// ─── Supplier khata (dealers the farm buys from on credit) ───────
// Mirrors routes/buyers.js: suppliers CRUD + payments made to each
// supplier. Purchases are NOT stored here — they are the existing
// Expense records tagged with supplierId, so nothing is counted twice.
import { randomUUID } from 'crypto';
import express from 'express';
const router = express.Router();
import { Supplier, SupplierPayment } from '../db.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { readString, readNonNegativeNumber, sendValidationError } from './input.js';

function supplierPayload(body, { requireBasics = false } = {}) {
  const errors = [];
  const payload = {};
  const name = readString(body, 'name', errors, { required: requireBasics, allowEmpty: false });
  if (name !== undefined) payload.name = name;
  ['phone', 'address', 'notes'].forEach((field) => {
    const value = readString(body, field, errors);
    if (value !== undefined) payload[field] = value;
  });
  return { payload, errors };
}

router.get('/', protect, async (req, res) => {
  try { res.json(await Supplier.find().sort({ name: 1 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { payload, errors } = supplierPayload(req.body, { requireBasics: true });
    if (errors.length) return sendValidationError(res, errors);
    const supplier = await Supplier.create({ ...payload, _id: randomUUID() });
    res.status(201).json(supplier);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { payload, errors } = supplierPayload(req.body);
    if (errors.length) return sendValidationError(res, errors);
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, { $set: payload }, { new: true });
    if (!supplier) return res.status(404).json({ error: 'Not found' });
    res.json(supplier);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Supplier.findByIdAndDelete(req.params.id);
    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Payments made to the supplier ────────────────────────────────
router.get('/:id/payments', protect, async (req, res) => {
  try {
    const all = await SupplierPayment.find({ supplierId: req.params.id });
    const rows = all
      .map(p => (p.toObject ? p.toObject() : p))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// All payments in one call (for the balances list on the khata card).
router.get('/payments/all', protect, async (req, res) => {
  try {
    const all = await SupplierPayment.find();
    res.json(all.map(p => (p.toObject ? p.toObject() : p)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/payments', protect, adminOnly, async (req, res) => {
  try {
    const errors = [];
    const date = readString(req.body, 'date', errors, { required: true, allowEmpty: false });
    const amount = readNonNegativeNumber(req.body, 'amount', errors, { required: true });
    const note = readString(req.body, 'note', errors);
    if (errors.length) return sendValidationError(res, errors);
    if (!(amount > 0)) return res.status(400).json({ error: 'Amount must be more than 0' });
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    const payment = await SupplierPayment.create({
      _id: randomUUID(), supplierId: req.params.id, date, amount, note: note || '',
    });
    res.status(201).json(payment);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/payments/:paymentId', protect, adminOnly, async (req, res) => {
  try {
    const errors = [];
    const payment = await SupplierPayment.findById(req.params.paymentId);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (req.body.date !== undefined) payment.date = readString(req.body, 'date', errors, { required: true, allowEmpty: false });
    if (req.body.amount !== undefined) {
      const amount = readNonNegativeNumber(req.body, 'amount', errors, { required: true });
      if (!(amount > 0)) return res.status(400).json({ error: 'Amount must be more than 0' });
      payment.amount = amount;
    }
    if (req.body.note !== undefined) payment.note = readString(req.body, 'note', errors) || '';
    if (errors.length) return sendValidationError(res, errors);
    await payment.save();
    res.json(payment);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id/payments/:paymentId', protect, adminOnly, async (req, res) => {
  try {
    await SupplierPayment.findByIdAndDelete(req.params.paymentId);
    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
