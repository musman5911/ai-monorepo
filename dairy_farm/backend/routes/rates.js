import express from 'express';
const router = express.Router();
import { Rate, RateHistory } from '../db.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { todayStr } from '../utils/date.js';
import { readPositiveNumber, sendValidationError } from './input.js';

async function getOrCreateRate() {
  let rate = await Rate.findById('1');
  if (!rate) {
    rate = await Rate.create({ _id: '1', value: 130, date: todayStr() });
  }
  return rate;
}

router.get('/', protect, async (req, res) => {
  try {
    res.json(await getOrCreateRate());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/1', protect, async (req, res) => {
  try {
    res.json(await getOrCreateRate());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/1', protect, adminOnly, async (req, res) => {
  try {
    const errors = [];
    const value = readPositiveNumber(req.body || {}, 'value', errors, { required: true });
    if (errors.length) return sendValidationError(res, errors);

    const old = await Rate.findById('1');
    const now = todayStr();

    // Save previous rate into history (keep the date the old rate started)
    if (old && Number(old.value) !== Number(value)) {
      await RateHistory.create({
        _id: 'rh' + Date.now(),
        value: old.value,
        date: old.date || now,
        note: `Changed from ${old.value} to ${value}`
      });
    }

    const rate = await Rate.findByIdAndUpdate(
      '1',
      { value, date: now },
      { new: true, upsert: true }
    );
    res.json(rate);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/history', protect, async (req, res) => {
  try {
    // Keep a long history so multi-year revenue calculations stay accurate
    res.json(await RateHistory.find().sort({ date: -1 }).limit(500));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
