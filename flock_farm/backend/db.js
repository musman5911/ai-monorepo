import mongoose from 'mongoose';
import { enableMemoryDb } from './memory-db.js';
import { MUF_ENV } from './muf-env.mjs';

// ---------------------------------------------------------------------------
// DEV-ONLY memory mode. For a local demo without MongoDB, set MEMORY_MODE=1
// in your .env (no MONGODB_URI needed). Data is LOST on restart.
// If MONGODB_URI is set, the real database ALWAYS wins and memory mode is
// ignored — so a leftover MEMORY_MODE flag can never hide your real data.
// ---------------------------------------------------------------------------
const memoryMode = MUF_ENV.memoryMode && !MUF_ENV.mongoUri;
if (memoryMode) enableMemoryDb();

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
}
