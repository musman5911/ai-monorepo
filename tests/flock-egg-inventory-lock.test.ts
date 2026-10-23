import { describe, expect, it } from 'vitest';
import { acquireEggInventoryLock, acquireEggInventoryLocks, FLOCK_EGG_INVENTORY_LOCK_KEY } from '../flock_farm/backend/egg-inventory-lock.mjs';

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


function createFarmStore() {
  const locks = new Map();
  let nextId = 1;
  return {
    async create(doc) {
      const key = String(doc.farmId || 'default');
      if (locks.has(key)) {
        const error = new Error('duplicate key');
        error.code = 11000;
        throw error;
      }
      const created = { ...doc, _id: String(nextId++) };
      locks.set(key, created);
      return created;
    },
    async findOneAndDelete(filter) {
      const key = String(filter.farmId || 'default');
      const current = locks.get(key);
      if (current && current._id === filter._id) {
        locks.delete(key);
        return current;
      }
      return null;
    },
    hasFarm(farmId) { return locks.has(String(farmId || 'default')); },
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

  it('still serializes when the backing adapter does not enforce unique indexes', async () => {
    let nextId = 1;
    const store = {
      create: async (doc) => ({ ...doc, _id: String(nextId++) }),
      findOneAndDelete: async () => null,
    };
    const release = await acquireEggInventoryLock(store, 'farm-memory');
    await expect(acquireEggInventoryLock(store, 'farm-memory')).rejects.toMatchObject({
      status: 409,
      code: 'EGG_INVENTORY_BUSY',
    });
    await release();
  });

  it('acquires whole-farm lock sets in a stable deduplicated order and releases all', async () => {
    const store = createFarmStore();
    const release = await acquireEggInventoryLocks(store, ['farm-b', 'farm-a', 'farm-b']);
    expect(store.hasFarm('farm-a')).toBe(true);
    expect(store.hasFarm('farm-b')).toBe(true);
    await release();
    expect(store.hasFarm('farm-a')).toBe(false);
    expect(store.hasFarm('farm-b')).toBe(false);
  });

  it('rolls back earlier locks when a later farm lock is already held', async () => {
    const store = createFarmStore();
    const releaseExisting = await acquireEggInventoryLock(store, 'farm-b');
    await expect(acquireEggInventoryLocks(store, ['farm-a', 'farm-b'])).rejects.toMatchObject({
      status: 409,
      code: 'EGG_INVENTORY_BUSY',
    });
    expect(store.hasFarm('farm-a')).toBe(false);
    expect(store.hasFarm('farm-b')).toBe(true);
    await releaseExisting();
  });

});
