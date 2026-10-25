# Progress

Where the project stands, in one place. The detailed plan for each phase is in `docs/phases/`; the old dated log is kept unchanged in `docs/archive/`.

Last updated: 2026-10-25 (Phase 4 implementation checks recorded; failures remain).

**Honesty rule:** a result is written down only if the command was actually run and its output was seen. "Built" is not the same as "verified": command-line checks do not prove browser behavior or real-MongoDB behavior; those are checked in Phases 19 to 21.

## Phases

| Phase | What | Status | File |
|---|---|---|---|
| 0 | Done and verified | Done | [phase-00-done-and-verified.md](phases/phase-00-done-and-verified.md) |
| 1 | Super Admin: owner only, per-farm summaries | Done | [phase-01-super-admin-owner-only.md](phases/phase-01-super-admin-owner-only.md) |
| 2 | Dairy breeding events: server | Done | [phase-02-dairy-breeding-events-server.md](phases/phase-02-dairy-breeding-events-server.md) |
| 3 | Dairy breeding events: screens | Done | [phase-03-dairy-breeding-screens.md](phases/phase-03-dairy-breeding-screens.md) |
| 4 | Dairy calves and lineage | In progress | [phase-04-dairy-calves-lineage.md](phases/phase-04-dairy-calves-lineage.md) |
| 5 | Agri fields and crop cycles: server | Not started | [phase-05-agri-fields-cycles-server.md](phases/phase-05-agri-fields-cycles-server.md) |
| 6 | Agri fields and crop cycles: screens | Not started | [phase-06-agri-fields-cycles-screens.md](phases/phase-06-agri-fields-cycles-screens.md) |
| 7 | Telegram bot and daily summary per farm | Not started | [phase-07-telegram-daily-summary-per-farm.md](phases/phase-07-telegram-daily-summary-per-farm.md) |
| 8 | Photo storage adapter | Not started | [phase-08-photo-storage-adapter.md](phases/phase-08-photo-storage-adapter.md) |
| 9 | Cloudinary photo store | Not started | [phase-09-cloudinary-store.md](phases/phase-09-cloudinary-store.md) |
| 10 | Smaller downloads and faster screens | Not started | [phase-10-bundle-size-performance.md](phases/phase-10-bundle-size-performance.md) |
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
