// muf shared helper — feed stock estimate (purchases − assumed daily use).
// TWIN FILE: dairy_farm/client/src/muf-feedstock.ts and flock_farm/client/src/muf-feedstock.ts
// must stay IDENTICAL. Run `node check-muf-sync.js` from the repo root after editing.
//
// Same estimate the flock app pioneered: total kg purchased minus an assumed
// daily consumption, counted from the first purchase date. Today = day 0.

export interface FeedPurchase {
  date: string; // YYYY-MM-DD
  kg: number;
}

export const FEED_LOW_STOCK_DAYS_DEFAULT = 14;

function diffDays(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

/** Estimated kg remaining. Returns null when no daily-use rate is configured. */
export function feedRemainingKg(purchases: FeedPurchase[], dailyUseKg: number, today: string): number | null {
  if (!(dailyUseKg > 0)) return null;
  if (!purchases || purchases.length === 0) return 0;
  const purchased = purchases.reduce((sum, p) => sum + (p.kg || 0), 0);
  const firstDate = purchases.reduce((min, p) => (p.date < min ? p.date : min), purchases[0].date);
  const days = Math.max(0, diffDays(firstDate, today));
  return Math.max(0, purchased - dailyUseKg * days);
}

/** Full stock picture for the dashboard card. */
export function feedStockSummary(
  purchases: FeedPurchase[],
  dailyUseKg: number,
  today: string,
  lowStockDays: number = FEED_LOW_STOCK_DAYS_DEFAULT,
): {
  remainingKg: number;
  daysLeft: number;
  isLow: boolean;
  thresholdKg: number;
  totalPurchasedKg: number;
} | null {
  const remaining = feedRemainingKg(purchases, dailyUseKg, today);
  if (remaining === null) return null;
  const thresholdKg = dailyUseKg * lowStockDays;
  return {
    remainingKg: Math.round(remaining),
    daysLeft: Math.max(0, Math.floor(remaining / dailyUseKg)),
    isLow: remaining <= thresholdKg,
    thresholdKg,
    totalPurchasedKg: Math.round(purchases.reduce((sum, p) => sum + (p.kg || 0), 0)),
  };
}
