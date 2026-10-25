# Phase 6: Agri fields and crop cycles: screens

**Status:** In progress

## Goal

Owners and managers create fields, assign crops to a field and season, and see profit per field and per season.

## Already in place (from Phase 0)

- Agri summary-first dashboard and paged lists.

## Scope

- A Fields screen (add, edit, acres).
- Crop forms get field and season pickers.
- Finance forms get optional field and cycle pickers.
- Per-field and per-season profit in the dashboard and reports.
- Urdu labels for every new word.

## Out of scope

- No new data model (Phase 5).

## Steps

1. Read the shared popup and form rules.
2. Build the Fields screen and pickers.
3. Add the profit views using the summary route.
4. Add the check and run the Agri build.

## New command-line check

`tests/agri-fields-screens.test.ts`: source-contract checks for the Fields screen, the pickers and the per-field profit view, plus the Urdu coverage test passing.

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

- [ ] A Fields screen (add, edit, acres).
- [ ] Crop forms get field and season pickers.
- [ ] Finance forms get optional field and cycle pickers.
- [ ] Per-field and per-season profit in the dashboard and reports.
- [ ] Urdu labels for every new word.
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
