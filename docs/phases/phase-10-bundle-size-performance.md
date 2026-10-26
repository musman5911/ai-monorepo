# Phase 10: Smaller downloads and faster screens

**Status:** In progress

## Goal

The three apps load faster on phones with slow connections.

## Already in place (from Phase 0)

- Fresh owner-reported production build (2026-10-26): Dairy largest JavaScript file `index-C0HskdMJ.js` = 772.7 KiB; Agri `index-DL0ydQ8A.js` = 659.8 KiB; Flock `index-xqhjsCDQ.js` = 961.9 KiB.
- The initial source used Agri's deprecated `advancedChunks` setting and had a mixed static/dynamic import of Dairy's `api.ts`. Source corrections are committed and all three builds succeeded. `tools\\build-all.bat` summarizes builds rather than exposing full bundler warnings, so absence of warnings is not confirmed by this output.

## Scope

Per-file JavaScript budgets (largest emitted `.js`/`.mjs` file in each app): Dairy 700 KiB, Agri 600 KiB, Flock 850 KiB. The first measured build exceeds all three budgets: Dairy by 72.7 KiB, Agri by 59.8 KiB, and Flock by 111.9 KiB. Do not raise budgets just to make the check pass; split or defer the actual large dependencies, then measure again. The check fails if an app has no built JavaScript assets.

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
4. Add `tools/check-bundle-size.js`, expose `npm run check-bundle-size`, and test pass, over-budget, and missing-build cases.

## Latest verification (owner-reported, 2026-10-26)

- `npm test -- tests/check-bundle-size.test.ts`: **passed**, 1 file / 3 tests.
- `npm run check-sync`: **passed**; three-app MUF parity checks passed.
- `npm run check-docs`: **passed**.
- `tools\\build-all.bat`: **passed**, Dairy, Flock and Agri all built successfully.
- `npm test`: **passed**, 38 files / 310 tests.
- `npm run check-ui`: **passed**.
- `npm run check-workbench`: invoked; the pasted log does not include a final summary line, so treat this as unconfirmed until rerun if needed.
- `npm run check-farms`: **passed**, farm-scope checks and Dairy breeding runtime checks reported success.
- `npm run check-bundle-size`: **failed as expected** because all three largest chunks exceed their budgets: Dairy 772.7/700 KiB, Agri 659.8/600 KiB, Flock 961.9/850 KiB.
- `npm ci` and `npm run check-workbench-runtime` were not shown as run.

The build and full tests pass, but the bundle-size gate does not. Phase 10 remains In progress. Next work is to inspect the actual emitted chunk composition and Vite/Rolldown split behavior, then reduce initial entry chunks and rerun the same checks.

## New command-line check

`npm run check-bundle-size`: scans built `.js`/`.mjs` assets under all three `dist/assets` folders and fails if any JavaScript asset exceeds its app budget or a build output is missing.

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

- [ ] Confirm PDF/chart/report code is split out of initial entry chunks and materially reduces initial downloads; current bundle measurements show the first pass is not sufficient.
- [ ] Confirm the Agri deprecated build warning and Dairy mixed-import warning are absent in direct app build output; the wrapper build output alone does not confirm warning status.
- [x] Per-file JavaScript budgets recorded and compared with fresh output; all three apps currently exceed their limits.
- [ ] No change to how screens look or behave.
- [ ] `npm run check-bundle-size` exists and passes after all three production builds.
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
