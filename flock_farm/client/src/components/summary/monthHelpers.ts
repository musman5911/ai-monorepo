// Extracted from MonthlySummary.tsx — pure month/format helpers + the
// flock-profile data builder. No UI, no React, no component state.
//
// TWIN SCOPE: flock-only (not a muf-* file). The month helpers
// (monthKey/monthLabel/subtractMonths/buildLastNMonths/monthRange) are thin
// wrappers around muf-date / muf-compare twins; they stay here because
// MonthlySummary composes them in a flock-specific way.
import type { Bird, EggProduction, DateRange } from '../../types';
import { todayStr, formatLocalDate } from '../../utils/calculations';
import { mufMonthLabel, mufShiftMonth } from '../../muf/data/muf-date';

export const formatRs = (value: number) => `Rs ${Math.round(value || 0).toLocaleString()}`;
export const formatKg = (value: number) => `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`;

/**
 * Build the data shape consumed by muf-farm-profile's PDF/profile card.
 * Summarises the flock (active birds, laying hens, breeds) + the last 6
 * months of egg production with daily averages.
 */
export function buildFlockProfileData(
  birds: Bird[],
  eggProduction: EggProduction[],
): Omit<import('../../muf/data/muf-profile').MufProfileOpts, 'contact'> {
  const active = birds.filter(b => b.status === 'Active' || b.status === 'Sick');
  const hens = active.filter(b => b.gender === 'Female');
  const breeds = Array.from(new Set(active.map(b => b.breed).filter(Boolean))).slice(0, 4).join(', ');
  const byMonth: Record<string, { eggs: number; days: Set<string> }> = {};
  eggProduction.forEach(e => {
    const mk = (e.date || '').slice(0, 7);
    if (!mk) return;
    if (!byMonth[mk]) byMonth[mk] = { eggs: 0, days: new Set() };
    byMonth[mk].eggs += e.totalEggsCollected || 0;
    byMonth[mk].days.add(e.date);
  });
  const rows = Object.keys(byMonth).sort().slice(-6).map(mk => {
    const v = byMonth[mk];
    const avg = v.days.size ? v.eggs / v.days.size : 0;
    return [mk, `${v.eggs.toLocaleString()} eggs`, `${avg.toFixed(0)} eggs/day`];
  });
  return {
    tagline: 'Fresh eggs from a healthy, well-kept flock — daily records for every bird.',
    stats: [
      ['Flock size', `${active.length} birds`],
      ['Laying hens', `${hens.length}`],
      ...(breeds ? [['Breeds', breeds] as [string, string]] : []),
      ['Records kept', 'Daily eggs, feed & health logs'],
    ],
    monthlyTitle: 'Monthly egg production (last 6 months)',
    monthlyHead: ['Month', 'Total Eggs', 'Average'],
    monthlyRows: rows,
  };
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function monthLabel(month: string): string {
  return mufMonthLabel(month);
}

export function subtractMonths(month: string, amount: number): string {
  return mufShiftMonth(month, -amount);
}

export function buildLastNMonths(count: number): string[] {
  const current = monthKey(todayStr());
  return Array.from({ length: count }, (_, i) => subtractMonths(current, count - 1 - i));
}

/** Build a DateRange that covers every month in the input list (inclusive). */
export function monthRange(months: string[]): DateRange | null {
  if (months.length === 0) return null;
  const sorted = [...months].sort((a, b) => a.localeCompare(b));
  const from = `${sorted[0]}-01`;
  const [y, m] = sorted[sorted.length - 1].split('-').map(Number);
  const end = new Date(y, m, 0);
  const to = formatLocalDate(end);
  return { from, to };
}
