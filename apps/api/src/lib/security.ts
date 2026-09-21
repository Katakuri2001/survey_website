import type { Context } from 'hono';
import type { AppContext, Settings } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { ErrorCode, failure, logEvent } from './http';

// ============================================================
// Rate limiting (route-specific, best effort per isolate)
// ============================================================

export type RatePolicy = { limit: number; windowSeconds: number };

type BucketState = { count: number; resetAt: number };
const memoryBuckets = new Map<string, BucketState>();
const MAX_BUCKETS = 20_000;

function pruneBuckets(now: number): void {
  if (memoryBuckets.size < MAX_BUCKETS) return;
  for (const [key, state] of memoryBuckets) {
    if (state.resetAt <= now) memoryBuckets.delete(key);
  }
  // If still too large, drop the oldest entries.
  if (memoryBuckets.size >= MAX_BUCKETS) {
    const excess = memoryBuckets.size - MAX_BUCKETS / 2;
    let removed = 0;
    for (const key of memoryBuckets.keys()) {
      memoryBuckets.delete(key);
      if (++removed >= excess) break;
    }
  }
}

/**
 * Returns a 429 response when the caller exceeded `policy`, otherwise null.
 * The Cloudflare Rate Limiting binding is used when bound; the in-memory
 * window always applies and provides per-route granularity.
 */
export async function enforceRateLimit(
  c: Context<AppContext>,
  bucket: string,
  identifier: string,
  policy: RatePolicy
): Promise<Response | null> {
  const key = `${bucket}:${identifier}`;

  if (c.env.RATE_LIMITER) {
    try {
      const result = await c.env.RATE_LIMITER.limit({ key });
      if (!result.success) {
        return rateLimited(c, policy);
      }
    } catch (error) {
      logEvent('warn', 'rate_limiter_error', { bucket, error: String(error) });
    }
  }

  const now = Date.now();
  pruneBuckets(now);
  const state = memoryBuckets.get(key);
  if (!state || state.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + policy.windowSeconds * 1000 });
    return null;
  }
  state.count += 1;
  if (state.count > policy.limit) {
    return rateLimited(c, policy, state.resetAt);
  }
  return null;
}

function rateLimited(c: Context<AppContext>, policy: RatePolicy, resetAt?: number): Response {
  const retryAfter = Math.max(1, Math.ceil(((resetAt ?? Date.now() + policy.windowSeconds * 1000) - Date.now()) / 1000));
  c.header('Retry-After', String(retryAfter));
  return failure(c, ErrorCode.RATE_LIMITED, 'Too many requests. Please wait a moment and try again.', 429, {
    retryAfter,
  });
}

export const RATE_POLICIES = {
  login: { limit: 10, windowSeconds: 60 },
  guest: { limit: 20, windowSeconds: 60 },
  surveySubmit: { limit: 10, windowSeconds: 60 },
  spin: { limit: 20, windowSeconds: 60 },
  delivery: { limit: 10, windowSeconds: 60 },
  admin: { limit: 240, windowSeconds: 60 },
  upload: { limit: 20, windowSeconds: 60 },
} as const;

// ============================================================
// Turnstile (server-side Siteverify)
// ============================================================

type TurnstileResponse = { success: boolean; 'error-codes'?: string[]; action?: string };

export async function verifyTurnstile(
  c: Context<AppContext>,
  token: string | undefined,
  expectedAction?: string
): Promise<Response | null> {
  const secret = c.env.TURNSTILE_SECRET;
  const siteKey = c.env.TURNSTILE_SITE_KEY;
  // Not configured (local dev / staged rollout): do not block the flow. Both
  // values are required, so a missing site key can never lock users out.
  if (!secret || !siteKey) return null;

  if (!token || typeof token !== 'string') {
    return failure(c, ErrorCode.TURNSTILE_FAILED, 'Verification challenge is required.');
  }

  try {
    const form = new FormData();
    form.append('secret', secret);
    form.append('response', token);
    const ip = c.get('clientIp');
    if (ip && ip !== 'unknown') form.append('remoteip', ip);

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const data = (await response.json()) as TurnstileResponse;
    if (!data.success) {
      logEvent('warn', 'turnstile_failed', { codes: data['error-codes'] || [] });
      return failure(c, ErrorCode.TURNSTILE_FAILED, 'Verification failed. Please refresh and try again.');
    }
    if (expectedAction && data.action && data.action !== expectedAction) {
      return failure(c, ErrorCode.TURNSTILE_FAILED, 'Verification action mismatch.');
    }
    return null;
  } catch (error) {
    logEvent('error', 'turnstile_error', { error: String(error) });
    // Fail closed for protected actions when the verifier is configured.
    return failure(c, ErrorCode.TEMPORARY_UNAVAILABLE, 'Verification is temporarily unavailable.', 503);
  }
}

// ============================================================
// Settings / feature flags
// ============================================================

type SettingsCache = { value: Settings; expiresAt: number };
let settingsCache: SettingsCache | null = null;
const SETTINGS_TTL_MS = 30_000;

export function invalidateSettingsCache(): void {
  settingsCache = null;
}

function parseFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  return value === '1' || value.toLowerCase() === 'true';
}

/** Settings are cached in-isolate for 30 s; admin writes invalidate immediately. */
export async function getSettings(c: Context<AppContext>): Promise<Settings> {
  const now = Date.now();
  if (settingsCache && settingsCache.expiresAt > now) return settingsCache.value;

  try {
    const rows = await c.env.survey_db.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>();
    const map = new Map((rows.results || []).map((row) => [row.key, row.value]));
    const value: Settings = {
      maintenanceMode: parseFlag(map.get('maintenance_mode'), DEFAULT_SETTINGS.maintenanceMode),
      surveyEnabled: parseFlag(map.get('survey_enabled'), DEFAULT_SETTINGS.surveyEnabled),
      spinEnabled: parseFlag(map.get('spin_enabled'), DEFAULT_SETTINGS.spinEnabled),
      deliveryEnabled: parseFlag(map.get('delivery_enabled'), DEFAULT_SETTINGS.deliveryEnabled),
      configVersion: map.get('config_version') || DEFAULT_SETTINGS.configVersion,
    };
    settingsCache = { value, expiresAt: now + SETTINGS_TTL_MS };
    return value;
  } catch (error) {
    logEvent('warn', 'settings_read_failed', { error: String(error) });
    return { ...DEFAULT_SETTINGS, configVersion: 'fallback' };
  }
}

/**
 * Maintenance mode blocks public writes but never blocks admin operations, and
 * returns a stable, leak-free response.
 */
export function maintenanceResponse(c: Context<AppContext>): Response {
  return failure(c, ErrorCode.MAINTENANCE, 'The survey is temporarily paused. Please try again shortly.', 503);
}

// ============================================================
// Edge cache helper (public, cache-safe responses only)
// ============================================================

type CacheOptions = { key: string; ttlSeconds: number; staleSeconds?: number };

type CacheLike = { match: (req: Request) => Promise<Response | undefined>; put: (req: Request, res: Response) => Promise<void> };

function getCache(): CacheLike | null {
  try {
    const cachesAny = (globalThis as unknown as { caches?: { default?: CacheLike } }).caches;
    return cachesAny?.default ?? null;
  } catch {
    return null;
  }
}

/**
 * Serve a public GET from the Cloudflare cache when possible. Never use for
 * authenticated or user-specific data.
 */
export async function cachedPublicGet(
  c: Context<AppContext>,
  options: CacheOptions,
  producer: () => Promise<unknown>
): Promise<Response> {
  const cache = getCache();
  const url = new URL(c.req.url);
  url.pathname = `/__cache${options.key}`;
  url.search = '';
  const cacheKey = new Request(url.toString(), { method: 'GET' });

  if (cache) {
    try {
      const hit = await cache.match(cacheKey);
      if (hit) {
        const body = await hit.text();
        return new Response(body, {
          status: 200,
          headers: { ...Object.fromEntries(hit.headers), 'X-Cache': 'HIT', 'Content-Type': 'application/json' },
        });
      }
    } catch (error) {
      logEvent('warn', 'cache_read_error', { error: String(error) });
    }
  }

  const data = await producer();
  const body = JSON.stringify({ success: true, data });
  const response = new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${options.ttlSeconds}, s-maxage=${options.ttlSeconds}${
        options.staleSeconds ? `, stale-while-revalidate=${options.staleSeconds}` : ''
      }`,
      'X-Cache': 'MISS',
    },
  });

  if (cache) {
    try {
      await cache.put(cacheKey, response.clone());
    } catch (error) {
      logEvent('warn', 'cache_write_error', { error: String(error) });
    }
  }
  return response;
}
