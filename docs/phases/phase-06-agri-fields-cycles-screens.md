# Phase 6: Agri fields and crop cycles: screens

**Status:** Done

## Goal

Owners and managers create fields, assign crops to a field and season, and see profit per field and per season.

## Already in place (from Phase 0)

- Agri summary-first dashboard and paged lists.

## Scope

- A Fields screen (add, edit, acres).
- Crop forms get field and season pickers.
- Finance forms get optional field and cycle pickers.
- Per-field and per-season profit in the dashboard and reports.
- Urdu labels for every new word.

## Out of scope

- No new data model (Phase 5).

## Final validation (2026-10-26)

The owner supplied Windows CMD output from the repository root on branch `muf-monorepo`.

| Command/check | Result |
|---|---|
| `npm test -- tests/agri-fields-screens.test.ts` | Passed: 1 file, 4 tests |
| `npm test` | Passed: 29 files, 264 tests, 0 failures |
| `npm run check-docs` | Passed: all phase documentation checks, links and status indexes |
| `tools\\build-all.bat` | Passed: Dairy, Flock and Agri production builds |
| `npm run check-sync` | Owner-reported passed at the Phase 6 checkpoint before the final test-only assertion correction |
| `npm run check-ui` | Owner-reported passed at the Phase 6 checkpoint before the final test-only assertion correction |
| `npm run check-workbench` | Owner-reported passed: 23 source checks, before the final test-only assertion correction |
| `npm run check-farms` | Owner-reported passed: farm-scope and Dairy breeding-event runtime checks, before the final test-only assertion correction |

The initial failure was a stale source-contract test expectation for the update API call; the implementation correctly includes the payload argument. The assertion was corrected, and the owner subsequently supplied passing focused and full test results. The final correction changed only the test expectation. Results are owner-reported, not commands executed independently in this editing session.

**Completion boundary:** Phase 6 is Done for the planned command-line scope. This does not claim manual browser/phone review or real-MongoDB/live-site verification; those remain in Phases 19 to 21.

## Steps

1. Read the shared popup and form rules.
2. Build the Fields screen and pickers.
3. Add the profit views using the summary route.
4. Add the check and run the Agri build.

## New command-line check

`tests/agri-fields-screens.test.ts`: source-contract checks for the Fields screen, the pickers and the per-field profit view, plus Urdu labels. The owner supplied a passing result: 4/4 tests.

## Command-line checks at the end of this phase

```
npm ci
npm test
npm run check-sync
npm run check-ui
npm run check-workbench
npm run check-farms
npm run check-docs
tools\\build-all.bat
```

`npm run check-workbench-runtime` is optional and needs port 5000 free.

## Done checklist

- [x] A Fields screen (add, edit, acres).
- [x] Crop forms get field and season pickers.
- [x] Finance forms get optional field and cycle pickers.
- [x] Per-field and per-season profit in the dashboard and reports.
- [x] Urdu labels for the new Phase 6 labels covered by the screen-contract tests.
- [x] The new command-line check above exists and passes (4/4).
- [x] The full test suite passes (29 files, 264 tests).
- [x] Standard sync, UI, workbench and farm checks were owner-reported passing at this checkpoint; the final correction was test-only.
- [x] All three production builds pass.
- [x] Documentation checks pass after this phase status update.
- [x] `docs/PROGRESS.md`, `docs/ROADMAP.md` and `docs/phases/README.md` are updated.

## Rules for whoever works on this phase

1. Keep this file, `docs/PROGRESS.md`, `docs/ROADMAP.md` and `docs/phases/README.md` status values in sync.
2. Record only command results actually observed; distinguish owner-reported output from commands run during editing.
3. Do not remove existing features without the owner's approval.
4. Keep shared MUF twins identical and keep all three apps building.
5. Command-line checks do not prove browser/mobile behavior or real-MongoDB behavior. Those are reserved for the final verification phases.
