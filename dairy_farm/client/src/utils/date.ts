/**
 * Date utilities — thin wrappers over the shared muf-date twin.
 * (Kept for existing importers; new code should import muf-date directly.)
 */
import { mufToday, mufShiftDays, mufParse } from '../muf-date';

/** Returns today's date as YYYY-MM-DD in the local timezone */
export function todayStr(): string {
  return mufToday();
}

/** Shift a YYYY-MM-DD date string by `days` (positive or negative) */
export function shiftDate(dateStr: string, days: number): string {
  return mufShiftDays(dateStr, days);
}

/**
 * Format a YYYY-MM-DD (or ISO) date for display without UTC off-by-one.
 * Always treats bare dates as local calendar days.
 */
export function formatDate(dateStr: string | undefined | null, opts?: Intl.DateTimeFormatOptions): string {
  if (!dateStr) return '-';
  const s = String(dateStr);
  const bare = s.slice(0, 10);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(bare) ? mufParse(s) : new Date(s);
  if (!d || Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, opts);
}

/** True if YYYY-MM-DD is strictly before today (local). */
export function isDateBeforeToday(dateStr: string): boolean {
  if (!dateStr) return false;
  return String(dateStr).slice(0, 10) < mufToday();
}
