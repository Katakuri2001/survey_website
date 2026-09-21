# Myanmar Beer Survey & Rewards Platform

A full-stack web application built for Myanmar Beer's customer survey and rewards program. Users complete a product survey, then spin a virtual wheel to win prizes. Admins manage surveys, products, rewards, and deliveries through a dedicated dashboard.

## Architecture

```
myanmarbeer.boom.com.mm/            → survey-web (Next.js, user-facing app)
├── /                  → landing page
├── /survey            → survey pages
├── /spin              → lucky spin wheel
├── /info              → personal info form
├── /delivery          → reward delivery details
├── /login             → login page (auto-redirects to /info)
└── /api/*             → API (Hono + D1, served by a Pages Function)

alcohol-survey-admin.pages.dev/     → admin-web (standalone dashboard)
└── /api/*             → same API, same-origin for the admin app
```

### Apps

| App | Framework | Port | Description |
|---|---|---|---|
| `apps/survey-web` | Next.js 16 | 3000 | User-facing survey + spin wheel |
| `apps/admin-web` | Next.js 16 | 3001 | Admin dashboard (CRUD, analytics) |
| `apps/api` | Hono (Cloudflare Workers) | 8787 | REST API + D1 database |

### Tech Stack

- **Frontend**: Next.js 16, React 18, TypeScript, Tailwind CSS
- **Backend**: Hono (Cloudflare Workers), Cloudflare D1 (SQLite)
- **Database**: Cloudflare D1 (`survey-db`), migrations in `/migrations`
- **Deployment**: Cloudflare Pages (web apps) + Cloudflare Workers (API)
- **Build**: Turbo (monorepo), npm workspaces

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account with `survey-db` D1 database

### Local Development

```bash
# Clone and install
git clone <repo>
cd "Survey website"
npm install

# Start all three apps (requires local D1)
npm run dev

# Or start individually:
cd apps/api && npm run dev        # API on :8787
cd apps/survey-web && npm run dev # Survey web on :3000
cd apps/admin-web && npm run dev  # Admin web on :3001
```

### Database Setup

```bash
# Apply all pending migrations (tracked in d1_migrations). Add --local for local dev.
npx wrangler d1 migrations apply survey-db --remote
npx wrangler d1 migrations apply survey-db --local
```

> `migrations/0014_production_hardening.sql` adds the `settings` table (feature
> flags / maintenance mode), idempotency columns, and the indexes used by the
> hardened queries. It is additive and safe to apply to a live database.

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_API_BASE` | API base URL used by the web apps | `https://myanmarbeer.boom.com.mm/api` |
| `JWT_SECRET` | JWT signing secret (**required in production**, ≥16 chars) | none — auth is disabled in prod if unset |
| `ENVIRONMENT` | `production` / `staging` / `development` | `production` |
| `ALLOWED_ORIGINS` | Extra CORS origins (comma-separated) | same-origin only |
| `TURNSTILE_SITE_KEY` | Public Turnstile site key (non-secret, safe to commit) | unset |
| `TURNSTILE_SECRET` | Turnstile secret used for server-side Siteverify | unset |
| `TURNSTILE_ENFORCE` | Set to `true` to enforce Turnstile on guest + spin. Off by default so the V1 survey journey stays challenge-free. | unset (disabled) |

See [`.env.example`](./.env.example) and
[`PRODUCTION_HARDENING.md`](./PRODUCTION_HARDENING.md) for the full reference.

## API Endpoints

### Public

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | DB round-trip + config version (uptime monitor) |
| GET | `/public/config` | Combined products+campaigns+rewards+survey (edge-cached) |
| GET | `/products` | Get active products |
| GET | `/campaigns` | Get active campaigns |
| GET | `/rewards` | Get available rewards for spin |
| GET | `/survey/questions` | Get survey questions (latest active version) |
| GET | `/survey/questions/:productId` | Questions for one product |
| POST | `/users/guest` | Create/refresh guest user from profile |

### Auth (Protected)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login |
| POST | `/auth/admin/login` | Admin login |
| GET | `/user/profile` | Get current user profile |
| PATCH | `/user/profile` | Update profile |

### Rewards (Protected)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/rewards` | Get available rewards for spin |
| POST | `/rewards/spin` | Spin the wheel (idempotent) |
| POST | `/rewards/delivery` | Submit delivery info |
| GET | `/rewards/my` | Get user's rewards |

### Admin (Admin Only)

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/admin/survey/questions` | Questions CRUD |
| PATCH/DELETE | `/admin/survey/questions/:id` | Update/delete question |
| GET/POST | `/admin/survey/versions` | Survey versions |
| GET/POST | `/admin/products` | Products CRUD |
| GET/POST | `/admin/rewards` | Rewards CRUD |
| PATCH | `/admin/rewards/:id/stock` | Adjust stock |
| GET | `/admin/rewards/inventory` | Inventory summary |
| GET | `/admin/deliveries` | Delivery list |
| PATCH | `/admin/deliveries/:id/status` | Update delivery status |
| GET | `/admin/users` | User list |
| GET | `/admin/analytics/*` | Dashboard analytics |
| GET | `/admin/audit-logs` | Admin audit trail (`{ logs, total }`) |
| GET/PATCH | `/admin/settings` | Feature flags / maintenance mode |

## Database Schema (Key Tables)

- `users` — User accounts (email, phone, DOB, NRC, etc.)
- `survey_responses` — Completed survey submissions
- `survey_questions` / `survey_options` — Dynamic survey definitions
- `survey_versions` — Survey version history
- `products` — Product catalog
- `rewards` — Available prizes with stock/weights
- `reward_spins` — Spin history (idempotent)
- `user_rewards` — Awards granted to users
- `delivery_information` — Delivery addresses
- `reward_inventory_transactions` — Stock audit trail
- `audit_logs` — Admin action logging

## Spin Wheel Flow

```
Complete Survey → /survey/submit → /spin → GET /rewards → POST /rewards/spin
                                                     ↓
                                              Wheel animates to server result
                                                     ↓
                                          Result displayed + reward stored
                                                     ↓
                                          Claim → /delivery (if required)
```

### Idempotency & concurrency

- The spin result is **server-authoritative**: the API picks the reward atomically
  and the wheel animates to it.
- A partial unique index on `reward_spins(user_id, COALESCE(campaign_id,'default')) WHERE status != 'CANCELLED'`
  guarantees **at most one spin per user+campaign** (the default campaign is
  stored as `NULL`). A `PENDING` row is inserted
  before inventory is touched, so concurrent double-taps collapse to one award.
- Client `idempotencyKey` replays return the stored result; in-flight retries
  return `SPIN_IN_PROGRESS`; duplicate survey submissions return the original
  `responseId` with `idempotent: true`.
- Inventory is reserved with a conditional `UPDATE … WHERE remaining_quantity > 0`
  and finalised in a single `db.batch()`, with compensation on failure.

## Deployment

### Cloudflare Pages (Web Apps)

```bash
# survey-web (project: alcohol-survey, custom domain myanmarbeer.boom.com.mm)
cd apps/survey-web && npm run build && npx wrangler pages deploy

# admin-web (project: alcohol-survey-admin, standalone at its own .pages.dev domain)
cd apps/admin-web && npm run build && npx wrangler pages deploy
```

Both Pages projects also run the API as a Function (`functions/api/[[route]].ts`),
so **set the same `JWT_SECRET` on each project**:

```bash
npx wrangler pages secret put JWT_SECRET --project-name alcohol-survey
npx wrangler pages secret put JWT_SECRET --project-name alcohol-survey-admin
```

Turnstile is **opt-in and disabled by default** so the survey journey stays
challenge-free. A secret alone is not enough: verification also requires
`TURNSTILE_ENFORCE = "true"` in `[vars]`. To enable it, set the secret on the API
worker **and** both Pages projects (otherwise another origin can bypass bot
protection), then set `TURNSTILE_ENFORCE`:

```bash
npx wrangler secret put TURNSTILE_SECRET
npx wrangler pages secret put TURNSTILE_SECRET --project-name alcohol-survey
npx wrangler pages secret put TURNSTILE_SECRET --project-name alcohol-survey-admin
```

### Cloudflare Workers (API + cron)

The root `wrangler.toml` deploys the API worker (`alcohol-survey-platform`) and
its 15-minute spin-cleanup cron. Set secrets from the repo root:

```bash
npx wrangler secret put JWT_SECRET
npx wrangler deploy
```

### Verify after deploy

```bash
# The hardening test needs Turnstile disabled (the default), so it can run
# against a local/dev API as well.
API_BASE=http://localhost:8788/api npm run test:hardening

# Production sanity checks:
curl https://myanmarbeer.boom.com.mm/api/public/turnstile   # enabled:false unless TURNSTILE_ENFORCE=true
curl https://myanmarbeer.boom.com.mm/api/health
```

## Testing

- [`test.md`](./test.md) — full manual QA checklist (API, user app, admin app).
- `npm run typecheck` — TypeScript for all three apps.
- `npm run lint` — ESLint (web apps) + typecheck (API).
- `npm run test:hardening` — concurrency/idempotency smoke test against a running API.
- `npm run test:load` — k6 load test (staging only).

See [`LOAD_TESTING.md`](./LOAD_TESTING.md) for details.

## Further reading

- [`ARCHITECTURE_ASSESSMENT.md`](./ARCHITECTURE_ASSESSMENT.md) — findings, D1 budget, concurrency strategy.
- [`PRODUCTION_HARDENING.md`](./PRODUCTION_HARDENING.md) — what changed and the required deploy steps.
- [`MONITORING.md`](./MONITORING.md) — health, logs, alerts, runbook.
- [`LOAD_TESTING.md`](./LOAD_TESTING.md) — concurrency and load tests.

## Recent Fixes

### Spinwheel Fixes (2026-09-21)

1. **Wheel never rotated** — `wheelRotation` state was unused; replaced with `rotation` state in wheel CSS and label counter-rotation
2. **`checkExistingSpin` broken** — `/rewards/my` API wasn't returning `reward_id`; added `ur.reward_id` to SQL query
3. **Stale closure in `animateWheel`** — Replaced `rotation` state capture with `rotationRef` for accurate animation
4. **Async race in spin detection** — Added `rewardsLoadedRef` + `sessionStorage` fallback for pending rewards
5. **Dead code removed** — Removed unused `____setWheelRotation` state and setter

See [test.md](./test.md) for full bug history.
