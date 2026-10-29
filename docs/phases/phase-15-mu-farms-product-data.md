# Phase 15: MU Farms: products and publish switch

**Status:** Done

## Goal

Each project can mark products as published, and a safe public read-only list exists for the future shop.

## Already in place (from Phase 0)

- Phase 15 implementation started on 2026-10-29 after Phase 14 passed current-head command-line validation.

## Scope

- A farm-scoped `Product` collection in each app: name, unit, price, quantity, photo, published flag.
- Owner and manager screens to add products and flip "Publish to MU Farms".
- A public read-only endpoint per app that returns only published products and only public fields (no costs, buyers or users).
- Dairy: milk and animal catalogue items can be managed manually. This phase does not automatically join catalogue animals to Buyers records or filter animals by buyer status. Agri: harvested produce. Flock: eggs and birds.

## Out of scope

- No public website yet (Phase 16).
- No payments.

## Steps

1. Keep Product schema and public response fields synchronized across all three apps.
2. Add farm-scoped Product models, manager/owner CRUD routes, and a shared management screen.
3. Add a published-only public endpoint with an explicit public field allowlist.
4. Add product boundary tests and route/sync checks.

## New command-line check

`tests/public-products.test.ts`: unpublished products never appear, no private field is returned, and a product of farm B is only listed when published.

## Command-line checks at the end of this phase

```
npm ci
npm test
npm run check-sync
npm run check-ui
npm run check-workbench
npm run check-farms
npm run check-docs
tools\build-all.bat
```
Run the build in each app that this phase touched (or `tools\build-all.bat` for all three). `npm run check-workbench-runtime` is optional and needs port 5000 free.

## Done checklist

- [x] Farm-scoped Product model in each app with name, kind, unit, price, quantity, photo URL, published flag.
- [x] Owner/manager screens can add, edit, delete, and publish products.
- [x] Public endpoint returns published products only and exposes allowlisted public fields.
- [x] Dairy supports manually managed milk/animal catalogue items; Agri supports harvested produce; Flock supports eggs/birds. Automatic buyer-status filtering for animal catalogue items is not included.
- [x] Product boundary tests, updated route matrix, repository checks and all three builds pass.
- [x] Live database, browser/device and deployment checks remain in Phases 19–21.
- [x] Phase 15 checks passed. `npm ci` was not rerun because package manifests and lockfiles were unchanged since the successful Phase 14 install; existing installed dependencies were used.
- [x] `docs/PROGRESS.md`, `docs/ROADMAP.md` and `docs/phases/README.md` are updated.

## Rules for whoever works on this phase

1. When work starts, set **Status** below to `In progress` and update the tables in `docs/PROGRESS.md` and `docs/phases/README.md`. When it ends, set `Done` and write the real command results in `docs/PROGRESS.md`.
2. Add at least one new command-line check for this phase and name it under **New command-line check**. A phase is not done without it.
3. Report only commands you actually ran, with what they printed. If you did not run something, say so.
4. This phase uses command-line tests only: no live websites, no real MongoDB, no browsers or phones. Nothing is postponed: if part of this phase can only be tested live, add it to the matching list in Phase 19, 20 or 21.
5. Ask the owner before removing any feature (the Flock Home Birds trims are already allowed).
6. Stay inside this phase's scope. If a shared MUF file changes, keep the three copies identical (`npm run check-sync`).
7. Keep the other two apps working: run all three builds even when only one app changed.


## Owner validation checkpoint (Windows CMD, 2026-10-29)

The owner supplied passing results from the Windows checkout after pulling commit `0d32892` and the Phase 15 implementation/follow-up fix:

| Command/check | Result |
|---|---|
| `npm test -- tests/public-products.test.ts` | Passed: 1 file, 5 tests |
| `npm test -- tests/archive.test.ts` | Passed: 1 file, 10 tests |
| `npm run check-route-permissions` | Passed: 49 route modules documented, imported and visibly mounted |
| `npm run check-route-matrix` | Passed: 362 route declarations checked (Dairy 135, Agri 140, Flock 87); no authorization mismatches |
| `npm run check-sync` | Passed: shared ProductManager and backend `muf-products.mjs` copies match across all three apps; remaining sync checks passed |
| `npm run check-secrets` | Passed: 662 tracked paths scanned; no recognized tracked secrets found |
| `npm run check-ui` | Passed: all MUF UI safety checks |
| `npm run check-workbench` | Passed: 23 source checks |
| `npm run check-farms` | Passed: all farm-scope and Dairy breeding-event runtime checks |
| `npm run check-archive` | Passed: Dairy, Flock and Agri archive checks; Node printed non-fatal module-type warnings |
| `npm run check-docs` | Passed after the Phase 14 status correction; all 22 phase files/statuses/links passed |
| `npm test` | Passed: 45 files, 402 tests |
| `tools\\build-all.bat` | Passed: Dairy, Flock and Agri production builds |

`npm ci` was not rerun for this phase because dependency manifests and lockfiles did not change since the successful Phase 14 install. That earlier install reported 5 npm audit findings (1 moderate, 2 high, 2 critical); triage these before release and do not use `npm audit fix --force` blindly.

**Disposition:** Phase 15 is Done for command-line scope. No real MongoDB, browser/phone or live-deployment verification is claimed; those remain in Phases 19–21. Phase 16 is next: build the public MU Farms shop. Dairy animal catalogue entries are manual and are not automatically matched against Buyers records in this phase.
