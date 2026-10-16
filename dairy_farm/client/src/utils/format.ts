import {mufLastMonths} from '../muf/data/muf-date';
/**
 * Number formatting utilities
 */

/** Round to N decimal places */
export function round(n: number, decimals = 2): number {
  return Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/** Format number with commas and max 2 decimals: 1234.5 → "1,234.50" */
export function fmt(n: number, decimals = 2): string {
  return round(n, decimals).toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

/** Format as PKR currency: 1234.5 → "₨ 1,234.50" */
export function fmtPKR(n: number): string {
  return `₨ ${fmt(n)}`;
}

/** Format liters: 12.345 → "12.35 L" */
export function fmtL(n: number): string {
  return `${fmt(n)} L`;
}

/** Get month key from date string: "2026-07-24" → "2026-07" */
export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

/** Get month label from key: "2026-07" → "Jul 2026" */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

/** Get last N month keys including current: ["2026-02", "2026-03", ..., "2026-07"] */
export function lastNMonths(n: number): string[] {
  return mufLastMonths(n);
}
