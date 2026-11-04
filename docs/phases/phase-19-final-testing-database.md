# Phase 19: Final testing A: real MongoDB

**Status:** In progress

## Goal

Everything that needs a real MongoDB is tested on disposable copies of your backups.

## Already in place (from Phase 0)

- All earlier phases are implemented and pass the command-line checks.

## Scope

- Restore each backup into a separate throwaway database (local MongoDB Community plus Compass, or a disposable Atlas database).
- Build rich, farm-isolated demo fixtures and seed only explicitly named disposable MongoDB databases with the dry-run-first seed helper.
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

`npm run check-final-db` runs the offline regression tests for the Phase 19 safety gate and migration wrapper. `npm run check-seed` exercises all three shared rich seed plans and the disposable-target safety rules without opening a MongoDB connection. Both are source/contract checks only and are not evidence that a real database test passed. Use `node tools/final-db-preflight.mjs`, `node tools/final-db-migrate.mjs`, and the read-only `node tools/final-db-inspect.mjs` for repeatable safety, migration, index/query-plan and database-size checks; keep every later database-test script under `tools/final-db-*.mjs`.

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
npm run check-seed
node --check tools\\seed-test-db.js
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

## Rich demo fixtures and disposable database seed helper

The rich memory demo uses five distinct farms in each app. Farms 1–4 contain farm-scoped data; Farm 4 is archived; Farm 5 is intentionally empty. Dairy includes 60 days of milk history, per-farm ear tags, breeding event types, linked calving calves, and a sold animal with retained breeding events. Agri includes fields, seasonal crop cycles, linked finance and tasks, inventory, liabilities, suppliers and labor records. Flock includes batch records and all batch log types, home birds capped at 50, and incubation allocations tied to a source batch. Each app has eight shop products with mixed publication states and no external product-image URL.

`MUF_DEMO_PROFILE=basic` keeps the original two-farm fixture for older runtime checks. `MUF_DEMO_PROFILE=rich` selects the five-farm fixture; after compatibility updates the local demo default is rich. `MUF_SEED_TODAY=YYYY-MM-DD` pins generated dates, and the pseudo-random sequence is fixed per app. Role accounts and their farm assignments are listed in [LOCAL-ROLE-TEST-ACCOUNTS.md](../LOCAL-ROLE-TEST-ACCOUNTS.md). These passwords are test-only.

The root helper `tools/seed-test-db.js` uses the same shared seed definitions as memory mode. It always seeds the rich profile and requires `--app dairy`, `--app agri`, or `--app flock`. It accepts only the explicit `MUF_SEED_URI`; it never falls back to the ordinary app `MONGO_URI`/`MONGODB_URI`. It prints only the hostname and database name, never the URI credentials.

The database name must match `^muf_(phase19|test|demo|seed)_[a-z0-9_]+# Phase 19: Final testing A: real MongoDB

**Status:** In progress

## Goal

Everything that needs a real MongoDB is tested on disposable copies of your backups.

## Already in place (from Phase 0)

- All earlier phases are implemented and pass the command-line checks.

## Scope

- Restore each backup into a separate throwaway database (local MongoDB Community plus Compass, or a disposable Atlas database).
- Build rich, farm-isolated demo fixtures and seed only explicitly named disposable MongoDB databases with the dry-run-first seed helper.
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

`npm run check-final-db` runs the offline regression tests for the Phase 19 safety gate and migration wrapper. `npm run check-seed` exercises all three shared rich seed plans and the disposable-target safety rules without opening a MongoDB connection. Both are source/contract checks only and are not evidence that a real database test passed. Use `node tools/final-db-preflight.mjs`, `node tools/final-db-migrate.mjs`, and the read-only `node tools/final-db-inspect.mjs` for repeatable safety, migration, index/query-plan and database-size checks; keep every later database-test script under `tools/final-db-*.mjs`.

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
npm run check-seed
node --check tools\\seed-test-db.js
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

; names containing `prod`, `production`, or `live` are refused, as is `NODE_ENV=production`. Non-local hosts require the explicit `MUF_SEED_ALLOW_REMOTE=1` opt-in. A dry run is the default and makes no writes. The helper refuses a database with existing records unless `--reset --apply` is explicitly supplied; that combination drops the selected database before recreating the fixture. Use it only on a verified throwaway database.

Windows CMD example for a local empty test database:

```cmd
set MUF_SEED_URI=mongodb://localhost:27017/muf_test_dairy_demo
node tools\\seed-test-db.js --app dairy
node tools\\seed-test-db.js --app dairy --apply
```

To deliberately replace this same disposable database on a later run:

```cmd
node tools\\seed-test-db.js --app dairy --reset --apply
```

For an Atlas or other remote endpoint, keep the URI private and set `MUF_SEED_ALLOW_REMOTE=1` only after independently confirming the target is a throwaway database. Do not commit a URI, backup, or generated data dump. The seeder is not a migration tool and must never be pointed at production.

## Rules for whoever works on this phase

1. Use disposable data only: a throwaway database, a staging copy, test accounts. Never test destructive things (migrations, restores, farm deletion, concurrency) on live data.
2. Take a fresh backup first and confirm it opens.
3. Record every result (pass or fail) in `docs/PROGRESS.md` with the date, and fix failures in a small follow-up phase note, not by skipping the item.
4. A box is ticked only after the check was actually done and its result observed.
5. Stop and report if a safe disposable target cannot be confirmed.
6. Run destructive migration tests only through `tools/final-db-migrate.mjs`; never run the backend migration scripts directly against an ordinary `.env` target during Phase 19.
7. A passing preflight proves only that the target/backup declarations satisfy the guard. It does not prove the database is disposable; the operator must independently verify the host and restore.

## Empty disposable database setup track (2026-10-30)

The owner selected the empty-database integration-test path for the three disposable Atlas targets:

- Agri: `muf_phase19_agri_local`
- Dairy: `muf_phase19_dairy_local`
- Flock: `muf_phase19_flock_local`

These are intentionally blank databases. This track does not need a production export or a backup of empty databases. It must not be used as evidence for the separate legacy-data restore/migration checklist above.

First-owner setup differs by app:

- Agri: `GET /api/check-setup`, then `POST /api/signup`; the first-owner path invokes `mufMigrateFarms` and creates the initial `Farm 1`.
- Dairy: `GET /api/auth/check`, then `POST /api/auth/setup`; setup also invokes `mufMigrateFarms` and creates the initial `Farm 1`.
- Flock: `GET /api/auth/can-signup`, then verification through `POST /api/auth/signup/request-code` and `POST /api/auth/signup/verify`. With SMTP configured, the code is emailed. For `NODE_ENV=development` only, when SMTP is not configured, the one-time code is printed to the local Flock server console; the code is never included in the HTTP response, and production continues to require SMTP email. The Flock first-owner verification route invokes `mufMigrateFarms` after creating the owner, so the first farm and in-process default farm are initialized before the owner uses farm-scoped routes or monthly image backups.

The Flock first-owner fix is source/test coverage only until the updated branch is pulled and exercised against the local Flock test database. After owner setup, verify farm creation, test-record CRUD, farm isolation, and backup behavior. Keep all production databases untouched.

The existing `tools/final-db-*.mjs` migration workflow remains reserved for the restored-copy/legacy-data track. Do not bypass its backup/restore guards for empty-database setup tests, and do not run migrations against production.

## Dairy API request-limit correction (2026-11-03)

During the owner's live Dairy checks, the same HTTP 429 response appeared on Backup, Dashboard, Breeding and other screens. Source review found that one IP-based limiter capped every API route at 300 requests per 15 minutes, while the dashboard loads several datasets in parallel. The App shell also fetched health alerts and today's milk again on every tab change, duplicating requests made by the Dashboard.

The Dairy general API ceiling is now 1,200 requests per 15 minutes. The stricter route-specific limits for login (5), first-owner setup (3), password reset (5) and user management (20) remain in place. Shared header health/milk indicators now load once per authenticated session instead of on each tab switch. Added a source-contract regression test for both protections.

**Owner validation (2026-11-03):** the owner pulled commit `f50d196`; `npx vitest run tests/dairy-api-usage.test.ts` passed (1 file / 2 tests), and `npm run build` in `dairy_farm/client` passed with TypeScript checking plus Vite (3,224 modules). The backend started on port 3000 and connected to the disposable Dairy database. The owner reports Dashboard, Cows, Milk, Breeding, Health, Finance, Reports, manual/automatic Backup and repeated tab navigation all work without the previous 429 response. Farm A/B animal visibility and isolation also passed in the earlier browser checks. This is owner-supplied local/browser evidence.

The non-fatal Mongoose warning about the reserved schema pathname `collection` remains visible at backend startup. The owner did not report a blocking effect from it. The fix raises the general Dairy API allowance and removes duplicate App-shell requests; it does not claim to prove that every possible screen is free of an independent request loop.

Phase 19 remains **In progress**. The empty-disposable-database CRUD and selected backup checks are not a substitute for the remaining restored-backup migration, idempotence, index/query-plan, database-size, archive/photo, and multi-process concurrency scenarios listed above. No restore or migration apply is claimed in this checkpoint.


## Phase 19 farm-switch cache correction (2026-11-03)

Owner-reported Agri and Flock browser testing had shown that changing farms could require a second refresh before the newly selected farm's records appeared. Source inspection found all three service workers cached authenticated `/api/` GET responses by URL alone, ignoring the `Authorization` and `X-Farm-Id` request headers. Their stale-while-revalidate strategy could therefore return Farm A's cached response immediately after selecting Farm B while the background fetch refreshed the URL-only cache.

Updated Dairy, Agri and Flock service workers to:
- partition authenticated API cache entries by a SHA-256 scope derived from the authorization header and selected farm ID (the bearer token itself is never put in the cache URL);
- use network-first reads for private/authenticated API data, falling back only to the same user/farm cache when the network is unavailable;
- bypass caching if a safe per-user/per-farm key cannot be created;
- version the API caches and remove old cache versions during activation and local development.

Added `tests/farm-api-cache-isolation.test.ts`. GitHub Actions run [41667733026](https://github.com/musman5911/ai-monorepo/actions/runs/41667733026) passed on commit `139da5e`.

**Owner validation (2026-11-03):** after pulling commit `88bf941), the owner reports that Agri and Flock farm switching both pass in the browser: Farm A ↔ Farm B records appear immediately after selection, without pressing F5. The owner also reports that the Agri crop popup closes correctly after the tested close/cancel and save actions, and Dairy farm data isolation passes without a manual refresh. This closes the browser checks that were pending in the previous checkpoint. These are owner-supplied browser results, not independently executed in this editing session.


## Phase 19 automated regression checkpoint (2026-11-03; owner-supplied Windows CMD results)

After pulling documentation commit `3814116`, the owner reported:

| Command/check | Result |
|---|---|
| `npx vitest run tests/farm-api-cache-isolation.test.ts` | Passed: 1 file / 6 tests |
| `npm run check-final-db` | Passed: 1 file / 16 tests |
| `npm test` | Passed: 51 files / 441 tests |

The focused cache suite verifies the Dairy, Agri and Flock service-worker cache partitioning by authenticated user and selected farm, plus old-cache version cleanup. The final database suite verifies safety preflight and migration wrapper contracts offline; it does **not** establish a live MongoDB backup restore, migration, index, query-plan or concurrency result. The full test output included one conditional Mongoose-query test skipped because Dairy backend packages were not installed in the root test environment; all 441 executed tests passed.

Together with the immediately preceding browser checkpoint, the owner reports the farm-switch behavior in Agri and Flock passes without pressing F5, the Agri crop popup closes correctly, and Dairy farm data isolation passes. These are owner-supplied local results, not commands independently executed in this editing session.

**Remaining command-line gate: passed (owner-supplied Windows CMD output, 2026-11-03).** The owner reports `npm run check-sync`, `npm run check-ui`, `npm run check-workbench` (23 source checks), `npm run check-farms` (Agri/Flock/Dairy farm-scope checks and Dairy breeding-event runtime checks), `npm run check-docs` (all 22 phase files, links/statuses and guide commands), and `tools\\build-all.bat` (Dairy, Flock and Agri production builds) all passed. At that checkpoint, `npm ci` had not yet been repeated. The owner subsequently ran `npm ci` successfully on 2026-11-04 (51 packages added, 52 audited), followed by `npm test` (51 files / 441 tests passed; one conditional Mongoose-query test skipped because Dairy backend packages were not installed in the root test environment). npm reported 5 vulnerabilities (1 moderate, 2 high, 2 critical) and an unapproved `esbuild@0.28.2` postinstall script under `allowScripts`. These warnings remain unresolved; no automatic/forced audit fix or install-script approval was run. GitHub Actions run [41674013711](https://github.com/musman5911/ai-monorepo/actions/runs/41674013711) passed on commit `5a180ef`.

**Phase disposition:** still **In progress**. The restored-backup real-MongoDB checklist remains unverified: backup restore to dedicated copies, guarded migration dry-run/apply/re-apply, before/after counts and farm ownership, indexes/query plans, persistent backup/restore scenarios, archive/photo scenarios, 84-case farm-deletion safety, large Flock image restore, two-backend egg-inventory lock, and database-size/cap measurements.


## Phase 19 clean-install validation (2026-11-04; owner-supplied Windows CMD results)

| Command/check | Result |
|---|---|
| `npm ci` | Completed successfully; 51 packages added, 52 packages audited |
| `npm test` after clean install | Passed: 51 test files / 441 tests, zero failures |

The full-suite output includes one conditional Mongoose-query test skipped because Dairy backend packages were not installed in the root test environment. All 441 executed tests passed.

**Warnings requiring separate dependency review:** npm reported 5 vulnerabilities (1 moderate, 2 high, 2 critical). It also reported that the `esbuild@0.28.2` postinstall script is not approved by the configured `allowScripts` policy. The owner did not run `npm audit fix`, `npm audit fix --force`, or an install-script approval command. Treat the audit findings and the pending script approval as unresolved release-triage items; do not claim that the dependency audit is clean.

The clean-install and full-test portion of the standard Phase 19 command-line gate is now complete. The restored-backup real-MongoDB scenarios remain open, and Phase 19 remains **In progress**.
