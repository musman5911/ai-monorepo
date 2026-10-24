// MUF farms core. This file is a byte-identical twin in all three backends
// (agri_farm, dairy_farm, flock_farm); tools/check-muf-sync.js enforces it.
//
// What it provides (see docs/FARMS_AND_ROLES.md):
//   - the three roles (owner, manager, worker) and the legacy "admin" mapping
//   - farm access resolution for a request (which farm is selected, which are allowed)
//   - server-side farm scoping of model queries, via a per-request AsyncLocalStorage
//     context, so a user can never read or write a farm they are not assigned to
//   - a farms router factory (list, create, rename, archive, restore, delete)
//   - an idempotent migration (Farm 1, tag old records, convert roles)
//
// It has no dependency on mongoose or express, so it works with both the real
// MongoDB models and the in-memory demo models.
import { AsyncLocalStorage } from 'node:async_hooks';

// ─── Roles ──────────────────────────────────────────────────────────────────
export const MUF_ROLES = ['owner', 'manager', 'worker'];

/** Legacy "admin" accounts become owners; anything unknown is a worker. */
export function mufNormalizeRole(role) {
  if (role === 'owner' || role === 'admin') return 'owner';
  if (role === 'manager') return 'manager';
  return 'worker';
}
export const mufIsOwner = (role) => mufNormalizeRole(role) === 'owner';
/** Owner or manager: full control inside the farms they can see. */
export const mufIsFullRole = (role) => mufNormalizeRole(role) !== 'worker';
/** Old frontends only understand admin/worker. Removed once all screens use farmRole. */
export const mufLegacyRole = (role) => (mufIsFullRole(role) ? 'admin' : 'worker');
/** Mongo filter matching every account that may reset a password by email. */
export const MUF_FULL_ROLE_VALUES = ['owner', 'manager', 'admin'];

// ─── Request context ────────────────────────────────────────────────────────
// null / undefined store = unscoped (system jobs, backups, migration).
const als = new AsyncLocalStorage();
let defaultFarmId = null;

export function mufRunWithFarmContext(ctx, fn) { return als.run(ctx, fn); }
export function mufRunUnscoped(fn) { return als.run(null, fn); }
export function mufGetFarmContext() { return als.getStore() || null; }
/** Farm that system jobs (cron, Telegram bot) create records in. */
export function mufSetDefaultFarmId(id) { defaultFarmId = id ? String(id) : null; }
export function mufGetDefaultFarmId() { return defaultFarmId; }

const sid = (v) => (v === undefined || v === null ? '' : String(v));
const byCreated = (a, b) => {
  const ta = new Date(a.createdAt || 0).getTime();
  const tb = new Date(b.createdAt || 0).getTime();
  return ta - tb || sid(a._id).localeCompare(sid(b._id));
};

/**
 * Decide which farm(s) a request may use. Pure function.
 *   user:      { role, farmIds }
 *   farms:     every farm document { _id, archived, createdAt }
 *   requested: the X-Farm-Id header ('' / undefined = default, 'all', or an id)
 * Returns { ok: true, ctx } or { ok: false, status, code, message }.
 */
export function mufResolveFarmAccess({ user, farms, requested }) {
  const role = mufNormalizeRole(user?.role);
  const sorted = [...(farms || [])].sort(byCreated);
  if (sorted.length === 0) {
    return { ok: false, status: 503, code: 'MIGRATION_REQUIRED', message: 'Farms are not set up yet. Run the farms migration first.' };
  }
  const active = sorted.filter((f) => !f.archived);
  const assigned = new Set((user?.farmIds || []).map(sid));
  const allowed = role === 'owner'
    ? sorted
    : active.filter((f) => assigned.has(sid(f._id)));
  if (allowed.length === 0) {
    return { ok: false, status: 403, code: 'NO_FARM_ACCESS', message: 'You are not assigned to any farm.' };
  }
  const allowedActive = allowed.filter((f) => !f.archived);
  const want = sid(requested).trim();

  const base = { role, userId: sid(user?._id || user?.id) };
  if (want === 'all') {
    const ids = (allowedActive.length ? allowedActive : allowed).map((f) => sid(f._id));
    return { ok: true, ctx: { ...base, mode: 'all', farmId: null, farmIds: ids } };
  }
  if (want) {
    const hit = allowed.find((f) => sid(f._id) === want);
    if (!hit) return { ok: false, status: 403, code: 'FARM_FORBIDDEN', message: 'You do not have access to that farm.' };
    return { ok: true, ctx: { ...base, mode: 'single', farmId: sid(hit._id), farmIds: [sid(hit._id)] } };
  }
  const def = allowedActive[0] || allowed[0];
  return { ok: true, ctx: { ...base, mode: 'single', farmId: sid(def._id), farmIds: [sid(def._id)] } };
}

// ─── Scoping ────────────────────────────────────────────────────────────────
/** Add the farm constraint to a query filter. The server's constraint always wins. */
export function mufScopeFilter(filter, ctx) {
  const f = filter && typeof filter === 'object' ? filter : {};
  const scope = ctx.mode === 'all'
    ? { farmId: { $in: ctx.farmIds } }
    : { farmId: ctx.farmId };
  if (Object.prototype.hasOwnProperty.call(f, 'farmId')) return { $and: [f, scope] };
  return { ...f, ...scope };
}

/** Remove any attempt to move a record to another farm from an update document. */
export function mufStripFarmId(update) {
  if (!update || typeof update !== 'object' || Array.isArray(update)) return update;
  const u = { ...update };
  delete u.farmId;
  for (const op of ['$set', '$unset', '$setOnInsert', '$inc', '$push', '$addToSet']) {
    if (u[op] && typeof u[op] === 'object' && 'farmId' in u[op]) {
      u[op] = { ...u[op] };
      delete u[op].farmId;
    }
  }
  return u;
}

function farmRequiredError() {
  const e = new Error('Select one farm before saving (All farms is read-only).');
  e.status = 400;
  e.code = 'FARM_REQUIRED';
  return e;
}

function stampDoc(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return doc;
  const ctx = mufGetFarmContext();
  if (ctx) {
    // Inside a request the server's farm always wins over anything the client sent.
    if (ctx.mode !== 'single' || !ctx.farmId) throw farmRequiredError();
    return { ...doc, farmId: ctx.farmId };
  }
  // System job (cron, Telegram bot, restore): keep an existing farmId, else use the default farm.
  if (doc.farmId) return doc;
  return defaultFarmId ? { ...doc, farmId: defaultFarmId } : { ...doc };
}

const FILTER_FNS = [
  'find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete', 'updateOne', 'updateMany',
  'deleteOne', 'deleteMany', 'countDocuments', 'distinct', 'exists',
];
// Operations that could bypass the scope; they are refused inside a scoped request.
const BLOCKED_FNS = ['aggregate', 'bulkWrite', 'replaceOne', 'findOneAndReplace', 'estimatedDocumentCount'];

/**
 * Make one model farm-aware. Works on real mongoose models and the memory-db models.
 * Inside a request every read, update and delete is limited to the selected farm(s),
 * and every create is stamped with the selected farm.
 */
export function mufScopeModel(model, name = 'model') {
  if (!model || model.__mufFarmScoped) return model;
  const orig = {};
  for (const fn of [...FILTER_FNS, 'findById', 'findByIdAndUpdate', 'findByIdAndDelete', 'create', 'insertMany']) {
    if (typeof model[fn] === 'function') orig[fn] = model[fn];
  }

  const hasUpdateFilterFn = (fn) => typeof orig[fn] === 'function';

  for (const fn of FILTER_FNS) {
    if (!hasUpdateFilterFn(fn)) continue;
    const isUpdate = fn === 'findOneAndUpdate' || fn === 'updateOne' || fn === 'updateMany';
    const isDistinct = fn === 'distinct';
    model[fn] = function scoped(...args) {
      const ctx = mufGetFarmContext();
      if (!ctx) return orig[fn].apply(model, args);
      if (isDistinct) {
        const [field, filter, ...rest] = args;
        return orig[fn].call(model, field, mufScopeFilter(filter, ctx), ...rest);
      }
      const [filter, second, ...rest] = args;
      if (isUpdate) {
        const opts = rest[0] || {};
        if (opts.upsert && ctx.mode !== 'single') throw farmRequiredError();
        return orig[fn].call(model, mufScopeFilter(filter, ctx), mufStripFarmId(second), ...rest);
      }
      return orig[fn].call(model, mufScopeFilter(filter, ctx), second, ...rest);
    };
  }

  if (orig.findById) {
    model.findById = function scopedFindById(id, ...rest) {
      if (!mufGetFarmContext()) return orig.findById.call(model, id, ...rest);
      return model.findOne({ _id: id }, ...rest);
    };
  }
  if (orig.findByIdAndUpdate) {
    model.findByIdAndUpdate = function scopedFindByIdAndUpdate(id, update, ...rest) {
      if (!mufGetFarmContext()) return orig.findByIdAndUpdate.call(model, id, update, ...rest);
      return model.findOneAndUpdate({ _id: id }, update, ...rest);
    };
  }
  if (orig.findByIdAndDelete) {
    model.findByIdAndDelete = async function scopedFindByIdAndDelete(id, ...rest) {
      if (!mufGetFarmContext()) return orig.findByIdAndDelete.call(model, id, ...rest);
      const hit = await model.findOne({ _id: id });
      if (!hit) return null;
      return orig.findByIdAndDelete.call(model, id, ...rest);
    };
  }
  if (orig.create) {
    model.create = function scopedCreate(docs, ...rest) {
      const out = Array.isArray(docs) ? docs.map(stampDoc) : stampDoc(docs);
      return orig.create.call(model, out, ...rest);
    };
  }
  if (orig.insertMany) {
    model.insertMany = function scopedInsertMany(docs, ...rest) {
      return orig.insertMany.call(model, (docs || []).map(stampDoc), ...rest);
    };
  }
  for (const fn of BLOCKED_FNS) {
    if (typeof model[fn] !== 'function') continue;
    const real = model[fn];
    model[fn] = function blocked(...args) {
      if (mufGetFarmContext()) {
        throw new Error(`${name}.${fn}() is not farm-scoped; use find/update helpers or mufRunUnscoped.`);
      }
      return real.apply(model, args);
    };
  }
  model.__mufFarmScoped = true;
  return model;
}

/** Scope every model in `models` whose name is listed in `names`. */
export function mufScopeModels(models, names) {
  for (const n of names) mufScopeModel(models[n], n);
  return models;
}

// ─── Express glue ───────────────────────────────────────────────────────────
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function stripFarmIdFromBody(body) {
  if (!body || typeof body !== 'object') return;
  if (Array.isArray(body)) { body.forEach(stripFarmIdFromBody); return; }
  delete body.farmId;
}

/**
 * Call from the authentication middleware once req.user is set
 * ({ id, role, farmIds }). Resolves the farm for this request, rejects writes in
 * "All farms" mode, and runs the rest of the request inside the farm context.
 */
export async function mufApplyFarmContext(req, res, next, { Farm }) {
  try {
    const farms = await Farm.find({}).select('_id name archived createdAt').lean();
    const result = mufResolveFarmAccess({
      user: req.user,
      farms,
      requested: req.headers['x-farm-id'],
    });
    if (!result.ok) return res.status(result.status).json({ error: result.message, code: result.code });
    const ctx = result.ctx;
    if (ctx.mode === 'all' && !SAFE_METHODS.has(req.method)) {
      return res.status(400).json({ error: 'Select one farm before saving (All farms is read-only).', code: 'FARM_REQUIRED' });
    }
    stripFarmIdFromBody(req.body);
    req.farmContext = ctx;
    return mufRunWithFarmContext(ctx, () => next());
  } catch (err) {
    console.error('Farm context failed:', err);
    return res.status(500).json({ error: 'Farm check failed' });
  }
}

const cleanName = (v) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
const cleanText = (v) => String(v ?? '').trim().slice(0, 200);
const farmJson = (f) => ({
  id: sid(f._id), _id: sid(f._id), name: f.name, location: f.location || '',
  archived: Boolean(f.archived), createdAt: f.createdAt,
});

/** Count the records of one farm across every farm-scoped model. */
export async function mufCountFarmRecords(models, names, farmId) {
  return mufRunUnscoped(async () => {
    const counts = {};
    let total = 0;
    for (const n of names) {
      const c = await models[n].countDocuments({ farmId: sid(farmId) });
      if (c) counts[n] = c;
      total += c;
    }
    return { total, counts };
  });
}

/**
 * Router for /api/farms. Pass the express module so this file needs no express import.
 *   list:    owner sees every farm, others only assigned, active ones
 *   create / rename / archive / restore / delete: owner only
 */
export function mufCreateFarmsRouter({ express, Farm, User, models, names, protect, ownerOnly }) {
  const router = express.Router();

  router.get('/', protect, async (req, res) => {
    try {
      const farms = (await Farm.find({}).lean()).sort(byCreated);
      const role = mufNormalizeRole(req.user.role);
      const mine = role === 'owner'
        ? farms
        : farms.filter((f) => !f.archived && (req.user.farmIds || []).map(sid).includes(sid(f._id)));
      const out = [];
      for (const f of mine) {
        const j = farmJson(f);
        if (role === 'owner' && req.query.counts === '1') j.records = (await mufCountFarmRecords(models, names, f._id)).total;
        out.push(j);
      }
      res.json({ farms: out, activeFarmId: req.farmContext?.farmId || null, mode: req.farmContext?.mode || 'single' });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/', protect, ownerOnly, async (req, res) => {
    try {
      const name = cleanName(req.body?.name);
      if (!name) return res.status(400).json({ error: 'Farm name is required' });
      const dup = (await Farm.find({}).lean()).some((f) => cleanName(f.name).toLowerCase() === name.toLowerCase());
      if (dup) return res.status(409).json({ error: 'A farm with this name already exists' });
      const farm = await Farm.create({ name, location: cleanText(req.body?.location), archived: false, createdBy: req.user.id });
      res.status(201).json(farmJson(farm));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.put('/:id', protect, ownerOnly, async (req, res) => {
    try {
      const farm = await Farm.findById(req.params.id);
      if (!farm) return res.status(404).json({ error: 'Farm not found' });
      if (req.body?.name !== undefined) {
        const name = cleanName(req.body.name);
        if (!name) return res.status(400).json({ error: 'Farm name is required' });
        const dup = (await Farm.find({}).lean()).some((f) => sid(f._id) !== sid(farm._id) && cleanName(f.name).toLowerCase() === name.toLowerCase());
        if (dup) return res.status(409).json({ error: 'A farm with this name already exists' });
        farm.name = name;
      }
      if (req.body?.location !== undefined) farm.location = cleanText(req.body.location);
      await farm.save();
      res.json(farmJson(farm));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/:id/archive', protect, ownerOnly, async (req, res) => {
    try {
      const farm = await Farm.findById(req.params.id);
      if (!farm) return res.status(404).json({ error: 'Farm not found' });
      const active = (await Farm.find({}).lean()).filter((f) => !f.archived);
      if (!farm.archived && active.length <= 1) return res.status(400).json({ error: 'You cannot archive the last active farm' });
      farm.archived = true;
      await farm.save();
      res.json(farmJson(farm));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/:id/restore', protect, ownerOnly, async (req, res) => {
    try {
      const farm = await Farm.findById(req.params.id);
      if (!farm) return res.status(404).json({ error: 'Farm not found' });
      farm.archived = false;
      await farm.save();
      res.json(farmJson(farm));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Delete rules: an empty farm is deleted directly. A farm with records needs the
  // farm name typed in `confirmName`, and either `moveToFarmId` (move the records)
  // or `deleteData: true` (delete them). The last farm can never be deleted.
  router.delete('/:id', protect, ownerOnly, async (req, res) => {
    try {
      const farm = await Farm.findById(req.params.id);
      if (!farm) return res.status(404).json({ error: 'Farm not found' });
      const all = await Farm.find({}).lean();
      if (all.length <= 1) return res.status(400).json({ error: 'You cannot delete the last farm', code: 'LAST_FARM' });
      const active = all.filter((item) => !item.archived);
      if (!farm.archived && active.length <= 1) {
        return res.status(400).json({ error: 'You cannot delete the last active farm', code: 'LAST_ACTIVE_FARM' });
      }
      const { total } = await mufCountFarmRecords(models, names, farm._id);
      if (total > 0) {
        if (cleanName(req.body?.confirmName) !== cleanName(farm.name)) {
          return res.status(400).json({ error: 'Type the farm name to confirm', code: 'CONFIRM_NAME', records: total });
        }
        const moveTo = sid(req.body?.moveToFarmId);
        if (moveTo) {
          const destination = all.find((item) => sid(item._id) === moveTo);
          if (moveTo === sid(farm._id) || !destination || destination.archived) {
            return res.status(400).json({ error: 'Choose a different active farm to move the records to', code: 'INVALID_MOVE_TARGET' });
          }
          await mufRunUnscoped(async () => {
            for (const n of names) await models[n].updateMany({ farmId: sid(farm._id) }, { $set: { farmId: moveTo } });
          });
        } else if (req.body?.deleteData === true) {
          await mufRunUnscoped(async () => {
            for (const n of names) await models[n].deleteMany({ farmId: sid(farm._id) });
          });
        } else {
          return res.status(400).json({ error: 'Choose moveToFarmId or deleteData', code: 'CHOOSE_DATA_ACTION', records: total });
        }
      }
      await mufRunUnscoped(async () => {
        for (const u of await User.find({}).lean()) {
          const ids = (u.farmIds || []).map(sid);
          if (ids.includes(sid(farm._id))) {
            await User.findByIdAndUpdate(u._id, { $set: { farmIds: ids.filter((x) => x !== sid(farm._id)) } });
          }
        }
        await Farm.findByIdAndDelete(farm._id);
      });
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
}

// ─── Migration ──────────────────────────────────────────────────────────────
/**
 * Idempotent. Safe to run twice. Back up first.
 *   1. make sure at least one farm exists ("Farm 1" by default)
 *   2. tag every farm-scoped record that has no farmId with the oldest farm
 *   3. turn legacy admin accounts into owners; give managers and workers with no
 *      farm assigned the oldest farm
 */
export async function mufMigrateFarms({ Farm, User, models, names, farmName = 'Farm 1', log = () => {} }) {
  return mufRunUnscoped(async () => {
    let farms = (await Farm.find({}).lean()).sort(byCreated);
    let created = false;
    if (farms.length === 0) {
      await Farm.create({ name: farmName, location: '', archived: false });
      farms = (await Farm.find({}).lean()).sort(byCreated);
      created = true;
      log(`created farm "${farmName}"`);
    }
    const defaultId = sid(farms[0]._id);
    mufSetDefaultFarmId(defaultId);

    const tagged = {};
    for (const n of names) {
      const r = await models[n].updateMany(
        { $or: [{ farmId: { $exists: false } }, { farmId: null }] },
        { $set: { farmId: defaultId } },
      );
      const count = r?.modifiedCount ?? r?.nModified ?? 0;
      if (count) { tagged[n] = count; log(`tagged ${count} ${n} record(s)`); }
    }

    let rolesConverted = 0;
    let assigned = 0;
    const users = await User.find({}).lean();
    for (const u of users) {
      const patch = {};
      if (u.role === 'admin') { patch.role = 'owner'; rolesConverted += 1; }
      const role = patch.role || u.role;
      if ((role === 'manager' || role === 'worker') && !(u.farmIds || []).length) {
        patch.farmIds = [defaultId];
        assigned += 1;
      }
      if (Object.keys(patch).length) await User.findByIdAndUpdate(u._id, { $set: patch });
    }
    if (rolesConverted) log(`converted ${rolesConverted} admin account(s) to owner`);
    if (assigned) log(`assigned ${assigned} account(s) to the default farm`);
    return { defaultFarmId: defaultId, created, tagged, rolesConverted, assigned };
  });
}

/** Cheap startup check: the default farm id for system jobs. Does not modify data. */
export async function mufLoadDefaultFarm(Farm) {
  return mufRunUnscoped(async () => {
    const farms = (await Farm.find({}).lean()).sort(byCreated);
    mufSetDefaultFarmId(farms[0] ? sid(farms[0]._id) : null);
    return farms[0] ? sid(farms[0]._id) : null;
  });
}
