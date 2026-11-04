// ─── Finance ledger routes — money-sensitive, admin-only ────────────────────
import express from 'express';
import { Finance, Crop, Field, Supplier } from '../db.js';
import { protect, requireAdmin } from '../middleware/auth.js';
import { notFound, parseOid, asyncHandler, replaceFarmRecord } from '../utils/helpers.js';
import { todayStr } from '../utils/date.js';
import { cleanupOrphanPhotoAssets } from '../services/photo-assets.js';
import { normalizeFinanceInput } from '../record-validation.mjs';

const router = express.Router();

router.get('/finance', protect, requireAdmin, asyncHandler(async (req, res) => {
  const rawSkip = req.query.skip === undefined ? 0 : (Array.isArray(req.query.skip) ? NaN : Number(req.query.skip));
  const rawLimit = req.query.limit === undefined ? 100 : (Array.isArray(req.query.limit) ? NaN : Number(req.query.limit));
  if (!Number.isSafeInteger(rawSkip) || rawSkip < 0) return res.status(400).json({ error: 'skip must be a non-negative integer' });
  if (!Number.isSafeInteger(rawLimit) || rawLimit < 1) return res.status(400).json({ error: 'limit must be a positive integer' });
  const skip = rawSkip;
  const limit = Math.min(rawLimit, 500);
  const readFilter = (value) => typeof value === 'string' ? value.trim() : '';
  const escapeRegex = (value) => Array.from(value, (char) => {
    const code = char.charCodeAt(0);
    return [36, 46, 42, 43, 63, 94, 123, 125, 40, 41, 124, 91, 93, 92].includes(code)
      ? String.fromCharCode(92) + char : char;
  }).join('');
  const clauses = [];
  const type = readFilter(req.query.type);
  const cropId = readFilter(req.query.crop_id);
  const search = readFilter(req.query.search).slice(0, 100);
  const farmWide = ['1', 'true'].includes(readFilter(req.query.farm_wide).toLowerCase());
  if (type && type !== 'all') {
    if (type !== 'income' && type !== 'expense') return res.status(400).json({ error: 'type must be income or expense' });
    clauses.push({ type });
  }
  if (cropId && cropId !== 'all') clauses.push({ crop_id: cropId });
  else if (farmWide) {
    const cropRows = await Crop.find({}).lean();
    const existingCropIds = cropRows.map((crop) => String(crop._id));
    clauses.push({ crop_id: { $nin: existingCropIds } });
  }
  if (search) {
    const pattern = escapeRegex(search);
    clauses.push({ $or: [
      { category: { $regex: pattern, $options: 'i' } },
      { notes: { $regex: pattern, $options: 'i' } },
    ] });
  }
  const query = clauses.length === 0 ? {} : clauses.length === 1 ? clauses[0] : { $and: clauses };
  const [data, total] = await Promise.all([
    Finance.find(query).sort({ date: -1, _id: -1 }).skip(skip).limit(limit),
    Finance.countDocuments(query),
  ]);
  res.set('Access-Control-Expose-Headers', 'X-Total-Count, X-Page, X-Page-Size, X-Total-Pages');
  res.set('X-Total-Count', String(total));
  res.set('X-Page', String(Math.floor(skip / limit) + 1));
  res.set('X-Page-Size', String(limit));
  res.set('X-Total-Pages', String(Math.ceil(total / limit)));
  return res.json(data.map((d) => ({ ...d, _id: String(d._id) })));
}));


router.post('/finance/bulk', protect, requireAdmin, asyncHandler(async (req, res) => {
  const rows = req.body?.rows;
  if (!Array.isArray(rows) || rows.length < 1) return res.status(400).json({ error: 'rows must be a non-empty array' });
  if (rows.length > 200) return res.status(400).json({ error: 'A finance bulk request is limited to 200 rows' });

  const errors = [];
  const prepared = [];
  for (let index = 0; index < rows.length; index += 1) {
    const normalized = normalizeFinanceInput(rows[index], { defaultDate: todayStr() });
    if (normalized.error) {
      errors.push({ row: index + 2, message: normalized.error });
      continue;
    }
    const linkError = await validateFinanceLinks(normalized.value);
    if (linkError) errors.push({ row: index + 2, message: linkError });
    else prepared.push(normalized.value);
  }
  if (errors.length) return res.status(400).json({ error: 'Bulk finance validation failed', details: errors });
  const inserted = await Finance.insertMany(prepared);
  return res.status(201).json({ status: 'ok', inserted: inserted.length });
}));

async function validateFinanceLinks(entry) {
  const cropId = String(entry.crop_id || '').trim();
  const fieldId = String(entry.fieldId || '').trim();
  const cropCycleId = String(entry.cropCycleId || '').trim();
  if (cropId && (!/^[0-9a-fA-F]{24}$/.test(cropId) || !(await Crop.findOne({ _id: cropId })))) {
    return 'Crop must exist in the selected farm.';
  }
  if (fieldId && (!/^[0-9a-fA-F]{24}$/.test(fieldId) || !(await Field.findOne({ _id: fieldId })))) {
    return 'Field must exist in the selected farm.';
  }
  if (cropCycleId && (!/^[0-9a-fA-F]{24}$/.test(cropCycleId) || !(await Crop.findOne({ _id: cropCycleId })))) {
    return 'Crop cycle must exist in the selected farm.';
  }
  const supplierId = String(entry.supplier_id || '').trim();
  if (supplierId && (!/^[0-9a-fA-F]{24}$/.test(supplierId) || !(await Supplier.findOne({ _id: supplierId })))) {
    return 'Supplier must exist in the selected farm.';
  }
  return '';
}

router.post('/finance', protect, requireAdmin, asyncHandler(async (req, res) => {
  const normalized = normalizeFinanceInput(req.body || {}, { defaultDate: todayStr() });
  if (normalized.error) return res.status(400).json({ error: normalized.error });
  const linkError = await validateFinanceLinks(normalized.value);
  if (linkError) return res.status(400).json({ error: linkError });
  await Finance.insertMany([normalized.value]);
  return res.status(201).json({ status: 'ok' });
}));

router.put('/finance/:financeId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const oid = parseOid(req.params.financeId, 'finance ID');
  const existing = await Finance.findOne({ _id: oid });
  if (!existing) return notFound(res, 'Finance entry not found');
  const body = { ...(req.body || {}) };
  if (!Object.prototype.hasOwnProperty.call(body, 'fieldId')) body.fieldId = existing.fieldId || null;
  if (!Object.prototype.hasOwnProperty.call(body, 'cropCycleId')) body.cropCycleId = existing.cropCycleId || null;
  if (!Object.prototype.hasOwnProperty.call(body, 'supplier_id')) body.supplier_id = existing.supplier_id || null;
  const normalized = normalizeFinanceInput(body, { defaultDate: existing.date || todayStr() });
  if (normalized.error) return res.status(400).json({ error: normalized.error });
  const linkError = await validateFinanceLinks(normalized.value);
  if (linkError) return res.status(400).json({ error: linkError });
  const result = await replaceFarmRecord(Finance, oid, normalized.value);
  if (!result.matchedCount) return notFound(res, 'Finance entry not found');
  try { await cleanupOrphanPhotoAssets(); } catch (cleanupError) { console.error('[photos] orphan cleanup deferred:', cleanupError); }
  return res.json({ status: 'ok' });
}));

router.delete('/finance/:financeId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const oid = parseOid(req.params.financeId, 'finance ID');
  const result = await Finance.deleteOne({ _id: oid });
  if (!result.deletedCount) return notFound(res, 'Finance entry not found');
  try { await cleanupOrphanPhotoAssets(); } catch (cleanupError) { console.error('[photos] orphan cleanup deferred:', cleanupError); }
  return res.json({ status: 'ok' });
}));

export default router;
