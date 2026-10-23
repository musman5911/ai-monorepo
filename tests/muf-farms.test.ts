import { describe, it, expect } from 'vitest';
// @ts-expect-error plain ESM twin without type declarations
import * as farms from '../dairy_farm/backend/muf-farms.mjs';
// @ts-expect-error plain ESM without type declarations
import { createStore } from '../dairy_farm/backend/memory-db.js';

const {
  mufNormalizeRole, mufLegacyRole, mufIsFullRole, mufResolveFarmAccess, mufScopeFilter,
  mufStripFarmId, mufScopeModel, mufRunWithFarmContext, mufRunUnscoped, mufSetDefaultFarmId,
  mufMigrateFarms,
} = farms;

const F = (id: string, createdAt: string, archived = false) => ({ _id: id, createdAt, archived });
const farmList = [F('b', '2026-02-01'), F('a', '2026-01-01'), F('c', '2026-03-01', true)];

describe('roles', () => {
  it('maps the legacy admin to owner and unknown values to worker', () => {
    expect(mufNormalizeRole('admin')).toBe('owner');
    expect(mufNormalizeRole('owner')).toBe('owner');
    expect(mufNormalizeRole('manager')).toBe('manager');
    expect(mufNormalizeRole('worker')).toBe('worker');
    expect(mufNormalizeRole('anything')).toBe('worker');
    expect(mufNormalizeRole(undefined)).toBe('worker');
  });
  it('gives owners and managers full control, and old screens the admin/worker pair', () => {
    expect(mufIsFullRole('owner')).toBe(true);
    expect(mufIsFullRole('manager')).toBe(true);
    expect(mufIsFullRole('worker')).toBe(false);
    expect(mufLegacyRole('owner')).toBe('admin');
    expect(mufLegacyRole('manager')).toBe('admin');
    expect(mufLegacyRole('worker')).toBe('worker');
  });
});

describe('farm access', () => {
  it('requires the migration when there are no farms', () => {
    const r = mufResolveFarmAccess({ user: { role: 'owner' }, farms: [], requested: '' });
    expect(r).toMatchObject({ ok: false, status: 503, code: 'MIGRATION_REQUIRED' });
  });
  it('defaults an owner to the oldest active farm and lets them pick any farm', () => {
    const d = mufResolveFarmAccess({ user: { role: 'owner' }, farms: farmList, requested: '' });
    expect(d.ctx).toMatchObject({ mode: 'single', farmId: 'a' });
    const archived = mufResolveFarmAccess({ user: { role: 'owner' }, farms: farmList, requested: 'c' });
    expect(archived.ctx).toMatchObject({ mode: 'single', farmId: 'c' });
    const all = mufResolveFarmAccess({ user: { role: 'owner' }, farms: farmList, requested: 'all' });
    expect(all.ctx).toMatchObject({ mode: 'all', farmIds: ['a', 'b'] });
  });
  it('limits managers and workers to assigned, active farms', () => {
    const user = { role: 'worker', farmIds: ['b', 'c'] };
    expect(mufResolveFarmAccess({ user, farms: farmList, requested: '' }).ctx).toMatchObject({ farmId: 'b' });
    expect(mufResolveFarmAccess({ user, farms: farmList, requested: 'a' })).toMatchObject({ ok: false, status: 403, code: 'FARM_FORBIDDEN' });
    expect(mufResolveFarmAccess({ user, farms: farmList, requested: 'c' })).toMatchObject({ ok: false, code: 'FARM_FORBIDDEN' });
    expect(mufResolveFarmAccess({ user, farms: farmList, requested: 'all' }).ctx).toMatchObject({ mode: 'all', farmIds: ['b'] });
    expect(mufResolveFarmAccess({ user: { role: 'manager', farmIds: [] }, farms: farmList, requested: '' }))
      .toMatchObject({ ok: false, status: 403, code: 'NO_FARM_ACCESS' });
  });
});

describe('scope filter', () => {
  it('adds the farm to a plain filter and never lets the client override it', () => {
    const single = { mode: 'single', farmId: 'a', farmIds: ['a'] };
    expect(mufScopeFilter({ status: 'active' }, single)).toEqual({ status: 'active', farmId: 'a' });
    expect(mufScopeFilter(undefined, single)).toEqual({ farmId: 'a' });
    expect(mufScopeFilter({ farmId: 'evil' }, single)).toEqual({ $and: [{ farmId: 'evil' }, { farmId: 'a' }] });
    const all = { mode: 'all', farmId: null, farmIds: ['a', 'b'] };
    expect(mufScopeFilter({ x: 1 }, all)).toEqual({ x: 1, farmId: { $in: ['a', 'b'] } });
  });
  it('strips farmId from update documents', () => {
    expect(mufStripFarmId({ name: 'x', farmId: 'evil' })).toEqual({ name: 'x' });
    expect(mufStripFarmId({ $set: { name: 'x', farmId: 'evil' } })).toEqual({ $set: { name: 'x' } });
  });
});

describe('model wrapper', () => {
  function fakeModel() {
    const calls: Array<[string, unknown[]]> = [];
    const rec = (name: string) => (...args: unknown[]) => { calls.push([name, args]); return name; };
    const model: Record<string, unknown> = {};
    for (const n of ['find', 'findOne', 'findOneAndUpdate', 'updateMany', 'deleteMany', 'countDocuments', 'findById', 'findByIdAndUpdate', 'findByIdAndDelete', 'create', 'insertMany', 'aggregate']) {
      model[n] = rec(n);
    }
    model.findOne = (...args: unknown[]) => { calls.push(['findOne', args]); return { _id: 'x' }; };
    return { model, calls };
  }
  const single = { mode: 'single', farmId: 'a', farmIds: ['a'] };
  const all = { mode: 'all', farmId: null, farmIds: ['a', 'b'] };

  it('scopes reads and turns by-id lookups into scoped lookups', () => {
    const { model, calls } = fakeModel();
    mufScopeModel(model, 'Thing');
    mufRunWithFarmContext(single, () => {
      (model.find as Function)({ s: 1 });
      (model.findById as Function)('x');
      (model.countDocuments as Function)();
    });
    expect(calls[0]).toEqual(['find', [{ s: 1, farmId: 'a' }, undefined]]);
    expect(calls[1][0]).toBe('findOne');
    expect((calls[1][1] as unknown[])[0]).toEqual({ _id: 'x', farmId: 'a' });
    expect((calls[2][1] as unknown[])[0]).toEqual({ farmId: 'a' });
  });
  it('stamps creates with the selected farm and ignores a client farmId', () => {
    const { model, calls } = fakeModel();
    mufScopeModel(model, 'Thing');
    mufRunWithFarmContext(single, () => {
      (model.create as Function)({ name: 'n', farmId: 'evil' });
      (model.insertMany as Function)([{ name: 'm' }]);
    });
    expect((calls[0][1] as unknown[])[0]).toEqual({ name: 'n', farmId: 'a' });
    expect((calls[1][1] as unknown[])[0]).toEqual([{ name: 'm', farmId: 'a' }]);
  });
  it('refuses to create in All farms and blocks unscoped bulk operations', () => {
    const { model } = fakeModel();
    mufScopeModel(model, 'Thing');
    expect(() => mufRunWithFarmContext(all, () => (model.create as Function)({ a: 1 }))).toThrow(/Select one farm/);
    expect(() => mufRunWithFarmContext(single, () => (model.aggregate as Function)([]))).toThrow(/not farm-scoped/);
    expect(() => mufRunWithFarmContext(single, () => (model.findByIdAndUpdate as Function)('x', {}, { upsert: true }))).not.toThrow();
  });
  it('strips farmId from updates and lets system jobs run unscoped', () => {
    const { model, calls } = fakeModel();
    mufScopeModel(model, 'Thing');
    mufRunWithFarmContext(single, () => (model.findOneAndUpdate as Function)({ _id: 'x' }, { $set: { name: 'n', farmId: 'evil' } }, { new: true }));
    expect((calls[0][1] as unknown[])[1]).toEqual({ $set: { name: 'n' } });
    mufSetDefaultFarmId('a');
    mufRunUnscoped(() => {
      (model.find as Function)({ s: 1 });
      (model.create as Function)({ name: 'job' });
      (model.create as Function)({ name: 'restored', farmId: 'keep' });
    });
    expect(calls[1]).toEqual(['find', [{ s: 1 }]]);
    expect((calls[2][1] as unknown[])[0]).toEqual({ name: 'job', farmId: 'a' });
    expect((calls[3][1] as unknown[])[0]).toEqual({ name: 'restored', farmId: 'keep' });
    mufSetDefaultFarmId(null);
  });
});

describe('real mongoose queries (skipped when the dairy backend packages are not installed)', () => {
  it('builds scoped filters and strips farmId from updates', async () => {
    let mongoose: any;
    try {
      // @ts-ignore optional dependency of the dairy backend
      mongoose = (await import('../dairy_farm/backend/node_modules/mongoose/index.js')).default;
    } catch {
      return; // backend packages not installed here: nothing to check
    }
    const Thing = mongoose.model('FarmScopeCheck', new mongoose.Schema({ _id: String, name: String, farmId: String }));
    mufScopeModel(Thing, 'Thing');
    const ctx = { mode: 'single', farmId: 'a', farmIds: ['a'] };
    mufRunWithFarmContext(ctx, () => {
      expect(Thing.find({ name: 'n' }).getFilter()).toEqual({ name: 'n', farmId: 'a' });
      expect(Thing.findById('x').getFilter()).toEqual({ _id: 'x', farmId: 'a' });
      const q = Thing.findByIdAndUpdate('x', { $set: { name: 'n', farmId: 'evil' } }, { new: true });
      expect(q.getFilter()).toEqual({ _id: 'x', farmId: 'a' });
      expect(q.getUpdate()).toEqual({ $set: { name: 'n' } });
      expect(Thing.countDocuments({}).getFilter()).toEqual({ farmId: 'a' });
      expect(Thing.deleteMany({}).getFilter()).toEqual({ farmId: 'a' });
    });
    mufRunWithFarmContext({ mode: 'all', farmId: null, farmIds: ['a', 'b'] }, () => {
      expect(Thing.find({}).getFilter()).toEqual({ farmId: { $in: ['a', 'b'] } });
    });
  }, 20000);
});

describe('farms migration', () => {
  const stub = { paths: {} };
  function setup() {
    const m = createStore({ Farm: stub, User: stub, Cow: stub, Milk: stub });
    return m;
  }
  it('creates the first farm, tags old records, converts admins, and is safe to run twice', async () => {
    const m = setup();
    await m.Cow.create({ _id: 'c1', name: 'One' });
    await m.Cow.create({ _id: 'c2', name: 'Two', farmId: 'keepme' });
    await m.Milk.create({ _id: 'm1', cowId: 'c1' });
    await m.User.create({ username: 'boss', role: 'admin' });
    await m.User.create({ username: 'hand', role: 'worker' });
    const args = { Farm: m.Farm, User: m.User, models: m, names: ['Cow', 'Milk'] };

    const first = await mufMigrateFarms(args);
    expect(first.created).toBe(true);
    expect(first.tagged).toEqual({ Cow: 1, Milk: 1 });
    const farm = (await m.Farm.find({}).lean())[0];
    expect(farm.name).toBe('Farm 1');
    const cows = await m.Cow.find({}).lean();
    expect(cows.find((c: any) => c._id === 'c1').farmId).toBe(String(farm._id));
    expect(cows.find((c: any) => c._id === 'c2').farmId).toBe('keepme');
    const users = await m.User.find({}).lean();
    expect(users.find((u: any) => u.username === 'boss').role).toBe('owner');
    expect(users.find((u: any) => u.username === 'hand').farmIds).toEqual([String(farm._id)]);

    const second = await mufMigrateFarms(args);
    expect(second.created).toBe(false);
    expect(second.tagged).toEqual({});
    expect(second.rolesConverted).toBe(0);
    expect(second.assigned).toBe(0);
    expect((await m.Farm.find({}).lean()).length).toBe(1);
    mufSetDefaultFarmId(null);
  });
});
