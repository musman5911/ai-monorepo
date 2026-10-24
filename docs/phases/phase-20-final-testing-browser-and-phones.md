# Phase 20: Final testing B: browser and phones

**Status:** Not started

## Goal

Real people's screens are checked in a browser and on the phones workers use.

## Already in place (from Phase 0)

- Phase 19 passed. Local test accounts are in `docs/LOCAL-ROLE-TEST-ACCOUNTS.md` (memory mode only).

## Scope

- Owner, manager and worker walkthroughs in all three apps: farm switching, All farms read-only, Farms & Access, users, backup and restore, farm delete flows.
- Dairy: milk sheet, bulk health, breeding events, calving to calf. Flock: batches, Home Birds, bulk logs, incubation. Agri: fields and cycles, imports, summaries.
- Screen sizes 360, 390, 768/1024 and 1440 px in light, dark and Urdu; popup and form behaviour.
- Slow connection and offline banner behaviour while saving.
- Rebuild the screenshot tests that were removed in Phase 0 of the old plan, now that screens are final.
- The old Phase 3 browser matrix (see `docs/archive/PHASE-03-LOCAL-VERIFICATION.md`).

## Out of scope

- No new features.

## Steps

1. Write the checklist in this file from the items above.
2. Run it on the staging copy.
3. Record results with screenshots where useful.

## New command-line check

Screenshot test commands added to `package.json` (for example `npm run test:visual`) and documented here.

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

- [ ] Owner, manager and worker walkthroughs in all three apps: farm switching, All farms read-only, Farms & Access, users, backup and restore, farm delete flows.
- [ ] Dairy: milk sheet, bulk health, breeding events, calving to calf. Flock: batches, Home Birds, bulk logs, incubation. Agri: fields and cycles, imports, summaries.
- [ ] Screen sizes 360, 390, 768/1024 and 1440 px in light, dark and Urdu; popup and form behaviour.
- [ ] Slow connection and offline banner behaviour while saving.
- [ ] Rebuild the screenshot tests that were removed in Phase 0 of the old plan, now that screens are final.
- [ ] The old Phase 3 browser matrix (see `docs/archive/PHASE-03-LOCAL-VERIFICATION.md`).
- [ ] The new command-line check above exists and passes.
- [ ] The standard checks above all pass (write the real results in `docs/PROGRESS.md`).
- [ ] `docs/PROGRESS.md`, `docs/ROADMAP.md` and `docs/phases/README.md` are updated.

## Rules for whoever works on this phase

1. Use disposable data only: a throwaway database, a staging copy, test accounts. Never test destructive things (migrations, restores, farm deletion, concurrency) on live data.
2. Take a fresh backup first and confirm it opens.
3. Record every result (pass or fail) in `docs/PROGRESS.md` with the date, and fix failures in a small follow-up phase note, not by skipping the item.
4. A box is ticked only after the check was actually done and its result observed.
5. Stop and report if a safe disposable target cannot be confirmed.
