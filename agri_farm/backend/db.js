import mongoose from 'mongoose';
import { createStore } from './memory-db.js';
import { MUF_ENV, mufEnvHasMongo } from './muf-env.mjs';

// ---------------------------------------------------------------------------
// Database selection rule (same across all three farm apps):
//
//   1. If MONGO_URI is set           -> ALWAYS the real MongoDB. A leftover
//                                       MEMORY_MODE flag is ignored, so demo
//                                       mode can never hide your real data.
//                                       Connection failure = loud crash.
//   2. No MONGO_URI + MEMORY_MODE=1  -> in-memory demo database, auto-seeded
//                                       with a year of demo data. Data is
//                                       LOST on restart.
//   3. Neither                       -> try local MongoDB, fail loudly with a
//                                       helpful hint.
// ---------------------------------------------------------------------------
let envUri = MUF_ENV.mongoUri || '';

// Treat the template placeholder as "not configured"
if (!mufEnvHasMongo()) {
  if (envUri) console.log('⚠️ [Database] MONGO_URI in .env is a template placeholder — ignoring it.');
  envUri = '';
}

const memoryRequested = MUF_ENV.memoryMode;

const useMock = memoryRequested && !envUri;

// ─── Schemas (loose on purpose: the docs are plain field bags) ─────────────
// Collection names match the previous Python backend 1:1, so a real MongoDB
// with existing farm data keeps working with zero migration.
const baseOptions = { strict: false, versionKey: false, collection: undefined };
function looseSchema(collection) {
  return new mongoose.Schema({}, { ...baseOptions, collection });
}

const UserSchema = looseSchema('users');
const CropSchema = looseSchema('crops');
const FinanceSchema = looseSchema('finance');
const TaskSchema = looseSchema('tasks');
const ResetSchema = looseSchema('resets');
const InventorySchema = looseSchema('inventory');
const LiabilitySchema = looseSchema('liabilities');
const IrrigationSchema = looseSchema('irrigation');
const CropPhotoSchema = looseSchema('crop_photos');
const SpraySchema = looseSchema('spray_logs');
const LaborerSchema = looseSchema('laborers');
const AttendanceSchema = looseSchema('attendance');
const LaborAdvanceSchema = looseSchema('labor_advances');
const TelegramMetaSchema = looseSchema('telegram_meta');
const SupplierSchema = looseSchema('suppliers');
const SupplierPaymentSchema = looseSchema('supplier_payments');
const SettingSchema = looseSchema('settings');

// ─── Models ─────────────────────────────────────────────────────────────────
let User, Crop, Finance, Task, Reset, Inventory, Liability, Irrigation,
  CropPhoto, Spray, Laborer, Attendance, LaborAdvance, TelegramMeta,
  Supplier, SupplierPayment, Setting;

if (useMock) {
  const models = createStore({
    User: UserSchema,
    Crop: CropSchema,
    Finance: FinanceSchema,
    Task: TaskSchema,
    Reset: ResetSchema,
    Inventory: InventorySchema,
    Liability: LiabilitySchema,
    Irrigation: IrrigationSchema,
    CropPhoto: CropPhotoSchema,
    Spray: SpraySchema,
    Laborer: LaborerSchema,
    Attendance: AttendanceSchema,
    LaborAdvance: LaborAdvanceSchema,
    TelegramMeta: TelegramMetaSchema,
    Supplier: SupplierSchema,
    SupplierPayment: SupplierPaymentSchema,
    Setting: SettingSchema,
  });
  ({ User, Crop, Finance, Task, Reset, Inventory, Liability, Irrigation,
    CropPhoto, Spray, Laborer, Attendance, LaborAdvance, TelegramMeta,
    Supplier, SupplierPayment, Setting } = models);
} else {
  User = mongoose.model('User', UserSchema);
  Crop = mongoose.model('Crop', CropSchema);
  Finance = mongoose.model('Finance', FinanceSchema);
  Task = mongoose.model('Task', TaskSchema);
  Reset = mongoose.model('Reset', ResetSchema);
  Inventory = mongoose.model('Inventory', InventorySchema);
  Liability = mongoose.model('Liability', LiabilitySchema);
  Irrigation = mongoose.model('Irrigation', IrrigationSchema);
  CropPhoto = mongoose.model('CropPhoto', CropPhotoSchema);
  Spray = mongoose.model('Spray', SpraySchema);
  Laborer = mongoose.model('Laborer', LaborerSchema);
  Attendance = mongoose.model('Attendance', AttendanceSchema);
  LaborAdvance = mongoose.model('LaborAdvance', LaborAdvanceSchema);
  TelegramMeta = mongoose.model('TelegramMeta', TelegramMetaSchema);
  Supplier = mongoose.model('Supplier', SupplierSchema);
  SupplierPayment = mongoose.model('SupplierPayment', SupplierPaymentSchema);
  Setting = mongoose.model('Setting', SettingSchema);
}

const connectDB = async () => {
  if (useMock) {
    console.log('🧠 [Database] MEMORY_MODE=1 — using in-memory demo database (data is lost on restart).');
    // Seed demo accounts (admin + worker) and a full year of realistic farm
    // data so every screen is populated out of the box.
    const { seedDemoData } = await import('./demo-data.js');
    const userCount = await User.countDocuments({});
    if (userCount === 0) {
      await seedDemoData({
        User, Crop, Finance, Task, Inventory, Liability, Irrigation,
        CropPhoto, Spray, Laborer, Attendance, LaborAdvance,
        Supplier, SupplierPayment,
      });
    }
    return;
  }

  const uri = envUri || 'mongodb://localhost:27017/farm_management';
  let hostName = 'localhost';
  let dbName = 'farm_management';
  try {
    const m = uri.match(/mongodb(\+srv)?:\/\/([^@/]*@)?([^/:]+)/);
    if (m) hostName = m[3];
    const dbm = uri.match(/\/([^/?]+)(\?.*)?$/);
    if (dbm) dbName = decodeURIComponent(dbm[1]);
  } catch { /* keep defaults */ }

  if (memoryRequested && envUri) {
    console.log('ℹ️ [Database] MEMORY_MODE is set but MONGO_URI is configured — the real MongoDB wins; memory mode ignored.');
  }
  console.log(`🔌 [Database] Connection target resolved: Host '${hostName}' | Database '${dbName}'`);

  const timeoutMs = uri.startsWith('mongodb+srv://') ? 15000 : 5000;
  try {
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: timeoutMs });
    console.log(`✅ [Database] Connected successfully to real MongoDB server. Database in use: '${conn.connection.name || dbName}'`);
  } catch (error) {
    // Production must fail loudly so a typo'd MONGO_URI / Atlas allowlist
    // problem is noticed immediately — never silently boot an empty
    // throwaway database in place of the real one.
    console.error(`❌ [Database] CRITICAL: Could not connect to MongoDB at '${hostName}' (${error.message}).`);
    console.error('   Please verify the MONGO_URI secret (and MongoDB Atlas Network Access allowlist).');
    console.error('   For a local demo without MongoDB, remove MONGO_URI and set MEMORY_MODE=1.');
    process.exit(1);
  }
};

export {
  connectDB, useMock,
  User, Crop, Finance, Task, Reset, Inventory, Liability, Irrigation,
  CropPhoto, Spray, Laborer, Attendance, LaborAdvance, TelegramMeta,
  Supplier, SupplierPayment, Setting,
};
