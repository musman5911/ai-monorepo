// Extracted from FinancialLedger.tsx — pure totals calculations, no UI.
// Computes the summary-badge numbers (feed expense/weight, other expenses,
// eggs collected/sold/home/broken, egg income from cash + credit sales) from
// the raw data arrays. FinancialLedger.tsx consumes these for its top badges.
//
// TWIN SCOPE: flock-only (not a muf-* file). If dairy grows an equivalent
// aggregate-totals block, port this hook into dairy/components/ledger/; do
// NOT promote to muf-* unless the data shape matches across apps.
import { useMemo } from 'react';
import type { FeedRecord, OtherExpense, EggProduction, CustomerSale, GlobalSettings } from '../../types';

export interface LedgerTotals {
  totalFeedExpense: number;
  totalFeedWeight: number;
  totalOtherExpensesSum: number;
  totalEggsCollectedSum: number;
  totalEggsSoldSum: number;
  totalCustomerEggsSum: number;
  totalEggsHomeSum: number;
  totalEggsBrokenSum: number;
  totalEggIncome: number;
  totalCustomerEggIncome: number;
}

export interface UseLedgerTotalsArgs {
  feedRecords: FeedRecord[];
  otherExpenses: OtherExpense[];
  eggProduction: EggProduction[];
  customerSales: CustomerSale[];
  settings: GlobalSettings;
}

/**
 * All the reduce() calls that feed the summary badges at the top of the
 * Financial Ledger tab. Extracted verbatim — same inputs, same outputs,
 * just wrapped in a hook so the component file stays focused on rendering.
 */
export function useLedgerTotals({
  feedRecords,
  otherExpenses,
  eggProduction,
  customerSales,
  settings,
}: UseLedgerTotalsArgs): LedgerTotals {
  return useMemo(() => {
    const totalFeedExpense = feedRecords.reduce((sum, f) => sum + (f.quantityKg * f.rateRsPerKg), 0);
    const totalFeedWeight = feedRecords.reduce((sum, f) => sum + f.quantityKg, 0);

    const totalOtherExpensesSum = otherExpenses.reduce((sum, o) => sum + o.amount, 0);

    const totalEggsCollectedSum = eggProduction.reduce((sum, ep) => sum + ep.totalEggsCollected, 0);
    const totalEggsSoldSum = eggProduction.reduce((sum, ep) => sum + ep.sold, 0);
    const totalCustomerEggsSum = customerSales.reduce((sum, sale) => sum + (sale.eggsQty || 0), 0);
    const totalEggsHomeSum = eggProduction.reduce((sum, ep) => sum + ep.homeUse, 0);
    const totalEggsBrokenSum = eggProduction.reduce((sum, ep) => sum + ep.brokenWasted, 0);
    // Respect per-record price overrides if set, otherwise fall back to the default.
    const totalEggIncome = eggProduction.reduce(
      (sum, ep) => sum + ep.sold * (ep.pricePerEgg ?? settings.defaultPricePerEgg),
      0,
    );
    const totalCustomerEggIncome = customerSales.reduce(
      (sum, sale) => sum + (sale.eggsQty || 0) * (sale.pricePerEgg || 0),
      0,
    );

    return {
      totalFeedExpense,
      totalFeedWeight,
      totalOtherExpensesSum,
      totalEggsCollectedSum,
      totalEggsSoldSum,
      totalCustomerEggsSum,
      totalEggsHomeSum,
      totalEggsBrokenSum,
      totalEggIncome,
      totalCustomerEggIncome,
    };
  }, [feedRecords, otherExpenses, eggProduction, customerSales, settings]);
}
