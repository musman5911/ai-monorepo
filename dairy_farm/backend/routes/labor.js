// Field labor — named wage workers (NOT app logins) + daily attendance +
// month-end wage posting into the Expenses ledger (type 'labor').
// Cloned from agri_farm's Field Labor module; the wage math twin lives in
// client/src/muf-labor.ts (same file in flock, JS twin in agri).
import { randomUUID } from 'crypto';
import express from 'express';
const router = express.Router();
import { Laborer, LaborAttendance, LaborAdvance, Expense } from '../db.js';
import { withFinancialTransaction } from '../db.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { todayStr } from '../utils/date.js';
import { mufLaborAttendanceId } from '../utils/attendance-id.mjs';
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
    let result;
    try {
      result = await withFinancialTransaction([LaborAttendance], async (session) => {
        const options = session ? { session } : {};
        const query = LaborAttendance.find({ workerId, date }).limit(2);
        const rows = await (session ? query.session(session) : query);
        if (rows.length > 1) return { kind: 'duplicate_history' };
        if (rows.length === 1) {
          const existing = rows[0];
          if (existing.posted) return { kind: 'posted' };
          const update = await LaborAttendance.updateOne(
            { _id: existing._id, posted: { $ne: true } },
            { $set: { dayType, notes: notes || '' } },
            options,
          );
          if (!update.matchedCount) return { kind: 'posted' };
          const updatedQuery = LaborAttendance.findById(existing._id);
          const updated = await (session ? updatedQuery.session(session) : updatedQuery);
          return { kind: 'ok', doc: updated };
        }
        const doc = (await LaborAttendance.insertMany([{
          _id: mufLaborAttendanceId(workerId, date),
          workerId, date, dayType, posted: false, notes: notes || '',
        }], options))[0];
        return { kind: 'ok', doc };
      });
    } catch (error) {
      // Another server instance can win the deterministic attendance key.
      if (error?.code !== 11000) throw error;
      const raced = await LaborAttendance.find({ workerId, date }).limit(2);
      if (raced.length > 1) return res.status(409).json({ error: 'Duplicate attendance history exists for this worker and date. Resolve it before editing or posting wages.' });
      if (raced.length === 1 && !raced[0].posted) {
        const update = await LaborAttendance.updateOne(
          { _id: raced[0]._id, posted: { $ne: true } },
          { $set: { dayType, notes: notes || '' } },
        );
        if (update.matchedCount) return res.json({ ...raced[0], dayType, notes: notes || '' });
      }
      if (raced.length === 1) return res.status(400).json({ error: 'This day is already posted to the wages ledger.' });
      throw error;
    }
    if (result.kind === 'duplicate_history') return res.status(409).json({ error: 'Duplicate attendance history exists for this worker and date. Resolve it before editing or posting wages.' });
    if (result.kind === 'posted') return res.status(400).json({ error: 'This day is already posted to the wages ledger.' });
    res.status(201).json(result.doc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/attendance/:id', protect, adminOnly, async (req, res) => {
  try {
    const errors = [];
    const doc = await LaborAttendance.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Attendance not found' });
    if (doc.posted) return res.status(400).json({ error: 'This day is already posted to the wages ledger.' });
    const changes = {};
    if (req.body.dayType !== undefined) changes.dayType = readEnum(req.body || {}, 'dayType', ['full', 'half'], errors) || doc.dayType;
    if (req.body.notes !== undefined) changes.notes = readString(req.body || {}, 'notes', errors) || '';
    if (req.body.date !== undefined) {
      const nextDate = readDate(req.body || {}, 'date', errors);
      if (nextDate && nextDate !== doc.date) {
        const clashes = await LaborAttendance.find({ workerId: doc.workerId, date: nextDate, _id: { $ne: doc._id } }).limit(2);
        if (clashes.length) return res.status(409).json({ error: 'Duplicate entry', message: 'This worker already has attendance on that date.' });
        changes.date = nextDate;
      }
    }
    if (errors.length) return sendValidationError(res, errors);
    try {
      const result = await LaborAttendance.updateOne(
        { _id: doc._id, posted: { $ne: true } },
        { $set: changes },
      );
      if (!result.matchedCount) return res.status(400).json({ error: 'This day is already posted to the wages ledger.' });
    } catch (error) {
      if (error?.code === 11000) return res.status(409).json({ error: 'Duplicate entry', message: 'This worker already has attendance on that date.' });
      throw error;
    }
    const updated = await LaborAttendance.findById(doc._id);
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/attendance/:id', protect, adminOnly, async (req, res) => {
  try {
    const row = await LaborAttendance.findById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Attendance row not found' });
    if (row.posted) return res.status(400).json({ error: 'Posted attendance cannot be deleted. Remove the wage expense first if needed.' });
    const removed = await LaborAttendance.deleteOne({ _id: row._id, posted: { $ne: true } });
    if (!removed.deletedCount) return res.status(400).json({ error: 'Posted attendance cannot be deleted. Remove the wage expense first if needed.' });
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

    const result = await withFinancialTransaction([LaborAttendance, Laborer, LaborAdvance, Expense], async (session) => {
      const options = session ? { session } : {};
      const attendanceQuery = LaborAttendance.find();
      const all = await (session ? attendanceQuery.session(session) : attendanceQuery);
      const rows = all.filter((row) => String(row.date || '').startsWith(month) && !row.posted);
      if (!rows.length) return { kind: 'no_rows' };
      const attendanceDays = new Set();
      for (const row of rows) {
        const key = `${String(row.workerId)}:${String(row.date)}`;
        if (attendanceDays.has(key)) return { kind: 'duplicate_attendance' };
        attendanceDays.add(key);
      }

      const workersQuery = Laborer.find();
      const workers = await (session ? workersQuery.session(session) : workersQuery);
      const byId = new Map(workers.map((worker) => [worker._id, worker]));

      const lines = [];
      let total = 0;
      const byWorker = new Map();
      for (const row of rows) {
        if (!byWorker.has(row.workerId)) byWorker.set(row.workerId, []);
        byWorker.get(row.workerId).push(row);
      }
      for (const [workerId, group] of byWorker) {
        const worker = byId.get(workerId) || { name: 'Worker', dailyWage: 0 };
        const days = group.reduce((sum, row) => sum + rowUnits(row), 0);
        const wage = Number(worker.dailyWage) || 0;
        total += days * wage;
        lines.push(`${worker.name} ${days}d × Rs. ${wage}`);
      }
      total = Math.round(total * 100) / 100;
      if (total <= 0) return { kind: 'zero_total' };

      const advancesQuery = LaborAdvance.find();
      const allAdvances = await (session ? advancesQuery.session(session) : advancesQuery);
      const openAdvances = allAdvances.filter((advance) => !advance.settled);
      const advanceTotal = Math.round(openAdvances.reduce((sum, advance) => sum + (Number(advance.amount) || 0), 0) * 100) / 100;
      const advNote = advanceTotal > 0
        ? ` (advance already paid Rs. ${advanceTotal}; cash payable now Rs. ${Math.max(0, Math.round((total - advanceTotal) * 100) / 100)})`
        : '';

      const expense = (await Expense.insertMany([{
        _id: 'e-wages-' + month + '-' + randomUUID(),
        cowId: null,
        date: `${month}-28`,
        type: 'labor',
        amount: total,
        note: `Monthly labor wages ${month}: ${lines.join('; ')}${advNote}`,
      }], options))[0];

      const attendanceIds = rows.map((row) => row._id);
      const posted = await LaborAttendance.updateMany(
        { _id: { $in: attendanceIds }, posted: { $ne: true } },
        { $set: { posted: true, expenseId: String(expense._id) } },
        options,
      );
      const postedCount = posted.matchedCount ?? posted.modifiedCount ?? 0;
      if (postedCount !== attendanceIds.length) {
        throw new Error('Attendance changed during wage posting. The expense transaction was rolled back; retry the posting.');
      }

      if (openAdvances.length) {
        const advanceIds = openAdvances.map((advance) => advance._id);
        const settled = await LaborAdvance.updateMany(
          { _id: { $in: advanceIds }, settled: { $ne: true } },
          { $set: { settled: true } },
          options,
        );
        const settledCount = settled.matchedCount ?? settled.modifiedCount ?? 0;
        if (settledCount !== advanceIds.length) {
          throw new Error('Labor advances changed during wage posting. The expense transaction was rolled back; retry the posting.');
        }
      }

      return { kind: 'ok', amount: total, note: expense.note };
    });

    if (result.kind === 'no_rows') return res.status(400).json({ error: 'No unposted attendance remains for this month.' });
    if (result.kind === 'duplicate_attendance') return res.status(409).json({ error: 'Duplicate worker/day attendance exists in this month. Resolve the duplicate rows before posting wages.' });
    if (result.kind === 'zero_total') return res.status(400).json({ error: 'Wage total is 0. Set daily wages on workers first.' });
    res.json({ ok: true, amount: result.amount, note: result.note });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
