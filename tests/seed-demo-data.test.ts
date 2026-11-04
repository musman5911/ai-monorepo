import { describe, expect, it } from 'vitest';
import {
  buildSeedPlan,
  getFarmDefinitions,
  parseSeedArgs,
  validateSeedTarget
} from '../shared/muf-demo-seed.mjs';

const FARM_IDS = ['farm-one', 'farm-two', 'farm-three', 'farm-four', 'farm-five'];
const TODAY = '2026-11-04';
const APPS = ['dairy', 'agri', 'flock'] as const;

function recordsFor(plan: ReturnType<typeof buildSeedPlan>) {
  return [
    ...plan.products,
    ...Object.values(plan.collections).flat()
  ];
}

function farmCounts(plan: ReturnType<typeof buildSeedPlan>) {
  const counts = new Map<string, number>();
  for (const id of FARM_IDS) counts.set(id, 0);
  for (const row of recordsFor(plan)) {
    const id = String(row.farmId);
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  return counts;
}

function expectSameFarmLink(sourceFarmId: string, targetId: string, records: Array<Record<string, any>>, idField = '_id') {
  const target = records.find((row) => String(row[idField]) === String(targetId));
  expect(target, 'linked record exists').toBeTruthy();
  expect(String(target?.farmId)).toBe(sourceFarmId);
}

describe.each(APPS)('%s rich demo seed plan', (app) => {
  const plan = buildSeedPlan(app, FARM_IDS, { today: TODAY });

  it('defines five farms with an archived farm and a completely empty trial farm', () => {
    const farms = getFarmDefinitions(app, 'rich');
    expect(farms).toHaveLength(5);
    expect(farms[3].archived).toBe(true);
    expect(farms[4].archived).toBe(false);
    expect(new Set(farms.map((farm) => farm.name)).size).toBe(5);

    const counts = farmCounts(plan);
    expect(counts.get(FARM_IDS[3])).toBeGreaterThan(0);
    expect(counts.get(FARM_IDS[4])).toBe(0);
    expect([...counts.values()].slice(0, 4).every((count) => count > 0)).toBe(true);
    expect(new Set([...counts.values()].slice(0, 4)).size).toBeGreaterThan(1);
  });

  it('uses explicit farm ownership on every farm-owned record and shop product', () => {
    for (const row of recordsFor(plan)) {
      expect(FARM_IDS).toContain(String(row.farmId));
      expect(String(row.seedId)).toMatch(/^seed-/);
    }
    expect(plan.products).toHaveLength(8);
    expect(new Set(plan.products.map((product) => product.farmId)).size).toBe(4);
    expect(new Set(plan.products.map((product) => product.published))).toEqual(new Set([true, false]));
    expect(plan.products.every((product) => product.photoUrl === '')).toBe(true);
  });

  it('creates the documented owner, three managers and six workers with valid farm assignments', () => {
    const admin = plan.accounts.find((account) => account.username === 'admin');
    const worker = plan.accounts.find((account) => account.username === 'worker');
    const managers = plan.accounts.filter((account) => account.role === 'manager');
    const workers = plan.accounts.filter((account) => account.role === 'worker');
    expect(admin?.password).toBe('admin123');
    expect(worker?.password).toBe('worker123');
    expect(managers).toHaveLength(3);
    expect(workers).toHaveLength(6);
    expect(managers.some((account) => account.farmIds.length === 2)).toBe(true);
    for (const account of plan.accounts) {
      expect(['admin', 'manager', 'worker']).toContain(account.role);
      for (const farmId of account.farmIds) expect(FARM_IDS).toContain(String(farmId));
    }
  });

  it('anchors dates to the supplied seed date', () => {
    expect(plan.today).toBe(TODAY);
    for (const row of recordsFor(plan)) {
      if (typeof row.date === 'string') expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

it('keeps Dairy ear tags unique within each farm and preserves a sold cow breeding history', () => {
  const plan = buildSeedPlan('dairy', FARM_IDS, { today: TODAY });
  const cows = plan.collections.Cow;
  const tagsByFarm = new Map<string, string[]>();
  for (const cow of cows) {
    if (!cow.earTag) continue;
    const tags = tagsByFarm.get(cow.farmId) || [];
    tags.push(cow.earTag);
    tagsByFarm.set(cow.farmId, tags);
  }
  for (const tags of tagsByFarm.values()) expect(new Set(tags).size).toBe(tags.length);

  const soldCows = cows.filter((cow) => cow.status === 'sold');
  expect(soldCows.length).toBeGreaterThan(0);
  for (const cow of soldCows) {
    const events = plan.collections.BreedingEvent.filter((event) => event.cowId === cow._id);
    expect(events.some((event) => event.type === 'heat')).toBe(true);
    expect(events.some((event) => event.type === 'service')).toBe(true);
  }
  expect(plan.collections.BreedingEvent.some((event) => event.type === 'pregnancy_check')).toBe(true);
  expect(plan.collections.BreedingEvent.some((event) => event.type === 'calving' && event.generatedCalfIds.length > 0)).toBe(true);
  expect(plan.collections.BreedingEvent.some((event) => event.type === 'service' && event.sireSource === 'farm_bull')).toBe(true);
  expect(plan.collections.BreedingEvent.some((event) => event.type === 'service' && event.sireSource === 'outside_straw')).toBe(true);
  expect(plan.collections.Milk.some((entry) => entry.date === TODAY)).toBe(true);
  expect(plan.collections.Milk.some((entry) => entry.date === '2026-09-06')).toBe(true);
});

it('keeps Agri field, crop-cycle, finance and labor references within one farm', () => {
  const plan = buildSeedPlan('agri', FARM_IDS, { today: TODAY });
  const fields = plan.collections.Field;
  const crops = plan.collections.Crop;
  const laborers = plan.collections.Laborer;
  const suppliers = plan.collections.Supplier;
  for (const crop of crops) expectSameFarmLink(crop.farmId, crop.fieldId, fields);
  for (const entry of plan.collections.Finance) {
    if (entry.crop_id) expectSameFarmLink(entry.farmId, entry.crop_id, crops);
    if (entry.fieldId) expectSameFarmLink(entry.farmId, entry.fieldId, fields);
  }
  for (const task of plan.collections.Task) {
    expectSameFarmLink(task.farmId, task.fieldId, fields);
    expectSameFarmLink(task.farmId, task.crop_id, crops);
  }
  for (const attendance of plan.collections.Attendance) expectSameFarmLink(attendance.farmId, attendance.laborer_id, laborers);
  for (const payment of plan.collections.SupplierPayment) expectSameFarmLink(payment.farmId, payment.supplierId, suppliers);
  expect(crops.every((crop) => crop.cycleId && crop.season && crop.fieldId)).toBe(true);
  expect(fields.every((field) => Number(field.acres) > 0)).toBe(true);
});

it('keeps Flock batch logs, home birds and incubation allocation within each farm', () => {
  const plan = buildSeedPlan('flock', FARM_IDS, { today: TODAY });
  const batchModels = [
    'BatchFeedLog', 'BatchMortalityLog', 'BatchExpenseLog', 'BatchSaleLog',
    'BatchWeightLog', 'BatchEggLog', 'BatchVaccinationLog'
  ] as const;
  for (const modelName of batchModels) {
    expect(plan.collections[modelName].length).toBeGreaterThan(0);
    for (const log of plan.collections[modelName]) {
      const batch = plan.collections.Batch.find((item) => item.batch_id === log.batch_id);
      expect(batch).toBeTruthy();
      expect(batch?.farmId).toBe(log.farmId);
    }
  }
  for (const bucket of plan.collections.DataStore) {
    if (bucket.key === 'homeBirds') expect(bucket.value.length).toBeLessThanOrEqual(50);
    if (bucket.key === 'birds') {
      for (const bird of bucket.value) {
        const source = plan.collections.Batch.find((batch) => batch.batch_id === bird.batchId);
        expect(source?.farmId).toBe(bucket.farmId);
      }
    }
    if (bucket.key === 'incubations') {
      for (const incubation of bucket.value) {
        const source = plan.collections.Batch.find((batch) => batch.batch_id === incubation.sourceBatchId);
        expect(source?.farmId).toBe(bucket.farmId);
        expect(incubation.allocatedCount).toBeGreaterThan(0);
      }
    }
  }
});

describe('disposable Mongo seed command safety', () => {
  it('defaults to dry-run and requires --apply before --reset can be selected', () => {
    expect(parseSeedArgs(['--app', 'dairy'])).toEqual({ app: 'dairy', apply: false, reset: false });
    expect(parseSeedArgs(['--app', 'agri', '--dry-run']).apply).toBe(false);
    expect(() => parseSeedArgs(['--app', 'flock', '--reset'])).toThrow(/--reset is only allowed together with --apply/);
  });

  it('rejects production/live names, production mode and unapproved remote hosts', () => {
    expect(() => validateSeedTarget('mongodb://localhost:27017/production')).toThrow(/Database name must match/);
    expect(() => validateSeedTarget('mongodb://localhost:27017/muf_test_production_copy')).toThrow(/Production\/live/);
    expect(() => validateSeedTarget('mongodb://localhost:27017/muf_test_dairy_demo', { nodeEnv: 'production' })).toThrow(/NODE_ENV=production/);
    expect(() => validateSeedTarget('mongodb+srv://example.mongodb.net/muf_test_dairy_demo')).toThrow(/MUF_SEED_ALLOW_REMOTE=1/);
    expect(validateSeedTarget('mongodb://localhost:27017/muf_test_dairy_demo')).toMatchObject({ host: 'localhost', dbName: 'muf_test_dairy_demo', local: true });
  });
});
