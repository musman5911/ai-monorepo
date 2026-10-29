# Progress

Where the project stands, in one place. The detailed plan for each phase is in `docs/phases/`; the old dated log is kept unchanged in `docs/archive/`.

Last updated: 2026-10-29 (Phase 17 complete for command-line scope; Phase 18 documentation/handoff started).

**Honesty rule:** a result is written down only if the command was actually run and its output was seen. "Built" is not the same as "verified": command-line checks do not prove browser behavior or real-MongoDB behavior; those are checked in Phases 19 to 21.

## Phases

| Phase | What | Status | File |
|---|---|---|---|
| 0 | Done and verified | Done | [phase-00-done-and-verified.md](phases/phase-00-done-and-verified.md) |
| 1 | Super Admin: owner only, per-farm summaries | Done | [phase-01-super-admin-owner-only.md](phases/phase-01-super-admin-owner-only.md) |
| 2 | Dairy breeding events: server | Done | [phase-02-dairy-breeding-events-server.md](phases/phase-02-dairy-breeding-events-server.md) |
| 3 | Dairy breeding events: screens | Done | [phase-03-dairy-breeding-screens.md](phases/phase-03-dairy-breeding-screens.md) |
| 4 | Dairy calves and lineage | Done | [phase-04-dairy-calves-lineage.md](phases/phase-04-dairy-calves-lineage.md) |
| 5 | Agri fields and crop cycles: server | Done | [phase-05-agri-fields-cycles-server.md](phases/phase-05-agri-fields-cycles-server.md) |
| 6 | Agri fields and crop cycles: screens | Done | [phase-06-agri-fields-cycles-screens.md](phases/phase-06-agri-fields-cycles-screens.md) |
| 7 | Telegram bot and daily summary per farm | Done | [phase-07-telegram-daily-summary-per-farm.md](phases/phase-07-telegram-daily-summary-per-farm.md) |
| 8 | Photo storage adapter | Done | [phase-08-photo-storage-adapter.md](phases/phase-08-photo-storage-adapter.md) |
| 9 | Cloudinary photo store | Done | [phase-09-cloudinary-store.md](phases/phase-09-cloudinary-store.md) |
| 10 | Smaller downloads and faster screens | Done | [phase-10-bundle-size-performance.md](phases/phase-10-bundle-size-performance.md) |
| 11 | Yearly archive for old records: server | Done | [phase-11-yearly-archive-server.md](phases/phase-11-yearly-archive-server.md) |
| 12 | Yearly archive: screens | Done | [phase-12-yearly-archive-screens.md](phases/phase-12-yearly-archive-screens.md) |
| 13 | Dependency security fixes | Done | [phase-13-dependency-security.md](phases/phase-13-dependency-security.md) |
| 14 | Authorization and secrets review | Done | [phase-14-authorization-and-secrets-review.md](phases/phase-14-authorization-and-secrets-review.md) |
| 15 | MU Farms: products and publish switch | Done | [phase-15-mu-farms-product-data.md](phases/phase-15-mu-farms-product-data.md) |
| 16 | MU Farms: public shop | Done | [phase-16-mu-farms-public-shop.md](phases/phase-16-mu-farms-public-shop.md) |
| 17 | Automatic command-line checks on GitHub | Done | [phase-17-automatic-checks-ci.md](phases/phase-17-automatic-checks-ci.md) |
| 18 | Documentation and handoff | In progress | [phase-18-documentation-and-handoff.md](phases/phase-18-documentation-and-handoff.md) |
| 19 | Final testing A: real MongoDB | Not started | [phase-19-final-testing-database.md](phases/phase-19-final-testing-database.md) |
| 20 | Final testing B: browser and phones | Not started | [phase-20-final-testing-browser-and-phones.md](phases/phase-20-final-testing-browser-and-phones.md) |
| 21 | Final testing C: live deployment and sign-off | Not started | [phase-21-final-testing-live-and-signoff.md](phases/phase-21-final-testing-live-and-signoff.md) |

## Phase 7 start (2026-10-26)

The owner approved Phase 7. Implemented farm-bound Telegram link codes and chat links, fail-closed handling for legacy links without `farmId`, MUF single-farm execution for linked webhooks, per-farm scheduled Telegram summaries/settings, and farm-access filtering for manual summary sends in all three backends. Dairy daily-summary email sends farm-scoped messages and restricts manual sends to the selected/assigned farms. Added identical `backend/muf-telegram-farms.mjs` twins, registered them in `tools/check-muf-sync.js`, and added `tests/telegram-farm-scope.test.ts`.

**Owner-reported verification (Windows CMD, 2026-10-26):** focused Agri screen tests passed (4/4); `npm test` passed (30 files, 276 tests); `npm run check-sync`, `npm run check-farms`, `npm run check-docs`, `npm run check-ui`, and `npm run check-workbench` passed; `tools\\build-all.bat` built Dairy, Flock and Agri successfully. The 12 Telegram farm-scope tests passed within the full suite. The monthly-path audit found Dairy's separate monthly email is a full-database backup snapshot intended for off-database recovery, so it intentionally includes all farms and is sent to one full-role admin; it is not a farm report. The daily summary email is farm-scoped, and no separate monthly report job was found in the audited email/backup paths.

Phase 7 is **Done for command-line scope**. These are results supplied by the owner, not commands independently executed in this editing session. `npm ci` and optional `npm run check-workbench-runtime` were not run. Real MongoDB, browser/phone, and live deployment verification remain in Phases 19–21.

Audit focus: preserve existing webhook secret validation and current bot commands; trace each app's farm context and data stores before changing record writes, daily summary and monthly email flows. Required regression: farm B chat writes only to farm B, an unlinked chat creates nothing, and farm A summary excludes farm B data.

## Phase 12 final verification (2026-10-26; Windows CMD output supplied by owner)

Phase 12, Yearly archive: screens, is **Done for command-line scope**. The owner supplied passing results after pulling the translation and workflow review fixes:

| Command/check | Result |
|---|---|
| `npx vitest run tests/archive-screens.test.ts` | Passed: 1 file, 8 tests |
| `npm test` | Passed: 40 files, 328 tests, 0 failures |
| `npm run check-sync` | Passed: all three app twins and shared invariants |
| `npm run check-ui` | Passed: all MUF UI safety checks |
| `npm run check-workbench` | Passed: 23 source checks |
| `npm run check-farms` | Passed: all farm-scope checks and Dairy breeding-event runtime checks |
| `npm run check-docs` | Passed: all phase docs, status indexes and links |
| `tools\\build-all.bat` | Passed: Dairy, Flock and Agri production builds |
| `git status` | Clean working tree; branch up to date with `origin/muf-monorepo` |

The focused test verifies owner gating, export-before-execute marker checks, exact farm/job confirmation, restore and archived-record view paths, supported collection choices, Urdu dictionary coverage, and byte-identical archive panels. The UI workflow review also checked stale confirmation clearing when farm/collection/retention changes and kept archived records in an explicit separate report view rather than merging them into active totals.

These are owner-supplied Windows checkout results, not commands independently executed in this editing session. No live MongoDB, browser/phone, or deployment verification is claimed; those remain in Phases 19–21. The initial pasted `\`\`cmd`` token was accidentally entered as a command and produced a harmless “not recognized” message; it was not part of the test suite.



## Phase 13 start (2026-10-26)

Phase 13 is **In progress**. Added `tools/check-audit.js` and exposed it as `npm run check-audit`. The checker explicitly audits all seven npm package sets (root tools, Dairy backend/client, Flock backend/client, Agri backend/frontend) with `npm audit --omit=dev --audit-level=high`; it fails if a package manifest/lockfile is missing, npm cannot run, or an audit reports a high/critical production issue. The checker and documentation have been committed to `muf-monorepo`.

**Verification limitation:** this editing session can update repository files but cannot run npm against the registry or execute the Windows checkout. No current audit result, dependency remediation, test result, or build result is claimed yet. The historical audit counts above are from 2026-10-24 and must not be treated as current. After pulling, run `npm run check-audit` and share its full output; use those live results to make targeted lockfile/package changes, without `npm audit fix --force` or guessed version bumps.


## Phase 14 start (2026-10-27)

Phase 14, Authorization and secrets review, is **In progress**. Initial repository review covered the deployment guide, shared environment loader, production start configuration, and authentication middleware in all three backends. Existing safeguards include production JWT-secret requirements in Dairy/Flock, farm-context middleware, user-active checks, Helmet headers, request limits, and rate limiting; exact behavior differs between apps and needs route-by-route verification.

Added `tools/check-secrets.js` and the root `npm run check-secrets` command. It checks Git-tracked paths for tracked `.env` files, private-key/certificate files, and common credential patterns, with explicit allowance for documented MongoDB placeholders in public `.env.example` templates. The initial code review also found and fixed production fallbacks: all three apps now refuse `MEMORY_MODE` in production, and Agri refuses to generate a local JWT fallback key in production. Added `tests/auth-production-config.test.ts` to guard these source contracts. **Tests and the secret scan have not been run in the owner's Windows checkout yet.** Full route inventory and permission tests are still pending. No live secrets, databases, or deployments were accessed or changed.


## Phase 14 update (2026-10-27)

Owner validation of the initial security checkpoint passed: secret scan (644 tracked paths), 4 production-configuration tests, full suite (41 files / 332 tests), docs check, and all three builds. Further route review added public-card privacy headers and reduced per-card-router limits (120 to 60 per 15 minutes) in Dairy/Flock/Agri; timing-safe Agri cron-secret comparison with header preference; header support for Flock cron; smaller Flock cron responses; timing-safe cross-farm summary key checks with `X-Cross-Farm-Key` preference in all three servers; and removal of configured recipient addresses from Agri cron responses. Added regression coverage in `tests/public-route-security.test.ts`. These changes are pushed but require owner pull/test/build validation. Full route-by-route role and farm-scope inventory remains incomplete, so Phase 14 remains In progress.


## Phase 14 route inventory checkpoint (2026-10-27)

Added `docs/security/route-permission-inventory.md` covering the route modules in Dairy, Flock and Agri, their baseline role/farm-scope policies, public exceptions, scheduled jobs, webhook expectations and the accepted compatibility risk for public share-card bearer links. Added `tools/check-route-permissions.js` and `npm run check-route-permissions`; the command checks that every JavaScript module in each backend `routes/` directory has a matching inventory entry and that all three backend entry points exist. The public share-link policy is now explicit: the URL grants read access to its payload, it is not account-bound or individually revocable in the current design, and privacy headers/rate limits are only defense-in-depth. Signed, revocable tokens are recommended if the product requires private/revocable sharing.

**Earlier owner validation (2026-10-27):** the owner ran `npm run check-route-permissions` (46 actual route modules documented, imported and visibly mounted), `npm run check-secrets` (647 tracked paths), `npm test` (42 files / 341 tests at that checkpoint), `npm run check-sync`, `npm run check-ui`, `npm run check-workbench` (23 checks), `npm run check-farms`, `npm run check-docs`, all three builds, and `git status` (clean, branch synced). These were valid results for that checkout, but they do not prove every handler's authorization.


**Phase 14 follow-up source review (2026-10-27):** after the owner validation checkpoint above, source inspection found a CORS mismatch: Dairy and Agri cron handlers accepted `X-Cron-Key`, but their explicit CORS allowlists only named the legacy `X-Cron-Secret`. Added `X-Cron-Key` to both allowlists and added regression coverage in `tests/public-route-security.test.ts`. Flock's CORS middleware uses the cors package default allowed-header reflection. This follow-up change has been pushed but has **not yet been run in the owner's checkout**; the earlier 341-test result predates it. Phase 14 remains In progress while the route-level role/farm-scope audit continues.


**Latest owner validation (2026-10-27):** `npm test` passed (42 files / 347 tests), `npm run check-docs` passed, `tools\\build-all.bat` passed for Dairy, Flock and Agri, and `git status` was clean with the branch up to date. These results were supplied before the latest manager farm-assignment boundary fix and its regression assertion. The current branch head must be pulled and retested before Phase 14 can be marked Done. Phase 14 remains **In progress**.

## Phase 14 current-head validation (2026-10-27; owner-supplied Windows CMD output)

The owner pulled the current muf-monorepo branch and ran the security-focused and standard command-line checks. Results:

| Command/check | Result |
|---|---|
| `npx vitest run tests/public-route-security.test.ts` | Passed: 1 file, 16 tests |
| `npm test` | Passed: 42 files, 349 tests |
| `npm run check-route-permissions` | Passed: 46 route modules documented, imported and visibly mounted |
| `npm run check-secrets` | Passed: 647 tracked paths scanned; no tracked .env files, private keys or recognized credential patterns found |
| `npm run check-sync` | Passed: all three apps' shared files, backend twins, environment names and listed invariants in sync |
| `npm run check-farms` | Passed: Agri, Flock and Dairy farm-scope checks plus Dairy breeding-event runtime checks |
| `npm run check-docs` | Passed: all 22 phase files, statuses and links consistent |
| `tools\build-all.bat` | Passed: Dairy, Flock and Agri production builds |
| `git status` | Clean working tree; branch up to date with `origin/muf-monorepo` |

These results validate the current automated tests, static inventory/mount coverage, secret scan, farm-scope checks and builds reported in the supplied CMD output. `npm run check-ui` and `npm run check-workbench` were not shown in this latest run and are not claimed here. The route inventory checker does not prove every handler's authorization. Phase 14 remains **In progress** until the remaining handler-level role/farm-scope review is complete. Real MongoDB, browser/phone and live deployment verification remain in Phases 19–21.


## Phase 14 handler audit follow-up (2026-10-27)

Repository source review identified a cross-farm photo-reference issue in Dairy and Agri: orphan discovery and direct photo deletion checked references only in the current farm scope. A photo referenced by another farm could be incorrectly considered unreferenced. Updated the photo-asset services and direct-delete guards to check references across farms in a private unscoped read, while keeping asset enumeration and deletion farm-scoped. Added regression source-contract assertions to `tests/public-route-security.test.ts`.

Commits on `muf-monorepo`: `52fe5c2`, `ec9151b`, `f5589a7`, `352c9d1`, `de87aa8`, `98eb24e`.

**Validation status:** changes are committed to the GitHub branch, but the new tests and standard checks have not yet been executed in the owner's Windows checkout. No test pass or build pass is claimed for these commits. Phase 14 remains **In progress** because this is one finding from the handler audit, not proof that all 46 route modules have been behaviorally verified. The latest required local gate includes `npm test`, `npm run check-route-permissions`, `npm run check-secrets`, `npm run check-sync`, `npm run check-ui`, `npm run check-workbench`, `npm run check-farms`, `npm run check-docs`, and `tools\\build-all.bat`.


Additional handler-review finding (2026-10-27): Dairy's `PUT /api/settings/location` wrote to global `Meta` settings but allowed managers through the owner-or-manager guard. Changed it to owner-only and added regression coverage; the route inventory now states the policy. Flock location settings remain farm-scoped through `DataStore`. Commits: `341aa2c`, `57fdd32`, `0a94161`, `c62f341`. Validation is pending in the owner's Windows checkout. Phase 14 remains In progress.


A further inventory cross-check found the Flock `GET /api/settings/location` handler is authenticated and reads the selected farm's `DataStore`, despite the inventory describing it as public. Corrected the policy to authenticated + farm-scoped and added a regression assertion. Commits: `905a422`, `ffd1101`, `4e55328`. Tests remain unrun for these newest commits; Phase 14 is still In progress.

## Phase 14 latest owner validation (2026-10-27)

After pulling the latest branch update, the owner reported:

- `npx vitest run tests/public-route-security.test.ts`: passed, 1 file / 24 tests.
- `npm test`: passed, 42 files / 357 tests.
- `npm run check-docs`: passed; all 22 phase files, statuses, links and required sections were consistent.
- `git status --short --branch`: clean working tree, `muf-monorepo` aligned with `origin/muf-monorepo`.

This validates the corrected active-user source assertion and the expanded public-route security regression suite on the pulled checkout. The latest output did not include fresh runs of `check-route-permissions`, `check-secrets`, `check-sync`, `check-ui`, `check-workbench`, `check-farms`, or the three production builds, so those are not claimed for this exact checkpoint. Phase 14 remains **In progress**: the full handler-by-handler authorization audit is not complete, and source-contract tests are not equivalent to behavior-level tests for every role and farm combination. Phase 15 remains **Not started**.

## Phase 14 follow-up review (2026-10-28)

- Reviewed all three apps' full backup/restore route guards and the shared yearly-archive workflow. Database-wide backup/restore handlers are owner-only and intentionally run unscoped; yearly archive handlers also require owner authority and bind job/record reads and source mutations to the supplied farm ID. The farm ID is treated as a resource selector, not as authorization by itself; the owner-only guard is what permits cross-farm archive administration.
- Found a destructive input-validation gap in Agri backup restore: a present collection section set to `null` passed validation, then `applyBackupPayload` treated it as an empty array and deleted that collection. Validation now rejects null/non-array sections and malformed records before taking the pre-restore snapshot or applying any changes.
- Added a regression source-contract test for the validation-before-mutation ordering. Commits: `bf1946d` (fix), `5751685` (test).
- This is a source review and code change made through GitHub. The owner has not yet run the new test or current-head validation, so the fix is not marked locally verified. Phase 14 remains **In progress**.


## Phase 14 restore validation follow-up (2026-10-28)

The owner's latest pull passed 357 tests and failed one source-contract assertion in `tests/public-route-security.test.ts`. The assertion searched globally for the validator and apply helper, so the validator function declaration appeared after the apply helper declaration even though the manual restore handler called validation before applying the payload. The regression test now checks ordering inside each restore handler rather than comparing function declaration positions.

The continued source audit found the same class of risk in stored automatic backups and cross-app restore payloads. Added pre-mutation validation for Agri manual and automatic restore, Dairy manual and automatic restore, and Flock manual and automatic restore. The validators reject malformed collection records and auxiliary farm/archive/image/farm-bucket sections before restore locks or destructive writes. Regression source-contract tests now check both manual and automatic restore paths for all three apps.

Commits on `muf-monorepo`: `8456eb7`, `e06f911`, `94fbce3`, `eed8209`, `dc886f2`, `63813b8`.

**Validation pending:** these latest changes have not yet been pulled or run in the owner's Windows checkout. Do not mark the test suite as passing or Phase 14 as Done until the focused test, full suite, standard checks, and all three builds pass on the current head. Phase 15 remains Not started.


Phase 14 current-head validation (2026-10-28): owner pulled branch update e44ed46..8c6ff58. Reported results: public-route security 26/26; full suite 42 files / 359 tests; route inventory (46 modules), secret scan (647 tracked paths), sync, UI, workbench (23 checks), farm scope, archive, docs and all three production builds passed. Git status is clean and local branch is aligned with origin. Archive scripts emitted non-fatal Node module-type warnings. The restore-validation follow-up is now validated on the owner's checkout. Phase 14 remains In progress because the handler-level authorization audit is not complete; Phase 15 remains Not started.


Phase 14 handler audit follow-up (2026-10-28): added selected-farm validation for Dairy health cow links, milk cow/buyer links, and expense cow/supplier links, including bulk health/milk payloads. Added source-contract regression checks in tests/public-route-security.test.ts. Commits: 4c296a6, f09430b, 7b5f73e, b89f9aa. Validation is pending owner pull/run. Phase 14 remains In progress; Phase 15 remains Not started.


Phase 14 owner lifecycle follow-up (2026-10-28): Dairy user deletion now refuses to delete an owner when no other active owner remains. Added a regression assertion. Commits: 3e2881f, 5977efb. Validation is pending owner pull/run.

Phase 14 handler audit follow-up (2026-10-28): continued reviewing cross-farm links in Dairy lineage and Agri finance, task, and labor handlers. Added same-farm validation for Dairy cow mother/farm-sire references; Agri finance crop references on create/update; Agri task crop/inventory references on create/update; and Agri attendance crop references on create/update. Added source-contract regression tests. Also fixed the Dairy archive test fixture to use the actual cow ID returned by the API, since cow creation intentionally generates its own ID and ignores a client-supplied _id. Commits: a4a9fb5, a8c3e53, 8a1cd22, 07e57fb, a754185, 13a9cef. Validation is pending owner pull/run. Phase 14 remains In progress; Phase 15 remains Not started.
Phase 14 handler audit follow-up (2026-10-28): Telegram `/link-code` in Dairy, Flock and Agri now requires a selected farm and checks that a non-owner target user is assigned to that farm before issuing a link code. This closes a cross-farm user-ID trust gap found during handler review. Added regression source-contract coverage for all three routes. Commits: `ae35f22`, `699fc69`, `6b728b9`, `a081f00`, `8094f42`. Validation is pending owner pull/run. Phase 14 remains In progress; Phase 15 remains Not started.


Phase 14 handler audit follow-up (2026-10-28): strict `YYYY-MM` validation now protects Agri and Dairy labor wage posting from malformed month filters; Agri's attendance query is anchored to the full month prefix. Flock image uploads now allow only JPEG/PNG/WebP with matching file signatures, and authenticated image responses are no-store to prevent shared-cache leakage across farm contexts. Added source-contract regression assertions. Commits: `6e51a2b`, `34c26cc`, `ecf364d`, `7eb31aa`, `75e9551`, `32b2985`, `ff5ba56`, `9db2c19`. Validation is pending on the owner's Windows checkout; Phase 14 remains In progress and Phase 15 remains Not started.


Phase 14 owner validation update (2026-10-28): on branch head `6a9760a`, the owner reported 38 public-route security tests and 371 total tests passing, along with route inventory, secret scan, MUF sync, UI, workbench, docs checks and all three frontend production builds. However, `npm run check-farms` and `npm run check-archive` failed because `flock_farm/backend/routes/uploads.js` had a missing closing parenthesis in the PNG signature check, preventing the Flock backend from starting. Fixed the syntax on `muf-monorepo` and added a regression source assertion. The fix has not yet been validated in the owner's checkout. After pulling, rerun the focused security tests, full suite, farm and archive checks, docs, all standard checks, and all three builds. Phase 14 remains In progress; Phase 15 remains Not started.


## Phase 14 current-head validation update (2026-10-28)

The owner pulled `6a9760a..118f730` and supplied a complete Windows CMD validation run after the Flock upload syntax fix:

- `npx vitest run tests/public-route-security.test.ts`: passed, 1 file / 38 tests.
- `npm test`: passed, 42 files / 371 tests.
- `npm run check-farms`: passed, including all three farm-scope suites and Dairy breeding-event runtime checks.
- `npm run check-archive`: passed for Dairy, Flock and Agri; Node emitted non-fatal module-type warnings.
- `npm run check-route-permissions`: passed, 46 route modules documented, imported and visibly mounted.
- `npm run check-secrets`: passed, 647 tracked paths checked with no tracked .env files, private keys or recognized credential patterns.
- `npm run check-sync`, `npm run check-ui`, `npm run check-workbench` (23 checks), and `npm run check-docs`: passed.
- `tools\\build-all.bat`: all three production builds passed.
- `git status --short --branch`: clean working tree, branch aligned with `origin/muf-monorepo`.

The upload syntax fix and current command-line validation are now verified in the owner's checkout. Phase 14 remains **In progress** because the endpoint-by-endpoint authorization review is not yet complete; source-contract tests and route inventory coverage do not prove every handler's behavior for every role/farm combination. Phase 15 remains **Not started**.


## Phase 14 audit continuation: Flock cross-farm image boundary (2026-10-28)

A confirmed Flock handler gap was found and fixed: the Image model is not automatically farm-scoped, while batch import/wipe and per-path/orphan cleanup had relied on implicit scope. These paths now use explicit farm predicates; batch create/edit/gallery attachment rejects image IDs not belonging to the selected farm; import/wipe require a single selected farm. Added three source-contract regression tests and updated the route permission inventory.

Commits: `7469dfe`, `181ee01`, `4de6a48`, `f1cf04d`, `62d9202`.

**Validation pending:** the owner must pull and rerun the focused security tests, full test suite, farm/archive checks, route/secrets/sync/UI/workbench/docs checks and all three production builds. Phase 14 remains **In progress**; Phase 15 remains **Not started**.


## Phase 14 owner validation and audit disposition (2026-10-28)

The owner supplied a current Windows run after pulling the cross-farm image fixes: focused security tests passed (41 tests), full suite passed (42 files / 374 tests), farm and archive checks passed, all route/secret/sync/UI/workbench/docs checks passed, and all three production builds passed. Archive scripts emitted non-fatal Node module-type warnings. The working tree is clean and synchronized with `origin/muf-monorepo`.

The latest source review covered user/role assignment, Telegram link/webhook flows, scheduled secrets, public share cards, photo and image cleanup, Agri finance/tasks/labor links, Dairy wage posting, Flock batch image boundaries, and owner-only backup/archive operations. Confirmed gaps were fixed with focused regression assertions. Public share cards remain intentionally public bearer links and are not private or revocable.

**Phase 14 remains In progress; Phase 15 remains Not started.** The checks are green, but source-contract tests do not behaviorally prove every role/farm combination for every handler. Complete the remaining route-by-route review before closure; do not infer exhaustive authorization correctness from module inventory or passing builds.


## Phase 14 active-owner lifecycle follow-up (2026-10-28)

A final pass over user lifecycle handlers found that Agri's last-owner guard counted inactive owner-role accounts. The guard now counts active owners only and protects the target when that target is active. Added a focused source-contract regression assertion and clarified the Agri route inventory. Commits: `1507543`, `fd28bb8`, `82853c2`, `3ba993c`, `8bb8b35`.

The owner-reported validation from branch head `4d6215a` passed (41 focused security tests, 374 total tests, farm/archive/route/secret/sync/UI/workbench/docs checks and all three production builds), but it predates this final fix. Current-head validation is pending. Phase 14 remains **In progress** and Phase 15 remains **Not started** until the new code passes the full validation set.

**Phase 14 current-head validation (2026-10-28; owner-supplied Windows CMD output):** after pulling `4d6215a..f69334a`, the owner reported 42/42 focused public-route security tests and 375/375 tests across 42 files passing. Farm and archive checks passed; route inventory (46 modules), secret scan (647 tracked paths), MUF sync, UI, workbench (23 checks), docs, and all three production builds passed. Archive scripts emitted non-fatal Node module-type warnings. `git status --short --branch` showed a clean working tree aligned with `origin/muf-monorepo`. Phase 14 remains **In progress** because the handler-level authorization review is not exhaustive; Phase 15 remains **Not started**.

**Phase 14 summary-boundary fix (2026-10-28):** source review found Flock scheduled/manual summary handlers reading DataStore buckets without an explicit farm ID. Updated them to scope all bucket reads to a required farm, require a single selected farm for authenticated summary endpoints, bind scheduled sends to the configured default farm, constrain manual recipients to the selected farm plus the configured allowlist, and omit recipients/statistics from the manual-send response. Added a regression assertion. Commits: 14f828b, 94825c5. Validation of this latest change is pending owner-run tests/builds; Phase 14 remains **In progress**.


## Phase 14 completion validation (2026-10-29; owner-supplied Windows CMD results)

The owner pulled commit `18aeb2a`, completed the documented Phase 14 validation gate, and confirmed a clean, synchronized working tree (`muf-monorepo...origin/muf-monorepo`).

| Command/check | Result |
|---|---|
| `npm ci` | Completed successfully. npm reported 5 dependency audit findings (1 moderate, 2 high, 2 critical); investigate separately, and do not run `npm audit fix --force` blindly. |
| `node --check tools/check-route-matrix.js` | Passed |
| `node --check tools/route-matrix-policy.cjs` | Passed |
| `npm test -- tests/route-matrix-policy.test.ts` | Passed: 1 file / 5 tests |
| `npm test -- tests/public-route-security.test.ts` | Passed: 1 file / 45 tests |
| `npm run check-route-permissions` | Passed: 46 route modules documented, imported and visibly mounted |
| `npm run check-route-matrix` | Passed: 347 route declarations checked (Dairy 130, Agri 135, Flock 82); zero authorization mismatches |
| `npm run check-secrets` | Passed: 652 tracked paths scanned; no tracked .env files, private keys or recognized credential patterns |
| `npm run check-sync` | Passed: shared MUF files and invariants synchronized across all three apps |
| `npm run check-ui` | Passed: all MUF UI safety checks |
| `npm run check-workbench` | Passed: 23 source checks |
| `npm run check-farms` | Passed: all three farm-scope suites and Dairy breeding-event runtime checks |
| `npm run check-archive` | Passed: Dairy, Flock and Agri archive checks. Node printed non-fatal module-type warnings. |
| `npm run check-docs` | Passed: all 22 phase files, statuses, sections and links consistent |
| `npm test` | Passed: 44 files / 397 tests |
| `tools\\build-all.bat` | Passed: Dairy, Flock and Agri production builds |
| `git status --short --branch` | Clean; `muf-monorepo` aligned with `origin/muf-monorepo` |

The corrected inventory records manager access for Dairy labor worker/attendance/advance reads and the orphan-photo listing, removes the zero-declaration helper fingerprint, and includes a regression test that rejects zero-count route signatures.

**Disposition:** Phase 14 is **Done for command-line scope**. The owner-supplied tests verify the documented runtime matrix and regression suite, but do not claim real-MongoDB, browser/phone, or live-deployment verification; those remain in Phases 19–21. Five potential route-policy decisions (P14-R1 to P14-R5) remain documented in `docs/SESSION-2-PROBLEMS.md` for separate owner review and were not changed without an explicit policy decision. Public share cards remain intentionally bearer-link accessible with their documented safeguards.

**Dependency note:** the `npm ci` audit warning is not a failed Phase 14 check, but the five reported vulnerabilities must be triaged before release.

## Phase 15 start (2026-10-29)

Phase 14 is Done for command-line scope after owner-supplied current-head results showed 397/397 tests passing, the 347-route authorization matrix passing with zero mismatches, repository checks passing, all three production builds passing, and a clean synchronized working tree.

Phase 15 is now **In progress**. Implementation adds farm-scoped Product models, manager/owner management endpoints, a published-only public endpoint with an explicit allowlist, and the shared product-management screen in Dairy, Agri and Flock. New products default to unpublished. Product types are Dairy milk/animals without a buyer, Agri harvested produce, and Flock eggs/birds. The public shop and payments remain in Phase 16.

Phase 15 changes have not yet been tested in the owner's Windows checkout. Do not mark it Done until focused tests, the full suite, standard checks, and all three builds pass.


## Phase 15 completion validation (2026-10-29; owner-supplied Windows CMD output)

Phase 15, MU Farms products and publish switch, is **Done for command-line scope**.

| Command/check | Result |
|---|---|
| `npm test -- tests/public-products.test.ts` | Passed: 1 file / 5 tests |
| `npm test -- tests/archive.test.ts` | Passed: 1 file / 10 tests |
| `npm run check-route-permissions` | Passed: 49 route modules documented, imported and visibly mounted |
| `npm run check-route-matrix` | Passed: 362 route declarations checked (Dairy 135, Agri 140, Flock 87); no authorization mismatches |
| `npm run check-sync` | Passed: all MUF sync checks, including byte-identical ProductManager components and product backend helpers |
| `npm run check-secrets` | Passed: 662 tracked paths scanned; no recognized tracked secrets found |
| `npm run check-ui` | Passed: all MUF UI safety checks |
| `npm run check-workbench` | Passed: 23 source checks |
| `npm run check-farms` | Passed: farm-scope tests and Dairy breeding-event runtime checks |
| `npm run check-archive` | Passed: Dairy, Flock and Agri archive runtime checks (non-fatal Node module-type warnings) |
| `npm run check-docs` | Passed after fixing a Phase 14 status mismatch |
| `npm test` | Passed: 45 files / 402 tests |
| `tools\\build-all.bat` | Passed: Dairy, Flock and Agri builds |

The owner interrupted the first build attempt earlier, then supplied a later complete run showing all three builds passed. The archive-contract test initially failed because an export-list assertion depended on item order; the assertion was corrected to check for required exports independent of order. The Phase 14 status text was also normalized to `Done`, allowing `check-docs` to pass.

`npm ci` was not rerun specifically for Phase 15 because package manifests and lockfiles were unchanged from the successful Phase 14 install. The earlier install reported 5 audit findings (1 moderate, 2 high, 2 critical), which remain a release-triage item. Do not run `npm audit fix --force` blindly.

**Scope note:** Dairy's `animal` product kind is a manually maintained catalogue item. It is not automatically synchronized with or filtered by the Buyers records. Public shop UI and ordering/payments are Phase 16. Real MongoDB, browser/phone and live deployment remain unverified until Phases 19–21.

## Phase 16 completion (2026-10-29; owner-supplied Windows CMD results)

Phase 16, MU Farms public shop, is **Done for command-line scope**. The public shop is isolated in a lazy-loaded `/shop` route and a dedicated, byte-identical `src/muf-shop/` folder in each frontend. It reads only the published-product public feeds. Crops maps to Agri `produce`, Dairy to `milk` and manually managed `animal`, and Poultry to Flock `egg` and `bird`. WhatsApp order messages include product, farm, type, listed price and availability; the seller number and cross-app API roots are deployment configuration, not guessed constants.

| Command/check | Result |
|---|---|
| `npm run check-shop` | Passed: 1 file / 7 tests |
| `npm run check-sync` | Passed: all three shop copies, shared frontend files, backend twins and MUF invariants synchronized |
| `npm run check-docs` | Passed: all 22 phase files, statuses, sections and links consistent |
| `npm run check-ui` | Passed: all MUF UI safety checks |
| `npm run check-workbench` | Passed: 23 source checks |
| `npm run check-farms` | Passed: farm-scope suites and Dairy breeding-event runtime checks |
| `npm test` | Passed: 46 files / 409 tests |
| `tools\\build-all.bat` | Passed: Dairy, Flock and Agri production builds |

`npm ci` was not repeated because the dependency set and lockfiles were unchanged. The previous install reported five audit findings (1 moderate, 2 high, 2 critical); triage them before release and do not run `npm audit fix --force` blindly. These results were supplied from the owner's Windows checkout and were not independently run in this editing session.

No browser/phone behavior, real MongoDB, deployed cross-origin feeds or live WhatsApp delivery is claimed. Those checks remain in Phases 19–21.

## Phase 17 start (2026-10-29)

Phase 17, Automatic command-line checks on GitHub, is **In progress**. The owner approved the requested automation in the conversation and explicitly asked us to attempt GitHub Actions rather than presume any quota restriction.

Added `.github/workflows/muf-quick-checks.yml`, configured for `push`, `pull_request` and manual dispatch. It installs the root test tools and the app/backend packages required by regression and farm-scope tests, then runs `npm test`, `npm run check-sync`, `npm run check-ui`, `npm run check-workbench`, `npm run check-farms`, `npm run check-docs` and `npm run check-audit`. Added `tests/workflow-contract.test.ts` to assert the three triggers, exact install/check command list, read-only permissions and absence of embedded credentials. The existing `muf-frontend-checks.yml` remains manual-only for the workbench runtime smoke test, design-system audit and three frontend builds.

Added `.github/dependabot.yml` with `open-pull-requests-limit: 0` across all seven npm package sets and GitHub Actions to disable scheduled version-update pull requests. **Settings limitation:** the GitHub connector available for this edit can update repository contents but cannot toggle or verify the repository-level Dependabot alerts and security-update PR setting. This portion remains unverified and Phase 17 is not marked Done.

**Actual GitHub Actions result:** [MUF quick checks run 40842550494](https://github.com/musman5911/ai-monorepo/actions/runs/40842550494) completed successfully on push commit `dd2892768065908614e13e8fcf37196c1cb5fa6e`.

| Check | Result |
|---|---|
| Dependency installs | Passed: root, Dairy client, Agri backend, Dairy backend, Flock backend |
| `npm test` | Passed: 47 files / 412 tests, including 3 workflow-contract tests |
| `npm run check-sync` | Passed |
| `npm run check-ui` | Passed |
| `npm run check-workbench` | Passed: 23 checks |
| `npm run check-farms` | Passed: all farm-scope and Dairy breeding-event checks |
| `npm run check-docs` | Passed |
| `npm run check-audit` | Passed: seven package sets reported 0 high/critical production vulnerabilities |

The push trigger has been confirmed working; no quota limitation was inferred. The pull-request trigger has not yet been independently observed. The GitHub CI run does not replace current-head Windows validation or the three production builds.

Dependabot config disables scheduled version-update PRs with `open-pull-requests-limit: 0` for all npm package sets and GitHub Actions. The repository-level alerts/security-update setting remains to be verified in Settings, which the available connector cannot control or read.

## Phase 17 completion (2026-10-29; owner-supplied Windows results and GitHub Actions runs)

Phase 17, Automatic command-line checks on GitHub, is **Done for command-line scope**. The GitHub Actions quick-check workflow ran successfully on the initial implementation and again after the tracking docs were updated. The latest verified run is [40842866579](https://github.com/musman5911/ai-monorepo/actions/runs/40842866579) on commit `17c72c34b9220faaa574e02bb7daf466c8c6e22f`.

| Check | Result |
|---|---|
| CI dependency installation | Passed: root tools, Dairy client and Agri/Dairy/Flock backends installed with `npm ci` |
| `npm test` in GitHub Actions | Passed: 47 files / 412 tests (including 3 workflow-contract tests) |
| `npm run check-sync` | Passed |
| `npm run check-ui` | Passed |
| `npm run check-workbench` | Passed: 23 checks |
| `npm run check-farms` | Passed: farm-scope and Dairy breeding-event checks |
| `npm run check-docs` in GitHub Actions | Passed |
| `npm run check-audit` | Passed: seven package sets reported zero high/critical production dependency vulnerabilities |
| Owner's `npm test` on Windows | Passed: 47 files / 412 tests |
| Owner's `npm run check-docs` on Windows | Passed: all phase statuses, sections and links consistent |
| Owner's `tools\\build-all.bat` | Passed: Dairy, Flock and Agri production builds |
| Dependabot Settings | Owner confirmed alerts enabled and security updates disabled |

Version-update pull requests are disabled via `.github/dependabot.yml`. The push trigger was observed twice. A separate pull-request-triggered run has not been observed, though the trigger is protected by the workflow contract test. The optional Vite workbench runtime test remains manual. These results do not claim real MongoDB or live-site verification.

## Phase 18 start (2026-10-29)

Phase 18, Documentation and handoff, is **In progress**. Initial review found outdated instructions in the monorepo README, a duplicate copy in `docs/README.md`, stale `docs/AUDIT.md` links in all three app READMEs, missing practical role workflows, and no guard to validate commands printed in guides. This phase will repair docs and add the guide-command check without changing application behavior.
