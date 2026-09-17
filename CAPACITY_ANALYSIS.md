# Survey Website — Capacity & Data-Integrity Analysis (3,000 Concurrent Users)

> Generated 2026-09-17. Re-check when needed.

## Objective

Determine whether the current Cloudflare infrastructure (Pages Functions + D1) can handle **3,000 users filling forms simultaneously** without any data being missing or overlapping, whether a plan upgrade is required, and what must be fixed.

---

## 1. Current Infrastructure (measured)

| Resource | Value |
|---|---|
| Account | `standard` (personal email `kaungsethmue2001@gmail.com`) |
| Account ID | `e86299bf709f164c49c7743f56829687` |
| Workers plan | couldn't fetch via API (token expired); account type + D1/Pages/custom-domain suggests **Workers Free** |
| D1 DB (`survey-db`) | 606 kB, 26 tables, 500 MB free limit, APAC, single-writer |
| D1 24 h usage | 4,584 reads · 138 writes · 92,517 rows read · 545 rows written |
| D1 avg query duration | ~0.2–1.4 ms (very fast) |
| Pages projects | `alcohol-survey` (`alcohol-survey.pages.dev`, `myanmarbeer.boom.com.mm`) + `alcohol-survey-admin` |
| D1 free tier limits | 10 DBs (5 used) · 500 MB/DB · 5 GB storage/account · 50 subrequests/Worker invocation · **single-threaded** |
| Workers Free tier limits | 100,000 requests/day · no per-second cap · 10 ms CPU · 50 subrequests/request · 6 parallel D1 connections/request |

---

## 2. Does 3,000 concurrent users fit the current limits?

| Limit | 3,000 users | Verdict |
|---|---|---|
| Workers daily quota (100 k/day) | ~3,000 submissions × ~10 page-loads each ≈ 30 k requests | ✅ fits (≈30 % of free cap) |
| Workers requests/second | no cap on Free | ✅ all 3,000 accepted |
| Workers subrequests (50/request) | each survey submit = ~10 D1 calls | ✅ under 50 |
| Workers CPU (10 ms) | JS logic is light; D1 calls are I/O (don't count toward CPU) | ✅ fits |
| D1 throughput | 3,000 × ~10 queries = 30,000 queries ÷ ~1,000 queries/s ≈ **30 s queue** | ⚠️ all complete, but users wait seconds |
| D1 storage | 606 kB used / 500 MB free | ✅ plenty |
| D1 queue overflow | 30,000 queued queries may hit `"overloaded"` error if the queue fills | ⚠️ possible 5xx for some |

**Verdict:** the site *survives* 3,000 concurrent users, but with latency (~30 s queue) and possible `"overloaded"` errors — **not** because of plan caps, but because of D1 single-threading.

---

## 3. Data-Integrity Findings (read `apps/api/src/index.ts`)

### Already SAFE ✅

| Path | Why it's safe |
|---|---|
| `/rewards/spin` | Atomic `UPDATE rewards SET remaining_quantity = remaining_quantity - 1 WHERE remaining_quantity > 0` + partial unique index `idx_reward_spins_one_per_campaign WHERE status != 'CANCELLED'` → **no double-wins, no overselling** |
| D1 writes in general | D1 is **single-writer** → writes serialize automatically → no two writes interleave → no race conditions on the same row |
| `/rewards/delivery` (removed) | Was idempotent (checked existing delivery) ✅ |

### HOLE A — `/survey/submit` has NO duplicate-submission guard ⚠️

The `survey_responses` table has only *indexes*, not a UNIQUE constraint:

```sql
CREATE INDEX idx_survey_responses_user ON survey_responses(user_id);      -- not unique!
CREATE INDEX idx_survey_responses_campaign ON survey_responses(campaign_id);
CREATE INDEX idx_survey_responses_product ON survey_responses(product_id);
```

**Consequence:** if a user clicks submit twice (retry after network failure), **two `survey_responses` rows are created** → overlapping/duplicate data. The spin already uses a partial unique index (`idx_reward_spins_one_per_campaign`) which *does* prevent duplicates — the fix pattern already exists in the codebase.

### HOLE B — `/survey/submit` has NO transaction ⚠️

The endpoint does:
1. `INSERT survey_responses` (auto-committed)
2. Loop: `INSERT survey_answers` × N (each auto-committed individually)

**Consequence:** if the process crashes between steps, you get **a response row with only some answers** (partial/missing data).

### Other observations

- Client-side double-submit guards exist (`disabled={loading}` / `disabled={submitting}`) but reset on failure → retry still produces duplicates.
- The spin page uses `hasSpun` client state + the unique DB index → safe ✅.

---

## 4. Do you need to upgrade the Cloudflare plan?

| Question | Answer |
|---|---|
| **For raw capacity?** | **NO.** Workers Free handles 3,000 concurrent requests (no per-second cap, 100 k/day quota fits). |
| **For headroom/safety?** | **YES — Workers Paid (Pro, $5/mo)** if you expect sustained growth or repeated events. It removes the 100 k/day cap, raises subrequests 50→10,000, and raises CPU 10 ms→5 min. |
| **For D1 throughput?** | **NO plan helps.** D1 is single-threaded on every plan. The fixes below (unique index + batch) are what prevent data loss/overlap — not the plan tier. |

---

## 5. Recommended Fixes (priority order)

### Fix #1 — Prevent duplicate survey submissions (MUST-DO)

Add a partial unique index (same pattern as the spin):

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_responses_one_per_product
  ON survey_responses(user_id, product_id)
  WHERE status = 'COMPLETED';
```

Update `/survey/submit` to catch the unique-violation error and return `"You have already submitted this survey"` instead of inserting a duplicate.

### Fix #2 — Wrap survey submission in a D1 batch (MUST-DO)

Replace the separate `db.prepare(...).run()` calls with a single atomic batch:

```ts
await db.batch([
  db.prepare(`
    INSERT INTO survey_responses (id, user_id, campaign_id, product_id, survey_version_id, language, status, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, 'COMPLETED', datetime('now'))
  `).bind(responseId, actualUserId, campaignId || null, productId, version.id, language || 'en'),
  ...answers.map(answer =>
    db.prepare(`
      INSERT INTO survey_answers (id, response_id, question_id, answer_text, answer_number, answer_choice, answer_rating)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(answerId, responseId, answer.questionId, answerText, answerNumber, answerChoice, answerRating)
  )
]);
```

This guarantees **all-or-nothing** — no partial responses on crash.

### Fix #3 — Client-side double-submit prevention (recommended)

After the first click, disable the button and set a `sessionStorage` flag so the user physically cannot double-click. Reset only on a *failed* request (not on success).

### Fix #4 — Enable D1 read-replication (optional, scalability)

`read_replication.mode` is currently `disabled`. Enable it so admin dashboard overview queries don't compete with write traffic.

---

## 6. Plan Recommendation Summary

| Tier | Daily requests | Subrequests/request | CPU/request | Best for |
|---|---|---|---|---|
| **Workers Free** (current) | 100,000/day | 50 | 10 ms | One-time 3 k event; tight cap |
| **Workers Paid (Pro)** — *recommended* | **Unlimited** | **10,000** | **5 min** | Repeated surveys, growth, headroom |
| **Workers Business** | 10,000,000/month | 10,000 | 5 min | Heavy sustained traffic |
| **Workers Enterprise** | Custom | Custom | 5 min | Enterprise |

**Upgrade to Workers Paid (Pro, $5/mo)** for headroom, but the *essential* work is code-level — add the unique index + batch transaction so that at 3,000 concurrent users, every response is captured **exactly once and atomically**, with no overlaps.

---

## 7. To Reproduce / Verify

```bash
# Check D1 usage
npx wrangler@4.86.0 d1 info survey-db -c wrangler.toml

# Check D1 insights
npx wrangler@4.86.0 d1 insights survey-db --time-period 1d --sort-by reads --limit 5

# Check Workers/Pages deployments
npx wrangler@4.86.0 pages deployment list --project-name alcohol-survey
npx wrangler@4.86.0 pages deployment list --project-name alcohol-survey-admin

# Add the unique index (run against production D1)
npx wrangler@4.86.0 d1 execute survey-db --project-name alcohol-survey \
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_responses_one_per_product ON survey_responses(user_id, product_id) WHERE status = 'COMPLETED';"
```

---

## References

- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare D1 limits: https://developers.cloudflare.com/d1/platform/limits/
- D1 concurrency model: *"Each individual D1 database is inherently single-threaded, and processes queries one at a time."*
- Migration with spin uniqueness: `migrations/0005_spin_uniqueness.sql`
- Survey submit endpoint: `apps/api/src/index.ts` (~line 484)
- Spin endpoint: `apps/api/src/index.ts` (~line 591)
