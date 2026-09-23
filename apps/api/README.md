# API

The backend of the survey platform: a [Hono](https://hono.dev) app running on **Cloudflare Workers**, backed by **Cloudflare D1** (SQLite), with optional R2 (`MEDIA_BUCKET`), Cloudflare Rate Limiting, and Turnstile add-ons that all degrade gracefully when unbound. The same Worker is exposed two ways:

- Standalone Worker via the root `wrangler.toml` (`main = "apps/api/src/index.ts"`, cron `*/15 * * * *` for stale-spin cleanup).
- Same-origin on Pages under `/api/*` through the Functions wrappers [`../survey-web/functions/api/[[route]].ts`](../survey-web/functions/api/[[route]].ts) and `../admin-web/functions/api/[[route]].ts`, which strip the `/api` prefix and call `apiApp.fetch`. Same-origin avoids the `*.workers.dev` domain, which many mobile/carrier networks cannot reach.

Full per-function and per-endpoint documentation lives in [`../../docs/api-functions.md`](../../docs/api-functions.md).

## Commands

```bash
npm run dev        # wrangler dev — local API on http://localhost:8787
npm run typecheck  # tsc --noEmit -p tsconfig.json
npm run deploy     # wrangler deploy (uses the repo-root wrangler.toml)
npm run lint       # alias of typecheck
```

D1 helpers: `npm run d1:migrate` (create a migration), `npm run d1:push -- --file=…`, `npm run d1:execute -- --command='…'` (local `survey-db`).

Run commands from `apps/api/` (or use root `npm run dev` / `npm run typecheck`, which fan out through turbo). Configuration lives in the repo-root `wrangler.toml`; secrets are never committed there — set `JWT_SECRET` and `TURNSTILE_SECRET` with `wrangler secret put <NAME>`, and for Pages: `npx wrangler pages secret put JWT_SECRET --project-name alcohol-survey`.

Health check: `curl http://localhost:8787/health` should return `"status": "ok"` once D1 is reachable.

## Response envelope

Every response uses a stable shape; the frontend maps `error.code` to copy and never sees raw DB/runtime errors.

```jsonc
// success (optional `meta` object)
{ "success": true, "data": { }, "meta": { } }

// failure — `message` is duplicated at the top level for older admin clients
{ "success": false, "message": "…", "error": { "code": "VALIDATION_FAILED", "message": "…" } }
```

Error codes map to statuses in `src/lib/http.ts` (`STATUS_BY_CODE`): `INVALID_REQUEST` 400, `VALIDATION_FAILED` 422, `UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `RATE_LIMITED` 429, conflict-style codes (`ALREADY_SUBMITTED`, `ALREADY_SPUN`, `SPIN_IN_PROGRESS`, `REWARD_UNAVAILABLE`, `FEATURE_DISABLED`) 409, `PAYLOAD_TOO_LARGE` 413, `TURNSTILE_FAILED` 403, `MAINTENANCE`/`TEMPORARY_UNAVAILABLE` 503, `INTERNAL` 500. Custom codes also appear: `EMAIL_EXISTS`, `PHONE_EXISTS`, `NO_REWARDS_AVAILABLE` (all 409).

## Middleware chain (order matters)

Registered in `src/index.ts`, all `app.use('*')`:

1. **Correlation** — resolves/creates `X-Request-Id`, captures client IP and start time.
2. **CORS + security headers** — origin-aware (same-origin, `ALLOWED_ORIGINS`, localhost outside production; unknown origins are never reflected), `OPTIONS` short-circuits with 204; after the handler adds `Vary: Origin`, baseline headers (`nosniff`, `X-Frame-Options: DENY`, …), `X-Request-Id`.
3. **Settings + maintenance guard** — loads feature flags (30 s cache) into context and blocks the five public write endpoints while `maintenance_mode` is on (`MAINTENANCE` 503). Admin/login stay reachable for recovery; routes re-check the same gates per-handler.
4. **Structured logging** — one JSON line per request (`info`/`warn`/`error` by status, duration, user id).

Then routes mount: `public/auth/survey/rewards` at `/`, `adminRoutes` at `/admin` (so its `use('*')` guards cannot leak onto public routes). Finally `notFound` → `NOT_FOUND`, `onError` → logged `unhandled_error` + `INTERNAL` (raw error never returned).

Per-route middleware: `authMiddleware` on profile/submit/spin/delivery/my; admin group additionally runs `authMiddleware, adminMiddleware` then a 240 req/min per-user rate limit; write routes apply `enforceRateLimit` (in-memory window always, optional `RATE_LIMITER` binding) and opt-in Turnstile (`TURNSTILE_ENFORCE=true`, fail-closed 503 when the verifier is unreachable).

## Auth model

- **Tokens:** hand-rolled **HS256 JWT** via WebCrypto (`lib/auth.ts`) — `iss: myanmarbeer-api`, `aud: myanmarbeer-web`, 7-day TTL, timing-safe signature compare, expiry/`iat`/iss/aud checks. `JWT_SECRET` is required in production (≥ 16 chars); production without it fails closed.
- **Passwords:** **PBKDF2-SHA256**, 100 000 iterations, 16-byte random salt (`pbkdf2$…` format). Legacy unsalted SHA-256 hex digests still verify and are transparently re-hashed on successful login. Guest users get an unguessable `guest$…` marker and never log in with a password.
- **`authMiddleware`:** requires `Authorization: Bearer <jwt>`, sets `userId`/`role`/`isAdmin`.
- **`adminMiddleware`:** re-checks `is_admin && is_active` **against the DB** on every admin request — a forged `role` claim in the JWT is never sufficient.

## Route groups

| Group | Mount | Auth | Highlights |
|---|---|---|---|
| Public reads | `/` | none | `GET /`, `/health`, `/public/config` (edge-cached), `/public/turnstile`, `/products`, `/campaigns`, `/rewards`, `/survey/questions[/:productId]`, `/media/:key` |
| Auth & profile | `/` | rate limit / Bearer | `POST /auth/register`, `/auth/login`, `/auth/admin/login`, `/users/guest` (Turnstile), `GET|PATCH /user/profile` |
| Survey | `/` | Bearer | `POST /survey/submit` — idempotent (`submissionRequestId`), required-question validation, atomic batch |
| Rewards | `/` | Bearer | `POST /rewards/spin` (weighted pool, conditional atomic stock decrement, compensation on failure), `POST /rewards/delivery`, `GET /rewards/my` |
| Admin | `/admin` | `authMiddleware, adminMiddleware` + 240/min | dashboard, analytics (5), survey questions/versions, products, rewards + inventory + stock, exports, deliveries, users, responses, audit-logs, settings, upload, account |

## Data-integrity guarantees

- **Idempotency:** survey submits replay via `submissionRequestId` (and via an existing `COMPLETED` row); spins require an `idempotencyKey` and a partial unique index on `reward_spins (user_id, campaign) WHERE status != 'CANCELLED'` serializes double-taps; delivery info upserts idempotently. Replays return `200` with `idempotent: true`, not errors.
- **Atomic inventory:** the spin decrements stock with a conditional `UPDATE … WHERE remaining_quantity > 0` (success = `meta.changes === 1`), finalizes `user_rewards` + spin + status + ledger in one `db.batch`, and compensates `+1` stock if that batch fails. Stock adjustments and delivery cancellations use the same conditional/ledger pattern (`reward_inventory_transactions`).
- **Maintenance mode:** double-guarded — global block of the five public writes in `index.ts` plus per-route checks in submit/spin/delivery; admin routes are never blocked.
- **Cron:** `runScheduled` cancels `PENDING` spins older than 15 minutes (only `PENDING`, never `PROCESSING`) so users stuck by a crash can retry; reserved stock of such spins is intentionally not restored.

## Environment variables & bindings

| Name | Kind | Required | Purpose |
|---|---|---|---|
| `survey_db` | D1 binding (`survey-db`) | **yes** | primary database |
| `JWT_SECRET` | secret (`wrangler secret put` / Pages secret) | **yes** (prod) | HS256 signing key |
| `ENVIRONMENT` | var | no (`production`) | `production` \| `staging` \| `development`; gates dev fallbacks |
| `ALLOWED_ORIGINS` | var | no | comma-separated extra CORS origins |
| `PUBLIC_SITE_ORIGIN` | var | no | informational site origin for links |
| `TURNSTILE_SECRET` | secret | no | Siteverify secret; only used when enforced |
| `TURNSTILE_SITE_KEY` | var | no | public widget key (safe to commit) |
| `TURNSTILE_ENFORCE` | var | no | must be exactly `true` to enforce verification |
| `MEDIA_BUCKET` | R2 (`survey-assets`) | no | uploaded media; absent ⇒ D1 data-URL fallback, `GET /media/:key` → 404 |
| `RATE_LIMITER` | Rate Limiting binding | no | shared counter on top of the per-isolate window |
| `ANALYTICS_QUEUE` | Queue producer | no | reserved, unused today |
| `DB_DEBUG` | var | no | verbose SQL logging intent (declared; no reader in `src/`) |

## Migrations

SQL migrations live in the repo root [`/migrations`](../../migrations) (`0001_initial.sql` … `0014_production_hardening.sql`), applied against `survey-db` with the `d1:*` scripts above.

## Further reading

- [`../../docs/api-functions.md`](../../docs/api-functions.md) — every exported function, helper, and endpoint
- [`../../docs/database.md`](../../docs/database.md) — schema reference
- [`../../test.md`](../../test.md) — test plan / hardening test notes
- [`../../PRODUCTION_HARDENING.md`](../../PRODUCTION_HARDENING.md) — production hardening measures
