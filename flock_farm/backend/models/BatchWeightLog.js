import mongoose from 'mongoose';

const batchWeightLogSchema = new mongoose.Schema(
  {
    batch_id: { type: String, required: true, index: true },
    date: { type: String, required: true },
    avg_weight_g: { type: Number, required: true, min: 0 },
    sample_size: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: '' },
  },
  { timestamps: true, collection: 'batch_weight_logs' }
);

export default mongoose.model('BatchWeightLog', batchWeightLogSchema);
