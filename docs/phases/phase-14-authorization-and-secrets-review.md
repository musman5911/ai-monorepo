# Phase 14: Authorization and secrets review

**Status:** In progress

## Goal

Every route is checked for the right role, and no secret is in the repository.

## Already in place (from Phase 0)

- Server-side farm scoping and the three roles exist. Legacy `admin` role compatibility remains in the review scope.
- The shared `muf-env.mjs` files are byte-identical and define canonical names plus legacy aliases for secrets.
- Backend auth middleware re-checks user status and resolves farm context. Initial source review also found app-specific differences in JWT fallback behavior, so production startup/configuration must be compared before making changes.

## Initial audit notes (2026-10-27)

- Added `tools/check-secrets.js`, which scans Git-tracked files for tracked `.env` files, private-key/certificate files, and recognizable credential patterns. Public `.env.example` MongoDB URI placeholders are explicitly tolerated.
- Fixed a production fail-open configuration: all three database modules now refuse `MEMORY_MODE` when `NODE_ENV=production`, preventing demo accounts/data from being served if the production MongoDB URI is missing. Agri also now refuses to generate a fallback JWT key in production.
- Exposed the scan as `npm run check-secrets`.
- The scan has not yet been executed against the owner's Windows checkout. Do not treat it as passing until the owner runs it after pulling.
- No secrets or live deployment settings were changed.

## Validation checkpoint (owner-run, 2026-10-27)

- `npm run check-secrets`: passed, 644 tracked paths.
- `npx vitest run tests/auth-production-config.test.ts`: passed, 4 tests.
- `npm test`: passed, 41 files / 332 tests.
- `npm run check-docs`: all phase documentation checks passed.
- `tools\\build-all.bat`: Dairy, Flock, and Agri builds passed.
- These are owner-provided Windows results. The latest public-route hardening commits have not yet been pulled or tested by the owner.

## Route findings and decisions (2026-10-27)

- Public `/cards/*` routes intentionally disclose the addressed worker/customer/supplier ledger to anyone possessing the URL. This behavior supports QR/shared cards, so login was not added blindly. All three card routers now set `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow, noarchive`, and `Referrer-Policy: no-referrer`; the per-router cap was reduced from 120 to 60 requests per 15 minutes. The link remains a bearer-style access mechanism; a future signed, revocable share-token migration is the stronger option because record IDs alone are not authorization.
- Agri `/cron/dispatch-report` now compares the shared secret using `crypto.timingSafeEqual` after checking equal byte lengths and prefers `X-Cron-Key` over the legacy query parameter. Flock `/cron/daily-summary` also accepts `X-Cron-Key` while retaining the existing query key for scheduler compatibility. Configure schedulers to send the secret in the header where possible because URLs are more likely to appear in logs.
- Flock cron success responses no longer return recipient email addresses or farm summary statistics to the caller.
- Cross-farm summary endpoints in Dairy, Flock, and Agri now prefer `X-Cross-Farm-Key`, compare secrets with `crypto.timingSafeEqual` after checking byte lengths, and retain the query-string key only for existing scheduler/client compatibility. Dairy and Agri CORS allowlists include the new header; Flock's CORS middleware reflects requested headers for configured origins.
- Agri's authenticated-by-secret cron success response now omits configured recipient addresses. The new regression tests cover this and cross-farm key comparison/header preference.
- Agri `/settings/location` was checked against frontend usage and intentionally remains public because the unauthenticated weather widget reads it. This was not changed.
- Added `tests/public-route-security.test.ts` to protect the new card privacy headers, rate limits, timing-safe cron comparison, header-based cron authentication, reduced Flock cron response, and the CORS headers required for cron-key requests.
- Follow-up source review found that Dairy and Agri accepted `X-Cron-Key` in the cron handler but did not include it in their explicit CORS allowlists (they only listed the older `X-Cron-Secret`). Added `X-Cron-Key` to both allowlists and a regression assertion. Flock uses the `cors` package default header reflection when no `allowedHeaders` list is configured, so it does not need an explicit entry.

## Route inventory checkpoint (2026-10-27)

- Added `docs/security/route-permission-inventory.md`, a module-by-module policy inventory for the route modules in Dairy, Flock and Agri, including public exceptions, owner-only operations, farm-scoped business data, scheduled jobs, webhooks and share-card bearer access.
- Added `tools/check-route-permissions.js` and `npm run check-route-permissions`. It fails if a `.js` route module under any of the three `backend/routes/` directories lacks a matching inventory entry or an app backend entry point is missing.
- The owner ran `npm run check-route-permissions` after pulling: passed, 46 actual route modules documented, imported by their server, and visibly mounted. The earlier 53 count included route-folder helper modules and was corrected. This inventory check is a coverage guard, not proof that every handler enforces the documented policy.
- Share-card risk is explicitly documented as accepted compatibility risk for existing QR/share links. Links expose the card payload to anyone holding the URL and are not individually revocable in the current ID-based design. A signed/revocable token migration remains recommended if private or revocable sharing becomes a requirement.

## Owner validation checkpoint (2026-10-27)

The owner pulled commit `3d366ac` and supplied these Windows CMD results (before the follow-up CORS correction below):

- `npm run check-route-permissions`: passes for 46 actual route modules documented, imported and visibly mounted.
- `npm run check-secrets`: passed, 647 tracked paths scanned.
- `npm test`: passed, 42 files / 341 tests.
- `npm run check-sync`: passed.
- `npm run check-ui`: passed.
- `npm run check-workbench`: passed, 23 source checks.
- `npm run check-farms`: passed, including farm isolation and Dairy breeding-event runtime checks.
- `npm run check-docs`: passed, all 22 phase files and links consistent.
- `tools\\build-all.bat`: Dairy, Flock and Agri production builds passed.
- `git status`: clean; branch up to date with `origin/muf-monorepo`.

These are owner-provided results. They validate the current automated suite and builds, not every route's role behavior. The route-module inventory uses baseline policies and includes a public-link risk acceptance; it does not prove handler-level authorization. Do not claim exhaustive authorization verification based solely on the inventory count.


## Follow-up source review (2026-10-27)

- A focused comparison of authentication middleware found that Agri's token resolver accepted a valid JWT for a user whose account had been deactivated, unlike Dairy and Flock. Updated Agri to reject missing or explicitly inactive users during token resolution, so protected requests lose access immediately even before token expiry.
- Added a regression assertion to `tests/auth-production-config.test.ts` for the Agri inactive-user guard.
- Commits: `d5a593e` (fix) and `f6f7fd2` (regression test). These commits are on `muf-monorepo`; the owner still needs to pull and run the test suite.
- Phase 14 remains **In progress**. The route inventory checker verifies module coverage only; the remaining endpoint-level role/farm-scope review and checker-strengthening work are not complete.


## Additional secret and route-mount review (2026-10-27)

- Source review found Telegram webhook path secrets were compared with ordinary string equality in Dairy, Flock and Agri. Dairy and Flock now use their existing equal-length, timing-safe helper; Agri now has the same protection. Missing webhook secrets continue to fail closed.
- Agri Telegram's scheduled endpoint now prefers `X-Cron-Key` to the legacy query parameter and compares it timing-safely, matching the other scheduled endpoints.
- Added regression assertions for all three Telegram webhook comparisons and Agri's cron header/secret behavior in `tests/public-route-security.test.ts`.
- Strengthened `tools/check-route-permissions.js`: it now checks that every route module has an inventory entry, is imported by its server, and is visibly mounted directly or included in Agri's `apiRouters` list. This is a mount-wiring check, not a proof of handler authorization.
- Corrected the Agri inventory to document the public location read as an exception within `routes/automations.js`; there is no separate Agri `routes/settings.js` module.
- New commits: `7a63247`, `93127ce`, `b069244`, `44b6040`, `a49f096`, `3687c78`, `c03e141`. The owner must pull and run validation before these newest changes are considered verified.


- Agri's `Setting` model is global, not farm-scoped. The automation settings, location mutation and manual trigger endpoints previously allowed managers through `requireAdmin`, so a manager assigned to one farm could change global configuration. These routes now require `ownerOnly`; the public location read remains intentionally available to the weather widget. Added a regression assertion in `tests/public-route-security.test.ts`.
- Server-entry-point review confirmed all three apps configure Helmet, request-body size limits and broad API rate limiting; login/signup/reset paths have stricter rate limiters in their auth implementations or mount configuration. The new mount checker now verifies imported route routers are visibly mounted, but it does not prove role correctness within each handler.


- Dairy and Flock Telegram cron handlers now accept `X-Cron-Key` with the legacy query parameter as fallback, using their existing timing-safe comparison helper. This removes the remaining header-compatibility gap in the Telegram scheduled endpoints.
- The route-mount checker now handles both default-export route imports and Agri's named `automationsRouter` export. It remains a static wiring check and must be validated by running `npm run check-route-permissions` in the owner's checkout.
- Additional commits on `muf-monorepo` include `4a3043e`, `cfa0e97`, `8041afc`, `d4fc5ab`, `9f01423`, `de95738`, `4e5f10c`, `76078aa`, and `f04d193`.

## Follow-up handler review (2026-10-27)

- Reviewed the shared farm router factory: farm listing is limited to the owner's full view or the requesting user's active assignments; create, rename, archive, restore and delete require owner authority. Farm deletion and backup/archive flows deliberately run unscoped only after owner authentication, because they must enumerate or move records across farm scopes.
- Reviewed the three auth/user-management implementations. User listing and management are role-gated; managers are limited to workers sharing an assigned farm, while role changes and owner administration remain owner-only. Flock user edits/deletes are owner-only.
- Found and fixed an assignment-boundary bug in Dairy and Agri: when a manager edited a worker's farm assignments, the endpoint silently dropped that worker's assignments in farms outside the manager's scope. The handlers now preserve out-of-scope assignments and apply submitted changes only to farms the manager controls. Added a regression assertion to `tests/public-route-security.test.ts`.
- Re-reviewed Agri global automation/location settings: all global writes and manual digest triggers require owner authority; the public location read is retained for the unauthenticated weather widget. Secret-authenticated scheduled jobs remain unscoped by design and fail closed when their secret is missing.
- This is source review plus regression coverage, not a local test run. The owner must pull the resulting commits and run the focused test and full validation commands below before the phase can be marked Done.

## Latest owner validation (2026-10-27)

The owner supplied the following results from the current Windows checkout after pulling the latest branch:

- `npx vitest run tests/public-route-security.test.ts`: passed, 1 file / 16 tests.
- `npm test`: passed, 42 files / 349 tests.
- `npm run check-route-permissions`: passed; 46 route modules are documented, imported and visibly mounted.
- `npm run check-secrets`: passed; 647 tracked paths scanned with no tracked .env files, private keys or recognized credential patterns.
- `npm run check-sync`: passed; shared MUF files, backend twins, environment names and listed invariants are in sync.
- `npm run check-farms`: passed, including the three apps' farm-scope checks and Dairy breeding-event runtime checks.
- `npm run check-docs`: passed.
- `tools\build-all.bat`: all three production builds passed.
- `git status`: clean; branch up to date with `origin/muf-monorepo`.

The latest supplied output does not show `npm run check-ui` or `npm run check-workbench`; neither is claimed for this checkpoint. This is owner-supplied evidence, not a command run independently in this editing session. Passing tests and the 46-module inventory/mount guard do not prove every handler enforces its intended role and farm scope.

## Additional handler audit finding (2026-10-27)

- Review of Dairy and Agri photo routes found that orphan detection and the direct-delete reference guard searched farm-scoped records only. An asset referenced from a different farm could therefore be misclassified as unreferenced while cleanup ran in the current farm context.
- Updated both apps' photo-asset services to inspect references under an explicit unscoped read, while keeping the asset list and actual delete operations within the authenticated farm context. Updated the direct photo-delete reference guard the same way. This prevents cross-farm references from being ignored without exposing other farms' records through the API.
- Added regression source-contract assertions in `tests/public-route-security.test.ts` for the cross-farm reference guard and farm-scoped asset models.
- Commits: `52fe5c2`, `ec9151b`, `f5589a7`, `352c9d1`, `de87aa8`.
- **Validation pending:** these latest commits have not been run in the owner's Windows checkout, and no independent runtime/test execution was available in this editing session. The wider handler-level review remains open; do not mark Phase 14 Done yet.

## Additional global-settings finding (2026-10-27)

- Dairy's `Meta` model is global rather than farm-scoped, but `PUT /api/settings/location` used the owner-or-manager guard. A manager assigned to one farm could therefore change the application-wide weather location. Changed this write to `ownerOnly`, added a regression assertion, and clarified the route inventory. Flock's location setting is stored in the farm-scoped `DataStore`, so it remains controlled within the selected farm.
- Commits: `341aa2c`, `57fdd32`, `0a94161`.
- **Validation pending:** the latest change and its regression test have not been run locally. Phase 14 remains In progress pending the broader handler audit and full validation.

## Inventory-to-handler consistency correction (2026-10-27)

- Cross-checking the Flock settings inventory against `routes/settings.js` showed the inventory incorrectly described `GET /location` as public. The actual handler requires `authRequired` and reads the farm-scoped `DataStore`; corrected the inventory and added a regression assertion so this mismatch is less likely to return.
- Commit: `905a422`; test assertion: `ffd1101`.
- Validation pending; this correction reinforces that inventory entries must be checked against actual route declarations, not copied assumptions.

## Additional Telegram link authorization finding (2026-10-28)

- The handler-level review found that all three Telegram `/link-code` routes accepted a client-supplied app-user ID after checking only that the user existed. A manager in one farm could therefore create a Telegram link code for a user assigned to a different farm.
- Dairy, Flock and Agri now require a selected farm before creating the code and verify that a non-owner target user is assigned to that farm. Owners retain the intended ability to link their account to the selected farm. The lookup returns a not-found response for out-of-farm users to avoid disclosing their existence.
- Added a source-contract regression test covering the farm-context and assignment guard in all three Telegram routers.
- Commits: `ae35f22`, `699fc69`, `6b728b9`, `a081f00`.
- Validation is pending in the owner's Windows checkout. This source-level fix does not close the full audit; link-code behavior and the remaining financial, labor, upload/deletion, scheduled-job and share-link boundaries still require continued review.

## Remaining manual-review limitation

Phase 14 remains **In progress**. The latest focused and full test suites, secret scan, route coverage check, sync/farm/docs checks and all three builds passed in the owner's checkout. Before marking the phase Done, complete the remaining handler-level role/farm-scope review and add focused regression tests for any gaps found. Do not treat route-module inventory or mount wiring as proof of authorization correctness. Real MongoDB, browser/phone and live deployment verification remain in Phases 19–21.

## Scope

- A written list of every route in the three backends with the role allowed (owner, manager, worker, public) and a test that fails if a route is added without an entry.
- Fix any route that is more open than it should be.
- A secret scan of the repository for keys, tokens and `.env` files (the repo is public).
- Basic abuse protection review: login rate limiting, request size limits, security headers.

## Out of scope

- No new features.

## Steps

1. Generate the route inventory from the code.
2. Review each route against the role table in `FARMS_AND_ROLES.md`.
3. Fix and test.
4. Add the secret scan.

## New command-line check

`npm run check-secrets` fails on tracked environment files, private-key/certificate files, and recognized credential patterns. `npm run check-route-permissions` fails when a JavaScript module under a backend `routes/` directory lacks a matching inventory entry, is not imported/mounted by its server, or an app backend entry point is missing.

## Command-line checks at the end of this phase

```
npm ci
npm test
npm run check-sync
npm run check-ui
npm run check-workbench
npm run check-farms
npm run check-docs
tools\build-all.bat
```
Run the build in each app that this phase touched (or `tools\build-all.bat` for all three). `npm run check-workbench-runtime` is optional and needs port 5000 free.

## Done checklist

- [x] A written module-by-module permission inventory exists, including explicit public exceptions and accepted share-card risk; the inventory coverage check fails if a route module is added without an entry. Handler-level role/farm behavior still requires code review and focused regression tests.
- [x] Fix identified authorization gaps; manager assignment edits now preserve worker assignments outside the manager's farm scope. Final verification is pending owner-run tests.
- [x] A secret scan of the repository for keys, tokens and `.env` files (owner-run: 647 tracked paths, passed).
- [x] Source-reviewed server entry points for security headers, request-size limits and broad API rate limiting, alongside stricter auth-flow rate limits.
- [x] The new command-line check above exists and passed for 46 actual router modules documented, imported and visibly mounted; the old 53 count included route-folder helpers.
- [x] The current-head standard checks and all three builds pass after the latest authorization fixes and regression assertions (owner-validated 2026-10-28; see the current-head validation checkpoint below).
- [x] `docs/PROGRESS.md`, `docs/ROADMAP.md` and `docs/phases/README.md` reflect the current phase status and remaining verification gate.

## Rules for whoever works on this phase

1. When work starts, set **Status** below to `In progress` and update the tables in `docs/PROGRESS.md` and `docs/phases/README.md`. When it ends, set `Done` and write the real command results in `docs/PROGRESS.md`.
2. Add at least one new command-line check for this phase and name it under **New command-line check**. A phase is not done without it.
3. Report only commands you actually ran, with what they printed. If you did not run something, say so.
4. This phase uses command-line tests only: no live websites, no real MongoDB, no browsers or phones. Nothing is postponed: if part of this phase can only be tested live, add it to the matching list in Phase 19, 20 or 21.
5. Ask the owner before removing any feature (the Flock Home Birds trims are already allowed).
6. Stay inside this phase's scope. If a shared MUF file changes, keep the three copies identical (`npm run check-sync`).
7. Keep the other two apps working: run all three builds even when only one app changed.


## Focused handler audit (2026-10-27)

The current source review covered the five requested risk groups:

- **Backup/restore/archive:** Dairy and Agri backup handlers use `ownerOnly` before entering unscoped execution. Flock backup uses an explicit `mufIsOwner` check before `mufRunUnscoped`. All three yearly-archive routers install owner authorization before unscoped operations. The shared archive workflow binds job lookup, snapshot reads, source deletion, and restore conflict checks to both `farmId` and job/record IDs.
- **Cross-farm object access:** existing farm-scope runtime tests cover forged `farmId`, read/update/delete isolation, assigned-farm constraints, bulk imports, and breeding-event isolation. The photo fix additionally scans references unscoped before deciding an asset is orphaned, while keeping the asset itself farm-scoped.
- **Photos/assets:** regression assertions check cross-farm reference discovery and the `PhotoAsset` farm field in Dairy and Agri. This is source-contract coverage; production Mongo behavior still depends on the farm-scope adapter and needs real-Mongo validation in the final testing phases.
- **Users/assignments:** all three auth middleware implementations re-read the backing user and reject inactive accounts. Manager assignment rules are covered by source assertions and farm-scope runtime checks for owner/manager/worker boundaries, including archived-farm access loss.
- **Cron/Telegram/public links:** cron and cross-farm shared keys use timing-safe comparisons and fail closed when secrets are not configured; Telegram webhook path secrets are checked timing-safely. Public cards remain intentionally bearer-link readable, with no-store/noindex/no-referrer and rate limiting; these controls do not make the URL private or revocable.

A focused test section checks owner-before-unscoped backup/archive middleware, archive farm/job binding, inactive-user rejection, and manager role boundaries.

## Closure criteria

Do not mark Phase 14 Done solely from source-string tests or a passing route inventory. The owner must run the updated suite on the pulled branch. Any remaining Mongo-backed or deployed behavior must be verified in the dedicated final-testing phases. Phase 15 stays Not started until that validation is recorded.


## Latest owner validation and test correction (2026-10-27)

The owner pulled commit `45e9ee2` and supplied Windows CMD results. `npm test` reported 42 files, 356 passed tests and one failed assertion (357 total). The only failure was in the new `active-user and farm-role enforcement` source-contract test: it expected Agri's middleware to contain `user.active === false`, while Agri's actual `resolveUser` rejects missing or explicitly inactive users with `user && user.active !== false ? user : null`. This was an incorrect test expectation, not evidence from this run of an authorization bypass. Corrected the assertion in commit `bab5870` to match the actual guard. **The corrected focused test and full suite are pending owner rerun; no passing result is claimed yet.**

The owner's other reported checks passed: route permission inventory (46 route modules), secret scan (647 tracked paths), sync checks, UI safety, workbench source checks (23), farm-scope and breeding-event checks, phase-doc checks, and all three production builds. `git status --short --branch` showed a clean working tree synced with `origin/muf-monorepo`. Those checks do not erase the failing test or prove all routes behaviorally secure. Phase 14 remains **In progress**; Phase 15 remains **Not started**.

## Latest owner validation and corrected assertion (2026-10-27)

After pulling the latest branch update, the owner supplied these Windows CMD results:

- `npx vitest run tests/public-route-security.test.ts`: passed, 1 file / 24 tests.
- `npm test`: passed, 42 files / 357 tests.
- `npm run check-docs`: passed, all 22 phase files, statuses, required sections and links consistent.
- `git status --short --branch`: clean working tree; `muf-monorepo` is up to date with `origin/muf-monorepo`.

The focused suite now includes the corrected Agri active-user source assertion and the expanded backup/archive, farm-role, settings and photo-reference checks. These results supersede the prior note that the corrected assertion was awaiting rerun. They do not establish that every endpoint has been behaviorally tested for every role and farm context. The latest output did not include fresh current-head results for the secret scan, route inventory/mount check, sync/UI/workbench/farm checks, or all three production builds; do not infer those from this run.

**Status remains In progress.** Complete the remaining handler-level review, add behavior-focused regression tests for confirmed gaps, run the full current-head validation gate, and only then consider closure. Phase 15 remains Not started.

## Phase 14 follow-up review (2026-10-28)

Reviewed the backup and archive boundaries across Dairy, Flock and Agri. Backup/restore routes are owner-only before unscoped operations; the shared yearly-archive handlers bind jobs, snapshots and source deletion/restoration to the selected farm ID. Found and fixed an Agri restore validation flaw: a present section with a `null` value was accepted, while the restore path interpreted it as an empty array and could wipe that collection. The validator now rejects null/non-array sections before snapshot or mutation. Added a regression source-contract test.

Commits: `bf1946d` (Agri restore validation), `5751685` (regression test). Owner-run validation is pending. The broader audit and current-head checks are still required; Phase 14 remains **In progress**, Phase 15 remains **Not started**.


## Phase 14 restore-validation follow-up (2026-10-28)

- The owner's latest Windows run exposed a brittle regression assertion: it compared the first textual occurrence of the validator with the first textual occurrence of the apply helper, which are function declarations rather than calls inside the manual restore handler. The route's manual restore call was already after validation; the test now scopes its ordering assertion to each route handler.
- Continued the restore audit across all three apps. Agri now validates its stored monthly auto-backup before applying it and rejects malformed auxiliary `farms`, `archiveJobs`, and `archiveRecords` sections as well as malformed business collections. Dairy now rejects malformed record arrays and farm sections before both manual and automatic restores. Flock now validates the payload, farm rows, per-farm bucket rows, batch collections, archive sections, and image-section shape before acquiring restore locks or mutating records; manual and automatic restore use the same validator.
- Added regression source-contract assertions for manual and automatic restore validation ordering in all three apps.
- GitHub branch commits: `8456eb7` (Agri auto-restore validation), `e06f911` (Agri test), `94fbce3` (Dairy validation), `eed8209` (Flock validation), `dc886f2` and `63813b8` (restore tests/assertion correction).
- **Validation pending:** the owner has not pulled these newest commits or rerun the focused test/full suite. The last supplied local result was 357 passed and one failed test, so it must not be described as green. Phase 14 remains **In progress** and Phase 15 remains **Not started**.


## Phase 14 current-head owner validation (2026-10-28)

The owner pulled the latest branch update (e44ed46 to 8c6ff58) and supplied Windows CMD results. The restore-validation regression fixes are now validated in the local checkout:

| Command/check | Result |
|---|---|
| `npx vitest run tests/public-route-security.test.ts` | Passed: 1 file / 26 tests |
| `npm test` | Passed: 42 files / 359 tests |
| `npm run check-route-permissions` | Passed: all 46 route modules documented, imported by their server and visibly mounted |
| `npm run check-secrets` | Passed: 647 tracked paths scanned; no tracked .env files, private keys or recognized credential patterns |
| `npm run check-sync` | Passed: shared app files, backend twins, environment names and listed invariants in sync |
| `npm run check-ui` | Passed: all MUF UI safety checks |
| `npm run check-workbench` | Passed: 23 source checks |
| `npm run check-farms` | Passed: Agri, Flock and Dairy farm-scope checks plus Dairy breeding-event runtime checks |
| `npm run check-archive` | Passed: Dairy, Flock and Agri archive checks; Node emitted non-fatal module-type warnings |
| `npm run check-docs` | Passed: all 22 phase files, statuses and links consistent |
| `tools\build-all.bat` | Passed: Dairy, Flock and Agri production builds |
| `git status --short --branch` | Clean working tree; muf-monorepo aligned with origin/muf-monorepo |

This confirms the current restore-validation changes pass the reported source-contract tests, repository checks, archive checks and production builds. It does not complete the handler-by-handler authorization audit: the route inventory and source-contract assertions do not behaviorally test every sensitive endpoint against every role and farm context. Continue the remaining handler review and add behavior-focused regression coverage for confirmed gaps before considering Phase 14 complete. Phase 14 remains **In progress**; Phase 15 remains **Not started**.


## Handler-level audit follow-up: linked-record validation (2026-10-28)

The next source-review pass examined Dairy health, milk and expense writes, alongside Agri finance, inventory, labor and task handlers, the three user-management route modules, and Flock's farm-scoped DataStore/Image models and upload handlers.

**Confirmed gap fixed:** Dairy accepted client-supplied cow IDs on health and milk writes without first confirming that the cow exists in the authenticated farm. Milk also accepted a buyer ID without verifying that the buyer belongs to that farm. Expense create/update accepted cow and supplier IDs without validating those links. Model-level farm scoping protects the primary record itself, but it does not by itself prove a linked ID is valid; invalid cross-farm links could produce inconsistent or misleading records. Added selected-farm checks before writes, including validating every row in bulk health/milk requests before the first mutation.

- `dairy_farm/backend/routes/health.js`: validates cow links for single and bulk create/update.
- `dairy_farm/backend/routes/milk.js`: validates cow and buyer links for single and bulk create/update.
- `dairy_farm/backend/routes/expenses.js`: validates cow and supplier links for create/update.
- `tests/public-route-security.test.ts`: added source-contract regression checks for the new validations.

Commits: `4c296a6` (health links), `f09430b` (milk links), `7b5f73e` (expense links), `b89f9aa` (regression tests).

**Validation is pending.** These changes were committed directly to the branch through GitHub; they have not yet been pulled and executed in the owner's Windows checkout. This source-contract coverage is not a substitute for behavior-level HTTP tests or the rest of the audit. The remaining review still includes complete finance/inventory/labor/task mutation paths, user lifecycle and role changes, photo deletion/ownership, and Telegram/cron/public-share boundaries. Phase 14 remains **In progress**; Phase 15 remains **Not started**.


## Owner lifecycle safeguard (2026-10-28)

A further review of Dairy user lifecycle handling found that deleting a target account did not protect the last active owner. The edit path already had owner-safety checks in the broader lifecycle flow, and Agri/Flock protect the last active owner, but Dairy's delete handler could remove the final owner and lock out administration. Added a guard that checks for another active owner before deletion and a regression source-contract assertion.

Commits: `3e2881f` (guard), `5977efb` (regression test). Validation is pending owner pull/run. Phase 14 remains **In progress**; Phase 15 remains **Not started**.

## Handler-level audit follow-up: lineage and Agri operational links (2026-10-28)

Continued the source-level handler review for client-supplied IDs that connect records across farms.

- Dairy cow create/update now validates mother and farm-sire references against the authenticated farm before writing, preventing invalid cross-farm lineage links.
- Agri finance create/update now validates crop_id as well as field and crop-cycle references. Bulk finance already performed crop checks, but the single-record validator did not.
- Agri task create/update now validates crop and inventory references and rejects invalid inventory quantities. Bulk task import already had link checks; the single-record handlers lacked equivalent validation.
- Agri attendance create/update now validates optional crop references against the authenticated farm.
- tests/public-route-security.test.ts adds source-contract regression checks for the above ordering and guards.
- The Dairy archive integration fixture now uses the cow ID returned by /api/cows; the API generates IDs server-side, so the previous fixture's supplied _id was not the ID actually persisted and caused the milk link check to fail.

Commits: a4a9fb5, a8c3e53, 8a1cd22, 07e57fb, a754185, 13a9cef.

**Validation pending.** Pull these changes and rerun the focused security tests, full suite, farm and archive checks, route/secrets/docs checks, and production builds. The archive fixture correction has not yet been verified locally. This is still a source-level audit with source-contract tests, not a complete behavioral test of every endpoint and role/farm combination. User management, remaining finance/inventory/labor/task mutation paths, photo deletion authorization, Telegram/cron/public-share boundaries, and scheduled jobs still require continued review. Phase 14 remains In progress; Phase 15 remains Not started.


## Handler audit follow-up: wage posting and farm image delivery (2026-10-28)

Reviewed financial/labor mutation handlers, user-management boundaries, farm photo routes, Telegram webhook/link flows, scheduled endpoints, and the documented public share-card routes.

- Agri and Dairy wage-posting handlers previously accepted any month string of length seven or more. In Agri, the string was interpolated into a database regular expression, so malformed input could select attendance outside the intended month and post it to the ledger. Both handlers now require a strict `YYYY-MM` month with month 01-12 before reading unposted attendance; Agri's query now anchors to the month separator.
- Flock image upload now accepts only JPEG, PNG, and WebP, verifies the bytes' file signature against the declared MIME type, and rejects mismatches before storage.
- Flock image responses now use `Cache-Control: private, no-store`. The previous public one-year cache directive was inappropriate for images behind farm authorization because shared caches must not reuse a farm-authorized response.
- Added source-contract regression assertions for the month validation, image signature checks, farm-scoped image lookup, and private cache behavior.
- The reviewed share-card routes remain intentionally public bearer links. Existing no-store/noindex/no-referrer and rate-limit protections reduce accidental exposure but do not make these cards private or revocable.
- User assignment handlers in Agri and Dairy preserve a worker's assignments outside the manager's farm scope; Flock user mutations are owner-only. Telegram link-code handlers now require a selected farm and validate target-user assignment. Cron/webhook secret checks use timing-safe comparison and fail closed when the secret is missing.

Commits on `muf-monorepo`: `6e51a2b` (Flock image hardening), `34c26cc` (image regression tests), `ecf364d` / `7eb31aa` (initial wage month validation), `75e9551` / `32b2985` (regex correction), and `ff5ba56` (wage validation tests).

**Validation pending on the owner's Windows checkout.** These commits were made after the last owner-reported green run, so the prior 368-test/build results do not validate this new code. Run the focused security test, full suite, farm/archive checks, route/secret/sync/UI/workbench/docs checks, and all three production builds after pulling. Phase 14 remains **In progress** until current-head validation and the remaining endpoint review are complete; Phase 15 remains **Not started**.


## Owner validation and Flock upload syntax correction (2026-10-28)

The owner pulled branch head `bf558e4..6a9760a` and reported:

- `npx vitest run tests/public-route-security.test.ts`: passed, 38 tests.
- `npm test`: passed, 42 files / 371 tests.
- `npm run check-route-permissions`, `check-secrets`, `check-sync`, `check-ui`, `check-workbench`, and `check-docs`: passed.
- `tools\\build-all.bat`: all three production builds passed.
- `npm run check-farms`: failed when the Flock backend tried to load `flock_farm/backend/routes/uploads.js`.
- `npm run check-archive`: Dairy archive checks passed, then the Flock archive check failed for the same startup error.
- `git status --short --branch`: clean and aligned with `origin/muf-monorepo`.

The failure was a missing closing parenthesis in the PNG signature check inside `detectImageContentType`. This is a backend JavaScript syntax error; the frontend production build and source-text regression tests did not catch it. Corrected the condition and added a source-contract assertion for the closing syntax.

**Validation still required:** pull the new fix, then rerun `npx vitest run tests/public-route-security.test.ts`, `npm test`, `npm run check-farms`, `npm run check-archive`, `npm run check-docs`, and `tools\\build-all.bat`. Also rerun `npm run check-route-permissions`, `npm run check-secrets`, `npm run check-sync`, `npm run check-ui`, and `npm run check-workbench` for a current-head checkpoint. Do not mark Phase 14 Done until these checks pass and the remaining handler-level authorization audit is complete. Phase 15 remains Not started.


## Phase 14 current-head validation after Flock upload fix (2026-10-28)

The owner pulled branch update `6a9760a..118f730` and supplied Windows CMD output for the current head:

| Command/check | Result |
|---|---|
| `npx vitest run tests/public-route-security.test.ts` | Passed: 1 file / 38 tests |
| `npm test` | Passed: 42 files / 371 tests |
| `npm run check-farms` | Passed: Agri, Flock and Dairy farm-scope checks plus Dairy breeding-event runtime checks |
| `npm run check-archive` | Passed: Dairy, Flock and Agri archive checks; Node emitted non-fatal module-type warnings |
| `npm run check-route-permissions` | Passed: 46 route modules documented, imported by their server and visibly mounted |
| `npm run check-secrets` | Passed: 647 tracked paths scanned; no tracked .env files, private keys or recognized credential patterns |
| `npm run check-sync` | Passed: shared MUF files, backend twins, environment names and listed invariants in sync |
| `npm run check-ui` | Passed: all MUF UI safety checks |
| `npm run check-workbench` | Passed: 23 source checks |
| `npm run check-docs` | Passed: all 22 phase files, statuses, required sections and links consistent |
| `tools\\build-all.bat` | Passed: Dairy, Flock and Agri production builds |
| `git status --short --branch` | Clean working tree; local `muf-monorepo` is up to date with `origin/muf-monorepo` |

The Flock upload signature-check syntax error is fixed on the current branch, and the focused test, full suite, farm/archive runtime checks, repository safety checks and all three production builds now pass in the owner's checkout. The workbench check explicitly notes that it is a source-safety check, not a TypeScript build or browser review. Archive scripts emitted non-fatal Node module-type warnings.

**Phase status remains In progress.** These results validate the current automated checks and builds but do not establish that every sensitive endpoint has been behaviorally tested for every role and farm context. Continue the handler-level authorization review, add focused behavior-level tests for confirmed gaps, and only close the phase once the remaining audit findings and acceptance criteria are addressed. Phase 15 remains Not started.


## Additional handler-level source review (2026-10-28)

Reviewed the current branch implementations for Agri/Dairy/Flock authentication and user management, Telegram webhook/link-code flows, scheduled email/summary endpoints, Flock image upload/read/delete, Agri inventory and task/finance/labor writes, Dairy labor writes, Flock batch destructive operations, and the three backup/archive route guards.

Checks made in this pass:
- User creation and mutation paths apply role restrictions; manager operations are constrained to workers and farm assignments within their authority, while Flock user mutation routes require owner authority. Owner lifecycle safeguards are present in the reviewed delete paths.
- Telegram link creation requires a selected farm and validates target-user assignment; webhook and cron secrets use timing-safe comparison and missing secrets fail closed. Legacy query-string secret fallback remains for scheduler compatibility and should be migrated to headers where possible.
- Flock image access resolves the stored image's farm before authentication, queries storage with the authenticated farm ID, verifies stored Cloudinary URLs against HTTPS and the expected hostname, and sends private/no-store cache headers. Upload MIME types are checked against file signatures.
- Agri inventory, finance, tasks and Dairy labor mutation routes reviewed here have authentication/role middleware; Agri task and finance linked-record checks and labor month validation are already covered by regression assertions.
- Backup and archive routes use explicit owner-only guards before entering unscoped execution contexts. Flock batch import/wipe operations are admin-role-gated and operate through the farm-scoped model/data context.

No additional confirmed authorization defect was established from these reviewed snippets, so no speculative code changes were made. This is a source-level review, not runtime proof of all role/farm combinations. The next review pass must cover the remaining route handlers and strengthen behavior-level coverage where current tests only assert source text. The accepted public bearer-card disclosure remains a documented compatibility risk, not a private/revocable sharing model.

**Phase 14 remains In progress.** Do not close it solely on this source review; closure still requires the complete remaining route review, regression coverage for any discovered gaps, and owner-run validation after any new code changes. Phase 15 remains Not started.


## Confirmed Flock cross-farm image deletion and reference gap (2026-10-28)

The continued handler review found a concrete cross-farm boundary defect in Flock: the Image model is not wrapped by the shared farm-scoped model helper, but batch cleanup and orphan collection had relied on an assumed automatic scope. Batch import/wipe used `Image.deleteMany({ kind: 'batch' })`, and per-path/orphan cleanup looked up or deleted image IDs without an explicit farm predicate. Batch create/edit/gallery handlers also accepted image paths without confirming that the referenced image belonged to the selected farm.

Fixed on `muf-monorepo`:
- Batch import and wipe now require a single selected farm and delete only `Image` rows matching both `kind: 'batch'` and that farm ID.
- Batch image cleanup now requires the active farm ID and uses the same farm-scoped filter for image lookup and deletion.
- Batch create, edit and gallery attachment validate that image IDs resolve to a batch image in the selected farm.
- Orphan image collection now requires the selected farm and applies an explicit farm predicate to image lookup/deletion.
- Added three source-contract regression tests covering scoped bulk cleanup, scoped path cleanup, and rejection of cross-farm image references.
- Updated the route permission inventory to call out that Flock Image operations require explicit farm predicates.

Commits: `7469dfe` (batch image scoping), `181ee01` (orphan cleanup scoping), `4de6a48` (regression tests), `f1cf04d` (inventory).

**Validation pending:** these changes were made after the owner's last green checkout. The focused tests and full suite, farm/archive runtime checks, repository safety checks and all three production builds must be rerun after pulling. This is a confirmed source-level defect and a targeted regression guard, but the new tests are source-contract checks rather than full HTTP tests. Phase 14 remains **In progress**; Phase 15 remains **Not started**.


## Owner validation after cross-farm image fixes (2026-10-28)

The owner supplied a fresh Windows CMD run from the branch after pulling the latest changes. Results:

| Command/check | Result |
|---|---|
| `npx vitest run tests/public-route-security.test.ts` | Passed: 1 file / 41 tests |
| `npm test` | Passed: 42 files / 374 tests |
| `npm run check-farms` | Passed: Agri, Flock and Dairy farm-scope checks plus Dairy breeding-event runtime checks |
| `npm run check-archive` | Passed: Dairy, Flock and Agri archive checks; Node emitted non-fatal module-type warnings |
| `npm run check-route-permissions` | Passed: 46 route modules documented, imported by their server and visibly mounted |
| `npm run check-secrets` | Passed: 647 tracked paths scanned; no tracked .env files, private keys or recognized credential patterns |
| `npm run check-sync` | Passed: shared MUF files, backend twins, environment names and listed invariants in sync |
| `npm run check-ui` | Passed: all MUF UI safety checks |
| `npm run check-workbench` | Passed: 23 source checks |
| `npm run check-docs` | Passed: all 22 phase files, statuses, required sections and links consistent |
| `tools\\build-all.bat` | Passed: Dairy, Flock and Agri production builds |
| `git status --short --branch` | Clean working tree; local `muf-monorepo` is up to date with `origin/muf-monorepo` |

This current-head run validates the recent Flock image-boundary and wage-month regression changes. It also confirms that the backend runtime checks now start and complete. The archive scripts' module-type warnings are non-fatal.

## Handler audit disposition after current-head validation (2026-10-28)

The focused source review covered user/role assignment boundaries, Telegram link and webhook flows, scheduled secret-authenticated jobs, public share-card behavior, photo upload/read/delete and orphan cleanup, Agri finance/task/labor linked-record validation, Dairy labor posting, Flock batch image references and destructive operations, and owner-only backup/archive operations. Confirmed defects found during this audit were fixed and regression guards were added, including manager assignment preservation, cross-farm Telegram link prevention, linked-record validation, wage month validation, private image caching/MIME-signature checks, and explicit Flock image farm predicates.

The share-card routes remain an explicitly accepted public bearer-link risk. They are not account-bound, private, or individually revocable. Query-string secret compatibility also remains for existing schedulers, with headers preferred.

**Closure decision: Phase 14 remains In progress.** The green current-head suite and source-contract assertions are not equivalent to behavioral authorization tests across every role/farm combination, and this review has not established exhaustive handler-by-handler runtime coverage for every route in all three apps. Do not mark Done or start Phase 15 on the strength of green builds alone. The remaining closure task is a final route-by-route review of handlers not specifically covered above, with focused behavioral tests for any uncovered boundaries, followed by another current-head validation if code changes are made. Real MongoDB, browser/device and live-deployment checks remain assigned to Phases 19–21.
