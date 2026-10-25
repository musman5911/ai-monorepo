export type CowStatus = 'active' | 'inactive' | 'dry' | 'pregnant' | 'sold' | 'calf';

export interface Cow {
  _id: string;
  name: string;
  breed: string;
  gender?: 'female' | 'male';
  earTag?: string;
  fatherId?: string;
  fatherType?: 'farm' | 'outside';
  fatherName?: string;
  birthDate?: string;
  ageYears?: number;
  weight?: number;
  status: CowStatus;
  image?: string;
  notes?: string;
  calvingDate?: string;
  lactationNumber?: number;
  pregnancyDate?: string;
  heatDate?: string;
  dryDate?: string;
  batch?: string;
  motherId?: string;
  isCalf?: boolean;
  nursingUntil?: string;
  purchasePrice?: number;
  calvingHistory?: { date: string; calfId?: string; notes?: string }[];
  expectedPrice?: number;
  marketNotes?: MarketNote[];
  weightHistory?: WeightEntry[];
  gallery?: GalleryPhoto[];
}

export interface GalleryPhoto {
  id: string;
  date: string;
  base64: string;
  caption?: string;
}

export interface WeightEntry {
  id: string;
  date: string;
  weightKg: number;
  note?: string;
}

export interface MarketNote {
  id: string;
  date: string;
  buyer: string;
  phone?: string;
  offer?: number;
  note?: string;
}

export interface MilkEntry {
  _id: string;
  cowId: string;
  date: string;
  morning: number;
  evening: number;
  calfMilk?: number;
  fatPercent?: number;
  snfPercent?: number;
  buyerId?: string;
}

export type ExpenseType = 'feed' | 'medicine' | 'misc' | 'equipment' | 'labor' | 'purchasing';

export interface Expense {
  _id: string;
  cowId?: string;
  date: string;
  type: ExpenseType;
  amount: number;
  feedKg?: number;
  note?: string;
  supplierId?: string;
  receiptBase64?: string;
}

// Supplier khata (dealers the farm buys from on credit)
export interface Supplier {
  _id: string;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export interface SupplierPayment {
  _id: string;
  supplierId: string;
  date: string;
  amount: number;
  note?: string;
}

export type HealthType = 'vaccination' | 'treatment' | 'checkup' | 'deworming' | 'other';

export interface HealthRecord {
  _id: string;
  cowId: string;
  date: string;
  type: HealthType;
  description: string;
  medicine?: string;
  vet?: string;
  nextDueDate?: string;
  cost?: number;
  notes?: string;
}

export interface Buyer {
  _id: string;
  name: string;
  phone?: string;
  address?: string;
  defaultRate?: number;
  notes?: string;
}

export interface BuyerPayment {
  _id: string;
  buyerId: string;
  date: string;
  amount: number;
  note?: string;
}

export interface Rate {
  _id: string;
  value: number;
  date?: string;
  updatedAt?: string;
}

export interface RateHistory {
  _id: string;
  value: number;
  date: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface DailyLog {
  _id: string;
  date: string;
  checklist: ChecklistItem[];
  notes: string;
}

export interface Sale {
  _id: string;
  cowId: string;
  date: string;
  salePrice: number;
  buyer?: string;
  notes?: string;
  previousStatus?: string;
}

export type UserRole = 'admin' | 'worker';

export interface AuthUser {
  farmRole?: 'owner' | 'manager' | 'worker';
  _id: string;
  username: string;
  role: UserRole;
  displayName?: string;
  email?: string;
  avatarBase64?: string;
  active: boolean;
  farmName?: string;
  lastLoginAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AuthState {
  token: string;
  role: UserRole;
  username: string;
}

/** Lifetime block returned by GET /cows/:id/summary */
export interface CowLifetime {
  purchasePrice: number;
  salePrice: number;
  totalMilkLiters: number;
  milkRecords: MilkEntry[];
  totalDirectExpenses: number;
  /** Sum of health.cost (may overlap with medicine expenses) */
  totalHealthCost: number;
  /** Health costs not mirrored as expenses — add these to P&L */
  unlinkedHealthCost?: number;
}
