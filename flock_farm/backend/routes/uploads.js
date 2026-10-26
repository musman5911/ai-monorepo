import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { authRequired, requireRole } from '../middleware/auth.js';
import Image from '../models/Image.js';
import { createMufStorage } from '../muf-storage.mjs';
import { MUF_ENV } from '../muf-env.mjs';
import { createCloudinaryClient, cloudinaryConfigured } from '../muf-cloudinary.mjs';

const router = express.Router();

const allowedKinds = new Set(['bird', 'batch', 'diary']);

let cloudinaryFallbackLogged = false;
function storageForCurrentFarm(req) {
  const farmId = String(req.farmContext?.farmId || '');
  if (!farmId) throw new Error('Active farm context is required for photo storage');
  const scopedId = (id) => ({ _id: id, farmId });
  const config = { cloudName: MUF_ENV.cloudinaryCloudName, apiKey: MUF_ENV.cloudinaryApiKey, apiSecret: MUF_ENV.cloudinaryApiSecret };
  let cloudinary = null;
  if (cloudinaryConfigured(config)) cloudinary = createCloudinaryClient(config);
  else if (!cloudinaryFallbackLogged) {
    console.info('[photo-storage] Cloudinary credentials are incomplete; using MongoDB photo storage.');
    cloudinaryFallbackLogged = true;
  }
  return createMufStorage({
    store: {
      async save({ bytes, contentType, metadata = {} }) {
        if (cloudinary) {
          const remote = await cloudinary.upload({ bytes, contentType });
          const image = await Image.create({
            kind: allowedKinds.has(metadata.kind) ? metadata.kind : 'diary',
            farmId, provider: 'cloudinary', cloudinaryPublicId: remote.publicId, secureUrl: remote.secureUrl,
            contentType, size: bytes.length, uploadedBy: String(metadata.uploadedBy || ''),
          });
          return { id: String(image._id) };
        }
        const image = await Image.create({
          kind: allowedKinds.has(metadata.kind) ? metadata.kind : 'diary',
          farmId, provider: 'mongodb', contentType, data: bytes, size: bytes.length,
          uploadedBy: String(metadata.uploadedBy || ''),
        });
        return { id: String(image._id) };
      },
      async readLink(id) {
        const image = await Image.findOne(scopedId(id)).select('_id').lean();
        return image ? `/api/images/${image._id}` : null;
      },
      async delete(id) {
        const image = await Image.findOne(scopedId(id));
        if (!image) return false;
        if (image.provider === 'cloudinary' && image.cloudinaryPublicId) {
          if (!cloudinary) throw new Error('Cloudinary credentials are required to delete this photo');
          await cloudinary.destroy(image.cloudinaryPublicId);
        }
        return (await Image.deleteOne(scopedId(id))).deletedCount > 0;
      },
      async list() {
        const images = await Image.find({ farmId }).select('_id').lean();
        return images.map((image) => ({ id: String(image._id) }));
      },
    },
  });
}

// Image URLs are used directly by <img> tags, which cannot attach X-Farm-Id.
// Resolve the image's stored farm before auth, then let authRequired verify that
// the user is assigned to that farm. No image bytes or metadata are returned here.
async function resolveImageFarm(req, _res, next) {
  try {
    if (mongoose.isValidObjectId(req.params.id)) {
      const image = await Image.findById(req.params.id);
      if (image?.farmId) req.headers['x-farm-id'] = String(image.farmId);
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

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

    const storage = storageForCurrentFarm(req);
    const saved = await storage.save({
      bytes: req.file.buffer,
      contentType: req.file.mimetype || 'image/jpeg',
      metadata: { kind, uploadedBy: req.user?.username || '' },
    });
    const path = await storage.readLink(saved.id);
    if (!path) throw new Error('Saved image could not be read back');
    res.status(201).json({ ok: true, path });
  } catch (err) {
    console.error('POST /api/uploads/image error:', err);
    const status = err instanceof RangeError ? 413 : err instanceof TypeError ? 400 : 500;
    res.status(status).json({ error: err.message || 'Failed to upload image' });
  }
});

// Diary uploads reuse the MongoDB Image store and the diary bucket's existing
// authenticated write permissions. Bird and batch uploads remain admin-only.
router.post('/uploads/diary-image', authRequired, upload.single('image'), async (req, res) => {
  try {
    if (!req.file?.buffer?.length) return res.status(400).json({ error: 'No image file uploaded' });
    const storage = storageForCurrentFarm(req);
    const saved = await storage.save({
      bytes: req.file.buffer,
      contentType: req.file.mimetype || 'image/jpeg',
      metadata: { kind: 'diary', uploadedBy: req.user?.username || '' },
    });
    const path = await storage.readLink(saved.id);
    if (!path) throw new Error('Saved image could not be read back');
    return res.status(201).json({ ok: true, path });
  } catch (err) {
    console.error('POST /api/uploads/diary-image error:', err);
    const status = err instanceof RangeError ? 413 : err instanceof TypeError ? 400 : 500;
    return res.status(status).json({ error: err.message || 'Failed to upload diary image' });
  }
});

// GET /api/images/:id — resolve the owning farm, then authenticate against it.
// Legacy unscoped image records fail closed instead of bypassing farm checks.
router.get('/images/:id', resolveImageFarm, authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'Image not found' });
    }
    const storage = storageForCurrentFarm(req);
    const link = await storage.readLink(id);
    if (!link) return res.status(404).json({ error: 'Image not found' });
    const img = await Image.findOne({ _id: id, farmId: String(req.farmContext?.farmId || '') });
    if (!img) return res.status(404).json({ error: 'Image not found' });
    if (img.provider === 'cloudinary') {
      let remoteUrl;
      try { remoteUrl = new URL(img.secureUrl); } catch { return res.status(502).json({ error: 'Stored Cloudinary URL is invalid' }); }
      if (remoteUrl.protocol !== 'https:' || remoteUrl.hostname !== 'res.cloudinary.com') {
        return res.status(502).json({ error: 'Stored Cloudinary URL is not trusted' });
      }
      const remote = await fetch(remoteUrl);
      if (!remote.ok) return res.status(502).json({ error: 'Cloudinary photo retrieval failed' });
      const bytes = Buffer.from(await remote.arrayBuffer());
      res.setHeader('Content-Type', img.contentType || remote.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      return res.send(bytes);
    }

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
router.delete('/images/:id', resolveImageFarm, authRequired, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'Image not found' });
    }
    const storage = storageForCurrentFarm(req);
    const deleted = await storage.delete(id);
    if (!deleted) return res.status(404).json({ error: 'Image not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/images/:id error:', err);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

export default router;
