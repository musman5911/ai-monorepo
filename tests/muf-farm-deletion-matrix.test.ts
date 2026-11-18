import { describe, expect, it } from 'vitest';

// @ts-expect-error shared MUF ESM module has no declaration file.
import { mufCreateFarmsRouter as createAgriRouter } from '../agri_farm/backend/muf-farms.mjs';
// @ts-expect-error shared MUF ESM module has no declaration file.
import { mufCreateFarmsRouter as createDairyRouter } from '../dairy_farm/backend/muf-farms.mjs';
// @ts-expect-error shared MUF ESM module has no declaration file.
import { mufCreateFarmsRouter as createFlockRouter } from '../flock_farm/backend/muf-farms.mjs';
// @ts-expect-error memory adapter has no declaration file.
import { createStore as createDairyStore } from '../dairy_farm/backend/memory-db.js';

type StoreFactory = (schemas: Record<string, unknown>) => any;
type RouterFactory = (options: any) => any;

const apps: Array<{ name: string; store: StoreFactory; router: RouterFactory }> = [
  // The same contract-complete memory adapter is used for each factory so all
  // three router copies receive equivalent query semantics in this parity matrix.
  { name: 'Agri', store: createDairyStore, router: createAgriRouter },
  { name: 'Dairy', store: createDairyStore, router: createDairyRouter },
  { name: 'Flock', store: createDairyStore, router: createFlockRouter },
];

function response() {
  return {
    statusCode: 200,
    body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; return this; },
  };
}

function deleteHandler(routerFactory: RouterFactory, store: any, names = ['Crop']) {
  const express = {
    Router() {
      const layers: any[] = [];
      const router: any = { stack: layers };
      for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
        router[method] = (...args: any[]) => {
          layers.push({ route: { path: args[0], methods: { [method]: true } }, handlers: args.slice(1) });
          return router;
        };
      }
      return router;
    },
  };
  const pass = (_req: any, _res: any, next: () => void) => next();
  return routerFactory({
    express,
    Farm: store.Farm,
    User: store.User,
    models: store,
    names,
    protect: pass,
    ownerOnly: pass,
  }).stack.find((layer: any) => layer.route?.path === '/:id' && layer.route.methods.delete).handlers.at(-1);
}

function createStore(storeFactory: StoreFactory) {
  return storeFactory({
    Farm: { paths: {}, options: { timestamps: true } },
    User: { paths: {} },
    Crop: { paths: {} },
    DataStore: { paths: {}, options: { timestamps: true } },
  });
}

async function farms(store: any, rows = [
  { _id: 'source', name: 'Source Farm', archived: false },
  { _id: 'target', name: 'Target Farm', archived: false },
]) {
  for (const row of rows) await store.Farm.create(row);
}

async function execute(routerFactory: RouterFactory, store: any, body: any = {}, id = 'source', names = ['Crop']) {
  const result = response();
  await deleteHandler(routerFactory, store, names)({ params: { id }, body }, result);
  return result;
}

const scenarios: Array<{ name: string; run: (factory: RouterFactory, storeFactory: StoreFactory) => Promise<void> }> = [
  {
    name: 'returns 404 for a farm ID that does not exist',
    run: async (factory, makeStore) => {
      const db = createStore(makeStore); await farms(db);
      const res = await execute(factory, db, {}, 'missing');
      expect(res.statusCode).toBe(404);
    },
  },
  {
    name: 'refuses to delete the only active farm',
    run: async (factory, makeStore) => {
      const db = createStore(makeStore); await farms(db, [{ _id: 'source', name: 'Source Farm', archived: false }]);
      const res = await execute(factory, db);
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('LAST_FARM');
      expect(await db.Farm.findById('source')).not.toBeNull();
    },
  },
  {
    name: 'refuses to delete the sole archived farm',
    run: async (factory, makeStore) => {
      const db = createStore(makeStore); await farms(db, [{ _id: 'source', name: 'Source Farm', archived: true }]);
      const res = await execute(factory, db);
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('LAST_FARM');
    },
  },
  {
    name: 'refuses to delete the last active farm while an archived farm remains',
    run: async (factory, makeStore) => {
      const db = createStore(makeStore);
      await farms(db, [
        { _id: 'source', name: 'Source Farm', archived: false },
        { _id: 'old', name: 'Old Farm', archived: true },
      ]);
      const res = await execute(factory, db);
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('LAST_ACTIVE_FARM');
    },
  },
  {
    name: 'deletes an empty active farm without typed confirmation',
    run: async (factory, makeStore) => {
      const db = createStore(makeStore); await farms(db);
      const res = await execute(factory, db);
      expect(res.statusCode).toBe(200);
      expect(await db.Farm.findById('source')).toBeNull();
    },
  },
  {
    name: 'deletes an empty archived farm while preserving the active farm',
    run: async (factory, makeStore) => {
      const db = createStore(makeStore);
      await farms(db, [
        { _id: 'source', name: 'Source Farm', archived: true },
        { _id: 'target', name: 'Target Farm', archived: false },
      ]);
      const res = await execute(factory, db);
      expect(res.statusCode).toBe(200);
      expect(await db.Farm.findById('target')).not.toBeNull();
    },
  },
  {
    name: 'requires typed farm name before deleting populated records',
    run: async (factory, makeStore) => {
      const db = createStore(makeStore); await farms(db);
      await db.Crop.create({ _id: 'crop', name: 'Wheat', farmId: 'source' });
      const res = await execute(factory, db);
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('CONFIRM_NAME');
      expect(await db.Crop.findById('crop')).not.toBeNull();
    },
  },
  {
    name: 'rejects an incorrect typed farm name',
    run: async (factory, makeStore) => {
      const db = createStore(makeStore); await farms(db);
      await db.Crop.create({ _id: 'crop', name: 'Wheat', farmId: 'source' });
      const res = await execute(factory, db, { confirmName: 'Wrong Farm', deleteData: true });
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('CONFIRM_NAME');
      expect(await db.Crop.findById('crop')).not.toBeNull();
    },
  },
  {
    name: 'requires an explicit data action for a populated farm',
    run: async (factory, makeStore) => {
      const db = createStore(makeStore); await farms(db);
      await db.Crop.create({ _id: 'crop', farmId: 'source' });
      const res = await execute(factory, db, { confirmName: 'Source Farm' });
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('CHOOSE_DATA_ACTION');
    },
  },
  {
    name: 'rejects moving records back into the farm being deleted',
    run: async (factory, makeStore) => {
      const db = createStore(makeStore); await farms(db);
      await db.Crop.create({ _id: 'crop', farmId: 'source' });
      const res = await execute(factory, db, { confirmName: 'Source Farm', moveToFarmId: 'source' });
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('INVALID_MOVE_TARGET');
    },
  },
  {
    name: 'rejects an unknown move destination',
    run: async (factory, makeStore) => {
      const db = createStore(makeStore); await farms(db);
      await db.Crop.create({ _id: 'crop', farmId: 'source' });
      const res = await execute(factory, db, { confirmName: 'Source Farm', moveToFarmId: 'missing' });
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('INVALID_MOVE_TARGET');
    },
  },
  {
    name: 'rejects an archived move destination',
    run: async (factory, makeStore) => {
      const db = createStore(makeStore);
      await farms(db, [
        { _id: 'source', name: 'Source Farm', archived: false },
        { _id: 'target', name: 'Target Farm', archived: true },
        { _id: 'other', name: 'Other Active Farm', archived: false },
      ]);
      await db.Crop.create({ _id: 'crop', farmId: 'source' });
      const res = await execute(factory, db, { confirmName: 'Source Farm', moveToFarmId: 'target' });
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('INVALID_MOVE_TARGET');
    },
  },
  {
    name: 'moves a populated farm record into the selected active farm',
    run: async (factory, makeStore) => {
      const db = createStore(makeStore); await farms(db);
      await db.Crop.create({ _id: 'crop', name: 'Wheat', farmId: 'source' });
      const res = await execute(factory, db, { confirmName: 'Source Farm', moveToFarmId: 'target' });
      expect(res.statusCode).toBe(200);
      expect(await db.Crop.findOne({ farmId: 'target' })).toMatchObject({ _id: 'crop', name: 'Wheat' });
    },
  },
  {
    name: 'moves every source record and leaves no source-farm rows behind',
    run: async (factory, makeStore) => {
      const db = createStore(makeStore); await farms(db);
      for (let i = 1; i <= 4; i++) await db.Crop.create({ _id: 'crop-' + i, farmId: 'source' });
      const res = await execute(factory, db, { confirmName: 'Source Farm', moveToFarmId: 'target' });
      expect(res.statusCode).toBe(200);
      expect(await db.Crop.countDocuments({ farmId: 'source' })).toBe(0);
      expect(await db.Crop.countDocuments({ farmId: 'target' })).toBe(4);
    },
  },
  {
    name: 'transfers manager assignment with moved farm data',
    run: async (factory, makeStore) => {
      const db = createStore(makeStore); await farms(db);
      await db.User.create({ _id: 'manager', role: 'manager', farmIds: ['source'] });
      await db.Crop.create({ _id: 'crop', farmId: 'source' });
      const res = await execute(factory, db, { confirmName: 'Source Farm', moveToFarmId: 'target' });
      expect(res.statusCode).toBe(200);
      expect((await db.User.findById('manager')).farmIds).toEqual(['target']);
    },
  },
  {
    name: 'transfers worker assignment with moved farm data',
    run: async (factory, makeStore) => {
      const db = createStore(makeStore); await farms(db);
      await db.User.create({ _id: 'worker', role: 'worker', farmIds: ['source'] });
      await db.Crop.create({ _id: 'crop', farmId: 'source' });
      const res = await execute(factory, db, { confirmName: 'Source Farm', moveToFarmId: 'target' });
      expect(res.statusCode).toBe(200);
      expect((await db.User.findById('worker')).farmIds).toEqual(['target']);
    },
  },
  {
    name: 'deduplicates the destination assignment when moving a farm',
    run: async (factory, makeStore) => {
      const db = createStore(makeStore); await farms(db);
      await db.User.create({ _id: 'manager', role: 'manager', farmIds: ['source', 'target', 'target', 'source'] });
      await db.Crop.create({ _id: 'crop', farmId: 'source' });
      const res = await execute(factory, db, { confirmName: 'Source Farm', moveToFarmId: 'target' });
      expect(res.statusCode).toBe(200);
      expect((await db.User.findById('manager')).farmIds).toEqual(['target']);
    },
  },
  {
    name: 'preserves unrelated farm assignments when moving a farm',
    run: async (factory, makeStore) => {
      const db = createStore(makeStore); await farms(db);
      await db.Farm.create({ _id: 'other', name: 'Other Farm', archived: false });
      await db.User.create({ _id: 'manager', role: 'manager', farmIds: ['source', 'other'] });
      await db.Crop.create({ _id: 'crop', farmId: 'source' });
      const res = await execute(factory, db, { confirmName: 'Source Farm', moveToFarmId: 'target' });
      expect(res.statusCode).toBe(200);
      expect((await db.User.findById('manager')).farmIds).toEqual(['other', 'target']);
    },
  },
  {
    name: 'removes source records when explicitly deleting farm data',
    run: async (factory, makeStore) => {
      const db = createStore(makeStore); await farms(db);
      await db.Crop.create({ _id: 'crop', farmId: 'source' });
      const res = await execute(factory, db, { confirmName: 'Source Farm', deleteData: true });
      expect(res.statusCode).toBe(200);
      expect(await db.Crop.findById('crop')).toBeNull();
    },
  },
  {
    name: 'does not remove records from other farms when deleting source data',
    run: async (factory, makeStore) => {
      const db = createStore(makeStore); await farms(db);
      await db.Crop.create({ _id: 'source-crop', farmId: 'source' });
      await db.Crop.create({ _id: 'target-crop', farmId: 'target' });
      const res = await execute(factory, db, { confirmName: 'Source Farm', deleteData: true });
      expect(res.statusCode).toBe(200);
      expect(await db.Crop.findById('target-crop')).not.toBeNull();
      expect(await db.Crop.findById('source-crop')).toBeNull();
    },
  },
  {
    name: 'removes only the deleted farm assignment when deleting data',
    run: async (factory, makeStore) => {
      const db = createStore(makeStore); await farms(db);
      await db.User.create({ _id: 'worker', role: 'worker', farmIds: ['source', 'target'] });
      await db.Crop.create({ _id: 'crop', farmId: 'source' });
      const res = await execute(factory, db, { confirmName: 'Source Farm', deleteData: true });
      expect(res.statusCode).toBe(200);
      expect((await db.User.findById('worker')).farmIds).toEqual(['target']);
    },
  },
  {
    name: 'allows deleting a populated archived farm after confirmation and a valid action',
    run: async (factory, makeStore) => {
      const db = createStore(makeStore,); await farms(db, [
        { _id: 'source', name: 'Source Farm', archived: true },
        { _id: 'target', name: 'Target Farm', archived: false },
      ]);
      await db.Crop.create({ _id: 'crop', farmId: 'source' });
      const res = await execute(factory, db, { confirmName: 'Source Farm', deleteData: true });
      expect(res.statusCode).toBe(200);
      expect(await db.Crop.findById('crop')).toBeNull();
    },
  },
  {
    name: 'can move populated archived farm data to an active farm',
    run: async (factory, makeStore) => {
      const db = createStore(makeStore);
      await farms(db, [
        { _id: 'source', name: 'Source Farm', archived: true },
        { _id: 'target', name: 'Target Farm', archived: false },
      ]);
      await db.Crop.create({ _id: 'crop', farmId: 'source' });
      const res = await execute(factory, db, { confirmName: 'Source Farm', moveToFarmId: 'target' });
      expect(res.statusCode).toBe(200);
      expect(await db.Crop.findOne({ farmId: 'target' })).toMatchObject({ _id: 'crop' });
    },
  },
  {
    name: 'removes source farm and its references after a successful move',
    run: async (factory, makeStore) => {
      const db = createStore(makeStore); await farms(db);
      await db.Crop.create({ _id: 'crop', farmId: 'source' });
      const res = await execute(factory, db, { confirmName: 'Source Farm', moveToFarmId: 'target' });
      expect(res.statusCode).toBe(200);
      expect(await db.Farm.findById('source')).toBeNull();
      expect((await db.Farm.find({}).lean()).map((f: any) => f._id)).toContain('target');
    },
  },
  {
    name: 'requires exact farm-name confirmation after whitespace normalization',
    run: async (factory, makeStore) => {
      const db = createStore(makeStore); await farms(db);
      await db.Crop.create({ _id: 'crop', farmId: 'source' });
      const res = await execute(factory, db, { confirmName: ' Source   Farm ', deleteData: true });
      expect(res.statusCode).toBe(200);
    },
  },
  {
    name: 'merges colliding DataStore buckets when moving farm data',
    run: async (factory, makeStore) => {
      const db = createStore(makeStore); await farms(db);
      await db.DataStore.create({
        _id: 'target-birds', farmId: 'target', key: 'birds', version: 3,
        value: [{ id: 'target-bird' }, { id: 'shared-bird', targetOnly: true }],
      });
      await db.DataStore.create({
        _id: 'source-birds', farmId: 'source', key: 'birds', version: 5,
        value: [{ id: 'source-bird' }, { id: 'shared-bird', sourceOnly: true }],
      });
      const res = await execute(factory, db, { confirmName: 'Source Farm', moveToFarmId: 'target' }, 'source', ['DataStore']);
      expect(res.statusCode).toBe(200);
      const bucket = await db.DataStore.findOne({ farmId: 'target', key: 'birds' }).lean();
      expect(bucket.value.map((row: any) => row.id)).toEqual(['target-bird', 'shared-bird', 'source-bird']);
      expect(bucket.value[1]).toMatchObject({ targetOnly: true, sourceOnly: true });
      expect(await db.DataStore.findOne({ farmId: 'source' })).toBeNull();
    },
  },
  {
    name: 'moves non-colliding DataStore buckets to the destination',
    run: async (factory, makeStore) => {
      const db = createStore(makeStore); await farms(db);
      await db.DataStore.create({ _id: 'source-eggs', farmId: 'source', key: 'eggs', version: 1, value: [{ id: 'egg-1' }] });
      const res = await execute(factory, db, { confirmName: 'Source Farm', moveToFarmId: 'target' }, 'source', ['DataStore']);
      expect(res.statusCode).toBe(200);
      expect(await db.DataStore.findOne({ farmId: 'target', key: 'eggs' })).toMatchObject({ value: [{ id: 'egg-1' }] });
    },
  },
  {
    name: 'does not move or delete destination buckets when source has none',
    run: async (factory, makeStore) => {
      const db = createStore(makeStore); await farms(db);
      await db.DataStore.create({ _id: 'target-birds', farmId: 'target', key: 'birds', version: 1, value: [{ id: 'target' }] });
      const res = await execute(factory, db);
      expect(res.statusCode).toBe(200);
      expect(await db.DataStore.findOne({ farmId: 'target', key: 'birds' })).toMatchObject({ value: [{ id: 'target' }] });
    },
  },
];
if (scenarios.length !== 28) throw new Error('Expected exactly 28 deletion scenarios, got ' + scenarios.length);

describe('Phase 19 84-case farm deletion safety matrix', () => {
  for (const app of apps) {
    for (const scenario of scenarios) {
      it(`${app.name}: ${scenario.name}`, async () => {
        await scenario.run(app.router, app.store);
      });
    }
  }
});
