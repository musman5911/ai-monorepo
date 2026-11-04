import express from 'express';
import { DiaryMedia } from '../db.js';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../utils/helpers.js';
import { cleanupOrphanPhotoAssets } from '../services/photo-assets.js';
import { normalizeDiaryEntries, normalizeDiaryPhotos, normalizeDiaryMediaUpdate } from '../diary-media-validation.mjs';
const router = express.Router();

// Diary records and their attachments live in the farm database, not just UI state.
router.get('/diary-media/entries', protect, asyncHandler(async (_req, res) => {
  const records = await DiaryMedia.find({}).sort({ date: -1 });
  const entries = [];
  for (const record of records || []) {
    if (Array.isArray(record.entries) && record.entries.length) {
      const safe = normalizeDiaryEntries(record.entries, String(record.date || ''));
      if (safe.value) entries.push(...safe.value);
    } else if (Array.isArray(record.photos) && record.photos.length) {
      const safePhotos = normalizeDiaryPhotos(record.photos, String(record.date || ''));
      if (safePhotos.value) entries.push({ id: 'legacy-photo-' + record.date, date: record.date, note: '', photos: safePhotos.value, createdAt: String(record.updatedAt || record.date || ''), updatedAt: '' });
    }
  }
  entries.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return res.json({ entries });
}));

router.get('/diary-media/:date', protect, asyncHandler(async (req, res) => {
  const date = String(req.params.date || '');
  if (!validDate(date)) return res.status(400).json({ error: 'Invalid diary date' });
  const record = await DiaryMedia.findOne({ date });
  const photos = normalizeDiaryPhotos(Array.isArray(record?.photos) ? record.photos : [], date);
  const entries = normalizeDiaryEntries(Array.isArray(record?.entries) ? record.entries : [], date);
  return res.json({ date, photos: photos.value || [], entries: entries.value || [] });
}));

router.put('/diary-media/:date', protect, asyncHandler(async (req, res) => {
  const date = String(req.params.date || '');
  const normalized = normalizeDiaryMediaUpdate(req.body || {}, date);
  if (normalized.error) return res.status(400).json({ error: normalized.error });
  await DiaryMedia.updateOne({ date }, { $set: normalized.value }, { upsert: true });
  const saved = await DiaryMedia.findOne({ date });
  if (req.body?.photos !== undefined || req.body?.entries !== undefined) try { await cleanupOrphanPhotoAssets(); } catch (cleanupError) { console.error('[photos] orphan cleanup deferred:', cleanupError); }
  const photos = normalizeDiaryPhotos(Array.isArray(saved?.photos) ? saved.photos : [], date);
  const entries = normalizeDiaryEntries(Array.isArray(saved?.entries) ? saved.entries : [], date);
  return res.json({ date, photos: photos.value || [], entries: entries.value || [] });
}));
export default router;