import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { authRequired, requireRole } from '../middleware/auth.js';
import Image from '../models/Image.js';

const router = express.Router();

const allowedKinds = new Set(['bird', 'batch', 'diary']);

// Images are held in memory briefly, then persisted to MongoDB — NOT to local
// disk. Local disk is ephemeral on Replit autoscale (files vanish on every
// redeploy), so DB storage is what makes photos survive.
// Client compresses images before upload, so 5MB is a generous safety cap.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) return cb(null, true);
    return cb(new Error('Only image uploads are allowed'));
  },
});

// POST /api/uploads/image?kind=bird|batch  -> { ok, path: '/api/images/<id>' }
router.post('/uploads/image', authRequired, requireRole('admin'), upload.single('image'), async (req, res) => {
  try {
    const kind = String(req.query.kind || '').trim();
    if (!allowedKinds.has(kind)) {
      return res.status(400).json({ error: 'Invalid upload kind' });
    }
    if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const img = await Image.create({
      kind,
      contentType: req.file.mimetype || 'image/jpeg',
      data: req.file.buffer,
      size: req.file.buffer.length,
      uploadedBy: req.user?.username || '',
    });

    res.status(201).json({ ok: true, path: `/api/images/${img._id}` });
  } catch (err) {
    console.error('POST /api/uploads/image error:', err);
    res.status(500).json({ error: err.message || 'Failed to upload image' });
  }
});

// Diary uploads reuse the MongoDB Image store and the diary bucket's existing
// authenticated write permissions. Bird and batch uploads remain admin-only.
router.post('/uploads/diary-image', authRequired, upload.single('image'), async (req, res) => {
  try {
    if (!req.file?.buffer?.length) return res.status(400).json({ error: 'No image file uploaded' });
    const img = await Image.create({ kind: 'diary', contentType: req.file.mimetype || 'image/jpeg', data: req.file.buffer, size: req.file.buffer.length, uploadedBy: req.user?.username || '' });
    return res.status(201).json({ ok: true, path: `/api/images/${img._id}` });
  } catch (err) {
    console.error('POST /api/uploads/diary-image error:', err);
    return res.status(500).json({ error: err.message || 'Failed to upload diary image' });
  }
});

// GET /api/images/:id — serves the stored image bytes. Left unauthenticated on
// purpose so plain <img src> tags work everywhere (list views, emails,
// browsers without the auth cookie). IDs are unguessable ObjectIds and the
// content is farm photos, so exposure risk is negligible.
router.get('/images/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'Image not found' });
    }
    const img = await Image.findById(id);
    if (!img) return res.status(404).json({ error: 'Image not found' });

    res.setHeader('Content-Type', img.contentType || 'image/jpeg');
    // Images are immutable (a new upload = a new id), so cache aggressively.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(img.data);
  } catch (err) {
    console.error('GET /api/images/:id error:', err);
    res.status(500).json({ error: 'Failed to load image' });
  }
});

// DELETE /api/images/:id — admin cleanup when replacing/removing a photo.
router.delete('/images/:id', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'Image not found' });
    }
    const img = await Image.findByIdAndDelete(id);
    if (!img) return res.status(404).json({ error: 'Image not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/images/:id error:', err);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

export default router;
