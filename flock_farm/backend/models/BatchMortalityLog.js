import mongoose from 'mongoose';

const batchMortalityLogSchema = new mongoose.Schema(
  {
    batch_id: { type: String, required: true, index: true },
    farmId: { type: String, index: true },
    date: { type: String, required: true },
    count: { type: Number, required: true, min: 0 },
    reason: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { timestamps: true, collection: 'batch_mortality' }
);

export default mongoose.model('BatchMortalityLog', batchMortalityLogSchema);
