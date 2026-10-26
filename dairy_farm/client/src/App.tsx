import { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import MufFarmSwitcher from './muf/ui/muf-farm-switcher';
import { createPortal } from "react-dom";
import { motion, AnimatePresence, prefersReducedMotion } from './muf/core/muf-motion';
import {
  CalendarHeart,
  Home,
  HardHat,
  Cat,
  Droplets,
  DollarSign,
  HeartPulse,
  BarChart2,
  Moon,
  Sun,
  LogOut,
  BookOpen,
  Shield,
  Bell,
  Users,
  ChevronDown,
  Languages,
} from "lucide-react";
import { getToken, getRole, getUsername, clearAuth, api, syncOfflineQueue, offlineQueueCount } from "./api";
import type { HealthRecord, AuthUser } from "./types";
import MyProfilePopup from "./components/MyProfilePopup";
import { todayStr } from "./utils/date";
import { L, getLang, setCurrentLang, type Lang } from "./i18n";
import { notify, useConfirm } from './muf/core/muf-confirm';
import Login from "./components/Login";
const Dashboard = lazy(() => import("./components/Dashboard"));
const SuperAdminTab = lazy(() => import("./components/SuperAdminTab").then((module) => ({ default: module.SuperAdminTab })));
const CowsTab = lazy(() => import("./components/CowsTab"));
const BreedingTab = lazy(() => import("./components/BreedingTab"));
const MilkTab = lazy(() => import("./components/MilkTab"));
const ExpensesTab = lazy(() => import("./components/ExpensesTab"));
const HealthTab = lazy(() => import("./components/HealthTab"));
const ReportsTab = lazy(() => import("./components/ReportsTab"));
import DiaryTab from "./components/DiaryTab";
import MufDiary, { type MufDiaryEntry, type MufDiaryChoice } from "./muf/ui/muf-diary";
import { compressDiaryPhoto } from "./muf/ui/muf-diary-media";
const LaborTab = lazy(() => import("./components/LaborTab"));
import HeaderSearch from "./muf/ui/muf-header-search";
import OfflineBanner from "./muf/core/muf-offline-banner";
import { hideMufSplash, initMufPullToRefresh, MufWhatsNew } from './muf/core/muf-applike';
import AdminPanel from "./components/AdminPanel";
import DetailModal from './muf/core/muf-modal';

type Tab =
  | "dashboard"
  | "cows"
  | "milk"
  | "breeding"
  | "expenses"
  | "health"
  | "labor"
  | "diary"
  | "reports"
  | "super_admin";

const getNav = (): { id: Tab; label: string; icon: React.ElementType }[] => [
  { id: "dashboard", label: L("Dashboard"), icon: Home },
  { id: "cows", label: L("Cows"), icon: Cat },
  { id: "milk", label: L("Milk"), icon: Droplets },
  { id: "breeding", label: L("Breeding"), icon: CalendarHeart },
  { id: "expenses", label: L("Finance"), icon: DollarSign },
  { id: "health", label: L("Health"), icon: HeartPulse },
  { id: "labor", label: L("Labor"), icon: HardHat },
  { id: "reports", label: L("Summary"), icon: BarChart2 },
  { id: "super_admin", label: "Super Admin", icon: Shield },
];

const offlinePendingCount = () => {
  try { return (JSON.parse(localStorage.getItem('dm_offline_queue') || '[]') as unknown[]).length; } catch { return 0; }
};

export default function App() {
  const [token, setToken] = useState<string | null>(getToken);
  const [role, setRole] = useState<string | null>(getRole);
  const [farmRole, setFarmRole] = useState<string | null>(() => { try { return localStorage.getItem('dm_farm_role'); } catch { return null; } });
  const [username, setUsername] = useState<string | null>(getUsername);
  const [dark, setDark] = useState(
    () => localStorage.getItem("dm_dark") === "true",
  );
  const [tab, setTab] = useState<Tab>("dashboard");
  const [financeMenuOpen, setFinanceMenuOpen] = useState(false);
  const financeMenuAnchorRef = useRef<HTMLDivElement | null>(null);
  const financeMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [financeMenuPosition, setFinanceMenuPosition] = useState({ top: 8, left: 8 });

  const toggleFinanceMenu = () => {
    if (financeMenuOpen) {
      setFinanceMenuOpen(false);
      return;
    }
    const anchor = financeMenuAnchorRef.current?.getBoundingClientRect();
    const menuWidth = Math.min(208, Math.max(0, window.innerWidth - 16));
    const maxMenuHeight = Math.min(window.innerHeight * 0.7, 416);
    if (anchor) {
      setFinanceMenuPosition({
        top: Math.max(8, Math.min(anchor.bottom + 8, window.innerHeight - maxMenuHeight - 8)),
        left: Math.max(8, Math.min(anchor.left, window.innerWidth - menuWidth - 8)),
      });
    }
    setFinanceMenuOpen(true);
  };

  // Body portal escapes the horizontally scrolling navigation and its clipping.
  // Keep outside-pointer, Escape, resize and page-scroll dismissal consistent.
  useEffect(() => {
    if (!financeMenuOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element &&
        !target.closest('.muf-finance-nav-item') &&
        !target.closest('.muf-finance-menu')) {
        setFinanceMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setFinanceMenuOpen(false);
      financeMenuTriggerRef.current?.focus({ preventScroll: true });
    };
    const closeOnScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('.muf-finance-menu')) return;
      setFinanceMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnScroll);
    window.addEventListener('scroll', closeOnScroll, true);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnScroll);
      window.removeEventListener('scroll', closeOnScroll, true);
    };
  }, [financeMenuOpen]);
  const [financeCategory, setFinanceCategory] = useState('');
  const [lang, setLangState] = useState<Lang>(getLang());

  // muf-applike: fade out the boot splash + enable pull-to-refresh on phones
  useEffect(() => {
    hideMufSplash();
    return initMufPullToRefresh();
  }, []);
  const confirmAction = useConfirm();
  const toggleLang = () => {
    const next: Lang = lang === "en" ? "ur" : lang === "ur" ? "roman" : "en";
    setCurrentLang(next);
    setLangState(next);
  };

  // ── Offline mode: queued writes replay automatically on reconnect ──
  useEffect(() => {
    const onQueued = () => notify('📶 Offline: saved on this device — will sync when internet returns', 'info');
    const onBackOnline = async () => {
      if (offlineQueueCount() === 0) return;
      const [ok, failed] = await syncOfflineQueue();
      if (ok > 0) notify(`✅ Back online — ${ok} offline change${ok === 1 ? '' : 's'} synced`, 'success');
      if (failed > 0) notify(`⚠️ ${failed} change${failed === 1 ? '' : 's'} failed — will retry`, 'error');
    };
    window.addEventListener('dm:offline-queued', onQueued);
    window.addEventListener('online', onBackOnline);
    if (navigator.onLine) onBackOnline();
    return () => {
      window.removeEventListener('dm:offline-queued', onQueued);
      window.removeEventListener('online', onBackOnline);
    };
  }, []);
  const [showAdmin, setShowAdmin] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [diaryOpen, setDiaryOpen] = useState(false);
  const [diaryEntries, setDiaryEntries] = useState<MufDiaryEntry[]>([]);
  const [diaryEntityOptions, setDiaryEntityOptions] = useState<MufDiaryChoice[]>([]);
  const [diaryShareTargets, setDiaryShareTargets] = useState<MufDiaryChoice[]>([]);
  const [me, setMe] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (!diaryOpen || !token) return;
    let cancelled = false;
    Promise.all([
      api.getDiaryEntries().catch(() => ({ entries: [] })),
      api.getCows({}).catch(() => []),
      api.getBuyers().catch(() => []),
      api.getLaborWorkers().catch(() => []),
      api.getSuppliers().catch(() => []),
    ]).then(([diaryResult, cows, buyers, workers, suppliers]) => {
      if (cancelled) return;
      setDiaryEntries(Array.isArray(diaryResult.entries) ? diaryResult.entries : []);
      const entityOptions: MufDiaryChoice[] = [
        ...(Array.isArray(cows) ? cows.map((x: any) => ({ id: String(x._id || x.id), type: 'animal', label: x.name || x.tagNo || x.tag || L('Animal') })) : []),
        ...(Array.isArray(buyers) ? buyers.map((x: any) => ({ id: String(x._id || x.id), type: 'buyer', label: x.name || L('Buyer') })) : []),
        ...(Array.isArray(workers) ? workers.map((x: any) => ({ id: String(x._id || x.id), type: 'labor', label: x.name || L('Laborer') })) : []),
        ...(Array.isArray(suppliers) ? suppliers.map((x: any) => ({ id: String(x._id || x.id), type: 'dealer', label: x.name || L('Dealer') })) : []),
      ].filter((x) => x.id && x.id !== 'undefined');
      setDiaryEntityOptions(entityOptions);
      setDiaryShareTargets([
        ...(Array.isArray(buyers) ? buyers.map((x: any) => ({ id: String(x._id || x.id), type: 'buyer', label: x.name || L('Buyer'), phone: x.phone || x.mobile })) : []),
        ...(Array.isArray(workers) ? workers.map((x: any) => ({ id: String(x._id || x.id), type: 'labor', label: x.name || L('Laborer'), phone: x.phone || x.mobile })) : []),
        ...(Array.isArray(suppliers) ? suppliers.map((x: any) => ({ id: String(x._id || x.id), type: 'dealer', label: x.name || L('Dealer'), phone: x.phone || x.mobile })) : []),
      ].filter((x) => x.id && x.id !== 'undefined'));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [diaryOpen, token]);

  const saveDiaryEntry = async (entry: MufDiaryEntry) => {
    if (entry.originalDate && entry.originalDate !== entry.date) await deleteDiaryEntry(entry.id, entry.originalDate);
    const current = await api.getDailyLog(entry.date);
    let dayEntries: MufDiaryEntry[] = Array.isArray(current.diaryEntries) ? current.diaryEntries : [];
    if (!dayEntries.length && (current.notes || current.photos?.length || current.voiceNotes?.length)) {
      dayEntries = [{
        id: 'legacy-' + entry.date, date: entry.date, note: current.notes || '',
        photos: Array.isArray(current.photos) ? current.photos : [],
        voiceBase64: Array.isArray(current.voiceNotes) && current.voiceNotes.length ? current.voiceNotes[0].base64 : undefined,
      }];
    }
    dayEntries = dayEntries.filter((item) => item.id !== entry.id);
    dayEntries.push(entry);
    await api.saveDailyLog(entry.date, { diaryEntries: dayEntries, notes: '', photos: [], voiceNotes: [] });
    setDiaryEntries((previous) => [...previous.filter((item) => item.date !== entry.date), ...dayEntries].sort((a, b) => b.date.localeCompare(a.date)));
  };

  const deleteDiaryEntry = async (id: string, date: string) => {
    const current = await api.getDailyLog(date);
    let dayEntries: MufDiaryEntry[] = Array.isArray(current.diaryEntries) ? current.diaryEntries : [];
    if (!dayEntries.length && (current.notes || current.photos?.length || current.voiceNotes?.length)) {
      dayEntries = [{ id: 'legacy-' + date, date, note: current.notes || '', photos: Array.isArray(current.photos) ? current.photos : [], voiceBase64: current.voiceNotes?.[0]?.base64 }];
    }
    dayEntries = dayEntries.filter((entry) => entry.id !== id);
    await api.saveDailyLog(date, { diaryEntries: dayEntries, ...(id === 'legacy-' + date ? { notes: '', photos: [], voiceNotes: [] } : {}) });
    setDiaryEntries((previous) => previous.filter((entry) => !(entry.date === date && entry.id === id)));
  };
  const [healthAlerts, setHealthAlerts] = useState<HealthRecord[]>([]);

  // Load own profile (for the header avatar); refresh when the admin panel
  // or profile popup updates it.
  useEffect(() => {
    if (!token) { setMe(null); return; }
    let cancelled = false;
    const load = () => api.getMe().then((r) => { if (!cancelled) setMe(r.user); }).catch(() => {});
    load();
    window.addEventListener('dm:profile-updated', load);
    return () => { cancelled = true; window.removeEventListener('dm:profile-updated', load); };
  }, [token]);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const reduceMotion = prefersReducedMotion();

  // Header bell — real health alerts (due/overdue), same data the Dashboard
  // banner uses, surfaced in the shared parent-design header.
  useEffect(() => {
    if (!token) { setHealthAlerts([]); return; }
    let cancelled = false;
    api.getUpcomingHealth()
      .then((records: HealthRecord[]) => { if (!cancelled) setHealthAlerts(records || []); })
      .catch(() => { if (!cancelled) setHealthAlerts([]); });
    return () => { cancelled = true; };
  }, [token, tab]);

  const [milkLoggedToday, setMilkLoggedToday] = useState<boolean | null>(null);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const today = todayStr();
    api.getMilk({ from: today, to: today })
      .then((rows: unknown[]) => { if (!cancelled) setMilkLoggedToday(Array.isArray(rows) && rows.length > 0); })
      .catch(() => { if (!cancelled) setMilkLoggedToday(null); });
    return () => { cancelled = true; };
  }, [token, tab]);

  const notifications = useMemo(() => {
    const today = todayStr();
    const list = healthAlerts.map((r) => {
      const overdue = !!r.nextDueDate && r.nextDueDate < today;
      return {
        id: r._id,
        type: overdue ? ("danger" as const) : ("warning" as const),
        title: `${overdue ? "🔴 Overdue" : "💉 Due"}: ${r.type.charAt(0).toUpperCase() + r.type.slice(1)}`,
        desc: `${r.description || r.type}${r.medicine ? ` — ${r.medicine}` : ""}. Due date: ${r.nextDueDate || "—"}.`,
        time: overdue ? "Health alert — overdue" : "Health reminder",
      };
    });
    // Daily entry reminder: nothing logged today after 8 AM
    if (milkLoggedToday === false && new Date().getHours() >= 8) {
      list.unshift({
        id: 'no-milk-today',
        type: 'warning' as const,
        title: '🥛 No milk entry recorded today',
        desc: `No milk has been logged for ${today} yet. Add today's records in the Milk tab.`,
        time: 'Daily reminder',
      });
    }
    return list;
  }, [healthAlerts, milkLoggedToday]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("dm_dark", String(dark));
  }, [dark]);

  // Soft logout on expired/invalid JWT — no hard page reload
  useEffect(() => {
    const onUnauthorized = () => {
      clearAuth();
      setToken(null);
      setRole(null);
      setFarmRole(null);
      try { localStorage.removeItem('dm_farm_role'); } catch { /* storage unavailable */ }
      setUsername(null);
      setShowAdmin(false);
      setSessionNotice("Your session expired. Please sign in again.");
    };
    window.addEventListener("dm:unauthorized", onUnauthorized);
    return () => window.removeEventListener("dm:unauthorized", onUnauthorized);
  }, []);

  function handleLogin(t: string, r: string, u: string, actualFarmRole: string) {
    setToken(t);
    setRole(r);
    setFarmRole(actualFarmRole);
    try { localStorage.setItem('dm_farm_role', actualFarmRole); } catch { /* storage unavailable */ }
    setUsername(u);
    setSessionNotice(null);
  }

  async function handleLogout() {
    const ok = await confirmAction({
      title: L('Sign Out'),
      message: L('Are you sure you want to sign out of Usman Dairy Farm?'),
      confirmLabel: L('Sign Out'),
      tone: 'warning',
    });
    if (!ok) return;
    clearAuth();
    setToken(null);
    setRole(null);
    setFarmRole(null);
    try { localStorage.removeItem('dm_farm_role'); } catch { /* storage unavailable */ }
    setUsername(null);
    setShowAdmin(false);
  }

  if (!token) {
    return (
      <Login onLogin={handleLogin} sessionNotice={sessionNotice} lang={lang} onToggleLang={toggleLang} />
    );
  }

  const isAdmin = role === "admin";
  const canLogDaily = isAdmin || role === "worker";
  // Workers can use day-to-day tabs; financial Reports stay admin-only
  const NAV = getNav(); // re-evaluated every render so labels follow the language
  void lang; // language state drives re-render
  const visibleNav = (isAdmin ? NAV : NAV.filter((n) => n.id !== "reports" && n.id !== "labor"))
    .filter((n) => n.id !== "super_admin" || farmRole === "owner");

  return (
    <div
      className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans text-slate-800 dark:text-slate-100 transition-colors duration-200 overflow-x-clip relative"
      id="app-root"
    >
      {/* Decorative background — one-shot fade-in, no loops */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.1 }}
          className="absolute -top-28 left-1/4 w-72 h-72 rounded-full bg-farm-300/20 dark:bg-farm-600/10 blur-3xl"
        />
        <motion.div
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="absolute top-1/3 -right-24 w-80 h-80 rounded-full bg-emerald-300/20 dark:bg-emerald-600/10 blur-3xl"
        />
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, rotate: 0 }}
          animate={{ opacity: 1, rotate: -12 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="absolute bottom-16 left-8 text-7xl opacity-[0.06] dark:opacity-[0.08]"
        >
          🐄
        </motion.div>
      </div>

      {/* Header */}
      <OfflineBanner
        pendingCount={offlinePendingCount}
        lang={lang}
        readQueue={() => { try { return JSON.parse(localStorage.getItem('dm_offline_queue') || '[]'); } catch { return []; } }}
        onSync={async () => { await syncOfflineQueue(); window.dispatchEvent(new Event('dm:offline-synced')); }}
      />
      <MufWhatsNew storageKey="dm_whats_new_seen" version={'2026-08 update'} lang={lang} notes={[
  'Search box in the top bar — find anything on the farm instantly',
  'Working offline? A banner shows saved entries and syncs them automatically',
  'New smooth production chart on the dashboard',
  'Farm profile PDF for buyers — in the reports section',
  'More Urdu across the whole app',
]} />
      <div className="muf-sticky-chrome">
<header className="muf-header">
        <a href="/" target="_self" className="muf-header-brand cursor-pointer hover:opacity-90 transition-opacity">
          <img
            src="/dairy-farm-logo-round-512.png"
            className="muf-brand-logo"
            alt="Usman Dairy Farm"
          />
          <div>
            <h1>{L('Usman Dairy Farm')}</h1>
            <p>{L('Farm Management System')}</p>
          </div>
        </a>

        <div className="muf-header-actions">
              <MufFarmSwitcher app="dairy" />
          <HeaderSearch
            lang={lang}
            loadItems={async () => {
              const [cows, buyers, workers, milk, expenses, health] = await Promise.all([
                api.getCows().catch(() => []),
                isAdmin ? api.getBuyers().catch(() => []) : Promise.resolve([]),
                isAdmin ? api.getLaborWorkers().catch(() => []) : Promise.resolve([]),
                api.getMilk({}).catch(() => []),
                isAdmin ? api.getExpenses({}).catch(() => []) : Promise.resolve([]),
                isAdmin ? api.getHealth().catch(() => []) : Promise.resolve([]),
              ]);
              return [
                ...cows.map((c: any) => ({ id: c._id, type: 'cows', label: c.name, sub: c.breed || '', emoji: c.gender === 'male' ? '🐂' : '🐄' })),
                ...buyers.map((b: any) => ({ id: b._id, type: 'buyers', label: b.name, sub: b.phone || '', emoji: '🧑‍🌾' })),
                ...workers.map((w: any) => ({ id: w._id, type: 'labor', label: w.name, sub: L('Worker'), emoji: '👷' })),
                ...milk.slice(-50).map((m: any) => ({ id: `milk-${m._id || m.date}`, type: 'milk', label: `Milk ${m.morning + m.evening}L`, sub: m.date, emoji: '🥛' })),
                ...expenses.slice(-50).map((e: any) => ({ id: `exp-${e._id}`, type: 'expenses', label: `${e.type} Rs ${e.amount}`, sub: e.date, emoji: '💰' })),
                ...health.slice(-50).map((h: any) => ({ id: `hlth-${h._id}`, type: 'health', label: `${h.type} — ${h.description || ''}`.trim(), sub: h.date, emoji: '💊' })),
              ];
            }}
            onPick={(item) => setTab((item.type === 'buyers' ? 'reports' : item.type === 'milk' ? 'milk' : item.type === 'expenses' ? 'expenses' : item.type === 'health' ? 'health' : item.type) as Tab)}
          />

          <button
            className="muf-icon-button"
            onClick={() => setDiaryOpen(true)}
            title={L("Notes")}
            aria-label={L("Notes")}
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
            onClick={toggleLang}
            title={lang === "en" ? L("Switch to Urdu") : lang === "ur" ? L("Switch to Roman Urdu") : L("Switch to English")}
            aria-label={L("Switch language")}
          >
            <Languages size={19} />
          </button>

          <button
            className="muf-icon-button"
            onClick={() => setDark((d) => !d)}
            title={dark ? L("Switch to Light Mode") : L("Switch to Dark Mode")}
            aria-label={L("Toggle theme")}
          >
            {dark ? <Sun size={19} /> : <Moon size={19} /> }
          </button>

          {isAdmin ? (
            <button className="muf-profile" onClick={() => setShowAdmin(true)} title={L("Open admin panel")} aria-label={L("Open admin panel")}>
              <span className="muf-avatar">
                {me?.avatarBase64 ? (
                  <img src={me.avatarBase64} className="object-cover rounded-full" alt={username || 'Admin'} />
                ) : (
                  <Shield size={18} />
                )}
              </span>
              <span><strong>Welcome - {username || "Admin"}</strong><small>{L('Administrator')}</small></span>
              <ChevronDown size={17} />
            </button>
          ) : (
            <button className="muf-profile" onClick={() => setProfileOpen(true)} title={L("My profile")} aria-label={L("Open my profile")}>
              <span className="muf-avatar">
                {me?.avatarBase64 ? (
                  <img src={me.avatarBase64} className="object-cover rounded-full" alt={username || 'Worker'} />
                ) : (
                  <Users size={18} />
                )}
              </span>
              <span><strong>Welcome - {username || "Worker"}</strong><small>{L('Worker')}</small></span>
            </button>
          )}

          <button className="muf-icon-button muf-logout" onClick={handleLogout} title={L("Logout")} aria-label={L("Logout")}>
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Tab Nav */}
      <nav className="muf-top-nav" aria-label={L('Primary navigation')}>
        <div className="muf-top-nav-scroll">
          {visibleNav.map(({ id, label, icon: Icon }) => id === "expenses" ? (
            <div className="muf-nav-item muf-finance-nav-item relative" ref={financeMenuAnchorRef} key={id}>
              <div className="flex items-center">
                <button type="button" className={`muf-nav-link ${tab === id ? "active" : ""}`} onClick={() => { setTab(id); setFinanceMenuOpen(false); }}><Icon size={15}/><span>{label}</span></button>
                <button type="button" ref={financeMenuTriggerRef} aria-label={L('Open Finance sections')} aria-expanded={financeMenuOpen} aria-controls="muf-finance-menu" onClick={toggleFinanceMenu} className="muf-nav-link !px-2" title={L('Finance sections')}><ChevronDown size={14}/></button>
              </div>
              {financeMenuOpen && createPortal(
                <div
                  id="muf-finance-menu"
                  className="muf-finance-menu"
                  role="group"
                  aria-label={L('Finance sections')}
                  style={financeMenuPosition}
                >{[{label:'All expenses',value:''},{label:'Feed',value:'feed'},{label:'Medicine',value:'medicine'},{label:'Equipment',value:'equipment'},{label:'Labor',value:'labor'},{label:'Purchasing',value:'purchasing'},{label:'Other',value:'misc'}].map(item => <button key={item.label} type="button" onClick={() => { setFinanceCategory(item.value); setTab('expenses'); setFinanceMenuOpen(false); }} className={`muf-finance-menu-item ${financeCategory === item.value ? 'is-active' : ''}`}>{item.label}</button>)}</div>,
                document.body
              )}
            </div>
          ) : <div className="muf-nav-item" key={id}><button type="button" className={`muf-nav-link ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}><Icon size={15}/><span>{label}</span></button></div>)}
        </div>
      </nav>
</div>

      {/* Content */}
      <div className="flex-1 w-full p-3 sm:p-5 relative z-10">
        <AnimatePresence mode="wait">
          <motion.main
            key={tab}
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="bg-white/95 dark:bg-slate-900/95 backdrop-blur rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-3.5 sm:p-6 min-h-[60vh]"
          >
            <Suspense fallback={<div className="p-8 text-center text-slate-500 text-sm">{L("Loading section…")}</div>}>
            {tab === "dashboard" && (
              <Dashboard
                isAdmin={isAdmin}
                onNavigate={setTab as (t: string) => void}
              />
            )}
            {tab === "cows" && <CowsTab isAdmin={isAdmin} />}
            {tab === "milk" && (
              <MilkTab isAdmin={canLogDaily} canDelete={isAdmin} />
            )}
            {tab === "breeding" && <BreedingTab isAdmin={isAdmin} />}
            {tab === "expenses" && (
              <ExpensesTab isAdmin={canLogDaily} canDelete={isAdmin} financeCategory={financeCategory} />
            )}
            {tab === "health" && (
              <HealthTab isAdmin={canLogDaily} canDelete={isAdmin} />
            )}
            {tab === "labor" && isAdmin && <LaborTab />}
            {tab === "reports" && (isAdmin ? <Suspense fallback={<div className="p-8 text-center text-slate-500 text-sm">Loading reports…</div>}><ReportsTab /></Suspense> : (
              <div className="p-8 text-center text-slate-500 text-sm">
                {L('Reports are available to admin accounts only.')}
              </div>
            ))}
            {tab === "super_admin" && farmRole === "owner" && <SuperAdminTab />}
            </Suspense>
          </motion.main>
        </AnimatePresence>
      </div>

      <footer className="muf-app-footer">
        <span className="muf-footer-brand">🐄 Usman Dairy Farm © {new Date().getFullYear()}</span>
        <span className="muf-footer-meta">
          {username && <span>{username}</span>}
          <span>{role} mode</span>
        </span>
      </footer>

      {/* Admin Panel Popup */}
      <AnimatePresence>
        {showAdmin && (
          <AdminPanel username={username} isOwner={farmRole === 'owner'} onClose={() => setShowAdmin(false)} />
        )}
      </AnimatePresence>

      {/* My Profile popup (workers manage their own avatar & password) */}
      <AnimatePresence>
        {profileOpen && (
          <MyProfilePopup
            me={me}
            onClose={() => setProfileOpen(false)}
            onProfileUpdated={() => window.dispatchEvent(new Event('dm:profile-updated'))}
          />
        )}
      </AnimatePresence>

      {/* Diary popup (checklist + notes + voice notes) */}
      <DetailModal
        open={diaryOpen}
        onClose={() => setDiaryOpen(false)}
        title={L("Notes")}
        subtitle={L("Daily checklist and notes")}
        icon={<BookOpen className="w-5 h-5" />}
        iconBg="bg-indigo-100 text-indigo-700"
        size="big"
      >
        <div className="space-y-5">
          <MufDiary entries={diaryEntries} onSave={saveDiaryEntry} onDelete={deleteDiaryEntry}
            uploadPhoto={async (file) => { const compressed = await compressDiaryPhoto(file); const uploaded = await api.uploadPhoto(compressed.data); return uploaded.path; }}
            resolvePhotoUrl={api.getPhotoObjectUrl} entityOptions={diaryEntityOptions} shareTargets={diaryShareTargets} />
          <details className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <summary className="cursor-pointer select-none text-xs font-bold text-slate-600 dark:text-slate-300">{L('Daily checklist')}</summary>
            <div className="mt-4"><DiaryTab checklistOnly /></div>
          </details>
        </div>
      </DetailModal>

      {/* Notifications popup */}
      <DetailModal
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        title={L('Active Farm Notifications')}
        subtitle={L('Real-time Operational Alerts')}
        icon={<Bell className="w-4 h-4" />}
        iconBg="bg-farm-100 text-farm-700 dark:bg-farm-900/40 dark:text-farm-300"
        size="small"
      >
        <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                  {notifications.map((notif) => (
                    <div key={notif.id} className="p-3.5 rounded-xl border border-[color:var(--muf-color-border)] bg-slate-50 dark:bg-slate-900/40 space-y-1 animate-fade-in">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-xs text-slate-800 dark:text-white flex items-center gap-1.5">
                          {notif.title}
                        </span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                          notif.type === "danger"
                            ? "bg-red-900/20 text-red-600 border-red-900/30"
                            : "bg-amber-900/20 text-amber-600 border-amber-900/30"
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
                      ✨ No active alerts. All farm operations are running smoothly!
                    </div>
                  )}
                </div>
      </DetailModal>
    </div>
  );
}
