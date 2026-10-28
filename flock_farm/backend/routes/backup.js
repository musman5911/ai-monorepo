import mongoose from 'mongoose';
// ─── Backup & Monthly Auto-Backup ────────────────
// Once per calendar month a full snapshot of the whole database (all data
// buckets + batch collections) is stored inside the DB itself under the name
// auto-YYYY-MM. It runs at server boot; if this month's snapshot already
// exists, nothing happens. Admins can download it, force-refresh it, or
// restore the entire database from it.
import express from 'express';
import { authRequiredUnscoped } from '../middleware/auth.js';
import { mailConfigured, sendBackupEmail } from '../mailer.js';
import User from '../models/User.js';
import DataStore from '../models/DataStore.js';
import Batch from '../models/Batch.js';
import BatchFeedLog from '../models/BatchFeedLog.js';
import BatchMortalityLog from '../models/BatchMortalityLog.js';
import BatchExpenseLog from '../models/BatchExpenseLog.js';
import BatchSaleLog from '../models/BatchSaleLog.js';
import BatchWeightLog from '../models/BatchWeightLog.js';
import BatchEggLog from '../models/BatchEggLog.js';
import BatchVaccinationLog from '../models/BatchVaccinationLog.js';
import { acquireEggInventoryLocks } from '../egg-inventory-lock.mjs';
import Farm from '../models/Farm.js';
import Image from '../models/Image.js';
import { serializeBackupImages, restoreBackupImages, splitBase64Image, assembleBase64ImageParts } from '../muf-backup-images.mjs';
import { mufGetDefaultFarmId, mufIsOwner, mufRunUnscoped } from '../muf-farms.mjs';

const router = express.Router();

const ownerUnscoped = (req, res, next) => {
  if (!mufIsOwner(req.user?.farmRole || req.user?.role)) return res.status(403).json({ error: 'Owner only' });
  return mufRunUnscoped(() => next());
};

const MONTHLY_AUTO_BACKUP_KEY = 'monthly_auto_backup';
const MONTHLY_IMAGE_CHUNK_PREFIX = 'monthly_auto_backup_image_chunk_';
const MONTHLY_IMAGE_CHUNK_CHARS = 4 * 1024 * 1024;
const BUCKET_KEYS = [
  'birds', 'expenses', 'feed', 'eggs', 'settings',
  'vaccinations', 'customers', 'customerSales',
  'incubation', 'checklist', 'diary',
  'laborers', 'laborAttendance', 'laborAdvances',
  'suppliers', 'supplierPayments',
];
const BATCH_MODELS = {
  batches: Batch,
  batchFeedLogs: BatchFeedLog,
  batchMortalityLogs: BatchMortalityLog,
  batchExpenseLogs: BatchExpenseLog,
  batchSaleLogs: BatchSaleLog,
  batchWeightLogs: BatchWeightLog,
  batchEggLogs: BatchEggLog,
  batchVaccinationLogs: BatchVaccinationLog,
};

async function collectBackupPayload() {
  const farmIds = (await Farm.find({}).lean()).map((farm) => String(farm._id));
  const releaseLocks = await acquireEggInventoryLocks(DataStore, farmIds);
  try {
  const payload = {
    exportDate: new Date().toISOString(),
    farmName: 'Usman Flock Farm',
    version: 2,
    farms: [],
    buckets: {},
    farmBuckets: {},
    images: serializeBackupImages(await Image.find({}).lean()),
    archiveJobs: await (mongoose.models.MufArchiveJob?.find({}).lean() || Promise.resolve([])),
    archiveRecords: await (mongoose.models.MufArchiveRecord?.find({}).lean() || Promise.resolve([])),
  };
  payload.farms = (await Farm.find({}).lean()).map((farm) => {
    const out = { ...farm };
    delete out._id;
    delete out.__v;
    return { ...out, id: String(farm._id) };
  });
  const defaultFarmId = mufGetDefaultFarmId();
  for (const key of BUCKET_KEYS) {
    const docs = await DataStore.find({ key }).lean();
    payload.farmBuckets[key] = docs.map((doc) => ({ farmId: String(doc.farmId || defaultFarmId || ''), value: doc.value, version: doc.version || 0 }));
    const defaultDoc = docs.find((doc) => String(doc.farmId || '') === String(defaultFarmId || '')) || docs[0];
    payload.buckets[key] = defaultDoc ? defaultDoc.value : null;
  }
  for (const [name, Model] of Object.entries(BATCH_MODELS)) {
    const docs = await Model.find().lean();
    payload[name] = docs.map((d) => { const o = { ...d }; delete o._id; delete o.__v; return o; });
  }
  return payload;
  } finally {
    await releaseLocks();
  }
}

function validateBackupPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Backup payload must be an object.');
  }
  const requireRecords = (key, value) => {
    if (value !== undefined && (!Array.isArray(value) || value.some((doc) => !doc || typeof doc !== 'object' || Array.isArray(doc)))) {
      throw new Error(`Backup section '${key}' must be an array of records.`);
    }
  };
  requireRecords('farms', payload.farms);
  requireRecords('images', payload.images);
  requireRecords('archiveJobs', payload.archiveJobs);
  requireRecords('archiveRecords', payload.archiveRecords);
  for (const [key, Model] of Object.entries(BATCH_MODELS)) {
    void Model;
    requireRecords(key, payload[key]);
  }
  if (payload.buckets !== undefined && (!payload.buckets || typeof payload.buckets !== 'object' || Array.isArray(payload.buckets))) {
    throw new Error("Backup section 'buckets' must be an object.");
  }
  if (payload.farmBuckets !== undefined && (!payload.farmBuckets || typeof payload.farmBuckets !== 'object' || Array.isArray(payload.farmBuckets))) {
    throw new Error("Backup section 'farmBuckets' must be an object.");
  }
  for (const key of BUCKET_KEYS) {
    const rows = payload.farmBuckets?.[key];
    if (rows !== undefined && (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row) || typeof row.farmId !== 'string' || !row.farmId.trim()))) {
      throw new Error(`Backup farm bucket '${key}' must contain records with farmId.`);
    }
  }
}

async function restoreBackupPayload(payload) {
  validateBackupPayload(payload);
  // Validate the complete image section before any restore mutation. Older backups
  // without an images key remain compatible and leave current images untouched.
  const restoredImages = Array.isArray(payload.images) ? restoreBackupImages(payload.images) : null;
  // Buckets: overwrite each present bucket, bumping the version so any
  // logged-in clients get a clean 409 + reload instead of silent overwrite.
  if (Array.isArray(payload.farms)) {
    for (const farm of payload.farms) {
      const name = String(farm.name || '').trim();
      if (!name) continue;
      const existing = farm.id ? await Farm.findById(farm.id) : await Farm.findOne({ name });
      if (!existing) await Farm.create({ ...(farm.id ? { _id: farm.id } : {}), name, location: farm.location || '', archived: Boolean(farm.archived) });
      else {
        existing.location = farm.location || '';
        existing.archived = Boolean(farm.archived);
        await existing.save();
      }
    }
  }
  for (const key of BUCKET_KEYS) {
    const farmRows = payload.farmBuckets?.[key];
    if (Array.isArray(farmRows)) {
      for (const row of farmRows) {
        if (!row?.farmId) continue;
        const current = await DataStore.findOne({ key, farmId: String(row.farmId) });
        if (current) await DataStore.findOneAndUpdate({ key, farmId: String(row.farmId) }, { $set: { value: row.value, version: (current.version || 0) + 1 } });
        else await DataStore.create({ key, farmId: String(row.farmId), value: row.value, version: 1 });
      }
    } else if (payload.buckets && payload.buckets[key] !== undefined && payload.buckets[key] !== null) {
      const farmId = mufGetDefaultFarmId();
      if (!farmId) continue;
      const current = await DataStore.findOne({ key, farmId });
      if (current) await DataStore.findOneAndUpdate({ key, farmId }, { $set: { value: payload.buckets[key], version: (current.version || 0) + 1 } });
      else await DataStore.create({ key, farmId, value: payload.buckets[key], version: 1 });
    }
  }
  // Batch collections: full replace
  for (const [name, Model] of Object.entries(BATCH_MODELS)) {
    if (!Array.isArray(payload[name])) continue;
    await Model.deleteMany({});
    if (payload[name].length > 0) {
      await Model.insertMany(payload[name]);
    }
  }
  if (Array.isArray(payload.archiveJobs) && mongoose.models.MufArchiveJob) {
    await mongoose.models.MufArchiveJob.deleteMany({});
    if (payload.archiveJobs.length) await mongoose.models.MufArchiveJob.insertMany(payload.archiveJobs);
  }
  if (Array.isArray(payload.archiveRecords) && mongoose.models.MufArchiveRecord) {
    await mongoose.models.MufArchiveRecord.deleteMany({});
    if (payload.archiveRecords.length) await mongoose.models.MufArchiveRecord.insertMany(payload.archiveRecords);
  }
  if (restoredImages) {
    await Image.deleteMany({});
    if (restoredImages.length) await Image.insertMany(restoredImages);
  }
}


async function saveMonthlyImageChunks(snapshotId, images) {
  const chunks = [];
  for (let imageIndex = 0; imageIndex < images.length; imageIndex += 1) {
    chunks.push(...splitBase64Image(images[imageIndex], imageIndex, MONTHLY_IMAGE_CHUNK_CHARS));
  }
  const groups = [];
  let current = [];
  let currentBytes = 0;
  for (const part of chunks) {
    const size = Buffer.byteLength(JSON.stringify(part), 'utf8');
    if (current.length && currentBytes + size > 6 * 1024 * 1024) {
      groups.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(part);
    currentBytes += size;
  }
  if (current.length) groups.push(current);
  const farmId = mufGetDefaultFarmId();
  if (!farmId) throw new Error('Cannot store monthly image backup without a default farm.');
  for (let i = 0; i < groups.length; i += 1) {
    await DataStore.create({
      key: MONTHLY_IMAGE_CHUNK_PREFIX + snapshotId + '_' + String(i).padStart(5, '0'),
      farmId,
      value: { snapshotId, chunkIndex: i, parts: groups[i] },
      version: 1,
    });
  }
  return groups.length;
}

async function expandMonthlyImagePayload(stored) {
  const payload = { ...(stored?.payload || {}) };
  if (!stored?.imageSnapshotId) return payload;
  const docs = await DataStore.find({}).lean();
  const rows = docs.filter((doc) => String(doc.key || '').startsWith(MONTHLY_IMAGE_CHUNK_PREFIX) && doc.value?.snapshotId === stored.imageSnapshotId);
  if (rows.length !== stored.imageChunkCount) throw new Error('Monthly backup image chunks are missing; restore was not started.');
  const parts = rows.flatMap((doc) => Array.isArray(doc.value?.parts) ? doc.value.parts : []);
  const imageIndexes = [...new Set(parts.map((part) => part.imageIndex))].sort((a, b) => a - b);
  const images = [];
  for (let index = 0; index < imageIndexes.length; index += 1) {
    if (imageIndexes[index] !== index) throw new Error('Monthly backup image list is incomplete; restore was not started.');
    const imageParts = parts.filter((part) => part.imageIndex === index);
    images.push(assembleBase64ImageParts(imageParts, index));
  }
  payload.images = images;
  return payload;
}

async function cleanOldMonthlyImageChunks(keepSnapshotId) {
  const docs = await DataStore.find({}).lean();
  for (const doc of docs) {
    if (String(doc.key || '').startsWith(MONTHLY_IMAGE_CHUNK_PREFIX) && doc.value?.snapshotId !== keepSnapshotId) {
      await DataStore.deleteMany({ _id: doc._id });
    }
  }
}

function currentAutoBackupName(now = new Date()) {
  return `auto-${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function maybeRunMonthlyAutoBackup(force = false) {
  const name = currentAutoBackupName();
  const existing = await DataStore.findOne({ key: MONTHLY_AUTO_BACKUP_KEY });
  const value = (existing && existing.value) || {};
  if (!force && value.name === name && value.payload && value.imageSnapshotId) return value;
  const fullPayload = await collectBackupPayload();
  const imageSnapshotId = new Date().toISOString().replace(/[^0-9A-Za-z]/g, '') + '_' + Math.random().toString(36).slice(2, 10);
  const imageChunkCount = await saveMonthlyImageChunks(imageSnapshotId, fullPayload.images || []);
  const stored = {
    name,
    createdAt: new Date().toISOString(),
    imageSnapshotId,
    imageChunkCount,
    payload: { ...fullPayload, images: [] },
  };
  if (existing) {
    await DataStore.findOneAndUpdate(
      { key: MONTHLY_AUTO_BACKUP_KEY },
      { $set: { value: stored, version: (existing.version || 0) + 1 } }
    );
  } else {
    await DataStore.create({ key: MONTHLY_AUTO_BACKUP_KEY, value: stored, version: 1 });
  }
  await cleanOldMonthlyImageChunks(imageSnapshotId);
  console.log(`💾 [Auto Backup] Saved ${name}`);

  // Silently email the snapshot to the admin so a copy lives OUTSIDE the
  // database. Failures never block the backup itself.
  try {
    if (mailConfigured()) {
      const admin = await User.findOne({ role: { $in: ['owner', 'admin'] }, email: { $nin: [null, ''] } });
      if (admin && admin.email) {
        await sendBackupEmail({ to: admin.email, name, json: JSON.stringify(await expandMonthlyImagePayload(stored), null, 2) });
        stored.emailedTo = admin.email;
        stored.emailedAt = new Date().toISOString();
        await DataStore.findOneAndUpdate(
          { key: MONTHLY_AUTO_BACKUP_KEY },
          { $set: { value: stored } }
        );
        console.log(`📧 [Auto Backup] Emailed ${name} to ${admin.email}`);
      }
    }
  } catch (mailErr) {
    console.error('[Auto Backup] Email failed:', mailErr.message);
  }
  return stored;
}

// GET /api/backup — download a full snapshot right now (admin only)
router.get('/backup', authRequiredUnscoped, ownerUnscoped, async (_req, res) => {
  try {
    const payload = await collectBackupPayload();
    res.setHeader('Content-Disposition', `attachment; filename=flock-farm-backup-${new Date().toISOString().slice(0, 10)}.json`);
    res.json(payload);
  } catch (err) {
    console.error('GET /api/backup error:', err);
    res.status(500).json({ error: 'Failed to build backup' });
  }
});

// POST /api/backup/restore — restore a downloaded full snapshot (owner only)
router.post('/backup/restore', authRequiredUnscoped, ownerUnscoped, async (req, res) => {
  let releaseLocks;
  try {
    const payload = req.body;
    validateBackupPayload(payload);
    if (Array.isArray(payload.images)) restoreBackupImages(payload.images);
    const farmIds = (await Farm.find({}).lean()).map((farm) => String(farm._id));
    releaseLocks = await acquireEggInventoryLocks(DataStore, farmIds);
    await restoreBackupPayload(payload);
    res.json({ ok: true, message: 'Backup restored.' });
  } catch (err) {
    if (err?.code === 'EGG_INVENTORY_BUSY') return res.status(409).json({ error: err.message, code: err.code, retryable: true });
    res.status(400).json({ error: `Restore failed: ${err.message}` });
  } finally {
    if (releaseLocks) { try { await releaseLocks(); } catch (e) { console.error('Failed to release restore locks:', e); } }
  }
});

// GET /api/backup/auto — info + payload of the stored monthly auto-backup
router.get('/backup/auto', authRequiredUnscoped, ownerUnscoped, async (_req, res) => {
  try {
    const existing = await DataStore.findOne({ key: MONTHLY_AUTO_BACKUP_KEY });
    const value = (existing && existing.value) || null;
    if (!value || !value.payload) return res.json({ available: false });
    res.json({ available: true, name: value.name, createdAt: value.createdAt, emailedTo: value.emailedTo || null, emailedAt: value.emailedAt || null, payload: await expandMonthlyImagePayload(value) });
  } catch (err) {
    console.error('GET /api/backup/auto error:', err);
    res.status(500).json({ error: 'Failed to load auto-backup' });
  }
});

// POST /api/backup/auto/run — force-refresh this month's snapshot now
router.post('/backup/auto/run', authRequiredUnscoped, ownerUnscoped, async (_req, res) => {
  try {
    const stored = await maybeRunMonthlyAutoBackup(true);
    res.json({ ok: true, name: stored.name, createdAt: stored.createdAt });
  } catch (err) {
    console.error('POST /api/backup/auto/run error:', err);
    res.status(500).json({ error: 'Failed to run auto-backup' });
  }
});

// POST /api/backup/restore-auto — restore the whole DB from the auto-backup
router.post('/backup/restore-auto', authRequiredUnscoped, ownerUnscoped, async (_req, res) => {
  let releaseLocks;
  try {
    const existing = await DataStore.findOne({ key: MONTHLY_AUTO_BACKUP_KEY });
    const value = (existing && existing.value) || null;
    if (!value || !value.payload) return res.status(404).json({ error: 'No auto-backup available yet' });
    const payload = await expandMonthlyImagePayload(value);
    validateBackupPayload(payload);
    const existingFarmIds = (await Farm.find({}).lean()).map((farm) => String(farm._id));
    const backupFarmIds = [
      ...(Array.isArray(payload.farms) ? payload.farms.map((farm) => farm.id || farm._id) : []),
      ...Object.values(payload.farmBuckets || {}).flatMap((rows) => Array.isArray(rows) ? rows.map((row) => row?.farmId) : []),
    ];
    releaseLocks = await acquireEggInventoryLocks(DataStore, [...existingFarmIds, ...backupFarmIds]);
    await restoreBackupPayload(payload);
    res.json({ ok: true, message: `Restored from ${value.name}` });
  } catch (err) {
    if (err?.code === 'EGG_INVENTORY_BUSY') return res.status(409).json({ error: err.message, code: err.code, retryable: true });
    console.error('POST /api/backup/restore-auto error:', err);
    res.status(500).json({ error: `Restore failed: ${err.message}` });
  } finally {
    if (releaseLocks) {
      try { await releaseLocks(); }
      catch (releaseError) { console.error('Failed to release egg inventory locks after restore:', releaseError); }
    }
  }
});

export default router;
