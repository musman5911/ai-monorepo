// ─── Inventory & stock operations (admin only) ──────────────────────────────
import express from 'express';
import { Inventory } from '../db.js';
import { protect, requireAdmin } from '../middleware/auth.js';
import { parseOid, asyncHandler } from '../utils/helpers.js';

const router = express.Router();

router.get('/inventory', protect, requireAdmin, asyncHandler(async (_req, res) => {
  const items = await Inventory.find({}).limit(100000);
  return res.json(items.map((i) => ({ ...i, _id: String(i._id) })));
}));

router.post('/inventory', protect, requireAdmin, asyncHandler(async (req, res) => {
  const doc = (await Inventory.insertMany([req.body || {}]))[0];
  return res.status(201).json({ ...doc, _id: String(doc._id) });
}));

router.put('/inventory/:itemId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const oid = parseOid(req.params.itemId, 'inventory ID');
  await Inventory.updateOne({ _id: oid }, { $set: req.body || {} });
  return res.json({ status: 'ok' });
}));

router.delete('/inventory/:itemId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const oid = parseOid(req.params.itemId, 'inventory ID');
  await Inventory.deleteOne({ _id: oid });
  return res.json({ status: 'ok' });
}));

export default router;
