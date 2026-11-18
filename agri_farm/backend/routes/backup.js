import mongoose from 'mongoose';
// ─── Backup & restore (admin only) + monthly auto-backup ────────────────────
import express from 'express';
import { Setting, User, Farm, Field, MUF_FARM_MODELS, MUF_FARM_SCOPED_NAMES, Crop, Finance, Task, Inventory, Liability, Irrigation, CropPhoto, Spray, Laborer, Attendance, LaborAdvance, Supplier, SupplierPayment, DiaryMedia, PhotoAsset } from '../db.js';
import { protectUnscoped, ownerOnly } from '../middleware/auth.js';
import { mufRunUnscoped, mufMigrateFarms, MUF_FULL_ROLE_VALUES } from '../muf-farms.mjs';
import { HttpError, badRequest, notFound, asyncHandler } from '../utils/helpers.js';
import { sendEmail, mufEmail, mailConfigured } from '../utils/mailer.js';
import { MUF_ENV } from '../muf-env.mjs';
import { withRestoreRecovery } from '../../../shared/muf-restore-recovery.mjs';
import { stringifyDocs as stringifyPlainBackupDocs, stringifyBackupUsers } from '../muf-backup-serialization.mjs';
import { serializePhotoAssets, restorePhotoAssets } from '../../../shared/muf-photo-asset-backup.mjs';
import { splitMonthlyPhotoAssets, assembleMonthlyPhotoAssets } from '../../../shared/muf-monthly-photo-chunks.mjs';

const router = express.Router();

// A backup covers every farm of this project, so only owners may take or restore
// one, and the handlers run outside any single-farm scope.
const requireAdmin = [ownerOnly, (_req, _res, next) => mufRunUnscoped(() => next())];

// Old backups have no farmId: tag whatever is untagged with the default farm.
const tagAfterRestore = () => mufMigrateFarms({ Farm, User, models: MUF_FARM_MODELS, names: MUF_FARM_SCOPED_NAMES });

// Restore farms that exist in the backup but not in the database (same ids).
async function restoreMissingFarms(payload) {
  if (!Array.isArray(payload?.farms)) return;
  for (const f of payload.farms) {
    if (f && f._id && !(await Farm.findById(String(f._id)))) {
      await Farm.create({
        _id: String(f._id), name: f.name || 'Farm', location: f.location || '',
        archived: Boolean(f.archived), createdAt: f.createdAt,
      });
    }
  }
}

const MONTHLY_AUTO_BACKUP_KEY = 'monthly_auto_backup';
const MONTHLY_PHOTO_CHUNK_PREFIX = 'monthly_auto_backup_photo_chunk_';
const MONTHLY_PHOTO_SECTION = 'photo_assets';

async function saveMonthlyPhotoChunks(snapshotId, photos) {
  const groups = splitMonthlyPhotoAssets(photos, snapshotId);
  for (const group of groups) {
    const key = MONTHLY_PHOTO_CHUNK_PREFIX + snapshotId + '_' + String(group.chunkIndex).padStart(5, '0');
    await Setting.findOneAndUpdate(
      { key },
      { $set: { key, value: group } },
      { upsert: true, new: true },
    );
  }
  return groups.length;
}

async function expandMonthlyPhotoPayload(stored) {
  const payload = { ...(stored?.payload || {}) };
  if (!stored?.imageSnapshotId) return payload; // legacy monthly snapshots stored their photos inline
  const docs = await Setting.find({}).lean();
  const chunks = docs
    .filter((doc) => String(doc.key || '').startsWith(MONTHLY_PHOTO_CHUNK_PREFIX)
      && doc.value?.snapshotId === stored.imageSnapshotId)
    .map((doc) => doc.value);
  payload[MONTHLY_PHOTO_SECTION] = assembleMonthlyPhotoAssets(chunks, {
    snapshotId: stored.imageSnapshotId,
    chunkCount: stored.imageChunkCount,
    imageCount: stored.imageCount,
  });
  return payload;
}

async function cleanOldMonthlyPhotoChunks(keepSnapshotId) {
  const docs = await Setting.find({}).lean();
  for (const doc of docs) {
    if (String(doc.key || '').startsWith(MONTHLY_PHOTO_CHUNK_PREFIX)
        && doc.value?.snapshotId !== keepSnapshotId) {
      await Setting.deleteMany({ key: doc.key });
    }
  }
}
const BACKUP_COLLECTIONS = [
  ['fields', Field],
  ['crops', Crop],
  ['finance', Finance],
  ['tasks', Task],
  ['inventory', Inventory],
  ['liabilities', Liability],
  ['irrigation', Irrigation],
  ['crop_photos', CropPhoto],
  ['diary_media', DiaryMedia],
  ['spray', Spray],
  ['laborers', Laborer],
  ['attendance', Attendance],
  ['labor_advances', LaborAdvance],
  ['suppliers', Supplier],
  ['supplier_payments', SupplierPayment],
  ['photo_assets', PhotoAsset],
];

// Mongoose documents must be converted before spreading. Spreading a document
// exposes its internals rather than its schema fields and can leak nested user hashes.
function stringifyDocs(docs) {
  return stringifyPlainBackupDocs(docs);
}

function currentAutoBackupName(now = new Date()) {
  return `auto-${now.toISOString().slice(0, 7)}`;
}

async function collectBackupPayload() {
  const payload = {};
  for (const [key, Model] of BACKUP_COLLECTIONS) {
    const docs = await Model.find({}).limit(100000);
    payload[key] = key === 'photo_assets' ? serializePhotoAssets(docs) : stringifyDocs(docs);
  }
  payload.farms = stringifyDocs(await Farm.find({}).limit(10000));
  // Archive models are regular Mongoose models, not memory-db models. In MEMORY_MODE
  // there is no Mongo connection, so querying them would buffer until timeout and
  // make even an ordinary full backup fail. The archive workflow itself is Mongo-backed.
  if (!MUF_ENV.memoryMode) {
    const ArchiveJob = mongoose.models.MufArchiveJob;
    const ArchiveRecord = mongoose.models.MufArchiveRecord;
    payload.archiveJobs = ArchiveJob ? stringifyDocs(await ArchiveJob.find({}).limit(100000)) : [];
    payload.archiveRecords = ArchiveRecord ? stringifyDocs(await ArchiveRecord.find({}).limit(100000)) : [];
  } else {
    payload.archiveJobs = [];
    payload.archiveRecords = [];
  }
  const usersList = await User.find({}).limit(100000);
  payload.users = stringifyBackupUsers(usersList);
  return payload;
}

async function restoreCollection(Model, data) {
  if (data == null) return false;
  const sourceData = Model === PhotoAsset ? restorePhotoAssets(data) : data;
  await Model.deleteMany({});
  if (!sourceData.length) return true;
  const prepared = [];
  for (const doc of sourceData) {
    const item = { ...doc };
    if (item._id) {
      if (/^[0-9a-fA-F]{24}$/.test(String(item._id))) {
        item._id = String(item._id);
      } else {
        delete item._id;
      }
    }
    prepared.push(item);
  }
  if (prepared.length) await Model.insertMany(prepared);
  return true;
}

async function applyBackupPayload(payload) {
  let restoredAny = false;
  await restoreMissingFarms(payload);
  for (const [key, Model] of BACKUP_COLLECTIONS) {
    if (key in payload) {
      await restoreCollection(Model, payload[key] || []);
      restoredAny = true;
    }
  }
  // Do not touch disconnected Mongoose archive models in memory demo mode.
  // Those collections are not backed by memory-db and the archive workflow is
  // unavailable there; querying them would hang until Mongoose's buffer timeout.
  if (!MUF_ENV.memoryMode) {
    for (const [key, modelName] of [['archiveJobs','MufArchiveJob'],['archiveRecords','MufArchiveRecord']]) {
      const Model = mongoose.models[modelName];
      if (Model && Array.isArray(payload[key])) {
        await Model.deleteMany({});
        if (payload[key].length) await Model.insertMany(payload[key]);
        restoredAny = true;
      }
    }
  }
  if (restoredAny) await tagAfterRestore();
  return restoredAny;
}

// Monthly auto-backup — snapshots the whole DB once per month into the
// settings collection and silently emails it to the admin (failures never
// block the backup itself).
async function maybeRunMonthlyAutoBackup(force = false) {
  const now = new Date();
  const name = currentAutoBackupName(now);
  const existing = await Setting.findOne({ key: MONTHLY_AUTO_BACKUP_KEY });
  const value = (existing && existing.value) || {};
  if (!force && value.name === name && value.payload) {
    return value;
  }
  const fullPayload = await collectBackupPayload();
  const photos = fullPayload[MONTHLY_PHOTO_SECTION] || [];
  const imageSnapshotId = new Date().toISOString().replace(/[^0-9A-Za-z]/g, '') + '_' + Math.random().toString(36).slice(2, 10);
  const imageChunkCount = await saveMonthlyPhotoChunks(imageSnapshotId, photos);
  const stored = {
    name,
    created_at: now.toISOString(),
    imageSnapshotId,
    imageChunkCount,
    imageCount: photos.length,
    payload: { ...fullPayload, [MONTHLY_PHOTO_SECTION]: [] },
  };
  await Setting.updateOne(
    { key: MONTHLY_AUTO_BACKUP_KEY },
    { $set: { value: stored } },
    { upsert: true },
  );
  await cleanOldMonthlyPhotoChunks(imageSnapshotId);
  console.log(`💾 [Auto Backup] Saved ${name}`);

  try {
    if (mailConfigured()) {
      const admin = await User.findOne({ role: { $in: MUF_FULL_ROLE_VALUES }, email: { $nin: [null, ''] } });
      const adminEmail = (admin || {}).email;
      if (adminEmail) {
        const sent = await sendEmail(
          adminEmail,
          `Usman Agri Farm — monthly backup ${name}`,
          mufEmail({
            title: `Monthly backup — ${name}`,
            bodyHtml: `<p style="margin:0;">Attached is the automatic monthly backup (<strong>${name}</strong>) of Usman Agri Farm. Keep this file safe — it can restore all farm data.</p>`,
          }),
          {
            filename: `${name}-agrifarm-backup.json`,
            content: JSON.stringify(await expandMonthlyPhotoPayload(stored), null, 2),
          },
        );
        if (sent) {
          stored.emailed_to = adminEmail;
          stored.emailed_at = new Date().toISOString();
          await Setting.updateOne(
            { key: MONTHLY_AUTO_BACKUP_KEY },
            { $set: { 'value.emailed_to': stored.emailed_to, 'value.emailed_at': stored.emailed_at } },
          );
          console.log(`📧 [Auto Backup] Emailed ${name} to ${adminEmail}`);
        }
      }
    }
  } catch (mailErr) {
    console.log(`[Auto Backup] Email failed: ${mailErr.message}`);
  }
  return stored;
}

function validateBackupPayload(payload) {
  // Reject malformed backup files BEFORE any collection is wiped.
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new HttpError(400, 'Backup file must be a JSON object.');
  }
  const knownKeys = BACKUP_COLLECTIONS.map(([k]) => k);
  const present = knownKeys.filter((k) => k in payload);
  if (!present.length) {
    throw new HttpError(400, "Backup has no valid data to restore. Expected keys like 'crops', 'finance', 'tasks'...");
  }

  // Validate every collection that the restore path can mutate, including the
  // auxiliary farm/archive collections. A malformed optional section must not
  // be silently skipped or partially applied during a database-wide restore.
  const mutableKeys = [...knownKeys, 'farms', 'archiveJobs', 'archiveRecords'];
  if (Array.isArray(payload.photo_assets)) restorePhotoAssets(payload.photo_assets);
  for (const key of mutableKeys.filter((k) => k in payload)) {
    const data = payload[key];
    if (!Array.isArray(data) || data.some((doc) => !doc || typeof doc !== 'object' || Array.isArray(doc))) {
      throw new HttpError(400, `Backup section '${key}' is malformed: expected a list of records. Restore aborted — nothing was changed.`);
    }
  }
  return present;
}

// ─── Routes ──────────────────────────────────────────────────────────────────
router.get('/backup', protectUnscoped, ...requireAdmin, asyncHandler(async (_req, res) => {
  return res.json(await collectBackupPayload());
}));

router.post('/restore', protectUnscoped, ...requireAdmin, asyncHandler(async (req, res) => {
  const payload = req.body || {};
  validateBackupPayload(payload);
  const restored = await withRestoreRecovery({
    createSnapshot: async () => {
      // Persist the rollback point before touching any source collection.
      const stored = await maybeRunMonthlyAutoBackup(true);
      return expandMonthlyPhotoPayload(stored);
    },
    restore: () => applyBackupPayload(payload),
    rollback: (snapshot) => applyBackupPayload(snapshot),
  });
  if (!restored) return badRequest(res, 'Backup has no valid data to restore');
  return res.json({ status: 'ok', recoverySnapshot: 'saved' });
}));

router.get('/backup/auto', protectUnscoped, ...requireAdmin, asyncHandler(async (_req, res) => {
  const existing = await Setting.findOne({ key: MONTHLY_AUTO_BACKUP_KEY });
  const value = (existing && existing.value) || {};
  if (!value.name) {
    return res.json({ exists: false, name: null, created_at: null });
  }
  return res.json({
    exists: true,
    name: value.name,
    created_at: value.created_at,
    emailed_to: value.emailed_to,
    emailed_at: value.emailed_at,
  });
}));

router.post('/restore/auto', protectUnscoped, ...requireAdmin, asyncHandler(async (req, res) => {
  const existing = await Setting.findOne({ key: MONTHLY_AUTO_BACKUP_KEY });
  const value = (existing && existing.value) || {};
  if (!value.payload) return notFound(res, 'No automatic monthly backup is stored yet.');
  const payload = await expandMonthlyPhotoPayload(value);
  validateBackupPayload(payload);
  await withRestoreRecovery({
    createSnapshot: async () => {
      // Capture the current state first. The target payload is already held in
      // memory, so refreshing the monthly slot does not lose the requested restore.
      const stored = await maybeRunMonthlyAutoBackup(true);
      return expandMonthlyPhotoPayload(stored);
    },
    restore: () => applyBackupPayload(payload),
    rollback: (snapshot) => applyBackupPayload(snapshot),
  });
  return res.json({ status: 'ok', name: value.name, recoverySnapshot: 'saved' });
}));

export { maybeRunMonthlyAutoBackup };
export default router;
