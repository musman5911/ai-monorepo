# Phase 19: Final testing A: real MongoDB

**Status:** In progress

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

1. Confirm the disposable target is separate from production and take a fresh backup that opens.
2. Restore that backup only into a database named `muf_phase19_<app>_<copy>`; never reuse an app or production database.
3. Run the safety preflight, migration dry run, apply, and repeat apply; compare record counts and farm ownership.
4. Run the real-MongoDB scenarios one at a time and record observed output.
5. Open a fix note for any failure.

## New command-line check

`npm run check-final-db` runs the offline regression tests for the Phase 19 safety gate and migration wrapper. It must pass before live operations, but it does not connect to MongoDB and is not evidence that a real database test passed. Use `node tools/final-db-preflight.mjs`, `node tools/final-db-migrate.mjs`, and the read-only `node tools/final-db-inspect.mjs` for repeatable safety, migration, index/query-plan and database-size checks; keep every later database-test script under `tools/final-db-*.mjs`.

## Safety gate and repeatable migration commands

The scripts never read an ordinary app `.env` connection URI as their target. Set these values only in a private local CMD session for one app at a time:

| Variable | Requirement |
|---|---|
| `MUF_FINAL_DB_APP` | `agri`, `dairy`, or `flock` |
| `MUF_FINAL_DB_URI` | Connection URI for the dedicated test database only |
| `MUF_FINAL_DB_EXPECTED_HOST` | Exact target hostname as shown in the URI |
| `MUF_FINAL_DB_BACKUP` | Absolute path to a fresh, non-empty backup file outside the repository |
| `MUF_FINAL_DB_DISPOSABLE_CONFIRMED` | Set to `YES` only after independently confirming the target is not production |
| `MUF_FINAL_DB_BACKUP_VALIDATED` | Set to `YES` only after the backup has been opened/read successfully |
| `MUF_FINAL_DB_RESTORE_VERIFIED` | Set to `YES` only after restoring the backup to the target and sanity-checking records |
| `MUF_FINAL_DB_FREE_TIER_CAP_MB` | Actual documented storage cap for this provider/tier, in MB; do not guess |

The database name must start with `muf_phase19_agri_`, `muf_phase19_dairy_`, or `muf_phase19_flock_` according to the selected app. The backup file must be outside the repository and no older than 24 hours at preflight time. The preflight prints only the target host/database, backup name, size and SHA-256; it does not print URI credentials. After a restore is confirmed, set `MUF_FINAL_DB_FREE_TIER_CAP_MB` to the provider's actual documented cap, then run the read-only database inspector to list collections, estimated counts, index listings, representative query-plan metrics and the selected database's size share of that cap.

Run `node tools\final-db-preflight.mjs --pre-restore` before restoring the backup. After restoring it and checking records, set `MUF_FINAL_DB_RESTORE_VERIFIED=YES` and run `node tools\final-db-preflight.mjs` again. The migration runner defaults to a dry run; applying changes requires the explicit `--apply` flag:

```cmd
node tools\final-db-preflight.mjs --pre-restore
node tools\final-db-preflight.mjs
node tools\final-db-inspect.mjs
node tools\final-db-migrate.mjs
node tools\final-db-migrate.mjs --apply
node tools\final-db-migrate.mjs --apply
```

Do not paste a connection URI, username, password, backup contents, or real farm data into chat, issues, or committed files. The two `--apply` invocations are deliberately separate to test idempotence. Do not run them until the target restore has been independently verified. No database command should proceed if the target/backup safety confirmations are unavailable.
## Command-line checks at the end of this phase

```
npm ci
npm test
npm run check-final-db
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

## Phase 19 start (2026-10-29)

Phase 19 is **In progress**. Repository review found existing real-database migration scripts in all three backends, backup/restore implementations for Agri, Dairy and Flock, archive storage, Flock image backup helpers, and the farm-scoped egg-inventory lock. Existing tests cover memory-mode/source contracts but do not prove real MongoDB behavior.

Added a fail-closed configuration-and-backup preflight and a migration wrapper. The wrapper uses only the explicitly supplied `MUF_FINAL_DB_URI`, requires a dedicated Phase 19 database name, requires host confirmation, requires a fresh non-empty backup and manual confirmation that the backup opens and has been restored, and defaults migrations to dry-run. Unit tests cover these guards without connecting to MongoDB.

**Live database verification is blocked on environment evidence:** no disposable MongoDB target or fresh backup has been supplied or verified in this session. No real database connection, migration, restore, deletion, or concurrency test has been attempted. Keep all real-DB checklist items unchecked until their outputs are observed.

## Initial automated validation (2026-10-29)

GitHub Actions run [40852928322](https://github.com/musman5911/ai-monorepo/actions/runs/40852928322) passed on commit `83ecc481b68e645dd05f6929ab557d8d509ec5c3`: 48 test files / 424 tests passed; shared sync, UI safety, workbench source checks (23), farm scope, phase documentation and the seven-package production dependency audit all passed. The audit reported no high or critical production dependency findings. These are automated source/safety-guard checks only; this run did not connect to MongoDB or perform any backup, restore, migration, deletion or concurrency test.

## Rules for whoever works on this phase

1. Use disposable data only: a throwaway database, a staging copy, test accounts. Never test destructive things (migrations, restores, farm deletion, concurrency) on live data.
2. Take a fresh backup first and confirm it opens.
3. Record every result (pass or fail) in `docs/PROGRESS.md` with the date, and fix failures in a small follow-up phase note, not by skipping the item.
4. A box is ticked only after the check was actually done and its result observed.
5. Stop and report if a safe disposable target cannot be confirmed.
6. Run destructive migration tests only through `tools/final-db-migrate.mjs`; never run the backend migration scripts directly against an ordinary `.env` target during Phase 19.
7. A passing preflight proves only that the target/backup declarations satisfy the guard. It does not prove the database is disposable; the operator must independently verify the host and restore.
