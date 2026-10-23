# Progress

What is done, what remains and what is next for the scale-up project. Keep this file up to date after every change.
Last updated: 2026-10-23 (owner pulled through d7321fb and reported 151 passing tests plus passing farm-scope, shared-MUF sync, UI-safety and workbench checks; all three frontend production builds succeeded. Phase 3 implementation remains open.)


## Phase 3 implementation update (2026-10-23): Dairy paging and bounded bulk milk entry

- Owner verification update (Windows, pulled through d7321fb): the pasted run reports 151 passing tests. `npm run check-farms`, `npm run check-sync`, `npm run check-ui`, and `npm run check-workbench` all passed. Production builds succeeded for Dairy, Flock and Agri. Dairy emitted an advisory mixed static/dynamic import warning; Flock and Agri emitted advisory large-chunk warnings; Agri also reports a deprecated `advancedChunks` option. These warnings did not fail the builds. The test output is interleaved with the farm-scope command in the supplied console transcript, so the complete standalone `npm test` exit summary should still be captured at the next clean verification checkpoint.
- Dairy cows now have opt-in server paging with stable name/ID ordering, escaped literal search, batch/status/gender filters, a farm-scoped count, and separate server totals for stat cards. Eligible mothers are loaded through a dedicated endpoint so adding calves still works when the visible cow list is paged.
- Dairy Cows UI now requests 50 records at a time, debounces search, applies filters server-side, and offers Load 50 More without duplicate rows.
- Dairy Milk History now requests 50 records at a time and appends further pages with ID-based deduplication. A farm-scoped server summary endpoint keeps month count, total/saleable liters, and revenue accurate across all pages.
- Daily Milk Save All now sends bounded chunks of at most 200 rows to an authenticated bulk endpoint. The endpoint validates the entire chunk before writing, rejects duplicate cow/date pairs inside a request, caps payloads at 200, and returns per-row outcomes for partial failures so retries are explicit. It does not pretend multi-row writes are transactionally atomic.
- Added a preview-first Dairy milk CSV importer and a preview-first Dairy health CSV importer (up to 1,000 rows per file, 2 MB file cap, row validation, 200-row write chunks). Health bulk writes also clean up the linked health/expense pair if a row fails partway through.
- Flock now has a bounded batch-list page API/UI and preview-first per-batch egg CSV import, serialized under the existing inventory lock. Agri crops, finance and tasks now validate skip/limit inputs and return stable sort order plus page-count headers while preserving the legacy array response. Dairy Health has preview-first CSV import backed by the bounded health bulk API.
- Added Phase 3 contract tests for paging APIs, server summaries, bulk validation, CSV preview flows, Flock page loading, and partial-write reporting.
- Commits are on muf-monorepo: 28a599b, 2f9d26c, 96388fb, 21d1565, 07f011d, 2e283ee, ecaaa34, 15aa67a, b50ac87, 141838e, db02717, 87af32c, 90a57b5, 4afcced, 6a6b7d4.
- Owner's local checkpoint on the Phase 3 branch reported 149/150 tests passing; the remaining contract failure was a missing rendered Dairy milk CSV preview modal. Dairy and Flock builds also exposed unused/missing state setters. The farm-scope script found Flock's paginated batch route failing in memory mode because the memory query adapter lacked working skip/limit support. Corrective commits now render the milk preview modal, remove unused rate state, fix the Flock pagination setter, implement skip/limit in the Flock memory adapter, and add a regression contract test. These corrections have not yet been verified by the owner.
- Still required for Phase 3: rerun root tests, farm-scope check and all three builds locally; finish Agri UI incremental loading and bulk/import workflows; extend Flock bulk entry beyond egg logs; add Excel import support; validate 1,000-row fixtures, stable pagination under changing data, and farm isolation for bulk writes and totals. The current Agri server headers are additive but its UI still fetches every page in sequence. Phase 3 is not signed off yet.
- Per owner direction, Phase 2's real-MongoDB concurrency and disposable-copy backup/restore sign-off is deferred to the final consolidated verification pass after all planned phases. Continue implementation in Phase 3 now, but do not connect to or mutate production data.

## Owner verification checkpoint (2026-10-23, commit d629392 and follow-up)

- Owner pulled through the Phase 3 pagination and Phase 4 breeding-lineage foundation and reported a clean working tree.
- Local root suite result: **134 passed, 1 failed out of 135**. The only failure was the optional real-Mongoose query-contract test in `tests/muf-farms.test.ts`, which timed out at Vitest's default 5 seconds while importing the installed backend Mongoose package. Its assertions were not reported as failing. A targeted 20-second timeout is now committed as `dc01ba84baa13f946a9dd940b85b5ff2f5f00ec9`; the owner must rerun `npm test` to verify this diagnosis.
- Owner-reported checks passed: `npm run check-farms`, `npm run check-sync`, `npm run check-ui`, `npm run check-workbench`, and the Dairy client `npm run build`. The build emitted a non-fatal warning because `api.ts` is both dynamically and statically imported; this does not fail the build.
- The pagination and breeding-lineage tests passed in the reported suite (17 pagination tests and 3 lineage contract tests). These are source/contract checks, not proof of live MongoDB index creation or visual browser behavior.
- Phase 3/4 remain in progress. Do not claim Phase 2 signed off: real-MongoDB inventory-lock concurrency and backup/restore tests on an explicitly disposable database copy remain open. No live database was accessed for this checkpoint.

## Workflow execution policy update (2026-10-23)

- Changed `.github/workflows/muf-frontend-checks.yml` to use only `workflow_dispatch`. Ordinary pushes and pull requests no longer start this expensive combined workflow.
- Run CI manually only when a deliberate testing checkpoint is needed, rather than on every implementation commit. No workflow run was triggered by this change; the last completed run before this policy change was successful at `6c7b3e95d5264f09e347ea66eb3d30e1ce77048c`.
- Continue implementation in small, ordered steps without waiting for additional approval. Update this file and `ROADMAP.md` after each work step. Browser and end-to-end role verification remains a consolidated final-stage task.
.

**Honesty rule:** a row says "verified" only for checks that actually ran, and says where they ran. Source checks and tests are automated evidence, not visual sign-off. Owner testing in a browser is recorded separately.

The system is described in [FARMS_AND_ROLES.md](FARMS_AND_ROLES.md); the phases are in [ROADMAP.md](ROADMAP.md).

## At a glance

| Phase | State |
|---|---|
| 0. Docs reset and repository cleanup | Done. Applied by the owner, pushed to the `muf-monorepo` branch, owner's checks and builds all passed |
| 1. Farms and roles (MUF) | Implementation substantially delivered; local farm-scope, shared-MUF and UI checks pass. Disposable database-copy migration/backup checks remain open; final browser/role review is deferred until all phases finish |
| 2. Flock restructure and Home Birds | Partial. Batches default and batch egg/vaccination logs plus calculations are implemented and automated checks pass. Dashboard, Health, Labors, Incubation and Summary are not yet all batch-driven; backup/restore copy validation remains open |
| 3. Bulk entry, scroll loading, server totals | In progress: opt-in Dairy cows/milk API pagination and query validation are implemented; UI incremental loading and bulk entry remain |
| 4. Dairy breeding; Agri fields and seasons | In progress: optional Dairy lineage fields and farm-scoped ear-tag unique index are implemented; sire workflow, lineage automation, Agri fields/seasons and MongoDB index verification remain |
| 5. Photo storage and Cloudinary | Not started. Prerequisite done: free Cloudinary account created 2026-10-22 |
| 6. Super Admin upgrade | Not started. The tab and farm-summary endpoints already exist |
| 7. MU Farms shop | Not started |
| Carried over: A3 dependency security, G3 live deployment check, visual review, visual regression rebuild | Open (see below) |

## Decisions (owner, 2026-10-22)

- **Roles:** exactly three: Owner (super admin: all farms, manages farms and admins, sees the Super Admin tab), Manager (full control inside assigned farms; not an admin; no Super Admin), Worker (data entry in assigned farms). Existing admins become Owner.
- **Farms:** per project (poultry farms only in Flock, dairy farms only in Dairy, land only in Agri). Only the owner adds, renames, archives or deletes farms. Delete rules in `FARMS_AND_ROLES.md` section 3 were approved.
- **Shared systems** go into the MUF layer with organized files so later changes are easy.
- **Super Admin** is a role plus the existing tab, not a new domain.
- **Photos:** adapter first, free external store later. Cloudinary Free plan chosen; account created 2026-10-22 (plan shows 0 of 25 credits used). Not connected to any app. Credentials stay in environment secrets only.
- **Flock:** Batches become the main project; the old bird system becomes a much smaller Home Birds tab (eggs, expenses, feed focus; no exports). Claude may remove extras in Home Birds without asking each time; the list is recorded below when it happens.
- **Everywhere else:** ask before removing anything.
- **Rules lifted:** "zero backend changes" no longer applies to this project. Each phase still needs the owner's approval of its plan.
- **Backups:** the owner already took a database backup on 2026-10-22. Take a fresh one before each migration.
- **Hosting:** the owner uses the free MongoDB tier and Replit, so size and quota limits matter (see `DEPLOYMENT.md`).
- **MU Farms shop:** later. There is no budget for a new domain; where it lives is decided in Phase 7.

## Current status and next action

- The owner synced local `muf-monorepo` to `2d4d788` and reported a clean working tree. `npm test` passed 89 tests across 9 files; `npm run check-farms`, `npm run check-ui`, `npm run check-sync`, and `npm run check-workbench` passed; the Flock client `npm run build` passed; and `npm run check-workbench-runtime` passed all 8 checks after starting the Dairy Vite server on port 5000. These are local results supplied by the owner, not a claim that every workflow was browser-tested.
- Phase 2 implementation step: Dashboard now loads its operational KPIs and recent-batch list from the authenticated batch API, with an explicit loading-failure message and a shortcut to Batches. Commits `d2939da` and `1df705b` on `muf-monorepo`; the active-batch KPI uses the actual `Active` enum value. Health now also shows recent batch vaccination history by batch, with record counts, bird counts, dates, doses and costs (`d3be222`, hook import fix `9815fc2` and JSX wrapper fix `4259907`). Source-level work only; automated verification is pending.
- Continue Phase 2: make Labors, Incubation and Summary derive their primary information from batches, and finish shifting Health's primary workflow to batch health while retaining Home Birds vaccination as its limited legacy view; keep Home Birds secondary with Bird List, Bird Details, Eggs, Monthly Report and Vaccination only. Inspect batch backup/restore compatibility and validate on a disposable copy.
- Phase 1 still needs disposable database-copy migration tests and backup/restore review. Per owner direction, defer all browser/end-to-end role testing to one final pass after every planned phase. Never run migrations against live data without explicit approval.
- Dependency audit warnings were reported by `npm ci`: root 5 vulnerabilities (1 moderate, 2 high, 2 critical), Flock backend 6 (4 moderate, 2 high), Flock client 3 (2 high, 1 critical). Investigate with targeted updates in the planned security work; do not use blanket `npm audit fix --force`.

## Phase 1 step 1B-2: Flock backend (in progress, 2026-10-23)

Commits are on `muf-monorepo`; no production data was accessed or migrated.

- Added `Farm`; added optional `farmId` paths to `DataStore`, `Batch`, all five batch-log models and `Image`. `DataStore` now has a compound unique index on `farmId + key`; the migration removes the old globally-unique `key_1` index only after tagging existing records.
- Wired the byte-identical shared `muf-farms.mjs` into Flock authentication and database setup. Farm access comes from the authenticated user's assignments and `X-Farm-Id`; model queries are scoped server-side. The client cannot choose a record's `farmId`. The migration creates farm-leading indexes and replaces the old global bucket-key index.
- Added `/api/farms`, a Flock migration script, `migrate:farms:dry` and `migrate:farms` backend scripts. Demo memory data migrates at startup; real MongoDB data is not migrated at startup.
- Updated bucket permissions to use farm roles, preserved the legacy `role` response, assigned new workers/managers to the selected farm, allowed managers to create workers and see only workers in their assigned farm(s), kept password recovery/backup emails working for migrated owners, and added Flock checks to `tools/check-farm-scope.js`.
- Backup payload work now records the farms and per-farm bucket values, keeps the older `buckets` field for compatibility, includes the labor buckets, and restricts backup/restore to owners. Telegram system jobs explicitly use the default farm when outside a request. Image URLs resolve the image's farm before authentication so ordinary `<img>` tags can still be authorized against the correct assignment.

**Not verified yet:** no local Node test/build could run in this session; the container could not reach GitHub to clone the branch. The new Flock HTTP checks have been added but not executed. No real MongoDB copy was available, so neither migration dry-run nor apply was tested against MongoDB. The new backup format/restore path, image access behavior, first-time setup after signup, and manager permissions still require automated and browser validation. The existing backup format still does not include image binaries; this must be reviewed before treating backups as complete. Do not apply the migration to live data. First take a fresh backup, test on a database copy, and confirm the results.

## Phase 1 step 1B-1: Agri backend (built 2026-10-23)

Design record: [PHASE1_PLAN.md](PHASE1_PLAN.md). Backend only; no screens changed.

- **Agri backend:** `Farm` model; `farmId` on the 14 farm-owned collections; users get `farmIds`; roles owner, manager, worker; server-side scoping from the `X-Farm-Id` header (no header = default farm, `all` = read-only); `/api/farms` (owner only to change); owner-only backup and restore covering all farms; `npm run migrate:farms:dry` and `npm run migrate:farms` in `agri_farm/backend`.
- **Changed behavior to know about:** managers can no longer download or restore backups (owners only, as decided); the first sign-up is the owner; four PUT routes (crops, finance, tasks, suppliers) now go through `replaceFarmRecord` because `replaceOne` is refused inside a farm-scoped request.
- **Checks added or extended:** `tests/muf-farms-agri.test.ts` (10 tests); `tools/check-farm-scope.js` now works per project and has `agri` (and, for both Agri and Dairy: same-farm update, and backup then restore keeps every record in its farm).
- **Small fix in Dairy:** `X-Farm-Id` added to the allowed CORS headers.

**Not done or not verified (Agri):**

- The migration has only run against demo (memory) data, never on a real MongoDB copy. No real database was available here, so no real read or write through MongoDB was exercised for Agri.
- No screens (step 1C). The old Agri screens keep working through the default farm, but errors from the farm layer use `{ error, code }` while Agri screens read `{ detail }`, so a farm error shows only a generic message until 1C.
- Telegram bot records, the daily summary and `/api/farm-summary` run unscoped over the whole project; per-farm Telegram links and summaries come later.
- The Agri frontend was not rebuilt (no frontend file changed).

## Phase 1 step 1A: what was built

Design record: [PHASE1_PLAN.md](PHASE1_PLAN.md). Backend only; no screens changed.

- **Shared core** `backend/muf-farms.mjs`, a byte-identical twin in all three backends (guarded by `check-muf-sync`). Only Dairy uses it so far.
- **Dairy backend:**
  - `Farm` model; `farmId` on the 15 farm-owned collections; users get `farmIds`; roles owner, manager, worker.
  - Server-side scoping of every farm-owned query and create, driven by the `X-Farm-Id` header (no header = default farm, `all` = read-only).
  - `/api/farms`: list, create, rename, archive, restore, delete (owner only; deleting a farm with data needs the name typed plus move-or-delete).
  - Users: owners create any role; managers create only workers in their own farms.
  - Backup and restore: owner only, all farms, farms included in the file, untagged records tagged after a restore.
  - Rate and daily log no longer share ids between farms.
  - `npm run migrate:farms:dry` and `npm run migrate:farms` in `dairy_farm/backend`.
- **Checks added:** `tests/muf-farms.test.ts` (13 tests) and `tools/check-farm-scope.js` / `npm run check-farms` (42 checks over real HTTP against the Dairy backend in memory mode).
- **Old screens still work:** the API returns the old `role` (`admin` or `worker`) next to the real `farmRole`.

**Not done or not verified:**

- Agri was completed in step 1B-1. Flock step 1B-2 is now in progress; the per-farm bucket layout is recorded in `PHASE1_PLAN.md`.
- No screens: no farm switcher, no Farms & Access popup (step 1C).
- The migration has only run against demo (memory) data. It has not been run on a real MongoDB copy.
- The model wrapper was checked against real MongoDB query objects, but no real database was available here, so no real write or read through MongoDB was exercised.
- Telegram bot records and the daily summary email run unscoped and use the default farm; per-farm Telegram links are not built.

## Phase 0: what changed

**Removed**

- `docs/PROGRESS.md`, `docs/ROADMAP.md`, `docs/DEPLOYMENT.md` (replaced by new versions) and `docs/AUDIT.md`.
- Screenshot regression: the `e2e/` folder, `playwright.config.mjs`, `tests/visual-regression-ci-policy.test.ts`, the `visual-candidate` job in `.github/workflows/muf-frontend-checks.yml`, the three `test:visual*` scripts, and the `@playwright/test` dev dependency. The 40 candidate screenshots were never approved, and every screen will change, so this is rebuilt after Phase 2.
- Four Playwright-specific tests in `tests/smoke.test.ts`.
- The Playwright lines in `.gitignore`.
- `package-lock.json` was regenerated with npm. It lost exactly three packages (`@playwright/test`, `playwright`, `playwright-core`) and gained none.

**Added or updated**

- New: `docs/PROGRESS.md`, `docs/ROADMAP.md`, `docs/FARMS_AND_ROLES.md`, `docs/DEPLOYMENT.md` (old environment and Replit content kept, rollout and free-tier sections added).
- `RULES.md`: section 1 rewritten for the scale-up project; notes on new shared systems, dependencies and migrations.
- `docs/README.md`, `docs/muf-rules.md`, `docs/MUF_OVERVIEW.md` and the three project `README.md` files: references to deleted documents fixed.

**Kept on purpose:** every image (all are real logos, icons and crop cards used by the code), `demo-data.js` in each backend (demo mode needs it), all other tests and docs.

**Home Birds removals:** none yet. The Phase 2 plan will list them.

## Verification (2026-10-22, Linux sandbox, uploaded `main` snapshot plus Phase 0 edits)

| Check | Result |
|---|---|
| `npm ci` (root) and `npm ci` in `dairy_farm/client` | Succeeded |
| `npm test` | 61 of 61 pass (6 files) |
| `node tools/check-muf-sync.js` | All checks passed |
| `node tools/check-ui-safety.js` | All checks passed |
| `node tools/check-muf-workbench.js` | 23 of 23 pass |
| `node --check tools/audit-muf-design-system.mjs` and the audit itself | Ran. Agri 36, Dairy 38, Flock 70 popups; 0 missing sizes |
| Dairy frontend production build (`npm run build` in `dairy_farm/client`) | Built successfully |
| Not run | The workbench runtime check, the GitHub Actions workflow after the edit, any live Replit, MongoDB, SMTP or Telegram test |

Owner's machine, 2026-10-22, Phase 0 branch: `npm test` 61 of 61, sync, UI safety and workbench checks passed, and `tools\build-all.bat` built Dairy, Flock and Agri.

### Owner verification (2026-10-23, Windows; reported by owner, not independently rerun here)

| Check | Result |
|---|---|
| `npm test` | 84 of 84 pass |
| `npm run check-farms` | Agri and Dairy passed |
| `npm run check-muf-sync`, `npm run check-ui-safety`, `npm run check-workbench` | Passed |
| `tools\\build-all.bat` | All three apps built |
| Independently verified in this session | No; these are owner-reported results |

### Phase 1 step 1B-1 (2026-10-23, Linux sandbox)

| Check | Result |
|---|---|
| `npm test` | 84 of 84 pass (8 files), including 10 new Agri tests |
| `node tools/check-farm-scope.js agri` | All pass (49 checks) |
| `node tools/check-farm-scope.js dairy` | All pass (49 checks; seven new generic checks added) |
| `check-muf-sync`, `check-ui-safety`, `check-workbench` | All pass |
| Frontend builds | Not re-run: no frontend file changed |
| Not run | A real MongoDB migration, the screens, the Flock backend |

### Phase 1 step 1A (2026-10-22, Linux sandbox)

| Check | Result |
|---|---|
| `npm test` | 74 of 74 pass (7 files), including the new 13 farm tests |
| `node tools/check-farm-scope.js dairy` | 42 of 42 pass |
| `check-muf-sync`, `check-ui-safety`, `check-workbench` | All pass |
| Frontend builds | Not re-run: no frontend file changed in 1A |
| Not run | A real MongoDB migration, the screens, Agri and Flock backends |

Phase 0 changed no application code, but the Agri and Flock builds and the edited workflow should still be run on the owner's side once the zip is applied.

## Carried over from the old system

### A3: dependency audit (2026-10-20, `npm audit`; nothing remediated yet)

| Project | All findings | Shipped to users |
|---|---|---|
| Root (test tools) | 4: 2 critical, 1 high, 1 moderate | 0 |
| Dairy frontend | 4: 2 high, 1 moderate, 1 low | 1 low (`dompurify`) |
| Flock frontend | 2: 1 high, 1 low | 1 low (`dompurify`) |
| Agri frontend | 4: 3 high, 1 low | 2: `axios` high (direct), `dompurify` low |

Fixes: `axios` 1.20.0 (Agri), `dompurify` 3.4.17 (all three), `nanoid` 3.3.20 (Agri build tool), `source-map-js` 1.2.2 (build tools): all non-breaking. Vitest 5 and Vite 8 are major upgrades; do them separately. Never run a blanket `npm audit fix`: it added 50 to 68 unrelated optional packages to each lockfile. Update targeted packages and review each lockfile diff. This audit predates the Playwright removal, so the root numbers may now differ; re-run before fixing.

### G3: live deployment

The Replit configuration was improved in source on 2026-10-20 (Node.js 24 in all three `.replit` files, lockfile-driven build and run commands, canonical environment names, consistent `JWT_EXPIRES_IN`). It has not been exercised on the owner's three Replit projects. External scheduler setup, database reachability, SMTP, Telegram webhooks and publishing quota still need the live checks in `DEPLOYMENT.md`.

### Owner visual review still pending

Dairy popup field styling (B1), micro-typography (B3) and the Urdu popup labels (C5), at 360, 390, 768/1024 and 1440 px in light, dark and Urdu. The Urdu fallback sweep covered named modules only.

### Visual regression (A1)

Removed in Phase 0. The old 40-image candidate set was never approved and has expired. Rebuild after Phase 2 settles the screens; authenticated screens need a safe test account, never real credentials or fake farm data.

### Housekeeping

- Flock `ZakatSection` (in `MonthlySummary.tsx`) is defined and unused (roadmap D1).
- `tools\send-to-projects.bat` normalizes line endings and prints the paths it changes. If it has not been run since the 2026-10-18 reorganization, run it only when ready.
- The earlier note that old remote branches still existed was reported out of date by the maintainers; it could not be checked from the snapshot.

## Next

1. Owner applies the 1B-1 zip and runs the commands in `docs/README.md` (including `npm run check-farms`; run `npm ci` in `agri_farm\backend` first).
2. Step 1B-2 wires farm scoping into the existing Flock data layout; plan approved, implementation pending.
3. Step 1C: farm switcher and Farms & Access popup in all three apps.

## How to update this file

After each change: move the phase to done with the date, record real check results with where they ran, list anything unverified, add removals to the Home Birds list when they happen, and keep `ROADMAP.md` in step.


## Phase 1C implementation note (2026-10-23; initial note superseded by validation update below)

- Added a shared MUF farm switcher to the Agri, Dairy and Flock frontends and mounted it in each app header.
- Added the selected farm ID as `X-Farm-Id` to authenticated API requests.
- The owner panel uses existing APIs for farm create, rename, archive/restore, and role/farm assignment. Permanent deletion and “All farms” mode are not exposed in this pass.
- Added a three-app byte-identity check for the shared switcher.
- At the time of the initial note, builds and automated checks had not yet been reported. The later validation update below supersedes that status.
- **Still unverified:** browser behavior, endpoint compatibility under real app sessions, role enforcement in UI/API flows, and migration-on-copy tests.
- **Permission caveat:** legacy `admin` role checks still need review; this UI does not replace server-side authorization.


### Phase 1C owner validation (2026-10-23; Windows output supplied by owner)

| Check | Result |
|---|---|
| `npm run check-farms` | Passed for Agri, Flock and Dairy |
| `npm run check-sync` | Passed, including byte-identical switcher check |
| `npm run check-ui` | Passed |
| `npm test` | 84 passed across 8 files; real Mongoose query test skipped conditionally because Dairy backend packages may be absent |
| `npm run check-workbench` | 23 source checks passed; does not replace browser testing |
| `tools\\build-all.bat` | Flock and Agri built. Dairy TypeScript check failed because `RefreshCw` was unused; script then built Dairy with Vite only, skipping type checking |
| `git diff --check` | Passed |
| Root `npm install` | Completed; reported 5 vulnerabilities (1 moderate, 2 high, 2 critical) |
| Real MongoDB copy migration / browser review | Not run |

The unused `RefreshCw` import was removed from all three identical switcher copies and pushed to `muf-monorepo`. Re-run the full builds to verify the fix. Do not call Phase 1C complete until TypeScript builds pass, endpoint/permission behavior is reviewed, and migration dry-runs are tested on database copies.

The existing local change to `flock_farm/backend/package-lock.json` is owner-local and not part of the pushed implementation. Review its diff separately; do not discard it or commit it automatically.


### Phase 1C validation update (2026-10-23; owner-provided Windows output)

| Check | Result |
|---|---|
| Dairy `npm run build` | Passed: `tsc --noEmit && vite build`; Vite warned about mixed static/dynamic import of `src/api.ts` |
| Flock `npm run build` | Passed: `tsc --noEmit && vite build`; Vite warned about chunks larger than 500 kB |
| Agri `npm run build` | Passed: Vite production build; large-chunk and deprecated `advancedChunks` warnings |
| `npm run check-farms` | Passed for all three apps |
| `npm run check-sync` | Passed, including shared switcher byte identity |
| `npm run check-ui` | Passed |
| `npm test` | 84 passed across 8 test files; the Mongoose test is listed in output with its conditional-skip note |
| `npm run check-workbench` | 23 source checks passed |
| `git diff --check` | Passed |
| `git status` | Only local `flock_farm/backend/package-lock.json` modified; not committed |

The previously reported Dairy unused-import TypeScript error is resolved in the owner's new build output. These results validate builds and automated checks, not end-to-end browser/API behavior. Next: inspect the lockfile diff without discarding it, exercise farm switching and owner user/farm management in each app, verify role restrictions with test accounts, and run migration dry-runs on database copies only. No live migration or browser verification has been reported.


## Phase 2 implementation update (2026-10-23)

Owner approved simplifying the old individual-bird workflow. The retained Home Birds scope is: home-animal list/details, eggs, monthly report and vaccination. Batches must become the primary Flock workflow. Browser and end-to-end role testing are consolidated at the end of all phases, not repeated per phase.

- **Implemented and pushed:** Flock defaults to Batches after login; Batches is first in navigation. Home Birds has nested Bird List, Eggs, Monthly Report and Vaccination sections.
- **Home Birds narrowed:** its egg screen is restricted to egg production; the vaccination screen hides mortality tools and retains vaccine schedule/history. Existing bird list/detail, monthly report and vaccination records remain backed by their existing stores.
- **Batch operations added:** new batch egg-production and vaccination log models/APIs/forms/detail tables; batch summary now includes egg counts, egg income and vaccination costs. Egg sales revenue contributes to batch revenue/profit calculations.
- **Existing systems reused:** current `BatchesTab`, `FlockRegister`, `FinancialLedger`, `MonthlySummary` and `HealthPortal`; no parallel batch system was created.
- **Backup support updated:** batch export/import, detail reads, batch deletion and wipe handling include the new log collections.
- **Tests added:** `tests/flock-batch-math.test.ts` covers valid/invalid egg counts and batch revenue/expense/profit calculations. `tools/check-farm-scope.js` now also exercises batch egg/vaccination creation, farm stamps, detail history and summary totals.
- **CI passed on GitHub Actions:** run [39906995155](https://github.com/musman5911/ai-monorepo/actions/runs/39906995155), commit `50bb799`, completed successfully after the new batch-log scope assertions were added. Root tests, `check-farms` (including egg/vaccination log farm stamps and summary totals), MUF parity, UI safety, workbench checks/runtime, design-system audit, and all three app builds passed.
- The first CI pass caught and led to fixes for the missing `Egg` icon import and an outdated UI-safety expectation for the intentionally simplified Flock navigation. Those fixes are included in the passing run.
- **Owner's local automated validation (2026-10-23):** `npm test` passed 89 tests across 9 files; `npm run check-farms`, `npm run check-ui`, `npm run check-sync`, and `npm run check-workbench` passed; `flock_farm/client` `npm run build` passed TypeScript and Vite production build; `npm run check-workbench-runtime` passed 8/8 checks with the Dairy Vite dev server running on port 5000. `npm run check-ui-safety` and `npm run check-muf-parity` were initially attempted as nonexistent script names; the actual `check-ui` and `check-sync` scripts then passed.
- `npm ci` reported dependency audit findings: root 5 vulnerabilities (1 moderate, 2 high, 2 critical), Flock backend 6 (4 moderate, 2 high), and Flock client 3 (2 high, 1 critical). No automatic or forced audit fix was run.
- **Still incomplete:** Dashboard, Health, Labors, Incubation and Summary are not yet all fully batch-driven. The current work establishes batch logs/calculations and narrows Home Birds navigation, but does not complete the user's intended primary workflow.
- Browser/end-to-end role testing remains deferred to the final project-wide pass. No real-data migration was run and no live data was touched. New log collections are additive, but backup/restore compatibility must be checked on a disposable copy before calling Phase 2 complete.


## Phase 2 step update (2026-10-23): incubation source-batch traceability

- Added optional `sourceBatchId` to `IncubationRecord`, preserving existing historical records without a source link.
- Incubation add/edit form now lets the user associate a record with a batch that has egg collection; list and detail views display the selected source batch.
- The UI explicitly warns that this is provenance tracking only. It does not reserve or deduct eggs, and must not be treated as a stock ledger or as proof that the batch had sufficient unallocated eggs.
- Existing batch egg logs remain the source for collected/sold/home-use/wasted counts; the existing incubation datastore remains separate. No automatic egg transfer or database migration was introduced.
- **Verification:** source edits were pushed to `muf-monorepo`. No build, unit test, browser check, or GitHub Actions run has been executed for this step. CI remains manual-only.
- **Next:** add server-enforced, farm-scoped egg allocation/transfer with duplicate and over-allocation protection before claiming stock traceability complete; then replace additive Labor context with batch-linked work assignments. Preserve unlinked legacy records.


## Phase 2 implementation update (2026-10-23): server-enforced incubation egg allocation

- Added a pure allocation validator and unit tests for the rules.
- Incubation writes now validate linked source batches against the active farm's batch records and egg logs. The server calculates available eggs as collected minus sold, home use and broken/wasted; it sums every linked incubation record for each batch and rejects unknown batches, non-positive/non-integer linked counts, and allocations above supply.
- Validation runs before the datastore's conditional versioned write. Concurrent writes using the same bucket version cannot both overwrite the same snapshot; stale writes continue to receive the existing HTTP 409 conflict response.
- Legacy incubation records without `sourceBatchId` remain accepted. No records are migrated or removed.
- This is server-side validation for the existing farm-scoped incubation bucket, not a separate physical egg ledger. Egg logs can still be edited independently after an allocation; preventing later edits from reducing supply below existing allocations is a follow-up requirement before claiming fully reconciled stock accounting.
- **Tests added but not run:** `tests/flock-incubation-allocation.test.ts` covers valid supply, over-allocation, unknown source batch, combined allocations, legacy records and invalid counts. No GitHub Actions run was triggered yet; workflow remains manual-only. No build, browser check or live-data operation was performed.
- **Next within Phase 2:** protect egg-log edits against reducing available supply below existing allocations, then implement batch-linked labor assignments and replace the current Labor context panel with an actual workflow. After Phase 2 implementation is complete, run the deliberate GitHub Actions checkpoint and defer browser/role end-to-end testing to the final project-wide pass.


## Phase 2 implementation update (2026-10-23): allocation protection and batch-linked labor

- Batch egg-log deletion now checks the remaining egg supply against all farm incubation allocations and rejects a deletion that would leave allocations unsupported. Batch deletion is also blocked while incubation or labor attendance history references that batch, preserving traceability instead of leaving dangling links.
- Daily labor attendance now has an optional `batchId` field. The attendance add/edit forms can assign a worker's shift to a batch, the list shows the batch, and the workload panel summarizes distinct workers assigned to each active batch during the selected month. General/unassigned work remains supported; wage calculations remain unchanged.
- Server-side `laborAttendance` bucket validation checks linked batch IDs against the selected farm, preventing cross-farm assignments through direct API writes.
- Added unit tests for batch labor assignment validation in `tests/flock-batch-labor.test.ts`, alongside the six incubation allocation tests. **These tests have not been run yet.** No build, API integration test, browser test or GitHub Actions run has been performed for these latest commits.
- **Remaining Phase 2 work:** review Dashboard, Health and Summary for true batch-first workflows rather than supplementary panels; surface calculated available egg counts in the incubation UI; verify batch log deletion and linked-history behavior in tests; finish any necessary backup/restore compatibility checks. Then deliberately run the manual GitHub Actions workflow. Browser and role end-to-end testing remain deferred until all phases are complete.


## Phase 2 implementation update (2026-10-23): available egg counts in incubation

- Batch summaries now calculate net eggs remaining after sold, home-use and broken/wasted counts (before incubation allocations). Incubation shows net supply, currently allocated eggs, and estimated unallocated eggs by batch; the source-batch selector shows the amount available for the record being edited, accounting for that record's current allocation.
- Updated the selector warning to explain that the server validates allocations, while the incubation ledger does not physically transfer egg records. Existing unlinked records remain supported.
- Updated the batch-math test to assert net available eggs. New allocation and labor-validator tests are present but **none of the new tests or frontend builds have been run yet**. GitHub Actions is configured for manual dispatch only; this connection exposes no workflow-dispatch action, so I cannot start a run from this chat. No local Windows commands, browser tests, or live-data changes were performed.
- **Important limitation:** incubation saves use optimistic concurrency on the incubation bucket, and egg-log deletion checks allocations before deleting, but allocation writes and egg-log deletion are not one cross-collection atomic transaction. A concurrent allocation and egg-log deletion could race. This must be closed with transaction/serialization support and integration coverage before calling egg inventory fully race-safe.


## Phase 2 implementation update (2026-10-23): protect destructive batch replacement

- Batch backup import and wipe-all endpoints now refuse to replace/delete batch data while any incubation or labor attendance record is linked to a batch. The response is HTTP 409 with linked-record counts and a reconciliation message. This closes two destructive paths that bypassed the per-batch delete guard.
- Added a batch-math unit case proving that sold, home-use and broken/wasted eggs are all deducted from net availability across multiple egg logs.
- **Not verified by execution:** tests and builds remain unrun for the latest commits. The manual-only GitHub Actions workflow cannot be dispatched with the GitHub actions available in this environment. No live data was touched.
- **Remaining Phase 2 risks:** allocation writes and egg-log deletion are still separate operations and can race; integration-level concurrency tests are needed. Backup restore now intentionally refuses batch-only replacement when linked history exists, so a full restore process must restore or reconcile the linked incubation/labor buckets as well.


## Phase 2 implementation update (2026-10-23): testable linked-history guard

- Extracted the bulk-replacement linked-history decision into a pure backend helper and added three unit cases: no linked history permits replacement; linked incubation or labor history blocks it and reports counts. The batch routes now use that helper for import-all and wipe-all.
- Tests are added but not executed. The manual-only workflow is still configured correctly; this GitHub connector does not expose workflow dispatch, so no Actions run was started. The race between allocation writes and egg-log deletion remains open, as does integration testing.


## Phase 2 implementation update (2026-10-23): allocation math consistency

- Incubation allocation validation now clamps each egg-log entry's net supply at zero, matching batch summary math. A negative-net legacy/malformed log therefore cannot cancel valid supply recorded on another day.
- Added a unit case covering that edge condition. This test has been added but not executed. Cross-request concurrency between incubation writes and egg-log deletion remains unresolved; do not treat inventory allocation as race-safe yet.
- The manual-only GitHub Actions workflow still cannot be dispatched through the connected GitHub tools available in this session. No Actions result is claimed.


## Phase 2 verification checkpoint (2026-10-23): remaining-risk review

- Reviewed the current Flock navigation: Batches is the first/main tab; Home Birds is a secondary group with Bird List, Eggs, Monthly Report and Vaccination. Bird details remain available through the bird-list workflow rather than a separate top-level navigation item. Batch panels exist in Dashboard, Health, Labor, Incubation and Summary, but some legacy summary/health calculations still use individual-bird ledgers; do not describe every screen as fully batch-native yet.
- Allocation validation and egg-log deletion still have a cross-document race. A simple in-process mutex or a version bump alone is not sufficient: the backend may run in multiple processes, and an incubation save can validate while an egg log is still present. A safe fix needs a shared database transaction or a database-backed lock protocol that covers both operations, plus route-level integration tests. No unverified lock was introduced.
- Latest Actions run visible on the repository is run `39909652206`, commit `6c7b3e95d5264f09e347ea66eb3d30e1ce77048c`, event `push`, conclusion `success`. It predates the current manual-only workflow and the subsequent allocation commits, so it is not evidence for current code. The available GitHub connector has no workflow-dispatch operation; current tests could not be run through Actions from this session.
- Phase 2 remains **in progress**, not complete. Outstanding: implement cross-operation atomic coordination, add route-level integration coverage, run the deliberate manual Actions checkpoint against the resulting head, and finish reviewing batch-first calculations and coordinated backup/restore on a disposable copy. No live data was touched.

## Phase 2 implementation checkpoint (2026-10-23): shared inventory locking and backup completeness

- Added a database-enforced egg-inventory lock using the farm-scoped unique DataStore key. Incubation writes, egg-log creation/deletion, batch deletion, batch import-all/wipe-all, and full backup/restore coordinate through this lock. Contending requests fail closed with HTTP 409 (`EGG_INVENTORY_BUSY`) rather than validating against a moving supply snapshot.
- The lock is cross-process because MongoDB's unique farm/key index arbitrates acquisition; it is not an in-process mutex. The lock intentionally has no expiry, to avoid unsafe lease expiry while an operation is still running. If a process crashes while holding it, an owner/operator must confirm no inventory operation is active before manually removing the `__flock_egg_inventory_lock__` sentinel for the affected farm. This recovery procedure must be documented for deployment.
- Full backup snapshots now include `batchEggLogs` and `batchVaccinationLogs`, and auto-restore restores those collections when present. Backup collection locks all current farm inventories; restore locks the union of current farms and farm IDs in the backup before replacing buckets/collections. Old backups without the new arrays remain readable and leave those newer collections unchanged.
- Health now presents batch vaccination event count, recorded bird-dose entries and vaccine spend. Monthly Summary labels the batch financial figures as all-time totals, avoiding confusion with the separately selected legacy-bird report period.
- Added unit coverage for lock contention, idempotent release, multi-farm lock acquisition/rollback and the inventory coordination contract. Added route-level tests for the incubation PUT handler: valid allocation save/release, contention rejection, and over-allocation rejection. These tests have been authored but **not executed in this session**.
- Remaining verification is deliberately local: run the full test/build/check commands after pulling this branch, review any failures, and test full backup/restore using a disposable database copy. No production database or live records were touched. GitHub Actions remains manual-only and could not be dispatched through the connected tools.
- Final farm-scope review found that the new batch egg-log and vaccination-log models were not yet included in Flock's scoped-model registry. Added both models to backend initialization and the MUF farm-scoping registry, so their queries inherit the selected farm context. Added `docs/FLOCK_EGG_INVENTORY_LOCK.md` with a manual, fail-closed stale-lock recovery procedure.
- The in-memory development adapter does not enforce compound unique indexes, so the lock helper now also guards each farm with a process-local set. MongoDB remains the cross-process authority in deployed mode; a regression test covers the in-memory fallback.
- Extended the same shared lock to `laborAttendance` writes, closing the matching race where batch deletion/replacement could check for linked labor history immediately before a concurrent attendance save.
- Extended route-level regression coverage to verify `laborAttendance` writes also acquire and release the shared lock.

- Finished the main-navigation restructure: Batches, Dashboard, Health, Labor, Incubation and Summary are now primary tabs. Health and Summary have dedicated batch-first portals; the previous bird-led health and monthly-report views remain under Home Birds as Vaccination and Monthly Report. Home Birds is limited to Bird List, Eggs, Monthly Report and Vaccination, with bird details reached from Bird List.
- The Health portal derives batch vaccination and mortality activity from batch detail APIs. The main Summary uses batch revenue, cost, profit/loss and net egg availability; the legacy Home Birds monthly report remains available separately rather than being silently deleted.
- The new batch-first Health portal now reports partial batch-detail failures instead of silently presenting incomplete activity; its totals use all loaded history while the feed shows the 20 most recent events.
- Removed the duplicate batch-financial panel from Home Birds Monthly Report after creating the dedicated top-level batch Summary. The Home Birds report remains focused on individual home-bird records; historical data and calculations are retained.


## Owner verification checkpoint and next actions (2026-10-23)

The owner pulled commit `e49317e` and ran the local checks. These are owner-reported results, not CI results:

- Root `npm test`: **114 passed, 1 failed** across 15 test files. The failing test incorrectly expected 110 incubation eggs to be accepted when net supply is 100. The validator's rejection is correct; the regression test is corrected to accept exactly 100 and reject 101 even when a legacy log has negative net values.
- `npm run check-farms`: Agri and Dairy passed. Flock reported failures for legacy admin/owner role mapping, old-screen role compatibility, farm migration setup, then crashed while reading the missing farms array. The farm-scope harness now stops after a failed login/setup and prints the HTTP status and response, rather than cascading into an unhelpful TypeError. **This is diagnostic hardening, not proof that the underlying Flock failure is fixed.**
- `npm run check-sync`, `npm run check-ui`, `npm run check-workbench`: passed.
- Flock client `npm run build`: passed; Vite warned that the main JavaScript chunk exceeds 500 kB.
- `npm ci` reported audit findings: root 5 (1 moderate, 2 high, 2 critical), Flock backend 6 (4 moderate, 2 high), Flock client 3 (2 high, 1 critical). Counts may overlap across dependency trees. Review with targeted updates; do not run `npm audit fix --force` blindly.

### Immediate gate before Phase 2 sign-off

1. Pull the latest `muf-monorepo` branch and rerun the root test and farm-scope check. Capture the new Flock login/farms diagnostic if it still fails.
2. Fix the actual Flock startup/login/farm migration defect exposed by that diagnostic; do not weaken role or isolation assertions to make the check green.
3. Run inventory-lock concurrency tests against a disposable real MongoDB database, including concurrent incubation saves, an incubation save racing an egg-log deletion, lock cleanup on success/failure, and two backend processes. Memory mode alone is not evidence of cross-process lock correctness.
4. Test backup/restore on a disposable database copy, including legacy backup payloads, all Phase 2 collections, IDs/relationships, and failure behavior. Never test destructive restore against production data.
5. Re-run all automated checks and builds, then manually trigger CI at the verification checkpoint. Record only checks that actually ran.
6. Only after those gates pass, mark Phase 2 verified and start Phase 3.

### Ongoing automation and documentation rule

Each implementation step must update both `PROGRESS.md` and `ROADMAP.md`, add or extend automated regression tests, and document exact Windows CMD commands and expected outcomes. Prefer tests for business rules, farm isolation, API contracts, concurrency, backup compatibility, and bulk/pagination limits. Do not mark a phase complete based on source inspection alone.


## Follow-up verification results (2026-10-23)

The owner pulled commit `566f3b2` and reran the requested checks:

- Root `npm test`: **15 test files passed, 115 tests passed**.
- `npm run check-sync`: passed.
- `npm run check-ui`: passed.
- `npm run check-workbench`: all 23 source checks passed.
- Flock client `npm run build`: passed TypeScript and Vite production build. Existing warning: main JS chunk is about 954 kB minified, above Vite's 500 kB advisory threshold.
- `npm run check-farms`: Agri and Dairy passed. Flock returned HTTP 503 with `Server is starting, please retry in a few seconds.` at login. Diagnosis: Flock's HTTP health route becomes available before its asynchronous DB connection, demo seed, and farm migration complete; the checker was racing initialization. This output is not evidence of an owner-role migration defect.

### Fix applied after the owner run

The farm-scope harness now retries login for up to 30 seconds only when it receives the exact known startup 503 response. Other HTTP failures are reported immediately and are not retried as startup. This preserves the role assertions and makes the integration check wait for actual app readiness.

Commit: `9a3eeb5` (`test(flock): wait for backend readiness in farm scope check`).

### Next verification required

Pull `9a3eeb5` and rerun `npm run check-farms`. If Flock then passes its owner-role and farm migration checks, the harness continues to exercise buckets, batches, linked logs, worker farm access and backup scope. If a different failure appears, fix that actual contract/security issue before Phase 2 sign-off.

The inventory lock still needs disposable-MongoDB concurrency verification, and Phase 2 backup/restore compatibility still needs a dedicated repeatable test. These are not proven by the current memory-mode HTTP test. Keep Phase 2 open until those gates are complete.


### Follow-up verification results: Flock backup assertion (2026-10-23)

The owner pulled the startup-retry fix and reran the checks. Root tests remain green (**115/115**), as do MUF sync, UI safety, and all 23 workbench source checks. Agri and Dairy farm-scope checks pass. Flock now reaches the backup assertion, where `owner backup includes both farms` fails; the earlier startup 503 is resolved.

Root cause found in the Flock development memory adapter: the shared egg-inventory lock's release path calls Mongoose's `findOneAndDelete`, but the adapter did not implement that method. The backup route acquires locks for all farms and releases them in a `finally` block, so this missing adapter method causes the otherwise-built backup request to fail in the memory-mode integration check. Added `findOneAndDelete(filter)` to the memory adapter, with the same filter semantics and returned deleted document as the adapter's other delete methods.

Fix commit: `1d71319` (`fix(flock): support findOneAndDelete in memory adapter`).

**Awaiting owner verification:** pull the latest `muf-monorepo` branch and rerun `npm run check-farms`. This is an implementation diagnosis, not a claimed test pass. The HTTP farm-scope check exercises the backup path and lock release in memory mode, but it does not replace the required real-MongoDB multi-process concurrency test or disposable-database backup/restore compatibility test.


## Owner verification checkpoint and Phase 3 start (2026-10-23)

The owner confirmed the local checkout uses memory mode and contains no real farm data; the live websites use their own MongoDB deployments. The latest local verification reported:

- `npm run check-farms`: all Agri, Flock and Dairy farm-scope checks passed.
- `npm test`: 15 test files, 115 tests passed.
- `npm run check-sync`: all shared MUF and cross-app parity checks passed.
- `npm run check-ui`: all UI safety checks passed.
- `npm run check-workbench`: all 23 source checks passed.
- `flock_farm/client npm run build`: TypeScript and Vite build passed. Vite emitted a non-fatal large-chunk warning for the ~954 kB main JS bundle.

These results validate the local memory-mode test run only. They do not exercise live MongoDB, and no live data was intentionally accessed by these commands. Before any Mongo integration test, the test harness must fail closed unless its URI/database name is explicitly identified as a disposable test target; never use the production website URI.

**Phase 2 status:** owner-reported local checks are green. Final sign-off remains pending isolated real-MongoDB multi-process inventory-lock tests and backup/restore compatibility tests on a disposable database copy. This does not block planning and test-first implementation of Phase 3.

**Phase 3 started:** expanded `ROADMAP.md` with a staged, test-first plan for server-side pagination/filtering, scroll loading, farm-scoped totals, bulk entry/import, and 1,000-row scale fixtures. The first code step is to define and test a reusable pagination contract and prove it on one representative list endpoint before rolling the pattern across Dairy, Flock and Agri. Existing single-record flows must remain compatible; server-side farm scope must be applied before filtering, totals, and pagination.

Roadmap update commit: `e4411d0`. No application code changed in this documentation step; no tests were run for it.


### Phase 3 step 1: opt-in paginated Dairy list APIs (2026-10-23)

Implemented the first bounded-pagination contract and wired it into Dairy cow and milk list routes:

- New `parsePagePagination` helper uses 1-based pages, a default page size of 50, a maximum page size of 200, and rejects invalid/unsafe page or limit values.
- `GET /api/cows?page=N` and `GET /api/milk?page=N` now use stable sort keys, run a matching `countDocuments` query, and expose `X-Total-Count`, `X-Page`, `X-Page-Size`, and `X-Total-Pages` response headers.
- The farm-scoped model wrapper applies the request's farm filter to both list and count operations. Browser clients are explicitly allowed to read the pagination headers.
- Legacy requests without `page` keep the existing array response and skip/limit behavior. No frontend has been switched to paging yet, so this is additive.

Added `tests/phase3-pagination.test.ts` with cases for legacy compatibility, 1-based offsets, default and capped limits, invalid values, overflow protection, and source contracts for the two routes.

Relevant commits: `df43183`, `f64cb48`, `17b0c9f`, `87f3781`, `70fbd2b`, `ea5fd3d`, `f030d66`.

**Verification status:** tests/builds have not been run after these commits in the owner's local checkout. The owner must pull the latest branch and run `npm test` and the Dairy backend/client build before this step is considered verified. Next implementation step after that checkpoint: switch one Dairy list UI to request pages and append results with loading/error/empty states, then generalize the proven pattern.


## Owner verification and follow-on implementation (2026-10-23)

The owner pulled commit `5f7a963` and reported the following local results: `npm test` passed **130 tests across 16 files**; `check-farms`, `check-sync`, `check-ui`, and `check-workbench` passed; the Dairy client TypeScript check and production build passed. The build emitted non-fatal warnings for large JS chunks and mixed static/dynamic imports of `api.ts`. These checks do not cover real-MongoDB cross-process locking, disposable-database backup/restore, or browser-level review.

### Phase 3: pagination hardening

- Hardened page/limit parsing to reject array-valued query parameters instead of coercing them into numbers. Replaced CommonJS `require/__dirname` usage in the Vitest source-contract test with ESM-safe `node:fs` and `import.meta.url` path resolution.
- Added tests for array-valued page and limit parameters.
- Verification: these new changes have not been executed in the owner's local environment yet.

### Phase 4: breeding lineage foundation

- Added optional cow ear-tag and sire-lineage fields: `earTag`, `fatherId`, `fatherType` (`farm` or `outside`) and `fatherName`. Added a farm-scoped unique partial MongoDB index for non-empty ear tags, so old records without tags are unaffected.
- These fields are additive; no existing record is rewritten. Full Phase 4 still requires sire selection/validation in the UI, automatic calf creation/lineage tests, and the Agri Field/Crop-cycle structure. The unique index has not been verified against a disposable MongoDB copy; if legacy data already contains duplicate non-empty ear tags within a farm, index creation will warn and must be resolved on a copy before rollout.


### Phase 4 test coverage added (2026-10-23)

Added `tests/phase4-breeding-lineage.test.ts` to guard the additive sire/ear-tag schema fields, farm-scoped partial unique index, and backward compatibility for records without lineage values. These are source-contract tests only; they do not prove MongoDB index creation or reject duplicate tags at runtime. Disposable-database index verification and actual sire-selection/API validation remain required.


### Phase 3 follow-on (2026-10-23): additional Flock bulk-log API

- Added a bounded per-batch bulk endpoint for feed, weight, vaccination and expense logs. Requests are capped at 200 rows, all entries are validated before the first write, batch existence/open status is checked, and the batch's farm ID is attached server-side. Unsupported types are rejected.
- Kept mortality and sales on their single-row endpoints because those operations depend on the remaining live-bird count and require sequential checks. Egg bulk entry continues to use the inventory lock.
- Added a client API wrapper and contract coverage, including a 1,000-row paging fixture. These tests are source/fixture checks and do not replace API integration tests or browser validation.
- Commit sequence: `83f2759` (route), `b6e56ec` (client API), `3af8f5a` (tests).
- Not yet complete: bulk CSV controls for the new log types, Agri user-driven incremental loading and bulk/import UI, Excel workbook import, and stronger 1,000-row server/API plus farm-isolation integration fixtures. Do not treat Phase 3 as complete yet.


### Phase 3 Flock CSV workflow follow-up (2026-10-23)

- Added preview-first CSV import controls in the Flock batch detail UI for feed, weight, vaccination and expense logs, wired to the bounded bulk API. The parser caps files at 2 MB and 1,000 data rows, checks required columns, validates each row, and blocks submission while any preview row is invalid. Writes are sent in chunks of at most 200.
- Added source-contract coverage for the additional import controls. These changes have not yet been built or tested in a local checkout; the owner should pull the branch and run the full checks before treating them as verified.
- New commits: `7a7175c` (UI import), `b27a78e` (test).
- Remaining Phase 3 work still includes Agri incremental UI and bulk/import workflows, Excel workbook import, stronger real route/API scale and farm-isolation tests, and a full verification pass. Mortality and sale CSV bulk import is intentionally not exposed because these records depend on sequential live-bird validation.


### Phase 3 Agri list rendering and scale fixtures (2026-10-23)

- Agri crop and task cards now render in chunks of 40 with Load More controls. The underlying complete arrays remain intact for dashboard calculations, crop selectors and report totals; this is incremental rendering, not yet network-level lazy loading.
- Added regression/source-contract checks for Agri list pagination headers, worker crop visibility, finance admin-only access, preserved aggregate inputs, and stable paging of a 1,250-row fixture.
- Commits: `20a94e7` (Agri incremental card rendering), `fd45009` (tests).
- Verification has not been run against this commit batch. The source-contract and synthetic fixture tests do not replace live route integration tests.
- Phase 3 is still open: Agri needs network-level Load More with correct full-dataset summary totals, preview-first CSV bulk import workflows, and Excel workbook parsing/import. Stronger farm-isolation and real route/API scale fixtures also remain. No production database was accessed.
