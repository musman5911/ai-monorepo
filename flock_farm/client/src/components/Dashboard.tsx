import React, { useState, useMemo, useEffect } from 'react';
import { L } from '../i18n';
import {
  TrendingUp, TrendingDown, DollarSign, Percent, Activity, Egg,
  AlertTriangle, AlertCircle, HeartPulse, ShoppingBag, Coins,
  Syringe, Package, Eye, ArrowRight, Share2,
} from 'lucide-react';
import { Bird, OtherExpense, FeedRecord, EggProduction, GlobalSettings, DateRange, Lang, DeathReason, Customer,
  CustomerSale, VaccinationRecord } from '../types';
import { motion, cardSpring, wobbleSpring, staggerDelay, prefersReducedMotion } from '../muf-motion';
import {
  costPerEgg, costPerBird, birdSaleIncome, inDateRange, eggSaleIncome,
  totalOutstandingReceivables, birdsActiveInRange, productionRate,
  todayStr as localTodayStr, diffDateOnlyDays, feedStockKg,
} from '../utils/calculations';
import { DateRangeFilter } from './LightChart';
import { MufAreaChart } from '../muf-charts';
import { MufCountUpText } from '../muf-applike';
import { mufToday, mufShiftDays } from '../muf-date';
import DetailModal from '../muf-modal';
import MufWeather from '../muf-weather';
import MufFab from '../muf-fab';
import MufWorkerPanel from '../muf-worker-panel';
import { loadNotifPrefs, fireNotif } from '../muf-notifications';
import { getFarmLocation } from '../api';
import { thisMonthKey, lastMonthKey, monthKeyLabel, pctChange, trendArrow, sumMonth, sameMonthLastYearKey } from '../muf-compare';
import { udhaarSummary, daysSince, udhaarReminderText } from '../muf-khata';
import { shareViaWhatsAppTo } from '../utils/share';
import { customerBalance } from '../utils/calculations';
import BirdAvatar, { breedLabel } from './BirdAvatar';
import BirdDetailContent from './BirdDetailContent';
import { shareViaWhatsApp } from '../utils/share';
import { telegramAlerts } from '../api';
import {mufWeekStart} from '../muf-date';
import { useRecentOps, type OpItem } from './dashboard/useRecentOps';

interface DashboardProps {
  birds: Bird[];
  customers?: Customer[];
  otherExpenses: OtherExpense[];
  feedRecords: FeedRecord[];
  eggProduction: EggProduction[];
  vaccinations: VaccinationRecord[];
  customerSales: CustomerSale[];
  settings: GlobalSettings;
  openQuickAction: (actionType: 'bird' | 'egg' | 'expense' | 'feed') => void;
  onNavigate: (tab: string, highlight?: any) => void;
  lang?: Lang;
  dateRange?: DateRange | null;
  rangeFrom?: string;
  rangeTo?: string;
  onDateRangeChange?: (from: string, to: string) => void;
  onDatePreset?: (preset: 'all' | 'month' | '30d') => void;
  isAdmin?: boolean;
}

type ModalKey =
  | null
  | 'mortality' | 'deficit' | 'vaccinations' | 'feedRestock' | 'sickBirds'
  | 'income' | 'expenses' | 'net' | 'roi'
  | 'activeBirds' | 'totalEggs' | 'eggEfficiency' | 'costEgg' | 'costBird'
  | 'feedPerBird' | 'feedToday' | 'feedWeek' | 'feedMonth'
  | 'birdDetail' | 'recentOps';

const formatRs = (v: number) => `Rs ${Math.round(v).toLocaleString()}`;

export default function Dashboard({
  birds, otherExpenses, feedRecords, eggProduction, vaccinations, customers = [],
  customerSales, settings,
  openQuickAction, onNavigate, lang = 'en',
  dateRange = null, rangeFrom = '', rangeTo = '',
  onDateRangeChange, onDatePreset, isAdmin = true,
}: DashboardProps) {
  // production-drop alarm (backend /api/telegram/alerts — muf drop math)
  const [dropAlert, setDropAlert] = useState<{ drop: boolean; today: number; avg: number; pct: number; threshold?: number } | null>(null);
  const [showDropPopup, setShowDropPopup] = useState(false);
  const [farmLoc, setFarmLoc] = useState<{ lat?: number; lon?: number; city?: string } | null>(null);

  useEffect(() => {
    getFarmLocation().then((loc: any) => {
      if (loc.lat != null && loc.lon != null) setFarmLoc({ lat: loc.lat, lon: loc.lon, city: loc.city });
    }).catch(() => {});
  }, []);
  useEffect(() => {
    telegramAlerts().then(setDropAlert).catch(() => setDropAlert(null));
  }, []);

  // --- Range-filtered data ---
  const rangedFeed = useMemo(() => feedRecords.filter(f => inDateRange(f.date, dateRange)), [feedRecords, dateRange]);
  const rangedOther = useMemo(() => otherExpenses.filter(o => inDateRange(o.date, dateRange)), [otherExpenses, dateRange]);
  const rangedEggs = useMemo(() => eggProduction.filter(e => inDateRange(e.date, dateRange)), [eggProduction, dateRange]);
  const rangedVaccinations = useMemo(() => vaccinations.filter(v => inDateRange(v.date, dateRange)), [vaccinations, dateRange]);
  const rangedCustomerSales = useMemo(() => customerSales.filter(s => inDateRange(s.date, dateRange)), [customerSales, dateRange]);
  const rangedBirdsBought = useMemo(() => birds.filter(b => inDateRange(b.dateBought, dateRange)), [birds, dateRange]);

  const totalBirdPurchaseCost = rangedBirdsBought.reduce((s, b) => s + (b.price || 0), 0);
  const totalFeedCost = rangedFeed.reduce((s, f) => s + (f.quantityKg || 0) * (f.rateRsPerKg || 0), 0);
  const totalOtherCost = rangedOther.reduce((s, e) => s + (e.amount || 0), 0);
  const totalVaccCost = rangedVaccinations.reduce((s, v) => s + (v.cost || 0), 0);
  const totalExpense = totalBirdPurchaseCost + totalFeedCost + totalOtherCost + totalVaccCost;

  // Egg income uses per-record price (fall back to default)
  const eggIncome = rangedEggs.reduce((s, r) => s + eggSaleIncome(r, settings), 0);
  const birdIncome = birdSaleIncome(birds, dateRange);
  const customerIncome = rangedCustomerSales.reduce((s, s2) => s + (s2.eggsQty || 0) * (s2.pricePerEgg || 0), 0);
  const totalIncome = eggIncome + birdIncome + customerIncome;
  const outstanding = totalOutstandingReceivables(customerSales);

  // ── This month vs last month (muf shared card) ──
  const cmpCurKey = thisMonthKey();
  const cmpPrevKey = lastMonthKey();
  const cmp = useMemo(() => {
    const monthIncome = (mk: string) =>
      sumMonth(eggProduction, mk, (r) => eggSaleIncome(r, settings)) +
      sumMonth(customerSales, mk, (s2) => (s2.eggsQty || 0) * (s2.pricePerEgg || 0)) +
      birds.filter((b) => b.status === 'Sold' && String(b.saleDate || '').startsWith(mk)).reduce((a, b) => a + (b.salePrice || 0), 0);
    const monthExpense = (mk: string) =>
      sumMonth(feedRecords, mk, (f) => (f.quantityKg || 0) * (f.rateRsPerKg || 0)) +
      sumMonth(otherExpenses, mk, (e) => e.amount || 0) +
      sumMonth(vaccinations, mk, (v) => v.cost || 0) +
      birds.filter((b) => String(b.dateBought || '').startsWith(mk)).reduce((a, b) => a + (b.price || 0), 0);
    const monthEggs = (mk: string) => sumMonth(eggProduction, mk, (r) => r.totalEggsCollected || 0);
    const curEggs = monthEggs(cmpCurKey); const prevEggs = monthEggs(cmpPrevKey);
    const curInc = Math.round(monthIncome(cmpCurKey)); const prevInc = Math.round(monthIncome(cmpPrevKey));
    const curExp = Math.round(monthExpense(cmpCurKey)); const prevExp = Math.round(monthExpense(cmpPrevKey));
    const curNet = curInc - curExp; const prevNet = prevInc - prevExp;
    // Same month last year (season vs season)
    const lyKey = sameMonthLastYearKey();
    const lyEggs = monthEggs(lyKey);
    const lyNet = Math.round(monthIncome(lyKey)) - Math.round(monthExpense(lyKey));
    const hasLy = eggProduction.some((r) => String(r.date || '').startsWith(lyKey))
      || otherExpenses.some((e) => String(e.date || '').startsWith(lyKey))
      || feedRecords.some((f) => String(f.date || '').startsWith(lyKey));
    return { curEggs, prevEggs, eggsPct: pctChange(curEggs, prevEggs), curInc, prevInc, curExp, prevExp, curNet, prevNet, netPct: pctChange(curNet, prevNet),
      lyEggs, lyNet, hasLy, lyEggsPct: pctChange(curEggs, lyEggs), lyNetPct: pctChange(curNet, lyNet) };
  }, [eggProduction, customerSales, feedRecords, otherExpenses, vaccinations, birds, settings, cmpCurKey, cmpPrevKey]);

  const netProfitLoss = totalIncome - totalExpense;
  const roiPercent = totalExpense > 0 ? (netProfitLoss / totalExpense) * 100 : 0;

  const costPerEggValue = costPerEgg(birds, feedRecords, otherExpenses, eggProduction, vaccinations, customerSales, dateRange);
  const costPerBirdValue = costPerBird(birds, feedRecords, otherExpenses, vaccinations, dateRange);

  const totalBirdsCount = birds.length;
  const activeBirds = birds.filter(b => b.status === 'Active' || b.status === 'Sick');
  const activeBirdsCount = activeBirds.length;
  const deadBirds = birds.filter(b => b.status === 'Dead');
  const deadBirdsCount = deadBirds.length;
  const sickBirds = birds.filter(b => b.status === 'Sick');
  const sickBirdsCount = sickBirds.length;
  const soldBirdsCount = birds.filter(b => b.status === 'Sold').length;
  const inactiveCount = deadBirdsCount + soldBirdsCount;
  const mortalityRatePercent = totalBirdsCount > 0 ? (deadBirdsCount / totalBirdsCount) * 100 : 0;

  // Range-aware female count: which hens were actually part of the flock
  // during the selected date range, so the Eggs/Hen/Day ratio stays correct
  // on historical views even after birds have been bought/sold/lost since.
  const rangedActiveFemaleCount = birdsActiveInRange(birds, dateRange).filter(b => b.gender === 'Female').length;
  const uniqueDaysCount = rangedEggs.length;
  const totalEggsCollected = rangedEggs.reduce((s, e) => s + e.totalEggsCollected, 0);
  const eggsSold = rangedEggs.reduce((s, e) => s + e.sold, 0);
  const eggsHome = rangedEggs.reduce((s, e) => s + (e.homeUse || 0), 0);
  const eggsBroken = rangedEggs.reduce((s, e) => s + (e.brokenWasted || 0), 0);
  const avgEggsPerHenPerDay = productionRate(birds, eggProduction, dateRange);

  const now = new Date();
  const today = localTodayStr();
  const weekStart = (() => {
    const d = new Date(now);
    return mufWeekStart(d);
  })();
  const monthPrefix = today.slice(0, 7);

  const feedKgToday = feedRecords.filter(f => f.date === today).reduce((s, f) => s + f.quantityKg, 0);
  const feedKgThisWeek = feedRecords.filter(f => f.date >= weekStart).reduce((s, f) => s + f.quantityKg, 0);
  const feedKgThisMonth = feedRecords.filter(f => f.date.startsWith(monthPrefix)).reduce((s, f) => s + f.quantityKg, 0);
  const feedKgPerBird = activeBirdsCount > 0 ? feedKgThisMonth / activeBirdsCount : 0;

  // Alerts
  const showHighMortality = mortalityRatePercent > 10;
  const showFinancialDeficit = netProfitLoss < -5000;

  const vaccinationReminders = activeBirds.map(b => {
    const daysUntilDue = b.lastVaccinationDate
      ? settings.vaccinationIntervalDays - diffDateOnlyDays(b.lastVaccinationDate, today)
      : null;
    return { bird: b, daysUntilDue };
  }).filter(r => r.daysUntilDue === null || r.daysUntilDue <= 7)
    .sort((a, b) => (a.daysUntilDue ?? -9999) - (b.daysUntilDue ?? -9999));

  // --- Feed stock reminder ---
  // Previously this just checked "days since last purchase of this type" —
  // which has no idea how much feed was actually bought or how fast it's
  // being used (a big batch still triggers the nag after 2 weeks; a big
  // flock burning through a small batch fast gets no warning at all).
  // `feedStockKg` estimates kg remaining from total purchased minus an
  // assumed daily consumption rate, giving a real answer instead.
  const feedConsumptionRate = settings.feedConsumptionKgPerDay ?? 0;
  const feedStockRemainingKg = useMemo(() => {
    if (feedConsumptionRate <= 0) return null; // no consumption rate configured — can't estimate
    return feedStockKg(feedRecords, feedConsumptionRate, today);
  }, [feedRecords, feedConsumptionRate, today]);
  const feedLowStockThresholdKg = feedConsumptionRate * (settings.feedLowStockDays ?? 14);
  const feedDaysRemaining = (feedStockRemainingKg !== null && feedConsumptionRate > 0)
    ? Math.floor(feedStockRemainingKg / feedConsumptionRate) : null;
  const feedStockIsLow = feedStockRemainingKg !== null && feedStockRemainingKg <= feedLowStockThresholdKg;

  const feedRestockReminders = useMemo(() => {
    // Per-type "last purchased" info, still useful context in the modal —
    // but no longer what decides whether the alert fires (see feedStockIsLow).
    return Array.from(new Set(feedRecords.map(f => f.feedType))).map(type => {
      const recs = feedRecords.filter(f => f.feedType === type).sort((a, b) => b.date.localeCompare(a.date));
      const lastDate = recs[0]?.date;
      const daysSince = lastDate ? diffDateOnlyDays(lastDate, today) : 0;
      return { type, lastDate, daysSince };
    }).filter(r => r.daysSince >= (settings.feedLowStockDays ?? 14))
      .sort((a, b) => b.daysSince - a.daysSince);
  }, [feedRecords, settings.feedLowStockDays, today]);

  // Alert fires when we have a real stock estimate AND it's low; if no
  // consumption rate is configured, fall back to the old days-since-purchase
  // heuristic so the reminder still works for farms that haven't set one.
  const feedNeedsAttention = feedConsumptionRate > 0 ? feedStockIsLow : feedRestockReminders.length > 0;

  // ── Fire browser notifications for flock alerts ──
  useEffect(() => {
    const prefs = loadNotifPrefs();
    if (!prefs.enabled) return;
    if (sickBirdsCount > 0 && prefs.healthAlerts) {
      fireNotif('Sick Birds', `${sickBirdsCount} sick bird(s) need attention`, prefs, 'healthAlerts');
    }
    if (feedNeedsAttention && prefs.lowFeed) {
      fireNotif('Low Feed Stock', 'Feed stock is running low — check supply', prefs, 'lowFeed');
    }
    if (showFinancialDeficit && prefs.financialDeficit) {
      fireNotif('Financial Deficit', `Net loss of Rs ${Math.abs(netProfitLoss).toLocaleString()}`, prefs, 'financialDeficit');
    }
  }, [sickBirdsCount, feedNeedsAttention, showFinancialDeficit]);

  // --- Build Recent Operations list (clickable) ---
  // OpItem type + the merging logic live in ./dashboard/useRecentOps so this
  // file stays focused on rendering. The hook is a pure data transformation
  // (no UI) — same inputs, same output as the inline useMemo it replaced.
  const allRecentOps: OpItem[] = useRecentOps({
    feedRecords, otherExpenses, vaccinations, customerSales, eggProduction, birds, settings,
  });

  const recentOps = allRecentOps.slice(0, 4);

  // Daily summary sharing (email / WhatsApp) has moved to Admin → Reports.

  const [modal, setModal] = useState<ModalKey>(null);
  const [showUdhaar, setShowUdhaar] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [selectedBird, setSelectedBird] = useState<Bird | null>(null);
  const [parentModal, setParentModal] = useState<ModalKey>(null);
  const [activeFlockFilter, setActiveFlockFilter] = useState<'all' | 'male' | 'female' | 'inactive'>('all');

  const openBirdDetail = (bird: Bird, parent: ModalKey) => {
    setSelectedBird(bird);
    setParentModal(parent);
    setModal('birdDetail');
  };
  const closeBirdDetail = () => {
    setSelectedBird(null);
    setModal(parentModal);
    setParentModal(null);
  };
  const closeModal = () => {
    setModal(null);
    setSelectedBird(null);
    setParentModal(null);
    setActiveFlockFilter('all');
  };

  // Range subtitle helper
  const rangeLabel = dateRange
    ? `${dateRange.from} → ${dateRange.to}`
    : rangeFrom && rangeTo ? `${rangeFrom} → ${rangeTo}` : 'All time';

  // muf-charts: smooth egg production trend (daily; monthly when range is long)
  const eggTrendSeries = (() => {
    const src = rangeFrom && rangeTo
      ? eggProduction.filter((e) => e.date >= rangeFrom && e.date <= rangeTo)
      : eggProduction;
    const monthly = new Set(src.map((e) => e.date)).size > 62;
    const byKey: Record<string, number> = {};
    src.forEach((e) => {
      const k = monthly ? e.date.slice(0, 7) : e.date;
      byKey[k] = (byKey[k] || 0) + (e.totalEggsCollected || 0);
    });
    return Object.keys(byKey).sort().map((k) => ({
      label: monthly ? k.slice(2) : k.slice(5),
      value: byKey[k],
    }));
  })();

  // Derived helpers
  const birdAge = (b: Bird) => {
    const diff = diffDateOnlyDays(b.dateBought, today);
    const d = b.ageBoughtDays + (diff > 0 ? diff : 0);
    if (d < 30) return `${d}d`;
    if (d < 365) return `${Math.floor(d / 30)}mo`;
    return `${(d / 365).toFixed(1)}y`;
  };

  const deathReasonLabel = (r?: DeathReason) => {
    if (!r) return 'Unknown';
    return r;
  };

  // --- Build line-item lists for modals ---
  const incomeLineItems = useMemo(() => {
    const eggItems = rangedEggs.filter(e => (e.sold || 0) > 0).map(e => ({
      date: e.date,
      label: `Eggs sold (${e.sold} × Rs ${e.pricePerEgg ?? settings.defaultPricePerEgg})`,
      amount: eggSaleIncome(e, settings),
    }));
    const customerItems = rangedCustomerSales.map(s => ({
      date: s.date,
      label: `Credit sale: ${s.eggsQty} eggs @ Rs ${s.pricePerEgg}`,
      amount: (s.eggsQty || 0) * (s.pricePerEgg || 0),
    }));
    const soldBirdItems = birds.filter(b => b.status === 'Sold' && b.saleDate && inDateRange(b.saleDate, dateRange)).map(b => ({ date: b.saleDate!, label: `Bird sold: ${b.name}`, amount: b.salePrice || 0 }));
    return [...eggItems, ...customerItems, ...soldBirdItems].sort((a, b) => b.date.localeCompare(a.date));
  }, [rangedEggs, rangedCustomerSales, birds, settings, dateRange]);

  const expenseLineItems = useMemo(() => {
    const birdItems = rangedBirdsBought.map(b => ({ date: b.dateBought, label: `Bird: ${b.name}`, amount: b.price || 0 }));
    const feedItems = rangedFeed.map(f => ({ date: f.date, label: `Feed: ${f.feedType} (${f.quantityKg}kg)`, amount: (f.quantityKg || 0) * (f.rateRsPerKg || 0) }));
    const vaxItems = rangedVaccinations.map(v => ({ date: v.date, label: `Vaccination: ${v.vaccineName}${v.notes ? ' (' + v.notes + ')' : ''}`, amount: v.cost || 0 })).filter(x => x.amount > 0);
    const expItems = rangedOther.map(o => ({ date: o.date, label: `Expense: ${o.detail} (${o.category})`, amount: o.amount || 0 }));
    return [...birdItems, ...feedItems, ...vaxItems, ...expItems].sort((a, b) => b.date.localeCompare(a.date));
  }, [rangedBirdsBought, rangedFeed, rangedVaccinations, rangedOther]);

  return (
    <div className="space-y-6 muf-dashboard-workspace" id="dashboard-tab">
      {/* Worker panel — shown for non-admin users */}
      {!isAdmin && (() => {
        const today = mufToday();
        return (
          <MufWorkerPanel
            appName="Flock"
            todayEntries={eggProduction.filter(e => e.date === today).map((e, i) => ({ id: `egg-${i}`, label: `Eggs ${e.totalEggsCollected || 0}`, sub: e.date }))}
            todayExpenses={otherExpenses.filter(e => e.date === today).map((e, i) => ({ id: `exp-${i}`, label: `${e.category} Rs ${e.amount || 0}`, sub: e.date }))}
            todayHealth={vaccinations.filter(v => v.date === today).map((v, i) => ({ id: `vax-${i}`, label: `Vax ${v.vaccineName || ''}`.trim(), sub: v.date }))}
            quickActions={[
              { label: L('Add Egg Log'), icon: <Egg size={16} />, onClick: () => onNavigate('ledger') },
              { label: L('Add Expense'), icon: <ShoppingBag size={16} />, onClick: () => onNavigate('ledger') },
              { label: L('Add Vaccination'), icon: <Syringe size={16} />, onClick: () => onNavigate('health') },
            ]}
          />
        );
      })()}

      {/* production-drop alarm — click opens the detail popup (muf rule: dashboard cards open popups) */}
      {dropAlert?.drop && (
        <button onClick={() => setShowDropPopup(true)} className="w-full text-left cursor-pointer rounded-2xl border-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 flex items-start gap-3 hover:shadow-md transition-shadow">
          <div className="bg-red-100 dark:bg-red-900/40 p-2 rounded-xl h-fit"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
          <div className="flex-1">
            <p className="text-sm font-bold text-red-700 dark:text-red-400">{L('Egg production alarm')}</p>
            <p className="text-xs text-red-600/90 dark:text-red-300/90 mt-0.5">
              {L('Today {today} eggs — {pct}% below the 7-day average ({avg}). Tap for details.', { today: dropAlert.today, pct: dropAlert.pct, avg: dropAlert.avg })}
            </p>
          </div>
          <Eye className="w-4 h-4 text-red-400 shrink-0 mt-1" />
        </button>
      )}

      <DetailModal open={showDropPopup && !!dropAlert} onClose={() => setShowDropPopup(false)}
        title={L('Egg production alarm')}
        icon={<AlertTriangle className="w-5 h-5" />} iconBg="bg-red-100 text-red-700" size="small">
        {dropAlert && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-red-50 border border-red-200 p-2.5">
                <p className="text-[10px] text-red-500 font-bold uppercase">{L('Today')}</p>
                <p className="font-black text-sm text-red-600">{dropAlert.today}</p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5">
                <p className="text-[10px] text-slate-400 font-bold uppercase">{L('7-day avg')}</p>
                <p className="font-black text-sm text-slate-700">{dropAlert.avg}</p>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5">
                <p className="text-[10px] text-amber-600 font-bold uppercase">{L('Down')}</p>
                <p className="font-black text-sm text-amber-700">{dropAlert.pct}%</p>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1 text-slate-600">
              <p className="font-bold text-slate-700">{L('Check these first:')}</p>
              <p>• {L('Bird health — anyone sick?')}</p>
              <p>• {L('Feed and water — enough given?')}</p>
              <p>• {L('Weather / heat stress')}</p>
              <p>• {L('Egg entry — was today recorded?')}</p>
            </div>
            <p className="text-[10px] text-slate-400">{L('Alarm fires when today falls {v0}%+ below the 7-day average (set in the Telegram panel). The evening Telegram summary carries this alarm too.', { v0: dropAlert.threshold || 20 })}</p>
          </div>
        )}
      </DetailModal>
      {/* Date Range Filter + Quick Presets */}
      {onDatePreset && onDateRangeChange && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {/* Quick preset chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(() => {
              const today = mufToday();
              const presets: { label: string; from: string; to: string }[] = [
                { label: L('Today'), from: today, to: today },
                { label: L('Yesterday'), from: mufShiftDays(today, -1), to: mufShiftDays(today, -1) },
                { label: L('This Week'), from: mufShiftDays(today, -6), to: today },
                { label: L('This Month'), from: `${today.slice(0, 8)}01`, to: today },
                { label: L('This Year'), from: `${today.slice(0, 4)}-01-01`, to: today },
              ];
              return presets.map(p => {
                const active = rangeFrom === p.from && rangeTo === p.to;
                return (
                  <button key={p.label} type="button" onClick={() => onDateRangeChange(p.from, p.to)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition whitespace-nowrap ${
                      active ? 'bg-farm-600 text-white border-farm-700 shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}>
                    {p.label}
                  </button>
                );
              });
            })()}
          </div>
          <DateRangeFilter lang={lang} from={rangeFrom} to={rangeTo} onChange={onDateRangeChange} onPreset={onDatePreset} />
        </div>
      )}


      {/* Health Alerts Banner (dairy-style) — single bar, click to view sick birds */}
      {(() => {
        const alertCount = sickBirdsCount + (showHighMortality ? 1 : 0) + (vaccinationReminders.length > 0 ? 1 : 0) + (feedNeedsAttention ? 1 : 0) + (showFinancialDeficit ? 1 : 0);
        if (alertCount === 0) return null;
        const previewParts: string[] = [];
        if (sickBirdsCount > 0) previewParts.push(`${sickBirdsCount} sick`);
        if (showHighMortality) previewParts.push('high mortality');
        if (vaccinationReminders.length > 0) previewParts.push(`${vaccinationReminders.length} vaccination due`);
        if (feedNeedsAttention) previewParts.push('feed low');
        if (showFinancialDeficit) previewParts.push('financial deficit');
        return (
          <motion.button
            initial={prefersReducedMotion() ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => setModal('sickBirds')}
            className="group w-full bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-center gap-3 hover:bg-amber-100/60 dark:hover:bg-amber-900/20 transition-colors duration-200 text-left"
          >
            <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-lg shrink-0">
              <AlertCircle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                {alertCount} Alert{alertCount > 1 ? 's' : ''} — {L('Click to view')}
              </p>
              <p className="text-[10px] text-amber-600 dark:text-amber-400 truncate">
                {previewParts.join(' · ')}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-amber-500 shrink-0 opacity-0 group-hover:opacity-100 transition" />
          </motion.button>
        );
      })()}

      {/* Share bar + Financial KPIs (dairy-style StatCards) */}
      <Stagger index={1}>
      <div className="space-y-4">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => shareViaWhatsApp(
              `*Usman Flock Farm — ${today}\n` +
              `🐔 Active birds: ${activeBirdsCount}\n` +
              `🥚 Eggs today: ${eggProduction.filter(e => e.date === today).reduce((a, e) => a + (e.totalEggsCollected || 0), 0)}\n` +
              `💰 Net: Rs ${(totalIncome - totalExpense).toLocaleString()}`
            )}
            title={L('Share today\'s summary on WhatsApp')}
            className="flex items-center gap-1.5 rounded-xl border border-farm-300 dark:border-farm-700 px-2.5 py-1.5 text-2xs font-bold text-farm-700 dark:text-farm-300 hover:bg-farm-50 dark:hover:bg-farm-900/30 transition"
          >
            <Share2 className="w-3.5 h-3.5" /> {L('Share')}
          </button>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono font-medium">{L('Egg Price')}: Rs {settings.defaultPricePerEgg}</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StaggerItem index={0}>
            <button onClick={() => setModal('income')} className="text-left w-full">
              <StatCard label={L('Total Income')} value={formatRs(totalIncome)} icon={Coins}
                subText={L('Eggs + birds + credit sales')} isProfit={totalIncome > 0} />
            </button>
          </StaggerItem>
          <StaggerItem index={1}>
            <button onClick={() => setModal('expenses')} className="text-left w-full">
              <StatCard label={L('Total Expenses')} value={formatRs(totalExpense)} icon={ShoppingBag}
                subText={L('Birds + feed + ops + vax')} isProfit={false} />
            </button>
          </StaggerItem>
          <StaggerItem index={2}>
            <button onClick={() => setModal('net')} className="text-left w-full">
              <StatCard label={L('Net Profit/Loss')} value={`${netProfitLoss >= 0 ? '+' : '-'}${formatRs(Math.abs(netProfitLoss))}`} icon={netProfitLoss >= 0 ? TrendingUp : TrendingDown}
                subText={L('Ledger balance')} isNegative={netProfitLoss < 0} isProfit={netProfitLoss >= 0} />
            </button>
          </StaggerItem>
          <StaggerItem index={3}>
            <button onClick={() => setModal('roi')} className="text-left w-full">
              <StatCard label={L('ROI')} value={`${roiPercent.toFixed(1)}%`} icon={Percent}
                subText={L('Return on investment')} isNegative={roiPercent < 0} />
            </button>
          </StaggerItem>
        </div>
      </div>
      </Stagger>

      {/* Flock KPIs (dairy-style StatCards) */}
      <Stagger index={2}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StaggerItem index={0}>
          <button onClick={() => setModal('activeBirds')} className="text-left w-full">
            <StatCard label={L('Active Birds')} value={`${activeBirdsCount}`} icon={Activity}
              subText={`${activeBirds.filter(b => b.gender === 'Male').length}♂ · ${activeBirds.filter(b => b.gender === 'Female').length}♀`} />
          </button>
        </StaggerItem>
        <StaggerItem index={1}>
          <button onClick={() => setModal('mortality')} className="text-left w-full">
            <StatCard label={L('Mortality (lifetime)')} value={`${mortalityRatePercent.toFixed(1)}%`} icon={HeartPulse}
              subText={`${deadBirdsCount} ${L('deceased of')} ${totalBirdsCount} ${L('ever')}`} isNegative={showHighMortality} />
          </button>
        </StaggerItem>
        <StaggerItem index={2}>
          <button onClick={() => setModal('eggEfficiency')} className="text-left w-full">
            <StatCard label={L('Avg Eggs/Hen')} value={avgEggsPerHenPerDay.toFixed(2)} icon={Egg}
              subText={`${rangedActiveFemaleCount} ${L('hens laying')}`} />
          </button>
        </StaggerItem>
        <StaggerItem index={3}>
          <button onClick={() => setModal('totalEggs')} className="text-left w-full">
            <StatCard label={L('Total Eggs')} value={`${totalEggsCollected}`} icon={Egg}
              subText={`${uniqueDaysCount} ${L('day')}${uniqueDaysCount === 1 ? '' : 's'} ${L('logged')}`} />
          </button>
        </StaggerItem>
        <StaggerItem index={4}>
          <button onClick={() => setModal('feedWeek')} className="text-left w-full">
            <StatCard label={L('Feed This Week')} value={`${feedKgThisWeek} kg`} icon={Package}
              subText={L('Sun – today')} />
          </button>
        </StaggerItem>
      </div>
      </Stagger>

      {/* ── This month vs last month (muf shared card) ── */}
      <button onClick={() => setShowCompare(true)} className="w-full text-left cursor-pointer">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-4 flex flex-wrap items-center gap-x-6 gap-y-2 hover:shadow-md transition-shadow">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{L('This month vs last month')}</span>
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
            🥚 {cmp.curEggs.toLocaleString()}{' '}
            <span className={cmp.eggsPct === null ? 'text-slate-400' : cmp.eggsPct >= 0 ? 'text-farm-600' : 'text-red-500'}>{trendArrow(cmp.eggsPct)}</span>
          </span>
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
            💰 Rs {cmp.curNet.toLocaleString()}{' '}
            <span className={cmp.netPct === null ? 'text-slate-400' : cmp.netPct >= 0 ? 'text-farm-600' : 'text-red-500'}>{trendArrow(cmp.netPct)}</span>
          </span>
          <span className="text-[10px] text-slate-400 ml-auto">{monthKeyLabel(cmpCurKey)} · {L('tap for details')}</span>
          {/* vs same month LAST YEAR (muf-compare) */}
          <div className="w-full flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-slate-100 dark:border-slate-800 pt-2 mt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">📅 {L('vs same month last year')} ({monthKeyLabel(sameMonthLastYearKey())})</span>
            {cmp.hasLy ? (
              <>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  🥚 {cmp.lyEggs.toLocaleString()} → {cmp.curEggs.toLocaleString()}{' '}
                  <span className={cmp.lyEggsPct === null ? 'text-slate-400' : cmp.lyEggsPct >= 0 ? 'text-farm-600' : 'text-red-500'}>{trendArrow(cmp.lyEggsPct)}</span>
                </span>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  💰 Rs {cmp.lyNet.toLocaleString()} → Rs {cmp.curNet.toLocaleString()}{' '}
                  <span className={cmp.lyNetPct === null ? 'text-slate-400' : cmp.lyNetPct >= 0 ? 'text-farm-600' : 'text-red-500'}>{trendArrow(cmp.lyNetPct)}</span>
                </span>
              </>
            ) : (
              <span className="text-[11px] text-slate-400 italic">{L('No data from last year yet')}</span>
            )}
          </div>
        </div>
      </button>

      {/* ── Udhaar (amounts due) — muf-khata twin ── */}
      {isAdmin && customers.length > 0 && (() => {
        const rows = customers.map((c) => {
          const mySales = customerSales.filter((cs) => cs.customerId === c.id);
          const paidSales = mySales.filter((cs) => (cs.amountPaid || 0) > 0);
          return {
            id: String(c.id),
            name: c.name,
            phone: c.phone,
            balance: Math.round(customerBalance(mySales)),
            lastPaymentDate: paidSales.length ? paidSales.map((cs) => cs.date).sort().slice(-1)[0] : undefined,
          };
        });
        const ud = udhaarSummary(rows);
        return (
          <button onClick={() => setShowUdhaar(true)} className="w-full text-left cursor-pointer">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-4 flex flex-wrap items-center gap-x-6 gap-y-2 hover:shadow-md transition-shadow">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">📒 {L('Udhaar (amounts due)')}</span>
              <span className={`text-sm font-bold ${ud.totalDue > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>Rs {ud.totalDue.toLocaleString()}</span>
              <span className="text-xs font-bold text-slate-500">{ud.count} {L('customers owe')}</span>
              <span className="text-[10px] text-slate-400 ml-auto">{L('tap for details')}</span>
            </div>
          </button>
        );
      })()}

      {/* Egg trend (muf-charts) */}
      <Stagger index={3}>
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
          <Egg className="w-4 h-4 text-farm-600" />
          {L('Egg Production Trend')}
        </h3>
        <p className="text-[10px] text-slate-400 mb-3">{rangeLabel}</p>
        <MufAreaChart data={eggTrendSeries} format={(v) => `${v.toLocaleString()} eggs`} emptyText={L('No egg logs yet')} />
      </div>
      </Stagger>

      <Stagger index={4}>
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
        className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3">
          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 font-display">{L('Recent Operations')}</h4>
          <button onClick={() => setModal('recentOps')} className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" title={L('Show all recent operations')}>
            <Eye className="w-4 h-4" />
          </button>
        </div>
        {recentOps.length === 0 ? (
          <p className="text-slate-400 dark:text-slate-500 py-4 text-center text-xs">{L('No operations recorded yet.')}</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700 text-xs">
            {recentOps.map((item, i) => (
              <button
                key={i}
                onClick={() => item.tab && onNavigate(item.tab, { type: item.type, id: item.id, date: item.date })}
                className="w-full flex justify-between items-center py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 -mx-2 px-2 rounded-lg transition text-left"
              >
                <div className="min-w-0">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold mr-2 ${
                    item.type === 'Feed' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900' :
                    item.type === 'Expense' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-100 dark:border-rose-900' :
                    item.type === 'Mortality' ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 border border-red-100 dark:border-red-900' :
                    'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900'
                  }`}>{item.type}</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{item.title}</span>
                  {item.detail && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 ml-[52px] truncate">{item.detail}</p>}
                </div>
                <div className="text-right shrink-0 ml-3">
                  {item.amt > 0 && <span className={`font-mono font-bold ${item.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>
                    {item.positive ? '+' : '-'}{formatRs(item.amt)}
                  </span>}
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">{item.date}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </motion.div>
      </Stagger>

      <DetailModal
        open={showUdhaar}
        onClose={() => setShowUdhaar(false)}
        title={L('Udhaar — amounts due')}
        size="small"
      >
        <div className="space-y-2">
          {(() => {
            const rows = customers.map((c) => {
              const mySales = customerSales.filter((cs) => cs.customerId === c.id);
              const paidSales = mySales.filter((cs) => (cs.amountPaid || 0) > 0);
              return {
                id: String(c.id),
                name: c.name,
                phone: c.phone,
                balance: Math.round(customerBalance(mySales)),
                lastPaymentDate: paidSales.length ? paidSales.map((cs) => cs.date).sort().slice(-1)[0] : undefined,
              };
            });
            const debtors = udhaarSummary(rows).debtors;
            if (debtors.length === 0) {
              return <p className="text-sm text-slate-500 text-center py-6">{L('No one owes you anything right now. 🎉')}</p>;
            }
            return debtors.map((r) => {
              const days = daysSince(r.lastPaymentDate, today);
              return (
                <div key={r.id} className="flex items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-sm">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{r.name}</p>
                    <p className="text-[10px] text-slate-400">
                      {days === null ? (L('no payment yet')) : (L('last payment {days} days ago', { days: days }))}
                      {days !== null && days > 30 ? ' ⚠️' : ''}
                    </p>
                  </div>
                  <span className="font-bold text-rose-500 shrink-0">Rs {r.balance.toLocaleString()}</span>
                  {r.phone && (
                    <button
                      onClick={() => shareViaWhatsAppTo(r.phone!, udhaarReminderText(r.name, r.balance, '— Usman Flock Farm'))}
                      className="shrink-0 px-2.5 py-1.5 rounded-lg text-white text-[11px] font-bold transition"
                      style={{ backgroundColor: '#25D366' }}
                    >{L('Remind')}</button>
                  )}
                </div>
              );
            });
          })()}
        </div>
      </DetailModal>

      <DetailModal
        open={showCompare}
        onClose={() => setShowCompare(false)}
        title={L('This Month vs Last Month')}
        subtitle={`${monthKeyLabel(cmpPrevKey)} → ${monthKeyLabel(cmpCurKey)}`}
        size="small"
      >
        <div className="space-y-2">
          {[
            { label: L('Eggs'), cur: cmp.curEggs.toLocaleString(), prev: cmp.prevEggs.toLocaleString(), pct: cmp.eggsPct },
            { label: L('Income'), cur: `Rs ${cmp.curInc.toLocaleString()}`, prev: `Rs ${cmp.prevInc.toLocaleString()}`, pct: pctChange(cmp.curInc, cmp.prevInc) },
            { label: L('Expenses'), cur: `Rs ${cmp.curExp.toLocaleString()}`, prev: `Rs ${cmp.prevExp.toLocaleString()}`, pct: pctChange(cmp.curExp, cmp.prevExp) },
            { label: L('Net'), cur: `Rs ${cmp.curNet.toLocaleString()}`, prev: `Rs ${cmp.prevNet.toLocaleString()}`, pct: cmp.netPct },
          ].map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">{r.label}</span>
              <span className="text-xs text-slate-400">{r.prev} →</span>
              <span className="font-bold text-slate-800 dark:text-slate-100">{r.cur}</span>
              <span className={`text-xs font-bold ${r.pct === null ? 'text-slate-400' : r.pct >= 0 ? 'text-farm-600' : 'text-red-500'}`}>{trendArrow(r.pct)}</span>
            </div>
          ))}
        </div>
      </DetailModal>

      <DetailModal
        open={modal === 'recentOps'}
        onClose={closeModal}
        title={L('Recent Operations')}
        subtitle={`${allRecentOps.length} latest entries`}
        icon={<Eye className="w-5 h-5" />}
        iconBg="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
        size="small"
      >
        {allRecentOps.length === 0 ? (
          <p className="text-slate-400 dark:text-slate-500 py-8 text-center text-sm">{L('No operations recorded yet.')}</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700 text-xs">
            {allRecentOps.map((item, i) => (
              <button
                key={`${item.type}-${item.date}-${i}`}
                onClick={() => {
                  closeModal();
                  if (item.tab) onNavigate(item.tab, { type: item.type, id: item.id, date: item.date });
                }}
                className="w-full flex justify-between items-center py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 -mx-2 px-2 rounded-lg transition text-left"
              >
                <div className="min-w-0">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold mr-2 ${
                    item.type === 'Feed' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900' :
                    item.type === 'Expense' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-100 dark:border-rose-900' :
                    item.type === 'Mortality' ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 border border-red-100 dark:border-red-900' :
                    'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900'
                  }`}>{item.type}</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{item.title}</span>
                  {item.detail && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 ml-[52px] truncate">{item.detail}</p>}
                </div>
                <div className="text-right shrink-0 ml-3">
                  {item.amt > 0 && <span className={`font-mono font-bold ${item.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>
                    {item.positive ? '+' : '-'}{formatRs(item.amt)}
                  </span>}
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">{item.date}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </DetailModal>

      {/* ── Live Weather & Flock Advice ─────────── */}
      <MufWeather
        lat={farmLoc?.lat}
        lon={farmLoc?.lon}
        cityName={farmLoc?.city}
        tipGenerator={({ temp, condition, humidity, wind, rain }) => {
          const tips: string[] = [];
          if (rain > 10) tips.push(`Heavy rain ahead (~${rain.toFixed(0)}mm/24h). Move feeders indoors; secure coop against wet and drafts.`);
          else if (rain > 5) tips.push(`Rain expected (~${rain.toFixed(0)}mm/24h). Postpone vaccinations; keep litter dry to prevent coccidiosis.`);
          else if (rain > 0.5) tips.push(`Light showers (~${rain.toFixed(1)}mm). Ensure coop ventilation; check for wet litter around drinkers.`);

          if (temp > 38) tips.push(`Extreme heat (${temp}°C). Add electrolytes to water, increase ventilation, and mist birds to prevent heat stroke.`);
          else if (temp > 32) tips.push(`High temperature (${temp}°C). Ensure shade and airflow; reduce stocking density in hot hours.`);
          else if (temp < 5) tips.push(`Very cold (${temp}°C). Deepen litter for warmth; protect chicks with brooders and block cold drafts.`);

          if (humidity != null && humidity >= 85 && temp >= 20) tips.push(`High humidity (${humidity}%) raises respiratory and coccidiosis risk. Improve ventilation and change wet litter.`);
          else if (humidity != null && humidity <= 25) tips.push(`Very dry air (${humidity}%). Dust can irritate airways — sprinkle water on litter to settle dust.`);

          if (wind != null && wind >= 30) tips.push(`Strong winds (${wind} km/h). Secure coop roofs and netting; avoid outdoor spray treatments.`);

          if (tips.length === 0) {
            if (condition.toLowerCase().includes('rain')) tips.push('Wet conditions. Keep feed dry and check for ammonia buildup in deep litter.');
            else tips.push('Favorable weather. Good time for vaccinations, deworming, and cleaning waterers.');
          }
          return tips.slice(0, 2).join(' ');
        }}
      />

      {/* =================== MODALS =================== */}
      <DetailModal open={modal === 'mortality'} onClose={closeModal}
        title="Mortality Log" subtitle={`${deadBirdsCount} dead · ${mortalityRatePercent.toFixed(1)}% mortality rate`}
        icon={<HeartPulse className="w-5 h-5" />} iconBg="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" size="big">
        {deadBirds.length === 0 ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400 text-center py-8">✓ No deaths recorded — flock is healthy.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2 pr-3 font-semibold uppercase text-[10px]">{L('Bird')}</th>
                  <th className="py-2 pr-3 font-semibold uppercase text-[10px]">{L('Breed/Gender')}</th>
                  <th className="py-2 pr-3 font-semibold uppercase text-[10px]">{L('Date Died')}</th>
                  <th className="py-2 pr-3 font-semibold uppercase text-[10px]">{L('Reason')}</th>
                  <th className="py-2 font-semibold uppercase text-[10px]">{L('Detail')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {deadBirds.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => openBirdDetail(b, 'mortality')}>
                    <td className="py-2 pr-3 font-semibold text-slate-800 dark:text-slate-100">{b.name}</td>
                    <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{breedLabel(b)} · {b.gender}</td>
                    <td className="py-2 pr-3 font-mono text-slate-500 dark:text-slate-400">{b.dateDied || '—'}</td>
                    <td className="py-2 pr-3"><span className="px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-[10px] font-bold">{deathReasonLabel(b.deathReason)}</span></td>
                    <td className="py-2 text-slate-500 dark:text-slate-400">{b.deathDetail || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-4 text-xs">
          <Stat label="Total dead" value={`${deadBirdsCount}`} />
          <Stat label="Total flock" value={`${totalBirdsCount}`} />
          <Stat label="Mortality rate" value={`${mortalityRatePercent.toFixed(1)}%`} />
          <Stat label="Sold birds" value={`${soldBirdsCount}`} />
        </div>
      </DetailModal>

      <DetailModal open={modal === 'deficit'} onClose={closeModal}
        title="Financial Deficit" subtitle={`Current shortfall: ${formatRs(Math.abs(netProfitLoss))}`}
        icon={<AlertTriangle className="w-5 h-5" />} iconBg="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
        <div className="grid grid-cols-2 gap-3 mb-5">
          <MiniStat label={L('Total Income')} value={formatRs(totalIncome)} color="emerald" />
          <MiniStat label={L('Total Expenses')} value={formatRs(totalExpense)} color="rose" />
          <MiniStat label={L('Net Loss')} value={formatRs(Math.abs(netProfitLoss))} color="rose" />
          <MiniStat label="ROI" value={`${roiPercent.toFixed(1)}%`} color="rose" />
        </div>
        <h4 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2">{L('Expense breakdown')}</h4>
        <div className="space-y-2 text-xs">
          <BarRow label={L('Birds')} value={totalBirdPurchaseCost} total={totalExpense} color="bg-sky-500" />
          <BarRow label={L('Feed')} value={totalFeedCost} total={totalExpense} color="bg-amber-500" />
          <BarRow label={L('Vaccinations')} value={totalVaccCost} total={totalExpense} color="bg-teal-500" />
          <BarRow label={L('Other')} value={totalOtherCost} total={totalExpense} color="bg-rose-500" />
        </div>
        <h4 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mt-5 mb-2">{L('Largest expenses in range')}</h4>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {expenseLineItems.slice(0, 8).map((x, i) => (
            <div key={i} className="flex justify-between py-2 text-xs">
              <span className="truncate text-slate-700 dark:text-slate-200">{x.label}</span>
              <span className="text-slate-500 dark:text-slate-400 font-mono ml-3">{formatRs(x.amount)}</span>
            </div>
          ))}
        </div>
      </DetailModal>

      <DetailModal open={modal === 'vaccinations'} onClose={closeModal}
        title="Vaccination Reminders" subtitle={`${vaccinationReminders.length} bird${vaccinationReminders.length === 1 ? '' : 's'} need attention`}
        icon={<Syringe className="w-5 h-5" />} iconBg="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" size="small">
        <div className="space-y-2">
          {vaccinationReminders.map(({ bird, daysUntilDue }) => {
            const overdue = daysUntilDue === null || daysUntilDue < 0;
            return (
              <button key={bird.id} onClick={() => openBirdDetail(bird, 'vaccinations')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left hover:shadow-sm transition cursor-pointer ${overdue ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 hover:border-red-400' : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 hover:border-amber-400'}`}>
                <Syringe className={`w-5 h-5 shrink-0 ${overdue ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{bird.name} · {breedLabel(bird)}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Last: {bird.lastVaccinationDate || 'never'}</p>
                </div>
                <span className={`text-[10px] font-bold font-mono px-2 py-1 rounded ${overdue ? 'bg-red-600 text-white' : 'bg-amber-600 text-white'}`}>
                  {daysUntilDue === null ? 'NEVER' : daysUntilDue < 0 ? `OVERDUE ${Math.abs(daysUntilDue)}d` : daysUntilDue === 0 ? 'TODAY' : `IN ${daysUntilDue}d`}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={() => { closeModal(); onNavigate('health'); }} className="text-xs font-bold px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white">
            Go to Health Portal →
          </button>
        </div>
      </DetailModal>

      <DetailModal open={modal === 'feedRestock'} onClose={closeModal}
        title={L('Feed Restock')}
        subtitle={feedStockRemainingKg !== null ? `~${Math.round(feedStockRemainingKg)} kg remaining` : `${feedRestockReminders.length} feed type${feedRestockReminders.length === 1 ? '' : 's'} need attention`}
        icon={<Package className="w-5 h-5" />} iconBg="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
        {feedStockRemainingKg !== null ? (
          <div className="p-3 mb-3 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Estimated ~{Math.round(feedStockRemainingKg)} kg of feed left — about {feedDaysRemaining} day{feedDaysRemaining === 1 ? '' : 's'} of supply at ~{feedConsumptionRate} kg/day.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Estimated from total purchased minus the consumption rate set in Admin → General. Update that rate if it's off.
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            No feed consumption rate is set, so stock can't be estimated — these feed types just haven't been purchased in {settings.feedLowStockDays ?? 14}+ days. Set a consumption rate in Admin → General for a real stock estimate.
          </p>
        )}
        <div className="space-y-2">
          {feedRestockReminders.map(r => (
            <div key={r.type} className="flex items-center gap-3 p-3 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900">
              <Package className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{r.type}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Last purchase: {r.lastDate} · {r.daysSince} days ago</p>
              </div>
              <span className="text-[10px] font-bold font-mono px-2 py-1 rounded bg-orange-600 text-white">{L('RESTOCK')}</span>
            </div>
          ))}
          {feedStockRemainingKg !== null && feedRestockReminders.length === 0 && (
            <p className="text-xs text-slate-400 dark:text-slate-500">No individual feed type has gone quiet for {settings.feedLowStockDays ?? 14}+ days, but total estimated stock is running low.</p>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => { closeModal(); openQuickAction('feed'); }} className="text-xs font-bold px-4 py-2 rounded-lg bg-farm-600 hover:bg-farm-700 text-white">{L('Log Feed Purchase')}</button>
          <button onClick={() => { closeModal(); onNavigate('ledger'); }} className="text-xs font-bold px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200">{L('Go to Ledger')}</button>
        </div>
      </DetailModal>

      <DetailModal open={modal === 'income'} onClose={closeModal}
        title="Total Income Breakdown" subtitle={`${formatRs(totalIncome)} · ${rangeLabel}`}
        icon={<Coins className="w-5 h-5" />} iconBg="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" size="small">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          <MiniStat label={L('Egg income')} value={formatRs(eggIncome)} color="emerald" />
          <MiniStat label={L('Bird sale income')} value={formatRs(birdIncome)} color="emerald" />
          <MiniStat label={L('Credit sales')} value={formatRs(customerIncome)} color="emerald" />
        </div>
        {outstanding > 0 && (
          <div className="mb-3 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-200">
            Outstanding customer receivables: <strong>{formatRs(outstanding)}</strong> (not yet received as cash)
          </div>
        )}
        <LineItemTable items={incomeLineItems} emptyMsg="No income recorded in this range." />
      </DetailModal>

      <DetailModal open={modal === 'expenses'} onClose={closeModal}
        title="Total Expenses Breakdown" subtitle={`${formatRs(totalExpense)} · ${rangeLabel}`}
        icon={<ShoppingBag className="w-5 h-5" />} iconBg="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" size="small">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <MiniStat label={L('Birds')} value={formatRs(totalBirdPurchaseCost)} color="sky" />
          <MiniStat label={L('Feed')} value={formatRs(totalFeedCost)} color="amber" />
          <MiniStat label={L('Vaccinations')} value={formatRs(totalVaccCost)} color="teal" />
          <MiniStat label={L('Other')} value={formatRs(totalOtherCost)} color="rose" />
        </div>
        <LineItemTable items={expenseLineItems} emptyMsg="No expenses recorded in this range." />
      </DetailModal>

      <DetailModal open={modal === 'net'} onClose={closeModal}
        title="Net Profit / Loss" subtitle={`${netProfitLoss >= 0 ? 'Profitable' : 'Running at a loss'} · ${rangeLabel}`}
        icon={netProfitLoss >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
        iconBg={netProfitLoss >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'}>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <MiniStat label={L('Income')} value={formatRs(totalIncome)} color="emerald" />
          <MiniStat label={L('Expenses')} value={formatRs(totalExpense)} color="rose" />
          <MiniStat label="Net" value={`${netProfitLoss >= 0 ? '+' : '-'}${formatRs(Math.abs(netProfitLoss))}`} color={netProfitLoss >= 0 ? 'emerald' : 'rose'} />
          <MiniStat label="ROI" value={`${roiPercent.toFixed(1)}%`} color={roiPercent >= 0 ? 'emerald' : 'rose'} />
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
          <strong>Net = Income − Expenses.</strong> ROI is Net / Expenses × 100. Negative ROI means you have spent more than you have earned in this period.
        </div>
      </DetailModal>

      <DetailModal open={modal === 'roi'} onClose={closeModal}
        title="Return on Investment" subtitle={`${roiPercent.toFixed(1)}% · ${rangeLabel}`}
        icon={<Percent className="w-5 h-5" />} iconBg="bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
        <div className="text-center py-6">
          <div className={`text-5xl font-black font-mono ${roiPercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{roiPercent.toFixed(1)}%</div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            {roiPercent >= 0 ? 'Profitable return' : 'Negative return — expenses exceed income'}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MiniStat label={L('Investment')} value={formatRs(totalExpense)} color="violet" />
          <MiniStat label={L('Net return')} value={formatRs(netProfitLoss)} color={netProfitLoss >= 0 ? 'emerald' : 'rose'} />
        </div>
      </DetailModal>

      {(() => {
        const maleCount = activeBirds.filter(b => b.gender === 'Male').length;
        const femaleCount = activeBirds.filter(b => b.gender === 'Female').length;
        const inactiveShown = deadBirdsCount + soldBirdsCount;
        const shownBirds =
          activeFlockFilter === 'male'     ? activeBirds.filter(b => b.gender === 'Male') :
          activeFlockFilter === 'female'   ? activeBirds.filter(b => b.gender === 'Female') :
          activeFlockFilter === 'inactive' ? [...deadBirds, ...birds.filter(b => b.status === 'Sold')] :
          activeBirds;
        const chip = (id: typeof activeFlockFilter, label: string, value: string | number) => (
          <button key={id} type="button" onClick={() => setActiveFlockFilter(id)} aria-pressed={activeFlockFilter === id}
            className={`muf-segmented-nav-button ${activeFlockFilter === id ? 'is-active' : ''}`}>
            <span>{label}</span><span className="muf-segmented-nav-count">{value}</span>
          </button>
        );
        return (
          <DetailModal open={modal === 'activeBirds'} onClose={closeModal}
            title="Active Flock" subtitle={`${rangeLabel}`}
            icon={<Activity className="w-5 h-5" />} iconBg="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" size="big">
            <nav className="muf-segmented-nav mb-5" aria-label={L('Filter birds')}>
              {chip('all', L('In Flock'), activeBirdsCount)}
              {chip('male', L('Males'), maleCount)}
              {chip('female', L('Females'), femaleCount)}
              {chip('inactive', L('Dead/Sold'), inactiveShown)}
            </nav>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2 pr-3 font-semibold uppercase text-[10px]">{L('Name')}</th>
                    <th className="py-2 pr-3 font-semibold uppercase text-[10px]">{L('Breed')}</th>
                    <th className="py-2 pr-3 font-semibold uppercase text-[10px]">{L('Gender')}</th>
                    <th className="py-2 pr-3 font-semibold uppercase text-[10px]">{L('Status')}</th>
                    <th className="py-2 pr-3 font-semibold uppercase text-[10px]">{L('Age')}</th>
                    <th className="py-2 pr-3 font-semibold uppercase text-[10px]">{L('Bought')}</th>
                    <th className="py-2 font-semibold uppercase text-[10px]">{L('Last Vax')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {shownBirds.map(b => (
                    <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => openBirdDetail(b, 'activeBirds')}>
                      <td className="py-2 pr-3 font-semibold text-slate-800 dark:text-slate-100">{b.name}</td>
                      <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{breedLabel(b)}</td>
                      <td className="py-2 pr-3">{b.gender === 'Male' ? '♂' : '♀'}</td>
                      <td className="py-2 pr-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          b.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' :
                          b.status === 'Sick'   ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' :
                          b.status === 'Sold'   ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200' :
                          'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        }`}>{b.status}</span>
                      </td>
                      <td className="py-2 pr-3 font-mono text-slate-600 dark:text-slate-300">{birdAge(b)}</td>
                      <td className="py-2 pr-3 font-mono text-slate-500 dark:text-slate-400">{b.dateBought}</td>
                      <td className="py-2 font-mono text-slate-500 dark:text-slate-400">{b.lastVaccinationDate || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DetailModal>
        );
      })()}

      <DetailModal open={modal === 'totalEggs'} onClose={closeModal}
        title="Total Eggs Collected" subtitle={`${totalEggsCollected} eggs over ${uniqueDaysCount} day${uniqueDaysCount === 1 ? '' : 's'} · ${rangeLabel}`}
        icon={<Egg className="w-5 h-5" />} iconBg="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" size="big">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <MiniStat label="Collected" value={`${totalEggsCollected}`} color="amber" />
          <MiniStat label="Sold" value={`${eggsSold}`} color="emerald" />
          <MiniStat label="Home use" value={`${eggsHome}`} color="slate" />
          <MiniStat label="Broken/waste" value={`${eggsBroken}`} color="rose" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 pr-3 font-semibold uppercase text-[10px]">{L('Date')}</th>
                <th className="py-2 pr-3 font-semibold uppercase text-[10px]">{L('Collected')}</th>
                <th className="py-2 pr-3 font-semibold uppercase text-[10px]">{L('Sold')}</th>
                <th className="py-2 pr-3 font-semibold uppercase text-[10px]">{L('Home')}</th>
                <th className="py-2 font-semibold uppercase text-[10px]">{L('Broken')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {[...rangedEggs].sort((a, b) => b.date.localeCompare(a.date)).map(e => (
                <tr key={e.date}>
                  <td className="py-2 pr-3 font-mono text-slate-700 dark:text-slate-200">{e.date}</td>
                  <td className="py-2 pr-3 font-bold">{e.totalEggsCollected}</td>
                  <td className="py-2 pr-3 text-emerald-600 dark:text-emerald-400">{e.sold}</td>
                  <td className="py-2 pr-3 text-slate-500 dark:text-slate-400">{e.homeUse || 0}</td>
                  <td className="py-2 text-rose-500">{e.brokenWasted || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DetailModal>

      <DetailModal open={modal === 'eggEfficiency'} onClose={closeModal}
        title="Egg Production Efficiency" subtitle={`${avgEggsPerHenPerDay.toFixed(2)} eggs/hen/day · ${rangeLabel}`}
        icon={<Egg className="w-5 h-5" />} iconBg="bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
        <div className="text-center py-4">
          <div className="text-5xl font-black font-mono text-teal-600 dark:text-teal-400">{avgEggsPerHenPerDay.toFixed(2)}</div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">eggs per hen per day</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MiniStat label="Active females" value={`${rangedActiveFemaleCount}`} color="teal" />
          <MiniStat label="Total eggs" value={`${totalEggsCollected}`} color="amber" />
          <MiniStat label="Days logged" value={`${uniqueDaysCount}`} color="slate" />
          <MiniStat label="Eggs/day" value={`${uniqueDaysCount > 0 ? Math.round(totalEggsCollected / uniqueDaysCount) : 0}`} color="teal" />
        </div>
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
          Healthy production rate is around 0.7–0.9 eggs per hen per day for commercial layers.
        </p>
      </DetailModal>

      <DetailModal open={modal === 'costEgg'} onClose={closeModal}
        title="Cost Per Egg" subtitle={`${formatRs(costPerEggValue)} · ${rangeLabel}`}
        icon={<Coins className="w-5 h-5" />} iconBg="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
        <div className="text-center py-4">
          <div className="text-5xl font-black font-mono text-orange-600 dark:text-orange-400">{formatRs(costPerEggValue)}</div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">cost to produce 1 egg</p>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <MiniStat label={L('Sale price')} value={formatRs(settings.defaultPricePerEgg)} color={costPerEggValue <= settings.defaultPricePerEgg ? 'emerald' : 'rose'} />
          <MiniStat label={L('Margin/egg')} value={formatRs(settings.defaultPricePerEgg - costPerEggValue)} color={settings.defaultPricePerEgg >= costPerEggValue ? 'emerald' : 'rose'} />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
          All-in cost per egg = (bird purchases + feed + other ops + vaccinations) ÷ total eggs collected in range.
          {costPerEggValue > settings.defaultPricePerEgg && ' ⚠ All-in cost exceeds default sale price — this is normal early on (bird purchases are capex). Look at monthly trends before reacting.'}
        </p>
      </DetailModal>

      <DetailModal open={modal === 'costBird'} onClose={closeModal}
        title="Cost Per Bird" subtitle={`${formatRs(costPerBirdValue)} · ${rangeLabel}`}
        icon={<DollarSign className="w-5 h-5" />} iconBg="bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300">
        <div className="text-center py-4">
          <div className="text-5xl font-black font-mono text-fuchsia-600 dark:text-fuchsia-400">{formatRs(costPerBirdValue)}</div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">cost per active bird</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MiniStat label="Active birds" value={`${activeBirdsCount}`} color="slate" />
          <MiniStat label={L('Total cost')} value={formatRs(totalExpense)} color="fuchsia" />
        </div>
      </DetailModal>

      <DetailModal open={modal === 'feedPerBird'} onClose={closeModal}
        title="Feed Per Bird (This Month)" subtitle={`${feedKgPerBird.toFixed(1)} kg/bird · ${monthPrefix}`}
        icon={<Package className="w-5 h-5" />} iconBg="bg-lime-100 text-lime-700 dark:bg-lime-950 dark:text-lime-300">
        <div className="text-center py-4">
          <div className="text-5xl font-black font-mono text-lime-600 dark:text-lime-400">{feedKgPerBird.toFixed(1)}<span className="text-2xl text-lime-500"> kg</span></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MiniStat label="Active birds" value={`${activeBirdsCount}`} color="slate" />
          <MiniStat label="Feed this month" value={`${feedKgThisMonth} kg`} color="lime" />
        </div>
      </DetailModal>

      {(['feedToday', 'feedWeek', 'feedMonth'] as const).map((key) => {
        const cfg = {
          feedToday: { title: L('Feed Purchased Today'), icon: <Package className="w-5 h-5" />, bg: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300', value: feedKgToday, records: feedRecords.filter(f => f.date === today), sub: today },
          feedWeek: { title: 'Feed Purchased This Week', icon: <Package className="w-5 h-5" />, bg: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300', value: feedKgThisWeek, records: feedRecords.filter(f => f.date >= weekStart), sub: `${weekStart} → ${today}` },
          feedMonth: { title: L('Feed Purchased This Month'), icon: <Package className="w-5 h-5" />, bg: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300', value: feedKgThisMonth, records: feedRecords.filter(f => f.date.startsWith(monthPrefix)), sub: monthPrefix },
        }[key];
        const kgTotal = cfg.records.reduce((s, f) => s + f.quantityKg, 0);
        const rsTotal = cfg.records.reduce((s, f) => s + f.quantityKg * f.rateRsPerKg, 0);
        return (
          <React.Fragment key={key}>
          <DetailModal open={modal === key} onClose={closeModal} title={cfg.title} subtitle={`${cfg.value} kg · ${cfg.sub}`}
            icon={cfg.icon} iconBg={cfg.bg} size="big">
            <div className="grid grid-cols-2 gap-3 mb-5">
              <MiniStat label="Total weight" value={`${kgTotal} kg`} color="slate" />
              <MiniStat label={L('Total cost')} value={formatRs(rsTotal)} color="emerald" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2 pr-3 font-semibold uppercase text-[10px]">{L('Date')}</th>
                    <th className="py-2 pr-3 font-semibold uppercase text-[10px]">{L('Type')}</th>
                    <th className="py-2 pr-3 font-semibold uppercase text-[10px]">{L('Qty (kg)')}</th>
                    <th className="py-2 pr-3 font-semibold uppercase text-[10px]">{L('Rate/kg')}</th>
                    <th className="py-2 font-semibold uppercase text-[10px]">{L('Total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {[...cfg.records].sort((a, b) => b.date.localeCompare(a.date)).map((f, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-3 font-mono text-slate-700 dark:text-slate-200">{f.date}</td>
                      <td className="py-2 pr-3">{f.feedType}</td>
                      <td className="py-2 pr-3 font-bold">{f.quantityKg}</td>
                      <td className="py-2 pr-3 font-mono text-slate-500 dark:text-slate-400">{formatRs(f.rateRsPerKg)}</td>
                      <td className="py-2 font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatRs(f.quantityKg * f.rateRsPerKg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DetailModal>
          </React.Fragment>
        );
      })}

      {/* Sick birds alert modal */}
      <DetailModal open={modal === 'sickBirds'} onClose={closeModal}
        title="Sick Birds" subtitle={`${sickBirdsCount} bird${sickBirdsCount === 1 ? '' : 's'} need care`}
        icon={<HeartPulse className="w-5 h-5" />} iconBg="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" size="small">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {sickBirds.map(b => (
            <button key={b.id} onClick={() => openBirdDetail(b, 'sickBirds')}
              className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 hover:border-red-400 rounded-xl transition text-left cursor-pointer">
              <BirdAvatar bird={b} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-red-900 dark:text-red-200 truncate">{b.name}</p>
                <p className="text-2xs text-red-700 dark:text-red-400 font-mono">{breedLabel(b)} · {b.gender} · {birdAge(b)}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => { closeModal(); onNavigate('health'); }} className="text-xs font-bold px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white">Go to Health Portal →</button>
        </div>
      </DetailModal>

      {/* Shared rich MUF bird details, matching the Birds register popup. */}
      {(() => {
        const b = selectedBird;
        if (!b) return null;
        const isBack = !!parentModal;
        const detailVaccinations = [...vaccinations.filter((record) => record.birdId === b.id)].sort((a, next) => next.date.localeCompare(a.date));
        return <DetailModal open={modal === 'birdDetail'} onClose={closeModal} onBack={isBack ? closeBirdDetail : undefined}
          backLabel="Back" title={b.name} subtitle={`${breedLabel(b)} · ${b.gender} · ${birdAge(b)} old`}
          icon={<BirdAvatar bird={b} size="sm" showBadge={false} />} iconBg="" size="big">
          <BirdDetailContent bird={b} detailVaccinations={detailVaccinations} vaccinationIntervalDays={settings.vaccinationIntervalDays} lang={lang}
            canEdit canDelete={false} onEdit={() => { closeModal(); onNavigate('flock', { editBirdId: b.id }); }} />
        </DetailModal>;
      })()}

      {/* Quick Actions FAB */}
      <MufFab actions={[
        { icon: <Egg size={18} />, label: L('Add Egg Log'), onClick: () => onNavigate('ledger') },
        { icon: <ShoppingBag size={18} />, label: L('Add Expense'), onClick: () => onNavigate('ledger') },
        { icon: <Syringe size={18} />, label: L('Add Vaccination'), onClick: () => onNavigate('health') },
      ]} />
    </div>
  );
}

// ----- Small sub-components -----

// StaggerItem — per-card staggered fade-up (dairy-style)
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

// StatCard — vertical card with emerald icon, decorative blob, profit/loss tinting (dairy-style)
interface StatCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  trend?: number;
  trendUnit?: string;
  subText?: string;
  isNegative?: boolean;
  isProfit?: boolean;
}

function StatCard({ label, value, icon: Icon, trend, trendUnit = '', subText, isNegative, isProfit }: StatCardProps) {
  const isPositive = trend && trend > 0;
  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={cardSpring}
      className={`group relative overflow-hidden rounded-2xl border bg-white/90 dark:bg-[#0d1a11]/90 p-4 shadow-sm backdrop-blur transition-colors duration-200 hover:shadow-xl ${
      isProfit === true ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/10' :
      isProfit === false ? 'border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-900/10' :
      'border-slate-200 dark:border-[#203528] hover:border-emerald-300 dark:hover:border-emerald-700'
    }`}>
      <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-emerald-500/10 transition-transform duration-300 group-hover:scale-125" />
      <Eye className="absolute right-3 bottom-3 w-3.5 h-3.5 text-emerald-500/70 opacity-0 group-hover:opacity-100 transition" />
      <div className="relative flex justify-between items-start mb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
        <motion.div
          whileHover={{ rotate: -6, scale: 1.06 }}
          transition={wobbleSpring}
          className="rounded-xl bg-emerald-50 dark:bg-emerald-900/30 p-2 text-emerald-600 dark:text-emerald-300"
        >
          <Icon className="w-4 h-4" />
        </motion.div>
      </div>
      <div className="relative">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`font-display text-2xl font-bold ${isNegative ? 'text-red-600 dark:text-red-400' : isProfit === true ? 'text-emerald-700 dark:text-emerald-400' : isProfit === false ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}><MufCountUpText text={String(value)} /></span>
          {trend !== undefined && trend !== 0 && (
            <div className={`flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${isPositive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'}`}>
              {isPositive ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
              {Math.abs(trend)}{trendUnit}
            </div>
          )}
        </div>
        {subText && <p className="text-[11px] text-slate-400 mt-1">{subText}</p>}
      </div>
    </motion.div>
  );
}

// Stagger helper — tiny wrapper that delays children based on their index
function Stagger({ index = 0, baseDelay = 0.035, children }: { index?: number; baseDelay?: number; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * baseDelay, ease: 'easeOut' }}
      className="contents"
    >
      {children}
    </motion.div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: 'emerald' | 'rose' | 'sky' | 'amber' | 'violet' | 'fuchsia' | 'teal' | 'lime' | 'orange' | 'green' | 'indigo' | 'slate' }) {
  const bg = {
    emerald: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
    rose: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300',
    sky: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300',
    amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
    violet: 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300',
    fuchsia: 'bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-700 dark:text-fuchsia-300',
    teal: 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300',
    lime: 'bg-lime-50 dark:bg-lime-950/40 text-lime-700 dark:text-lime-300',
    orange: 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300',
    green: 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300',
    indigo: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300',
    slate: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
  }[color];
  return (
    <div className={`p-3 rounded-xl ${bg}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</p>
      <p className="text-sm sm:text-base font-bold font-mono mt-1 truncate">{value}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">{label}</p>
      <p className="text-sm font-bold font-mono text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700">
      <p className="text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 font-mono truncate mt-0.5">{value}</p>
    </div>
  );
}

function BarRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-medium text-slate-600 dark:text-slate-300">{label}</span>
        <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{formatRs(value)} ({pct.toFixed(0)}%)</span>
      </div>
      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function LineItemTable({ items, emptyMsg }: { items: { date: string; label: string; amount: number }[]; emptyMsg: string }) {
  if (items.length === 0) return <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">{emptyMsg}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
            <th className="py-2 pr-3 font-semibold uppercase text-[10px]">{L('Date')}</th>
            <th className="py-2 pr-3 font-semibold uppercase text-[10px]">{L('Description')}</th>
            <th className="py-2 text-right font-semibold uppercase text-[10px]">{L('Amount')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {items.map((x, i) => (
            <tr key={i}>
              <td className="py-2 pr-3 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">{x.date}</td>
              <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">{x.label}</td>
              <td className="py-2 text-right font-mono font-bold text-slate-800 dark:text-slate-100">{formatRs(x.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
