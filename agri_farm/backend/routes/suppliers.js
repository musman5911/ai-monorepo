// ─── Supplier khata (dealers the farm buys from on credit) ──────────────────
// Purchases are the existing finance expenses tagged with supplier_id (set
// in the expense form) so nothing is counted twice; payments made to the
// supplier live in their own collection. Balance = purchases - payments.
import express from 'express';
import { Supplier, SupplierPayment } from '../db.js';
import { protect, requireAdmin } from '../middleware/auth.js';
import { badRequest, notFound, parseOid, asyncHandler, replaceFarmRecord } from '../utils/helpers.js';

const router = express.Router();

router.get('/suppliers', protect, requireAdmin, asyncHandler(async (_req, res) => {
  const items = await Supplier.find({}).limit(10000);
  return res.json(items.map((i) => ({ ...i, _id: String(i._id) })));
}));

router.post('/suppliers', protect, requireAdmin, asyncHandler(async (req, res) => {
  const doc = (await Supplier.insertMany([req.body || {}]))[0];
  return res.status(201).json({ ...doc, _id: String(doc._id) });
}));

router.put('/suppliers/:supplierId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const oid = parseOid(req.params.supplierId, 'supplier ID');
  const result = await replaceFarmRecord(Supplier, oid, req.body || {});
  if (!result.matchedCount) return notFound(res, 'Supplier not found');
  return res.json({ status: 'ok' });
}));

router.delete('/suppliers/:supplierId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const supplierId = req.params.supplierId;
  await Supplier.deleteOne({ _id: parseOid(supplierId, 'supplier ID') });
  await SupplierPayment.deleteMany({ supplier_id: supplierId });
  return res.json({ status: 'ok' });
}));

router.get('/suppliers/payments/all', protect, requireAdmin, asyncHandler(async (_req, res) => {
  const items = await SupplierPayment.find({}).limit(100000);
  return res.json(items.map((i) => ({ ...i, _id: String(i._id) })));
}));

router.post('/suppliers/:supplierId/payments', protect, requireAdmin, asyncHandler(async (req, res) => {
  const supplierId = req.params.supplierId;
  const amount = Number(req.body?.amount || 0);
  if (amount <= 0) return badRequest(res, 'Amount must be more than 0');
  const sup = await Supplier.findOne({ _id: parseOid(supplierId, 'supplier ID') });
  if (!sup) return notFound(res, 'Supplier not found');
  const payload = { ...(req.body || {}), supplier_id: supplierId };
  const doc = (await SupplierPayment.insertMany([payload]))[0];
  return res.status(201).json({ ...doc, _id: String(doc._id) });
}));

router.put('/suppliers/:supplierId/payments/:paymentId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const paymentId = parseOid(req.params.paymentId, 'payment ID');
  const row = await SupplierPayment.findOne({ _id: paymentId });
  if (!row) return notFound(res, 'Payment not found');
  const body = req.body || {};
  const payload = {};
  if (body.amount !== undefined) {
    const amount = Number(body.amount || 0);
    if (amount <= 0) return badRequest(res, 'Amount must be more than 0');
    payload.amount = amount;
  }
  if (body.date !== undefined) {
    if (!/\d{4}-\d{2}-\d{2}/.test(String(body.date))) return badRequest(res, 'Invalid date');
    payload.date = String(body.date);
  }
  if (body.note !== undefined) payload.note = String(body.note || '');
  if (body.notes !== undefined) payload.notes = String(body.notes || '');
  await SupplierPayment.updateOne({ _id: paymentId }, { $set: payload });
  return res.json({ ...row, ...payload, _id: String(row._id) });
}));

router.delete('/suppliers/:supplierId/payments/:paymentId', protect, requireAdmin, asyncHandler(async (req, res) => {
  await SupplierPayment.deleteOne({ _id: parseOid(req.params.paymentId, 'payment ID') });
  return res.json({ status: 'ok' });
}));

export default router;
