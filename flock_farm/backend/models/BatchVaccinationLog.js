import mongoose from 'mongoose';

const batchVaccinationLogSchema = new mongoose.Schema(
  {
    batch_id: { type: String, required: true, index: true },
    farmId: { type: String, index: true },
    date: { type: String, required: true },
    vaccine_name: { type: String, required: true, trim: true },
    dose: { type: String, default: '' },
    bird_count: { type: Number, required: true, min: 0, default: 0 },
    cost: { type: Number, required: true, min: 0, default: 0 },
    notes: { type: String, default: '' },
  },
  { timestamps: true, collection: 'batch_vaccination_logs' }
);

export default mongoose.model('BatchVaccinationLog', batchVaccinationLogSchema);
