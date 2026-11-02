# Survey Website — Concurrent Capacity & Scaling Plan

> Capacity inspection results for the Myanmar Beer survey/rewards platform
> (user journey: `/` → `/info` → `/survey` → `/spin` → `/delivery`).
>
> **Companion docs:** [`CAPACITY_ANALYSIS.md`](./CAPACITY_ANALYSIS.md) ·
> [`ARCHITECTURE_ASSESSMENT.md`](./ARCHITECTURE_ASSESSMENT.md) ·
> [`PRODUCTION_HARDENING.md`](./PRODUCTION_HARDENING.md) ·
> [`MONITORING.md`](./MONITORING.md) ·
> [`LOAD_TESTING.md`](./LOAD_TESTING.md) ·
> [`docs/README.md`](./docs/README.md)
>
> Generated 2026-10-28 · Status: inspection findings + scaling recommendation
> (pending confirmation from the staged k6 load run).

---

## 1. TL;DR — how much traffic can the site handle?

| Question | Answer |
|---|---|
| Designed concurrent envelope | **~3,000 users** completing survey → spin → delivery in a single campaign burst (the repo's own target; see [`CAPACITY_ANALYSIS.md`](./CAPACITY_ANALYSIS.md)) |
| Can the current stack handle 3,000 concurrent users? | **Yes, on a capacity-limit basis** — estimated ~30k API requests/day for the burst fits inside the Cloudflare Workers Free 100k/day cap; D1 single-writer queueing is the binding constraint at that scale |
| Comfortable / production-safe at 3,000 concurrent? | **Not yet proven operationally** — needs the staged k6 run (`USERS=3000 HOLD=120`) and a Workers Paid upgrade for headroom |
| How much traffic can it handle before needing a bigger server? | Free tier design ceiling ≈ **3,000 concurrent users / ~30k requests per event**; sustained campaigns beyond that should move to Workers **Paid (Pro, $5/mo)** and consider D1 read-replication/queue architecture |

Plain-language version for the client conversation:

- The website is built to survive roughly **3,000 people filling the survey at the
  same time** during one campaign burst.
- On the current Cloudflare configuration it is *expected* to survive that volume,
  but the database serialises writes, so peak-load latency/queueing risk exists at
  exactly that scale.

---

## 2. What was inspected (source of truth)

Inspection scope for this capacity pass:

| Area | Files / surfaces inspected |
|---|---|
| User frontend | `apps/survey-web/` — Next.js 16 static export (`output: 'export'`), routes `/`, `/info`, `/survey`, `/spin`, `/delivery`; `/survey/questions` polled every 12 s per open client; `/api/*` mounted via `apps/survey-web/functions/api/[[route]].ts` |
| Admin frontend | `apps/admin-web/` — Next.js 16 static export, standalone origin (no `basePath`); same `/api/*` function pattern |
| API | `apps/api/src/index.ts` (Hono composition root), `apps/api/src/routes/{public,auth,survey,rewards,admin}.ts`, `apps/api/src/lib/{security,http,auth,survey,validation,ids,audit}.ts` |
| Runtime config | Root `wrangler.toml` (Worker `alcohol-survey-platform` + D1 `survey_db` + R2 `MEDIA_BUCKET` + cron), per-app Pages `wrangler.toml`, root `vercel.json` (legacy static-only fallback), `.vercel/project.json` |
| Data / tests | `migrations/` (0001–0017), `loadtest/k6-spin.js`, `tests/hardening.test.mjs`, `tests/api-tests.mjs` |
| Docs | `CAPACITY_ANALYSIS.md`, `ARCHITECTURE_ASSESSMENT.md`, `PRODUCTION_HARDENING.md`, `MONITORING.md`, `LOAD_TESTING.md`, `README.md`, `AGENT.md`, `docs/*` |

## 3. Current infrastructure snapshot

| Layer | Technology | Observed capacity-relevant config |
|---|---|---|
| Static frontend | Next.js 16 static export (React 18 + Tailwind) | CDN-cached by Cloudflare Pages — page views do not consume Worker/CPU unless they hit the `/api/*` function |
| API host | Cloudflare Workers (Hono) via Pages Function (`/api/*`) + standalone Worker release | Root `wrangler.toml` → `env.production` (D1 `survey_db`, R2 `MEDIA_BUCKET`, cron `*/15`) |
| Database | Cloudflare D1 (`survey-db`, id `449a4386-9e0f-4e65-b7cf-e37cc0de491c`) | Single writer, APAC region, ~606 kB used / 500 MB Free limit, 26 tables |
| Object storage | Cloudflare R2 `survey-assets` (optional `MEDIA_BUCKET`) | Falls back to inline base64 in D1 when unbound |
| Auth | Custom HS256 JWT + PBKDF2-SHA256 + rotating guest resume tokens | Secrets required in production (`JWT_SECRET`) |
| Legacy host | `vercel.json` | Retained as **static-only** fallback; does not host the API |

## 4. Per-user traffic & capacity model

Dynamic (function-invoking) path per user in the happy journey:

| Step | Endpoint | Requests | D1 queries | Rows read | Rows written | Cached? |
|---|---|---|---|---|---|---|
| Landing/legal/static pages | — (CDN) | 0 | 0 | 0 | 0 | CDN edge cache |
| First `/public/config` | `GET /public/config` | 1 (MISS) + polls | ~6 (products, campaigns, rewards, survey config, settings) | ~40 | 0 | TTL 60 s / stale 300 s |
| Repeat `/public/config` within TTL | `GET /public/config` | ~HITs | 0 | 0 | 0 | edge cache |
| Guest identity | `POST /users/guest` | 1 | 2 (lookup + upsert) | 1 | 1 | — |
| Survey submit | `POST /survey/submit` | 1 | ~7 (version, existing, product, idempotency, stock update, response insert, user_rewards insert) | ~3 | ~4 | — |
| Rewards fetch | `GET /rewards` | 1 | 1 | — | — | TTL 30 s / stale 120 s |
| Spin | `POST /rewards/spin` | 1 | ~6–8 (eligibility, replay, in-flight check, PENDING insert, claim update, finalize batch) | ~15 | ~5 | — |
| Delivery | `POST /rewards/delivery` | 0–1 | ~4 | ~3 | ~3 | — |

**Per-user design totals (happy path, single campaign):** ≈ **5–8 function requests**,
≈ **15–25 D1 queries**, ≈ **40–60 rows read / ~5–8 rows written**.

**At the designed 3,000-user burst:** ≈ **105k rows read / 54k rows written**
([`ARCHITECTURE_ASSESSMENT.md`](./ARCHITECTURE_ASSESSMENT.md)), i.e. query volume
dominates over raw row volume — the earlier N+1 survey-question query (1 + 2N) was
already fixed by the combined config + edge cache.

## 5. Platform limit comparison (Cloudflare tiers, per repo analysis)

| Limit | Workers Free (current per analysis) | Workers Paid — Pro (recommended) |
|---|---|---|
| API requests / day | **100,000** | Removes the cap (paid) |
| Sub-requests / invocation | **50** | **10,000** |
| CPU / invocation | **10 ms** | **5 min** |
| Parallel D1 connections / invocation | 6 | higher |
| Plan cost | **$0** | **~$5/mo** |

| Limit | D1 Free (current) | D1 Paid (for growth) |
|---|---|---|
| Storage | **500 MB / DB** (currently ~606 kB used) | higher / more |
| DBs / account | **10** (5 used) | more |
| Storage / account | **5 GB** | higher |

Free-tier daily projection for the 3,000-user design: ≈ **30k requests/day** →
~30 % of the Workers Free cap; daily submissions ≈ 3,000 → comfortably inside
budget, but with polling/retry overhead the margin shrinks.

## 6. How much concurrent load can it handle today? (calculation)

Assumptions used for the numbers above: 3,000 concurrent users, one campaign burst,
happy-path journey, English survey version.

| Constraint | At 3,000 concurrent users | Verdict |
|---|---|---|
| Workers Free daily request cap | ~30k (design) vs 100k cap | ✅ fits (≈30 %) |
| Workers Free CPU (10 ms/req) | JS logic is light; D1 is I/O (does not count) | ✅ fits |
| Workers Free sub-requests (50/req) | Survey submit ≈ 4–6 subrequests; spin ≈ 5–8 | ✅ fits |
| D1 single-writer throughput | ~30k queued queries ÷ ~1,000 qps ≈ **~30 s queue** | ⚠️ completes, but seconds of write latency; possible `"overloaded"` D1 errors under queue pressure |
| D1 storage | 606 kB used / 500 MB Free | ✅ plenty |

**Verdict:** the site *survives* a 3,000-concurrent-user event within tier limits;
the risk at that scale is D1 write serialization, not the Workers Free request quota.

## 7. Rate limits & controls currently in code

`RATE_POLICIES` (`apps/api/src/lib/security.ts`) + in-isolate sliding window
(`MAX_BUCKETS = 20,000`) with optional Cloudflare Rate Limiting binding (`RATE_LIMITER`):

| Route group | Limit | Key |
|---|---|---|
| Login / admin login | 10 / min, burst 5 | IP |
| Guest creation | 20 / min | IP |
| Survey submit | 10 / min | user |
| Spin | 20 / min | user |
| Delivery | 10 / min | user |
| Admin | 240 / min, read-heavy | admin |

One success is still enforced by database idempotency (unique indexes /
`submission_request_id` / spin idempotency keys), so limits are a backstop, not the
source of truth.

## 8. Load-test & verification path

From [`LOAD_TESTING.md`](./LOAD_TESTING.md) / `loadtest/k6-spin.js` / `tests/hardening.test.mjs`:

```bash
# Concurrency + idempotency smoke (local/staging only)
API_BASE=http://localhost:8787 npm run test:hardening

# k6 dress rehearsal — staging only, NEVER production
API_BASE=https://staging.example.com/api USERS=1000 HOLD=60 npm run test:load
API_BASE=https://staging.example.com/api USERS=3000 HOLD=120 npm run test:load
```

k6 thresholds: `http_req_failed < 2 %`, `http_req_duration` p95 < 1500 ms / p99 < 3000 ms,
`config_duration` p95 < 500 ms, `spin_duration` p95 < 1500 ms.

Interpretation guide lives in [`LOAD_TESTING.md`](./LOAD_TESTING.md) (D1 read/write
saturation, cache-miss storms, stock contention, rate-limit tuning).

## 9. Scaling plan for "much more users"

1. **Short term (next campaign, if ≤ ~3,000 concurrent):** keep Workers Free +
   D1 Free; run the staged k6 dress rehearsal at `USERS=3000 HOLD=120`; watch
   `/health`, D1 metrics and `X-Cache` HIT ratio during the burst; keep feature flags
   (`survey_enabled`, `spin_enabled`, `delivery_enabled`) and rate limits as emergency
   controls (`MONITORING.md`).
2. **Mid term (> ~3,000 concurrent sustained / > ~100k requests/day):** upgrade to
   **Workers Paid (Pro, $5/mo)** — removes Free request/CPU/subrequest ceilings; keep
   D1 single-writer design but keep write transactions short; tune `/public/config`
   TTLs; consider Cloudflare Rate Limiting binding for global (not per-isolate) limits.
3. **Long term (heavy sustained traffic):** D1 read replication for read-heavy public
   paths + queue-based write decoupling, or move write ownership off D1; consider
   Workers Business for multi-million-request months.

## 10. Client cost limit / quota / server-sizing inputs (handoff for ChatGPT)

Numbers below are the inputs the owner can feed into ChatGPT (or any cost/quota tool)
to derive client-facing limits and server sizing.

| Question | Current answer / input |
|---|---|
| How many concurrent users can we promise? | **3,000** designed envelope; free-tier capacity OK on request volume |
| Daily API quota per event | ~3,000 submissions × ~10 requests/user ≈ **30k requests/day** (≈30 % of Free cap) |
| Recommended client-side concurrency cap | **~3,000 concurrent users** per campaign burst |
| Recommended server (function) tier | **Cloudflare Workers Paid (Pro, ~$5/mo)** for the 3,000-user campaign (Free works on paper, Paid is safer) |
| Database tier | D1 Free is sufficient for the design (~606 kB used); upgrade only at higher write volume |
| Emergency public-write quota | Feature flags + rate limits (guest 20/min, survey 10/min, spin 20/min, delivery 10/min) |

Cost-limit framing for the client: the free-tier configuration is viable for the
documented 3,000-user envelope; beyond it, the first paid step is Workers Pro ($5/mo) +
D1 growth plan, with architecture (D1 read replica / queues) as the next step.

## 11. Open items / next steps

- [ ] Run staged k6 dress rehearsal (`USERS=3000 HOLD=120`) against staging and record
      `spin_duration`, `config_duration`, D1 rows read/written.
- [ ] Confirm `JWT_SECRET` + rate-limiter binding state in production before scaling.
- [ ] Decide client campaign size (higher than 3,000?) → re-run §6 math.
- [ ] Upgrade to Workers Paid (Pro) before the next paid campaign burst.

## 12. References

- [`CAPACITY_ANALYSIS.md`](./CAPACITY_ANALYSIS.md) — original 3,000-user study
- [`ARCHITECTURE_ASSESSMENT.md`](./ARCHITECTURE_ASSESSMENT.md) — D1 query budget, concurrency strategy
- [`PRODUCTION_HARDENING.md`](./PRODUCTION_HARDENING.md) — migrations, flags, deploy steps
- [`MONITORING.md`](./MONITORING.md) — health, alerts, runbook
- [`LOAD_TESTING.md`](./LOAD_TESTING.md) — hardening + k6 load test
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare D1 limits: https://developers.cloudflare.com/d1/platform/limits/
