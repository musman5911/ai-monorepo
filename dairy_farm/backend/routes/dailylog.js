import express from 'express';
const router = express.Router();
import { DailyLog } from '../db.js';
import { protect } from '../middleware/auth.js';
import { cleanupOrphanPhotoAssets } from '../services/photo-assets.js';

// Load all independent diary notes across dates. Older daily-log text/photos are
// exposed as a legacy entry until the user edits/saves them into diaryEntries.
router.get('/entries', protect, async (req, res) => {
  try {
    const logs = await DailyLog.find({}).sort({ date: -1 });
    const entries = [];
    for (const log of logs || []) {
      if (Array.isArray(log.diaryEntries) && log.diaryEntries.length) {
        entries.push(...log.diaryEntries);
      } else if (log.notes || (Array.isArray(log.photos) && log.photos.length) || (Array.isArray(log.voiceNotes) && log.voiceNotes.length)) {
        entries.push({
          id: 'legacy-' + log.date,
          date: log.date,
          note: log.notes || '',
          photos: Array.isArray(log.photos) ? log.photos : [],
          voiceBase64: Array.isArray(log.voiceNotes) && log.voiceNotes.length ? log.voiceNotes[0].base64 : undefined,
          createdAt: String(log.updatedAt || log.date || ''),
        });
      }
    }
    entries.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    res.json({ entries });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/dailylog/:date -> one daily log (existing checklist API preserved)
router.get('/:date', protect, async (req, res) => {
  try {
    const log = await DailyLog.findOne({ date: req.params.date });
    if (!log) {
      return res.json({ _id: req.params.date, date: req.params.date, checklist: [], notes: '', voiceNotes: [], photos: [], diaryEntries: [] });
    }
    res.json(log);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/dailylog/:date -> upsert (create if missing, update if exists)
// Both admin and worker can save — this is day-to-day operational input.
router.put('/:date', protect, async (req, res) => {
  try {
    const { checklist, notes, voiceNotes, photos, diaryEntries } = req.body;
    const update = { date: req.params.date };
    if (diaryEntries !== undefined) {
      if (!Array.isArray(diaryEntries) || diaryEntries.length > 100) {
        return res.status(400).json({ error: 'diaryEntries must be an array with at most 100 notes per day' });
      }
      const safeEntries = diaryEntries.map((entry) => ({
        id: String(entry?.id || ''),
        date: req.params.date,
        note: typeof entry?.note === 'string' ? entry.note.slice(0, 50000) : '',
        photos: Array.isArray(entry?.photos) ? entry.photos.map((photo) => ({
          id: String(photo?.id || ''),
          date: req.params.date,
          data: typeof photo?.data === 'string' ? photo.data : '',
          bytes: Math.max(0, Number(photo?.bytes) || 0),
          createdAt: String(photo?.createdAt || ''),
        })) : [],
        voiceBase64: typeof entry?.voiceBase64 === 'string' ? entry.voiceBase64 : undefined,
        linkedEntity: entry?.linkedEntity && typeof entry.linkedEntity === 'object' ? {
          id: String(entry.linkedEntity.id || ''),
          type: String(entry.linkedEntity.type || ''),
          label: String(entry.linkedEntity.label || ''),
        } : null,
        createdAt: String(entry?.createdAt || ''),
        updatedAt: String(entry?.updatedAt || ''),
      }));
      if (safeEntries.some((entry) => !entry.id || entry.photos.length > 10 ||
        entry.photos.some((photo) => !photo.id || !photo.data || photo.data.length > 230000) ||
        (entry.voiceBase64 && entry.voiceBase64.length > 1500000))) {
        return res.status(400).json({ error: 'Diary note attachments are invalid or too large' });
      }
      update.diaryEntries = safeEntries;
    }
    if (checklist !== undefined) update.checklist = checklist;
    if (notes !== undefined) update.notes = notes;
    if (photos !== undefined) {
      if (!Array.isArray(photos) || photos.length > 10) return res.status(400).json({ error: 'photos is limited to 10 per day' });
      const safePhotos = photos.map((p) => ({ id: String(p.id || ''), date: req.params.date, data: typeof p.data === 'string' && (p.data.startsWith('data:image/jpeg;base64,') || /^\/api\/photos\/[a-f0-9]{24}$/i.test(p.data)) ? p.data : '', bytes: Math.max(0, Number(p.bytes) || 0), createdAt: String(p.createdAt || '') }));
      if (safePhotos.some((p) => !p.id || !p.data || p.data.length > 230000)) return res.status(400).json({ error: 'Each diary photo must be a compressed JPEG under 160 KB' });
      update.photos = safePhotos;
    }
    if (voiceNotes !== undefined) {
      if (!Array.isArray(voiceNotes) || voiceNotes.length > 3) {
        return res.status(400).json({ error: 'voiceNotes is limited to 3 clips per day' });
      }
      const clips = voiceNotes.map((v) => ({
        id: String(v.id || ''),
        base64: typeof v.base64 === 'string' ? v.base64 : '',
        createdAt: String(v.createdAt || ''),
      }));
      if (clips.some((v) => v.base64.length > 1500000)) {
        return res.status(400).json({ error: 'each voice note must stay under ~1 MB' });
      }
      update.voiceNotes = clips;
    }

    // One log per farm and date: look it up by date, never by a shared id.
    const existing = await DailyLog.findOne({ date: req.params.date });
    const log = existing
      ? await DailyLog.findByIdAndUpdate(existing._id, { $set: update }, { new: true })
      : await DailyLog.create({ _id: `${req.farmContext.farmId}:${req.params.date}`, ...update });
    if (photos !== undefined || diaryEntries !== undefined) {
      try { await cleanupOrphanPhotoAssets(); }
      catch (cleanupError) { console.error('[photos] orphan cleanup deferred:', cleanupError); }
    }
    res.json(log);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
