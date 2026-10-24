# Phase 11: Yearly archive for old records: server

**Status:** Not started

## Goal

Old years of records can be archived and exported so the live data stays small and screens stay fast.

## Already in place (from Phase 0)

- Backups and exports exist; there is no archive step.

## Scope

- An owner-only archive job per farm: moves records older than a chosen number of years (default to be agreed) into an archive collection and writes a downloadable export first.
- Nothing is deleted without a successful export and a typed confirmation.
- Archived records are excluded from normal lists and totals but can be read and restored.
- Covers the high-volume collections first: Dairy milk and expenses, Flock batch logs, Agri finance.

## Out of scope

- No screens (Phase 12).

## Steps

1. Agree the rules in this file (which collections, how many years, what is kept).
2. Implement archive, export and restore for one collection, then the others.
3. Make backups include or reference archives.
4. Add the check.

## New command-line check

`tests/archive.test.ts` plus new cases in `npm run check-farms`: archiving farm B never touches farm A, an archive without a finished export refuses to delete, and restore brings records back unchanged.

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

- [ ] An owner-only archive job per farm: moves records older than a chosen number of years (default to be agreed) into an archive collection and writes a downloadable export first.
- [ ] Nothing is deleted without a successful export and a typed confirmation.
- [ ] Archived records are excluded from normal lists and totals but can be read and restored.
- [ ] Covers the high-volume collections first: Dairy milk and expenses, Flock batch logs, Agri finance.
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
