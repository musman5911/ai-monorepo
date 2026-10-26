import { MUF_ENV } from '../muf-env.mjs';
import { createCloudinaryClient, cloudinaryConfigured } from '../muf-cloudinary.mjs';
import { PhotoAsset, Cow, Expense, DailyLog } from '../db.js';

const MODELS = [Cow, Expense, DailyLog];

function collectPhotoReferences(value, refs, seen = new Set()) {
  if (typeof value === 'string') {
    for (const match of value.matchAll(/\/api\/photos\/([a-f0-9]{24})/ig)) refs.add(match[1].toLowerCase());
    return;
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  for (const child of Array.isArray(value) ? value : Object.values(value)) collectPhotoReferences(child, refs, seen);
}

export async function discoverOrphanPhotoAssets() {
  const refs = new Set();
  for (const Model of MODELS) {
    const rows = await Model.find({}).lean();
    for (const row of rows) collectPhotoReferences(row, refs);
  }
  const assets = await PhotoAsset.find({}).select('_id createdAt').lean();
  // Give newly uploaded photos time to be attached to their parent record.
  // Legacy assets without timestamps remain eligible for cleanup.
  const cutoff = Date.now() - 60 * 60 * 1000;
  const orphanIds = assets.filter((asset) => {
    const createdAt = asset.createdAt ? new Date(asset.createdAt).getTime() : 0;
    return !refs.has(String(asset._id).toLowerCase()) && createdAt < cutoff;
  }).map((asset) => String(asset._id));
  return { scanned: assets.length, orphanIds };
}

export async function cleanupOrphanPhotoAssets() {
  const { scanned, orphanIds } = await discoverOrphanPhotoAssets();
  const config = { cloudName: MUF_ENV.cloudinaryCloudName, apiKey: MUF_ENV.cloudinaryApiKey, apiSecret: MUF_ENV.cloudinaryApiSecret };
  const cloudinary = cloudinaryConfigured(config) ? createCloudinaryClient(config) : null;
  let deleted = 0;
  let skippedCloudinary = 0;
  for (const id of orphanIds) {
    const asset = await PhotoAsset.findById(id);
    if (!asset) continue;
    if (asset.provider === 'cloudinary' && asset.cloudinaryPublicId) {
      if (!cloudinary) { skippedCloudinary++; continue; }
      await cloudinary.destroy(asset.cloudinaryPublicId);
    }
    const result = await PhotoAsset.deleteOne({ _id: id });
    deleted += result.deletedCount || 0;
  }
  return { scanned, candidates: orphanIds.length, deleted, skippedCloudinary };
}
