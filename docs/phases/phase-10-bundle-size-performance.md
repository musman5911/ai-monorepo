# Phase 10: Smaller downloads and faster screens

**Status:** In progress

## Goal

The three apps load faster on phones with slow connections.

## Already in place (from Phase 0)

- Previously recorded build output (Phase 0; must be refreshed at the start of this phase): Flock about 977 kB, Dairy about 760 kB, Agri about 659 kB for the largest file. Agri uses the deprecated `advancedChunks` setting; Dairy imports `api.ts` both statically and dynamically.
- Initial repository inspection confirms PDF utilities are imported by main app modules and charts are imported eagerly in Agri. Fresh baseline sizes have not yet been measured in this session.

## Scope

- Load PDF, charts and the workbench only when needed (lazy loading).
- Fix the Agri deprecated build setting and the Dairy mixed import warning.
- Set a size budget per app, agreed in this file.
- No change to how screens look or behave.

## Out of scope

- No redesign.

## Steps

1. Run `tools\\build-all.bat`, capture the exact largest emitted JS chunks and warnings for each app, and record them here.
2. Lazy-load PDF utilities, charts and the workbench entry points only at their use points; split the biggest chunks one app at a time.
3. Rebuild and compare after each change; keep the app's current screens and behavior unchanged.
4. Add `tools/check-bundle-size.js`, configure an explicit per-app budget based on the measured baseline and achievable reductions, and expose `npm run check-bundle-size`.

## New command-line check

`npm run check-bundle-size`: reads each app's `dist` folder after a build and fails if any file is over its budget.

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

- [ ] Load PDF, charts and the workbench only when needed (lazy loading).
- [ ] Fix the Agri deprecated build setting and the Dairy mixed import warning.
- [ ] Set a size budget per app, agreed in this file.
- [ ] No change to how screens look or behave.
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
