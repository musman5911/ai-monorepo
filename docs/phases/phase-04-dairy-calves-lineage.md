# Phase 4: Dairy calves and lineage

**Status:** In progress

## Goal

A calving event creates the calf with gender, mother and father, so lineage is never typed twice.

## Calving-to-calf rules

- A successful calving event is the source record. Calf records are created only by the server after the event is validated and saved; the client cannot submit a trusted `farmId` or bypass farm scope.
- Each live calf entry creates exactly one Cow record in the same farm as the mother and calving event, with `isCalf: true`, `status: calf`, the event birth date, gender, mother link, and available father/sire details. The parent must belong to that farm; a farm-bull sire must resolve to a valid male animal in that farm. Outside bull/straw details are copied from the validated event.
- A calving payload must describe its calf entries explicitly. Twins are two separate calf entries and therefore two separate calf records. Stillbirth entries are retained as calving outcomes but do not create a live calf record or inflate live-calf counts. If the existing event contract cannot express entries or stillbirths, extend it compatibly rather than silently guessing.
- Ear-tag uniqueness is case-insensitive after trimming and is enforced by the server within a farm. The same tag may exist in a different farm. A missing optional tag is allowed unless the existing Cow contract says otherwise.
- Event and generated calf changes must behave atomically from the caller's perspective. Use the repository's supported transaction mechanism if available; otherwise use a documented compensating rollback and test failures at each write boundary. Never leave an apparently successful calving event without its expected calf records.
- Editing a calving event must reconcile generated calves without duplicating them. Deleting an event must not silently orphan or erase calves that have subsequently been edited or referenced; reject the delete with a clear error unless a safe, explicit lifecycle is supported by the existing data model. Preserve existing non-calving event behavior.
- Lineage reads are farm-scoped. Unknown parent information is displayed as unavailable rather than causing the cow detail popup to fail.

## Already in place (from Phase 0)

- `isCalf`, `status: calf`, optional sire fields and ear tag exist on the cow record.

## Scope

- On a calving event the server creates one calf per entry with gender, birth date, mother link, father link (farm bull or outside straw) and the farm.
- Ear tag is unique per farm; a clash gives a clear error.
- A lineage view on the cow detail popup: mother, father, calves.
- Calving with twins and with a stillbirth is handled without breaking counts.

## Out of scope

- No change to milk or expense calculations.

## Implementation checkpoint (2026-10-25)

Initial implementation is on `muf-monorepo`:

- Calving events accept calf entries with gender, optional ear tag and outcome (`live` or `stillbirth`).
- The server creates one farm-scoped Cow record for each live entry, links the mother and available sire, records the source event, normalizes ear tags, checks duplicates within the selected farm, and rolls back created calves/event if creation fails.
- Events with generated calves reject unsafe changes to calf identity/date/sire and reject deletion to avoid orphaning calf records; ordinary notes/result edits remain allowed.
- The cow detail summary now returns the registered farm bull, and the lineage section displays mother, father (registered or outside sire) and offspring.
- The calving form supports multiple calf entries, gender, ear tags and stillbirth outcomes.
- Added `tests/dairy-calving-creates-calf.test.ts` and expanded the existing HTTP memory-mode breeding checker. `npm run check-farms` already invokes that runtime checker, so the new Phase 4 checks run as part of it.
- **Not yet verified:** no tests, checker, docs check or builds have been run after these code changes in this editing session. Do not mark this phase Done until the owner runs the end-of-phase commands locally and records the actual output in `docs/PROGRESS.md`.

## Steps

1. Write the calving-to-calf rules in this file.
2. Implement in the server, with a transaction-safe order (event first, then calf, with clean rollback on failure).
3. Add the lineage view.
4. Add the check below.

## New command-line check

`tests/dairy-calving-creates-calf.test.ts` and a new section in `npm run check-farms`: a calving in farm B creates a calf in farm B only, a duplicate ear tag in the same farm is refused, and the same tag in another farm is allowed.

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

- [ ] On a calving event the server creates one calf per entry with gender, birth date, mother link, father link (farm bull or outside straw) and the farm.
- [ ] Ear tag is unique per farm; a clash gives a clear error.
- [ ] A lineage view on the cow detail popup: mother, father, calves.
- [ ] Calving with twins and with a stillbirth is handled without breaking counts.
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
