# Phase 01 final verification checklist

Status: OPEN. Updated 2026-10-24. Owner has now run memory-mode farm-deletion, backup/restore, and single-process concurrency checks. Those tests found three functional bugs and one minor migration setup issue. Source fixes and regression tests were committed as `b09f9d3`; the new tests/checks/builds still need to be run locally. Real-MongoDB checks remain POSTPONED until the consolidated project-wide verification pass. Never use production data.

## Owner-reported results before the fix commit

### 1. Farm deletion safety (all three apps)

- **82/84 checks passed** before the fixes; two real bugs were identified.
- Passed: missing confirmation name returns 400 `CONFIRM_NAME`; wrong name returns 400; confirmation without a data action returns 400 `CHOOSE_DATA_ACTION`; source-equals-destination and archived destination are rejected; manager/worker DELETE returns 403; fresh backup JSON contains the test record; move and delete-data flows produced the expected record/farm results; Farm 1 and Farm 2 stayed untouched.
- Disposable temporary instances on ports 5820-5822 were discarded after testing. `LAST_FARM` and `LAST_ACTIVE_FARM` guards passed 12/12 across all three apps.
- **Bug A, Dairy memory mode:** cow DELETE returned 500 because `dairy_farm/backend/memory-db.js` lacked `findOneAndDelete`. Fixed; regression coverage now exercises the scoped by-ID delete path.
- **Bug B, Flock farm move:** DataStore buckets with the same key were simply re-stamped with the destination `farmId`. This made moved values unreachable; on real MongoDB the unique `(farmId, key)` index would raise E11000 partway through the move. Fixed in all three byte-identical MUF farm helpers: merge colliding DataStore buckets, union array entries by stable row identity, retain object fields, increment the destination version, and only remove the source bucket after the destination write succeeds. Non-colliding buckets are moved separately.
- Regression coverage was added for merging a colliding `birds` bucket and moving a non-colliding `eggs` bucket. **The original 82/84 run predates the fix; rerun is required.**

## 2. Backup and restore validation (memory mode)

- **Agri: 13/13 passed.** DiaryMedia, photos, linked-entity associations, record `_id` values and `farmId` values survived backup/restore in All-Farms mode; farm isolation remained intact.
- **Dairy: 11/11 passed.** Supplier and SupplierPayment records preserved `_id`, `supplierId` relationships and farm scope.
- **Flock: 10/10 passed after a clean restart** for the cases exercised: a 1 MB image round trip, manual restore in All-Farms mode, a JSON payload above 10 MB, explicit 413 for payloads above the 100 MB limit without mutation, legacy backups lacking image fields not wiping images, malformed image rows rejected before mutation, and a monthly image snapshot assembled byte-for-byte from two chunks.
- **Bug C, critical Flock image restore:** `restoreBackupImages` used a large Base64 regex that overflowed the V8 call stack at about 4.92 million characters, approximately 3.3-3.6 MB of source image bytes. This can make otherwise valid larger photo backups unrestorable. Removed the regex validation; canonical Base64 decode-and-round-trip validation remains. Added a 4 MiB byte-for-byte regression test. **The new test has not yet been run locally.**
- The user-reported corruption tests refused restore before existing image data changed. Mongo-backed missing/corrupt monthly-chunk simulation remains postponed.

## 3. Concurrency results (memory mode)

- 12 parallel writes across two farms per app produced no cross-farm leakage.
- Cross-farm DELETE requests returned 404 and their target records survived.
- Flock stale-`baseVersion` race produced exactly one 200 and one 409.
- Parallel writes to different farms both succeeded.
- **POSTPONED:** shared-Mongo, two-backend-process Flock egg-inventory lock test.
- **POSTPONED:** Mongo-backed missing/corrupt monthly image-chunk simulation.

## 4. Flock migration environment setup

- **Bug D, minor:** `flock_farm/backend/scripts/migrate-farms.js` lacked `import 'dotenv/config'`. The script could throw a raw missing-`MONGODB_URI` error before reaching its friendly guard. Added the dotenv side-effect import as the first line and a regression assertion.
- The migration guard remains fail-closed: reported migration dry-run attempts in memory mode exited nonzero in Agri, Dairy and Flock and made no migration changes.

## Code-level index review versus persistent-database verification

- Static source review confirmed Flock's unique `(farmId, key)` index `datastore_farm_key_unique`; the migration drops legacy `key_1` and creates the compound index. Farm-first index declarations were found for Flock batch/image access, Dairy milk/expense access and Agri farm query patterns.
- Static definitions do not prove index creation or query plans in a real database.

## Required local rerun after pulling commit `b09f9d3`

- [ ] `npm test`, including DataStore collision merge, Dairy scoped delete, Flock dotenv order, and 4 MiB Base64 regression tests.
- [ ] `npm run check-farms`, including farm-move cases in all three apps.
- [ ] `npm run check-sync` and `npm run check-ui`.
- [ ] `npm run check-workbench` and `npm run check-workbench-runtime`.
- [ ] Production builds for `agri_farm/frontend`, `dairy_farm/client`, and `flock_farm/client`.
- [ ] Rerun the deletion and Flock large-image cases against a clean memory-mode restart, including byte/metadata preservation and no mutation for malformed/over-limit requests.
- [ ] Record actual result counts, exact commit SHA, command output summaries and warnings in `docs/PROGRESS.md`.

## POSTPONED until the consolidated project-wide verification pass

These tasks have **not** been completed and must not be reported as passing:

- [ ] Real disposable-MongoDB migration dry-run, apply, and idempotency checks for Agri, Dairy and Flock; compare baseline/after record counts and ownership.
- [ ] Actual MongoDB index listings and representative query plans, including Flock's unique `(farmId, key)` index.
- [ ] Persistent backup/restore on disposable copies: Agri DiaryMedia; Dairy Supplier/SupplierPayment; Flock exact image bytes/metadata, monthly chunks, legacy backups, and Mongo-backed missing/corrupt-chunk handling.
- [ ] Shared-Mongo, two-backend-process Flock egg-inventory lock/concurrency validation.
- [ ] Physical browser walkthroughs for owner/manager/worker flows in all three apps.

Never run migrations, destructive restores or farm-deletion tests against production databases. Phase 01 remains OPEN until the post-fix local rerun passes and all postponed checks are completed in the consolidated pass.
