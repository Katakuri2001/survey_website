# Production Hardening

This document describes the changes made to support ~3,000 concurrent users
completing login → survey → spin → claim without duplicate rewards, corrupted
state, or database overload. See [`ARCHITECTURE_ASSESSMENT.md`](./ARCHITECTURE_ASSESSMENT.md)
for the underlying analysis and [`MONITORING.md`](./MONITORING.md) /
[`LOAD_TESTING.md`](./LOAD_TESTING.md) for operations.

## TL;DR — required production steps

1. **Apply the new migration** (`migrations/0014_production_hardening.sql`).
   It is additive except for `reward_spins`, which is rebuilt to widen its
   `status` CHECK to allow the in-flight `PENDING` value; dependent rows
   (`user_rewards`, `delivery_information`) are snapshotted and restored within
   the same migration. On production, take a D1 time-travel bookmark first.
2. **Set `JWT_SECRET` as a secret** on both Pages projects (and the API worker).
   Without it, authentication is disabled in production by design.
3. Deploy the API worker and both Pages apps, then run the smoke test:
   `API_BASE=https://<site>/api npm run test:hardening`.
4. Optionally enable **Turnstile** (requires the frontend widget) and the
   optional bindings listed below.

> ⚠️ This release changes the security posture. Previously the API fell back to
> a hard-coded development JWT secret in production. That fallback is now
> refused in production, so **`JWT_SECRET` must be configured before deploying**
> or all token-based endpoints will return `500 INTERNAL`.

### Deploying against an existing database

The original `survey-db` was created **outside** the migration runner, so
`d1_migrations` recorded only `0001_initial.sql` even though the later tables
and columns were present. In that state `wrangler d1 migrations apply` tries to
re-run `0002`–`0013` and fails on duplicate columns. Reconcile the ledger to
match the live schema first, then apply only the pending migration:

```bash
# 1. Rollback point: D1 time-travel bookmark (primary), plus an export if reachable.
npx wrangler d1 time-travel info survey-db
npx wrangler d1 export survey-db --remote --output survey-db-backup.sql

# 2. Insert rows for the migrations the live schema already reflects, e.g.
#    INSERT INTO d1_migrations (name) VALUES ('0002_...sql'), ... ;
#    then verify `SELECT name FROM d1_migrations ORDER BY id`.

# 3. Apply — this now runs only 0014.
npx wrangler d1 migrations apply survey-db --remote
```

Some networks block the `d1 export` and `d1 execute --file` endpoints
(`fetch failed`); `d1 execute --command` still works, and the time-travel
bookmark is the primary rollback for D1.

> The smoke test sends a synthetic `CF-Connecting-IP` only when run against
> `localhost`, so repeated local runs get a fresh rate-limit budget. Cloudflare's
> edge rejects a client-supplied `CF-Connecting-IP` (error 1000 / HTTP 403), so
> the header is omitted for a deployed API.

## What changed

### Security

- **JWT**: HS256 verification now also checks issuer/audience and expiry, uses
  timing-safe signature comparison, and refuses the development fallback in
  production.
- **Passwords**: PBKDF2-SHA256 (100k iterations, per-user salt). Existing
  unsalted SHA-256 hashes are verified on login and transparently re-hashed.
  Guests store an unguessable `guest$…` marker instead of a hash of a shared
  secret.
- **Admin access**: the JWT role claim is never trusted on its own — every
  `/admin/*` request re-checks `is_admin`/`is_active` in the database.
- **CORS**: origin allow-list instead of `*`. Same-origin is always allowed.
- **Input validation**: every write body/query is parsed with Zod; SQL is always
  parameterised (including the admin export `sortBy`, now an enum whitelist).
- **Errors**: stable `{ success:false, error:{ code, message } }` envelopes; raw
  database/runtime errors are logged, never returned.
- **Headers**: `nosniff`, `DENY` framing, referrer policy, permissions policy,
  and a CSP are applied by the API and by `_headers` on both sites.
- **Rate limiting**: per-route limits (in-isolate, always on) plus the optional
  Cloudflare Rate Limiting binding when bound.

### Correctness under concurrency

- **Server-authoritative spin.** The worker chooses the reward; the client only
  animates to the returned result.
- **One spin per user+campaign**, enforced by a partial unique index on
  `(user_id, COALESCE(campaign_id,'default')) WHERE status != 'CANCELLED'`
  (the default campaign is stored as `NULL`, so `COALESCE` keeps its slot
  unique). A `PENDING` row is inserted *before* inventory is touched, so
  concurrent double-taps collapse to a single award.
- **Atomic inventory reservation** via a conditional
  `UPDATE rewards SET remaining_quantity = remaining_quantity - 1
   WHERE remaining_quantity > 0 AND is_active = 1 AND status NOT IN ('EXHAUSTED','PAUSED')`
  and checking `meta.changes`. The winner/loser pair is committed in a single
  `db.batch()`; on failure the reservation is compensated back.
- **Idempotency**:
  - Survey: `submission_request_id` + partial unique index. Replays (and repeat
    submissions for the same product) return the original `responseId` with
    `idempotent: true`.
  - Spin: `idempotency_key` per request; replays return the stored award, and an
    in-flight request returns `SPIN_IN_PROGRESS`.
  - Delivery: `delivery_information.user_reward_id` is `UNIQUE`; replays return
    the existing delivery id.
- **Bounded queries**: the survey config endpoint loads questions/options/
  conditions in 3 queries (previously 1 + 2N, polled every 12 s per client).
- **Public reads are cached** at the edge (`/public/config`, `/products`,
  `/campaigns`, `/rewards`, `/survey/questions`) with short TTLs, so a traffic
  spike hits cache instead of D1.

### Operations

- **Feature flags / maintenance mode** stored in the `settings` table, readable
  via `GET /admin/settings` and writable via `PATCH /admin/settings`. Settings
  are cached in-isolate for 30 s and invalidated on write.
  Keys: `maintenance_mode`, `survey_enabled`, `spin_enabled`,
  `delivery_enabled`, `config_version`.
- **Health endpoint**: `GET /health` (DB round-trip, environment, config version,
  maintenance flag, latency).
- **Structured logs**: one JSON line per request plus explicit `error`/`warn`
  events, including a correlation id (`X-Request-Id`).
- **Audit trail**: admin actions are written to `audit_logs` (best effort) and
  readable at `GET /admin/audit-logs`.
- **Scheduled cleanup** (`*/15 * * * *`): cancels spins left in `PENDING` by a
  crash so users can retry. `PROCESSING` is deliberately *not* touched because
  it is a real delivery status set by admins. Remove the `[triggers]` block in
  `wrangler.toml` if you prefer to manage crons elsewhere.

## Configuration reference

| Name | Type | Required | Notes |
|---|---|---|---|
| `survey_db` | D1 binding | yes | Existing binding name — do not rename. |
| `JWT_SECRET` | secret | **yes (prod)** | ≥16 chars. Must be identical across the API worker and both Pages projects. |
| `ENVIRONMENT` | var | no | `production` (default) / `staging` / `development`. |
| `ALLOWED_ORIGINS` | var | no | Comma-separated extra browser origins for CORS. |
| `PUBLIC_SITE_ORIGIN` | var | no | Informational only. |
| `TURNSTILE_SECRET` | secret | no | When set, guest + spin require a valid Turnstile token. |
| `TURNSTILE_SITE_KEY` | var | no | Public site key for the frontend widget. |
| `ASSETS` | R2 binding | no | Reserved for media; uploads currently stay inline. |
| `ANALYTICS_QUEUE` | Queue producer | no | Reserved for deferred analytics. |
| `RATE_LIMITER` | Rate Limiting binding | no | Cloudflare rate limit in addition to the in-isolate limiter. |

Set secrets per project:

```bash
# API worker
cd apps/api && npx wrangler secret put JWT_SECRET --env production

# Pages projects (each serves its own /api/* Function)
npx wrangler pages secret put JWT_SECRET --project-name alcohol-survey
npx wrangler pages secret put JWT_SECRET --project-name alcohol-survey-admin
```

## Feature flags & emergency controls

During an incident an operator can throttle the event without a deploy:

```bash
# Pause the public write paths (survey submit, spin, delivery, guest signup)
npx wrangler d1 execute survey-db --remote --command \
  "UPDATE settings SET value='1' WHERE key='maintenance_mode'"

# Close just the survey or the spin
npx wrangler d1 execute survey-db --remote --command \
  "UPDATE settings SET value='0' WHERE key='survey_enabled'"
```

Admin APIs and login remain reachable while maintenance mode is on, so the team
can recover. Flags take effect within 30 s (isolate cache) or immediately via
`PATCH /admin/settings`.

## Turnstile

Turnstile is **off until `TURNSTILE_SECRET` is set**. Server-side verification is
already wired into `POST /users/guest` and `POST /rewards/spin`, but the
frontend widget is not included in this pass. Enabling the secret without the
widget will reject those requests, so deploy the widget first (render the
Turnstile script with `TURNSTILE_SITE_KEY`, obtain a token, and send it as
`turnstileToken` in the request body).

## Known remaining work (tracked, not blocking the event)

- **Media storage**: `/admin/upload` still stores base64 images in D1. For a
  large catalogue this is inefficient; move to the optional `ASSETS` R2 bucket
  (`/media/:key` route is not implemented yet).
- **Turnstile frontend widget** (above).
- **Frontend admin audit page**: the API endpoint exists; `apps/admin-web/app/audit`
  is an empty directory.

## Rollback

The migration is additive apart from the `reward_spins` rebuild, so rolling
back the application code is safe: the older API ignores the new
columns/tables, and the widened `status` CHECK is a superset of the old one.
If you must remove the new objects, do so in a **new** migration; do not edit
`0014` once it has been applied anywhere.
