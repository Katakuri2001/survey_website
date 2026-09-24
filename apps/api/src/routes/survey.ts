import { Hono } from 'hono';
import type { AppContext } from '../types';
import { ErrorCode, failure, isUniqueViolation, logEvent, success } from '../lib/http';
import { authMiddleware } from '../lib/auth';
import { enforceRateLimit, maintenanceResponse, RATE_POLICIES } from '../lib/security';
import { conditionMatches, loadSurveyConfig, validateQuestionAnswer } from '../lib/survey';
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

  const version = body.surveyVersionId
    ? await db
        .prepare(
          `SELECT id, product_id, title FROM survey_versions
           WHERE id = ? AND is_active = 1 LIMIT 1`
        )
        .bind(body.surveyVersionId)
        .first<VersionRow>()
    : await db
        .prepare(
          `SELECT id, product_id, title FROM survey_versions
           WHERE is_active = 1
           ORDER BY created_at DESC LIMIT 1`
        )
        .first<VersionRow>();

  if (!version) return failure(c, ErrorCode.NOT_FOUND, 'No active survey found');
  if (body.productId && body.productId !== version.product_id) {
    return failure(c, ErrorCode.VALIDATION_FAILED, 'Survey version does not belong to the selected product', 422);
  }
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

  // Validate against the exact active version and its options/rules.
  const config = await loadSurveyConfig(db, 'en', version.id);
  if (!config.questions.length) {
    return failure(c, ErrorCode.VALIDATION_FAILED, 'The active survey has no questions', 422);
  }
  const questionMap = new Map(config.questions.map((question) => [question.id, question]));
  const answersByQuestion = new Map<string, unknown>();
  for (const answer of body.answers) {
    if (answersByQuestion.has(answer.questionId)) {
      return failure(c, ErrorCode.VALIDATION_FAILED, `Duplicate answer for question: ${answer.questionId}`, 422);
    }
    const question = questionMap.get(answer.questionId);
    if (!question) {
      return failure(c, ErrorCode.VALIDATION_FAILED, `Answer references an unknown question: ${answer.questionId}`, 422);
    }
    answersByQuestion.set(answer.questionId, answer.value);
  }

  const visibleAnswers: Array<{ questionId: string; value: unknown }> = [];
  for (const question of config.questions) {
    const visible = question.conditions.every((condition) => conditionMatches(condition, answersByQuestion));
    const answer = body.answers.find((candidate) => candidate.questionId === question.id);
    if (!visible) {
      if (answer) {
        return failure(c, ErrorCode.VALIDATION_FAILED, `Answer references a hidden question: ${question.id}`, 422);
      }
      continue;
    }
    if (question.is_required && !answer) {
      return failure(c, ErrorCode.VALIDATION_FAILED, `Missing required answer for: ${question.question_text}`, 422);
    }
    if (answer) {
      const validationError = validateQuestionAnswer(question, answer.value);
      if (validationError) {
        return failure(c, ErrorCode.VALIDATION_FAILED, `${question.question_text}: ${validationError}`, 422);
      }
      visibleAnswers.push({ questionId: question.id, value: answer.value });
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

  for (const answer of visibleAnswers) {
    const question = questionMap.get(answer.questionId);
    if (!question) continue;
    let answerText: string | null = null;
    let answerNumber: number | null = null;
    let answerChoice: string | null = null;
    let answerRating: number | null = null;

    if (question.question_type === 'text' || question.question_type === 'long_text') {
      answerText = String(answer.value);
    } else if (question.question_type === 'number' || question.question_type === 'rating') {
      answerNumber = Number(answer.value);
      answerRating = question.question_type === 'rating' ? answerNumber : null;
    } else {
      answerChoice = Array.isArray(answer.value) ? answer.value.join(',') : String(answer.value);
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
