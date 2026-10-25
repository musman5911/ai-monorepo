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
- The owner ran the focused screen test and full Vitest suite successfully. `check-sync`, `check-farms`, `check-docs`, and all three production builds also passed.
- The first `check-ui` run found one legacy Tailwind grid class in the new popup. The class has now been replaced with the shared `muf-pc-form-grid` primitive. **The UI-safety rerun and post-fix builds are still pending.**

## New command-line check

`npm test -- tests/dairy-breeding-screens.test.ts` runs the seven Phase 3 source-contract tests. The full suite also includes the existing Urdu fallback coverage test.

## Standard checks

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

`npm run check-workbench-runtime` is optional and requires port 5000 to be free. Run all three builds even when only Dairy was changed.

## Done checklist

- [ ] Forms cover all four event types and include date, technician, result and notes.
- [ ] Searchable farm-bull picker and outside bull/straw details work.
- [ ] Per-cow event history and filters work.
- [ ] New Urdu terms are present and all shared dictionary twins are identical.
- [ ] The Phase 3 regression test passes.
- [ ] All standard checks pass after the latest code change.
- [ ] `docs/PROGRESS.md`, `docs/ROADMAP.md` and this index are current.

## Rules

1. Keep this file, `docs/PROGRESS.md`, `docs/ROADMAP.md` and `docs/phases/README.md` status values in sync.
2. Record only command results actually observed; distinguish owner-reported output from commands run during editing.
3. Do not remove existing features without the owner's approval.
4. Keep shared MUF twins identical and keep all three apps building.
5. Command-line checks do not prove browser/mobile behavior or real-MongoDB behavior. Those are reserved for the final verification phases.
