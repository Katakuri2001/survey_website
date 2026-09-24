# Codebase Audit Checklist

- **Status:** Open — no fixes applied
- **Audit scope:** Current working tree, including the uncommitted NRC/authentication changes present during the audit
- **Checklist date:** 2026-09-25
- **Branch audited:** `main`
- **Fix backlog:** 56 items — 5 critical, 23 high, 20 medium, 8 low
- **Add backlog:** 28 items — 4 security/identity, 7 product/admin, 12 test, 5 deployment/operations

All boxes are intentionally unchecked. This document separates defects that need to be **fixed** from capabilities, tests, and operational controls that need to be **added**.

## Priority

- **P0 — Critical:** Security, data loss, reward abuse, or production-blocking issue.
- **P1 — High:** Core workflow, data integrity, deployment, or administration failure.
- **P2 — Medium:** Reliability, contract, accessibility, analytics, or user-experience defect.
- **P3 — Low:** Tooling, documentation, maintainability, or cosmetic issue.
- **ADD — Missing:** Capability, test, CI control, or operational safeguard not currently present.

## Needed to Fix — Critical (P0)

- [ ] **FIX-C01 — Phone-only guest authentication permits account takeover and possible admin escalation.** `apps/api/src/routes/auth.ts:170-259` finds users solely by phone, overwrites their profile, and issues a JWT without OTP or password verification. `apps/api/src/lib/auth.ts:216-227` authorizes admins from the database without requiring the token's role claim.
- [ ] **FIX-C02 — Users can win rewards without completing the survey.** `apps/api/src/routes/rewards.ts:87-176` never checks for a completed response. The only completion check is client-side session storage in `apps/survey-web/app/spin/page.tsx:357-365`.
- [ ] **FIX-C03 — Migration `0005` silently deletes delivery records.** `migrations/0005_spin_uniqueness.sql:28-33` drops `user_rewards`; delivery rows cascade from it through `migrations/0001_initial.sql:291-304`.
- [ ] **FIX-C04 — Production migrations create a publicly known admin account.** `migrations/0003_seed_data.sql:10-16` creates `admin@myanmarbeer.com` with password `admin`; the same credentials are used by `tests/api-tests.mjs:100-102`.
- [ ] **FIX-C05 — Production migrations seed fake users, responses, deliveries, and inventory usage.** `migrations/0004_demo_survey_data.sql:92-256` and `migrations/0006_seed_data_v2.sql:28-260` contaminate a fresh production database with demo analytics and fulfillment records.

## Needed to Fix — High (P1)

- [ ] **FIX-H01 — Current deployable bundles call the visitor's localhost.** Both ignored `.env.local` files override `/api`; current generated chunks in `apps/survey-web/out/` and `apps/admin-web/out/` contain `http://localhost:8787`. Production CSP also blocks HTTP localhost.
- [ ] **FIX-H02 — Worker environment and migration instructions conflict.** `wrangler.toml:10-13` and `README.md:211-219` target different Wrangler environments. Local production-hardening notes also describe a remote migration ledger that would replay non-idempotent migrations; `0014` can fail on legacy duplicates.
- [ ] **FIX-H03 — Delivery submission resurrects canceled and non-physical rewards.** `apps/api/src/routes/rewards.ts:313-361` checks ownership but not `requires_delivery` or current delivery status.
- [ ] **FIX-H04 — Delivery status transitions have no state machine and repeated cancellation inflates stock.** `apps/api/src/routes/admin.ts:820-873` allows arbitrary transitions, returns success for unknown IDs, and adds inventory every time `CANCELLED` is submitted.
- [ ] **FIX-H05 — Inventory can leak permanently after a spin crash.** Stock is decremented before finalization in `apps/api/src/routes/rewards.ts:195-207`; the stale-spin cron cancels the spin without restoring inventory.
- [ ] **FIX-H06 — The admin app has no delivery-management screen.** `apps/admin-web/app/components/AdminShell.tsx:8-17` has no Deliveries item and no `app/deliveries/page.tsx` exists.
- [ ] **FIX-H07 — Admin Excel exports are broken or incomplete.** `apps/admin-web/app/users/page.tsx:531-567` requests a limit rejected by the API. `/admin/surveys/export` selects nonexistent `reward_spins.won_at` and otherwise defaults to only 50 joined rows.
- [ ] **FIX-H08 — Hard-deleting a question destroys historical answers.** `apps/api/src/routes/admin.ts:311-315` and `migrations/0001_initial.sql:204-206` cascade the deletion into `survey_answers`.
- [ ] **FIX-H09 — Administrators can create surveys that respondents cannot complete.** Choice questions can be created without options; existing options cannot be edited; supported API types such as `number` and `dropdown` have no public renderer; conditions are not evaluated.
- [ ] **FIX-H10 — Survey-version management can replace the live survey with an empty version.** `apps/api/src/routes/admin.ts:332-362` creates an empty version as active without cloning questions or deactivating older versions. The UI Active toggle is a no-op.
- [ ] **FIX-H11 — Reward editing and inventory figures are incorrect.** Total quantity and cleared winning ratios are ignored, status values do not match the API, utilization is multiplied by 100 twice, and stock adjustments can make remaining inventory exceed total inventory.
- [ ] **FIX-H12 — Image uploads are not transactionally tied to form saving.** Upload endpoints update entities before Save; cancelling does not roll back. Returned `/api/media/...` URLs also fail with a separate API origin.
- [ ] **FIX-H13 — Dashboard and mutation failures are presented as valid success.** `apps/admin-web/app/dashboard/page.tsx:193-221` converts failures into zero values and still displays “All systems operational.” Product/question toggles and deletion silently ignore failed responses.
- [ ] **FIX-H14 — Analytics can display the wrong product and retain stale results.** `apps/admin-web/app/analytics/page.tsx:324-421` has no request cancellation or response sequencing.
- [ ] **FIX-H15 — Survey answers are not validated against the live question definition.** `apps/api/src/routes/survey.ts:63-128` trusts client-supplied types, permits invalid options/rating bounds, inactive or foreign question IDs, and duplicate answers.
- [ ] **FIX-H16 — Survey polling can erase progress and a stale flag can block retries.** `apps/survey-web/app/survey/page.tsx:80-152,221-280` treats failed polls as an empty survey, prunes answers, races requests, and can retain `survey_submitting` after interruption.
- [ ] **FIX-H17 — Previously awarded rewards can disappear from the spin page.** Exhausted or paused awards are omitted from `/rewards`, so `/spin` can mark the session as spun without showing the award or claim action.
- [ ] **FIX-H18 — Retrying a canceled spin returns a false successful award.** `apps/api/src/routes/rewards.ts:33-51,110-117` treats a `CANCELLED` idempotency record as success with null reward IDs.
- [ ] **FIX-H19 — NRC validation accepts invalid data end-to-end.** Short serials pass, the API does not validate real NRC components, township code `"-"` is accepted, duplicate short codes are indistinguishable, and Burmese digits are stripped by the widget.
- [ ] **FIX-H20 — The k6 test is not a valid capacity gate and can mutate production.** `loadtest/k6-spin.js:34-145` performs sequential setup without a custom timeout, does not validate setup responses, can pass with no active VUs, and has no production hostname guard.
- [ ] **FIX-H21 — Workspace lockfiles are inconsistent.** `apps/survey-web/package-lock.json` omits `mm-nrc`; `npm ci --workspaces=false` fails. Root and child installs also resolve different Next versions.
- [ ] **FIX-H22 — The nominal root test command cannot run tests.** `package.json:13` calls a nonexistent Turbo/workspace test task, and no CI workflow invokes the separate API suites.
- [ ] **FIX-H23 — The Vercel deployment configuration is incompatible with the apps.** `vercel.json` points to `.next` instead of static-export `out`, uses unsupported multi-project configuration, and provides no API route for the Cloudflare Pages functions.

## Needed to Fix — Medium (P2)

- [ ] **FIX-M01 — Campaign and product context is inconsistent.** Expired campaigns remain selectable, the wheel can show ineligible rewards, and segment geometry ignores configured weights and winning ratios.
- [ ] **FIX-M02 — Frontends ignore API feature flags.** Survey, spin, and delivery controls remain enabled until submission returns an error.
- [ ] **FIX-M03 — Authentication and session recovery is incomplete.** Disabled users and old tokens remain valid for seven days; password changes do not revoke tokens; survey submission does not retry a 401; spin does not redirect after auth loss.
- [ ] **FIX-M04 — Profile and DOB validation is inconsistent.** Impossible dates normalize, the 18+ calculation is approximate, profile PATCH permits minors, fields cannot be cleared, and duplicate phones return 500.
- [ ] **FIX-M05 — PII and bearer tokens persist indefinitely with no logout.** Full identity data and JWTs remain in browser storage and can be inherited by a later user of the same browser.
- [ ] **FIX-M06 — Public i18n is incomplete.** The document language remains English while Burmese is default; multiple labels remain hardcoded English; review and photo cards expose internal values instead of localized names.
- [ ] **FIX-M07 — Major accessibility failures exist in both apps.** Labels are not associated with controls, dialogs lack focus management, errors are not live regions, choice state is not announced, the hidden mobile sidebar remains focusable, and contrast/focus indicators are inadequate.
- [ ] **FIX-M08 — Existing bilingual content is not loaded into admin editors.** Product, question, reward, and option data is omitted or initialized empty, and product descriptions are stored/displayed inconsistently.
- [ ] **FIX-M09 — Status and timestamp rendering uses incorrect formats.** Valid uppercase statuses receive fallback styling, and SQLite UTC timestamps are parsed as local time.
- [ ] **FIX-M10 — Several analytics calculations are misleading.** Completion can exceed 100%, recommendation compares labels to stored values, averages are unweighted, inactive products disappear from totals, and average/day uses the wrong denominator.
- [ ] **FIX-M11 — Admin list requests can overwrite newer results.** User search, audit filtering, reward tabs, and pagination lack request sequencing or cancellation.
- [ ] **FIX-M12 — Multi-step admin writes are not atomic.** Main entities can be committed before translations, options, status updates, or ledger rows fail. Several PATCH/DELETE routes return success for nonexistent IDs.
- [ ] **FIX-M13 — Database failures are misreported as 404.** Public survey-question handlers catch every producer error and return “No active survey found.”
- [ ] **FIX-M14 — Rate limiting and maintenance settings are not reliable globally.** The shared Cloudflare limiter is disabled, leaving per-isolate counters; settings-read errors fail open with all features enabled.
- [ ] **FIX-M15 — Cloudflare topology has conditional operational hazards.** R2 is optional in code but bound unconditionally, development references the production D1 ID, Pages Functions do not run scheduled cleanup, and external API fallback CORS excludes the normal admin origin.
- [ ] **FIX-M16 — Operational limits are missing or inaccurate.** JSON/multipart size limits are absent, arbitrary product IDs can cause D1/cache churn, the capacity estimate omits the 12-second survey poll, and the analytics aggregate table is unused.
- [ ] **FIX-M17 — Browser and storage resilience issues remain.** Missing Web Animations support can lock the spin button, direct storage access can crash private-mode/WebViews, restored drafts can hydration-mismatch, and write requests have no timeout.
- [ ] **FIX-M18 — Delivery and reward status UX is misleading.** Users can be offered delivery for submitted, delivered, or canceled rewards; the delivery form omits the reward name; consolation rewards are announced as wins.
- [ ] **FIX-M19 — Seeded inventory already disagrees with its ledger.** T-shirt deductions and ledger entries differ, and the legacy no-prize reward retains the wrong delivery requirement.
- [ ] **FIX-M20 — Collected identity data is omitted from admin detail/export contracts.** `nrc_township` and DOB are stored but not returned or displayed consistently.

## Needed to Fix — Lower Priority (P3)

- [ ] **FIX-L01 — `npm start` fails in both web apps.** The scripts invoke `next start` despite `output: 'export'`.
- [ ] **FIX-L02 — Root development port assignment is nondeterministic.** Both Next apps default to port 3000.
- [ ] **FIX-L03 — D1 helper scripts are malformed.** `d1:migrate` uses the obsolete `wrangler d1 migrate create` command; execute/push scripts contain awkward option separators.
- [ ] **FIX-L04 — Dependency audit reports one moderate `uuid` advisory.** Current source appears to use `crypto.randomUUID()`, so the vulnerable package is probably removable rather than reachable.
- [ ] **FIX-L05 — Node and operational documentation is stale.** README says Node 20+, while Wrangler requires Node 22+; some deployment, QA, and domain instructions are obsolete.
- [ ] **FIX-L06 — Required documentation is ignored by Git.** `AGENT.md`, `test.md`, and `docs/` are excluded despite being linked as repository documentation.
- [ ] **FIX-L07 — The admin shell contains nonfunctional controls and hardcoded identity.** Search and notifications do nothing, and signed-in account details are not loaded from the API.
- [ ] **FIX-L08 — Additional UI/export defects remain.** Product object URLs leak, inventory Adjust uses stale data, reward editing is not a form, XML export permits illegal control characters, optional questions appear completed, and township title-casing is inconsistent.

## Needed to Add

### Security and Identity

- [ ] **ADD-S01 — Add a verified guest identity flow.** The current phone-only identity must be supplemented with proof of phone ownership before issuing an account JWT.
- [ ] **ADD-S02 — Add token/session revocation.** Store a session or token version and invalidate existing tokens after password change, account disablement, deletion, or explicit logout.
- [ ] **ADD-S03 — Add public and admin logout flows.** Clear identity/session data and provide an explicit way to end the current session.
- [ ] **ADD-S04 — Add a production-safe identity lifecycle.** Distinguish guest, registered, disabled, deleted, and administrator identities with server-authoritative state transitions.

### Missing Product and Admin Capabilities

- [ ] **ADD-A01 — Add the admin Deliveries page.** Include paginated address-bearing delivery rows, status filters, valid transition controls, cancellation confirmation, and error recovery.
- [ ] **ADD-A02 — Add complete survey-version lifecycle controls.** Create, clone, preview, activate, deactivate, and roll back versions without changing the public survey accidentally.
- [ ] **ADD-A03 — Add complete option and translation editing.** Load and update existing options, option translations, question translations, product translations, and reward translations.
- [ ] **ADD-A04 — Add a production-safe migration/seed strategy.** Keep schema migrations separate from local demo data; production initialization must not create demo users or known credentials.
- [ ] **ADD-A05 — Add verified feature-flag handling in both frontends.** Load, display, and disable survey, spin, delivery, and maintenance states before users begin a blocked action.
- [ ] **ADD-A06 — Add a shared production rate limiter.** Configure the Cloudflare binding for Workers and both Pages deployments rather than relying on isolate-local counters.
- [ ] **ADD-A07 — Add delivery and inventory reconciliation monitoring.** Alert on repeated cancellation returns, remaining stock above total stock, long-pending spins, and stock/ledger divergence.

### Automated Tests

- [ ] **ADD-T01 — Add CI for the monorepo.** Run migration validation, typecheck, lint, production builds, Pages Function builds, and the API suites on every change.
- [ ] **ADD-T02 — Add a working root test command.** Ensure `npm test` executes API, hardening, and relevant unit/integration suites rather than failing on a missing Turbo task.
- [ ] **ADD-T03 — Add account-takeover regression tests.** Existing phone plus guessed DOB must not receive another user's token or overwrite PII without verification.
- [ ] **ADD-T04 — Add spin eligibility tests.** A user without a completed response must be rejected; campaign/product must match the completed response.
- [ ] **ADD-T05 — Add delivery state-machine tests.** Cover valid transitions, invalid skips, repeated cancellation idempotency, canceled/non-delivery rejection, and atomic inventory/ledger updates.
- [ ] **ADD-T06 — Add export contract tests.** Verify both exports succeed, return complete paginated data, and remain within validated limits.
- [ ] **ADD-T07 — Add survey-editor tests.** Cover zero-option rejection, option editing, arbitrary question types, version activation, cloning, rollback, and empty surveys.
- [ ] **ADD-T08 — Add migration preservation tests.** Apply every migration from a realistic legacy snapshot and verify delivery, answer, reward, and user counts are preserved.
- [ ] **ADD-T09 — Add admin E2E smoke coverage.** Log in, load every page, perform one mutation per major resource, export data, and verify failed requests are visible.
- [ ] **ADD-T10 — Add public E2E coverage for reload/recovery.** Survey progress, token expiry, prior awards, canceled retries, network loss, and refresh should be covered.
- [ ] **ADD-T11 — Add accessibility automation.** Run Lighthouse/axe checks in CI and manually verify keyboard access, focus trapping, labels, live regions, and mobile navigation.
- [ ] **ADD-T12 — Add safe load-test guards.** Refuse non-staging hosts, validate setup responses, enforce timeouts, and report skipped/empty workloads as failures.

### Deployment and Operations

- [ ] **ADD-O01 — Add a deployment preflight.** Verify required secrets, selected Wrangler environment, pending migrations, API base, D1 schema level, R2 availability, and output directory before release.
- [ ] **ADD-O02 — Add a clean-build artifact check.** Reject bundles containing localhost URLs, development output, source maps, unexpected secrets, or excessive output size.
- [ ] **ADD-O03 — Add a separate development/preview D1 database.** Prevent remote development commands and tests from targeting production data.
- [ ] **ADD-O04 — Add monitoring for critical security and business invariants.** Alert on guest-token anomalies, no-survey spin attempts, auth failures, stock drift, failed exports, and admin privilege changes.
- [ ] **ADD-O05 — Add or correctly configure the supported deployment paths.** Make Cloudflare Pages the verified path or provide valid, separately tested Vercel configuration for each app and the API.

## Verification Already Completed

- [x] All 13 migrations applied successfully to a fresh temporary D1 database.
- [x] Forced TypeScript check passed for all 3 workspaces.
- [x] Forced lint passed for all 3 workspaces with zero warnings/errors.
- [x] Forced production builds passed: survey app 11 routes; admin app 15 routes.
- [x] API gate subset passed 46/46.
- [x] Default hardening test passed 18/18.
- [x] Optional stock-contention test passed 23/23, including the final-unit contention case.
- [x] Full browser survey journey completed through spin during the audit.
- [x] Admin login/dashboard loaded live local API data.
- [x] Both Cloudflare Pages Functions compiled successfully.
- [x] Worker dry-run packaging succeeded.

Passing build and smoke checks do not cover every security, migration, admin workflow, and data-integrity issue listed above.

## Audit Boundaries

- No production database, secret, or deployed-domain state was queried.
- Seeded credential/demo exposure and the remote migration ledger must be confirmed separately.
- Dependency directories were not manually reviewed line by line; package manifests, lockfiles, builds, and `npm audit` were checked.
- Generated `out/` and `.next/` content was inspected only for build/deployment verification.
