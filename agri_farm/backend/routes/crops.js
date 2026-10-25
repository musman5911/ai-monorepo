// ─── Crop routes (mirrors the previous FastAPI backend) ─────────────────────
import express from 'express';
import { Crop, CropPhoto, Spray, Field } from '../db.js';
import { protect, requireAdmin } from '../middleware/auth.js';
import { badRequest, notFound, parseOid, asyncHandler, replaceFarmRecord } from '../utils/helpers.js';
import { mufIsFullRole } from '../muf-farms.mjs';

const router = express.Router();

router.get('/crops', protect, asyncHandler(async (req, res) => {
  const rawSkip = req.query.skip === undefined ? 0 : (Array.isArray(req.query.skip) ? NaN : Number(req.query.skip));
  const rawLimit = req.query.limit === undefined ? 100 : (Array.isArray(req.query.limit) ? NaN : Number(req.query.limit));
  if (!Number.isSafeInteger(rawSkip) || rawSkip < 0) return res.status(400).json({ error: 'skip must be a non-negative integer' });
  if (!Number.isSafeInteger(rawLimit) || rawLimit < 1) return res.status(400).json({ error: 'limit must be a positive integer' });
  const skip = rawSkip;
  const limit = Math.min(rawLimit, 500);
  const isAdmin = mufIsFullRole(req.user.role);
  const readFilter = (value) => typeof value === 'string' ? value.trim() : '';
  const escapeRegex = (value) => Array.from(value, (char) => {
    const code = char.charCodeAt(0);
    return [36, 46, 42, 43, 63, 94, 123, 125, 40, 41, 124, 91, 93, 92].includes(code)
      ? String.fromCharCode(92) + char : char;
  }).join('');
  const clauses = [];
  if (!isAdmin) clauses.push({ status: { $ne: 'Completed' } });
  const status = readFilter(req.query.status);
  const season = readFilter(req.query.season);
  const cropYear = readFilter(req.query.crop_year);
  const field = readFilter(req.query.field);
  const fieldId = readFilter(req.query.fieldId);
  const cropId = readFilter(req.query.crop_id);
  const search = readFilter(req.query.search).slice(0, 100);
  if (status && status !== 'all') clauses.push({ status });
  if (season && season !== 'all') clauses.push({ season });
  if (cropYear && cropYear !== 'all') clauses.push({ crop_year: cropYear });
  if (field && field !== 'all') clauses.push({ field });
  if (fieldId && fieldId !== 'all') {
    if (!/^[0-9a-fA-F]{24}$/.test(fieldId)) return res.status(400).json({ error: 'fieldId must be a valid field ID' });
    clauses.push({ fieldId });
  }
  if (cropId && cropId !== 'all') {
    if (!/^[0-9a-fA-F]{24}$/.test(cropId)) return res.status(400).json({ error: 'crop_id must be a valid crop ID' });
    clauses.push({ _id: cropId });
  }
  if (search) {
    const pattern = escapeRegex(search);
    clauses.push({ $or: [
      { name: { $regex: pattern, $options: 'i' } },
      { variety: { $regex: pattern, $options: 'i' } },
      { field: { $regex: pattern, $options: 'i' } },
    ] });
  }
  const query = clauses.length === 0 ? {} : clauses.length === 1 ? clauses[0] : { $and: clauses };
  const [data, total] = await Promise.all([
    Crop.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
    Crop.countDocuments(query),
  ]);
  res.set('Access-Control-Expose-Headers', 'X-Total-Count, X-Page, X-Page-Size, X-Total-Pages');
  res.set('X-Total-Count', String(total));
  res.set('X-Page', String(Math.floor(skip / limit) + 1));
  res.set('X-Page-Size', String(limit));
  res.set('X-Total-Pages', String(Math.ceil(total / limit)));
  const out = data.map((d) => {
    const doc = { ...d, _id: String(d._id) };
    if (!isAdmin) {
      // Workers see care-level data only: no costs, no input quantities,
      // no production totals, no owner notes.
      delete doc.seed_cost_per_unit;
      delete doc.seed_quantity;
      delete doc.yield_kg;
      delete doc.notes;
    }
    return doc;
  });
  return res.json(out);
}));

async function validateFieldLink(body) {
  const fieldId = String(body?.fieldId || '').trim();
  if (!fieldId) return { ok: true, fieldId: '' };
  if (!/^[0-9a-fA-F]{24}$/.test(fieldId)) return { ok: false, message: 'fieldId must be a valid field ID' };
  const field = await Field.findOne({ _id: fieldId });
  if (!field) return { ok: false, message: 'Field must exist in the selected farm' };
  return { ok: true, fieldId };
}

router.post('/crops', protect, requireAdmin, asyncHandler(async (req, res) => {
  const link = await validateFieldLink(req.body || {});
  if (!link.ok) return badRequest(res, link.message);
  const payload = { ...(req.body || {}) };
  if (link.fieldId) payload.fieldId = link.fieldId;
  else delete payload.fieldId;
  const doc = (await Crop.insertMany([payload]))[0];
  return res.status(201).json({ ...doc, _id: String(doc._id) });
}));

router.put('/crops/:cropId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const oid = parseOid(req.params.cropId, 'crop ID');
  const link = await validateFieldLink(req.body || {});
  if (!link.ok) return badRequest(res, link.message);
  const payload = { ...(req.body || {}) };
  if (link.fieldId) payload.fieldId = link.fieldId;
  else if (!Object.prototype.hasOwnProperty.call(req.body || {}, 'fieldId')) {
    const existing = await Crop.findOne({ _id: oid });
    if (existing?.fieldId) payload.fieldId = String(existing.fieldId);
    else delete payload.fieldId;
  } else delete payload.fieldId;
  const result = await replaceFarmRecord(Crop, oid, payload);
  if (!result.matchedCount) return notFound(res, 'Crop not found');
  return res.json({ ...(req.body || {}), _id: oid });
}));

router.patch('/crops/:cropId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const newStatus = req.body?.status;
  if (!newStatus) return badRequest(res, 'Status is required');
  const oid = parseOid(req.params.cropId, 'crop ID');
  const result = await Crop.updateOne({ _id: oid }, { $set: { status: newStatus } });
  if (!result.matchedCount) return notFound(res, 'Crop not found');
  return res.json({ status: 'ok' });
}));

router.delete('/crops/:cropId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const cropId = req.params.cropId;
  const oid = parseOid(cropId, 'crop ID');
  const result = await Crop.deleteOne({ _id: oid });
  if (!result.deletedCount) return notFound(res, 'Crop not found');
  // Free storage: remove this crop's diary photos (and spray-log photos)
  // so deleted crops never leave orphaned image data in the database.
  await CropPhoto.deleteMany({ crop_id: cropId });
  await Spray.updateMany({ crop_id: cropId }, { $set: { image_base64: '' } });
  return res.json({ status: 'ok' });
}));

export default router;
