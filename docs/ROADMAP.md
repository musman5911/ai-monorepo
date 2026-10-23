# Roadmap
Last reviewed: 2026-10-23. CI is manual-only and should run at deliberate testing checkpoints, not on every commit. Owner verified commit `757e11e` locally: root `npm test` passed 186/186 tests across 21 files; the Agri runtime API integration file passed 6/6; Agri and Flock frontend production builds passed. Dairy frontend build and the farm/sync/UI/workbench checks have not yet been run at this checkpoint. Phase 2 real-MongoDB and disposable-copy verification remains deferred to the consolidated final pass. This roadmap replaces the old UI-modernization roadmap. The design-system work (MUF phases 6 to 12) is finished and lives on `main`; what is planned now is the scale-up of the three apps.

### Phase 3 step: Agri task and finance bulk imports

Added admin-only bulk endpoints and preview-first CSV/XLSX import UI for task and finance records. The endpoints reject malformed rows before writing, enforce a 200-record request cap, and restrict finance imports to an explicit field allowlist and validate crop/inventory references against the selected farm. The frontend accepts up to 1,000 rows per file and submits sequential chunks of at most 200, reporting failed chunks without automatically retrying them. The XLSX parser now resolves the actual first worksheet through workbook relationships and bounds archive/file sizes. Source-contract tests and the memory-mode HTTP farm-scope checker cover validation and cross-farm visibility, but local tests, production build and browser review remain pending.

The primary Phase 3 blocker remains true network-level Agri on-demand pagination with aggregate/report correctness. Adjacent-page HTTP tests and task bulk authorization/atomic-validation regression tests have been added, but no fresh test/build run is claimed. Owner verification on 2026-10-23 confirms the root test suite passes 186/186 tests across 21 files, the Agri runtime HTTP integration suite passes 6/6, and Agri and Flock production builds pass. Agri warns about deprecated `advancedChunks` and a >500 kB chunk; Flock warns about a >500 kB chunk. Owner subsequently passed `check-farms`, `check-sync`, `check-ui`, and all 23 `check-workbench` source checks. Dairy client build remains pending. `check-workbench-runtime` was attempted but correctly failed because the Dairy Vite dev server was not running at `127.0.0.1:5000`. Keep Phase 3 open until on-demand UI paging, large-dataset and cross-farm bulk fixtures, and the consolidated verification checkpoint are complete.


The system being built is described in [FARMS_AND_ROLES.md](FARMS_AND_ROLES.md). Status is in [PROGRESS.md](PROGRESS.md).

## How every phase runs

1. Work directly on the `muf-monorepo` branch in small, ordered implementation steps; do not modify `main`.
2. Continue through the approved roadmap without asking for repeated approval. Inspect existing schemas, APIs and data flows before changing them; preserve historical data unless a safe replacement is explicit.
3. Update both `PROGRESS.md` and `ROADMAP.md` after each work step, and state clearly what is implemented versus verified.
4. GitHub Actions is manual-only (`workflow_dispatch`). Do not run a workflow for every commit. Trigger it deliberately at a useful testing checkpoint, and report only checks that actually ran.
5. For data/migration changes, use disposable database copies and backups before considering any live application. Never run migrations against live data. Browser and end-to-end role testing are deferred to one consolidated final pass after all planned phases.

Rules for every phase come from `RULES.md`: back up before migrations, ask before removing anything, keep the three projects separate, keep shared MUF files identical.

## Phases

| Phase | What | Projects | Risk |
|---|---|---|---|
| 0 | Docs reset and repository cleanup | Repository | Low (done, see PROGRESS) |
| 1 | Farms and roles in the MUF layer (1A Dairy backend, 1B-1 Agri backend, 1B-2 Flock backend, 1C screens, 1D migration/CI wrap-up) | Agri, Dairy, Flock | Implementation done; copy-migration checks and final integrated browser pass pending |
| 2 | Flock restructure: Batches become the main project, Home Birds becomes a small tab | Flock | Implementation checkpoint delivered: batch-first panels, source-batch egg allocation validation, batch-linked labor, cross-process inventory locking, and complete batch backup fields. Local tests/builds and disposable-copy backup/restore verification are pending before phase sign-off |
| 3 | Bulk entry, scroll loading, server-side totals | Dairy, Flock, then Agri | In progress, not signed off. Dairy cow/milk paging and CSV imports, Flock batch paging and bulk CSV workflows, and Agri bounded crop/task/finance APIs are implemented. Agri has preview-first crop/task/finance CSV/XLSX workflows with bounded row/chunk sizes and row validation. Runtime HTTP tests now cover adjacent-page metadata/ID uniqueness and invalid/unauthorized task bulk writes. Remaining: wire Agri lists to genuine on-demand network paging without losing full dashboard/report totals; verify cross-farm isolation for bulk writes and aggregates with dedicated runtime fixtures; confirm Flock bulk-entry acceptance scope (CSV workflows are implemented; XLSX support needs an explicit requirement); run Dairy client build; start its Vite server and pass the workbench runtime smoke test; then complete browser role review and real-MongoDB/disposable-copy validation in the consolidated final pass. Browser role checks and real-MongoDB validation remain in the consolidated final pass. |
| 4 | Dairy breeding and father records; Agri fields and seasons | Dairy, Agri | In progress: optional cow lineage fields and ear-tag index added; workflows and disposable-MongoDB index verification remain |
| 5 | Photo storage adapter and Cloudinary | All three | Medium |
| 6 | Super Admin upgrade (Owner-only, per-farm summaries) | All three | Low to medium |
| 7 | MU Farms shop | Parent | Medium |

### Phase 0: Docs reset and repository cleanup (done)

Removed the old progress, roadmap, deployment and audit documents, the screenshot-regression setup (it will be rebuilt after the screens settle), and the Playwright dependency. Wrote the new docs and updated `RULES.md`. Details and check results are in `PROGRESS.md`.

### Phase 1: Farms and roles

Built in four steps so each zip can be checked on its own. The design record is `PHASE1_PLAN.md`.

- **1A (delivered):** shared server core `muf-farms.mjs` in all three backends, wired fully into Dairy: farms collection, `farmId` on farm-owned records, the three roles, server-side scoping, farms API, owner-only backups, migration script, tests.
- **1B-1 (delivered):** the same core wired into the Agri backend: 14 farm-owned collections, three roles, farms API, owner-only backups, migration script, tests.
- **1B-2 (in progress):** farm fields, `Farm` model/API, auth scope wiring, migration script and per-farm backup payload work have been committed. Still needs role/assignment review, complete backup/restore validation, Flock-specific HTTP scope checks, automated validation, and copy-based migration test before delivery. See `PHASE1_PLAN.md` and `PROGRESS.md`.
- **1C:** screens in all three apps: header farm switcher, owner-only Farms & Access popup, role labels.
- **1D:** migration dry-runs on copies and CI job for `check-farms`. The cross-app browser/end-to-end role pass is consolidated at the end of all phases, not repeated after each phase.

- A `farms` collection per project; a `farmId` on every farm-owned record; indexes led by `farmId`.
- Roles `owner`, `manager`, `worker`, each user with assigned farms; scope enforced on the server.
- Header farm switcher and a "Farms & Access" popup (owner only): add, rename, archive, delete, assign users.
- Migration script: "Farm 1", tag all records, convert admin to owner, assign workers. Re-runnable, tested on a copy, backup first.
- Shared files per `FARMS_AND_ROLES.md` section 6; extend `check-muf-sync.js`; new tests for scope and roles.
- The plan must list every collection and decide farm-owned versus global.
- Done when: migration passes on a copy of each project's data, a worker cannot reach another farm through the API, the three builds pass, and the owner confirms in the browser.

### Phase 2: Flock restructure

Owner-approved retained Home Birds scope: home-animal list/details, eggs, monthly reports and vaccination only. Other individual-bird workflow features can be removed from the Home Birds navigation/workflow where they are no longer needed, but historical data must not be silently deleted.

- **Implemented in source:** Batches is first and is the default after login. Home Birds exposes nested Bird List, Eggs, Monthly Report and Vaccination sections. Egg entry is constrained to egg production; its vaccination view hides mortality tools.
- **New step on 2026-10-23:** Dashboard loads active-batch count, live bird count, batch revenue, combined batch profit/loss and a short recent-batch list from the authenticated batch API. Health displays recent batch vaccination history by batch. Summary presents batch totals and per-batch profit/loss (`151cef0`); Labor displays batch workload/live-bird context (`553e44e`, type fix `3a1d451`); Incubation displays batch egg collection totals and states that egg transfer to incubation is not yet linked (`fc48ee6`). These are additive batch-derived panels, not full batch-first workflows; automated verification is pending.
- **Next implementation step:** Incubation records can now optionally store and display a source batch ID, including in the record list and detail view. Existing historical records remain valid without a source. This is provenance-only: egg stock is not reserved/deducted and no server-side allocation exists yet. No tests/build were run for this commit; run the manual CI workflow at a deliberate verification checkpoint.
- **Implemented in source:** new per-batch egg and vaccination log models, authenticated API routes, frontend entry forms and history tables. Batch summary includes egg totals, egg income and vaccination costs, with egg income included in revenue/profit. Batch detail, export/import, deletion and wipe paths include the new collections.
- **CI passed:** GitHub Actions run [39906778407](https://github.com/musman5911/ai-monorepo/actions/runs/39906778407) completed successfully on commit `d63d719`; root tests, farm scope, MUF parity, UI safety, workbench checks/runtime, design audit and all three app builds passed. `tests/flock-batch-math.test.ts` was included in the passing root test run. Still required: inspect backup/restore compatibility and fix any failures. No migration has been run; new collections are additive, but copy-based backup/restore validation is still required.
- Browser and end-to-end role verification are deferred to the final pass after all phases, per owner direction.
- Done when: Batches is the clear primary workflow, Home Birds exposes only the approved features, relevant automated checks pass, and any required copy-based migration/backup checks pass.

### Latest verification checkpoint (2026-10-23)

- The owner pulled through `d7321fb` and reported 151 passing tests in the latest console output. Because command output is interleaved, capture a clean standalone root `npm test` summary at the next checkpoint.
- `npm run check-farms`, `npm run check-sync`, `npm run check-ui`, and `npm run check-workbench` passed locally.
- Dairy, Flock and Agri production builds succeeded. Dairy's mixed static/dynamic import warning, Flock/Agri large-chunk warnings, and Agri's deprecated `advancedChunks` warning are advisory, not build failures.
- Do not run a production migration or index build to verify Phase 4. Use a disposable database copy and first check for duplicate non-empty ear tags within each farm.

### Phase 3: Bulk entry, scroll loading, server totals

### Phase 3 implementation update (2026-10-23): Dairy paging and bounded bulk milk entry

- Dairy Cows uses 50-row server pages, stable name/ID sorting, literal search, server-side batch/status/gender filtering, a separate farm-scoped count endpoint for global stat cards, and a separate eligible-mothers endpoint. The UI debounces search, appends pages, and deduplicates records.
- Dairy Milk History loads 50 rows initially and supports Load 50 More with stable server ordering and ID deduplication. A farm-scoped summary endpoint keeps count, total/saleable liters and revenue accurate across the full matching result set.
- Daily milk Save All uses an authenticated bulk endpoint in chunks of at most 200 entries. All rows in each chunk are validated before writes begin; malformed entries and duplicate cow/date pairs within a chunk are rejected. Per-row results are returned for partial failures.
- Preview-first CSV import is available for Dairy milk and health (1,000-row/file cap, 2 MB cap, row-level validation and 200-row write chunks). Health bulk writes attempt to roll back a health record if its linked expense cannot be saved.
- Flock batch listing now supports 20-row pages and Load More; batch egg logs have a lock-coordinated bulk endpoint and preview-first CSV import. Agri crop, finance and task list APIs validate skip/limit and expose stable sorting/page-count headers while preserving legacy array payloads; the Agri UI still fetches pages sequentially rather than offering a user-driven Load More. Dairy Health also has preview-first CSV import backed by the bulk health endpoint.
- Contract tests were added for page metadata, filtered cow paging, bulk bounds, partial-write reporting, and Flock memory-query pagination. The owner's first Phase 3 run exposed a missing Dairy milk CSV preview modal, unused Dairy rate state, a stale Flock pagination setter, and missing skip/limit behavior in the Flock memory query adapter. Fixes have been pushed; rerun the suite and builds before proceeding.
- The Flock API and UI now support preview-first CSV bulk entry for egg, feed, weight, vaccination and expense logs. Bulk writes are bounded to 200 entries per request and CSV previews are capped at 1,000 rows / 2 MB. Mortality and sales remain single-row only because each write depends on the live-bird count.
- Agri crop/task cards now render incrementally in chunks of 40 while preserving the full arrays used by totals and selectors. This reduces mounted UI nodes but is not network-level lazy loading. Remaining: implement network-level Agri Load More without breaking full-dataset totals; add Agri preview-first CSV bulk imports and Excel workbook parsing/import; and strengthen 1,000-row server/API fixtures for stable paging, farm isolation and totals. Run all tests and all three builds after the current implementation batch. Phase 3 remains in progress until these are complete.

**Status: implementation in progress (2026-10-23).** Per owner direction, Phase 2's real-MongoDB concurrency and disposable-copy backup/restore checks are deferred to the final verification pass after all phases. Continue Phase 3 implementation without accessing production data; Phase 2 is not being marked complete early.

Implementation order:

1. **Baseline and safety contract:** identify large lists, current request/response shapes, pagination/filter support, and write paths. Add tests before changing API behavior. Preserve existing single-record workflows.
2. **Server-side paging foundation:** shared per-app query parsing/validation for `page`, `limit`, sort and search/filter inputs where practical; hard cap page size; farm scoping must be applied before filters, counts and pagination. Return stable ordering and a consistent total count. Reject invalid inputs safely.
3. **Scroll loading:** implement incremental loading in Dairy and Flock lists, then Agri, with loading/empty/error states, deduplication, stable sort, filter reset and no cross-farm cache leakage.
4. **Server totals:** move heavy summary totals to farm-scoped aggregation endpoints, with selected-farm vs read-only All farms semantics. Test that totals agree with record fixtures and never count another farm's records.
5. **Bulk entry/import:** Dairy milk sheet and bulk health, Flock per-batch bulk entry, then CSV/Excel import with column validation, row-level errors and bounded payload sizes. Start with preview/validate before committing writes; bulk writes must be atomic where practical or report partial outcomes explicitly.
6. **Scale verification:** fixtures at 1,000+ rows; query/payload limits; pagination no gaps/duplicates under stable data; farm isolation for rows and totals; all three builds and shared-MUF checks. Add focused tests for each increment.

**Phase 3 first step (implemented; owner reported the initial test/build checkpoint passed):** added an opt-in 1-based paging contract to Dairy cow and milk list APIs. It validates page/limit, defaults to 50 rows, caps at 200, uses stable sort keys, returns total/page metadata headers, and retains legacy array behavior when `page` is omitted. Added `tests/phase3-pagination.test.ts`. Farm-scoped model wrappers scope both list and count queries. No frontend has been switched to paging yet. Pull and run tests/builds before continuing; next step is to wire one Dairy list UI to append pages with loading/error/empty states. See `PROGRESS.md` for commit references.

**Done when:** a 1,000-row import has a documented bounded request/response strategy; large lists load incrementally with server filters and stable totals; the three apps build; root, farm-scope, UI and MUF parity tests pass; and a 1,000-row fixture demonstrates acceptable behavior without loading the whole dataset into the browser.

### Phase 4: Dairy breeding and Agri structure

**First implementation slice (2026-10-23, local verification pending):** Dairy cow records now have additive `earTag`, `fatherId`, `fatherType` (`farm` or `outside`) and `fatherName` fields, with a partial unique index scoped by farm for non-empty ear tags. This preserves existing records that have no tag. Added source-contract tests in `tests/phase4-breeding-lineage.test.ts`. Before rollout, verify index creation against a disposable MongoDB copy and detect any existing duplicate tags within a farm.

Remaining work:
- Dairy: sire selection and validation in the UI/API, breeding-event history, automatic calf creation with gender and mother/father links (farm bull or outside straw), tests for lineage and per-farm tag uniqueness.
- Agri: Farm → Field (acres) → Crop cycle (season); finance linked to farm, field and cycle; archive finished crops; data checks and indexes.

### Phase 5: Photo storage

- Add `muf-storage.mjs`: compression and size limits, delete photos with their record, clean up orphaned photos.
- Connect Cloudinary (Free plan; the owner created the account on 2026-10-22, not yet connected). Credentials go only in environment secrets.
- Done when: new photos go through the adapter in all three apps and old photos still display.

### Phase 6: Super Admin upgrade

- Make the existing tab Owner-only and show each project's farms separately from the existing `/api/farm-summary` endpoints.

### Phase 7: MU Farms shop

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

Batch import-all and wipe-all now return HTTP 409 if incubation or labor attendance records reference a batch, preventing those bulk operations from silently orphaning history. A new batch-math test covers net egg availability after sales, home use and waste. These tests and builds remain unrun; the GitHub Actions connector cannot dispatch the manual workflow. Still open: race protection between allocation writes and egg-log deletion, concurrency/integration coverage, and coordinated full backup restore when linked history exists.


### Phase 2 implementation update (2026-10-23): linked-history guard tests

The import/wipe guard is now a pure tested helper with coverage for empty, incubation-linked and labor-linked history. The route uses the helper. Tests/builds remain unrun; manual workflow dispatch is unavailable through this connector. Allocation-vs-egg-log deletion race protection and integration coverage remain unresolved before Phase 2 can be considered fully verified.


### Phase 2 implementation update (2026-10-23): allocation math consistency

Incubation validation now clamps each egg-log's net supply at zero, matching the batch summary calculation and preventing negative-net legacy records from reducing valid supply on other dates. Added a regression unit test, not yet executed. Cross-request allocation/deletion concurrency and integration coverage remain open. The connected GitHub tools do not expose workflow dispatch, so the manual-only Actions checkpoint has not run; Phase 2 remains in progress until those risks and verification are addressed.


### Phase 2 verification checkpoint (2026-10-23): atomicity and current-test evidence

The Home Birds navigation is secondary and scoped to Bird List, Eggs, Monthly Report and Vaccination; bird details are reached from Bird List. Batch panels are present across the requested screens, but some legacy health/summary calculations still depend on individual-bird ledgers, so batch-first review is not complete. Allocation validation and egg-log deletion still need shared database atomic coordination and route-level integration tests. No simplistic in-process lock was added because it would not safely cover multiple server processes. The latest visible Actions success (`39909652206`, commit `6c7b3e95d5264f09e347ea66eb3d30e1ce77048c`) predates current changes and is not current verification. Workflow dispatch is unavailable through the connected GitHub tool. Phase 2 remains in progress until atomicity, integration tests, current Actions verification, and disposable-copy backup/restore validation are complete.

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

**Phase 2 is still open.** After the farm-scope check passes, remaining sign-off gates are real-MongoDB inventory-lock concurrency and repeatable backup/restore compatibility tests on disposable data. The Vite chunk-size warning is a performance follow-up, not the cause of the farm-scope failure.


### Latest verification update (2026-10-23): Flock backup path

The startup retry worked: Agri and Dairy farm-scope checks pass, and Flock progresses through bucket, batch, linked-log and worker checks. Its owner-backup assertion then fails. Root tests (115/115), MUF sync, UI safety and 23 workbench source checks pass.

The cause identified is a missing `findOneAndDelete` operation in Flock's in-memory Mongoose adapter, used by the shared egg-inventory lock cleanup in the backup route. Fix committed as `1d71319`. This is awaiting local verification; do not count Flock farm-scope as passed yet.

Next: pull and rerun `npm run check-farms`; if it passes, rerun the root checks and builds at the checkpoint. Real-MongoDB cross-process inventory concurrency and disposable-copy backup/restore compatibility remain mandatory before Phase 2 sign-off. Phase 3 stays blocked until all Phase 2 gates pass.


### Phase 3 implementation update (2026-10-23): Agri workbook imports and regression coverage
- Added browser-native XLSX ZIP/XML parsing for the first worksheet, including shared strings, inline strings, sparse columns, basic booleans, and Excel serial date normalization for plant/harvest dates. CSV and XLSX share the same preview, required-column checks, row-width validation, 1,000-row cap, 5 MB file cap, and explicit confirmation.
- Crop import converts an `area_acres` value to kanal before saving, rather than silently sending an unsupported field while applying the default area.
- Added parser regressions for CSV round-tripping, row limits, malformed workbook signatures, malformed row widths, and farm-scope helper behavior. Existing `tools/check-farm-scope.js` already exercises Agri record isolation over HTTP in memory mode.
- Not signed off: Agri still loads all crop/task/finance pages during refresh because dashboards and reports currently consume the full arrays. Changing those arrays to one page would silently break totals and report history. True list-on-demand loading needs a separate list state plus server-backed aggregate/report data or carefully deferred report fetches; this remains open rather than being mislabeled complete.
- Verification status: no tests or builds were executed by the GitHub file-editing session. Run the Windows checkpoint commands listed in `PROGRESS.md` before treating these changes as working.
