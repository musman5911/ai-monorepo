import type { RateHistory } from '../types';

/**
 * Given a sorted list of rate history entries (newest first) and a date string,
 * returns the rate that was active on that date.
 *
 * RateHistory stores when a rate *started*: { value: 130, date: "2026-06-01" }
 * means the rate was 130 from June 1 onwards (until the next entry).
 */
export function getRateForDate(
  dateStr: string,
  history: RateHistory[],
  currentRate: number,
  currentDate: string,
): number {
  const timeline: { date: string; value: number }[] = [];

  // Only include current rate if it has a real start date
  if (currentDate && /^\d{4}-\d{2}-\d{2}$/.test(currentDate) && Number.isFinite(currentRate)) {
    timeline.push({ date: currentDate, value: currentRate });
  }

  for (const h of history || []) {
    if (h?.date && /^\d{4}-\d{2}-\d{2}$/.test(h.date) && Number.isFinite(h.value)) {
      timeline.push({ date: h.date, value: h.value });
    }
  }

  if (timeline.length === 0) {
    return Number.isFinite(currentRate) ? currentRate : 0;
  }

  // Sort by date descending (newest first)
  timeline.sort((a, b) => b.date.localeCompare(a.date));

  // Find the first entry whose date <= dateStr
  for (const entry of timeline) {
    if (entry.date <= dateStr) return entry.value;
  }

  // If all history is after dateStr, use the oldest known rate
  return timeline[timeline.length - 1].value;
}

/** Saleable liters = morning + evening − calf milk (never negative). */
export function saleableMilkLiters(m: { morning?: number; evening?: number; calfMilk?: number }): number {
  return Math.max(0, (m.morning || 0) + (m.evening || 0) - (m.calfMilk || 0));
}

/**
 * Calculate revenue for an array of milk entries using historical rates.
 * Uses saleable liters (excludes calf milk).
 */
export function calcRevenueWithHistory(
  milkEntries: { date: string; morning: number; evening: number; calfMilk?: number; buyerId?: string }[],
  history: RateHistory[],
  currentRate: number,
  currentDate: string,
  buyerRates?: Record<string, number>,
): number {
  let total = 0;
  for (const m of milkEntries) {
    const buyerRate = m.buyerId && buyerRates ? buyerRates[m.buyerId] : undefined;
    const rate = (buyerRate && buyerRate > 0) ? buyerRate : getRateForDate(m.date, history, currentRate, currentDate);
    total += saleableMilkLiters(m) * rate;
  }
  return Math.round(total * 100) / 100;
}
