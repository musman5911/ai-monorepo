import { describe, expect, it } from 'vitest';
import { acquireEggInventoryLock, FLOCK_EGG_INVENTORY_LOCK_KEY } from '../flock_farm/backend/egg-inventory-lock.mjs';

function createAtomicStore() {
  let lock = null;
  let nextId = 1;
  return {
    async create(doc) {
      if (doc.key === FLOCK_EGG_INVENTORY_LOCK_KEY && lock) {
        const error = new Error('duplicate key');
        error.code = 11000;
        throw error;
      }
      const created = { ...doc, _id: String(nextId++) };
      if (doc.key === FLOCK_EGG_INVENTORY_LOCK_KEY) lock = created;
      return created;
    },
    async findOneAndDelete(filter) {
      if (lock && String(lock._id) === String(filter._id) && lock.key === filter.key) {
        const removed = lock;
        lock = null;
        return removed;
      }
      return null;
    },
    hasLock() { return Boolean(lock); },
  };
}

describe('Flock egg inventory lock', () => {
  it('allows only one concurrent holder and releases for the next operation', async () => {
    const store = createAtomicStore();
    const releaseFirst = await acquireEggInventoryLock(store);
    expect(store.hasLock()).toBe(true);

    await expect(acquireEggInventoryLock(store)).rejects.toMatchObject({
      status: 409,
      code: 'EGG_INVENTORY_BUSY',
    });

    await releaseFirst();
    expect(store.hasLock()).toBe(false);
    const releaseSecond = await acquireEggInventoryLock(store);
    expect(store.hasLock()).toBe(true);
    await releaseSecond();
  });

  it('makes release idempotent', async () => {
    const store = createAtomicStore();
    const release = await acquireEggInventoryLock(store);
    await release();
    await expect(release()).resolves.toBeUndefined();
    expect(store.hasLock()).toBe(false);
  });

  it('does not swallow unexpected storage errors', async () => {
    const store = {
      create: async () => { throw new Error('database unavailable'); },
    };
    await expect(acquireEggInventoryLock(store)).rejects.toThrow('database unavailable');
  });
});
