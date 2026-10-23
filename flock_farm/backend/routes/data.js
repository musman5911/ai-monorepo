// Flock Farm — generic key/value data store endpoints + worker-write validation.
//
// Extracted from server.js so server.js stays focused on middleware + mounting
// (same pattern dairy_farm and agri_farm already follow). All flock-specific
// worker-permission logic (which fields a worker may/may not touch on a bird,
// the "workers cannot mark birds as sold" rule, etc.) lives here and only here.
//
// Routes mounted at /api by server.js, so the public paths stay:
//   GET  /api/data/:key   — read any bucket (admin or worker)
//   PUT  /api/data/:key   — write a bucket (role-gated, optimistic-concurrency)
import express from 'express';
import mongoose from 'mongoose';
import DataStore from '../models/DataStore.js';
import Image from '../models/Image.js';
import Batch from '../models/Batch.js';
import BatchEggLog from '../models/BatchEggLog.js';
import { validateIncubationAllocations } from '../incubation-allocation.mjs';
import { validateLaborBatchAssignments } from '../batch-labor.mjs';
import { acquireEggInventoryLock } from '../egg-inventory-lock.mjs';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

// ─── Bucket whitelist + per-role write rules ────────────────────────────────
const ALLOWED_KEYS = [
  'birds', 'expenses', 'feed', 'eggs', 'settings',
  'vaccinations', 'customers', 'customerSales',
  'incubation', 'checklist', 'diary',
  'laborers', 'laborAttendance', 'laborAdvances',
  'suppliers', 'supplierPayments',
];

const ADMIN_ONLY_WRITE_KEYS = new Set([
  'birds', 'settings', 'customers',
  'laborers', 'laborAttendance', 'laborAdvances',
  'suppliers', 'supplierPayments',
]);

const WORKER_WRITE_KEYS = new Set([
  'expenses', 'feed', 'eggs', 'vaccinations',
  'customerSales', 'incubation', 'checklist', 'diary',
]);

// Workers may edit only these fields on a bird record. Everything else is
// immutable from a worker session — protects identity, sale price, photo, etc.
const WORKER_MUTABLE_BIRD_FIELDS = new Set([
  'status',
  'lastVaccinationDate',
  'dateDied',
  'deathReason',
  'deathDetail',
]);

const IMMUTABLE_BIRD_FIELDS_FOR_WORKERS = [
  'id',
  'name',
  'gender',
  'dateBought',
  'price',
  'ageBoughtDays',
  'breed',
  'customBreed',
  'image',
  'dateOfBirth',
  'salePrice',
  'saleDate',
];

// ─── Helpers ────────────────────────────────────────────────────────────────
function sameValue(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function validateWorkerBirdWrite(existingBirds, incomingBirds) {
  if (!Array.isArray(existingBirds) || !Array.isArray(incomingBirds)) {
    return { ok: false, error: 'Bird data must stay an array.' };
  }
  if (existingBirds.length !== incomingBirds.length) {
    return { ok: false, error: 'Workers cannot add or delete birds.' };
  }

  const existingById = new Map(existingBirds.map((bird) => [bird.id, bird]));
  for (const bird of incomingBirds) {
    const previous = existingById.get(bird.id);
    if (!previous) {
      return { ok: false, error: 'Workers cannot create new bird records.' };
    }

    for (const field of IMMUTABLE_BIRD_FIELDS_FOR_WORKERS) {
      if (!sameValue(previous[field], bird[field])) {
        return { ok: false, error: `Workers cannot modify bird field "${field}".` };
      }
    }

    for (const key of Object.keys(bird)) {
      if (!WORKER_MUTABLE_BIRD_FIELDS.has(key) && !IMMUTABLE_BIRD_FIELDS_FOR_WORKERS.includes(key)) {
        if (!sameValue(previous[key], bird[key])) {
          return { ok: false, error: `Workers cannot modify bird field "${key}".` };
        }
      }
    }

    if (bird.status === 'Sold' && previous.status !== 'Sold') {
      return { ok: false, error: 'Workers cannot mark birds as sold.' };
    }
  }

  return { ok: true };
}

// ─── Image space GC ─────────────────────────────────────────────────────────
// Bird and diary photos are stored as Image documents in MongoDB and referenced
// by '/api/images/<id>' paths. When either bucket is saved, unreferenced images
// are deleted so replaced/removed photos do not accumulate forever.
function extractImageIds(value) {
  const ids = new Set();
  if (Array.isArray(value)) {
    for (const item of value) {
      const candidates = [item && typeof item.image === 'string' ? item.image : '', ...(Array.isArray(item?.photos) ? item.photos.map((photo) => typeof photo?.data === 'string' ? photo.data : '') : [])];
      for (const p of candidates) { const m = p.match(/^\/api\/images\/([a-f0-9]{24})$/i); if (m) ids.add(m[1]); }
    }
  }
  return ids;
}

async function cleanupOrphanedImages(oldIds, newIds) {
  try {
    const orphaned = [...oldIds].filter((id) => !newIds.has(id));
    for (const id of orphaned) {
      if (mongoose.isValidObjectId(id)) {
        await Image.findByIdAndDelete(id);
      }
    }
    if (orphaned.length > 0) {
      console.log(`🗑️  Freed ${orphaned.length} orphaned farm image(s) from the DB.`);
    }
  } catch (err) {
    console.error('Image cleanup failed (non-fatal):', err.message);
  }
}

// ─── GET /data/:key ─────────────────────────────────────────────────────────
// Any logged-in user (admin or worker) can read data.
// Returns `version` so clients can do optimistic-concurrency writes.
router.get('/data/:key', authRequired, async (req, res) => {
  const { key } = req.params;
  if (!ALLOWED_KEYS.includes(key)) {
    return res.status(400).json({ error: `Unknown data key: ${key}` });
  }
  try {
    const doc = await DataStore.findOne({ key });
    res.json({
      key,
      exists: !!doc,
      value: doc ? doc.value : null,
      version: doc ? (doc.version || 0) : 0,
    });
  } catch (err) {
    console.error('GET /api/data error:', err);
    res.status(500).json({ error: 'Failed to load data' });
  }
});

// ─── PUT /data/:key ─────────────────────────────────────────────────────────
// Authenticated write with SERVER-SIDE role enforcement. Workers may log
// day-to-day activity only; structural data remains admin-only even if someone
// bypasses the UI and calls the API directly.
//
// Concurrency: clients send `baseVersion` (the version they loaded). If the
// stored version differs, another user saved in between — reject with 409 and
// return the fresh data so the client can merge/reload instead of silently
// overwriting (last-write-wins data loss). The final write is CONDITIONAL on
// the version still matching, which also closes the worker-validation
// read-then-write race (TOCTOU).
router.put('/data/:key', authRequired, async (req, res) => {
  const { key } = req.params;
  if (!ALLOWED_KEYS.includes(key)) {
    return res.status(400).json({ error: `Unknown data key: ${key}` });
  }
  let releaseInventoryLock;
  try {
    const { value, baseVersion } = req.body;

    // Role gate first (cheap, no DB read needed for the non-birds cases)
    if (req.user.farmRole === 'worker' || (!req.user.farmRole && req.user.role !== 'admin')) {
      if (key !== 'birds') {
        if (!WORKER_WRITE_KEYS.has(key)) {
          return res.status(403).json({ error: `Workers cannot modify "${key}"` });
        }
        if (ADMIN_ONLY_WRITE_KEYS.has(key)) {
          return res.status(403).json({ error: `Admin role required to modify "${key}"` });
        }
      }
    }

    // Serialize incubation allocation writes with every batch egg-supply mutation.
    // The lock is farm-scoped by the DataStore model and enforced by Mongo's unique index.
    if (key === 'incubation') releaseInventoryLock = await acquireEggInventoryLock(DataStore);

    const current = await DataStore.findOne({ key });
    const currentVersion = current ? (current.version || 0) : 0;
    // Snapshot image references BEFORE the write — needed for image garbage collection
    // below (in-memory mode returns live objects, so reading after the
    // update would already show the new value).
    const oldImageIds = (key === 'birds' || key === 'diary') ? extractImageIds(current ? current.value : null) : null;

    // Optimistic-concurrency check (only when the client opts in by sending
    // baseVersion — keeps backwards compatibility with older clients).
    if (baseVersion !== undefined && baseVersion !== null) {
      const base = Number(baseVersion);
      if (!Number.isFinite(base) || base !== currentVersion) {
        return res.status(409).json({
          error: 'This data was changed by another user since you loaded it. Refresh to get the latest version.',
          conflict: true,
          key,
          value: current ? current.value : null,
          version: currentVersion,
        });
      }
    }

    // Worker bird-write validation against the same snapshot we version-check
    if ((req.user.farmRole === 'worker' || (!req.user.farmRole && req.user.role !== 'admin')) && key === 'birds') {
      const validation = validateWorkerBirdWrite(current?.value ?? [], value);
      if (!validation.ok) {
        return res.status(403).json({ error: validation.error });
      }
    }

    // Labor attendance may be linked to a batch, but the server must reject
    // batch IDs outside the selected farm even if the client bypasses the UI.
    if (key === 'laborAttendance') {
      const linkedBatchIds = Array.isArray(value)
        ? [...new Set(value.map((record) => String(record?.batchId || '').trim()).filter(Boolean))]
        : [];
      const batches = linkedBatchIds.length
        ? await Batch.find({ batch_id: { $in: linkedBatchIds } })
        : [];
      const assignmentError = validateLaborBatchAssignments(value, batches);
      if (assignmentError) return res.status(400).json({ error: assignmentError, code: 'LABOR_BATCH_ASSIGNMENT' });
    }

    // Incubation source-batch links are a real allocation, not just display metadata.
    // Queries inherit the active farm context from auth middleware. The datastore
    // version compare below prevents two clients saving against the same old bucket.
    if (key === 'incubation') {
      const linkedBatchIds = Array.isArray(value)
        ? [...new Set(value.map((record) => String(record?.sourceBatchId || '').trim()).filter(Boolean))]
        : [];
      const [batches, eggLogs] = linkedBatchIds.length
        ? await Promise.all([
          Batch.find({ batch_id: { $in: linkedBatchIds } }),
          BatchEggLog.find({ batch_id: { $in: linkedBatchIds } }),
        ])
        : [[], []];
      const allocationError = validateIncubationAllocations(value, batches, eggLogs);
      if (allocationError) return res.status(400).json({ error: allocationError, code: 'INCUBATION_EGG_ALLOCATION' });
    }

    // Conditional write: only succeeds if version is still what we read.
    // Legacy docs (created before versioning) have no `version` field at all,
    // and `{version: 0}` does NOT match a missing field in MongoDB — so when
    // the expected version is 0, also accept docs where the field is absent.
    let doc;
    if (current) {
      const versionMatch = currentVersion === 0
        ? { $or: [{ version: 0 }, { version: null }, { version: { $exists: false } }] }
        : { version: currentVersion };
      doc = await DataStore.findOneAndUpdate(
        { key, ...versionMatch },
        { $set: { value, version: currentVersion + 1 } },
        { new: true }
      );
    } else {
      try {
        doc = await DataStore.create({ key, value, version: 1 });
      } catch (createErr) {
        // Duplicate key: someone else created the doc concurrently
        if (createErr && createErr.code === 11000) doc = null;
        else throw createErr;
      }
    }

    if (!doc) {
      const fresh = await DataStore.findOne({ key });
      return res.status(409).json({
        error: 'This data was changed by another user while saving. Refresh to get the latest version.',
        conflict: true,
        key,
        value: fresh ? fresh.value : null,
        version: fresh ? (fresh.version || 0) : 0,
      });
    }

    // Free storage: delete Image docs no longer referenced by any bird
    if ((key === 'birds' || key === 'diary') && oldImageIds) {
      await cleanupOrphanedImages(oldImageIds, extractImageIds(doc.value));
    }

    res.json({ key, exists: true, value: doc.value, version: doc.version || 0 });
  } catch (err) {
    if (err?.code === 'EGG_INVENTORY_BUSY') {
      return res.status(409).json({ error: err.message, code: err.code, retryable: true });
    }
    console.error('PUT /api/data error:', err);
    res.status(500).json({ error: 'Failed to save data' });
  } finally {
    if (releaseInventoryLock) {
      try { await releaseInventoryLock(); }
      catch (releaseError) { console.error('Failed to release egg inventory lock:', releaseError); }
    }
  }
});

export default router;
