// ─── Crop logs: irrigation + crop photo diary + spray/pesticide logs ────────
import express from 'express';
import { Irrigation, CropPhoto, Spray, Crop, Finance, Inventory, withFinancialTransaction } from '../db.js';
import { mufLaborAttendanceId } from '../utils/attendance-id.mjs';
import { mufIsFullRole } from '../muf-farms.mjs';
import { protect, requireAdmin } from '../middleware/auth.js';
import { HttpError, badRequest, notFound, parseOid, asyncHandler, toFloat } from '../utils/helpers.js';
import { todayStr } from '../utils/date.js';
import { cleanupOrphanPhotoAssets } from '../services/photo-assets.js';
import { normalizeIrrigationInput, normalizeCropPhotoInput, normalizeSprayInput } from '../record-validation.mjs';

const router = express.Router();

// Inventory deduct/restore helper (same rules as the Python backend)
async function adjustInventory(itemId, qty, restore = false, session = null) {
  if (!itemId || !qty) return;
  const oid = parseOid(String(itemId), 'inventory item ID');
  const options = session ? { session } : {};
  const query = Inventory.findOne({ _id: oid });
  const item = await (session ? query.session(session) : query);
  if (!item) throw new HttpError(400, 'Inventory item not found');

  const filter = { _id: oid };
  if (!restore) filter.current_stock = { $gte: qty };
  const result = await Inventory.updateOne(
    filter,
    { $inc: { current_stock: restore ? qty : -qty } },
    options,
  );
  if ((result.matchedCount ?? result.modifiedCount ?? 0) === 0) {
    throw new HttpError(400, restore
      ? 'Inventory item not found.'
      : 'Not enough stock to deduct for this spray.');
  }
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
  const normalized = normalizeIrrigationInput(req.body || {}, { defaultDate: todayStr() });
  if (normalized.error) return badRequest(res, normalized.error);
  const payload = normalized.value;
  const crop = await Crop.findOne({ _id: parseOid(payload.crop_id, 'crop ID') });
  if (!crop) return notFound(res, 'Crop not found');
  payload.finance_id = null;
  payload.amount = 0.0;

  if (payload.tubewell === 'rented') {
    if (payload.hourly_rate <= 0) {
      return badRequest(res, 'Rented tubewell needs an hourly rate.');
    }
    const amount = Math.round(payload.hours * payload.hourly_rate * 100) / 100;
    payload.amount = amount;
    const fin = {
      category: 'Irrigation',
      amount,
      type: 'expense',
      date: payload.date,
      crop_id: payload.crop_id,
      notes: `Rented tubewell: ${payload.hours}h × Rs. ${payload.hourly_rate}/hr` + (payload.notes ? `. ${payload.notes}` : ''),
      hourly_rate: payload.hourly_rate,
      custom_qty: payload.hours,
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
  const normalized = normalizeCropPhotoInput(req.body || {}, { defaultDate: todayStr() });
  if (normalized.error) return badRequest(res, normalized.error);
  const { crop_id } = normalized.value;
  const crop = await Crop.findOne({ _id: parseOid(crop_id, 'crop ID') });
  if (!crop) return notFound(res, 'Crop not found');
  const existing = await CropPhoto.countDocuments({ crop_id });
  if (existing >= 3) return badRequest(res, 'This crop already has 3 diary photos.');
  const doc = (await CropPhoto.insertMany([normalized.value]))[0];
  return res.status(201).json({ ...doc, _id: String(doc._id) });
}));

router.delete('/crop-photos/:photoId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const oid = parseOid(req.params.photoId, 'photo ID');
  const result = await CropPhoto.deleteOne({ _id: oid });
  if (!result.deletedCount) return notFound(res, 'Photo not found');
  try { await cleanupOrphanPhotoAssets(); } catch (cleanupError) { console.error('[photos] orphan cleanup deferred:', cleanupError); }
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
  const normalized = normalizeSprayInput(req.body || {}, { defaultDate: todayStr() });
  if (normalized.error) return badRequest(res, normalized.error);
  const payload = normalized.value;

  const result = await withFinancialTransaction([Crop, Inventory, Spray], async (session) => {
    const options = session ? { session } : {};
    const cropQuery = Crop.findOne({ _id: parseOid(payload.crop_id, 'crop ID') });
    const crop = await (session ? cropQuery.session(session) : cropQuery);
    if (!crop) return { kind: 'crop_not_found' };

    if (payload.inventory_item_id && payload.inventory_qty_consumed > 0) {
      await adjustInventory(payload.inventory_item_id, payload.inventory_qty_consumed, false, session);
      payload.inventory_deducted = true;
    } else {
      payload.inventory_deducted = false;
    }

    const doc = (await Spray.insertMany([payload], options))[0];
    return { kind: 'ok', doc };
  });
  if (result.kind === 'crop_not_found') return notFound(res, 'Crop not found');
  return res.status(201).json({ ...result.doc, _id: String(result.doc._id) });
}));

router.delete('/spray/:logId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const oid = parseOid(req.params.logId, 'spray ID');
  const result = await withFinancialTransaction([Inventory, Spray], async (session) => {
    const options = session ? { session } : {};
    const query = Spray.findOne({ _id: oid });
    const log = await (session ? query.session(session) : query);
    if (!log) return { kind: 'not_found' };

    if (log.inventory_deducted && log.inventory_item_id && log.inventory_qty_consumed) {
      await adjustInventory(log.inventory_item_id, toFloat(log.inventory_qty_consumed), true, session);
    }
    const removed = await Spray.deleteOne({ _id: oid }, options);
    if (!removed.deletedCount) throw new Error('Spray log changed during deletion; retry the request.');
    return { kind: 'ok' };
  });
  if (result.kind === 'not_found') return notFound(res, 'Spray log not found');
  try { await cleanupOrphanPhotoAssets(); } catch (cleanupError) { console.error('[photos] orphan cleanup deferred:', cleanupError); }
  return res.json({ status: 'ok' });
}));

export default router;
