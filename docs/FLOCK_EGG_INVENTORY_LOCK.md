## Verification timing policy (owner decision)

Real-MongoDB multi-process concurrency and disposable-copy backup/restore validation for Phase 2 are **POSTPONED until the consolidated final project-wide pass after all planned phases have implementation complete**. They are not Phase 2 implementation blockers. Continue unit and memory-mode regression coverage now. Never use production data for verification.

## Additional edge-case safety (2026-10-23)

Incubation allocation now counts egg-log rows as usable supply only when collected, sold, home-use and waste quantities are absent or valid non-negative safe integers. A malformed field makes that row contribute zero supply, preventing NaN from bypassing the allocation comparison. Tests cover malformed numeric strings, negative/unsafe counts, independent per-farm locks and retry after a storage acquisition error. Tests have not been run for this batch. Real-MongoDB multi-process contention and backup/restore are postponed to the final project-wide verification pass, using a disposable copy and never production.

---

# Flock egg-inventory lock recovery

The backend uses a farm-scoped DataStore sentinel named `__flock_egg_inventory_lock__` to serialize incubation allocation writes, batch egg-log changes, destructive batch operations, and full backup/restore. A concurrent request receives HTTP 409 with code `EGG_INVENTORY_BUSY`.

## Normal behavior

- A request creates one sentinel for the selected farm, performs the protected operation, and removes the sentinel in a `finally` block.
- Whole-database backup and restore acquire sentinels for all involved farms in sorted order and release them in reverse order.
- The lock has no TTL by design. An expiring lease could allow a slow but still-running process to continue after another process took the lock, recreating the inventory race.

## Recovery after a server crash

Do not remove a lock just because it looks old. First confirm that all application instances are stopped or that no protected inventory operation is still running. Take a database backup before manual repair.

1. Inspect the DataStore collection for records whose `key` is `__flock_egg_inventory_lock__`. Record each affected `farmId` and `value.acquiredAt`.
2. Confirm with the deployment operator that no batch egg-log, incubation, batch replacement, backup, or restore request is still active on any instance.
3. Remove only the stale sentinel for the affected farm, matching both the lock key and exact `farmId`. Do not delete ordinary DataStore records or every lock across farms indiscriminately.
4. Retry the blocked operation and review backend logs.

Use the actual collection name configured for the Mongoose `DataStore` model in the target deployment; do not guess the collection or run the cleanup against production without the backup and operator checks above. This is an operational recovery procedure, not a migration, and must never be run automatically.
