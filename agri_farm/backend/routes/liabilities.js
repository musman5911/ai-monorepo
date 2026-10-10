// ─── Loan & liability operations (admin only) ───────────────────────────────
import express from 'express';
import { Liability, Crop, Finance } from '../db.js';
import { protect, requireAdmin } from '../middleware/auth.js';
import { notFound, parseOid, asyncHandler } from '../utils/helpers.js';
import { todayStr } from '../utils/date.js';

const router = express.Router();

router.get('/liabilities', protect, requireAdmin, asyncHandler(async (_req, res) => {
  const items = await Liability.find({}).limit(100000);
  return res.json(items.map((i) => ({ ...i, _id: String(i._id) })));
}));

router.post('/liabilities', protect, requireAdmin, asyncHandler(async (req, res) => {
  const doc = (await Liability.insertMany([req.body || {}]))[0];
  return res.status(201).json({ ...doc, _id: String(doc._id) });
}));

router.put('/liabilities/:itemId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const itemId = req.params.itemId;
  const oid = parseOid(itemId, 'liability ID');
  const body = req.body || {};
  const update = {
    creditor: body.creditor,
    amount_owed: Number(body.amount_owed) || 0,
    due_date: body.due_date || '',
    crop_id: body.crop_id === 'farm-wide' || body.crop_id === '' || body.crop_id == null ? null : body.crop_id,
    notes: body.notes || '',
  };
  const result = await Liability.updateOne({ _id: oid }, { $set: update });
  if (result.matchedCount === 0) return notFound(res, 'Liability not found');
  return res.json({ status: 'ok' });
}));

router.put('/liabilities/:itemId/pay', protect, requireAdmin, asyncHandler(async (req, res) => {
  const itemId = req.params.itemId;
  const liability = await Liability.findOne({ _id: parseOid(itemId, 'liability ID') });
  if (!liability) return notFound(res, 'Liability not found');

  if (liability.status === 'Paid') {
    return res.json({ status: 'already_paid' });
  }

  await Liability.updateOne({ _id: itemId }, { $set: { status: 'Paid' } });

  let cropName = '';
  if (liability.crop_id) {
    try {
      const crop = await Crop.findOne({ _id: String(liability.crop_id) });
      if (crop) cropName = ` - ${crop.name}`;
    } catch { /* ignore */ }
  }

  const amount = Number(liability.amount_owed || 0);
  await Finance.insertMany([{
    category: `Paid Off Debt: ${liability.creditor}${cropName}`,
    amount,
    type: 'expense',
    date: todayStr(),
    crop_id: liability.crop_id || null,
    notes: `Settled credit payment of Rs. ${amount.toLocaleString()} owed to ${liability.creditor} (Notes: ${liability.notes || ''})`,
  }]);

  return res.json({ status: 'ok' });
}));

router.delete('/liabilities/:itemId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const oid = parseOid(req.params.itemId, 'liability ID');
  await Liability.deleteOne({ _id: oid });
  return res.json({ status: 'ok' });
}));

export default router;
