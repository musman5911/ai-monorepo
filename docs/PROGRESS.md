# Progress

Where the project stands, in one place. The detailed plan for each phase is in `docs/phases/`; the old dated log is kept unchanged in `docs/archive/`.

Last updated: 2026-10-26 (Phase 10 command-line scope completed; all three bundle budgets pass).

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
| 11 | Yearly archive for old records: server | Not started | [phase-11-yearly-archive-server.md](phases/phase-11-yearly-archive-server.md) |
| 12 | Yearly archive: screens | Not started | [phase-12-yearly-archive-screens.md](phases/phase-12-yearly-archive-screens.md) |
| 13 | Dependency security fixes | Not started | [phase-13-dependency-security.md](phases/phase-13-dependency-security.md) |
| 14 | Authorization and secrets review | Not started | [phase-14-authorization-and-secrets-review.md](phases/phase-14-authorization-and-secrets-review.md) |
| 15 | MU Farms: products and publish switch | Not started | [phase-15-mu-farms-product-data.md](phases/phase-15-mu-farms-product-data.md) |
| 16 | MU Farms: public shop | Not started | [phase-16-mu-farms-public-shop.md](phases/phase-16-mu-farms-public-shop.md) |
| 17 | Automatic command-line checks on GitHub | Not started | [phase-17-automatic-checks-ci.md](phases/phase-17-automatic-checks-ci.md) |
| 18 | Documentation and handoff | Not started | [phase-18-documentation-and-handoff.md](phases/phase-18-documentation-and-handoff.md) |
| 19 | Final testing A: real MongoDB | Not started | [phase-19-final-testing-database.md](phases/phase-19-final-testing-database.md) |
| 20 | Final testing B: browser and phones | Not started | [phase-20-final-testing-browser-and-phones.md](phases/phase-20-final-testing-browser-and-phones.md) |
| 21 | Final testing C: live deployment and sign-off | Not started | [phase-21-final-testing-live-and-signoff.md](phases/phase-21-final-testing-live-and-signoff.md) |

## Phase 7 start (2026-10-26)

The owner approved Phase 7. Implemented farm-bound Telegram link codes and chat links, fail-closed handling for legacy links without `farmId`, MUF single-farm execution for linked webhooks, per-farm scheduled Telegram summaries/settings, and farm-access filtering for manual summary sends in all three backends. Dairy daily-summary email sends farm-scoped messages and restricts manual sends to the selected/assigned farms. Added identical `backend/muf-telegram-farms.mjs` twins, registered them in `tools/check-muf-sync.js`, and added `tests/telegram-farm-scope.test.ts`.

**Owner-reported verification (Windows CMD, 2026-10-26):** focused Agri screen tests passed (4/4); `npm test` passed (30 files, 276 tests); `npm run check-sync`, `npm run check-farms`, `npm run check-docs`, `npm run check-ui`, and `npm run check-workbench` passed; `tools\\build-all.bat` built Dairy, Flock and Agri successfully. The 12 Telegram farm-scope tests passed within the full suite. The monthly-path audit found Dairy's separate monthly email is a full-database backup snapshot intended for off-database recovery, so it intentionally includes all farms and is sent to one full-role admin; it is not a farm report. The daily summary email is farm-scoped, and no separate monthly report job was found in the audited email/backup paths.

Phase 7 is **Done for command-line scope**. These are results supplied by the owner, not commands independently executed in this editing session. `npm ci` and optional `npm run check-workbench-runtime` were not run. Real MongoDB, browser/phone, and live deployment verification remain in Phases 19–21.

Audit focus: preserve existing webhook secret validation and current bot commands; trace each app's farm context and data stores before changing record writes, daily summary and monthly email flows. Required regression: farm B chat writes only to farm B, an unlinked chat creates nothing, and farm A summary excludes farm B data.

## Phase 10 start (2026-10-26)

Phase 10 is In progress on `muf-monorepo`. Initial implementation dynamically imports the shared PDF shell from zakat/ushr/farm-book report actions, lazy-loads Agri's dashboard chart and Dairy's Reports screen, changes Agri Vite from deprecated `advancedChunks` to `rolldownOptions.output.codeSplitting`, and removes Dairy's mixed static/dynamic API import in `reportExport.ts`. Added `tools/check-bundle-size.js`, `npm run check-bundle-size`, and `tests/check-bundle-size.test.ts`. Per-file JavaScript budgets are Dairy 700 KiB, Agri 600 KiB, Flock 850 KiB.

## Phase 10 final verification results (owner-reported, 2026-10-26)

Phase 10, Smaller downloads and faster screens, is **Done for command-line scope**. Lazy loading was added for report/PDF code, Agri's dashboard chart, Dairy's Reports screen, major Dairy/Flock screens, and selected Agri admin/worker panels. Agri's deprecated Vite chunk setting was replaced, Dairy's mixed static/dynamic API import was removed, and the bundle-size checker and regression tests were added.

| Command/check | Result |
|---|---|
| `npm test -- tests/check-bundle-size.test.ts` | Passed: 1 file, 3 tests |
| `tools\\build-all.bat` | Passed: Dairy, Flock and Agri production builds |
| `npm run check-bundle-size` | Passed: Dairy 505.5/700 KiB, Agri 420.1/600 KiB, Flock 542.0/850 KiB |
| `npm test` | Passed: 38 files, 310 tests |
| `npm run check-ui` | Passed: all UI safety checks |
| `npm run check-farms` | Passed: farm-scope and Dairy breeding-event runtime checks |
| `npm run check-sync` | Passed: all three apps and shared MUF files in sync |
| `npm run check-workbench` | Passed: all 23 workbench source safety checks |
| `npm run check-docs` | Passed before this final documentation update; rerun after pulling |
| `npm ci` / `npm run check-workbench-runtime` | Not reported as run for this checkpoint |

Largest individual JavaScript asset changes from the initial measured build: Dairy 772.7 to 505.5 KiB (267.2 KiB smaller); Agri 659.8 to 420.1 KiB (239.7 KiB smaller); Flock 961.9 to 542.0 KiB (419.9 KiB smaller). All are within the existing per-file budgets. These are largest-file comparisons, not total-transfer measurements.

The owner supplied the Windows CMD output; commands were not independently run in this documentation-editing session. Browser review, real-device performance, real MongoDB and live deployment verification are not claimed. Browser/phone and live checks remain in Phases 19–21 as appropriate.
## Phase 9 verification results (2026-10-26)

After commit `3a2ff45` corrected the stale Phase 8 cleanup assertion, the owner reran the focused suite: **6 test files passed, 36 tests passed, 0 failed**. The full suite passed: **37 test files, 307 tests, 0 failed**. `npm run check-sync`, `npm run check-ui`, `npm run check-workbench`, `npm run check-farms`, `npm run check-docs`, `tools\\build-all.bat` (Dairy, Flock, Agri all successful), and `npm run check-workbench-runtime` (8 checks) all passed. `npm ci` was not run because dependencies were already installed. No live Cloudinary credentials or uploads were used. Phase 9 is Done for command-line scope; live-provider validation remains deferred to the final live-verification phase.


Phase 9, Cloudinary photo store, is **Done for command-line scope**. Initial implementation has been committed directly to `muf-monorepo`: signed Cloudinary REST client with injectable `fetch`, optional Cloudinary env configuration across Dairy/Flock/Agri, route integration using MongoDB metadata records to preserve existing local API paths, MongoDB fallback when credentials are incomplete, authenticated proxy reads for Cloudinary-backed photos, and Cloudinary-aware photo orphan/batch cleanup. Official Free plan limits are recorded in the Phase 9 document and deployment guide.

**Verified:** the focused photo suite passed (6 files, 36 tests); the full suite passed (37 files, 307 tests); sync, UI, workbench, farm, docs, all three production builds, and the optional workbench runtime smoke test passed. No live Cloudinary credentials or uploads were used. Phase 9 is Done for command-line scope; live-provider validation remains deferred to the final live-verification phase.

## Phase 8 final verification (2026-10-26)

Phase 8, Photo storage adapter, is **Done for command-line scope**. Dairy, Flock and Agri use the shared MongoDB-first storage contract for the identified photo flows, with validation, authenticated access, farm isolation and safe orphan cleanup.

**Owner-reported Windows CMD results from `F:\\PROJECTS\\dairy\\muf-monorepo` (2026-10-26):**

| Command/check | Result |
|---|---|
| Focused photo suite: `npm test -- tests/muf-storage.test.ts tests/photo-client-migration.test.ts tests/photo-phase8-regression.test.ts tests/agri-runtime-api.integration.test.ts tests/dairy-photo-runtime.integration.test.ts` | Passed: 5 files, 30 tests |
| `npm test` | Passed: 36 files, 301 tests |
| `npm run check-sync` | Passed: three-backend storage twins, shared MUF files, env names and invariants |
| `npm run check-ui` | Passed: all MUF UI safety checks |
| `npm run check-workbench` | Passed: 23 source safety checks |
| `npm run check-farms` | Passed: Agri, Flock and Dairy farm-scope checks and Dairy breeding-event runtime checks |
| `npm run check-docs` | Passed on the pre-final docs snapshot; rerun after pulling this documentation update |
| `tools\\build-all.bat` | Passed: Dairy, Flock and Agri production builds |
| `npm run check-workbench-runtime` | Passed: 8 runtime smoke checks |
| `npm ci` | Not run; existing dependencies were used |

The first focused run was 29/30 because Dairy photo deletion returned HTTP 500. The missing model-level `deleteOne(filter)` method was added to the Dairy and Flock in-memory model adapters. The subsequent focused run passed 30/30, and the full suite passed 301/301. These are results supplied by the owner, not commands independently run in this documentation-editing session.

Phase 8 is **Done for command-line scope**. Real MongoDB, browser/phone and live deployment verification remain in Phases 19–21. Phase 9 is Done for command-line scope. Next is Phase 10, Smaller downloads and faster screens. Do not enable live Cloudinary uploads until the planned live-verification phase.

## Phase 3 final local verification (2026-10-25, Windows CMD; output supplied by owner)

Phase 3 is marked Done after the owner supplied a passing `npm run check-docs` output. The implementation and remaining Phase 3 checks below are owner-reported results, not commands run in this editing session.

| Command/check | Result |
|---|---|
| `npm test -- tests/dairy-breeding-screens.test.ts` | Owner-reported passed: 7/7 focused tests |
| `npm test` | Owner-reported passed: 26 files, 249 tests |
| `npm run check-sync` | Owner-reported passed |
| `npm run check-ui` | Owner-reported passed after replacing the legacy grid class with the shared form-grid primitive |
| `npm run check-workbench` | Owner-reported passed: 23 source checks |
| `npm run check-farms` | Owner-reported passed, including farm-scope and 19 breeding-event runtime checks |
| `tools\build-all.bat` | Owner-reported passed: Dairy, Flock and Agri production builds |
| `npm run check-docs` | Passed: owner supplied the complete Windows CMD output on 2026-10-25; all phase docs checks passed |

`npm ci` and the optional `npm run check-workbench-runtime` were not reported as run for this checkpoint. No browser/mobile review or real-MongoDB verification is claimed. Phase 3 is complete for the command-line scope; real-world verification remains in Phases 19 to 21.

## Phase 4 start (2026-10-25)

Phase 4, Dairy calves and lineage, is now **In progress**. Work starts with a repository audit of the existing breeding-event API, Cow schema, farm-scoping model, event edit/delete behavior, and cow detail popup before implementing automatic calf creation. No Phase 4 implementation tests or builds have been run yet in this editing session.

## Phase 4 implementation checkpoint (2026-10-25)

Phase 4 is **In progress**. Initial implementation is committed on `muf-monorepo`: server-side live-calf creation from calving entries, stillbirth exclusion from live-calf records, farm-scoped normalized ear-tag checks, rollback on calf/event creation failure, safe restrictions for edits/deletes of events with generated calves, and father display in the cow lineage popup. The calving form now supports multiple calf entries and outcomes. Added `tests/dairy-calving-creates-calf.test.ts` and extended the memory-mode HTTP checker that is invoked by `npm run check-farms`.

**Owner-reported verification (Windows CMD, 2026-10-25; output supplied in chat):** `npm test -- tests/dairy-calving-creates-calf.test.ts` passed (5/5); `npm test` passed (27 files, 254 tests); `npm run check-sync` passed; `npm run check-workbench` passed (23 checks); `tools\\build-all.bat` built Dairy, Flock and Agri; and the latest `npm run check-docs` passed. Latest `npm run check-farms` passes event edit/date resynchronization and other listed breeding checks, but still fails the cross-farm same-ear-tag case. Follow-up fixes are now committed on `muf-monorepo`: the cross-farm runtime test creates a valid mother in Farm B before testing tag uniqueness (the previous fixture could have no eligible cow, so it did not reliably exercise the intended scenario), and the remaining legacy `flex items-center justify-between` pattern inside the Dairy breeding-event popup now uses `muf-pc-between`. The backend also explicitly filters ear-tag candidates by the selected farm. These follow-up changes have not yet been executed locally after commit, so `npm run check-farms` and `npm run check-ui` remain pending verification. Earlier results were run by the owner, not independently in this editing session.

## Earlier baseline verification (2026-10-24, Linux sandbox, uploaded `muf-monorepo` snapshot)

| Command | Result |
|---|---|
| `npm test` | 23 files, 219 of 219 passed |
| `npm run check-sync` | Passed |
| `npm run check-ui` | Passed |
| `npm run check-workbench` | 23 of 23 passed |
| `npm run check-workbench-runtime` | 8 of 8 passed |
| `npm run check-farms` | Passed for Agri, Dairy and Flock |
| Production builds (Dairy, Flock, Agri) | All three built |
| `npm run check-docs` | See the command's own output; it is part of every phase's checks |

Not run: anything needing a real MongoDB, a browser, a phone or a live website (Phases 19 to 21).

Phase 1 implementation and local command-line verification are complete on `muf-monorepo`. The results below were supplied by the owner from Windows CMD and are recorded as owner-reported results, not commands run in this editing session.

## Phase 1 final local verification (2026-10-24, Windows CMD; output supplied by owner)

| Command | Result |
|---|---|
| `npm test -- tests/phase-1-super-admin.test.ts` | Passed: 1 file, 13 tests |
| `npm run check-super-admin` | Passed: all three apps; owners read per-farm summaries, managers and workers receive HTTP 403 |
| `npm test` | Passed: 24 files, 232 tests |
| `npm run check-sync` | Passed: all MUF shared copies and three-app invariants in sync |
| `npm run check-ui` | Passed: all MUF UI safety checks |
| `npm run check-workbench` | Passed: 23 source safety checks |
| `npm run check-farms` | Passed: Agri, Dairy and Flock farm-scope checks |
| `npm run check-docs` | Passed: all 22 phase files, statuses, links and required sections consistent at time of run |
| `tools\\build-all.bat` | Passed: Dairy, Flock and Agri production builds succeeded |

`npm ci` was not run; the existing local dependencies supported all checks and builds. The optional `npm run check-workbench-runtime` was not run. Phase 1 is marked Done based on the listed checks. Real MongoDB, browser, phone and live-site checks remain in Phases 19 to 21.

## Decisions (owner)

- **Roles:** exactly three: Owner (all farms, manages farms and users, sees the Super Admin tab), Manager (full control inside assigned farms; not an admin; no Super Admin), Worker (data entry in assigned farms).
- **Farms** are per project (poultry farms only in Flock, dairy farms only in Dairy, land only in Agri). Only the owner adds, renames, archives or deletes farms.
- **Shared systems** live in the MUF layer, identical in all three apps.
- **Flock:** Batches are the main project; Home Birds is a small secondary group. Home Birds extras may be trimmed without asking; everywhere else ask before removing anything.
- **Testing:** phases 1 to 18 use command-line checks only. Everything needing a real MongoDB, a browser or a live site is done after building, in Phases 19 to 21. Nothing is postponed or dropped.
- **Photos:** a storage adapter first, then Cloudinary (free plan; account created 2026-10-22, not connected yet).
- **MU Farms:** one shop for all three projects, built late (Phases 15 and 16); no new domain budget.
- **GitHub Actions** is manual-only today; the owner decides about automatic runs in Phase 17.
- **Hosting:** free MongoDB and Replit, so size and quota limits matter (see `docs/DEPLOYMENT.md`).
- **Backups:** the owner has a backup of each farm. Take a fresh one before any migration.

## How to update this file

Whoever works on a phase updates it in the same change: set the phase status here and in the phase file and in `docs/phases/README.md` and `docs/ROADMAP.md`, and add the real command results to the table above. Then run `npm run check-docs`.

## Phase 2 final local verification (2026-10-25, Windows CMD; output supplied by owner)

| Command | Result |
|---|---|
| `npm run check-breeding-events` | Passed: all 19 breeding-event runtime checks, including event CRUD, farm isolation, validation, role restrictions, legacy date synchronization and backup/restore retention |
| `npm test` | Passed: 25 test files, 242 tests |
| `npm run check-farms` | Passed: Agri, Flock and Dairy farm-scope checks plus all breeding-event runtime checks |

These are owner-reported results from the pasted CMD output, not commands run in this editing session. Production builds and the remaining standard checks were not included in the reported Phase 2 verification.

## Phase 3 local verification checkpoint (2026-10-25, Windows CMD; output supplied by owner)

| Command | Result |
|---|---|
| `git pull origin muf-monorepo` | Already up to date |
| `npm test -- tests/dairy-breeding-screens.test.ts` | Passed: 1 file, 7 tests |
| `npm test` | Passed: 26 files, 249 tests |
| `npm run check-sync` | Passed: all shared MUF twins and three-app invariants |
| `npm run check-ui` | Passed on rerun: all MUF UI safety checks passed after replacing the Dairy breeding popup grid with `muf-pc-form-grid` |
| `npm run check-farms` | Passed: Agri, Flock and Dairy farm-scope tests plus all 19 Dairy breeding runtime checks |
| `npm run check-docs` | **Failed on rerun:** Phase 3 file was missing required `Steps`, `Command-line checks at the end of this phase`, and `Rules for whoever works on this phase` sections; documentation corrected on GitHub, rerun pending |
| `tools\\build-all.bat` | Passed: Dairy, Flock and Agri production builds |

The owner then reran `npm run check-ui`, which passed. `npm test` passed again with 26 files / 249 tests; `check-sync`, `check-workbench` (23 checks), `check-farms`, and all three production builds passed. The `check-docs` rerun exposed missing required headings in the Phase 3 document. Those sections have now been restored on `muf-monorepo`; `npm run check-docs` must be rerun locally before Phase 3 can be marked Done. All results above are owner-reported Windows CMD output, not commands executed in this editing session.

## Phase 4 local verification checkpoint (2026-10-25, Windows CMD; output supplied by owner)

| Command | Result |
|---|---|
| `git pull origin muf-monorepo` | Passed: fast-forward from `ba24110` to `9aba98d`; 13 files updated |
| `npm test -- tests/dairy-calving-creates-calf.test.ts` | Passed: 1 file, 5 tests |
| `npm test` | Passed: 27 files, 254 tests |
| `npm run check-sync` | Passed: all shared MUF twins and three-app invariants |
| `npm run check-ui` | **Failed:** one Dairy popup element still uses a Tailwind pattern that should use a `muf-pc-*` class; Flock and Agri checks passed |
| `npm run check-workbench` | Passed: all 23 workbench source checks |
| `npm run check-farms` | **Failed in Dairy breeding runtime checks:** event edit, legacy cow date resynchronization after edit, and allowing the same ear tag in a different farm. Farm-scope checks passed; other listed breeding checks passed |
| `npm run check-docs` | **Failed:** Phase 4 status in the phase file was In progress, but the phase index still said Not started. Index and roadmap status are being corrected in this documentation update |
| `tools\\build-all.bat` | Passed: Dairy, Flock and Agri production builds |

These results are from the owner's pasted Windows CMD output. The focused and full test suites pass, but Phase 4 remains **In progress** because UI safety and three runtime checks fail. Fix those failures, rerun the affected checks, then rerun `npm run check-docs` and the full end-of-phase suite before considering completion.


## Phase 4 final verification and Phase 5 start (2026-10-25; Windows CMD output supplied by owner)

Phase 4, Dairy calves and lineage, is **Done for the command-line scope**. The latest owner-provided output confirms:

| Command | Result |
|---|---|
| `npm test` | Passed: 27 files, 254 tests |
| `npm run check-farms` | Passed: all farm-scope checks and Dairy breeding runtime checks, including same-farm duplicate-tag rejection and cross-farm tag reuse |
| `npm run check-ui` | Passed: all MUF UI safety checks |
| `npm run check-docs` | Passed: all phase documentation checks |
| `npm run check-sync` | Passed: all MUF shared-file and cross-app sync checks |
| `npm run check-workbench` | Passed: 23 source checks in the earlier Phase 4 verification output |
| `tools\\build-all.bat` | Passed: Dairy, Flock and Agri production builds in the earlier Phase 4 verification output |

The latest full-suite run also confirms the stale source-string assertion in `tests/dairy-calving-creates-calf.test.ts` has been corrected. Results above are owner-reported from the pasted Windows CMD output, not independently executed in this editing session. `npm ci` and the optional `npm run check-workbench-runtime` were not reported as run for this checkpoint. No real-MongoDB, browser/mobile or live-site verification is claimed; those remain in Phases 19 to 21.

Phase 5, **Agri fields and crop cycles: server**, is now **In progress**. Work is limited to the server/data layer: farm-scoped fields, optional crop field/season links, field/season financial summaries, and backup/restore/demo/farm-deletion integration. UI work remains in Phase 6.


## Phase 5 implementation checkpoint (2026-10-25; verification pending)

Phase 5, **Agri fields and crop cycles: server**, is **In progress**. Initial implementation has been committed to `muf-monorepo`:

- Added a farm-scoped `Field` model and CRUD API for field name, acres and notes.
- Added optional `fieldId` links on crop cycles and finance entries, and `cropCycleId` on finance entries, with same-farm link validation.
- Added field/season finance breakdowns to `/analytics/summary`, including a farm-wide/unassigned group for unlinked ledger entries.
- Included fields in backup/restore, shared farm migration/deletion model lists and memory-mode demo data.
- Added a Phase 5 contract test, extended Agri HTTP integration coverage, and added field farm-isolation checks to `tools/check-farm-scope.js` (executed by `npm run check-farms`).

**No Phase 5 commands have been executed after these changes in this editing session.** The owner must pull the latest branch and run the Phase 5 command list before this phase can be marked Done. In particular, the full test suite, farm/UI/sync/workbench/docs checks and all three builds are still unverified against this implementation.


## Phase 5 final local verification (2026-10-25, Windows CMD; output supplied by owner)

Phase 5, Agri fields and crop cycles server, is **Done for the command-line scope**. The owner supplied the following passing results from `F:\\PROJECTS\\dairy\\muf-monorepo` on branch `muf-monorepo`. These are owner-reported results, not commands independently executed in this editing session.

| Command/check | Result |
|---|---|
| `git status` / `git branch --show-current` | Clean working tree; branch `muf-monorepo`; up to date with `origin/muf-monorepo` before documentation updates |
| `npm ci` | Completed successfully; npm reported 5 audit vulnerabilities (1 moderate, 2 high, 2 critical) and an esbuild install-script approval warning |
| `npm test` | Passed: 28 files, 260 tests |
| `npm run check-sync` | Passed: all three apps in sync |
| `npm run check-ui` | Passed: all MUF UI safety checks |
| `npm run check-workbench` | Passed: 23 source checks |
| `npm run check-farms` | Passed on the final complete run: Agri, Flock and Dairy farm-scope checks plus Dairy breeding-event runtime checks |
| `npm run check-docs` | Passed: all phase docs, statuses, links and required sections consistent before the status update |
| `tools\\build-all.bat` | Passed: Dairy, Flock and Agri production builds |
| `npm test -- tests/agri-fields-cycles.test.ts` | Passed: 1 file, 5 tests |
| `npm test -- tests/agri-runtime-api.integration.test.ts` | Passed: 1 file, 11 tests |

The owner interrupted one earlier `npm run check-farms` run with Ctrl+C, then reran it to completion; only the completed run is counted as passing. The focused test runs and the complete farm check were shown in the supplied output. No real-MongoDB, browser/phone, or live-site verification is claimed; those remain in Phases 19 to 21.

Security follow-up: `npm ci` reported 5 dependency audit findings. Do not use `npm audit fix --force` without reviewing the proposed breaking changes. The dedicated dependency-security phase remains Phase 13.

## Phase 6 start (2026-10-25)

Phase 6, Agri fields and crop cycles screens, is now **In progress**. The Phase 5 server foundation is verified for the command-line scope. Initial Phase 6 work begins with an audit of the Agri crop, finance, dashboard/report, shared popup/form, and Urdu-label patterns before wiring field and crop-cycle controls. No Phase 6 implementation tests or builds have been run yet at this checkpoint.


## Phase 6 validation checkpoint (2026-10-26; Windows CMD output supplied by owner)

The owner supplied the output saved in `result.tx` from the latest Phase 6 screen implementation. The focused test exposed one failing source-contract assertion: it expected `api.put(`/fields/${id}`)` but the actual helper correctly supplies the update payload as the second argument. Corrected the assertion in `tests/agri-fields-screens.test.ts` to expect `api.put(`/fields/${id}`, field)`.

| Command/check | Result |
|---|---|
| Initial `npm test -- tests/agri-fields-screens.test.ts` | Failed: 1 of 4 tests, due to the incorrect update-helper string expectation; the other 3 tests passed |
| Initial `npm test` | Failed: 1 of 264 tests; 263 passed. The same assertion was the reported failure |
| `npm run check-sync` | Owner-reported passed |
| `npm run check-ui` | Owner-reported passed |
| `npm run check-workbench` | Owner-reported passed: 23 source checks |
| `npm run check-farms` | Owner-reported passed: all farm-scope and Dairy breeding-event runtime checks |
| `npm run check-docs` | Owner-reported passed |
| `tools\\build-all.bat` | Owner-reported passed: Dairy, Flock and Agri builds |

**Pending:** rerun `npm test -- tests/agri-fields-screens.test.ts` and the full `npm test` after the assertion fix. Phase 6 remains **In progress** until those results are supplied and Urdu label coverage is checked. The pasted command-output file `result.tx` has been removed from the branch after review.


## Phase 6 final verification (2026-10-26; Windows CMD output supplied by owner)

Phase 6, Agri fields and crop cycles screens, is **Done for the planned command-line scope**. The owner supplied these results from `F:\\PROJECTS\\dairy\\muf-monorepo` after pulling the test assertion fix:

| Command/check | Result |
|---|---|
| `npm test -- tests/agri-fields-screens.test.ts` | Passed: 1 file, 4 tests |
| `npm test` | Passed: 29 files, 264 tests, 0 failures |
| `npm run check-docs` | Passed: all phase docs checks, links and status indexes |
| `tools\\build-all.bat` | Passed: Dairy, Flock and Agri production builds |
| `npm run check-sync` | Owner-reported passed before the final test-only assertion correction |
| `npm run check-ui` | Owner-reported passed before the final test-only assertion correction |
| `npm run check-workbench` | Owner-reported passed: 23 source checks, before the final test-only assertion correction |
| `npm run check-farms` | Owner-reported passed: farm-scope and Dairy breeding-event runtime checks, before the final test-only assertion correction |

The initial failure was a stale source-contract expectation; the API implementation correctly included its payload argument. The test assertion was corrected, and the owner supplied passing focused and full-suite results afterward. The final correction changed only the test expectation. Results are owner-reported, not commands independently run in this editing session.

The Phase 6 checklist is complete for command-line scope. No browser/phone, real-MongoDB, or live-site verification is claimed; those remain in Phases 19 to 21. Phase 7 subsequently completed for command-line scope; see the Phase 7 entry above.


Phase 9, Cloudinary photo store, is **Done for command-line scope**. The signed Cloudinary client, optional credentials across all three farm backends, MongoDB fallback, authenticated proxy reads, and Cloudinary-aware cleanup are in place. Owner-reported verification passed: focused photo suite (6 files, 36 tests), full suite (37 files, 307 tests), sync/UI/workbench/farm/docs checks, all three production builds, and 8 workbench runtime smoke checks. No live Cloudinary credentials or uploads were used. Live-provider validation remains deferred to the final live-verification phase.

## Phase 8 final verification (2026-10-26)

Phase 8, Photo storage adapter, is **Done for command-line scope**. Dairy, Flock and Agri use the shared MongoDB-first storage contract for the identified photo flows, with validation, authenticated access, farm isolation and safe orphan cleanup.

**Owner-reported Windows CMD results from `F:\\PROJECTS\\dairy\\muf-monorepo` (2026-10-26):**

| Command/check | Result |
|---|---|
| Focused photo suite: `npm test -- tests/muf-storage.test.ts tests/photo-client-migration.test.ts tests/photo-phase8-regression.test.ts tests/agri-runtime-api.integration.test.ts tests/dairy-photo-runtime.integration.test.ts` | Passed: 5 files, 30 tests |
| `npm test` | Passed: 36 files, 301 tests |
| `npm run check-sync` | Passed: three-backend storage twins, shared MUF files, env names and invariants |
| `npm run check-ui` | Passed: all MUF UI safety checks |
| `npm run check-workbench` | Passed: 23 source safety checks |
| `npm run check-farms` | Passed: Agri, Flock and Dairy farm-scope checks and Dairy breeding-event runtime checks |
| `npm run check-docs` | Passed on the pre-final docs snapshot; rerun after pulling this documentation update |
| `tools\\build-all.bat` | Passed: Dairy, Flock and Agri production builds |
| `npm run check-workbench-runtime` | Passed: 8 runtime smoke checks |
| `npm ci` | Not run; existing dependencies were used |

The first focused run was 29/30 because Dairy photo deletion returned HTTP 500. The missing model-level `deleteOne(filter)` method was added to the Dairy and Flock in-memory model adapters. The subsequent focused run passed 30/30, and the full suite passed 301/301. These are results supplied by the owner, not commands independently run in this documentation-editing session.

Phase 8 is **Done for command-line scope**. Real MongoDB, browser/phone and live deployment verification remain in Phases 19–21. Phase 9 is Done for command-line scope. Next is Phase 10, Smaller downloads and faster screens. Do not enable live Cloudinary uploads until the planned live-verification phase.

## Phase 3 final local verification (2026-10-25, Windows CMD; output supplied by owner)

Phase 3 is marked Done after the owner supplied a passing `npm run check-docs` output. The implementation and remaining Phase 3 checks below are owner-reported results, not commands run in this editing session.

| Command/check | Result |
|---|---|
| `npm test -- tests/dairy-breeding-screens.test.ts` | Owner-reported passed: 7/7 focused tests |
| `npm test` | Owner-reported passed: 26 files, 249 tests |
| `npm run check-sync` | Owner-reported passed |
| `npm run check-ui` | Owner-reported passed after replacing the legacy grid class with the shared form-grid primitive |
| `npm run check-workbench` | Owner-reported passed: 23 source checks |
| `npm run check-farms` | Owner-reported passed, including farm-scope and 19 breeding-event runtime checks |
| `tools\build-all.bat` | Owner-reported passed: Dairy, Flock and Agri production builds |
| `npm run check-docs` | Passed: owner supplied the complete Windows CMD output on 2026-10-25; all phase docs checks passed |

`npm ci` and the optional `npm run check-workbench-runtime` were not reported as run for this checkpoint. No browser/mobile review or real-MongoDB verification is claimed. Phase 3 is complete for the command-line scope; real-world verification remains in Phases 19 to 21.

## Phase 4 start (2026-10-25)

Phase 4, Dairy calves and lineage, is now **In progress**. Work starts with a repository audit of the existing breeding-event API, Cow schema, farm-scoping model, event edit/delete behavior, and cow detail popup before implementing automatic calf creation. No Phase 4 implementation tests or builds have been run yet in this editing session.

## Phase 4 implementation checkpoint (2026-10-25)

Phase 4 is **In progress**. Initial implementation is committed on `muf-monorepo`: server-side live-calf creation from calving entries, stillbirth exclusion from live-calf records, farm-scoped normalized ear-tag checks, rollback on calf/event creation failure, safe restrictions for edits/deletes of events with generated calves, and father display in the cow lineage popup. The calving form now supports multiple calf entries and outcomes. Added `tests/dairy-calving-creates-calf.test.ts` and extended the memory-mode HTTP checker that is invoked by `npm run check-farms`.

**Owner-reported verification (Windows CMD, 2026-10-25; output supplied in chat):** `npm test -- tests/dairy-calving-creates-calf.test.ts` passed (5/5); `npm test` passed (27 files, 254 tests); `npm run check-sync` passed; `npm run check-workbench` passed (23 checks); `tools\\build-all.bat` built Dairy, Flock and Agri; and the latest `npm run check-docs` passed. Latest `npm run check-farms` passes event edit/date resynchronization and other listed breeding checks, but still fails the cross-farm same-ear-tag case. Follow-up fixes are now committed on `muf-monorepo`: the cross-farm runtime test creates a valid mother in Farm B before testing tag uniqueness (the previous fixture could have no eligible cow, so it did not reliably exercise the intended scenario), and the remaining legacy `flex items-center justify-between` pattern inside the Dairy breeding-event popup now uses `muf-pc-between`. The backend also explicitly filters ear-tag candidates by the selected farm. These follow-up changes have not yet been executed locally after commit, so `npm run check-farms` and `npm run check-ui` remain pending verification. Earlier results were run by the owner, not independently in this editing session.

## Earlier baseline verification (2026-10-24, Linux sandbox, uploaded `muf-monorepo` snapshot)

| Command | Result |
|---|---|
| `npm test` | 23 files, 219 of 219 passed |
| `npm run check-sync` | Passed |
| `npm run check-ui` | Passed |
| `npm run check-workbench` | 23 of 23 passed |
| `npm run check-workbench-runtime` | 8 of 8 passed |
| `npm run check-farms` | Passed for Agri, Dairy and Flock |
| Production builds (Dairy, Flock, Agri) | All three built |
| `npm run check-docs` | See the command's own output; it is part of every phase's checks |

Not run: anything needing a real MongoDB, a browser, a phone or a live website (Phases 19 to 21).

Phase 1 implementation and local command-line verification are complete on `muf-monorepo`. The results below were supplied by the owner from Windows CMD and are recorded as owner-reported results, not commands run in this editing session.

## Phase 1 final local verification (2026-10-24, Windows CMD; output supplied by owner)

| Command | Result |
|---|---|
| `npm test -- tests/phase-1-super-admin.test.ts` | Passed: 1 file, 13 tests |
| `npm run check-super-admin` | Passed: all three apps; owners read per-farm summaries, managers and workers receive HTTP 403 |
| `npm test` | Passed: 24 files, 232 tests |
| `npm run check-sync` | Passed: all MUF shared copies and three-app invariants in sync |
| `npm run check-ui` | Passed: all MUF UI safety checks |
| `npm run check-workbench` | Passed: 23 source safety checks |
| `npm run check-farms` | Passed: Agri, Dairy and Flock farm-scope checks |
| `npm run check-docs` | Passed: all 22 phase files, statuses, links and required sections consistent at time of run |
| `tools\\build-all.bat` | Passed: Dairy, Flock and Agri production builds succeeded |

`npm ci` was not run; the existing local dependencies supported all checks and builds. The optional `npm run check-workbench-runtime` was not run. Phase 1 is marked Done based on the listed checks. Real MongoDB, browser, phone and live-site checks remain in Phases 19 to 21.

## Decisions (owner)

- **Roles:** exactly three: Owner (all farms, manages farms and users, sees the Super Admin tab), Manager (full control inside assigned farms; not an admin; no Super Admin), Worker (data entry in assigned farms).
- **Farms** are per project (poultry farms only in Flock, dairy farms only in Dairy, land only in Agri). Only the owner adds, renames, archives or deletes farms.
- **Shared systems** live in the MUF layer, identical in all three apps.
- **Flock:** Batches are the main project; Home Birds is a small secondary group. Home Birds extras may be trimmed without asking; everywhere else ask before removing anything.
- **Testing:** phases 1 to 18 use command-line checks only. Everything needing a real MongoDB, a browser or a live site is done after building, in Phases 19 to 21. Nothing is postponed or dropped.
- **Photos:** a storage adapter first, then Cloudinary (free plan; account created 2026-10-22, not connected yet).
- **MU Farms:** one shop for all three projects, built late (Phases 15 and 16); no new domain budget.
- **GitHub Actions** is manual-only today; the owner decides about automatic runs in Phase 17.
- **Hosting:** free MongoDB and Replit, so size and quota limits matter (see `docs/DEPLOYMENT.md`).
- **Backups:** the owner has a backup of each farm. Take a fresh one before any migration.

## How to update this file

Whoever works on a phase updates it in the same change: set the phase status here and in the phase file and in `docs/phases/README.md` and `docs/ROADMAP.md`, and add the real command results to the table above. Then run `npm run check-docs`.

## Phase 2 final local verification (2026-10-25, Windows CMD; output supplied by owner)

| Command | Result |
|---|---|
| `npm run check-breeding-events` | Passed: all 19 breeding-event runtime checks, including event CRUD, farm isolation, validation, role restrictions, legacy date synchronization and backup/restore retention |
| `npm test` | Passed: 25 test files, 242 tests |
| `npm run check-farms` | Passed: Agri, Flock and Dairy farm-scope checks plus all breeding-event runtime checks |

These are owner-reported results from the pasted CMD output, not commands run in this editing session. Production builds and the remaining standard checks were not included in the reported Phase 2 verification.

## Phase 3 local verification checkpoint (2026-10-25, Windows CMD; output supplied by owner)

| Command | Result |
|---|---|
| `git pull origin muf-monorepo` | Already up to date |
| `npm test -- tests/dairy-breeding-screens.test.ts` | Passed: 1 file, 7 tests |
| `npm test` | Passed: 26 files, 249 tests |
| `npm run check-sync` | Passed: all shared MUF twins and three-app invariants |
| `npm run check-ui` | Passed on rerun: all MUF UI safety checks passed after replacing the Dairy breeding popup grid with `muf-pc-form-grid` |
| `npm run check-farms` | Passed: Agri, Flock and Dairy farm-scope tests plus all 19 Dairy breeding runtime checks |
| `npm run check-docs` | **Failed on rerun:** Phase 3 file was missing required `Steps`, `Command-line checks at the end of this phase`, and `Rules for whoever works on this phase` sections; documentation corrected on GitHub, rerun pending |
| `tools\\build-all.bat` | Passed: Dairy, Flock and Agri production builds |

The owner then reran `npm run check-ui`, which passed. `npm test` passed again with 26 files / 249 tests; `check-sync`, `check-workbench` (23 checks), `check-farms`, and all three production builds passed. The `check-docs` rerun exposed missing required headings in the Phase 3 document. Those sections have now been restored on `muf-monorepo`; `npm run check-docs` must be rerun locally before Phase 3 can be marked Done. All results above are owner-reported Windows CMD output, not commands executed in this editing session.

## Phase 4 local verification checkpoint (2026-10-25, Windows CMD; output supplied by owner)

| Command | Result |
|---|---|
| `git pull origin muf-monorepo` | Passed: fast-forward from `ba24110` to `9aba98d`; 13 files updated |
| `npm test -- tests/dairy-calving-creates-calf.test.ts` | Passed: 1 file, 5 tests |
| `npm test` | Passed: 27 files, 254 tests |
| `npm run check-sync` | Passed: all shared MUF twins and three-app invariants |
| `npm run check-ui` | **Failed:** one Dairy popup element still uses a Tailwind pattern that should use a `muf-pc-*` class; Flock and Agri checks passed |
| `npm run check-workbench` | Passed: all 23 workbench source checks |
| `npm run check-farms` | **Failed in Dairy breeding runtime checks:** event edit, legacy cow date resynchronization after edit, and allowing the same ear tag in a different farm. Farm-scope checks passed; other listed breeding checks passed |
| `npm run check-docs` | **Failed:** Phase 4 status in the phase file was In progress, but the phase index still said Not started. Index and roadmap status are being corrected in this documentation update |
| `tools\\build-all.bat` | Passed: Dairy, Flock and Agri production builds |

These results are from the owner's pasted Windows CMD output. The focused and full test suites pass, but Phase 4 remains **In progress** because UI safety and three runtime checks fail. Fix those failures, rerun the affected checks, then rerun `npm run check-docs` and the full end-of-phase suite before considering completion.


## Phase 4 final verification and Phase 5 start (2026-10-25; Windows CMD output supplied by owner)

Phase 4, Dairy calves and lineage, is **Done for the command-line scope**. The latest owner-provided output confirms:

| Command | Result |
|---|---|
| `npm test` | Passed: 27 files, 254 tests |
| `npm run check-farms` | Passed: all farm-scope checks and Dairy breeding runtime checks, including same-farm duplicate-tag rejection and cross-farm tag reuse |
| `npm run check-ui` | Passed: all MUF UI safety checks |
| `npm run check-docs` | Passed: all phase documentation checks |
| `npm run check-sync` | Passed: all MUF shared-file and cross-app sync checks |
| `npm run check-workbench` | Passed: 23 source checks in the earlier Phase 4 verification output |
| `tools\\build-all.bat` | Passed: Dairy, Flock and Agri production builds in the earlier Phase 4 verification output |

The latest full-suite run also confirms the stale source-string assertion in `tests/dairy-calving-creates-calf.test.ts` has been corrected. Results above are owner-reported from the pasted Windows CMD output, not independently executed in this editing session. `npm ci` and the optional `npm run check-workbench-runtime` were not reported as run for this checkpoint. No real-MongoDB, browser/mobile or live-site verification is claimed; those remain in Phases 19 to 21.

Phase 5, **Agri fields and crop cycles: server**, is now **In progress**. Work is limited to the server/data layer: farm-scoped fields, optional crop field/season links, field/season financial summaries, and backup/restore/demo/farm-deletion integration. UI work remains in Phase 6.


## Phase 5 implementation checkpoint (2026-10-25; verification pending)

Phase 5, **Agri fields and crop cycles: server**, is **In progress**. Initial implementation has been committed to `muf-monorepo`:

- Added a farm-scoped `Field` model and CRUD API for field name, acres and notes.
- Added optional `fieldId` links on crop cycles and finance entries, and `cropCycleId` on finance entries, with same-farm link validation.
- Added field/season finance breakdowns to `/analytics/summary`, including a farm-wide/unassigned group for unlinked ledger entries.
- Included fields in backup/restore, shared farm migration/deletion model lists and memory-mode demo data.
- Added a Phase 5 contract test, extended Agri HTTP integration coverage, and added field farm-isolation checks to `tools/check-farm-scope.js` (executed by `npm run check-farms`).

**No Phase 5 commands have been executed after these changes in this editing session.** The owner must pull the latest branch and run the Phase 5 command list before this phase can be marked Done. In particular, the full test suite, farm/UI/sync/workbench/docs checks and all three builds are still unverified against this implementation.


## Phase 5 final local verification (2026-10-25, Windows CMD; output supplied by owner)

Phase 5, Agri fields and crop cycles server, is **Done for the command-line scope**. The owner supplied the following passing results from `F:\\PROJECTS\\dairy\\muf-monorepo` on branch `muf-monorepo`. These are owner-reported results, not commands independently executed in this editing session.

| Command/check | Result |
|---|---|
| `git status` / `git branch --show-current` | Clean working tree; branch `muf-monorepo`; up to date with `origin/muf-monorepo` before documentation updates |
| `npm ci` | Completed successfully; npm reported 5 audit vulnerabilities (1 moderate, 2 high, 2 critical) and an esbuild install-script approval warning |
| `npm test` | Passed: 28 files, 260 tests |
| `npm run check-sync` | Passed: all three apps in sync |
| `npm run check-ui` | Passed: all MUF UI safety checks |
| `npm run check-workbench` | Passed: 23 source checks |
| `npm run check-farms` | Passed on the final complete run: Agri, Flock and Dairy farm-scope checks plus Dairy breeding-event runtime checks |
| `npm run check-docs` | Passed: all phase docs, statuses, links and required sections consistent before the status update |
| `tools\\build-all.bat` | Passed: Dairy, Flock and Agri production builds |
| `npm test -- tests/agri-fields-cycles.test.ts` | Passed: 1 file, 5 tests |
| `npm test -- tests/agri-runtime-api.integration.test.ts` | Passed: 1 file, 11 tests |

The owner interrupted one earlier `npm run check-farms` run with Ctrl+C, then reran it to completion; only the completed run is counted as passing. The focused test runs and the complete farm check were shown in the supplied output. No real-MongoDB, browser/phone, or live-site verification is claimed; those remain in Phases 19 to 21.

Security follow-up: `npm ci` reported 5 dependency audit findings. Do not use `npm audit fix --force` without reviewing the proposed breaking changes. The dedicated dependency-security phase remains Phase 13.

## Phase 6 start (2026-10-25)

Phase 6, Agri fields and crop cycles screens, is now **In progress**. The Phase 5 server foundation is verified for the command-line scope. Initial Phase 6 work begins with an audit of the Agri crop, finance, dashboard/report, shared popup/form, and Urdu-label patterns before wiring field and crop-cycle controls. No Phase 6 implementation tests or builds have been run yet at this checkpoint.


## Phase 6 validation checkpoint (2026-10-26; Windows CMD output supplied by owner)

The owner supplied the output saved in `result.tx` from the latest Phase 6 screen implementation. The focused test exposed one failing source-contract assertion: it expected `api.put(`/fields/${id}`)` but the actual helper correctly supplies the update payload as the second argument. Corrected the assertion in `tests/agri-fields-screens.test.ts` to expect `api.put(`/fields/${id}`, field)`.

| Command/check | Result |
|---|---|
| Initial `npm test -- tests/agri-fields-screens.test.ts` | Failed: 1 of 4 tests, due to the incorrect update-helper string expectation; the other 3 tests passed |
| Initial `npm test` | Failed: 1 of 264 tests; 263 passed. The same assertion was the reported failure |
| `npm run check-sync` | Owner-reported passed |
| `npm run check-ui` | Owner-reported passed |
| `npm run check-workbench` | Owner-reported passed: 23 source checks |
| `npm run check-farms` | Owner-reported passed: all farm-scope and Dairy breeding-event runtime checks |
| `npm run check-docs` | Owner-reported passed |
| `tools\\build-all.bat` | Owner-reported passed: Dairy, Flock and Agri builds |

**Pending:** rerun `npm test -- tests/agri-fields-screens.test.ts` and the full `npm test` after the assertion fix. Phase 6 remains **In progress** until those results are supplied and Urdu label coverage is checked. The pasted command-output file `result.tx` has been removed from the branch after review.


## Phase 6 final verification (2026-10-26; Windows CMD output supplied by owner)

Phase 6, Agri fields and crop cycles screens, is **Done for the planned command-line scope**. The owner supplied these results from `F:\\PROJECTS\\dairy\\muf-monorepo` after pulling the test assertion fix:

| Command/check | Result |
|---|---|
| `npm test -- tests/agri-fields-screens.test.ts` | Passed: 1 file, 4 tests |
| `npm test` | Passed: 29 files, 264 tests, 0 failures |
| `npm run check-docs` | Passed: all phase docs checks, links and status indexes |
| `tools\\build-all.bat` | Passed: Dairy, Flock and Agri production builds |
| `npm run check-sync` | Owner-reported passed before the final test-only assertion correction |
| `npm run check-ui` | Owner-reported passed before the final test-only assertion correction |
| `npm run check-workbench` | Owner-reported passed: 23 source checks, before the final test-only assertion correction |
| `npm run check-farms` | Owner-reported passed: farm-scope and Dairy breeding-event runtime checks, before the final test-only assertion correction |

The initial failure was a stale source-contract expectation; the API implementation correctly included its payload argument. The test assertion was corrected, and the owner supplied passing focused and full-suite results afterward. The final correction changed only the test expectation. Results are owner-reported, not commands independently run in this editing session.

The Phase 6 checklist is complete for command-line scope. No browser/phone, real-MongoDB, or live-site verification is claimed; those remain in Phases 19 to 21. Phase 7 subsequently completed for command-line scope; see the Phase 7 entry above.
