export type Gender = 'Male' | 'Female';
export type BirdStatus = 'Active' | 'Sold' | 'Dead' | 'Sick';
export type DeathReason = 'Disease' | 'Injury' | 'Predator' | 'Other' | 'Unknown';
export type BirdBreed = 'Desi' | 'Rhode Island' | 'Broiler' | 'Layer' | 'Fayoumi' | 'Aseel' | 'Golden' | 'Misri' | 'Custom';
export type UserRole = 'admin' | 'worker';
export type Lang = 'en' | 'ur' | 'roman';
export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

export interface VaccinationRecord {
  id: number;
  birdId: number;
  date: string;
  vaccineName: string;
  dose?: string;
  cost?: number;
  notes?: string;
}

export interface Bird {
  id: number;
  name: string;
  gender: Gender;
  dateBought: string;
  price: number;
  status: BirdStatus;
  ageBoughtDays: number;
  breed?: BirdBreed;
  customBreed?: string;
  image?: string;
  dateOfBirth?: string;
  dateDied?: string;
  deathReason?: DeathReason;
  deathDetail?: string;
  lastVaccinationDate?: string;
  sourceIncubationId?: number;
  salePrice?: number;
  saleDate?: string;
}

export type ExpenseCategory = 'Medicine' | 'Repair' | 'Utility' | 'Other';

export interface OtherExpense {
  id: number;
  date: string;
  detail: string;
  category: ExpenseCategory;
  amount: number;
  notes?: string;
  supplierId?: number | string; // supplier khata: dealer this was bought from
  receiptBase64?: string;
}

export type FeedType =
  | 'Khal & Choker'
  | 'Corn'
  | 'Wheat'
  | 'Grains'
  | 'Supplements'
  | 'Medicine'
  | 'Other'
  | 'Eggs';

export interface FeedRecord {
  id: number;
  date: string;
  feedType: FeedType;
  quantityKg: number;
  rateRsPerKg: number;
  notes?: string;
  supplierId?: number | string; // supplier khata: dealer this was bought from
}

// Supplier khata (dealers the farm buys from on credit)
export interface Supplier {
  id: number | string;
  name: string;
  phone?: string;
  notes?: string;
}

export interface SupplierPayment {
  id: number | string;
  supplierId: number | string;
  date: string;
  amount: number;
  note?: string;
}

export interface Customer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface CustomerSale {
  id: number;
  customerId: number;
  date: string;
  eggsQty: number;
  pricePerEgg: number;
  amountPaid: number;
  notes?: string;
}

export interface EggProduction {
  date: string;
  totalEggsCollected: number;
  sold: number;
  homeUse: number;
  brokenWasted: number;
  pricePerEgg?: number;
  customerId?: number;
}

export interface IncubationRecord {
  id: number;
  startDate: string;
  /** Batch that supplied these eggs; absent on historical records created before batch traceability. */
  sourceBatchId?: string;
  eggsSet: number;
  hatchDate?: string;
  hatched: number;
  brokenEggs?: number;
  spoiledEggs?: number;
  infertileEggs?: number;
  deadInShellEggs?: number;
  notes?: string;
  flockTransferDate?: string;
  flockTransferCount?: number;
}

export interface DailyChecklistEntry {
  date: string;
  completed: string[];
}

export interface DiaryEntry {
  id?: string;
  date: string;
  note: string;
  // Optional short voice note (audio data-URL, max ~60s) — Urdu-friendly input.
  voiceBase64?: string;
  photos?: { id: string; date: string; data: string; bytes: number; createdAt: string }[];
  linkedEntity?: { id: string; type: string; label: string } | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface GlobalSettings {
  defaultPricePerEgg: number;
  vaccinationIntervalDays: number;
  feedLowStockDays?: number;
  feedConsumptionKgPerDay?: number;
}

export interface MonthlySummaryItem {
  month: string;
  totalExpense: number;
  eggIncome: number;
  birdSaleIncome: number;
  netBalance: number;
  eggsCollected: number;
  birdPurchase: number;
  feedCost: number;
  feedKg: number;
  otherExpenses: number;
}

export interface DateRange {
  from: string;
  to: string;
}

export type BatchType = 'Broiler' | 'Layer' | 'Breeder' | 'Custom';
export type BatchStatus = 'Active' | 'Closed';

export interface BatchRecord {
  _id: string;
  batch_id: string;
  name: string;
  type: BatchType;
  start_date: string;
  expected_end_date?: string;
  intake_count: number;
  source?: string;
  image_path?: string;
  gallery?: string[];
  cost_per_bird: number;
  status: BatchStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface BatchFeedLog {
  _id: string;
  batch_id: string;
  date: string;
  feed_type: string;
  quantity_kg: number;
  rate_rs_per_kg: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BatchMortalityLog {
  _id: string;
  batch_id: string;
  date: string;
  count: number;
  reason?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BatchExpenseLog {
  _id: string;
  batch_id: string;
  date: string;
  category: 'Medicine' | 'Vaccination' | 'Misc' | 'Other';
  detail: string;
  amount: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BatchWeightLog {
  _id: string;
  batch_id: string;
  date: string;
  avg_weight_g: number;
  sample_size?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BatchSaleLog {
  _id: string;
  batch_id: string;
  date: string;
  count: number;
  amount: number;
  buyer?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BatchEggLog {
  _id: string;
  batch_id: string;
  date: string;
  collected: number;
  sold: number;
  home_use: number;
  broken_wasted: number;
  price_per_egg: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BatchVaccinationLog {
  _id: string;
  batch_id: string;
  date: string;
  vaccine_name: string;
  dose?: string;
  bird_count: number;
  cost: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BatchSummary {
  intake_cost: number;
  total_feed_cost: number;
  total_expense_cost: number;
  total_vaccination_cost: number;
  total_eggs_collected: number;
  total_eggs_sold: number;
  /** Collected eggs remaining after sold, home-use and broken/wasted counts, before incubation allocations. */
  total_eggs_available: number;
  total_egg_income: number;
  total_mortality_count: number;
  total_sold_count: number;
  total_revenue: number;
  total_cost: number;
  live_count: number;
  profit_loss: number;
  mortality_pct: number;
  cost_per_bird: number;
}

export interface BatchWithSummary extends BatchRecord {
  summary: BatchSummary;
}

export interface BatchDetail {
  batch: BatchWithSummary;
  feed_logs: BatchFeedLog[];
  mortality_logs: BatchMortalityLog[];
  expense_logs: BatchExpenseLog[];
  sales_logs: BatchSaleLog[];
  weight_logs: BatchWeightLog[];
  egg_logs: BatchEggLog[];
  vaccination_logs: BatchVaccinationLog[];
}

export interface BatchBackupBundle {
  batches: BatchRecord[];
  feed_logs: BatchFeedLog[];
  mortality_logs: BatchMortalityLog[];
  expense_logs: BatchExpenseLog[];
  sales_logs: BatchSaleLog[];
  weight_logs?: BatchWeightLog[];
  egg_logs?: BatchEggLog[];
  vaccination_logs?: BatchVaccinationLog[];
}

// Field labor — named wage workers (NOT app logins) + daily attendance.
// Wage math twin: src/muf-labor.ts (same file in dairy, JS twin in agri).
export interface LaborWorker {
  id: string;
  name: string;
  dailyWage: number;
  notes?: string;
}

export interface LaborAttendanceEntry {
  id: string;
  workerId: string;
  date: string; // YYYY-MM-DD
  dayType: 'full' | 'half';
  /** Optional batch the worker was assigned to for this day's work. */
  batchId?: string;
  posted?: boolean;
  notes?: string;
}

export interface LaborAdvanceEntry {
  id: string;
  workerId: string;
  date: string; // YYYY-MM-DD
  amount: number;
  settled?: boolean; // true once its month has been posted to the ledger
  notes?: string;
}

export const CHECKLIST_TASKS = [
  { id: 'collect_eggs', labelEn: 'Collect eggs' },
  { id: 'feed_birds', labelEn: 'Feed birds' },
  { id: 'check_water', labelEn: 'Check water' },
  { id: 'clean_coop', labelEn: 'Clean coop' },
  { id: 'health_check', labelEn: 'Health check' },
  { id: 'lock_coop', labelEn: 'Lock coop at night' },
] as const;
