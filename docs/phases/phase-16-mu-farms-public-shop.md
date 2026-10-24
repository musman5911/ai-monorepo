# Phase 16: MU Farms: public shop

**Status:** Not started

## Goal

Customers can browse published products from all three projects and place an order by WhatsApp.

## Already in place (from Phase 0)

- The Phase 15 public product endpoints.

## Scope

- A decision, written first in this file: where the shop lives (a clearly separated public section inside one app, or a free-subdomain site), with the security reasons.
- A simple shop with Crops, Dairy and Poultry sections reading the public endpoints.
- An "Order on WhatsApp" button with the product details filled in.
- No admin or private data reachable from the shop.

## Out of scope

- No online payments, no customer accounts.

## Steps

1. Write and get the owner's approval of the location decision.
2. Build the shop.
3. Add the check.

## New command-line check

`tests/shop-isolation.test.ts`: proves the shop only calls the public endpoints and no admin route or private field is reachable from it.

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

- [ ] A decision, written first in this file: where the shop lives (a clearly separated public section inside one app, or a free-subdomain site), with the security reasons.
- [ ] A simple shop with Crops, Dairy and Poultry sections reading the public endpoints.
- [ ] An "Order on WhatsApp" button with the product details filled in.
- [ ] No admin or private data reachable from the shop.
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
