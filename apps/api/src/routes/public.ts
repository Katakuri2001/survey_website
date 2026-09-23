import { Hono } from 'hono';
import type { AppContext } from '../types';
import { ErrorCode, failure, logEvent, success } from '../lib/http';
import { cachedPublicGet, getSettings } from '../lib/security';
import { loadSurveyConfig } from '../lib/survey';

export const publicRoutes = new Hono<AppContext>();

function resolveLang(raw: string | undefined): string {
  return raw === 'my' ? 'my' : 'en';
}

// ============================================================
// Service root
// ============================================================

publicRoutes.get('/', (c) =>
  success(c, {
    name: 'Myanmar Beer Survey API',
    version: '2.0.0',
    endpoints: {
      auth: ['/auth/register', '/auth/login', '/auth/admin/login', '/users/guest'],
      user: ['/user/profile'],
      public: ['/public/config', '/products', '/campaigns', '/rewards', '/health'],
      survey: ['/survey/questions', '/survey/questions/:productId', '/survey/submit'],
      rewards: ['/rewards/spin', '/rewards/delivery', '/rewards/my'],
      admin: [
        '/admin/dashboard',
        '/admin/analytics/*',
        '/admin/survey/*',
        '/admin/products',
        '/admin/rewards/*',
        '/admin/deliveries',
        '/admin/users',
        '/admin/responses',
        '/admin/audit-logs',
        '/admin/settings',
        '/admin/account',
        '/admin/account/password',
      ],
    },
  })
);

// ============================================================
// Media (R2). Returns 404 when no bucket is bound, so uploads keep
// working as D1 data-URLs when the optional MEDIA_BUCKET binding is absent.
// ============================================================

publicRoutes.get('/media/:key', async (c) => {
  const bucket = c.env.MEDIA_BUCKET;
  if (!bucket) {
    return failure(c, ErrorCode.NOT_FOUND, 'Media storage is not configured', 404);
  }

  try {
    const object = await bucket.get(c.req.param('key'));
    if (!object) {
      return failure(c, ErrorCode.NOT_FOUND, 'Media not found', 404);
    }
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('ETag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(object.body, { headers });
  } catch (error) {
    logEvent('error', 'media_read_failed', { error: String(error) });
    return failure(c, ErrorCode.INTERNAL, 'Media unavailable', 500);
  }
});

// ============================================================
// Health check (used by uptime monitors and the load test)
// ============================================================

publicRoutes.get('/health', async (c) => {
  const startedAt = Date.now();
  try {
    const row = await c.env.survey_db.prepare('SELECT 1 AS ok').first<{ ok: number }>();
    const settings = c.get('settings') ?? (await getSettings(c));
    return success(c, {
      status: row?.ok === 1 ? 'ok' : 'degraded',
      database: row?.ok === 1 ? 'ok' : 'error',
      environment: c.env.ENVIRONMENT || 'production',
      configVersion: settings.configVersion,
      maintenanceMode: settings.maintenanceMode,
      latencyMs: Date.now() - startedAt,
      time: new Date().toISOString(),
    });
  } catch (error) {
    logEvent('error', 'health_check_failed', { error: String(error) });
    return failure(c, ErrorCode.INTERNAL, 'Database unavailable', 503);
  }
});

// ============================================================
// Combined public config (cache-friendly; replaces the polling storm)
// ============================================================

publicRoutes.get('/public/config', async (c) => {
  const language = resolveLang(c.req.query('lang'));

  return cachedPublicGet(c, { key: `/public/config/${language}`, ttlSeconds: 60, staleSeconds: 300 }, async () => {
    const [products, campaigns, rewards, survey, settings] = await Promise.all([
      c.env.survey_db
        .prepare(
          `SELECT p.id, p.name, p.description, p.brand, p.image_url, p.display_order,
                  COALESCE(pt.name, p.name) as name,
                  COALESCE(pt.description, p.description) as description
           FROM products p
           LEFT JOIN product_translations pt ON p.id = pt.product_id AND pt.language = ?
           WHERE p.is_active = 1
           ORDER BY p.display_order`
        )
        .bind(language)
        .all(),
      c.env.survey_db
        .prepare(
          `SELECT c.id, c.name, c.description, c.slug, c.start_date, c.end_date,
                  COALESCE(ct.name, c.name) as name,
                  COALESCE(ct.description, c.description) as description
           FROM campaigns c
           LEFT JOIN campaign_translations ct ON c.id = ct.campaign_id AND ct.language = ?
           WHERE c.is_active = 1
           ORDER BY c.start_date DESC`
        )
        .bind(language)
        .all(),
      c.env.survey_db
        .prepare(
          `SELECT r.id, r.name, r.description, r.image_url, r.weight, r.status, r.winning_ratio,
                  r.remaining_quantity, r.low_stock_threshold, r.requires_delivery,
                  COALESCE(rt.name, r.name) as name,
                  COALESCE(rt.description, r.description) as description
           FROM rewards r
           LEFT JOIN reward_translations rt ON r.id = rt.reward_id AND rt.language = ?
           WHERE r.is_active = 1 AND r.remaining_quantity > 0
             AND r.status != 'EXHAUSTED' AND r.status != 'PAUSED'
           ORDER BY r.weight DESC`
        )
        .bind(language)
        .all(),
      loadSurveyConfig(c.env.survey_db, language),
      getSettings(c),
    ]);

    return {
      version: settings.configVersion,
      language,
      settings: {
        maintenanceMode: settings.maintenanceMode,
        surveyEnabled: settings.surveyEnabled,
        spinEnabled: settings.spinEnabled,
        deliveryEnabled: settings.deliveryEnabled,
      },
      products: products.results || [],
      campaigns: campaigns.results || [],
      rewards: rewards.results || [],
      survey,
    };
  });
});

// ============================================================
// Individual public resources (kept for backwards compatibility)
// ============================================================

publicRoutes.get('/products', async (c) => {
  const language = resolveLang(c.req.query('lang'));
  return cachedPublicGet(c, { key: `/products/${language}`, ttlSeconds: 60, staleSeconds: 300 }, async () => {
    const rows = await c.env.survey_db
      .prepare(
        `SELECT p.id, p.name, p.description, p.brand, p.image_url, p.display_order,
                COALESCE(pt.name, p.name) as name,
                COALESCE(pt.description, p.description) as description
         FROM products p
         LEFT JOIN product_translations pt ON p.id = pt.product_id AND pt.language = ?
         WHERE p.is_active = 1
         ORDER BY p.display_order`
      )
      .bind(language)
      .all();
    return rows.results || [];
  });
});

publicRoutes.get('/campaigns', async (c) => {
  const language = resolveLang(c.req.query('lang'));
  return cachedPublicGet(c, { key: `/campaigns/${language}`, ttlSeconds: 60, staleSeconds: 300 }, async () => {
    const rows = await c.env.survey_db
      .prepare(
        `SELECT c.id, c.name, c.description, c.slug, c.start_date, c.end_date,
                COALESCE(ct.name, c.name) as name,
                COALESCE(ct.description, c.description) as description
         FROM campaigns c
         LEFT JOIN campaign_translations ct ON c.id = ct.campaign_id AND ct.language = ?
         WHERE c.is_active = 1
         ORDER BY c.start_date DESC`
      )
      .bind(language)
      .all();
    return rows.results || [];
  });
});

publicRoutes.get('/rewards', async (c) => {
  const language = resolveLang(c.req.query('lang'));
  return cachedPublicGet(c, { key: `/rewards/${language}`, ttlSeconds: 30, staleSeconds: 120 }, async () => {
    const rows = await c.env.survey_db
      .prepare(
        `SELECT r.id, r.name, r.description, r.image_url, r.weight, r.status, r.winning_ratio,
                r.remaining_quantity, r.low_stock_threshold, r.requires_delivery,
                COALESCE(rt.name, r.name) as name,
                COALESCE(rt.description, r.description) as description
         FROM rewards r
         LEFT JOIN reward_translations rt ON r.id = rt.reward_id AND rt.language = ?
         WHERE r.is_active = 1 AND r.remaining_quantity > 0
           AND r.status != 'EXHAUSTED' AND r.status != 'PAUSED'
         ORDER BY r.weight DESC`
      )
      .bind(language)
      .all();
    return rows.results || [];
  });
});

// Latest active survey across all products.
publicRoutes.get('/survey/questions', async (c) => {
  const language = resolveLang(c.req.query('lang'));
  return cachedPublicGet(c, { key: `/survey/questions/${language}`, ttlSeconds: 30, staleSeconds: 120 }, async () => {
    const config = await loadSurveyConfig(c.env.survey_db, language);
    if (!config.version) {
      throw new Error('NO_ACTIVE_SURVEY');
    }
    return config;
  }).catch(() => failure(c, ErrorCode.NOT_FOUND, 'No active survey found'));
});

// Active survey for one product (legacy).
publicRoutes.get('/survey/questions/:productId', async (c) => {
  const language = resolveLang(c.req.query('lang'));
  const productId = c.req.param('productId');

  return cachedPublicGet(
    c,
    { key: `/survey/questions/${productId}/${language}`, ttlSeconds: 30, staleSeconds: 120 },
    async () => {
      const version = await c.env.survey_db
        .prepare(
          `SELECT id FROM survey_versions
           WHERE product_id = ? AND is_active = 1
           ORDER BY version DESC LIMIT 1`
        )
        .bind(productId)
        .first<{ id: string }>();
      if (!version) throw new Error('NO_ACTIVE_SURVEY');
      return loadSurveyConfig(c.env.survey_db, language, version.id);
    }
  ).catch(() => failure(c, ErrorCode.NOT_FOUND, 'No active survey found'));
});
