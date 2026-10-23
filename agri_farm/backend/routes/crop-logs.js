// ─── Crop logs: irrigation + crop photo diary + spray/pesticide logs ────────
import express from 'express';
import { Irrigation, CropPhoto, Spray, Crop, Finance, Inventory } from '../db.js';
import { mufIsFullRole } from '../muf-farms.mjs';
import { protect, requireAdmin } from '../middleware/auth.js';
import { HttpError, badRequest, notFound, parseOid, asyncHandler, toFloat } from '../utils/helpers.js';
import { todayStr } from '../utils/date.js';

const router = express.Router();

// Inventory deduct/restore helper (same rules as the Python backend)
async function deductInventory(itemId, qty, restore = false) {
  if (!itemId || !qty) return;
  const oid = parseOid(String(itemId), 'inventory item ID');
  const item = await Inventory.findOne({ _id: oid });
  if (!item) throw new HttpError(400, 'Inventory item not found');
  const delta = restore ? qty : -qty;
  if (!restore && (toFloat(item.current_stock) < qty)) {
    throw new HttpError(400, 'Not enough stock to deduct for this spray.');
  }
  await Inventory.updateOne({ _id: oid }, { $inc: { current_stock: delta } });
}

// ─── Irrigation ──────────────────────────────────────────────────────────────
router.get('/irrigation', protect, asyncHandler(async (req, res) => {
  const cropId = req.query.crop_id || null;
  const query = cropId ? { crop_id: cropId } : {};
  const data = await Irrigation.find(query).limit(100000);
  const out = data.map((d) => {
    const doc = { ...d, _id: String(d._id) };
    // Workers may see watering hours/dates but not the money side.
    if (!mufIsFullRole(req.user.role)) {
      delete doc.hourly_rate;
      delete doc.amount;
      delete doc.finance_id;
    }
    return doc;
  });
  return res.json(out);
}));

router.post('/irrigation', protect, requireAdmin, asyncHandler(async (req, res) => {
  const hours = toFloat(req.body?.hours);
  if (hours <= 0) return badRequest(res, 'Irrigation hours must be greater than 0.');
  if (!req.body?.crop_id) return badRequest(res, 'Crop is required for an irrigation log.');
  const crop = await Crop.findOne({ _id: parseOid(req.body.crop_id, 'crop ID') });
  if (!crop) return notFound(res, 'Crop not found');

  const payload = { ...(req.body || {}) };
  payload.date = payload.date || todayStr();
  payload.hourly_rate = toFloat(payload.hourly_rate);
  payload.finance_id = null;
  payload.amount = 0.0;

  if (payload.tubewell === 'rented') {
    if (payload.hourly_rate <= 0) {
      return badRequest(res, 'Rented tubewell needs an hourly rate.');
    }
    const amount = Math.round(hours * payload.hourly_rate * 100) / 100;
    payload.amount = amount;
    const fin = {
      category: 'Irrigation',
      amount,
      type: 'expense',
      date: payload.date,
      crop_id: payload.crop_id,
      notes: `Rented tubewell: ${hours}h × Rs. ${payload.hourly_rate}/hr` + (payload.notes ? `. ${payload.notes}` : ''),
      hourly_rate: payload.hourly_rate,
      custom_qty: hours,
      custom_price: payload.hourly_rate,
    };
    const finDoc = (await Finance.insertMany([fin]))[0];
    payload.finance_id = String(finDoc._id);
  } else {
    payload.hourly_rate = 0.0;
    payload.notes = payload.notes || 'Own solar tubewell — hours only';
  }

  const doc = (await Irrigation.insertMany([payload]))[0];
  return res.status(201).json({ ...doc, _id: String(doc._id) });
}));

router.delete('/irrigation/:logId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const oid = parseOid(req.params.logId, 'irrigation ID');
  const log = await Irrigation.findOne({ _id: oid });
  if (!log) return notFound(res, 'Irrigation log not found');
  if (log.finance_id) {
    try {
      await Finance.deleteOne({ _id: String(log.finance_id) });
    } catch { /* ignore */ }
  }
  await Irrigation.deleteOne({ _id: oid });
  return res.json({ status: 'ok' });
}));

// ─── Crop photo diary ────────────────────────────────────────────────────────
router.get('/crop-photos', protect, asyncHandler(async (req, res) => {
  const cropId = req.query.crop_id || null;
  const query = cropId ? { crop_id: cropId } : {};
  const data = await CropPhoto.find(query).limit(1000);
  return res.json(data.map((d) => ({ ...d, _id: String(d._id) })));
}));

router.post('/crop-photos', protect, requireAdmin, asyncHandler(async (req, res) => {
  const { crop_id, image_base64 } = req.body || {};
  if (!crop_id || !image_base64) return badRequest(res, 'Crop and photo are required.');
  const crop = await Crop.findOne({ _id: parseOid(crop_id, 'crop ID') });
  if (!crop) return notFound(res, 'Crop not found');
  const existing = await CropPhoto.countDocuments({ crop_id });
  if (existing >= 3) return badRequest(res, 'This crop already has 3 diary photos.');
  const payload = { ...(req.body || {}) };
  payload.uploaded_at = payload.uploaded_at || todayStr();
  const doc = (await CropPhoto.insertMany([payload]))[0];
  return res.status(201).json({ ...doc, _id: String(doc._id) });
}));

router.delete('/crop-photos/:photoId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const oid = parseOid(req.params.photoId, 'photo ID');
  const result = await CropPhoto.deleteOne({ _id: oid });
  if (!result.deletedCount) return notFound(res, 'Photo not found');
  return res.json({ status: 'ok' });
}));

// ─── Spray / pesticide logs ──────────────────────────────────────────────────
router.get('/spray', protect, asyncHandler(async (req, res) => {
  const cropId = req.query.crop_id || null;
  const query = cropId ? { crop_id: cropId } : {};
  const data = await Spray.find(query).limit(100000);
  return res.json(data.map((d) => ({ ...d, _id: String(d._id) })));
}));

router.post('/spray', protect, requireAdmin, asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.crop_id || !String(body.chemical || '').trim()) {
    return badRequest(res, 'Crop and chemical name are required.');
  }
  const crop = await Crop.findOne({ _id: parseOid(body.crop_id, 'crop ID') });
  if (!crop) return notFound(res, 'Crop not found');

  const payload = { ...body };
  payload.date = payload.date || todayStr();
  payload.inventory_item_id = payload.inventory_item_id || null;
  payload.inventory_qty_consumed = toFloat(payload.inventory_qty_consumed);
  if (payload.inventory_item_id && payload.inventory_qty_consumed > 0) {
    await deductInventory(payload.inventory_item_id, payload.inventory_qty_consumed);
    payload.inventory_deducted = true;
  } else {
    payload.inventory_deducted = false;
  }
  const doc = (await Spray.insertMany([payload]))[0];
  return res.status(201).json({ ...doc, _id: String(doc._id) });
}));

router.delete('/spray/:logId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const oid = parseOid(req.params.logId, 'spray ID');
  const log = await Spray.findOne({ _id: oid });
  if (!log) return notFound(res, 'Spray log not found');
  if (log.inventory_deducted && log.inventory_item_id && log.inventory_qty_consumed) {
    try {
      await deductInventory(log.inventory_item_id, toFloat(log.inventory_qty_consumed), true);
    } catch (e) {
      if (e instanceof HttpError) return res.status(e.status).json({ detail: e.detail });
      throw e;
    }
  }
  await Spray.deleteOne({ _id: oid });
  return res.json({ status: 'ok' });
}));

export default router;
