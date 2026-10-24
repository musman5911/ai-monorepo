## Phase 01 implementation follow-up (2026-10-24, latest source changes)

Flock image backup/restore now preserves Mongo image IDs, farm IDs, metadata and exact binary bytes using Base64 in portable JSON; monthly auto-backups store image data in bounded sidecar chunks and reconstruct it before restore. The shared owner farm-management UI now offers permanent deletion only after a fresh backup download starts, typed-name confirmation, and an explicit move-or-delete data choice. Server-side farm deletion checks remain authoritative. Automated regression tests were added for binary round-trips and chunk integrity. These latest changes still need root tests and all three production builds rerun against this exact branch head. Browser role checks and real MongoDB/disposable-copy validation remain postponed to the consolidated final pass.

# Roadmap
Last reviewed: 2026-10-24. Agri now has a farm-scoped analytics summary endpoint and summary-first frontend refresh, with full details retained for workspaces that require them. The new code and regression coverage still need the owner's local test/build run. GitHub Actions remains manual-only; do not start a run on every commit. This roadmap replaces the old UI-modernization roadmap. The design-system work (MUF phases 6 to 12) is finished and lives on `main`; the roadmap below covers scale-up work for the three apps.

## Verification timing policy (owner decision)

For **every planned phase (0 through 7)**, browser/live UI testing (including all role walkthroughs) and every real-MongoDB or database-copy test are **POSTPONED until one consolidated project-wide verification pass after all planned phases have implementation complete**. This includes multi-process MongoDB concurrency, index/migration validation, disposable-copy backup/restore and final browser role checks. These checks do not block individual phase implementation, and must not be run independently for a phase. Never run verification against production data.

Per-phase work must still use local automated tests, memory-mode HTTP integration fixtures, source/safety checks, shared-file parity checks and frontend production builds. Those checks are not postponed. At the final checkpoint, run the combined browser/role matrix and isolated real-database/disposable-copy suite, record exact results, and only then close the related verification gates. This decision supersedes older historical notes below that describe browser or real-MongoDB checks as immediate per-phase blockers.

## Latest local checkpoint (2026-10-24)

- The owner's latest run after pulling dbc41f4 reported 204/205 tests passing. The one remaining failure was a stale Flock duplicate-date label assertion; it has been corrected to the current generic CSV/XLSX import wording.
- check-farms, check-sync, check-ui, check-workbench and check-workbench-runtime passed in that run.
- Dairy and Flock builds passed with non-fatal chunk/import warnings. Agri failed at App.tsx template literals where escaped backticks and interpolation markers caused a Vite invalid-Unicode-escape parse error. Those source expressions are corrected in the new commit but the build has not been rerun yet.
- Pull the repair and rerun the root suite and all three app builds. Browser/live UI and real-MongoDB/database-copy checks remain postponed to the consolidated final pass and are not counted as unfinished phase implementation.

### Phase 3 step: Agri task and finance bulk imports

Added admin-only bulk endpoints and preview-first CSV/XLSX import UI for task and finance records. The endpoints reject malformed rows before writing, enforce a 200-record request cap, and restrict finance imports to an explicit field allowlist and validate crop/inventory references against the selected farm. The frontend accepts up to 1,000 rows per file and submits sequential chunks of at most 200, reporting failed chunks without automatically retrying them. The XLSX parser now resolves the actual first worksheet through workbook relationships and bounds archive/file sizes. Source-contract tests and the memory-mode HTTP farm-scope checker cover validation and cross-farm visibility, but local tests, production build and browser review remain pending.

The Agri crop/task/ledger lists use server-side paging and filters. The new authenticated `/analytics/summary` route returns farm-scoped crop/task/finance aggregates, monthly trends, profitability and bounded recent rows without returning photo blobs. The frontend uses these summaries for dashboard/report totals and loads full detail arrays only in the non-ledger finance and Labor workspaces. Runtime tests now cover summary accuracy, selected-farm isolation, worker finance redaction and cross-farm bulk task/finance rejection. This code has not yet been verified by the owner's local test/build run. Keep Phase 3 open until local automated gates, paging/import/summary regression fixtures and all three frontend builds pass. Browser and real-MongoDB/database-copy checks are postponed to the final project-wide pass.

The system being built is described in [FARMS_AND_ROLES.md](FARMS_AND_ROLES.md). Status is in [PROGRESS.md](PROGRESS.md).

## How every phase runs

1. Work directly on the `muf-monorepo` branch in small, ordered implementation steps; do not modify `main`.
2. Continue through the approved roadmap without asking for repeated approval. Inspect existing schemas, APIs and data flows before changing them; preserve historical data unless a safe replacement is explicit.
3. Update both `PROGRESS.md` and `ROADMAP.md` after each work step, and state clearly what is implemented versus verified.
4. GitHub Actions is manual-only (`workflow_dispatch`). Do not run a workflow for every commit. Trigger it deliberately at a useful testing checkpoint, and report only checks that actually ran.
5. For data/migration changes, use disposable database copies and backups at the final verification checkpoint only. Never run migrations against live data. All browser/live UI and real-MongoDB/database-copy checks across every phase are postponed to one consolidated project-wide pass after all planned phases have implementation complete.

Rules for every phase come from `RULES.md`: back up before migrations, ask before removing anything, keep the three projects separate, keep shared MUF files identical.

## Phase 01 implementation follow-up (2026-10-24)

Current follow-up status: Agri DiaryMedia and Dairy supplier/payment backup registries have been added; owner All farms read-only selector is now present in all three clients; farm-first compound index definitions have been added. Remaining implementation blockers are Flock image binary backup/restore and the backup-first permanent deletion UI. Root tests and all three frontend builds must be rerun after these edits. Real MongoDB index/restore checks and browser role walkthroughs remain postponed until the consolidated final pass.

## Phases

| Phase | What | Projects | Risk |
|---|---|---|---|
| 0 | Docs reset and repository cleanup | Repository | Low (done, see PROGRESS) |
| 1 | Farms and roles in the MUF layer (1A Dairy backend, 1B-1 Agri backend, 1B-2 Flock backend, 1C screens, 1D migration/CI wrap-up) | Agri, Dairy, Flock | Implementation delivered in source; check-farms, MUF parity and UI-safety checks passed in the 2026-10-24 capture. Production builds are not shown in that capture. Migration/backup on database copies and the final browser-role pass are postponed, not current implementation blockers |
| 2 | Flock restructure: Batches become the main project, Home Birds becomes a small tab | Flock | Core restructure, batch logs, allocation checks and shared inventory locking are implemented. Remaining implementation: make Dashboard/Health/Summary truly batch-first, complete the batch-linked Labor workflow, and protect existing incubation allocations from egg-log edits. Local tests/builds remain gates; real-MongoDB concurrency and database-copy backup/restore are postponed |
| 3 | Bulk entry, scroll loading, server-side totals | Dairy, Flock, then Agri | Implementation scope is in place, but the captured pre-repair root suite reported 202/205 tests passing. Two source-contract assertions and one cross-farm test fixture are corrected; rerun the root suite, checks and all three production builds before sign-off. Browser/live UI and real-MongoDB/database-copy checks are postponed |
| 4 | Dairy breeding and father records; Agri fields and seasons | Dairy, Agri | In progress: optional cow lineage fields and ear-tag index added; workflows remain. Real-MongoDB index verification is postponed to the final project-wide pass |
| 5 | Photo storage adapter and Cloudinary | All three | Medium |
| 6 | Super Admin upgrade (Owner-only, per-farm summaries) | All three | Low to medium |
| 7 | MU Farms shop | Parent | Medium |

### Phase 0: Docs reset and repository cleanup (done)

Removed the old progress, roadmap, deployment and audit documents, the screenshot-regression setup (it will be rebuilt after the screens settle), and the Playwright dependency. Wrote the new docs and updated `RULES.md`. Details and check results are in `PROGRESS.md`.

### Phase 1: Farms and roles

Built in four steps so each zip can be checked on its own. The design record is `PHASE1_PLAN.md`.

- **1A (delivered):** shared server core `muf-farms.mjs` in all three backends, wired fully into Dairy: farms collection, `farmId` on farm-owned records, the three roles, server-side scoping, farms API, owner-only backups, migration script, tests.
- **1B-1 (delivered):** the same core wired into the Agri backend: 14 farm-owned collections, three roles, farms API, owner-only backups, migration script, tests.
- **1B-2 (implementation delivered):** farm fields, Farm model/API, auth scope wiring, migration script and per-farm backup payload are in place. The captured check-farms run passes Flock farm-scoped HTTP/role checks alongside Dairy and Agri checks. Copy-based migration and backup/restore verification and the final browser/role review are postponed to the consolidated final pass.
- **1C:** screens in all three apps: header farm switcher, owner-only Farms & Access popup, role labels.
- **1D:** migration dry-runs on copies and CI job for `check-farms`. The cross-app browser/end-to-end role pass is consolidated at the end of all phases, not repeated after each phase.

- A `farms` collection per project; a `farmId` on every farm-owned record; indexes led by `farmId`.
- Roles `owner`, `manager`, `worker`, each user with assigned farms; scope enforced on the server.
- Header farm switcher and a "Farms & Access" popup (owner only): add, rename, archive, delete, assign users.
- Migration script: "Farm 1", tag all records, convert admin to owner, assign workers. Re-runnable, tested on a copy, backup first.
- Shared files per `FARMS_AND_ROLES.md` section 6; extend `check-muf-sync.js`; new tests for scope and roles.
- The plan must list every collection and decide farm-owned versus global.
- Local implementation gate: automated farm-scope/role tests and the three builds pass. Migration on disposable copies, backup/restore validation and browser/role confirmation are postponed to the final project-wide pass.

### Phase 2: Flock restructure

Owner-approved retained Home Birds scope: home-animal list/details, eggs, monthly reports and vaccination only. Other individual-bird workflow features can be removed from the Home Birds navigation/workflow where they are no longer needed, but historical data must not be silently deleted.

- **Implemented in source:** Batches is first and is the default after login. Home Birds exposes nested Bird List, Eggs, Monthly Report and Vaccination sections. Egg entry is constrained to egg production; its vaccination view hides mortality tools.
- **New step on 2026-10-23:** Dashboard loads active-batch count, live bird count, batch revenue, combined batch profit/loss and a short recent-batch list from the authenticated batch API. Health displays recent batch vaccination history by batch. Summary presents batch totals and per-batch profit/loss (`151cef0`); Labor displays batch workload/live-bird context (`553e44e`, type fix `3a1d451`); Incubation displays batch egg collection totals and states that egg transfer to incubation is not yet linked (`fc48ee6`). These are additive batch-derived panels, not full batch-first workflows; automated verification is pending.
- **Incubation source link/allocation:** Incubation records can optionally store and display a source batch ID, and the server validates linked allocations against net egg supply using the shared inventory lock. This is still not a physical egg transfer or separate egg ledger. An active implementation gap remains: egg-log edits must not reduce net supply below existing allocations. The real-MongoDB lock/concurrency and backup/restore checks are postponed to the final project-wide pass.
- **Implemented in source:** new per-batch egg and vaccination log models, authenticated API routes, frontend entry forms and history tables. Batch summary includes egg totals, egg income and vaccination costs, with egg income included in revenue/profit. Batch detail, export/import, deletion and wipe paths include the new collections.
- **CI passed:** GitHub Actions run [39906778407](https://github.com/musman5911/ai-monorepo/actions/runs/39906778407) completed successfully on commit `d63d719`; root tests, farm scope, MUF parity, UI safety, workbench checks/runtime, design audit and all three app builds passed. `tests/flock-batch-math.test.ts` was included in the passing root test run. Still required: inspect backup/restore compatibility and fix any failures. No migration has been run; new collections are additive, but copy-based backup/restore validation is still required.
- Browser and end-to-end role verification are deferred to the final pass after all phases, per owner direction.
- Local implementation gate: Batches is the primary workflow, Home Birds exposes only the approved features, and relevant automated checks/builds pass. Real-MongoDB concurrency and disposable-copy backup/restore are postponed to the final project-wide pass.

### Latest verification checkpoint (2026-10-23)

- The owner pulled through `d7321fb` and reported 151 passing tests in the latest console output. Because command output is interleaved, capture a clean standalone root `npm test` summary at the next checkpoint.
- `npm run check-farms`, `npm run check-sync`, `npm run check-ui`, and `npm run check-workbench` passed locally.
- Dairy, Flock and Agri production builds succeeded. Dairy's mixed static/dynamic import warning, Flock/Agri large-chunk warnings, and Agri's deprecated `advancedChunks` warning are advisory, not build failures.
- Phase 4 database/index validation is postponed to final project-wide verification. At that checkpoint, use a disposable database copy and first check for duplicate non-empty ear tags within each farm. Do not run production migrations or index builds.

### Phase 3: Bulk entry, scroll loading, server totals

### Phase 3 implementation update (2026-10-23): Dairy paging and bounded bulk milk entry

- Dairy Cows uses 50-row server pages, stable name/ID sorting, literal search, server-side batch/status/gender filtering, a separate farm-scoped count endpoint for global stat cards, and a separate eligible-mothers endpoint. The UI debounces search, appends pages, and deduplicates records.
- Dairy Milk History loads 50 rows initially and supports Load 50 More with stable server ordering and ID deduplication. A farm-scoped summary endpoint keeps count, total/saleable liters and revenue accurate across the full matching result set.
- Daily milk Save All uses an authenticated bulk endpoint in chunks of at most 200 entries. All rows in each chunk are validated before writes begin; malformed entries and duplicate cow/date pairs within a chunk are rejected. Per-row results are returned for partial failures.
- Preview-first CSV import is available for Dairy milk and health (1,000-row/file cap, 2 MB cap, row-level validation and 200-row write chunks). Health bulk writes attempt to roll back a health record if its linked expense cannot be saved.
- Flock batch listing supports 20-row pages and Load More; per-batch egg/feed/weight/vaccination/expense logs support bounded, preview-first CSV/XLSX imports using existing bulk APIs. Mortality and sales remain single-row because each depends on the live-bird count. Agri crop/task/finance APIs validate skip/limit, apply supported filters before counting, and expose stable page metadata. Crop/task screens request pages only as needed; ledger details page by crop/farm-wide group and finance type. Agri dashboard/report totals now come from a farm-scoped analytics summary; full details are fetched only for crop profiles and workspaces that need them. Dairy Health retains preview-first CSV import.
- Contract tests were added for page metadata, filtered cow paging, bulk bounds, partial-write reporting, and Flock memory-query pagination. The owner's first Phase 3 run exposed a missing Dairy milk CSV preview modal, unused Dairy rate state, a stale Flock pagination setter, and missing skip/limit behavior in the Flock memory query adapter. Fixes have been pushed; rerun the suite and builds before proceeding.
- The Flock API and UI support preview-first CSV/XLSX bulk entry for egg, feed, weight, vaccination and expense logs. Writes are bounded to 200 entries/request; imports cap CSV at 2 MB, XLSX at 5 MB and each file at 1,000 data rows. Mortality and sales remain single-row because each write depends on live-bird count.
- Agri crop/task cards use 40-row server pages and Load More; ledger detail pages by crop/farm-wide group and finance type. `/analytics/summary` supplies farm-scoped dashboard/report totals, monthly trends, income/expense breakdowns and crop profitability. The default refresh no longer downloads full finance/task ledgers; full details load for detail workspaces, and crop profile views fetch complete linked history on demand. Memory-mode runtime tests cover aggregate accuracy, farm isolation, worker finance redaction and cross-farm task/finance bulk rejection. New source/regression tests cover safe seed-ledger lookup and Flock XLSX import parsing. Remaining local gates: run root tests/checks and all three builds. Browser and real-MongoDB/database-copy validation remains postponed to the final project-wide pass.

**Status: Core Phase 2 restructure implemented; some batch-first workflow work remains.** Dashboard, Health and Summary still need to become primarily batch-driven rather than relying on supplementary batch panels alongside legacy-bird calculations; the batch-linked Labor workflow needs completion; and egg-log edits must not reduce supply below linked incubation allocations. Real-MongoDB concurrency and disposable-copy backup/restore are postponed to final project-wide verification, not counted as current implementation gaps.

Implementation order:

1. **Baseline and safety contract:** identify large lists, current request/response shapes, pagination/filter support, and write paths. Add tests before changing API behavior. Preserve existing single-record workflows.
2. **Server-side paging foundation:** shared per-app query parsing/validation for `page`, `limit`, sort and search/filter inputs where practical; hard cap page size; farm scoping must be applied before filters, counts and pagination. Return stable ordering and a consistent total count. Reject invalid inputs safely.
3. **Scroll loading:** implement incremental loading in Dairy and Flock lists, then Agri, with loading/empty/error states, deduplication, stable sort, filter reset and no cross-farm cache leakage.
4. **Server totals:** move heavy summary totals to farm-scoped aggregation endpoints, with selected-farm vs read-only All farms semantics. Test that totals agree with record fixtures and never count another farm's records.
5. **Bulk entry/import:** Dairy milk sheet and bulk health, Flock per-batch bulk entry, then CSV/Excel import with column validation, row-level errors and bounded payload sizes. Start with preview/validate before committing writes; bulk writes must be atomic where practical or report partial outcomes explicitly.
6. **Scale verification:** fixtures at 1,000+ rows; query/payload limits; pagination no gaps/duplicates under stable data; farm isolation for rows and totals; all three builds and shared-MUF checks. Add focused tests for each increment.

**Initial Phase 3 foundation (historical checkpoint):** the first step added opt-in paging for Dairy cow and milk APIs. Since then, all three projects have added paged list workflows, bounded bulk endpoints and import previews. The current Agri summary-first refresh and Flock CSV/XLSX import work are described above and await the owner's local test/build run. See `PROGRESS.md` for the chronology.

**Done when:** a 1,000-row import has a documented bounded request/response strategy; large lists load incrementally with server filters and stable totals; the three apps build; root, farm-scope, UI and MUF parity tests pass; and a 1,000-row fixture demonstrates acceptable behavior without loading the whole dataset into the browser.

### Phase 4: Dairy breeding and Agri structure

Browser/live UI and all real-MongoDB/database-copy checks for Phase 4 are postponed to the final project-wide verification pass; they are not per-phase blockers.

**First implementation slice (2026-10-23, local verification pending):** Dairy cow records now have additive `earTag`, `fatherId`, `fatherType` (`farm` or `outside`) and `fatherName` fields, with a partial unique index scoped by farm for non-empty ear tags. This preserves existing records that have no tag. Added source-contract tests in `tests/phase4-breeding-lineage.test.ts`. Index creation and duplicate-tag detection are postponed to final project-wide verification against a disposable MongoDB copy.

Remaining work:
- Dairy: sire selection and validation in the UI/API, breeding-event history, automatic calf creation with gender and mother/father links (farm bull or outside straw), tests for lineage and per-farm tag uniqueness.
- Agri: Farm → Field (acres) → Crop cycle (season); finance linked to farm, field and cycle; archive finished crops; data checks and indexes.

### Phase 5: Photo storage

Browser/live UI and all real-MongoDB/database-copy checks for Phase 5 are postponed to the final project-wide verification pass; they are not per-phase blockers.

- Add `muf-storage.mjs`: compression and size limits, delete photos with their record, clean up orphaned photos.
- Connect Cloudinary (Free plan; the owner created the account on 2026-10-22, not yet connected). Credentials go only in environment secrets.
- Done when: new photos go through the adapter in all three apps and old photos still display.

### Phase 6: Super Admin upgrade

Browser/live UI and all real-MongoDB/database-copy checks for Phase 6 are postponed to the final project-wide verification pass; they are not per-phase blockers.

- Make the existing tab Owner-only and show each project's farms separately from the existing `/api/farm-summary` endpoints.

### Phase 7: MU Farms shop

Browser/live UI and all real-MongoDB/database-copy checks for Phase 7 are postponed to the final project-wide verification pass; they are not per-phase blockers.

- One shop with Crops, Dairy and Poultry sections, and a "Publish to MU Farms" switch per product. Decide where it lives (a separate public section inside one app, or a free-subdomain site) before building.
- Dairy: a "List on MU Farms" option for milk or animals with no buyer.

## Carried over from the old roadmap

These are still open. Each needs the owner's approval before it starts.

| Item | What | Notes |
|---|---|---|
| A3 | Dependency security | Fresh audit of 2026-10-20 is recorded in `PROGRESS.md`. Shipped findings: Agri `axios` (high), `dompurify` (low) in all three. Fix with targeted `npm update`, never a blanket `npm audit fix`. Do before Phase 7 at the latest |
| G3 | Live deployment check | Run the smoke-test checklist in `DEPLOYMENT.md` for each Replit app; CI does not prove live behavior |
| A1 | Visual regression | The old screenshot setup was removed in Phase 0 because every screen will change. Rebuild after Phase 2 settles the screens |
| B1, B3, C5 | Owner visual review | Dairy field styling, micro-typography and Urdu labels: reviewed by source and tests only. Urdu fallback sweep covered named modules only |
| Vitest 5, Vite 8 | Major upgrades | Separate phase, after visual regression exists again |
| D1 | Dead code | Flock `ZakatSection` is defined and unused; owner confirms each deletion |

## Parked ideas

Not planned until the scale-up phases are done: lazy-loading PDF and charts (C1), right-to-left logical properties (C2), accessibility pass (C3), service-worker update prompt (C4), shared form, table and icon components, a component gallery in the workbench, splitting the large components (Agri `App.tsx`, Flock `App.tsx`), one real shared MUF package instead of three copies, and clearing Agri's type errors so `tsc` can join its build.

### Phase 1C implementation status (2026-10-23)

The first frontend integration adds a shared farm switcher to all three app headers and attaches the selected farm ID to API requests. The owner panel uses existing APIs for farm maintenance and role/farm assignment. Permanent deletion and “All farms” mode are intentionally not exposed.

Owner-reported local results before the latest Dashboard change: all three frontend builds, farm-scope, MUF-sync, UI-safety, 89 unit tests and 8 workbench runtime checks passed. The latest Dashboard change is not yet verified. Build warnings remain for large chunks and a mixed static/dynamic import; they did not fail the builds. Review actual endpoint compatibility and role-based access, then test migration dry-runs on database copies. Never run migrations against live data. Browser testing remains deferred until final review.

### Phase 2 implementation update (2026-10-23): server-enforced incubation allocation

Incubation records linked to a batch now pass server validation against egg supply in the selected farm. Availability is calculated from batch egg logs after sold, home-use and waste counts; all linked incubation records are summed before accepting a write. Unknown batches and over-allocation are rejected. Legacy unlinked records remain valid. The validator has six unit cases added, but no tests/build/workflow have been run for this update yet. Egg-log edits can still reduce supply below existing allocations, so stock reconciliation is not complete. Next: prevent that case, then implement real batch-linked labor assignments. GitHub Actions stays manual-only and should be triggered at the Phase 2 testing checkpoint, not on each commit.

### Phase 2 implementation update (2026-10-23): batch-linked labor and egg-history protection

Daily labor attendance can now be assigned to a batch, displays that assignment in history, and summarizes assigned workers by active batch for the selected month. Server validation rejects attendance writes linked to batches outside the active farm. Batch deletion is blocked while incubation or labor history references it; deleting an egg log is blocked if it would make current incubation allocations exceed remaining supply. Added validator unit tests for labor assignment and incubation allocation, but they have not yet been executed. The UI still needs a clear per-batch available-egg figure, and Dashboard/Health/Summary need a final review for batch-first workflows. The workflow remains manual-only; run it at the Phase 2 checkpoint, not per commit.

### Phase 2 implementation update (2026-10-23): available egg supply in incubation

Batch summary now includes net eggs after sales, home use and waste. Incubation shows net supply, linked allocations and estimated unallocated eggs by batch, including the current record's allocation when editing. Validator tests and a batch-math assertion were added, but tests/builds remain unrun. Remaining stock-integrity work includes preventing races between an incubation save and egg-log deletion with transaction or serialization support, plus integration coverage. This environment has no GitHub Actions workflow-dispatch action, so CI cannot be started directly here; keep the workflow manual-only and run it at the deliberate Phase 2 checkpoint.

### Phase 2 implementation update (2026-10-23): destructive batch replacement guards

Historical Phase 2 checkpoint (2026-10-23): import-all and wipe-all guards were added at this stage; the shared inventory lock and further regression tests were committed later. Current local tests/builds remain implementation gates. Real-MongoDB concurrency and coordinated backup/restore checks are postponed to the final project-wide pass.

### Phase 2 implementation update (2026-10-23): linked-history guard tests

Historical Phase 2 checkpoint (2026-10-23): pure linked-history guard tests were added here; later commits add shared inventory locking and route-level memory-mode regressions. Real-MongoDB concurrency and disposable-copy backup/restore are postponed to the final project-wide pass.

### Phase 2 implementation update (2026-10-23): allocation math consistency

Historical Phase 2 checkpoint (2026-10-23): that update added net-supply validation but still listed allocation/deletion race protection as open. Later commits implement the shared inventory lock and memory-mode route regressions. Real-MongoDB race/concurrency checks and disposable-copy backup/restore are postponed to final project-wide verification after every phase has implementation complete.

### Phase 2 verification checkpoint (2026-10-23): atomicity and current-test evidence

Historical Phase 2 checkpoint (2026-10-23): later commits implemented shared farm-scoped inventory locking and memory-mode route coverage. Current local unit/source/build checks continue per phase. Real-MongoDB concurrency, final browser role review and disposable-copy backup/restore are postponed to the final project-wide pass; this older checkpoint is not the current status.

### Phase 2 implementation checkpoint (2026-10-23): inventory coordination and backup completeness

- Incubation allocation writes, batch egg-log creation/deletion, batch deletion and destructive batch replacement now share a farm-scoped MongoDB-unique lock. Whole-database backup and auto-restore acquire the lock set for the farms involved. Conflicting requests receive a retryable 409 instead of racing inventory validation.
- The lock is intentionally non-expiring so a slow process cannot outlive a lease and continue mutating inventory. If a server crashes while holding the sentinel, confirm all inventory operations are stopped before removing that farm's `__flock_egg_inventory_lock__` DataStore record. This fail-closed recovery needs to be included in deployment runbooks.
- Full backup/restore now includes batch egg logs and batch vaccination logs. Old backups without these arrays remain accepted; restore leaves those collections unchanged for old payloads.
- Added unit tests for lock lifecycle and multi-farm acquisition, an allocation coordination contract test, and route-level tests for the incubation save path. They have not been run here. Phase 2 remains open for local root tests, all three frontend builds/source guards, and a backup/restore dry run against a disposable copy. Do not use live data for that dry run.
- Final scoping review added the batch egg-log and vaccination-log models to Flock's server-enforced farm-scoped registry. The lock recovery runbook is `docs/FLOCK_EGG_INVENTORY_LOCK.md`. Local checks remain required; this is implementation status, not a test-pass claim.
- The memory-mode adapter lacks compound-index enforcement, so the lock helper also applies a per-process farm guard for local development. Deployed MongoDB uses the persisted unique key to coordinate across processes. See `docs/FLOCK_EGG_INVENTORY_LOCK.md` for stale-lock recovery.
- The shared lock also covers labor-attendance bucket writes so batch deletion/replacement cannot race a new batch-linked attendance record.
- Route-level tests now cover both incubation allocation writes and batch-linked labor-attendance writes against the shared lock helper.

- Main navigation now exposes Batches, Dashboard, Health, Labor, Incubation and Summary. Dedicated batch-first Health and Summary portals are separate from the smaller Home Birds workflows; the legacy bird-led monthly report and vaccination tracker remain under Home Birds.
- Batch Health displays the 20 most recent batch vaccination/mortality events and computes headline totals from the full loaded history, with a visible warning when any batch detail could not be loaded.
- The Home Birds Monthly Report is now bird-focused again; batch financials live in the dedicated top-level Summary. No legacy bird report data was deleted.

## Verification checkpoint update (2026-10-23)

The owner's latest local run found one failing root test and a Flock farm-scope failure. The incubation test expectation was inconsistent with the implemented rule: 100 net eggs are available, so allocation 110 must be rejected. The test now checks that exactly 100 is accepted and that a malformed negative-net legacy log cannot make 101 available. The farm-scope harness now reports login/farm setup HTTP responses and exits that project check cleanly when setup fails; this improves diagnostics but does **not** mean the underlying Flock role/migration failure is fixed.

**Phase 2 remains in progress and is not signed off.** Required before Phase 3 starts:

- Root unit tests pass, including the corrected legacy egg-log regression.
- Flock farm-scope check passes without weakening authorization, role compatibility, or farm isolation assertions.
- Inventory-lock concurrency is verified against a disposable MongoDB instance, including concurrent writes and a second backend process.
- Phase 2 backup/restore passes on a disposable database copy, including old backup compatibility and linked batch, egg, vaccination, incubation and labor records.
- Shared-file parity, UI safety, workbench checks and the Flock build pass after the final fixes.
- CI is manually triggered at the deliberate checkpoint, and the exact commit and actual result are recorded.

For every following implementation step, update both this roadmap and `PROGRESS.md`, add/extend automated regression tests, and record reproducible Windows CMD commands. Phase 3 should include automated tests for bulk request validation, farm isolation in bulk reads/writes, pagination/filter correctness, server-side totals, and a 1,000-row save/performance fixture before its UI is considered done.

## Latest local verification update (2026-10-23)

The owner reports root unit tests passing (**115/115**), MUF sync/UI/workbench checks passing, and the Flock client production build passing. The farm-scope script passed Agri and Dairy but received Flock's intentional startup 503 at login: its HTTP health route can respond before asynchronous database initialization and farm migration finish.

The harness has been updated to retry only that exact startup response for up to 30 seconds; role checks remain strict and other failures remain visible. Commit: `9a3eeb5`. This change is awaiting the owner's local rerun.

**Historical Phase 2 checkpoint (2026-10-23):** that report listed real-MongoDB inventory-lock concurrency and disposable-copy backup/restore as pending. Per the 2026-10-24 owner decision, both checks are postponed to final project-wide verification after every phase has implementation complete.

### Latest verification update (2026-10-23): Flock backup path

The startup retry worked: Agri and Dairy farm-scope checks pass, and Flock progresses through bucket, batch, linked-log and worker checks. Its owner-backup assertion then fails. Root tests (115/115), MUF sync, UI safety and 23 workbench source checks pass.

This was a historical Phase 2 verification blocker identified at the 2026-10-23 checkpoint. Current owner direction postpones real-MongoDB concurrency and disposable-copy checks until the single final project-wide verification pass after all phases have implementation complete.

Historical next step at that checkpoint: pull and rerun local checks. Per the 2026-10-24 owner decision, real-MongoDB concurrency and disposable-copy backup/restore are postponed to the single final project-wide verification pass; Phase 3 implementation can progress while current local tests/builds are verified.

### Phase 3 implementation update (2026-10-23): Agri workbook imports and regression coverage
- Added bounded browser-native XLSX ZIP/XML parsing for the first worksheet, including shared strings, inline strings, sparse columns, basic booleans and Excel serial date normalization. Agri crop/task/finance imports use the parser; it has now been adapted for Flock batch egg/feed/weight/vaccination/expense previews too. Flock caps CSV at 2 MB, XLSX at 5 MB and each import at 1,000 data rows, with explicit preview/confirmation.
- Crop import converts an `area_acres` value to kanal before saving, rather than silently sending an unsupported field while applying the default area.
- Added parser regressions for CSV round-tripping, row limits, malformed workbook signatures, malformed row widths, and farm-scope helper behavior. Existing `tools/check-farm-scope.js` already exercises Agri record isolation over HTTP in memory mode.
- The earlier full-array startup blocker is addressed by the authenticated farm-scoped `/analytics/summary` endpoint. Dashboard/report totals, trends, breakdowns and crop profitability come from server summaries; full detail data loads for workspaces that require it, and crop profiles fetch complete linked finance/task history on demand. Added regression coverage validates summary totals, selected-farm isolation, cross-farm bulk rejection and safe seed-ledger lookup. Local tests/builds for this follow-up remain pending.
- Verification status: no tests or builds were executed by the GitHub file-editing session. Run the Windows checkpoint commands listed in `PROGRESS.md` before treating these changes as working.

Phase 3 implementation follow-up: commit `7245abb` adds a 1,001-row Agri task pagination integration test that creates data through the bulk API, validates page metadata and exact unique fixture coverage across real HTTP pages, and cleans up its fixture. Commit `3e50f9d` updates the workbench runtime smoke script to manage its local Vite server. Both changes are pending local execution. They strengthen verification but do not resolve the core Agri on-demand UI paging blocker.
