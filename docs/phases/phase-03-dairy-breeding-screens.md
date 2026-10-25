# Phase 3: Dairy breeding events: screens

**Status:** In progress

## Goal

Managers and workers record heat, tikka, pregnancy checks and calvings from the Breeding tab and pick the father.

## Already in place (from Phase 0)

- The Dairy Breeding tab with due-date alerts.

## Scope

- Forms for each event type with date, technician and result.
- A father picker: a searchable list of bulls on the farm or an outside bull or straw (name and semen code).
- A per-cow history list of events.
- Urdu labels for every new word, following the existing Urdu rules.

## Out of scope

- Calf creation (Phase 4).

## Steps

1. Read `BreedingTab.tsx` and the popup rules in `RULES.md` first.
2. Build the forms with the shared MUF popup and form components.
3. Add Urdu terms to the MUF term files in all three apps and keep them identical.
4. Add the check below and run the Dairy build.

## Implementation checkpoint (2026-10-25)

The first screen implementation is on `muf-monorepo`: `BreedingEventsPanel.tsx` is mounted beneath the existing breeding calendar, with create/edit forms, event and cow filters, per-event history, a searchable farm-bull picker, outside bull/straw details, shared MUF popup/form styles, and Urdu labels. Client API methods and `tests/dairy-breeding-screens.test.ts` are added. **Local Vitest, UI safety, sync, docs and production build checks have not yet been run for this screen work.**

## New command-line check

`tests/dairy-breeding-screens.test.ts`: source-contract checks that every event form, the father picker and the history list exist and use the shared MUF popup classes, plus the existing Urdu coverage test passing.

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

- [ ] Forms for each event type with date, technician and result.
- [ ] A father picker: a bull on the farm (searchable list) or an outside bull or straw (name and semen code).
- [ ] A per-cow history list of events.
- [ ] Urdu labels for every new word, following the existing Urdu rules.
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


`tests/dairy-breeding-screens.test.ts`: source-contract checks that every event form, the father picker and the history list exist and use the shared MUF popup classes, plus the existing Urdu coverage test passing.

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

- [ ] Forms for each event type with date, technician and result.
- [ ] A father picker: a bull on the farm (searchable list) or an outside bull or straw (name and semen code).
- [ ] A per-cow history list of events.
- [ ] Urdu labels for every new word, following the existing Urdu rules.
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
