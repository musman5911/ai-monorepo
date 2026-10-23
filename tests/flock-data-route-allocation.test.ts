import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  lockHeld: false,
  currentValue: [],
  savedValue: null,
  datastoreVersion: 1,
}));

vi.mock('../flock_farm/backend/models/DataStore.js', () => ({
  default: {
    create: vi.fn(async (doc) => {
      if (doc.key === '__flock_egg_inventory_lock__') {
        if (state.lockHeld) {
          const error = new Error('duplicate key');
          error.code = 11000;
          throw error;
        }
        state.lockHeld = true;
        return { ...doc, _id: 'inventory-lock-id' };
      }
      return { ...doc, _id: 'created-id' };
    }),
    findOne: vi.fn(async ({ key }) => ['incubation', 'laborAttendance'].includes(key)
      ? { key, value: state.currentValue, version: state.datastoreVersion }
      : null),
    findOneAndUpdate: vi.fn(async (filter, update) => {
      state.savedValue = update.$set.value;
      state.currentValue = update.$set.value;
      state.datastoreVersion = update.$set.version;
      return { key: filter.key, value: state.currentValue, version: state.datastoreVersion };
    }),
    findOneAndDelete: vi.fn(async (filter) => {
      if (filter._id === 'inventory-lock-id' && state.lockHeld) {
        state.lockHeld = false;
        return { _id: filter._id };
      }
      return null;
    }),
  },
}));
vi.mock('../flock_farm/backend/models/Image.js', () => ({ default: {} }));
vi.mock('../flock_farm/backend/models/Batch.js', () => ({
  default: { find: vi.fn(async () => [{ batch_id: 'BATCH-1' }]) },
}));
vi.mock('../flock_farm/backend/models/BatchEggLog.js', () => ({
  default: { find: vi.fn(async () => [
    { batch_id: 'BATCH-1', collected: 100, sold: 10, home_use: 5, broken_wasted: 5 },
  ]) },
}));
vi.mock('../flock_farm/backend/middleware/auth.js', () => ({
  authRequired: (_req, _res, next) => next(),
}));

const { default: dataRouter } = await import('../flock_farm/backend/routes/data.js');
const { acquireEggInventoryLock } = await import('../flock_farm/backend/egg-inventory-lock.mjs');
const { default: DataStore } = await import('../flock_farm/backend/models/DataStore.js');

const putIncubation = dataRouter.stack
  .find((layer) => layer.route?.path === '/data/:key' && layer.route.methods.put)
  .route.stack.at(-1).handle;

function makeResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function makeRequest(value, key = 'incubation') {
  return {
    params: { key },
    body: { value, baseVersion: 1 },
    user: { role: 'owner', farmRole: 'owner' },
  };
}

describe('incubation data route inventory lock integration', () => {
  beforeEach(() => {
    state.lockHeld = false;
    state.currentValue = [];
    state.savedValue = null;
    state.datastoreVersion = 1;
    vi.clearAllMocks();
  });

  it('saves a valid allocation and releases the lock', async () => {
    const value = [{ id: 1, sourceBatchId: 'BATCH-1', eggsSet: 75 }];
    const res = makeResponse();
    await putIncubation(makeRequest(value), res);

    expect(res.statusCode).toBe(200);
    expect(state.savedValue).toEqual(value);
    expect(state.lockHeld).toBe(false);
    expect(DataStore.findOneAndDelete).toHaveBeenCalled();
  });

  it('rejects a concurrent allocation request while another inventory operation holds the lock', async () => {
    const release = await acquireEggInventoryLock(DataStore);
    const res = makeResponse();
    await putIncubation(makeRequest([{ id: 1, sourceBatchId: 'BATCH-1', eggsSet: 75 }]), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('EGG_INVENTORY_BUSY');
    expect(state.savedValue).toBeNull();
    await release();
  });


  it('also serializes batch-linked labor attendance writes with batch deletion', async () => {
    const value = [{ id: 'att-1', batchId: 'BATCH-1' }];
    const res = makeResponse();
    await putIncubation(makeRequest(value, 'laborAttendance'), res);

    expect(res.statusCode).toBe(200);
    expect(state.savedValue).toEqual(value);
    expect(state.lockHeld).toBe(false);
    expect(DataStore.findOneAndDelete).toHaveBeenCalled();
  });

  it('rejects allocations above available egg supply and still releases the lock', async () => {
    const res = makeResponse();
    await putIncubation(makeRequest([{ id: 1, sourceBatchId: 'BATCH-1', eggsSet: 81 }]), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('INCUBATION_EGG_ALLOCATION');
    expect(state.lockHeld).toBe(false);
  });
});
