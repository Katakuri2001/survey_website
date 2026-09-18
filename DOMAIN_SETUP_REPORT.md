# Domain Setup Report: myanmarbeer.com.mm for Survey Web & Admin Dashboard

## Current Architecture

- **survey-web** (`apps/survey-web`): Next.js 15, static export (`output: 'export'`), routes: `/`, `/survey`, `/spin`, `/info`, `/login`
- **admin-web** (`apps/admin-web`): Next.js 15, static export (`output: 'export'`), routes: `/`, `/dashboard`, `/surveys`, `/products`, `/analytics`, `/rewards`, `/settings`, `/users`, `/login`
- **api** (`apps/api`): Hono on Cloudflare Workers with D1 database

## Recommended Domain Structure

```
myanmarbeer.com.mm/              → survey-web (root)
myanmarbeer.com.mm/survey        → survey-web survey pages
myanmarbeer.com.mm/spin          → survey-web spin wheel
myanmarbeer.com.mm/info          → survey-web info page
myanmarbeer.com.mm/login         → survey-web login

myanmarbeer.com.mm/admin/        → admin-web dashboard (all admin routes under /admin)
myanmarbeer.com.mm/admin/dashboard
myanmarbeer.com.mm/admin/surveys
myanmarbeer.com.mm/admin/products
myanmarbeer.com.mm/admin/analytics
myanmarbeer.com.mm/admin/rewards
myanmarbeer.com.mm/admin/settings
myanmarbeer.com.mm/admin/users
myanmarbeer.com.mm/admin/login

myanmarbeer.com.mm/api/          → API (Cloudflare Worker)
```

## Implementation Plan

### 1. Configure Next.js Apps for Sub-path Deployment

**survey-web** - Already at root, no changes needed.

**admin-web** - Needs basePath `/admin`:
- Update `next.config.mjs` with `basePath: '/admin'` and `assetPrefix: '/admin/'`
- Update all internal links/navigation to use `/admin` prefix
- Update API calls to use `/api` (not relative)

### 2. Cloudflare Pages Setup

Deploy both apps to Cloudflare Pages as **two separate projects** on the same custom domain:
- Project 1: `myanmarbeer-survey` → `myanmarbeer.com.mm` (root)
- Project 2: `myanmarbeer-admin` → `myanmarbeer.com.mm/admin/*`

Use **Cloudflare Pages routing rules** to handle the sub-path.

### 3. Cloudflare Workers (API)

Already configured in `wrangler.toml`. Deploy with:
```bash
cd apps/api && wrangler deploy --env production
```

### 4. DNS Configuration

In Cloudflare dashboard for `myanmarbeer.com.mm`:
- Add CNAME `myanmarbeer.com.mm` → `<survey-project>.pages.dev`
- Add CNAME `admin` → `<admin-project>.pages.dev` (or use Pages routing)
- Add CNAME `api` → `<worker-name>.<account>.workers.dev`

### 5. API URL Configuration

Update both Next.js apps to use absolute API URL:
- `NEXT_PUBLIC_API_URL=https://api.myanmarbeer.com.mm` (or `https://myanmarbeer.com.mm/api`)

---

## Files to Modify

1. `apps/admin-web/next.config.mjs` - Add basePath
2. `apps/admin-web/app/layout.tsx` - Update navigation links
3. `apps/admin-web/app/lib/api.ts` - Use absolute API URL
4. `apps/survey-web/app/lib/api.ts` - Use absolute API URL
5. Create Cloudflare Pages configuration (wrangler.toml for pages or dashboard setup)
6. Environment variables for production API URL

---

## Deployment Steps

1. **Typecheck & Build** - Run `npm run lint && npm run build`
2. **Deploy API** - `cd apps/api && wrangler deploy --env production`
3. **Deploy to Cloudflare Pages** - Via dashboard or wrangler
4. **Configure Custom Domain** - In Cloudflare Pages dashboard
5. **Test** - Verify all routes work