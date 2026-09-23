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
| `npm run build` | `next build` — static export into `out/` (`distDir: 'out'`) |
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
| `/info` | Personal info form (name, phone, DOB, Myanmar NRC) → guest registration, stores the JWT |
| `/survey` | One-question-at-a-time survey with a review screen → submit → `/spin` |
| `/spin` | Prize wheel; the server decides the reward (idempotency-keyed), win card shown on return |
| `/delivery` | Shipping-address claim for rewards with `requiresDelivery` (`?reward=<userRewardId>`) |

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `NEXT_PUBLIC_API_BASE` | API origin used by every `fetch` (see `app/lib/config.ts`) | `https://myanmarbeer.boom.com.mm/api` |

Conventions in this repo:

- `.env.local` → `NEXT_PUBLIC_API_BASE=http://localhost:8787` (local `wrangler dev` API)
- `.env.production` → `NEXT_PUBLIC_API_BASE=/api` (same-origin, proxied by
  `functions/api/[[route]].ts`, which mounts the full API under `/api/*` on Cloudflare Pages —
  this avoids the `*.workers.dev` API domain that many mobile/carrier networks cannot reach)

Being `NEXT_PUBLIC_*`, the value is inlined at build time; change it before building, not after.

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

## Internationalisation (EN / MY)

- Copy lives in `app/lib/translations.ts` — two flat dictionaries, `en` and `my`, with the same
  keys; `Language` and `TranslationKey` types are exported from the same file.
- `app/context/LanguageContext.tsx` provides `t(key)`, `language` and `setLanguage`; **the
  default language is Burmese (`'my'`)** and missing keys fall back to `en`.
- `app/components/LanguageSwitcher.tsx` (EN/MY pills in the header and landing bar) toggles the
  language. The selection is **not persisted** — it resets to `my` on reload.
- Burmese text uses the `font-myanmar` class (Noto Sans Myanmar, loaded in `app/layout.tsx`).

## Myanmar NRC data

- **Validation/formatting helpers used by the UI:** `app/lib/nrc.ts`
  (`normalizeMyanmarNumerals`, `validateSerial`, `validateNrc`, `formatNrcDisplay`,
  `isNrcComplete`, `NRC_TYPES`, `parseNrc`). The widget is `app/components/NrcInput.tsx`
  (Region 1–14, type letter, 6-digit serial — township is not collected).
- **Full dataset:** `app/data/myanmar-nrc.ts` — 14 State/Regions with bilingual township lists
  plus lookup/validation helpers (`getStateRegion`, `getTownships`, `validateNrcComponents`,
  `formatNrc`). Currently not imported by any page (reference data for the NRC doc).

## Further documentation

- Function-by-function reference: [`../../docs/survey-web-functions.md`](../../docs/survey-web-functions.md)
- Myanmar NRC reference: [`../../docs/myanmar-nrc.md`](../../docs/myanmar-nrc.md)
- End-to-end QA checklist (app runs on :3000, admin on :3001, API on :8787): [`../../test.md`](../../test.md)
