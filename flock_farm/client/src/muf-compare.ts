import { mufMonth, mufShiftMonth, mufMonthLabel } from './muf-date';

/* ══
   muf-compare — "this month vs last month" helper.
   muf shared file: keep identical in all three farm apps
   (dairy_farm / flock_farm / agri_farm — .ts in dairy & flock,
   .js twin in agri).
   ═══════════════════════════════════════════════════════════════ */

/** 'YYYY-MM' of the current month. */
export function thisMonthKey(): string {
  return mufMonth();
}

/** 'YYYY-MM' of the previous month. */
/** Same month LAST YEAR, e.g. 2026-08 → 2025-08 (season-vs-season compare). */
export function sameMonthLastYearKey(): string {
  return mufShiftMonth(mufMonth(), -12);
}

export function lastMonthKey(): string {
  return mufShiftMonth(mufMonth(), -1);
}

/** Human label like 'August 2026' for a 'YYYY-MM' key. */
export function monthKeyLabel(key: string): string {
  return mufMonthLabel(key);
}

/** % change from prev → cur. Returns null when prev is 0 (no baseline). */
export function pctChange(cur: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((cur - prev) / Math.abs(prev)) * 100);
}

/** '▲ 6%' / '▼ 12%' / '—' formatting for a pct change. */
export function trendArrow(pct: number | null): string {
  if (pct === null) return '—';
  if (pct > 0) return `▲ ${pct}%`;
  if (pct < 0) return `▼ ${Math.abs(pct)}%`;
  return '● 0%';
}

/** Sum records of a month by a value getter (records need a 'date' YYYY-MM-DD...). */
export function sumMonth<T extends { date: string }>(rows: T[], monthKey: string, value: (r: T) => number): number {
  let total = 0;
  for (const r of rows) if (String(r.date || '').startsWith(monthKey)) total += value(r) || 0;
  return total;
}
