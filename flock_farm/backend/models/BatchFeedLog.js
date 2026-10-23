import mongoose from 'mongoose';

const batchFeedLogSchema = new mongoose.Schema(
  {
    batch_id: { type: String, required: true, index: true },
    farmId: { type: String, index: true },
    date: { type: String, required: true },
    feed_type: { type: String, required: true, trim: true },
    quantity_kg: { type: Number, required: true, min: 0 },
    rate_rs_per_kg: { type: Number, required: true, min: 0 },
    notes: { type: String, default: '' },
  },
  { timestamps: true, collection: 'batch_feed_logs' }
);

export default mongoose.model('BatchFeedLog', batchFeedLogSchema);
