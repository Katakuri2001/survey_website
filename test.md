# Survey Platform — Full Website Test Checklist

QA test suite for the "Myanmar Beer Survey & Rewards" platform.

- **User app (survey)**: http://localhost:3000
- **Admin app (admin)**: http://localhost:3001
- **API**: http://localhost:8787
- **Environment**: Local dev (Next.js dev servers + wrangler dev + local D1)

After each test mark `[ ]` as `[x]` and note result: **PASS** / **FAIL** (+ screenshot/log if fail).

---

## Reference data (seeded via `migrations/0003_seed_data.sql`)

| Item | Value |
|---|---|
| Admin user | `admin@myanmarbeer.com` / `admin` |
| Sample user | `user@example.com` / `user123` |
| Product | `beer` (Myanmar Beer) |
| Campaign | `campaign-2026` |
| Rewards | `reward-tumbler` (200), `reward-t-shirt` (100), `reward-cap` (150), `reward-cooler` (50), `reward-no-prize` (99999) |
| JWT header | `Authorization: Bearer <token>` |

---

## 1. API Tests (`curl`)

### A. Auth

- [ ] **API-01** `POST /auth/register` with `{ fullName, email, phone, password }` → 200 `{ success: true, data: { token, user } }`; new user appears in `users`.
- [ ] **API-02** Register with duplicate email → `{ success: false }` error (409-ish), no duplicate row.
- [ ] **API-03** `POST /auth/login` correct credentials → 200 token + user.
- [ ] **API-04** Login wrong password / unknown email → `{ success: false }` with message.
- [ ] **API-05** `POST /auth/admin/login` with admin creds → 200 token with admin role; with normal user creds → rejected.
- [ ] **API-06** `GET /user/profile` with valid token → 200 user; without token → 401.
- [ ] **API-07** `PATCH /user/profile` updates fields (is_admin cannot be escalated by normal user).

### B. Public survey endpoints

- [ ] **API-08** `GET /products?lang=en` → 200 `success`, array contains `beer`; `lang=my` returns Myanmar translation.
- [ ] **API-09** `GET /campaigns?lang=en` → 200, contains `campaign-2026`.
- [ ] **API-10** `GET /survey/questions/beer?lang=en` → 200, `data.questions` = 6 items in display_order; each question has `options` for choice types; `lang=my` returns translated text.
- [ ] **API-11** `GET /survey/questions/unknown-product` → graceful `success:false` or empty (no crash).

### C. Survey submit / rewards flow

- [ ] **API-12** `POST /survey/submit` with valid `productId`, `campaignId`, `userId`, `language`, `answers[]` (all required questions answered) → 200, returns `responseId`.
- [ ] **API-13** Submit with a missing required question → validation error, no response row.
- [ ] **API-14** `GET /rewards?lang=en` → 200 list of 5 rewards; `lang=my` translated.
- [ ] **API-15** `POST /rewards/spin` (auth, no body → server resolves response/campaign/product) → 200 `{ userRewardId, rewardId, rewardName }`.
- [ ] **API-16** Spin **twice for the same response** → second call rejected (one spin per response).
- [ ] **API-17** Spin as ratio: reward respects weights (tumbler 30 / t-shirt 20 / cap 25 / cooler 15 / no-prize 10). Run 50 spins, count distribution is non-zero for all weighted rewards.
- [ ] **API-18** Spin without token → 401. Spin with a user that has no eligible response → clean error.
- [ ] **API-19** `POST /rewards/delivery` (auth) with `userRewardId` + `{ fullName, phone, address, city, township, postalCode, notes }` → 200, status `PENDING` (or `DELIVERY_SUBMITTED`).
- [ ] **API-20** Delivery without required fields → validation error.
- [ ] **API-21** Delivery for an already-delivered reward → rejected / idempotent (no double submit).
- [ ] **API-22** `GET /rewards/my` (auth) → list of the user's rewards with statuses (WON → DELIVERY_SUBMITTED → SHIPPED/DELIVERED).

### D. Admin — dashboard & analytics

- [ ] **API-23** `GET /admin/dashboard` (admin token) → totals: participants, completed surveys, completion rate, rewards awarded, pending deliveries, active products. (No token → 401; normal user token → 403.)
- [ ] **API-24** `GET /admin/analytics/popularity` → per-product response_count/percentage.
- [ ] **API-25** `GET /admin/analytics/ratings` → per-product avg_rating.
- [ ] **API-26** `GET /admin/analytics/age-groups?productId=beer` → age_group aggregates.
- [ ] **API-27** `GET /admin/analytics/comparison` → per-product response/taste/packaging/value/recommend.
- [ ] **API-28** `GET /admin/analytics/trend?period=7|14|30|60` → daily counts.

### E. Admin — CRUD

- [ ] **API-29** `GET /admin/survey/questions` → list for active version.
- [ ] **API-30** `POST /admin/survey/questions` → creates question (appears in public `/survey/questions/:productId`).
- [ ] **API-31** `PATCH /admin/survey/questions/:id` → updates text/type/order.
- [ ] **API-32** `DELETE /admin/survey/questions/:id` → removes (public endpoint reflects).
- [ ] **API-33** `GET /admin/survey/versions` → version list.
- [ ] **API-34** `POST /admin/survey/versions` → creates new version; activating it switches public survey.
- [ ] **API-35** `GET/POST /admin/products`, `PATCH /admin/products/:id` → product CRUD; toggle `is_active` hides from public.
- [ ] **API-36** `GET/POST /admin/rewards`, `PATCH /admin/rewards/:id` → reward CRUD.
- [ ] **API-37** `GET /admin/rewards/inventory` → per-reward remaining + summary.
- [ ] **API-38** `PATCH /admin/rewards/:id/stock` → stock adjustment updates `remaining_quantity` + writes inventory tx; **cannot make remaining negative**.
- [ ] **API-39** `GET /admin/rewards/history` → inventory transaction history.
- [ ] **API-40** `GET /admin/deliveries` → paginated deliveries.
- [ ] **API-41** `PATCH /admin/deliveries/:id/status` → advance status (PENDING → SHIPPED → DELIVERED); invalid transition rejected.
- [ ] **API-42** `GET /admin/users` → paginated user list (sensitive fields not exposed).
- [ ] **API-43** `GET /admin/users/:id` → single user detail.
- [ ] **API-44** `GET /admin/responses` + `GET /admin/responses/:id` → response + answers detail.
- [ ] **API-45** `GET /admin/audit-logs` → audit trail (admin actions logged).
- [ ] **API-46** `GET /` → 200 OK / service info.

---

## 2. User Web App Tests (http://localhost:3000)

### 2.1 Home page (`/`)

- [ ] **UI-01** Loads within 3s; shows brand + product intro + "Scan to participate" / CTA.
- [ ] **UI-02** Age gate / legal notice present (drinking-age requirement).
- [ ] **UI-03** EN ↔ MY language toggle switches all visible text.
- [ ] **UI-04** CTA links to `/login`. Navigation works on mobile viewport (375px).

### 2.2 Login / Register (`/login`)

- [ ] **UI-05** Login with `user@example.com` / `user123` → redirect to `/info`.
- [ ] **UI-06** Wrong password → inline error, stays on page.
- [ ] **UI-07** Switch to Register tab. Fill fullName/email/phone/password/confirmPassword.
- [ ] **UI-08** Password mismatch → validation error, no submit.
- [ ] **UI-09** Valid registration → auto-login (token saved) → `/info`.
- [ ] **UI-10** After login token exists in `localStorage("survey_token")`.

### 2.3 Personal info form (`/info`)

- [ ] **UI-11** All fields render: DOB (day/month/year), gender, NRC state/type/number, occupation, city.
- [ ] **UI-12** DOB age validation — under 18 rejected (age gate).
- [ ] **UI-13** Required fields : empty submit → validation errors.
- [ ] **UI-14** Valid submit → navigates to `/survey`.

### 2.4 Survey (`/survey`)

- [ ] **UI-15** Loads questions from API (`beer`); no hardcoded fallback.
- [ ] **UI-16** Question types all work: single_choice (radio), multiple_choice (checkboxes), rating (1–10 stars/scale), text (textarea, 500 max).
- [ ] **UI-17** Progress bar advances per question; % updates.
- [ ] **UI-18** Back button returns to previous question **with answers preserved**.
- [ ] **UI-19** Required question left empty → cannot proceed.
- [ ] **UI-20** Multiple-choice minimum selection (min:1) enforced.
- [ ] **UI-21** Completing last question → Review mode listing all answers.
- [ ] **UI-22** Review: "Edit" jumps back; "Submit" posts to `/survey/submit`.
- [ ] **UI-23** Successful submit → stores `responseId/product/campaign` in sessionStorage → `/spin`.
- [ ] **UI-24** Language toggle during survey keeps EN/MY translations for questions/options/labels.
- [ ] **UI-25** Network error during load → error message + retry (no white screen).

### 2.5 Spin (`/spin`)

- [ ] **UI-26** Reward wheel loads the 5 rewards with colors.
- [ ] **UI-27** Clicking "Spin" plays animation (~4s) and lands on a reward.
- [ ] **UI-28** Winning a real reward shows reward name/image + "Claim your prize".
- [ ] **UI-29** Winning "no-prize" shows try-again message (no claim CTA).
- [ ] **UI-30** Spin disabled after first result (one spin per response).
- [ ] **UI-31** Reward saved to sessionStorage (`user_reward_id`, `reward_name`).
- [ ] **UI-32** Claim → `/delivery`. No reward → cannot access delivery spinner-state.

### 2.6 Delivery (`/delivery`)

- [ ] **UI-33** Form shows reward name they won.
- [ ] **UI-34** Required fields (fullName, phone, address, city, township, postalCode) validated.
- [ ] **UI-35** Valid submit → success screen (delivery received), no double-submit on refresh.
- [ ] **UI-36** "Home" link returns to `/`.
- [ ] **UI-37** Direct visit to `/delivery` without reward → graceful message, no crash.

### 2.7 Auth & route guard (user app)

- [ ] **UI-38** Accessing `/info`, `/survey`, `/spin`, `/delivery` **logged-out** → redirected to `/login` (or clean unauthenticated message).
- [ ] **UI-39** Expired / tampered `survey_token` → API returns 401 → app recovers to login.
- [ ] **UI-40** Reload mid-flow on `/survey`, `/spin` — state from sessionStorage preserved or clean error (no infinite spinner).

### 2.8 i18n & responsiveness (user app)

- [ ] **UI-41** Every page has correct EN & MY text (no untranslated English on MY mode).
- [ ] **UI-42** Responsive on 375px×667px (mobile), 768×1024 (tablet), 1280×800 (desktop) — no horizontal scroll.

---

## 3. Admin Web App Tests (http://localhost:3001)

### 3.1 Login (`/login`)

- [ ] **AD-01** `/` redirects to `/login` when unauthenticated (or `/dashboard` after auth).
- [ ] **AD-02** Login `admin@myanmarbeer.com` / `admin` → `/dashboard`.
- [ ] **AD-03** Wrong password → error message.
- [ ] **AD-04** Non-admin user token → 403 / locked out of admin UI.

### 3.2 Dashboard (`/dashboard`)

- [ ] **AD-05** KPI cards populate (participants, completed, rewards awarded, pending deliveries).
- [ ] **AD-06** Charts render (product popularity bar, responses bar); reward inventory list shows remaining stock.
- [ ] **AD-07** Quick Actions links navigate to products/surveys/rewards/deliveries.
- [ ] **AD-08** Loading skeleton shown while fetching; auth error state when token invalid.

### 3.3 Products (`/products`)

- [ ] **AD-09** Table lists products (name, image, display order, active status).
- [ ] **AD-10** Add product modal: validation, save → appears in list + public API.
- [ ] **AD-11** Edit product → updates.
- [ ] **AD-12** Toggle active/inactive → reflected in status; inactive product hidden from user app.
- [ ] **AD-13** Server error → inline error message.

### 3.4 Surveys (`/surveys`)

- [ ] **AD-14** Lists active survey version + questions.
- [ ] **AD-15** Add question with type/required/order/options → persists to DB.
- [ ] **AD-16** Edit question (text, options) → user survey reflects changes.
- [ ] **AD-17** Delete question → removed from public survey.
- [ ] **AD-18** Create new version → appears in versions list.

### 3.5 Rewards (`/rewards`)

- [ ] **AD-19** Rewards table with images, stock, weight, status badges (AVAILABLE/LOW_STOCK/EXHAUSTED).
- [ ] **AD-20** Add / edit / delete reward.
- [ ] **AD-21** Inventory tab: remaining vs total per reward + summary; percent bars.
- [ ] **AD-22** Stock adjustment: +/− quantity; over-deduct → blocked/negative clamp.
- [ ] **AD-23** History tab: INITIAL_STOCK / REWARD_AWARDED / ADJUSTMENT transactions listed.

### 3.6 Deliveries (`/deliveries`)

- [ ] **AD-24** Paginated delivery list with user/reward/address/status.
- [ ] **AD-25** Filter by status.
- [ ] **AD-26** Status advance PENDING → SHIPPED → DELIVERED updates UI + API.
- [ ] **AD-27** Invalid transition (e.g. PENDING → DELIVERED skip) rejected gracefully.

### 3.7 Users (`/users`)

- [ ] **AD-28** List of users with pagination + search.
- [ ] **AD-29** User detail view shows profile + activity (surveys, rewards).
- [ ] **AD-30** No password/sensitive data rendered.

### 3.8 Analytics (`/analytics`)

- [ ] **AD-31** Stat cards (total responses, active products, avg rating, top product).
- [ ] **AD-32** Product popularity + average ratings charts.
- [ ] **AD-33** Age-group breakdown by product selector.
- [ ] **AD-34** Participation trend with 7/14/30/60d buttons.
- [ ] **AD-35** Product comparison table (responses, taste, packaging, value, recommend badges).
- [ ] **AD-36** Refresh button reloads data; per-section error states (no crash).

### 3.9 Audit (`/audit`)

- [ ] **AD-37** Logs list with admin, action, resource type/id, timestamp.
- [ ] **AD-38** Actions performed in admin (login, product edit, stock change) appear here.
- [ ] **AD-39** Pagination + action filter work.

---

## 4. Cross-Cutting Tests

- [ ] **X-01** **Auth/security**: deleted/expired/forged JWT → 401 on all protected endpoints; normal-user token → 403 on all `/admin/*`.
- [ ] **X-02** **Integrity**: after a successful spin, inventory `remaining_quantity` decremented by exactly 1; `REWARD_AWARDED` transaction recorded.
- [ ] **X-03** One spin per `survey_response_id` even after page refresh / double-click.
- [ ] **X-04** No negative stock possible.
- [ ] **X-05** **Input validation**: long text (501 chars) blocked; malformed JSON body → 400 not 500.
- [ ] **X-06** **Consent/age gate**: marketing consent and age-gate booleans stored; under-18 blocked at `/info`.
- [ ] **X-07** **i18n**: `lang` param honored on all public GETs; invalid lang falls back to EN.
- [ ] **X-08** **Accessibility**: forms have labels, buttons have aria-labels, contrast of text on white ≥ 4.5:1 (text-muted #5F6E63 survey / #64748B admin).
- [ ] **X-09** **Performance**: API responses < 500ms locally; pages load < 3s; no console errors on any page.
- [ ] **X-10** **Browser matrix**: Chrome + Firefox + Safari latest render & function.

---

## 5. Post-Deployment (Cloudflare) Acceptance

After deploying to Cloudflare:
- [ ] **DEP-01** API reachable at production Workers URL; `GET /` responds.
- [ ] **DEP-02** Production D1 migrated (`0001`→`0003`) and seeded; run API-01, 03, 05, 08, 12, 15, 19, 22, 23 against prod.
- [ ] **DEP-03** `wrangler d1` remote shows seed counts (product, campaign, 6 questions, 5 rewards).
- [ ] **DEP-04** User app prod URL: home → login → info → survey → spin → delivery flow end-to-end.
- [ ] **DEP-05** Admin app prod URL: login → dashboard → products/surveys/rewards/deliveries/users/analytics/audit.
- [ ] **DEP-06** Cookies/auth still work cross-origin (API at different subdomain than apps).
- [ ] **DEP-07** No CORS errors when apps call production API; check the frontend `API_BASE` env points to prod.

---

## Execution log

| Date | Environment | Automated (API) | User app | Admin app | Notes |
|---|---|---|---|---|---|
| 2026-09-13 | local (:3000/:3001/:8787) | API-01..46 PASS (see fixes below) | Manual checklist pending | Manual checklist pending | 3 bugs found+fixed during API run |

## Bugs found & fixed during API testing

1. **Auth 500 on `/admin/*` for non-admins** — `authMiddleware` nested `next()` so a 403 path hit un-finalized context. Fixed: `return await next()`, simplified `adminMiddleware`, 28 routes now use `authMiddleware, adminMiddleware`. Non-admin → 403 (was 500).
2. **Duplicate delivery POST → 500** — `delivery_information.user_reward_id` is UNIQUE; second POST threw. Fixed: idempotent early-return of existing delivery (200).
3. **Register duplicate phone → 500** — only email was pre-checked. Fixed: pre-check phone → 400 `Phone number already registered`.
4. **Admin toggle PATCH → 500** — admin-web sends `{ isActive }` only, handler bound `undefined` to D1 (`Type 'undefined' not supported`). Fixed: `orNull()` helper applied to `/admin/survey/questions/:id`, `/admin/products/:id`, `/admin/rewards/:id` binds. Verified question/product/reward toggles, stock adjust +/-, and below-zero guard all 200/400.