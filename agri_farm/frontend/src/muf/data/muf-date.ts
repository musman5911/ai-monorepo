/* ─────────────────────────────────────────────────────────────
 * muf-date — LOCAL-timezone date helpers (muf twin file).
 * `new Date().toISOString()` uses UTC, so in Pakistan (UTC+5) it
 * returns YESTERDAY's date until 5 AM — exactly when farm work
 * starts. Every "today" default must use these helpers instead.
 * Identical in dairy_farm & flock_farm; agri copy is muf-date.js.
 * ──────────────────────────────────────────────────────────── */

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Format a Date as YYYY-MM-DD using the LOCAL calendar day. */
export function mufDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Today as YYYY-MM-DD in the user's local timezone. */
export function mufToday(): string {
  return mufDateStr(new Date());
}

/** Current month as YYYY-MM in the user's local timezone. */
export function mufMonth(): string {
  return mufToday().slice(0, 7);
}

/** Shift a YYYY-MM-DD string by `days` (±), staying in local time. */
export function mufShiftDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return mufDateStr(d);
}

/** Parse a YYYY-MM-DD (or ISO) string as a LOCAL calendar day. Null if invalid. */
export function mufParse(dateStr: string): Date | null {
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** First day of the month containing dateStr (defaults to today), as YYYY-MM-DD. */
export function mufMonthStart(dateStr?: string): string {
  const d = (dateStr && mufParse(dateStr)) || new Date();
  return mufDateStr(d);
}

/** Shift a 'YYYY-MM' key by `delta` months (±). */
export function mufShiftMonth(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split('-').map(Number);
  return mufDateStr(new Date(y, m - 1 + delta, 1)).slice(0, 7);
}

/** 'YYYY-MM' key for `n` months ago (0 = current month). */
export function mufMonthsAgo(n: number): string {
  return mufShiftMonth(mufMonth(), -n);
}

/** Last `n` month keys including the current one, ascending: [..., '2026-07']. */
export function mufLastMonths(n: number): string[] {
  return Array.from({ length: n }, (_, i) => mufMonthsAgo(n - 1 - i));
}

/** YYYY-MM-DD of the Monday starting the week containing `d`. */
export function mufWeekStart(d: Date): string {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay());
  return mufDateStr(x);
}

/** 'YYYY-MM' → 'August 2026' (English long month label). */
export function mufMonthLabel(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-PK', { month: 'long', year: 'numeric' });
}

/** One consistent display format for all three apps. */
export function mufFmt(d: Date, style: 'short' | 'full' | 'weekday' = 'full'): string {
  if (style === 'weekday') return d.toLocaleDateString('en-US', { weekday: 'short' });
  if (style === 'short') return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
  return d.toLocaleDateString('en-PK');
}
