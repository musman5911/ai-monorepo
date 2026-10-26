import express from 'express';
import mongoose from 'mongoose';
import { PhotoAsset, DiaryMedia, CropPhoto, Spray, Finance, Crop } from '../db.js';
import { protect, requireAdmin } from '../middleware/auth.js';
import { createMufStorage } from '../muf-storage.mjs';
import { cleanupOrphanPhotoAssets, discoverOrphanPhotoAssets } from '../services/photo-assets.js';

const router = express.Router();
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
function parseDataUrl(value) {
  const match = typeof value === 'string' && value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match || !TYPES.has(match[1])) return null;
  const bytes = Buffer.from(match[2], 'base64');
  return bytes.length ? { bytes, contentType: match[1] } : null;
}
function storage() {
  return createMufStorage({ store: {
    async save({ bytes, contentType, metadata = {} }) {
      const doc = await PhotoAsset.create({ contentType, data: bytes, size: bytes.length, createdBy: String(metadata.createdBy || ''), createdAt: new Date() });
      return { id: String(doc._id) };
    },
    async readLink(id) {
      const doc = await PhotoAsset.findById(id).select('_id').lean();
      return doc ? `/api/photos/${doc._id}` : null;
    },
    async delete(id) { return Boolean(await PhotoAsset.findOneAndDelete({ _id: id })); },
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
  for (const Model of [DiaryMedia, CropPhoto, Spray, Finance, Crop]) {
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
router.get('/photos/orphans', protect, requireAdmin, async (req, res) => {
  try {
    return res.json(await discoverOrphanPhotoAssets());
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Photo orphan discovery failed' });
  }
});
router.post('/photos/cleanup-orphans', protect, requireAdmin, async (req, res) => {
  try {
    return res.json(await cleanupOrphanPhotoAssets());
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Photo orphan cleanup failed' });
  }
});
router.get('/photos/:id', protect, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Photo not found' });
  const photo = await PhotoAsset.findById(req.params.id);
  if (!photo) return res.status(404).json({ error: 'Photo not found' });
  res.set('Content-Type', photo.contentType).set('Cache-Control', 'private, max-age=3600').send(photo.data);
});
router.delete('/photos/:id', protect, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Photo not found' });
  if (await isReferenced(req.params.id)) return res.status(409).json({ error: 'Photo is still referenced by a farm record' });
  const removed = await PhotoAsset.findOneAndDelete({ _id: req.params.id });
  if (!removed) return res.status(404).json({ error: 'Photo not found' });
  return res.json({ ok: true });
});
export default router;
