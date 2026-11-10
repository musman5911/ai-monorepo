import { mufGetDefaultFarmId, mufGetFarmContext } from './muf-farms.mjs';

// Local guard is required for the disposable in-memory adapter, which does not
// implement Mongo's compound unique indexes. Real Mongo deployments are also
// protected by the persisted unique DataStore key, including across processes.
const localLocks = new Set();
const STALE_LOCK_AFTER_MS = 30 * 60 * 1000;
const LOCK_LEASE_MS = 5 * 60 * 1000;
const LOCK_HEARTBEAT_MS = 60 * 1000;

export const FLOCK_EGG_INVENTORY_LOCK_KEY = '__flock_egg_inventory_lock__';

function resolveFarmId(farmId) {
  const context = mufGetFarmContext();
  const resolved = farmId ?? context?.farmId ?? mufGetDefaultFarmId();
  const value = resolved == null ? '' : String(resolved).trim();
  return value || null;
}

function lockIdentity(farmId) {
  return String(farmId || '__unscoped__');
}

function busyError() {
  const busy = new Error('Egg inventory is being updated by another request. Retry shortly.');
  busy.status = 409;
  busy.code = 'EGG_INVENTORY_BUSY';
  return busy;
}

export async function acquireEggInventoryLock(DataStore, farmId) {
  const resolvedFarmId = resolveFarmId(farmId);
  const identity = lockIdentity(resolvedFarmId);
  if (localLocks.has(identity)) throw busyError();
  localLocks.add(identity);

  const farmFilter = resolvedFarmId
    ? { farmId: resolvedFarmId }
    : { farmId: { $exists: false } };
  let lock;
  try {
    // A process crash can skip finally and leave a persisted lock behind.
    // Reclaim only records older than the lease window; active operations keep
    // their lock, and the per-farm unique key still arbitrates concurrent hosts.
    const now = Date.now();
    const staleBefore = new Date(now - STALE_LOCK_AFTER_MS).toISOString();
    const nowIso = new Date(now).toISOString();
    await DataStore.findOneAndDelete({
      key: FLOCK_EGG_INVENTORY_LOCK_KEY,
      ...farmFilter,
      $or: [
        { 'value.expiresAt': { $lte: nowIso } },
        { 'value.expiresAt': { $exists: false }, 'value.acquiredAt': { $lt: staleBefore } },
      ],
    });

    const record = {
      key: FLOCK_EGG_INVENTORY_LOCK_KEY,
      value: {
        acquiredAt: nowIso,
        expiresAt: new Date(now + LOCK_LEASE_MS).toISOString(),
      },
    };
    if (resolvedFarmId) record.farmId = resolvedFarmId;
    lock = await DataStore.create(record);
  } catch (error) {
    localLocks.delete(identity);
    if (error?.code === 11000 || error?.code === 11001) throw busyError();
    throw error;
  }

  let released = false;
  const heartbeat = typeof DataStore.findOneAndUpdate === 'function'
    ? setInterval(async () => {
        try {
          const refreshed = await DataStore.findOneAndUpdate(
            { _id: lock._id, key: FLOCK_EGG_INVENTORY_LOCK_KEY, ...farmFilter },
            { $set: { 'value.expiresAt': new Date(Date.now() + LOCK_LEASE_MS).toISOString() } },
            { new: true },
          );
          if (!refreshed) console.error('[Flock lock] Lease refresh found no matching lock record.');
        } catch (error) {
          console.error('[Flock lock] Lease refresh failed:', error?.message || error);
        }
      }, LOCK_HEARTBEAT_MS)
    : null;
  heartbeat?.unref?.();

  return async function releaseEggInventoryLock() {
    if (released) return;
    released = true;
    if (heartbeat) clearInterval(heartbeat);
    const filter = { _id: lock._id, key: FLOCK_EGG_INVENTORY_LOCK_KEY, ...farmFilter };
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
