# Phase 19: Final testing A: real MongoDB

**Status:** Not started

## Goal

Everything that needs a real MongoDB is tested on disposable copies of your backups.

## Already in place (from Phase 0)

- All earlier phases are implemented and pass the command-line checks.

## Scope

- Restore each backup into a separate throwaway database (local MongoDB Community plus Compass, or a disposable Atlas database).
- Migration for Agri, Dairy and Flock: dry run, apply, run again (idempotent); compare record counts and farm ownership before and after.
- Index listings and representative query plans, including Flock's unique `(farmId, key)` index and the Dairy per-farm ear-tag index.
- Persistent backup and restore on the copies: Agri diary media, Dairy suppliers and payments, Flock images (exact bytes and metadata), monthly chunks, and legacy backups.
- Flock egg-inventory lock with two backend processes on one MongoDB.
- Repeat the 84-case farm-deletion safety run and a Flock restore of an image larger than 3.3 MB.
- Archive and restore on the copies; photo storage with the default store.
- Record the size of each database against the free-tier cap.

## Out of scope

- No production database, ever.

## Steps

1. Confirm the disposable target and take a fresh backup.
2. Run each item and tick it only with the observed result.
3. Open a fix note for any failure.

## New command-line check

Save each script used as `tools/final-db-*.js` so the run can be repeated.

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

- [ ] Restore each backup into a separate throwaway database (local MongoDB Community plus Compass, or a disposable Atlas database).
- [ ] Migration for Agri, Dairy and Flock: dry run, apply, run again (idempotent); compare record counts and farm ownership before and after.
- [ ] Index listings and representative query plans, including Flock's unique `(farmId, key)` index and the Dairy per-farm ear-tag index.
- [ ] Persistent backup and restore on the copies: Agri diary media, Dairy suppliers and payments, Flock images (exact bytes and metadata), monthly chunks, and legacy backups.
- [ ] Flock egg-inventory lock with two backend processes on one MongoDB.
- [ ] Repeat the 84-case farm-deletion safety run and a Flock restore of an image larger than 3.3 MB.
- [ ] Archive and restore on the copies; photo storage with the default store.
- [ ] Record the size of each database against the free-tier cap.
- [ ] The new command-line check above exists and passes.
- [ ] The standard checks above all pass (write the real results in `docs/PROGRESS.md`).
- [ ] `docs/PROGRESS.md`, `docs/ROADMAP.md` and `docs/phases/README.md` are updated.

## Rules for whoever works on this phase

1. Use disposable data only: a throwaway database, a staging copy, test accounts. Never test destructive things (migrations, restores, farm deletion, concurrency) on live data.
2. Take a fresh backup first and confirm it opens.
3. Record every result (pass or fail) in `docs/PROGRESS.md` with the date, and fix failures in a small follow-up phase note, not by skipping the item.
4. A box is ticked only after the check was actually done and its result observed.
5. Stop and report if a safe disposable target cannot be confirmed.
