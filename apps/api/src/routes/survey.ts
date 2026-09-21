import { Hono } from 'hono';
import type { AppContext } from '../types';
import { ErrorCode, failure, isUniqueViolation, logEvent, success } from '../lib/http';
import { authMiddleware } from '../lib/auth';
import { enforceRateLimit, maintenanceResponse, RATE_POLICIES } from '../lib/security';
import { isAnswerPresent } from '../lib/survey';
import { generateId } from '../lib/ids';
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
    .prepare(
      `SELECT id, product_id, title FROM survey_versions
       WHERE is_active = 1
       ORDER BY created_at DESC LIMIT 1`
    )
    .first<VersionRow>();

  if (!version) return failure(c, ErrorCode.NOT_FOUND, 'No active survey found');
  const productId = version.product_id;

  // Idempotency: replaying a known submission request returns the original id.
  if (body.submissionRequestId) {
    const replay = await db
      .prepare('SELECT id FROM survey_responses WHERE submission_request_id = ? AND user_id = ?')
      .bind(body.submissionRequestId, userId)
      .first<{ id: string }>();
    if (replay) {
      return success(c, { responseId: replay.id, idempotent: true, message: 'Survey already submitted' });
    }
  }

  const existing = await db
    .prepare(
      `SELECT id FROM survey_responses WHERE user_id = ? AND product_id = ? AND status = 'COMPLETED' LIMIT 1`
    )
    .bind(userId, productId)
    .first<{ id: string }>();
  if (existing) {
    return success(c, { responseId: existing.id, idempotent: true, message: 'Survey already submitted' });
  }

  // Validate required questions against the live survey definition.
  const questions = await db
    .prepare(
      `SELECT id, question_type, is_required, question_text FROM survey_questions
       WHERE survey_version_id = ? AND is_active = 1`
    )
    .bind(version.id)
    .all<{ id: string; question_type: string; is_required: number; question_text: string }>();

  const answersByQuestion = new Map(body.answers.map((answer) => [answer.questionId, answer]));
  for (const question of questions.results || []) {
    if (!question.is_required) continue;
    const answer = answersByQuestion.get(question.id);
    if (!isAnswerPresent(question.question_type, answer?.value)) {
      return failure(c, ErrorCode.VALIDATION_FAILED, `Missing required answer for: ${question.question_text}`, 422);
    }
  }

  const responseId = generateId();
  const statements = [
    db
      .prepare(
        `INSERT INTO survey_responses
           (id, user_id, campaign_id, product_id, survey_version_id, survey_version_label, language, status, submission_request_id, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, datetime('now'))`
      )
      .bind(
        responseId,
        userId,
        body.campaignId || null,
        productId,
        version.id,
        version.title || null,
        body.language || 'en',
        body.submissionRequestId || null
      ),
  ];

  for (const answer of body.answers) {
    let answerText: string | null = null;
    let answerNumber: number | null = null;
    let answerChoice: string | null = null;
    let answerRating: number | null = null;

    if (answer.type === 'text' || answer.type === 'long_text') {
      answerText = String(answer.value);
    } else if (answer.type === 'number' || answer.type === 'rating') {
      const numeric = Number(answer.value);
      answerNumber = Number.isNaN(numeric) ? null : numeric;
      answerRating = answer.type === 'rating' ? answerNumber : null;
    } else if (['single_choice', 'multiple_choice', 'yes_no', 'dropdown'].includes(answer.type || '')) {
      answerChoice = Array.isArray(answer.value) ? answer.value.join(',') : String(answer.value);
    } else {
      // Unknown type: persist the raw text rather than silently dropping it.
      answerText = Array.isArray(answer.value) ? answer.value.join(',') : String(answer.value);
    }

    statements.push(
      db
        .prepare(
          `INSERT INTO survey_answers (id, response_id, question_id, answer_text, answer_number, answer_choice, answer_rating)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(generateId(), responseId, answer.questionId, answerText, answerNumber, answerChoice, answerRating)
    );
  }

  try {
    await db.batch(statements);
  } catch (error) {
    if (isUniqueViolation(error)) {
      const replay = await db
        .prepare(
          `SELECT id FROM survey_responses
           WHERE user_id = ? AND product_id = ? AND status = 'COMPLETED' LIMIT 1`
        )
        .bind(userId, productId)
        .first<{ id: string }>();
      if (replay) {
        return success(c, { responseId: replay.id, idempotent: true, message: 'Survey already submitted' });
      }
      return failure(c, ErrorCode.ALREADY_SUBMITTED, 'You have already submitted this survey', 409);
    }
    logEvent('error', 'survey_submit_failed', { userId, error: String(error) });
    return failure(c, ErrorCode.INTERNAL, 'Survey submission failed');
  }

  return success(c, { responseId, message: 'Survey submitted successfully' });
});
