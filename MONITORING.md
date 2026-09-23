# Monitoring & Operations

## Health check

`GET /health` (also reachable at `/api/health`) returns:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "database": "ok",
    "environment": "production",
    "configVersion": "2026-v1",
    "maintenanceMode": false,
    "latencyMs": 3,
    "time": "2026-09-21T09:00:00.000Z"
  }
}
```

- `status` is `ok` when a `SELECT 1` round-trip succeeds, otherwise `degraded`
  (returns HTTP 503 with a `INTERNAL` envelope).
- Point a 1-minute uptime monitor at a **cheap path**: prefer `/health`; avoid
  `/public/config` (it does real work on a cache miss).

## Structured logs

Every request emits one JSON line to the Workers log stream:

```json
{"level":"info","event":"request","ts":"…","requestId":"…","method":"POST","path":"/rewards/spin","status":200,"durationMs":42,"ip":"…","userId":"…"}
```

Other events worth alerting on:

| `event` | Level | Meaning |
|---|---|---|
| `unhandled_error` | error | Unexpected exception (includes `requestId`). |
| `jwt_secret_missing` | error | `JWT_SECRET` not configured in production. |
| `settings_read_failed` | warn | Falling back to default flags. |
| `spin_compensation_failed` | error | **Inventory leak** — investigate immediately. |
| `spin_finalize_failed` / `spin_insert_failed` | error | Spin write failure. |
| `survey_submit_failed` / `delivery_submit_failed` | error | Write failure. |
| `scheduled_stale_spin_cleanup` | info | Crash recovery ran (watch `cancelled` count). |

The `requestId` is also returned in the `X-Request-Id` response header and
accepts a client-supplied `X-Request-Id`, so a user can report a correlation id.

## D1 capacity — what to watch

Cloudflare exposes per-database metrics (rows read/written, query latency). For a
3,000-user event, the read path is the budget to protect:

- Rows read per request should stay flat; a spike means a cache miss storm or an
  N+1 regression.
- Query latency p95 should stay in the low tens of ms. Sustained >100 ms means
  the database is the bottleneck.
- Watch writes during the spin window (one reservation + one batch per spin).

Mitigations, in order: ensure cached public GETs are hitting
(`X-Cache: HIT`), raise `/public/config` TTLs, reduce the survey client poll
interval, then pause non-essential traffic via feature flags.

## Key metrics to alert on

| Signal | Warning | Critical |
|---|---|---|
| `/health` failures | 2 in 5 min | 1 min sustained |
| API 5xx rate | >1% | >5% |
| API p95 latency | >1 s | >3 s |
| `/rewards/spin` 5xx or `INTERNAL` | any | — |
| `spin_compensation_failed` | any | any |
| `scheduled_stale_spin_cleanup.cancelled` | >0 occasionally | >0 repeatedly |
| `RATE_LIMITED` responses | spike vs baseline | — |

## Dashboards / queries

Useful D1 queries for an incident dashboard:

```sql
-- Rewards with the lowest remaining stock
SELECT id, name, remaining_quantity, status
FROM rewards ORDER BY remaining_quantity ASC LIMIT 10;

-- In-flight spins (should be ~0 outside a burst)
SELECT status, COUNT(*) FROM reward_spins GROUP BY status;

-- Squared-off inventory: awarded vs stock movements
SELECT r.name, r.remaining_quantity,
       COALESCE(SUM(t.quantity), 0) AS movements
FROM rewards r
LEFT JOIN reward_inventory_transactions t ON t.reward_id = r.id
GROUP BY r.id;
```

## Admin audit log

`GET /admin/audit-logs?limit=&offset=&action=` returns `{ logs, total }`. Actions
include `LOGIN`, `UPDATE`, `UPLOAD`, `PASSWORD_CHANGED`, and the resource writes
performed by admin endpoints. Use it to reconstruct who changed stock or
settings during the event.

## Runbook: something is wrong

1. **Check `/health`** — 503 means D1 is unreachable.
2. **Read the latest `unhandled_error` lines**, filtering by `requestId` from the
   user's report.
3. **Throttle, don't debug under fire**: set `maintenance_mode=1` for public
   writes; admin and login stay up.
4. **Check for inventory leaks**: run the "squared-off inventory" query and scan
   logs for `spin_compensation_failed`.
5. **Recover**: fix forward, then clear `maintenance_mode`. Flags apply within
   30 s (or immediately after `PATCH /admin/settings`).
