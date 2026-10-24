> **Historical design record.** The phase numbers, "postponed" wording and step names (1A, 1B, 1C) in this file belong to the old plan. The current plan is `docs/ROADMAP.md` and `docs/phases/`; what was built is summarised in `docs/phases/phase-00-done-and-verified.md`. The design rules below (how farm scoping works and why) are still correct.

## Phase 01 status after local verification (2026-10-24)

Owner-run local checkpoint on commit 26f6731:
- Root regression suite: 22 files passed, 210/210 tests passed.
- Passed: check-farms, check-sync, check-ui, check-workbench, check-workbench-runtime.
- Production builds passed: Dairy, Flock, and Agri. Non-fatal warnings were reported for Dairy mixed imports, Flock/Agri chunk sizes, and Agri's deprecated advancedChunks option.
- Git status was clean after the checkpoint.

## Phase 01 final completion policy

The owner has explicitly changed the previous timing decision: finish ALL Phase 01 work now, including browser/role walkthroughs, migration/index verification, and backup/restore tests on disposable database copies. Do not defer these Phase 01 checks to the final pass for later phases. Never use production data.

## Known code gap before large-image restore testing

Flock's server currently applies express.json({ limit: '10mb' }) globally before backup routes. The manual restore endpoint reads req.body, so an image backup larger than 10 MB is rejected before that endpoint can validate it. Fix the parser ordering/route-specific limit and add a regression covering a larger valid request before attempting a real backup restore.

## Phase 01 active remaining checklist

1. Fix the Flock manual restore body limit and verify the error/response path before mutation.
2. Browser-test owner, manager, and worker flows in all three apps, including All farms read-only behavior, assigned-farm isolation, and owner-only management.
3. Test farm deletion on disposable data: fresh backup exists, exact-name confirmation, move records to another active farm, delete records, invalid destination, wrong name, last farm/last active farm, and server-side rejection.
4. Run real MongoDB migration dry-runs and apply migrations only to disposable copies for Agri, Dairy, and Flock. Compare before/after record counts and farm ownership, rerun migrations for idempotency, and restore a backup if validation fails.
5. Verify backup/restore on disposable copies: Agri DiaryMedia; Dairy Supplier and SupplierPayment; Flock images with IDs, farm IDs, metadata and exact bytes, including monthly auto-backup chunk assembly.
6. Inspect actual MongoDB indexes on the copies, confirm farmId-leading indexes match the real list/filter/sort queries, confirm Flock DataStore farmId+key uniqueness, and collect query plans for representative queries.
7. Exercise concurrent requests across two farms against disposable MongoDB to confirm isolation and atomic farm-scoped deletion/update behavior.
8. After the body-limit fix, rerun root tests, all root check commands, and all three frontend production builds; update this checklist with the exact final results.

Historical design and migration notes follow. Any older statement below that Phase 01 browser/database checks are postponed is superseded by this status section.

## Farm deletion safety follow-up (2026-10-23)

The shared farm delete route refuses to delete an active farm if it is the last active farm, even when archived farms remain. It also verifies that a move destination exists and is active before moving populated records. Route-handler regressions cover the last-active-farm guard, archived destination and typed-name confirmation. Tests have not yet been run for this batch. Migration/backup-restore on a disposable copy and the all-role browser pass remain deferred; never use production data for those checks.

---

# Phase 1 design record: farms and roles

Written 2026-10-22 while building step 1A. It records what was decided and why, so steps 1B to 1D follow the same rules. The rulebook is `FARMS_AND_ROLES.md`; status is in `PROGRESS.md`.

## How scoping works

One shared file, `backend/muf-farms.mjs`, is a byte-identical twin in all three backends.

1. The authentication middleware (`protect`) loads the user, then calls `mufApplyFarmContext`.
2. That reads the `X-Farm-Id` request header, checks it against the user's allowed farms, and runs the rest of the request inside a per-request context (Node `AsyncLocalStorage`).
3. Every farm-owned model is wrapped by `mufScopeModel`. Inside a request, every `find`, `findOne`, `findById`, update, delete and count gets the farm added to its filter, and every create is stamped with the farm. The routes themselves did not need to change.
4. A client can never choose or change a farm: `farmId` is removed from request bodies and update documents, and creates always use the server's farm.
5. Operations that could bypass the filter (`aggregate`, `bulkWrite`, `replaceOne` and similar) throw inside a scoped request. None are used today.

The wrapper works on real MongoDB models and on the memory-mode demo models, so both are checked by the same tests.

## Decisions

| Question | Decision |
|---|---|
| No `X-Farm-Id` header | The user's default farm (owner: the oldest active farm; others: their first assigned farm). Old screens keep working unchanged |
| Header `all` | Read-only. Owners see every active farm; managers and workers see their assigned farms. Any write returns 400 `FARM_REQUIRED` |
| Header names a farm the user may not use | 403 `FARM_FORBIDDEN` |
| Archived farms | Hidden from managers and workers, excluded from "All farms", still selectable by the owner |
| No farms yet (migration not run) | 503 `MIGRATION_REQUIRED` |
| System jobs (cron, Telegram bot, restore) | Run unscoped. New records without a farm go to the default farm; records that already carry a farmId keep it |
| Role names in the API | `role` keeps the old `admin`/`worker` values (owner and manager both appear as `admin`) so existing screens work; `farmRole` is the real `owner`/`manager`/`worker`. The old values go away in step 1C |
| `adminOnly` in routes | Now means owner or manager. A new `ownerOnly` covers farm management and backups |
| Users | Owners create any role. Managers create only workers, limited to their own farms, and see only workers who share a farm with them. Owner and manager accounts need an email address |
| Backups | Owner only, covering every farm. They now include the farms list. After a restore, untagged records are tagged with the default farm |
| Ids that were shared | Rate used a fixed id and daily logs used the date as id. Both are now looked up by field, one per farm. Existing records keep their old ids |
| Animal ids | Still unique across the whole project (the app uses the record id as the animal tag). Per-farm ear tags are planned for Phase 4 |
| Demo (memory) mode | The migration runs automatically at startup because demo data is disposable. Real data is never migrated automatically; run the script |
| Cross-farm summary endpoint | Still totals the whole project. Phase 6 makes it per farm |

## Dairy classification (step 1A)

- **Farm-owned:** Cow, Milk, Expense, Laborer, LaborAttendance, LaborAdvance, Rate, Health, Buyer, BuyerPayment, Supplier, SupplierPayment, RateHistory, DailyLog, Sale.
- **Global:** User (gets `farmIds`), PasswordReset, Meta (settings, backup snapshots, feed stock settings, Telegram links), Farm.
- Known gaps that already existed: the backup does not include suppliers or supplier payments. Not changed here.

## Agri (step 1B-1, built)

- **Farm-owned (14):** Crop, Finance, Task, Inventory, Liability, Irrigation, CropPhoto, Spray, Laborer, Attendance, LaborAdvance, Supplier, SupplierPayment, DiaryMedia. **Global:** User, Reset, TelegramMeta, Setting (automation e-mail settings, farm location and the monthly backup, none of which is per farm), Farm.
- Agri's schemas are loose, so `farmId` is declared as a string path with an index on each farm-owned schema. No fixed ids needed a fix: ids are database ids, and diary media is looked up by date within the farm.
- **`replaceOne` is refused inside a farm-scoped request** (it could move a record to another farm). Four PUT routes used it (crops, finance, tasks, suppliers). They now call `replaceFarmRecord` (`utils/helpers.js`): find the record inside the selected farm (404 if it belongs to another farm), then replace it while keeping its `farmId`. A PUT still replaces the whole record, as before.
- **Accounts:** the first sign-up becomes the owner (and creates "Farm 1"). Later: owners create any role (the old `admin` value means owner); managers create only workers, limited to their own farms. Owner and manager accounts need an e-mail. `PATCH /users/:id/edit` also accepts `role` (owner only) and `farmIds`. The last owner cannot be deleted or demoted. Old screens send no farms when creating a worker, so a new worker gets the creator's selected farm (`X-Farm-Id`), or the creator's default farm.
- **API shape:** `role` still returns `admin` or `worker` for old screens; `farmRole` and `farmIds` are new. Errors from the farm layer use `{ error, code }`; the rest of Agri uses `{ detail }`. The step 1C screens will read both.
- **Backups:** owner only, covering all farms and the farms list. A restore re-creates missing farms and tags untagged records with the default farm. The automatic monthly backup (a system job) also covers every farm.
- **System jobs** (cron, Telegram bot, daily summary, the cross-farm summary) run unscoped, so their totals still cover the whole project, and records they create go to the default farm. Per-farm Telegram links and per-farm summaries come later (Phase 6).
- **In-memory demo store:** now supports `save()`, `findByIdAndUpdate`, `findByIdAndDelete` and timestamps on Farm. These were needed by the shared farms router and change nothing for other models.
- Also: `X-Farm-Id` was added to the allowed CORS headers (Agri and Dairy), so a frontend served from another origin can send it.

## Flock (step 1B-2, implementation delivered; final data-copy verification postponed)

- **Farm-owned:** `DataStore` buckets, `Batch`, all five batch-log collections, and `Image`. `User`, `PasswordReset`, and `Farm` remain global.
- **Legacy bucket layout:** one document per `farmId + key`. The existing bucket `value` and optimistic-concurrency `version` remain intact. The migration tags existing documents into the default farm, then drops the old globally-unique `key_1` index and creates the compound unique `farmId + key` index. The new `farmId` schema path stays optional until migration so old documents can be read and tagged.
- **Batches/logs/images:** keep the existing collections and record shapes, adding server-owned `farmId`. Batch IDs remain project-wide unique for compatibility. Batch summary queries are scoped because each model query is wrapped by the shared MUF farm helper.
- **Roles:** legacy `admin` accounts migrate to `owner`; `manager` and `worker` use the shared farm rules. The API preserves the legacy `role` response while exposing `farmRole` and `farmIds`.
- **Migration:** `flock_farm/backend/scripts/migrate-farms.js`; `npm run migrate:farms:dry` reports untagged records and legacy roles without applying the farm migration, while `npm run migrate:farms` applies it. Real data is never migrated at startup. Memory/demo data is disposable and migrates automatically.
- Phase 2 will later move the large legacy bucket lists into proper collections; that restructure is not part of 1B-2.

**Local check status (2026-10-24):** the captured npm run check-farms run passes Flock farm-scoped HTTP/role checks, and shared parity/UI safety checks also passed. The log does not show all three production builds, so the local build gate remains unverified. Browser review, migration against a database copy and backup/restore validation are postponed to the final project-wide verification pass; they are not Phase 1 implementation blockers.

## What is checked

- `tests/muf-farms.test.ts`: roles, access rules, filter building, the model wrapper (also against real MongoDB query objects), and the migration, including running it twice.
- `tools/check-farm-scope.js` (`npm run check-farms`): starts the Dairy backend in memory mode and proves over real HTTP that owners, managers and workers see and change only what they should (42 checks).

Postponed to final project-wide verification: migration against a disposable MongoDB copy and browser/screen review (step 1C), after all planned phases have implementation complete.
