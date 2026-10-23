import mongoose from 'mongoose';

const batchEggLogSchema = new mongoose.Schema(
  {
    batch_id: { type: String, required: true, index: true },
    farmId: { type: String, index: true },
    date: { type: String, required: true },
    collected: { type: Number, required: true, min: 0 },
    sold: { type: Number, required: true, min: 0, default: 0 },
    home_use: { type: Number, required: true, min: 0, default: 0 },
    broken_wasted: { type: Number, required: true, min: 0, default: 0 },
    price_per_egg: { type: Number, required: true, min: 0, default: 0 },
    notes: { type: String, default: '' },
  },
  { timestamps: true, collection: 'batch_egg_logs' }
);

export default mongoose.model('BatchEggLog', batchEggLogSchema);
