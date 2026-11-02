import { Hono } from 'hono';
import type { AppContext } from '../types';
import type { D1Database } from '@cloudflare/workers-types';
import { ErrorCode, failure, isUniqueViolation, logEvent, success } from '../lib/http';
import { authMiddleware } from '../lib/auth';
import { enforceRateLimit, maintenanceResponse, RATE_POLICIES } from '../lib/security';
import { conditionMatches, loadSurveyConfig, validateQuestionAnswer } from '../lib/survey';
import { generateId, isoTimestamp } from '../lib/ids';
import { readJson, surveySubmitSchema, shopSelectionSchema } from '../lib/validation';
import { allocateRewardForSession } from '../lib/rewardAllocation';

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

  // Create or find a survey session for this user+campaign
  let sessionId: string;
  const campaignId = body.campaignId || 'campaign-2026';
  const existingSession = await db
    .prepare('SELECT id FROM survey_sessions WHERE user_id = ? AND campaign_id = ? LIMIT 1')
    .bind(userId, campaignId)
    .first<{ id: string }>();
  if (existingSession) {
    sessionId = existingSession.id;
  } else {
    sessionId = generateId();
    const nowISO = isoTimestamp();
    const campaignId = body.campaignId || 'campaign-2026';
    await db
      .prepare('INSERT INTO survey_sessions (id, user_id, campaign_id, status, started_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(sessionId, userId, campaignId, 'STARTED', nowISO, nowISO)
      .run();
  }

  // Note: Product stock is no longer checked here. The reward system is now
  // shop-based (see shop_rewards). Product availability is managed separately.

  // Check idempotency key
  const idempotencyKey = body.submissionRequestId;
  if (idempotencyKey) {
    const idempotentCheck = await db
      .prepare('SELECT id FROM survey_responses WHERE idempotency_key = ?')
      .bind(idempotencyKey)
      .first();
    if (idempotentCheck) return success(c, { responseId: idempotentCheck.id, message: 'Duplicate request ignored (idempotent)' });
  }

  // Begin transaction: create response, update user_rewards
  try {
    await db.prepare('INSERT INTO survey_responses (id, user_id, product_id, survey_version_id, submission_request_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(generateId(), userId, version.product_id, surveyId, idempotencyKey || null, 'COMPLETED', isoTimestamp(), isoTimestamp()).run();
  } catch (error) {
    logEvent('error', 'survey_submit_failed', { userId, error: String(error) });
    return failure(c, ErrorCode.INTERNAL, 'Survey submission failed');
  }

  // Update session status to SURVEY_COMPLETED
  try {
    const nowISO = isoTimestamp();
    await db
      .prepare('UPDATE survey_sessions SET status = ?, survey_completed_at = ?, updated_at = ? WHERE id = ?')
      .bind('SURVEY_COMPLETED', nowISO, nowISO, sessionId)
      .run();
  } catch (sessionError) {
    logEvent('warn', 'session_update_failed', { sessionId, error: String(sessionError) });
  }

  return success(c, { responseId: 'resp-' + generateId(), sessionId, message: 'Survey submitted successfully' });
});

// ============================================================
// Survey Session Management
// ============================================================

/** POST /api/v1/survey/sessions - Create a new survey session */
surveyRoutes.post('/survey/sessions', authMiddleware, async (c) => {
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
surveyRoutes.patch('/survey/sessions/:sessionId/personal', authMiddleware, async (c) => {
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
surveyRoutes.put('/survey/sessions/:sessionId/answers', authMiddleware, async (c) => {
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

  const questions = JSON.parse(configResult.questions as string);
  const questionMap = new Map<string, any>(questions.map((q: any) => [q.id, q]));

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
surveyRoutes.post('/survey/sessions/:sessionId/complete', authMiddleware, async (c) => {
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

  const questions = JSON.parse(configResult.questions as string);
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

// ============================================================
// Shop selection (v1)
// ============================================================

/** POST /v1/survey/sessions/:sessionId/select-shop */
surveyRoutes.post('/v1/survey/sessions/:sessionId/select-shop', authMiddleware, async (c) => {
  const db = c.env.survey_db;
  const userId = c.get('userId');
  const sessionId = c.req.param('sessionId');

  const settings = c.get('settings');
  if (settings.maintenanceMode) return maintenanceResponse(c);

  const parsed = await readJson(c, shopSelectionSchema);
  if (!parsed.ok) return parsed.response;
  const { shopId } = parsed.data;

  // Verify session exists and belongs to user
  const session = await db
    .prepare('SELECT id, status, campaign_id, selected_shop_id FROM survey_sessions WHERE id = ? AND user_id = ?')
    .bind(sessionId, userId)
    .first<{ id: string; status: string; campaign_id: string; selected_shop_id: string | null }>();

  if (!session) return failure(c, ErrorCode.SESSION_NOT_FOUND, 'Session not found', 404);

  // Survey must be completed before shop selection
  if (session.status !== 'SURVEY_COMPLETED') {
    return failure(c, ErrorCode.SESSION_INCOMPLETE, 'Survey must be completed before selecting a shop', 409);
  }

  // Shop must not already be selected (immutability after selection)
  if (session.selected_shop_id) {
    return failure(c, ErrorCode.ALREADY_REWARDED, 'Shop already selected for this session', 409);
  }

  // Verify shop exists, belongs to campaign, is active
  const shop = await db
    .prepare(
      `SELECT id, status FROM shops WHERE id = ? AND campaign_id = ?`
    )
    .bind(shopId, session.campaign_id)
    .first<{ id: string; status: string }>();

  if (!shop) {
    return failure(c, ErrorCode.SHOP_NOT_FOUND, 'Shop not found or not part of this campaign', 404);
  }
  if (shop.status !== 'ACTIVE') {
    return failure(c, ErrorCode.SHOP_INACTIVE, 'Shop is not active', 409);
  }

  const now = isoTimestamp();

  // Save selected shop on session
  await db
    .prepare(
      `UPDATE survey_sessions
       SET selected_shop_id = ?, shop_selected_at = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(shopId, now, now, sessionId)
    .run();

  await recordRewardEventAudit(
    db,
    sessionId,
    shopId,
    null,
    'SHOP_SELECTED',
    { shop_id: shopId, campaign_id: session.campaign_id },
  );

  return success(c, {
    data: {
      sessionId,
      shopId,
      status: 'SHOP_SELECTED',
      shopSelectedAt: now,
    },
  });
});

/** GET /v1/survey/sessions/:sessionId — session recovery and status */
surveyRoutes.get('/v1/survey/sessions/:sessionId', authMiddleware, async (c) => {
  const db = c.env.survey_db;
  const userId = c.get('userId');
  const sessionId = c.req.param('sessionId');

  const session = await db
    .prepare(
      `SELECT id, campaign_id, status, selected_shop_id, shop_selected_at,
              reward_assigned_at, completed_at, personal_completed_at, survey_completed_at
       FROM survey_sessions
       WHERE id = ? AND user_id = ?`
    )
    .bind(sessionId, userId)
    .first<{
      id: string;
      campaign_id: string;
      status: string;
      selected_shop_id: string | null;
      shop_selected_at: string | null;
      reward_assigned_at: string | null;
      completed_at: string | null;
      personal_completed_at: string | null;
      survey_completed_at: string | null;
    }>();

  if (!session) return failure(c, ErrorCode.SESSION_NOT_FOUND, 'Session not found', 404);

  // Determine allowed next action
  let nextAction: string;
  switch (session.status) {
    case 'STARTED':
      nextAction = 'PERSONAL_INFO';
      break;
    case 'PERSONAL_INFO_COMPLETED':
      nextAction = 'SURVEY';
      break;
    case 'SURVEY_COMPLETED':
      nextAction = session.selected_shop_id ? 'REWARD_SELECT' : 'SHOP_SELECT';
      break;
    case 'REWARD_ASSIGNED':
      nextAction = 'REWARD_RESULT';
      break;
    case 'COMPLETED':
    case 'ABANDONED':
      nextAction = 'DONE';
      break;
    default:
      nextAction = 'UNKNOWN';
  }

  // Check for existing reward
  const existingWin = await db
    .prepare(
      `SELECT id, reward_name_snapshot AS reward_name, shop_id FROM reward_wins WHERE session_id = ? LIMIT 1`
    )
    .bind(sessionId)
    .first<{ id: string; reward_name: string; shop_id: string | null }>();

  return success(c, {
    data: {
      sessionId: session.id,
      status: session.status,
      selectedShopId: session.selected_shop_id,
      shopSelectedAt: session.shop_selected_at,
      rewardAssignedAt: session.reward_assigned_at,
      completedAt: session.completed_at,
      nextAction,
      existingReward: existingWin
        ? { winId: existingWin.id, rewardName: existingWin.reward_name, shopId: existingWin.shop_id }
        : null,
    },
  });
});

/** POST /v1/rewards/select — server-authoritative reward allocation */
surveyRoutes.post('/v1/rewards/select', authMiddleware, async (c) => {
  const db = c.env.survey_db;
  const userId = c.get('userId');

  const settings = c.get('settings');
  if (settings.maintenanceMode) return maintenanceResponse(c);

  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.sessionId !== 'string') {
    return failure(c, ErrorCode.VALIDATION_FAILED, 'sessionId is required', 422);
  }

  const sessionId = body.sessionId;
  const selectedCardId = typeof body.selectedCardId === 'string' ? body.selectedCardId : null;
  const idempotencyKey =
    typeof body.idempotencyKey === 'string' && body.idempotencyKey.length >= 8
      ? body.idempotencyKey
      : c.req.header('Idempotency-Key') ||
        c.req.header('x-idempotency-key') ||
        generateId();

  // Rate limit per user for reward selection
  const limited = await enforceRateLimit(c, 'reward-select', userId, {
    limit: 30,
    windowSeconds: 60,
  });
  if (limited) return limited;

  // Load session to get the selected shop (backend authority — never trust client shopId)
  const session = await db
    .prepare(
      `SELECT id, campaign_id, status, selected_shop_id FROM survey_sessions WHERE id = ? AND user_id = ?`
    )
    .bind(sessionId, userId)
    .first<{ id: string; campaign_id: string; status: string; selected_shop_id: string | null }>();

  if (!session) return failure(c, ErrorCode.SESSION_NOT_FOUND, 'Session not found', 404);

  // Check idempotency FIRST — if this key already produced a result, return it
  // (even if the session has moved past SURVEY_COMPLETED)
  const existingByKey = await db
    .prepare(
      `SELECT id, reward_name_snapshot AS reward_name, shop_id FROM reward_wins WHERE idempotency_key = ? LIMIT 1`
    )
    .bind(idempotencyKey)
    .first<{ id: string; reward_name: string; shop_id: string | null }>();

  if (existingByKey) {
    return success(c, {
      data: {
        kind: 'DUPLICATE',
        winId: existingByKey.id,
        rewardName: existingByKey.reward_name,
        shopId: existingByKey.shop_id ?? session.selected_shop_id ?? '',
        idempotent: true,
      },
    });
  }

  // Also check if session already has a reward (different idempotency key)
  const existingWin = await db
    .prepare('SELECT id, reward_name_snapshot AS reward_name, shop_id FROM reward_wins WHERE session_id = ? LIMIT 1')
    .bind(sessionId)
    .first<{ id: string; reward_name: string; shop_id: string | null }>();

  if (existingWin) {
    return success(c, {
      data: {
        kind: 'DUPLICATE',
        winId: existingWin.id,
        rewardName: existingWin.reward_name,
        shopId: existingWin.shop_id ?? session.selected_shop_id ?? '',
        idempotent: true,
      },
    });
  }

  if (session.status !== 'SURVEY_COMPLETED') {
    return failure(c, ErrorCode.SESSION_INCOMPLETE, 'Survey not completed', 409);
  }
  if (!session.selected_shop_id) {
    return failure(c, ErrorCode.SESSION_INCOMPLETE, 'No shop selected', 409);
  }

  const shopId = session.selected_shop_id;

  // Perform shop-isolated allocation
  const result = await allocateRewardForSession(db, sessionId, shopId, idempotencyKey);

  switch (result.kind) {
    case 'DUPLICATE':
      return success(c, {
        data: {
          kind: 'DUPLICATE',
          winId: result.existingWinId,
          rewardName: result.rewardName,
          shopId: result.shopId,
          idempotent: true,
        },
      });

    case 'NO_ELIGIBLE_REWARD':
      return failure(c, ErrorCode.NO_ELIGIBLE_REWARD, 'No eligible rewards are currently available for this shop.', 409);

    case 'NO_REWARD':
      return success(c, {
        data: {
          kind: 'NO_REWARD',
          shopId: result.shopId,
          reason: result.reason,
          message: 'No reward was assigned for this shop.',
        },
      });

    case 'REWARD_ASSIGNED': {
      // Fetch the shop reward details for the response
      const shopReward = await db
        .prepare(
          `SELECT reward_name, reward_image_url FROM shop_rewards WHERE id = ?`
        )
        .bind(result.shopRewardId)
        .first<{ reward_name: string; reward_image_url: string | null }>();

      return success(c, {
        data: {
          kind: 'REWARD_ASSIGNED',
          shopId: result.shopId,
          shopRewardId: result.shopRewardId,
          rewardName: shopReward?.reward_name ?? result.rewardName,
          rewardImageUrl: shopReward?.reward_image_url ?? null,
          userRewardId: result.userRewardId,
          rewardWinId: result.rewardWinId,
          idempotent: false,
        },
      });
    }
  }
});

/** GET /v1/rewards/result/:sessionId — recover an already-assigned reward */
surveyRoutes.get('/v1/rewards/result/:sessionId', authMiddleware, async (c) => {
  const db = c.env.survey_db;
  const userId = c.get('userId');
  const sessionId = c.req.param('sessionId');

  const session = await db
    .prepare(
      `SELECT id, status, selected_shop_id FROM survey_sessions WHERE id = ? AND user_id = ?`
    )
    .bind(sessionId, userId)
    .first<{ id: string; status: string; selected_shop_id: string | null }>();

  if (!session) return failure(c, ErrorCode.SESSION_NOT_FOUND, 'Session not found', 404);

  const win = await db
    .prepare(
      `SELECT rw.id, rw.reward_name_snapshot AS reward_name, rw.shop_id, rw.shop_reward_id,
              sr.reward_image_url, rw.created_at
       FROM reward_wins rw
       LEFT JOIN shop_rewards sr ON sr.id = rw.shop_reward_id
       WHERE rw.session_id = ? AND rw.status != 'CANCELLED'
       LIMIT 1`
    )
    .bind(sessionId)
    .first<{
      id: string;
      reward_name: string;
      shop_id: string | null;
      shop_reward_id: string | null;
      reward_image_url: string | null;
      created_at: string;
    }>();

  if (!win) {
    return success(c, { data: { hasReward: false, reward: null } });
  }

  return success(c, {
    data: {
      hasReward: true,
      reward: {
        winId: win.id,
        rewardName: win.reward_name,
        shopId: win.shop_id,
        shopRewardId: win.shop_reward_id,
        rewardImageUrl: win.reward_image_url,
        assignedAt: win.created_at,
      },
      session: {
        sessionId: session.id,
        status: session.status,
        selectedShopId: session.selected_shop_id,
      },
    },
  });
});

/** GET /v1/rewards/status/:sessionId — reward selection status */
surveyRoutes.get('/v1/rewards/status/:sessionId', authMiddleware, async (c) => {
  const db = c.env.survey_db;
  const userId = c.get('userId');
  const sessionId = c.req.param('sessionId');

  const session = await db
    .prepare(
      `SELECT id, status, selected_shop_id, reward_assigned_at FROM survey_sessions WHERE id = ? AND user_id = ?`
    )
    .bind(sessionId, userId)
    .first<{ id: string; status: string; selected_shop_id: string | null; reward_assigned_at: string | null }>();

  if (!session) return failure(c, ErrorCode.SESSION_NOT_FOUND, 'Session not found', 404);

  const hasReward = await db
    .prepare('SELECT 1 FROM reward_wins WHERE session_id = ? LIMIT 1')
    .bind(sessionId)
    .first();

  return success(c, {
    data: {
      sessionId: session.id,
      status: session.status,
      selectedShopId: session.selected_shop_id,
      rewardAssignedAt: session.reward_assigned_at,
      hasReward: Boolean(hasReward),
      nextAction:
        session.status === 'REWARD_ASSIGNED' ? 'REWARD_RESULT' :
        session.selected_shop_id ? 'REWARD_SELECT' : 'SHOP_SELECT',
    },
  });
});

// Helper for audit logging in survey routes (avoid circular import)
async function recordRewardEventAudit(
  db: D1Database,
  sessionId: string,
  shopId: string | null,
  rewardId: string | null,
  eventType: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO reward_events (id, session_id, shop_id, reward_id, event_type, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        generateId(),
        sessionId,
        shopId,
        rewardId,
        eventType,
        JSON.stringify(metadata),
        isoTimestamp(),
      )
      .run();
  } catch (error) {
    logEvent('warn', 'reward_event_audit_failed', { eventType, error: String(error) });
  }
}