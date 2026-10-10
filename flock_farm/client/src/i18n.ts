// muf shared bilingual helper — app owns the language state; this module keeps
// the current value so any component can call L(en, vars?) without prop-drilling
// (App re-renders the whole tree when the language changes).
// ALL Urdu lives in the shared muf-urdu dictionary (MUF_URDU).
import { Lang } from './types';
import { mufL, mufUr } from './muf-urdu';

const STORAGE_KEY = 'ff_lang';
const LEGACY_KEY = 'flockfarm_lang';

let current: Lang = (() => {
  try {
    const v = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
    return (v === 'ur' ? 'ur' : 'en');
  }
  catch { return 'en'; }
})();

export function getLang(): Lang {
  return current;
}

export function setCurrentLang(lang: Lang): void {
  current = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
  document.documentElement.lang = lang === 'ur' ? 'ur' : 'en';
}

/**
 * Bilingual pick: L('Save') or L('Saved {n} cows', { n: 3 }).
 * Urdu comes from the shared muf-urdu dictionary (English fallback when missing).
 */
export function L(en: string, urOrVars?: string | Record<string, string | number | null>): string {
  return mufL(current, en, urOrVars);
}

// ── legacy key-based lookup (kept for the tab bar / small labels) ──────────
// Keys map to English text; the Urdu translation is always MUF_URDU[english].
const EN: Record<string, string> = {
  appName: 'Usman Flock Farm',
  appSubtitle: 'Poultry Farm Management',
  dashboard: 'Dashboard',
  flock: 'Flock Registry',
  batches: 'Batches',
  ledger: 'Financial Ledger',
  health: 'Health Portal',
  incubation: 'Incubation',
  operations: 'Daily Ops',
  summary: 'Reports',
  labor: 'Labor',
  settings: 'Settings',
  today: 'Today',
  totalIncome: 'Total Income',
  totalExpenses: 'Total Expenses',
  netProfit: 'Net Profit/Loss',
  costPerEgg: 'Cost per Egg',
  costPerBird: 'Cost per Bird',
  productionRate: 'Eggs/Hen/Day',
  activeBirds: 'Active Birds',
  mortality: 'Mortality',
  save: 'Save',
  cancel: 'Cancel',
  edit: 'Edit',
  delete: 'Delete',
  add: 'Add',
  search: 'Search',
  shareWhatsApp: 'Share via WhatsApp',
  shareEmail: 'Share via Email',
  syncSaving: 'Saving…',
  syncSaved: 'Saved',
  syncError: 'Save failed',
  syncConflict: 'Updated by another user — reloading…',
  roleAdmin: 'Admin',
  roleWorker: 'Worker',
  dateRange: 'Date range',
  allTime: 'All time',
  thisMonth: 'This month',
  last30Days: 'Last 30 days',
  customRange: 'Custom',
  alerts: 'Alerts',
  checklist: 'Daily Checklist',
  diary: 'Farm Diary',
  customers: 'Customers',
  birdSales: 'Bird Sales',
  noEggToday: 'No egg entry logged today',
  feedLowStock: 'Feed may be running low',
  vaccinationDue: 'Vaccination due',
  loginTitle: 'Welcome to Usman Flock Farm',
  loginSubtitle: 'Select your role and enter passcode to access your farm dashboard.',
  selectRole: 'Select Your Access Role',
  enterPasscode: 'Enter Admin Passcode',
  loginBtn: 'Sign In to Dashboard',
  wrongPin: 'Incorrect Admin PIN. Please try again.',
  logout: 'Sign Out',
  rememberMe: 'Keep me signed in',
  workerNoPin: 'Worker access does not require a PIN.',
};

export function t(lang: Lang, key: string): string {
  const en = EN[key] ?? key;
  return lang === 'ur' ? mufUr(en) : en;
}

export function tChecklistTask(lang: Lang, task: { labelEn: string }): string {
  return lang === 'ur' ? mufUr(task.labelEn) : task.labelEn;
}
