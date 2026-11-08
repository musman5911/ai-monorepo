// ─── Loan & liability operations (admin only) ───────────────────────────────
import express from 'express';
import { Liability, Crop, Finance } from '../db.js';
import { withFinancialTransaction } from '../db.js';
import { protect, requireAdmin } from '../middleware/auth.js';
import { notFound, parseOid, asyncHandler } from '../utils/helpers.js';
import { todayStr } from '../utils/date.js';
import { normalizeLiabilityInput } from '../record-validation.mjs';

const router = express.Router();

router.get('/liabilities', protect, requireAdmin, asyncHandler(async (_req, res) => {
  const items = await Liability.find({}).limit(100000);
  return res.json(items.map((i) => ({ ...i, _id: String(i._id) })));
}));

router.post('/liabilities', protect, requireAdmin, asyncHandler(async (req, res) => {
  const normalized = normalizeLiabilityInput(req.body || {});
  if (normalized.error) return res.status(400).json({ error: normalized.error });
  if (normalized.value.crop_id && !(await Crop.findById(normalized.value.crop_id).lean())) {
    return res.status(400).json({ error: 'Crop must exist in the selected farm.' });
  }
  const doc = (await Liability.insertMany([{ ...normalized.value, status: 'Pending' }]))[0];
  return res.status(201).json({ ...doc, _id: String(doc._id) });
}));

router.put('/liabilities/:itemId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const itemId = req.params.itemId;
  const oid = parseOid(itemId, 'liability ID');
  const normalized = normalizeLiabilityInput(req.body || {});
  if (normalized.error) return res.status(400).json({ error: normalized.error });
  if (normalized.value.crop_id && !(await Crop.findById(normalized.value.crop_id).lean())) {
    return res.status(400).json({ error: 'Crop must exist in the selected farm.' });
  }
  const result = await Liability.updateOne({ _id: oid }, { $set: normalized.value });
  if (result.matchedCount === 0) return notFound(res, 'Liability not found');
  return res.json({ status: 'ok' });
}));

router.put('/liabilities/:itemId/pay', protect, requireAdmin, asyncHandler(async (req, res) => {
  const oid = parseOid(req.params.itemId, 'liability ID');
  const result = await withFinancialTransaction([Liability, Crop, Finance], async (session) => {
    const options = session ? { session } : {};
    const liabilityQuery = Liability.findOne({ _id: oid });
    const liability = await (session ? liabilityQuery.session(session) : liabilityQuery);
    if (!liability) return { kind: 'not_found' };
    if (liability.status === 'Paid') return { kind: 'already_paid' };

    const amount = Number(liability.amount_owed);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
      return { kind: 'invalid_amount' };
    }

    // The conditional transition and ledger insert commit or roll back together.
    const claim = await Liability.updateOne(
      { _id: oid, status: { $ne: 'Paid' } },
      { $set: { status: 'Paid' } },
      options,
    );
    if ((claim.matchedCount ?? claim.modifiedCount ?? 0) === 0) return { kind: 'already_paid' };

    let cropName = '';
    if (liability.crop_id) {
      const cropQuery = Crop.findOne({ _id: String(liability.crop_id) });
      const crop = await (session ? cropQuery.session(session) : cropQuery);
      if (crop) cropName = ` - ${crop.name}`;
    }

    await Finance.insertMany([{
      category: `Paid Off Debt: ${liability.creditor}${cropName}`,
      amount,
      type: 'expense',
      date: todayStr(),
      crop_id: liability.crop_id || null,
      notes: `Settled credit payment of Rs. ${amount.toLocaleString()} owed to ${liability.creditor} (Notes: ${liability.notes || ''})`,
    }], options);
    return { kind: 'ok' };
  });

  if (result.kind === 'not_found') return notFound(res, 'Liability not found');
  if (result.kind === 'already_paid') return res.json({ status: 'already_paid' });
  if (result.kind === 'invalid_amount') {
    return res.status(409).json({ error: 'This liability has an invalid amount and cannot be settled until corrected.' });
  }
  return res.json({ status: 'ok' });
}));
router.delete('/liabilities/:itemId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const oid = parseOid(req.params.itemId, 'liability ID');
  await Liability.deleteOne({ _id: oid });
  return res.json({ status: 'ok' });
}));

export default router;
