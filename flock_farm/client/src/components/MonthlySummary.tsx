import React, { useEffect, useMemo, useState } from 'react';
import { mufL } from '../muf/data/muf-urdu';
import { mufMonthLabel } from '../muf/data/muf-date';
import { listBatches } from '../api';
import type { BatchWithSummary } from '../types';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Coins,
  Egg,
  Package,
  ShoppingBag,
  Syringe,
  TrendingDown,
  TrendingUp,
  Wallet,
  Bird as BirdIcon,
  Download,
  FileSpreadsheet,
  BarChart2,
} from 'lucide-react';
import {
  Bird,
  OtherExpense,
  FeedRecord,
  EggProduction,
  GlobalSettings,
  Lang,
  CustomerSale,
  VaccinationRecord,
  Customer,
  DateRange,
} from '../types';
import {
  birdSaleIncome,
  birdsActiveInRange,
  costPerBird,
  costPerEgg,
  customerPaymentsReceived,
  customerSaleIncome,
  formatLocalDate,
  inDateRange,
  productionRate,
  todayStr,
  totalBirdPurchaseCost,
  totalFeedCost,
  totalFeedKg,
  totalOtherExpenses,
  totalOutstandingReceivables,
  totalVaccinationCost,
} from '../utils/calculations';
import {
  exportEggExcel,
  exportEggPDF,
  exportExpenseExcel,
  exportExpensePDF,
  exportMonthlySummaryPDF,
} from '../reportExport';
import { openMufPrint } from '../muf/data/muf-print';
import { zakatStatementBody, pctAmount, ZAKAT_DEFAULT_PCT, downloadZakatPdf } from '../muf/domain/muf-zakat';
import FarmProfileCard from '../muf/ui/muf-farm-profile';
import { downloadFarmBookPdf } from '../muf/domain/muf-farmbook';
import {mufShiftMonth} from '../muf/data/muf-date';
import { MufAreaChart, MufBarChart, type MufChartPoint } from '../muf/ui/muf-charts';
import DetailModal from '../muf/core/muf-modal';

interface MonthlySummaryProps {
  birds: Bird[];
  otherExpenses: OtherExpense[];
  feedRecords: FeedRecord[];
  eggProduction: EggProduction[];
  vaccinations: VaccinationRecord[];
  customers?: Customer[];
  customerSales: CustomerSale[];
  settings: GlobalSettings;
  lang?: Lang;
}

type RangeKey = '3m' | '6m' | '1y';

type PeriodStats = {
  label: string;
  months: string[];
  range: DateRange | null;
  eggsCollected: number;
  eggsSold: number;
  eggsHome: number;
  eggsBroken: number;
  eggIncome: number;
  customerIncome: number;
  customerPayments: number;
  periodReceivables: number;
  birdSaleIncome: number;
  birdPurchaseCost: number;
  feedCost: number;
  feedKg: number;
  vaccinationCost: number;
  otherExpenseCost: number;
  operatingExpense: number;
  totalExpense: number;
  operatingIncome: number;
  totalIncome: number;
  operatingProfit: number;
  totalProfit: number;
  purchasedBirds: number;
  soldBirds: number;
  deadBirds: number;
  activeBirds: number;
  activeHens: number;
  activeRoosters: number;
  sickBirds: number;
  vaccinationCount: number;
  production: number;
  allInCostPerEgg: number;
  costPerActiveBird: number;
  outstandingAllTime: number;
  selectedCustomerSales: CustomerSale[];
  activityBirds: Bird[];
  expenseBreakdown: { label: string; amount: number; color: string }[];
  otherCategoryBreakdown: { label: string; amount: number; color: string }[];
};

const RANGE_OPTIONS: { key: RangeKey; label: string; count: number }[] = [
  { key: '3m', label: 'Last 3 Months', count: 3 },
  { key: '6m', label: 'Last 6 Months', count: 6 },
  { key: '1y', label: 'Last 1 Year', count: 12 },
];

const EXPENSE_COLORS = {
  purchases: 'bg-amber-500',
  feed: 'bg-sky-500',
  vaccination: 'bg-violet-500',
  other: 'bg-rose-500',
  medicine: 'bg-emerald-500',
  repair: 'bg-orange-500',
  utility: 'bg-cyan-500',
  otherMisc: 'bg-slate-500',
} as const;

const formatRs = (value: number) => `Rs ${Math.round(value || 0).toLocaleString()}`;
const formatKg = (value: number) => `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`;

// The following helpers were extracted to ./summary/monthHelpers to keep this
// file focused on rendering. They are re-exported here so existing inline
// callsites inside this file don't need to change.
//   buildFlockProfileData, monthKey, monthLabel, subtractMonths,
//   buildLastNMonths, monthRange
import {
  buildFlockProfileData,
  monthKey,
  monthLabel,
  subtractMonths,
  buildLastNMonths,
  monthRange,
} from './summary/monthHelpers';
// Re-export the two formatters too — they're imported from monthHelpers so
// there's one source of truth, but callers in this file still expect them
// in scope.
export { formatRs, formatKg };

export default function MonthlySummary({
  birds,
  otherExpenses,
  feedRecords,
  eggProduction,
  vaccinations,
  customers = [],
  customerSales,
  settings,
  lang = 'en',
}: MonthlySummaryProps) {
  const L = (en: string, urOrVars?: string | Record<string, string | number | null>) => mufL(lang, en, urOrVars);
  const currentMonth = monthKey(todayStr());
  const [batchSummaryRows, setBatchSummaryRows] = useState<BatchWithSummary[]>([]);
  const [batchSummaryUnavailable, setBatchSummaryUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listBatches().then(rows => {
      if (!cancelled) { setBatchSummaryRows(rows); setBatchSummaryUnavailable(false); }
    }).catch(() => { if (!cancelled) setBatchSummaryUnavailable(true); });
    return () => { cancelled = true; };
  }, []);

  const historyMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    birds.forEach((b) => {
      if (b.dateBought) monthsSet.add(monthKey(b.dateBought));
      if (b.saleDate) monthsSet.add(monthKey(b.saleDate));
      if (b.dateDied) monthsSet.add(monthKey(b.dateDied));
    });
    otherExpenses.forEach((o) => o.date && monthsSet.add(monthKey(o.date)));
    feedRecords.forEach((f) => f.date && monthsSet.add(monthKey(f.date)));
    eggProduction.forEach((e) => e.date && monthsSet.add(monthKey(e.date)));
    vaccinations.forEach((v) => v.date && monthsSet.add(monthKey(v.date)));
    customerSales.forEach((s) => s.date && monthsSet.add(monthKey(s.date)));
    return Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
  }, [birds, otherExpenses, feedRecords, eggProduction, vaccinations, customerSales]);

  const monthOptions = useMemo(() => {
    const set = new Set<string>(buildLastNMonths(12));
    historyMonths.forEach((m) => set.add(m));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [historyMonths]);

  const [selectedPeriod, setSelectedPeriod] = useState<string>(currentMonth);
  const selectedRange = RANGE_OPTIONS.find((r) => r.key === selectedPeriod);
  const isRange = !!selectedRange;
  const selectedMonths = selectedRange ? monthOptions.slice(-selectedRange.count) : [selectedPeriod];

  const customerNameById = useMemo(
    () => Object.fromEntries(customers.map((c) => [c.id, c.name])),
    [customers]
  );

  const buildStats = (months: string[], label: string): PeriodStats => {
    const monthSet = new Set(months);
    const range = monthRange(months);

    const selectedBirdsBought = birds.filter((b) => b.dateBought && monthSet.has(monthKey(b.dateBought)));
    const selectedBirdSales = birds.filter((b) => b.status === 'Sold' && b.saleDate && monthSet.has(monthKey(b.saleDate)));
    const selectedBirdDeaths = birds.filter((b) => b.status === 'Dead' && b.dateDied && monthSet.has(monthKey(b.dateDied)));
    const selectedEggs = eggProduction.filter((e) => monthSet.has(monthKey(e.date)));
    const selectedFeed = feedRecords.filter((f) => monthSet.has(monthKey(f.date)));
    const selectedOther = otherExpenses.filter((o) => monthSet.has(monthKey(o.date)));
    const selectedVaccinations = vaccinations.filter((v) => monthSet.has(monthKey(v.date)));
    const selectedCustomerSales = customerSales.filter((s) => monthSet.has(monthKey(s.date)));

    const eggsCollected = selectedEggs.reduce((sum, e) => sum + (e.totalEggsCollected || 0), 0);
    const eggsSold = selectedEggs.reduce((sum, e) => sum + (e.sold || 0), 0);
    const eggsHome = selectedEggs.reduce((sum, e) => sum + (e.homeUse || 0), 0);
    const eggsBroken = selectedEggs.reduce((sum, e) => sum + (e.brokenWasted || 0), 0);
    const eggIncome = selectedEggs.reduce((sum, e) => sum + (e.sold || 0) * (e.pricePerEgg ?? settings.defaultPricePerEgg), 0);
    const customerIncome = customerSaleIncome(selectedCustomerSales);
    const customerPayments = customerPaymentsReceived(selectedCustomerSales);
    const periodReceivables = selectedCustomerSales.reduce(
      (sum, sale) => sum + (sale.eggsQty || 0) * (sale.pricePerEgg || 0) - (sale.amountPaid || 0),
      0
    );
    const birdPurchaseCost = totalBirdPurchaseCost(selectedBirdsBought);
    const birdSaleValue = birdSaleIncome(selectedBirdSales);
    const feedCost = totalFeedCost(selectedFeed);
    const feedKg = totalFeedKg(selectedFeed);
    const otherExpenseCost = totalOtherExpenses(selectedOther);
    const vaccinationCost = totalVaccinationCost(selectedVaccinations);
    const operatingExpense = feedCost + otherExpenseCost + vaccinationCost;
    const totalExpense = operatingExpense + birdPurchaseCost;
    const operatingIncome = eggIncome + customerIncome;
    const totalIncome = operatingIncome + birdSaleValue;
    const operatingProfit = operatingIncome - operatingExpense;
    const totalProfit = totalIncome - totalExpense;
    const activeFlock = birdsActiveInRange(birds, range);
    const activeBirds = activeFlock.length;
    const activeHens = activeFlock.filter((b) => b.gender === 'Female').length;
    const activeRoosters = activeFlock.filter((b) => b.gender === 'Male').length;
    const sickBirds = activeFlock.filter((b) => b.status === 'Sick').length;

    const activityBirds = birds
      .filter(
        (b) =>
          (b.dateBought && monthSet.has(monthKey(b.dateBought))) ||
          (b.saleDate && monthSet.has(monthKey(b.saleDate))) ||
          (b.dateDied && monthSet.has(monthKey(b.dateDied)))
      )
      .sort((a, b) => {
        const dateA = a.saleDate || a.dateDied || a.dateBought;
        const dateB = b.saleDate || b.dateDied || b.dateBought;
        return dateB.localeCompare(dateA);
      });

    const expenseBreakdown = [
      { label: 'Bird Purchase', amount: birdPurchaseCost, color: EXPENSE_COLORS.purchases },
      { label: 'Feed', amount: feedCost, color: EXPENSE_COLORS.feed },
      { label: 'Vaccinations', amount: vaccinationCost, color: EXPENSE_COLORS.vaccination },
      { label: 'Other Expenses', amount: otherExpenseCost, color: EXPENSE_COLORS.other },
    ].filter((item) => item.amount > 0);

    const categoryTotals: Record<string, number> = {
      Medicine: 0,
      Repair: 0,
      Utility: 0,
      Other: 0,
    };
    selectedOther.forEach((entry) => {
      categoryTotals[entry.category] = (categoryTotals[entry.category] || 0) + (entry.amount || 0);
    });
    const otherCategoryBreakdown = [
      { label: 'Medicine', amount: categoryTotals.Medicine, color: EXPENSE_COLORS.medicine },
      { label: 'Repair', amount: categoryTotals.Repair, color: EXPENSE_COLORS.repair },
      { label: 'Utility', amount: categoryTotals.Utility, color: EXPENSE_COLORS.utility },
      { label: 'Other', amount: categoryTotals.Other, color: EXPENSE_COLORS.otherMisc },
    ].filter((item) => item.amount > 0);

    return {
      label,
      months,
      range,
      eggsCollected,
      eggsSold,
      eggsHome,
      eggsBroken,
      eggIncome,
      customerIncome,
      customerPayments,
      periodReceivables,
      birdSaleIncome: birdSaleValue,
      birdPurchaseCost,
      feedCost,
      feedKg,
      vaccinationCost,
      otherExpenseCost,
      operatingExpense,
      totalExpense,
      operatingIncome,
      totalIncome,
      operatingProfit,
      totalProfit,
      purchasedBirds: selectedBirdsBought.length,
      soldBirds: selectedBirdSales.length,
      deadBirds: selectedBirdDeaths.length,
      activeBirds,
      activeHens,
      activeRoosters,
      sickBirds,
      vaccinationCount: selectedVaccinations.length,
      production: range ? productionRate(birds, eggProduction, range) : 0,
      allInCostPerEgg: range ? costPerEgg(birds, feedRecords, otherExpenses, eggProduction, vaccinations, customerSales, range) : 0,
      costPerActiveBird: range ? costPerBird(birds, feedRecords, otherExpenses, vaccinations, range) : 0,
      outstandingAllTime: totalOutstandingReceivables(customerSales),
      selectedCustomerSales,
      activityBirds,
      expenseBreakdown,
      otherCategoryBreakdown,
    };
  };

  const thisMonthStats = useMemo(
    () => buildStats([currentMonth], monthLabel(currentMonth)),
    [currentMonth, birds, otherExpenses, feedRecords, eggProduction, vaccinations, customerSales, settings]
  );

  const todayFeedKg = useMemo(
    () => feedRecords.filter((record) => record.date === todayStr()).reduce((sum, record) => sum + (record.quantityKg || 0), 0),
    [feedRecords]
  );
  const thisMonthFeedKg = useMemo(
    () => feedRecords.filter((record) => record.date.startsWith(currentMonth)).reduce((sum, record) => sum + (record.quantityKg || 0), 0),
    [feedRecords, currentMonth]
  );
  const thisMonthFeedPerBird = thisMonthStats.activeBirds > 0 ? thisMonthStats.feedKg / thisMonthStats.activeBirds : 0;

  const selectedStats = useMemo(() => {
    const label = selectedRange ? L(selectedRange.label) : monthLabel(selectedPeriod);
    return buildStats(selectedMonths, label);
  }, [selectedMonths, selectedPeriod, selectedRange, birds, otherExpenses, feedRecords, eggProduction, vaccinations, customerSales, settings, lang]);

  const comparisonRows = useMemo(
    () => historyMonths.map((month) => buildStats([month], monthLabel(month))),
    [historyMonths, birds, otherExpenses, feedRecords, eggProduction, vaccinations, customerSales, settings]
  );

  const selectedFeedCostPerBird = selectedStats.activeBirds > 0 ? selectedStats.feedCost / selectedStats.activeBirds : 0;
  const selectedOperatingCostPerBird = selectedStats.activeBirds > 0 ? selectedStats.operatingExpense / selectedStats.activeBirds : 0;
  const selectedRevenuePerHen = selectedStats.activeHens > 0 ? selectedStats.operatingIncome / selectedStats.activeHens : 0;
  const selectedAverageCustomerSale = selectedStats.selectedCustomerSales.length > 0
    ? selectedStats.customerIncome / selectedStats.selectedCustomerSales.length
    : 0;

  const summaryExportBirds = useMemo(() => {
    return birds
      .filter((bird) => inDateRange(bird.dateBought, selectedStats.range) || inDateRange(bird.saleDate, selectedStats.range))
      .map((bird) => ({
        ...bird,
        dateBought: inDateRange(bird.dateBought, selectedStats.range) ? bird.dateBought : '',
        saleDate: inDateRange(bird.saleDate, selectedStats.range) ? bird.saleDate : undefined,
        dateDied: inDateRange(bird.dateDied, selectedStats.range) ? bird.dateDied : undefined,
      }));
  }, [birds, selectedStats.range]);

  const shiftMonth = (dir: number) => {
    if (isRange) return;
    const idx = monthOptions.indexOf(selectedPeriod);
    const next = idx + dir;
    if (next >= 0 && next < monthOptions.length) {
      setSelectedPeriod(monthOptions[next]);
    }
  };

  const noReportData = historyMonths.length === 0;

  return (
    <div className="space-y-6 pb-10" id="reports-tab">
      <section className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-white dark:bg-slate-900 p-4 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{L('Batch financial summary')}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{L('All-time primary financial view for managed flock batches')}</p>
        </div>
        {batchSummaryUnavailable ? (
          <p role="status" className="text-xs text-amber-700 dark:text-amber-300">{L('Batch financial data is unavailable right now.')}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-3"><p className="text-[10px] uppercase tracking-wide text-slate-500">{L('Batches')}</p><p className="text-xl font-bold mt-1">{batchSummaryRows.length}</p></div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-3"><p className="text-[10px] uppercase tracking-wide text-slate-500">{L('Live birds')}</p><p className="text-xl font-bold mt-1">{batchSummaryRows.reduce((sum, b) => sum + (b.summary?.live_count || 0), 0).toLocaleString()}</p></div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-3"><p className="text-[10px] uppercase tracking-wide text-slate-500">{L('All-time batch revenue')}</p><p className="text-xl font-bold mt-1">Rs {Math.round(batchSummaryRows.reduce((sum, b) => sum + (b.summary?.total_revenue || 0), 0)).toLocaleString()}</p></div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-3"><p className="text-[10px] uppercase tracking-wide text-slate-500">{L('All-time batch profit / loss')}</p><p className={`text-xl font-bold mt-1 ${batchSummaryRows.reduce((sum, b) => sum + (b.summary?.profit_loss || 0), 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>Rs {Math.round(batchSummaryRows.reduce((sum, b) => sum + (b.summary?.profit_loss || 0), 0)).toLocaleString()}</p></div>
            </div>
            {batchSummaryRows.length > 0 && <div className="space-y-2">
              {batchSummaryRows.slice(0, 5).map(batch => <div key={batch.batch_id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 dark:border-slate-800 px-3 py-2">
                <div className="min-w-0"><p className="text-xs font-semibold truncate">{batch.name}</p><p className="text-[11px] text-slate-500">{batch.summary?.live_count || 0} {L('live birds')} · {batch.status}</p></div>
                <span className={`text-xs font-semibold whitespace-nowrap ${(batch.summary?.profit_loss || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>Rs {Math.round(batch.summary?.profit_loss || 0).toLocaleString()}</span>
              </div>)}
            </div>}
            {batchSummaryRows.length === 0 && <p className="text-xs text-slate-500">{L('No batch records yet. Batch financials will appear after the first batch is created.')}</p>}
          </>
        )}
      </section>
      <div className="muf-page-hero">
        <div className="muf-page-title">
          <div className="muf-title-icon"><BarChart2 size={28}/></div>
          <div>
            <h2>{L('Summary')}</h2>
            <p>{L('Review flock finances, egg performance, purchases, sales, and monthly trends in one place.')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="w-4 h-4 text-slate-400" />
          {!isRange && (
            <button
              onClick={() => shiftMonth(-1)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-900 dark:text-slate-100 outline-none"
          >
            <optgroup label={L('Ranges')}>
              {RANGE_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>{L(option.label)}</option>
              ))}
            </optgroup>
            <optgroup label={L('Months')}>
              {[...monthOptions].reverse().map((month) => (
                <option key={month} value={month}>{monthLabel(month)}</option>
              ))}
            </optgroup>
          </select>
          {!isRange && (
            <button
              onClick={() => shiftMonth(1)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {noReportData ? (
        <div className="text-center py-16 bg-white dark:bg-[#0d1a11] rounded-3xl border border-dashed border-slate-200 dark:border-[#203528]">
          <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-300">
            {L('No report data found yet.')}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {L('Add bird purchases, egg logs, sales, or feed records to build reports.')}
          </p>
        </div>
      ) : (
        <>
          <PeriodHero
            title={L('This Month')}
            subtitle={monthLabel(currentMonth)}
            stats={thisMonthStats}
            highlight
            lang={lang}
          />

          {selectedPeriod !== currentMonth && (
            <PeriodHero
              title={L('Selected Period')}
              subtitle={selectedStats.label}
              stats={selectedStats}
              lang={lang}
            />
          )}

          {/* ── 6-Month Analytics Trends ────────────────────────── */}
          {comparisonRows.length > 0 && (() => {
            const eggTrend: MufChartPoint[] = comparisonRows.slice(-6).map(r => ({
              label: monthLabel(r.months[0]).slice(0, 3),
              value: r.eggsCollected,
            }));
            const profitTrend: MufChartPoint[] = comparisonRows.slice(-6).map(r => ({
              label: monthLabel(r.months[0]).slice(0, 3),
              value: r.totalProfit,
            }));
            const expByCat: Record<string, number> = {};
            otherExpenses.forEach(o => {
              const mk = monthKey(o.date);
              if (comparisonRows.slice(-6).some(r => r.months.includes(mk))) {
                const cat = (o.category || 'Other').split(' - ')[0];
                expByCat[cat] = (expByCat[cat] || 0) + (o.amount || 0);
              }
            });
            const expTrend: MufChartPoint[] = Object.entries(expByCat).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([cat, amt]) => ({
              label: cat, value: Math.round(amt),
            }));
            return (
              <>
                <div className="muf-lower-grid">
                  <div className="muf-panel p-5">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                      <Egg className="w-4 h-4 text-farm-600" /> {L('6-Month Egg Trend')}
                    </h3>
                    <MufAreaChart data={eggTrend} format={(v) => `${v.toLocaleString()} eggs`} emptyText={L('No egg data')} />
                  </div>
                  <div className="muf-panel p-5">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-farm-600" /> {L('Expense Breakdown')} (Rs)
                    </h3>
                    <MufBarChart data={expTrend} format={(v) => `Rs ${v.toLocaleString()}`} emptyText={L('No expenses')} color="#ef4444" />
                  </div>
                </div>
                <div className="muf-panel p-5">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-farm-600" /> {L('6-Month Profit/Loss Trend')} (Rs)
                  </h3>
                  <MufAreaChart data={profitTrend} format={(v) => `Rs ${v.toLocaleString()}`} emptyText={L('No data')} color={profitTrend.some(p => p.value < 0) ? '#ef4444' : '#16a34a'} />
                </div>
              </>
            );
          })()}

          <div className="muf-panel p-5 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">
                {L('Expense Breakdown')} — {selectedStats.label}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {L('Bird purchases are kept separate from operating expenses, just like the Dairy Farm reports flow.')}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                {selectedStats.expenseBreakdown.length === 0 ? (
                  <p className="text-sm text-slate-400 dark:text-slate-500">{L('No expenses in this period.')}</p>
                ) : (
                  selectedStats.expenseBreakdown.map((item) => (
                    <BreakdownRow
                      key={item.label}
                      label={item.label}
                      amount={item.amount}
                      total={selectedStats.totalExpense}
                      colorClass={item.color}
                    />
                  ))
                )}
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <MetricTile label={L('Operating Expenses')} value={formatRs(selectedStats.operatingExpense)} icon={<Wallet className="w-4 h-4" />} />
                  <MetricTile label={L('Bird Purchases')} value={formatRs(selectedStats.birdPurchaseCost)} icon={<ShoppingBag className="w-4 h-4" />} />
                  <MetricTile label={L('Feed Cost')} value={formatRs(selectedStats.feedCost)} icon={<Package className="w-4 h-4" />} />
                  <MetricTile label={L('Vaccinations')} value={formatRs(selectedStats.vaccinationCost)} icon={<Syringe className="w-4 h-4" />} />
                </div>

                {selectedStats.otherCategoryBreakdown.length > 0 && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                      {L('Other Expense Categories')}
                    </h4>
                    <div className="space-y-2">
                      {selectedStats.otherCategoryBreakdown.map((item) => (
                        <BreakdownRow
                          key={item.label}
                          label={item.label}
                          amount={item.amount}
                          total={selectedStats.otherExpenseCost}
                          colorClass={item.color}
                          compact
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <MetricTile label={L('Eggs Collected')} value={selectedStats.eggsCollected.toLocaleString()} helper={`${selectedStats.eggsSold} ${L('sold')} · ${selectedStats.eggsHome} ${L('home')} · ${selectedStats.eggsBroken} ${L('broken')}`} icon={<Egg className="w-4 h-4" />} />
            <MetricTile label={L('Direct Egg Income')} value={formatRs(selectedStats.eggIncome)} helper={L('From daily egg logs only')} icon={<Coins className="w-4 h-4" />} positive={selectedStats.eggIncome > 0} />
            <MetricTile label={L('Customer Egg Sales')} value={formatRs(selectedStats.customerIncome)} helper={L('Gross value from customer ledger')} icon={<Coins className="w-4 h-4" />} positive={selectedStats.customerIncome > 0} />
            <MetricTile label={L('Bird Sales')} value={formatRs(selectedStats.birdSaleIncome)} helper={`${selectedStats.soldBirds} ${L('birds sold')}`} icon={<BirdIcon className="w-4 h-4" />} positive={selectedStats.birdSaleIncome > 0} />
            <MetricTile label={L('Cash Received')} value={formatRs(selectedStats.customerPayments)} helper={L('Customer payments actually collected')} icon={<Wallet className="w-4 h-4" />} />
            <MetricTile label={L('This Period Due')} value={formatRs(selectedStats.periodReceivables)} helper={L('Sales minus amount paid')} icon={<Wallet className="w-4 h-4" />} />
            <MetricTile label={L('Avg Eggs / Hen / Day')} value={selectedStats.production.toFixed(2)} helper={`${selectedStats.activeHens} ${L('active hens')}`} icon={<Egg className="w-4 h-4" />} />
            <MetricTile label={L('Operating Profit')} value={formatRs(selectedStats.operatingProfit)} helper={L('Egg + customer sales − operating expense')} icon={selectedStats.operatingProfit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />} positive={selectedStats.operatingProfit >= 0} />
            <MetricTile label={L('Total Profit')} value={formatRs(selectedStats.totalProfit)} helper={L('Operating profit plus bird sales minus purchases')} icon={selectedStats.totalProfit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />} positive={selectedStats.totalProfit >= 0} />
          </div>

          <div className="muf-lower-grid">
            <div className="muf-panel p-5">
              <div className="mb-4">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                  {L('Flock Averages')} — {selectedStats.label}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {L('A Flock-friendly version of Dairy’s category average cards, based on metrics your poultry data can actually support.')}
                </p>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-2 gap-3">
                <MiniStatCard label={L('Feed Cost / Active Bird')} value={formatRs(selectedFeedCostPerBird)} helper={`${selectedStats.activeBirds} ${L('active birds')}`} />
                <MiniStatCard label={L('Operating Cost / Active Bird')} value={formatRs(selectedOperatingCostPerBird)} helper={L('Feed + other + vaccinations')} />
                <MiniStatCard label={L('Operating Revenue / Hen')} value={formatRs(selectedRevenuePerHen)} helper={`${selectedStats.activeHens} ${L('active hens')}`} />
                <MiniStatCard label={L('Average Customer Sale')} value={formatRs(selectedAverageCustomerSale)} helper={`${selectedStats.selectedCustomerSales.length} ${L('sales entries')}`} />
              </div>
            </div>

            <div className="muf-panel p-5">
              <div className="mb-4">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                  {L('Flock Snapshot')} — {selectedStats.label}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {L('This section replaces Dairy’s per-animal cost block with flock-appropriate metrics based on your current schema.')}
                </p>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-2 gap-3">
                <MiniStatCard label={L('Active Birds')} value={`${selectedStats.activeBirds}`} helper={`${selectedStats.activeRoosters} ♂ · ${selectedStats.activeHens} ♀`} />
                <MiniStatCard label={L('Sick Birds')} value={`${selectedStats.sickBirds}`} helper={L('Within active flock')} />
                <MiniStatCard label={L('Bought in Period')} value={`${selectedStats.purchasedBirds}`} helper={formatRs(selectedStats.birdPurchaseCost)} />
                <MiniStatCard label={L('Sold / Dead')} value={`${selectedStats.soldBirds} / ${selectedStats.deadBirds}`} helper={L('Stock movement')} />
                <MiniStatCard label={L('Vaccinations Logged')} value={`${selectedStats.vaccinationCount}`} helper={formatRs(selectedStats.vaccinationCost)} />
                <MiniStatCard label={L('Outstanding Receivables')} value={formatRs(selectedStats.outstandingAllTime)} helper={L('All-time customer balance')} />
                <MiniStatCard label={L('Egg Usage Split')} value={`${selectedStats.eggsSold} / ${selectedStats.eggsHome} / ${selectedStats.eggsBroken}`} helper={L('Sold / Home / Broken')} />
              </div>
            </div>
          </div>

          <div className="muf-panel overflow-hidden">
            <div className="muf-panel-heading">
              <h3>{L('Bird Purchase & Sale Activity')} — {selectedStats.label}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">{L('Bird')}</th>
                    <th className="px-4 py-3 font-medium">{L('Status')}</th>
                    <th className="px-4 py-3 font-medium text-right">{L('Bought')}</th>
                    <th className="px-4 py-3 font-medium text-right">{L('Purchase')}</th>
                    <th className="px-4 py-3 font-medium text-right">{L('Sold / Died')}</th>
                    <th className="px-4 py-3 font-medium text-right">{L('Sale Value')}</th>
                    <th className="px-4 py-3 font-medium">{L('Notes')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedStats.activityBirds.map((bird) => {
                    const note = bird.status === 'Dead'
                      ? bird.deathReason || 'Dead'
                      : bird.status === 'Sold'
                        ? 'Sold'
                        : 'Purchased';
                    return (
                      <tr key={bird.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{bird.name}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            bird.status === 'Sold'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                              : bird.status === 'Dead'
                                ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800'
                                : 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                          }`}>{bird.status}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-300">{bird.dateBought}</td>
                        <td className="px-4 py-3 text-right text-amber-700 dark:text-amber-400 font-mono">{formatRs(bird.price || 0)}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-300">{bird.saleDate || bird.dateDied || '—'}</td>
                        <td className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-400 font-mono">{bird.salePrice ? formatRs(bird.salePrice) : '—'}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{bird.deathDetail || note}</td>
                      </tr>
                    );
                  })}
                  {selectedStats.activityBirds.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                        {L('No bird purchase/sale activity in this period.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {selectedStats.selectedCustomerSales.length > 0 && (
            <div className="muf-panel p-5">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">
                {L('Customer Egg Sales')} — {selectedStats.label}
              </h3>
              <div className="space-y-2">
                {selectedStats.selectedCustomerSales
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((sale) => {
                    const total = (sale.eggsQty || 0) * (sale.pricePerEgg || 0);
                    const balance = total - (sale.amountPaid || 0);
                    return (
                      <div key={sale.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                            {customerNameById[sale.customerId] || `${L('Customer')} #${sale.customerId}`}
                          </p>
                          <p className="text-xs text-slate-400">
                            {sale.date} · {sale.eggsQty} {L('eggs')} @ {formatRs(sale.pricePerEgg)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{formatRs(total)}</p>
                          <p className="text-[11px] text-slate-400">{L('Paid')}: {formatRs(sale.amountPaid || 0)} · {L('Due')}: {formatRs(balance)}</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          <div className="muf-panel overflow-hidden">
            <div className="muf-panel-heading">
              <h3>{L('Monthly Comparison')}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-farm-50 dark:bg-farm-900/20 text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-bold">{L('Month')}</th>
                    <th className="px-4 py-3 font-bold text-right">{L('Eggs')}</th>
                    <th className="px-4 py-3 font-bold text-right">{L('Income')}</th>
                    <th className="px-4 py-3 font-bold text-right">{L('Bird Sales')}</th>
                    <th className="px-4 py-3 font-bold text-right">{L('Purchase')}</th>
                    <th className="px-4 py-3 font-bold text-right">{L('Op. Exp.')}</th>
                    <th className="px-4 py-3 font-bold text-right">{L('Total Exp.')}</th>
                    <th className="px-4 py-3 font-bold text-right bg-farm-50 dark:bg-farm-900/30">{L('Op. Profit')}</th>
                    <th className="px-4 py-3 font-bold text-right bg-farm-50 dark:bg-farm-900/30">{L('Total Profit')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {comparisonRows.map((row, idx) => (
                    <tr key={row.months[0]} className={`hover:bg-farm-50 dark:hover:bg-farm-900/10 transition-colors ${idx % 2 === 0 ? 'bg-white dark:bg-transparent' : 'bg-slate-50/50 dark:bg-slate-800/20'}`}>
                      <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100">{row.label}</td>
                      <td className="px-4 py-3 text-right font-mono">{row.eggsCollected.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">{formatRs(row.eggIncome + row.customerIncome)}</td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">{formatRs(row.birdSaleIncome)}</td>
                      <td className="px-4 py-3 text-right font-mono text-amber-600 dark:text-amber-400">{formatRs(row.birdPurchaseCost)}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-400">{formatRs(row.operatingExpense)}</td>
                      <td className="px-4 py-3 text-right font-mono text-rose-600 dark:text-rose-400">{formatRs(row.totalExpense)}</td>
                      <td className={`px-4 py-3 text-right font-mono font-bold bg-farm-50/50 dark:bg-farm-900/10 ${row.operatingProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{row.operatingProfit >= 0 ? '+' : ''}{formatRs(row.operatingProfit)}</td>
                      <td className={`px-4 py-3 text-right font-mono font-bold bg-farm-50/50 dark:bg-farm-900/10 ${row.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{row.totalProfit >= 0 ? '+' : ''}{formatRs(row.totalProfit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="muf-panel p-5">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
              {L('Export Reports')}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {L('Using Flock Farm’s existing export system.')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <SimpleExportButton label={L('Egg Report PDF')} icon={<Download className="w-4 h-4" />} onClick={() => exportEggPDF(eggProduction.filter((e) => inDateRange(e.date, selectedStats.range)), settings)} />
              <SimpleExportButton label={L('Expense Report PDF')} icon={<Download className="w-4 h-4" />} onClick={() => exportExpensePDF(birds.filter((b) => inDateRange(b.dateBought, selectedStats.range)), otherExpenses.filter((o) => inDateRange(o.date, selectedStats.range)), feedRecords.filter((f) => inDateRange(f.date, selectedStats.range)), vaccinations.filter((v) => inDateRange(v.date, selectedStats.range)))} />
              <SimpleExportButton label={L('Summary PDF')} icon={<Download className="w-4 h-4" />} onClick={() => exportMonthlySummaryPDF(summaryExportBirds, otherExpenses.filter((o) => inDateRange(o.date, selectedStats.range)), feedRecords.filter((f) => inDateRange(f.date, selectedStats.range)), eggProduction.filter((e) => inDateRange(e.date, selectedStats.range)), vaccinations.filter((v) => inDateRange(v.date, selectedStats.range)), customerSales.filter((s) => inDateRange(s.date, selectedStats.range)), settings)} />
              <SimpleExportButton label={L('Egg CSV')} icon={<FileSpreadsheet className="w-4 h-4" />} onClick={() => exportEggExcel(eggProduction.filter((e) => inDateRange(e.date, selectedStats.range)), settings)} />
              <SimpleExportButton label={L('Expense CSV')} icon={<FileSpreadsheet className="w-4 h-4" />} onClick={() => exportExpenseExcel(birds.filter((b) => inDateRange(b.dateBought, selectedStats.range)), otherExpenses.filter((o) => inDateRange(o.date, selectedStats.range)), feedRecords.filter((f) => inDateRange(f.date, selectedStats.range)), vaccinations.filter((v) => inDateRange(v.date, selectedStats.range)))} />
            </div>
          </div>
        </>
      )}

      {/* ── Farm profile for buyers (muf-profile twin) ───────── */}
      <FarmProfileCard
        lang={lang}
        storageKey="flockfarm_profile_contact"
        blurbEn="One page with your logo, flock size, monthly eggs and contact — share it with new buyers."
        buildPdfData={() => buildFlockProfileData(birds, eggProduction)}
      />
    </div>
  );
}

// Yearly zakat: income − expenses = profit → chosen % → amount. The numbers
// are prefilled from the ledger but stay editable — the app only does the
// math; the religious ruling is always the owner's own decision.
function ZakatSection({ lang = 'en', birds, otherExpenses, feedRecords, vaccinations, customerSales }: {
  lang?: Lang;
  birds: Bird[];
  otherExpenses: OtherExpense[];
  feedRecords: FeedRecord[];
  vaccinations: VaccinationRecord[];
  customerSales: CustomerSale[];
}) {
  const L = (en: string, urOrVars?: string | Record<string, string | number | null>) => mufL(lang, en, urOrVars);
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(String(thisYear));
  const [pct, setPct] = useState(String(ZAKAT_DEFAULT_PCT));
  const [incomeOverride, setIncomeOverride] = useState<string | null>(null);
  const [expenseOverride, setExpenseOverride] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const years: string[] = [];
  for (let y = thisYear; y >= thisYear - 4; y--) years.push(String(y));

  const inYear = (d?: string) => !!d && d.startsWith(year);
  const autoIncome = Math.round(
    customerSales.filter((cs) => inYear(cs.date)).reduce((a, cs) => a + (cs.amountPaid || cs.eggsQty * cs.pricePerEgg || 0), 0)
    + birds.filter((b) => inYear(b.saleDate)).reduce((a, b) => a + (b.salePrice || 0), 0)
  );
  const autoExpenses = Math.round(
    otherExpenses.filter((o) => inYear(o.date)).reduce((a, o) => a + (o.amount || 0), 0)
    + feedRecords.filter((f) => inYear(f.date)).reduce((a, f) => a + (f.quantityKg || 0) * (f.rateRsPerKg || 0), 0)
    + vaccinations.filter((v) => inYear(v.date)).reduce((a, v) => a + (v.cost || 0), 0)
    + birds.filter((b) => inYear(b.dateBought)).reduce((a, b) => a + (b.price || 0), 0)
  );
  const income = incomeOverride === null ? autoIncome : (parseFloat(incomeOverride) || 0);
  const expensesTotal = expenseOverride === null ? autoExpenses : (parseFloat(expenseOverride) || 0);
  const profit = income - expensesTotal;
  const pctNum = parseFloat(pct) || 0;
  const amount = pctAmount(profit, pctNum);
  const fmtRs = (n: number) => `Rs. ${Math.round(n).toLocaleString()}`;

  const inputClass = 'w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-950 outline-none focus:border-emerald-500';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="muf-card-link w-full flex items-center gap-3 p-4 text-left"
      >
        <span className="shrink-0 w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center text-lg">🕌</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{L('Zakat calculator (yearly)')}</p>
          <p className="text-[11px] text-slate-400 truncate">{L('Income − expenses = profit, then the rate you choose. The app only does the math — the ruling is your decision.')}</p>
        </div>
        <span className="shrink-0 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">{L('Open')} →</span>
      </button>

      <DetailModal open={open} onClose={() => setOpen(false)} title={L('Zakat calculator (yearly)')} size="big"
        icon={<span className="text-lg leading-none">🕌</span>} iconBg="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-slate-500 flex-1">{L('Income − expenses = profit, then the rate you choose. The app only does the math — the ruling is your decision.')}</p>
            <select value={year} onChange={(e) => { setYear(e.target.value); setIncomeOverride(null); setExpenseOverride(null); }} className={inputClass} style={{ width: 'auto' }}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <label className="muf-pc-label-micro">{L('Income')} ({year})</label>
              <input type="number" className={inputClass} value={incomeOverride === null ? autoIncome : incomeOverride} onChange={(e) => setIncomeOverride(e.target.value)} />
            </div>
            <div>
              <label className="muf-pc-label-micro">{L('Expenses')} ({year})</label>
              <input type="number" className={inputClass} value={expenseOverride === null ? autoExpenses : expenseOverride} onChange={(e) => setExpenseOverride(e.target.value)} />
            </div>
            <div>
              <label className="muf-pc-label-micro">{L('Rate %')}</label>
              <input type="number" step="any" min="0" className={inputClass} value={pct} onChange={(e) => setPct(e.target.value)} />
            </div>
            <div className="flex flex-col justify-end">
              <p className="text-[10px] text-slate-400 uppercase">{L('Profit')}: <span className={profit >= 0 ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'}>{fmtRs(profit)}</span></p>
              <p className="text-base font-black text-emerald-700 dark:text-emerald-400">{L('Zakat')}: {fmtRs(amount)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => downloadZakatPdf({ periodLabel: year, income, expenses: expensesTotal, pct: pctNum })}
              className="px-4 py-2 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-xl transition"
            >{L('Download zakat statement (PDF)')}</button>
            <button
              onClick={() => openMufPrint({
                title: `Zakat Statement — ${year}`,
                metaHtml: `<p>Generated: ${todayStr()}</p><p>Period: ${year}</p>`,
                bodyHtml: zakatStatementBody({ periodLabel: year, income, expenses: expensesTotal, pct: pctNum }),
              })}
              className="px-4 py-2 border border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-xs font-bold rounded-xl transition"
            >{L('Print')}</button>
            <button
              onClick={() => {
                // Year-end farm book: month-by-month income/expenses + overview + breakdown + zakat suggestion.
                const months: string[] = [];
                for (let m = 1; m <= 12; m++) months.push(`${year}-${String(m).padStart(2, '0')}`);
                const inMonth = (d: string | undefined, mk: string) => !!d && d.startsWith(mk);
                const monthly = months.map((mk) => {
                  const inc = Math.round(
                    customerSales.filter((cs) => inMonth(cs.date, mk)).reduce((a, cs) => a + (cs.amountPaid || cs.eggsQty * cs.pricePerEgg || 0), 0)
                    + birds.filter((b) => inMonth(b.saleDate, mk)).reduce((a, b) => a + (b.salePrice || 0), 0)
                  );
                  const exp = Math.round(
                    otherExpenses.filter((o) => inMonth(o.date, mk)).reduce((a, o) => a + (o.amount || 0), 0)
                    + feedRecords.filter((f) => inMonth(f.date, mk)).reduce((a, f) => a + (f.quantityKg || 0) * (f.rateRsPerKg || 0), 0)
                    + vaccinations.filter((v) => inMonth(v.date, mk)).reduce((a, v) => a + (v.cost || 0), 0)
                    + birds.filter((b) => inMonth(b.dateBought, mk)).reduce((a, b) => a + (b.price || 0), 0)
                  );
                  return [mk, inc.toLocaleString(), exp.toLocaleString(), (inc - exp).toLocaleString()];
                }).filter((row) => row[1] !== '0' || row[2] !== '0');
                const feedPaid = Math.round(feedRecords.filter((f) => inYear(f.date)).reduce((a, f) => a + (f.quantityKg || 0) * (f.rateRsPerKg || 0), 0));
                const birdsPaid = Math.round(birds.filter((b) => inYear(b.dateBought)).reduce((a, b) => a + (b.price || 0), 0));
                downloadFarmBookPdf({
                  year,
                  overview: [
                    ['Total income', `Rs. ${Math.round(income).toLocaleString()}`],
                    ['Total expenses', `Rs. ${Math.round(expensesTotal).toLocaleString()}`],
                    ['Yearly profit', `Rs. ${Math.round(profit).toLocaleString()}`],
                  ],
                  monthly,
                  sections: [
                    { title: 'Where the money went', lines: [['Feed', `Rs. ${feedPaid.toLocaleString()}`], ['Bird purchases', `Rs. ${birdsPaid.toLocaleString()}`], ['Other', `Rs. ${Math.round(expensesTotal - feedPaid - birdsPaid).toLocaleString()}`]] },
                    { title: `Zakat suggestion at ${pctNum}% of profit (your decision — see the zakat calculator)`, lines: [[`${Math.round(profit).toLocaleString()} × ${pctNum}%`, `Rs. ${Math.round(amount).toLocaleString()}`]] },
                  ],
                });
              }}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition"
            >📕 {L('Yearly farm book (PDF)')}</button>
          </div>
        </div>
      </DetailModal>
    </>
  );
}

function PeriodHero({
  title,
  subtitle,
  stats,
  highlight,
  lang,
}: {
  title: string;
  subtitle: string;
  stats: PeriodStats;
  highlight?: boolean;
  lang: Lang;
}) {
  const L = (en: string, urOrVars?: string | Record<string, string | number | null>) => mufL(lang, en, urOrVars);
  return (
    <div className={`rounded-xl p-5 text-white ${highlight ? 'bg-gradient-to-r from-farm-600 to-farm-700' : 'bg-gradient-to-r from-slate-700 to-slate-800'}`}>
      <p className="text-xs font-medium opacity-80 uppercase tracking-wider">{title} — {subtitle}</p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-3">
        <HeroStat label={L('Eggs')} value={stats.eggsCollected.toLocaleString()} />
        <HeroStat label={L('Income')} value={formatRs(stats.totalIncome)} />
        <HeroStat label={L('Expenses')} value={formatRs(stats.totalExpense)} />
        <HeroStat label={L('Operating Profit')} value={formatRs(stats.operatingProfit)} positive={stats.operatingProfit >= 0} />
        <HeroStat label={L('Total Profit')} value={formatRs(stats.totalProfit)} positive={stats.totalProfit >= 0} />
      </div>
      <p className="text-[10px] opacity-75 mt-2">
        {L('* Operating Profit = Egg + Customer Sales − Feed/Other/Vaccinations | Total Profit also includes bird purchases and bird sales.')}
      </p>
    </div>
  );
}

function HeroStat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider opacity-70">{label}</p>
      <p className={`text-base font-bold ${positive === false ? 'text-rose-200' : ''}`}>{value}</p>
    </div>
  );
}

function MetricTile({
  label,
  value,
  icon,
  positive,
  helper,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  positive?: boolean;
  helper?: string;
}) {
  return (
    <div className="muf-panel p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
        <span className={`shrink-0 ${positive === true ? 'text-emerald-500' : positive === false ? 'text-rose-500' : 'text-slate-400'}`}>{icon}</span>
      </div>
      <p className={`text-sm sm:text-base font-bold font-mono ${positive === true ? 'text-emerald-700 dark:text-emerald-400' : positive === false ? 'text-rose-700 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100'}`}>{value}</p>
      {helper && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{helper}</p>}
    </div>
  );
}

function MiniStatCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4">
      <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold">{label}</p>
      <p className="text-base font-bold text-slate-800 dark:text-slate-100 mt-1 font-mono">{value}</p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{helper}</p>
    </div>
  );
}

function BreakdownRow({
  label,
  amount,
  total,
  colorClass,
  compact,
}: {
  label: string;
  amount: number;
  total: number;
  colorClass: string;
  compact?: boolean;
}) {
  const pct = total > 0 ? (amount / total) * 100 : 0;
  return (
    <div>
      <div className={`flex justify-between gap-3 ${compact ? 'text-xs' : 'text-sm'} mb-1`}>
        <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
        <span className="font-mono text-slate-600 dark:text-slate-300">{formatRs(amount)} ({pct.toFixed(0)}%)</span>
      </div>
      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={`${colorClass} h-full rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SimpleExportButton({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-farm-50 dark:bg-farm-900/20 hover:bg-farm-100 dark:hover:bg-farm-900/35 border border-farm-200 dark:border-farm-800 text-farm-700 dark:text-farm-300 text-xs font-bold transition"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
