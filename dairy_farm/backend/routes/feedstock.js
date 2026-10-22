// Feed stock settings (assumed daily use + low-stock threshold) stored in Meta.
// The stock itself is computed on the client from feed expenses with feedKg,
// using the shared muf-feedstock twin (same estimate as the flock app).
import express from 'express';
const router = express.Router();
import { Meta } from '../db.js';
import { protect, adminOnly } from '../middleware/auth.js';

const KEY = 'feed_stock_settings';
const DEFAULTS = { dailyUseKg: 0, lowStockDays: 14 };

router.get('/settings', protect, async (_req, res) => {
  try {
    const doc = await Meta.findOne({ key: KEY });
    res.json({ ...DEFAULTS, ...(doc && doc.value ? doc.value : {}) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/settings', protect, adminOnly, async (req, res) => {
  try {
    const dailyUseKg = Math.max(0, Number(req.body && req.body.dailyUseKg) || 0);
    const lowStockDays = Math.max(1, Number(req.body && req.body.lowStockDays) || 14);
    const value = { dailyUseKg, lowStockDays };
    const doc = await Meta.findOne({ key: KEY });
    if (doc) { doc.value = value; await doc.save(); }
    else await Meta.create({ key: KEY, value });
    res.json(value);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
