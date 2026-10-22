import { randomUUID } from 'crypto';
import express from 'express';
const router = express.Router();
import { Buyer, BuyerPayment } from '../db.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { readString, readNonNegativeNumber, sendValidationError } from './input.js';

function buyerPayload(body, { requireBasics = false } = {}) {
  const errors = [];
  const payload = {};
  const name = readString(body, 'name', errors, { required: requireBasics, allowEmpty: false });
  if (name !== undefined) payload.name = name;
  ['phone', 'address', 'notes'].forEach((field) => {
    const value = readString(body, field, errors);
    if (value !== undefined) payload[field] = value;
  });
  const defaultRate = readNonNegativeNumber(body, 'defaultRate', errors);
  if (defaultRate !== undefined) payload.defaultRate = defaultRate;
  return { payload, errors };
}

router.get('/', protect, async (req, res) => {
  try { res.json(await Buyer.find().sort({ name: 1 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { payload, errors } = buyerPayload(req.body, { requireBasics: true });
    if (errors.length) return sendValidationError(res, errors);
    const id = randomUUID();
    const buyer = await Buyer.create({ ...payload, _id: id });
    res.status(201).json(buyer);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { payload, errors } = buyerPayload(req.body);
    if (errors.length) return sendValidationError(res, errors);
    const buyer = await Buyer.findByIdAndUpdate(req.params.id, { $set: payload }, { new: true });
    if (!buyer) return res.status(404).json({ error: 'Not found' });
    res.json(buyer);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Buyer.findByIdAndDelete(req.params.id);
    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Udhaar payments (buyer khata) ────────────────────────────────────────────
router.get('/:id/payments', protect, async (req, res) => {
  try {
    const all = await BuyerPayment.find({ buyerId: req.params.id });
    const rows = all
      .map(p => (p.toObject ? p.toObject() : p))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/payments', protect, async (req, res) => {
  try {
    const errors = [];
    const date = readString(req.body, 'date', errors, { required: true, allowEmpty: false });
    const amount = readNonNegativeNumber(req.body, 'amount', errors, { required: true });
    const note = readString(req.body, 'note', errors);
    if (errors.length) return sendValidationError(res, errors);
    if (!(amount > 0)) return res.status(400).json({ error: 'Amount must be more than 0' });
    const buyer = await Buyer.findById(req.params.id);
    if (!buyer) return res.status(404).json({ error: 'Buyer not found' });
    const payment = await BuyerPayment.create({
      _id: randomUUID(), buyerId: req.params.id, date, amount, note: note || '',
    });
    res.status(201).json(payment);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/payments/:paymentId', protect, adminOnly, async (req, res) => {
  try {
    const errors = [];
    const payment = await BuyerPayment.findById(req.params.paymentId);
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
    await BuyerPayment.findByIdAndDelete(req.params.paymentId);
    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
