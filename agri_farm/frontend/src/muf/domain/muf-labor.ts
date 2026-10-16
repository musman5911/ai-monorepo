// muf shared helper — worker attendance & wage math.
// TWIN FILE: dairy_farm/client/src/muf-labor.ts and flock_farm/client/src/muf-labor.ts
// must stay IDENTICAL (agri_farm/frontend/src/muf-labor.js is the JS twin).
// Run `node check-muf-sync.js` from the repo root after editing.

export interface MufLaborWorker {
  id: string;
  name: string;
  dailyWage: number;
  notes?: string;
}

export interface MufAttendanceRow {
  id: string;
  workerId: string;
  date: string; // YYYY-MM-DD
  dayType: 'full' | 'half';
  posted?: boolean;
  notes?: string;
}

export const HALF_DAY_UNITS = 0.5;

/** Day units for one attendance row: full day = 1, half day = 0.5. */
export function rowUnits(row: MufAttendanceRow): number {
  return row.dayType === 'half' ? HALF_DAY_UNITS : 1;
}

/** All rows that fall inside a YYYY-MM month. */
export function monthRows<T extends { date: string }>(rows: T[], monthKey: string): T[] {
  return rows.filter((r) => String(r.date || '').startsWith(monthKey));
}

/** Per-worker totals for a set of attendance rows (already month-filtered). */
export function workerSummary(worker: MufLaborWorker, rows: MufAttendanceRow[]) {
  const mine = rows.filter((r) => r.workerId === worker.id);
  const days = mine.reduce((s, r) => s + rowUnits(r), 0);
  const unposted = mine.filter((r) => !r.posted);
  const unpostedDays = unposted.reduce((s, r) => s + rowUnits(r), 0);
  return {
    days,
    unpostedDays,
    wageDue: Math.round(unpostedDays * (Number(worker.dailyWage) || 0) * 100) / 100,
  };
}

/** Total unposted wages across all workers for a set of rows. */
export function unpostedTotal(workers: MufLaborWorker[], rows: MufAttendanceRow[]): number {
  return workers.reduce((sum, w) => sum + workerSummary(w, rows).unpostedDays * (Number(w.dailyWage) || 0), 0);
}

/**
 * Build the month-end wage sheet from unposted rows:
 * one line per worker — "Ali 22d × Rs. 700".
 */
export function buildWageSheet(workers: MufLaborWorker[], rows: MufAttendanceRow[]) {
  const lines: string[] = [];
  let total = 0;
  let totalDays = 0;
  let workerCount = 0;
  for (const w of workers) {
    const unposted = rows.filter((r) => r.workerId === w.id && !r.posted);
    if (!unposted.length) continue;
    const days = unposted.reduce((s, r) => s + rowUnits(r), 0);
    const wage = Number(w.dailyWage) || 0;
    total += days * wage;
    totalDays += days;
    workerCount += 1;
    lines.push(`${w.name} ${days}d × Rs. ${wage}`);
  }
  return { lines, total: Math.round(total * 100) / 100, totalDays, workerCount };
}

/** Ledger note for the posted month — same wording in all three apps. */
export function wageNote(monthKey: string, lines: string[]): string {
  return `Monthly labor wages ${monthKey}: ${lines.join('; ')}`;
}

/** Ledger date used when posting a month (28th is valid in every month). */
export function wagePostDate(monthKey: string): string {
  return `${monthKey}-28`;
}

/* ── Wage advances (udhaar to workers) ─────────────────────────── */

export interface MufAdvanceRow {
  id: string;
  workerId: string;
  date: string; // YYYY-MM-DD
  amount: number;
  settled?: boolean; // true once its month has been posted to the ledger
  notes?: string;
}

/** Unsettled advance total for one worker (or all workers when id omitted). */
export function unsettledAdvance(advances: MufAdvanceRow[], workerId?: string): number {
  return Math.round(advances
    .filter((a) => !a.settled && (workerId === undefined || a.workerId === workerId))
    .reduce((sum, a) => sum + (Number(a.amount) || 0), 0) * 100) / 100;
}

/**
 * Month-end payout view: gross wages stay the ledger amount (advances were
 * early payment of the same wages, so they are NOT a second expense);
 * payable = gross − unsettled advances, floored at 0 per worker.
 */
export function payoutAfterAdvances(
  workers: MufLaborWorker[],
  rows: MufAttendanceRow[],
  advances: MufAdvanceRow[],
): { gross: number; advances: number; payable: number; perWorker: { id: string; name: string; wage: number; advance: number; payable: number }[] } {
  const sheet = buildWageSheet(workers, rows);
  const perWorker = workers.map((w) => {
    const unposted = rows.filter((r) => r.workerId === w.id && !r.posted);
    const days = unposted.reduce((s, r) => s + rowUnits(r), 0);
    const wage = Math.round(days * (Number(w.dailyWage) || 0) * 100) / 100;
    const advance = unsettledAdvance(advances, w.id);
    return { id: w.id, name: w.name, wage, advance, payable: Math.max(0, Math.round((wage - advance) * 100) / 100) };
  }).filter((p) => p.wage > 0 || p.advance > 0);
  const advTotal = unsettledAdvance(advances);
  return {
    gross: sheet.total,
    advances: advTotal,
    payable: Math.max(0, Math.round((sheet.total - advTotal) * 100) / 100),
    perWorker,
  };
}
