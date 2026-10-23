import { describe, expect, it } from 'vitest';
import { acquireEggInventoryLock } from '../flock_farm/backend/egg-inventory-lock.mjs';
import { validateIncubationAllocations } from '../flock_farm/backend/incubation-allocation.mjs';

function sharedStore() {
  let lock = null;
  let nextId = 1;
  return {
    async create(doc) {
      if (lock) {
        const error = new Error('duplicate key');
        error.code = 11000;
        throw error;
      }
      lock = { ...doc, _id: String(nextId++) };
      return lock;
    },
    async findOneAndDelete(filter) {
      if (lock && lock._id === filter._id) {
        const removed = lock;
        lock = null;
        return removed;
      }
      return null;
    },
  };
}

describe('Flock egg inventory coordination contract', () => {
  it('prevents egg supply deletion while an allocation save holds the shared lock', async () => {
    const store = sharedStore();
    const releaseAllocation = await acquireEggInventoryLock(store);

    // This is the same allocation validator used by the HTTP route.
    expect(validateIncubationAllocations(
      [{ sourceBatchId: 'BATCH-1', eggsSet: 75 }],
      [{ batch_id: 'BATCH-1' }],
      [{ batch_id: 'BATCH-1', collected: 100, sold: 10, home_use: 5, broken_wasted: 5 }],
    )).toBeNull();

    // The concurrent egg-log deletion must fail closed instead of validating
    // against a snapshot while the allocation is being saved.
    await expect(acquireEggInventoryLock(store)).rejects.toMatchObject({
      status: 409,
      code: 'EGG_INVENTORY_BUSY',
    });
    await releaseAllocation();
  });

  it('revalidates a deletion after the allocation lock is released', async () => {
    const store = sharedStore();
    const release = await acquireEggInventoryLock(store);
    await release();

    // Once serialized, deleting the only supply log would leave 75 eggs
    // allocated against zero supply, so the existing validator rejects it.
    expect(validateIncubationAllocations(
      [{ sourceBatchId: 'BATCH-1', eggsSet: 75 }],
      [{ batch_id: 'BATCH-1' }],
      [],
    )).toContain('available eggs');
  });
});
