# Phase 5: Agri fields and crop cycles: server

**Status:** Done

## Goal

Land is organised as Farm, Field (with acres), Crop cycle (season) so profit can be seen per field and per season.

## Already in place (from Phase 0)

- Agri crops have a `season` filter field but there is no field (land) record.
- Agri finance entries link to crops.

## Scope

- A farm-scoped `Field` collection: name, acres, notes.
- A crop can link to a field and a season (`fieldId`, `season`); old crops without a link keep working.
- Finance entries can optionally link to a field and a crop cycle.
- Server filters and the existing `/analytics/summary` can group by field and by season.
- Included in backup/restore, demo data and farm deletion.

## Out of scope

- No screens (Phase 6).
- No forced change of old crop records.

## Implementation checkpoint (2026-10-25)

Initial server implementation is committed on `muf-monorepo`:

- Added the farm-scoped `Field` model and authenticated CRUD routes for field name, acreage and notes. Duplicate names are rejected within the selected farm; invalid/negative acreage is rejected; deleting a field is blocked while crop cycles or finance entries reference it.
- Crops can optionally reference `fieldId`, with server validation that the field exists in the selected farm. Legacy crops using the existing text `field` value remain supported.
- Finance entries support optional `fieldId` and `cropCycleId`; the server validates those links for normal and bulk create paths.
- `/analytics/summary` now returns finance totals grouped by field and season, including an explicit unassigned/farm-wide bucket so grouped values remain reconcilable to the ledger total.
- Fields are included in backup/restore, farm-scoped model migration/deletion, and memory-mode demo data. Demo crop cycles are linked to seeded fields where their legacy field name matches.
- Added `tests/agri-fields-cycles.test.ts`, expanded the Agri HTTP integration tests, and added cross-farm field/link assertions to `npm run check-farms`.

**Verification status (2026-10-25): Done for the command-line scope.** The owner supplied Windows CMD output confirming the required checks passed on branch `muf-monorepo`. Results are recorded in `docs/PROGRESS.md`. These are owner-reported results, not commands independently run in this editing session. No real-MongoDB, browser/phone, or live-site verification is claimed; those remain in Phases 19 to 21.

## Steps

1. Write the field and cycle schema in this file.
2. Add the model, routes and filters.
3. Extend the summary route.
4. Wire backup/restore and the farm-delete model list.
5. Add the check below.

## New command-line check

`tests/agri-fields-cycles.test.ts` plus new cases in `npm run check-farms`: fields of farm B never show in farm A, a crop without a field still lists, and profit grouped by field adds up to the farm total.

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

- [x] A farm-scoped `Field` collection: name, acres, notes.
- [x] A crop can link to a field and a season (`fieldId`, `season`); old crops without a link keep working.
- [x] Finance entries can optionally link to a field and a crop cycle.
- [x] Server filters and the existing `/analytics/summary` can group by field and by season.
- [x] Included in backup/restore, demo data and farm deletion.
- [x] The new command-line check above exists and passes.
- [x] The standard checks above all pass (write the real results in `docs/PROGRESS.md`).
- [x] `docs/PROGRESS.md`, `docs/ROADMAP.md` and `docs/phases/README.md` are updated.

## Rules for whoever works on this phase

1. When work starts, set **Status** below to `In progress` and update the tables in `docs/PROGRESS.md` and `docs/phases/README.md`. When it ends, set `Done` and write the real command results in `docs/PROGRESS.md`.
2. Add at least one new command-line check for this phase and name it under **New command-line check**. A phase is not done without it.
3. Report only commands you actually ran, with what they printed. If you did not run something, say so.
4. This phase uses command-line tests only: no live websites, no real MongoDB, no browsers or phones. Nothing is postponed: if part of this phase can only be tested live, add it to the matching list in Phase 19, 20 or 21.
5. Ask the owner before removing any feature (the Flock Home Birds trims are already allowed).
6. Stay inside this phase's scope. If a shared MUF file changes, keep the three copies identical (`npm run check-sync`).
7. Keep the other two apps working: run all three builds even when only one app changed.
