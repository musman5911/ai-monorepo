import mongoose from 'mongoose';
import { enableMemoryDb } from './memory-db.js';
import { MUF_ENV } from './muf-env.mjs';
import DataStore from './models/DataStore.js';
import Batch from './models/Batch.js';
import BatchFeedLog from './models/BatchFeedLog.js';
import BatchMortalityLog from './models/BatchMortalityLog.js';
import BatchExpenseLog from './models/BatchExpenseLog.js';
import BatchSaleLog from './models/BatchSaleLog.js';
import BatchWeightLog from './models/BatchWeightLog.js';
import Image from './models/Image.js';
import User from './models/User.js';
import Farm from './models/Farm.js';
import { mufScopeModels, mufMigrateFarms, mufLoadDefaultFarm } from './muf-farms.mjs';

// ---------------------------------------------------------------------------
// DEV-ONLY memory mode. For a local demo without MongoDB, set MEMORY_MODE=1
// in your .env (no MONGODB_URI needed). Data is LOST on restart.
// If MONGODB_URI is set, the real database ALWAYS wins and memory mode is
// ignored — so a leftover MEMORY_MODE flag can never hide your real data.
// ---------------------------------------------------------------------------
const memoryMode = MUF_ENV.memoryMode && !MUF_ENV.mongoUri;
if (memoryMode) enableMemoryDb();

const MUF_FARM_SCOPED_NAMES = ['DataStore', 'Batch', 'BatchFeedLog', 'BatchMortalityLog', 'BatchExpenseLog', 'BatchSaleLog', 'BatchWeightLog', 'Image'];
const MUF_FARM_MODELS = { DataStore, Batch, BatchFeedLog, BatchMortalityLog, BatchExpenseLog, BatchSaleLog, BatchWeightLog, Image };
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

export { Farm, User, MUF_FARM_MODELS, MUF_FARM_SCOPED_NAMES };
