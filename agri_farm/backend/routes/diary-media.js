import express from 'express';
import { DiaryMedia } from '../db.js';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../utils/helpers.js';
import { cleanupOrphanPhotoAssets } from '../services/photo-assets.js';
const router = express.Router();

const validDate = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date);
const safePhoto = (p, date) => ({
  id: String(p?.id || ''),
  date,
  data: typeof p?.data === 'string' ? p.data : '',
  bytes: Math.max(0, Number(p?.bytes) || 0),
  createdAt: String(p?.createdAt || ''),
});
function safeEntries(entries, date) {
  if (!Array.isArray(entries) || entries.length > 100) return null;
  const result = entries.map((entry) => {
    const photos = Array.isArray(entry?.photos) ? entry.photos.map((p) => safePhoto(p, date)) : [];
    const linked = entry?.linkedEntity && typeof entry.linkedEntity === 'object' ? {
      id: String(entry.linkedEntity.id || ''),
      type: String(entry.linkedEntity.type || ''),
      label: String(entry.linkedEntity.label || ''),
    } : null;
    return {
      id: String(entry?.id || ''),
      date,
      note: typeof entry?.note === 'string' ? entry.note.slice(0, 50000) : '',
      photos,
      voiceBase64: typeof entry?.voiceBase64 === 'string' ? entry.voiceBase64 : undefined,
      linkedEntity: linked,
      createdAt: String(entry?.createdAt || ''),
      updatedAt: String(entry?.updatedAt || ''),
    };
  });
  if (result.some((e) => !e.id || e.photos.length > 10 ||
    e.photos.some((p) => !p.id || !(p.data.startsWith('data:image/jpeg;base64,') || (p.data.startsWith('/api/images/') || /^\/api\/photos\/[a-f0-9]{24}$/i.test(p.data)) || /^https?:\/\//i.test(p.data)) || p.data.length > 230000) ||
    (e.voiceBase64 && e.voiceBase64.length > 1500000))) return null;
  return result;
}

// Diary records and their attachments live in the farm database, not just UI state.
router.get('/diary-media/entries', protect, asyncHandler(async (_req, res) => {
  const records = await DiaryMedia.find({}).sort({ date: -1 });
  const entries = [];
  for (const record of records || []) {
    if (Array.isArray(record.entries) && record.entries.length) {
      entries.push(...record.entries);
    } else if (Array.isArray(record.photos) && record.photos.length) {
      entries.push({ id: 'legacy-photo-' + record.date, date: record.date, note: '', photos: record.photos, createdAt: String(record.updatedAt || record.date || '') });
    }
  }
  entries.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return res.json({ entries });
}));

router.get('/diary-media/:date', protect, asyncHandler(async (req, res) => {
  const date = String(req.params.date || '');
  if (!validDate(date)) return res.status(400).json({ error: 'Invalid diary date' });
  const record = await DiaryMedia.findOne({ date });
  return res.json({ date, photos: Array.isArray(record?.photos) ? record.photos : [], entries: Array.isArray(record?.entries) ? record.entries : [] });
}));

router.put('/diary-media/:date', protect, asyncHandler(async (req, res) => {
  const date = String(req.params.date || '');
  if (!validDate(date)) return res.status(400).json({ error: 'Invalid diary date' });
  const update = { date };
  if (req.body?.photos !== undefined) {
    const photos = req.body.photos;
    if (!Array.isArray(photos) || photos.length > 10) return res.status(400).json({ error: 'Photos must be an array with at most 10 items' });
    const safePhotos = photos.map((p) => safePhoto(p, date));
    if (safePhotos.some((p) => !p.id || !(p.data.startsWith('data:image/jpeg;base64,') || (p.data.startsWith('/api/images/') || /^\/api\/photos\/[a-f0-9]{24}$/i.test(p.data)) || /^https?:\/\//i.test(p.data)) || p.data.length > 230000)) {
      return res.status(400).json({ error: 'Each diary photo must be a compressed image under 160 KB' });
    }
    update.photos = safePhotos;
  }
  if (req.body?.entries !== undefined) {
    const entries = safeEntries(req.body.entries, date);
    if (!entries) return res.status(400).json({ error: 'Diary entries or attachments are invalid or too large' });
    update.entries = entries;
  }
  await DiaryMedia.updateOne({ date }, { $set: update }, { upsert: true });
  const saved = await DiaryMedia.findOne({ date });
  if (req.body?.photos !== undefined || req.body?.entries !== undefined) try { await cleanupOrphanPhotoAssets(); } catch (cleanupError) { console.error('[photos] orphan cleanup deferred:', cleanupError); }
  return res.json({ date, photos: Array.isArray(saved?.photos) ? saved.photos : [], entries: Array.isArray(saved?.entries) ? saved.entries : [] });
}));
export default router;