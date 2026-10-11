import express from 'express';
const router = express.Router();
import { DailyLog } from '../db.js';
import { protect } from '../middleware/auth.js';

// GET /api/dailylog/:date  -> returns the log for that date, or an empty shell if none exists yet
router.get('/:date', protect, async (req, res) => {
  try {
    const log = await DailyLog.findById(req.params.date);
    if (!log) {
      return res.json({ _id: req.params.date, date: req.params.date, checklist: [], notes: '', voiceNotes: [], photos: [] });
    }
    res.json(log);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/dailylog/:date -> upsert (create if missing, update if exists)
// Both admin and worker can save — this is day-to-day operational input.
router.put('/:date', protect, async (req, res) => {
  try {
    const { checklist, notes, voiceNotes, photos } = req.body;
    const update = { date: req.params.date };
    if (checklist !== undefined) update.checklist = checklist;
    if (notes !== undefined) update.notes = notes;
    if (photos !== undefined) {
      if (!Array.isArray(photos) || photos.length > 10) return res.status(400).json({ error: 'photos is limited to 10 per day' });
      const safePhotos = photos.map((p) => ({ id: String(p.id || ''), date: req.params.date, data: typeof p.data === 'string' && p.data.startsWith('data:image/jpeg;base64,') ? p.data : '', bytes: Math.max(0, Number(p.bytes) || 0), createdAt: String(p.createdAt || '') }));
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

    const log = await DailyLog.findByIdAndUpdate(
      req.params.date,
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json(log);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
