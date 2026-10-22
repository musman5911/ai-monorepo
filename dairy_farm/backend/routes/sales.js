import { randomUUID } from 'crypto';
import express from 'express';
const router = express.Router();
import { Sale, Cow } from '../db.js';
import { protect, adminOnly } from '../middleware/auth.js';
import {
  readString,
  readDate,
  readNonNegativeNumber,
  sendValidationError,
} from './input.js';

function salePayload(body, { requireBasics = false } = {}) {
  const errors = [];
  const payload = {};

  const cowId = readString(body, 'cowId', errors, { required: requireBasics, allowEmpty: false });
  if (cowId !== undefined) payload.cowId = cowId;
  const date = readDate(body, 'date', errors, { required: requireBasics });
  if (date !== undefined) payload.date = date;
  const salePrice = readNonNegativeNumber(body, 'salePrice', errors, { required: requireBasics });
  if (salePrice !== undefined) payload.salePrice = salePrice;
  ['buyer', 'notes'].forEach((field) => {
    const value = readString(body, field, errors);
    if (value !== undefined) payload[field] = value;
  });

  return { payload, errors };
}

router.get('/', protect, async (req, res) => {
  try {
    const filter = {};
    if (req.query.cowId) filter.cowId = req.query.cowId;
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = req.query.from;
      if (req.query.to) filter.date.$lte = req.query.to;
    }
    res.json(await Sale.find(filter).sort({ date: -1 }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { payload, errors } = salePayload(req.body, { requireBasics: true });
    if (errors.length) return sendValidationError(res, errors);

    const id = randomUUID();
    const cow = await Cow.findById(payload.cowId);
    if (!cow) return res.status(404).json({ error: 'Cow not found' });
    if (cow.status === 'sold') return res.status(400).json({ error: `${cow.name} is already marked as sold` });

    // Prevent a second open sale record for the same cow
    const existingSale = await Sale.findOne({ cowId: payload.cowId });
    if (existingSale) {
      return res.status(400).json({ error: `${cow.name} already has a sale record` });
    }

    const previousStatus = cow.status;
    const sale = await Sale.create({ ...payload, _id: id, previousStatus });

    cow.status = 'sold';
    await cow.save();

    res.status(201).json(sale);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { payload, errors } = salePayload(req.body);
    if (errors.length) return sendValidationError(res, errors);

    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Not found' });

    // If cowId is changing, restore old cow and mark new cow as sold
    if (payload.cowId && payload.cowId !== sale.cowId) {
      const newCow = await Cow.findById(payload.cowId);
      if (!newCow) return res.status(404).json({ error: 'Cow not found' });
      if (newCow.status === 'sold') {
        return res.status(400).json({ error: `${newCow.name} is already marked as sold` });
      }
      const otherSale = await Sale.findOne({ cowId: payload.cowId, _id: { $ne: sale._id } });
      if (otherSale) {
        return res.status(400).json({ error: `${newCow.name} already has a sale record` });
      }

      const oldCow = await Cow.findById(sale.cowId);
      if (oldCow && oldCow.status === 'sold') {
        oldCow.status = sale.previousStatus || 'active';
        await oldCow.save();
      }

      payload.previousStatus = newCow.status;
      newCow.status = 'sold';
      await newCow.save();
    }

    Object.assign(sale, payload);
    await sale.save();
    res.json(sale);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Not found' });
    await sale.deleteOne();

    if (sale.cowId) {
      const cow = await Cow.findById(sale.cowId);
      if (cow && cow.status === 'sold') {
        cow.status = sale.previousStatus || 'active';
        await cow.save();
      }
    }

    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
