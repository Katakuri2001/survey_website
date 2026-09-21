import { Hono } from 'hono';
import { z } from 'zod';
import type { AppContext } from '../types';
import { ErrorCode, failure, success } from '../lib/http';
import { adminMiddleware, authMiddleware } from '../lib/auth';
import { enforceRateLimit, invalidateSettingsCache } from '../lib/security';
import { generateId } from '../lib/ids';
import { logAudit } from '../lib/audit';
import {
  deliveryStatusSchema,
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
  stockAdjustSchema,
  surveyVersionCreateSchema,
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
const exportQuerySchema = paginationSchema.extend({
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
  const rows = await c.env.survey_db
    .prepare(
      `SELECT q.*, sv.title as version_title, p.name as product_name,
              (SELECT COUNT(*) FROM survey_options WHERE question_id = q.id AND is_active = 1) as option_count
       FROM survey_questions q
       JOIN survey_versions sv ON q.survey_version_id = sv.id
       JOIN products p ON sv.product_id = p.id
       ORDER BY q.display_order`
    )
    .all();
  return success(c, rows.results || []);
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

  await db
    .prepare(
      `INSERT INTO survey_questions (id, survey_version_id, question_text, question_type, is_required, display_order, validation_rules, image_url, product_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      body.surveyVersionId,
      body.questionText,
      body.questionType || 'single_choice',
      body.isRequired === false ? 0 : 1,
      order,
      body.validationRules || null,
      body.imageUrl || null,
      body.productType || 'none'
    )
    .run();

  if (body.translations) {
    for (const [lang, text] of Object.entries(body.translations)) {
      if (!text) continue;
      await db
        .prepare('INSERT INTO survey_question_translations (id, question_id, language, question_text) VALUES (?, ?, ?, ?)')
        .bind(generateId(), id, lang, text)
        .run();
    }
  }

  if (body.options) {
    for (let i = 0; i < body.options.length; i += 1) {
      const option = body.options[i];
      const optionId = generateId();
      await db
        .prepare('INSERT INTO survey_options (id, question_id, option_text, option_value, display_order) VALUES (?, ?, ?, ?, ?)')
        .bind(optionId, id, option.text, option.value || option.text, option.displayOrder ?? i)
        .run();
      if (option.translations) {
        for (const [lang, text] of Object.entries(option.translations)) {
          if (!text) continue;
          await db
            .prepare('INSERT INTO survey_option_translations (id, option_id, language, option_text) VALUES (?, ?, ?, ?)')
            .bind(generateId(), optionId, lang, text)
            .run();
        }
      }
    }
  }

  await logAudit(c, 'CREATE', 'question', id, { questionText: body.questionText });
  return success(c, { id, message: 'Question created' });
});

adminRoutes.patch('/survey/questions/:id', async (c) => {
  const parsed = await readJson(c, questionUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const id = c.req.param('id');
  const db = c.env.survey_db;

  await db
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

  if (body.translations) {
    for (const [lang, text] of Object.entries(body.translations)) {
      if (!text) continue;
      await db
        .prepare('INSERT OR REPLACE INTO survey_question_translations (id, question_id, language, question_text) VALUES (?, ?, ?, ?)')
        .bind(generateId(), id, lang, text)
        .run();
    }
  }

  await logAudit(c, 'UPDATE', 'question', id, { questionText: body.questionText, isActive: body.isActive });
  return success(c, { message: 'Question updated' });
});

adminRoutes.delete('/survey/questions/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.survey_db.prepare('DELETE FROM survey_questions WHERE id = ?').bind(id).run();
  await logAudit(c, 'DELETE', 'question', id);
  return success(c, { message: 'Question deleted' });
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

  await db
    .prepare('INSERT INTO survey_versions (id, product_id, version, title, description, is_active) VALUES (?, ?, ?, ?, ?, 1)')
    .bind(id, body.productId, versionNumber, body.title, body.description || null)
    .run();

  if (body.translations) {
    for (const [lang, data] of Object.entries(body.translations)) {
      if (data?.title) {
        await db
          .prepare('INSERT INTO survey_version_translations (id, version_id, language, title, description) VALUES (?, ?, ?, ?, ?)')
          .bind(generateId(), id, lang, data.title, data.description || null)
          .run();
      }
    }
  }

  await logAudit(c, 'CREATE', 'survey_version', id, { productId: body.productId, title: body.title, version: versionNumber });
  return success(c, { id, version: versionNumber, message: 'Survey version created' });
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

  await db
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
      `INSERT INTO rewards (id, name, description, image_url, total_quantity, remaining_quantity, weight, low_stock_threshold, campaign_id, winning_ratio, requires_delivery)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      body.requiresDelivery === false ? 0 : 1
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

  await db
    .prepare(
      `UPDATE rewards SET
         name = COALESCE(?, name),
         description = COALESCE(?, description),
         image_url = COALESCE(?, image_url),
         weight = COALESCE(?, weight),
         low_stock_threshold = COALESCE(?, low_stock_threshold),
         is_active = COALESCE(?, is_active),
         status = COALESCE(?, status),
         campaign_id = COALESCE(?, campaign_id),
         winning_ratio = COALESCE(?, winning_ratio),
         requires_delivery = COALESCE(?, requires_delivery),
         updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(
      body.name ?? null,
      body.description ?? null,
      body.imageUrl ?? null,
      body.weight ?? null,
      body.lowStockThreshold ?? null,
      body.isActive ?? null,
      body.status ?? null,
      body.campaignId ?? null,
      body.winningRatio ?? null,
      body.requiresDelivery ?? null,
      id
    )
    .run();

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

  // Conditional update prevents a concurrent spin from driving stock negative.
  const result = await db
    .prepare(
      `UPDATE rewards SET remaining_quantity = remaining_quantity + ?, updated_at = datetime('now')
       WHERE id = ? AND remaining_quantity + ? >= 0`
    )
    .bind(adjustment, id, adjustment)
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
  const parsed = readQuery(c, paginationSchema);
  if (!parsed.ok) return parsed.response;
  const { limit, offset } = parsed.data;

  const data = await c.env.survey_db
    .prepare(
      `SELECT ur.id, u.full_name, u.email, u.phone,
              r.name as reward_name, r.image_url as reward_image_url,
              rs.won_at, ur.delivery_status, ur.delivered_at,
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
  const sinceStr = since.toISOString();

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

  await db
    .prepare(
      `UPDATE user_rewards SET
         delivery_status = ?,
         delivered_at = COALESCE(?, delivered_at),
         updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(status, status === 'DELIVERED' ? new Date().toISOString() : null, id)
    .run();

  await db
    .prepare(
      `UPDATE reward_spins SET status = ?, updated_at = datetime('now')
       WHERE id = (SELECT reward_spin_id FROM user_rewards WHERE id = ?)`
    )
    .bind(status, id)
    .run();

  if (status === 'CANCELLED') {
    const userReward = await db
      .prepare('SELECT reward_id FROM user_rewards WHERE id = ?')
      .bind(id)
      .first<{ reward_id: string }>();
    if (userReward) {
      // Return the unit to stock and clear the EXHAUSTED flag if needed.
      await db
        .prepare(
          `UPDATE rewards SET remaining_quantity = remaining_quantity + 1,
             status = CASE WHEN status = 'EXHAUSTED' THEN 'AVAILABLE' ELSE status END,
             updated_at = datetime('now')
           WHERE id = ?`
        )
        .bind(userReward.reward_id)
        .run();
      await db
        .prepare(
          `INSERT INTO reward_inventory_transactions (id, reward_id, type, quantity, reference_type, reference_id, notes, created_by)
           VALUES (?, ?, 'CANCELLATION_RETURN', 1, 'user_reward', ?, 'Delivery cancelled', ?)`
        )
        .bind(generateId(), userReward.reward_id, id, c.get('userId'))
        .run();
    }
  }

  await logAudit(c, 'DELIVERY_STATUS_CHANGED', 'user_reward', id, { newStatus: status });
  return success(c, { message: 'Delivery status updated' });
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
  const buffer = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < buffer.length; i += 1) binary += String.fromCharCode(buffer[i]);
  const dataUrl = `data:${file.type};base64,${btoa(binary)}`;

  if (entityId) {
    const db = c.env.survey_db;
    let result;
    if (type === 'reward') {
      result = await db.prepare("UPDATE rewards SET image_url = ?, updated_at = datetime('now') WHERE id = ?").bind(dataUrl, entityId).run();
    } else if (type === 'survey_question') {
      result = await db.prepare("UPDATE survey_questions SET image_url = ?, updated_at = datetime('now') WHERE id = ?").bind(dataUrl, entityId).run();
    } else {
      result = await db.prepare("UPDATE products SET image_url = ?, updated_at = datetime('now') WHERE id = ?").bind(dataUrl, entityId).run();
    }
    if (!result.meta.changes) {
      return failure(c, ErrorCode.NOT_FOUND, 'Entity not found');
    }
  }

  await logAudit(c, 'UPLOAD', type, entityId || 'new', { fileName: file.name, fileSize: file.size });

  // `url` is duplicated at the top level for admin clients that read
  // `data.url` instead of `data.data.url`.
  return c.json({ success: true, data: { url: dataUrl, message: 'File uploaded successfully' }, url: dataUrl });
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
