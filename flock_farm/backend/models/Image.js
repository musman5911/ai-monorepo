import mongoose from 'mongoose';

// Uploaded images (bird / batch photos) stored directly in MongoDB so they
// survive redeploys on ephemeral hosting (Replit autoscale wipes local disk).
// Images are compressed client-side before upload, so documents stay small
// (well under MongoDB's 16MB doc limit).
const imageSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['bird', 'batch', 'diary'], required: true },
    farmId: { type: String, index: true },
    contentType: { type: String, required: true },
    data: { type: Buffer, required: false },
    provider: { type: String, enum: ['mongodb', 'cloudinary'], default: 'mongodb' },
    cloudinaryPublicId: { type: String, default: '' },
    secureUrl: { type: String, default: '' },
    size: { type: Number, default: 0 },
    uploadedBy: { type: String, default: '' },
  },
  { timestamps: true, collection: 'images' }
);

imageSchema.index({ farmId: 1, kind: 1, createdAt: -1 }, { name: 'image_farm_kind_created' });

export default mongoose.model('Image', imageSchema);
