import mongoose from 'mongoose';

const farmSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  location: { type: String, default: '' },
  archived: { type: Boolean, default: false },
  createdBy: { type: String, default: '' },
}, { timestamps: true, collection: 'farms' });

export default mongoose.model('Farm', farmSchema);
