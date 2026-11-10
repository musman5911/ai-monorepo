// ─── Inventory & stock operations (admin only) ──────────────────────────────
import express from 'express';
import { Inventory, Task, Spray } from '../db.js';
import { protect, requireAdmin } from '../middleware/auth.js';
import { parseOid, asyncHandler, notFound } from '../utils/helpers.js';
import { normalizeInventoryInput } from '../record-validation.mjs';

const router = express.Router();

router.get('/inventory', protect, requireAdmin, asyncHandler(async (_req, res) => {
  const items = await Inventory.find({}).limit(100000);
  return res.json(items.map((i) => ({ ...i, _id: String(i._id) })));
}));

router.post('/inventory', protect, requireAdmin, asyncHandler(async (req, res) => {
  const normalized = normalizeInventoryInput(req.body || {});
  if (normalized.error) return res.status(400).json({ error: normalized.error });
  const doc = (await Inventory.insertMany([normalized.value]))[0];
  return res.status(201).json({ ...doc, _id: String(doc._id) });
}));

router.put('/inventory/:itemId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const oid = parseOid(req.params.itemId, 'inventory ID');
  const normalized = normalizeInventoryInput(req.body || {});
  if (normalized.error) return res.status(400).json({ error: normalized.error });
  if (req.body?._id && String(req.body._id) !== String(req.params.itemId)) {
    return res.status(400).json({ error: 'Inventory ID does not match the item being updated.' });
  }
  const result = await Inventory.updateOne({ _id: oid }, { $set: normalized.value });
  if (!result.matchedCount) return notFound(res, 'Inventory item not found');
  return res.json({ status: 'ok' });
}));

router.delete('/inventory/:itemId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const oid = parseOid(req.params.itemId, 'inventory ID');
  const item = await Inventory.findOne({ _id: oid });
  if (!item) return notFound(res, 'Inventory item not found');
  const [linkedTasks, linkedSprays] = await Promise.all([
    Task.countDocuments({ inventory_item_id: String(oid) }),
    Spray.countDocuments({ inventory_item_id: String(oid) }),
  ]);
  if (linkedTasks || linkedSprays) {
    return res.status(409).json({
      error: 'This inventory item is linked to tasks or spray logs. Update those records before deleting the item.',
      linkedTasks, linkedSprays,
    });
  }
  const result = await Inventory.deleteOne({ _id: oid });
  if (!result.deletedCount) return notFound(res, 'Inventory item not found');
  return res.json({ status: 'ok' });
}));

export default router;
