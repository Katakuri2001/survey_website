import { Hono } from 'hono';
import { z } from 'zod';
import type { AppContext } from '../types';
import { ErrorCode, failure, logEvent, success } from '../lib/http';
import { adminMiddleware, authMiddleware, createGuestResumeToken, hashGuestResumeToken } from '../lib/auth';
import { enforceRateLimit, invalidateSettingsCache } from '../lib/security';
import { generateId, isoTimestamp } from '../lib/ids';
import { logAudit } from '../lib/audit';
import {
  deliveryStatusSchema,
  exportPaginationSchema,
  paginationSchema,
  productCreateSchema,
  productUpdateSchema,
  questionCreateSchema,
  questionUpdateSchema,
  readJson,
  readQuery,
  rewardCreateSchema,
  rewardUpdateSchema,
  settingsUpdateSchema,
  shopCreateSchema,
  shopRewardCreateSchema,
  shopRewardUpdateSchema,
  shopStockAdjustSchema,
  shopUpdateSchema,
  stockAdjustSchema,
  surveyVersionCreateSchema,
  surveyVersionStatusSchema,
  winningConfigSchema,
} from '../lib/validation';

export const adminRoutes = new Hono<AppContext>();

// Every admin route requires a valid token AND a live is_admin check.
adminRoutes.use('*', authMiddleware, adminMiddleware);
adminRoutes.use('*', async (c, next) => {
  const limited = await enforceRateLimit(c, 'admin', c.get('userId'), { limit: 240, windowSeconds: 60 });
  if (limited) return limited;
  await next();
});

const searchPaginationSchema = paginationSchema.extend({ search: z.string().trim().max(200).optional() });
const deliveriesQuerySchema = paginationSchema.extend({
  status: z.enum(['DELIVERY_SUBMITTED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']).optional(),
});
const responsesQuerySchema = paginationSchema.extend({
  productId: z.string().trim().max(100).optional(),
  status: z.string().trim().max(32).optional(),
});
const exportQuerySchema = exportPaginationSchema.extend({
  days: z.coerce.number().int().min(1).max(3650).default(30),
  sortBy: z.enum(['created_at', 'completed_at']).catch('created_at'),
});

// ============================================================
// Dashboard
// ============================================================

adminRoutes.get('/dashboard', async (c) => {
  const db = c.env.survey_db;
  const [totalUsers, completedSurveys, totalRewards, pendingDeliveries, deliveredRewards, activeProducts] =
    await Promise.all([
      db.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 0').first<{ count: number }>(),
      db.prepare("SELECT COUNT(*) as count FROM survey_responses WHERE status = 'COMPLETED'").first<{ count: number }>(),
      db.prepare('SELECT COUNT(*) as count FROM user_rewards').first<{ count: number }>(),
      db
        .prepare("SELECT COUNT(*) as count FROM user_rewards WHERE delivery_status = 'DELIVERY_SUBMITTED'")
        .first<{ count: number }>(),
      db.prepare("SELECT COUNT(*) as count FROM user_rewards WHERE delivery_status = 'DELIVERED'").first<{ count: number }>(),
      db.prepare('SELECT COUNT(*) as count FROM products WHERE is_active = 1').first<{ count: number }>(),
    ]);

  const participants = totalUsers?.count || 0;
  const completed = completedSurveys?.count || 0;
  return success(c, {
    totalParticipants: participants,
    completedSurveys: completed,
    completionRate: participants > 0 ? Math.round((completed / participants) * 100) : 0,
    totalRewardsAwarded: totalRewards?.count || 0,
    pendingDeliveries: pendingDeliveries?.count || 0,
    deliveredRewards: deliveredRewards?.count || 0,
    activeProducts: activeProducts?.count || 0,
  });
});

// ============================================================
// Analytics
// ============================================================

adminRoutes.get('/analytics/popularity', async (c) => {
  const rows = await c.env.survey_db
    .prepare(
      `SELECT p.id, p.name,
              COUNT(sr.id) as response_count,
              ROUND(COUNT(sr.id) * 100.0 / NULLIF((SELECT COUNT(*) FROM survey_responses WHERE status = 'COMPLETED'), 0), 1) as percentage
       FROM products p
       LEFT JOIN survey_responses sr ON p.id = sr.product_id AND sr.status = 'COMPLETED'
       WHERE p.is_active = 1
       GROUP BY p.id, p.name
       ORDER BY response_count DESC`
    )
    .all();
  return success(c, rows.results || []);
});

adminRoutes.get('/analytics/ratings', async (c) => {
  const productId = c.req.query('productId');
  const params: unknown[] = [];
  let query = `
    SELECT p.id, p.name,
           ROUND(AVG(sa.answer_rating), 2) as avg_rating,
           COUNT(DISTINCT sr.id) as response_count
    FROM products p
    JOIN survey_responses sr ON p.id = sr.product_id AND sr.status = 'COMPLETED'
    JOIN survey_answers sa ON sr.id = sa.response_id
    WHERE sa.answer_rating IS NOT NULL`;
  if (productId) {
    query += ' AND p.id = ?';
    params.push(productId);
  }
  query += ' GROUP BY p.id, p.name ORDER BY avg_rating DESC';
  const rows = await c.env.survey_db.prepare(query).bind(...params).all();
  return success(c, rows.results || []);
});

adminRoutes.get('/analytics/age-groups', async (c) => {
  const productId = c.req.query('productId');
  const params: unknown[] = [];
  let query = `
    SELECT u.age_group, p.name as product_name,
           ROUND(AVG(sa.answer_rating), 2) as avg_rating,
           COUNT(DISTINCT sr.id) as response_count
    FROM survey_responses sr
    JOIN users u ON sr.user_id = u.id
    JOIN products p ON sr.product_id = p.id
    JOIN survey_answers sa ON sr.id = sa.response_id
    WHERE sr.status = 'COMPLETED' AND sa.answer_rating IS NOT NULL AND u.age_group IS NOT NULL`;
  if (productId) {
    query += ' AND p.id = ?';
    params.push(productId);
  }
  query += ' GROUP BY u.age_group, p.name ORDER BY u.age_group, p.name';
  const rows = await c.env.survey_db.prepare(query).bind(...params).all();
  return success(c, rows.results || []);
});

adminRoutes.get('/analytics/comparison', async (c) => {
  const rows = await c.env.survey_db
    .prepare(
      `SELECT p.id, p.name,
              COUNT(DISTINCT sr.id) as total_responses,
              ROUND(AVG(CASE WHEN sa.answer_rating IS NOT NULL THEN sa.answer_rating END), 2) as avg_rating,
              ROUND(AVG(CASE WHEN sq.question_text LIKE '%Taste%' THEN sa.answer_rating END), 2) as taste_rating,
              ROUND(AVG(CASE WHEN sq.question_text LIKE '%Packaging%' THEN sa.answer_rating END), 2) as packaging_rating,
              ROUND(AVG(CASE WHEN sq.question_text LIKE '%Value%' THEN sa.answer_rating END), 2) as value_rating,
              ROUND(SUM(CASE WHEN sa.answer_choice LIKE '%Definitely yes%' OR sa.answer_choice LIKE '%Probably yes%' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(DISTINCT sr.id), 0), 1) as recommendation_rate
       FROM products p
       LEFT JOIN survey_responses sr ON p.id = sr.product_id AND sr.status = 'COMPLETED'
       LEFT JOIN survey_answers sa ON sr.id = sa.response_id
       LEFT JOIN survey_questions sq ON sa.question_id = sq.id
       WHERE p.is_active = 1
       GROUP BY p.id, p.name
       ORDER BY total_responses DESC`
    )
    .all();
  return success(c, rows.results || []);
});

adminRoutes.get('/analytics/trend', async (c) => {
  const period = Math.min(365, Math.max(1, parseInt(c.req.query('period') || '30', 10) || 30));
  const rows = await c.env.survey_db
    .prepare(
      `SELECT date(created_at) as date, COUNT(*) as count
       FROM survey_responses
       WHERE status = 'COMPLETED' AND created_at >= datetime('now', '-' || ? || ' days')
       GROUP BY date(created_at)
       ORDER BY date`
    )
    .bind(period)
    .all();
  return success(c, rows.results || []);
});

// ============================================================
// Survey management
// ============================================================

adminRoutes.get('/survey/questions', async (c) => {
  const db = c.env.survey_db;
  const rows = await db
    .prepare(
      `SELECT q.*, sv.title as version_title, p.name as product_name,
              (SELECT COUNT(*) FROM survey_options WHERE question_id = q.id AND is_active = 1) as option_count
       FROM survey_questions q
       JOIN survey_versions sv ON q.survey_version_id = sv.id
       JOIN products p ON sv.product_id = p.id
       ORDER BY sv.created_at DESC, q.display_order`
    )
    .all<Record<string, unknown>>();
  const result = rows.results || [];
  if (!result.length) return success(c, []);

  const placeholders = result.map(() => '?').join(',');
  const ids = result.map((row) => String(row.id));
  const [options, translations] = await Promise.all([
    db
      .prepare(
        `SELECT o.*, ot.language AS translation_language, ot.option_text AS translated_text
         FROM survey_options o
         LEFT JOIN survey_option_translations ot ON ot.option_id = o.id
         WHERE o.question_id IN (${placeholders}) AND o.is_active = 1
         ORDER BY o.display_order`
      )
      .bind(...ids)
      .all<Record<string, unknown>>(),
    db
      .prepare(
        `SELECT * FROM survey_question_translations
         WHERE question_id IN (${placeholders})`
      )
      .bind(...ids)
      .all<Record<string, unknown>>(),
  ]);
  const optionsByQuestion = new Map<string, Record<string, unknown>[]>();
  for (const option of options.results || []) {
    const list = optionsByQuestion.get(String(option.question_id)) || [];
    list.push(option);
    optionsByQuestion.set(String(option.question_id), list);
  }
  const translationsByQuestion = new Map<string, Record<string, unknown>>();
  for (const translation of translations.results || []) {
    translationsByQuestion.set(`${translation.question_id}:${translation.language}`, translation);
  }
  return success(
    c,
    result.map((row) => ({
      ...row,
      options: optionsByQuestion.get(String(row.id)) || [],
      translations: Object.fromEntries(
        [...translationsByQuestion.entries()]
          .filter(([key]) => key.startsWith(`${row.id}:`))
          .map(([key, value]) => [key.slice(String(row.id).length + 1), value.question_text])
      ),
    }))
  );
});

adminRoutes.post('/survey/questions', async (c) => {
  const parsed = await readJson(c, questionCreateSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const db = c.env.survey_db;
  const id = generateId();

  let order = body.displayOrder;
  if (order === undefined) {
    const maxOrder = await db
      .prepare('SELECT MAX(display_order) as m FROM survey_questions WHERE survey_version_id = ?')
      .bind(body.surveyVersionId)
      .first<{ m: number | null }>();
    order = (maxOrder?.m ?? -1) + 1;
  }

  const statements = [
    db
      .prepare(
        `INSERT INTO survey_questions (id, survey_version_id, question_text, question_type, is_required, display_order, validation_rules, image_url, product_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        body.surveyVersionId,
        body.questionText,
        body.questionType,
        body.isRequired === false ? 0 : 1,
        order,
        body.validationRules || null,
        body.imageUrl || null,
        body.productType || 'none'
      ),
  ];
  for (const [lang, text] of Object.entries(body.translations || {})) {
    if (!text) continue;
    statements.push(
      db
        .prepare('INSERT INTO survey_question_translations (id, question_id, language, question_text) VALUES (?, ?, ?, ?)')
        .bind(generateId(), id, lang, text)
    );
  }
  for (const [index, option] of (body.options || []).entries()) {
    const optionId = generateId();
    statements.push(
      db
        .prepare('INSERT INTO survey_options (id, question_id, option_text, option_value, display_order) VALUES (?, ?, ?, ?, ?)')
        .bind(optionId, id, option.text, option.value || option.text, option.displayOrder ?? index)
    );
    for (const [lang, text] of Object.entries(option.translations || {})) {
      if (!text) continue;
      statements.push(
        db
          .prepare('INSERT INTO survey_option_translations (id, option_id, language, option_text) VALUES (?, ?, ?, ?)')
          .bind(generateId(), optionId, lang, text)
      );
    }
  }
  await db.batch(statements);
  await logAudit(c, 'CREATE', 'question', id, { questionText: body.questionText });
  return success(c, { id, message: 'Question created' });
});

adminRoutes.patch('/survey/questions/:id', async (c) => {
  const parsed = await readJson(c, questionUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const id = c.req.param('id');
  const db = c.env.survey_db;
  const current = await db
    .prepare('SELECT question_type FROM survey_questions WHERE id = ?')
    .bind(id)
    .first<{ question_type: string }>();
  if (!current) return failure(c, ErrorCode.NOT_FOUND, 'Question not found');
  const effectiveType = body.questionType || current.question_type;
  const choiceType = ['single_choice', 'multiple_choice', 'dropdown'].includes(effectiveType);
  if (choiceType && !body.options) {
    return failure(c, ErrorCode.VALIDATION_FAILED, 'Choice questions require options', 422);
  }

  const result = await db
    .prepare(
      `UPDATE survey_questions SET
         question_text = COALESCE(?, question_text),
         question_type = COALESCE(?, question_type),
         is_required = COALESCE(?, is_required),
         display_order = COALESCE(?, display_order),
         is_active = COALESCE(?, is_active),
         validation_rules = COALESCE(?, validation_rules),
         image_url = COALESCE(?, image_url),
         product_type = COALESCE(?, product_type),
         updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(
      body.questionText ?? null,
      body.questionType ?? null,
      body.isRequired ?? null,
      body.displayOrder ?? null,
      body.isActive ?? null,
      body.validationRules ?? null,
      body.imageUrl ?? null,
      body.productType ?? null,
      id
    )
    .run();
  if (result.meta.changes !== 1) return failure(c, ErrorCode.NOT_FOUND, 'Question not found');

  const statements = [];
  for (const [lang, text] of Object.entries(body.translations || {})) {
    statements.push(
      db
        .prepare('DELETE FROM survey_question_translations WHERE question_id = ? AND language = ?')
        .bind(id, lang)
    );
    if (text) {
      statements.push(
        db
          .prepare('INSERT INTO survey_question_translations (id, question_id, language, question_text) VALUES (?, ?, ?, ?)')
          .bind(generateId(), id, lang, text)
      );
    }
  }
  if (body.options) {
    statements.push(
      db.prepare('UPDATE survey_options SET is_active = 0 WHERE question_id = ?').bind(id)
    );
    for (const [index, option] of body.options.entries()) {
      const optionId = generateId();
      statements.push(
        db
          .prepare('INSERT INTO survey_options (id, question_id, option_text, option_value, display_order) VALUES (?, ?, ?, ?, ?)')
          .bind(optionId, id, option.text, option.value || option.text, option.displayOrder ?? index)
      );
      for (const [lang, text] of Object.entries(option.translations || {})) {
        statements.push(
          db
            .prepare('DELETE FROM survey_option_translations WHERE option_id = ? AND language = ?')
            .bind(optionId, lang)
        );
        if (text) {
          statements.push(
            db
              .prepare('INSERT INTO survey_option_translations (id, option_id, language, option_text) VALUES (?, ?, ?, ?)')
              .bind(generateId(), optionId, lang, text)
          );
        }
      }
    }
  }
  if (statements.length) await db.batch(statements);
  await logAudit(c, 'UPDATE', 'question', id, { questionText: body.questionText, isActive: body.isActive });
  return success(c, { message: 'Question updated' });
});

adminRoutes.delete('/survey/questions/:id', async (c) => {
  const id = c.req.param('id');
  const result = await c.env.survey_db
    .prepare('UPDATE survey_questions SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?')
    .bind(id)
    .run();
  if (result.meta.changes !== 1) return failure(c, ErrorCode.NOT_FOUND, 'Question not found');
  await logAudit(c, 'DEACTIVATE', 'question', id);
  return success(c, { message: 'Question removed from the active survey' });
});

adminRoutes.get('/survey/versions', async (c) => {
  const rows = await c.env.survey_db
    .prepare(
      `SELECT sv.*, p.name as product_name,
              (SELECT COUNT(*) FROM survey_questions WHERE survey_version_id = sv.id AND is_active = 1) as question_count,
              (SELECT COUNT(*) FROM survey_responses WHERE survey_version_id = sv.id) as response_count
       FROM survey_versions sv
       JOIN products p ON sv.product_id = p.id
       ORDER BY sv.created_at DESC`
    )
    .all();
  return success(c, rows.results || []);
});

adminRoutes.post('/survey/versions', async (c) => {
  const parsed = await readJson(c, surveyVersionCreateSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const db = c.env.survey_db;

  const lastVersion = await db
    .prepare('SELECT MAX(version) as max_version FROM survey_versions WHERE product_id = ?')
    .bind(body.productId)
    .first<{ max_version: number | null }>();
  const versionNumber = (lastVersion?.max_version || 0) + 1;
  const id = generateId();
  const sourceId = body.cloneFromVersionId || (
    await db
      .prepare('SELECT id FROM survey_versions WHERE product_id = ? ORDER BY version DESC LIMIT 1')
      .bind(body.productId)
      .first<{ id: string }>()
  )?.id || null;
  if (body.cloneFromVersionId && sourceId !== body.cloneFromVersionId) {
    return failure(c, ErrorCode.VALIDATION_FAILED, 'Source version not found for this product', 422);
  }

  const sourceQuestions = sourceId
    ? await db
        .prepare('SELECT * FROM survey_questions WHERE survey_version_id = ? AND is_active = 1 ORDER BY display_order')
        .bind(sourceId)
        .all<Record<string, unknown>>()
    : { results: [] as Record<string, unknown>[] };
  if (body.activate && sourceQuestions.results.length === 0) {
    return failure(c, ErrorCode.VALIDATION_FAILED, 'Cannot activate an empty survey version', 422);
  }

  const statements = [
    db
      .prepare('INSERT INTO survey_versions (id, product_id, version, title, description, is_active) VALUES (?, ?, ?, ?, ?, 0)')
      .bind(id, body.productId, versionNumber, body.title, body.description || null),
  ];
  for (const [lang, data] of Object.entries(body.translations || {})) {
    if (!data?.title) continue;
    statements.push(
      db
        .prepare('INSERT INTO survey_version_translations (id, version_id, language, title, description) VALUES (?, ?, ?, ?, ?)')
        .bind(generateId(), id, lang, data.title, data.description || null)
    );
  }
  for (const source of sourceQuestions.results) {
    const questionId = generateId();
    statements.push(
      db
        .prepare(
          `INSERT INTO survey_questions
             (id, survey_version_id, question_text, question_type, is_required, display_order, is_active, validation_rules, image_url, product_type)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
        )
        .bind(
          questionId,
          id,
          source.question_text,
          source.question_type,
          source.is_required,
          source.display_order,
          source.validation_rules,
          source.image_url,
          source.product_type
        )
    );
    const optionRows = await db
      .prepare('SELECT * FROM survey_options WHERE question_id = ? AND is_active = 1 ORDER BY display_order')
      .bind(String(source.id))
      .all<Record<string, unknown>>();
    for (const option of optionRows.results || []) {
      const optionId = generateId();
      statements.push(
        db
          .prepare('INSERT INTO survey_options (id, question_id, option_text, option_value, display_order) VALUES (?, ?, ?, ?, ?)')
          .bind(optionId, questionId, option.option_text, option.option_value, option.display_order)
      );
    }
  }
  await db.batch(statements);
  if (body.activate) {
    await db.batch([
      db.prepare('UPDATE survey_versions SET is_active = 0 WHERE id != ?').bind(id),
      db.prepare('UPDATE survey_versions SET is_active = 1, updated_at = datetime(\'now\') WHERE id = ?').bind(id),
    ]);
  }
  await logAudit(c, 'CREATE', 'survey_version', id, { productId: body.productId, title: body.title, version: versionNumber, activate: body.activate });
  return success(c, { id, version: versionNumber, active: body.activate, message: 'Survey version created' });
});

adminRoutes.patch('/survey/versions/:id/status', async (c) => {
  const parsed = await readJson(c, surveyVersionStatusSchema);
  if (!parsed.ok) return parsed.response;
  const id = c.req.param('id');
  const db = c.env.survey_db;
  const version = await db
    .prepare('SELECT id, product_id FROM survey_versions WHERE id = ?')
    .bind(id)
    .first<{ id: string; product_id: string }>();
  if (!version) return failure(c, ErrorCode.NOT_FOUND, 'Survey version not found');
  if (parsed.data.isActive) {
    const count = await db
      .prepare('SELECT COUNT(*) as count FROM survey_questions WHERE survey_version_id = ? AND is_active = 1')
      .bind(id)
      .first<{ count: number }>();
    if (!count?.count) return failure(c, ErrorCode.VALIDATION_FAILED, 'Cannot activate an empty survey version', 422);
    await db.batch([
      db.prepare('UPDATE survey_versions SET is_active = 0 WHERE id != ?').bind(id),
      db.prepare('UPDATE survey_versions SET is_active = 1, updated_at = datetime(\'now\') WHERE id = ?').bind(id),
    ]);
  } else {
    await db.prepare('UPDATE survey_versions SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?').bind(id).run();
  }
  await logAudit(c, 'UPDATE', 'survey_version', id, { isActive: parsed.data.isActive });
  return success(c, { message: 'Survey version status updated', isActive: parsed.data.isActive });
});

// ============================================================
// Products
// ============================================================

adminRoutes.get('/products', async (c) => {
  const rows = await c.env.survey_db
    .prepare(
      `SELECT p.*,
              (SELECT COUNT(*) FROM survey_responses WHERE product_id = p.id AND status = 'COMPLETED') as response_count
       FROM products p
       ORDER BY p.display_order`
    )
    .all();
  return success(c, rows.results || []);
});

adminRoutes.post('/products', async (c) => {
  const parsed = await readJson(c, productCreateSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const db = c.env.survey_db;
  const id = generateId();

  await db
    .prepare('INSERT INTO products (id, name, description, brand, image_url, display_order) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, body.name, body.description || null, body.brand || null, body.imageUrl || null, body.displayOrder ?? 0)
    .run();

  if (body.translations) {
    for (const [lang, data] of Object.entries(body.translations)) {
      if (data?.name) {
        await db
          .prepare('INSERT INTO product_translations (id, product_id, language, name, description) VALUES (?, ?, ?, ?, ?)')
          .bind(generateId(), id, lang, data.name, data.description || null)
          .run();
      }
    }
  }

  await logAudit(c, 'CREATE', 'product', id, { name: body.name });
  return success(c, { id, message: 'Product created' });
});

adminRoutes.patch('/products/:id', async (c) => {
  const parsed = await readJson(c, productUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const id = c.req.param('id');
  const db = c.env.survey_db;

  const result = await db
    .prepare(
      `UPDATE products SET
         name = COALESCE(?, name),
         description = COALESCE(?, description),
         brand = COALESCE(?, brand),
         image_url = COALESCE(?, image_url),
         display_order = COALESCE(?, display_order),
         is_active = COALESCE(?, is_active),
         updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(
      body.name ?? null,
      body.description ?? null,
      body.brand ?? null,
      body.imageUrl ?? null,
      body.displayOrder ?? null,
      body.isActive ?? null,
      id
    )
    .run();
  if (result.meta.changes !== 1) return failure(c, ErrorCode.NOT_FOUND, 'Product not found');

  if (body.translations) {
    for (const [lang, data] of Object.entries(body.translations)) {
      if (data?.name) {
        await db
          .prepare('INSERT OR REPLACE INTO product_translations (id, product_id, language, name, description) VALUES (?, ?, ?, ?, ?)')
          .bind(generateId(), id, lang, data.name, data.description || null)
          .run();
      }
    }
  }

  await logAudit(c, 'UPDATE', 'product', id, { name: body.name, isActive: body.isActive });
  return success(c, { message: 'Product updated' });
});

// ============================================================
// Rewards
// ============================================================

adminRoutes.get('/rewards', async (c) => {
  const rows = await c.env.survey_db
    .prepare(
      `SELECT r.*,
              (SELECT COUNT(*) FROM user_rewards WHERE reward_id = r.id) as rewarded_count,
              (SELECT COUNT(*) FROM user_rewards WHERE reward_id = r.id AND delivery_status = 'DELIVERED') as delivered_count
       FROM rewards r
       ORDER BY r.created_at DESC`
    )
    .all();
  return success(c, rows.results || []);
});

adminRoutes.post('/rewards', async (c) => {
  const parsed = await readJson(c, rewardCreateSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const db = c.env.survey_db;
  const id = generateId();

  await db
    .prepare(
      `INSERT INTO rewards (id, name, description, image_url, total_quantity, remaining_quantity, weight, low_stock_threshold, campaign_id, winning_ratio, requires_delivery, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      body.name,
      body.description || null,
      body.imageUrl || null,
      body.totalQuantity,
      body.totalQuantity,
      body.weight ?? 10,
      body.lowStockThreshold ?? 10,
      body.campaignId || null,
      body.winningRatio ?? null,
      body.requiresDelivery === false ? 0 : 1,
      body.totalQuantity <= 0
        ? 'EXHAUSTED'
        : body.totalQuantity <= (body.lowStockThreshold ?? 10)
          ? 'LOW_STOCK'
          : 'AVAILABLE'
    )
    .run();

  await db
    .prepare(
      `INSERT INTO reward_inventory_transactions (id, reward_id, type, quantity, notes, created_by)
       VALUES (?, ?, 'INITIAL_STOCK', ?, 'Initial stock', ?)`
    )
    .bind(generateId(), id, body.totalQuantity, c.get('userId'))
    .run();

  if (body.translations) {
    for (const [lang, data] of Object.entries(body.translations)) {
      if (data?.name) {
        await db
          .prepare('INSERT INTO reward_translations (id, reward_id, language, name, description) VALUES (?, ?, ?, ?, ?)')
          .bind(generateId(), id, lang, data.name, data.description || null)
          .run();
      }
    }
  }

  await logAudit(c, 'CREATE', 'reward', id, { name: body.name });
  return success(c, { id, message: 'Reward created' });
});

adminRoutes.patch('/rewards/:id', async (c) => {
  const parsed = await readJson(c, rewardUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const id = c.req.param('id');
  const db = c.env.survey_db;

  const hasTotal = Object.prototype.hasOwnProperty.call(body, 'totalQuantity');
  const hasRatio = Object.prototype.hasOwnProperty.call(body, 'winningRatio');
  const needsStock = hasTotal || body.status !== undefined || body.lowStockThreshold !== undefined;
  const current = needsStock
    ? await db
        .prepare('SELECT total_quantity, remaining_quantity, low_stock_threshold, status FROM rewards WHERE id = ?')
        .bind(id)
        .first<{ total_quantity: number; remaining_quantity: number; low_stock_threshold: number; status: string }>()
    : null;
  if (needsStock && !current) return failure(c, ErrorCode.NOT_FOUND, 'Reward not found');

  let totalToSave: number | null = null;
  let remainingToSave: number | null = null;
  let statusToSave: string | null = null;
  if (current) {
    const awarded = Math.max(0, current.total_quantity - current.remaining_quantity);
    if (hasTotal) {
      totalToSave = body.totalQuantity!;
      remainingToSave = totalToSave - awarded;
      if (remainingToSave < 0) {
        return failure(c, ErrorCode.INVALID_REQUEST, 'Total quantity cannot be lower than awarded quantity', 422);
      }
    } else {
      remainingToSave = current.remaining_quantity;
    }
    const threshold = body.lowStockThreshold ?? current.low_stock_threshold;
    const derived = remainingToSave! <= 0
      ? 'EXHAUSTED'
      : remainingToSave! <= threshold
        ? 'LOW_STOCK'
        : 'AVAILABLE';
    statusToSave = body.status === 'PAUSED' || (!body.status && current.status === 'PAUSED')
      ? 'PAUSED'
      : derived;
  }

  const updateResult = await db
    .prepare(
      `UPDATE rewards SET
         name = COALESCE(?, name),
         description = COALESCE(?, description),
         image_url = COALESCE(?, image_url),
         total_quantity = CASE WHEN ? = 1 THEN ? ELSE total_quantity END,
         remaining_quantity = CASE WHEN ? = 1 THEN ? ELSE remaining_quantity END,
         weight = COALESCE(?, weight),
         low_stock_threshold = COALESCE(?, low_stock_threshold),
         is_active = COALESCE(?, is_active),
         status = CASE WHEN ? = 1 THEN ? ELSE status END,
         campaign_id = COALESCE(?, campaign_id),
         winning_ratio = CASE WHEN ? = 1 THEN ? ELSE winning_ratio END,
         requires_delivery = COALESCE(?, requires_delivery),
         updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(
      body.name ?? null,
      body.description ?? null,
      body.imageUrl ?? null,
      hasTotal ? 1 : 0,
      totalToSave,
      hasTotal ? 1 : 0,
      remainingToSave,
      body.weight ?? null,
      body.lowStockThreshold ?? null,
      body.isActive ?? null,
      needsStock ? 1 : 0,
      statusToSave,
      body.campaignId ?? null,
      hasRatio ? 1 : 0,
      hasRatio ? body.winningRatio : null,
      body.requiresDelivery ?? null,
      id
    )
    .run();
  if (updateResult.meta.changes !== 1) return failure(c, ErrorCode.NOT_FOUND, 'Reward not found');

  if (body.translations) {
    for (const [lang, data] of Object.entries(body.translations)) {
      if (data?.name) {
        await db
          .prepare('INSERT OR REPLACE INTO reward_translations (id, reward_id, language, name, description) VALUES (?, ?, ?, ?, ?)')
          .bind(generateId(), id, lang, data.name, data.description || null)
          .run();
      }
    }
  }

  if (hasTotal && current && remainingToSave !== current.remaining_quantity) {
    await db
      .prepare(
        `INSERT INTO reward_inventory_transactions (id, reward_id, type, quantity, notes, created_by)
         VALUES (?, ?, 'MANUAL_ADJUSTMENT', ?, 'Total quantity updated', ?)`
      )
      .bind(generateId(), id, remainingToSave! - current.remaining_quantity, c.get('userId'))
      .run();
  }

  await logAudit(c, 'UPDATE', 'reward', id, { name: body.name, status: body.status, isActive: body.isActive });
  return success(c, { message: 'Reward updated' });
});

adminRoutes.get('/rewards/inventory', async (c) => {
  const db = c.env.survey_db;
  const inventory = await db
    .prepare(
      `SELECT r.id, r.name, r.total_quantity, r.remaining_quantity, r.status, r.low_stock_threshold,
              (r.total_quantity - r.remaining_quantity) as rewarded_count,
              (SELECT COUNT(*) FROM user_rewards WHERE reward_id = r.id AND delivery_status = 'DELIVERED') as delivered_count,
              (SELECT COUNT(*) FROM user_rewards WHERE reward_id = r.id AND delivery_status IN ('DELIVERY_PENDING', 'DELIVERY_SUBMITTED')) as pending_count,
              ROUND((r.total_quantity - r.remaining_quantity) * 100.0 / NULLIF(r.total_quantity, 0), 1) as utilization_rate
       FROM rewards r
       ORDER BY r.name`
    )
    .all();

  const summary = await db
    .prepare(
      `SELECT
         SUM(total_quantity) as total_stock,
         SUM(total_quantity - remaining_quantity) as total_rewarded,
         SUM(remaining_quantity) as total_remaining,
         (SELECT COUNT(*) FROM user_rewards WHERE delivery_status = 'DELIVERED') as total_delivered,
         (SELECT COUNT(*) FROM user_rewards WHERE delivery_status IN ('DELIVERY_PENDING', 'DELIVERY_SUBMITTED')) as total_pending
       FROM rewards`
    )
    .first();

  return success(c, { rewards: inventory.results || [], summary });
});

adminRoutes.patch('/rewards/:id/stock', async (c) => {
  const parsed = await readJson(c, stockAdjustSchema);
  if (!parsed.ok) return parsed.response;
  const { adjustment, reason } = parsed.data;
  const id = c.req.param('id');
  const db = c.env.survey_db;

  const reward = await db
    .prepare('SELECT remaining_quantity FROM rewards WHERE id = ?')
    .bind(id)
    .first<{ remaining_quantity: number }>();
  if (!reward) return failure(c, ErrorCode.NOT_FOUND, 'Reward not found');

  // Conditional update prevents a concurrent spin from driving stock negative,
  // and re-derives status from the new quantity so EXHAUSTED/LOW_STOCK always
  // match stock (PAUSED stays sticky — resume via PATCH /rewards/:id).
  const result = await db
    .prepare(
      `UPDATE rewards SET
         total_quantity = total_quantity + ?,
         remaining_quantity = remaining_quantity + ?,
         status = CASE
           WHEN status = 'PAUSED' THEN 'PAUSED'
           WHEN remaining_quantity + ? <= 0 THEN 'EXHAUSTED'
           WHEN remaining_quantity + ? <= low_stock_threshold THEN 'LOW_STOCK'
           ELSE 'AVAILABLE'
         END,
         updated_at = datetime('now')
       WHERE id = ?
         AND total_quantity + ? >= (total_quantity - remaining_quantity)
         AND remaining_quantity + ? >= 0`
    )
    .bind(adjustment, adjustment, adjustment, adjustment, id, adjustment, adjustment)
    .run();
  if (result.meta.changes !== 1) {
    return failure(c, ErrorCode.INVALID_REQUEST, 'Cannot reduce below zero');
  }

  await db
    .prepare(
      `INSERT INTO reward_inventory_transactions (id, reward_id, type, quantity, notes, created_by)
       VALUES (?, ?, 'MANUAL_ADJUSTMENT', ?, ?, ?)`
    )
    .bind(generateId(), id, adjustment, reason || 'Manual adjustment', c.get('userId'))
    .run();

  await logAudit(c, 'UPDATE', 'reward', id, { action: 'stock_adjustment', adjustment, reason });

  const updated = await db
    .prepare('SELECT remaining_quantity FROM rewards WHERE id = ?')
    .bind(id)
    .first<{ remaining_quantity: number }>();
  return success(c, { message: 'Stock adjusted', newQuantity: updated?.remaining_quantity ?? 0 });
});

adminRoutes.get('/rewards/history', async (c) => {
  const parsed = readQuery(c, paginationSchema);
  if (!parsed.ok) return parsed.response;
  const { limit, offset } = parsed.data;

  const history = await c.env.survey_db
    .prepare(
      `SELECT ur.id, ur.delivery_status, ur.won_at, ur.delivered_at,
              u.full_name as user_name, u.email as user_email,
              r.name as reward_name, p.name as product_name
       FROM user_rewards ur
       JOIN users u ON ur.user_id = u.id
       JOIN rewards r ON ur.reward_id = r.id
       LEFT JOIN reward_spins rs ON ur.reward_spin_id = rs.id
       LEFT JOIN products p ON rs.product_id = p.id
       ORDER BY ur.won_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(limit, offset)
    .all();

  const total = await c.env.survey_db.prepare('SELECT COUNT(*) as count FROM user_rewards').first<{ count: number }>();
  return success(c, { history: history.results || [], total: total?.count || 0 });
});

// ============================================================
// Exports
// ============================================================

adminRoutes.get('/surveys/export', async (c) => {
  const parsed = readQuery(c, exportPaginationSchema);
  if (!parsed.ok) return parsed.response;
  const { limit, offset } = parsed.data;

  const data = await c.env.survey_db
    .prepare(
      `SELECT ur.id, u.full_name, u.email, u.phone,
              r.name as reward_name, r.image_url as reward_image_url,
              ur.won_at, ur.delivery_status, ur.delivered_at,
              sr.id as survey_response_id, sr.language, sr.completed_at,
              sq.question_text, sa.answer_text, sa.answer_choice, sa.answer_number, sa.answer_rating
       FROM user_rewards ur
       JOIN users u ON ur.user_id = u.id
       JOIN rewards r ON ur.reward_id = r.id
       JOIN reward_spins rs ON ur.reward_spin_id = rs.id
       LEFT JOIN survey_responses sr ON sr.user_id = u.id
       LEFT JOIN survey_answers sa ON sa.response_id = sr.id
       LEFT JOIN survey_questions sq ON sa.question_id = sq.id
       ORDER BY ur.won_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(limit, offset)
    .all();

  const total = await c.env.survey_db.prepare('SELECT COUNT(*) as count FROM user_rewards').first<{ count: number }>();
  return success(c, { data: data.results || [], total: total?.count || 0 });
});

adminRoutes.get('/users/export', async (c) => {
  const parsed = readQuery(c, exportQuerySchema);
  if (!parsed.ok) return parsed.response;
  const { days, limit, offset, sortBy } = parsed.data;

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = isoTimestamp(since);

  // sortBy is a validated enum; never interpolated from raw user input.
  const orderColumn = sortBy === 'completed_at' ? 'sr.completed_at' : 'u.created_at';

  const data = await c.env.survey_db
    .prepare(
      `SELECT
         u.id as user_id, u.full_name, u.email, u.phone, u.age, u.age_group, u.gender,
         u.city, u.township, u.occupation, u.created_at as user_created_at,
         sr.id as response_id, sr.product_id, p.name as product_name, sr.language,
         sr.status as response_status, sr.completed_at, sr.created_at as response_created_at,
         sq.id as question_id, sq.question_text, sq.question_type, sq.display_order as question_order,
         sa.answer_text, sa.answer_choice, sa.answer_number, sa.answer_rating
       FROM users u
       LEFT JOIN survey_responses sr ON u.id = sr.user_id AND sr.status = 'COMPLETED' AND sr.completed_at >= ?
       LEFT JOIN products p ON sr.product_id = p.id
       LEFT JOIN survey_answers sa ON sr.id = sa.response_id
       LEFT JOIN survey_questions sq ON sa.question_id = sq.id AND sq.is_active = 1
       WHERE u.is_admin = 0
       ORDER BY ${orderColumn} DESC
       LIMIT ? OFFSET ?`
    )
    .bind(sinceStr, limit, offset)
    .all();

  const total = await c.env.survey_db
    .prepare(
      `SELECT COUNT(DISTINCT u.id) as count
       FROM users u
       LEFT JOIN survey_responses sr ON u.id = sr.user_id AND sr.status = 'COMPLETED' AND sr.completed_at >= ?
       WHERE u.is_admin = 0`
    )
    .bind(sinceStr)
    .first<{ count: number }>();

  return success(c, { data: data.results || [], total: total?.count || 0 });
});

// ============================================================
// Deliveries
// ============================================================

adminRoutes.get('/deliveries', async (c) => {
  const parsed = readQuery(c, deliveriesQuerySchema);
  if (!parsed.ok) return parsed.response;
  const { limit, offset, status } = parsed.data;

  const params: unknown[] = [];
  let query = `
    SELECT ur.id, ur.delivery_status, ur.won_at, ur.delivered_at,
           u.full_name as user_name, u.email as user_email, u.phone as user_phone,
           r.name as reward_name, r.requires_delivery,
           di.full_name as delivery_name, di.phone as delivery_phone,
           di.address, di.city, di.township, di.postal_code
    FROM user_rewards ur
    JOIN users u ON ur.user_id = u.id
    JOIN rewards r ON ur.reward_id = r.id
    LEFT JOIN delivery_information di ON ur.id = di.user_reward_id
    WHERE ur.delivery_status != 'DELIVERY_PENDING'`;
  if (status) {
    query += ' AND ur.delivery_status = ?';
    params.push(status);
  }
  query += ' ORDER BY ur.won_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const deliveries = await c.env.survey_db.prepare(query).bind(...params).all();

  const total = await c.env.survey_db
    .prepare(
      `SELECT COUNT(*) as count FROM user_rewards
       WHERE delivery_status != 'DELIVERY_PENDING' ${status ? 'AND delivery_status = ?' : ''}`
    )
    .bind(...(status ? [status] : []))
    .first<{ count: number }>();

  return success(c, { deliveries: deliveries.results || [], total: total?.count || 0 });
});

adminRoutes.patch('/deliveries/:id/status', async (c) => {
  const parsed = await readJson(c, deliveryStatusSchema);
  if (!parsed.ok) return parsed.response;
  const { status } = parsed.data;
  const id = c.req.param('id');
  const db = c.env.survey_db;
  const current = await db
    .prepare(
      `SELECT ur.id, ur.reward_id, ur.delivery_status, ur.reward_spin_id, r.requires_delivery
       FROM user_rewards ur JOIN rewards r ON r.id = ur.reward_id WHERE ur.id = ?`
    )
    .bind(id)
    .first<{ id: string; reward_id: string; delivery_status: string; reward_spin_id: string; requires_delivery: number }>();
  if (!current) return failure(c, ErrorCode.NOT_FOUND, 'Delivery reward not found');
  if (current.delivery_status === status) {
    return success(c, { message: 'Delivery status already set', status });
  }
  const transitions: Record<string, string[]> = {
    DELIVERY_PENDING: ['CANCELLED'],
    DELIVERY_SUBMITTED: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['DELIVERED'],
    DELIVERED: [],
    CANCELLED: [],
  };
  if (!transitions[current.delivery_status]?.includes(status)) {
    return failure(c, ErrorCode.INVALID_STATE_TRANSITION, `Cannot transition delivery from ${current.delivery_status} to ${status}`, 409);
  }

  const now = new Date().toISOString();
  const statements = [
    db
      .prepare(
        `UPDATE user_rewards
         SET delivery_status = ?, delivered_at = CASE WHEN ? = 'DELIVERED' THEN ? ELSE delivered_at END,
             updated_at = ?
         WHERE id = ? AND delivery_status = ?`
      )
      .bind(status, status, now, now, id, current.delivery_status),
    db
      .prepare(
        `UPDATE reward_spins SET status = ?, updated_at = ?
         WHERE id = ? AND status NOT IN ('CANCELLED', 'DELIVERED')`
      )
      .bind(status, now, current.reward_spin_id),
  ];
  if (status === 'CANCELLED') {
    statements.push(
      db
        .prepare(
          `UPDATE rewards
           SET remaining_quantity = remaining_quantity + 1,
               total_quantity = total_quantity + 1,
               status = CASE
                 WHEN status = 'PAUSED' THEN 'PAUSED'
                 WHEN remaining_quantity + 1 <= 0 THEN 'EXHAUSTED'
                 WHEN remaining_quantity + 1 <= low_stock_threshold THEN 'LOW_STOCK'
                 ELSE 'AVAILABLE'
               END,
               updated_at = ?
           WHERE id = ? AND remaining_quantity < total_quantity`
        )
        .bind(now, current.reward_id),
      db
        .prepare(
          `INSERT INTO reward_inventory_transactions
             (id, reward_id, type, quantity, reference_type, reference_id, notes, created_by)
           VALUES (?, ?, 'CANCELLATION_RETURN', 1, 'user_reward', ?, 'Delivery cancelled', ?)`
        )
        .bind(generateId(), current.reward_id, id, c.get('userId'))
    );
  }
  const results = await db.batch(statements);
  if (results[0]?.meta.changes !== 1) {
    return failure(c, ErrorCode.INVALID_STATE_TRANSITION, 'Delivery status changed concurrently', 409);
  }
  await logAudit(c, 'DELIVERY_STATUS_CHANGED', 'user_reward', id, { from: current.delivery_status, newStatus: status });
  return success(c, { message: 'Delivery status updated', status });
});

// ============================================================
// Users
// ============================================================

adminRoutes.get('/users', async (c) => {
  const parsed = readQuery(c, searchPaginationSchema);
  if (!parsed.ok) return parsed.response;
  const { limit, offset, search } = parsed.data;

  const params: unknown[] = [];
  let query = `
    SELECT id, full_name, email, phone, age, age_group, gender, city, township, occupation, created_at, is_active,
           (SELECT COUNT(*) FROM survey_responses WHERE user_id = users.id AND status = 'COMPLETED') as survey_count,
           (SELECT COUNT(*) FROM user_rewards WHERE user_id = users.id) as reward_count
    FROM users WHERE is_admin = 0`;
  if (search) {
    query += ' AND (full_name LIKE ? OR email LIKE ? OR phone LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const users = await c.env.survey_db.prepare(query).bind(...params).all();

  const totalParams: unknown[] = [];
  let totalQuery = 'SELECT COUNT(*) as count FROM users WHERE is_admin = 0';
  if (search) {
    totalQuery += ' AND (full_name LIKE ? OR email LIKE ? OR phone LIKE ?)';
    const term = `%${search}%`;
    totalParams.push(term, term, term);
  }
  const total = await c.env.survey_db.prepare(totalQuery).bind(...totalParams).first<{ count: number }>();

  return success(c, { users: users.results || [], total: total?.count || 0 });
});

adminRoutes.get('/users/:id', async (c) => {
  const id = c.req.param('id');
  const db = c.env.survey_db;

  const user = await db
    .prepare(
      `SELECT id, full_name, email, phone, age, age_group, gender, city, township, nrc_state, nrc_type, nrc_number, occupation, created_at, is_active
       FROM users WHERE id = ?`
    )
    .bind(id)
    .first();
  if (!user) return failure(c, ErrorCode.NOT_FOUND, 'User not found');

  const [surveys, rewards] = await Promise.all([
    db
      .prepare(
        `SELECT sr.*, p.name as product_name, sv.title as version_title,
                (SELECT AVG(answer_rating) FROM survey_answers WHERE response_id = sr.id AND answer_rating IS NOT NULL) as avg_rating
         FROM survey_responses sr
         JOIN products p ON sr.product_id = p.id
         JOIN survey_versions sv ON sr.survey_version_id = sv.id
         WHERE sr.user_id = ?
         ORDER BY sr.created_at DESC`
      )
      .bind(id)
      .all(),
    db
      .prepare(
        `SELECT ur.*, r.name as reward_name
         FROM user_rewards ur
         JOIN rewards r ON ur.reward_id = r.id
         WHERE ur.user_id = ?
         ORDER BY ur.won_at DESC`
      )
      .bind(id)
      .all(),
  ]);

  return success(c, { user, surveys: surveys.results || [], rewards: rewards.results || [] });
});

adminRoutes.post('/users/:id/resume-token', async (c) => {
  const id = c.req.param('id');
  const db = c.env.survey_db;
  const user = await db
    .prepare('SELECT id, is_admin, is_active FROM users WHERE id = ?')
    .bind(id)
    .first<{ id: string; is_admin: number; is_active: number }>();
  if (!user) return failure(c, ErrorCode.NOT_FOUND, 'User not found');
  if (user.is_admin || !user.is_active) {
    return failure(c, ErrorCode.INVALID_REQUEST, 'Resume tokens can only be reset for active participant accounts', 422);
  }

  const resumeToken = createGuestResumeToken();
  const resumeHash = await hashGuestResumeToken(resumeToken);
  const result = await db
    .prepare(
      `UPDATE users SET guest_resume_token_hash = ?, token_version = token_version + 1, updated_at = datetime('now')
       WHERE id = ? AND is_active = 1`
    )
    .bind(resumeHash, id)
    .run();
  if (result.meta.changes !== 1) return failure(c, ErrorCode.NOT_FOUND, 'User not found');

  await logAudit(c, 'RESET_RESUME_TOKEN', 'user', id);
  // Returned exactly once so support can hand it to the verified participant.
  return success(c, { userId: id, resumeToken });
});

// ============================================================
// Responses
// ============================================================

adminRoutes.get('/responses', async (c) => {
  const parsed = readQuery(c, responsesQuerySchema);
  if (!parsed.ok) return parsed.response;
  const { limit, offset, productId, status } = parsed.data;

  const params: unknown[] = [];
  let query = `
    SELECT sr.*, u.full_name as user_name, u.age_group, u.gender,
           p.name as product_name, sv.title as version_title
    FROM survey_responses sr
    JOIN users u ON sr.user_id = u.id
    JOIN products p ON sr.product_id = p.id
    JOIN survey_versions sv ON sr.survey_version_id = sv.id
    WHERE 1=1`;
  if (productId) {
    query += ' AND sr.product_id = ?';
    params.push(productId);
  }
  if (status) {
    query += ' AND sr.status = ?';
    params.push(status);
  }
  query += ' ORDER BY sr.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const responses = await c.env.survey_db.prepare(query).bind(...params).all();

  const totalParams: unknown[] = [];
  let totalQuery = 'SELECT COUNT(*) as count FROM survey_responses WHERE 1=1';
  if (productId) {
    totalQuery += ' AND product_id = ?';
    totalParams.push(productId);
  }
  if (status) {
    totalQuery += ' AND status = ?';
    totalParams.push(status);
  }
  const total = await c.env.survey_db.prepare(totalQuery).bind(...totalParams).first<{ count: number }>();

  return success(c, { responses: responses.results || [], total: total?.count || 0 });
});

adminRoutes.get('/responses/:id', async (c) => {
  const id = c.req.param('id');
  const db = c.env.survey_db;

  const response = await db
    .prepare(
      `SELECT sr.*, u.full_name as user_name, u.age, u.age_group, u.gender, u.city, p.name as product_name
       FROM survey_responses sr
       JOIN users u ON sr.user_id = u.id
       JOIN products p ON sr.product_id = p.id
       WHERE sr.id = ?`
    )
    .bind(id)
    .first<{ language: string }>();
  if (!response) return failure(c, ErrorCode.NOT_FOUND, 'Response not found');

  const answers = await db
    .prepare(
      `SELECT sa.*, sq.question_text, sq.question_type,
              COALESCE(qt.question_text, sq.question_text) as translated_question
       FROM survey_answers sa
       JOIN survey_questions sq ON sa.question_id = sq.id
       LEFT JOIN survey_question_translations qt ON sq.id = qt.question_id AND qt.language = ?
       WHERE sa.response_id = ?
       ORDER BY sq.display_order`
    )
    .bind(response.language || 'en', id)
    .all();

  return success(c, { response, answers: answers.results || [] });
});

// ============================================================
// Audit log (read-only)
// ============================================================

adminRoutes.get('/audit-logs', async (c) => {
  const parsed = readQuery(c, paginationSchema.extend({ action: z.string().trim().max(64).optional() }));
  if (!parsed.ok) return parsed.response;
  const { limit, offset, action } = parsed.data;

  const params: unknown[] = [];
  let query = `
    SELECT al.id, al.action, al.resource_type, al.resource_id, al.metadata, al.created_at,
           u.full_name as admin_name, u.email as admin_email
    FROM audit_logs al
    LEFT JOIN users u ON al.admin_id = u.id`;
  if (action) {
    query += ' WHERE al.action = ?';
    params.push(action);
  }
  query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const logs = await c.env.survey_db.prepare(query).bind(...params).all();

  const totalParams: unknown[] = [];
  let totalQuery = 'SELECT COUNT(*) as count FROM audit_logs';
  if (action) {
    totalQuery += ' WHERE action = ?';
    totalParams.push(action);
  }
  const total = await c.env.survey_db.prepare(totalQuery).bind(...totalParams).first<{ count: number }>();

  return success(c, { logs: logs.results || [], total: total?.count || 0 });
});

// ============================================================
// Feature flags / maintenance mode
// ============================================================

adminRoutes.get('/settings', async (c) => {
  const rows = await c.env.survey_db
    .prepare('SELECT key, value, updated_at FROM settings ORDER BY key')
    .all<{ key: string; value: string; updated_at: string }>();
  const settings: Record<string, string> = {};
  for (const row of rows.results || []) settings[row.key] = row.value;
  return success(c, { settings, values: rows.results || [] });
});

adminRoutes.patch('/settings', async (c) => {
  const parsed = await readJson(c, settingsUpdateSchema);
  if (!parsed.ok) return parsed.response;

  const db = c.env.survey_db;
  const statements = Object.entries(parsed.data.settings).map(([key, value]) =>
    db
      .prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      )
      .bind(key, value)
  );

  if (statements.length > 0) await db.batch(statements);
  invalidateSettingsCache();

  await logAudit(c, 'UPDATE', 'settings', null, parsed.data.settings);
  return success(c, { message: 'Settings updated', settings: parsed.data.settings });
});

// ============================================================
// File upload
// ============================================================

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

function fileExtension(mimeType: string): string {
  return MIME_EXTENSIONS[mimeType] || '';
}


adminRoutes.post('/upload', async (c) => {
  const limited = await enforceRateLimit(c, 'upload', c.get('userId'), { limit: 20, windowSeconds: 60 });
  if (limited) return limited;

  const body = await c.req.parseBody();
  const file = body.file as File | undefined;
  const type = (body.type as string) || 'product';
  const entityId = body.entityId as string | undefined;

  if (!file || typeof file === 'string') {
    return failure(c, ErrorCode.INVALID_REQUEST, 'No file provided');
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    return failure(c, ErrorCode.INVALID_REQUEST, 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed');
  }
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return failure(c, ErrorCode.PAYLOAD_TOO_LARGE, 'File too large. Maximum size is 5MB', 413);
  }

  const arrayBuffer = await file.arrayBuffer();

  // Prefer the optional R2 bucket; fall back to a D1 data-URL so uploads keep
  // working in dev or when the MEDIA_BUCKET binding is not configured. The
  // entity is intentionally not updated here: the admin form commits the URL
  // in its normal Save request, so Cancel remains a true cancel.
  let url: string;
  if (c.env.MEDIA_BUCKET) {
    const key = `${type}_${generateId()}${fileExtension(file.type)}`;
    await c.env.MEDIA_BUCKET.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });
    const publicBase = c.env.PUBLIC_SITE_ORIGIN?.replace(/\/$/, '');
    url = publicBase ? `${publicBase}/media/${key}` : `/api/media/${key}`;
  } else {
    const buffer = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < buffer.length; i += 1) binary += String.fromCharCode(buffer[i]);
    url = `data:${file.type};base64,${btoa(binary)}`;
  }

  await logAudit(c, 'UPLOAD', type, entityId || 'new', { fileName: file.name, fileSize: file.size });
  return c.json({ success: true, data: { url, message: 'File uploaded successfully' }, url });
});

// ============================================================
// Admin account
// ============================================================

adminRoutes.get('/account', async (c) => {
  const user = await c.env.survey_db
    .prepare('SELECT id, full_name, email, created_at FROM users WHERE id = ? AND is_admin = 1')
    .bind(c.get('userId'))
    .first();
  if (!user) return failure(c, ErrorCode.NOT_FOUND, 'Admin not found');
  return success(c, { user });
});

adminRoutes.patch('/account/password', async (c) => {
  const parsed = await readJson(
    c,
    z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(6).max(200) })
  );
  if (!parsed.ok) return parsed.response;
  const { currentPassword, newPassword } = parsed.data;

  if (currentPassword === newPassword) {
    return failure(c, ErrorCode.INVALID_REQUEST, 'New password must be different from the current password');
  }

  const { verifyPassword, hashPassword } = await import('../lib/auth');
  const id = c.get('userId');
  const user = await c.env.survey_db
    .prepare('SELECT id, password_hash FROM users WHERE id = ? AND is_admin = 1')
    .bind(id)
    .first<{ id: string; password_hash: string | null }>();
  if (!user) return failure(c, ErrorCode.NOT_FOUND, 'Admin not found');

  const check = await verifyPassword(currentPassword, user.password_hash);
  if (!check.ok) return failure(c, ErrorCode.UNAUTHORIZED, 'Current password is incorrect', 401);

  const newHash = await hashPassword(newPassword);
  await c.env.survey_db
    .prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(newHash, id)
    .run();

  await logAudit(c, 'PASSWORD_CHANGED', 'auth', id);
  return success(c, { message: 'Password updated successfully' });
});

// ============================================================
// Shop management (v1) — multi-shop reward system
// ============================================================

/** GET /admin/shops — list shops with pagination, search, status filter */
adminRoutes.get('/shops', async (c) => {
  const db = c.env.survey_db;
  const parsed = readQuery(c, searchPaginationSchema);
  if (!parsed.ok) return parsed.response;
  const { limit, offset, search } = parsed.data;

  const params: unknown[] = [];
  let query = `
    SELECT s.id, s.campaign_id, s.name, s.slug, s.description, s.logo_url,
           s.address, s.contact_information, s.status, s.display_order,
           s.created_at, s.updated_at,
           (SELECT COUNT(*) FROM shop_rewards sr WHERE sr.shop_id = s.id) as reward_count,
           (SELECT COUNT(*) FROM shop_rewards sr WHERE sr.shop_id = s.id AND sr.active = 1 AND sr.stock_remaining > 0) as active_reward_count,
           (SELECT SUM(sr.stock_remaining) FROM shop_rewards sr WHERE sr.shop_id = s.id) as total_stock,
           (SELECT SUM(sr.stock_remaining) FROM shop_rewards sr WHERE sr.shop_id = s.id AND sr.active = 1) as remaining_stock,
           (SELECT win_probability FROM shop_winning_config swc WHERE swc.shop_id = s.id) as win_probability
    FROM shops s
    WHERE 1=1`;
  if (search) {
    query += ' AND (s.name LIKE ? OR s.slug LIKE ? OR s.address LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }
  query += ' ORDER BY s.display_order, s.name LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const shops = await db.prepare(query).bind(...params).all();

  const totalParams: unknown[] = [];
  let totalQuery = 'SELECT COUNT(*) as count FROM shops s WHERE 1=1';
  if (search) {
    totalQuery += ' AND (s.name LIKE ? OR s.slug LIKE ? OR s.address LIKE ?)';
    const term = `%${search}%`;
    totalParams.push(term, term, term);
  }
  const total = await db.prepare(totalQuery).bind(...totalParams).first<{ count: number }>();

  return success(c, {
    shops: (shops.results || []).map((shop) => ({
      id: shop.id,
      campaignId: shop.campaign_id,
      name: shop.name,
      slug: shop.slug,
      description: shop.description,
      logoUrl: shop.logo_url,
      address: shop.address,
      contactInformation: shop.contact_information,
      status: shop.status,
      displayOrder: shop.display_order,
      createdAt: shop.created_at,
      updatedAt: shop.updated_at,
      rewardCount: shop.reward_count,
      activeRewardCount: shop.active_reward_count,
      totalStock: shop.total_stock || 0,
      remainingStock: shop.remaining_stock || 0,
      winProbability: shop.win_probability,
    })),
    total: total?.count || 0,
  });
});

/** POST /admin/shops — create a new shop */
adminRoutes.post('/shops', async (c) => {
  const parsed = await readJson(c, shopCreateSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const db = c.env.survey_db;

  // Verify campaign exists and is active
  const campaign = await db
    .prepare('SELECT id FROM campaigns WHERE id = ? AND is_active = 1')
    .bind(body.campaignId || 'campaign-2026')
    .first<{ id: string }>();
  if (!campaign) {
    return failure(c, ErrorCode.NOT_FOUND, 'Campaign not found or not active', 404);
  }

  const id = generateId();
  const now = isoTimestamp();

  try {
    await db
      .prepare(
        `INSERT INTO shops (id, campaign_id, name, slug, description, logo_url, address, contact_information, status, display_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        campaign.id,
        body.name,
        body.slug,
        body.description || null,
        body.logoUrl || null,
        body.address || null,
        body.contactInformation || null,
        body.status,
        body.displayOrder ?? 0,
        now,
        now,
      )
      .run();
  } catch (error) {
    if (String(error).toLowerCase().includes('unique constraint')) {
      return failure(c, ErrorCode.VALIDATION_FAILED, 'A shop with this slug already exists in this campaign', 422);
    }
    logEvent('error', 'shop_create_failed', { error: String(error) });
    return failure(c, ErrorCode.INTERNAL, 'Failed to create shop');
  }

  // Create default winning configuration
  await db
    .prepare(
      `INSERT INTO shop_winning_config (id, shop_id, win_probability, probability_mode, no_reward_enabled, configuration_version, created_at, updated_at)
       VALUES (?, ?, 0, 'percentage', 1, 1, ?, ?)`
    )
    .bind(generateId(), id, now, now)
    .run();

  await logAudit(c, 'CREATE', 'shop', id, { name: body.name, slug: body.slug, campaignId: campaign.id });
  return success(c, { id, message: 'Shop created' });
});

/** PATCH /admin/shops/:shopId — update shop details */
adminRoutes.patch('/shops/:shopId', async (c) => {
  const parsed = await readJson(c, shopUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const shopId = c.req.param('shopId');
  const db = c.env.survey_db;

  const existing = await db
    .prepare('SELECT id FROM shops WHERE id = ?')
    .bind(shopId)
    .first();
  if (!existing) return failure(c, ErrorCode.NOT_FOUND, 'Shop not found', 404);

  const now = isoTimestamp();
  const result = await db
    .prepare(
      `UPDATE shops SET
         name = COALESCE(?, name),
         slug = COALESCE(?, slug),
         description = COALESCE(?, description),
         logo_url = COALESCE(?, logo_url),
         address = COALESCE(?, address),
         contact_information = COALESCE(?, contact_information),
         status = COALESCE(?, status),
         display_order = COALESCE(?, display_order),
         updated_at = ?
       WHERE id = ?`
    )
    .bind(
      body.name ?? null,
      body.slug ?? null,
      body.description ?? null,
      body.logoUrl ?? null,
      body.address ?? null,
      body.contactInformation ?? null,
      body.status ?? null,
      body.displayOrder ?? null,
      now,
      shopId,
    )
    .run();
  if (result.meta.changes !== 1) return failure(c, ErrorCode.NOT_FOUND, 'Shop not found', 404);

  await logAudit(c, 'UPDATE', 'shop', shopId, { name: body.name, status: body.status });
  return success(c, { message: 'Shop updated' });
});

/** PATCH /admin/shops/:shopId/status — activate or deactivate a shop */
adminRoutes.patch('/shops/:shopId/status', async (c) => {
  const parsed = await readJson(
    c,
    z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) })
  );
  if (!parsed.ok) return parsed.response;
  const { status } = parsed.data;
  const shopId = c.req.param('shopId');
  const db = c.env.survey_db;

  const existing = await db
    .prepare('SELECT id, status FROM shops WHERE id = ?')
    .bind(shopId)
    .first<{ id: string; status: string }>();
  if (!existing) return failure(c, ErrorCode.NOT_FOUND, 'Shop not found', 404);
  if (existing.status === status) {
    return success(c, { message: `Shop already ${status}`, status });
  }

  const now = isoTimestamp();
  await db
    .prepare('UPDATE shops SET status = ?, updated_at = ? WHERE id = ?')
    .bind(status, now, shopId)
    .run();

  await logAudit(c, 'STATUS_CHANGED', 'shop', shopId, { from: existing.status, to: status });
  return success(c, { message: `Shop ${status.toLowerCase()}`, status });
});

/** GET /admin/shops/:shopId/rewards — list shop-specific rewards */
adminRoutes.get('/shops/:shopId/rewards', async (c) => {
  const db = c.env.survey_db;
  const shopId = c.req.param('shopId');

  const shop = await db
    .prepare('SELECT id FROM shops WHERE id = ?')
    .bind(shopId)
    .first();
  if (!shop) return failure(c, ErrorCode.NOT_FOUND, 'Shop not found', 404);

  const rows = await db
    .prepare(
      `SELECT sr.id, sr.reward_name, sr.reward_description, sr.reward_image_url,
              sr.stock_total, sr.stock_remaining, sr.probability_weight, sr.active,
              sr.winning_ratio, sr.is_default_remainder,
              sr.created_at, sr.updated_at,
              (SELECT COUNT(*) FROM reward_wins rw WHERE rw.shop_reward_id = sr.id) as assigned_count,
              (SELECT COUNT(*) FROM reward_wins rw JOIN reward_delivery_records rdr ON rdr.reward_win_id = rw.id WHERE rw.shop_reward_id = sr.id AND rdr.delivery_status = 'DELIVERED') as delivered_count
       FROM shop_rewards sr
       WHERE sr.shop_id = ?
       ORDER BY sr.created_at DESC`
    )
    .bind(shopId)
    .all<{
      id: string;
      reward_name: string;
      reward_description: string | null;
      reward_image_url: string | null;
      stock_total: number;
      stock_remaining: number;
      probability_weight: number;
      active: number;
      winning_ratio: number | null;
      is_default_remainder: number;
      created_at: string;
      updated_at: string;
      assigned_count: number;
      delivered_count: number;
    }>();

  return success(c, {
    shopId,
    rewards: (() => {
      const results = rows.results || [];
      // Calculate effective ratios
      const inStockExplicit = results.filter(r => r.winning_ratio != null && r.stock_remaining > 0);
      const totalExplicit = inStockExplicit.reduce((sum, r) => sum + Number(r.winning_ratio), 0);
      const remainder = Math.max(0, 100 - totalExplicit);
      return results.map((r) => {
        let effectiveRatio: number;
        if (r.stock_remaining <= 0) {
          effectiveRatio = 0; // Out of stock → excluded
        } else if (r.winning_ratio != null) {
          effectiveRatio = Number(r.winning_ratio); // Explicit ratio
        } else if (r.is_default_remainder === 1) {
          effectiveRatio = remainder; // Remainder reward
        } else {
          effectiveRatio = 0;
        }
        return {
          id: r.id,
          rewardName: r.reward_name,
          rewardDescription: r.reward_description,
          rewardImageUrl: r.reward_image_url,
          stockTotal: r.stock_total,
          stockRemaining: r.stock_remaining,
          probabilityWeight: r.probability_weight,
          active: r.active === 1,
          winningRatio: r.winning_ratio,
          isDefaultRemainder: r.is_default_remainder === 1,
          effectiveRatio,
          status: r.stock_remaining <= 0 ? 'EXHAUSTED' : r.active === 0 ? 'INACTIVE' : 'AVAILABLE',
          assignedCount: r.assigned_count,
          deliveredCount: r.delivered_count,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        };
      });
    })(),
  });
});

/** POST /admin/shops/:shopId/rewards — create a shop-specific reward */
adminRoutes.post('/shops/:shopId/rewards', async (c) => {
  const parsed = await readJson(c, shopRewardCreateSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const shopId = c.req.param('shopId');
  const db = c.env.survey_db;

  const shop = await db
    .prepare('SELECT id, campaign_id FROM shops WHERE id = ?')
    .bind(shopId)
    .first<{ id: string; campaign_id: string }>();
  if (!shop) return failure(c, ErrorCode.NOT_FOUND, 'Shop not found', 404);

  const id = generateId();
  const now = isoTimestamp();
  const totalQty = body.stockTotal;
  const status = totalQty <= 0 ? 'EXHAUSTED' : 'AVAILABLE';

  await db
    .prepare(
      `INSERT INTO shop_rewards (id, campaign_id, shop_id, reward_name, reward_description, reward_image_url, stock_total, stock_remaining, probability_weight, winning_ratio, is_default_remainder, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      shop.campaign_id,
      shopId,
      body.rewardName,
      body.rewardDescription || null,
      body.rewardImageUrl || null,
      totalQty,
      totalQty,
      body.probabilityWeight ?? 10,
      body.winningRatio ?? null,
      body.isDefaultRemainder ?? 0,
      body.active ?? 1,
      now,
      now,
    )
    .run();

  await logAudit(c, 'CREATE', 'shop_reward', id, { shopId, rewardName: body.rewardName, stockTotal: totalQty });
  return success(c, { id, message: 'Shop reward created' });
});

/** PATCH /admin/shops/:shopId/rewards/:rewardId — update a shop reward */
adminRoutes.patch('/shops/:shopId/rewards/:rewardId', async (c) => {
  const parsed = await readJson(c, shopRewardUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const shopId = c.req.param('shopId');
  const rewardId = c.req.param('rewardId');
  const db = c.env.survey_db;

  const current = await db
    .prepare('SELECT stock_total, stock_remaining FROM shop_rewards WHERE id = ? AND shop_id = ?')
    .bind(rewardId, shopId)
    .first<{ stock_total: number; stock_remaining: number }>();
  if (!current) return failure(c, ErrorCode.NOT_FOUND, 'Shop reward not found', 404);

  const now = isoTimestamp();
  const awarded = Math.max(0, current.stock_total - current.stock_remaining);

  let totalToSave: number | null = null;
  let remainingToSave: number | null = null;
  if (body.stockTotal !== undefined) {
    totalToSave = body.stockTotal;
    remainingToSave = totalToSave - awarded;
    if (remainingToSave < 0) {
      return failure(c, ErrorCode.INVALID_REQUEST, 'Total quantity cannot be lower than awarded quantity', 422);
    }
  } else {
    remainingToSave = current.stock_remaining;
  }

  const result = await db
    .prepare(
      `UPDATE shop_rewards SET
         reward_name = COALESCE(?, reward_name),
         reward_description = COALESCE(?, reward_description),
         reward_image_url = COALESCE(?, reward_image_url),
         stock_total = CASE WHEN ? = 1 THEN ? ELSE stock_total END,
         stock_remaining = CASE WHEN ? = 1 THEN ? ELSE stock_remaining END,
         probability_weight = COALESCE(?, probability_weight),
         winning_ratio = CASE WHEN ? = 1 THEN ? ELSE winning_ratio END,
         is_default_remainder = COALESCE(?, is_default_remainder),
         active = COALESCE(?, active),
         updated_at = ?
       WHERE id = ? AND shop_id = ?`
    )
    .bind(
      body.rewardName ?? null,
      body.rewardDescription ?? null,
      body.rewardImageUrl ?? null,
      body.stockTotal !== undefined ? 1 : 0,
      totalToSave,
      body.stockTotal !== undefined ? 1 : 0,
      remainingToSave,
      body.probabilityWeight ?? null,
      body.winningRatio !== undefined ? 1 : 0,
      body.winningRatio !== undefined ? body.winningRatio : null,
      body.isDefaultRemainder ?? null,
      body.active ?? null,
      now,
      rewardId,
      shopId,
    )
    .run();
  if (result.meta.changes !== 1) return failure(c, ErrorCode.NOT_FOUND, 'Shop reward not found', 404);

  if (body.stockTotal !== undefined && remainingToSave !== current.stock_remaining) {
    await db
      .prepare(
        `INSERT INTO reward_inventory_transactions (id, reward_id, type, quantity, notes, created_by, created_at)
         VALUES (?, ?, 'MANUAL_ADJUSTMENT', ?, 'total_quantity_updated', ?, ?)`
      )
      .bind(generateId(), rewardId, remainingToSave! - current.stock_remaining, c.get('userId'), now)
      .run();
  }

  await logAudit(c, 'UPDATE', 'shop_reward', rewardId, { shopId, rewardName: body.rewardName, stockTotal: body.stockTotal });
  return success(c, { message: 'Shop reward updated' });
});

/** POST /admin/shops/:shopId/rewards/:rewardId/stock-adjustments — audited stock adjustment */
adminRoutes.post('/shops/:shopId/rewards/:rewardId/stock-adjustments', async (c) => {
  const parsed = await readJson(c, shopStockAdjustSchema);
  if (!parsed.ok) return parsed.response;
  const { adjustment, reason } = parsed.data;
  const shopId = c.req.param('shopId');
  const rewardId = c.req.param('rewardId');
  const db = c.env.survey_db;

  const reward = await db
    .prepare('SELECT stock_total, stock_remaining FROM shop_rewards WHERE id = ? AND shop_id = ?')
    .bind(rewardId, shopId)
    .first<{ stock_total: number; stock_remaining: number }>();
  if (!reward) return failure(c, ErrorCode.NOT_FOUND, 'Shop reward not found', 404);

  const awarded = Math.max(0, reward.stock_total - reward.stock_remaining);
  const newRemaining = reward.stock_remaining + adjustment;

  // Prevent reducing below already-committed awards
  if (newRemaining < awarded) {
    return failure(
      c,
      ErrorCode.INVALID_REQUEST,
      `Cannot reduce stock below ${awarded} already-committed award(s)`,
      422,
    );
  }

  const result = await db
    .prepare(
      `UPDATE shop_rewards
       SET stock_remaining = stock_remaining + ?,
           updated_at = ?
       WHERE id = ? AND shop_id = ?`
    )
    .bind(adjustment, isoTimestamp(), rewardId, shopId)
    .run();
  if (result.meta.changes !== 1) return failure(c, ErrorCode.NOT_FOUND, 'Shop reward not found', 404);

  await db
    .prepare(
      `INSERT INTO reward_inventory_transactions (id, reward_id, type, quantity, reference_type, notes, created_by, created_at)
       VALUES (?, ?, 'MANUAL_ADJUSTMENT', ?, 'stock_adjustment', ?, ?)`
    )
    .bind(generateId(), rewardId, adjustment, reason || 'Manual adjustment', c.get('userId'), isoTimestamp())
    .run();

  await logAudit(c, 'STOCK_ADJUSTED', 'shop_reward', rewardId, { shopId, adjustment, reason, previousStock: reward.stock_remaining, newStock: newRemaining });
  return success(c, { message: 'Stock adjusted', newQuantity: newRemaining });
});

/** PATCH /admin/shops/:shopId/winning-config — update shop winning configuration */
adminRoutes.patch('/shops/:shopId/winning-config', async (c) => {
  const parsed = await readJson(c, winningConfigSchema);
  if (!parsed.ok) return parsed.response;
  const { winProbability, probabilityMode, noRewardEnabled, configurationVersion } = parsed.data;
  const shopId = c.req.param('shopId');
  const db = c.env.survey_db;

  const shop = await db
    .prepare('SELECT id FROM shops WHERE id = ?')
    .bind(shopId)
    .first();
  if (!shop) return failure(c, ErrorCode.NOT_FOUND, 'Shop not found', 404);

  const now = isoTimestamp();
  const version = configurationVersion ?? 1;

  // Upsert winning config
  await db
    .prepare(
      `INSERT INTO shop_winning_config (id, shop_id, win_probability, probability_mode, no_reward_enabled, configuration_version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (shop_id) DO UPDATE SET
         win_probability = excluded.win_probability,
         probability_mode = excluded.probability_mode,
         no_reward_enabled = excluded.no_reward_enabled,
         configuration_version = excluded.configuration_version,
         updated_at = excluded.updated_at`
    )
    .bind(
      generateId(),
      shopId,
      winProbability,
      probabilityMode,
      noRewardEnabled ? 1 : 0,
      version,
      now,
      now,
    )
    .run();

  await logAudit(c, 'WINNING_CONFIG_UPDATED', 'shop', shopId, {
    winProbability,
    probabilityMode,
    noRewardEnabled,
    configurationVersion: version,
  });
  return success(c, { message: 'Winning configuration updated', configurationVersion: version });
});

/** GET /admin/shops/:shopId/reward-history — reward history for a shop */
adminRoutes.get('/shops/:shopId/reward-history', async (c) => {
  const db = c.env.survey_db;
  const parsed = readQuery(c, paginationSchema);
  if (!parsed.ok) return parsed.response;
  const { limit, offset } = parsed.data;
  const shopId = c.req.param('shopId');

  const shop = await db
    .prepare('SELECT id FROM shops WHERE id = ?')
    .bind(shopId)
    .first();
  if (!shop) return failure(c, ErrorCode.NOT_FOUND, 'Shop not found', 404);

  const history = await db
    .prepare(
      `SELECT rw.id, rw.reward_name_snapshot AS reward_name, rw.shop_reward_id, rw.status,
              rw.created_at, rw.updated_at, rw.delivered_at,
              u.full_name as user_name, u.phone as user_phone
       FROM reward_wins rw
       LEFT JOIN users u ON u.id = rw.session_id
       WHERE rw.shop_id = ?
       ORDER BY rw.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(shopId, limit, offset)
    .all();

  const total = await db
    .prepare('SELECT COUNT(*) as count FROM reward_wins WHERE shop_id = ?')
    .bind(shopId)
    .first<{ count: number }>();

  return success(c, {
    shopId,
    history: (history.results || []).map((h) => ({
      winId: h.id,
      rewardName: h.reward_name,
      shopRewardId: h.shop_reward_id,
      status: h.status,
      userName: h.user_name,
      userPhone: h.user_phone,
      createdAt: h.created_at,
      updatedAt: h.updated_at,
      deliveredAt: h.delivered_at,
    })),
    total: total?.count || 0,
  });
});

/** GET /admin/shops/:shopId/statistics — shop-level statistics */
adminRoutes.get('/shops/:shopId/statistics', async (c) => {
  const db = c.env.survey_db;
  const shopId = c.req.param('shopId');

  const shop = await db
    .prepare('SELECT id FROM shops WHERE id = ?')
    .bind(shopId)
    .first();
  if (!shop) return failure(c, ErrorCode.NOT_FOUND, 'Shop not found', 404);

  const [
    sessionsSelectingShop,
    rewardSelectionAttempts,
    totalWinners,
    totalNoReward,
    remainingStock,
    totalStock,
    deliveredRewards,
    pendingRewards,
  ] = await Promise.all([
    db
      .prepare("SELECT COUNT(*) as count FROM survey_sessions WHERE selected_shop_id = ?")
      .bind(shopId)
      .first<{ count: number }>(),
    db
      .prepare('SELECT COUNT(*) as count FROM reward_wins WHERE shop_id = ?')
      .bind(shopId)
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) as count FROM reward_wins WHERE shop_id = ? AND status != 'NO_REWARD'")
      .bind(shopId)
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) as count FROM reward_wins WHERE shop_id = ? AND status = 'NO_REWARD'")
      .bind(shopId)
      .first<{ count: number }>(),
    db
      .prepare("SELECT COALESCE(SUM(stock_remaining), 0) as total FROM shop_rewards WHERE shop_id = ?")
      .bind(shopId)
      .first<{ total: number }>(),
    db
      .prepare("SELECT COALESCE(SUM(stock_total), 0) as total FROM shop_rewards WHERE shop_id = ?")
      .bind(shopId)
      .first<{ total: number }>(),
    db
      .prepare(
        "SELECT COUNT(*) as count FROM reward_wins rw JOIN reward_delivery_records rdr ON rdr.reward_win_id = rw.id WHERE rw.shop_id = ? AND rdr.delivery_status = 'DELIVERED'"
      )
      .bind(shopId)
      .first<{ count: number }>(),
    db
      .prepare(
        "SELECT COUNT(*) as count FROM reward_wins rw JOIN reward_delivery_records rdr ON rdr.reward_win_id = rw.id WHERE rw.shop_id = ? AND rdr.delivery_status IN ('PENDING', 'PROCESSING', 'SHIPPED')"
      )
      .bind(shopId)
      .first<{ count: number }>(),
  ]);

  const attempts = rewardSelectionAttempts?.count || 0;
  const winners = totalWinners?.count || 0;
  const actualWinRate = attempts > 0 ? Math.round((winners / attempts) * 100 * 100) / 100 : 0;

  return success(c, {
    shopId,
    sessionsSelectingShop: sessionsSelectingShop?.count || 0,
    rewardSelectionAttempts: attempts,
    totalWinners: winners,
    totalNoReward: totalNoReward?.count || 0,
    actualWinRate,
    remainingStock: remainingStock?.total || 0,
    totalStock: totalStock?.total || 0,
    deliveredRewards: deliveredRewards?.count || 0,
    pendingRewards: pendingRewards?.count || 0,
  });
});
