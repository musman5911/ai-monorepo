import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error plain ESM twin without type declarations
import * as farms from '../agri_farm/backend/muf-farms.mjs';
// @ts-expect-error plain ESM without type declarations
import { createStore } from '../agri_farm/backend/memory-db.js';
// @ts-expect-error plain ESM without type declarations
import { replaceFarmRecord } from '../agri_farm/backend/utils/helpers.js';

const {
  mufScopeModels, mufRunWithFarmContext, mufRunUnscoped, mufSetDefaultFarmId, mufMigrateFarms,
} = farms;

// Agri's schemas are loose; the memory store only needs `paths` and, for Farm, timestamps.
const loose = { paths: {} };
const farmSchema = { paths: {}, options: { timestamps: true } };
const ctxA = { mode: 'single', farmId: 'fa', farmIds: ['fa'] };
const ctxB = { mode: 'single', farmId: 'fb', farmIds: ['fb'] };
const ctxAll = { mode: 'all', farmId: null, farmIds: ['fa', 'fb'] };

function setup() {
  const m = createStore({ Farm: farmSchema, User: loose, Crop: loose, Finance: loose });
  mufScopeModels(m, ['Crop', 'Finance']);
  return m;
}
const backendRoot = join(__dirname, '..', 'agri_farm', 'backend');

describe('agri memory store (farms support)', () => {
  it('gives Farm documents timestamps, save(), and by-id update/delete', async () => {
    const m = setup();
    const farm = await m.Farm.create({ name: 'Farm 1' });
    expect(farm.createdAt).toBeInstanceOf(Date);
    const loaded = await m.Farm.findById(String(farm._id));
    loaded.name = 'Renamed';
    await loaded.save();
    expect((await m.Farm.findById(String(farm._id))).name).toBe('Renamed');
    expect(Object.keys({ ...loaded })).not.toContain('save'); // spreads and JSON stay clean
    await m.User.create({ _id: 'u1', username: 'x', role: 'worker' });
    await m.User.findByIdAndUpdate('u1', { $set: { farmIds: ['fa'] } });
    expect((await m.User.findById('u1')).farmIds).toEqual(['fa']);
    expect(await m.User.findByIdAndDelete('u1')).toMatchObject({ _id: 'u1' });
    expect(await m.User.findById('u1')).toBeNull();
  });
});

describe('agri scoping', () => {
  it('keeps farms apart for reads, updates and deletes by id', async () => {
    const m = setup();
    mufRunWithFarmContext(ctxA, () => m.Crop.create({ _id: 'c1', name: 'Wheat' }));
    mufRunWithFarmContext(ctxB, () => m.Crop.create({ _id: 'c2', name: 'Rice', farmId: 'fa' }));
    const inA = await mufRunWithFarmContext(ctxA, () => m.Crop.find({}));
    const inB = await mufRunWithFarmContext(ctxB, () => m.Crop.find({}));
    expect(inA.map((c: any) => c._id)).toEqual(['c1']);
    expect(inB.map((c: any) => c._id)).toEqual(['c2']); // forged farmId ignored
    expect(await mufRunWithFarmContext(ctxA, () => m.Crop.findOne({ _id: 'c2' }))).toBeNull();
    const all = await mufRunWithFarmContext(ctxAll, () => m.Crop.find({}));
    expect(all.length).toBe(2);
    await expect(async () => mufRunWithFarmContext(ctxAll, () => m.Crop.insertMany([{ name: 'x' }]))).rejects.toThrow(/Select one farm/);
  });

  it('refuses replaceOne in a request, so routes use replaceFarmRecord', async () => {
    const m = setup();
    mufRunWithFarmContext(ctxA, () => m.Crop.create({ _id: 'c1', name: 'Wheat' }));
    expect(() => mufRunWithFarmContext(ctxA, () => m.Crop.replaceOne({ _id: 'c1' }, { name: 'x' }))).toThrow(/not farm-scoped/);
  });

  it('replaceFarmRecord replaces inside the farm, keeps farmId, and finds nothing elsewhere', async () => {
    const m = setup();
    await mufRunWithFarmContext(ctxA, () => m.Crop.create({ _id: 'c1', name: 'Wheat', old: 1 }));
    const other = await mufRunWithFarmContext(ctxB, () => replaceFarmRecord(m.Crop, 'c1', { name: 'Hack' }));
    expect(other.matchedCount).toBe(0);
    const same = await mufRunWithFarmContext(ctxA, () => replaceFarmRecord(m.Crop, 'c1', { name: 'Maize', farmId: 'fb' }));
    expect(same.matchedCount).toBe(1);
    const row = await mufRunUnscoped(() => m.Crop.findOne({ _id: 'c1' }));
    expect(row).toMatchObject({ name: 'Maize', farmId: 'fa' });
    expect(row.old).toBeUndefined(); // still a full replace, like before
  });
});

describe('agri migration', () => {
  it('tags records, converts admins to owners, assigns workers, and is safe to run twice', async () => {
    const m = setup();
    await m.Crop.create({ _id: 'c1', name: 'Wheat' });
    await m.Finance.create({ _id: 'f1', amount: 5 });
    await m.User.create({ username: 'boss', role: 'admin' });
    await m.User.create({ username: 'hand', role: 'worker' });
    const args = { Farm: m.Farm, User: m.User, models: m, names: ['Crop', 'Finance'] };
    const first = await mufMigrateFarms(args);
    expect(first.created).toBe(true);
    expect(first.tagged).toEqual({ Crop: 1, Finance: 1 });
    const farm = (await m.Farm.find({}).lean())[0];
    const users = await m.User.find({}).lean();
    expect(users.find((u: any) => u.username === 'boss').role).toBe('owner');
    expect(users.find((u: any) => u.username === 'hand').farmIds).toEqual([String(farm._id)]);
    const second = await mufMigrateFarms(args);
    expect(second).toMatchObject({ created: false, tagged: {}, rolesConverted: 0, assigned: 0 });
    mufSetDefaultFarmId(null);
  });
});

describe('agri wiring (source checks)', () => {
  const read = (...p: string[]) => readFileSync(join(backendRoot, ...p), 'utf8');
  it('wraps all 14 farm-owned models and leaves the global ones alone', () => {
    const db = read('db.js');
    const block = db.slice(db.indexOf('const FARM_SCOPED = {'), db.indexOf('const MUF_FARM_SCOPED_NAMES'));
    for (const n of ['Crop', 'Finance', 'Task', 'Inventory', 'Liability', 'Irrigation', 'CropPhoto', 'Spray', 'Laborer', 'Attendance', 'LaborAdvance', 'Supplier', 'SupplierPayment', 'DiaryMedia']) {
      expect(block).toContain(`${n}: `);
    }
    for (const n of ['User:', 'Reset:', 'TelegramMeta:', 'Setting:']) expect(block).not.toContain(n);
  });
  it('no route calls replaceOne directly (it is refused inside a farm-scoped request)', () => {
    for (const f of readdirSync(join(backendRoot, 'routes'))) {
      expect(read('routes', f), f).not.toMatch(/\.replaceOne\(/);
    }
  });
  it('backups and restores are owner only', () => {
    const src = read('routes', 'backup.js');
    expect(src).toContain('ownerOnly');
    expect(src).not.toMatch(/protect, requireAdmin/);
  });
  it('no route still checks for the old admin role value', () => {
    for (const f of readdirSync(join(backendRoot, 'routes'))) {
      expect(read('routes', f), f).not.toMatch(/role\s*(===|!==)\s*'admin'/);
    }
  });
  it('the farms API is mounted and the farm header is allowed by CORS', () => {
    const src = read('server.js');
    expect(src).toContain("app.use('/api/farms', farmsRoutes)");
    expect(src).toContain('X-Farm-Id');
  });
});
