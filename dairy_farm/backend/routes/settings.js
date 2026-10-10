// ─── Farm settings (location for weather widget) ───────────────────
// GET  /api/settings/location — open (no auth), used by weather widget
// PUT  /api/settings/location — admin only, saves lat/lon/city
import express from 'express';
import { Meta } from '../db.js';
import { protect, adminOnly } from '../middleware/auth.js';
const router = express.Router();

router.get('/location', async (req, res) => {
  try {
    const doc = await Meta.findOne({ key: 'farm_location' });
    const value = (doc && doc.value) || {};
    res.json({
      raw_dms: value.raw_dms || '',
      lat: value.lat,
      lon: value.lon,
      city: value.city || '',
    });
  } catch {
    res.json({});
  }
});

router.put('/location', protect, adminOnly, async (req, res) => {
  try {
    const rawDms = String(req.body?.raw_dms || '').trim();
    const lat = req.body?.lat;
    const lon = req.body?.lon;
    const city = String(req.body?.city || '').trim();
    if (lat == null || lon == null) {
      return res.status(400).json({ error: 'Latitude and longitude are required.' });
    }
    await Meta.findOneAndUpdate(
      { key: 'farm_location' },
      { $set: { key: 'farm_location', value: { raw_dms: rawDms, lat, lon, city } } },
      { upsert: true, new: true }
    );
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save location.' });
  }
});

export default router;
