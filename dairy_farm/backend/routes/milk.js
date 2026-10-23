import { randomUUID } from 'crypto';
import express from 'express';
const router = express.Router();
import { Milk, Rate, RateHistory, Buyer } from '../db.js';
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

function buildMilkFilter(query) {
  const filter = {};
  if (query.cowId) filter.cowId = String(query.cowId);
  if (query.from || query.to) {
    filter.date = {};
    if (query.from) filter.date.$gte = String(query.from);
    if (query.to) filter.date.$lte = String(query.to);
  }
  if (query.month) {
    const month = String(query.month);
    if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('month must use YYYY-MM');
    const [y, m] = month.split('-').map(Number);
    if (m < 1 || m > 12) throw new Error('month must use YYYY-MM');
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const endDay = new Date(y, m, 0).getDate();
    filter.date = { $gte: startDate, $lte: `${y}-${String(m).padStart(2, '0')}-${endDay}` };
  }
  return filter;
}

router.get('/summary', protect, async (req, res) => {
  try {
    const filter = buildMilkFilter(req.query);
    const [rows, count, currentRate, history, buyers] = await Promise.all([
      Milk.find(filter),
      Milk.countDocuments(filter),
      Rate.findOne().lean(),
      RateHistory.find().lean(),
      Buyer.find().lean(),
    ]);
    const timeline = [];
    if (currentRate?.date && /^\d{4}-\d{2}-\d{2}$/.test(currentRate.date) && Number.isFinite(currentRate.value)) {
      timeline.push({ date: currentRate.date, value: currentRate.value });
    }
    for (const item of history || []) {
      if (item?.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date) && Number.isFinite(item.value)) {
        timeline.push({ date: item.date, value: item.value });
      }
    }
    timeline.sort((a, b) => b.date.localeCompare(a.date));
    const buyerRates = Object.fromEntries((buyers || []).map((buyer) => [buyer._id, buyer.defaultRate || 0]));
    const rateForDate = (date) => {
      const match = timeline.find((entry) => entry.date <= date);
      return match ? match.value : (timeline.length ? timeline[timeline.length - 1].value : (currentRate?.value || 0));
    };
    let totalLiters = 0;
    let saleableLiters = 0;
    let revenue = 0;
    for (const row of rows) {
      const total = (row.morning || 0) + (row.evening || 0);
      const saleable = Math.max(0, total - (row.calfMilk || 0));
      totalLiters += total;
      saleableLiters += saleable;
      const customRate = row.buyerId ? buyerRates[row.buyerId] : 0;
      revenue += saleable * (customRate > 0 ? customRate : rateForDate(row.date));
    }
    res.json({
      count,
      totalLiters: Math.round(totalLiters * 100) / 100,
      saleableLiters: Math.round(saleableLiters * 100) / 100,
      revenue: Math.round(revenue * 100) / 100,
    });
  } catch (e) {
    if (e.message === 'month must use YYYY-MM') return res.status(400).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
});

router.get('/', protect, async (req, res) => {
  try {
    const filter = buildMilkFilter(req.query);
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


/**
 * Bounded bulk daily-entry endpoint. Validation is completed for every row
 * before the first write; writes then return explicit per-row outcomes so a
 * partial batch can be retried without guessing which rows succeeded.
 */
router.post('/bulk', protect, workerOrAdmin, async (req, res) => {
  try {
    const rows = req.body?.entries;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'entries must be a non-empty array' });
    }
    if (rows.length > 200) {
      return res.status(413).json({ error: 'bulk request is limited to 200 entries' });
    }

    const seen = new Set();
    const normalized = [];
    const errors = [];
    rows.forEach((row, index) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        errors.push(`row ${index + 1}: entry must be an object`);
        normalized.push({ index, payload: {}, forceOverwrite: false });
        return;
      }
      const { payload, errors: rowErrors } = milkPayload(row, { requireBasics: true });
      if (rowErrors.length) errors.push(`row ${index + 1}: ${rowErrors.join(', ')}`);
      if (payload.cowId && payload.date) {
        const key = `${payload.cowId}\u0000${payload.date}`;
        if (seen.has(key)) errors.push(`row ${index + 1}: duplicate cow/date in this batch`);
        seen.add(key);
      }
      normalized.push({ index, payload, forceOverwrite: row?.forceOverwrite === true });
    });
    if (errors.length) return res.status(400).json({ error: errors.join('; '), errors });

    const results = [];
    for (const row of normalized) {
      try {
        const { payload, forceOverwrite } = row;
        const existing = await Milk.findOne({ cowId: payload.cowId, date: payload.date });
        if (existing) {
          if (!forceOverwrite) {
            results.push({ index: row.index, cowId: payload.cowId, date: payload.date, ok: false, status: 409, error: 'Duplicate entry' });
            continue;
          }
          const updated = await Milk.findByIdAndUpdate(existing._id, { $set: payload }, { new: true });
          results.push({ index: row.index, cowId: payload.cowId, date: payload.date, ok: true, record: updated });
        } else {
          const record = await Milk.create({ ...payload, _id: randomUUID() });
          results.push({ index: row.index, cowId: payload.cowId, date: payload.date, ok: true, record });
        }
      } catch (error) {
        if (error && (error.code === 11000 || error.codeName === 'DuplicateKey')) {
          results.push({ index: row.index, cowId: row.payload.cowId, date: row.payload.date, ok: false, status: 409, error: 'Duplicate entry' });
        } else {
          results.push({ index: row.index, cowId: row.payload.cowId, date: row.payload.date, ok: false, status: 500, error: 'Could not save this row' });
        }
      }
    }
    const saved = results.filter((row) => row.ok).length;
    const failed = results.length - saved;
    return res.status(failed ? 207 : 200).json({ saved, failed, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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
