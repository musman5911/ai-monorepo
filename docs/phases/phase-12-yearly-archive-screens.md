# Phase 12: Yearly archive: screens

**Status:** In progress

## Goal

The owner runs, reviews and restores archives from a screen.

## Already in place (from Phase 0)

- The Phase 11 server archive.

## Scope

- An owner-only Archive screen: choose farm and years, preview counts, run, download the export.
- A list of past archives with restore.
- Reports can optionally include archived years.
- Urdu labels for every new word.

## Out of scope

- No new server rules.

## Audit findings and implementation plan (2026-10-26)

- The Phase 11 owner-only archive API is mounted separately in Dairy, Flock and Agri and shares `shared/muf-yearly-archive.mjs`.
- Each app already has an Admin > Reports section and shared `MufAdminReports` layout. The archive controls should be an owner-only panel embedded in that existing admin flow, not a new public navigation route.
- The current report datasets are fetched from active-list APIs, so archived records must not silently be mixed into existing totals. The report option must be explicit and use the archive read endpoint, with farm and date scope validated by the server.
- Keep the shared MUF report twin files byte-identical. Preserve existing API authentication helpers and Urdu translation patterns in each app.

## Steps

1. Audit shared archive request/response contracts and each app's owner-role checks, authenticated fetch helper, and reports/admin integration.
2. Add an owner-only archive panel with explicit farm and retention-year selection, preview, export download before execution, exact typed confirmation, archive history, and restore with conflict/error feedback.
3. Add an explicit archived-year report option without changing default active-only reports; only include archived records when the user chooses the relevant archive/date scope.
4. Add `tests/archive-screens.test.ts` for owner gating, required workflow states, export-before-execute, and explicit archived-report opt-in.
5. Run the focused test, full suite, sync/UI/workbench/farm/docs checks, and all three production builds; update the phase records with observed results.

## Implementation checkpoint (2026-10-26)

- Added byte-identical `YearlyArchivePanel.tsx` components to all three app frontends and mounted each in Admin > Reports.
- The panel lists farms from the existing farm API, requests a server-side snapshot preview, downloads the JSON export, requires exact farm name and job ID before archive/restore, lists job history, and offers a separate opt-in view of snapshot records.
- Existing report datasets are unchanged; archived records are not merged into active totals.
- Added `tests/archive-screens.test.ts` to assert owner gating, export-before-execute, exact confirmation, restore/report paths, supported collections, and identical panel copies.
- Owner-supplied local verification after commit `2810316`: focused archive-screen test passed (5 tests); full suite passed (40 files, 325 tests); sync, UI safety, workbench (23 checks), farm scope, phase docs, and all three production builds passed. The owner also reported a clean Git working tree.
- These commands were run by the owner in the Windows checkout and were not independently executed in this editing session.
- Added Urdu dictionary entries for the archive screen and localized its visible controls/status labels in all three apps; a source-contract test now checks key translations and dictionary parity.
- Workflow review found and fixed two UI safety/usability issues: export completion is now confirmed by polling the server's `exportDownloaded` marker before the UI enables execution, and changing farm/collection/retention clears stale job confirmations. The preview now shows the prepared collection explicitly.
- The three archive panels and Urdu dictionary twins are byte-identical by source inspection. Local tests and production builds must be rerun after these latest changes; Phase 12 is not yet complete.

## New command-line check

`tests/archive-screens.test.ts`: source-contract checks that the Archive screen is owner-only and has the preview, export, confirm, report and restore steps.

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

- [ ] An owner-only Archive screen: choose farm and years, preview counts, run, download the export.
- [ ] A list of past archives with restore.
- [ ] Reports can optionally include archived years.
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
