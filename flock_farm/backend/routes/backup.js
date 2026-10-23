// ─── Backup & Monthly Auto-Backup ────────────────
// Once per calendar month a full snapshot of the whole database (all data
// buckets + batch collections) is stored inside the DB itself under the name
// auto-YYYY-MM. It runs at server boot; if this month's snapshot already
// exists, nothing happens. Admins can download it, force-refresh it, or
// restore the entire database from it.
import express from 'express';
import { authRequired } from '../middleware/auth.js';
import { mailConfigured, sendBackupEmail } from '../mailer.js';
import User from '../models/User.js';
import DataStore from '../models/DataStore.js';
import Batch from '../models/Batch.js';
import BatchFeedLog from '../models/BatchFeedLog.js';
import BatchMortalityLog from '../models/BatchMortalityLog.js';
import BatchExpenseLog from '../models/BatchExpenseLog.js';
import BatchSaleLog from '../models/BatchSaleLog.js';
import BatchWeightLog from '../models/BatchWeightLog.js';
import Farm from '../models/Farm.js';
import { mufGetDefaultFarmId, mufIsOwner, mufRunUnscoped } from '../muf-farms.mjs';

const router = express.Router();

const ownerUnscoped = (req, res, next) => {
  if (!mufIsOwner(req.user?.farmRole || req.user?.role)) return res.status(403).json({ error: 'Owner only' });
  return mufRunUnscoped(() => next());
};

const MONTHLY_AUTO_BACKUP_KEY = 'monthly_auto_backup';
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
};

async function collectBackupPayload() {
  const payload = {
    exportDate: new Date().toISOString(),
    farmName: 'Usman Flock Farm',
    version: 2,
    farms: [],
    buckets: {},
    farmBuckets: {},
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
}

async function restoreBackupPayload(payload) {
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
}

function currentAutoBackupName(now = new Date()) {
  return `auto-${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function maybeRunMonthlyAutoBackup(force = false) {
  const name = currentAutoBackupName();
  const existing = await DataStore.findOne({ key: MONTHLY_AUTO_BACKUP_KEY });
  const value = (existing && existing.value) || {};
  if (!force && value.name === name && value.payload) return value;
  const stored = {
    name,
    createdAt: new Date().toISOString(),
    payload: await collectBackupPayload(),
  };
  if (existing) {
    await DataStore.findOneAndUpdate(
      { key: MONTHLY_AUTO_BACKUP_KEY },
      { $set: { value: stored, version: (existing.version || 0) + 1 } }
    );
  } else {
    await DataStore.create({ key: MONTHLY_AUTO_BACKUP_KEY, value: stored, version: 1 });
  }
  console.log(`💾 [Auto Backup] Saved ${name}`);

  // Silently email the snapshot to the admin so a copy lives OUTSIDE the
  // database. Failures never block the backup itself.
  try {
    if (mailConfigured()) {
      const admin = await User.findOne({ role: { $in: ['owner', 'admin'] }, email: { $nin: [null, ''] } });
      if (admin && admin.email) {
        await sendBackupEmail({ to: admin.email, name, json: JSON.stringify(stored.payload, null, 2) });
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
router.get('/backup', authRequired, ownerUnscoped, async (_req, res) => {
  try {
    const payload = await collectBackupPayload();
    res.setHeader('Content-Disposition', `attachment; filename=flock-farm-backup-${new Date().toISOString().slice(0, 10)}.json`);
    res.json(payload);
  } catch (err) {
    console.error('GET /api/backup error:', err);
    res.status(500).json({ error: 'Failed to build backup' });
  }
});

// GET /api/backup/auto — info + payload of the stored monthly auto-backup
router.get('/backup/auto', authRequired, ownerUnscoped, async (_req, res) => {
  try {
    const existing = await DataStore.findOne({ key: MONTHLY_AUTO_BACKUP_KEY });
    const value = (existing && existing.value) || null;
    if (!value || !value.payload) return res.json({ available: false });
    res.json({ available: true, name: value.name, createdAt: value.createdAt, emailedTo: value.emailedTo || null, emailedAt: value.emailedAt || null, payload: value.payload });
  } catch (err) {
    console.error('GET /api/backup/auto error:', err);
    res.status(500).json({ error: 'Failed to load auto-backup' });
  }
});

// POST /api/backup/auto/run — force-refresh this month's snapshot now
router.post('/backup/auto/run', authRequired, ownerUnscoped, async (_req, res) => {
  try {
    const stored = await maybeRunMonthlyAutoBackup(true);
    res.json({ ok: true, name: stored.name, createdAt: stored.createdAt });
  } catch (err) {
    console.error('POST /api/backup/auto/run error:', err);
    res.status(500).json({ error: 'Failed to run auto-backup' });
  }
});

// POST /api/backup/restore-auto — restore the whole DB from the auto-backup
router.post('/backup/restore-auto', authRequired, ownerUnscoped, async (_req, res) => {
  try {
    const existing = await DataStore.findOne({ key: MONTHLY_AUTO_BACKUP_KEY });
    const value = (existing && existing.value) || null;
    if (!value || !value.payload) return res.status(404).json({ error: 'No auto-backup available yet' });
    await restoreBackupPayload(value.payload);
    res.json({ ok: true, message: `Restored from ${value.name}` });
  } catch (err) {
    console.error('POST /api/backup/restore-auto error:', err);
    res.status(500).json({ error: `Restore failed: ${err.message}` });
  }
});

export default router;
