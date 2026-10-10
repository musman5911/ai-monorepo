// Extracted from Dashboard.tsx — pure data transformation, no UI.
// Builds the "Recent Operations" feed: merges feed purchases, expenses,
// vaccinations, egg sales, customer credit sales, bird sales and mortality
// into a single sorted list (newest first). Dashboard consumes the top N.
//
// TWIN SCOPE: flock-only (not a muf-* file — Dashboard itself is app-specific).
// If dairy / agri grow an equivalent recent-ops widget, copy this hook into
// their components/dashboard/ folder; do NOT promote to muf-* unless the
// data shape is identical across all three apps.
import { useMemo } from 'react';
import type { Bird, OtherExpense, FeedRecord, EggProduction, VaccinationRecord, CustomerSale, GlobalSettings } from '../../types';
import { eggSaleIncome } from '../../utils/calculations';

export type OpType = 'Feed' | 'Expense' | 'Egg Sale' | 'Bird Sold' | 'Bird Added' | 'Vaccination' | 'Mortality';

export interface OpItem {
  type: OpType;
  title: string;
  date: string;
  amt: number;
  positive: boolean;
  tab?: string;
  id?: number;
  detail?: string;
}

export interface UseRecentOpsArgs {
  feedRecords: FeedRecord[];
  otherExpenses: OtherExpense[];
  vaccinations: VaccinationRecord[];
  customerSales: CustomerSale[];
  eggProduction: EggProduction[];
  birds: Bird[];
  settings: GlobalSettings;
}

/**
 * Merges every dated operation across the flock domain into one feed.
 * Each item carries a `tab` hint so the dashboard can navigate the user
 * to the right place when they tap a row (e.g. 'ledger', 'health', 'flock').
 */
export function useRecentOps({
  feedRecords,
  otherExpenses,
  vaccinations,
  customerSales,
  eggProduction,
  birds,
  settings,
}: UseRecentOpsArgs): OpItem[] {
  return useMemo(() => {
    const items: OpItem[] = [];
    feedRecords.forEach((f) => items.push({
      type: 'Feed',
      title: `${f.feedType} (${f.quantityKg}kg)`,
      date: f.date,
      amt: (f.quantityKg || 0) * (f.rateRsPerKg || 0),
      positive: false,
      tab: 'ledger',
      detail: f.notes,
    }));
    otherExpenses.forEach((o) => items.push({
      type: 'Expense',
      title: o.detail,
      date: o.date,
      amt: o.amount || 0,
      positive: false,
      tab: 'ledger',
      detail: o.notes,
    }));
    vaccinations.forEach((v) => items.push({
      type: 'Vaccination',
      title: v.vaccineName,
      date: v.date,
      amt: v.cost || 0,
      positive: false,
      tab: 'health',
      detail: v.notes,
    }));
    eggProduction.forEach((e) => {
      if ((e.sold || 0) > 0) items.push({
        type: 'Egg Sale',
        title: `Sold ${e.sold} eggs @ Rs ${e.pricePerEgg ?? settings.defaultPricePerEgg}`,
        date: e.date,
        amt: eggSaleIncome(e, settings),
        positive: true,
        tab: 'ledger',
      });
    });
    customerSales.forEach((s) => items.push({
      type: 'Egg Sale',
      title: `Credit sale: ${s.eggsQty} eggs`,
      date: s.date,
      amt: (s.eggsQty || 0) * (s.pricePerEgg || 0),
      positive: true,
      tab: 'customers',
      detail: s.notes,
    }));
    birds.forEach((b) => {
      if (b.status === 'Sold' && b.saleDate) items.push({
        type: 'Bird Sold',
        title: b.name,
        date: b.saleDate,
        amt: b.salePrice || 0,
        positive: true,
        tab: 'flock',
        id: b.id,
      });
      if (b.status === 'Dead' && b.dateDied) items.push({
        type: 'Mortality',
        title: `${b.name} (${b.deathReason || 'Unknown'})`,
        date: b.dateDied,
        amt: 0,
        positive: false,
        tab: 'health',
        id: b.id,
        detail: b.deathDetail,
      });
    });
    return items.sort((a, b) => b.date.localeCompare(a.date));
  }, [feedRecords, otherExpenses, vaccinations, customerSales, eggProduction, birds, settings]);
}
