import express from 'express';
import { DiaryMedia } from '../db.js';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../utils/helpers.js';
const router = express.Router();
router.get('/diary-media/:date', protect, asyncHandler(async (req, res) => {
  const date = String(req.params.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Invalid diary date' });
  const record = await DiaryMedia.findOne({ date });
  return res.json({ date, photos: Array.isArray(record?.photos) ? record.photos : [] });
}));
router.put('/diary-media/:date', protect, asyncHandler(async (req, res) => {
  const date = String(req.params.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Invalid diary date' });
  const photos = req.body?.photos;
  if (!Array.isArray(photos) || photos.length > 10) return res.status(400).json({ error: 'Photos must be an array with at most 10 items' });
  const safePhotos = photos.map((p) => ({ id: String(p?.id || ''), date, data: typeof p?.data === 'string' && p.data.startsWith('data:image/jpeg;base64,') ? p.data : '', bytes: Math.max(0, Number(p?.bytes) || 0), createdAt: String(p?.createdAt || '') }));
  if (safePhotos.some((p) => !p.id || !p.data || p.data.length > 230000)) return res.status(400).json({ error: 'Each diary photo must be a compressed JPEG under 160 KB' });
  // updateOne + upsert works on real MongoDB and on the in-memory demo store (same pattern as automations.js)
  await DiaryMedia.updateOne({ date }, { $set: { date, photos: safePhotos } }, { upsert: true });
  return res.json({ date, photos: safePhotos });
}));
export default router;
