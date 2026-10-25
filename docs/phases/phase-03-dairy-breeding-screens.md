# Phase 3: Dairy breeding events: screens

**Status:** In progress

## Goal

Managers and workers record heat, tikka, pregnancy checks and calvings from the Breeding tab and pick the father.

## Already in place

- The Dairy Breeding tab and its existing due-date calendar.
- Phase 2 farm-scoped API and breeding event storage.

## Scope

- Forms for heat, service/tikka, pregnancy checks and calving, including date, technician, result and notes.
- A searchable farm-bull picker or outside bull/straw details (name and semen code).
- A per-cow event history, with cow and event-type filters.
- Urdu labels for new text, with the shared term dictionaries identical across all three apps.
- Shared MUF popup and form primitives.

## Out of scope

- Automatic calf creation. That is Phase 4.

## Implementation checkpoint (2026-10-25)

The first screen implementation is on `muf-monorepo`:

- `BreedingEventsPanel.tsx` is mounted inside the existing Dairy Breeding tab; the calendar remains.
- Create/edit forms, cow/type filters, event history, searchable farm-bull selection, outside bull/straw details, and technician/result/notes fields are present.
- Typed client API methods and shared Urdu dictionary entries were added.
- `tests/dairy-breeding-screens.test.ts` adds seven source-contract regression tests.
- The owner reported that the focused screen tests passed (7/7), the full Vitest suite passed (26 files, 249 tests), `check-sync`, `check-workbench`, and `check-farms` passed, and all three production builds succeeded.
- The first `check-ui` run found one legacy Tailwind grid class in the new popup. It was replaced with the shared `muf-pc-form-grid` primitive. The owner then reran `check-ui`, and all UI-safety checks passed.
- The latest `check-docs` run failed because this phase file lacked three required section headings. Those headings are included below to address the reported failure. The owner must rerun `npm run check-docs` against this documentation fix before the docs check can be marked passed.
- These are owner-reported Windows CMD results, not commands executed during this documentation edit. No browser/mobile review or real-MongoDB verification is claimed.

## Steps

1. Keep the existing Breeding tab and due-date calendar; add the event manager alongside them.
2. Provide create/edit forms for heat, service/tikka, pregnancy checks and calving.
3. Support farm bulls and outside bull/straw father details, with relevant identifiers.
4. Show per-cow event history with cow and event-type filters.
5. Add Urdu labels through the shared dictionary twins, keeping all three copies synchronized.
6. Verify the new source-contract test, standard checks, and all three production builds.
7. Record only observed command output in `docs/PROGRESS.md`, and keep all phase status indexes synchronized.

## New command-line check

`npm test -- tests/dairy-breeding-screens.test.ts` runs the seven Phase 3 source-contract tests. The full suite also includes the existing Urdu fallback coverage test.

## Command-line checks at the end of this phase

Run these from the monorepo root in Windows CMD:

```cmd
npm test -- tests/dairy-breeding-screens.test.ts
npm test
npm run check-sync
npm run check-ui
npm run check-workbench
npm run check-farms
npm run check-docs
tools\build-all.bat
```

`npm run check-workbench-runtime` is optional and requires port 5000 to be free. Run all three builds even when only Dairy was changed. Do not mark the documentation check as passed until it has been rerun after the latest docs edits.

## Done checklist

- [ ] Forms cover all four event types and include date, technician, result and notes.
- [ ] Searchable farm-bull picker and outside bull/straw details work.
- [ ] Per-cow event history and filters work.
- [ ] New Urdu terms are present and all shared dictionary twins are identical.
- [x] The Phase 3 regression test passes (owner-reported: 7/7).
- [ ] All standard checks pass after the latest code and documentation changes. The latest reported `check-docs` run failed and must be rerun.
- [x] `docs/PROGRESS.md`, `docs/ROADMAP.md` and this index are current at the 2026-10-25 checkpoint.

## Rules for whoever works on this phase

1. Keep this file, `docs/PROGRESS.md`, `docs/ROADMAP.md` and `docs/phases/README.md` status values in sync.
2. Record only command results actually observed; distinguish owner-reported output from commands run during editing.
3. Do not remove existing features without the owner's approval.
4. Keep shared MUF twins identical and keep all three apps building.
5. Command-line checks do not prove browser/mobile behavior or real-MongoDB behavior. Those are reserved for the final verification phases.
