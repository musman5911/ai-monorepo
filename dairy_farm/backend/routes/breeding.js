// ─── Gaabh (breeding) calendar API ───────────────────────────────
// Read-only: everything is computed from breeding fields that already
// live on the Cow record. Updates happen through the existing
// PUT /api/cows/:id (admin) — this route adds no new writes.
import express from 'express';
const router = express.Router();
import { protect } from '../middleware/auth.js';
import { Cow } from '../db.js';
import { todayStr } from '../utils/date.js';
import { computeBreeding, breedingReminders } from '../services/breeding.js';

// GET /api/breeding?horizon=30 → { today, cows: [...], reminders: [...] }
router.get('/', protect, async (req, res) => {
  try {
    const today = todayStr();
    const horizon = Math.min(120, Math.max(7, Number(req.query.horizon) || 30));
    const cows = await Cow.find();
    const list = [];
    for (const cow of cows) {
      const b = computeBreeding(cow, today);
      if (b) list.push(b);
    }
    res.json({ today, horizon, cows: list, reminders: breedingReminders(cows, today, horizon) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
