import express from 'express';
import mongoose from 'mongoose';
import { PhotoAsset, Cow, Expense, DailyLog } from '../db.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { createMufStorage } from '../muf-storage.mjs';
import { MUF_ENV } from '../muf-env.mjs';
import { createCloudinaryClient, cloudinaryConfigured } from '../muf-cloudinary.mjs';
import { cleanupOrphanPhotoAssets, discoverOrphanPhotoAssets } from '../services/photo-assets.js';

const router = express.Router();
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
function photoBytes(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array || Array.isArray(value)) return Buffer.from(value);
  if (value && typeof value === 'object') {
    const indexes = Object.keys(value).filter((key) => /^\d+$/.test(key)).sort((a, b) => Number(a) - Number(b));
    if (indexes.length) return Buffer.from(indexes.map((key) => Number(value[key])));
    if (value.type === 'Buffer' && Array.isArray(value.data)) return Buffer.from(value.data);
  }
  return Buffer.alloc(0);
}
function parseDataUrl(value) {
  const match = typeof value === 'string' && value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match || !TYPES.has(match[1])) return null;
  const bytes = Buffer.from(match[2], 'base64');
  return bytes.length ? { bytes, contentType: match[1] } : null;
}
let cloudinaryFallbackLogged = false;
function configuredCloudinary() {
  const config = { cloudName: MUF_ENV.cloudinaryCloudName, apiKey: MUF_ENV.cloudinaryApiKey, apiSecret: MUF_ENV.cloudinaryApiSecret };
  if (!cloudinaryConfigured(config)) {
    if (!cloudinaryFallbackLogged) {
      console.info('[photo-storage] Cloudinary credentials are incomplete; using MongoDB photo storage.');
      cloudinaryFallbackLogged = true;
    }
    return null;
  }
  return createCloudinaryClient(config);
}
function storage() {
  const cloudinary = configuredCloudinary();
  return createMufStorage({ store: {
    async save({ bytes, contentType, metadata = {} }) {
      if (cloudinary) {
        const remote = await cloudinary.upload({ bytes, contentType });
        const doc = await PhotoAsset.create({
          provider: 'cloudinary', cloudinaryPublicId: remote.publicId, secureUrl: remote.secureUrl,
          contentType, size: bytes.length, createdBy: String(metadata.createdBy || ''), createdAt: new Date(),
        });
        return { id: String(doc._id) };
      }
      const doc = await PhotoAsset.create({ provider: 'mongodb', contentType, data: bytes, size: bytes.length, createdBy: String(metadata.createdBy || ''), createdAt: new Date() });
      return { id: String(doc._id) };
    },
    async readLink(id) {
      const doc = await PhotoAsset.findById(id).select('_id').lean();
      return doc ? `/api/photos/${doc._id}` : null;
    },
    async delete(id) {
      const doc = await PhotoAsset.findById(id);
      if (!doc) return false;
      if (doc.provider === 'cloudinary' && doc.cloudinaryPublicId) {
        if (!cloudinary) throw new Error('Cloudinary credentials are required to delete this photo');
        await cloudinary.destroy(doc.cloudinaryPublicId);
      }
      return (await PhotoAsset.deleteOne({ _id: id })).deletedCount > 0;
    },
    async list() { return (await PhotoAsset.find({}).select('_id').lean()).map((d) => ({ id: String(d._id) })); },
  }});
}
function referencesId(value, id, seen = new Set()) {
  if (typeof value === 'string') return value.includes('/api/photos/' + id);
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  return (Array.isArray(value) ? value : Object.values(value)).some((v) => referencesId(v, id, seen));
}
async function isReferenced(id) {
  for (const Model of [Cow, Expense, DailyLog]) {
    const rows = await Model.find({}).lean();
    if (rows.some((row) => referencesId(row, id))) return true;
  }
  return false;
}
router.post('/photos', protect, async (req, res) => {
  try {
    const parsed = parseDataUrl(req.body?.data);
    if (!parsed) return res.status(400).json({ error: 'Photo must be a valid JPEG, PNG or WebP data URL' });
    const saved = await storage().save({ ...parsed, metadata: { createdBy: req.user?.username || '' } });
    return res.status(201).json({ id: saved.id, path: `/api/photos/${saved.id}` });
  } catch (err) {
    const status = err instanceof RangeError ? 413 : err instanceof TypeError ? 400 : 500;
    return res.status(status).json({ error: err.message || 'Photo upload failed' });
  }
});
router.get('/photos/orphans', protect, adminOnly, async (req, res) => {
  try {
    return res.json(await discoverOrphanPhotoAssets());
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Photo orphan discovery failed' });
  }
});
router.post('/photos/cleanup-orphans', protect, adminOnly, async (req, res) => {
  try {
    return res.json(await cleanupOrphanPhotoAssets());
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Photo orphan cleanup failed' });
  }
});
router.get('/photos/:id', protect, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Photo not found' });
    const photo = await PhotoAsset.findById(req.params.id);
    if (!photo) return res.status(404).json({ error: 'Photo not found' });
    if (photo.provider === 'cloudinary') {
      let remoteUrl;
      try { remoteUrl = new URL(photo.secureUrl); } catch { return res.status(502).json({ error: 'Stored Cloudinary URL is invalid' }); }
      if (remoteUrl.protocol !== 'https:' || remoteUrl.hostname !== 'res.cloudinary.com') {
        return res.status(502).json({ error: 'Stored Cloudinary URL is not trusted' });
      }
      const remote = await fetch(remoteUrl);
      if (!remote.ok) return res.status(502).json({ error: 'Cloudinary photo retrieval failed' });
      const bytes = Buffer.from(await remote.arrayBuffer());
      return res.set('Content-Type', photo.contentType || remote.headers.get('content-type') || 'application/octet-stream')
        .set('Cache-Control', 'private, max-age=3600')
        .send(bytes);
    }
    return res
      .set('Content-Type', photo.contentType || 'application/octet-stream')
      .set('Cache-Control', 'private, max-age=3600')
      .send(photoBytes(photo.data));
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Photo retrieval failed' });
  }
});
router.delete('/photos/:id', protect, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Photo not found' });
    if (await isReferenced(req.params.id)) return res.status(409).json({ error: 'Photo is still referenced by a farm record' });
    // Use deleteOne rather than findByIdAndDelete: Mongoose implements the latter
    // through findOneAndDelete, which the lightweight memory adapter does not expose.
    const existing = await PhotoAsset.findById(req.params.id).select('_id').lean();
    if (!existing) return res.status(404).json({ error: 'Photo not found' });
    const removed = await PhotoAsset.deleteOne({ _id: req.params.id });
    if (!removed.deletedCount) return res.status(404).json({ error: 'Photo not found' });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Photo deletion failed' });
  }
});
export default router;
