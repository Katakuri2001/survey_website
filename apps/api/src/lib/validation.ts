import { z } from 'zod';
import type { Context } from 'hono';
import type { AppContext } from '../types';
import { ErrorCode, failure } from './http';

const language = z.enum(['en', 'my']);
const shortText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).nullish();
const strictDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD').refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Invalid calendar date');

const nrcState = z.string().trim().regex(/^(?:9\*|[1-9]|1[0-4])$/).max(8);
const nrcTownship = z.string().trim().regex(/^(?!-)[A-Z0-9*-]{1,32}$/);
const nrcType = z.enum(['N', 'E', 'P', 'T', 'Y', 'S']);
const nrcNumber = z.string().trim().regex(/^\d{6}$/);

function addNrcCompleteness(
  value: { nrcState?: string | null; nrcTownship?: string | null; nrcType?: string | null; nrcNumber?: string | null },
  ctx: z.RefinementCtx
): void {
  const parts = [value.nrcState, value.nrcTownship, value.nrcType, value.nrcNumber].filter((part) => part !== undefined && part !== null && part !== '');
  if (parts.length > 0 && parts.length < 4) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nrcNumber'], message: 'All NRC fields are required when any NRC field is provided' });
  }
}

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

export const registerSchema = z.object({
  fullName: shortText(200),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: optionalText(32),
  password: z.string().min(6).max(200),
  age: z.coerce.number().int().min(0).max(120).optional(),
  gender: optionalText(32),
  city: optionalText(120),
  township: optionalText(120),
  nrcState: nrcState.nullish(),
  nrcTownship: nrcTownship.nullish(),
  nrcType: nrcType.nullish(),
  nrcNumber: nrcNumber.nullish(),
  occupation: optionalText(120),
}).superRefine(addNrcCompleteness);

export const guestSchema = z.object({
  fullName: shortText(200),
  phone: z.string().trim().min(4).max(32),
  dob: strictDate,
  resumeToken: z.string().trim().regex(/^gst_[A-Za-z0-9_-]{43}$/).optional(),
  stateCode: nrcState.nullish(),
  nrcTownship: nrcTownship.nullish(),
  nrcType: nrcType.nullish(),
  nrcNumber: nrcNumber.nullish(),
}).superRefine((value, ctx) => addNrcCompleteness({
  nrcState: value.stateCode,
  nrcTownship: value.nrcTownship,
  nrcType: value.nrcType,
  nrcNumber: value.nrcNumber,
}, ctx));

export const profileUpdateSchema = z.object({
  fullName: optionalText(200),
  phone: optionalText(32),
  age: z.coerce.number().int().min(0).max(120).optional(),
  gender: optionalText(32),
  city: optionalText(120),
  township: optionalText(120),
  nrcState: nrcState.nullish(),
  nrcTownship: nrcTownship.nullish(),
  nrcType: nrcType.nullish(),
  nrcNumber: nrcNumber.nullish(),
  occupation: optionalText(120),
}).superRefine(addNrcCompleteness);

const answerValue = z.union([
  z.string().max(2000),
  z.number(),
  z.array(z.string().max(500)).max(50),
]);

export const surveySubmitSchema = z.object({
  campaignId: optionalText(100),
  productId: optionalText(100),
  surveyVersionId: optionalText(100),
  language: language.default('en'),
  submissionRequestId: z.string().trim().min(8).max(128).optional(),
  answers: z
    .array(
      z.object({
        questionId: z.string().trim().min(1).max(100),
        type: z.string().trim().max(32).optional(),
        value: answerValue,
      })
    )
    .max(100),
});

export const spinSchema = z.object({
  campaignId: optionalText(100),
  productId: optionalText(100),
  idempotencyKey: z.string().trim().min(8).max(128),
});

export const deliverySchema = z.object({
  userRewardId: z.string().trim().min(1).max(100),
  fullName: shortText(200),
  phone: z.string().trim().min(4).max(32),
  address: shortText(500),
  city: shortText(120),
  township: optionalText(120),
  postalCode: optionalText(32),
  notes: optionalText(1000),
});

const translationRecord = <T extends z.ZodTypeAny>(value: T) =>
  z.record(language, value).optional();

const translations = translationRecord(z.object({
  name: optionalText(200),
  title: optionalText(200),
  description: optionalText(2000),
}));

export const rewardCreateSchema = z.object({
  name: shortText(200),
  description: optionalText(2000),
  imageUrl: optionalText(2048),
  totalQuantity: z.coerce.number().int().min(0).max(10_000_000),
  weight: z.coerce.number().int().min(0).max(1_000_000).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).max(1_000_000).optional(),
  campaignId: optionalText(100),
  winningRatio: z.coerce.number().min(0).max(100).nullable().optional(),
  requiresDelivery: z.boolean().optional(),
  translations,
});

export const rewardUpdateSchema = z.object({
  name: optionalText(200),
  description: optionalText(2000),
  imageUrl: optionalText(2048),
  totalQuantity: z.coerce.number().int().min(0).max(10_000_000).optional(),
  weight: z.coerce.number().int().min(0).max(1_000_000).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).max(1_000_000).optional(),
  isActive: z.coerce.number().int().min(0).max(1).optional(),
  // Accepted for UI compatibility; the handler derives stock-dependent values
  // (EXHAUSTED/LOW_STOCK) from remaining_quantity — PAUSED is the only
  // value honored verbatim.
  status: z.enum(['AVAILABLE', 'LOW_STOCK', 'EXHAUSTED', 'PAUSED']).optional(),
  campaignId: optionalText(100),
  winningRatio: z.coerce.number().min(0).max(100).nullable().optional(),
  requiresDelivery: z.coerce.number().int().min(0).max(1).optional(),
  translations,
});

export const stockAdjustSchema = z.object({
  adjustment: z.coerce.number().int().min(-10_000_000).max(10_000_000),
  reason: optionalText(500),
});

export const deliveryStatusSchema = z.object({
  status: z.enum(['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
});

export const productCreateSchema = z.object({
  name: shortText(200),
  description: optionalText(2000),
  brand: optionalText(120),
  imageUrl: optionalText(2048),
  displayOrder: z.coerce.number().int().min(-1000).max(100000).optional(),
  translations,
});

export const productUpdateSchema = productCreateSchema.partial().extend({
  isActive: z.coerce.number().int().min(0).max(1).optional(),
});

const questionType = z.enum([
  'single_choice',
  'multiple_choice',
  'dropdown',
  'rating',
  'number',
  'text',
  'long_text',
  'yes_no',
]);
const choiceQuestionType = new Set(['single_choice', 'multiple_choice', 'dropdown']);

const questionOptionSchema = z.object({
  text: shortText(500),
  value: optionalText(500),
  displayOrder: z.coerce.number().int().min(0).max(100000).optional(),
  translations: translationRecord(z.string().trim().min(1).max(500)),
});

export const questionCreateSchema = z.object({
  surveyVersionId: shortText(100),
  questionText: shortText(2000),
  questionType: questionType.default('single_choice'),
  isRequired: z.boolean().optional(),
  displayOrder: z.coerce.number().int().min(0).max(100000).optional(),
  validationRules: optionalText(2000),
  imageUrl: optionalText(2048),
  productType: optionalText(64),
  translations: translationRecord(z.string().trim().min(1).max(2000)),
  options: z.array(questionOptionSchema).min(1).max(100).optional(),
}).superRefine((value, ctx) => {
  if (choiceQuestionType.has(value.questionType) && (!value.options || value.options.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'Choice questions require at least one option' });
  }
});

export const questionUpdateSchema = z.object({
  questionText: optionalText(2000),
  questionType: questionType.optional(),
  isRequired: z.coerce.number().int().min(0).max(1).optional(),
  displayOrder: z.coerce.number().int().min(0).max(100000).optional(),
  isActive: z.coerce.number().int().min(0).max(1).optional(),
  validationRules: optionalText(2000),
  imageUrl: optionalText(2048),
  productType: optionalText(64),
  translations: translationRecord(z.string().trim().min(1).max(2000)),
  options: z.array(questionOptionSchema).min(1).max(100).optional(),
});

export const surveyVersionCreateSchema = z.object({
  productId: shortText(100),
  title: shortText(200),
  description: optionalText(2000),
  cloneFromVersionId: optionalText(100),
  activate: z.boolean().default(false),
  translations: translationRecord(
    z.object({ title: optionalText(200), description: optionalText(2000) })
  ),
});

export const surveyVersionStatusSchema = z.object({
  isActive: z.boolean(),
});

export const settingsUpdateSchema = z.object({
  settings: z.record(
    z.enum(['maintenance_mode', 'survey_enabled', 'spin_enabled', 'delivery_enabled', 'config_version']),
    z.string().max(200)
  ),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
});

export const exportPaginationSchema = paginationSchema.extend({
  limit: z.coerce.number().int().min(1).max(5000).default(1000),
});

export type Parsed<T> = { ok: true; data: T } | { ok: false; response: Response };

/** Parse and validate a JSON body, returning a safe 4xx response on failure. */
export async function readJson<S extends z.ZodTypeAny>(
  c: Context<AppContext>,
  schema: S
): Promise<Parsed<z.infer<S>>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return { ok: false, response: failure(c, ErrorCode.INVALID_REQUEST, 'Malformed JSON body') };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.join('.') || 'body';
    return {
      ok: false,
      response: failure(c, ErrorCode.VALIDATION_FAILED, `${path}: ${issue.message}`, 422),
    };
  }
  return { ok: true, data: parsed.data };
}

/** Parse validated query-string values (pagination, filters). */
export function readQuery<S extends z.ZodTypeAny>(c: Context<AppContext>, schema: S): Parsed<z.infer<S>> {
  const raw = Object.fromEntries(new URL(c.req.url).searchParams.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.join('.') || 'query';
    return {
      ok: false,
      response: failure(c, ErrorCode.VALIDATION_FAILED, `${path}: ${issue.message}`, 422),
    };
  }
  return { ok: true, data: parsed.data };
}
