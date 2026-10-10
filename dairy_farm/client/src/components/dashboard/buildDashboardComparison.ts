// Extracted from Dashboard.tsx — pure month-over-month + year-over-year
// comparison math for the dairy dashboard. No UI, no React, no hooks.
//
// TWIN SCOPE: dairy-only (not a muf-* file). The flock equivalent lives
// inline in flock Dashboard.tsx as the `cmp` useMemo (different data shape
// — eggs + birds vs milk + expenses). Do NOT promote to muf-* unless the
// two apps converge on a shared comparison shape.
import { pctChange } from '../../muf-compare';
import { calcRevenueWithHistory } from '../../utils/rates';

export interface DashboardCmpData {
  milkCur: Array<{ morning?: number; evening?: number; date?: string }>;
  milkPrev: Array<{ morning?: number; evening?: number; date?: string }>;
  expCur: Array<{ amount?: number }>;
  expPrev: Array<{ amount?: number }>;
  milkLy: Array<{ morning?: number; evening?: number; date?: string }>;
  expLy: Array<{ amount?: number }>;
}

export interface DashboardCmpResult {
  curMilk: number;
  prevMilk: number;
  milkPct: number | null;
  curRev: number;
  prevRev: number;
  curExp: number;
  prevExp: number;
  curNet: number;
  prevNet: number;
  netPct: number | null;
  lyMilk: number;
  lyNet: number;
  hasLy: boolean;
  lyMilkPct: number | null;
  lyNetPct: number | null;
}

/**
 * Build the "this month vs last month vs same month last year" comparison
 * block for the dairy dashboard. Pure function — same inputs always produce
 * the same output. Returns null when cmpData is null (data still loading).
 *
 * `rateHistory` and `dashboardBuyerRates` feed `calcRevenueWithHistory` so
 * historical milk rows are valued at the rate that was in effect at the
 * time they were logged, not today's rate.
 */
export function buildDashboardComparison(
  cmpData: DashboardCmpData | null,
  rate: number,
  rateDate: string,
  rateHistory: unknown,
  dashboardBuyerRates: unknown,
): DashboardCmpResult | null {
  if (!cmpData) return null;
  const milkL = (rows: Array<{ morning?: number; evening?: number }>) =>
    Math.round(rows.reduce((a, m) => a + (m.morning || 0) + (m.evening || 0), 0) * 10) / 10;
  const rev = (rows: Array<{ morning?: number; evening?: number; date?: string }>) =>
    Math.round(calcRevenueWithHistory(rows as any, rateHistory as any, rate, rateDate, dashboardBuyerRates as any));
  const exp = (rows: Array<{ amount?: number }>) =>
    Math.round(rows.reduce((a, e) => a + (e.amount || 0), 0));
  const curMilk = milkL(cmpData.milkCur);
  const prevMilk = milkL(cmpData.milkPrev);
  const curNet = rev(cmpData.milkCur) - exp(cmpData.expCur);
  const prevNet = rev(cmpData.milkPrev) - exp(cmpData.expPrev);
  // Same month last year (season vs season)
  const lyMilk = milkL(cmpData.milkLy);
  const lyNet = rev(cmpData.milkLy) - exp(cmpData.expLy);
  const hasLy = cmpData.milkLy.length > 0 || cmpData.expLy.length > 0;
  return {
    curMilk, prevMilk, milkPct: pctChange(curMilk, prevMilk),
    curRev: rev(cmpData.milkCur), prevRev: rev(cmpData.milkPrev),
    curExp: exp(cmpData.expCur), prevExp: exp(cmpData.expPrev),
    curNet, prevNet, netPct: pctChange(curNet, prevNet),
    lyMilk, lyNet, hasLy,
    lyMilkPct: pctChange(curMilk, lyMilk), lyNetPct: pctChange(curNet, lyNet),
  };
}
