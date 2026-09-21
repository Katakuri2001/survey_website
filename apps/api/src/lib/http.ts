import type { Context } from 'hono';
import type { AppContext } from '../types';

/**
 * Stable, client-facing error codes. The frontend maps these to copy; the raw
 * database / runtime error is never returned to the browser.
 */
export const ErrorCode = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  ALREADY_SUBMITTED: 'ALREADY_SUBMITTED',
  ALREADY_SPUN: 'ALREADY_SPUN',
  SPIN_IN_PROGRESS: 'SPIN_IN_PROGRESS',
  REWARD_UNAVAILABLE: 'REWARD_UNAVAILABLE',
  FEATURE_DISABLED: 'FEATURE_DISABLED',
  MAINTENANCE: 'MAINTENANCE',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  TURNSTILE_FAILED: 'TURNSTILE_FAILED',
  TEMPORARY_UNAVAILABLE: 'TEMPORARY_UNAVAILABLE',
  INTERNAL: 'INTERNAL',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

const STATUS_BY_CODE: Record<string, number> = {
  [ErrorCode.INVALID_REQUEST]: 400,
  [ErrorCode.VALIDATION_FAILED]: 422,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.ALREADY_SUBMITTED]: 409,
  [ErrorCode.ALREADY_SPUN]: 409,
  [ErrorCode.SPIN_IN_PROGRESS]: 409,
  [ErrorCode.REWARD_UNAVAILABLE]: 409,
  [ErrorCode.FEATURE_DISABLED]: 409,
  [ErrorCode.MAINTENANCE]: 503,
  [ErrorCode.PAYLOAD_TOO_LARGE]: 413,
  [ErrorCode.TURNSTILE_FAILED]: 403,
  [ErrorCode.TEMPORARY_UNAVAILABLE]: 503,
  [ErrorCode.INTERNAL]: 500,
};

export type JsonMeta = Record<string, unknown>;

export function success(c: Context<AppContext>, data: unknown, meta?: JsonMeta, status = 200) {
  return c.json({ success: true, data, ...(meta ? { meta } : {}) }, status as never);
}

export function failure(
  c: Context<AppContext>,
  code: ErrorCodeValue | string,
  message: string,
  status = STATUS_BY_CODE[code] ?? 400,
  extra?: JsonMeta
) {
  // `message` is duplicated at the top level for older admin clients that read
  // `data.message` instead of `data.error.message`. The canonical field remains
  // `error.message`.
  return c.json(
    { success: false, message, error: { code, message, ...(extra ?? {}) } },
    status as never
  );
}

/** Best-effort conversion of an unknown throwable into a safe log string. */
export function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

export function isUniqueViolation(error: unknown): boolean {
  const message = describeError(error).toLowerCase();
  // D1 messages look like:
  //   "UNIQUE constraint failed: users.phone: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_UNIQUE)"
  // Only match uniqueness, not CHECK/FOREIGN KEY constraint failures.
  return message.includes('unique constraint') || message.includes('sqlite_constraint_unique');
}

export function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

const REQUEST_ID_RE = /^[A-Za-z0-9._:-]{8,128}$/;

/** Accept a well-formed client correlation ID, otherwise generate one. */
export function resolveRequestId(header: string | undefined): string {
  if (header && REQUEST_ID_RE.test(header)) return header;
  return crypto.randomUUID();
}

export function clientIp(c: Context<AppContext>): string {
  return (
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-real-ip') ||
    (c.req.header('x-forwarded-for') || '').split(',')[0]?.trim() ||
    'unknown'
  );
}

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=()',
  'Cross-Origin-Resource-Policy': 'same-site',
};

export function applySecurityHeaders(headers: Headers): void {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'no-store');
  }
}

/**
 * Only the real application origins may call authenticated APIs. Same-origin
 * requests (the normal Pages deployment) are always allowed, as are localhost
 * dev origins outside production.
 */
export function isAllowedOrigin(origin: string | undefined, requestUrl: string, allowed: string, env: string): boolean {
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const requestHost = new URL(requestUrl).host;
    if (originUrl.host === requestHost) return true;
    const list = allowed
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (list.includes(origin)) return true;
    if (env !== 'production' && /^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
    if (env !== 'production' && /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return true;
    return false;
  } catch {
    return false;
  }
}

/** Structured single-line log, safe to ship to Workers Logs. */
export function logEvent(level: 'info' | 'warn' | 'error', event: string, fields: JsonMeta = {}): void {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}
