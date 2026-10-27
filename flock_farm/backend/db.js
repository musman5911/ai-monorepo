import mongoose from 'mongoose';
import { enableMemoryDb } from './memory-db.js';
import { MUF_ENV } from './muf-env.mjs';
import { mufScopeModels, mufMigrateFarms, mufLoadDefaultFarm } from './muf-farms.mjs';

// ---------------------------------------------------------------------------
// DEV-ONLY memory mode. For a local demo without MongoDB, set MEMORY_MODE=1
// in your .env (no MONGODB_URI needed). Data is LOST on restart.
// If MONGODB_URI is set, the real database ALWAYS wins and memory mode is
// ignored — so a leftover MEMORY_MODE flag can never hide your real data.
// ---------------------------------------------------------------------------
const memoryMode = MUF_ENV.memoryMode && !MUF_ENV.mongoUri;
if (MUF_ENV.nodeEnv === 'production' && memoryMode) {
  console.error('❌ MEMORY_MODE is not allowed in production. Configure MONGO_URI.');
  process.exit(1);
}
if (memoryMode) enableMemoryDb();

// Register models only after the memory adapter has patched mongoose.model().
const DataStore = (await import('./models/DataStore.js')).default;
const Batch = (await import('./models/Batch.js')).default;
const BatchFeedLog = (await import('./models/BatchFeedLog.js')).default;
const BatchMortalityLog = (await import('./models/BatchMortalityLog.js')).default;
const BatchExpenseLog = (await import('./models/BatchExpenseLog.js')).default;
const BatchSaleLog = (await import('./models/BatchSaleLog.js')).default;
const BatchWeightLog = (await import('./models/BatchWeightLog.js')).default;
const BatchEggLog = (await import('./models/BatchEggLog.js')).default;
const BatchVaccinationLog = (await import('./models/BatchVaccinationLog.js')).default;
const Image = (await import('./models/Image.js')).default;
const User = (await import('./models/User.js')).default;
const Farm = (await import('./models/Farm.js')).default;
const ArchiveJobSchema = new mongoose.Schema({
  _id: { type: String }, farmId: { type: String, required: true, index: true }, collection: { type: String, required: true },
  retentionYears: { type: Number, required: true, min: 1 }, cutoffDate: { type: String, required: true },
  state: { type: String, default: 'preparing' }, sourceCount: { type: Number, required: true },
  exportDownloaded: { type: Boolean, default: false }, createdBy: { type: String, default: '' },
}, { timestamps: true, collection: 'muf_archive_jobs' });
const ArchiveRecordSchema = new mongoose.Schema({
  _id: { type: String }, farmId: { type: String, required: true, index: true }, jobId: { type: String, required: true, index: true },
  sourceCollection: { type: String, required: true }, sourceId: { type: String, required: true },
  originalRecord: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true, collection: 'muf_archive_records' });
ArchiveRecordSchema.index({ farmId: 1, jobId: 1, sourceCollection: 1, sourceId: 1 }, { unique: true });
const ArchiveJob = mongoose.model('MufArchiveJob', ArchiveJobSchema);
const ArchiveRecord = mongoose.model('MufArchiveRecord', ArchiveRecordSchema);

const MUF_FARM_SCOPED_NAMES = ['MufArchiveJob', 'MufArchiveRecord', 'DataStore', 'Batch', 'BatchFeedLog', 'BatchMortalityLog', 'BatchExpenseLog', 'BatchSaleLog', 'BatchWeightLog', 'BatchEggLog', 'BatchVaccinationLog', 'Image'];
const MUF_FARM_MODELS = { MufArchiveJob: ArchiveJob, MufArchiveRecord: ArchiveRecord, DataStore, Batch, BatchFeedLog, BatchMortalityLog, BatchExpenseLog, BatchSaleLog, BatchWeightLog, BatchEggLog, BatchVaccinationLog, Image };
mufScopeModels(MUF_FARM_MODELS, MUF_FARM_SCOPED_NAMES);

let isConnected = false;

export async function connectDB() {
  if (isConnected) return;

  // --- DEV-ONLY memory mode branch ---
  if (memoryMode) {
    isConnected = true;
    console.log('🧠 In-memory store active (MEMORY_MODE=1) — no MongoDB connection.');
    // Seed demo accounts (admin + worker) and a full year of realistic
    // farm data so every screen is populated out of the box.
    const { seedDemoData } = await import('./demo-data.js');
    await seedDemoData();
    // Demo data is disposable. Migrate it automatically; real MongoDB data is never
    // migrated during startup.
    await mufMigrateFarms({
      Farm, User, models: MUF_FARM_MODELS, names: MUF_FARM_SCOPED_NAMES,
      log: (message) => console.log('[farms] ' + message),
    });
    return;
  }

  const uri = MUF_ENV.mongoUri;
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Add it to your .env file (locally) or Replit Secrets (when deployed).'
    );
  }

  await mongoose.connect(uri);
  isConnected = true;
  console.log('✅ Connected to MongoDB');
  // Production records are not changed at startup. The owner runs the explicit
  // migration after a backup and after testing against a copy.
  const defaultFarmId = await mufLoadDefaultFarm(Farm);
  if (!defaultFarmId) console.warn('[farms] No farms yet. Back up the database, then run npm run migrate:farms.');
}

export { Farm, User, ArchiveJob, ArchiveRecord, MUF_FARM_MODELS, MUF_FARM_SCOPED_NAMES };
