import { randomUUID } from 'crypto';
import express from 'express';
const router = express.Router();
import { Health, Expense } from '../db.js';
import { protect, adminOnly, workerOrAdmin } from '../middleware/auth.js';
import { todayStr, daysAgoStr } from '../utils/date.js';
import {
  readString,
  readDate,
  readNonNegativeNumber,
  readEnum,
  sendValidationError,
} from './input.js';

function healthPayload(body, { requireBasics = false } = {}) {
  const errors = [];
  const payload = {};

  const cowId = readString(body, 'cowId', errors, { required: requireBasics, allowEmpty: false });
  if (cowId !== undefined) payload.cowId = cowId;
  const date = readDate(body, 'date', errors, { required: requireBasics });
  if (date !== undefined) payload.date = date;
  const type = readEnum(body, 'type', ['vaccination', 'treatment', 'checkup', 'deworming', 'other'], errors, { required: requireBasics });
  if (type !== undefined) payload.type = type;
  const description = readString(body, 'description', errors, { required: requireBasics, allowEmpty: false });
  if (description !== undefined) payload.description = description;

  ['medicine', 'vet', 'notes'].forEach((field) => {
    const value = readString(body, field, errors);
    if (value !== undefined) payload[field] = value;
  });
  const nextDueDate = readDate(body, 'nextDueDate', errors);
  if (nextDueDate !== undefined) payload.nextDueDate = nextDueDate;
  const cost = readNonNegativeNumber(body, 'cost', errors);
  if (cost !== undefined) payload.cost = cost;

  return { payload, errors };
}

router.get('/', protect, async (req, res) => {
  try {
    const filter = {};
    if (req.query.cowId) filter.cowId = req.query.cowId;
    if (req.query.type) filter.type = req.query.type;
    res.json(await Health.find(filter).sort({ date: -1 }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get upcoming/overdue records
router.get('/upcoming', protect, async (req, res) => {
  try {
    // daysAgoStr(-30) = 30 days ahead in farm TZ
    const today = todayStr();
    const in30ISO = daysAgoStr(-30);
    const records = await Health.find({
      nextDueDate: { $exists: true, $ne: '', $lte: in30ISO }
    }).sort({ nextDueDate: 1 });
    res.json(records);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/bulk', protect, workerOrAdmin, async (req, res) => {
  try {
    const rows = req.body?.entries;
    if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'entries must be a non-empty array' });
    if (rows.length > 200) return res.status(413).json({ error: 'bulk request is limited to 200 entries' });

    const normalized = [];
    const errors = [];
    rows.forEach((row, index) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        errors.push(`row ${index + 1}: entry must be an object`);
        return;
      }
      const { payload, errors: rowErrors } = healthPayload(row, { requireBasics: true });
      if (rowErrors.length) errors.push(`row ${index + 1}: ${rowErrors.join(', ')}`);
      normalized.push({ index, payload });
    });
    if (errors.length) return res.status(400).json({ error: errors.join('; '), errors });

    const results = [];
    for (const row of normalized) {
      try {
        const id = randomUUID();
        const record = await Health.create({ ...row.payload, _id: id });
        if (row.payload.cost && row.payload.cost > 0) {
          const expenseNote = `${row.payload.type}: ${row.payload.description}${row.payload.medicine ? ' — ' + row.payload.medicine : ''}`;
          await Expense.create({
            _id: randomUUID(),
            cowId: row.payload.cowId || null,
            date: row.payload.date,
            type: 'medicine',
            amount: row.payload.cost,
            note: expenseNote,
            _healthId: id,
          });
        }
        results.push({ index: row.index, ok: true, record });
      } catch {
        results.push({ index: row.index, ok: false, error: 'Could not save this health row' });
      }
    }
    const saved = results.filter((row) => row.ok).length;
    const failed = results.length - saved;
    res.status(failed ? 207 : 200).json({ saved, failed, results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', protect, workerOrAdmin, async (req, res) => {
  try {
    const { payload, errors } = healthPayload(req.body, { requireBasics: true });
    if (errors.length) return sendValidationError(res, errors);

    const id = randomUUID();
    const record = await Health.create({ ...payload, _id: id });

    // Auto-create expense if cost > 0
    if (payload.cost && payload.cost > 0) {
      const expId = randomUUID();
      const expenseNote = `${payload.type}: ${payload.description}${payload.medicine ? ' — ' + payload.medicine : ''}`;
      await Expense.create({
        _id: expId,
        cowId: payload.cowId || null,
        date: payload.date,
        type: 'medicine',
        amount: payload.cost,
        note: expenseNote,
        _healthId: id,
      });
    }

    res.status(201).json(record);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', protect, workerOrAdmin, async (req, res) => {
  try {
    const { payload, errors } = healthPayload(req.body);
    if (errors.length) return sendValidationError(res, errors);

    const record = await Health.findByIdAndUpdate(req.params.id, { $set: payload }, { new: true });
    if (!record) return res.status(404).json({ error: 'Not found' });

    // Find linked expense
    const existingExp = await Expense.findOne({ _healthId: req.params.id });

    // ── Handle cost changes ─────────────────────────────────
    if (payload.cost !== undefined) {
      if (payload.cost > 0) {
        const expenseNote = `${record.type}: ${record.description}${record.medicine ? ' — ' + record.medicine : ''}`;
        if (existingExp) {
          existingExp.amount = payload.cost;
          existingExp.cowId = record.cowId || null;
          existingExp.date = record.date;
          existingExp.note = expenseNote;
          await existingExp.save();
        } else {
          await Expense.create({
            _id: randomUUID(),
            cowId: record.cowId || null,
            date: record.date,
            type: 'medicine',
            amount: payload.cost,
            note: expenseNote,
            _healthId: req.params.id,
          });
        }
      } else if (existingExp) {
        // Cost set to 0 — remove linked expense
        await existingExp.deleteOne();
      }
    }

    // ── Sync cowId/date even when cost wasn't changed ───────
    if (existingExp && payload.cost === undefined) {
      let needsSave = false;
      if (payload.cowId !== undefined && existingExp.cowId !== (record.cowId || null)) {
        existingExp.cowId = record.cowId || null;
        needsSave = true;
      }
      if (payload.date !== undefined && existingExp.date !== record.date) {
        existingExp.date = record.date;
        needsSave = true;
      }
      if (needsSave) await existingExp.save();
    }

    res.json(record);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    // Delete linked expense if exists
    await Expense.deleteOne({ _healthId: req.params.id });
    await Health.findByIdAndDelete(req.params.id);
    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
