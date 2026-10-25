import mongoose from 'mongoose';
import crypto from 'crypto';
import { seedDemoData } from './demo-data.js';
import { createStore } from './memory-db.js';
import { mufScopeModels, mufMigrateFarms, mufLoadDefaultFarm } from './muf-farms.mjs';
import { MUF_ENV } from './muf-env.mjs';

// Memory mode is DEV/DEMO only. If MONGO_URI is set, the real database
// ALWAYS wins and MEMORY_MODE is ignored — a leftover flag can never hide
// your real farm data.
const USE_MEMORY = MUF_ENV.memoryMode && !MUF_ENV.mongoUri;

const connectDB = async () => {
  if (USE_MEMORY) {
    console.log('🧠 In-memory store active (MEMORY_MODE=1) — no MongoDB connection.');
    // Seed demo accounts (admin + worker) and a full year of realistic
    // farm data so every screen is populated out of the box.
    await seedDemoData({
      connectDB, Cow, BreedingEvent, Milk, Expense, Laborer, LaborAttendance, LaborAdvance,
      Rate, Health, Buyer, BuyerPayment, Supplier, SupplierPayment, User, Farm,
      PasswordReset, RateHistory, DailyLog, Sale, Meta,
    });
    // Demo data is disposable, so the farms migration runs automatically here.
    await mufMigrateFarms({
      Farm, User, models: MUF_FARM_MODELS, names: MUF_FARM_SCOPED_NAMES,
      log: (m) => console.log(`[farms] ${m}`),
    });
    return;
  }
  try {
    const conn = await mongoose.connect(MUF_ENV.mongoUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    await ensureIndexes();
    // Real data is never migrated automatically. Run `npm run migrate:farms`
    // (see docs/DEPLOYMENT.md) after taking a backup.
    const defaultFarm = await mufLoadDefaultFarm(Farm);
    if (!defaultFarm) {
      console.warn('[farms] No farms exist yet. Take a backup, then run: npm run migrate:farms');
    }
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

async function ensureIndexes() {
  try {
    await Promise.all([
      Milk.collection.createIndex({ cowId: 1, date: 1 }, { unique: true, name: 'milk_cow_date_unique' }),
      Milk.collection.createIndex({ date: -1 }, { name: 'milk_date' }),
      Milk.collection.createIndex({ farmId: 1, date: -1 }, { name: 'milk_farm_date' }),
      BreedingEvent.collection.createIndex({ farmId: 1, cowId: 1, date: -1 }, { name: 'breeding_event_farm_cow_date' }),
      BreedingEvent.collection.createIndex({ farmId: 1, type: 1, date: -1 }, { name: 'breeding_event_farm_type_date' }),
      Expense.collection.createIndex({ farmId: 1, date: -1 }, { name: 'expense_farm_date' }),
      Expense.collection.createIndex({ date: -1 }, { name: 'expense_date' }),
      Expense.collection.createIndex({ cowId: 1, date: -1 }, { name: 'expense_cow_date' }),
      Expense.collection.createIndex({ _healthId: 1 }, { name: 'expense_health', sparse: true }),
      Expense.collection.createIndex({ _purchaseCowId: 1 }, { name: 'expense_purchase', sparse: true }),
      Health.collection.createIndex({ cowId: 1, date: -1 }, { name: 'health_cow_date' }),
      Health.collection.createIndex({ nextDueDate: 1 }, { name: 'health_next_due', sparse: true }),
      Sale.collection.createIndex({ cowId: 1 }, { name: 'sale_cow' }),
      Sale.collection.createIndex({ date: -1 }, { name: 'sale_date' }),
      Cow.collection.createIndex({ status: 1 }, { name: 'cow_status' }),
      Cow.collection.createIndex(
        { farmId: 1, earTag: 1 },
        { name: 'cow_farm_ear_tag_unique', unique: true, partialFilterExpression: { earTag: { $type: 'string', $gt: '' } } }
      ),
      Cow.collection.createIndex({ motherId: 1 }, { name: 'cow_mother', sparse: true }),
      Cow.collection.createIndex({ batch: 1 }, { name: 'cow_batch' }),
      User.collection.createIndex({ email: 1 }, { name: 'user_email', sparse: true }),
      RateHistory.collection.createIndex({ date: -1 }, { name: 'rate_history_date' }),
      Health.collection.createIndex({ farmId: 1, cowId: 1, date: -1 }, { name: 'health_farm_cow_date' }),
      Sale.collection.createIndex({ farmId: 1, date: -1 }, { name: 'sale_farm_date' }),
      Cow.collection.createIndex({ farmId: 1, status: 1, createdAt: -1 }, { name: 'cow_farm_status_created' }),
      LaborAttendance.collection.createIndex({ farmId: 1, date: -1 }, { name: 'labor_attendance_farm_date' }),
      LaborAdvance.collection.createIndex({ farmId: 1, date: -1 }, { name: 'labor_advance_farm_date' }),
      Supplier.collection.createIndex({ farmId: 1, name: 1 }, { name: 'supplier_farm_name' }),
      SupplierPayment.collection.createIndex({ farmId: 1, supplierId: 1, date: -1 }, { name: 'supplier_payment_farm_supplier_date' }),
      RateHistory.collection.createIndex({ farmId: 1, date: -1 }, { name: 'rate_history_farm_date' }),
    ]);
  } catch (err) {
    // Duplicate key on existing bad data shouldn't crash boot — log and continue.
    console.warn('Index ensure warning:', err.message);
  }
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const CowSchema = new mongoose.Schema({
  _id: String,
  name: { type: String, required: true },
  breed: { type: String, required: true },
  gender: { type: String, enum: ['female', 'male'], default: 'female' },
  // Breeding lineage: an ear tag is unique within a farm; father can be
  // another registered male or an outside sire/straw record.
  earTag: { type: String, trim: true, default: '' },
  fatherId: { type: String, default: '' },
  fatherType: { type: String, enum: ['farm', 'outside'], default: 'farm' },
  fatherName: { type: String, default: '' },
  birthDate: String,
  ageYears: Number,
  weight: Number,
  status: { type: String, enum: ['active', 'inactive', 'dry', 'pregnant', 'sold', 'calf'], default: 'active' },
  image: { type: String, default: '' },
  purchasePrice: { type: Number, default: 0 },
  notes: String,
  calvingDate: String,
  lactationNumber: { type: Number, default: 0 },
  pregnancyDate: String,
  heatDate: String,
  dryDate: String,
  // Batch & lineage
  batch: { type: String, default: '' },
  motherId: { type: String, default: '' },
  isCalf: { type: Boolean, default: false },
  // Source calving event prevents duplicate calf creation and protects lineage lifecycle.
  calvingEventId: { type: String, default: '' },
  // Marketplace: asking price when the animal is up for sale, plus notes
  // about interested buyers and their offers.
  expectedPrice: { type: Number, default: 0 },
  // Photo gallery — dated photos of the animal over time (small base64 JPEGs).
  gallery: { type: [{
    id: String,
    date: String,
    base64: String,
    caption: String,
  }], default: [] },
  // Weight log — growth tracking per animal.
  weightHistory: { type: [{
    id: String,
    date: String,
    weightKg: Number,
    note: String,
  }], default: [] },
  marketNotes: { type: [{
    id: String,
    date: String,
    buyer: String,
    phone: String,
    offer: Number,
    note: String,
  }], default: [] },
  nursingUntil: String,
  calvingHistory: [{
    date: String,
    calfId: String,
    notes: String,
  }],
}, { timestamps: true });

const BreedingEventSchema = new mongoose.Schema({
  _id: String,
  cowId: { type: String, required: true, index: true },
  type: { type: String, enum: ['heat', 'service', 'pregnancy_check', 'calving'], required: true },
  date: { type: String, required: true },
  sireSource: { type: String, enum: ['', 'farm_bull', 'outside_bull', 'outside_straw'], default: '' },
  bullId: { type: String, default: '' },
  bullName: { type: String, default: '' },
  semenCode: { type: String, default: '' },
  technician: { type: String, default: '' },
  result: { type: String, default: '' },
  notes: { type: String, default: '' },
  // Each calving entry is either a live calf or a stillbirth outcome.
  calves: { type: [{ gender: { type: String, enum: ['female', 'male'], default: 'female' }, earTag: { type: String, default: '' }, outcome: { type: String, enum: ['live', 'stillbirth'], default: 'live' } }], default: [] },
  generatedCalfIds: { type: [String], default: [] },
}, { timestamps: true });

const MilkSchema = new mongoose.Schema({
  _id: String,
  cowId: { type: String, required: true },
  date: { type: String, required: true },
  morning: { type: Number, default: 0 },
  evening: { type: Number, default: 0 },
  calfMilk: { type: Number, default: 0 },
  fatPercent: Number,
  snfPercent: Number,
  buyerId: String
}, { timestamps: true });

const ExpenseSchema = new mongoose.Schema({
  _id: String,
  cowId: String,
  date: { type: String, required: true },
  type: { type: String, enum: ['feed', 'medicine', 'misc', 'equipment', 'labor', 'purchasing'], default: 'misc' },
  amount: { type: Number, required: true },
  // Feed purchases only: how many kg this purchase added to the feed stock.
  feedKg: { type: Number, default: 0 },
  note: String,
  // Supplier khata: optional dealer this purchase was made from (udhaar).
  supplierId: { type: String, default: '' },
  // Compressed base64 receipt photo (same pipeline as user avatars) —
  // replaced in place on edit so no orphaned images pile up in the DB.
  receiptBase64: { type: String, default: '' },
  _healthId: String,
  _purchaseCowId: String,
}, { timestamps: true });

// Field laborers (named wage workers — NOT app logins) + daily attendance.
// Mirrors agri_farm's Field Labor module; wage math twin: client/src/muf-labor.ts
const LaborerSchema = new mongoose.Schema({
  _id: String,
  name: { type: String, required: true },
  dailyWage: { type: Number, default: 0 },
  notes: { type: String, default: '' },
}, { timestamps: true });

const LaborAttendanceSchema = new mongoose.Schema({
  _id: String,
  workerId: { type: String, required: true, index: true },
  date: { type: String, required: true },
  dayType: { type: String, enum: ['full', 'half'], default: 'full' },
  posted: { type: Boolean, default: false },
  expenseId: { type: String, default: '' },
  notes: { type: String, default: '' },
}, { timestamps: true });

// Wage advances (udhaar to workers) — early payment of the same wages, so
// they are never a second expense; settled when their month is posted.
const LaborAdvanceSchema = new mongoose.Schema({
  _id: String,
  workerId: { type: String, required: true, index: true },
  date: { type: String, required: true },
  amount: { type: Number, required: true },
  settled: { type: Boolean, default: false },
  notes: { type: String, default: '' },
}, { timestamps: true });

const RateSchema = new mongoose.Schema({
  _id: String,
  value: { type: Number, required: true },
  date: String
}, { timestamps: true });

const HealthSchema = new mongoose.Schema({
  _id: String,
  cowId: { type: String, required: true },
  date: { type: String, required: true },
  type: { type: String, enum: ['vaccination', 'treatment', 'checkup', 'deworming', 'other'], required: true },
  description: { type: String, required: true },
  medicine: String,
  vet: String,
  nextDueDate: String,
  cost: { type: Number, default: 0 },
  notes: String
}, { timestamps: true });

const BuyerSchema = new mongoose.Schema({
  _id: String,
  name: { type: String, required: true },
  phone: String,
  address: String,
  defaultRate: Number,
  notes: String
}, { timestamps: true });

// Udhaar (credit) payments collected from milk buyers — pairs with the
// per-buyer running balance in the buyer khata.
const BuyerPaymentSchema = new mongoose.Schema({
  _id: String,
  buyerId: { type: String, required: true },
  date: { type: String, required: true },
  amount: { type: Number, required: true },
  note: String
}, { timestamps: true });

// Supplier khata (money going OUT): dealers the farm buys from on credit.
// Purchases = existing Expense records tagged with supplierId; payments
// made to the supplier live here — balance = purchases − payments.
const SupplierSchema = new mongoose.Schema({
  _id: String,
  name: { type: String, required: true },
  phone: String,
  address: String,
  notes: String
}, { timestamps: true });

const SupplierPaymentSchema = new mongoose.Schema({
  _id: String,
  supplierId: { type: String, required: true },
  date: { type: String, required: true },
  amount: { type: Number, required: true },
  note: String
}, { timestamps: true });

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  // owner / manager / worker (legacy 'admin' is converted to owner by the farms migration)
  role: { type: String, enum: ['owner', 'manager', 'worker', 'admin'], default: 'worker' },
  // Farms a manager or worker is assigned to. Owners see every farm.
  farmIds: { type: [String], default: [] },
  displayName: { type: String, default: '' },
  email: { type: String, default: '', trim: true, lowercase: true },
  // Profile avatar stored as a compressed base64 data-URL directly on the
  // user document. Replacing it overwrites the
  // old image in place, so no orphaned image data accumulates in the DB.
  avatarBase64: { type: String, default: '' },
  active: { type: Boolean, default: true },
  lastLoginAt: Date,
  farmName: { type: String, default: 'Usman Dairy Farm' }
}, { timestamps: true });

const PasswordResetSchema = new mongoose.Schema({
  purpose: { type: String, enum: ['reset_password', 'profile_update'], required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  usedAt: { type: Date, default: null },
}, { timestamps: true });

PasswordResetSchema.statics.generateCode = function () {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  return { code, codeHash };
};

PasswordResetSchema.methods.matchesCode = function (candidate) {
  if (!candidate || !this.codeHash) return false;
  const hash = crypto.createHash('sha256').update(String(candidate)).digest('hex');
  try {
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(this.codeHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

PasswordResetSchema.statics.createCode = async function ({ userId, purpose = 'reset_password' }) {
  const { code, codeHash } = this.generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await this.updateMany(
    { purpose, userId, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } }
  );
  await this.create({ purpose, userId, codeHash, expiresAt });
  return code;
};

const RateHistorySchema = new mongoose.Schema({
  _id: String,
  value: Number,
  date: String,
  note: String
}, { timestamps: true });

const ChecklistItemSchema = new mongoose.Schema({
  id: String,
  text: String,
  done: { type: Boolean, default: false }
}, { _id: false });

const DailyLogSchema = new mongoose.Schema({
  _id: String,
  date: { type: String, required: true },
  checklist: { type: [ChecklistItemSchema], default: [] },
  notes: { type: String, default: '' },
  // Short voice notes (Urdu-friendly) — small audio data-URLs, max 3 per day.
  voiceNotes: { type: [{
    id: String,
    base64: String,
    createdAt: String,
  }], default: [] },
  photos: { type: [{ id: String, date: String, data: String, bytes: Number, createdAt: String }], default: [] },
  // Independent diary notes; daily checklist/log fields stay compatible.
  diaryEntries: { type: [mongoose.Schema.Types.Mixed], default: [] },
}, { timestamps: true });

const SaleSchema = new mongoose.Schema({
  _id: String,
  cowId: { type: String, required: true },
  date: { type: String, required: true },
  salePrice: { type: Number, required: true },
  buyer: String,
  notes: String,
  previousStatus: { type: String, default: 'active' },
}, { timestamps: true });

// Small key/value store for app-level metadata (e.g. the monthly auto-backup).
const MetaSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

// Farms of this project (dairy farms only). See docs/FARMS_AND_ROLES.md.
const FarmSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  location: { type: String, default: '' },
  archived: { type: Boolean, default: false },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

// Every record below belongs to exactly one farm. User, PasswordReset, Meta and
// Farm stay global. The server adds the farmId; clients can never set it.
const FARM_SCOPED = {
  Cow: CowSchema, BreedingEvent: BreedingEventSchema, Milk: MilkSchema, Expense: ExpenseSchema, Laborer: LaborerSchema,
  LaborAttendance: LaborAttendanceSchema, LaborAdvance: LaborAdvanceSchema, Rate: RateSchema,
  Health: HealthSchema, Buyer: BuyerSchema, BuyerPayment: BuyerPaymentSchema,
  Supplier: SupplierSchema, SupplierPayment: SupplierPaymentSchema, RateHistory: RateHistorySchema,
  DailyLog: DailyLogSchema, Sale: SaleSchema,
};
export const MUF_FARM_SCOPED_NAMES = Object.keys(FARM_SCOPED);
for (const schema of Object.values(FARM_SCOPED)) {
  schema.add({ farmId: { type: String, index: true } });
}

// ─── Models ──────────────────────────────────────────────────────────────────
let Cow, BreedingEvent, Milk, Expense, Laborer, LaborAttendance, LaborAdvance, Rate, Health, Buyer, BuyerPayment, Supplier, SupplierPayment, User, PasswordReset, RateHistory, DailyLog, Sale, Meta, Farm;

if (USE_MEMORY) {
  const models = createStore({
    Cow: CowSchema,
    BreedingEvent: BreedingEventSchema,
    Milk: MilkSchema,
    Expense: ExpenseSchema,
    Laborer: LaborerSchema,
    LaborAttendance: LaborAttendanceSchema,
    LaborAdvance: LaborAdvanceSchema,
    Rate: RateSchema,
    Health: HealthSchema,
    Buyer: BuyerSchema,
    BuyerPayment: BuyerPaymentSchema,
    Supplier: SupplierSchema,
    SupplierPayment: SupplierPaymentSchema,
    User: UserSchema,
    PasswordReset: PasswordResetSchema,
    RateHistory: RateHistorySchema,
    DailyLog: DailyLogSchema,
    Sale: SaleSchema,
    Meta: MetaSchema,
    Farm: FarmSchema,
  });
  Cow = models.Cow;
  BreedingEvent = models.BreedingEvent;
  Milk = models.Milk;
  Expense = models.Expense;
  Laborer = models.Laborer;
  LaborAttendance = models.LaborAttendance;
  LaborAdvance = models.LaborAdvance;
  Rate = models.Rate;
  Health = models.Health;
  Buyer = models.Buyer;
  BuyerPayment = models.BuyerPayment;
  Supplier = models.Supplier;
  SupplierPayment = models.SupplierPayment;
  User = models.User;
  PasswordReset = models.PasswordReset;
  RateHistory = models.RateHistory;
  DailyLog = models.DailyLog;
  Sale = models.Sale;
  Meta = models.Meta;
  Farm = models.Farm;
} else {
  Cow = mongoose.model('Cow', CowSchema);
  BreedingEvent = mongoose.model('BreedingEvent', BreedingEventSchema);
  Milk = mongoose.model('Milk', MilkSchema);
  Expense = mongoose.model('Expense', ExpenseSchema);
  Laborer = mongoose.model('Laborer', LaborerSchema);
  LaborAttendance = mongoose.model('LaborAttendance', LaborAttendanceSchema);
  LaborAdvance = mongoose.model('LaborAdvance', LaborAdvanceSchema);
  Rate = mongoose.model('Rate', RateSchema);
  Health = mongoose.model('Health', HealthSchema);
  Buyer = mongoose.model('Buyer', BuyerSchema);
  BuyerPayment = mongoose.model('BuyerPayment', BuyerPaymentSchema);
  Supplier = mongoose.model('Supplier', SupplierSchema);
  SupplierPayment = mongoose.model('SupplierPayment', SupplierPaymentSchema);
  User = mongoose.model('User', UserSchema);
  PasswordReset = mongoose.model('PasswordReset', PasswordResetSchema);
  RateHistory = mongoose.model('RateHistory', RateHistorySchema);
  DailyLog = mongoose.model('DailyLog', DailyLogSchema);
  Sale = mongoose.model('Sale', SaleSchema);
  Meta = mongoose.model('Meta', MetaSchema);
  Farm = mongoose.model('Farm', FarmSchema);
}

// Server-side farm scoping for every farm-owned model (works for MongoDB and memory mode).
const MUF_FARM_MODELS = { Cow, BreedingEvent, Milk, Expense, Laborer, LaborAttendance, LaborAdvance, Rate, Health, Buyer, BuyerPayment, Supplier, SupplierPayment, RateHistory, DailyLog, Sale };
mufScopeModels(MUF_FARM_MODELS, MUF_FARM_SCOPED_NAMES);

export { MUF_FARM_MODELS, Farm, connectDB, Cow, BreedingEvent, Milk, Expense, Laborer, LaborAttendance, LaborAdvance, Rate, Health, Buyer, BuyerPayment, Supplier, SupplierPayment, User, PasswordReset, RateHistory, DailyLog, Sale, Meta };
