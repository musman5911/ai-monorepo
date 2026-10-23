import { useState, useEffect, useMemo, useCallback } from 'react';
import MufFarmSwitcher from './muf/ui/muf-farm-switcher';
import { Home, HardHat, Bird as BirdIcon, BarChart2, Egg, Shield, LogOut, Package, ChevronDown, Bell, Moon, Sun, Users, HeartPulse, BookOpen, Languages } from 'lucide-react';
import { motion } from './muf/core/muf-motion';

import {
  INITIAL_SETTINGS,
  INITIAL_BIRDS,
  INITIAL_EXPENSES,
  INITIAL_FEED_RECORDS,
  INITIAL_EGG_PRODUCTION,
  INITIAL_VACCINATIONS,
  INITIAL_CUSTOMERS,
  INITIAL_CUSTOMER_SALES,
  INITIAL_INCUBATION,
} from './initialData';

import {
  Bird,
  OtherExpense,
  LaborWorker,
  LaborAttendanceEntry,
  LaborAdvanceEntry,
  FeedRecord,
  EggProduction,
  GlobalSettings,
  VaccinationRecord,
  Customer,
  CustomerSale,
  IncubationRecord,
  DailyChecklistEntry,
  DiaryEntry,
  UserRole,
  Lang,
  DateRange,
} from './types';

import Dashboard from './components/Dashboard';
import { SuperAdminTab } from "./components/SuperAdminTab";
import FlockRegister from './components/FlockRegister';
import FinancialLedger from './components/FinancialLedger';
import HealthPortal from './components/HealthPortal';
import BatchHealthPortal from './components/BatchHealthPortal';
import BatchSummaryPortal from './components/BatchSummaryPortal';
import MonthlySummary from './components/MonthlySummary';
import IncubationModule from './components/IncubationModule';
import DailyChecklist from './components/DailyChecklist';
import MufDiary, { type MufDiaryEntry } from './muf/ui/muf-diary';
import BatchesTab from './components/BatchesTab';
import LaborTab from './components/LaborTab';
import HeaderSearch from './muf/ui/muf-header-search';
import OfflineBanner from './muf/core/muf-offline-banner';
import { hideMufSplash, initMufPullToRefresh, MufWhatsNew } from './muf/core/muf-applike';
import AdminMenu from './components/AdminMenu';
import LoginScreen from './components/LoginScreen';
import SyncIndicator from './components/SyncIndicator';
import DetailModal from './muf/core/muf-modal';
import { useConfirm, notify } from './muf/core/muf-confirm';
import { loadData, getToken, getStoredUser, fetchMe, logout as apiLogout, AuthUser, importAllBatchData, wipeAllBatchData, syncOfflineBuckets, offlineBucketCount, saveData, uploadImage } from './api';
import type { FlockFarmBackup } from './reportExport';
import { useDebouncedSave, mergeSyncStatus } from './hooks/useDebouncedSave';
import { t, L, getLang, setCurrentLang } from './i18n';
import { todayStr, monthStartStr, daysAgoStr, diffDateOnlyDays, feedStockKg } from './utils/calculations';
import { MyProfileContent } from './components/MyProfileContent';

function nextId<T extends { id: number }>(items: T[]): number {
  return items.length > 0 ? Math.max(...items.map((i) => i.id)) + 1 : 1;
}

const EMPTY_SETTINGS: GlobalSettings = {
  defaultPricePerEgg: 25,
  vaccinationIntervalDays: 30,
  feedLowStockDays: 14,
  feedConsumptionKgPerDay: 2,
};

export default function App() {
  const confirmAction = useConfirm();
  const [activeTab, setActiveTab] = useState<string>('batches');

  const [isDark, setIsDark] = useState<boolean>(() => localStorage.getItem('flockfarm_dark_mode') === 'true');
  const [lang, setLang] = useState<Lang>(() => getLang());

  // muf-applike: fade out the boot splash + enable pull-to-refresh on phones
  useEffect(() => {
    hideMufSplash();
    return initMufPullToRefresh();
  }, []);

  // ── Offline mode: queued bucket saves replay automatically on reconnect ──
  useEffect(() => {
    const onQueued = () => {
      notify(L('📶 Offline: saved on this device — will sync when internet returns'), 'info');
    };
    const onBackOnline = async () => {
      if (offlineBucketCount() === 0) return;
      const [ok, failed] = await syncOfflineBuckets();
      if (ok > 0) notify(ok === 1 ? L('✅ Back online — {ok} offline change synced', { ok }) : L('✅ Back online — {ok} offline changes synced', { ok }), 'success');
      if (failed > 0) notify(failed === 1 ? L('⚠️ {failed} change failed — will retry', { failed }) : L('⚠️ {failed} changes failed — will retry', { failed }), 'error');
    };
    window.addEventListener('flockfarm:offline-queued', onQueued);
    window.addEventListener('online', onBackOnline);
    if (navigator.onLine) onBackOnline();
    return () => {
      window.removeEventListener('flockfarm:offline-queued', onQueued);
      window.removeEventListener('online', onBackOnline);
    };
  }, [lang]);

  // Auth state: null = verifying token, false = logged out, object = logged-in user
  const [currentUser, setCurrentUser] = useState<AuthUser | null | false>(null);

  const [dateRange, setDateRange] = useState<DateRange | null>(() => ({ from: monthStartStr(), to: todayStr() }));
  const [rangeFrom, setRangeFrom] = useState(monthStartStr());
  const [rangeTo, setRangeTo] = useState(todayStr());

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('flockfarm_dark_mode', String(isDark));
  }, [isDark]);

  useEffect(() => {
    setCurrentLang(lang);
    document.documentElement.lang = lang === 'ur' ? 'ur' : 'en';
  }, [lang]);

  // On mount: if a JWT exists, verify it against /api/auth/me to establish the session
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = getToken();
      if (!token) {
        if (!cancelled) setCurrentUser(false);
        return;
      }
      const u = await fetchMe();
      if (!cancelled) setCurrentUser(u ?? false);
    })();
    const onExpired = () => setCurrentUser(false);
    window.addEventListener('flockfarm:auth-expired', onExpired);
    // Another user saved data we were editing (server returned 409):
    // reload everything fresh so both sides converge instead of overwriting.
    const onConflict = () => setLoadVersion((v) => v + 1);
    window.addEventListener('flockfarm:data-conflict', onConflict);
    return () => {
      cancelled = true;
      window.removeEventListener('flockfarm:auth-expired', onExpired);
      window.removeEventListener('flockfarm:data-conflict', onConflict);
    };
  }, []);

  const handleLoginSuccess = useCallback(() => {
    const u = getStoredUser();
    setCurrentUser(u ?? false);
    setActiveTab('batches');
    setLoadError(null);
    setIsLoaded(false);
  }, []);

  const handleLogout = useCallback(async () => {
    await apiLogout();
    setCurrentUser(false);
    setLoadError(null);
    setIsLoaded(false);
  }, []);

  const role: UserRole = currentUser && typeof currentUser === 'object' ? currentUser.role : 'worker';

  const [birds, setBirds] = useState<Bird[]>([]);
  const [otherExpenses, setOtherExpenses] = useState<OtherExpense[]>([]);
  const [feedRecords, setFeedRecords] = useState<FeedRecord[]>([]);
  const [eggProduction, setEggProduction] = useState<EggProduction[]>([]);
  const [settings, setSettings] = useState<GlobalSettings>(EMPTY_SETTINGS);
  const [vaccinations, setVaccinations] = useState<VaccinationRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSales, setCustomerSales] = useState<CustomerSale[]>([]);
  const [incubation, setIncubation] = useState<IncubationRecord[]>([]);
  const [checklist, setChecklist] = useState<DailyChecklistEntry[]>([]);
  const [diary, setDiary] = useState<DiaryEntry[]>([]);
  const [laborers, setLaborers] = useState<LaborWorker[]>([]);
  const [laborAttendance, setLaborAttendance] = useState<LaborAttendanceEntry[]>([]);
  const [laborAdvances, setLaborAdvances] = useState<LaborAdvanceEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadVersion, setLoadVersion] = useState(0);

  // Load data only after a successful login.
  // Missing datastore docs now load as blank/default values; actual network/server
  // failures show an error state instead of silently swapping in demo data.
  useEffect(() => {
    if (currentUser === null || currentUser === false) return; // verifying or logged out
    let cancelled = false;
    setIsLoaded(false);
    setLoadError(null);
    (async () => {
      try {
        const [
          b, e, f, eg, s, vac, cust, cs, inc, chk, dia, lw, la, lv,
        ] = await Promise.all([
          loadData<Bird[]>('birds', []),
          loadData<OtherExpense[]>('expenses', []),
          loadData<FeedRecord[]>('feed', []),
          loadData<EggProduction[]>('eggs', []),
          loadData<GlobalSettings>('settings', EMPTY_SETTINGS),
          loadData<VaccinationRecord[]>('vaccinations', []),
          loadData<Customer[]>('customers', []),
          loadData<CustomerSale[]>('customerSales', []),
          loadData<IncubationRecord[]>('incubation', []),
          loadData<DailyChecklistEntry[]>('checklist', []),
          loadData<DiaryEntry[]>('diary', []),
          loadData<LaborWorker[]>('laborers', []),
          loadData<LaborAttendanceEntry[]>('laborAttendance', []),
          loadData<LaborAdvanceEntry[]>('laborAdvances', []),
        ]);
        if (cancelled) return;
        setBirds(b);
        setOtherExpenses(e);
        setFeedRecords(f);
        setEggProduction(eg);
        setSettings(s);
        setVaccinations(vac);
        setCustomers(cust);
        setCustomerSales(cs);
        setIncubation(inc);
        setChecklist(chk);
        setDiary(dia);
        setLaborers(lw);
        setLaborAttendance(la);
        setLaborAdvances(lv);
        setLoadError(null);
        setIsLoaded(true);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load farm data';
        setLoadError(message);
        setIsLoaded(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser, loadVersion]);

  const savesEnabled = !!currentUser && isLoaded;
  const sBirds = useDebouncedSave('birds', birds, savesEnabled);
  const sExpenses = useDebouncedSave('expenses', otherExpenses, savesEnabled);
  const sFeed = useDebouncedSave('feed', feedRecords, savesEnabled);
  const sEggs = useDebouncedSave('eggs', eggProduction, savesEnabled);
  const sSettings = useDebouncedSave('settings', settings, savesEnabled);
  const sVaccinations = useDebouncedSave('vaccinations', vaccinations, savesEnabled);
  const sCustomers = useDebouncedSave('customers', customers, savesEnabled);
  const sCustomerSales = useDebouncedSave('customerSales', customerSales, savesEnabled);
  const sIncubation = useDebouncedSave('incubation', incubation, savesEnabled);
  const sChecklist = useDebouncedSave('checklist', checklist, savesEnabled);
  const sDiary = useDebouncedSave('diary', diary, savesEnabled);
  // Labor buckets are admin-only on the server; never try to save them as a worker.
  const laborSavesEnabled = savesEnabled && !!currentUser && typeof currentUser === 'object' && currentUser.role === 'admin';
  const sLaborers = useDebouncedSave('laborers', laborers, laborSavesEnabled);
  const sLaborAttendance = useDebouncedSave('laborAttendance', laborAttendance, laborSavesEnabled);
  const sLaborAdvances = useDebouncedSave('laborAdvances', laborAdvances, laborSavesEnabled);

  const syncStatus = mergeSyncStatus([
    sBirds, sExpenses, sFeed, sEggs, sSettings,
    sVaccinations, sCustomers, sCustomerSales, sIncubation, sChecklist, sDiary,
    sLaborers, sLaborAttendance, sLaborAdvances,
  ]);

  const isAdmin = role === 'admin';
  // Workers can add/edit daily-log records but cannot delete or manage structural data
  const canDelete = isAdmin;
  // Daily-log modules (feed, eggs, expenses, vaccinations, sales, incubation,
  // checklist, diary, health updates): allowed for both admin and worker.
  const canLogDaily = !!currentUser;
  // Structural modules (add/delete birds, customers, settings): admin only.
  const canManageStructure = isAdmin;

  const handleDatePreset = (preset: 'all' | 'month' | '30d') => {
    if (preset === 'all') {
      setDateRange(null);
      setRangeFrom('2020-01-01');
      setRangeTo(todayStr());
    } else if (preset === 'month') {
      const from = monthStartStr();
      const to = todayStr();
      setDateRange({ from, to });
      setRangeFrom(from);
      setRangeTo(to);
    } else {
      const from = daysAgoStr(30);
      const to = todayStr();
      setDateRange({ from, to });
      setRangeFrom(from);
      setRangeTo(to);
    }
  };

  const effectiveRange = useMemo<DateRange | null>(() => {
    if (!dateRange) return null;
    return dateRange;
  }, [dateRange]);

  const handleResetDatabase = async () => {
    if (!canManageStructure) return;
    setBirds(INITIAL_BIRDS);
    setOtherExpenses(INITIAL_EXPENSES);
    setFeedRecords(INITIAL_FEED_RECORDS);
    setEggProduction(INITIAL_EGG_PRODUCTION);
    setSettings(INITIAL_SETTINGS);
    setVaccinations(INITIAL_VACCINATIONS);
    setCustomers(INITIAL_CUSTOMERS);
    setCustomerSales(INITIAL_CUSTOMER_SALES);
    setIncubation(INITIAL_INCUBATION);
    setChecklist([]);
    setDiary([]);
    await wipeAllBatchData();
  };

  const handleClearDatabase = async () => {
    if (!canManageStructure) return;
    setBirds([]);
    setOtherExpenses([]);
    setFeedRecords([]);
    setEggProduction([]);
    setSettings(EMPTY_SETTINGS);
    setVaccinations([]);
    setCustomers([]);
    setCustomerSales([]);
    setIncubation([]);
    setChecklist([]);
    setDiary([]);
    await wipeAllBatchData();
  };

  const handleRestoreBackup = async (data: FlockFarmBackup) => {
    if (!canManageStructure) return;
    if (data.birds) setBirds(data.birds);
    if (data.otherExpenses) setOtherExpenses(data.otherExpenses);
    if (data.feedRecords) setFeedRecords(data.feedRecords);
    if (data.eggProduction) setEggProduction(data.eggProduction);
    if (data.settings) setSettings(data.settings);
    if (data.vaccinations) setVaccinations(data.vaccinations);
    if (data.customers) setCustomers(data.customers);
    if (data.customerSales) setCustomerSales(data.customerSales);
    if (data.incubation) setIncubation(data.incubation);
    if (data.checklist) setChecklist(data.checklist);
    if (data.diary) setDiary(data.diary);
    if (data.laborers) setLaborers(data.laborers);
    if (data.laborAttendance) setLaborAttendance(data.laborAttendance);
    if (data.laborAdvances) setLaborAdvances(data.laborAdvances);
    if (data.batchData) {
      await importAllBatchData(data.batchData as any);
    } else {
      await wipeAllBatchData();
    }
  };

  const handleAddBird = (newBird: Omit<Bird, 'id'>) => {
    if (!canManageStructure) return;
    setBirds([...birds, { ...newBird, id: nextId(birds) }]);
    notify(L('Bird added successfully.'), 'success');
  };
  // Update bird is allowed for both (marking sick/dead/sold, updating vax)
  const handleUpdateBird = (id: number, updatedBird: Bird) => {
    if (!canLogDaily) return;
    setBirds(birds.map((b) => (b.id === id ? updatedBird : b)));
    notify(L('Bird updated successfully.'), 'success');
  };
  const handleDeleteBird = (id: number) => {
    if (!canDelete) return;
    setBirds((prev) => prev.filter((b) => b.id !== id));
    notify(L('Bird deleted successfully.'), 'success');
    setVaccinations((prev) => prev.filter((v) => v.birdId !== id));
  };

  const handleAddOtherExpense = (newExp: Omit<OtherExpense, 'id'>) => {
    if (!canLogDaily) return;
    setOtherExpenses([...otherExpenses, { ...newExp, id: nextId(otherExpenses) }]);
  };
  const handleUpdateOtherExpense = (id: number, exp: OtherExpense) => {
    if (!canLogDaily) return;
    setOtherExpenses(otherExpenses.map((o) => (o.id === id ? exp : o)));
  };
  const handleDeleteOtherExpense = (id: number) => {
    if (!canDelete) return;
    setOtherExpenses(otherExpenses.filter((o) => o.id !== id));
  };

  const handleAddFeedRecord = (newFeed: Omit<FeedRecord, 'id'>) => {
    if (!canLogDaily) return;
    setFeedRecords([...feedRecords, { ...newFeed, id: nextId(feedRecords) }]);
  };
  const handleUpdateFeedRecord = (id: number, feed: FeedRecord) => {
    if (!canLogDaily) return;
    setFeedRecords(feedRecords.map((f) => (f.id === id ? feed : f)));
  };
  const handleDeleteFeedRecord = (id: number) => {
    if (!canDelete) return;
    setFeedRecords(feedRecords.filter((f) => f.id !== id));
  };

  const handleAddEggRecord = (newEgg: EggProduction) => {
    if (!canLogDaily) return;
    const exists = eggProduction.some((ep) => ep.date === newEgg.date);
    if (exists) {
      setEggProduction(eggProduction.map((ep) => (ep.date === newEgg.date ? newEgg : ep)));
    } else {
      setEggProduction([...eggProduction, newEgg]);
    }
  };
  const handleUpdateEggRecord = (date: string, egg: EggProduction) => {
    if (!canLogDaily) return;
    setEggProduction(eggProduction.map((ep) => (ep.date === date ? egg : ep)));
  };
  const handleDeleteEggRecord = (date: string) => {
    if (!canDelete) return;
    setEggProduction(eggProduction.filter((ep) => ep.date !== date));
  };

  // Vaccinations: workers can add (treat birds), only admins delete
  const handleAddVaccination = (v: Omit<VaccinationRecord, 'id'>) => {
    if (!canLogDaily) return;
    const record = { ...v, id: nextId(vaccinations) };
    setVaccinations([...vaccinations, record]);
    setBirds(birds.map((b) => (b.id === v.birdId ? { ...b, lastVaccinationDate: v.date } : b)));
  }

  const handleUpdateVaccination = (id: number, v: Omit<VaccinationRecord, 'id'>) => {
    setVaccinations(vaccinations.map((x) => (x.id === id ? { ...v, id } : x)));
  };;
  const handleDeleteVaccination = (id: number) => {
    if (!canDelete) return;
    setVaccinations(vaccinations.filter((v) => v.id !== id));
  };

  // Customers: structural, admin only (add/edit/delete)
  const handleAddCustomer = (c: Omit<Customer, 'id'>) => {
    if (!canManageStructure) return;
    setCustomers([...customers, { ...c, id: nextId(customers) }]);
  };
  const handleUpdateCustomer = (id: number, c: Customer) => {
    if (!canManageStructure) return;
    setCustomers(customers.map((x) => (x.id === id ? c : x)));
  };
  const handleDeleteCustomer = (id: number) => {
    if (!canDelete) return;
    setCustomers(customers.filter((c) => c.id !== id));
  };
  // Customer sales (daily logging): workers can add/edit, admin only delete
  const handleAddCustomerSale = (s: Omit<CustomerSale, 'id'>) => {
    if (!canLogDaily) return;
    setCustomerSales((prev) => [...prev, { ...s, id: nextId(prev) }]);
  };
  const handleUpdateCustomerSale = (id: number, s: CustomerSale) => {
    if (!canLogDaily) return;
    setCustomerSales((prev) => prev.map((x) => (x.id === id ? s : x)));
  };
  const handleDeleteCustomerSale = (id: number) => {
    if (!canDelete) return;
    setCustomerSales((prev) => prev.filter((sale) => sale.id !== id));
  };

  // Incubation: workers can log, admin only delete
  const handleAddIncubation = (r: Omit<IncubationRecord, 'id'>) => {
    if (!canLogDaily) return;
    setIncubation([...incubation, { ...r, id: nextId(incubation) }]);
  };
  const handleUpdateIncubation = (id: number, r: IncubationRecord) => {
    if (!canLogDaily) return;
    setIncubation(incubation.map((x) => (x.id === id ? r : x)));
  };
  const handleDeleteIncubation = (id: number) => {
    if (!canDelete) return;
    setIncubation(incubation.filter((r) => r.id !== id));
  };
  const handleAddHatchedBirdsToFlock = (recordId: number, newBirds: Omit<Bird, 'id'>[]) => {
    if (!canManageStructure) return;
    const record = incubation.find((r) => r.id === recordId);
    if (!record || !record.hatchDate || record.hatched <= 0 || record.flockTransferDate) return;
    if (newBirds.length !== record.hatched) return;

    setBirds((prev) => {
      let nextBirdId = nextId(prev);
      return [
        ...prev,
        ...newBirds.map((bird) => ({
          ...bird,
          id: nextBirdId++,
        })),
      ];
    });
    setIncubation((prev) => prev.map((r) => (
      r.id === recordId
        ? {
            ...r,
            flockTransferDate: todayStr(),
            flockTransferCount: newBirds.length,
          }
        : r
    )));
  };

  // Daily operations (checklist + diary): any logged-in user can log
  const handleSaveChecklist = (entry: DailyChecklistEntry) => {
    if (!canLogDaily) return;
    const exists = checklist.some((c) => c.date === entry.date);
    if (exists) {
      setChecklist(checklist.map((c) => (c.date === entry.date ? entry : c)));
    } else {
      setChecklist([...checklist, entry]);
    }
  };

  const handleSaveDiary = async (entry: MufDiaryEntry) => {
    if (!canLogDaily) throw new Error(L('You do not have permission to edit diary notes.'));
    const entryId = entry.id || ('legacy-' + entry.date);
    const existing = diary.filter((item) => !(entry.originalDate && entry.originalDate !== entry.date &&
      item.date === entry.originalDate && (item.id || ('legacy-' + item.date)) === entryId));
    const index = existing.findIndex((item) => (item.id || ('legacy-' + item.date)) === entryId);
    const next = index >= 0 ? existing.map((item, i) => i === index ? entry : item) : [...existing, entry];
    await saveData('diary', next);
    setDiary(next);
  };

  const handleDeleteDiary = async (id: string, date: string) => {
    if (!canLogDaily) throw new Error(L('You do not have permission to delete diary notes.'));
    const next = diary.filter((item) => !((item.id || ('legacy-' + item.date)) === id && item.date === date));
    await saveData('diary', next);
    setDiary(next);
  };

  const [shouldOpenAddBirdModal, setShouldOpenAddBirdModal] = useState(false);
  const [birdIdToEdit, setBirdIdToEdit] = useState<number | null>(null);
  const [dailyOpsOpen, setDailyOpsOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Real-time farm notifications for the header bell — mirrors the Dashboard's
  // Smart Alerts (sick birds, vaccinations due, low feed stock). Same data,
  // surfaced in the shared parent-design header like the other farm apps.
  const notifications = useMemo(() => {
    type Notif = { id: string; type: 'danger' | 'warning' | 'info'; title: string; desc: string; time: string };
    const list: Notif[] = [];
    if (!isLoaded) return list;
    const today = todayStr();
    const activeBirds = birds.filter((b) => b.status === 'Active' || b.status === 'Sick');

    // 1. Sick birds
    const sickCount = birds.filter((b) => b.status === 'Sick').length;
    if (sickCount > 0) {
      list.push({
        id: 'sick-birds',
        type: 'danger',
        title: sickCount === 1 ? L('🩺 {count} sick bird', { count: sickCount }) : L('🩺 {count} sick birds', { count: sickCount }),
        desc: L('Birds are marked sick and need care. Check the Health Portal for treatment records.'),
        time: L('Health alert'),
      });
    }

    // Daily entry reminder: no egg entry for today after 8 AM
    const eggsToday = eggProduction.some((e) => e.date === today);
    if (!eggsToday && activeBirds.length > 0 && new Date().getHours() >= 8) {
      list.push({
        id: 'no-eggs-today',
        type: 'warning',
        title: L('🥚 No egg entry recorded today'),
        desc: L('No eggs have been logged for {today} yet. Add today\'s collection in the ledger.', { today: today }),
        time: L('Daily reminder'),
      });
    }

    // 2. Vaccinations due / overdue (same rule as Dashboard reminders)
    const vaccDue = activeBirds.filter((b) => {
      const daysUntilDue = b.lastVaccinationDate
        ? settings.vaccinationIntervalDays - diffDateOnlyDays(b.lastVaccinationDate, today)
        : null;
      return daysUntilDue === null || daysUntilDue <= 7;
    }).length;
    if (vaccDue > 0) {
      list.push({
        id: 'vaccination-due',
        type: 'warning',
        title: vaccDue === 1 ? L('💉 Vaccination due: {count} bird', { count: vaccDue }) : L('💉 Vaccination due: {count} birds', { count: vaccDue }),
        desc: L('These birds are due (or overdue) for vaccination within the next 7 days.'),
        time: L('Vaccination reminder'),
      });
    }

    // 3. Low feed stock (same estimate as Dashboard feed alert)
    const rate = settings.feedConsumptionKgPerDay ?? 0;
    if (rate > 0) {
      const remainingKg = feedStockKg(feedRecords, rate, today);
      const thresholdKg = rate * (settings.feedLowStockDays ?? 14);
      if (remainingKg !== null && remainingKg <= thresholdKg) {
        const daysLeft = Math.max(0, Math.floor(remainingKg / rate));
        list.push({
          id: 'feed-low-stock',
          type: 'warning',
          title: L('🌾 Low Feed Stock'),
          desc: daysLeft === 1
            ? L('Estimated feed remaining: {kg} kg (~{daysLeft} day). Please restock soon.', { kg: Math.max(0, Math.round(remainingKg)), daysLeft })
            : L('Estimated feed remaining: {kg} kg (~{daysLeft} days). Please restock soon.', { kg: Math.max(0, Math.round(remainingKg)), daysLeft }),
          time: L('Inventory health'),
        });
      }
    }

    return list;
  }, [isLoaded, birds, settings, feedRecords, eggProduction, lang]);
  const [quickOpenLedgerTab, setQuickOpenLedgerTab] = useState<'feed' | 'expense' | 'egg' | 'customers' | 'suppliers' | null>(null);

  const handleQuickAction = (actionType: 'bird' | 'egg' | 'expense' | 'feed') => {
    if (actionType === 'bird') {
      if (!canManageStructure) return;
      setActiveTab('flock');
      setShouldOpenAddBirdModal(true);
    } else {
      if (!canLogDaily) return;
      if (actionType === 'egg') {
        setActiveTab('ledger');
        setQuickOpenLedgerTab('egg');
      } else if (actionType === 'expense') {
        setActiveTab('ledger');
        setQuickOpenLedgerTab('expense');
      } else if (actionType === 'feed') {
        setActiveTab('ledger');
        setQuickOpenLedgerTab('feed');
      }
    }
  };

  const homeBirdTabs = ['flock', 'ledger', 'homeBirdSummary', 'homeBirdHealth'];
  const homeBirdsActive = homeBirdTabs.includes(activeTab);

  const navItems = [
    { id: 'batches', label: 'Batches', icon: Package },
    { id: 'flock', label: 'Home Birds', icon: BirdIcon },
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'health', label: 'Health', icon: HeartPulse },
    ...(isAdmin ? [{ id: 'labor', label: 'Labor', icon: HardHat }] : []),
    { id: 'incubation', label: 'Incubation', icon: Egg },
    { id: 'summary', label: 'Summary', icon: BarChart2 }, 
    ...(isAdmin ? [{ id: 'super_admin', label: 'Super Admin', icon: Shield }] : []),
  ];

  const [adminMenuOpen, setAdminMenuOpen] = useState(false);

  // Verifying token on mount? Show a neutral loading state
  if (currentUser === null) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-400 text-sm font-sans">
        {L('Loading…')}
      </div>
    );
  }

  // Logged out → show full-page login screen (viewer mode removed)
  if (currentUser === false) {
    return (
      <LoginScreen
        lang={lang}
        onLoginSuccess={handleLoginSuccess}
        onToggleLang={() => setLang(lang === 'en' ? 'ur' : lang === 'ur' ? 'roman' : 'en')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans transition-colors duration-200" id="app-root">
      <OfflineBanner
        pendingCount={offlineBucketCount}
        lang={lang}
        readQueue={() => { try { return Object.keys(JSON.parse(localStorage.getItem('ff_offline_buckets') || '{}')).map(k => ({ path: k, method: 'PUT' })); } catch { return []; } }}
        onSync={async () => { await syncOfflineBuckets(); window.dispatchEvent(new Event('ff:offline-synced')); }}
      />
      <MufWhatsNew storageKey="flockfarm_whats_new_seen" version={'2026-08 update'} lang={lang} notes={[
  'Search box in the top bar — find anything on the farm instantly',
  'Working offline? A banner shows saved entries and syncs them automatically',
  'New smooth production chart on the dashboard',
  'Farm profile PDF for buyers — in the reports section',
  'More Urdu across the whole app',
]} />
      <div className="muf-sticky-chrome">
<header className="muf-header">
        <div className="muf-header-brand cursor-pointer hover:opacity-90 transition-opacity">
          <img src="/flock-farm-logo-round-192.png" className="muf-brand-logo" alt="Usman Flock Farm" />
          <div>
            <h1>{t(lang, 'appName')}</h1>
            <p>{t(lang, 'appSubtitle')}</p>
          </div>
        </div>
        <div className="muf-header-actions">
              <MufFarmSwitcher app="flock" />
          <HeaderSearch
            lang={lang}
            loadItems={async () => {
              return [
                ...birds.map((b) => ({ id: String(b.id), type: 'flock', label: b.name, sub: b.breed || '', emoji: '🐔' })),
                ...customers.map((c) => ({ id: String(c.id), type: 'ledger', label: c.name, sub: c.phone || '', emoji: '🧑‍🌾' })),
                ...(isAdmin ? laborers.map((w) => ({ id: w.id, type: 'labor', label: w.name, sub: L('Worker'), emoji: '👷' })) : []),
                ...eggProduction.slice(-50).map((e, i) => ({ id: `egg-${i}`, type: 'ledger', label: `Eggs ${e.totalEggsCollected || 0}`, sub: e.date, emoji: '🥚' })),
                ...otherExpenses.slice(-50).map((e, i) => ({ id: `exp-${i}`, type: 'ledger', label: `${e.category} Rs ${e.amount || 0}`, sub: e.date, emoji: '💰' })),
                ...feedRecords.slice(-30).map((f, i) => ({ id: `feed-${i}`, type: 'ledger', label: `Feed ${f.quantityKg || 0}kg`, sub: f.date, emoji: '🌾' })),
                ...vaccinations.slice(-30).map((v, i) => ({ id: `vax-${i}`, type: 'health', label: `Vax ${v.vaccineName || ''}`.trim(), sub: v.date, emoji: '💉' })),
              ];
            }}
            onPick={(item) => setActiveTab(item.type as any)}
          />
          <button
            className="muf-icon-button"
            onClick={() => setDailyOpsOpen(true)}
            title={L('Notes')}
            aria-label={L('Notes')}
          >
            <BookOpen size={19} />
          </button>

          <button
            className="muf-icon-button muf-notif-wrap"
            title={L('Notifications')}
            aria-label={L('Notifications')}
            onClick={() => setNotifOpen(true)}
          >
            <Bell size={19} />
            {notifications.length > 0 && (
              <span className="muf-notif-badge">{notifications.length}</span>
            )}
          </button>

          <button
            className="muf-icon-button"
            onClick={() => setLang(lang === 'en' ? 'ur' : lang === 'ur' ? 'roman' : 'en')}
            title={lang === 'en' ? L('Switch to Urdu') : lang === 'ur' ? L('Switch to Roman Urdu') : L('Switch to English')}
            aria-label={L('Switch language')}
          >
            <Languages size={19} />
          </button>

          <button
            className="muf-icon-button"
            onClick={() => setIsDark(!isDark)}
            title={isDark ? (L('Switch to Light Mode')) : (L('Switch to Dark Mode'))}
            aria-label={L('Toggle theme')}
          >
            {isDark ? <Sun size={19} /> : <Moon size={19} />}
          </button>

          {isAdmin ? (
            <button
              className="muf-profile"
              onClick={() => setAdminMenuOpen(true)}
              title={L('Admin panel')}
              aria-label={L('Open admin panel')}
            >
              <span className="muf-avatar">
                {currentUser && typeof currentUser === 'object' && currentUser.avatarBase64 ? (
                  <img src={currentUser.avatarBase64} className="object-cover rounded-full" alt={currentUser.username} />
                ) : (
                  <Shield size={18} />
                )}
              </span>
              <span>
                <strong>{L('Welcome')} - {currentUser && typeof currentUser === 'object' ? currentUser.username : ''}</strong>
                <small>{L('Administrator')}</small>
              </span>
              <ChevronDown size={17} />
            </button>
          ) : (
            <button className="muf-profile" onClick={() => setProfileOpen(true)} title={L('My profile')} aria-label={L('Open my profile')}>
              <span className="muf-avatar">
                {currentUser && typeof currentUser === 'object' && currentUser.avatarBase64 ? (
                  <img src={currentUser.avatarBase64} className="object-cover rounded-full" alt={currentUser.username} />
                ) : (
                  <Users size={18} />
                )}
              </span>
              <span>
                <strong>{L('Welcome')} - {currentUser && typeof currentUser === 'object' ? currentUser.username : ''}</strong>
                <small>{L('Worker')}</small>
              </span>
            </button>
          )}

          <button
            className="muf-icon-button muf-logout"
            onClick={async () => {
              const ok = await confirmAction({
                title: L('Sign Out'),
                message: `${t(lang, 'logout')}?`,
                confirmLabel: t(lang, 'logout'),
                cancelLabel: L('Cancel'),
                tone: 'warning',
              });
              if (ok) {
                handleLogout();
              }
            }}
            title={t(lang, 'logout')}
            aria-label={L('Logout')}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <nav className="muf-top-nav" aria-label={L('Primary navigation')} id="tab-navigation">
        <div className="muf-top-nav-scroll">
          {navItems.map(({ id, label, icon: Icon }) => {
            const active = id === 'flock' ? homeBirdsActive : activeTab === id;
            return (
              <div className="muf-nav-item relative" key={id}>
                <div className="flex items-center">
                  <button type="button" className={`muf-nav-link ${active ? 'active' : ''}`} onClick={() => { setActiveTab(id); }} id={`nav-${id}`}><Icon size={15} /><span>{label}</span></button>
                </div>
              </div>
            );
          })}
        </div>
      </nav>
      {homeBirdsActive && (
        <nav className="muf-top-nav border-t border-slate-200/70 dark:border-slate-800/70" aria-label={L('Home Birds sections')}>
          <div className="muf-top-nav-scroll">
            {[
              { id: 'flock', label: 'Bird List', icon: BirdIcon },
              { id: 'ledger', label: 'Eggs', icon: Egg },
              { id: 'homeBirdSummary', label: 'Monthly Report', icon: BarChart2 },
              { id: 'homeBirdHealth', label: 'Vaccination', icon: HeartPulse }, 
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`muf-nav-link ${activeTab === id ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(id);
                  if (id === 'ledger') setQuickOpenLedgerTab('egg');
                }}
              >
                <Icon size={15} /><span>{label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}
</div>

      <div className="w-full p-3 sm:p-6 flex-1 flex flex-col gap-4 md:gap-6">
        <motion.main
          key={activeTab + (isLoaded ? '-loaded' : '-loading')}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -2 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="flex-1 bg-white dark:bg-slate-900 p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs min-w-0" id="main-content-window"
        >
          {!isLoaded ? (
            loadError ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20 text-center gap-3"
              >
                <div className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                  {L('Could not load farm data.')}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                  {loadError}
                </div>
                <button
                  onClick={() => setLoadVersion((v) => v + 1)}
                  className="px-4 py-2 rounded-xl bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold"
                >
                  {L('Retry')}
                </button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center py-20 text-slate-400 text-sm"
              >
                {L('Loading farm data…')}
              </motion.div>
            )
          ) : (
            <div key={activeTab} className="tab-panel">
              {activeTab === 'dashboard' && (
                <Dashboard
                  lang={lang}
                  birds={birds}
                  customers={customers}
                  otherExpenses={otherExpenses}
                  feedRecords={feedRecords}
                  eggProduction={eggProduction}
                  vaccinations={vaccinations}
                  customerSales={customerSales}
                  settings={settings}
                  dateRange={effectiveRange}
                  rangeFrom={rangeFrom}
                  rangeTo={rangeTo}
                  onDateRangeChange={(from, to) => {
                    setRangeFrom(from);
                    setRangeTo(to);
                    setDateRange({ from, to });
                  }}
                  onDatePreset={handleDatePreset}
                  openQuickAction={handleQuickAction}
                  onNavigate={(tab, context) => {
                    if (tab === 'customers') {
                      setActiveTab('ledger');
                      setQuickOpenLedgerTab('customers');
                      return;
                    }
                    if (tab === 'health') {
                      setActiveTab('homeBirdHealth');
                      return;
                    }
                    if (tab === 'operations') {
                      setDailyOpsOpen(true);
                      return;
                    }
                    setActiveTab(tab);
                    if (tab === 'flock' && context?.editBirdId) {
                      setBirdIdToEdit(context.editBirdId);
                    }
                  }}
                  isAdmin={isAdmin}
                />
              )}

              {activeTab === 'flock' && (
                <FlockRegister
                  lang={lang}
                  birds={birds}
                  vaccinations={vaccinations}
                  onAddBird={handleAddBird}
                  onUpdateBird={handleUpdateBird}
                  onDeleteBird={handleDeleteBird}
                  shouldOpenAddModal={shouldOpenAddBirdModal}
                  onCloseAddModal={() => setShouldOpenAddBirdModal(false)}
                  birdIdToEdit={birdIdToEdit}
                  onConsumeBirdEditRequest={() => setBirdIdToEdit(null)}
                  vaccinationIntervalDays={settings.vaccinationIntervalDays}
                  canDelete={canDelete}
                  isAdmin={isAdmin}
                />
              )}

              {activeTab === 'batches' && (
                <BatchesTab
                  lang={lang}
                  currentUser={currentUser && typeof currentUser === 'object' ? currentUser : null}
                />
              )}

              {activeTab === 'health' && <BatchHealthPortal />}

              {activeTab === 'homeBirdHealth' && (
                <HealthPortal
                  lang={lang}
                  birds={birds}
                  vaccinations={vaccinations}
                  vaccinationIntervalDays={settings.vaccinationIntervalDays}
                  onUpdateBird={handleUpdateBird}
                  onAddVaccination={handleAddVaccination}
                  onUpdateVaccination={handleUpdateVaccination}
                  onDeleteVaccination={handleDeleteVaccination}
                  canDelete={canDelete}
                  isAdmin={isAdmin}
                  vaccinationOnly
                />
              )}

              {activeTab === 'labor' && isAdmin && (
                <LaborTab
                  lang={lang}
                  workers={laborers}
                  attendance={laborAttendance}
                  advances={laborAdvances}
                  onChangeWorkers={setLaborers}
                  onChangeAttendance={setLaborAttendance}
                  onChangeAdvances={setLaborAdvances}
                  onAddExpense={handleAddOtherExpense}
                />
              )}

              {activeTab === 'ledger' && (
                <FinancialLedger
                  lang={lang}
                  birds={birds}
                  vaccinations={vaccinations}
                  customers={customers}
                  feedRecords={feedRecords}
                  otherExpenses={otherExpenses}
                  eggProduction={eggProduction}
                  customerSales={customerSales}
                  settings={settings}
                  onAddFeedRecord={handleAddFeedRecord}
                  onUpdateFeedRecord={handleUpdateFeedRecord}
                  onDeleteFeedRecord={handleDeleteFeedRecord}
                  onAddOtherExpense={handleAddOtherExpense}
                  onUpdateOtherExpense={handleUpdateOtherExpense}
                  onDeleteOtherExpense={handleDeleteOtherExpense}
                  onAddEggRecord={handleAddEggRecord}
                  onUpdateEggRecord={handleUpdateEggRecord}
                  onDeleteEggRecord={handleDeleteEggRecord}
                  onAddCustomer={handleAddCustomer}
                  onUpdateCustomer={handleUpdateCustomer}
                  onDeleteCustomer={handleDeleteCustomer}
                  onAddCustomerSale={handleAddCustomerSale}
                  onUpdateCustomerSale={handleUpdateCustomerSale}
                  onDeleteCustomerSale={handleDeleteCustomerSale}
                  onUpdateBird={handleUpdateBird}
                  onAddVaccination={handleAddVaccination}
                  onUpdateVaccination={handleUpdateVaccination}
                  onDeleteVaccination={handleDeleteVaccination}
                  quickOpenTab={quickOpenLedgerTab}
                  onResetQuickOpenTab={() => setQuickOpenLedgerTab(null)}
                  homeBirdsOnly
                  isAdmin={canLogDaily}
                  canDelete={canDelete}
                  canManageCustomers={canManageStructure}
                  canLogSales={canLogDaily}
                />
              )}

              {activeTab === 'incubation' && (
                <IncubationModule
                  lang={lang}
                  records={incubation}
                  onAdd={handleAddIncubation}
                  onUpdate={handleUpdateIncubation}
                  onDelete={handleDeleteIncubation}
                  onAddHatchedToFlock={handleAddHatchedBirdsToFlock}
                  canDelete={canDelete}
                  canEdit={canLogDaily}
                  canTransferToFlock={canManageStructure}
                />
              )}

              {activeTab === 'summary' && <BatchSummaryPortal />}

              {activeTab === 'homeBirdSummary' && (
                <MonthlySummary
                  lang={lang}
                  birds={birds}
                  otherExpenses={otherExpenses}
                  feedRecords={feedRecords}
                  eggProduction={eggProduction}
                  vaccinations={vaccinations}
                  customers={customers}
                  customerSales={customerSales}
                  settings={settings}
                />
              )}

              {activeTab === 'super_admin' && isAdmin && <SuperAdminTab />}

            </div>
          )}
        </motion.main>
      </div>

      <DetailModal
        open={dailyOpsOpen}
        onClose={() => setDailyOpsOpen(false)}
        title={L('Notes')}
        subtitle={L('Notes, photos, voice and daily checklist')}
        icon={<BookOpen className="w-5 h-5" />}
        iconBg="bg-indigo-100 text-indigo-700"
        size="small"
      >
        <div className="space-y-5">
          <MufDiary
            entries={diary.map((entry) => ({ ...entry, id: entry.id || ('legacy-' + entry.date), photos: entry.photos || [] } as MufDiaryEntry))}
            onSave={handleSaveDiary}
            onDelete={handleDeleteDiary}
            uploadPhoto={(file) => uploadImage(file, 'diary')}
            readOnly={!canLogDaily}
            entityOptions={[
              ...birds.map((item) => ({ id: String(item.id), type: 'bird', label: item.name || L('Bird') })),
              ...laborers.map((item) => ({ id: String(item.id), type: 'labor', label: item.name || L('Laborer') })),
              ...customers.map((item) => ({ id: String(item.id), type: 'customer', label: item.name || L('Customer') })),
            ]}
            shareTargets={[
              ...customers.map((item: any) => ({ id: String(item.id), type: 'customer', label: item.name || L('Customer'), phone: item.phone || item.mobile })),
              ...laborers.map((item: any) => ({ id: String(item.id), type: 'labor', label: item.name || L('Laborer'), phone: item.phone || item.mobile })),
            ]}
          />
          <details className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <summary className="cursor-pointer select-none text-xs font-bold text-slate-600 dark:text-slate-300">{L('Daily checklist')}</summary>
            <div className="mt-4">
              <DailyChecklist lang={lang} entries={checklist} onSave={handleSaveChecklist} readOnly={!canLogDaily} />
            </div>
          </details>
        </div>
      </DetailModal>

      {/* Notifications */}
      <DetailModal
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        title={L('Active Farm Notifications')}
        subtitle={L('Real-time Operational Alerts')}
        icon={<Bell className="w-4 h-4" />}
       size="small">
        <div className="space-y-4 text-slate-800 dark:text-slate-100">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {L('Below are the current real-time alerts and notices for Usman Flock Farm operations:')}
          </p>
          <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
            {notifications.map((notif) => (
              <div key={notif.id} className="p-3.5 rounded-xl border border-[color:var(--muf-color-border)] bg-slate-50 dark:bg-slate-900/40 space-y-1 animate-fade-in">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-xs text-slate-800 dark:text-white flex items-center gap-1.5">
                    {notif.title}
                  </span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                    notif.type === 'danger' ? 'bg-red-900/20 text-red-600 border-red-900/30' :
                    notif.type === 'warning' ? 'bg-amber-900/20 text-amber-600 border-amber-900/30' :
                    'bg-blue-900/20 text-blue-600 border-blue-900/30'
                  }`}>
                    {L('Alert')}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">{notif.desc}</p>
                <p className="text-[9px] text-slate-400 font-bold">{notif.time}</p>
              </div>
            ))}
            {notifications.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-500 italic">
                {L('✨ No active alerts. All farm operations are running smoothly!')}
              </div>
            )}
          </div>
        </div>
      </DetailModal>

      {/* My Profile popup — every account manages its own avatar & password */}
      <DetailModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        title={L('My Profile')}
        subtitle={currentUser && typeof currentUser === 'object' ? `${currentUser.username} · ${isAdmin ? 'Administrator' : 'Worker'}` : ''}
        icon={<Users className="w-4 h-4" />}
       size="small">
        <MyProfileContent
          lang={lang}
          currentUser={currentUser && typeof currentUser === 'object' ? currentUser : null}
          onUserUpdate={(u) => setCurrentUser(u)}
        />
      </DetailModal>

      {/* Admin popup (settings, users, backups, ...) — admin only */}
      {isAdmin && currentUser && typeof currentUser === 'object' && (
        <AdminMenu
          open={adminMenuOpen}
          onClose={() => setAdminMenuOpen(false)}
          currentUser={currentUser}
          onLoginStateChange={(u) => {
            if (u) {
              // Login just happened — persist locally and reload data
              setIsLoaded(false);
              setCurrentUser(u);
            } else {
              // Logout
              handleLogout();
            }
          }}
          lang={lang}
          onToggleLang={() => setLang(lang === 'en' ? 'ur' : lang === 'ur' ? 'roman' : 'en')}
          settings={settings}
          birds={birds}
          otherExpenses={otherExpenses}
          feedRecords={feedRecords}
          eggProduction={eggProduction}
          vaccinations={vaccinations}
          customers={customers}
          customerSales={customerSales}
          incubation={incubation}
          checklist={checklist}
          diary={diary}
          laborers={laborers}
          laborAttendance={laborAttendance}
          laborAdvances={laborAdvances}
          onSaveSettings={(s) => setSettings(s)}
          onResetDatabase={handleResetDatabase}
          onClearDatabase={handleClearDatabase}
          onRestoreBackup={handleRestoreBackup}
          onUserUpdate={(u) => setCurrentUser(u)}
        />
      )}

      <SyncIndicator status={syncStatus} lang={lang} />

      <footer className="muf-app-footer">
        <span className="muf-footer-brand">🐔 Usman Flock Farm © {new Date().getFullYear()}</span>
        <span className="muf-footer-meta">
          {currentUser && typeof currentUser === 'object' ? <span>{currentUser.username}</span> : null}
          <span>{isAdmin ? 'admin' : 'worker'}</span>
        </span>
      </footer>
    </div>
  );
}
