// Cross-request lock for operations that change batch egg supply or its allocations.
// A unique DataStore sentinel lets MongoDB enforce the lock across server processes.
// It intentionally has no automatic expiry: after a process crash, fail closed rather
// than silently allow concurrent stock changes. An owner can clear a stale sentinel
// only after confirming no inventory operation is still running.
export const FLOCK_EGG_INVENTORY_LOCK_KEY = '__flock_egg_inventory_lock__';

export async function acquireEggInventoryLock(DataStore, farmId) {
  let lock;
  try {
    const record = { key: FLOCK_EGG_INVENTORY_LOCK_KEY, value: { acquiredAt: new Date().toISOString() } };
    if (farmId !== undefined && farmId !== null && String(farmId)) record.farmId = String(farmId);
    lock = await DataStore.create(record);
  } catch (error) {
    if (error?.code === 11000 || error?.code === 11001) {
      const busy = new Error('Egg inventory is being updated by another request. Retry shortly.');
      busy.status = 409;
      busy.code = 'EGG_INVENTORY_BUSY';
      throw busy;
    }
    throw error;
  }

  let released = false;
  return async function releaseEggInventoryLock() {
    if (released) return;
    released = true;
    const filter = { _id: lock._id, key: FLOCK_EGG_INVENTORY_LOCK_KEY };
    if (farmId !== undefined && farmId !== null && String(farmId)) filter.farmId = String(farmId);
    await DataStore.findOneAndDelete(filter);
  };
}

// Whole-database backup/restore is unscoped, so acquire each farm's lock in a
// stable order. This coordinates backup/restore with normal farm-scoped routes.
export async function acquireEggInventoryLocks(DataStore, farmIds) {
  const ids = [...new Set((farmIds || []).map((id) => String(id || '').trim()).filter(Boolean))].sort();
  const releases = [];
  try {
    for (const id of ids) releases.push(await acquireEggInventoryLock(DataStore, id));
  } catch (error) {
    for (const release of releases.reverse()) {
      try { await release(); } catch { /* retain the original acquisition error */ }
    }
    throw error;
  }

  let released = false;
  return async function releaseAllEggInventoryLocks() {
    if (released) return;
    released = true;
    let releaseError;
    for (const release of releases.reverse()) {
      try { await release(); } catch (error) { releaseError ||= error; }
    }
    if (releaseError) throw releaseError;
  };
}
