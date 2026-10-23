// ─── Finance ledger routes — money-sensitive, admin-only ────────────────────
import express from 'express';
import { Finance, Crop } from '../db.js';
import { protect, requireAdmin } from '../middleware/auth.js';
import { notFound, parseOid, asyncHandler, replaceFarmRecord } from '../utils/helpers.js';
import { todayStr } from '../utils/date.js';

const router = express.Router();

router.get('/finance', protect, requireAdmin, asyncHandler(async (req, res) => {
  const rawSkip = req.query.skip === undefined ? 0 : (Array.isArray(req.query.skip) ? NaN : Number(req.query.skip));
  const rawLimit = req.query.limit === undefined ? 100 : (Array.isArray(req.query.limit) ? NaN : Number(req.query.limit));
  if (!Number.isSafeInteger(rawSkip) || rawSkip < 0) return res.status(400).json({ error: 'skip must be a non-negative integer' });
  if (!Number.isSafeInteger(rawLimit) || rawLimit < 1) return res.status(400).json({ error: 'limit must be a positive integer' });
  const skip = rawSkip;
  const limit = Math.min(rawLimit, 500);
  const [data, total] = await Promise.all([
    Finance.find({}).sort({ date: -1, _id: -1 }).skip(skip).limit(limit),
    Finance.countDocuments({}),
  ]);
  res.set('Access-Control-Expose-Headers', 'X-Total-Count, X-Page, X-Page-Size, X-Total-Pages');
  res.set('X-Total-Count', String(total));
  res.set('X-Page', String(Math.floor(skip / limit) + 1));
  res.set('X-Page-Size', String(limit));
  res.set('X-Total-Pages', String(Math.ceil(total / limit)));
  return res.json(data.map((d) => ({ ...d, _id: String(d._id) })));
}));


router.post('/bulk', protect, requireAdmin, asyncHandler(async (req, res) => {
  const rows = req.body?.rows;
  if (!Array.isArray(rows) || rows.length < 1) return res.status(400).json({ error: 'rows must be a non-empty array' });
  if (rows.length > 200) return res.status(400).json({ error: 'A finance bulk request is limited to 200 rows' });

  const errors = [];
  const prepared = rows.map((raw, index) => {
    const rowNumber = index + 2;
    const row = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const category = String(row.category || '').trim();
    const type = String(row.type || 'expense').trim().toLowerCase();
    const amount = row.amount === undefined || row.amount === '' ? NaN : Number(row.amount);
    const date = String(row.date || '').trim() || todayStr();
    if (!category) errors.push({ row: rowNumber, message: 'Category is required.' });
    if (type !== 'income' && type !== 'expense') errors.push({ row: rowNumber, message: 'Type must be income or expense.' });
    if (!Number.isFinite(amount) || amount < 0) errors.push({ row: rowNumber, message: 'Amount must be a non-negative number.' });
    if (Number.isNaN(Date.parse(date))) errors.push({ row: rowNumber, message: 'Date must be valid.' });
    return {
      category, type, amount, date,
      crop_id: String(row.crop_id || '').trim() || null,
      notes: String(row.notes || '').trim(),
    };
  });
  for (let index = 0; index < prepared.length; index += 1) {
    const row = prepared[index];
    if (row.crop_id && (!/^[0-9a-fA-F]{24}$/.test(row.crop_id) || !(await Crop.findOne({ _id: row.crop_id })))) {
      errors.push({ row: index + 2, message: 'Crop must exist in the selected farm.' });
    }
  }
  if (errors.length) return res.status(400).json({ error: 'Bulk finance validation failed', details: errors });
  const inserted = await Finance.insertMany(prepared);
  return res.status(201).json({ status: 'ok', inserted: inserted.length });
}));

router.post('/finance', protect, requireAdmin, asyncHandler(async (req, res) => {
  const entry = { ...(req.body || {}) };
  if (!entry.date) entry.date = todayStr();
  await Finance.insertMany([entry]);
  return res.status(201).json({ status: 'ok' });
}));

router.put('/finance/:financeId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const oid = parseOid(req.params.financeId, 'finance ID');
  const entry = { ...(req.body || {}) };
  if (!entry.date) entry.date = todayStr();
  const result = await replaceFarmRecord(Finance, oid, entry);
  if (!result.matchedCount) return notFound(res, 'Finance entry not found');
  return res.json({ status: 'ok' });
}));

router.delete('/finance/:financeId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const oid = parseOid(req.params.financeId, 'finance ID');
  const result = await Finance.deleteOne({ _id: oid });
  if (!result.deletedCount) return notFound(res, 'Finance entry not found');
  return res.json({ status: 'ok' });
}));

export default router;
