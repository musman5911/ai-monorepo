import { randomUUID } from 'crypto';
import express from 'express';
const router = express.Router();
import { Milk } from '../db.js';
import { protect, adminOnly, workerOrAdmin } from '../middleware/auth.js';
import {
  readString,
  readDate,
  readNonNegativeNumber,
  sendValidationError,
  parsePagination,
  parsePagePagination,
  applyPagination,
} from './input.js';

function milkPayload(body, { requireBasics = false } = {}) {
  const errors = [];
  const payload = {};

  const cowId = readString(body, 'cowId', errors, { required: requireBasics, allowEmpty: false });
  if (cowId !== undefined) payload.cowId = cowId;
  const date = readDate(body, 'date', errors, { required: requireBasics });
  if (date !== undefined) payload.date = date;

  ['morning', 'evening', 'calfMilk', 'fatPercent', 'snfPercent'].forEach((field) => {
    const value = readNonNegativeNumber(body, field, errors);
    if (value !== undefined) payload[field] = value;
  });

  const buyerId = readString(body, 'buyerId', errors);
  if (buyerId !== undefined) payload.buyerId = buyerId;

  return { payload, errors };
}

router.get('/', protect, async (req, res) => {
  try {
    const filter = {};
    if (req.query.cowId) filter.cowId = req.query.cowId;
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = req.query.from;
      if (req.query.to) filter.date.$lte = req.query.to;
    }
    if (req.query.month) {
      const [y, m] = req.query.month.split('-').map(Number);
      const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
      const endDay = new Date(y, m, 0).getDate();
      const endDate = `${y}-${String(m).padStart(2, '0')}-${endDay}`;
      filter.date = { $gte: startDate, $lte: endDate };
    }
    const page = parsePagePagination(req.query);
    if (page.enabled) {
      if (page.error) return res.status(400).json({ error: page.error });
      // Keep the legacy array response. Paging metadata is carried in headers
      // so existing clients continue to work unchanged.
      const [rows, total] = await Promise.all([
        Milk.find(filter).sort({ date: -1, _id: -1 }).skip(page.skip).limit(page.limit),
        Milk.countDocuments(filter),
      ]);
      res.set('Access-Control-Expose-Headers', 'X-Total-Count, X-Page, X-Page-Size, X-Total-Pages');
      res.set('X-Total-Count', String(total));
      res.set('X-Page', String(page.page));
      res.set('X-Page-Size', String(page.limit));
      res.set('X-Total-Pages', String(Math.ceil(total / page.limit)));
      return res.json(rows);
    }
    const pagination = parsePagination(req.query);
    const rows = await applyPagination(Milk.find(filter).sort({ date: -1, _id: -1 }), pagination);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', protect, workerOrAdmin, async (req, res) => {
  try {
    const { payload, errors } = milkPayload(req.body, { requireBasics: true });
    if (errors.length) return sendValidationError(res, errors);

    const existing = await Milk.findOne({ cowId: payload.cowId, date: payload.date });
    if (existing && !req.body.forceOverwrite) {
      return res.status(409).json({
        error: 'Duplicate entry',
        message: `Milk entry for this cow on ${payload.date} already exists.`,
        existing
      });
    }
    if (existing && req.body.forceOverwrite) {
      const updated = await Milk.findByIdAndUpdate(existing._id, { $set: payload }, { new: true });
      return res.json(updated);
    }
    try {
      const id = randomUUID();
      const entry = await Milk.create({ ...payload, _id: id });
      res.status(201).json(entry);
    } catch (createErr) {
      // Race: unique index hit between findOne and create
      if (createErr && (createErr.code === 11000 || createErr.codeName === 'DuplicateKey')) {
        if (req.body.forceOverwrite) {
          const existingRace = await Milk.findOne({ cowId: payload.cowId, date: payload.date });
          if (existingRace) {
            const updated = await Milk.findByIdAndUpdate(existingRace._id, { $set: payload }, { new: true });
            return res.json(updated);
          }
        }
        return res.status(409).json({
          error: 'Duplicate entry',
          message: `Milk entry for this cow on ${payload.date} already exists.`,
        });
      }
      throw createErr;
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', protect, workerOrAdmin, async (req, res) => {
  try {
    const { payload, errors } = milkPayload(req.body);
    if (errors.length) return sendValidationError(res, errors);

    // If cowId/date change would collide with another row, reject
    if (payload.cowId || payload.date) {
      const current = await Milk.findById(req.params.id);
      if (!current) return res.status(404).json({ error: 'Not found' });
      const nextCow = payload.cowId ?? current.cowId;
      const nextDate = payload.date ?? current.date;
      const clash = await Milk.findOne({ cowId: nextCow, date: nextDate, _id: { $ne: req.params.id } });
      if (clash) {
        return res.status(409).json({ error: 'Duplicate entry', message: `Milk entry for this cow on ${nextDate} already exists.` });
      }
    }

    const entry = await Milk.findByIdAndUpdate(req.params.id, { $set: payload }, { new: true });
    if (!entry) return res.status(404).json({ error: 'Not found' });
    res.json(entry);
  } catch (e) {
    if (e && (e.code === 11000 || e.codeName === 'DuplicateKey')) {
      return res.status(409).json({ error: 'Duplicate entry', message: 'Milk entry for this cow/date already exists.' });
    }
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Milk.findByIdAndDelete(req.params.id);
    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
