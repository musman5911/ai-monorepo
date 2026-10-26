import { PhotoAsset, DiaryMedia, CropPhoto, Spray, Finance, Crop } from '../db.js';

const MODELS = [DiaryMedia, CropPhoto, Spray, Finance, Crop];

function collectPhotoReferences(value, refs, seen = new Set()) {
  if (typeof value === 'string') {
    for (const match of value.matchAll(/\/api\/photos\/([a-f0-9]{24})/ig)) refs.add(match[1].toLowerCase());
    return;
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  for (const child of Array.isArray(value) ? value : Object.values(value)) collectPhotoReferences(child, refs, seen);
}

export async function cleanupOrphanPhotoAssets() {
  const refs = new Set();
  for (const Model of MODELS) {
    const rows = await Model.find({}).lean();
    for (const row of rows) collectPhotoReferences(row, refs);
  }
  const assets = await PhotoAsset.find({}).select('_id').lean();
  const orphanIds = assets.filter((asset) => !refs.has(String(asset._id).toLowerCase())).map((asset) => asset._id);
  const result = orphanIds.length ? await PhotoAsset.deleteMany({ _id: { $in: orphanIds } }) : { deletedCount: 0 };
  return { scanned: assets.length, deleted: result.deletedCount || 0 };
}
