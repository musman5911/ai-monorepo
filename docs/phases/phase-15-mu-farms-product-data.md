# Phase 15: MU Farms: products and publish switch

**Status:** Not started

## Goal

Each project can mark products as published, and a safe public read-only list exists for the future shop.

## Already in place (from Phase 0)

- No product or shop code exists yet.

## Scope

- A farm-scoped `Product` collection in each app: name, unit, price, quantity, photo, published flag.
- Owner and manager screens to add products and flip "Publish to MU Farms".
- A public read-only endpoint per app that returns only published products and only public fields (no costs, buyers or users).
- Dairy: option to list milk or animals that have no buyer. Agri: harvested produce. Flock: eggs and birds.

## Out of scope

- No public website yet (Phase 16).
- No payments.

## Steps

1. Agree product fields in this file.
2. Build model, routes and screens in one app first, then copy to the others.
3. Add the public endpoint and the leak test.

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

- [ ] A farm-scoped `Product` collection in each app: name, unit, price, quantity, photo, published flag.
- [ ] Owner and manager screens to add products and flip "Publish to MU Farms".
- [ ] A public read-only endpoint per app that returns only published products and only public fields (no costs, buyers or users).
- [ ] Dairy: option to list milk or animals that have no buyer. Agri: harvested produce. Flock: eggs and birds.
- [ ] The new command-line check above exists and passes.
- [ ] The standard checks above all pass (write the real results in `docs/PROGRESS.md`).
- [ ] `docs/PROGRESS.md`, `docs/ROADMAP.md` and `docs/phases/README.md` are updated.

## Rules for whoever works on this phase

1. When work starts, set **Status** below to `In progress` and update the tables in `docs/PROGRESS.md` and `docs/phases/README.md`. When it ends, set `Done` and write the real command results in `docs/PROGRESS.md`.
2. Add at least one new command-line check for this phase and name it under **New command-line check**. A phase is not done without it.
3. Report only commands you actually ran, with what they printed. If you did not run something, say so.
4. This phase uses command-line tests only: no live websites, no real MongoDB, no browsers or phones. Nothing is postponed: if part of this phase can only be tested live, add it to the matching list in Phase 19, 20 or 21.
5. Ask the owner before removing any feature (the Flock Home Birds trims are already allowed).
6. Stay inside this phase's scope. If a shared MUF file changes, keep the three copies identical (`npm run check-sync`).
7. Keep the other two apps working: run all three builds even when only one app changed.
