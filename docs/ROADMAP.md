# Roadmap

Last reviewed: 2026-10-23. CI is manual-only and should run at deliberate testing checkpoints, not on every commit. Owner-reported local checks before the latest Dashboard change: all three frontend builds, farm-scope checks, MUF sync checks, UI safety checks, 89 unit tests and 8 workbench runtime checks passed. The latest Dashboard batch-first change has not yet been built or tested. Per owner direction, browser and end-to-end role testing will be consolidated into one final verification pass after all planned phases. Migration dry-runs on database copies remain required before any production migration. This roadmap replaces the old UI-modernization roadmap. The design-system work (MUF phases 6 to 12) is finished and lives on `main`; what is planned now is the scale-up of the three apps.

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
| 2 | Flock restructure: Batches become the main project, Home Birds becomes a small tab | Flock | In progress; batch API logs/calculations and a Dashboard batch-first overview are implemented; Health has a batch-vaccination overview but still needs broader batch-first workflow review; Summary has a batch-financial overview, while Labor and Incubation still need explicit batch-workflow integration and safe egg traceability; checks pending |
| 3 | Bulk entry, scroll loading, server-side totals | Dairy, Flock, then Agri | Medium |
| 4 | Dairy breeding and father records; Agri fields and seasons | Dairy, Agri | Medium to high |
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

### Phase 3: Bulk entry, scroll loading, server totals

- Dairy: milk sheet, bulk health, CSV/Excel import. Flock: bulk entry per batch, import. Agri: scroll loading with server filters by farm, season and status.
- Lists load as you scroll with search and filters; profit and summary screens use server totals (selected farm, or all farms).
- Done when: a 1,000-row test sheet saves in one request and the heavy screens stay fast with test data.

### Phase 4: Dairy breeding and Agri structure

- Dairy: breeding events, automatic calf creation with gender and mother/father links (farm bull or outside straw), ear tag unique per farm.
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
