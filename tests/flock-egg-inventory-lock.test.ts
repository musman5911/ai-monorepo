import { describe, expect, it } from 'vitest';
import { acquireEggInventoryLock, acquireEggInventoryLocks, FLOCK_EGG_INVENTORY_LOCK_KEY } from '../flock_farm/backend/egg-inventory-lock.mjs';
import { mufRunWithFarmContext } from '../flock_farm/backend/muf-farms.mjs';

function createAtomicStore(initialLock: any = null) {
  let lock = initialLock;
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
      if (!lock || lock.key !== filter.key) return null;
      if (filter.farmId && String(lock.farmId) !== String(filter.farmId)) return null;
      if (filter.farmId?.$exists === false && lock.farmId !== undefined) return null;
      const leaseExpiredAt = filter.$or?.[0]?.['value.expiresAt']?.$lte;
      const legacyStaleBefore = filter.$or?.[1]?.['value.acquiredAt']?.$lt;
      const leaseExpired = leaseExpiredAt && lock.value?.expiresAt && lock.value.expiresAt <= leaseExpiredAt;
      const legacyStale = legacyStaleBefore && !lock.value?.expiresAt && lock.value?.acquiredAt && lock.value.acquiredAt < legacyStaleBefore;
      const owned = filter._id && String(lock._id) === String(filter._id);
      if (leaseExpired || legacyStale || owned) {
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

  it('reclaims a persisted lock left stale by a crashed process', async () => {
    const stale = {
      _id: 'stale-lock',
      key: FLOCK_EGG_INVENTORY_LOCK_KEY,
      farmId: 'farm-stale',
      value: { acquiredAt: new Date(Date.now() - 31 * 60 * 1000).toISOString() },
    };
    const store = createAtomicStore(stale);
    const release = await acquireEggInventoryLock(store, 'farm-stale');
    expect(store.hasLock()).toBe(true);
    await release();
    expect(store.hasLock()).toBe(false);
  });

  it('reclaims a lock whose lease expired even if its original timestamp is recent', async () => {
    const expired = {
      _id: 'expired-lease',
      key: FLOCK_EGG_INVENTORY_LOCK_KEY,
      farmId: 'farm-expired',
      value: {
        acquiredAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      },
    };
    const store = createAtomicStore(expired);
    const release = await acquireEggInventoryLock(store, 'farm-expired');
    expect(store.hasLock()).toBe(true);
    await release();
    expect(store.hasLock()).toBe(false);
  });

  it('persists the selected farm ID when the caller relies on farm context', async () => {
    const store = createFarmStore();
    const context = (farmId: string) => ({
      mode: 'single' as const,
      farmId,
      farmIds: [farmId],
      userId: 'lock-test',
    });
    const releaseA = await mufRunWithFarmContext(context('context-farm-a'), () => acquireEggInventoryLock(store));
    const releaseB = await mufRunWithFarmContext(context('context-farm-b'), () => acquireEggInventoryLock(store));
    expect(store.hasFarm('context-farm-a')).toBe(true);
    expect(store.hasFarm('context-farm-b')).toBe(true);
    await releaseA();
    await releaseB();
  });

  it('makes release idempotent', async () => {
    const store = createAtomicStore();
    const release = await acquireEggInventoryLock(store);
    await release();
    await expect(release()).resolves.toBeUndefined();
    expect(store.hasLock()).toBe(false);
  });

  it('clears the local guard after a storage error so the next attempt can succeed', async () => {
    let failCreate = true;
    let held = false;
    const store = {
      create: async (doc) => {
        if (failCreate) throw new Error('database unavailable');
        if (held) { const error = new Error('duplicate key'); error.code = 11000; throw error; }
        held = true; return { ...doc, _id: 'retry-lock' };
      },
      findOneAndDelete: async () => { held = false; return { _id: 'retry-lock' }; },
    };
    await expect(acquireEggInventoryLock(store, 'retry-after-storage-error')).rejects.toThrow('database unavailable');
    failCreate = false;
    const release = await acquireEggInventoryLock(store, 'retry-after-storage-error');
    expect(held).toBe(true);
    await release();
    expect(held).toBe(false);
  });

  it('allows independent farms to hold separate inventory locks concurrently', async () => {
    const store = createFarmStore();
    const releaseA = await acquireEggInventoryLock(store, 'independent-farm-a');
    const releaseB = await acquireEggInventoryLock(store, 'independent-farm-b');
    expect(store.hasFarm('independent-farm-a')).toBe(true);
    expect(store.hasFarm('independent-farm-b')).toBe(true);
    await releaseA();
    expect(store.hasFarm('independent-farm-a')).toBe(false);
    expect(store.hasFarm('independent-farm-b')).toBe(true);
    await releaseB();
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
