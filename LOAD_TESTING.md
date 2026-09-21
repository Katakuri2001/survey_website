# Load & Concurrency Testing

Two complementary tools are included:

| Tool | What it proves | Run against |
|---|---|---|
| `tests/hardening.test.mjs` | Correctness under concurrency: idempotency, single-award spin, auth boundaries, envelopes. | Local or staging. |
| `loadtest/k6-spin.js` | Throughput/latency under sustained concurrent load. | **Staging only.** |

> Never point a raw load test at production. Use a staging environment with the
> same D1 database size/schema and the same feature flags.

## 1. Concurrency smoke test (Node, no dependencies)

Start the API (with a migrated and seeded local D1):

```bash
cd apps/api
npx wrangler d1 execute survey-db --local --file=migrations/0001_initial.sql
# …apply each migration in order (or use your normal migration flow)…
npm run dev
```

Then, from the repository root:

```bash
API_BASE=http://localhost:8787 npm run test:hardening
```

It asserts:

- `{ success, data }` / `{ success:false, error:{ code, message } }` shapes;
- unauthenticated `/user/profile` → `401 UNAUTHORIZED`;
- a normal user cannot reach `/admin/*` → `403 FORBIDDEN`;
- `/health` reports `database: "ok"`;
- survey submission is idempotent for a repeated `submissionRequestId` and for a
  repeat submission of the same product;
- **ten parallel spins for one user yield exactly one award** and the rest are
  `ALREADY_SPUN` / `SPIN_IN_PROGRESS`;
- replaying the winning `idempotencyKey` returns the same `userRewardId`;
- delivery submission is idempotent;
- ten parallel guest creations for the same phone resolve to a single user id.

Exit code is `0` only when every assertion passes.

## 2. k6 load test

Install [k6](https://k6.io/docs/get-started/installation/), then:

```bash
API_BASE=https://staging.example.com/api \
USERS=3000 HOLD=60 RAMP=30 \
npm run test:load
```

Environment variables:

| Variable | Default | Meaning |
|---|---|---|
| `API_BASE` | `http://localhost:8787` | API base URL. |
| `USERS` | `500` | Unique users seeded in `setup()` and driven through the flow. |
| `HOLD` | `60` | Seconds at peak load. |
| `RAMP` | `30` | Seconds to ramp to peak. |

The script seeds one guest + one completed survey per user during `setup()`,
then each virtual user repeatedly calls `GET /public/config` (the app's poll
path) and `POST /rewards/spin`. A spin that returns a controlled rejection
(`ALREADY_SPUN`, `SPIN_IN_PROGRESS`, `RATE_LIMITED`, `NO_REWARDS_AVAILABLE`) is
treated as a pass; only unexpected statuses fail.

Thresholds enforced by k6:

```
http_req_failed     rate < 2%
http_req_duration   p95 < 1500ms, p99 < 3000ms
config_duration     p95 < 500ms
spin_duration       p95 < 1500ms
```

### Suggested run sequence

1. `USERS=100` — verify the environment and seeding.
2. `USERS=1000` — observe D1 read/write metrics and cache hit rate.
3. `USERS=3000 HOLD=120` — the dress rehearsal.

Watch `X-Cache: HIT` on the public GETs during the run; a miss storm is the most
likely cause of D1 saturation.

### Interpreting failures

| Symptom | Likely cause | Action |
|---|---|---|
| `spin_duration` p95 high, D1 writes high | Single hot reward row contention | Confirm conditional `UPDATE` is used; shard by campaign or reduce prize count per segment. |
| `config_duration` p95 high, reads high | Cache misses / N+1 | Check cache TTLs and that `/public/config` is being used instead of many small GETs. |
| Many `RATE_LIMITED` | Limits too tight for the ramp | Adjust `RATE_POLICIES` in `apps/api/src/lib/security.ts` or the Cloudflare binding. |
| 5xx `INTERNAL` during spin | Write failure / timeout | Inspect `spin_finalize_failed` logs; check for inventory compensation events. |
| Seeding is slow | Sequential `setup()` against D1 | Lower `USERS`, or seed users ahead of time with a batched script. |

## Capacity notes

- Public read paths are edge-cached (`X-Cache: HIT`), so the dominant D1 cost per
  user is the **one-time** survey write and the **one-time** spin reservation +
  batch.
- One spin per user+campaign means a 3,000-user event produces ≤3,000 spin
  writes, not 3,000×N retries.
- Idempotency keys mean a flaky client retry does not create a second award.

See [`ARCHITECTURE_ASSESSMENT.md`](./ARCHITECTURE_ASSESSMENT.md) for the full D1
budget and [`MONITORING.md`](./MONITORING.md) for what to watch during the event.
