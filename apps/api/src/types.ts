import type { Context, Hono } from 'hono';
import type { Handler } from 'hono';

/**
 * Cloudflare bindings available to the API Worker / Pages Function.
 *
 * Only `survey_db` and `JWT_SECRET` are required. Everything else is optional
 * and degrades gracefully when it is not configured, so the same code runs in
 * local dev, staging and production without a hard dependency on any add-on.
 */
export type Bindings = {
  survey_db: D1Database;
  JWT_SECRET?: string;

  /** 'production' | 'staging' | 'development'. Defaults to production. */
  ENVIRONMENT?: string;
  /** Comma-separated list of extra allowed browser origins. */
  ALLOWED_ORIGINS?: string;
  /** Public site origin used for links; informational only. */
  PUBLIC_SITE_ORIGIN?: string;

  /** Optional R2 bucket for uploaded media (`MEDIA_BUCKET`). */
  MEDIA_BUCKET?: R2Bucket;

  /** Optional Queues producer for non-critical work. */
  ANALYTICS_QUEUE?: Queue;

  /** Optional Cloudflare Rate Limiting binding. */
  RATE_LIMITER?: {
    limit: (options: { key: string }) => Promise<{ success: boolean }>;
  };

  /** Verbose SQL logging in development only. */
  DB_DEBUG?: string;
};

export type Variables = {
  userId: string;
  role: string;
  isAdmin: boolean;
  requestId: string;
  clientIp: string;
  startedAt: number;
  settings: Settings;
};

export type AppContext = {
  Bindings: Bindings;
  Variables: Variables;
};

export type App = Hono<AppContext>;
export type AppHandler = Handler<AppContext>;
export type Ctx = Context<AppContext>;

export type Settings = {
  maintenanceMode: boolean;
  surveyEnabled: boolean;
  spinEnabled: boolean;
  deliveryEnabled: boolean;
  configVersion: string;
};

export const DEFAULT_SETTINGS: Settings = {
  maintenanceMode: false,
  surveyEnabled: true,
  spinEnabled: true,
  deliveryEnabled: true,
  configVersion: 'unknown',
};
