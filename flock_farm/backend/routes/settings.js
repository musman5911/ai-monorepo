// ─── Farm settings (location for weather widget) ───────────────────
// GET  /api/settings/location — open (no auth), used by weather widget
// PUT  /api/settings/location — admin only, saves lat/lon/city
import express from 'express';
import DataStore from '../models/DataStore.js';
import { authRequired, requireRole } from '../middleware/auth.js';
const router = express.Router();

router.get('/location', authRequired, async (req, res) => {
  try {
    const doc = await DataStore.findOne({ key: 'farm_location' });
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

router.put('/location', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const rawDms = String(req.body?.raw_dms || '').trim();
    const lat = req.body?.lat;
    const lon = req.body?.lon;
    const city = String(req.body?.city || '').trim();
    if (lat == null || lon == null) {
      return res.status(400).json({ error: 'Latitude and longitude are required.' });
    }
    await DataStore.findOneAndUpdate(
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
