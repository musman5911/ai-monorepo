import React, { useState, useEffect } from 'react';
import { L } from '../i18n';
import { motion, AnimatePresence, staggerDelay, prefersReducedMotion } from '../muf/core/muf-motion';
import { Droplets, DollarSign, Hash, AlertCircle, History, CalendarDays, Share2, ArrowRight, Eye } from 'lucide-react';
import { api } from '../api';
import { MufAreaChart } from '../muf/ui/muf-charts';
import { shareViaWhatsApp, shareViaWhatsAppTo } from '../utils/share';
import { Cow, MilkEntry, Expense, HealthRecord, Rate, RateHistory, Sale, Buyer } from '../types';
import { fmt, fmtPKR } from '../utils/format';
import { calcRevenueWithHistory, saleableMilkLiters, getRateForDate } from '../utils/rates';
import { thisMonthKey, lastMonthKey, monthKeyLabel, pctChange, trendArrow, sameMonthLastYearKey } from '../muf/data/muf-compare';
import { buildDashboardComparison } from './dashboard/buildDashboardComparison';
import { feedStockSummary } from '../muf/domain/muf-feedstock';
import { udhaarSummary, daysSince, udhaarReminderText, type UdhaarRow } from '../muf/domain/muf-khata';
import { todayStr as getTodayStr, shiftDate, formatDate } from '../utils/date';
import CowDetailPopup from './CowDetailPopup';
import DetailModal from '../muf/core/muf-modal';
import MufWeather from '../muf/ui/muf-weather';
import MufFab from '../muf/core/muf-fab';
import MufWorkerPanel from '../muf/ui/muf-worker-panel';
import { loadNotifPrefs, fireNotif } from '../muf/core/muf-notifications';
import { StatCard } from './dashboard/StatCard';

interface DashboardProps {
  isAdmin: boolean;
  onNavigate: (tab: string) => void;
}

function CowImg({ src, name, size = 'w-8 h-8' }: { src?: string; name: string; size?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return <div className={`${size} rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-sm shrink-0`}>🐄</div>;
  }
  return <img src={src} alt={name} crossOrigin="anonymous" className={`${size} rounded-full object-cover border border-stone-200 dark:border-stone-700 shrink-0`} onError={() => setBroken(true)} />;
}

function genderLabel(cow: Cow) {
  return cow.gender === 'male' ? '🐂' : '🐄';
}

export default function Dashboard({ isAdmin, onNavigate }: DashboardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCowId, setSelectedCowId] = useState<string | null>(null);
  const [rateHistory, setRateHistory] = useState<RateHistory[]>([]);
  const [showMilkPopup, setShowMilkPopup] = useState(false);
  const [showRatePopup, setShowRatePopup] = useState(false);
  const [showPnlPopup, setShowPnlPopup] = useState(false);
  const [showTopPopup, setShowTopPopup] = useState(false);
  const [topRange, setTopRange] = useState<'week' | 'month' | 'year' | 'all'>('month');
  const [showCowPnlPopup, setShowCowPnlPopup] = useState(false);
  const [pnlMode, setPnlMode] = useState<'running' | 'lifetime'>('running');
  const [pnlCows, setPnlCows] = useState<Array<{
    _id: string; name: string; breed: string; status: string; image: string;
    milkRevenue: number; saleRevenue: number; opExpenses: number; purchasePrice: number;
    runningNet: number; lifetimeNet: number;
  }>>([]);
  const [showAlertsPopup, setShowAlertsPopup] = useState(false);
  const [showComparePopup, setShowComparePopup] = useState(false);
  const [farmLoc, setFarmLoc] = useState<{ lat?: number; lon?: number; city?: string } | null>(null);

  useEffect(() => {
    api.getFarmLocation().then((loc: any) => {
      if (loc.lat != null && loc.lon != null) setFarmLoc({ lat: loc.lat, lon: loc.lon, city: loc.city });
    }).catch(() => {});
  }, []);
  const [showFeedPopup, setShowFeedPopup] = useState(false);
  const [showUdhaarPopup, setShowUdhaarPopup] = useState(false);
  // Feed stock (muf-feedstock twin): all-time feed purchases + assumed daily use
  const [feedSettings, setFeedSettings] = useState<{ dailyUseKg: number; lowStockDays: number } | null>(null);
  const [feedSettingsDraft, setFeedSettingsDraft] = useState({ dailyUseKg: '', lowStockDays: '' });
  const [feedPurchases, setFeedPurchases] = useState<Expense[]>([]);
  // Udhaar (muf-khata twin): buyer balances from all-time milk − payments
  const [udhaarRows, setUdhaarRows] = useState<UdhaarRow[]>([]);
  // month-vs-month raw data (muf shared card)
  const [cmpData, setCmpData] = useState<{ milkCur: MilkEntry[]; milkPrev: MilkEntry[]; expCur: Expense[]; expPrev: Expense[]; milkLy: MilkEntry[]; expLy: Expense[] } | null>(null);
  // production-drop alarm (backend /telegram/alerts — muf drop math)
  const [dropAlert, setDropAlert] = useState<{ drop: boolean; today: number; avg: number; pct: number; threshold?: number } | null>(null);
  const [showDropPopup, setShowDropPopup] = useState(false);

  useEffect(() => {
    api.telegramAlerts().then(setDropAlert).catch(() => setDropAlert(null));
  }, []);

  useEffect(() => {
    api.getCowProfitability().then((d) => setPnlCows(d.cows || [])).catch(() => setPnlCows([]));
  }, []);

  useEffect(() => {
    const cur = thisMonthKey();
    const prev = lastMonthKey();
    const ly = sameMonthLastYearKey();
    Promise.all([
      api.getMilk({ month: cur }).catch(() => []),
      api.getMilk({ month: prev }).catch(() => []),
      api.getExpenses({ from: `${cur}-01`, to: `${cur}-31` }).catch(() => []),
      api.getExpenses({ from: `${prev}-01`, to: `${prev}-31` }).catch(() => []),
      api.getMilk({ month: ly }).catch(() => []),
      api.getExpenses({ from: `${ly}-01`, to: `${ly}-31` }).catch(() => []),
    ]).then(([milkCur, milkPrev, expCur, expPrev, milkLy, expLy]) => setCmpData({ milkCur, milkPrev, expCur, expPrev, milkLy, expLy }));
  }, []);
  const [rangeTo, setRangeTo] = useState(getTodayStr());
  const [rangeFrom, setRangeFrom] = useState(() => `${getTodayStr().slice(0, 8)}01`);
  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(rangeFrom);
  const [customTo, setCustomTo] = useState(rangeTo);
  const [data, setData] = useState<{
    cows: Cow[];
    milk: MilkEntry[];
    expenses: Expense[];
    sales: Sale[];
    buyers: Buyer[];
    rate: Rate | null;
    healthAlerts: HealthRecord[];
    allHealth: HealthRecord[];
    todayMilk: MilkEntry[];
    todayExpenses: Expense[];
  }>({ cows: [], milk: [], expenses: [], sales: [], buyers: [], rate: null, healthAlerts: [], allHealth: [], todayMilk: [], todayExpenses: [] });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const today = getTodayStr();
        const [cows, milk, expenses, rate, healthAlerts, rateHist, allHealth, todayMilk, todayExpenses, sales, buyers] = await Promise.all([
          api.getCows(),
          api.getMilk({ from: rangeFrom, to: rangeTo }),
          api.getExpenses({ from: rangeFrom, to: rangeTo }),
          api.getRate(),
          api.getUpcomingHealth(),
          api.getRateHistory(),
          api.getHealth(),
          api.getMilk({ from: today, to: today }),
          api.getExpenses({ from: today, to: today }),
          api.getSales({ from: rangeFrom, to: rangeTo }),
          api.getBuyers(),
        ]);
        setData({ cows, milk, expenses, sales, buyers, rate, healthAlerts, allHealth, todayMilk, todayExpenses });
        setRateHistory(rateHist);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [rangeFrom, rangeTo]);

  // ── Fire browser notifications for health alerts ──
  useEffect(() => {
    if (data.healthAlerts.length === 0) return;
    const prefs = loadNotifPrefs();
    if (prefs.enabled && prefs.healthAlerts) {
      fireNotif('Health Alert', `${data.healthAlerts.length} health alert(s) need attention`, prefs, 'healthAlerts');
    }
  }, [data.healthAlerts.length]);

  // ── Feed stock + udhaar (admin cards) ── all-time data, fetched once.
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const [settings, feedExp, buyers, allMilk, rateData, rateHist] = await Promise.all([
          api.getFeedStockSettings().catch(() => null),
          api.getExpenses({ type: 'feed' }).catch(() => []),
          api.getBuyers().catch(() => []),
          api.getMilk().catch(() => []),
          api.getRate().catch(() => null),
          api.getRateHistory().catch(() => []),
        ]);
        if (settings) {
          setFeedSettings(settings);
          setFeedSettingsDraft({ dailyUseKg: String(settings.dailyUseKg || ''), lowStockDays: String(settings.lowStockDays || 14) });
        }
        setFeedPurchases((feedExp as Expense[]).filter((e) => (e.feedKg || 0) > 0));

        // Buyer balances: all-time milk charges − payments (same math as BuyerKhata).
        const paymentsPerBuyer = await Promise.all(
          (buyers as Buyer[]).map((b) => api.getBuyerPayments(b._id).catch(() => [])),
        );
        const rows: UdhaarRow[] = (buyers as Buyer[]).map((b, i) => {
          const milkRows = (allMilk as MilkEntry[]).filter((m) => m.buyerId === b._id);
          const charges = milkRows.reduce((sum, m) => {
            const liters = saleableMilkLiters(m);
            const r = b.defaultRate && b.defaultRate > 0
              ? b.defaultRate
              : getRateForDate(m.date, rateHist, rateData?.value || 0, rateData?.date || '');
            return sum + liters * r;
          }, 0);
          const pays = paymentsPerBuyer[i] as { date: string; amount: number }[];
          const paid = pays.reduce((sum, pmt) => sum + (pmt.amount || 0), 0);
          const lastPaymentDate = pays.length ? pays.map((pmt) => pmt.date).sort().slice(-1)[0] : undefined;
          return { id: b._id, name: b.name, phone: b.phone, balance: Math.round(charges - paid), lastPaymentDate };
        });
        setUdhaarRows(rows);
      } catch { /* cards simply stay hidden */ }
    })();
  }, [isAdmin]);

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-xl" />)}
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <p className="text-red-600 dark:text-red-400 font-medium">⚠️ {error}</p>
        </div>
      </div>
    );
  }

  const todayStr = getTodayStr();
  const monthStart = `${todayStr.slice(0, 8)}01`;
  const isCurrentMonthRange = rangeFrom === monthStart && rangeTo === todayStr;
  const rangeLabel = `${rangeFrom} → ${rangeTo}`;
  // rangeDays removed — Top Producers now uses its own range selector
  const selectThisMonth = () => {
    setRangeFrom(monthStart);
    setRangeTo(todayStr);
    setCustomOpen(false);
  };
  const openCustomRange = () => {
    setCustomFrom(rangeFrom);
    setCustomTo(rangeTo);
    setCustomOpen(true);
  };
  const applyCustomRange = () => {
    if (!customFrom || !customTo || customFrom > customTo) return;
    setRangeFrom(customFrom);
    setRangeTo(customTo);
    setCustomOpen(false);
  };
  const yesterdayStr = shiftDate(todayStr, -1);

  const todayMilkGross = Math.round(data.todayMilk.reduce((a, c) => a + c.morning + c.evening, 0) * 100) / 100;
  const todayMilkSaleable = Math.round(data.todayMilk.reduce((a, c) => a + saleableMilkLiters(c), 0) * 100) / 100;
  const todayMilk = todayMilkGross;
  const rangeMilkEntries = data.milk.filter(m => m.date >= rangeFrom && m.date <= rangeTo);

  // muf-charts: smooth milk trend for the selected range (daily; monthly when range is long)
  const milkTrendSeries = (() => {
    const dates = new Set(data.milk.map(m => m.date));
    const monthly = dates.size > 62;
    const byKey: Record<string, number> = {};
    data.milk.forEach(m => {
      const k = monthly ? m.date.slice(0, 7) : m.date;
      byKey[k] = (byKey[k] || 0) + (m.morning || 0) + (m.evening || 0);
    });
    return Object.keys(byKey).sort().map(k => ({
      label: monthly ? k.slice(2) : k.slice(5),
      value: Math.round(byKey[k] * 10) / 10,
    }));
  })();
  const rangeTotalMilk = Math.round(rangeMilkEntries.reduce((a, c) => a + (c.morning || 0) + (c.evening || 0), 0) * 100) / 100;
  const rangeSaleableMilk = Math.round(rangeMilkEntries.reduce((a, c) => a + saleableMilkLiters(c), 0) * 100) / 100;
  const dashboardBuyerRates = Object.fromEntries(data.buyers.map(b => [b._id, b.defaultRate || 0]));
  const rangeRevenue = calcRevenueWithHistory(rangeMilkEntries, rateHistory, data.rate?.value || 0, data.rate?.date || '', dashboardBuyerRates);
  
  // Split operating vs purchasing expenses, and include sales
  const rangeExpensesList = data.expenses.filter(e => e.date >= rangeFrom && e.date <= rangeTo);
  const rangePurchases = rangeExpensesList.filter(e => e.type === 'purchasing').reduce((a, c) => a + c.amount, 0);
  const rangeOperatingExpenses = rangeExpensesList.filter(e => e.type !== 'purchasing').reduce((a, c) => a + c.amount, 0);
  const rangeTotalExp = rangePurchases + rangeOperatingExpenses;
  const rangeSalesIncome = data.sales.filter(s => s.date >= rangeFrom && s.date <= rangeTo).reduce((a, s) => a + (s.salePrice || 0), 0);
  const profitLoss = rangeRevenue + rangeSalesIncome - rangeTotalExp;

  // Top 3 producers in selected range
  const cowMilkMap: Record<string, number> = {};
  rangeMilkEntries.forEach(m => { cowMilkMap[m.cowId] = (cowMilkMap[m.cowId] || 0) + m.morning + m.evening; });
  const topProducers = Object.entries(cowMilkMap)
    .map(([id, milk]) => ({ cow: data.cows.find(c => c._id === id), milk }))
    .filter(p => p.cow)
    .sort((a, b) => b.milk - a.milk)
    .slice(0, 3);

  // Milk by cow in selected range
  const rangeMilkByCow = data.cows
    .map(cow => {
      const entries = rangeMilkEntries.filter(m => m.cowId === cow._id);
      const morning = entries.reduce((a, m) => a + (m.morning || 0), 0);
      const evening = entries.reduce((a, m) => a + (m.evening || 0), 0);
      const calfMilk = entries.reduce((a, m) => a + (m.calfMilk || 0), 0);
      return { cow, morning, evening, calfMilk, total: morning + evening, saleable: saleableMilkLiters({ morning, evening, calfMilk }) };
    })
    .filter(d => d.total > 0)
    .sort((a, b) => b.total - a.total);

  // Today's expense/revenue data
  const todayExpenses = data.todayExpenses;
  const todayMilkRev = Math.round(calcRevenueWithHistory(data.todayMilk, rateHistory, data.rate?.value || 0, data.rate?.date || '', dashboardBuyerRates));
  const todayPurchases = todayExpenses.filter(e => e.type === 'purchasing').reduce((a, e) => a + e.amount, 0);
  const expByType: { name: string; value: number; color: string }[] = [];
  const todayExpByType: Record<string, number> = {};
  todayExpenses.forEach(e => { todayExpByType[e.type] = (todayExpByType[e.type] || 0) + e.amount; });
  const expColors: Record<string, string> = { feed: '#3b82f6', medicine: '#ef4444', labor: '#a855f7', equipment: '#f97316', purchasing: '#d97706', misc: '#64748b' };
  Object.entries(todayExpByType).forEach(([k, v]) => {
    if (v > 0) expByType.push({ name: k.charAt(0).toUpperCase() + k.slice(1), value: v, color: expColors[k] || '#94a3b8' });
  });
  const todayTotalExp = todayExpenses.reduce((a, e) => a + e.amount, 0);
  const todayNet = todayMilkRev - todayTotalExp;

  // ── This month vs last month (muf shared card) ──
  const cmpCurKey = thisMonthKey();
  const cmpPrevKey = lastMonthKey();
  // Comparison math extracted to ./dashboard/buildDashboardComparison (pure
  // function — same inputs, same output as the inline IIFE it replaced).
  const cmp = buildDashboardComparison(
    cmpData,
    data.rate?.value || 0,
    data.rate?.date || '',
    rateHistory,
    dashboardBuyerRates,
  );

  // Recent Activity
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true });
  const recentActivity: { time: string; icon: string; text: string; color: string; tab?: string }[] = [];
  const todayMilkEntries = data.todayMilk;
  if (todayMilkEntries.length > 0) {
    const totalL = todayMilkEntries.reduce((a, m) => a + m.morning + m.evening, 0);
    recentActivity.push({ time: `${todayStr} ${timeStr}`, icon: '🥛', text: `Milk logged: ${fmt(totalL)}L for ${todayMilkEntries.length} cows`, color: 'text-farm-600', tab: 'milk' as const });
  }
  if (todayExpenses.length > 0) {
    recentActivity.push({ time: `${todayStr} ${timeStr}`, icon: '💰', text: `${todayExpenses.length} expenses added — ${fmtPKR(todayTotalExp)}`, color: 'text-red-600', tab: 'expenses' });
  }
  const todayHealth = data.allHealth.filter(h => h.date === todayStr);
  if (todayHealth.length > 0) {
    recentActivity.push({ time: `${todayStr} ${timeStr}`, icon: '💊', text: `${todayHealth.length} health record(s) added`, color: 'text-amber-600', tab: 'health' });
  }
  const yesterdayMilkEntries = data.milk.filter(m => m.date === yesterdayStr);
  if (yesterdayMilkEntries.length > 0) {
    const yTotal = yesterdayMilkEntries.reduce((a, m) => a + m.morning + m.evening, 0);
    recentActivity.push({ time: yesterdayStr, icon: '🥛', text: `Yesterday: ${fmt(yTotal)}L milk`, color: 'text-slate-500', tab: 'milk' });
  }
  if (data.healthAlerts.length > 0) {
    recentActivity.push({ time: `${todayStr} ${timeStr}`, icon: '⚠️', text: `${data.healthAlerts.length} health alert(s) due/overdue`, color: 'text-amber-600', tab: 'health' });
  }
  if (topProducers.length > 0) {
    recentActivity.push({ time: rangeLabel, icon: '🏆', text: `Top producer: ${topProducers[0].cow!.name} — ${fmt(topProducers[0].milk)}L in selected range`, color: 'text-farm-600', tab: 'cows' });
  }

  // Cow filter
  const cowCount = data.cows.filter(c => c.gender !== 'male').length;
  const bullCount = data.cows.filter(c => c.gender === 'male').length;


  return (
    <div className="space-y-6 tab-panel muf-dashboard-workspace">
      {/* Worker panel — shown for non-admin users */}
      {!isAdmin && (
        <MufWorkerPanel
          appName="Dairy"
          todayEntries={data.todayMilk.map(m => {
            const cow = data.cows.find(c => c._id === m.cowId);
            return { id: m._id || `${m.cowId}-${m.date}`, label: `${cow?.name || 'Unknown'} — ${fmt(m.morning + m.evening)}L`, sub: m.date };
          })}
          todayExpenses={data.todayExpenses.map(e => ({ id: e._id, label: `${e.type} — Rs ${e.amount}`, sub: e.date }))}
          todayHealth={data.allHealth.filter(h => h.date === todayStr).map(h => {
            const cow = data.cows.find(c => c._id === h.cowId);
            return { id: h._id, label: `${h.type} — ${cow?.name || 'Unknown'}`, sub: h.date };
          })}
          quickActions={[
            { label: L('Add Milk'), icon: <Droplets size={16} />, onClick: () => onNavigate('milk') },
            { label: L('Add Expense'), icon: <DollarSign size={16} />, onClick: () => onNavigate('expenses') },
            { label: L('Add Health'), icon: <AlertCircle size={16} />, onClick: () => onNavigate('health') },
          ]}
        />
      )}

      {/* production-drop alarm — click opens the detail popup (muf rule: dashboard cards open popups) */}
      {dropAlert?.drop && (
        <button onClick={() => setShowDropPopup(true)} className="w-full text-left cursor-pointer rounded-2xl border-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 flex items-start gap-3 hover:shadow-md transition-shadow">
          <div className="bg-red-100 dark:bg-red-900/40 p-2 rounded-xl h-fit"><AlertCircle className="w-5 h-5 text-red-600" /></div>
          <div className="flex-1">
            <p className="text-sm font-bold text-red-700 dark:text-red-400">{L('Milk production alarm')}</p>
            <p className="text-xs text-red-600/90 dark:text-red-300/90 mt-0.5">
              {L('Today {today} L — {pct}% below the 7-day average ({avg} L). Tap for details.', { today: dropAlert.today, pct: dropAlert.pct, avg: dropAlert.avg })}
            </p>
          </div>
          <Eye className="w-4 h-4 text-red-400 shrink-0 mt-1" />
        </button>
      )}
      <div className="relative z-20 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 dark:border-[#203528] bg-white/90 dark:bg-[#0d1a11]/90 p-3 sm:p-4 shadow-sm backdrop-blur">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{L('Date Range')}</p>
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">{rangeLabel}</p>
        </div>
        {/* Quick preset chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(() => {
            const today = getTodayStr();
            const presets: { label: string; from: string; to: string }[] = [
              { label: L('Today'), from: today, to: today },
              { label: L('Yesterday'), from: shiftDate(today, -1), to: shiftDate(today, -1) },
              { label: L('This Week'), from: shiftDate(today, -6), to: today },
              { label: L('This Month'), from: `${today.slice(0, 8)}01`, to: today },
              { label: L('This Year'), from: `${today.slice(0, 4)}-01-01`, to: today },
            ];
            return presets.map(p => {
              const active = rangeFrom === p.from && rangeTo === p.to;
              return (
                <button key={p.label} type="button" onClick={() => { setRangeFrom(p.from); setRangeTo(p.to); setCustomFrom(p.from); setCustomTo(p.to); }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition whitespace-nowrap ${
                    active ? 'bg-farm-600 text-white border-farm-700 shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}>
                  {p.label}
                </button>
              );
            });
          })()}
        </div>
        <div className="relative flex items-center gap-2">
          <button
            type="button"
            onClick={() => shareViaWhatsApp(
              `*Usman Dairy Farm — ${getTodayStr()}*\n` +
              `🥛 Today's milk: ${todayMilkGross} L\n` +
              `💰 Today's milk value: Rs ${todayMilkRev.toLocaleString()}\n` +
              `🐄 Active animals: ${data.cows.filter(c => c.status === 'active').length}`
            )}
            title={L('Share today\'s summary on WhatsApp')}
            className="flex items-center gap-1.5 rounded-xl border border-farm-300 dark:border-farm-700 px-3 py-2 text-xs font-bold text-farm-700 dark:text-farm-300 hover:bg-farm-50 dark:hover:bg-farm-900/30 transition"
          >
            <Share2 className="h-3.5 w-3.5" /> Share
          </button>
          <button
            type="button"
            onClick={selectThisMonth}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              isCurrentMonthRange
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            {L('This Month')}
          </button>
          <button
            type="button"
            onClick={openCustomRange}
            title={L('Custom range')}
            className={`p-1.5 rounded-lg border transition ${
              !isCurrentMonthRange
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
          </button>

          <AnimatePresence>
          {customOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0, y: -4 }}
              animate={{ height: 'auto', opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute right-0 top-full mt-2 z-30 w-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl overflow-hidden"
            >
            <div className="p-4 space-y-3">
              <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 uppercase tracking-wider">{L('Custom Range')}</h4>
              <label className="block space-y-1">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">{L('From')}</span>
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 rounded-lg font-mono" />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">To</span>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 rounded-lg font-mono" />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setCustomOpen(false)} className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200">{L('Cancel')}</button>
                <button type="button" onClick={applyCustomRange} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white">{L('Apply')}</button>
              </div>
            </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Health Alerts Banner ──────────────── */}
      {data.healthAlerts.length > 0 && (
        <motion.button
          initial={prefersReducedMotion() ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.985 }}
          onClick={() => setShowAlertsPopup(true)}
          className="group w-full bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-center gap-3 hover:bg-amber-100/60 dark:hover:bg-amber-900/20 transition-colors duration-200 text-left">
          <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-lg shrink-0">
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              {data.healthAlerts.length} Health Alert{data.healthAlerts.length > 1 ? 's' : ''} — Click to view
            </p>
            <p className="text-[10px] text-amber-600 dark:text-amber-400 truncate">
              {data.healthAlerts.slice(0, 3).map(a => {
                const cow = data.cows.find(c => c._id === a.cowId);
                return cow ? `${genderLabel(cow)} ${cow.name}` : 'Unknown';
              }).join(', ')}
              {data.healthAlerts.length > 3 && ` +${data.healthAlerts.length - 3} more`}
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-amber-500 shrink-0 opacity-0 group-hover:opacity-100 transition" />
        </motion.button>
      )}

      {/* ── Stats Cards ───────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StaggerItem index={0}>
          <button onClick={() => onNavigate('cows')} className="text-left w-full">
            <StatCard label={L("Cows & Bulls")} value={String(data.cows.length)} icon={Hash}
              subText={`🐄 ${cowCount} Cows · 🐂 ${bullCount} Bulls`} />
          </button>
        </StaggerItem>
        <StaggerItem index={1}>
          <button onClick={() => setShowMilkPopup(true)} className="text-left w-full">
            <StatCard
              label={L("Milk")}
              value={`${fmt(rangeTotalMilk)}L`}
              icon={Droplets}
              subText={`Saleable ${fmt(rangeSaleableMilk)}L · ${rangeLabel}`}
            />
          </button>
        </StaggerItem>
        <StaggerItem index={2}>
          <button onClick={() => setShowPnlPopup(true)} className="text-left w-full">
            <StatCard label={L("Range P&L")} value={fmtPKR(profitLoss)} icon={DollarSign}
              subText={`Rev: ${fmtPKR(rangeRevenue)}`} isNegative={profitLoss < 0} isProfit={profitLoss >= 0} />
          </button>
        </StaggerItem>
        <StaggerItem index={3}>
          <button onClick={() => setShowRatePopup(true)} className="text-left w-full">
            <StatCard label={L("Rate")} value={`₨ ${data.rate?.value || 0}`} icon={DollarSign} subText="/ Litre" />
          </button>
        </StaggerItem>
      </div>

      {/* ── Feed stock + Udhaar (admin, muf twins) ── */}
      {isAdmin && (() => {
        const stock = feedSettings ? feedStockSummary(
          feedPurchases.map((e) => ({ date: e.date.slice(0, 10), kg: e.feedKg || 0 })),
          feedSettings.dailyUseKg,
          todayStr,
          feedSettings.lowStockDays,
        ) : null;
        const udhaar = udhaarSummary(udhaarRows);
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <button onClick={() => setShowFeedPopup(true)} className="text-left w-full">
              <div className={`dm-card p-4 hover:shadow-md transition-shadow border ${stock?.isLow ? 'border-amber-400 dark:border-amber-600' : 'border-transparent'}`}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">🌾 {L('Feed stock')}</span>
                {stock ? (
                  <div className="flex items-end justify-between gap-2 mt-1">
                    <p className={`text-xl font-bold ${stock.isLow ? 'text-amber-600' : 'text-slate-800 dark:text-slate-100'}`}>
                      ≈ {fmt(stock.remainingKg)} kg
                    </p>
                    <p className={`text-xs font-bold ${stock.isLow ? 'text-amber-600' : 'text-slate-500'}`}>
                      {stock.isLow ? '⚠️ ' : ''}{L('~{daysLeft} days left', { daysLeft: stock.daysLeft })}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 mt-1">{L('Tap to set daily feed use (kg) to start tracking.')}</p>
                )}
              </div>
            </button>
            <button onClick={() => setShowUdhaarPopup(true)} className="text-left w-full">
              <div className="dm-card p-4 hover:shadow-md transition-shadow">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">📒 {L('Udhaar (amounts due)')}</span>
                <div className="flex items-end justify-between gap-2 mt-1">
                  <p className={`text-xl font-bold ${udhaar.totalDue > 0 ? 'text-red-500' : 'text-farm-600'}`}>{fmtPKR(udhaar.totalDue)}</p>
                  <p className="text-xs text-slate-500 font-bold">{udhaar.count} {L('buyers owe')}</p>
                </div>
              </div>
            </button>
          </div>
        );
      })()}

      {/* ── This month vs last month (muf shared card) ── */}
      {cmp && (
        <button onClick={() => setShowComparePopup(true)} className="w-full text-left">
          <div className="dm-card p-4 flex flex-wrap items-center gap-x-6 gap-y-2 hover:shadow-md transition-shadow">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{L('This month vs last month')}</span>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
              🥛 {fmt(cmp.curMilk)}L{' '}
              <span className={cmp.milkPct === null ? 'text-slate-400' : cmp.milkPct >= 0 ? 'text-farm-600' : 'text-red-500'}>{trendArrow(cmp.milkPct)}</span>
            </span>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
              💰 {fmtPKR(cmp.curNet)}{' '}
              <span className={cmp.netPct === null ? 'text-slate-400' : cmp.netPct >= 0 ? 'text-farm-600' : 'text-red-500'}>{trendArrow(cmp.netPct)}</span>
            </span>
            <span className="text-[10px] text-slate-400 ml-auto">{monthKeyLabel(cmpCurKey)} · {L('tap for details')}</span>
            {/* vs same month LAST YEAR (muf-compare) */}
            <div className="w-full flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-slate-100 dark:border-slate-800 pt-2 mt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">📅 {L('vs same month last year')} ({monthKeyLabel(sameMonthLastYearKey())})</span>
              {cmp.hasLy ? (
                <>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    🥛 {fmt(cmp.lyMilk)}L → {fmt(cmp.curMilk)}L{' '}
                    <span className={cmp.lyMilkPct === null ? 'text-slate-400' : cmp.lyMilkPct >= 0 ? 'text-farm-600' : 'text-red-500'}>{trendArrow(cmp.lyMilkPct)}</span>
                  </span>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    💰 {fmtPKR(cmp.lyNet)} → {fmtPKR(cmp.curNet)}{' '}
                    <span className={cmp.lyNetPct === null ? 'text-slate-400' : cmp.lyNetPct >= 0 ? 'text-farm-600' : 'text-red-500'}>{trendArrow(cmp.lyNetPct)}</span>
                  </span>
                </>
              ) : (
                <span className="text-[11px] text-slate-400 italic">{L('No data from last year yet')}</span>
              )}
            </div>
          </div>
        </button>
      )}

      {/* ── Milk Trend (muf-charts) ─────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
          <Droplets className="w-4 h-4 text-farm-600" />
          {L('Milk Trend')}
        </h3>
        <p className="text-[10px] text-slate-400 mb-3">{rangeFrom} → {rangeTo}</p>
        <MufAreaChart data={milkTrendSeries} format={(v) => `${v.toLocaleString()} L`} emptyText={L('No milk entries in this range')} />
      </div>

      {/* ── Today's Summary (with compact expense bars) ─────────── */}
      {(todayTotalExp > 0 || todayMilkRev > 0) && (
        <div className="muf-panel p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">{L("Today's Summary")}</h3>
          <p className="text-[10px] text-slate-400 mb-3">{todayStr}</p>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-farm-50 dark:bg-farm-900/10 rounded-lg">
              <span className="text-xs text-farm-700 dark:text-farm-400">{L('Total Milk (gross)')}</span>
              <span className="text-sm font-bold text-farm-700 dark:text-farm-400">{fmt(todayMilk)} L</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-farm-50/60 dark:bg-farm-900/5 rounded-lg">
              <span className="text-xs text-farm-700 dark:text-farm-400">{L('Saleable Milk')}</span>
              <span className="text-sm font-bold text-farm-700 dark:text-farm-400">{fmt(todayMilkSaleable)} L</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg">
              <span className="text-xs text-emerald-700 dark:text-emerald-400">{L('Milk Revenue')}</span>
              <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{fmtPKR(todayMilkRev)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
              <span className="text-xs text-red-700 dark:text-red-400">{L('Total Expenses')}</span>
              <span className="text-sm font-bold text-red-700 dark:text-red-400">{fmtPKR(todayTotalExp)}</span>
            </div>
            {/* Compact expense breakdown bars */}
            {expByType.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {expByType.map(e => {
                  const pct = todayTotalExp > 0 ? Math.round((e.value / todayTotalExp) * 100) : 0;
                  return (
                    <div key={e.name} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 w-16 shrink-0">{e.name}</span>
                      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: e.color }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 w-12 text-right">{fmtPKR(e.value)}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {todayPurchases > 0 && (
              <div className="flex justify-between items-center p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg">
                <span className="text-xs text-amber-700 dark:text-amber-400">{L('Animal Purchases')}</span>
                <span className="text-sm font-bold text-amber-700 dark:text-amber-400">{fmtPKR(todayPurchases)}</span>
              </div>
            )}
            <div className={`flex justify-between items-center p-3 rounded-lg ${todayNet >= 0 ? 'bg-farm-50 dark:bg-farm-900/10' : 'bg-red-50 dark:bg-red-900/10'}`}>
              <span className={`text-xs font-medium ${todayNet >= 0 ? 'text-farm-700 dark:text-farm-400' : 'text-red-700 dark:text-red-400'}`}>Net Today</span>
              <span className={`text-lg font-bold ${todayNet >= 0 ? 'text-farm-700 dark:text-farm-400' : 'text-red-700 dark:text-red-400'}`}>{fmtPKR(todayNet)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Recent Activity + Top Producers ────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 muf-panel p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            Recent Activity
          </h3>
          <div className="space-y-3">
            {recentActivity.length > 0 ? recentActivity.map((a, i) => (
              <StaggerItem key={i} index={i}>
                <button
                  onClick={() => a.tab && onNavigate(a.tab)}
                  className={`w-full flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg transition-colors duration-200 ${a.tab ? 'hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer' : 'cursor-default'}`}
                >
                  <span className="text-base shrink-0">{a.icon}</span>
                  <p className={`text-xs font-medium ${a.color} flex-1 text-left`}>{a.text}</p>
                  {a.time && <span className="text-[10px] text-slate-400 shrink-0">{a.time}</span>}
                  {a.tab && <ArrowRight className="w-3 h-3 text-slate-400 shrink-0 opacity-0 group-hover:opacity-100" />}
                </button>
              </StaggerItem>
            )) : (
              <p className="text-xs text-slate-400 text-center py-4">{L('No recent activity')}</p>
            )}
          </div>
        </div>

        <div className="muf-panel p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{L('Top Producers')}</h3>
            <button type="button" onClick={() => setShowTopPopup(true)} className="text-[11px] font-semibold text-farm-600 dark:text-farm-400 hover:underline">View details →</button>
          </div>
          <div className="space-y-2">
            {topProducers.slice(0, 3).map((p, i) => (
              <button type="button" key={p.cow!._id} onClick={() => setShowTopPopup(true)} className="w-full flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 text-left hover:border-farm-300 dark:hover:border-farm-700 transition-colors">
                <span className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-black ${i === 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}`}>{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{genderLabel(p.cow!)} {p.cow!.name}</span>
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">{p.cow!.breed || 'Breed not recorded'}</span>
                </span>
                <span className="text-xs font-extrabold text-farm-700 dark:text-farm-300 shrink-0">{fmt(p.milk)} L</span>
              </button>
            ))}
            {topProducers.length === 0 && <p className="text-xs text-slate-400 text-center py-4">{L('No milk data in this range')}</p>}
          </div>
          <p className="text-[10px] text-slate-400 mt-3">{L('Based on the selected date range.')}</p>
        </div>

        <div className="muf-panel p-4 sm:p-5 muf-cow-pnl-compact">
          <button onClick={() => setShowCowPnlPopup(true)} className="w-full text-left group">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Cow P&amp;L</h3>
              <span className="text-[10px] font-semibold text-farm-700 dark:text-farm-300 group-hover:underline">Top &amp; bottom →</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {(pnlCows.slice().sort((a, b) => b.runningNet - a.runningNet).slice(0, 5)).map((c, i) => (
                <div key={c._id} className="flex items-center gap-3 py-2.5 min-w-0">
                  <span className={`w-5 shrink-0 text-center text-[10px] font-black ${i === 0 ? 'text-amber-600' : 'text-slate-400'}`}>{i + 1}</span>
                  <span className="w-10 h-10 shrink-0 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 bg-emerald-50 dark:bg-slate-800 flex items-center justify-center text-xl">
                    {c.image ? <img src={c.image} alt="" className="w-full h-full object-cover" /> : '🐄'}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{c.name}</span>
                    <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">{c.breed || 'Breed not recorded'} · {c.status === 'sold' ? 'Sold' : 'Active'}</span>
                  </span>
                  <span className={`text-xs font-extrabold tabular-nums shrink-0 ${c.runningNet >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-400'}`}>{fmtPKR(c.runningNet)}</span>
                </div>
              ))}
              {pnlCows.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No P&amp;L data yet</p>}
            </div>
          </button>
        </div>
      </div>

      {/* ── Live Weather & Dairy Advice ─────────── */}
      <MufWeather
        lat={farmLoc?.lat}
        lon={farmLoc?.lon}
        cityName={farmLoc?.city}
        tipGenerator={({ temp, condition, humidity, wind, rain }) => {
          const tips: string[] = [];
          if (rain > 10) tips.push(`Heavy rain ahead (~${rain.toFixed(0)}mm/24h). Move feed storage indoors; keep animals sheltered and ensure drainage.`);
          else if (rain > 5) tips.push(`Rain expected (~${rain.toFixed(0)}mm/24h). Postpone outdoor vaccinations; keep shed bedding dry.`);
          else if (rain > 0.5) tips.push(`Light showers (~${rain.toFixed(1)}mm). Good for pasture — monitor for muddy conditions around water troughs.`);

          if (temp > 38) tips.push(`Extreme heat (${temp}°C). Increase water availability, milk early morning/evening, and watch for heat stress in high-yield cows.`);
          else if (temp > 32) tips.push(`High temperature (${temp}°C). Ensure shade and ventilation in sheds; add electrolytes to water.`);
          else if (temp < 5) tips.push(`Very cold (${temp}°C). Provide warm bedding; protect calves from drafts and increase feed energy.`);

          if (humidity != null && humidity >= 85 && temp >= 20) tips.push(`High humidity (${humidity}%) raises mastitis and lameness risk. Check shed hygiene and dry bedding.`);
          else if (humidity != null && humidity <= 25) tips.push(`Very dry air (${humidity}%). Ensure constant water access; monitor for respiratory irritation.`);

          if (wind != null && wind >= 30) tips.push(`Strong winds (${wind} km/h). Secure shed roofs and loose equipment; avoid spraying medicines outdoors.`);

          if (tips.length === 0) {
            if (condition.toLowerCase().includes('rain')) tips.push('Wet conditions. Keep feed dry and check for muddy walkways.');
            else tips.push('Favorable weather. Good time for routine health checks, vaccinations, and pasture management.');
          }
          return tips.slice(0, 2).join(' ');
        }}
      />

      {/* ── Popups ──────────────────────────────── */}
      <AnimatePresence>
      {showDropPopup && dropAlert && (
        <Popup key="drop-alarm" title={L('Milk production alarm')} onClose={() => setShowDropPopup(false)}>
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 p-2.5">
                <p className="text-[10px] text-red-500 font-bold uppercase">{L('Today')}</p>
                <p className="font-black text-sm text-red-600 dark:text-red-400">{dropAlert.today} L</p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-2.5">
                <p className="text-[10px] text-slate-400 font-bold uppercase">{L('7-day avg')}</p>
                <p className="font-black text-sm text-slate-700 dark:text-slate-200">{dropAlert.avg} L</p>
              </div>
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 p-2.5">
                <p className="text-[10px] text-amber-600 font-bold uppercase">{L('Down')}</p>
                <p className="font-black text-sm text-amber-700 dark:text-amber-400">{dropAlert.pct}%</p>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3 space-y-1 text-slate-600 dark:text-slate-300">
              <p className="font-bold text-slate-700 dark:text-slate-200">{L('Check these first:')}</p>
              <p>• {L('Animal health — koi beemar to nahi?')}</p>
              <p>• {L('Feed and water — poora mila?')}</p>
              <p>• {L('Weather / garmi ka asar')}</p>
              <p>• {L('Milk entries — sab likhi gayin?')}</p>
            </div>
            <p className="text-[10px] text-slate-400">{L('Alarm fires when today falls {v0}%+ below the 7-day average (set in Telegram panel). The evening Telegram summary carries this alarm too.', { v0: dropAlert.threshold || 20 })}</p>
          </div>
        </Popup>
      )}

      {showAlertsPopup && (
        <Popup key="alerts" title={`Health Alerts (${data.healthAlerts.length})`} rangeLabel={rangeLabel} onClose={() => setShowAlertsPopup(false)}>
          <div className="space-y-3">
            {data.healthAlerts.map(alert => {
              const cow = data.cows.find(c => c._id === alert.cowId);
              return (
                <div key={alert._id} className="flex gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-lg h-fit"><AlertCircle className="w-4 h-4 text-amber-600" /></div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{cow ? `${genderLabel(cow)} ${cow.name}` : 'Unknown'}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{alert.type} — {alert.description}</p>
                    {alert.medicine && <p className="text-[10px] text-slate-400">Medicine: {alert.medicine}</p>}
                    <p className="text-[10px] font-medium text-amber-600 mt-1">Due: {formatDate(alert.nextDueDate)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Popup>
      )}

      {showMilkPopup && (
        <Popup key="milk" title={L('Milk Production')} rangeLabel={rangeLabel} onClose={() => setShowMilkPopup(false)}>
          <div className="space-y-2">
            {rangeMilkByCow.map(d => (
              <div key={d.cow._id} className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-800/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <CowImg src={d.cow.image} name={d.cow.name} size="w-7 h-7" />
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{genderLabel(d.cow)} {d.cow.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-farm-600">{fmt(d.total)}L</p>
                  <p className="text-[10px] text-slate-400">M: {fmt(d.morning)} · E: {fmt(d.evening)} · Sold: {fmt(d.saleable)}</p>
                </div>
              </div>
            ))}
            {rangeMilkByCow.length === 0 && <p className="text-sm text-slate-400 text-center py-4">{L('No milk recorded in this range')}</p>}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between">
            <span className="text-sm font-medium text-slate-500">{L('Total')}</span>
            <span className="text-lg font-bold text-farm-600">{fmt(rangeTotalMilk)}L</span>
          </div>
        </Popup>
      )}

      {showPnlPopup && (
        <Popup key="pnl" title={L('Profit & Loss')} rangeLabel={rangeLabel} onClose={() => setShowPnlPopup(false)}>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg">
              <span className="text-xs text-emerald-700 dark:text-emerald-400">{L('Milk Revenue')}</span>
              <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{fmtPKR(rangeRevenue)}</span>
            </div>
            {rangeSalesIncome > 0 && (
              <div className="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg">
                <span className="text-xs text-purple-700 dark:text-purple-400">{L('Animal Sales')}</span>
                <span className="text-sm font-bold text-purple-700 dark:text-purple-400">{fmtPKR(rangeSalesIncome)}</span>
              </div>
            )}
            <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
              <span className="text-xs text-red-700 dark:text-red-400">{L('Operating Expenses')}</span>
              <span className="text-sm font-bold text-red-700 dark:text-red-400">{fmtPKR(rangeOperatingExpenses)}</span>
            </div>
            {rangePurchases > 0 && (
              <div className="flex justify-between items-center p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg">
                <span className="text-xs text-amber-700 dark:text-amber-400">{L('Animal Purchases')}</span>
                <span className="text-sm font-bold text-amber-700 dark:text-amber-400">{fmtPKR(rangePurchases)}</span>
              </div>
            )}
            <div className={`flex justify-between items-center p-3 rounded-lg ${profitLoss >= 0 ? 'bg-farm-50 dark:bg-farm-900/10' : 'bg-red-50 dark:bg-red-900/10'}`}>
              <span className={`text-xs font-medium ${profitLoss >= 0 ? 'text-farm-700 dark:text-farm-400' : 'text-red-700 dark:text-red-400'}`}>Net Profit</span>
              <span className={`text-lg font-bold ${profitLoss >= 0 ? 'text-farm-700 dark:text-farm-400' : 'text-red-700 dark:text-red-400'}`}>{fmtPKR(profitLoss)}</span>
            </div>
            <button onClick={() => { setShowPnlPopup(false); onNavigate('reports'); }} className="w-full rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white px-4 py-2 text-sm font-semibold">{L('Open Reports')}</button>
          </div>
        </Popup>
      )}

      {showRatePopup && (
        <Popup key="rate" title={L('Milk Rate History')} rangeLabel={rangeLabel} onClose={() => setShowRatePopup(false)}>
          <div className="flex items-center justify-between p-3 bg-farm-50 dark:bg-farm-900/20 rounded-lg mb-3">
            <span className="text-xs text-farm-600 font-medium">{L('Current Rate')}</span>
            <span className="text-lg font-bold text-farm-700 dark:text-farm-400">{fmtPKR(data.rate?.value || 0)}/L</span>
          </div>
          <div className="space-y-2">
            {rateHistory.sort((a, b) => b.date.localeCompare(a.date)).map(h => (
              <div key={h._id} className="flex items-center justify-between p-2 text-sm">
                <span className="text-slate-500">{h.date}</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{fmtPKR(h.value)}/L</span>
              </div>
            ))}
            {rateHistory.length === 0 && <p className="text-xs text-slate-400 text-center py-4">{L('No rate changes yet')}</p>}
          </div>
        </Popup>
      )}

        {showComparePopup && cmp && (
          <Popup key="compare" size="small" title={L('This Month vs Last Month')} rangeLabel={`${monthKeyLabel(cmpPrevKey)} → ${monthKeyLabel(cmpCurKey)}`} onClose={() => setShowComparePopup(false)}>
            <div className="space-y-2">
              {[
                { label: L('Milk (L)'), cur: `${fmt(cmp.curMilk)} L`, prev: `${fmt(cmp.prevMilk)} L`, pct: cmp.milkPct },
                { label: L('Milk value'), cur: fmtPKR(cmp.curRev), prev: fmtPKR(cmp.prevRev), pct: pctChange(cmp.curRev, cmp.prevRev) },
                { label: L('Expenses'), cur: fmtPKR(cmp.curExp), prev: fmtPKR(cmp.prevExp), pct: pctChange(cmp.curExp, cmp.prevExp) },
                { label: L('Net'), cur: fmtPKR(cmp.curNet), prev: fmtPKR(cmp.prevNet), pct: cmp.netPct },
              ].map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-200">{r.label}</span>
                  <span className="text-xs text-slate-400">{r.prev} →</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{r.cur}</span>
                  <span className={`text-xs font-bold ${r.pct === null ? 'text-slate-400' : r.pct >= 0 ? 'text-farm-600' : 'text-red-500'}`}>{trendArrow(r.pct)}</span>
                </div>
              ))}
            </div>
          </Popup>
        )}

      {showFeedPopup && (
        <Popup key="feedstock" title={L('Feed Stock')} onClose={() => setShowFeedPopup(false)}>
          <div className="space-y-4">
            {(() => {
              const stock = feedSettings ? feedStockSummary(
                feedPurchases.map((e) => ({ date: e.date.slice(0, 10), kg: e.feedKg || 0 })),
                feedSettings.dailyUseKg, todayStr, feedSettings.lowStockDays,
              ) : null;
              return stock ? (
                <div className={`p-4 rounded-xl ${stock.isLow ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700' : 'bg-slate-50 dark:bg-slate-800/40'}`}>
                  <p className="text-2xl font-black text-slate-800 dark:text-slate-100">≈ {fmt(stock.remainingKg)} kg {L('remaining')}</p>
                  <p className={`text-sm font-bold mt-1 ${stock.isLow ? 'text-amber-600' : 'text-farm-600'}`}>
                    {stock.isLow ? L('⚠️ Low stock — restock soon!') : L('Stock is OK')} · {L('about {daysLeft} days at {v1} kg/day', { daysLeft: stock.daysLeft, v1: feedSettings!.dailyUseKg })}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">{L('Total purchased: {v0} kg. Estimate = purchases − daily use since the first purchase.', { v0: fmt(stock.totalPurchasedKg) })}</p>
                </div>
              ) : (
                <p className="text-xs text-slate-500">{L('Set the daily feed use below to start tracking stock. Then add kg on feed purchases in the Expenses tab.')}</p>
              );
            })()}

            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase">{L('Settings')}</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">{L('Daily use (kg)')}</label>
                  <input type="number" min="0" step="any" value={feedSettingsDraft.dailyUseKg} onChange={(e) => setFeedSettingsDraft({ ...feedSettingsDraft, dailyUseKg: e.target.value })} className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-farm-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">{L('Warn below (days)')}</label>
                  <input type="number" min="1" value={feedSettingsDraft.lowStockDays} onChange={(e) => setFeedSettingsDraft({ ...feedSettingsDraft, lowStockDays: e.target.value })} className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-farm-500" />
                </div>
              </div>
              <button
                onClick={async () => {
                  const saved = await api.saveFeedStockSettings({ dailyUseKg: parseFloat(feedSettingsDraft.dailyUseKg) || 0, lowStockDays: parseInt(feedSettingsDraft.lowStockDays) || 14 });
                  setFeedSettings(saved);
                }}
                className="w-full bg-farm-600 hover:bg-farm-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition"
              >{L('Save settings')}</button>
            </div>

            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase">{L('Recent purchases (kg)')}</p>
              {feedPurchases.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12).map((e) => (
                <div key={e._id} className="flex items-center justify-between text-xs p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                  <span className="text-slate-500">{e.date.slice(0, 10)}</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">{e.feedKg} kg</span>
                  <span className="text-slate-400">{fmtPKR(e.amount)}</span>
                </div>
              ))}
              {feedPurchases.length === 0 && <p className="text-xs text-slate-400 italic">{L('No feed purchases with kg yet.')}</p>}
            </div>
          </div>
        </Popup>
      )}

      {showUdhaarPopup && (
        <Popup key="udhaar" title={L('Udhaar — amounts due')} onClose={() => setShowUdhaarPopup(false)}>
          <div className="space-y-2">
            {udhaarSummary(udhaarRows).debtors.map((r) => {
              const days = daysSince(r.lastPaymentDate, todayStr);
              return (
                <div key={r.id} className="flex items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-sm">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{r.name}</p>
                    <p className="text-[10px] text-slate-400">
                      {days === null ? L('no payment yet') : L('last payment {days} days ago', { days: days })}
                      {days !== null && days > 30 ? ' ⚠️' : ''}
                    </p>
                  </div>
                  <span className="font-bold text-red-500 shrink-0">{fmtPKR(r.balance)}</span>
                  {r.phone && (
                    <button
                      onClick={() => shareViaWhatsAppTo(r.phone!, udhaarReminderText(r.name, r.balance, '— Usman Dairy Farm'))}
                      className="shrink-0 px-2.5 py-1.5 rounded-lg text-white text-[11px] font-bold transition"
                      style={{ backgroundColor: '#25D366' }}
                    >{L('Remind')}</button>
                  )}
                </div>
              );
            })}
            {udhaarSummary(udhaarRows).debtors.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-6">{L('No one owes you anything right now. 🎉')}</p>
            )}
          </div>
        </Popup>
      )}

      {showTopPopup && (() => {
        const today = getTodayStr();
        const topFrom = topRange === 'week' ? shiftDate(today, -7) : topRange === 'month' ? `${today.slice(0, 8)}01` : topRange === 'year' ? `${today.slice(0, 4)}-01-01` : '';
        const topMilk = topRange === 'all' ? data.milk : data.milk.filter(m => m.date >= topFrom && m.date <= today);
        const topMilkMap: Record<string, number> = {};
        topMilk.forEach(m => { topMilkMap[m.cowId] = (topMilkMap[m.cowId] || 0) + m.morning + m.evening; });
        const topList = Object.entries(topMilkMap).map(([id, milk]) => ({ cow: data.cows.find(c => c._id === id), milk })).filter(p => p.cow).sort((a, b) => b.milk - a.milk).slice(0, 10);
        const topDays = topRange === 'week' ? 7 : topRange === 'month' ? 30 : topRange === 'year' ? 365 : 365;
        return (
        <Popup key="top" title={L('Top Producers')} rangeLabel={topRange === 'all' ? 'All time' : topRange === 'week' ? 'Last 7 days' : topRange === 'month' ? 'This month' : 'This year'} onClose={() => setShowTopPopup(false)}>
          <div className="space-y-3">
            {/* Range selector */}
            <div className="muf-filter-group">
              <span className="muf-filter-label" id="top-producers-range-label">{L('Period')}</span>
              <div className="muf-seg" role="group" aria-labelledby="top-producers-range-label">
                {([
                  { key: 'week', label: L('This Week') },
                  { key: 'month', label: L('This Month') },
                  { key: 'year', label: L('This Year') },
                  { key: 'all', label: L('All Time') },
                ] as { key: 'week' | 'month' | 'year' | 'all'; label: string }[]).map(r => (
                  <button key={r.key} type="button" aria-pressed={topRange === r.key} onClick={() => setTopRange(r.key)}>{r.label}</button>
                ))}
              </div>
            </div>
            <ul className="muf-rowlist">
              {topList.map((p, i) => {
                const avg = p.milk / topDays;
                const second = topList[1];
                const lead = i === 0 && second ? p.milk - second.milk : 0;
                const share = topList[0].milk > 0 ? Math.round((p.milk / topList[0].milk) * 100) : 0;
                return (
                  <li key={p.cow!._id}>
                    <button type="button" onClick={() => setSelectedCowId(p.cow!._id)} aria-label={`${L('Open cow details')}: ${p.cow!.name}`} className={`muf-row${i === 0 ? ' muf-row--lead' : ''}`}>
                      <span className={`muf-rank${i < 3 ? ` muf-rank--${i + 1}` : ''}`}>{i + 1}</span>
                      <CowImg src={p.cow!.image} name={p.cow!.name} size="w-11 h-11" />
                      <span className="muf-row-main">
                        <span className="muf-row-title">{genderLabel(p.cow!)} {p.cow!.name}</span>
                        <span className="muf-row-sub">{p.cow!.breed} · {p.cow!.gender === 'male' ? 'Bull' : `Lact #${p.cow!.lactationNumber || 0}`}</span>
                        <span className="muf-meter" aria-hidden="true"><span style={{ width: `${share}%` }} /></span>
                      </span>
                      <span className="muf-row-end">
                        <span className="muf-row-value muf-row-value--good">{fmt(p.milk)}L</span>
                        <span className="muf-row-sub">Avg {fmt(avg)}L/day</span>
                      </span>
                    </button>
                    {i === 0 && lead > 0 && (
                      <p className="mt-1 px-1 text-[10px] font-semibold text-farm-600 dark:text-farm-400">🏆 Leading by {fmt(lead)}L over #2</p>
                    )}
                  </li>
                );
              })}
            </ul>
            {topList.length === 0 && <p className="text-xs text-slate-400 text-center py-4">{L('No milk data in this range')}</p>}
          </div>
        </Popup>
        );
      })()}

      {showCowPnlPopup && (() => {
        const sorted = pnlCows.slice().sort((a, b) => (pnlMode === 'lifetime' ? b.lifetimeNet - a.lifetimeNet : b.runningNet - a.runningNet));
        const top = sorted.slice(0, 5);
        const bottom = sorted.length > 5 ? sorted.slice(-5).reverse() : [];
        const row = (c: (typeof pnlCows)[number], i: number, tone: 'good' | 'bad') => {
          const net = pnlMode === 'lifetime' ? c.lifetimeNet : c.runningNet;
          return (
            <li key={c._id}>
              <button type="button" onClick={() => setSelectedCowId(c._id)} aria-label={`${L('Open cow details')}: ${c.name}`} className={`muf-row ${tone === 'good' ? 'muf-row--good' : 'muf-row--bad'}`}>
                <span className={`muf-rank${tone === 'good' && i < 3 ? ` muf-rank--${i + 1}` : ''}`}>{i + 1}</span>
                <CowImg src={c.image} name={c.name} size="w-9 h-9" />
                <span className="muf-row-main">
                  <span className="muf-row-title">{c.name}{c.status === 'sold' && <span className="ml-1 text-[9px] font-semibold text-purple-500">SOLD</span>}</span>
                  <span className="muf-row-sub">Milk {fmtPKR(c.milkRevenue)}{c.saleRevenue > 0 ? ` · Sale ${fmtPKR(c.saleRevenue)}` : ''} · Cost {fmtPKR(c.opExpenses + (pnlMode === 'lifetime' ? c.purchasePrice : 0))}</span>
                </span>
                <span className="muf-row-end">
                  <span className={`muf-row-value ${net >= 0 ? 'muf-row-value--good' : 'muf-row-value--bad'}`}>{net >= 0 ? '+' : ''}{fmtPKR(net)}</span>
                </span>
              </button>
            </li>
          );
        };
        return (
        <Popup key="cowpnl" title={L('Cow P&L')} rangeLabel="" onClose={() => setShowCowPnlPopup(false)}>
          <div className="space-y-3">
            <div className="muf-seg" role="group" aria-label={L('P&L mode')}>
              {(['running', 'lifetime'] as const).map((m) => (
                <button key={m} type="button" aria-pressed={pnlMode === m} onClick={() => setPnlMode(m)}>
                  {m === 'running' ? 'Running (no purchase)' : 'Lifetime (with purchase)'}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400">
              {pnlMode === 'running'
                ? 'Milk + sale income minus operating expenses (feed/medicine) per cow.'
                : 'Running P&L minus the cow\'s purchase price — full lifecycle picture.'}
            </p>
            <h4 className="text-xs font-bold text-farm-700 dark:text-farm-400 uppercase tracking-wider">{L('Top 5')}</h4>
            <ul className="muf-rowlist">
              {top.map((c, i) => row(c, i, 'good'))}
            </ul>
            {top.length === 0 && <p className="text-xs text-slate-400 text-center py-3">{L('No P&L data yet')}</p>}
            {bottom.length > 0 && (<>
              <h4 className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Bottom {bottom.length}</h4>
              <ul className="muf-rowlist">
                {bottom.map((c, i) => row(c, i, 'bad'))}
              </ul>
            </>)}
          </div>
        </Popup>
        );
      })()}
      {selectedCowId && <CowDetailPopup key="cow-detail" cowId={selectedCowId} rate={data.rate?.value || 0} rateHistory={rateHistory} rateDate={data.rate?.date || ''} isAdmin={isAdmin} onClose={() => setSelectedCowId(null)} />}
      </AnimatePresence>

      {/* Quick Actions FAB */}
      <MufFab actions={[
        { icon: <Droplets size={18} />, label: L('Add Milk'), onClick: () => onNavigate('milk') },
        { icon: <DollarSign size={18} />, label: L('Add Expense'), onClick: () => onNavigate('expenses') },
        { icon: <AlertCircle size={18} />, label: L('Add Health Record'), onClick: () => onNavigate('health') },
      ]} />
    </div>
  );
}

/** Staggered list entrance — delays each child's fade-up by its index. */
function StaggerItem({ index, children, className = '' }: { index: number; children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={prefersReducedMotion() ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut', delay: staggerDelay(index) }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Popup({ title, rangeLabel, children, onClose, size = 'small' }: { title: string; rangeLabel?: string; children: React.ReactNode; onClose: () => void; size?: 'small' | 'big' }) {
  return (
    <DetailModal open onClose={onClose} title={title} subtitle={rangeLabel} size={size}>
      {children}
    </DetailModal>
  );
}
