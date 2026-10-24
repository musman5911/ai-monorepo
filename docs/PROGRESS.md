# Progress

Where the project stands, in one place. The detailed plan for each phase is in `docs/phases/`; the old dated log is kept unchanged in `docs/archive/`.

Last updated: 2026-10-24 (Phase 1 complete after local Windows checks).

**Honesty rule:** a result is written down only if the command was actually run and its output was seen. "Built" is not the same as "verified": command-line checks do not prove browser behavior or real-MongoDB behavior; those are checked in Phases 19 to 21.

## Phases

| Phase | What | Status | File |
|---|---|---|---|
| 0 | Done and verified | Done | [phase-00-done-and-verified.md](phases/phase-00-done-and-verified.md) |
| 1 | Super Admin: owner only, per-farm summaries | Done | [phase-01-super-admin-owner-only.md](phases/phase-01-super-admin-owner-only.md) |
| 2 | Dairy breeding events: server | Not started | [phase-02-dairy-breeding-events-server.md](phases/phase-02-dairy-breeding-events-server.md) |
| 3 | Dairy breeding events: screens | Not started | [phase-03-dairy-breeding-screens.md](phases/phase-03-dairy-breeding-screens.md) |
| 4 | Dairy calves and lineage | Not started | [phase-04-dairy-calves-lineage.md](phases/phase-04-dairy-calves-lineage.md) |
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
