import { Hono } from 'hono';
import type { AppContext, Bindings } from './types';
import {
  ErrorCode,
  applySecurityHeaders,
  clientIp,
  describeError,
  failure,
  isAllowedOrigin,
  logEvent,
  resolveRequestId,
  success,
} from './lib/http';
import { getSettings, maintenanceResponse } from './lib/security';
import { publicRoutes } from './routes/public';
import { authRoutes } from './routes/auth';
import { surveyRoutes } from './routes/survey';
import { rewardRoutes } from './routes/rewards';
import { adminRoutes } from './routes/admin';

/**
 * Composition root.
 *
 * The actual endpoints live in `routes/*`; this file is responsible for the
 * cross-cutting concerns that must wrap every request:
 *
 *  1. correlation id + timing + client IP
 *  2. CORS (origin aware) and security headers
 *  3. feature flags / settings, maintenance guard
 *  4. structured request logging
 *  5. mounting the route modules
 *
 * `apiApp.fetch` is kept as the single entry point so the two Cloudflare Pages
 * Functions wrappers (`functions/api/[[route]].ts`) keep working unchanged.
 */
export const app = new Hono<AppContext>();

// ------------------------------------------------------------------
// 1. Correlation id, timing, client IP
// ------------------------------------------------------------------

app.use('*', async (c, next) => {
  c.set('requestId', resolveRequestId(c.req.header('x-request-id')));
  c.set('clientIp', clientIp(c));
  c.set('startedAt', Date.now());
  await next();
});

// ------------------------------------------------------------------
// 2. CORS (origin aware) + security headers
// ------------------------------------------------------------------

app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  const environment = c.env.ENVIRONMENT || 'production';
  const allowed = isAllowedOrigin(origin, c.req.url, c.env.ALLOWED_ORIGINS || '', environment);

  if (c.req.method === 'OPTIONS') {
    const headers = new Headers();
    if (origin && allowed) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Vary', 'Origin');
      headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Request-Id');
      headers.set('Access-Control-Max-Age', '86400');
    }
    return new Response(null, { status: 204, headers });
  }

  await next();

  // Never reflect an unrecognised origin: the browser then blocks the response.
  if (origin && allowed) {
    c.res.headers.set('Access-Control-Allow-Origin', origin);
    c.res.headers.set('Vary', 'Origin');
  }
  applySecurityHeaders(c.res.headers);
  c.res.headers.set('X-Request-Id', c.get('requestId'));
});

// ------------------------------------------------------------------
// 3. Settings / feature flags + maintenance guard
// ------------------------------------------------------------------

app.use('*', async (c, next) => {
  const settings = await getSettings(c);
  c.set('settings', settings);

  // Redundant with the per-route checks, but it guarantees a public write can
  // never slip through while an incident is in progress. Admin and login stay
  // reachable so operators can recover the system.
  if (settings.maintenanceMode && isMaintenanceBlocked(c.req.method, c.req.path)) {
    return maintenanceResponse(c);
  }

  await next();
});

const MAINTENANCE_BLOCKED: ReadonlyArray<[string, string]> = [
  ['POST', '/auth/register'],
  ['POST', '/users/guest'],
  ['POST', '/survey/submit'],
  ['POST', '/rewards/spin'],
  ['POST', '/rewards/delivery'],
];

function isMaintenanceBlocked(method: string, path: string): boolean {
  const normalized = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  return MAINTENANCE_BLOCKED.some(([m, p]) => m === method && p === normalized);
}

// ------------------------------------------------------------------
// 4. Structured request logging
// ------------------------------------------------------------------

app.use('*', async (c, next) => {
  await next();

  const status = c.res.status;
  const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
  logEvent(level, 'request', {
    requestId: c.get('requestId'),
    method: c.req.method,
    path: c.req.path,
    status,
    durationMs: Date.now() - c.get('startedAt'),
    ip: c.get('clientIp'),
    userId: c.get('userId') || undefined,
  });
});

// ------------------------------------------------------------------
// 5. Routes
// ------------------------------------------------------------------

// Public + authenticated user-facing routes are mounted at the root; their
// paths already include the full operation name (e.g. `/survey/submit`).
app.route('/', publicRoutes);
app.route('/', authRoutes);
app.route('/', surveyRoutes);
app.route('/', rewardRoutes);

// Admin routes are mounted under `/admin`; the module itself declares the
// operation only (e.g. `/dashboard`), so its `use('*')` auth middleware is
// scoped to `/admin/*` and cannot leak onto public routes.
app.route('/admin', adminRoutes);

// ------------------------------------------------------------------
// Error handling
// ------------------------------------------------------------------

app.notFound((c) => failure(c, ErrorCode.NOT_FOUND, 'Endpoint not found'));

app.onError((err, c) => {
  logEvent('error', 'unhandled_error', {
    requestId: c.get('requestId'),
    method: c.req.method,
    path: c.req.path,
    error: describeError(err),
  });
  // The raw error is intentionally never returned to the client.
  return failure(c, ErrorCode.INTERNAL, 'An unexpected error occurred.');
});

// ------------------------------------------------------------------
// Scheduled cleanup (optional cron trigger)
// ------------------------------------------------------------------

/**
 * Cancels spins that were left in-flight ('PENDING') by a crash between the
 * inventory reservation and the final batch. This lets the user retry instead
 * of being permanently stuck on `SPIN_IN_PROGRESS`. Only 'PENDING' is targeted:
 * 'PROCESSING' is a real delivery status set by admins, so it must never be
 * cancelled here. Stock reserved by such a spin is not restored (the reserved
 * reward is not recorded until finalisation); the window is the few
 * milliseconds of the final `db.batch()`.
 */
async function runScheduled(env: Bindings): Promise<void> {
  try {
    const result = await env.survey_db
      .prepare(
        `UPDATE reward_spins
            SET status = 'CANCELLED', updated_at = ?
          WHERE status = 'PENDING'
            AND updated_at < ?`
      )
      .bind(new Date().toISOString(), new Date(Date.now() - 15 * 60 * 1000).toISOString())
      .run();
    logEvent('info', 'scheduled_stale_spin_cleanup', { cancelled: result.meta.changes });
  } catch (error) {
    logEvent('error', 'scheduled_cleanup_failed', { error: describeError(error) });
  }
}

export default {
  fetch(request: Request, env: Bindings, ctx: ExecutionContext): Response | Promise<Response> {
    return app.fetch(request, env, ctx);
  },
  scheduled(_controller: ScheduledController, env: Bindings, ctx: ExecutionContext): void {
    ctx.waitUntil(runScheduled(env));
  },
};
