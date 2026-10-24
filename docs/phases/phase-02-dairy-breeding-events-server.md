# Phase 2: Dairy breeding events: server

**Status:** Not started

## Goal

Heat, tikka (artificial insemination), pregnancy checks and calvings are stored as records, not just dates on the cow.

## Already in place (from Phase 0)

- Optional sire and ear-tag fields on cows, and a unique ear tag per farm (source-level index).
- A breeding service that works out due dates from the dates on the cow (`services/breeding.js`).

## Scope

- A farm-scoped `BreedingEvent` collection: type (heat, service, pregnancy check, calving), date, cow, bull or outside straw (name and semen code), technician, result, notes.
- API: list (paged, per cow and per farm), create, edit, delete, with the same roles as other Dairy data.
- The existing date fields on the cow keep working; new events keep them in step (additive, no forced migration).
- Included in backup and restore, demo data and farm deletion (move/delete).

## Out of scope

- No screens (Phase 3).
- No automatic calf creation (Phase 4).

## Steps

1. Design the schema and write it down in this file before coding.
2. Add the model, scope it with the farm layer, and add the routes.
3. Wire into backup/restore and the farm-delete model list.
4. Add demo data and the new test file.

## New command-line check

`tests/dairy-breeding-events.test.ts` plus new cases in `npm run check-farms`: events created in farm B never appear in farm A, workers cannot delete events, restore keeps events.

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

- [ ] A farm-scoped `BreedingEvent` collection: type (heat, service, pregnancy check, calving), date, cow, bull or outside straw (name and semen code), technician, result, notes.
- [ ] API: list (paged, per cow and per farm), create, edit, delete, with the same roles as other Dairy data.
- [ ] The existing date fields on the cow keep working; new events keep them in step (additive, no forced migration).
- [ ] Included in backup and restore, demo data and farm deletion (move/delete).
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
