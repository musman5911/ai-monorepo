# Progress

What is done, what remains and what is next for the scale-up project. Keep this file up to date after every change.
Last updated: 2026-10-23 (Dashboard, Health and Summary now expose batch-derived primary operational/financial panels; automated verification for this latest set is pending)

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
| 3. Bulk entry, scroll loading, server totals | Not started |
| 4. Dairy breeding; Agri fields and seasons | Not started |
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
