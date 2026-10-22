import mongoose from 'mongoose';

const batchSaleLogSchema = new mongoose.Schema(
  {
    batch_id: { type: String, required: true, index: true },
    date: { type: String, required: true },
    count: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    buyer: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { timestamps: true, collection: 'batch_sales' }
);

export default mongoose.model('BatchSaleLog', batchSaleLogSchema);
