import { mufGetDefaultFarmId, mufGetFarmContext } from './muf-farms.mjs';

// Local guard is required for the disposable in-memory adapter, which does not
// implement Mongo's compound unique indexes. Real Mongo deployments are also
// protected by the persisted unique DataStore key, including across processes.
const localLocks = new Set();

export const FLOCK_EGG_INVENTORY_LOCK_KEY = '__flock_egg_inventory_lock__';

function lockIdentity(farmId) {
  const context = mufGetFarmContext();
  return String(farmId ?? context?.farmId ?? mufGetDefaultFarmId() ?? '__unscoped__');
}

function busyError() {
  const busy = new Error('Egg inventory is being updated by another request. Retry shortly.');
  busy.status = 409;
  busy.code = 'EGG_INVENTORY_BUSY';
  return busy;
}

export async function acquireEggInventoryLock(DataStore, farmId) {
  const identity = lockIdentity(farmId);
  if (localLocks.has(identity)) throw busyError();
  localLocks.add(identity);

  let lock;
  try {
    const record = { key: FLOCK_EGG_INVENTORY_LOCK_KEY, value: { acquiredAt: new Date().toISOString() } };
    if (farmId !== undefined && farmId !== null && String(farmId)) record.farmId = String(farmId);
    lock = await DataStore.create(record);
  } catch (error) {
    localLocks.delete(identity);
    if (error?.code === 11000 || error?.code === 11001) throw busyError();
    throw error;
  }

  let released = false;
  return async function releaseEggInventoryLock() {
    if (released) return;
    released = true;
    const filter = { _id: lock._id, key: FLOCK_EGG_INVENTORY_LOCK_KEY };
    if (farmId !== undefined && farmId !== null && String(farmId)) filter.farmId = String(farmId);
    try {
      await DataStore.findOneAndDelete(filter);
    } finally {
      localLocks.delete(identity);
    }
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
