# Roadmap

Last reviewed: 2026-10-23. Phase 1B-2 implementation is underway on `muf-monorepo`; it is not delivered until checks and copy-based migration testing are recorded. This roadmap replaces the old UI-modernization roadmap. The design-system work (MUF phases 6 to 12) is finished and lives on `main`; what is planned now is the scale-up of the three apps.

The system being built is described in [FARMS_AND_ROLES.md](FARMS_AND_ROLES.md). Status is in [PROGRESS.md](PROGRESS.md).

## How every phase runs

1. Claude sends a read-only plan: files, collections and migration steps. No code yet.
2. The owner approves, changes or rejects the plan.
3. Claude delivers the change as one zip, and runs the checks that can run, reporting honestly which did and did not.
4. The owner takes a backup, tries it on a copy, tests in the browser, and only then applies it to live data.
5. The result is recorded in `PROGRESS.md`. The next phase does not start until the owner says so.

Rules for every phase come from `RULES.md`: back up before migrations, ask before removing anything, keep the three projects separate, keep shared MUF files identical.

## Phases

| Phase | What | Projects | Risk |
|---|---|---|---|
| 0 | Docs reset and repository cleanup | Repository | Low (done, see PROGRESS) |
| 1 | Farms and roles in the MUF layer (1A Dairy backend, 1B-1 Agri backend, 1B-2 Flock backend, 1C screens, 1D wrap-up) | Agri, Dairy, Flock | High (migration of live data) |
| 2 | Flock restructure: Batches become the main project, Home Birds becomes a small tab | Flock | High |
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
- **1D:** wrap-up: migration dry runs on copies, docs, CI job for `check-farms`.

- A `farms` collection per project; a `farmId` on every farm-owned record; indexes led by `farmId`.
- Roles `owner`, `manager`, `worker`, each user with assigned farms; scope enforced on the server.
- Header farm switcher and a "Farms & Access" popup (owner only): add, rename, archive, delete, assign users.
- Migration script: "Farm 1", tag all records, convert admin to owner, assign workers. Re-runnable, tested on a copy, backup first.
- Shared files per `FARMS_AND_ROLES.md` section 6; extend `check-muf-sync.js`; new tests for scope and roles.
- The plan must list every collection and decide farm-owned versus global.
- Done when: migration passes on a copy of each project's data, a worker cannot reach another farm through the API, the three builds pass, and the owner confirms in the browser.

### Phase 2: Flock restructure

- Batches become the main project: daily eggs, deaths, feed and weight per batch; one vaccination record per batch; profit and loss per batch and per farm.
- Old per-bird system becomes the slim **Home Birds** tab.
- Move the old big-list data into collections with `farmId` and `batchId`.
- The plan must list exactly which Home Birds features are kept and which are removed.
- Done when: migration passes on a copy, the old data is intact under Home Birds and Batches, and the owner confirms.

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
