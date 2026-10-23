// Cross-request lock for operations that change batch egg supply or its allocations.
// The lock is a unique DataStore sentinel, so MongoDB enforces it across server
// processes. It intentionally has no automatic expiry: after a process crash,
// fail closed rather than silently allow concurrent stock changes. An owner can
// clear a stale sentinel after confirming no inventory operation is still running.
export const FLOCK_EGG_INVENTORY_LOCK_KEY = '__flock_egg_inventory_lock__';

export async function acquireEggInventoryLock(DataStore) {
  let lock;
  try {
    lock = await DataStore.create({
      key: FLOCK_EGG_INVENTORY_LOCK_KEY,
      value: { acquiredAt: new Date().toISOString() },
    });
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
    await DataStore.findOneAndDelete({
      _id: lock._id,
      key: FLOCK_EGG_INVENTORY_LOCK_KEY,
    });
  };
}
