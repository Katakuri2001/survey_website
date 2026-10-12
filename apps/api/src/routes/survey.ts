import { Hono } from 'hono';
import type { AppContext } from '../types';
import { ErrorCode, failure, isUniqueViolation, logEvent, success } from '../lib/http';
import { authMiddleware } from '../lib/auth';
import { enforceRateLimit, maintenanceResponse, RATE_POLICIES } from '../lib/security';
import { conditionMatches, loadSurveyConfig, validateQuestionAnswer } from '../lib/survey';
import { generateId, isoTimestamp } from '../lib/ids';
import { readJson, surveySubmitSchema } from '../lib/validation';

export const surveyRoutes = new Hono<AppContext>();

type VersionRow = { id: string; product_id: string; title: string };

surveyRoutes.post('/survey/submit', authMiddleware, async (c) => {
  const settings = c.get('settings');
  if (settings.maintenanceMode) return maintenanceResponse(c);
  if (!settings.surveyEnabled) {
    return failure(c, ErrorCode.FEATURE_DISABLED, 'The survey is currently closed.', 409);
  }

  const userId = c.get('userId');
  const limited = await enforceRateLimit(c, 'survey-submit', userId, RATE_POLICIES.surveySubmit);
  if (limited) return limited;

  const parsed = await readJson(c, surveySubmitSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const db = c.env.survey_db;

  const version = await db
    .prepare('SELECT id, product_id, title FROM survey_versions WHERE is_active = 1 LIMIT 1')
    .first<{ id: string; product_id: string; title: string }>();

  if (!version) return failure(c, ErrorCode.NOT_FOUND, 'No active survey version', 404);

  const surveyId = version.id;

  // Check if user already submitted
  const existing = await db
    .prepare('SELECT id FROM survey_responses WHERE user_id = ? AND survey_version_id = ?')
    .bind(userId, surveyId)
    .first();

  if (existing) return failure(c, ErrorCode.VALIDATION_FAILED, 'You have already submitted this survey', 422);

  // Check if the product is still in stock
  const product = await db
    .prepare('SELECT id, name, stock FROM products WHERE id = ?')
    .bind(version.product_id)
    .first<{ id: string; name: string; stock: number }>();

  if (!product || product.stock <= 0) return failure(c, ErrorCode.INVENTORY_EXHAUSTED, 'Sorry, this item is out of stock', 409);

  // Check idempotency key
  const idempotencyKey = body.submissionRequestId;
  if (idempotencyKey) {
    const idempotentCheck = await db
      .prepare('SELECT id FROM survey_responses WHERE idempotency_key = ?')
      .bind(idempotencyKey)
      .first();
    if (idempotentCheck) return success(c, { responseId: idempotentCheck.id, message: 'Duplicate request ignored (idempotent)' });
  }

  // Begin transaction: decrement stock, create response, update user_rewards
  try {
    await db.prepare('UPDATE products SET stock = stock - 1 WHERE id = ?').bind(version.product_id).run();
    await db.prepare('INSERT INTO survey_responses (id, user_id, survey_version_id, submission_request_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(generateId(), userId, surveyId, idempotencyKey || null, 'COMPLETED', isoTimestamp(), isoTimestamp()).run();
    await db.prepare('INSERT INTO user_rewards (id, user_id, reward_spin_id, reward_id, delivery_status, won_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(generateId(), userId, null, null, 'DELIVERY_PENDING', isoTimestamp(), isoTimestamp(), isoTimestamp()).run();
  } catch (error) {
    // Attempt stock rollback on failure
    try {
      await db.prepare('UPDATE products SET stock = stock + 1 WHERE id = ?').bind(version.product_id).run();
    } catch (rollbackError) {
      logEvent('error', 'stock_rollback_failed', { userId, error: String(rollbackError) });
    }
    logEvent('error', 'survey_submit_failed', { userId, error: String(error) });
    return failure(c, ErrorCode.INTERNAL, 'Survey submission failed');
  }

  return success(c, { responseId: 'resp-' + generateId(), message: 'Survey submitted successfully' });
});

// ============================================================
// Survey Session Management
// ============================================================

/** POST /api/v1/survey/sessions - Create a new survey session */
surveyRoutes.post('/sessions', authMiddleware, async (c) => {
  const db = c.env.survey_db;
  const userId = c.get('userId');

  const body = await c.req.json();
  if (!body || !body.campaignId) return failure(c, ErrorCode.VALIDATION_FAILED, 'campaignId is required', 422);

  const campaignId = body.campaignId.trim();

  // Check if the campaign exists and is active
  const campaign = await db
    .prepare('SELECT id, status, start_date, end_date FROM campaigns WHERE id = ?')
    .bind(campaignId)
    .first<{ id: string; status: string; start_date: string; end_date: string }>();

  if (!campaign) return failure(c, ErrorCode.NOT_FOUND, 'Campaign not found', 404);
  if (campaign.status !== 'ACTIVE') return failure(c, ErrorCode.INVALID_REQUEST, 'Campaign is not active', 409);

  // Check date range
  const now = new Date();
  const startDate = new Date(campaign.start_date);
  const endDate = new Date(campaign.end_date);
  if (now < startDate) return failure(c, ErrorCode.INVALID_REQUEST, 'Campaign has not started yet', 409);
  if (now > endDate) return failure(c, ErrorCode.INVALID_REQUEST, 'Campaign has ended', 409);

  const sessionId = generateId();
  const nowISO = isoTimestamp();

  await db.prepare('INSERT INTO survey_sessions (id, campaign_id, status, started_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .bind(sessionId, campaignId, 'STARTED', nowISO, nowISO).run();

  return success(c, { data: { sessionId, status: 'STARTED' } });
});

/** PATCH /api/v1/survey/sessions/:sessionId/personal - Save personal information */
surveyRoutes.patch('/sessions/:sessionId/personal', authMiddleware, async (c) => {
  const db = c.env.survey_db;
  const userId = c.get('userId');
  const sessionId = c.req.param('sessionId');

  // Verify the session belongs to this user
  const session = await db
    .prepare('SELECT id, status, campaign_id FROM survey_sessions WHERE id = ? AND user_id = ?')
    .bind(sessionId, userId)
    .first<{ id: string; status: string; campaign_id: string }>();

  if (!session) return failure(c, ErrorCode.NOT_FOUND, 'Session not found', 404);
  if (session.status !== 'STARTED') return failure(c, ErrorCode.INVALID_STATE_TRANSITION, 'Session not in STARTED state', 409);

  const body = await c.req.json();
  if (!body) return failure(c, ErrorCode.VALIDATION_FAILED, 'Request body is required', 422);

  const { fullName, phone, dob, stateCode, nrcTownship, nrcType, nrcNumber } = body;

  // Validate required fields
  if (!fullName || !phone || !dob || !stateCode || !nrcTownship || !nrcType || !nrcNumber) {
    return failure(c, ErrorCode.VALIDATION_FAILED, 'All personal information fields are required', 422);
  }

  // Validate NRC format (basic validation)
  const nrcPattern = /^[0-9]{1,2}\/[A-Z]{2,4}\s\([A-Z]\)\d{6}$/;
  if (!nrcPattern.test(nrcNumber)) {
    return failure(c, ErrorCode.VALIDATION_FAILED, 'Invalid NRC format. Expected format: 14/HATHATHA (N)361920', 422);
  }

  const now = isoTimestamp();

  await db.prepare('UPDATE survey_sessions SET personal_info_json = ?, personal_completed_at = ?, status = ?, updated_at = ? WHERE id = ?')
    .bind(JSON.stringify({ fullName, phone, dob, stateCode, nrcTownship, nrcType, nrcNumber }), now, 'PERSONAL_INFO_COMPLETED', now, sessionId).run();

  await db.prepare('UPDATE users SET full_name = ?, phone = ?, eligibility_confirmed = TRUE, updated_at = ? WHERE id = ?')
    .bind(fullName, phone, now, userId).run();

  return success(c, { data: { sessionId, status: 'PERSONAL_INFO_COMPLETED' } });
});

/** PUT /api/v1/survey/sessions/:sessionId/answers - Save survey answers */
surveyRoutes.put('/sessions/:sessionId/answers', authMiddleware, async (c) => {
  const db = c.env.survey_db;
  const userId = c.get('userId');
  const sessionId = c.req.param('sessionId');

  // Verify the session belongs to this user and is in a valid state
  const session = await db
    .prepare('SELECT id, status, campaign_id FROM survey_sessions WHERE id = ? AND user_id = ?')
    .bind(sessionId, userId)
    .first<{ id: string; status: string; campaign_id: string }>();

  if (!session) return failure(c, ErrorCode.NOT_FOUND, 'Session not found', 404);
  if (session.status === 'COMPLETED') return failure(c, ErrorCode.INVALID_STATE_TRANSITION, 'Survey already completed', 409);

  const body = await c.req.json();
  if (!body || !body.answers || !Array.isArray(body.answers)) return failure(c, ErrorCode.VALIDATION_FAILED, 'Answers array is required', 422);

  const { answers } = body;

  // Fetch the survey config for this campaign
  const configResult = await db
    .prepare('SELECT questions FROM survey_questions WHERE campaign_id = ? AND is_active = 1 LIMIT 1')
    .bind(session.campaign_id)
    .first();

  if (!configResult || !configResult.questions) return failure(c, ErrorCode.NOT_FOUND, 'Survey config not found', 404);

  const questions = JSON.parse(configResult.questions);;
  const questionMap = new Map(questions.map((q: any) => [q.id, q as any]));

  // Validate each answer
  for (const answer of answers) {
    const questionId = answer.questionId;
    const value = answer.value;

    if (!questionId) return failure(c, ErrorCode.VALIDATION_FAILED, 'Answer missing questionId', 422);

    const question = questionMap.get(questionId);
    if (!question) return failure(c, ErrorCode.VALIDATION_FAILED, `Unknown question: ${questionId}`, 422);

    // Check if required
    if (question.is_required && !value) return failure(c, ErrorCode.VALIDATION_FAILED, `Required question not answered: ${question.question_text}`, 422);

    // Validate answer type
    const validationError = validateQuestionAnswer(question as any, value);
    if (validationError) return failure(c, ErrorCode.VALIDATION_FAILED, `${question.question_text}: ${validationError}`, 422);
  }

  // Mark survey as completed if all required questions are answered
  const requiredAnswered = answers.filter((a: any) => {
    const q = questionMap.get(a.questionId);
    return q && q.is_required && a.value !== undefined && a.value !== null;
  }).length;

  const totalRequired = (questions as any[]).filter((q: any) => q.is_required).length;

  const newStatus = requiredAnswered >= totalRequired ? 'SURVEY_COMPLETED' : 'SURVEY_IN_PROGRESS';

  const now = isoTimestamp();

  await db.prepare('UPDATE survey_sessions SET status = ?, survey_completed_at = ?, updated_at = ? WHERE id = ?')
    .bind(newStatus, now, now, sessionId).run();

  await db.prepare('INSERT INTO survey_answers (id, response_id, question_id, answer_text, answer_number, answer_choice, answer_rating) SELECT generateId(), ?, question_id, answer_text, answer_number, answer_choice, answer_rating FROM unnest(?) AS answer(questionId, question_type, value)')
    .bind(sessionId, JSON.stringify(answers)).run();

  return success(c, { data: { sessionId, status: newStatus } });
});

/** POST /api/v1/survey/sessions/:sessionId/complete - Mark survey as completed */
surveyRoutes.post('/sessions/:sessionId/complete', authMiddleware, async (c) => {
  const db = c.env.survey_db;
  const userId = c.get('userId');
  const sessionId = c.req.param('sessionId');

  // Verify the session belongs to this user
  const session = await db
    .prepare('SELECT id, status, campaign_id FROM survey_sessions WHERE id = ? AND user_id = ?')
    .bind(sessionId, userId)
    .first<{ id: string; status: string; campaign_id: string }>();

  if (!session) return failure(c, ErrorCode.NOT_FOUND, 'Session not found', 404);
  if (session.status === 'COMPLETED') return failure(c, ErrorCode.INVALID_STATE_TRANSITION, 'Survey already completed', 409);

  // Fetch the survey config for this campaign
  const configResult = await db
    .prepare('SELECT questions FROM survey_questions WHERE campaign_id = ? AND is_active = 1 LIMIT 1')
    .bind(session.campaign_id)
    .first();

  if (!configResult) return failure(c, ErrorCode.NOT_FOUND, 'Survey config not found', 404);

  const questions = JSON.parse(configResult.questions);;
  const totalRequired = (questions as any[]).filter((q: any) => q.is_required).length;

  // Count how many required questions have answers
  const answeredCount = await db
    .prepare('SELECT COUNT(DISTINCT question_id) FROM survey_answers WHERE response_id = ? AND (answer_text IS NOT NULL OR answer_number IS NOT NULL OR answer_choice IS NOT NULL OR answer_rating IS NOT NULL)')
    .bind(sessionId)
    .first<{ COUNT: number }>();

  const countResult = answeredCount?.COUNT ?? 0;

  if (countResult < totalRequired) return failure(c, ErrorCode.VALIDATION_FAILED, 'Not all required questions have been answered', 422);

  const now = isoTimestamp();

  await db.prepare('UPDATE survey_sessions SET status = ?, survey_completed_at = ?, updated_at = ? WHERE id = ?')
    .bind('COMPLETED', now, now, sessionId).run();

  await db.prepare('UPDATE user_rewards SET delivery_status = $DELIVERY_PENDING, updated_at = ? WHERE reward_spin_id IN (SELECT reward_spin_id FROM user_rewards WHERE user_id = ?)')
    .bind(now, userId).run();

  return success(c, { data: { sessionId, status: 'COMPLETED' } });
});