import express from 'express';
const router = express.Router();
import mongoose from 'mongoose';
import { Cow, Milk, Expense, Rate, Health, Buyer, BuyerPayment, RateHistory, DailyLog, Sale, Meta, Laborer, LaborAttendance, LaborAdvance, Supplier, SupplierPayment, BreedingEvent, User, Farm, ArchiveJob, ArchiveRecord, MUF_FARM_MODELS, MUF_FARM_SCOPED_NAMES } from '../db.js';
import { protectUnscoped, ownerOnly } from '../middleware/auth.js';
import { mufRunUnscoped, mufMigrateFarms, MUF_FULL_ROLE_VALUES } from '../muf-farms.mjs';

// A backup covers every farm of this project, so only owners may take or restore
// one, and the handlers run outside any single-farm scope.
const adminOnly = [ownerOnly, (_req, _res, next) => mufRunUnscoped(() => next())];

// Old backups have no farmId: tag whatever is untagged with the default farm.
const tagAfterRestore = () => mufMigrateFarms({ Farm, User, models: MUF_FARM_MODELS, names: MUF_FARM_SCOPED_NAMES });

// Restore farms that exist in the backup but not in the database (same ids).
async function restoreMissingFarms(payload) {
  if (!Array.isArray(payload?.farms)) return;
  for (const f of payload.farms) {
    if (f && f._id && !(await Farm.findById(String(f._id)))) {
      await Farm.create({ _id: f._id, name: f.name || 'Farm', location: f.location || '', archived: Boolean(f.archived) });
    }
  }
}
import { sendMail, mailConfigured, mufEmail } from '../utils/mailer.js';
import { MUF_ENV } from '../muf-env.mjs';

// GET /api/backup — download full database as JSON
router.get('/', protectUnscoped, ...adminOnly, async (req, res) => {
  try {
    const [cows, milk, expenses, rates, health, buyers, buyerPayments, rateHistory, dailyLogs, sales, laborers, laborAttendance, laborAdvances, suppliers, supplierPayments, breedingEvents] = await Promise.all([
      Cow.find().lean(),
      Milk.find().lean(),
      Expense.find().lean(),
      Rate.find().lean(),
      Health.find().lean(),
      Buyer.find().lean(),
      BuyerPayment.find().lean(),
      RateHistory.find().lean(),
      DailyLog.find().lean(),
      Sale.find().lean(),
      Laborer.find().lean(),
      LaborAttendance.find().lean(),
      LaborAdvance.find().lean(), Supplier.find().lean(), SupplierPayment.find().lean(), BreedingEvent.find().lean(),
    ]);
    const farms = await Farm.find().lean();
    const backup = {
      exportDate: new Date().toISOString(),
      farmName: 'Usman Dairy Farm',
      version: 4,
      farms,
      cows, milk, expenses, rates, health, buyers, buyerPayments, rateHistory, dailyLogs, sales, laborers, laborAttendance, laborAdvances, suppliers, supplierPayments, breedingEvents,
      archiveJobs: await ArchiveJob.find().lean(), archiveRecords: await ArchiveRecord.find().lean()
    };
    res.setHeader('Content-Disposition', `attachment; filename=usman-dairy-backup-${new Date().toISOString().slice(0,10)}.json`);
    res.setHeader('Content-Type', 'application/json');
    res.json(backup);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const COLLECTIONS = {
  cows: Cow,
  milk: Milk,
  expenses: Expense,
  rates: Rate,
  health: Health,
  buyers: Buyer,
  buyerPayments: BuyerPayment,
  rateHistory: RateHistory,
  dailyLogs: DailyLog,
  sales: Sale,
  laborers: Laborer,
  laborAttendance: LaborAttendance,
  laborAdvances: LaborAdvance,
  suppliers: Supplier,
  supplierPayments: SupplierPayment,
  breedingEvents: BreedingEvent,
  archiveJobs: ArchiveJob,
  archiveRecords: ArchiveRecord,
};

async function restoreCollections(payload, session) {
  const opts = session ? { session } : {};
  for (const [key, Model] of Object.entries(COLLECTIONS)) {
    const data = payload[key];
    // Only touch collections that are present AND are arrays with content intent.
    // Empty array still means "clear this collection" when the key is present.
    if (data === undefined || !Array.isArray(data)) continue;
    await Model.deleteMany({}, opts);
    if (data.length > 0) {
      // insertMany in chunks to avoid huge single ops
      const chunkSize = 500;
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        await Model.insertMany(chunk, { ...opts, ordered: false });
      }
    }
  }
}

// POST /api/backup/restore — restore from JSON backup
// Uses a transaction when the deployment supports it (replica set / Atlas).
// Falls back to sequential restore on standalone MongoDB.
router.post('/restore', protectUnscoped, ...adminOnly, async (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Invalid backup payload' });
  }

  for (const key of Object.keys(COLLECTIONS)) {
    const val = payload[key];
    if (val !== undefined && !Array.isArray(val)) {
      return res.status(400).json({ error: `"${key}" must be an array if present` });
    }
  }

  const hasData = Object.keys(COLLECTIONS).some(key => Array.isArray(payload[key]) && payload[key].length > 0);
  if (!hasData) {
    return res.status(400).json({ error: 'Backup contains no data to restore' });
  }

  // Prefer atomic transaction; fall back for standalone Mongo / memory mode.
  // IMPORTANT: startSession() must live INSIDE the try — in memory mode there
  // is no Mongo connection, it throws after a buffering timeout, and an
  // unhandled rejection here used to CRASH the whole server.
  let session = null;
  try {
    let usedTransaction = false;

    if (!MUF_ENV.memoryMode && mongoose.connection.readyState === 1) {
      try { session = await mongoose.startSession(); } catch { session = null; }
    }

    await restoreMissingFarms(payload);
    if (session) {
      try {
        await session.withTransaction(async () => {
          await restoreCollections(payload, session);
        });
        usedTransaction = true;
      } catch (txErr) {
        const msg = String(txErr?.message || txErr || '');
        const noTxn =
          msg.includes('Transaction numbers are only allowed') ||
          msg.includes('replica set') ||
          msg.includes('not supported') ||
          txErr?.code === 20 ||
          txErr?.codeName === 'IllegalOperation';

        if (!noTxn) throw txErr;

        // Standalone fallback — not atomic, but functional
        console.warn('Backup restore: transactions unavailable, using sequential restore.');
        await restoreCollections(payload, null);
      }
    } else {
      // Memory mode / not connected: plain sequential restore.
      await restoreCollections(payload, null);
    }

    await tagAfterRestore();
    res.json({
      success: true,
      message: usedTransaction
        ? 'Data restored successfully (atomic)'
        : 'Data restored successfully (sequential)',
    });
  } catch (e) {
    res.status(500).json({ error: `Restore failed: ${e.message}` });
  } finally {
    if (session) session.endSession();
  }
});


// ─── Monthly Auto-Backup ──────────────────────────
// Once per calendar month a full snapshot of the database is stored inside
// the DB itself (Meta collection) under the name auto-YYYY-MM. It runs at
// server boot; if this month's snapshot already exists nothing happens.
const MONTHLY_AUTO_BACKUP_KEY = 'monthly_auto_backup';

async function collectBackupPayload() {
  const [cows, milk, expenses, rates, health, buyers, buyerPayments, rateHistory, dailyLogs, sales, laborers, laborAttendance, laborAdvances, suppliers, supplierPayments, breedingEvents] = await Promise.all([
    Cow.find().lean(), Milk.find().lean(), Expense.find().lean(), Rate.find().lean(),
    Health.find().lean(), Buyer.find().lean(), BuyerPayment.find().lean(), RateHistory.find().lean(), DailyLog.find().lean(), Sale.find().lean(),
    Laborer.find().lean(), LaborAttendance.find().lean(), LaborAdvance.find().lean(), Supplier.find().lean(), SupplierPayment.find().lean(), BreedingEvent.find().lean(),
  ]);
  const farms = await Farm.find().lean();
  return {
    farms,
    exportDate: new Date().toISOString(),
    farmName: 'Usman Dairy Farm',
    version: 3,
    cows, milk, expenses, rates, health, buyers, buyerPayments, rateHistory, dailyLogs, sales, laborers, laborAttendance, laborAdvances, suppliers, supplierPayments, breedingEvents, archiveJobs: await ArchiveJob.find().lean(), archiveRecords: await ArchiveRecord.find().lean(),
  };
}

function currentAutoBackupName(now = new Date()) {
  return `auto-${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function maybeRunMonthlyAutoBackup(force = false) {
  const name = currentAutoBackupName();
  const existing = await Meta.findOne({ key: MONTHLY_AUTO_BACKUP_KEY });
  const value = (existing && existing.value) || {};
  if (!force && value.name === name && value.payload) return value;
  const stored = {
    name,
    createdAt: new Date().toISOString(),
    payload: await collectBackupPayload(),
  };
  await Meta.findOneAndUpdate(
    { key: MONTHLY_AUTO_BACKUP_KEY },
    { $set: { key: MONTHLY_AUTO_BACKUP_KEY, value: stored } },
    { upsert: true, new: true }
  );
  console.log(`💾 [Auto Backup] Saved ${name}`);

  // Silently email the snapshot to the admin so a copy lives OUTSIDE the
  // database. Failures never block the backup itself.
  try {
    if (mailConfigured()) {
      const admin = await User.findOne({ role: { $in: MUF_FULL_ROLE_VALUES }, email: { $nin: [null, ''] } });
      if (admin && admin.email) {
        await sendMail({
          to: admin.email,
          subject: `Usman Dairy Farm — monthly backup ${name}`,
          text: `Attached is the automatic monthly backup (${name}) of Usman Dairy Farm.`,
          html: mufEmail({
            title: `Monthly backup — ${name}`,
            bodyHtml: `<p style="margin:0;">Attached is the automatic monthly backup (<strong>${name}</strong>) of Usman Dairy Farm. Keep this file safe — it can restore all farm data.</p>`,
          }),
          attachments: [{
            filename: `${name}-dairyfarm-backup.json`,
            content: JSON.stringify(stored.payload, null, 2),
            contentType: 'application/json',
          }],
        });
        stored.emailedTo = admin.email;
        stored.emailedAt = new Date().toISOString();
        await Meta.findOneAndUpdate(
          { key: MONTHLY_AUTO_BACKUP_KEY },
          { $set: { 'value.emailedTo': stored.emailedTo, 'value.emailedAt': stored.emailedAt } }
        );
        console.log(`📧 [Auto Backup] Emailed ${name} to ${admin.email}`);
      }
    }
  } catch (mailErr) {
    console.error('[Auto Backup] Email failed:', mailErr.message);
  }
  return stored;
}

// GET /api/backup/auto — info + payload of the stored monthly auto-backup
router.get('/auto', protectUnscoped, ...adminOnly, async (_req, res) => {
  try {
    const existing = await Meta.findOne({ key: MONTHLY_AUTO_BACKUP_KEY });
    const value = (existing && existing.value) || null;
    if (!value || !value.payload) return res.json({ available: false });
    res.json({ available: true, name: value.name, createdAt: value.createdAt, emailedTo: value.emailedTo || null, emailedAt: value.emailedAt || null, payload: value.payload });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/backup/auto/run — force-refresh this month's snapshot now
router.post('/auto/run', protectUnscoped, ...adminOnly, async (_req, res) => {
  try {
    const stored = await maybeRunMonthlyAutoBackup(true);
    res.json({ ok: true, name: stored.name, createdAt: stored.createdAt });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/backup/restore-auto — restore the DB from the monthly auto-backup
router.post('/restore-auto', protectUnscoped, ...adminOnly, async (_req, res) => {
  try {
    const existing = await Meta.findOne({ key: MONTHLY_AUTO_BACKUP_KEY });
    const value = (existing && existing.value) || null;
    if (!value || !value.payload) return res.status(404).json({ error: 'No auto-backup available yet' });
    await restoreMissingFarms(value.payload);
    await restoreCollections(value.payload, null);
    await tagAfterRestore();
    res.json({ success: true, message: `Restored from ${value.name}` });
  } catch (e) { res.status(500).json({ error: `Restore failed: ${e.message}` }); }
});

export default router;
export { maybeRunMonthlyAutoBackup };

