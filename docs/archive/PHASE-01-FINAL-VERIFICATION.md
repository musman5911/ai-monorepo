# Phase 01 final verification checklist

Status: OPEN. Updated 2026-10-24 after the owner’s local rerun on checkout `6ed7aee` (includes source-fix commit `b09f9d3`). Root tests, farm/sync/UI/workbench checks, workbench runtime smoke test, and all three frontend production builds passed. Real-MongoDB checks remain POSTPONED until the consolidated project-wide verification pass. Never use production data.

## Owner-reported results before the fix commit

### 1. Farm deletion safety (all three apps)

- **82/84 checks passed** before the fixes; two real bugs were identified.
- Passed: missing confirmation name returns 400 `CONFIRM_NAME`; wrong name returns 400; confirmation without a data action returns 400 `CHOOSE_DATA_ACTION`; source-equals-destination and archived destination are rejected; manager/worker DELETE returns 403; fresh backup JSON contains the test record; move and delete-data flows produced the expected record/farm results; Farm 1 and Farm 2 stayed untouched.
- Disposable temporary instances on ports 5820-5822 were discarded after testing. `LAST_FARM` and `LAST_ACTIVE_FARM` guards passed 12/12 across all three apps.
- **Bug A, Dairy memory mode:** cow DELETE returned 500 because `dairy_farm/backend/memory-db.js` lacked `findOneAndDelete`. Fixed; regression coverage now exercises the scoped by-ID delete path.
- **Bug B, Flock farm move:** DataStore buckets with the same key were simply re-stamped with the destination `farmId`. This made moved values unreachable; on real MongoDB the unique `(farmId, key)` index would raise E11000 partway through the move. Fixed in all three byte-identical MUF farm helpers: merge colliding DataStore buckets, union array entries by stable row identity, retain object fields, increment the destination version, and only remove the source bucket after the destination write succeeds. Non-colliding buckets are moved separately.
- Regression coverage was added for merging a colliding `birds` bucket and moving a non-colliding `eggs` bucket. The owner’s post-fix `npm test` passed 219/219 tests, and `npm run check-farms` passed for all three apps. **The custom 84-case deletion run was not included in the pasted rerun log**, so record it as not yet rerun separately rather than claiming 84/84.

## 2. Backup and restore validation (memory mode)

- **Agri: 13/13 passed.** DiaryMedia, photos, linked-entity associations, record `_id` values and `farmId` values survived backup/restore in All-Farms mode; farm isolation remained intact.
- **Dairy: 11/11 passed.** Supplier and SupplierPayment records preserved `_id`, `supplierId` relationships and farm scope.
- **Flock: 10/10 passed after a clean restart** for the cases exercised: a 1 MB image round trip, manual restore in All-Farms mode, a JSON payload above 10 MB, explicit 413 for payloads above the 100 MB limit without mutation, legacy backups lacking image fields not wiping images, malformed image rows rejected before mutation, and a monthly image snapshot assembled byte-for-byte from two chunks.
- **Bug C, critical Flock image restore:** `restoreBackupImages` used a large Base64 regex that overflowed the V8 call stack at about 4.92 million characters, approximately 3.3-3.6 MB of source image bytes. This can make otherwise valid larger photo backups unrestorable. Removed the regex validation; canonical Base64 decode-and-round-trip validation remains. Added a 4 MiB byte-for-byte regression test. It passed in the owner’s post-fix `npm test` run (219/219 tests). A separate endpoint-level restore using a >3.3 MB real image after a clean server restart was not shown in the pasted log and remains to be verified.
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

## Post-fix local verification (2026-10-24)

The owner pulled through checkout `6ed7aee` (source fixes from `b09f9d3`) in `F:\\PROJECTS\\dairy\\muf-monorepo` and reported these results:

- [x] `npm test`: **23 test files passed, 219/219 tests passed**, including the DataStore bucket collision merge regression, Dairy-compatible `findOneAndDelete`, Flock dotenv-order contract, and 4 MiB Base64 image test.
- [x] `npm run check-farms`: passed for Agri, Flock and Dairy. The harness reports farm separation, permissions, All-farms backup/restore, and baseline farm move/delete checks.
- [x] `npm run check-sync`: all MUF shared-file, backend twin and environment parity checks passed.
- [x] `npm run check-ui`: all MUF UI safety checks passed.
- [x] `npm run check-workbench`: 23/23 source safety checks passed.
- [x] `npm run check-workbench-runtime`: 8/8 runtime smoke checks passed.
- [x] Agri frontend production build passed. Non-fatal warnings: deprecated `advancedChunks` setting and a 659 kB minified chunk.
- [x] Dairy frontend TypeScript check and production build passed. Non-fatal warning: `api.ts` is imported both statically and dynamically; the largest displayed chunk was about 760 kB.
- [x] Flock frontend TypeScript check and production build passed. Non-fatal warning: a 977 kB minified chunk.
- [ ] **Not evidenced in this rerun:** repeat the complete custom 84-case deletion-safety harness after the fixes.
- [ ] **Not evidenced in this rerun:** exercise the actual Flock restore endpoint with a valid image larger than the former 3.3-3.6 MB crash threshold after a clean backend restart, and check the bytes/metadata plus malformed/over-limit no-mutation behavior.

The source regression suite, static/safety checks, memory-mode farm-scope harness and production builds are green for the current code. This does not prove persistent MongoDB behavior or complete the separate manual scenarios noted above.

## POSTPONED until the consolidated project-wide verification pass

These tasks have **not** been completed and must not be reported as passing:

- [ ] Real disposable-MongoDB migration dry-run, apply, and idempotency checks for Agri, Dairy and Flock; compare baseline/after record counts and ownership.
- [ ] Actual MongoDB index listings and representative query plans, including Flock's unique `(farmId, key)` index.
- [ ] Persistent backup/restore on disposable copies: Agri DiaryMedia; Dairy Supplier/SupplierPayment; Flock exact image bytes/metadata, monthly chunks, legacy backups, and Mongo-backed missing/corrupt-chunk handling.
- [ ] Shared-Mongo, two-backend-process Flock egg-inventory lock/concurrency validation.
- [ ] Physical browser walkthroughs for owner/manager/worker flows in all three apps.

Never run migrations, destructive restores or farm-deletion tests against production databases. Phase 01 remains OPEN until the post-fix local rerun passes and all postponed checks are completed in the consolidated pass.
