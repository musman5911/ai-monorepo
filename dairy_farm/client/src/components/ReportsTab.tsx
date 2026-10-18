import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, BarChart2, Droplets, DollarSign } from 'lucide-react';
import { api } from '../api';
import FarmProfileCard from '../muf/ui/muf-farm-profile';
import type { Cow, MilkEntry, Expense, ExpenseType, Rate, Sale, RateHistory, Buyer } from '../types';
import { fmt, fmtPKR, fmtL, monthKey, monthLabel, lastNMonths } from '../utils/format';
import { calcRevenueWithHistory, saleableMilkLiters } from '../utils/rates';
import { todayStr, shiftDate } from '../utils/date';
import { generateMilkReport, generateExpenseReport, generateSummaryReport } from '../reportExport';
import { L, getLang } from '../i18n';
import { MufAreaChart, MufBarChart, type MufChartPoint } from '../muf/ui/muf-charts';
import { ExportButton, CowReportButton, buildDairyProfileData } from './reports/ReportParts';

function exportRangeLabel(days: number): string {
  const labels: Record<number, string> = { 1: 'Last 1 Day', 7: 'Last 7 Days', 30: 'Last 1 Month', 180: 'Last 6 Months', 365: 'Last 1 Year' };
  return labels[days] || `Last ${days} Days`;
}

const EXPENSE_COLORS: Record<string, string> = {
  feed: '#3b82f6',
  medicine: '#ef4444',
  labor: '#a855f7',
  equipment: '#f97316',
  purchasing: '#d97706',
  misc: '#64748b',
};

const DIRECT_EXPENSE_TYPES: ExpenseType[] = ['feed', 'medicine', 'labor', 'equipment', 'misc'];
type AnimalCategory = 'cow' | 'bull' | 'calf';
type CostAnimal = Cow & {
  category: AnimalCategory;
  milkL: number;
  revenue: number;
  expenses: number;
  feed: number;
  purchaseInMonth: number;
  saleIncome: number;
  net: number;
};

function animalCategory(cow: Cow): AnimalCategory {
  if (cow.isCalf || cow.status === 'calf') return 'calf';
  if (cow.gender === 'male') return 'bull';
  return 'cow';
}

export default function ReportsTab() {
  const [cows, setCows] = useState<Cow[]>([]);
  const [milkEntries, setMilkEntries] = useState<MilkEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [rate, setRate] = useState<Rate | null>(null);
  const [rateHistory, setRateHistory] = useState<RateHistory[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(monthKey(todayStr()));

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const from = shiftDate(todayStr(), -365);

        const [cowsData, milkData, expensesData, rateData, salesData, rateHist, buyersData] = await Promise.all([
          api.getCows(),
          api.getMilk({ from }),
          api.getExpenses({ from }),
          api.getRate(),
          api.getSales({ from }),
          api.getRateHistory(),
          api.getBuyers(),
        ]);

        setCows(cowsData);
        setMilkEntries(milkData);
        setExpenses(expensesData);
        setRate(rateData);
        setSales(salesData);
        setRateHistory(rateHist);
        setBuyers(buyersData);
      } catch (error) {
        console.error('Failed to fetch report data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-8 text-center text-slate-500">{L('Loading reports...')}</div>;

  const currentRate = rate?.value || 0;
  const months = lastNMonths(12);
  const thisMonth = months[months.length - 1];

  const buyerRates = Object.fromEntries(buyers.map(b => [b._id, b.defaultRate || 0]));

  // Range options
  const rangeOptions = [
    { key: '3m', label: 'Last 3 Months', count: 3 },
    { key: '6m', label: 'Last 6 Months', count: 6 },
    { key: '1y', label: 'Last 1 Year', count: 12 },
  ];
  const isRange = selectedMonth === '3m' || selectedMonth === '6m' || selectedMonth === '1y';
  const selectedRange = rangeOptions.find(r => r.key === selectedMonth);
  const rangeMonthKeys = selectedRange ? months.slice(-selectedRange.count) : [selectedMonth];
  const rangeLabel = selectedRange ? selectedRange.label : monthLabel(selectedMonth);

  // ── Monthly stats ──────────────────────────────────────────────
  function getMonthStats(mk: string) {
    const mkMilk = milkEntries.filter(m => monthKey(m.date) === mk);
    const mkExp = expenses.filter(e => monthKey(e.date) === mk);
    const mkSales = sales.filter(s => monthKey(s.date) === mk);

    const milkL = mkMilk.reduce((a, m) => a + (m.morning || 0) + (m.evening || 0), 0);
    const calfMilk = mkMilk.reduce((a, m) => a + (m.calfMilk || 0), 0);
    const saleableL = mkMilk.reduce((a, m) => a + saleableMilkLiters(m), 0);
    const milkRevenue = calcRevenueWithHistory(mkMilk, rateHistory, currentRate, rate?.date || '', buyerRates);
    const saleIncome = mkSales.reduce((a, s) => a + (s.salePrice || 0), 0);
    const totalExp = mkExp.reduce((a, e) => a + (e.amount || 0), 0);
    const purchasingCost = mkExp.filter(e => e.type === 'purchasing').reduce((a, e) => a + (e.amount || 0), 0);
    const operatingExpenses = totalExp - purchasingCost;

    const expByType: Record<string, number> = {};
    mkExp.forEach(e => { expByType[e.type] = (expByType[e.type] || 0) + (e.amount || 0); });

    // Operating profit = milk revenue - operating expenses (excludes one-time animal purchases & sales)
    const operatingProfit = milkRevenue - operatingExpenses;
    // Total profit includes sales and purchases (one-time items)
    const totalProfit = operatingProfit + saleIncome - purchasingCost;

    return { milkL, calfMilk, saleableL, milkRevenue, saleIncome, totalExp, purchasingCost, operatingProfit, totalProfit, expByType, sales: mkSales };
  }

  const currentStats = getMonthStats(thisMonth);

  // Selected stats — aggregate if range
  function getRangeStats(mks: string[]) {
    const milkL = mks.reduce((a, mk) => a + getMonthStats(mk).milkL, 0);
    const calfMilk = mks.reduce((a, mk) => a + getMonthStats(mk).calfMilk, 0);
    const saleableL = mks.reduce((a, mk) => a + getMonthStats(mk).saleableL, 0);
    const milkRevenue = mks.reduce((a, mk) => a + getMonthStats(mk).milkRevenue, 0);
    const saleIncome = mks.reduce((a, mk) => a + getMonthStats(mk).saleIncome, 0);
    const totalExp = mks.reduce((a, mk) => a + getMonthStats(mk).totalExp, 0);
    const purchasingCost = mks.reduce((a, mk) => a + getMonthStats(mk).purchasingCost, 0);
    const operatingExpenses = totalExp - purchasingCost;
    const operatingProfit = milkRevenue - operatingExpenses;
    const totalProfit = operatingProfit + saleIncome - purchasingCost;
    const expByType: Record<string, number> = {};
    mks.forEach(mk => {
      const s = getMonthStats(mk);
      Object.entries(s.expByType).forEach(([k, v]) => { expByType[k] = (expByType[k] || 0) + v; });
    });
    const salesList = mks.flatMap(mk => getMonthStats(mk).sales);
    return { milkL, calfMilk, saleableL, milkRevenue, saleIncome, totalExp, purchasingCost, operatingProfit, totalProfit, expByType, sales: salesList };
  }
  const selectedStats = isRange ? getRangeStats(rangeMonthKeys) : getMonthStats(selectedMonth);

  // ── Expense pie data for selected month ────────────────────────
  const expensePie = Object.entries(selectedStats.expByType)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({
      name: k === 'purchasing' ? 'Animal Purchase' : k.charAt(0).toUpperCase() + k.slice(1),
      value: v,
      color: EXPENSE_COLORS[k] || '#94a3b8',
    }));

  // ── Cost per animal (selected month or range) ──────────────────
  const selectedMilk = milkEntries.filter(m => rangeMonthKeys.includes(monthKey(m.date)));
  const selectedExpenses = expenses.filter(e => rangeMonthKeys.includes(monthKey(e.date)));
  const selectedSales = sales.filter(s => rangeMonthKeys.includes(monthKey(s.date)));

  const costPerAnimal: CostAnimal[] = cows.map(cow => {
    const cowMilkRecords = selectedMilk.filter(m => m.cowId === cow._id);
    const cowMilk = cowMilkRecords.reduce((a, m) => a + (m.morning || 0) + (m.evening || 0), 0);
    const cowRevenue = calcRevenueWithHistory(cowMilkRecords, rateHistory, currentRate, rate?.date || '', buyerRates);
    const directExpenses = selectedExpenses.filter(e => e.cowId === cow._id && DIRECT_EXPENSE_TYPES.includes(e.type));
    const cowExp = directExpenses.reduce((a, e) => a + (e.amount || 0), 0);
    const cowFeed = directExpenses.filter(e => e.type === 'feed').reduce((a, e) => a + (e.amount || 0), 0);
    const cowPurchase = selectedExpenses.filter(e => e.cowId === cow._id && e.type === 'purchasing').reduce((a, e) => a + (e.amount || 0), 0);
    const cowSales = selectedSales.filter(s => s.cowId === cow._id).reduce((a, s) => a + (s.salePrice || 0), 0);
    return {
      ...cow,
      category: animalCategory(cow),
      milkL: cowMilk,
      revenue: cowRevenue,
      expenses: cowExp,
      feed: cowFeed,
      purchaseInMonth: cowPurchase,
      saleIncome: cowSales,
      net: cowRevenue + cowSales - cowExp - cowPurchase,
    };
  }).filter(cow => {
    // Show non-sold animals always, and sold animals only if they have activity in this period.
    if (cow.status !== 'sold') return true;
    return cow.milkL > 0 || cow.expenses > 0 || cow.purchaseInMonth > 0 || cow.saleIncome > 0;
  }).sort((a, b) => b.milkL - a.milkL);

  // Farm-wide expenses (no cowId assigned)
  const farmWideExpenses = selectedExpenses.filter(e => !e.cowId).reduce((a, e) => a + (e.amount || 0), 0);

  // Avg Milk / Cow divides by all animals classified as cows, including zero-milk cows.
  const categoryStats = ([
    { key: 'cow' as const, label: 'Cow', icon: '🐄' },
    { key: 'bull' as const, label: 'Bull', icon: '🐂' },
    { key: 'calf' as const, label: 'Calf', icon: '🐮' },
  ]).map(group => {
    const animals = costPerAnimal.filter(animal => animal.category === group.key);
    const count = animals.length;
    const totalCost = animals.reduce((sum, animal) => sum + animal.expenses, 0);
    const totalFeed = animals.reduce((sum, animal) => sum + animal.feed, 0);
    const totalMilk = animals.reduce((sum, animal) => sum + animal.milkL, 0);
    return {
      ...group,
      count,
      avgCost: count > 0 ? totalCost / count : null,
      avgFeed: count > 0 ? totalFeed / count : null,
      avgMilk: group.key === 'cow' && count > 0 ? totalMilk / count : null,
    };
  });

  const monthOptions = months.map(mk => ({ key: mk, label: monthLabel(mk) }));

  function shiftMonth(dir: number) {
    const idx = months.indexOf(selectedMonth);
    const next = idx + dir;
    if (next >= 0 && next < months.length) setSelectedMonth(months[next]);
  }

  return (
    <div className="space-y-6 pb-12 tab-panel">
      {/* ── Page Hero + Month/Range Selector ───────────────────── */}
      <div className="muf-page-hero">
        <div className="muf-page-title">
          <div className="muf-title-icon"><BarChart2 size={28}/></div>
          <div>
            <h2>{L('Summary')}</h2>
            <p>{L('Review dairy finances, milk performance, animal costs, and monthly trends in one place.')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          {!isRange && (
            <button onClick={() => shiftMonth(-1)} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-950 outline-none"
          >
            <optgroup label={L('Ranges')}>
              {rangeOptions.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
            </optgroup>
            <optgroup label={L('Months')}>
              {monthOptions.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </optgroup>
          </select>
          {!isRange && (
            <button onClick={() => shiftMonth(1)} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Current Month Highlight ────────────────────────────── */}
      <div className="bg-gradient-to-r from-farm-600 to-farm-700 rounded-xl p-5 text-white">
        <p className="text-xs font-medium opacity-80 uppercase tracking-wider">This Month — {monthLabel(thisMonth)}</p>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-3">
          <MiniStat label={L('Milk')} value={fmtL(currentStats.milkL)} />
          <MiniStat label={L('Milk Revenue')} value={fmtPKR(currentStats.milkRevenue)} />
          <MiniStat label={L('Expenses')} value={fmtPKR(currentStats.totalExp)} />
          <MiniStat label={L('Operating Profit')} value={fmtPKR(currentStats.operatingProfit)} highlight={currentStats.operatingProfit >= 0} />
          {currentStats.purchasingCost > 0 && (
            <MiniStat label={L('Animal Purchases')} value={fmtPKR(currentStats.purchasingCost)} />
          )}
          {currentStats.saleIncome > 0 && (
            <MiniStat label={L('Animal Sales')} value={fmtPKR(currentStats.saleIncome)} />
          )}
          <MiniStat label={L('Total Profit')} value={fmtPKR(currentStats.totalProfit)} highlight={currentStats.totalProfit >= 0} />
        </div>
        <p className="text-[10px] opacity-70 mt-2">* Operating Profit = Milk Revenue − Operating Expenses (excl. Purchases) | Total Profit includes animal sales & purchases</p>
      </div>

      {/* ── Selected Month/Range Stats ──────────────────────────── */}
      {selectedMonth !== thisMonth && (
        <div className="muf-panel p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">{rangeLabel} — Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <MiniStatDark label={L('Milk')} value={fmtL(selectedStats.milkL)} />
            <MiniStatDark label={L('Milk Revenue')} value={fmtPKR(selectedStats.milkRevenue)} />
            <MiniStatDark label={L('Expenses')} value={fmtPKR(selectedStats.totalExp)} />
            <MiniStatDark label={L('Operating Profit')} value={fmtPKR(selectedStats.operatingProfit)} positive={selectedStats.operatingProfit >= 0} />
            {selectedStats.purchasingCost > 0 && (
              <MiniStatDark label={L('Animal Purchases')} value={fmtPKR(selectedStats.purchasingCost)} />
            )}
            {selectedStats.saleIncome > 0 && (
              <MiniStatDark label={L('Animal Sales')} value={fmtPKR(selectedStats.saleIncome)} />
            )}
            <MiniStatDark label={L('Total Profit')} value={fmtPKR(selectedStats.totalProfit)} positive={selectedStats.totalProfit >= 0} />
          </div>
        </div>
      )}

      {/* ── 6-Month Analytics Trends ────────────────────────────── */}
      {(() => {
        const months = lastNMonths(6);
        const milkTrend: MufChartPoint[] = months.map(mk => ({
          label: monthLabel(mk).slice(0, 3),
          value: Math.round(milkEntries.filter(m => monthKey(m.date) === mk).reduce((a, m) => a + m.morning + m.evening, 0)),
        }));
        const expByType: Record<string, number> = {};
        expenses.forEach(e => {
          const mk = monthKey(e.date);
          if (months.includes(mk)) {
            expByType[e.type] = (expByType[e.type] || 0) + e.amount;
          }
        });
        const expTrend: MufChartPoint[] = Object.entries(expByType).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([type, amt]) => ({
          label: type.charAt(0).toUpperCase() + type.slice(1),
          value: Math.round(amt),
        }));
        return (
          <div className="muf-lower-grid">
            <div className="muf-panel p-5">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                <Droplets className="w-4 h-4 text-farm-600" /> {L('6-Month Milk Trend')} (L)
              </h3>
              <MufAreaChart data={milkTrend} format={(v) => `${v.toLocaleString()} L`} emptyText={L('No milk data')} />
            </div>
            <div className="muf-panel p-5">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-farm-600" /> {L('Expense Breakdown')} (Rs)
              </h3>
              <MufBarChart data={expTrend} format={(v) => `Rs ${v.toLocaleString()}`} emptyText={L('No expenses')} color="#ef4444" />
            </div>
          </div>
        );
      })()}

      {/* ── 6-Month Profit/Loss Trend ──────────────────────────── */}
      {(() => {
        const months = lastNMonths(6);
        const profitTrend: MufChartPoint[] = months.map(mk => {
          const mMilk = milkEntries.filter(m => monthKey(m.date) === mk);
          const mExp = expenses.filter(e => monthKey(e.date) === mk);
          const rev = calcRevenueWithHistory(mMilk, rateHistory, currentRate, rate?.date || '', buyerRates);
          const exp = mExp.reduce((a, e) => a + e.amount, 0);
          return { label: monthLabel(mk).slice(0, 3), value: Math.round(rev - exp) };
        });
        return (
          <div className="muf-panel p-5">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-farm-600" /> {L('6-Month Profit/Loss Trend')} (Rs)
            </h3>
            <MufAreaChart data={profitTrend} format={(v) => `Rs ${v.toLocaleString()}`} emptyText={L('No data')} color={profitTrend.some(p => p.value < 0) ? '#ef4444' : '#16a34a'} />
          </div>
        );
      })()}

      {/* ── Expense Breakdown + Category Averages (2-col grid) ── */}
      <div className="muf-lower-grid">
        <div className="muf-panel p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4">
            Expense Breakdown — {rangeLabel}
          </h3>
          {expensePie.length > 0 ? (
            <div className="space-y-2">
              {expensePie.map(e => {
                const pct = expensePie.reduce((a, e2) => a + e2.value, 0) > 0 ? Math.round((e.value / expensePie.reduce((a, e2) => a + e2.value, 0)) * 100) : 0;
                return (
                  <div key={e.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: e.color }} />
                        {e.name}
                      </span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{fmtPKR(e.value)} · {pct}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: e.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-400">{L('No expenses for this period')}</p>
          )}
        </div>

        <div className="muf-panel p-5">
          <div className="mb-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">{L('Average Cost by Category')}</h3>
            <p className="text-xs text-slate-400 mt-1">{L('Direct costs exclude animal purchases and farm-wide expenses.')}</p>
          </div>
          <div className="space-y-3">
            {categoryStats.map(group => (
              <div key={group.key} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100">{group.icon} {group.label}</h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700">{group.count}</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500 dark:text-slate-400">{L('Avg Cost / Animal')}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{group.avgCost === null ? '-' : fmtPKR(group.avgCost)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500 dark:text-slate-400">{L('Avg Feed / Animal')}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{group.avgFeed === null ? '-' : fmtPKR(group.avgFeed)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500 dark:text-slate-400">{L('Avg Milk / Cow')}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{group.avgMilk === null ? '-' : fmtL(group.avgMilk)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Cost per Animal (grid view) ─────────────────────────── */}
      <div className="muf-panel p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Cost per Animal — {rangeLabel}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{costPerAnimal.length} animals · Farm-wide expenses: {fmtPKR(farmWideExpenses)}</p>
        </div>
        {costPerAnimal.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">{L('No data for this period')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {costPerAnimal.map(cow => {
              const isMale = cow.gender === 'male';
              return (
                <div key={cow._id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{isMale ? '🐂' : '🐄'}</span>
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{cow.name}</p>
                        <p className="text-[10px] text-slate-400">{isMale ? 'Bull' : 'Cow'} · {cow.breed}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${cow.net >= 0 ? 'bg-farm-100 dark:bg-farm-900/30 text-farm-700 dark:text-farm-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                      {cow.net >= 0 ? 'Profit' : 'Loss'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    {!isMale && (
                      <div className="flex justify-between"><span className="text-slate-500">{L('Milk')}</span><span className="font-bold text-slate-700 dark:text-slate-300">{fmt(cow.milkL)}L</span></div>
                    )}
                    {!isMale && (
                      <div className="flex justify-between"><span className="text-slate-500">{L('Revenue')}</span><span className="font-bold text-farm-600">{fmtPKR(cow.revenue)}</span></div>
                    )}
                    {cow.purchaseInMonth > 0 && (
                      <div className="flex justify-between"><span className="text-slate-500">{L('Purchase')}</span><span className="font-bold text-amber-600">{fmtPKR(cow.purchaseInMonth)}</span></div>
                    )}
                    <div className="flex justify-between"><span className="text-slate-500">{L('Expenses')}</span><span className="font-bold text-red-500">{fmtPKR(cow.expenses)}</span></div>
                    {cow.saleIncome > 0 && (
                      <div className="flex justify-between"><span className="text-slate-500">{L('Sales')}</span><span className="font-bold text-purple-600">{fmtPKR(cow.saleIncome)}</span></div>
                    )}
                    <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-1"><span className="text-slate-500 font-bold">Net</span><span className={`font-bold ${cow.net >= 0 ? 'text-farm-600' : 'text-red-500'}`}>{fmtPKR(cow.net)}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {/* Totals summary */}
        <div className="mt-4 p-3 rounded-lg bg-farm-50 dark:bg-farm-900/20 border border-farm-200 dark:border-farm-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div><p className="text-[10px] text-slate-400 uppercase">{L('Total Milk')}</p><p className="font-bold text-slate-800 dark:text-slate-100">{fmt(costPerAnimal.reduce((a, c) => a + (c.gender !== 'male' ? c.milkL : 0), 0))} L</p></div>
          <div><p className="text-[10px] text-slate-400 uppercase">{L('Total Revenue')}</p><p className="font-bold text-farm-600">{fmtPKR(costPerAnimal.reduce((a, c) => a + (c.gender !== 'male' ? c.revenue : 0), 0))}</p></div>
          <div><p className="text-[10px] text-slate-400 uppercase">{L('Total Expenses')}</p><p className="font-bold text-red-500">{fmtPKR(costPerAnimal.reduce((a, c) => a + c.expenses, 0) + farmWideExpenses)}</p></div>
          <div><p className="text-[10px] text-slate-400 uppercase">Total Net</p><p className={`font-bold ${costPerAnimal.reduce((a, c) => a + c.net, 0) - farmWideExpenses >= 0 ? 'text-farm-600' : 'text-red-500'}`}>{fmtPKR(costPerAnimal.reduce((a, c) => a + c.net, 0) - farmWideExpenses)}</p></div>
        </div>
      </div>

      {/* ── Animal Sales ───────────────────────────────────────── */}
      {selectedSales.length > 0 && (
        <div className="muf-panel p-5">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Animal Sales — {rangeLabel}</h3>
          <div className="space-y-2">
            {selectedSales.map(sale => {
              const cow = cows.find(c => c._id === sale.cowId);
              return (
                <div key={sale._id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{cow?.name || 'Unknown'}</p>
                    <p className="text-xs text-slate-400">{sale.date}{sale.buyer ? ` · ${sale.buyer}` : ''}</p>
                  </div>
                  <span className="text-sm font-semibold text-purple-600">{fmtPKR(sale.salePrice)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Export Reports ───────────────────────────────────── */}
      <div className="muf-panel p-5">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">{L('Export Reports')}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{L('Select date range and download PDF')}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <ExportButton
            label={L('Milk Report')}
            color="stone"
            onGenerate={(rangeDays) => generateMilkReport({
              month: selectedMonth,
              rangeLabel: exportRangeLabel(rangeDays),
              rangeDays,
              cows,
              // Pass FULL datasets so rangeDays filter is applied against today, not the selected month slice
              milkEntries,
              expenses,
              sales,
              rate: currentRate,
              rateHistory,
              rateDate: rate?.date || '',
              buyerRates,
              costPerAnimal,
            })}
          />
          <ExportButton
            label={L('Expense Report')}
            color="stone"
            onGenerate={(rangeDays) => generateExpenseReport({
              month: selectedMonth,
              rangeLabel: exportRangeLabel(rangeDays),
              rangeDays,
              cows,
              milkEntries,
              expenses,
              sales,
              rate: currentRate,
              rateHistory,
              rateDate: rate?.date || '',
              buyerRates,
              costPerAnimal,
            })}
          />
          <ExportButton
            label={L('Monthly Summary')}
            color="stone"
            onGenerate={(rangeDays) => generateSummaryReport({
              month: selectedMonth,
              rangeLabel: exportRangeLabel(rangeDays),
              rangeDays,
              cows,
              milkEntries,
              expenses,
              sales,
              rate: currentRate,
              rateHistory,
              rateDate: rate?.date || '',
              buyerRates,
              costPerAnimal,
              stats: selectedStats,
            })}
          />
          <CowReportButton cows={cows} rate={currentRate} rateHistory={rateHistory} rateDate={rate?.date || ''} />
        </div>
      </div>

      {/* ── Farm profile for buyers (muf-profile twin) ───────── */}
      <FarmProfileCard
        lang={getLang()}
        storageKey="dm_profile_contact"
        blurbEn="One page with your logo, herd size, monthly milk and contact — share it with new buyers."
        buildPdfData={() => buildDairyProfileData(cows, milkEntries)}
      />
    </div>
  );
}

function MiniStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider opacity-70">{label}</p>
      <p className={`text-base font-bold ${highlight === false ? 'text-red-200' : ''}`}>{value}</p>
    </div>
  );
}

function MiniStatDark({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-slate-400 uppercase">{label}</p>
      <p className={`text-base font-bold ${positive === true ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 px-2 py-0.5 rounded-lg inline-block' : positive === false ? 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/10 px-2 py-0.5 rounded-lg inline-block' : 'text-slate-800 dark:text-slate-100'}`}>{value}</p>
    </div>
  );
}
