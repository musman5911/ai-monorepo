import express from 'express';
import { Field, Crop, Finance } from '../db.js';
import { protect, requireAdmin } from '../middleware/auth.js';
import { asyncHandler, badRequest, notFound, parseOid, replaceFarmRecord } from '../utils/helpers.js';

const router = express.Router();

function normalizeField(body = {}) {
  const name = String(body.name || '').trim();
  const acres = body.acres === '' || body.acres == null ? 0 : Number(body.acres);
  const notes = String(body.notes || '').trim();
  if (!name) return { error: 'Field name is required.' };
  if (!Number.isFinite(acres) || acres < 0) return { error: 'Acres must be a non-negative number.' };
  return { value: { name, acres, notes } };
}

router.get('/fields', protect, asyncHandler(async (_req, res) => {
  const fields = await Field.find({}).sort({ name: 1, _id: 1 }).lean();
  return res.json(fields.map((field) => ({ ...field, _id: String(field._id) })));
}));

router.post('/fields', protect, requireAdmin, asyncHandler(async (req, res) => {
  const normalized = normalizeField(req.body || {});
  if (normalized.error) return badRequest(res, normalized.error);
  const duplicate = await Field.findOne({ name: normalized.value.name });
  if (duplicate) return res.status(409).json({ error: 'A field with this name already exists in this farm.' });
  const field = await Field.create(normalized.value);
  return res.status(201).json({ ...field, _id: String(field._id) });
}));

router.put('/fields/:fieldId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const id = parseOid(req.params.fieldId, 'field ID');
  const normalized = normalizeField(req.body || {});
  if (normalized.error) return badRequest(res, normalized.error);
  const duplicate = await Field.findOne({ name: normalized.value.name, _id: { $ne: id } });
  if (duplicate) return res.status(409).json({ error: 'A field with this name already exists in this farm.' });
  const result = await replaceFarmRecord(Field, id, normalized.value);
  if (!result.matchedCount) return notFound(res, 'Field not found');
  return res.json({ ...normalized.value, _id: id });
}));

router.delete('/fields/:fieldId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const id = parseOid(req.params.fieldId, 'field ID');
  const field = await Field.findOne({ _id: id });
  if (!field) return notFound(res, 'Field not found');
  const [linkedCrops, linkedFinance] = await Promise.all([
    Crop.countDocuments({ fieldId: id }),
    Finance.countDocuments({ fieldId: id }),
  ]);
  if (linkedCrops || linkedFinance) {
    return res.status(409).json({
      error: 'This field is linked to existing crop cycles or finance entries. Move those records before deleting the field.',
      linkedCrops, linkedFinance,
    });
  }
  await Field.deleteOne({ _id: id });
  return res.json({ status: 'ok' });
}));

export default router;
