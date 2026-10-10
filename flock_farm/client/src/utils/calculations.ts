import { mufDateStr, mufToday, mufMonthStart, mufShiftDays } from '../muf-date';
import { feedRemainingKg } from '../muf-feedstock';
import {
  Bird,
  OtherExpense,
  FeedRecord,
  EggProduction,
  GlobalSettings,
  CustomerSale,
  VaccinationRecord,
  DateRange,
} from '../types';

// --- Local-date helpers ---
// Use the browser's LOCAL calendar date, not UTC. `Date#toISOString()`
// always returns the UTC date, which is wrong for any user ahead of UTC (e.g.
// Pakistan, UTC+5): anything logged between local midnight and ~5 AM would get
// silently filed under yesterday's date. `formatLocalDate` reads the local
// year/month/day fields instead, so "today" always matches the user's clock.
export function formatLocalDate(d: Date): string {
  return mufDateStr(d);
}

export function todayStr(): string {
  return mufToday();
}

export function monthStartStr(): string {
  return mufMonthStart();
}

export function daysAgoStr(days: number): string {
  return mufShiftDays(mufToday(), -days);
}

export function inDateRange(date: string | undefined | null, range: DateRange | null): boolean {
  if (!range || !date) return true;
  return date >= range.from && date <= range.to;
}

export function parseDateOnlyUtcMs(date: string): number {
  const [year, month, day] = String(date).split('-').map(Number);
  return Date.UTC(year, (month || 1) - 1, day || 1);
}

export function diffDateOnlyDays(from: string, to: string = todayStr()): number {
  return Math.floor((parseDateOnlyUtcMs(to) - parseDateOnlyUtcMs(from)) / 86400000);
}

// --- Range-aware flock membership ---
// Estimate which birds were actually part of the flock at some point during
// the given range, using dateBought / saleDate / dateDied. Without a range
// (the "all time" view) this is just today's active/sick birds, same as
// before. With a range, a bird counts if it had been bought by the end of
// the range AND either is still active/sick today, or left the flock
// (sold/died) on or after the range's start date. This is an approximation
// (we don't store a full day-by-day flock history), but it is far closer to
// the truth than always using today's headcount, which silently breaks any
// historical/date-ranged view once birds have been bought, sold, or lost.
export function birdsActiveInRange(birds: Bird[], range?: DateRange | null): Bird[] {
  if (!range) {
    return birds.filter((b) => b.status === 'Active' || b.status === 'Sick');
  }
  return birds.filter((b) => {
    if (b.dateBought && b.dateBought > range.to) return false; // not bought yet by range end
    if (b.status === 'Active' || b.status === 'Sick') return true; // still in the flock
    const leftDate = b.saleDate || b.dateDied;
    if (!leftDate) return true; // sold/dead but no exit date recorded — assume present
    return leftDate >= range.from; // left during or after the range started
  });
}

// --- Egg income ---

export function eggSaleIncome(record: EggProduction, settings: GlobalSettings): number {
  const price = record.pricePerEgg ?? settings.defaultPricePerEgg;
  return (record.sold || 0) * price;
}

export function totalEggIncome(eggProduction: EggProduction[], settings: GlobalSettings, range?: DateRange | null): number {
  return eggProduction
    .filter((e) => inDateRange(e.date, range ?? null))
    .reduce((sum, e) => sum + eggSaleIncome(e, settings), 0);
}

// --- Bird sale income ---

export function birdSaleIncome(birds: Bird[], range?: DateRange | null): number {
  return birds
    .filter((b) => b.status === 'Sold' && b.salePrice && b.saleDate && inDateRange(b.saleDate, range ?? null))
    .reduce((sum, b) => sum + (b.salePrice || 0), 0);
}

// --- Feed costs ---

export function totalFeedCost(feedRecords: FeedRecord[], range?: DateRange | null): number {
  return feedRecords
    .filter((f) => inDateRange(f.date, range ?? null))
    .reduce((sum, f) => sum + (f.quantityKg || 0) * (f.rateRsPerKg || 0), 0);
}

export function totalFeedKg(feedRecords: FeedRecord[], range?: DateRange | null): number {
  return feedRecords
    .filter((f) => inDateRange(f.date, range ?? null))
    .reduce((sum, f) => sum + (f.quantityKg || 0), 0);
}

// --- Other expenses ---

export function totalOtherExpenses(otherExpenses: OtherExpense[], range?: DateRange | null): number {
  return otherExpenses
    .filter((o) => inDateRange(o.date, range ?? null))
    .reduce((sum, o) => sum + (o.amount || 0), 0);
}

// --- Bird purchase cost (capital expenditure) ---

export function totalBirdPurchaseCost(birds: Bird[], range?: DateRange | null): number {
  return birds
    .filter((b) => inDateRange(b.dateBought, range ?? null))
    .reduce((sum, b) => sum + (b.price || 0), 0);
}

// --- Vaccination costs (also an operating expense) ---

export function totalVaccinationCost(vaccinations: VaccinationRecord[], range?: DateRange | null): number {
  return vaccinations
    .filter((v) => inDateRange(v.date, range ?? null))
    .reduce((sum, v) => sum + (v.cost || 0), 0);
}

// --- Customer-sales income (credit sales recorded through CustomerLedger) ---
// These are egg sales logged via the Customers tab. By design the egg totals in
// EggProduction.sold should NOT include these (otherwise we'd double-count
// revenue), but they ARE real income — include them in total revenue totals.
// `customerIncome` is the GROSS sale value (eggsQty × pricePerEgg). Collections
// (amountPaid) are cash-flow, not P&L revenue — they reduce accounts receivable.

export function customerSaleIncome(customerSales: CustomerSale[], range?: DateRange | null): number {
  return customerSales
    .filter((s) => inDateRange(s.date, range ?? null))
    .reduce((sum, s) => sum + (s.eggsQty || 0) * (s.pricePerEgg || 0), 0);
}

export function customerSaleEggs(customerSales: CustomerSale[], range?: DateRange | null): number {
  return customerSales
    .filter((s) => inDateRange(s.date, range ?? null))
    .reduce((sum, s) => sum + (s.eggsQty || 0), 0);
}

export function customerPaymentsReceived(customerSales: CustomerSale[], range?: DateRange | null): number {
  return customerSales
    .filter((s) => inDateRange(s.date, range ?? null))
    .reduce((sum, s) => sum + (s.amountPaid || 0), 0);
}

// customerBalance and totalOutstandingReceivables compute the exact same
// thing (total owed = value sold − amount paid); kept as two names since
// each reads more naturally at its call site (one customer vs. all of
// them), but only one implementation so they can't drift out of sync.
export function customerBalance(sales: CustomerSale[]): number {
  return sales.reduce((sum, s) => sum + (s.eggsQty || 0) * (s.pricePerEgg || 0) - (s.amountPaid || 0), 0);
}

export function totalOutstandingReceivables(customerSales: CustomerSale[]): number {
  return customerBalance(customerSales);
}

// --- Totals ---

export function totalExpense(
  birds: Bird[],
  feedRecords: FeedRecord[],
  otherExpenses: OtherExpense[],
  vaccinations?: VaccinationRecord[],
  range?: DateRange | null
): number {
  return (
    totalBirdPurchaseCost(birds, range) +
    totalFeedCost(feedRecords, range) +
    totalOtherExpenses(otherExpenses, range) +
    totalVaccinationCost(vaccinations || [], range)
  );
}

export function totalIncome(
  birds: Bird[],
  eggProduction: EggProduction[],
  customerSales: CustomerSale[],
  settings: GlobalSettings,
  range?: DateRange | null
): number {
  return (
    totalEggIncome(eggProduction, settings, range) +
    birdSaleIncome(birds, range) +
    customerSaleIncome(customerSales, range)
  );
}

// Operating expense = everything EXCEPT bird purchases (which are capex).
// Use for cost-per-egg / cost-per-bird to avoid spiking when birds are bought.
export function totalOperatingExpense(
  feedRecords: FeedRecord[],
  otherExpenses: OtherExpense[],
  vaccinations?: VaccinationRecord[],
  range?: DateRange | null
): number {
  return (
    totalFeedCost(feedRecords, range) +
    totalOtherExpenses(otherExpenses, range) +
    totalVaccinationCost(vaccinations || [], range)
  );
}

// --- Unit cost metrics ---

export function costPerEgg(
  birds: Bird[],
  feedRecords: FeedRecord[],
  otherExpenses: OtherExpense[],
  eggProduction: EggProduction[],
  vaccinations?: VaccinationRecord[],
  customerSales?: CustomerSale[],
  range?: DateRange | null
): number {
  const ownEggs = eggProduction
    .filter((e) => inDateRange(e.date, range ?? null))
    .reduce((sum, e) => sum + (e.totalEggsCollected || 0), 0);
  const customerEggs = customerSaleEggs(customerSales || [], range);
  // Customer-sold eggs are already part of collected eggs when logged correctly;
  // but if they are tracked separately, don't let the denominator double-count.
  // We assume EggProduction.sold already reflects the day's total sales (cash +
  // credit) because it is a daily total; customerSales just tracks WHO bought
  // them. So we use ownEggs only for egg count.
  const eggs = ownEggs;
  void customerEggs;
  if (eggs === 0) return 0;
  return totalExpense(birds, feedRecords, otherExpenses, vaccinations, range) / eggs;
}

export function costPerBird(
  birds: Bird[],
  feedRecords: FeedRecord[],
  otherExpenses: OtherExpense[],
  vaccinations?: VaccinationRecord[],
  range?: DateRange | null
): number {
  // Use the flock as it existed during the selected range, not today's count,
  // so historical views (e.g. "Last Month") don't get silently skewed by
  // birds bought/sold/lost since then.
  const active = birdsActiveInRange(birds, range).length;
  if (active === 0) return 0;
  return totalExpense(birds, feedRecords, otherExpenses, vaccinations, range) / active;
}

// --- Production rate (eggs per hen per day) ---
// Uses the flock as it existed during the selected range (see
// birdsActiveInRange), so the ratio stays accurate on historical views even
// after the flock size has changed since then.

export function productionRate(
  birds: Bird[],
  eggProduction: EggProduction[],
  range?: DateRange | null
): number {
  const activeFemales = birdsActiveInRange(birds, range).filter((b) => b.gender === 'Female').length;
  const filtered = eggProduction.filter((e) => inDateRange(e.date, range ?? null));
  const days = filtered.length;
  const eggs = filtered.reduce((sum, e) => sum + (e.totalEggsCollected || 0), 0);
  if (activeFemales === 0 || days === 0) return 0;
  return eggs / (activeFemales * days);
}

// --- Feed stock remaining (kg) ---
// Fix: include day 0 correctly — consumption starts AFTER the purchase date,
// not on the day you bring feed home. We use floor(days since first record),
// not ceil, so a same-day purchase shows full stock.

export function feedStockKg(feedRecords: FeedRecord[], consumptionKgPerDay: number, rangeEnd?: string): number {
  // Math lives in the shared muf-feedstock twin (same estimate in dairy).
  const remaining = feedRemainingKg(
    feedRecords.map((f) => ({ date: f.date, kg: f.quantityKg || 0 })),
    consumptionKgPerDay,
    rangeEnd ?? todayStr(),
  );
  return remaining === null ? 0 : remaining;
}

