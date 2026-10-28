// Field labor — named wage workers (NOT app logins) + daily attendance +
// month-end wage posting into the Expenses ledger (type 'labor').
// Cloned from agri_farm's Field Labor module; the wage math twin lives in
// client/src/muf-labor.ts (same file in flock, JS twin in agri).
import { randomUUID } from 'crypto';
import express from 'express';
const router = express.Router();
import { Laborer, LaborAttendance, LaborAdvance, Expense } from '../db.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { todayStr } from '../utils/date.js';
import {
  readString,
  readDate,
  readNonNegativeNumber,
  readEnum,
  sendValidationError,
} from './input.js';

const HALF_DAY_UNITS = 0.5; // must match muf-labor twins
const rowUnits = (row) => (row.dayType === 'half' ? HALF_DAY_UNITS : 1);

// ─── Workers ────────────────────────────────────────────────────────────────

router.get('/workers', protect, adminOnly, async (_req, res) => {
  try {
    res.json(await Laborer.find());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/workers', protect, adminOnly, async (req, res) => {
  try {
    const errors = [];
    const name = readString(req.body || {}, 'name', errors, { required: true });
    const dailyWage = readNonNegativeNumber(req.body || {}, 'dailyWage', errors);
    const notes = readString(req.body || {}, 'notes', errors);
    if (!name || !String(name).trim()) errors.push('name is required');
    if (errors.length) return sendValidationError(res, errors);
    const doc = await Laborer.create({
      _id: 'lw' + Date.now() + '-' + randomUUID().slice(0, 6),
      name: String(name).trim(),
      dailyWage: dailyWage || 0,
      notes: notes || '',
    });
    res.status(201).json(doc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/workers/:id', protect, adminOnly, async (req, res) => {
  try {
    const errors = [];
    const name = readString(req.body || {}, 'name', errors, { required: true });
    const dailyWage = readNonNegativeNumber(req.body || {}, 'dailyWage', errors);
    const notes = readString(req.body || {}, 'notes', errors);
    if (!name || !String(name).trim()) errors.push('name is required');
    if (errors.length) return sendValidationError(res, errors);
    const doc = await Laborer.findByIdAndUpdate(
      req.params.id,
      { name: String(name).trim(), dailyWage: dailyWage || 0, notes: notes || '' },
      { new: true },
    );
    if (!doc) return res.status(404).json({ error: 'Worker not found' });
    res.json(doc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/workers/:id', protect, adminOnly, async (req, res) => {
  try {
    const doc = await Laborer.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Worker not found' });
    // Keep posted history (it backs a ledger entry); drop unposted rows.
    await LaborAttendance.deleteMany({ workerId: req.params.id, posted: false });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Attendance ─────────────────────────────────────────────────────────────

router.get('/attendance', protect, adminOnly, async (req, res) => {
  try {
    const month = String(req.query.month || '').slice(0, 7);
    const rows = await LaborAttendance.find();
    res.json(month ? rows.filter((r) => String(r.date || '').startsWith(month)) : rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/attendance', protect, adminOnly, async (req, res) => {
  try {
    const errors = [];
    const workerId = readString(req.body || {}, 'workerId', errors, { required: true });
    const date = readDate(req.body || {}, 'date', errors) || todayStr();
    const dayType = readEnum(req.body || {}, 'dayType', ['full', 'half'], errors) || 'full';
    const notes = readString(req.body || {}, 'notes', errors);
    if (errors.length) return sendValidationError(res, errors);

    const worker = await Laborer.findById(workerId);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    // Upsert by worker+date — one attendance row per worker per day.
    const all = await LaborAttendance.find();
    const existing = all.find((r) => r.workerId === workerId && r.date === date);
    if (existing) {
      if (existing.posted) return res.status(400).json({ error: 'This day is already posted to the wages ledger.' });
      existing.dayType = dayType;
      existing.notes = notes || '';
      await existing.save();
      return res.json(existing);
    }
    const doc = await LaborAttendance.create({
      _id: 'la' + Date.now() + '-' + randomUUID().slice(0, 6),
      workerId,
      date,
      dayType,
      posted: false,
      notes: notes || '',
    });
    res.status(201).json(doc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/attendance/:id', protect, adminOnly, async (req, res) => {
  try {
    const errors = [];
    const doc = await LaborAttendance.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Attendance not found' });
    if (doc.posted) return res.status(400).json({ error: 'This day is already posted to the wages ledger.' });
    if (req.body.dayType !== undefined) doc.dayType = readEnum(req.body || {}, 'dayType', ['full', 'half'], errors) || doc.dayType;
    if (req.body.notes !== undefined) doc.notes = readString(req.body || {}, 'notes', errors) || '';
    if (req.body.date !== undefined) {
      const nextDate = readDate(req.body || {}, 'date', errors);
      if (nextDate && nextDate !== doc.date) {
        const clash = (await LaborAttendance.find()).find((r) => r.workerId === doc.workerId && r.date === nextDate && r._id !== doc._id);
        if (clash) return res.status(409).json({ error: 'Duplicate entry', message: 'This worker already has attendance on that date.' });
        doc.date = nextDate;
      }
    }
    if (errors.length) return sendValidationError(res, errors);
    await doc.save();
    res.json(doc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/attendance/:id', protect, adminOnly, async (req, res) => {
  try {
    const row = await LaborAttendance.findById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Attendance row not found' });
    if (row.posted) return res.status(400).json({ error: 'Posted attendance cannot be deleted. Remove the wage expense first if needed.' });
    await LaborAttendance.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Wage advances (udhaar to workers) ─────────────────────────────────────
// An advance is EARLY payment of the same wages — it is NOT logged as its own
// expense (the month-end wage posting covers the full gross amount).

router.get('/advances', protect, adminOnly, async (_req, res) => {
  try {
    res.json(await LaborAdvance.find());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/advances', protect, adminOnly, async (req, res) => {
  try {
    const errors = [];
    const workerId = readString(req.body || {}, 'workerId', errors, { required: true });
    const date = readDate(req.body || {}, 'date', errors) || todayStr();
    const amount = readNonNegativeNumber(req.body || {}, 'amount', errors, { required: true });
    const notes = readString(req.body || {}, 'notes', errors);
    if (!(amount > 0)) errors.push('amount must be greater than 0');
    if (errors.length) return sendValidationError(res, errors);
    const worker = await Laborer.findById(workerId);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    const doc = await LaborAdvance.create({
      _id: 'lv' + Date.now() + '-' + randomUUID().slice(0, 6),
      workerId, date, amount, settled: false, notes: notes || '',
    });
    res.status(201).json(doc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/advances/:id', protect, adminOnly, async (req, res) => {
  try {
    const errors = [];
    const doc = await LaborAdvance.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Advance not found' });
    if (doc.settled) return res.status(400).json({ error: 'This advance is already settled in the wages ledger.' });
    if (req.body.date !== undefined) {
      const date = readDate(req.body || {}, 'date', errors);
      if (date) doc.date = date;
    }
    if (req.body.amount !== undefined) {
      const amount = readNonNegativeNumber(req.body || {}, 'amount', errors, { required: true });
      if (!(amount > 0)) return res.status(400).json({ error: 'Amount must be greater than 0' });
      doc.amount = amount;
    }
    if (req.body.notes !== undefined) doc.notes = readString(req.body || {}, 'notes', errors) || '';
    if (errors.length) return sendValidationError(res, errors);
    await doc.save();
    res.json(doc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/advances/:id', protect, adminOnly, async (req, res) => {
  try {
    const row = await LaborAdvance.findById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Advance not found' });
    if (row.settled) return res.status(400).json({ error: 'Settled advances cannot be deleted.' });
    await LaborAdvance.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Month-end wage posting ────────────────────────────────────────────────
// Turns all unposted attendance of a month into ONE labor Expense and marks
// the rows posted — same wording as agri's post-wages endpoint.

router.post('/post-wages', protect, adminOnly, async (req, res) => {
  try {
    const month = String((req.body && req.body.month) || todayStr().slice(0, 7)).trim();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return res.status(400).json({ error: 'Month must be a valid YYYY-MM value.' });

    const all = await LaborAttendance.find();
    const rows = all.filter((r) => String(r.date || '').startsWith(month) && !r.posted);
    if (!rows.length) return res.status(400).json({ error: 'No unposted attendance remains for this month.' });

    const workers = await Laborer.find();
    const byId = new Map(workers.map((w) => [w._id, w]));

    const lines = [];
    let total = 0;
    const byWorker = new Map();
    for (const row of rows) {
      if (!byWorker.has(row.workerId)) byWorker.set(row.workerId, []);
      byWorker.get(row.workerId).push(row);
    }
    for (const [wid, group] of byWorker) {
      const worker = byId.get(wid) || { name: 'Worker', dailyWage: 0 };
      const days = group.reduce((s, r) => s + rowUnits(r), 0);
      const wage = Number(worker.dailyWage) || 0;
      total += days * wage;
      lines.push(`${worker.name} ${days}d × Rs. ${wage}`);
    }
    total = Math.round(total * 100) / 100;
    if (total <= 0) return res.status(400).json({ error: 'Wage total is 0. Set daily wages on workers first.' });

    // Advances already paid out are settled by this posting — the ledger
    // amount stays the GROSS wages (the advance was part of the same money).
    const allAdvances = await LaborAdvance.find();
    const openAdvances = allAdvances.filter((a) => !a.settled);
    const advanceTotal = Math.round(openAdvances.reduce((s, a) => s + (Number(a.amount) || 0), 0) * 100) / 100;
    const advNote = advanceTotal > 0
      ? ` (advance already paid Rs. ${advanceTotal}; cash payable now Rs. ${Math.max(0, Math.round((total - advanceTotal) * 100) / 100)})`
      : '';

    const expense = await Expense.create({
      _id: 'e-wages-' + month + '-' + Date.now(),
      cowId: null,
      date: `${month}-28`,
      type: 'labor',
      amount: total,
      note: `Monthly labor wages ${month}: ${lines.join('; ')}${advNote}`,
    });
    for (const row of rows) {
      row.posted = true;
      row.expenseId = expense._id;
      await row.save();
    }
    for (const adv of openAdvances) {
      adv.settled = true;
      await adv.save();
    }
    res.json({ ok: true, amount: total, note: expense.note });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
