# admin-web

Standalone admin dashboard for the Myanmar Beer survey & rewards platform — product, survey, reward, user, analytics and audit-log management behind one login. It is a **Next.js 16** app built with `output: 'export'` (a pure static bundle), served from its **own origin** (the `alcohol-survey-admin` Cloudflare Pages project, `alcohol-survey-admin.pages.dev`) with the API mounted same-origin at `/api/*` by a Pages Function. In local development it is documented to run on **port 3001** alongside `survey-web` on 3000.

## Commands

```bash
cd apps/admin-web

npm run dev        # next dev --turbopack (see "Port" note below)
npm run build      # static export → out/
npm run lint       # eslint .
npm run typecheck  # tsc --noEmit -p tsconfig.json
```

From the repo root the same tasks run across all apps via `npm run dev` / `npm run build` / `npm run lint` / `npm run typecheck` (turbo).

> **Port note:** the `dev` script is plain `next dev --turbopack` (Next's default port is 3000, env `PORT`). The ":3001" convention holds when the monorepo runs both web apps together; when running this app alone, pin it with `PORT=3001 npm run dev`.

## Pages

| Route | File | Purpose |
|---|---|---|
| `/` | `app/page.tsx` | Spinner that redirects to `/dashboard` |
| `/login` | `app/login/page.tsx` | Admin email/password sign-in |
| `/dashboard` | `app/dashboard/page.tsx` | KPI cards, popularity charts, reward inventory |
| `/analytics` | `app/analytics/page.tsx` | Popularity, ratings, age-group, trend, comparison |
| `/products` | `app/products/page.tsx` | Product CRUD, image upload, active toggle |
| `/surveys` | `app/surveys/page.tsx` | Survey questions & versions CRUD (tabbed) |
| `/rewards` | `app/rewards/page.tsx` | Rewards CRUD, stock adjust, inventory, win history |
| `/users` | `app/users/page.tsx` | User list, detail drill-down, Excel exports |
| `/settings` | `app/settings/page.tsx` | Signed-in account, logout, change password |
| `/audit` | `app/audit/page.tsx` | Paginated admin audit log with action filter |
| `/api/*` | `functions/api/[[route]].ts` | Pages Function proxy → shared Hono API |

Full per-function reference: [`../../docs/admin-web-functions.md`](../../docs/admin-web-functions.md).

## Environment variables

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_API_BASE` | API base URL used for every fetch (inlined at build time) | `https://myanmarbeer.boom.com.mm/api` |

Local values (see `../../.env.example`): `http://localhost:8787` for the wrangler API worker, or the relative `/api` to go through the same-origin Pages Function. There are no other app-level env vars — secrets (`JWT_SECRET`, Turnstile) belong to the Pages/Workers runtime, not this bundle.

## Auth model

- **Login:** `POST {API_BASE}/auth/admin/login` with `{ email, password }` → on success the JWT is stored in `localStorage` under the key **`admin_token`** and the app navigates to `/dashboard`.
- **Client:** `adminHeaders()` in `app/lib/api.ts` reads that key and attaches `Authorization: Bearer <token>` (+ caller headers). Logout (`/settings`) removes the key. Guard behavior is per-page (static export has no middleware): `/settings` redirects to `/login` when the token is missing or the API answers `401`; `/dashboard` shows an inline "Admin Login Required" card; other pages surface generic error states.
- **Server:** enforcement lives in the API, not this app — `authMiddleware` verifies the JWT and **`adminMiddleware`** (`apps/api/src/lib/auth.ts`) re-checks `is_admin`/`is_active` against D1 on every `/admin/*` route (`apps/api/src/routes/admin.ts`).

## Static-export constraints

`next.config.mjs` sets `output: 'export'`, `trailingSlash: true`, `distDir: 'out'` and `images: { unoptimized: true }`, which means:

- `npm run build` emits a plain static site in `out/` — deploy with `npx wrangler pages deploy`; there is no Next.js server (`next start` doesn't apply).
- No server-side features: no route handlers, middleware, server actions, cookies or per-request rendering — every page is a `'use client'` component, so auth must be client-side (`localStorage`) and data fetching happens in the browser.
- `next/image` optimization is disabled (`unoptimized`) because the on-demand `/_next/image` loader can't run on a static host.
- The API is reached either cross-origin via `NEXT_PUBLIC_API_BASE` or same-origin through `functions/api/[[route]].ts`, which strips the `/api` prefix and forwards to the shared Hono app.

## Data flow & UX conventions

- All pages are client components; each fetches on mount with the Bearer token and renders one of four states: loading skeleton/spinner → error card/banner (with Retry where wired) → empty state → data table/cards.
- Mutations (create/edit/toggle/delete/stock adjust) apply a local state patch on success and refetch the affected list via the page's fetch helper.
- Error envelope from the API: `{ success: false, message, error: { code, message } }` — pages read either `message` or `error.message` (both are provided by the API by design).
- Excel exports are generated **client-side** (`app/lib/excel.ts` → `exportToExcel` + internal `escapeXml`/`cell`) as SpreadsheetML `.xls` with a UTF-8 BOM, so Myanmar text opens correctly; no server-side export code and no spreadsheet dependency.
- Pagination is offset-based: users (50/page + debounced search), audit logs (50/page + action filter), reward history (50/page); the user Q&A export caps at `limit=1000`.

## Deployment

```bash
cd apps/admin-web && npm run build && npx wrangler pages deploy
```

The Pages project serves `out/` plus the `/api/*` function, so the same `JWT_SECRET` (and optional Turnstile vars) must be set on the project:

```bash
npx wrangler pages secret put JWT_SECRET --project-name alcohol-survey-admin
```

See the root [`../../README.md`](../../README.md) for the full monorepo architecture and deploy flow.

## Testing

- `npm run lint` / `npm run typecheck` from `apps/admin-web` (or via turbo at the root).
- Manual QA for this app lives in [`../../test.md`](../../test.md) (Admin Web App section, http://localhost:3001).

## Related docs

- [`../../docs/admin-web-functions.md`](../../docs/admin-web-functions.md) — function/component reference for this app
- [`../../test.md`](../../test.md) — manual QA checklist (admin app section)
- [`../../MONITORING.md`](../../MONITORING.md) — health checks, logs, alerts, runbook
