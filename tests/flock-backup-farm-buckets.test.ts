import { describe, expect, it } from 'vitest';
import { createStore } from '../dairy_farm/backend/memory-db.js';
import { restoreFlockFarmBuckets } from '../flock_farm/backend/muf-backup-data.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function makeDataStore() {
  return createStore({ DataStore: { paths: {}, options: { timestamps: true } } }).DataStore;
}

const BUCKET_KEYS = ['birds', 'expenses', 'feed', 'eggs', 'settings', 'farm_location'];

describe('Flock multi-farm backup restoration', () => {
  it('fully replaces each farm bucket from a modern snapshot and bumps versions', async () => {
    const DataStore = makeDataStore();
    await DataStore.create({ key: 'birds', farmId: 'farm-a', value: [{ id: 'before-a' }], version: 8 });
    await DataStore.create({ key: 'birds', farmId: 'farm-b', value: [{ id: 'created-after-backup' }], version: 3 });
    await DataStore.create({ key: 'settings', farmId: 'farm-a', value: { theme: 'newer' }, version: 4 });
    await DataStore.create({ key: 'monthly_auto_backup', farmId: 'farm-a', value: { name: 'auto-2026-11' }, version: 2 });
    await DataStore.create({ key: 'monthly_auto_backup_image_chunk_snapshot_00000', farmId: 'farm-a', value: { snapshotId: 'snapshot' }, version: 1 });
    await DataStore.create({ key: '__flock_egg_inventory_lock__', farmId: 'farm-a', value: { acquiredAt: 'now' }, version: 1 });

    await restoreFlockFarmBuckets({
      DataStore,
      bucketKeys: BUCKET_KEYS,
      defaultFarmId: 'farm-a',
      farmBuckets: {
        birds: [{ farmId: 'farm-a', value: [{ id: 'from-backup' }], version: 5 }],
        settings: [],
      },
      buckets: {},
    });

    const birds = await DataStore.find({ key: 'birds' }).lean();
    expect(birds).toHaveLength(1);
    expect(birds[0]).toMatchObject({ farmId: 'farm-a', value: [{ id: 'from-backup' }], version: 9 });
    expect(await DataStore.find({ key: 'settings' }).lean()).toEqual([]);
    expect(await DataStore.findOne({ key: 'monthly_auto_backup' }).lean()).toMatchObject({ value: { name: 'auto-2026-11' } });
    expect(await DataStore.findOne({ key: 'monthly_auto_backup_image_chunk_snapshot_00000' }).lean()).not.toBeNull();
    expect(await DataStore.findOne({ key: '__flock_egg_inventory_lock__' }).lean()).not.toBeNull();
  });

  it('includes each farm\'s weather location in the restorable business buckets', async () => {
    const DataStore = makeDataStore();
    await DataStore.create({
      key: 'farm_location', farmId: 'farm-a',
      value: { raw_dms: 'old-a', lat: 33.1, lon: 72.1, city: 'Snapshot Farm A' }, version: 2,
    });
    await DataStore.create({
      key: 'farm_location', farmId: 'farm-b',
      value: { raw_dms: 'new-b', lat: 34.2, lon: 73.2, city: 'Post-snapshot Farm B' }, version: 5,
    });

    await restoreFlockFarmBuckets({
      DataStore,
      bucketKeys: BUCKET_KEYS,
      defaultFarmId: 'farm-a',
      farmBuckets: {
        farm_location: [{
          farmId: 'farm-a',
          value: { raw_dms: 'old-a', lat: 33.1, lon: 72.1, city: 'Snapshot Farm A' },
          version: 1,
        }],
      },
      buckets: {},
    });

    expect(await DataStore.find({ key: 'farm_location' }).lean()).toHaveLength(1);
    expect(await DataStore.findOne({ key: 'farm_location', farmId: 'farm-a' }).lean()).toMatchObject({
      value: { raw_dms: 'old-a', lat: 33.1, lon: 72.1, city: 'Snapshot Farm A' },
      version: 3,
    });
    const route = readFileSync(path.resolve(__dirname, '../flock_farm/backend/routes/backup.js'), 'utf8');
    const bucketDeclaration = route.slice(route.indexOf('const BUCKET_KEYS'), route.indexOf('const BATCH_MODELS'));
    expect(bucketDeclaration).toContain("'farm_location'");
  });

  it('uses snapshot version when there is no current row, preventing version reuse', async () => {
    const DataStore = makeDataStore();
    await restoreFlockFarmBuckets({
      DataStore,
      bucketKeys: BUCKET_KEYS,
      defaultFarmId: 'farm-a',
      farmBuckets: { eggs: [{ farmId: 'farm-a', value: [{ total: 12 }], version: 17 }] },
      buckets: {},
    });
    expect(await DataStore.findOne({ key: 'eggs', farmId: 'farm-a' }).lean()).toMatchObject({ version: 18 });
  });

  it('keeps legacy single-farm restores scoped to the default farm', async () => {
    const DataStore = makeDataStore();
    await DataStore.create({ key: 'feed', farmId: 'farm-a', value: [{ kg: 2 }], version: 4 });
    await DataStore.create({ key: 'feed', farmId: 'farm-b', value: [{ kg: 99 }], version: 6 });
    await DataStore.create({ key: 'eggs', farmId: 'farm-a', value: [{ total: 100 }], version: 3 });
    await DataStore.create({ key: 'eggs', farmId: 'farm-b', value: [{ total: 900 }], version: 7 });

    await restoreFlockFarmBuckets({
      DataStore,
      bucketKeys: BUCKET_KEYS,
      defaultFarmId: 'farm-a',
      farmBuckets: undefined,
      buckets: { feed: [{ kg: 8 }], eggs: null },
    });

    expect(await DataStore.findOne({ key: 'feed', farmId: 'farm-a' }).lean()).toMatchObject({ value: [{ kg: 8 }], version: 5 });
    expect(await DataStore.findOne({ key: 'feed', farmId: 'farm-b' }).lean()).toMatchObject({ value: [{ kg: 99 }] });
    expect(await DataStore.findOne({ key: 'eggs', farmId: 'farm-a' }).lean()).toBeNull();
    expect(await DataStore.findOne({ key: 'eggs', farmId: 'farm-b' }).lean()).toMatchObject({ value: [{ total: 900 }] });
  });

  it('leaves unrelated internal DataStore keys untouched when restoring a modern snapshot', async () => {
    const DataStore = makeDataStore();
    await DataStore.create({ key: 'backup_lock_meta', farmId: 'farm-a', value: { alive: true }, version: 1 });
    await restoreFlockFarmBuckets({
      DataStore,
      bucketKeys: BUCKET_KEYS,
      defaultFarmId: 'farm-a',
      farmBuckets: Object.fromEntries(BUCKET_KEYS.map((key) => [key, []])),
      buckets: {},
    });
    expect(await DataStore.findOne({ key: 'backup_lock_meta' }).lean()).not.toBeNull();
  });

  it('wires both manual and monthly restores through the full bucket replacement helper', () => {
    const route = readFileSync(path.resolve(__dirname, '../flock_farm/backend/routes/backup.js'), 'utf8');
    expect(route).toContain('await restoreFlockFarmBuckets({');
    expect(route).toContain('restore: () => restoreBackupPayload(payload)');
    expect(route).toContain('rollback: (snapshot) => restoreBackupPayload(snapshot)');
  });
});
