import { randomUUID } from 'crypto';
import express from 'express';
const router = express.Router();
import { Expense, Health, Cow } from '../db.js';
import { protect, adminOnly, workerOrAdmin } from '../middleware/auth.js';
import {
  readString,
  readDate,
  readNonNegativeNumber,
  readEnum,
  sendValidationError,
  parsePagination,
  applyPagination,
} from './input.js';

function expensePayload(body, { requireBasics = false } = {}) {
  const errors = [];
  const payload = {};

  const cowId = body.cowId === null ? null : readString(body, 'cowId', errors);
  if (cowId !== undefined) payload.cowId = cowId || null;
  const date = readDate(body, 'date', errors, { required: requireBasics });
  if (date !== undefined) payload.date = date;
  const type = readEnum(body, 'type', ['feed', 'medicine', 'misc', 'equipment', 'labor', 'purchasing'], errors, { required: requireBasics });
  if (type !== undefined) payload.type = type;
  const amount = readNonNegativeNumber(body, 'amount', errors, { required: requireBasics });
  if (amount !== undefined) payload.amount = amount;
  const note = readString(body, 'note', errors);
  if (note !== undefined) payload.note = note;
  // Feed stock: optional kg on feed purchases (drives the dashboard stock card).
  const feedKg = readNonNegativeNumber(body, 'feedKg', errors);
  if (feedKg !== undefined) payload.feedKg = feedKg;
  // Supplier khata: optional dealer id ('' clears the link).
  const supplierId = readString(body, 'supplierId', errors);
  if (supplierId !== undefined) payload.supplierId = supplierId;
  // Receipt photo: compressed base64 data-URL from the client (or '' to remove).
  if (typeof body.receiptBase64 === 'string') {
    if (body.receiptBase64.length > 400000) errors.push('receipt photo is too large');
    else if (body.receiptBase64 === '' || body.receiptBase64.startsWith('data:image/')) payload.receiptBase64 = body.receiptBase64;
    else errors.push('receipt photo must be an image');
  }

  return { payload, errors };
}

router.get('/', protect, async (req, res) => {
  try {
    const filter = {};
    if (req.query.cowId) filter.cowId = req.query.cowId;
    if (req.query.type) filter.type = req.query.type;
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = req.query.from;
      if (req.query.to) filter.date.$lte = req.query.to;
    }
    const pagination = parsePagination(req.query);
    const rows = await applyPagination(Expense.find(filter).sort({ date: -1 }), pagination);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', protect, workerOrAdmin, async (req, res) => {
  try {
    const { payload, errors } = expensePayload(req.body, { requireBasics: true });
    if (errors.length) return sendValidationError(res, errors);
    const id = randomUUID();
    const exp = await Expense.create({ ...payload, _id: id });
    res.status(201).json(exp);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', protect, workerOrAdmin, async (req, res) => {
  try {
    const { payload, errors } = expensePayload(req.body);
    if (errors.length) return sendValidationError(res, errors);
    const exp = await Expense.findByIdAndUpdate(req.params.id, { $set: payload }, { new: true });
    if (!exp) return res.status(404).json({ error: 'Not found' });

    // Sync back to health records or cow if there is an association
    if (exp._healthId && payload.amount !== undefined) {
      await Health.findByIdAndUpdate(exp._healthId, { $set: { cost: payload.amount } });
    }
    if (exp._purchaseCowId && payload.amount !== undefined) {
      await Cow.findByIdAndUpdate(exp._purchaseCowId, { $set: { purchasePrice: payload.amount } });
    }

    res.json(exp);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const exp = await Expense.findById(req.params.id);
    if (!exp) return res.status(404).json({ error: 'Not found' });

    if (exp._healthId) {
      await Health.findByIdAndUpdate(exp._healthId, { $set: { cost: 0 } });
    }
    if (exp._purchaseCowId) {
      await Cow.findByIdAndUpdate(exp._purchaseCowId, { $set: { purchasePrice: 0 } });
    }

    await exp.deleteOne();
    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
