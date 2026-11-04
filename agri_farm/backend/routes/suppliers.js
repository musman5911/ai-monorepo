// ─── Supplier khata (dealers the farm buys from on credit) ──────────────────
// Purchases are the existing finance expenses tagged with supplier_id (set
// in the expense form) so nothing is counted twice; payments made to the
// supplier live in their own collection. Balance = purchases - payments.
import express from 'express';
import { Supplier, SupplierPayment } from '../db.js';
import { protect, requireAdmin } from '../middleware/auth.js';
import { badRequest, notFound, parseOid, asyncHandler, replaceFarmRecord } from '../utils/helpers.js';
import { todayStr } from '../utils/date.js';
import { normalizeSupplierInput, normalizeSupplierPaymentInput } from '../record-validation.mjs';

const router = express.Router();

router.get('/suppliers', protect, requireAdmin, asyncHandler(async (_req, res) => {
  const items = await Supplier.find({}).limit(10000);
  return res.json(items.map((i) => ({ ...i, _id: String(i._id) })));
}));

router.post('/suppliers', protect, requireAdmin, asyncHandler(async (req, res) => {
  const normalized = normalizeSupplierInput(req.body || {});
  if (normalized.error) return badRequest(res, normalized.error);
  const doc = (await Supplier.insertMany([normalized.value]))[0];
  return res.status(201).json({ ...doc, _id: String(doc._id) });
}));

router.put('/suppliers/:supplierId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const oid = parseOid(req.params.supplierId, 'supplier ID');
  const normalized = normalizeSupplierInput(req.body || {});
  if (normalized.error) return badRequest(res, normalized.error);
  const result = await replaceFarmRecord(Supplier, oid, normalized.value);
  if (!result.matchedCount) return notFound(res, 'Supplier not found');
  return res.json({ status: 'ok' });
}));

router.delete('/suppliers/:supplierId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const supplierId = req.params.supplierId;
  const result = await Supplier.deleteOne({ _id: parseOid(supplierId, 'supplier ID') });
  if (!result.deletedCount) return notFound(res, 'Supplier not found');
  await SupplierPayment.deleteMany({ supplier_id: supplierId });
  return res.json({ status: 'ok' });
}));

router.get('/suppliers/payments/all', protect, requireAdmin, asyncHandler(async (_req, res) => {
  const items = await SupplierPayment.find({}).limit(100000);
  return res.json(items.map((i) => ({ ...i, _id: String(i._id) })));
}));

router.post('/suppliers/:supplierId/payments', protect, requireAdmin, asyncHandler(async (req, res) => {
  const supplierId = req.params.supplierId;
  const supplierOid = parseOid(supplierId, 'supplier ID');
  const sup = await Supplier.findOne({ _id: supplierOid });
  if (!sup) return notFound(res, 'Supplier not found');
  const normalized = normalizeSupplierPaymentInput(req.body || {}, { defaultDate: todayStr() });
  if (normalized.error) return badRequest(res, normalized.error);
  const doc = (await SupplierPayment.insertMany([{ ...normalized.value, supplier_id: String(sup._id) }]))[0];
  return res.status(201).json({ ...doc, _id: String(doc._id) });
}));

router.put('/suppliers/:supplierId/payments/:paymentId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const supplierId = parseOid(req.params.supplierId, 'supplier ID');
  const paymentId = parseOid(req.params.paymentId, 'payment ID');
  const supplier = await Supplier.findOne({ _id: supplierId });
  if (!supplier) return notFound(res, 'Supplier not found');
  const row = await SupplierPayment.findOne({ _id: paymentId, supplier_id: String(supplier._id) });
  if (!row) return notFound(res, 'Payment not found');
  const normalized = normalizeSupplierPaymentInput(req.body || {}, { defaultDate: row.date || todayStr() });
  if (normalized.error) return badRequest(res, normalized.error);
  const result = await SupplierPayment.updateOne(
    { _id: paymentId, supplier_id: String(supplier._id) },
    { $set: normalized.value },
  );
  if (!result.matchedCount) return notFound(res, 'Payment not found');
  return res.json({ ...row, ...normalized.value, _id: String(row._id) });
}));

router.delete('/suppliers/:supplierId/payments/:paymentId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const supplierId = parseOid(req.params.supplierId, 'supplier ID');
  const paymentId = parseOid(req.params.paymentId, 'payment ID');
  const result = await SupplierPayment.deleteOne({ _id: paymentId, supplier_id: supplierId });
  if (!result.deletedCount) return notFound(res, 'Payment not found');
  return res.json({ status: 'ok' });
}));

export default router;
