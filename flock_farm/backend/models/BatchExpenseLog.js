import mongoose from 'mongoose';

const batchExpenseLogSchema = new mongoose.Schema(
  {
    batch_id: { type: String, required: true, index: true },
    date: { type: String, required: true },
    category: { type: String, enum: ['Medicine', 'Vaccination', 'Misc', 'Other'], required: true },
    detail: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    notes: { type: String, default: '' },
  },
  { timestamps: true, collection: 'batch_expenses' }
);

export default mongoose.model('BatchExpenseLog', batchExpenseLogSchema);
