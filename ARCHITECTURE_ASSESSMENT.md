# Architecture Assessment — Myanmar Beer Survey (3,000+ Concurrent Users)

> Generated during the production-hardening pass. Read this before changing the API or schema.

## 1. What exists today

| Layer | Technology | Location |
|---|---|---|
| User app | Next.js 16 static export (`output: 'export'`), React 18, Tailwind | `apps/survey-web` |
| Admin app | Next.js 16 static export, standalone origin (no `basePath`) | `apps/admin-web` |
| API | Hono on Cloudflare Workers, also mounted as Pages Functions at `/api/*` | `apps/api/src/index.ts` (single 1,983-line file) |
| DB | Cloudflare D1 (`survey_db`) | `migrations/0001`–`0013` |
| Storage | R2 bucket `survey-assets` via the optional `MEDIA_BUCKET` binding; falls back to base64 data-URLs in D1 | `POST /admin/upload`, `GET /media/:key` |
| Auth | Custom HS256 JWT (WebCrypto HMAC), SHA-256 password hashing | `apps/api/src/index.ts` |
| Deployment | Cloudflare Pages (both apps) + optional Worker; legacy `vercel.json` remains | root `wrangler.toml` |

The public flow is: `/` → `/info` (guest user) → `/survey` → `/spin` → `/delivery` (implemented in this pass; `POST /rewards/delivery` is ownership-checked and idempotent).

## 2. Findings (ranked)

### CRITICAL — correctness / security

1. **`POST /survey/submit` trusts a client-supplied `userId` and has no auth.** Any caller can submit a survey as any other user. It will even *create* a user from an arbitrary `profile`. (`index.ts` ~L550.)
2. **Spin can leak inventory.** The endpoint decrements `remaining_quantity` first, then inserts the unique `reward_spins` row in a batch. If two requests race, the loser's insert fails on the unique index **after** its stock decrement has already committed → permanent over-allocation / negative-equivalent stock.
3. **Spin non-idempotency race.** The "already spun" check is a separate `SELECT` before the conditional `UPDATE`; concurrent double-taps can reserve more than one reward before the unique constraint stops one row.
4. **Wildcard CORS** (`origin: '*'`) on every route, including authenticated and admin APIs.
5. **No rate limiting anywhere** — login, guest creation, survey submit, spin, delivery, admin.
6. **`JWT_SECRET` falls back to a hardcoded development string** when unset, so a production deploy without the secret accepts forgeable tokens.
7. **Unsalted SHA-256 password hashing**; `bcrypt-ts` is a dependency but unused.
8. **Errors leak internals** (`Internal error: ${err.message}`), and `jsonError` always uses code `ERROR`.
9. **No authorization on `GET /rewards` / `GET /survey/questions`** is fine (public), but `adminMiddleware` performs a DB read on every admin request without indexing on `(is_admin, is_active)`.
10. **`/users/guest` is unauthenticated, returns a JWT, and only keys on phone** — trivially abused to mint unlimited identities.

### HIGH — D1 pressure / availability

11. **`GET /survey/questions` is N+1**: 1+2·N queries (options + conditions per question). The survey page polls it **every 12 s per open client** → ~250 req/s of 13-query calls at 3,000 users. This is the single biggest D1 risk.
12. **The survey page makes a second round trip to `/campaigns` on submit**, and reads `userId` from an unverified JWT decode.
13. **Admin analytics run unbounded aggregate scans** (`SELECT ... FROM survey_answers JOIN ...`) with no time bounds and no caching, on every dashboard load/poll.
14. **Upload stores base64 images in D1** → multi-MB rows, bloated queries, D1 storage pressure.
15. **No edge/HTTP caching** for products/rewards/config.
16. **`/admin/users/export` interpolates `sortBy` into SQL** (`u.${sortBy}...`) — a SQL-injection vector, even though the value is currently constrained.

### MEDIUM — operations

17. No `/health`, no request/correlation ID, no structured logs, no feature flags, no maintenance mode, no audit for reward changes, no delivery idempotency guarantee beyond a UNIQUE column, no event/survey-version record on responses beyond `survey_version_id`.
18. No migration versioning discipline documented; no backup/restore runbook.
19. No load test, no concurrency test, no monitoring checklist.
20. Delivery UI is missing despite being in the test plan.

### Already good (preserve)

- Atomic conditional reward decrement (`WHERE remaining_quantity > 0`).
- Partial unique index `reward_spins(user_id, campaign_id) WHERE status != 'CANCELLED'`.
- Partial unique index `survey_responses(user_id, product_id) WHERE status = 'COMPLETED'` (migration 0009).
- Survey submit already uses `db.batch()` (atomic).
- `adminMiddleware` re-checks `is_admin` from the DB (role claim alone is not trusted).
- Reward inventory ledger (`reward_inventory_transactions`) and audit log exist.

## 3. Target architecture

```
Internet → Cloudflare DNS/WAF
        → Cloudflare Pages (static Next.js export + Pages Function at /api/*)
        → Cloudflare Worker (Hono)
        → D1 (single writer, kept short)
        → R2 (images, optional binding `MEDIA_BUCKET`)
Optional: Turnstile (server-verified), Rate Limiting binding, Queue, scheduled aggregation
```

**Static vs dynamic split.** Products, questions, rewards metadata and flags are served from one cache-friendly `GET /public/config`; only login, submit, spin, delivery and admin hit D1 per interaction.

## 4. D1 query budget (per user)

| Step | Statements | Rows read | Rows written | Cached? |
|---|---|---|---|---|
| `GET /public/config` (first load) | 6 (3 questions bundle + 2 rewards + settings) | ~40 | 0 | yes, 60 s s-maxage |
| `GET /public/config` (repeat) | 0 | 0 | 0 | edge cache |
| `GET /users/guest` | 2 (select by phone, upsert) | 1 | 1 | no |
| `POST /survey/submit` | 1 read + 1 pre-check read + 1 batch (1+N) | ~12 | ~7 | no |
| `POST /rewards/spin` | ~6–9 (idempotency, claim, rewards, reserve, finalize) | ~15 | ~5 | no |
| `POST /rewards/delivery` | 4 | ~3 | ~3 | no |
| Admin dashboard | 6 cached/short | small | 0 | 30 s cache |

Worst case **3,000 users** ≈ 3,000 × (≈35 reads / ≈18 writes) ≈ **105k rows read / 54k rows written**, well inside D1 Paid limits, and dominated by *query count* rather than row volume. The 12-second survey poll was the outlier (millions of rows/day); it now hits the edge cache.

## 5. Concurrency strategy (chosen)

Use **atomic conditional D1 writes**, not Durable Objects:

- One spin row per `(user_id, campaign)` is inserted **first** (`status='PENDING'`). This serialises resolution per user; a second request gets a UNIQUE violation or sees the pending row. The default campaign is stored as `NULL` and the partial unique index uses `COALESCE(campaign_id,'default')` so NULLs still share one slot.
- A successful insert is the ownership claim; there is no second state transition (so the transient states never collide with the admin delivery status `PROCESSING`).
- Stock is reserved with `UPDATE rewards SET remaining_quantity = remaining_quantity - 1 WHERE id=? AND remaining_quantity>0 AND is_active=1 AND status!='PAUSED'` and `meta.changes` is verified.
- Finalisation is one `db.batch()` (reward claim + ledger + spin row + reward status). On failure the reservation is compensated and the spin is cancelled so the user can retry.

No global Durable Object singleton is introduced. A DO is only worth adding if a single pool needs strict serialised ordering beyond what `WHERE ... > 0` provides; we do not need it here.

## 6. Idempotency

| Operation | Guard |
|---|---|
| Survey submit | `submission_request_id` index + partial unique `(user_id, product_id) WHERE COMPLETED`; duplicate returns the original `responseId`. |
| Spin | `idempotency_key` on `reward_spins` + one row per `(user_id, campaign)`; repeats return the stored `rewardId`/`userRewardId`. A retry while the row is `PENDING` returns `SPIN_IN_PROGRESS` (client re-checks `/rewards/my`). |
| Delivery | `delivery_information.user_reward_id` UNIQUE; duplicate POST returns the existing record. |

## 7. Rate-limit policy (initial, tune after load test)

| Route | Key | Limit |
|---|---|---|
| `POST /auth/login`, `/auth/admin/login` | IP | 10 / min, burst 5 |
| `POST /users/guest` | IP | 20 / min |
| `POST /survey/submit` | user | 10 / min (one success enforced by DB) |
| `POST /rewards/spin` | user | 20 / min (one success enforced by DB) |
| `POST /rewards/delivery` | user | 10 / min |
| `/admin/*` | admin | 240 / min, read-heavy |

Implemented with the Cloudflare Rate Limiting binding when configured (`RATE_LIMITER`), otherwise a best-effort per-isolate sliding window. Global bursts are additionally handled by WAF rate-limiting rules (documented in `MONITORING.md`).

## 8. What this pass changes

- Split the Worker into `lib/` + `routes/` modules; validation via `zod`; safe error envelopes with stable codes.
- Add `GET /public/config`, `GET /health`, request IDs, structured logs, security headers, strict CORS.
- Fix survey submit (auth + idempotency), spin (serialised resolution + compensation), delivery (ownership + idempotency).
- Add optional Turnstile (server Siteverify), optional R2 uploads, feature flags + maintenance mode, settings cache.
- Add migration `0014` (indexes, settings, delivery idempotency, response request id, analytics aggregates). It also rebuilds `reward_spins` to allow the in-flight `PENDING` status and switches the campaign uniqueness index to `COALESCE(campaign_id,'default')`.
- Add edge caching to public config and admin analytics; fix the N+1 survey query; parametrise admin exports.
- Add the missing `/delivery` page and a centralised retrying/no-retry API client.
- Add load/concurrency tests and operational docs.

Nothing listed under "Already good" is removed; all existing endpoints keep their paths and response envelope.
