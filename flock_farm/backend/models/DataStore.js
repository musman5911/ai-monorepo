import mongoose from 'mongoose';

// A simple, flexible "bucket" store: one document per data category
// (birds, expenses, feed, eggs, settings). Each document just holds
// whatever JSON array/object the frontend was previously keeping in
// localStorage. This makes the switch from localStorage -> MongoDB
// a drop-in replacement without needing to redesign the whole schema.
const dataStoreSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, index: true }, // e.g. 'birds'
    // Each bucket is isolated per farm. The migration tags existing buckets before
    // this compound unique index is created in MongoDB.
    farmId: { type: String, required: true, index: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true }, // the actual data
    // Optimistic-concurrency version. Every successful write increments it.
    // Clients send the version they loaded; a mismatch means someone else
    // saved in between, and the write is rejected with 409 instead of
    // silently overwriting their changes (last-write-wins data loss).
    version: { type: Number, default: 0 },
  },
  { timestamps: true }
);

dataStoreSchema.index({ farmId: 1, key: 1 }, { unique: true, name: 'datastore_farm_key_unique' });

dataStoreSchema.index({ farmId: 1, key: 1 }, { unique: true, name: 'datastore_farm_key_unique' });

export default mongoose.model('DataStore', dataStoreSchema);
