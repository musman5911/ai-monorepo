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
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function detectImageContentType(bytes) {
  if (!Buffer.isBuffer(bytes)) return '';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return '';
}

function validatedImageContentType(file) {
  const detected = detectImageContentType(file?.buffer);
  return detected && allowedImageTypes.has(file?.mimetype) && detected === file.mimetype ? detected : '';
}

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
    if (allowedImageTypes.has(file.mimetype)) return cb(null, true);
    return cb(new Error('Only JPEG, PNG, and WebP image uploads are allowed'));
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

    const contentType = validatedImageContentType(req.file);
    if (!contentType) return res.status(400).json({ error: 'Image content does not match a supported JPEG, PNG, or WebP file' });

    const storage = storageForCurrentFarm(req);
    const saved = await storage.save({
      bytes: req.file.buffer,
      contentType,
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
    const contentType = validatedImageContentType(req.file);
    if (!contentType) return res.status(400).json({ error: 'Image content does not match a supported JPEG, PNG, or WebP file' });
    const storage = storageForCurrentFarm(req);
    const saved = await storage.save({
      bytes: req.file.buffer,
      contentType,
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
      res.setHeader('Cache-Control', 'private, no-store');
      return res.send(bytes);
    }

    res.setHeader('Content-Type', img.contentType || 'image/jpeg');
    // The response is farm-authorized. Never permit shared caches to reuse it
    // across users or farm contexts, even though each upload has its own ID.
    res.setHeader('Cache-Control', 'private, no-store');
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
