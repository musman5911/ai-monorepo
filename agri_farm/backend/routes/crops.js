// ─── Crop routes (mirrors the previous FastAPI backend) ─────────────────────
import express from 'express';
import { Crop, CropPhoto, Spray } from '../db.js';
import { protect, requireAdmin } from '../middleware/auth.js';
import { badRequest, notFound, parseOid, asyncHandler } from '../utils/helpers.js';

const router = express.Router();

router.get('/crops', protect, asyncHandler(async (req, res) => {
  const skip = Math.max(0, Number(req.query.skip) || 0);
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 100, 500));
  const isAdmin = req.user.role === 'admin';
  // Workers only see CURRENT crop cycles — completed/history records
  // (and their harvest totals) are the owner's business.
  const query = isAdmin ? {} : { status: { $ne: 'Completed' } };
  const data = await Crop.find(query).skip(skip).limit(limit);
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

router.post('/crops', protect, requireAdmin, asyncHandler(async (req, res) => {
  const doc = (await Crop.insertMany([req.body || {}]))[0];
  return res.status(201).json({ ...doc, _id: String(doc._id) });
}));

router.put('/crops/:cropId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const oid = parseOid(req.params.cropId, 'crop ID');
  const result = await Crop.replaceOne({ _id: oid }, req.body || {});
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
