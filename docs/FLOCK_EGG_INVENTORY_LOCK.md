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
