# survey-web

The public **Myanmar Beer Survey & Rewards** user app — a Next.js 16 (App Router) client-side
application that is statically exported and served on **http://localhost:3000** in development.
Users move through a fixed funnel: land → register (guest) → answer the survey → spin the wheel →
claim delivery for physical rewards. All data comes from the workspace API (`apps/api`, a
Cloudflare Worker/Hono app) at request time from the browser.

Part of the `alcohol-survey-platform` npm/turbo monorepo (`apps/*` workspaces).

## Commands

Run from this directory (`apps/survey-web`):

| Command | What it does |
|---|---|
| `npm run dev` | `next dev --turbopack` — dev server on **http://localhost:3000** |
| `npm run build` | production-safe `next build` wrapper — static export into `out/` (`distDir: 'out'`) |
| `npm run start` | `next start` (note: with `output: 'export'` serve `out/` with any static file server instead) |
| `npm run lint` | `eslint .` |
| `npm run typecheck` | `tsc --noEmit -p tsconfig.json` |

From the repo root the same scripts run through Turbo: `npm run dev`, `npm run build`,
`npm run lint`, `npm run typecheck`.

## Routes

| Route | Purpose |
|---|---|
| `/` | Landing page — hero, "How to Win" steps, CTAs into the funnel |
| `/login` | Legacy route; immediately redirects to `/info` |
| `/info` | Personal info form (name, phone, DOB, Myanmar NRC) → guest registration, stores the JWT and resume token |
| `/survey` | One-question-at-a-time survey with a review screen → submit → `/spin`; answers/current question survive reloads |
| `/spin` | Prize wheel; the server decides the reward (idempotency-keyed), win card shown on return |
| `/delivery` | Shipping-address claim for rewards with `requiresDelivery` (`?reward=<userRewardId>`) |

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `NEXT_PUBLIC_API_BASE` | API origin used by every `fetch` (see `app/lib/config.ts`) | `/api` for production Pages builds |

Conventions in this repo:

- `.env.local` → `NEXT_PUBLIC_API_BASE=http://localhost:8787` (local `wrangler dev` API)
- `.env.production` → `NEXT_PUBLIC_API_BASE=/api` (same-origin, proxied by
  `functions/api/[[route]].ts`, which mounts the full API under `/api/*` on Cloudflare Pages —
  this avoids the `*.workers.dev` API domain that many mobile/carrier networks cannot reach)

Being `NEXT_PUBLIC_*`, the value is inlined at build time; change it before building, not after. The `prebuild`/`build` wrapper treats a normal build as production: an ignored `.env.local` localhost value is overridden with `/api`, and `postbuild` rejects localhost URLs or source maps in `out/`. Use `BUILD_TARGET=local` only when a local static artifact is intentional.

## Static-export constraints

`next.config.mjs` is configured for a pure static site:

- `output: 'export'` — no server runtime, no Route Handlers, no middleware, no ISR/SSR.
  Every page is `'use client'` and does its own fetching in the browser.
- `images: { unoptimized: true }` — the on-demand `/_next/image` optimizer cannot run in a
  static export (it would 404), so images are served as-is.
- `trailingSlash: true` and `distDir: 'out'` — deploy the `out/` directory to any static host
  or Cloudflare Pages.
- Consequences: no server-side secrets (everything reaching the client is public), auth is a
  JWT in `localStorage`, and pages defer storage/query-string reads behind `useHydrated()` to
  stay hydration-safe.

## Session recovery and progress

- `POST /users/guest` must accept an optional `resumeToken` and return
  `data.resumeToken` on every successful response. The client stores that value as
  `survey_resume_token` and sends it with both the initial guest request and forced token
  refreshes.
- A `RESUME_TOKEN_REQUIRED` response clears the stale identity/session keys and leaves a
  recovery notice for `/info`; in-progress survey answers are intentionally retained.
- Survey progress is stored as the validated `survey_progress` snapshot in
  `sessionStorage` (answers, current question id/index, and review mode). Polls use a
  request sequence and submission epoch so late/error responses cannot replace newer
  progress.
- The API must expose the awarded rows through `GET /rewards/my` with non-null
  `reward_id` and `user_reward_id`. The spin UI uses that endpoint when a prior award is
  no longer present in the public `/rewards` catalogue. A successful spin envelope with
  null/canceled identifiers is never rendered as a win.

## Internationalisation (EN / MY)

- Copy lives in `app/lib/translations.ts` — two flat dictionaries, `en` and `my`, with the same
  keys; `Language` and `TranslationKey` types are exported from the same file.
- `app/context/LanguageContext.tsx` provides `t(key)`, `language` and `setLanguage`; **the
  default language is Burmese (`'my'`)** and missing keys fall back to `en`.
- `app/components/LanguageSwitcher.tsx` (EN/MY pills in the header and landing bar) toggles the
  language. The selection is **not persisted** — it resets to `my` on reload.
- Burmese text uses the `font-myanmar` class (Noto Sans Myanmar, loaded in `app/layout.tsx`).

## Myanmar NRC data

- **Source of truth:** [`mm-nrc`](https://github.com/wai-lin/mm-nrc) (MIT) is a direct
  dependency — it ships 15 states (1–14 + Naypyitaw `9*`), 471 townships with official
  3-letter codes, and the citizenship type letters (N/E/P/T/Y/S).
- **Adapter:** `app/data/myanmar-nrc.ts` derives `MYANMAR_NRC_DATA`, `NRC_TYPES` and the
  lookup/validation helpers (`getStateRegion`, `getTownships`, `getTownship`,
  `validateNrcComponents`, `formatNrc`) from the package at module load — do not hand-edit.
- **Validation/formatting:** `app/lib/nrc.ts` (`normalizeMyanmarNumerals`, `validateSerial`,
  `validateNrc`, `formatNrcDisplay`, `isNrcComplete`, `parseNrc`; `NRC_TYPES` re-exported).
  All four components are required; the canonical display is `12/TAMANA(N)112233`.
  Myanmar numerals are normalized to ASCII, serials must be exactly six digits, and the
  upstream dataset is used to reject placeholder `-` codes and ambiguous duplicate township
  codes.
- **Widget:** `app/components/NrcInput.tsx` — Region → Township → Type → Serial (only
  unambiguous, non-placeholder township codes are selectable; validation is derived from the
  current controlled value). Used on `/info`.

## API dependencies for the P1 client fixes

The browser implementation is ready for the agreed contracts, but deployment still depends on
API behavior outside this app:

- `/users/guest` must validate `resumeToken`, rotate/return `data.resumeToken`, and return the
  stable error code `RESUME_TOKEN_REQUIRED` when an existing phone cannot be resumed.
- Authenticated survey/spin/delivery endpoints must return a parseable 401 (or
  `UNAUTHORIZED`) envelope so the one forced-refresh retry can run.
- `GET /rewards/my` must include the durable user-reward id, reward id/name/image, delivery
  flag, and status; canceled rows should not be presented as awards.
- Survey question `validation_rules` is JSON (for example `{"required":true,"maxLength":500}`);
  the client applies `required`, length, min/max, and regex rules to text/rating/choice
  answers before submission.

## Further documentation

- Function-by-function reference: [`../../docs/survey-web-functions.md`](../../docs/survey-web-functions.md)
- Myanmar NRC reference: [`../../docs/myanmar-nrc.md`](../../docs/myanmar-nrc.md)
- End-to-end QA checklist (app runs on :3000, admin on :3001, API on :8787): [`../../test.md`](../../test.md)
