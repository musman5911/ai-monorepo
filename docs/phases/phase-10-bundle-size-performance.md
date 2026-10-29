# Phase 10: Smaller downloads and faster screens

**Status:** Done

## Goal

The three apps load faster on phones with slow connections.

## Already in place

- Lazy-load the shared PDF shell from zakat, ushr and farm-book report actions.
- Lazy-load Agri's dashboard chart and Dairy's Reports screen.
- Lazy-load major tab/screens in Dairy and Flock, and defer selected Agri admin and worker panels.
- Replace Agri's deprecated `advancedChunks` setting with `rolldownOptions.output.codeSplitting`.
- Remove Dairy's mixed static/dynamic import of `api.ts` from `reportExport.ts`.
- Add `tools/check-bundle-size.js`, `npm run check-bundle-size`, and `tests/check-bundle-size.test.ts`.

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
- `tools\\build-all.bat`: **passed**, Dairy, Flock and Agri production builds.
- `npm run check-bundle-size`: **passed**. Largest JavaScript assets: Dairy 505.5 KiB / 700 KiB; Agri 420.1 KiB / 600 KiB; Flock 542.0 KiB / 850 KiB.
- `npm test`: **passed**, 38 files / 310 tests.
- `npm run check-ui`: **passed**, all UI safety checks.
- `npm run check-farms`: **passed**, farm-scope and Dairy breeding-event runtime checks.
- `npm run check-sync`: **passed**, all three apps and shared MUF files remain in sync.
- `npm run check-workbench`: **passed**, all 23 workbench source safety checks.
- `npm run check-docs`: **passed** before this final documentation status update; rerun after pulling.
- `npm ci` and `npm run check-workbench-runtime`: not reported as run for this checkpoint.

The largest individual JavaScript asset decreased from the initial measured build by 267.2 KiB in Dairy (772.7 to 505.5 KiB), 239.7 KiB in Agri (659.8 to 420.1 KiB), and 419.9 KiB in Flock (961.9 to 542.0 KiB). Each app's largest asset is now below its agreed per-file budget. These are per-file measurements, not a claim that total downloaded JavaScript decreased by the same amounts.

Phase 10 is **Done for command-line scope**. Browser/device behavior and real-world performance have not been verified here and remain part of Phases 19–21 as applicable. The workbench checker itself notes that source checks do not replace browser review.

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

- [x] Confirm PDF/chart/report code is split out of initial entry chunks and materially reduces the largest emitted JavaScript assets.
- [x] Direct-build warning state is accurately recorded: the Agri deprecated build warning and Dairy mixed-import warning were not confirmed absent by wrapper output and remain unverified. No warning-free claim is made; direct app output must be inspected if this matters for release.
- [x] Per-file JavaScript budgets recorded and compared with fresh output; all three apps are within budget.
- [x] No intentional screen redesign was made; browser-level behavior remains unverified.
- [x] `npm run check-bundle-size` exists and passes after all three production builds.
- [x] The standard command-line checks reported for this checkpoint pass: tests, sync, UI, workbench, farms, docs, and all three production builds.
- [x] `docs/PROGRESS.md`, `docs/ROADMAP.md` and `docs/phases/README.md` updated.

## Warning verification limitation (reviewed 2026-10-29)

The owner's latest `tools\\build-all.bat` output reports successful builds but does not show direct per-app build logs, so it does not prove the Agri deprecated warning or Dairy mixed-import warning are absent. The earlier warning-absence check is intentionally not reported as passed. Phase 10 remains Done for its command-line bundle-budget scope; the warning state is retained as an explicit unverified limitation, not hidden by the status label.

## Rules for whoever works on this phase

1. When work starts, set **Status** below to `In progress` and update the tables in `docs/PROGRESS.md` and `docs/phases/README.md`. When it ends, set `Done` and write the real command results in `docs/PROGRESS.md`.
2. Add at least one new command-line check for this phase and name it under **New command-line check**. A phase is not done without it.
3. Report only commands you actually ran, with what they printed. If you did not run something, say so.
4. This phase uses command-line tests only: no live websites, no real MongoDB, no browsers or phones. Nothing is postponed: if part of this phase can only be tested live, add it to the matching list in Phase 19, 20 or 21.
5. Ask the owner before removing any feature (the Flock Home Birds trims are already allowed).
6. Stay inside this phase's scope. If a shared MUF file changes, keep the three copies identical (`npm run check-sync`).
7. Keep the other two apps working: run all three builds even when only one app changed.
