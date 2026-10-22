import mongoose from 'mongoose';

// Uploaded images (bird / batch photos) stored directly in MongoDB so they
// survive redeploys on ephemeral hosting (Replit autoscale wipes local disk).
// Images are compressed client-side before upload, so documents stay small
// (well under MongoDB's 16MB doc limit).
const imageSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['bird', 'batch', 'diary'], required: true },
    contentType: { type: String, required: true },
    data: { type: Buffer, required: true },
    size: { type: Number, default: 0 },
    uploadedBy: { type: String, default: '' },
  },
  { timestamps: true, collection: 'images' }
);

export default mongoose.model('Image', imageSchema);
