// Extracted from App.jsx — pure helpers for the agri dashboard + forms.
// No UI, no React, no component state. App.jsx imports these so the
// 5,557-line file stays focused on rendering + stateful handlers.
//
// TWIN SCOPE: agri-only (not a muf-* file). dairy and flock have their
// own equivalents inlined in their Dashboards; if the three converge on
// a shared shape, promote to a muf-* twin.

import { mufToday, mufMonth } from '../../muf/data/muf-date';
import { sumMonth, pctChange, sameMonthLastYearKey } from '../../muf/data/muf-compare';

// ─── Form factories ─────────────────────────────────────────────────────────

export function getEmptyCropForm() {
  return {
    name: '',
    variety: '',
    status: 'Growing',
    plant_date: '',
    harvest_date: '',
    field: '',
    fieldId: '',
    yield_kg: '',
    yield_unit: 'kg',
    area_kanal: '1.0',
    notes: '',
    image_base64: '',
    seed_quantity: '0',
    seed_unit: 'kg',
    seed_cost_per_unit: '0',
    season: 'Rabi',
    crop_year: new Date().getFullYear().toString()
  };
}

export function getEmptyFinForm() {
  return {
    category: '',
    amount: '',
    type: 'expense',
    crop_id: 'farm-wide',
    notes: '',
    supplier_id: '',
    receipt_base64: '',
    date: mufToday(),
    buyer_name: '',
    quantity_sold: '0',
    rate_per_unit: '0',
    seed_qty_kg: '0',
    seed_price_per_kg: '0',
    plough_hours: '0',
    cultivator_hours: '0',
    fuel_cost: '0',
    hourly_rate: '0',
    labor_workers: '0',
    labor_days: '0',
    labor_wage_rate: '0',
    fertilizer_bags: '0',
    fertilizer_price_per_bag: '0',
    custom_qty: '0',
    custom_price: '0',
    tubewell: 'rented',
    hours: '',
    chemical: '',
    dose: '',
    spray_image: '',
    inventory_item_id: '',
    inventory_qty_consumed: ''
  };
}

export function getEmptyTaskForm() {
  return {
    title: '',
    due_date: '',
    assigned_to: '',
    priority: 'Medium',
    notes: '',
    image_base64: '',
    labor_cost: '0',
    inventory_item_id: '',
    inventory_qty_consumed: '0',
    crop_id: 'farm-wide',
    laborer_ids: []
  };
}

// ─── Formatters + lookups ───────────────────────────────────────────────────

export const formatCurrency = (amount) =>
  (Number(amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const cropImageMap = {
  wheat: '/crop_cards/wheat.jpg',
  corn: '/crop_cards/corn.jpg',
  maize: '/crop_cards/corn.jpg',
  bajra: '/crop_cards/bajra.jpg',
  millet: '/crop_cards/bajra.jpg',
  mattar: '/crop_cards/mattar.jpg',
  peas: '/crop_cards/mattar.jpg',
  pea: '/crop_cards/mattar.jpg',
  jundra: '/crop_cards/jundra.jpg',
  rice: '/crop_cards/rice.jpg',
  paddy: '/crop_cards/rice.jpg',
  basmati: '/crop_cards/rice.jpg',
  cotton: '/crop_cards/cotton.jpg',
  kapas: '/crop_cards/cotton.jpg',
  mustard: '/crop_cards/mustard.jpg',
  sarson: '/crop_cards/mustard.jpg',
  canola: '/crop_cards/mustard.jpg'
};

export function getCropImage(name = '') {
  const key = String(name).toLowerCase().trim();
  if (cropImageMap[key]) return cropImageMap[key];
  for (const [alias, src] of Object.entries(cropImageMap)) {
    if (key.includes(alias)) return src;
  }
  return '/crop_cards/field_header.jpg';
}

/**
 * Crop progress percentage (0–100) based on plant/harvest dates.
 * - Completed → 100
 * - Past target harvest but not marked Completed → 95 (nudges user to close out)
 * - Otherwise → elapsed / total growing window
 * - No dates → status-based fallback (Harvesting=82, Growing=58, else 0)
 */
export function getCropProgress(crop) {
  if (!crop) return 0;
  if (crop.status === 'Completed') return 100;
  const plant = crop.plant_date ? new Date(crop.plant_date) : null;
  const harvest = crop.harvest_date ? new Date(crop.harvest_date) : null;
  if (plant && harvest && harvest > plant) {
    const now = Date.now();
    const total = harvest - plant;
    const elapsed = now - plant;
    if (elapsed <= 0) return 0;
    if (elapsed >= total) return 95;
    return Math.max(1, Math.round((elapsed / total) * 100));
  }
  // Fallback to status-based when dates are missing
  if (crop.status === 'Harvesting') return 82;
  if (crop.status === 'Growing') return 58;
  return 0;
}

// ─── Dashboard math ─────────────────────────────────────────────────────────

/**
 * Build the data shape consumed by muf-farm-profile's PDF/profile card.
 * Summarises land under crops, growing cycles, crop names, and the last 6
 * months of sales income.
 */
export function buildAgriProfileData(crops, finance) {
  const growing = crops.filter(c => c.status === 'Growing');
  const totalKanal = crops.reduce((a, c) => a + (parseFloat(c.area_kanal) || 0), 0);
  const cropNames = Array.from(new Set(crops.map(c => c.name).filter(Boolean))).slice(0, 5).join(', ');
  const byMonth = {};
  finance.forEach(f => {
    if (f.type !== 'income' || !f.date || typeof f.date !== 'string' || f.date.length < 7) return;
    const mk = f.date.slice(0, 7);
    byMonth[mk] = (byMonth[mk] || 0) + (Number(f.amount) || 0);
  });
  const rows = Object.keys(byMonth).sort().slice(-6).map(mk => [mk, `Rs. ${Math.round(byMonth[mk]).toLocaleString()}`]);
  return {
    tagline: 'Quality crops grown with care — full records for every cycle.',
    stats: [
      ['Land under crops', `${totalKanal.toLocaleString()} kanal`],
      ['Crop cycles registered', `${crops.length}`],
      ['Growing now', `${growing.length}`],
      ...(cropNames ? [['Crops', cropNames]] : []),
      ['Records kept', 'Daily care, harvest & ledger logs'],
    ],
    monthlyTitle: 'Monthly sales income (last 6 months)',
    monthlyHead: ['Month', 'Income'],
    monthlyRows: rows,
  };
}

/**
 * Month-over-month + same-month-last-year comparison for the agri dashboard.
 * Pure function — same inputs always produce the same output.
 *
 * @param finance  - finance ledger rows (each has type, date, amount)
 * @param cmpCurKey - YYYY-MM for the current month
 * @param cmpPrevKey - YYYY-MM for last month
 */
export function buildAgriComparison(finance, cmpCurKey, cmpPrevKey) {
  const inc = (mk) => Math.round(sumMonth(finance.filter(f => f.type === 'income'), mk, (f) => f.amount || 0));
  const exp = (mk) => Math.round(sumMonth(finance.filter(f => f.type === 'expense'), mk, (f) => f.amount || 0));
  const curInc = inc(cmpCurKey); const prevInc = inc(cmpPrevKey);
  const curExp = exp(cmpCurKey); const prevExp = exp(cmpPrevKey);
  const curNet = curInc - curExp; const prevNet = prevInc - prevExp;
  const lyKey = sameMonthLastYearKey();
  const lyInc = inc(lyKey); const lyExp = exp(lyKey);
  const lyNet = lyInc - lyExp;
  const hasLy = finance.some(f => String(f.date || '').startsWith(lyKey));
  return {
    curInc, prevInc, curExp, prevExp, curNet, prevNet,
    netPct: pctChange(curNet, prevNet),
    incPct: pctChange(curInc, prevInc),
    lyInc, lyNet, hasLy,
    lyIncPct: pctChange(curInc, lyInc),
    lyNetPct: pctChange(curNet, lyNet),
  };
}

/**
 * Last 12 months of income, as { label, value } pairs for MufAreaChart.
 */
export function buildDashboardIncomeSeries(finance) {
  const byM = {};
  finance.forEach(f => {
    if (f.type !== 'income' || !f.date || typeof f.date !== 'string' || f.date.length < 7) return;
    const k = f.date.slice(0, 7);
    byM[k] = (byM[k] || 0) + (Number(f.amount) || 0);
  });
  return Object.keys(byM).sort().slice(-12).map(k => ({ label: k.slice(2), value: byM[k] }));
}

/**
 * Monthly breakdown of expenses by category for the selected period.
 * Returns [{ category, amount, percentage }] sorted by amount descending.
 */
export function buildExpenseBreakdown(filteredPeriodFinance) {
  const categories = {};
  const periodExpenses = filteredPeriodFinance.filter(f => f.type === 'expense');
  periodExpenses.forEach(f => {
    categories[f.category] = (categories[f.category] || 0) + f.amount;
  });
  const totalCatExpense = Object.values(categories).reduce((sum, val) => sum + val, 0);
  return Object.entries(categories)
    .map(([cat, amt]) => ({
      category: cat,
      amount: amt,
      percentage: totalCatExpense > 0 ? Math.round((amt / totalCatExpense) * 100) : 0
    }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Monthly income/expense/cycles table for the reports view.
 * Filters by crop ID when reportsCropFilter !== 'all'.
 *
 * @param finance            - finance ledger rows
 * @param crops              - crop records (for cycle counts per month)
 * @param reportsCropFilter  - 'all' or a crop _id
 * @param sortOrder          - 'oldest' (ascending) or anything else (descending)
 */
export function buildMonthlyComparisonRows(finance, crops, reportsCropFilter, sortOrder) {
  const monthsData = {};

  // Accumulate ledger entries
  finance.forEach(f => {
    if (reportsCropFilter !== 'all' && f.crop_id !== reportsCropFilter) return;
    if (f.date && typeof f.date === 'string' && f.date.length >= 7) {
      const mKey = f.date.slice(0, 7);
      if (!monthsData[mKey]) {
        monthsData[mKey] = { income: 0, expense: 0, cropsCount: 0 };
      }
      if (f.type === 'income') monthsData[mKey].income += f.amount;
      if (f.type === 'expense') monthsData[mKey].expense += f.amount;
    }
  });

  // Accumulate crop cycles
  crops.forEach(c => {
    if (reportsCropFilter !== 'all' && c._id !== reportsCropFilter) return;
    if (c.plant_date && typeof c.plant_date === 'string' && c.plant_date.length >= 7) {
      const mKey = c.plant_date.slice(0, 7);
      if (!monthsData[mKey]) {
        monthsData[mKey] = { income: 0, expense: 0, cropsCount: 0 };
      }
      monthsData[mKey].cropsCount += 1;
    }
  });

  return Object.entries(monthsData).sort((a, b) => {
    if (sortOrder === 'oldest') {
      return a[0].localeCompare(b[0]);
    } else {
      return b[0].localeCompare(a[0]);
    }
  });
}
