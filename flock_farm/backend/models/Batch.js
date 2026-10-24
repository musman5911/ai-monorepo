import mongoose from 'mongoose';

const batchSchema = new mongoose.Schema(
  {
    batch_id: { type: String, required: true, unique: true, index: true },
    farmId: { type: String, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['Broiler', 'Layer', 'Breeder', 'Custom'], required: true },
    start_date: { type: String, required: true },
    expected_end_date: { type: String, default: null },
    intake_count: { type: Number, required: true, min: 0, default: 0 },
    source: { type: String, trim: true, default: '' },
    image_path: { type: String, trim: true, default: '' },
    // Photo gallery — extra dated photos ('/api/images/<id>' paths, max 10).
    gallery: { type: [String], default: [] },
    cost_per_bird: { type: Number, required: true, min: 0, default: 0 },
    status: { type: String, enum: ['Active', 'Closed'], default: 'Active' },
  },
  { timestamps: true, collection: 'batches' }
);

batchSchema.index({ farmId: 1, status: 1, start_date: -1 }, { name: 'batch_farm_status_start' });

export default mongoose.model('Batch', batchSchema);
