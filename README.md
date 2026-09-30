# Myanmar Beer Survey & Rewards Platform

A full-stack web application built for Myanmar Beer's customer survey and rewards program. Users complete a product survey, then spin a virtual wheel to win prizes. Admins manage surveys, products, rewards, and deliveries through a dedicated dashboard.

## Documentation

| Doc | What it's for |
|---|---|
| **[`AGENT.md`](./AGENT.md)** | Rules for working in this repo (commands, invariants, conventions) |
| **[`test.md`](./test.md) §0** | **The gate: TypeScript + lint + build + CSS checks to run before every commit / push / deploy** |
| **[`WEBSITE_WORKFLOW_AND_SERVICES.md`](./WEBSITE_WORKFLOW_AND_SERVICES.md)** | End-to-end working flow (Mermaid diagrams), marketing/service catalogue, pros & cons, and the loophole/awareness map |
| [`docs/README.md`](./docs/README.md) | Index of all detailed docs |
| `docs/*-functions.md` | Per-function reference for each app (what every function does and why) |
| [`docs/database.md`](./docs/database.md) | Schema, all 13 migrations, invariants |
| [`docs/myanmar-nrc.md`](./docs/myanmar-nrc.md) | Myanmar NRC format research + data-quality findings |
| [`docs/browser-research.md`](./docs/browser-research.md) | Browser choice for Myanmar translation/testing |

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

- Node.js 22+
- npm 10+
- Wrangler CLI (provided by the root dev dependency; `npx wrangler`)
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
# Apply pending migrations to the disposable local development D1.
npx wrangler d1 migrations apply survey-db --config wrangler.toml --env development --local

# Production is explicit and requires Cloudflare credentials. Review the
# migration ledger and take a D1 time-travel bookmark before running it.
npx wrangler d1 migrations apply survey-db --config wrangler.toml --env production --remote
```

> `migrations/0014_production_hardening.sql` adds the `settings` table (feature
> flags / maintenance mode), idempotency columns, and the indexes used by the
> hardened queries. It is additive and safe to apply to a live database.
>
> `migrations/0015_security_reservations_and_demo_cleanup.sql` adds rotating
> guest resume-token hashes, token revocation state, and recoverable spin
> reservations, then removes migration-seeded demo users/responses and disables
> the legacy default administrator. After applying it, create or rotate the
> administrator explicitly:
>
> ```bash
> ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='a-long-unique-password' \
>   npm run admin:bootstrap -- --remote
> ```
>
> Existing guest users created before this migration do not have a resume token;
> reset one through `POST /admin/users/:id/resume-token` (the plaintext value is
> returned once) before they can resume.

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_API_BASE` | API base URL inlined into the web apps; production builds default to same-origin `/api` | `/api` |
| `JWT_SECRET` | JWT signing secret (**required in production**, ≥16 chars) | none — auth is disabled in prod if unset |
| `ENVIRONMENT` | `production` / `staging` / `development` | `production` |
| `ALLOWED_ORIGINS` | Extra CORS origins (comma-separated) | same-origin only |

See [`.env.example`](./.env.example) and
[`PRODUCTION_HARDENING.md`](./PRODUCTION_HARDENING.md) for the full reference.

`npm run build` is a production-safe build: its prebuild guard resolves the API
base before Next starts, overrides an ignored `.env.local` value such as
`http://localhost:8787` with `/api`, and the postbuild check rejects localhost
URLs or source maps in `out/`. For an intentionally local static preview, set
`BUILD_TARGET=local` explicitly; local API/live-test commands remain opt-in.

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
npm run build --workspace=apps/survey-web
npx wrangler pages deploy apps/survey-web/out --project-name alcohol-survey --branch main

# admin-web (project: alcohol-survey-admin, standalone at its own .pages.dev domain)
npm run build --workspace=apps/admin-web
npx wrangler pages deploy apps/admin-web/out --project-name alcohol-survey-admin --branch main
```

Both Pages projects also run the API as a Function (`functions/api/[[route]].ts`),
so **set the same `JWT_SECRET` on each project**:

```bash
npx wrangler pages secret put JWT_SECRET --project-name alcohol-survey
npx wrangler pages secret put JWT_SECRET --project-name alcohol-survey-admin
```

### Cloudflare Workers (API + cron)

The root `wrangler.toml` has one release target: the explicit `production`
environment. The top-level environment is not a deployment target.

```bash
npx wrangler secret put JWT_SECRET --config wrangler.toml --env production
npx wrangler deploy --config wrangler.toml --env production
```

Pages Functions use named project secrets (there is no Worker `--env` flag for
`wrangler pages secret put`); keep the secret values identical across both
Pages projects and the production Worker.

### Vercel (static-only compatibility path)

Cloudflare Pages is the supported deployment path. `vercel.json` is retained
only as a valid single-project static-export fallback for `survey-web`; it
points at `apps/survey-web/out` and does not claim to provide the Cloudflare
Pages `/api/*` Function. The admin app and API remain Cloudflare-only unless a
separate Vercel API design is deliberately added.

### Verify after deploy

```bash
# The hardening test runs against a local/dev API and refuses production hosts:
API_BASE=http://localhost:8787 npm run test:hardening
```

## Testing

- [`test.md`](./test.md) §0 — **the pre-commit/pre-deploy gate** (typecheck, lint,
  build, CSS checks, smoke flow); sections 1–6 are the full manual QA checklist.
- `npm run typecheck` — TypeScript for all three apps (incl. `apps/api`).
- `npm run lint` — ESLint (web apps) + typecheck (API).
- `npm run build` — production-safe static exports plus artifact localhost checks.
- `npm test` — safe repository/config tests; live API suites are skipped unless `RUN_LIVE_API_TESTS=1`.
- `npm run test:api` / `npm run test:hardening` — live API suites; both require a local/staging API.
- `RUN_LIVE_API_TESTS=1 API_BASE=http://localhost:8787 npm test` — run both live suites explicitly.
- `npm run test:load` — k6 load test (local or staging only; it refuses production hosts).
- `npm run migrations:validate` and `npm run pages:build` — local migration and Pages Function checks.

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
