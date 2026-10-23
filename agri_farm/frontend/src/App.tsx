import { SuperAdminTab } from './components/SuperAdminTab';
import MufFarmSwitcher from './muf/ui/muf-farm-switcher';
import MufLoginLang from './muf/ui/muf-login-lang';
import { MufLoginBrand, MufLoginPanel, MufLoginScreen } from './muf/ui/muf-login';
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from './muf/core/muf-motion';
import * as api from './api';
import { AGRI_LIST_PAGE_SIZE, mergeAgriPageRows, getAgriPageTotal } from './components/app/agri-list-paging';
import DetailModal from './muf/core/muf-modal';
import MufDiary, { type MufDiaryEntry } from './muf/ui/muf-diary';
import AdminMenu from './components/AdminMenu';
import MufFab from './muf/core/muf-fab';
import MufWorkerPanel from './muf/ui/muf-worker-panel';
import ImageUploader from './components/ImageUploader';
import { L, getLang, setCurrentLang } from './i18n';
import { openMufPrint, mufEsc } from './muf/data/muf-print';
import { mufPdfStart, mufPdfSummary, mufPdfTable, mufPdfFooter, mufPdfSave } from './muf/data/muf-pdf';
import { zakatStatementBody, ushrStatementBody, pctAmount, ZAKAT_DEFAULT_PCT, USHR_RAIN_PCT, USHR_IRRIGATED_PCT, downloadZakatPdf, downloadUshrPdf } from './muf/domain/muf-zakat';
import { downloadFarmBookPdf } from './muf/domain/muf-farmbook';
import HeaderSearch from './muf/ui/muf-header-search';
import OfflineBanner from './muf/core/muf-offline-banner';
import FarmProfileCard from './muf/ui/muf-farm-profile';
import { hideMufSplash, initMufPullToRefresh, MufWhatsNew } from './muf/core/muf-applike';
import { MufAreaChart } from './muf/ui/muf-charts';
import { MufCountUpText } from './muf/core/muf-applike';
import { mufToday, mufMonth } from './muf/data/muf-date';
import { mufStoryNet, mufVerdictText, mufDaysBetween } from './muf/data/muf-story';
import { thisMonthKey, lastMonthKey, monthKeyLabel, pctChange, trendArrow, sumMonth, sameMonthLastYearKey } from './muf/data/muf-compare';
import FormOverlay from './muf/core/muf-form-overlay';
import CropOpsPanel from './components/CropOpsPanel';
import LaborBoard from './components/LaborBoard';
import LedgerBookForm from './components/LedgerBookForm';
import SupplierKhata from './components/SupplierKhata';
import { useConfirm } from './muf/core/muf-confirm';
import MufEntityGrid from './muf/ui/muf-entity-grid';
import AgriCropCsvImport from './components/AgriCropCsvImport';
import AgriBulkCsvImport from './components/AgriBulkCsvImport';
import {
  getEmptyCropForm, getEmptyFinForm, getEmptyTaskForm,
  formatCurrency, cropImageMap, getCropImage, getCropProgress,
  buildAgriProfileData, buildAgriComparison,
  buildDashboardIncomeSeries, buildExpenseBreakdown, buildMonthlyComparisonRows,
} from './components/app/agriHelpers';
import {
  Sprout, 
  Coins, 
  CheckSquare, 
  Search,
  LogOut, 
  Plus, 
  Trash2, 
  CheckCircle, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  UserPlus, 
  AlertTriangle,
  Send,
  Loader,
  Circle,
  LayoutDashboard,
  Users,
  Database,
  ArrowUpRight,
  ArrowDownRight,
  Edit3,
  ShieldCheck,
  MapPin,
  Scale,
  Sun,
  Moon,
  BarChart3,
  BarChart2,
  HeartPulse,
  DollarSign,
  Download,
  Printer,
  Home,
  Bell,
  BookOpen,
  ChevronDown,
  Eye,
  EyeOff,
  FileText,
  CloudSun,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  Leaf,
  Droplets,
  Clock,
  HardHat,
  CalendarPlus,
  CalendarDays,
  Ruler,
  Languages
, Share2
} from 'lucide-react';

// Maps a WMO weather code (Open-Meteo `current_weather.weathercode`) to a Lucide
// icon + colour so the live weather widget always reflects the actual sky state.
const WEATHER_ICON = (code) => {
  if (code == null || code === 0) return { Icon: Sun, className: 'text-amber-500' };
  if (code >= 1 && code <= 3) return { Icon: CloudSun, className: 'text-amber-500' };
  if (code >= 45 && code <= 48) return { Icon: CloudFog, className: 'text-slate-400' };
  if (code >= 51 && code <= 67) return { Icon: CloudRain, className: 'text-blue-500' };
  if (code >= 71 && code <= 77) return { Icon: CloudSnow, className: 'text-sky-400' };
  if (code >= 80 && code <= 82) return { Icon: CloudRain, className: 'text-blue-600' };
  if (code >= 85 && code <= 86) return { Icon: CloudSnow, className: 'text-sky-400' };
  if (code >= 95 && code <= 99) return { Icon: CloudLightning, className: 'text-indigo-500' };
  return { Icon: CloudSun, className: 'text-amber-500' };
};

const KG_PER_MAUND = 40;
const KG_PER_SEED_BAG = 50;
const AUTO_SEED_NOTE_PREFIX = 'Automatically logged sowing seed inputs';
const toKg = (value, unit) => {
  const val = parseFloat(value) || 0;
  const u = (unit || '').toLowerCase().trim();
  if (u === 'maund') return val * KG_PER_MAUND;
  if (u === 'ton') return val * KG_PER_MAUND * 25; // 25 * 40 = 1000
  return val; // already kg
};
const seedQtyToKg = (value, unit) => {
  const u = String(unit || 'kg').toLowerCase().trim();
  if (u === 'bag' || u === 'bag_50kg') return (parseFloat(value) || 0) * KG_PER_SEED_BAG;
  return toKg(value, unit);
};
const isLegacySowingSeedCategory = (category) => String(category || '').startsWith('Sowing Seed Purchase');
const isSeedLedgerCategory = (category) => category === 'Seed' || isLegacySowingSeedCategory(category);
const isAutoSeedFinance = (entry) => {
  if (!entry || entry.type !== 'expense') return false;
  return String(entry.notes || '').startsWith(AUTO_SEED_NOTE_PREFIX) || isLegacySowingSeedCategory(entry.category);
};
const buildAutoSeedFinance = (payload, cropId, existing = {}) => {
  const qty = Number(payload.seed_quantity) || 0;
  const unitCost = Number(payload.seed_cost_per_unit) || 0;
  const unit = payload.seed_unit || 'kg';
  const qtyKg = seedQtyToKg(qty, unit);
  const amount = qty * unitCost;
  const pricePerKg = qtyKg > 0 ? amount / qtyKg : unitCost;
  return {
    ...existing,
    category: 'Seed',
    amount,
    type: 'expense',
    crop_id: cropId,
    date: payload.plant_date || existing.date || mufToday(),
    notes: `${AUTO_SEED_NOTE_PREFIX}: ${qty} ${unit} at Rs. ${unitCost}/unit`,
    seed_qty_kg: qtyKg,
    seed_price_per_kg: pricePerKg,
    custom_qty: 0,
    custom_price: 0
  };
};

const formatYield = (kgValue, unit = 'kg') => {
  const kg = parseFloat(kgValue) || 0;
  const u = String(unit || 'kg').toLowerCase().trim();
  if (u === 'maund') return `${(kg / KG_PER_MAUND).toFixed(2)} Maund`;
  if (u === 'ton') return `${(kg / 1000).toFixed(2)} Ton`;
  return `${Number.isInteger(kg) ? kg : kg.toFixed(1)} kg`;
};

const cropNameInText = (text, cropName) => {
  const n = String(cropName || '').toLowerCase().trim();
  if (n.length < 2) return false;
  const t = String(text || '').toLowerCase();
  let from = 0;
  while (from <= t.length) {
    const idx = t.indexOf(n, from);
    if (idx < 0) return false;
    const before = idx > 0 ? t[idx - 1] : ' ';
    const after = t[idx + n.length] || ' ';
    const edge = (ch) => /[^a-z0-9]/.test(ch);
    if (edge(before) && edge(after)) return true;
    from = idx + 1;
  }
  return false;
};

const isIrrigationRelated = (text1, text2) => {
  const blob = `${text1 || ''} ${text2 || ''}`.toLowerCase();
  const terms = ['irrigation', 'irrigate', 'tubewell', 'tube-well', 'sprinkler', 'watering'];
  if (terms.some(term => blob.includes(term))) return true;
  return blob.split(/[^a-z0-9]+/).includes('water');
};

const isOfflineSave = (res) => !!(res && res.data && res.data.offline);
const offlineRecord = (payload, res) => ({
  ...payload,
  _id: (res && res.data && res.data._id) || `offline-${Date.now()}`,
  _offline: true
});

const offlinePendingCount = () => {
  try { return JSON.parse(localStorage.getItem('offline_request_queue') || '[]').length; } catch { return 0; }
};

// buildAgriProfileData extracted to ./components/app/agriHelpers (imported above).

function App() {
  const confirm = useConfirm();
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [userRole, setUserRole] = useState(localStorage.getItem('role') || 'worker');
  const [username, setUsername] = useState(localStorage.getItem('username') || 'Worker');
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [currentUserAvatar, setCurrentUserAvatar] = useState(localStorage.getItem('avatar_base64') || '');
  const [isDbMock, setIsDbMock] = useState(false);
  
  // Custom states for theme, tabs, and text settings
  const [activeTab, setActiveTab] = useState('dashboard');
  // Top navbar selection is intentionally separate from content tabs because
  // several navigation items share the same existing feature view.
  const [activeNav, setActiveNav] = useState('dashboard');
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
  const navRef = useRef(null);
  const navigateTo = (tab, navKey = tab) => {
    setActiveTab(tab);
    setActiveNav(navKey);
  };
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [lang, setLangState] = useState(getLang());

  // muf-applike: fade out the boot splash + enable pull-to-refresh on phones
  useEffect(() => {
    hideMufSplash();
    return initMufPullToRefresh();
  }, []);
  const toggleLang = () => {
    const next = lang === 'en' ? 'ur' : lang === 'ur' ? 'roman' : 'en';
    setCurrentLang(next);
    setLangState(next);
  };
  const [modal, setModal] = useState(null);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [diaryOpen, setDiaryOpen] = useState(false);
  const [legacyDiaryEntries, setLegacyDiaryEntries] = useState(() => {
    try { return JSON.parse(localStorage.getItem('af_diary_entries') || '[]'); } catch { return []; }
  });
  const [diaryEntries, setDiaryEntries] = useState<MufDiaryEntry[]>([]);

  useEffect(() => {
    if (!diaryOpen) return;
    let cancelled = false;
    api.getDiaryEntries().then((response) => {
      if (cancelled) return;
      const saved = Array.isArray(response.data?.entries) ? response.data.entries : [];
      const seen = new Set(saved.map((entry) => entry.id || ('legacy-' + entry.date)));
      const legacy = legacyDiaryEntries.filter((entry) => entry?.date && entry?.note && !seen.has('legacy-' + entry.date))
        .map((entry) => ({ id: 'legacy-' + entry.date, date: entry.date, note: entry.note, photos: [] }));
      setDiaryEntries([...saved, ...legacy].sort((a, b) => b.date.localeCompare(a.date)));
      if (legacy.length) {
        (async () => {
          try {
            const dates = [...new Set(legacy.map((entry) => entry.date))];
            for (const date of dates) {
              const response = await api.getDiaryMedia(date);
              const data = response.data || {};
              let dayEntries: MufDiaryEntry[] = Array.isArray(data.entries) ? data.entries : [];
              if (!dayEntries.length && Array.isArray(data.photos) && data.photos.length) {
                dayEntries.push({ id: 'legacy-photo-' + date, date, note: '', photos: data.photos });
              }
              for (const entry of legacy.filter((item) => item.date === date)) {
                if (!dayEntries.some((item) => item.id === entry.id)) dayEntries.push(entry);
              }
              await api.saveDiaryMedia(date, [], dayEntries);
            }
            localStorage.removeItem('af_diary_entries');
            setLegacyDiaryEntries([]);
          } catch {
            // Leave the local copy intact unless every legacy note was saved.
          }
        })();
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [diaryOpen, legacyDiaryEntries]);

  const saveDiaryEntry = async (entry: MufDiaryEntry) => {
    if (entry.originalDate && entry.originalDate !== entry.date) await deleteDiaryEntry(entry.id, entry.originalDate);
    const response = await api.getDiaryMedia(entry.date);
    const data = response.data || {};
    let dayEntries: MufDiaryEntry[] = Array.isArray(data.entries) ? data.entries : [];
    const legacyPhotos = Array.isArray(data.photos) ? data.photos : [];
    if (!dayEntries.length && legacyPhotos.length) dayEntries = [{ id: 'legacy-photo-' + entry.date, date: entry.date, note: '', photos: legacyPhotos }];
    dayEntries = dayEntries.filter((item) => item.id !== entry.id);
    dayEntries.push(entry);
    const saved = await api.saveDiaryMedia(entry.date, [], dayEntries);
    const normalized = Array.isArray(saved.data?.entries) ? saved.data.entries : dayEntries;
    setDiaryEntries((previous) => [...previous.filter((item) => item.date !== entry.date), ...normalized].sort((a, b) => b.date.localeCompare(a.date)));
  };

  const deleteDiaryEntry = async (id: string, date: string) => {
    const legacyLeft = legacyDiaryEntries.filter((entry) => entry.date !== date);
    if (legacyDiaryEntries.some((entry) => entry.date === date)) {
      setLegacyDiaryEntries(legacyLeft);
      try { localStorage.setItem('af_diary_entries', JSON.stringify(legacyLeft)); } catch { /* server copy remains authoritative */ }
    }
    const response = await api.getDiaryMedia(date);
    const data = response.data || {};
    let dayEntries: MufDiaryEntry[] = Array.isArray(data.entries) ? data.entries : [];
    if (!dayEntries.length && Array.isArray(data.photos) && data.photos.length) dayEntries = [{ id: 'legacy-photo-' + date, date, note: '', photos: data.photos }];
    dayEntries = dayEntries.filter((entry) => entry.id !== id);
    await api.saveDiaryMedia(date, [], dayEntries);
    setDiaryEntries((previous) => previous.filter((entry) => !(entry.date === date && entry.id === id)));
  };

  // Authentication & Password Recovery States
  const [setupDone, setSetupDone] = useState(true);
  const [authMode, setAuthMode] = useState('login'); // 'login', 'register', 'forgot_send', 'forgot_reset'
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPw, setResetNewPw] = useState('');
  
  const [crops, setCrops] = useState([]);
  const [finance, setFinance] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [cropPageRows, setCropPageRows] = useState([]);
  const [cropPageNextSkip, setCropPageNextSkip] = useState(0);
  const [cropPageTotal, setCropPageTotal] = useState(0);
  const [cropPageLoading, setCropPageLoading] = useState(false);
  const [cropPageError, setCropPageError] = useState('');
  const [taskPageRows, setTaskPageRows] = useState([]);
  const [taskPageNextSkip, setTaskPageNextSkip] = useState(0);
  const [taskPageTotal, setTaskPageTotal] = useState(0);
  const [taskPageLoading, setTaskPageLoading] = useState(false);
  const [taskPageError, setTaskPageError] = useState('');
  const [ledgerPageRows, setLedgerPageRows] = useState([]);
  const [ledgerPageNextSkip, setLedgerPageNextSkip] = useState(0);
  const [ledgerPageTotal, setLedgerPageTotal] = useState(0);
  const [ledgerPageLoading, setLedgerPageLoading] = useState(false);
  const [ledgerPageError, setLedgerPageError] = useState('');
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const cropPageRequestRef = useRef(0);
  const taskPageRequestRef = useRef(0);
  const ledgerPageRequestRef = useRef(0);
  const [inventory, setInventory] = useState([]);
  const [liabilities, setLiabilities] = useState([]);
  // Supplier khata (dealers we buy from on credit)
  const [suppliers, setSuppliers] = useState([]);
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [users, setUsers] = useState([]); // Worker management (admin only)
  const [laborers, setLaborers] = useState([]); // Field crew roster (admin only)
  const [todayAttendance, setTodayAttendance] = useState([]); // Today's crew presence (admin only)
  
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' or 'oldest'
  
  const [offlineQueueSize, setOfflineQueueSize] = useState(() => {
    try {
      const queue = JSON.parse(localStorage.getItem('offline_request_queue') || '[]');
      return queue.length;
    } catch {
      return 0;
    }
  });
  
  // Loading & action locks
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState(null); 
  
  // Modals
  const [showCropModal, setShowCropModal] = useState(false);
  const [showCropImport, setShowCropImport] = useState(false);
  const [showTaskImport, setShowTaskImport] = useState(false);
  const [showFinanceImport, setShowFinanceImport] = useState(false);
  const [showFinanceModal, setShowFinanceModal] = useState(false);
  const [financeBookTab, setFinanceBookTab] = useState('ledger');
  const [showTaskModal, setShowTaskModal] = useState(false);
  
  // Edit records storage
  const [editingCrop, setEditingCrop] = useState(null);
  const [editingFinance, setEditingFinance] = useState(null);
  const [editingTask, setEditingTask] = useState(null);

  // Form factories extracted to ./components/app/agriHelpers (pure functions).
  // Kept as locals so existing call sites (getEmptyCropForm()) don't change.
  // (No redefinition — they're imported at the top of the file.)

  // Form states
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  
  const [cropForm, setCropForm] = useState(getEmptyCropForm());
  const [finForm, setFinForm] = useState(getEmptyFinForm());
  const [taskForm, setTaskForm] = useState(getEmptyTaskForm());
  const [liaForm, setLiaForm] = useState({ creditor: '', amount_owed: '', due_date: '', crop_id: 'farm-wide', notes: '' });
  const [invForm, setInvForm] = useState({ name: '', category: 'fertilizer', current_stock: '', unit: 'kg', low_stock_threshold: '' });
  const [showLiabilityModal, setShowLiabilityModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [editingLiabilityId, setEditingLiabilityId] = useState(null);
  const [agriFinanceSubTab, setAgriFinanceSubTab] = useState('ledger');
  const [showPlantedSectorsModal, setShowPlantedSectorsModal] = useState(false);
  const [showCareRosterModal, setShowCareRosterModal] = useState(false);
  const [showRecentActivitiesModal, setShowRecentActivitiesModal] = useState(false);
  const [showLiabilityDetailsModal, setShowLiabilityDetailsModal] = useState(false);
  const [showInventoryDetailsModal, setShowInventoryDetailsModal] = useState(false);

  // Filter States
  const [cropIdFilter, setCropIdFilter] = useState('all'); // Crop Manager tab: specific crop filter
  const [cropFilter, setCropFilter] = useState('all');
  const [cropSeasonFilter, setCropSeasonFilter] = useState('all');
  const [cropYearFilter, setCropYearFilter] = useState('all');
  const [cropSearch, setCropSearch] = useState('');
  const [cropFieldFilter, setCropFieldFilter] = useState('all');
  const [selectedCrop, setSelectedCrop] = useState(null);
  const [selectedFinance, setSelectedFinance] = useState(null);
  const [showCompare, setShowCompare] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedLedgerGroup, setSelectedLedgerGroup] = useState(null);
  const [popupStack, setPopupStack] = useState([]);
  const [selectedMonthRow, setSelectedMonthRow] = useState(null);
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [financeFilter, setFinanceFilter] = useState('all');
  const [financeCropFilter, setFinanceCropFilter] = useState('all');
  const [dashboardCropFilter, setDashboardCropFilter] = useState('all');
  const [reportsCropFilter, setReportsCropFilter] = useState('all');
  const [taskFilter, setTaskFilter] = useState('all');
  const [taskCropFilter, setTaskCropFilter] = useState('all');
  const [rainForecast24h, setRainForecast24h] = useState(0);
  const [breakEvenPrices, setBreakEvenPrices] = useState({});
  // Ushr (per-crop, % picked each time — never stored) + yearly zakat calculator
  const [ushrPcts, setUshrPcts] = useState({});
  const [zakatYear, setZakatYear] = useState(String(new Date().getFullYear()));
  const [zakatPct, setZakatPct] = useState(String(ZAKAT_DEFAULT_PCT));
  const [zakatIncomeOv, setZakatIncomeOv] = useState(null);
  const [zakatExpenseOv, setZakatExpenseOv] = useState(null);
  const [showZakatPopup, setShowZakatPopup] = useState(false);
  const [ledgerModalData, setLedgerModalData] = useState({
    income: 0,
    expense: 0,
    netProfit: 0,
    transactions: [],
    title: L('Operational Ledger Flow')
  });

  const openPopup = (type, data) => {
    const current = {};
    if (selectedCrop) current.selectedCrop = selectedCrop;
    if (selectedFinance) current.selectedFinance = selectedFinance;
    if (selectedTask) current.selectedTask = selectedTask;
    if (selectedLedgerGroup) current.selectedLedgerGroup = selectedLedgerGroup;
    if (selectedMonthRow) current.selectedMonthRow = selectedMonthRow;
    if (selectedExpenseCategory) current.selectedExpenseCategory = selectedExpenseCategory;
    if (modal) current.modal = modal;

    if (Object.keys(current).length > 0) {
      setPopupStack(prev => [...prev, current]);
    }

    if (type === 'selectedCrop') setSelectedCrop(data);
    else if (type === 'selectedFinance') setSelectedFinance(data);
    else if (type === 'selectedTask') setSelectedTask(data);
    else if (type === 'selectedLedgerGroup') setSelectedLedgerGroup(data);
    else if (type === 'modal') setModal(data);
  };

  const closePopup = () => {
    setSelectedCrop(null);
    setSelectedFinance(null);
    setSelectedTask(null);
    setSelectedLedgerGroup(null);
    setSelectedMonthRow(null);
    setSelectedExpenseCategory(null);
    setModal(null);

    if (popupStack.length > 0) {
      const prev = popupStack[popupStack.length - 1];
      setPopupStack(prevStack => prevStack.slice(0, -1));

      if (prev.selectedCrop) setSelectedCrop(prev.selectedCrop);
      if (prev.selectedFinance) setSelectedFinance(prev.selectedFinance);
      if (prev.selectedTask) setSelectedTask(prev.selectedTask);
      if (prev.selectedLedgerGroup) setSelectedLedgerGroup(prev.selectedLedgerGroup);
      if (prev.selectedMonthRow) setSelectedMonthRow(prev.selectedMonthRow);
      if (prev.selectedExpenseCategory) setSelectedExpenseCategory(prev.selectedExpenseCategory);
      if (prev.modal) setModal(prev.modal);
    }
  };

  // Feedback Alert
  const [alertMsg, setAlertMsg] = useState({ text: '', isError: false });

  const showAlert = (text, isError = false) => {
    const cleanText = typeof text === 'string' ? text : JSON.stringify(text);
    setAlertMsg({ text: cleanText, isError });
    setTimeout(() => setAlertMsg({ text: '', isError: false }), 4000);
  };

  // --- PWA Offline Synchronization ---
  const syncOfflineQueue = async () => {
    let queue = [];
    try {
      queue = JSON.parse(localStorage.getItem('offline_request_queue') || '[]');
    } catch {
      return;
    }
    if (queue.length === 0) return;
    
    showAlert(`📶 Connection restored! Syncing ${queue.length} offline changes to server...`);
    
    let successCount = 0;
    const failedItems = [];
    
    for (const req of queue) {
      try {
        await api.default.request({
          url: req.url,
          method: req.method,
          data: req.data
        });
        successCount++;
      } catch (err) {
        console.error("Failed to replay offline request:", req, err);
        failedItems.push(req);
      }
    }
    
    localStorage.setItem('offline_request_queue', JSON.stringify(failedItems));
    setOfflineQueueSize(failedItems.length);
    
    if (failedItems.length > 0) {
      showAlert(`⚠️ Synced: ${successCount} logs saved. ${failedItems.length} changes failed and will be retried when online.`, true);
    } else {
      showAlert(`✅ Synced! All ${successCount} offline logs successfully saved in database.`);
    }
    refreshData();
  };

  useEffect(() => {
    const handleQueued = (e) => {
      setOfflineQueueSize(e.detail);
      showAlert(`📶 Offline Mode: Operational data saved locally! Auto-syncs on reconnect.`);
    };
    window.addEventListener('offline-request-queued', handleQueued);
    window.addEventListener('online', syncOfflineQueue);
    return () => {
      window.removeEventListener('offline-request-queued', handleQueued);
      window.removeEventListener('online', syncOfflineQueue);
    };
  }, []);

  // Sync setup state on launch
  useEffect(() => {
    api.checkSetup()
      .then(res => {
        const done = res.data.setup_done;
        setSetupDone(done);
        setIsDbMock(res.data.is_mock || false);
        if (!done) {
          setAuthMode('register');
        } else {
          setAuthMode('login');
        }
      })
      .catch(() => {
        setSetupDone(true);
        setAuthMode('login');
      });
  }, [token]);

  // Sync isDark with document element & body
  useEffect(() => {
    const root = window.document.documentElement;
    const body = window.document.body;
    if (isDark) {
      root.classList.add('dark');
      body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      body.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  // formatCurrency + cropImageMap + getCropImage + getCropProgress extracted
  // to ./components/app/agriHelpers (pure functions, imported at top of file).

  // cropImageMap + getCropImage extracted to ./components/app/agriHelpers.

  // getCropImage extracted to ./components/app/agriHelpers.

  // getCropProgress extracted to ./components/app/agriHelpers.

  const [weather, setWeatherData] = useState({ temp: '32', condition: 'Partly Cloudy', city: 'Haripur', code: null, humidity: null, soilTemp: null, wind: null });
  
  const fetchWeather = (lat, lon, cityName) => {
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=precipitation,relative_humidity_2m,soil_temperature_0_to_10cm,wind_speed_10m&forecast_days=1`)
      .then(res => res.json())
      .then(data => {
        if (data && data.current_weather) {
          const temp = Math.round(data.current_weather.temperature);
          const code = data.current_weather.weathercode;
          let cond = "Clear Sky";
          if (code >= 1 && code <= 3) cond = "Partly Cloudy";
          else if (code >= 45 && code <= 48) cond = "Foggy";
          else if (code >= 51 && code <= 67) cond = "Rainy / Showers";
          else if (code >= 71 && code <= 77) cond = "Snowy";
          else if (code >= 80 && code <= 99) cond = "Stormy / Rain";

          // Snapshot extra agro-relevant fields at the current-weather hour.
          // Each is optional: if Open-Meteo doesn't return it for this
          // location/model, it stays null and the advice rules skip it.
          const h = data.hourly || {};
          let idx = 0;
          if (h.time && data.current_weather.time) {
            const i = h.time.indexOf(data.current_weather.time);
            if (i >= 0) idx = i;
          }
          const humidity = h.relative_humidity_2m ? h.relative_humidity_2m[idx] : null;
          const soilTemp = h.soil_temperature_0_to_10cm ? h.soil_temperature_0_to_10cm[idx] : null;
          const wind = (data.current_weather.windspeed != null) ? data.current_weather.windspeed : (h.wind_speed_10m ? h.wind_speed_10m[idx] : null);

          setWeatherData({
            temp: temp.toString(),
            condition: cond,
            code: code,
            city: cityName,
            humidity: humidity != null ? Math.round(humidity) : null,
            soilTemp: soilTemp != null ? Math.round(soilTemp) : null,
            wind: wind != null ? Math.round(wind) : null
          });
        }
        if (data && data.hourly && data.hourly.precipitation) {
          const next24hPrecipitation = data.hourly.precipitation.slice(0, 24).reduce((sum, val) => sum + (val || 0), 0);
          setRainForecast24h(next24hPrecipitation);
        }
      })
      .catch(err => console.warn("Failed to fetch Open-Meteo weather data:", err));
  };

  useEffect(() => {
    if (!token) return;
    // Weather location priority:
    //   1. Admin-saved farm coordinates (backend settings) — no browser
    //      permission prompt and no IP-geolocation lookup.
    //   2. Hardcoded Haripur default until an admin sets a real location.
    // When saved coordinates exist without a stored city label, reverse-geocode
    // them once to auto-derive the city name from the coordinates.
    api.getFarmLocation()
      .then(res => {
        const loc = res.data || {};
        if (loc.lat != null && loc.lon != null) {
          if (loc.city) {
            fetchWeather(loc.lat, loc.lon, loc.city);
          } else {
            fetch(`https://nominatim.openstreetmap.org/reverse?lat=${loc.lat}&lon=${loc.lon}&format=json`)
              .then(r => r.json())
              .then(geo => {
                const cityName = geo.address?.city || geo.address?.town || geo.address?.village || geo.address?.suburb || geo.address?.county || "My Location";
                fetchWeather(loc.lat, loc.lon, cityName);
              })
              .catch(() => fetchWeather(loc.lat, loc.lon, "My Location"));
          }
        } else {
          fetchWeather(33.9943, 72.9106, "Haripur");
        }
      })
      .catch(() => {
        fetchWeather(33.9943, 72.9106, "Haripur");
      });
  }, [token]);

  // Dynamic seasonal advice — a rules engine (no hardcoded single message).
  // Combines live weather (temp, condition, humidity, soil temp, wind), the
  // 24h rain forecast amount, the current Rabi/Kharif season, and your actual
  // planted crops + pending irrigation tasks to assemble tailored guidance.
  // Every extra field is optional, so missing data just skips that rule.
  const getFarmingTip = () => {
    const temp = Number(weather.temp) || 30;
    const cond = String(weather.condition).toLowerCase();
    const humidity = weather.humidity != null ? Number(weather.humidity) : null;
    const soilTemp = weather.soilTemp != null ? Number(weather.soilTemp) : null;
    const wind = weather.wind != null ? Number(weather.wind) : null;
    const rain = Number(rainForecast24h) || 0;

    // Pakistan cropping calendar: Rabi = Oct–Mar (wheat, mustard, peas),
    // Kharif = Apr–Sep (rice, corn, cotton, bajra).
    const month = Number(mufMonth().slice(5, 7));
    const season = (month >= 10 || month <= 3) ? 'Rabi' : 'Kharif';

    // Your active crops (Growing/Planted/Harvesting) — advice references them.
    const active = crops.filter(c => ['Growing', 'Planted', 'Harvesting'].includes(c.status) && (dashboardCropFilter === 'all' || c._id === dashboardCropFilter));
    const activeNames = active.slice(0, 3).map(c => c.name).filter(Boolean);
    const cropHint = activeNames.length ? ` for your ${activeNames.join(', ')}` : '';

    // Pending irrigation/watering tasks on the roster.
    const pendingIrrigation = tasks.filter(t => t.status === 'Pending' && isIrrigationRelated(t.title, t.notes)).length;

    const tips = [];

    // 1. Imminent rainfall (uses the actual forecast amount, not just a flag)
    if (rain > 10) {
      tips.push(`Heavy rain ahead (~${rain.toFixed(0)}mm in 24h). Pause all irrigation and spraying${cropHint}; clear field drainage channels to prevent waterlogging.`);
    } else if (rain > 5) {
      tips.push(`Rain expected (~${rain.toFixed(0)}mm in 24h). Hold off sprinkler irrigation${pendingIrrigation ? ` — you have ${pendingIrrigation} irrigation task${pendingIrrigation > 1 ? 's' : ''} pending; consider postponing` : ''}.`);
    } else if (rain > 0.5) {
      tips.push(`Light showers possible (~${rain.toFixed(1)}mm). Skip today's watering${cropHint} and let natural moisture soak in.`);
    }

    // 2. Temperature stress bands
    if (temp > 38) {
      tips.push(`Extreme heat (${temp}°C). Irrigate only early morning or evening${cropHint} to prevent heat stress and soil cracking.`);
    } else if (temp > 32) {
      tips.push(`High temperature (${temp}°C). Increase irrigation frequency and mulch exposed soil${cropHint} to retain moisture.`);
    } else if (temp < 5) {
      tips.push(`Very cold (${temp}°C). Delay any new sowing and protect young seedlings${cropHint} with cover or mulch.`);
    } else if (temp < 12) {
      tips.push(`Cool conditions (${temp}°C). Hold off sowing warm-season crops${cropHint}; preserve soil warmth with organic mulch.`);
    }

    // 3. Humidity-driven disease / drying risk
    if (humidity != null && humidity >= 85 && temp >= 20) {
      tips.push(`High humidity (${humidity}%) with warmth raises fungal disease risk${cropHint}. Scout leaves for mildew/blast and have a preventive fungicide spray ready.`);
    } else if (humidity != null && humidity <= 25 && temp > 25) {
      tips.push(`Very dry air (${humidity}%). Soil is drying fast — irrigate deeply${cropHint} and mulch to lock in moisture.`);
    }

    // 4. Wind caution for spray applications / lodging
    if (wind != null && wind >= 30) {
      tips.push(`Strong winds (${wind} km/h). Avoid pesticide/spray applications${cropHint} due to drift risk; check stakes and tall crops for lodging.`);
    }

    // 5. Soil-temperature sowing window (crop calendar aware)
    if (soilTemp != null) {
      if (season === 'Rabi' && soilTemp >= 15 && soilTemp <= 25) {
        tips.push(`Soil temperature is ideal (${soilTemp}°C) for Rabi sowing${cropHint}. Good window to plant wheat, mustard, or peas.`);
      } else if (season === 'Kharif' && soilTemp >= 22 && soilTemp <= 32) {
        tips.push(`Soil temperature is favorable (${soilTemp}°C) for Kharif sowing${cropHint}. Good window for rice nursery, corn, or bajra.`);
      } else if (soilTemp < 10) {
        tips.push(`Soil is still cold (${soilTemp}°C). Delay sowing until it warms above 12°C${cropHint}.`);
      }
    }

    // 6. Fallback — general guidance only when no specific rule fired
    if (tips.length === 0) {
      if (cond.includes("rain") || cond.includes("storm")) {
        tips.push(`Wet conditions. Pause irrigation${cropHint} and ensure drainage pathways are clear.`);
      } else if (season === 'Rabi') {
        tips.push(`Ideal Rabi conditions${cropHint}. Apply organic nutrient treatments, check soil pH, and monitor for aphids on wheat.`);
      } else {
        tips.push(`Ideal sunny conditions${cropHint}. Apply organic nutrient treatments, check soil pH, and scout for fall armyworm on corn.`);
      }
    }

    // Combine the top two relevant notes into one advice line for the panel.
    return tips.slice(0, 2).join(' ');
  };

  useEffect(() => { 
    if (token) { 
      setLoading(true);
      refreshData().finally(() => setLoading(false));
    } 
  }, [token]);

  const refreshData = async () => {
    // Read the backend's page metadata rather than assuming a fixed total or
    // stopping at an arbitrary 10,000-row ceiling. Aggregate/report consumers
    // still receive the complete scoped dataset; the list endpoints remain
    // bounded at 500 records per request.
    const fetchAllPages = async (fetchFn) => {
      const pageSize = 500;
      const first = await fetchFn(0, pageSize);
      if (!Array.isArray(first.data)) throw new Error('Paginated API returned a non-array payload.');
      const all = [...first.data];
      const rawTotal = first.headers?.['x-total-count'] ?? first.headers?.['X-Total-Count'];
      const total = Number(rawTotal);
      const appendUnique = (rows) => {
        // A concurrent insert/delete can shift offset pages while a refresh is in
        // progress. Deduplicate stable IDs so the UI never renders the same record
        // twice; retain ID-less legacy records rather than dropping valid data.
        const seen = new Set(all.filter((row) => row?._id != null).map((row) => String(row._id)));
        for (const row of rows) {
          if (row?._id == null || !seen.has(String(row._id))) {
            all.push(row);
            if (row?._id != null) seen.add(String(row._id));
          }
        }
      };
      if (Number.isFinite(total) && total >= 0) {
        const pageCount = Math.ceil(total / pageSize);
        for (let page = 1; page < pageCount; page += 1) {
          const res = await fetchFn(page * pageSize, pageSize);
          if (!Array.isArray(res.data)) throw new Error('Paginated API returned a non-array payload.');
          const reportedTotal = Number(res.headers?.['x-total-count'] ?? res.headers?.['X-Total-Count']);
          if (Number.isFinite(reportedTotal) && reportedTotal !== total) {
            throw new Error(`Pagination total changed during refresh (${total} to ${reportedTotal}); retry the refresh.`);
          }
          appendUnique(res.data);
        }
        if (all.length < total) {
          throw new Error(`Paginated API returned ${all.length} unique records for a reported total of ${total}. The dataset may have changed during refresh; retry.`);
        }
        return all.slice(0, total);
      }

      // Compatibility fallback for older servers without pagination headers.
      // A short page proves completion; a full page means another request is needed.
      let skip = first.data.length;
      let previousPageSize = first.data.length;
      while (previousPageSize === pageSize) {
        const res = await fetchFn(skip, pageSize);
        if (!Array.isArray(res.data)) throw new Error('Paginated API returned a non-array payload.');
        appendUnique(res.data);
        previousPageSize = res.data.length;
        skip += res.data.length;
      }
      return all;
    };
    try {
      const cropsRes = await fetchAllPages(api.getCrops); setCrops(cropsRes);
      const tasksRes = await fetchAllPages(api.getTasks); setTasks(tasksRes);

      // Money/stock/roster data is admin-only — the backend returns 403 for
      // workers, so don't even request it for them.
      if (userRole === 'admin') {
        const invRes = await api.getInventory(); setInventory(invRes.data);
        const finRes = await fetchAllPages(api.getFinance); setFinance(finRes);
        const liaRes = await api.getLiabilities(); setLiabilities(liaRes.data);
        try {
          const supRes = await api.getSuppliers(); setSuppliers(supRes.data);
          const supPayRes = await api.getAllSupplierPayments(); setSupplierPayments(supPayRes.data);
        } catch { setSuppliers([]); setSupplierPayments([]); }
        const usersRes = await api.getUsers(); setUsers(usersRes.data);
        const labRes = await api.getLaborers(); setLaborers(labRes.data);
        const attRes = await api.getAttendance(mufMonth()); setTodayAttendance(attRes.data);
      } else {
        setInventory([]);
        setFinance([]);
        setLiabilities([]);
        setSuppliers([]);
        setSupplierPayments([]);
      }
      try {
        const meRes = await api.getMe();
        setCurrentUserEmail(meRes.data.email || '');
        setCurrentUserAvatar(meRes.data.avatar_base64 || '');
        localStorage.setItem('avatar_base64', meRes.data.avatar_base64 || '');
      } catch (meErr) {
        console.warn("Could not load current user profile:", meErr);
      }
    } catch (err) {
      console.error("Data refresh failed:", err);
      if (err.response?.status === 401) performLogout();
    }
    setListRefreshKey((value) => value + 1);
  };

  const fetchCropPage = async (skip, filters, reset = false) => {
    const id = ++cropPageRequestRef.current;
    if (reset) { setCropPageRows([]); setCropPageNextSkip(0); setCropPageTotal(0); }
    setCropPageLoading(true); setCropPageError('');
    try {
      const res = await api.getCrops(skip, AGRI_LIST_PAGE_SIZE, filters);
      if (id !== cropPageRequestRef.current) return;
      if (!Array.isArray(res.data)) throw new Error('Crop page response was not an array.');
      setCropPageRows((rows) => mergeAgriPageRows(reset ? [] : rows, res.data));
      setCropPageNextSkip(skip + res.data.length);
      setCropPageTotal(getAgriPageTotal(res.headers, skip + res.data.length));
    } catch (err) {
      if (id === cropPageRequestRef.current) setCropPageError(err?.response?.data?.error || err?.message || 'Could not load crop records.');
    } finally { if (id === cropPageRequestRef.current) setCropPageLoading(false); }
  };

  const fetchTaskPage = async (skip, filters, reset = false) => {
    const id = ++taskPageRequestRef.current;
    if (reset) { setTaskPageRows([]); setTaskPageNextSkip(0); setTaskPageTotal(0); }
    setTaskPageLoading(true); setTaskPageError('');
    try {
      const res = await api.getTasks(skip, AGRI_LIST_PAGE_SIZE, filters);
      if (id !== taskPageRequestRef.current) return;
      if (!Array.isArray(res.data)) throw new Error('Task page response was not an array.');
      setTaskPageRows((rows) => mergeAgriPageRows(reset ? [] : rows, res.data));
      setTaskPageNextSkip(skip + res.data.length);
      setTaskPageTotal(getAgriPageTotal(res.headers, skip + res.data.length));
    } catch (err) {
      if (id === taskPageRequestRef.current) setTaskPageError(err?.response?.data?.error || err?.message || 'Could not load task records.');
    } finally { if (id === taskPageRequestRef.current) setTaskPageLoading(false); }
  };

  const fetchLedgerPage = async (group, skip, reset = false, type = financeFilter) => {
    if (!group) return;
    const id = ++ledgerPageRequestRef.current;
    if (reset) { setLedgerPageRows([]); setLedgerPageNextSkip(0); setLedgerPageTotal(0); }
    setLedgerPageLoading(true); setLedgerPageError('');
    const filters = { type };
    if (group.id === 'farm-wide') filters.farm_wide = 'true'; else filters.crop_id = group.id;
    try {
      const res = await api.getFinance(skip, AGRI_LIST_PAGE_SIZE, filters);
      if (id !== ledgerPageRequestRef.current) return;
      if (!Array.isArray(res.data)) throw new Error('Ledger page response was not an array.');
      setLedgerPageRows((rows) => mergeAgriPageRows(reset ? [] : rows, res.data));
      setLedgerPageNextSkip(skip + res.data.length);
      setLedgerPageTotal(getAgriPageTotal(res.headers, skip + res.data.length));
    } catch (err) {
      if (id === ledgerPageRequestRef.current) setLedgerPageError(err?.response?.data?.error || err?.message || 'Could not load ledger entries.');
    } finally { if (id === ledgerPageRequestRef.current) setLedgerPageLoading(false); }
  };

  const openLedgerGroup = (group) => {
    setSelectedLedgerGroup(group);
  };

  useEffect(() => {
    if (!selectedLedgerGroup) {
      ledgerPageRequestRef.current += 1;
      setLedgerPageRows([]);
      setLedgerPageNextSkip(0);
      setLedgerPageTotal(0);
      setLedgerPageError('');
      return undefined;
    }
    void fetchLedgerPage(selectedLedgerGroup, 0, true, financeFilter);
    return () => { ledgerPageRequestRef.current += 1; };
  }, [selectedLedgerGroup?.id, financeFilter, listRefreshKey]);

  const performLogout = () => {
    // Preserve theme preference and the offline request queue on sign-out
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    localStorage.removeItem('avatar_base64');
    api.logout().catch(() => {});
    setToken(null);
    setUserRole('worker');
    setUsername('Worker');
    window.location.reload();
  };

  const handleLogout = async () => {
    const ok = await confirm({
      title: L('Sign Out'),
      message: L('Are you sure you want to sign out of Usman Agri Farm?'),
      tone: 'warning',
      confirmLabel: L('Sign Out'),
      cancelLabel: L('Cancel')
    });
    if (!ok) return;
    performLogout();
  };

  // --- Login / Signup Actions ---
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (authMode === 'register') {
      if (!authForm.username || !authForm.email || !authForm.password || !authForm.confirmPassword) {
        return showAlert("Please complete all initial signup fields.", true);
      }
      if (authForm.password !== authForm.confirmPassword) {
        return showAlert("Passwords do not match. Please verify your password confirmation.", true);
      }
    } else {
      if (!authForm.username || !authForm.password) {
        return showAlert("Please enter your login credentials.", true);
      }
    }

    setLoading(true);
    try {
      if (authMode === 'register') {
        // Initial setup signup: first user created is always an administrator!
        await api.signup(authForm.username, authForm.email, authForm.password, 'admin');
        showAlert("Administrator registered successfully! Please log in.");
        setAuthForm({ username: '', email: '', password: '' });
        setAuthMode('login');
        setSetupDone(true);
      } else {
        // Login: accepts email or username
        const res = await api.login(authForm.username, authForm.password);
        localStorage.setItem('token', res.data.access_token);
        localStorage.setItem('role', res.data.role);
        
        const cleanName = res.data.username || authForm.username.split('@')[0];
        localStorage.setItem('username', cleanName);

        setToken(res.data.access_token);
        setUserRole(res.data.role);
        setUsername(cleanName);
        showAlert("Welcome back to Usman Agri Farm!");
      }
    } catch (err) {
      let errMsg = "Authentication failed. Please verify credentials.";
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (typeof detail === 'string') {
          errMsg = detail;
        } else if (Array.isArray(detail)) {
          // Cleanly extract the first Pydantic validation error message
          errMsg = detail[0]?.msg || JSON.stringify(detail);
        } else {
          errMsg = JSON.stringify(detail);
        }
      }
      showAlert(errMsg, true);
    } finally {
      setLoading(false);
    }
  };

  // --- Password Recovery (Admin Only) ---
  const handleForgotSendCode = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return showAlert("Administrator email is required.", true);
    setLoading(true);
    try {
      await api.forgotPassword(forgotEmail);
      showAlert("Verification code emailed to you successfully!");
      setAuthMode('forgot_reset');
    } catch (err) {
      showAlert(err.response?.data?.detail || "Failed to trigger email code.", true);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotResetPw = async (e) => {
    e.preventDefault();
    if (!forgotEmail || !resetCode || !resetNewPw) {
      return showAlert("Please complete all fields.", true);
    }
    setLoading(true);
    try {
      await api.resetPassword(forgotEmail, resetCode, resetNewPw);
      showAlert("Password successfully reset! Please log in.");
      setForgotEmail('');
      setResetCode('');
      setResetNewPw('');
      setAuthMode('login');
    } catch (err) {
      showAlert(err.response?.data?.detail || "Reset verification failed.", true);
    } finally {
      setLoading(false);
    }
  };

  const compressAndConvertToBase64 = (file, callback) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_DIM = 400;
        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        callback(compressedBase64);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  // --- Crops Actions ---
  const handleCropSubmit = async (e) => {
    e.preventDefault();
    if (!cropForm.name.trim()) return showAlert("Crop name is required.", true);
    try {
      const payload = {
        ...cropForm,
        yield_kg: cropForm.yield_kg ? parseFloat(cropForm.yield_kg) : 0.0,
        area_kanal: cropForm.area_kanal ? parseFloat(cropForm.area_kanal) : 1.0,
        seed_quantity: cropForm.seed_quantity ? parseFloat(cropForm.seed_quantity) : 0.0,
        seed_cost_per_unit: cropForm.seed_cost_per_unit ? parseFloat(cropForm.seed_cost_per_unit) : 0.0
      };
      
      let savedCrop = null;
      let cropSaveRes = null;
      if (editingCrop) {
        const res = await api.updateCrop(editingCrop._id, payload);
        cropSaveRes = res;
        savedCrop = res.data;
        showAlert(isOfflineSave(res) ? "Saved on this device. It will sync when you reconnect." : "Crop developments updated successfully!");
        
        // Update auto-logged seed cost under the existing Seed category boxes
        const totalSeedCost = payload.seed_quantity * payload.seed_cost_per_unit;
        const existingSeedFin = finance.find(f => f.crop_id === editingCrop._id && isAutoSeedFinance(f));
        
        if (existingSeedFin) {
          if (totalSeedCost > 0) {
            try {
              await api.updateFinance(existingSeedFin._id, buildAutoSeedFinance(payload, editingCrop._id, existingSeedFin));
            } catch (finErr) {
              console.warn("Failed to update auto-logged seed expense:", finErr);
            }
          } else {
            // Sowing seed cost is now 0, delete the transaction
            try {
              await api.deleteFinance(existingSeedFin._id);
            } catch (finErr) {
              console.warn("Failed to delete auto-logged seed expense:", finErr);
            }
          }
        } else if (totalSeedCost > 0 && savedCrop && savedCrop._id) {
          // It didn't exist before, but now totalSeedCost > 0, so create it!
          try {
            await api.addFinance(buildAutoSeedFinance(payload, savedCrop._id));
          } catch (finErr) {
            console.warn("Failed to auto-log seed expense on edit:", finErr);
          }
        }
      } else {
        const res = await api.addCrop(payload);
        cropSaveRes = res;
        savedCrop = res.data;
        showAlert(isOfflineSave(res) ? "Saved on this device. It will sync when you reconnect." : "Crop cycle successfully planted & logged!");
        
        // Auto-log seed inputs as a Seed-category ledger entry (qty + price boxes)
        const totalSeedCost = payload.seed_quantity * payload.seed_cost_per_unit;
        if (totalSeedCost > 0 && savedCrop && savedCrop._id) {
          try {
            await api.addFinance(buildAutoSeedFinance(payload, savedCrop._id));
          } catch (finErr) {
            console.warn("Failed to auto-log seed expense:", finErr);
          }
        }
      }
      
      setCropForm(getEmptyCropForm());
      setEditingCrop(null);
      setShowCropModal(false);
      if (editingCrop) {
        const localCrop = { ...(editingCrop || {}), ...(savedCrop || {}), ...payload, _id: editingCrop._id };
        setCrops(prev => prev.map(c => c._id === editingCrop._id ? localCrop : c));
      } else if (isOfflineSave(cropSaveRes)) {
        setCrops(prev => [offlineRecord(payload, cropSaveRes), ...prev]);
      } else if (savedCrop && savedCrop._id) {
        setCrops(prev => [savedCrop, ...prev.filter(c => c._id !== savedCrop._id)]);
      }
      // Refresh derived lists (including seed-ledger entries) in the background;
      // the crop list above is already reconciled for immediate feedback.
      if (!isOfflineSave(cropSaveRes)) void refreshData();
    } catch (err) {
      showAlert("Failed to save crop entry.", true);
    }
  };

  const handleEditCrop = (crop) => {
    setEditingCrop(crop);
    setCropForm({
      name: crop.name,
      variety: crop.variety || '',
      status: crop.status || 'Growing',
      plant_date: crop.plant_date || '',
      harvest_date: crop.harvest_date || '',
      field: crop.field || '',
      yield_kg: crop.yield_kg || '',
      yield_unit: crop.yield_unit || 'kg',
      area_kanal: crop.area_kanal ? crop.area_kanal.toString() : '1.0',
      notes: crop.notes || '',
      image_base64: crop.image_base64 || '',
      seed_quantity: crop.seed_quantity ? crop.seed_quantity.toString() : '0',
      seed_unit: crop.seed_unit || 'kg',
      seed_cost_per_unit: crop.seed_cost_per_unit ? crop.seed_cost_per_unit.toString() : '0',
      season: crop.season || 'Rabi',
      crop_year: crop.crop_year ? crop.crop_year.toString() : new Date().getFullYear().toString()
    });
    setShowCropModal(true);
  };

  const handleDeleteCrop = async (id) => {
    const ok = await confirm({
      title: L('Delete Crop Record'),
      message: L('Delete this crop record? Linked ledger entries will remain. This cannot be undone.'),
      tone: 'danger',
      confirmLabel: L('Delete'),
      cancelLabel: L('Cancel')
    });
    if (!ok) return;
    setActionId(id);
    try {
      await api.deleteCrop(id);
      setCrops(prev => prev.filter(c => c._id !== id));
      showAlert("Crop cycle record removed successfully!");
      // Keep the confirmed local removal; an immediate refetch can return a stale cached list.
    } catch (err) {
      showAlert("Failed to remove crop.", true);
    } finally {
      setActionId(null);
    }
  };

  const handlePlanNext = (crop) => {
    if (!crop) return;
    const season = crop.season || 'Rabi';
    const year = parseInt(crop.crop_year, 10) || new Date().getFullYear();
    let nextSeason = season;
    let nextYear = year;
    if (String(season).toLowerCase() === 'rabi') {
      nextSeason = 'Kharif';
      nextYear = year + 1;
    } else if (String(season).toLowerCase() === 'kharif') {
      nextSeason = 'Rabi';
      nextYear = year;
    }
    const spent = finance
      .filter(f => f.crop_id === crop._id && f.type === 'expense')
      .reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
    setEditingCrop(null);
    setCropForm({
      ...getEmptyCropForm(),
      name: crop.name,
      variety: crop.variety || '',
      status: 'Planted',
      field: crop.field || '',
      area_kanal: crop.area_kanal ? crop.area_kanal.toString() : '1.0',
      seed_quantity: crop.seed_quantity ? crop.seed_quantity.toString() : '0',
      seed_unit: crop.seed_unit || 'kg',
      seed_cost_per_unit: crop.seed_cost_per_unit ? crop.seed_cost_per_unit.toString() : '0',
      season: nextSeason,
      crop_year: String(nextYear),
      notes: `Planned from ${crop.season || ''} ${crop.crop_year || ''} cycle. Last spend Rs. ${formatCurrency(spent)}.`
    });
    setSelectedCrop(null);
    setShowCropModal(true);
  };

  // --- Finance Actions ---
  const handleFinanceSubmit = async (e) => {
    e.preventDefault();
    if (!editingFinance && financeBookTab === 'irrigation') {
      if (!finForm.crop_id || finForm.crop_id === 'farm-wide') {
        return showAlert('Irrigation must be linked to a crop.', true);
      }
      const hours = parseFloat(finForm.hours);
      if (!hours || hours <= 0) return showAlert('Enter irrigation hours.', true);
      if ((finForm.tubewell || 'rented') === 'rented' && !(parseFloat(finForm.hourly_rate) > 0)) {
        return showAlert('Rented tubewell needs an hourly rate.', true);
      }
      try {
        await api.addIrrigation({
          crop_id: finForm.crop_id,
          date: finForm.date || mufToday(),
          hours,
          tubewell: finForm.tubewell || 'rented',
          hourly_rate: (finForm.tubewell || 'rented') === 'rented' ? parseFloat(finForm.hourly_rate) : 0,
          notes: finForm.notes
        });
        showAlert((finForm.tubewell || 'rented') === 'rented'
          ? `Irrigation logged and Rs. ${formatCurrency(hours * (parseFloat(finForm.hourly_rate) || 0))} posted to the ledger.`
          : 'Own-tubewell hours logged (no diesel / no ledger charge).');
        setFinForm(getEmptyFinForm());
        setEditingFinance(null);
        setFinanceBookTab('ledger');
        setShowFinanceModal(false);
        refreshData();
      } catch (err) {
        showAlert(err.response?.data?.detail || 'Failed to log irrigation.', true);
      }
      return;
    }
    if (!editingFinance && financeBookTab === 'spray') {
      if (!finForm.crop_id || finForm.crop_id === 'farm-wide') {
        return showAlert('Spray must be linked to a crop.', true);
      }
      if (!String(finForm.chemical || '').trim()) return showAlert('Chemical name is required.', true);
      try {
        await api.addSprayLog({
          crop_id: finForm.crop_id,
          date: finForm.date || mufToday(),
          chemical: String(finForm.chemical).trim(),
          dose: finForm.dose,
          notes: finForm.notes,
          image_base64: finForm.spray_image,
          inventory_item_id: finForm.inventory_item_id || null,
          inventory_qty_consumed: finForm.inventory_item_id ? (parseFloat(finForm.inventory_qty_consumed) || 0) : 0
        });
        showAlert('Spray logged.');
        setFinForm(getEmptyFinForm());
        setEditingFinance(null);
        setFinanceBookTab('ledger');
        setShowFinanceModal(false);
        refreshData();
      } catch (err) {
        showAlert(err.response?.data?.detail || 'Failed to log spray.', true);
      }
      return;
    }
    const bookForm = { ...finForm };
    if (financeBookTab === 'labor') {
      bookForm.category = 'Labor';
      bookForm.type = 'expense';
    } else if (financeBookTab === 'fertilizer') {
      bookForm.category = 'Fertilizer';
      bookForm.type = 'expense';
    }
    if (!bookForm.category.trim()) {
      return showAlert("Please complete description/category field.", true);
    }
    let amt = parseFloat(bookForm.amount || '0');
    const qty = parseFloat(bookForm.quantity_sold || '0');
    const rate = parseFloat(bookForm.rate_per_unit || '0');
    
    // Auto calculate if sales quantities exist
    if (bookForm.type === 'income' && qty > 0 && rate > 0) {
      amt = qty * rate;
    }

    const seedQty = parseFloat(bookForm.seed_qty_kg || '0');
    const seedPrice = parseFloat(bookForm.seed_price_per_kg || '0');
    const ploughHours = parseFloat(bookForm.plough_hours || '0');
    const cultivatorHours = parseFloat(bookForm.cultivator_hours || '0');
    const fuelCost = parseFloat(bookForm.fuel_cost || '0');
    const hourlyRate = parseFloat(bookForm.hourly_rate || '0');
    const laborWorkers = parseFloat(bookForm.labor_workers || '0');
    const laborDays = parseFloat(bookForm.labor_days || '0');
    const laborWageRate = parseFloat(bookForm.labor_wage_rate || '0');
    const fertilizerBags = parseFloat(bookForm.fertilizer_bags || '0');
    const fertilizerPricePerBag = parseFloat(bookForm.fertilizer_price_per_bag || '0');
    const customQty = parseFloat(bookForm.custom_qty || '0');
    const customPrice = parseFloat(bookForm.custom_price || '0');

    if (bookForm.type === 'expense' && bookForm.category === 'Seed') {
      if (seedQty > 0 && seedPrice > 0) amt = seedQty * seedPrice;
    } else if (bookForm.type === 'expense' && bookForm.category === 'Hal (Plough)') {
      if ((ploughHours > 0 && hourlyRate > 0) || fuelCost > 0) amt = (ploughHours * hourlyRate) + fuelCost;
    } else if (bookForm.type === 'expense' && bookForm.category === 'Cultivator') {
      if ((cultivatorHours > 0 && hourlyRate > 0) || fuelCost > 0) amt = (cultivatorHours * hourlyRate) + fuelCost;
    } else if (bookForm.type === 'expense' && bookForm.category === 'Labor') {
      if (laborWorkers > 0 && laborDays > 0 && laborWageRate > 0) amt = laborWorkers * laborDays * laborWageRate;
    } else if (bookForm.type === 'expense' && bookForm.category === 'Fertilizer') {
      if (fertilizerBags > 0 && fertilizerPricePerBag > 0) amt = fertilizerBags * fertilizerPricePerBag;
    } else if (!["Seed", "Cultivator", "Hal (Plough)", "Fertilizer", "Labor"].includes(bookForm.category)) {
      if (customQty > 0 && customPrice > 0) {
        amt = customQty * customPrice;
      }
    }
    
    if (isNaN(amt) || amt <= 0) return showAlert("Total Transaction amount must be a positive number.", true);

    try {
      const {
        tubewell,
        hours,
        chemical,
        dose,
        spray_image,
        inventory_item_id,
        inventory_qty_consumed,
        ...ledgerFields
      } = bookForm;
      const payload = {
        ...ledgerFields,
        amount: amt,
        crop_id: bookForm.crop_id === 'farm-wide' ? null : bookForm.crop_id,
        quantity_sold: qty,
        rate_per_unit: rate,
        seed_qty_kg: seedQty,
        seed_price_per_kg: seedPrice,
        plough_hours: ploughHours,
        cultivator_hours: cultivatorHours,
        fuel_cost: fuelCost,
        hourly_rate: hourlyRate,
        labor_workers: laborWorkers,
        labor_days: laborDays,
        labor_wage_rate: laborWageRate,
        fertilizer_bags: fertilizerBags,
        fertilizer_price_per_bag: fertilizerPricePerBag,
        custom_qty: customQty,
        custom_price: customPrice
      };
      let saveRes;
      if (editingFinance) {
        saveRes = await api.updateFinance(editingFinance._id, payload);
        showAlert(isOfflineSave(saveRes) ? "Saved on this device. It will sync when you reconnect." : "Ledger transaction successfully updated!");
      } else {
        saveRes = await api.addFinance(payload);
        showAlert(isOfflineSave(saveRes) ? "Saved on this device. It will sync when you reconnect." : "Financial transaction successfully recorded!");
      }
      setFinForm(getEmptyFinForm());
      setEditingFinance(null);
      setFinanceBookTab('ledger');
      setShowFinanceModal(false);
      if (editingFinance) {
        setFinance(prev => prev.map(f => f._id === editingFinance._id ? { ...f, ...payload } : f));
      } else if (isOfflineSave(saveRes)) {
        setFinance(prev => [offlineRecord(payload, saveRes), ...prev]);
      } else {
        // The existing finance API returns {status:'ok'} rather than the saved
        // document. Use a temporary client id until the authoritative reload
        // supplies the server id; do not modify the backend contract.
        setFinance(prev => [{ ...payload, _id: `pending-ui-${Date.now()}` }, ...prev]);
      }
      if (!isOfflineSave(saveRes)) void refreshData();
    } catch (err) {
      showAlert("Failed to save ledger entry.", true);
    }
  };

  const handleFinanceFieldChange = (field, val) => {
    const nextForm = { ...finForm, [field]: val };
    
    const seedQty = parseFloat(field === 'seed_qty_kg' ? val : nextForm.seed_qty_kg) || 0;
    const seedPrice = parseFloat(field === 'seed_price_per_kg' ? val : nextForm.seed_price_per_kg) || 0;
    
    const ploughHours = parseFloat(field === 'plough_hours' ? val : nextForm.plough_hours) || 0;
    const cultivatorHours = parseFloat(field === 'cultivator_hours' ? val : nextForm.cultivator_hours) || 0;
    const fuelCost = parseFloat(field === 'fuel_cost' ? val : nextForm.fuel_cost) || 0;
    const hourlyRate = parseFloat(field === 'hourly_rate' ? val : nextForm.hourly_rate) || 0;
    
    const laborWorkers = parseFloat(field === 'labor_workers' ? val : nextForm.labor_workers) || 0;
    const laborDays = parseFloat(field === 'labor_days' ? val : nextForm.labor_days) || 0;
    const laborWageRate = parseFloat(field === 'labor_wage_rate' ? val : nextForm.labor_wage_rate) || 0;
    
    const fertilizerBags = parseFloat(field === 'fertilizer_bags' ? val : nextForm.fertilizer_bags) || 0;
    const fertilizerPricePerBag = parseFloat(field === 'fertilizer_price_per_bag' ? val : nextForm.fertilizer_price_per_bag) || 0;
    
    const customQty = parseFloat(field === 'custom_qty' ? val : nextForm.custom_qty) || 0;
    const customPrice = parseFloat(field === 'custom_price' ? val : nextForm.custom_price) || 0;

    const qtySold = parseFloat(field === 'quantity_sold' ? val : nextForm.quantity_sold) || 0;
    const ratePerUnit = parseFloat(field === 'rate_per_unit' ? val : nextForm.rate_per_unit) || 0;

    let calculatedAmount = nextForm.amount;

    if (nextForm.type === 'expense' && nextForm.category === 'Seed') {
      if (seedQty > 0 && seedPrice > 0) calculatedAmount = (seedQty * seedPrice).toString();
    } else if (nextForm.type === 'expense' && nextForm.category === 'Hal (Plough)') {
      if ((ploughHours > 0 && hourlyRate > 0) || fuelCost > 0) calculatedAmount = ((ploughHours * hourlyRate) + fuelCost).toString();
    } else if (nextForm.type === 'expense' && nextForm.category === 'Cultivator') {
      if ((cultivatorHours > 0 && hourlyRate > 0) || fuelCost > 0) calculatedAmount = ((cultivatorHours * hourlyRate) + fuelCost).toString();
    } else if (nextForm.type === 'expense' && nextForm.category === 'Labor') {
      if (laborWorkers > 0 && laborDays > 0 && laborWageRate > 0) calculatedAmount = (laborWorkers * laborDays * laborWageRate).toString();
    } else if (nextForm.type === 'expense' && nextForm.category === 'Fertilizer') {
      if (fertilizerBags > 0 && fertilizerPricePerBag > 0) calculatedAmount = (fertilizerBags * fertilizerPricePerBag).toString();
    } else if (nextForm.type === 'income' && qtySold > 0 && ratePerUnit > 0) {
      calculatedAmount = (qtySold * ratePerUnit).toString();
    } else if (!["Seed", "Cultivator", "Hal (Plough)", "Fertilizer", "Labor"].includes(nextForm.category)) {
      if (customQty > 0 && customPrice > 0) {
        calculatedAmount = (customQty * customPrice).toString();
      }
    }

    nextForm.amount = calculatedAmount;
    setFinForm(nextForm);
  };

  const handleEditFinance = (f) => {
    setEditingFinance(f);
    const asSeed = isSeedLedgerCategory(f.category);
    if (f.category === 'Labor') setFinanceBookTab('labor');
    else if (f.category === 'Fertilizer') setFinanceBookTab('fertilizer');
    else setFinanceBookTab('ledger');
    setFinForm({
      category: asSeed ? 'Seed' : f.category,
      amount: f.amount.toString(),
      type: f.type,
      crop_id: f.crop_id || 'farm-wide',
      notes: f.notes || '',
      supplier_id: f.supplier_id || '',
      receipt_base64: f.receipt_base64 || '',
      date: f.date || mufToday(),
      buyer_name: f.buyer_name || '',
      quantity_sold: f.quantity_sold ? f.quantity_sold.toString() : '0',
      rate_per_unit: f.rate_per_unit ? f.rate_per_unit.toString() : '0',
      seed_qty_kg: f.seed_qty_kg ? f.seed_qty_kg.toString() : '0',
      seed_price_per_kg: f.seed_price_per_kg ? f.seed_price_per_kg.toString() : '0',
      plough_hours: f.plough_hours ? f.plough_hours.toString() : '0',
      cultivator_hours: f.cultivator_hours ? f.cultivator_hours.toString() : '0',
      fuel_cost: f.fuel_cost ? f.fuel_cost.toString() : '0',
      hourly_rate: f.hourly_rate ? f.hourly_rate.toString() : '0',
      labor_workers: f.labor_workers ? f.labor_workers.toString() : '0',
      labor_days: f.labor_days ? f.labor_days.toString() : '0',
      labor_wage_rate: f.labor_wage_rate ? f.labor_wage_rate.toString() : '0',
      fertilizer_bags: f.fertilizer_bags ? f.fertilizer_bags.toString() : '0',
      fertilizer_price_per_bag: f.fertilizer_price_per_bag ? f.fertilizer_price_per_bag.toString() : '0',
      custom_qty: f.custom_qty ? f.custom_qty.toString() : '0',
      custom_price: f.custom_price ? f.custom_price.toString() : '0',
      tubewell: 'rented',
      hours: '',
      chemical: '',
      dose: '',
      spray_image: '',
      inventory_item_id: '',
      inventory_qty_consumed: ''
    });
    setShowFinanceModal(true);
  };

  const handleDeleteFinance = async (id) => {
    const ok = await confirm({
      title: L('Remove Transaction'),
      message: L('Remove this transaction log? This will modify your gross totals.'),
      tone: 'danger',
      confirmLabel: L('Remove'),
      cancelLabel: L('Cancel')
    });
    if (!ok) return false;
    setActionId(id);
    try {
      await api.deleteFinance(id);
      setFinance(prev => prev.filter(f => f._id !== id));
      showAlert("Transaction successfully removed from ledger!");
      await refreshData();
      return true;
    } catch (err) {
      showAlert("Failed to delete transaction.", true);
      return false;
    } finally {
      setActionId(null);
    }
  };

  // --- Liabilities / Credit Actions ---
  const handleLiabilitySubmit = async (e) => {
    e.preventDefault();
    if (!liaForm.creditor.trim() || !liaForm.amount_owed) {
      return showAlert("Please complete creditor name and amount owed.", true);
    }
    const amt = parseFloat(liaForm.amount_owed);
    if (isNaN(amt) || amt <= 0) return showAlert("Amount owed must be a positive number.", true);

    try {
      const payload = {
        ...liaForm,
        amount_owed: amt,
        crop_id: liaForm.crop_id === 'farm-wide' ? null : liaForm.crop_id
      };
      if (editingLiabilityId) {
        await api.updateLiability(editingLiabilityId, payload);
        showAlert("Liability updated successfully!");
      } else {
        const liaRes = await api.addLiability(payload);
        showAlert(isOfflineSave(liaRes) ? "Saved on this device. It will sync when you reconnect." : "Credit liability recorded successfully!");
        if (isOfflineSave(liaRes)) {
          setLiabilities(prev => [offlineRecord({ ...payload, status: 'Pending' }, liaRes), ...prev]);
        }
      }
      setLiaForm({ creditor: '', amount_owed: '', due_date: '', crop_id: 'farm-wide', notes: '' });
      setEditingLiabilityId(null);
      setShowLiabilityModal(false);
      if (!editingLiabilityId) {
        // already handled offline add above; otherwise refresh
        refreshData();
      } else {
        refreshData();
      }
    } catch (err) {
      showAlert("Failed to save liability.", true);
    }
  };

  const startEditLiability = (l) => {
    setEditingLiabilityId(l._id);
    setLiaForm({
      creditor: l.creditor || '',
      amount_owed: String(l.amount_owed || ''),
      due_date: l.due_date || '',
      crop_id: l.crop_id || 'farm-wide',
      notes: l.notes || '',
    });
    setShowLiabilityModal(true);
  };

  const resetLiabilityForm = () => {
    setLiaForm({ creditor: '', amount_owed: '', due_date: '', crop_id: 'farm-wide', notes: '' });
    setEditingLiabilityId(null);
    setShowLiabilityModal(false);
  };

  const handlePayLiability = async (id) => {
    const ok = await confirm({
      title: L('Settle Debt / Liability'),
      message: L('Mark this debt as Paid? This will automatically log a corresponding cash outflow expense in your Ledger.'),
      tone: 'warning',
      confirmLabel: L('Pay Off Debt'),
      cancelLabel: L('Cancel')
    });
    if (!ok) return;
    setActionId(id);
    try {
      await api.payLiability(id);
      showAlert("Debt settled! Corresponding transaction logged to ledger.");
      refreshData();
    } catch (err) {
      showAlert("Failed to settle debt.", true);
    } finally {
      setActionId(null);
    }
  };

  const handleDeleteLiability = async (id) => {
    const ok = await confirm({
      title: L('Remove Liability Log'),
      message: L('Are you sure you want to delete this liability record? This does not log any cash outflow.'),
      tone: 'danger',
      confirmLabel: L('Delete Record'),
      cancelLabel: L('Cancel')
    });
    if (!ok) return;
    setActionId(id);
    try {
      await api.deleteLiability(id);
      setLiabilities(prev => prev.filter(item => item._id !== id));
      showAlert("Liability record removed successfully.");
      await refreshData();
    } catch (err) {
      showAlert("Failed to remove liability.", true);
    } finally {
      setActionId(null);
    }
  };

  // --- Inventory / Stocks Actions ---
  const handleInventorySubmit = async (e) => {
    e.preventDefault();
    if (!invForm.name.trim() || !invForm.current_stock) {
      return showAlert("Please complete stock item name and current quantity.", true);
    }
    const stock = parseFloat(invForm.current_stock);
    const threshold = parseFloat(invForm.low_stock_threshold || '10.0');
    if (isNaN(stock) || stock < 0) return showAlert("Stock count must be a non-negative number.", true);

    try {
      const payload = {
        ...invForm,
        current_stock: stock,
        low_stock_threshold: isNaN(threshold) ? 10.0 : threshold
      };
      let invRes;
      if (invForm._id) {
        invRes = await api.updateInventory(invForm._id, payload);
        showAlert(isOfflineSave(invRes) ? "Saved on this device. It will sync when you reconnect." : "Inventory stock count successfully updated!");
      } else {
        invRes = await api.addInventory(payload);
        showAlert(isOfflineSave(invRes) ? "Saved on this device. It will sync when you reconnect." : "Inventory stock item recorded successfully!");
      }
      setInvForm({ name: '', category: 'fertilizer', current_stock: '', unit: 'kg', low_stock_threshold: '' });
      setShowInventoryModal(false);
      if (isOfflineSave(invRes)) {
        if (invForm._id) {
          setInventory(prev => prev.map(item => item._id === invForm._id ? { ...item, ...payload } : item));
        } else {
          setInventory(prev => [offlineRecord(payload, invRes), ...prev]);
        }
      } else {
        refreshData();
      }
    } catch (err) {
      showAlert("Failed to save inventory item.", true);
    }
  };

  const handleDeleteInventory = async (id) => {
    const ok = await confirm({
      title: L('Remove Inventory Item'),
      message: L('Are you sure you want to permanently delete this stock item from inventory?'),
      tone: 'danger',
      confirmLabel: L('Delete Item'),
      cancelLabel: L('Cancel')
    });
    if (!ok) return;
    setActionId(id);
    try {
      await api.deleteInventory(id);
      setInventory(prev => prev.filter(item => item._id !== id));
      showAlert("Inventory stock item deleted successfully.");
      await refreshData();
    } catch (err) {
      showAlert("Failed to delete stock item.", true);
    } finally {
      setActionId(null);
    }
  };

  // --- Task Actions ---
  const handleTaskSubmit = async (e) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return showAlert("Task title/assignment is required.", true);
    try {
      const payload = { 
        ...taskForm, 
        status: editingTask ? editingTask.status : 'Pending',
        labor_cost: taskForm.labor_cost ? parseFloat(taskForm.labor_cost) : 0.0,
        inventory_qty_consumed: taskForm.inventory_qty_consumed ? parseFloat(taskForm.inventory_qty_consumed) : 0.0,
        inventory_item_id: taskForm.inventory_item_id === '' ? null : taskForm.inventory_item_id,
        crop_id: !taskForm.crop_id || taskForm.crop_id === 'farm-wide' ? null : taskForm.crop_id
      };
      let taskRes;
      if (editingTask) {
        taskRes = await api.updateTask(editingTask._id, payload);
        showAlert(isOfflineSave(taskRes) ? "Saved on this device. It will sync when you reconnect." : "Care roster assignment updated successfully!");
      } else {
        taskRes = await api.addTask(payload);
        showAlert(isOfflineSave(taskRes) ? "Saved on this device. It will sync when you reconnect." : "Care duty successfully scheduled!");
      }
      setTaskForm(getEmptyTaskForm());
      setEditingTask(null);
      setShowTaskModal(false);
      if (isOfflineSave(taskRes)) {
        if (editingTask) {
          setTasks(prev => prev.map(t => t._id === editingTask._id ? { ...t, ...payload } : t));
        } else {
          setTasks(prev => [offlineRecord(payload, taskRes), ...prev]);
        }
      } else {
        refreshData();
      }
    } catch (err) {
      showAlert("Failed to save assignment.", true);
    }
  };

  const handleEditTask = (t) => {
    setEditingTask(t);
    setTaskForm({
      title: t.title,
      due_date: t.due_date || '',
      assigned_to: t.assigned_to || '',
      priority: t.priority || 'Medium',
      notes: t.notes || '',
      image_base64: t.image_base64 || '',
      labor_cost: t.labor_cost ? t.labor_cost.toString() : '0',
      inventory_item_id: t.inventory_item_id || '',
      inventory_qty_consumed: t.inventory_qty_consumed ? t.inventory_qty_consumed.toString() : '0',
      crop_id: t.crop_id || 'farm-wide',
      laborer_ids: t.laborer_ids || []
    });
    setShowTaskModal(true);
  };

  const handleCompleteTask = async (id) => {
    setActionId(id);
    try {
      await api.completeTask(id);
      showAlert("Task completed successfully! Confetti on the farm!");
      refreshData();
    } catch (err) {
      showAlert("Failed to update task status.", true);
    } finally {
      setActionId(null);
    }
  };

  const handleRevertTask = async (t) => {
    try {
      const payload = { ...t, status: 'Pending' };
      await api.updateTask(t._id, payload);
      showAlert("Task status successfully reverted to Pending!");
      refreshData();
    } catch (err) {
      showAlert("Failed to revert task status.", true);
    }
  };

  const handleDeleteTask = async (id) => {
    const ok = await confirm({
      title: L('Delete Care Task'),
      message: L('Delete this duty roster task? This cannot be undone.'),
      tone: 'danger',
      confirmLabel: L('Delete'),
      cancelLabel: L('Cancel')
    });
    if (!ok) return;
    setActionId(id);
    try {
      await api.deleteTask(id);
      setTasks(prev => prev.filter(item => item._id !== id));
      showAlert("Care task assignment removed successfully!");
      await refreshData();
    } catch (err) {
      showAlert("Failed to delete task.", true);
    } finally {
      setActionId(null);
    }
  };

  // --- Helper Calculations ---
  const totalIncome = finance.filter(f => f.type === 'income').reduce((sum, item) => sum + item.amount, 0);
  const totalExpense = finance.filter(f => f.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
  const netProfit = totalIncome - totalExpense;

  const dbIncome = finance.filter(f => f.type === 'income' && (dashboardCropFilter === 'all' ? true : f.crop_id === dashboardCropFilter)).reduce((sum, item) => sum + item.amount, 0);
  const dbExpense = finance.filter(f => f.type === 'expense' && (dashboardCropFilter === 'all' ? true : f.crop_id === dashboardCropFilter)).reduce((sum, item) => sum + item.amount, 0);
  const dbNetProfit = dbIncome - dbExpense;

  // ── This month vs last month (muf shared card) ──
  const cmpCurKey = thisMonthKey();
  const cmpPrevKey = lastMonthKey();
  // cmp (month-over-month + same-month-last-year comparison) extracted to
  // ./components/app/agriHelpers as buildAgriComparison — pure function,
  // same inputs (finance, cmpCurKey, cmpPrevKey), same output shape.
  const cmp = buildAgriComparison(finance, cmpCurKey, cmpPrevKey);

  // Tasks matching the dashboard crop filter (title-name heuristic, same as the task board)
  const taskMatchesCrop = (t, cropId) => {
    if (cropId === 'all') return true;
    if (String(t.crop_id || '') === String(cropId)) return true;
    const sel = crops.find(c => c._id === cropId);
    if (!sel) return false;
    return cropNameInText(t.title, sel.name) || cropNameInText(t.notes, sel.name) || cropNameInText(t.title, sel.variety);
  };
  const dashPendingTasks = tasks.filter(t => t.status === 'Pending' && taskMatchesCrop(t, dashboardCropFilter)).length;
  const dashCompletedTasks = tasks.filter(t => t.status === 'Completed' && taskMatchesCrop(t, dashboardCropFilter)).length;

  // --- Premium Monthly Summary & Analytics ---
  const realNotifications = React.useMemo(() => {
    const list = [];

    // Daily entry reminder: no ledger/task activity recorded today after 8 AM
    const todayIso = mufToday();
    const activityToday =
      finance.some(f => String(f.date || '').slice(0, 10) === todayIso) ||
      tasks.some(t => String(t.completed_at || t.date || '').slice(0, 10) === todayIso);
    if (!activityToday && new Date().getHours() >= 8) {
      list.push({
        id: 'no-activity-today',
        type: 'warning',
        title: '📔 Nothing logged today',
        desc: 'No ledger entries or completed tasks recorded today yet.',
        time: 'Daily reminder'
      });
    }

    // 1. Rain alert
    if (rainForecast24h > 5) {
      list.push({
        id: 'rain-alert',
        type: 'danger',
        title: '🌧️ Heavy Rain Warning',
        desc: `Our weather station reports ${rainForecast24h.toFixed(1)}mm of rain in the next 24h. Pause sprinkler irrigation plans immediately!`,
        time: 'Real-time alert'
      });
    }

    // 2. Low stock alert
    inventory.forEach(item => {
      if (item.current_stock <= item.low_stock_threshold) {
        list.push({
          id: `low-stock-${item._id}`,
          type: 'warning',
          title: `⚠️ Low Stock: ${item.name}`,
          desc: `Current stock of ${item.current_stock} ${item.unit} is below the safety threshold of ${item.low_stock_threshold} ${item.unit}. Please restock.`,
          time: 'Inventory health'
        });
      }
    });

    // 3. Pending tasks alert
    const pendingTasks = tasks.filter(t => t.status === 'Pending');
    if (pendingTasks.length > 0) {
      list.push({
        id: 'pending-tasks',
        type: 'info',
        title: '📝 Pending Care Duties',
        desc: `There are currently ${pendingTasks.length} farm assignments marked as Pending on the Care Roster board.`,
        time: 'Care Portal'
      });
    }

    // 4. Unpaid liabilities
    const pendingLia = liabilities.filter(l => l.status === 'Pending');
    if (pendingLia.length > 0) {
      list.push({
        id: 'pending-liabilities',
        type: 'warning',
        title: '💰 Outstanding Liabilities',
        desc: `You have ${pendingLia.length} unpaid credit debts logged. These are committed crop costs that will be logged as expenses when you settle them.`,
        time: 'Financial'
      });
    }

    return list;
  }, [rainForecast24h, inventory, tasks, crops, liabilities]);

  const sortedCropsProfitability = React.useMemo(() => {
    return crops.map(c => {
      const cropExpenses = finance.filter(f => f.crop_id === c._id);
      const spent = cropExpenses.filter(f => f.type === 'expense').reduce((sum, f) => sum + f.amount, 0);
      const earned = cropExpenses.filter(f => f.type === 'income').reduce((sum, f) => sum + f.amount, 0);
      const netProfit = earned - spent;
      const area = parseFloat(c.area_kanal) || 1.0;
      const profitPerKanal = netProfit / area;
      return {
        ...c,
        spent,
        earned,
        netProfit,
        profitPerKanal,
        area
      };
    }).sort((a, b) => b.profitPerKanal - a.profitPerKanal);
  }, [crops, finance]);

  const filteredPeriodFinance = finance.filter(f => {
    if (reportsCropFilter !== 'all' && f.crop_id !== reportsCropFilter) return false;
    return true;
  });

  const periodIncome = filteredPeriodFinance.filter(f => f.type === 'income').reduce((sum, f) => sum + f.amount, 0);
  const periodExpense = filteredPeriodFinance.filter(f => f.type === 'expense').reduce((sum, f) => sum + f.amount, 0);
  const periodNet = periodIncome - periodExpense;
  const periodMargin = periodIncome > 0 ? ((periodNet / periodIncome) * 100).toFixed(1) : '0.0';

  // muf-charts: monthly income series for the dashboard area chart (last 12 months)
  // dashboardIncomeSeries extracted to ./components/app/agriHelpers as
  // buildDashboardIncomeSeries — pure function, same input (finance).
  const dashboardIncomeSeries = buildDashboardIncomeSeries(finance);

  // monthlyComparisonRows extracted to ./components/app/agriHelpers as
  // buildMonthlyComparisonRows — pure function, same inputs (finance, crops,
  // reportsCropFilter, sortOrder).
  const monthlyComparisonRows = buildMonthlyComparisonRows(finance, crops, reportsCropFilter, sortOrder);

  // expenseBreakdown extracted to ./components/app/agriHelpers as
  // buildExpenseBreakdown — pure function, same input (filteredPeriodFinance).
  const expenseBreakdown = buildExpenseBreakdown(filteredPeriodFinance);

  const uniqueFields = [...new Set(crops.map(c => c.field).filter(Boolean))];
  const uniqueSeasons = [...new Set(crops.map(c => c.season).filter(Boolean))];
  const uniqueYears = [...new Set(crops.map(c => c.crop_year).filter(Boolean))];

  const filteredCrops = crops.filter(c => {
    // 0. Specific Crop Filter (Crop Manager tab)
    if (cropIdFilter !== 'all' && c._id !== cropIdFilter) return false;

    // 1. Status Filter
    if (cropFilter !== 'all' && c.status !== cropFilter) return false;

    // 1b. Season Filter
    if (cropSeasonFilter !== 'all' && c.season !== cropSeasonFilter) return false;

    // 1c. Crop Year Filter
    if (cropYearFilter !== 'all' && c.crop_year !== cropYearFilter) return false;
    
    // 2. Search Filter (by name, variety, or field)
    if (cropSearch) {
      const q = cropSearch.toLowerCase().trim();
      const matchName = String(c.name || '').toLowerCase().includes(q);
      const matchVariety = String(c.variety || '').toLowerCase().includes(q);
      const matchField = String(c.field || '').toLowerCase().includes(q);
      if (!matchName && !matchVariety && !matchField) return false;
    }
    
    // 3. Field Filter
    if (cropFieldFilter !== 'all' && c.field !== cropFieldFilter) return false;
    
    return true;
  });

  // ── Grid view items (muf-entity-grid) — replaces inline crop cards ──
  const visibleFilteredCrops = cropPageRows;
  const gridCrops = visibleFilteredCrops.map((c) => {
    const progress = getCropProgress(c);
    const cropDay = c.plant_date ? Math.max(0, Math.floor((Date.now() - new Date(c.plant_date + 'T00:00:00').getTime()) / 86400000)) : null;
    const dayText = c.status === 'Completed' ? (c.harvest_date ? `Harvested ${c.harvest_date}` : 'Completed') : cropDay != null ? `Day ${cropDay + 1}` : 'Not planted';
    return {
      id: c._id,
      photo: c.image_base64 || getCropImage(c.name),
      emoji: '🌾',
      name: c.name,
      sub: c.variety || 'Standard Variety',
      chip: c.status === 'Planted' ? 'Planned' : c.status,
      status: c.status,
      statusTone: c.status === 'Growing' ? 'good' : c.status === 'Harvesting' ? 'warn' : c.status === 'Completed' ? 'muted' : 'info',
      stats: [
        { icon: <MapPin size={14} />, text: c.field || 'Farm-wide' },
        { icon: <CalendarDays size={14} />, text: dayText },
        { icon: <Ruler size={14} />, text: c.area_kanal ? `${c.area_kanal} kanal` : 'Area —' },
        { icon: <Scale size={14} />, text: c.yield_kg ? formatYield(toKg(c.yield_kg, c.yield_unit), c.yield_unit) : 'Yield pending' },
        { icon: <Sprout size={14} />, text: c.season || 'No season' },
        { icon: <CalendarDays size={14} />, text: c.n ? `Year ${c.n}` : 'No year' },
        { icon: <Ruler size={14} />, text: c.variety || 'Standard' },
      ],
      progress,
      progressLabel: 'Crop Progress',
      actions: (
        <>
          <button onClick={() => setSelectedCrop(c)} className="muf-detail-btn"><Eye size={15}/> {L('Details')}</button>
          {userRole === 'admin' && (
            <>
              <button onClick={() => handleEditCrop(c)} className="muf-record-btn"><Edit3 size={15}/> {L('Edit')}</button>
              {c.status === 'Completed' && (
                <button onClick={() => handlePlanNext(c)} className="muf-record-btn" title={L('Plan next season')}><CalendarPlus size={15}/> {L('Next')}</button>
              )}
              <button onClick={() => handleDeleteCrop(c._id)} className="muf-mini-icon danger" title={L('Delete')} aria-label={L('Delete crop')}><Trash2 size={15}/></button>
            </>
          )}
        </>
      ),
    };
  });

  const ledgerScopedFinance = finance.filter(f => financeCropFilter === 'all' || f.crop_id === financeCropFilter);
  const filteredFinance = ledgerScopedFinance.filter(f => financeFilter === 'all' ? true : f.type === financeFilter);
  const groupedFinances = React.useMemo(() => {
    const groupsMap = {};

    // Initialize the farm-wide group
    groupsMap['farm-wide'] = {
      id: 'farm-wide',
      name: 'General / Farm-Wide Operational',
      plot: 'General',
      transactions: [],
      net: 0
    };

    // Initialize groups for each crop
    crops.forEach(c => {
      groupsMap[c._id] = {
        id: c._id,
        name: `Crop: ${c.name} (${c.variety || 'Standard'})`,
        plot: c.field || 'Farm-wide',
        transactions: [],
        net: 0
      };
    });

    // Populate transactions into their respective groups
    filteredFinance.forEach(f => {
      const cropId = f.crop_id || 'farm-wide';
      if (!groupsMap[cropId]) {
        groupsMap['farm-wide'].transactions.push(f);
      } else {
        groupsMap[cropId].transactions.push(f);
      }
    });

    const result = [];
    Object.values(groupsMap).forEach(g => {
      const inc = g.transactions.filter(f => f.type === 'income').reduce((sum, f) => sum + f.amount, 0);
      const exp = g.transactions.filter(f => f.type === 'expense').reduce((sum, f) => sum + f.amount, 0);
      g.net = inc - exp;

      if ((g.id === 'farm-wide' && financeCropFilter === 'all') || g.transactions.length > 0) {
        result.push(g);
      }
    });

    return result;
  }, [crops, filteredFinance, financeCropFilter]);

  const filteredTasks = tasks.filter(t => {
    if (taskFilter !== 'all') {
      if (taskFilter === 'Pending' && t.status !== 'Pending') return false;
      if (taskFilter === 'Completed' && t.status !== 'Completed') return false;
    }
    if (taskCropFilter !== 'all' && !taskMatchesCrop(t, taskCropFilter)) return false;
    return true;
  });
  const cropListFilters = { status: cropFilter, season: cropSeasonFilter, crop_year: cropYearFilter, field: cropFieldFilter, crop_id: cropIdFilter, search: cropSearch };
  const selectedTaskCrop = taskCropFilter === 'all' ? null : crops.find((crop) => crop._id === taskCropFilter);
  const taskListFilters = { status: taskFilter, crop_id: taskCropFilter === 'all' ? '' : taskCropFilter, crop_search: selectedTaskCrop ? [selectedTaskCrop.name, selectedTaskCrop.variety].filter(Boolean).join('|') : '' };
  useEffect(() => {
    if (!token || activeTab !== 'crops') return undefined;
    void fetchCropPage(0, cropListFilters, true);
    return () => { cropPageRequestRef.current += 1; };
  }, [token, activeTab, cropFilter, cropSeasonFilter, cropYearFilter, cropFieldFilter, cropIdFilter, cropSearch, listRefreshKey]);
  useEffect(() => {
    if (!token || activeTab !== 'tasks') return undefined;
    void fetchTaskPage(0, taskListFilters, true);
    return () => { taskPageRequestRef.current += 1; };
  }, [token, activeTab, taskFilter, taskCropFilter, selectedTaskCrop?.name, selectedTaskCrop?.variety, listRefreshKey]);

  const openLedgerProfitModal = (source, cardType = 'profit') => {
    if (userRole !== 'admin') return; // money popups are admin-only
    let income = 0;
    let expense = 0;
    let transactions = [];
    let title = "Operational Ledger Flow";

    if (source === 'dashboard') {
      transactions = finance.filter(f => dashboardCropFilter === 'all' ? true : f.crop_id === dashboardCropFilter);
      income = transactions.filter(f => f.type === 'income').reduce((sum, item) => sum + item.amount, 0);
      expense = transactions.filter(f => f.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
      const cropName = dashboardCropFilter === 'all' ? L('All Crops') : (crops.find(c => c._id === dashboardCropFilter)?.name || L('Crop'));
      title = `${L('Dashboard Ledger Flow')}: ${cropName}`;
    } else if (source === 'reports') {
      transactions = filteredPeriodFinance;
      income = periodIncome;
      expense = periodExpense;
      const cropName = reportsCropFilter === 'all' ? L('All Crops') : (crops.find(c => c._id === reportsCropFilter)?.name || L('Crop'));
      title = `${L('Reports Ledger Flow')}: ${cropName}`;
    } else {
      transactions = ledgerScopedFinance;
      income = pageIncome;
      expense = pageExpense;
      const cropName = financeCropFilter === 'all' ? L('All Crops') : (crops.find(c => c._id === financeCropFilter)?.name || L('Crop'));
      title = `${L('Financial Ledger Flow')}: ${cropName}`;
    }

    // Process breakdowns based on cardType
    let breakdowns = [];
    let listTransactions = [...transactions];

    if (cardType === 'income') {
      title += ` (${L('Income Source')})`;
      listTransactions = transactions.filter(f => f.type === 'income');
      const group = {};
      listTransactions.forEach(f => {
        const buyer = f.buyer_name ? f.buyer_name.trim() : f.category;
        const key = buyer || 'General / Spot Sale';
        group[key] = (group[key] || 0) + f.amount;
      });
      breakdowns = Object.entries(group)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount);
    } else if (cardType === 'expense') {
      title += ` (${L('Expense Breakdown')})`;
      listTransactions = transactions.filter(f => f.type === 'expense');
      const group = {};
      listTransactions.forEach(f => {
        const key = f.category || 'General Expense';
        group[key] = (group[key] || 0) + f.amount;
      });
      breakdowns = Object.entries(group)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount);
    } else if (cardType === 'profit') {
      title += ` (${L('Profit Formula')})`;
      listTransactions = [];
    } else if (cardType === 'margin') {
      title += ` (${L('Margin Formula')})`;
      listTransactions = [];
    }

    setLedgerModalData({
      income,
      expense,
      netProfit: income - expense,
      transactions: listTransactions.slice(0, 15),
      title,
      cardType,
      source,
      breakdowns
    });
    setModal('ledger_profit');
  };

  // Exports follow the Monthly Summary page's active settings (Crop Filter +
  // Sort Order) so whatever is on screen is exactly what gets exported.
  const reportsCropName = reportsCropFilter === 'all'
    ? 'All Crops'
    : (crops.find(c => c._id === reportsCropFilter)?.name || 'Crop');

  const handleExportMonthlyCSV = () => {
    let csv = `Monthly Summary — Crop Filter: ${reportsCropName} — Sort: ${sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}\n`;
    csv += "Month,Crops Planted,Income,Expense,Net Profit\n";
    monthlyComparisonRows.forEach(([month, val]) => {
      csv += `"${month}",${val.cropsCount},Rs. ${formatCurrency(val.income)},Rs. ${formatCurrency(val.expense)},Rs. ${formatCurrency(val.income - val.expense)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const fileSlug = reportsCropFilter === 'all' ? 'all-crops' : reportsCropName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    link.setAttribute("download", `agrifarm-monthly-summary-${fileSlug}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showAlert(`Monthly statement exported to CSV (Crop Filter: ${reportsCropName})!`);
  };

  const handlePrintMonthlyPDF = async () => {
    // One-tap PDF download in the shared muf-pdf design (no print window).
    const totalInc = monthlyComparisonRows.reduce((sum, [_, val]) => sum + val.income, 0);
    const totalExp = monthlyComparisonRows.reduce((sum, [_, val]) => sum + val.expense, 0);

    const { doc, y } = await mufPdfStart('Monthly Performance Summary', `Crop Filter: ${reportsCropName} · Generated: ${mufToday()}`);
    let cursor = mufPdfSummary(doc, y, `Period Financial Overview — ${reportsCropName}`, [
      ['Total Income', `Rs. ${formatCurrency(totalInc)}`],
      ['Total Expense', `Rs. ${formatCurrency(totalExp)}`],
      ['Period Net Profit', `Rs. ${formatCurrency(totalInc - totalExp)}`],
    ]);
    mufPdfTable(doc, cursor,
      ['Month', 'Crops Planted', 'Income', 'Expense', 'Net Profit'],
      monthlyComparisonRows.map(([month, val]) => [
        month,
        `${val.cropsCount} cycles`,
        `Rs. ${formatCurrency(val.income)}`,
        `Rs. ${formatCurrency(val.expense)}`,
        `Rs. ${formatCurrency(val.income - val.expense)}`,
      ]),
      [['TOTAL', '', `Rs. ${formatCurrency(totalInc)}`, `Rs. ${formatCurrency(totalExp)}`, `Rs. ${formatCurrency(totalInc - totalExp)}`]]
    );
    mufPdfFooter(doc, 'Monthly Performance Summary');
    mufPdfSave(doc, `monthly-summary-${reportsCropFilter === 'all' ? 'all-crops' : reportsCropName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
    showAlert(`Monthly summary PDF downloaded (Crop Filter: ${reportsCropName}).`);
  };

  const cropCareDutiesCount = tasks.filter(t => t.status === 'Pending' && (
    filteredCrops.length === crops.length || filteredCrops.some(c => taskMatchesCrop(t, c._id))
  )).length;
  const cropLedgerEntriesCount = finance.filter(f => (
    filteredCrops.length === crops.length || (f.crop_id && filteredCrops.some(c => c._id === f.crop_id))
  )).length;
  // Workers only see CURRENT work: completed crop cycles and finished duties
  // are history that belongs to the admin (backend also filters crops).
  const dashCrops = crops.filter(c =>
    (dashboardCropFilter === 'all' || c._id === dashboardCropFilter) &&
    (userRole === 'admin' || c.status !== 'Completed')
  );
  const dashTasks = tasks.filter(t =>
    taskMatchesCrop(t, dashboardCropFilter) &&
    (userRole === 'admin' || t.status !== 'Completed')
  );
  const dashFinance = finance.filter(f => dashboardCropFilter === 'all' || f.crop_id === dashboardCropFilter);
  const dashRecentActivities = [
    ...dashTasks.map(t => ({ id: `task-${t._id}`, label: t.title, date: t.due_date || '', kind: 'Task', status: t.status || 'Pending' })),
    ...dashFinance.map(f => ({ id: `finance-${f._id}`, label: `${f.type === 'income' ? 'Income' : 'Expense'}: ${f.description || f.category || 'Finance entry'}`, date: f.date || '', kind: 'Finance', status: '' })),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 6);
  const pageIncome = ledgerScopedFinance.filter(f => f.type === 'income').reduce((sum, item) => sum + item.amount, 0);
  const pageExpense = ledgerScopedFinance.filter(f => f.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
  const pageProfit = pageIncome - pageExpense;

  // --- RENDER AUTHENTICATION & LOGIN ---
  if (!token) return (
    <MufLoginScreen className={lang === 'ur' ? 'rtl' : 'ltr'} dir={lang === 'ur' ? 'rtl' : 'ltr'}>
      <MufLoginLang lang={lang} onToggle={toggleLang} />
      {alertMsg.text && (
        <div className={`mb-6 p-4 rounded-xl shadow-lg border text-sm max-w-sm w-full animate-fade-in ${
          alertMsg.isError ? 'bg-red-50 border-red-300 text-red-800 dark:bg-red-950/80 dark:border-red-500 dark:text-red-200' : 'bg-farm-50 border-farm-300 text-farm-800 dark:bg-farm-950/80 dark:border-farm-500 dark:text-farm-200'
        }`}>
          <div className="flex items-center gap-3">
            {alertMsg.isError ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
            <span>{alertMsg.text}</span>
          </div>
        </div>
      )}
      
      {/* ─── PANE 1: DEFAULT LOGIN SCREEN ─── */}
      {authMode === 'login' && (
        <MufLoginPanel className="pulse-border-hover">
          <MufLoginBrand farmName="Usman Agri Farm" logoSrc="/logo.png" logoAlt="Usman Agri Farm" fallbackSrc="/favicon.png" subtitle={L('Sign in to continue')} />
          
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="muf-label">{L('Username or Email')}</label>
              <input 
                type="text"
                required
                className="muf-field muf-field-lg"
                placeholder={L('username or email')} 
                value={authForm.username}
                onChange={e => setAuthForm({...authForm, username: e.target.value})} 
              />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{L('Password')}</label>
                <button 
                  type="button" 
                  onClick={() => setAuthMode('forgot_send')}
                  className="text-[11px] text-farm-600 hover:text-farm-500 font-bold uppercase tracking-wider cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  className="w-full bg-slate-100 border border-slate-200 text-slate-900 dark:bg-[#1e293b] dark:border-slate-700 dark:text-white rounded-lg pl-4 pr-11 py-3 text-sm focus:outline-none focus:border-farm-500 transition-colors"
                  placeholder="••••••••" 
                  value={authForm.password}
                  onChange={e => setAuthForm({...authForm, password: e.target.value})} 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            
            <button 
              type="submit" 
              className="w-full py-3 bg-farm-600 hover:bg-farm-700 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-farm-500/10 flex items-center justify-center gap-2 cursor-pointer mt-2"
              disabled={loading}
            >
              {loading ? <Loader size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
              Sign in
            </button>
          </form>
        </MufLoginPanel>
      )}

      {/* ─── PANE 2: FIRST-TIME SETUP REGISTRATION (ADMIN CREATION) ─── */}
      {authMode === 'register' && (
        <MufLoginPanel className="pulse-border-hover animate-fade-in">
          <MufLoginBrand farmName="Usman Agri Farm" logoSrc="/logo.png" logoAlt="Usman Agri Farm" fallbackSrc="/favicon.png" subtitle={L('First-time Administrative Setup')} />
          
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="muf-label">{L('Admin Username')}</label>
              <input 
                type="text"
                required
                className="muf-field muf-field-lg"
                placeholder={L('e.g. admin')} 
                value={authForm.username}
                onChange={e => setAuthForm({...authForm, username: e.target.value})} 
              />
            </div>
            
            <div>
              <label className="muf-label">{L('Admin Email')}</label>
              <input 
                type="email"
                required
                className="muf-field muf-field-lg"
                placeholder="admin@farm.com" 
                value={authForm.email}
                onChange={e => setAuthForm({...authForm, email: e.target.value})} 
              />
            </div>
            
            <div>
              <label className="muf-label">{L('Setup Password')}</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  className="w-full bg-slate-100 border border-slate-200 text-slate-900 dark:bg-[#1e293b] dark:border-slate-700 dark:text-white rounded-lg pl-4 pr-11 py-3 text-sm focus:outline-none focus:border-farm-500 transition-colors"
                  placeholder={L('Min 6 characters')} 
                  value={authForm.password}
                  onChange={e => setAuthForm({...authForm, password: e.target.value})} 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="muf-label">{L('Confirm Password')}</label>
              <div className="relative">
                <input 
                  type={showConfirmPassword ? "text" : "password"} 
                  required
                  className="w-full bg-slate-100 border border-slate-200 text-slate-900 dark:bg-[#1e293b] dark:border-slate-700 dark:text-white rounded-lg pl-4 pr-11 py-3 text-sm focus:outline-none focus:border-farm-500 transition-colors"
                  placeholder={L('Confirm your password')} 
                  value={authForm.confirmPassword || ''}
                  onChange={e => setAuthForm({...authForm, confirmPassword: e.target.value})} 
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            
            <button 
              type="submit" 
              className="w-full py-3 bg-farm-600 hover:bg-farm-700 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-farm-500/10 flex items-center justify-center gap-2 cursor-pointer mt-2"
              disabled={loading}
            >
              {loading ? <Loader size={18} className="animate-spin" /> : <UserPlus size={18} />}
              Initialize & Register Admin
            </button>
          </form>
        </MufLoginPanel>
      )}

      {/* ─── PANE 3: FORGOT PASSWORD (REQUEST RESET CODE) ─── */}
      {authMode === 'forgot_send' && (
        <MufLoginPanel className="pulse-border-hover animate-fade-in">
          <MufLoginBrand farmName="Usman Agri Farm" logoSrc="/logo.png" logoAlt="Usman Agri Farm" fallbackSrc="/favicon.png" subtitle={L('Reset your password')} />
          
          <form onSubmit={handleForgotSendCode} className="space-y-4">
            <div>
              <label className="muf-label">{L('Admin Email Address')}</label>
              <input 
                type="email"
                required
                className="muf-field muf-field-lg"
                placeholder="admin@farm.com" 
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)} 
              />
            </div>
            
            <button 
              type="submit" 
              className="w-full py-3 bg-farm-600 hover:bg-farm-700 text-white font-bold rounded-lg transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer mt-2"
              disabled={loading}
            >
              {loading ? <Loader size={18} className="animate-spin" /> : <Send size={18} />}
              Send Verification Code
            </button>
            
            <button 
              type="button" 
              onClick={() => setAuthMode('login')}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-lg transition-all text-xs uppercase tracking-wider mt-2 cursor-pointer"
            >
              {L('Back to Login')}
            </button>
          </form>
        </MufLoginPanel>
      )}

      {/* ─── PANE 4: AUTHORIZE RESET PASSWORD WITH CODE ─── */}
      {authMode === 'forgot_reset' && (
        <MufLoginPanel className="pulse-border-hover animate-fade-in">
          <MufLoginBrand farmName="Usman Agri Farm" logoSrc="/logo.png" logoAlt="Usman Agri Farm" fallbackSrc="/favicon.png" subtitle={L('Verify reset code')} />
          
          <form onSubmit={handleForgotResetPw} className="space-y-4">
            <div>
              <label className="muf-label">{L('Email Address')}</label>
              <input 
                type="email"
                required
                readOnly
                className="w-full bg-slate-100/50 border border-slate-200 text-slate-500 dark:bg-[#1a2333]/50 dark:border-slate-800 dark:text-slate-400 rounded-lg px-4 py-3 text-sm focus:outline-none"
                value={forgotEmail}
              />
            </div>
            
            <div>
              <label className="muf-label">6-Digit Verification Code</label>
              <input 
                type="text"
                required
                maxLength="6"
                className="w-full bg-slate-100 border border-slate-200 text-slate-900 dark:bg-[#1e293b] dark:border-slate-700 dark:text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-farm-500 transition-colors text-center tracking-widest font-extrabold text-base"
                placeholder="123456" 
                value={resetCode}
                onChange={e => setResetCode(e.target.value)} 
              />
            </div>
            
            <div>
              <label className="muf-label">{L('New password')}</label>
              <input 
                type="password"
                required
                className="muf-field muf-field-lg"
                placeholder={L('Min 6 characters')} 
                value={resetNewPw}
                onChange={e => setResetNewPw(e.target.value)} 
              />
            </div>
            
            <button 
              type="submit" 
              className="w-full py-3 bg-farm-600 hover:bg-farm-700 text-white font-bold rounded-lg transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer mt-2"
              disabled={loading}
            >
              {loading ? <Loader size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
              Verify & Reset Password
            </button>
            
            <button 
              type="button" 
              onClick={() => setAuthMode('forgot_send')}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-lg transition-all text-xs uppercase tracking-wider mt-2 cursor-pointer"
            >
              {L('Request New Code')}
            </button>
          </form>
        </MufLoginPanel>
      )}
    </MufLoginScreen>
  );

  // --- RENDER MAIN INTERFACE ---
  return (
    <div className={`muf-app min-h-screen flex flex-col transition-colors duration-300 text-xs sm:text-sm md:text-base ${
      isDark ? 'bg-[#070b13] text-slate-100' : 'bg-[#fcfaf2] text-[#1c1917]'
    }`}>
      
      {/* Container wrapper matching flock_farm */}
      <div className="muf-app-shell w-full flex-1 flex">
        
        {/* IMAGE 02 SHELL: premium farm header + left navigation */}
        <div className="muf-layout w-full min-h-screen">
          <OfflineBanner
            pendingCount={offlinePendingCount}
            lang={lang}
            readQueue={() => { try { return JSON.parse(localStorage.getItem('offline_request_queue') || '[]'); } catch { return []; } }}
            onSync={async () => { await syncOfflineQueue(); }}
          />
          <MufWhatsNew storageKey="af_whats_new_seen" version={'2026-08 update'} lang={lang} notes={[
  'Search box in the top bar — find anything on the farm instantly',
  'Working offline? A banner shows saved entries and syncs them automatically',
  'New smooth production chart on the dashboard',
  'Farm profile PDF for buyers — in the reports section',
  'More Urdu across the whole app',
]} />
          <div className="muf-sticky-chrome">
<header className="muf-header">
            <div className="muf-header-brand cursor-pointer hover:opacity-90 transition-opacity" onClick={() => navigateTo('dashboard', 'dashboard')}>
              <img src="/logo.png" className="muf-brand-logo" onError={(e) => { e.target.onerror = null; e.target.src = "/favicon.png"; }} alt="Usman Agri Farm" />
              <div>
                <h1>{L('Usman Agri Farm')}</h1>
                <p>Smart Farming • Better Harvest</p>
              </div>
            </div>
            <div className="muf-header-actions">
              <MufFarmSwitcher app="agri" />
              {offlineQueueSize > 0 && (
                <button onClick={syncOfflineQueue} className="muf-icon-button muf-queue" title={L('Sync offline changes')} aria-label={L('Sync offline changes')}><Clock size={18}/><span>{offlineQueueSize}</span></button>
              )}
              <HeaderSearch
                lang={lang}
                loadItems={async () => {
                  return [
                    ...crops.map((c) => ({ id: c._id, type: 'crop', label: c.name, sub: `${c.season || ''} ${c.crop_year || ''}`.trim(), emoji: '🌾' })),
                    ...(userRole === 'admin' ? laborers.map((w) => ({ id: w._id, type: 'labor', label: w.name, sub: L('Worker'), emoji: '👷' })) : []),
                    ...finance.slice(-50).map((f, i) => ({ id: `fin-${i}`, type: 'finance', label: `${f.type} Rs ${f.amount || 0}`, sub: f.date || '', emoji: f.type === 'income' ? '📈' : '💰' })),
                    ...tasks.slice(-30).map((t, i) => ({ id: `task-${i}`, type: 'tasks', label: t.title || '', sub: t.due_date || '', emoji: '📋' })),
                  ];
                }}
                onPick={(item) => {
                  if (item.type === 'crop') { const crop = crops.find((c) => c._id === item.id); if (crop) return openPopup('selectedCrop', crop); }
                  navigateTo(item.type === 'labor' ? 'labor' : item.type === 'finance' ? 'finance' : item.type === 'tasks' ? 'tasks' : 'crops');
                }}
              />
              <button
                className="muf-icon-button"
                onClick={() => setDiaryOpen(true)}
                title={L('Notes')}
                aria-label={L('Notes')}
              >
                <BookOpen size={19}/>
              </button>
              <button className="muf-icon-button muf-notif-wrap" title={L('Notifications')} aria-label={L('Notifications')} onClick={() => setModal('notifications')}>
                <Bell size={19}/>
                {realNotifications.length > 0 && (
                  <span className="muf-notif-badge">{realNotifications.length}</span>
                )}
              </button>
              
              <button
                className="muf-icon-button"
                onClick={toggleLang}
                title={lang === 'en' ? L('Switch to Urdu') : lang === 'ur' ? L('Switch to Roman Urdu') : L('Switch to English')}
                aria-label={L('Switch language')}
              >
                <Languages size={19}/>
              </button>

              <button 
                className="muf-icon-button" 
                onClick={() => setIsDark(!isDark)} 
                title={isDark ? L('Switch to Light Mode') : L('Switch to Dark Mode')} 
                aria-label={L('Toggle theme')}
              >
                {isDark ? <Sun size={19}/> : <Moon size={19}/>} 
              </button>

              <button className="muf-profile" onClick={() => setAdminMenuOpen(true)} title={L('Open settings')} aria-label={L('Open settings')}>
                <span className="muf-avatar">
                  {currentUserAvatar ? (
                    <img src={currentUserAvatar} className="object-cover rounded-full" alt={username} />
                  ) : (
                    <Users size={18}/>
                  )}
                </span>
                <span><strong>{L('Welcome')} - {username}</strong><small>{userRole === 'admin' ? L('Administrator') : L('Worker')}</small></span>
                <ChevronDown size={17}/>
              </button>
              <button className="muf-icon-button muf-logout" onClick={handleLogout} title={L('Logout')} aria-label={L('Logout')}><LogOut size={18}/></button>
            </div>
          </header>

          <nav className="muf-top-nav" aria-label={L('Primary navigation')} ref={navRef}>
            <div className="muf-top-nav-scroll">
              {[
                { key: 'dashboard', tab: 'dashboard', label: L('Dashboard'), Icon: Home },
                { key: 'crops', tab: 'crops', label: L('Crops'), Icon: Sprout },
                ...(userRole === 'admin'
                  ? [{ key: 'finance', tab: 'finance', label: L('Finance'), Icon: DollarSign }]
                  : []),
                ...(userRole === 'admin'
                  ? [{ key: 'labor', tab: 'labor', label: L('Labor'), Icon: HardHat }]
                  : []),
                { key: 'tasks', tab: 'tasks', label: L('Health & Tasks'), Icon: HeartPulse },
                ...(userRole === 'admin'
                  ? [{ key: 'summary', tab: 'summary', label: L('Summary'), Icon: BarChart2 }]
                  : []),
                ...(userRole === 'admin'
                  ? [{ key: 'super_admin', tab: 'super_admin', label: 'Super Admin', Icon: ShieldCheck }]
                  : []),
              ].map(({ key, tab, label, Icon }) => (
                <div className={`muf-nav-item relative ${key === 'finance' ? 'muf-finance-nav-item' : ''}`} ref={key === 'finance' ? financeMenuAnchorRef : undefined} key={key}>
                  <div className="flex items-center">
                    <button type="button" className={`muf-nav-link ${activeNav === key ? 'active' : ''}`} onClick={() => { navigateTo(tab, key); setFinanceMenuOpen(false); }}><Icon size={15}/><span>{label}</span></button>
                    {key === 'finance' && <button type="button" ref={financeMenuTriggerRef} aria-label={L('Open Finance sections')} aria-expanded={financeMenuOpen} aria-controls="muf-finance-menu" onClick={toggleFinanceMenu} className="muf-nav-link !px-2"><ChevronDown size={14}/></button>}
                  </div>
                  {key === 'finance' && financeMenuOpen && createPortal(
                <div
                  id="muf-finance-menu"
                  className="muf-finance-menu"
                  role="group"
                  aria-label={L('Finance sections')}
                  style={financeMenuPosition}
                >{[{id:'ledger',label:'Ledger'},{id:'suppliers',label:'Supplier Khata'},{id:'zakat',label:'Zakat & Ushr'},{id:'loan',label:'Loan & Credit'},{id:'inventory',label:'Input Inventory'}].filter(item => item.id !== 'inventory' || userRole === 'admin').map(item => <button key={item.id} type="button" onClick={() => { navigateTo('finance', 'finance'); setAgriFinanceSubTab(item.id); setFinanceMenuOpen(false); }} className={`muf-finance-menu-item ${agriFinanceSubTab === item.id ? 'is-active' : ''}`}>{L(item.label)}</button>)}</div>,
                document.body
              )}
                </div>
              ))}
            </div>
          </nav>
</div>

          <div className="muf-body-frame">
            <main id="main-content" className="muf-main-content" tabIndex={-1}>
              {isDbMock && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-amber-800 dark:text-amber-200 px-4 py-3 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs font-medium shadow-sm animate-fade-in">
                  <div className="flex items-center gap-2 min-w-0"><AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 animate-pulse"/><span><strong>{L('Cannot reach the online database.')}</strong> {L('Your entries are kept on this device for now.')}</span></div>
                  <span className="text-[10px] bg-amber-200 dark:bg-amber-900/60 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">{L('Temporary mode')}</span>
                </div>
              )}

              {/* Tab views content area */}
              <div className="flex-1 min-h-0 flex flex-col">
          {loading && crops.length === 0 && finance.length === 0 && tasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
              <Loader className="animate-spin text-farm-600" size={28} />
              <p className="text-sm font-semibold">Loading farm data…</p>
            </div>
          )}
          
          {/* ───────────────── VIEW: DASHBOARD ───────────────── */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fade-in flex-1 muf-dashboard-workspace">
              {/* Worker panel — shown for non-admin users */}
              {userRole !== 'admin' && (() => {
                const today = mufToday();
                return (
                  <MufWorkerPanel
                    appName="Agri"
                    todayEntries={tasks.filter(t => t.due_date === today).map((t, i) => ({ id: `task-${i}`, label: t.title || '', sub: t.due_date || '' }))}
                    todayExpenses={finance.filter(f => f.date === today && f.type === 'expense').map((f, i) => ({ id: `exp-${i}`, label: `${f.category || 'Other'} Rs ${f.amount || 0}`, sub: f.date || '' }))}
                    todayHealth={[]}
                    quickActions={[
                      { label: L('Add Finance'), icon: <DollarSign size={16} />, onClick: () => navigateTo('finance') },
                      { label: L('Add Task'), icon: <HeartPulse size={16} />, onClick: () => navigateTo('tasks') },
                    ]}
                  />
                );
              })()}

              {/* Dashboard Crop Filter Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4 border-[color:var(--muf-color-border)]">
                <div>
                  <h2 className="text-base md:text-lg font-black text-slate-800 dark:text-white flex items-center gap-1.5"><LayoutDashboard size={20}/> {L('Dashboard')}</h2>
                  <p className="text-slate-500 text-xs">{L('Real-time indicators, operational financials, and scheduled crop cares.')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(
                      `*Usman Agri Farm — ${mufToday()}*\n` +
                      `🌾 Crops planted: ${crops.length}\n` +
                      `🌱 Growing now: ${crops.filter(c => c.status === 'Growing').length}\n` +
                      `💰 Net profit: Rs ${Number(dbNetProfit || 0).toLocaleString()}`
                    )}`, '_blank', 'noopener,noreferrer')}
                    title={L('Share today\'s summary on WhatsApp')}
                    className="flex items-center gap-1.5 rounded-lg border border-farm-300 dark:border-farm-700 px-3 py-2 text-xs font-bold text-farm-700 dark:text-farm-400 hover:bg-farm-50 dark:hover:bg-farm-900/30 transition cursor-pointer"
                  >
                    <Share2 size={14} /> Share
                  </button>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{L('Crop Filter:')}</span>
                  <select 
                    className={`border rounded-lg text-xs px-3 py-2 outline-none focus:border-farm-500 font-bold cursor-pointer ${
                      isDark ? 'bg-[#0f172a] border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                    }`}
                    value={dashboardCropFilter}
                    onChange={e => setDashboardCropFilter(e.target.value)}
                  >
                    <option value="all">{L('All Crops (Blended)')}</option>
                    {crops.map(c => (
                      <option key={c._id} value={c._id}>{c.name} ({c.season} {c.crop_year || 'N/A'})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status Grid Cards using grid-cols-3 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div 
                  onClick={() => setModal('crops_planted')}
                  className="muf-kpi-card cursor-pointer hover:scale-[1.02] transition-transform"
                >
                  <span className="muf-kpi-icon green"><Sprout size={22}/></span>
                  <div>
                    <small>{L('Crops Planted')}</small>
                    <strong><MufCountUpText text={String(crops.filter(c => dashboardCropFilter === 'all' ? true : c._id === dashboardCropFilter).length)} /></strong>
                    <p>{crops.filter(c => c.status === 'Growing' && (dashboardCropFilter === 'all' ? true : c._id === dashboardCropFilter)).length} Active Growing</p>
                  </div>
                </div>

                {userRole === 'admin' ? (
                  <div 
                    onClick={() => openLedgerProfitModal('dashboard', 'profit')}
                    className="muf-kpi-card cursor-pointer hover:scale-[1.02] transition-transform"
                  >
                    <span className={`muf-kpi-icon ${dbNetProfit >= 0 ? 'green' : 'wheat'}`}><TrendingUp size={22}/></span>
                    <div>
                      <small>{L('Operational Profit')}</small>
                      <strong className={dbNetProfit >= 0 ? 'text-farm-600 dark:text-farm-400' : 'text-red-400'}>
                        <MufCountUpText text={`Rs. ${formatCurrency(dbNetProfit)}`} />
                      </strong>
                      <p>Inflow: Rs. {formatCurrency(dbIncome)} | Outflow: Rs. {formatCurrency(dbExpense)}</p>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={() => navigateTo('tasks')}
                    className="muf-kpi-card cursor-pointer hover:scale-[1.02] transition-transform"
                  >
                    <span className="muf-kpi-icon green"><HeartPulse size={22}/></span>
                    <div>
                      <small>{L('My Assigned Duties')}</small>
                      <strong>{tasks.filter(t => (t.assigned_to || '').toLowerCase() === (username || '').toLowerCase() && t.status !== 'Completed').length}</strong>
                      <p>{tasks.filter(t => (t.assigned_to || '').toLowerCase() === (username || '').toLowerCase() && t.status === 'Completed').length} of my duties completed</p>
                    </div>
                  </div>
                )}

                <div 
                  onClick={() => setModal('pending_duties')}
                  className="muf-kpi-card cursor-pointer hover:scale-[1.02] transition-transform"
                >
                  <span className="muf-kpi-icon blue"><CheckSquare size={22}/></span>
                  <div>
                    <small>{L('Duties Scheduled')}</small>
                    <strong><MufCountUpText text={String(dashPendingTasks)} /></strong>
                    <p>{dashCompletedTasks} Duties completed</p>
                  </div>
                </div>
              </div>

              {/* ── This month vs last month (muf shared card) ── */}
              <button onClick={() => setShowCompare(true)} className="w-full text-left cursor-pointer">
                <div className="bg-white dark:bg-[#0f172a] border border-[color:var(--muf-color-border)] rounded-2xl shadow-sm p-4 flex flex-wrap items-center gap-x-6 gap-y-2 hover:shadow-md transition-shadow">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{L('This month vs last month')}</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    📈 Rs {cmp.curInc.toLocaleString()}{' '}
                    <span className={cmp.incPct === null ? 'text-slate-400' : cmp.incPct >= 0 ? 'text-farm-600' : 'text-red-500'}>{trendArrow(cmp.incPct)}</span>
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
                          📈 Rs {cmp.lyInc.toLocaleString()} → Rs {cmp.curInc.toLocaleString()}{' '}
                          <span className={cmp.lyIncPct === null ? 'text-slate-400' : cmp.lyIncPct >= 0 ? 'text-farm-600' : 'text-red-500'}>{trendArrow(cmp.lyIncPct)}</span>
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

              {/* Income trend (muf-charts) */}
              <div className="bg-white dark:bg-[#0f172a] border border-[color:var(--muf-color-border)] rounded-2xl shadow-sm p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">📈 {L('Monthly Income Trend')}</span>
                <div className="mt-2">
                  <MufAreaChart data={dashboardIncomeSeries} format={(v) => `Rs ${v.toLocaleString()}`} emptyText={L('No income entries yet')} />
                </div>
              </div>

              {/* Sub-panels for Quick Actions & Overview — clickable summary cards opening DetailModal popups */}
              <div className="muf-lower-grid">
                {/* Planted Sectors — summary card */}
                <button type="button" onClick={() => setShowPlantedSectorsModal(true)} className="muf-panel text-left hover:shadow-lg transition-shadow cursor-pointer">
                  <div className="muf-panel-heading">
                    <div>
                      <h3><Sprout size={21} /> {L('Planted Sectors')}</h3>
                      <p>{L('Latest active crop cycles in the soil.')}</p>
                    </div>
                    <ArrowUpRight size={17} className="text-slate-400"/>
                  </div>
                  <div className="px-4 pb-4 pt-1 space-y-2">
                    {dashCrops.length === 0 ? <p className="text-xs text-slate-500 dark:text-slate-400 py-2">{L('No active crop cycles.')}</p> : dashCrops.slice(0, 3).map(c => <div key={c._id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-2"><span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{c.name}</span><span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0">{c.field || c.status || 'Active'}</span></div>)}
                    <div className="flex items-center justify-between pt-1"><span className="text-[10px] text-slate-500">{dashCrops.length} active crop cycles</span><span className="text-[10px] font-bold text-farm-600 dark:text-farm-400 uppercase tracking-wider">{L('View All')} →</span></div>
                  </div>
                </button>

                {/* Care Roster — summary card */}
                <button type="button" onClick={() => setShowCareRosterModal(true)} className="muf-panel text-left hover:shadow-lg transition-shadow cursor-pointer">
                  <div className="muf-panel-heading">
                    <div>
                      <h3><HeartPulse size={21} /> {L('Care & Operations Roster')}</h3>
                      <p>{L('Current pending care duty schedules.')}</p>
                    </div>
                    <ArrowUpRight size={17} className="text-slate-400"/>
                  </div>
                  <div className="px-4 pb-4 pt-1 space-y-2">
                    {dashTasks.filter(t => t.status !== 'Completed').length === 0 ? <p className="text-xs text-slate-500 dark:text-slate-400 py-2">{L('No pending care tasks.')}</p> : dashTasks.filter(t => t.status !== 'Completed').slice(0, 3).map(t => <div key={t._id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-2"><span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{t.title}</span><span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0">{t.priority || t.status || 'Pending'}</span></div>)}
                    <div className="flex items-center justify-between pt-1"><span className="text-[10px] text-slate-500">{dashTasks.filter(t => t.status !== 'Completed').length} pending tasks</span><span className="text-[10px] font-bold text-farm-600 dark:text-farm-400 uppercase tracking-wider">{L('Open Board')} →</span></div>
                  </div>
                </button>
              </div>

              {/* Second Lower Grid: Recent Activities & Dynamic Weather */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                
                {/* Recent Activities — summary card */}
                <button type="button" onClick={() => setShowRecentActivitiesModal(true)} className="muf-panel text-left hover:shadow-lg transition-shadow cursor-pointer">
                  <div className="muf-panel-heading">
                    <div>
                      <h3><Calendar size={21}/> {L('Recent Activities')}</h3>
                      <p>{L('Historical log of crop care and financial balance entries.')}</p>
                    </div>
                    <ArrowUpRight size={17} className="text-slate-400"/>
                  </div>
                  <div className="px-4 pb-4 pt-1 space-y-2">
                    {dashRecentActivities.length === 0 ? <p className="text-xs text-slate-500 dark:text-slate-400 py-2">{L('No recent activities recorded.')}</p> : dashRecentActivities.slice(0, 4).map(a => <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-2"><span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{a.label}</span><span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0">{a.date || a.kind}</span></div>)}
                    <div className="flex items-center justify-between pt-1"><span className="text-[10px] text-slate-500">Showing up to 4 of {dashTasks.length + dashFinance.length}</span><span className="text-[10px] font-bold text-farm-600 dark:text-farm-400 uppercase tracking-wider">{L('View All')} →</span></div>
                  </div>
                </button>

                {/* Dynamic Real-time Weather & Tips Panel */}
                <section className="muf-panel">
                  <div className="muf-panel-heading">
                    <div>
                      <h3><CloudSun size={21}/> {L('Live Weather & Farming Advice')}</h3>
                      <p>{L('Farm weather from the saved farm location (or Haripur default).')}</p>
                    </div>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-xl border border-[color:var(--muf-color-border)] bg-amber-50/10 dark:bg-[#132017] shadow-xs">
                      <div className="flex items-center gap-3">
                        {(() => {
                          const { Icon, className } = WEATHER_ICON(weather.code);
                          return <Icon size={36} className={`${className} ${weather.code === 0 || weather.code == null ? 'animate-spin-slow' : ''}`} />;
                        })()}
                        <div>
                          <strong className="text-2xl font-black text-slate-800 dark:text-white">{weather.temp}°C</strong>
                          <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">{weather.condition}</span>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <MapPin size={12} /> {weather.city}
                      </span>
                    </div>

                    {/* Live agro-metrics that drive the seasonal advice below */}
                    {(weather.humidity != null || weather.soilTemp != null || weather.wind != null || rainForecast24h > 0) && (
                      <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                        {weather.soilTemp != null && (
                          <span className="muf-chip">Soil {weather.soilTemp}°C</span>
                        )}
                        {weather.humidity != null && (
                          <span className="muf-chip">Humidity {weather.humidity}%</span>
                        )}
                        {weather.wind != null && (
                          <span className="muf-chip">Wind {weather.wind} km/h</span>
                        )}
                        {rainForecast24h > 0 && (
                          <span className="muf-chip">Rain ~{rainForecast24h.toFixed(1)}mm/24h</span>
                        )}
                      </div>
                    )}

                    <div className="p-4 rounded-xl border border-farm-200 dark:border-farm-900/30 bg-farm-50 dark:bg-[#16301d] text-farm-800 dark:text-farm-200 space-y-2">
                      <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider">
                        <Leaf size={16} /> Seasonal Advice
                      </div>
                      <p className="text-xs leading-relaxed font-semibold">{getFarmingTip()}</p>
                    </div>
                  </div>
                </section>

              </div>
              {/* Quick Actions FAB */}
              <MufFab actions={[
                { icon: <DollarSign size={18} />, label: L('Add Finance Entry'), onClick: () => navigateTo('finance') },
                { icon: <Plus size={18} />, label: L('Add Crop'), onClick: () => navigateTo('crops') },
                { icon: <HeartPulse size={18} />, label: L('Add Task'), onClick: () => navigateTo('tasks') },
              ]} />

              {/* ── Planted Sectors popup ── */}
              <DetailModal
                open={showPlantedSectorsModal}
                onClose={() => setShowPlantedSectorsModal(false)}
                title={L('Planted Sectors')}
                subtitle={`${dashCrops.length} active crop cycles`}
                icon={<Sprout size={20} />}
                iconBg="bg-farm-100 text-farm-600 dark:bg-farm-900/30 dark:text-farm-400"
                size="big"
              >
                <div className="space-y-3">
                  {dashCrops.length === 0 ? (
                    <p className="text-slate-500 text-xs text-center py-8">{L('No crops currently registered.')}</p>
                  ) : dashCrops.map(c => (
                    <button
                      type="button"
                      key={c._id}
                      onClick={() => openPopup('selectedCrop', c)}
                      aria-label={`${L('Open crop profile')}: ${c.name}`}
                      className={`w-full flex justify-between items-center gap-3 p-3 rounded-xl border text-left transition-colors hover:border-farm-400 dark:hover:border-farm-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-farm-500 ${
                        isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold">{c.name}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Plot sector: {c.field || 'General'}</p>
                        <p className="muf-pc-micro">{L('Open profile for full crop details')}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase shrink-0 ${
                        c.status === 'Growing' ? 'bg-farm-900/20 text-farm-600 dark:text-farm-400 border border-farm-900/30' : 'bg-indigo-950 text-indigo-400 border border-indigo-900/30'
                      }`}>{c.status}</span>
                    </button>
                  ))}
                  <button type="button" onClick={() => { setShowPlantedSectorsModal(false); navigateTo('crops'); }} className="w-full mt-3 px-3 py-2 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-xl">{L('Open Crop Manager')} →</button>
                </div>
              </DetailModal>

              {/* ── Care Roster popup ── */}
              <DetailModal
                open={showCareRosterModal}
                onClose={() => setShowCareRosterModal(false)}
                title={L('Care & Operations Roster')}
                subtitle={L('{count} pending tasks', { count: dashTasks.filter(t => t.status !== 'Completed').length })}
                icon={<HeartPulse size={20} />}
                iconBg="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                size="small"
              >
                <div className="space-y-3">
                  {dashTasks.filter(t => t.status !== 'Completed').length === 0 ? (
                    <p className="text-slate-500 text-xs text-center py-8">{L('Care roster is clean.')}</p>
                  ) : dashTasks.filter(t => t.status !== 'Completed').map(t => (
                    <button
                      type="button"
                      key={t._id}
                      onClick={() => openPopup('selectedTask', t)}
                      aria-label={`${L('Open task details')}: ${t.title}`}
                      className={`w-full flex justify-between items-center gap-3 p-3 rounded-xl border text-left transition-colors hover:border-farm-400 dark:hover:border-farm-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-farm-500 ${
                        isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Circle size={14} className="text-slate-500 dark:text-slate-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold">{t.title}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">Assigned: {t.assigned_to || 'General'}</p>
                          <p className="muf-pc-micro">{L('Open task for due date, crew and notes')}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase shrink-0 ${
                        t.priority === 'High' ? 'bg-red-950 text-red-400 border border-red-900/20' : 'bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}>{t.priority}</span>
                    </button>
                  ))}
                  <button type="button" onClick={() => { setShowCareRosterModal(false); navigateTo('tasks'); }} className="w-full mt-3 px-3 py-2 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-xl">{L('Open Care Board')} →</button>
                </div>
              </DetailModal>

              {/* ── Recent Activities popup ── */}
              <DetailModal
                open={showRecentActivitiesModal}
                onClose={() => setShowRecentActivitiesModal(false)}
                title={L('Recent Activities')}
                subtitle={L('{count} total activities', { count: dashTasks.length + dashFinance.length })}
                icon={<Calendar size={20} />}
                iconBg="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
                size="small"
              >
                <div className="space-y-3">
                  {dashTasks.length === 0 && dashFinance.length === 0 && (
                    <p className="text-slate-500 text-xs text-center py-8">{L('No activities recorded yet.')}</p>
                  )}
                  {dashTasks.map(t => (
                    <button type="button" key={t._id} onClick={() => openPopup('selectedTask', t)}
                      aria-label={`${L('Open task details')}: ${t.title}`}
                      className="w-full flex justify-between items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-left transition-colors hover:border-farm-400 dark:hover:border-farm-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-farm-500">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 shrink-0">
                          <Sprout size={14}/>
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold">{t.title}</p>
                          <p className="text-[10px] text-slate-500">{t.due_date || 'Ongoing care'}</p>
                        </div>
                      </div>
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-farm-900/20 text-farm-600 dark:text-farm-400 border border-farm-900/30">{t.status || 'Pending'}</span>
                    </button>
                  ))}
                  {dashFinance.map(f => (
                    <button type="button" key={f._id} onClick={() => openPopup('selectedFinance', f)}
                      aria-label={`${L('Open ledger entry')}: ${f.category}, ${f.date || ''}`}
                      className="w-full flex justify-between items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-left transition-colors hover:border-farm-400 dark:hover:border-farm-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-farm-500">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-8 h-8 rounded-full flex items-center justify-center bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30 shrink-0">
                          <Coins size={14}/>
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold">{f.category}</p>
                          <p className="text-[10px] text-slate-500">{f.date || 'Ledger entry'}</p>
                          <p className="muf-pc-micro">{L('Open entry for amount, crop, notes and receipt')}</p>
                        </div>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                        f.type === 'expense'
                          ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30 text-red-600'
                          : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30 text-emerald-600'
                      }`}>{f.type}</span>
                    </button>
                  ))}
                </div>
              </DetailModal>
            </div>
          )}

          {/* ───────────────── VIEW: CROP MANAGER / IMAGE 02 ───────────────── */}
          {activeTab === 'crops' && (
            <div className="muf-crop-manager animate-fade-in">
              <div className="muf-page-hero">
                <div className="muf-page-title">
                  <div className="muf-title-icon"><Sprout size={30}/></div>
                  <div><h2>{L('Crops')}</h2><p>{L('Plan • Monitor • Maximize Your Harvest')}</p></div>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{L('Crop Filter:')}</span>
                    <select 
                      className={`border rounded-lg text-xs px-3 py-2 outline-none focus:border-farm-500 font-bold cursor-pointer ${
                        isDark ? 'bg-[#0f172a] border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                      }`}
                      value={cropIdFilter}
                      onChange={e => setCropIdFilter(e.target.value)}
                    >
                      <option value="all">{L('All Crops (Blended)')}</option>
                      {crops.map(c => (
                        <option key={c._id} value={c._id}>{c.name} ({c.season} {c.crop_year || 'N/A'})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {userRole === 'admin' && (
              <div className="muf-kpi-grid">
                <div 
                  onClick={() => setModal('crops_planted')}
                  className="muf-kpi-card cursor-pointer hover:scale-[1.02] transition-transform"
                >
                  <span className="muf-kpi-icon wheat"><Sprout size={22}/></span>
                  <div>
                    <small>{L('Total Cropped Area')}</small>
                    <strong>{(filteredCrops.reduce((n, c) => n + (parseFloat(c.area_kanal) || 0), 0)).toFixed(1)} <em>{L('Kanal')}</em></strong>
                    <p className="up">↗ Filtered area (kanal)</p>
                  </div>
                </div>

                <div 
                  onClick={() => setModal('crops_planted')}
                  className="muf-kpi-card cursor-pointer hover:scale-[1.02] transition-transform"
                >
                  <span className="muf-kpi-icon green"><Leaf size={22}/></span>
                  <div>
                    <small>{L('Total Production (Est.)')}</small>
                    <strong>{(filteredCrops.reduce((n,c)=>n+(Number(toKg(c.yield_kg, c.yield_unit))||0),0)/1000).toFixed(1)} <em>{L('Ton')}</em></strong>
                    <p className="up">↗ Filtered production (normalized)</p>
                  </div>
                </div>

                <div 
                  onClick={() => setModal('crops_planted')}
                  className="muf-kpi-card cursor-pointer hover:scale-[1.02] transition-transform"
                >
                  <span className="muf-kpi-icon green"><Sprout size={22}/></span>
                  <div>
                    <small>{L('Active Crops')}</small>
                    <strong>{filteredCrops.filter(c => ['Growing','Planted','Harvesting'].includes(c.status)).length}</strong>
                    <p>{filteredCrops.slice(0,3).map(c=>c.name).filter(Boolean).join(', ') || 'No filtered crops'}</p>
                  </div>
                </div>

                <div 
                  onClick={() => setModal('pending_duties')}
                  className="muf-kpi-card cursor-pointer hover:scale-[1.02] transition-transform"
                >
                  <span className="muf-kpi-icon blue"><Droplets size={22}/></span>
                  <div>
                    <small>{L('Care Duties')}</small>
                    <strong>{cropCareDutiesCount}</strong>
                    <p>{L('Pending duties for filtered crops')}</p>
                  </div>
                </div>

                {userRole === 'admin' ? (
                  <div 
                    onClick={() => openLedgerProfitModal('ledger', 'expense')}
                    className="muf-kpi-card cursor-pointer hover:scale-[1.02] transition-transform"
                  >
                    <span className="muf-kpi-icon gold"><FileText size={22}/></span>
                    <div>
                      <small>{L('Ledger Entries')}</small>
                      <strong>{cropLedgerEntriesCount}</strong>
                      <p>{cropLedgerEntriesCount ? 'Matching filtered crops' : 'No entries yet'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="muf-kpi-card">
                    <span className="muf-kpi-icon gold"><Leaf size={22}/></span>
                    <div>
                      <small>{L('Growing Now')}</small>
                      <strong>{crops.filter(c => c.status === 'Growing').length}</strong>
                      <p>{L('Active crop cycles in the soil')}</p>
                    </div>
                  </div>
                )}
              </div>
              )}

              <section className="muf-panel muf-my-crops">
                <div className="muf-panel-heading"><div><h3><Leaf size={21}/> {L('My Crops')}</h3><p>{L('Monitor every crop record from planting to harvest.')}</p></div><button onClick={() => { setCropIdFilter('all'); setCropFilter('all'); setCropSearch(''); setCropFieldFilter('all'); setCropSeasonFilter('all'); setCropYearFilter('all'); }} className="muf-text-action">{L('View All Crops')} <ArrowUpRight size={17}/></button></div>
                
                {/* Search & Dynamic Filters Bar */}
                <div className={`p-4 mt-4 mx-3 sm:mx-5 rounded-xl border flex flex-col sm:flex-row gap-3 items-stretch sm:items-center ${
                  isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  {/* Search Input */}
                  <div className="relative w-full sm:flex-1">
                    <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 pointer-events-none">
                      <Search size={16} />
                    </span>
                    <input 
                      type="text"
                      placeholder={L('Search crop, variety, or field plot...')}
                      className={`w-full pl-9 pr-4 py-2 text-xs rounded-lg border outline-none focus:border-farm-500 transition-colors ${
                        isDark ? 'bg-[#0f172a] border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                      }`}
                      value={cropSearch}
                      onChange={(e) => setCropSearch(e.target.value)}
                    />
                  </div>
                  
                  {/* Phase Filter Dropdown */}
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <select 
                      className={`border rounded-lg text-xs px-3 py-2 outline-none focus:border-farm-500 cursor-pointer ${
                        isDark ? 'bg-[#0f172a] border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                      }`}
                      value={cropFilter}
                      onChange={(e) => setCropFilter(e.target.value)}
                    >
                      <option value="all">{L('All Phases')}</option>
                      <option value="Planted">{L('Planted')}</option>
                      <option value="Growing">{L('Growing')}</option>
                      <option value="Harvesting">{L('Harvesting')}</option>
                      {userRole === 'admin' && <option value="Completed">{L('Completed')}</option>}
                    </select>

                    {/* Field Plot Filter Dropdown */}
                    <select 
                      className={`border rounded-lg text-xs px-3 py-2 outline-none focus:border-farm-500 cursor-pointer ${
                        isDark ? 'bg-[#0f172a] border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                      }`}
                      value={cropFieldFilter}
                      onChange={(e) => setCropFieldFilter(e.target.value)}
                    >
                      <option value="all">{L('All Fields')}</option>
                      {uniqueFields.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>

                    {/* Season Filter Dropdown */}
                    <select 
                      className={`border rounded-lg text-xs px-3 py-2 outline-none focus:border-farm-500 cursor-pointer ${
                        isDark ? 'bg-[#0f172a] border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                      }`}
                      value={cropSeasonFilter}
                      onChange={(e) => setCropSeasonFilter(e.target.value)}
                    >
                      <option value="all">{L('All Seasons')}</option>
                      <option value="Rabi">{L('Rabi')}</option>
                      <option value="Kharif">{L('Kharif')}</option>
                      {uniqueSeasons.filter(s => s !== 'Rabi' && s !== 'Kharif').map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>

                    {/* Crop Year Filter Dropdown */}
                    <select 
                      className={`border rounded-lg text-xs px-3 py-2 outline-none focus:border-farm-500 cursor-pointer ${
                        isDark ? 'bg-[#0f172a] border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                      }`}
                      value={cropYearFilter}
                      onChange={(e) => setCropYearFilter(e.target.value)}
                    >
                      <option value="all">{L('All Years')}</option>
                      {uniqueYears.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {showCropImport && userRole === 'admin' && (
                  <AgriCropCsvImport onImportRows={async (rows) => {
                    const outcomes = [];
                    for (const row of rows) {
                      const payload = Object.fromEntries(Object.entries(row).filter(([key, value]) => value !== ''));
                      try {
                        const cropPayload = { ...payload };
                      delete cropPayload.area_acres;
                      const areaKanal = payload.area_kanal !== undefined
                        ? payload.area_kanal
                        : payload.area_acres !== undefined
                          ? String(Number(payload.area_acres) * 8)
                          : '1.0';
                      await api.addCrop({
                          ...cropPayload,
                          area_kanal: areaKanal,
                          status: payload.status || 'Growing',
                          yield_unit: payload.yield_unit || 'kg',
                          season: payload.season || 'Rabi',
                          crop_year: payload.crop_year || String(new Date().getFullYear()),
                        });
                        outcomes.push({ ok: true });
                      } catch (error) {
                        outcomes.push({ ok: false, error });
                      }
                    }
                    await refreshData();
                    const saved = outcomes.filter((item) => item.ok).length;
                    const failed = outcomes.length - saved;
                    setShowCropImport(false);
                    showAlert(failed ? `Crop CSV/Excel import: ${saved} saved, ${failed} failed. Review the server logs and retry only the failed rows.` : `Crop CSV/Excel import complete: ${saved} crops saved.`);
                  }} />
                )}
                {crops.length === 0 ? (
                    <div className="muf-empty-crops"><div><Sprout size={36}/></div><h4>{L('No crop records yet')}</h4><p>Add your first wheat, corn, bajra, mattar, jundra, or any other crop.</p>{userRole === 'admin' && (<><button onClick={() => { setEditingCrop(null); setCropForm(getEmptyCropForm()); setShowCropModal(true); }} className="muf-primary-action small"><Plus size={16}/> {L('Add Crop')}</button><button type="button" onClick={() => setShowCropImport(open => !open)} className="rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-bold">Import CSV / Excel</button></>)}</div>
                  ) : filteredCrops.length === 0 ? (
                    <div className="muf-empty-crops"><div><Sprout size={36}/></div><h4>{L('No crops match this filter')}</h4><p>{L('Change the crop phase filter to see other records.')}</p></div>
                  ) : (
                    <MufEntityGrid
                      items={gridCrops}
                      onOpen={(it) => {
                        const crop = crops.find(c => c._id === it.id);
                        if (crop) setSelectedCrop(crop);
                      }}
                      emptyIcon={<Sprout size={36} />}
                      emptyTitle="No crops found"
                      emptyHint="Try clearing the filters or add your first crop."
                    />
                  )}
                  {cropPageError && <div role="alert" className="my-3 flex items-center justify-between gap-3 rounded-xl border border-red-300/60 p-3 text-xs text-red-700"><span>{cropPageError}</span><button type="button" onClick={() => fetchCropPage(cropPageNextSkip, cropListFilters, cropPageNextSkip === 0)} className="font-bold underline">Retry</button></div>}
                  {cropPageLoading && cropPageRows.length === 0 && <p role="status" className="py-5 text-center text-xs text-slate-500">Loading crop records…</p>}
                  {cropPageRows.length < cropPageTotal && <div className="flex justify-center py-4"><button type="button" disabled={cropPageLoading} onClick={() => fetchCropPage(cropPageNextSkip, cropListFilters, false)} className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-bold disabled:opacity-50">{cropPageLoading ? 'Loading crops…' : 'Load more crops (' + cropPageRows.length + ' of ' + cropPageTotal + ')'}</button></div>}
              </section>

              {/* FAB — Add New Crop */}
              {userRole === 'admin' && (
                <MufFab actions={[
                  { icon: <Plus size={18} />, label: L('Add Crop'), onClick: () => { setEditingCrop(null); setCropForm(getEmptyCropForm()); setShowCropModal(true); } },
                ]} />
              )}
            </div>
          )}

          {/* ───────────────── VIEW: LABOR ───────────────── */}
          {activeTab === 'labor' && userRole === 'admin' && (
            <LaborBoard
              crops={crops}
              userRole={userRole}
              formatCurrency={formatCurrency}
              refreshData={refreshData}
              showAlert={showAlert}
              confirm={confirm}
            />
          )}

          {/* ───────────────── VIEW: FINANCIAL LEDGER ───────────────── */}
          {activeTab === 'finance' && userRole === 'admin' && (
            <div className="space-y-6 animate-fade-in flex-1 muf-finance-surface">
              <div className="muf-page-hero">
                <div className="muf-page-title">
                  <div className="muf-title-icon"><FileText size={30}/></div>
                  <div>
                    <h2>{L('Finance')}{agriFinanceSubTab !== 'ledger' && <><span className="mx-2 text-slate-300 dark:text-slate-600">›</span><span className="text-emerald-700 dark:text-emerald-400">{L(({ suppliers: 'Supplier Khata', zakat: 'Zakat & Ushr', loan: 'Loan & Credit', inventory: 'Input Inventory' } as Record<string, string>)[agriFinanceSubTab] || 'Ledger')}</span></>}</h2>
                    <p>{agriFinanceSubTab === 'ledger' ? 'Verify seed logistics, operational fuels, wages, and harvest sales ledger flows.' : `Finance section · ${L(({ suppliers: 'Supplier Khata', zakat: 'Zakat & Ushr', loan: 'Loan & Credit', inventory: 'Input Inventory' } as Record<string, string>)[agriFinanceSubTab] || 'Ledger')}`}</p>
                  </div>
                </div>
              </div>

              {/* ── LEDGER SUB-TAB ── */}
              {agriFinanceSubTab === 'ledger' && (
                <>
              <div className="flex justify-end">
                <button type="button" onClick={() => setShowFinanceImport((open) => !open)} className="rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-bold">
                  {showFinanceImport ? 'Hide bulk import' : 'Import finance CSV / Excel'}
                </button>
              </div>
              {showFinanceImport && <AgriBulkCsvImport kind="finance" onImportRows={async (rows) => {
                const normalized = rows.map((row) => Object.fromEntries(Object.entries(row).filter(([, value]) => value !== '')));
                let saved = 0;
                let failed = 0;
                for (let start = 0; start < normalized.length; start += 200) {
                  const chunk = normalized.slice(start, start + 200);
                  try {
                    const response = await api.addFinanceBulk(chunk);
                    saved += response.data?.inserted ?? chunk.length;
                  } catch {
                    failed += chunk.length;
                  }
                }
                await refreshData();
                setShowFinanceImport(false);
                showAlert(failed ? `Finance import partially completed: ${saved} saved, ${failed} failed. Failed rows were not retried automatically.` : `Finance import complete: ${saved} records saved.`, failed > 0);
              }} />}
              {/* Financial Breakdown Panel */}
              <div className="muf-kpi-grid">
                <div 
                  onClick={() => openLedgerProfitModal('ledger', 'income')}
                  className="muf-kpi-card cursor-pointer hover:scale-[1.02] transition-transform"
                >
                  <span className="muf-kpi-icon green"><TrendingUp size={22}/></span>
                  <div>
                    <small>{L('Gross Income')}</small>
                    <strong>Rs. {formatCurrency(pageIncome)}</strong>
                    <p className="up">↗ Live revenue</p>
                  </div>
                </div>
                <div 
                  onClick={() => openLedgerProfitModal('ledger', 'expense')}
                  className="muf-kpi-card cursor-pointer hover:scale-[1.02] transition-transform"
                >
                  <span className="muf-kpi-icon wheat"><TrendingDown size={22}/></span>
                  <div>
                    <small>{L('Expenditures')}</small>
                    <strong>Rs. {formatCurrency(pageExpense)}</strong>
                    <p className="down text-red-500">↘ Direct outlays</p>
                  </div>
                </div>
                <div 
                  onClick={() => openLedgerProfitModal('ledger', 'profit')}
                  className="muf-kpi-card cursor-pointer hover:scale-[1.02] transition-transform"
                >
                  <span className={`muf-kpi-icon ${pageProfit >= 0 ? 'green' : 'blue'}`}><Scale size={22}/></span>
                  <div>
                    <small>{L('Net Profit Margin')}</small>
                    <strong className={pageProfit >= 0 ? 'text-farm-600 dark:text-farm-400' : 'text-red-400'}>
                      {pageIncome > 0 ? ((pageProfit / pageIncome) * 100).toFixed(1) : '0.0'}%
                    </strong>
                    <p>{pageProfit >= 0 ? '↗ Healthy balance' : '⚠️ Deficit status'}</p>
                  </div>
                </div>
              </div>

              {/* Filter controls heading */}
              <div className="flex flex-wrap items-center gap-2 justify-end">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{L('Crop Filter:')}</span>
                <select 
                  className={`border rounded-lg text-xs px-3 py-2 outline-none focus:border-farm-500 cursor-pointer ${
                    isDark ? 'bg-[#0f172a] border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                  }`}
                  value={financeCropFilter}
                  onChange={e => setFinanceCropFilter(e.target.value)}
                >
                  <option value="all">{L('All Crops')}</option>
                  {crops.map(c => (
                    <option key={c._id} value={c._id}>{c.name} ({c.season} {c.crop_year || 'N/A'})</option>
                  ))}
                </select>
                <select 
                  className={`border rounded-lg text-xs px-3 py-2 outline-none focus:border-farm-500 cursor-pointer ${
                    isDark ? 'bg-[#0f172a] border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                  }`}
                  value={financeFilter}
                  onChange={e => setFinanceFilter(e.target.value)}
                >
                  <option value="all">{L('All Flows')}</option>
                  <option value="income">{L('Revenue Only')}</option>
                  <option value="expense">{L('Expense Only')}</option>
                </select>
              </div>
              {/* Finance list grouped by crop folder */}
              <div className="space-y-4">
                {groupedFinances.length === 0 ? (
                  <section className="muf-panel p-8 text-center text-slate-500">
                    {L('Financial ledger contains no logs.')}
                  </section>
                ) : groupedFinances.map(group => {
                  return (
                    <section key={group.id} className="muf-panel overflow-hidden">
                      {/* Folder Header */}
                      <div
                        onClick={() => openLedgerGroup(group)}
                        className="muf-panel-heading cursor-pointer hover:bg-slate-100/40 dark:hover:bg-slate-900/10 transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-lg ${group.id === 'farm-wide' ? 'bg-slate-100 text-slate-600' : 'bg-farm-900/20 text-farm-500 dark:text-farm-400'}`}>
                            {group.id === 'farm-wide' ? <Database size={16} /> : <Sprout size={16} />}
                          </div>
                          <div>
                            <h3 className="text-sm font-black">{group.name}</h3>
                            <p className="text-[10px] text-slate-500">Plot: {group.plot} • {group.transactions.length} entries</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          <div className="text-xs">
                            <span className="text-slate-400 block text-[9px] uppercase tracking-wider">{L('Folder Balance')}</span>
                            <strong className={`font-black text-sm ${group.net >= 0 ? 'text-farm-600 dark:text-farm-400' : 'text-red-500'}`}>
                              Rs. {formatCurrency(group.net)}
                            </strong>
                          </div>
                          <ArrowUpRight
                            size={18}
                            className="text-slate-400"
                          />
                        </div>
                      </div>
                    </section>
                  );
                })}
              </div>
                </>
              )}

              {/* ── ZAKAT & USHR SUB-TAB ── */}
              {agriFinanceSubTab === 'zakat' && (
              <>
              {/* Zakat + Farm Profile — 2-column grid (muf-lower-grid) */}
              <div className="muf-lower-grid">
              {/* Yearly Zakat calculator (muf-zakat twin) — income − expenses = profit → chosen % */}
              {(() => {
                const thisYear = new Date().getFullYear();
                const years = [];
                for (let y = thisYear; y >= thisYear - 4; y--) years.push(String(y));
                const autoIncome = Math.round(finance.filter(f => f.type === 'income' && String(f.date || '').startsWith(zakatYear)).reduce((sum, f) => sum + (f.amount || 0), 0));
                const autoExpenses = Math.round(finance.filter(f => f.type === 'expense' && String(f.date || '').startsWith(zakatYear)).reduce((sum, f) => sum + (f.amount || 0), 0));
                const income = zakatIncomeOv === null ? autoIncome : (parseFloat(zakatIncomeOv) || 0);
                const expensesTotal = zakatExpenseOv === null ? autoExpenses : (parseFloat(zakatExpenseOv) || 0);
                const profit = income - expensesTotal;
                const pctNum = parseFloat(zakatPct) || 0;
                const amount = pctAmount(profit, pctNum);
                const zInput = 'w-full bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-xs outline-none focus:border-farm-500';
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowZakatPopup(true)}
                      className="muf-card-link w-full flex items-center gap-3 p-4 text-left"
                    >
                      <span className="shrink-0 w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center text-lg">🕌</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{L('Zakat calculator (yearly)')}</p>
                        <p className="text-[11px] text-slate-400 truncate">{L('Income − expenses = profit, then the rate you choose. The app only does the math — the ruling is your decision.')}</p>
                      </div>
                      <span className="shrink-0 text-[10px] font-bold text-farm-600 dark:text-farm-400 uppercase tracking-wider">{L('Open')} →</span>
                    </button>

                    <DetailModal open={showZakatPopup} onClose={() => setShowZakatPopup(false)} title={L('Zakat calculator (yearly)')} size="big"
                      icon={<span className="text-lg leading-none">🕌</span>} iconBg="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[11px] text-slate-500 flex-1">{L('Income − expenses = profit, then the rate you choose. The app only does the math — the ruling is your decision.')}</p>
                          <select className={zInput} style={{ width: 'auto' }} value={zakatYear} onChange={e => { setZakatYear(e.target.value); setZakatIncomeOv(null); setZakatExpenseOv(null); }}>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                          </select>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                          <div>
                            <label className="muf-label">{L('Income')} ({zakatYear})</label>
                            <input type="number" className={zInput} value={zakatIncomeOv === null ? autoIncome : zakatIncomeOv} onChange={e => setZakatIncomeOv(e.target.value)} />
                          </div>
                          <div>
                            <label className="muf-label">{L('Expenses')} ({zakatYear})</label>
                            <input type="number" className={zInput} value={zakatExpenseOv === null ? autoExpenses : zakatExpenseOv} onChange={e => setZakatExpenseOv(e.target.value)} />
                          </div>
                          <div>
                            <label className="muf-label">{L('Rate')} %</label>
                            <input type="number" step="any" min="0" className={zInput} value={zakatPct} onChange={e => setZakatPct(e.target.value)} />
                          </div>
                          <div className="flex flex-col justify-end">
                            <p className="text-[10px] text-slate-400 uppercase">{L('Profit')}: <span className={profit >= 0 ? 'text-farm-600 font-bold' : 'text-red-500 font-bold'}>Rs. {formatCurrency(profit)}</span></p>
                            <p className="text-base font-black text-farm-600 dark:text-farm-400">{L('Zakat')}: Rs. {formatCurrency(amount)}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => downloadZakatPdf({ periodLabel: zakatYear, income, expenses: expensesTotal, pct: pctNum })}
                            className="px-4 py-2 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-lg"
                          >{L('Download zakat statement (PDF)')}</button>
                          <button
                            type="button"
                            onClick={() => openMufPrint({
                              title: `Zakat Statement — ${zakatYear}`,
                              metaHtml: `<p>Generated: ${mufToday()}</p><p>Period: ${zakatYear}</p>`,
                              bodyHtml: zakatStatementBody({ periodLabel: zakatYear, income, expenses: expensesTotal, pct: pctNum }),
                            })}
                            className="px-4 py-2 border border-farm-600 text-farm-600 dark:text-farm-400 hover:bg-farm-900/10 text-xs font-bold rounded-lg"
                          >{L('Print')}</button>
                          <button
                            type="button"
                            onClick={() => {
                              // Year-end farm book: month-by-month + overview + per-category breakdown + zakat suggestion.
                              const months = [];
                              for (let m = 1; m <= 12; m++) months.push(`${zakatYear}-${String(m).padStart(2, '0')}`);
                              const monthly = months.map(mk => {
                                const inc = Math.round(finance.filter(f => f.type === 'income' && String(f.date || '').startsWith(mk)).reduce((sum, f) => sum + (f.amount || 0), 0));
                                const exp = Math.round(finance.filter(f => f.type === 'expense' && String(f.date || '').startsWith(mk)).reduce((sum, f) => sum + (f.amount || 0), 0));
                                return [mk, inc.toLocaleString(), exp.toLocaleString(), (inc - exp).toLocaleString()];
                              }).filter(row => row[1] !== '0' || row[2] !== '0');
                              const byCat = {};
                              finance.filter(f => f.type === 'expense' && String(f.date || '').startsWith(zakatYear)).forEach(f => {
                                const cat = (f.category || 'Other').split(' - ')[0];
                                byCat[cat] = (byCat[cat] || 0) + (f.amount || 0);
                              });
                              const catLines = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 6)
                                .map(([cat, amt]) => [cat, `Rs. ${Math.round(amt).toLocaleString()}`]);
                              downloadFarmBookPdf({
                                year: zakatYear,
                                overview: [
                                  ['Total income', `Rs. ${Math.round(income).toLocaleString()}`],
                                  ['Total expenses', `Rs. ${Math.round(expensesTotal).toLocaleString()}`],
                                  ['Yearly profit', `Rs. ${Math.round(profit).toLocaleString()}`],
                                ],
                                monthly,
                                sections: [
                                  ...(catLines.length ? [{ title: L('Where the money went'), lines: catLines }] : []),
                                  { title: `Zakat suggestion at ${pctNum}% of profit (your decision — see the zakat calculator)`, lines: [[`${Math.round(profit).toLocaleString()} × ${pctNum}%`, `Rs. ${Math.round(amount).toLocaleString()}`]] },
                                ],
                              });
                            }}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-lg"
                          >📕 {L('Yearly farm book (PDF)')}</button>
                        </div>
                      </div>
                    </DetailModal>
                  </>
                );
              })()}

              {/* ── Farm profile PDF for buyers (muf-profile twin) ── */}
              <FarmProfileCard
                lang={lang}
                storageKey="af_profile_contact"
                blurbEn="One page with your logo, land, crops, monthly income and contact — share it with new buyers."
                buildPdfData={() => buildAgriProfileData(crops, finance)}
              />
              </div>{/* end muf-lower-grid */}
                </>
              )}

              {/* ── SUPPLIERS SUB-TAB ── */}
              {agriFinanceSubTab === 'suppliers' && (
              <>
              {/* Supplier khata — dealers we buy from on credit */}
              <SupplierKhata
                suppliers={suppliers}
                payments={supplierPayments}
                financeEntries={finance}
                onChanged={refreshData}
                showAlert={showAlert}
              />
              </>
              )}

              {/* ── LOAN & CREDIT SUB-TAB ── */}
              {agriFinanceSubTab === 'loan' && (
              <>
              <button type="button" onClick={() => setShowLiabilityDetailsModal(true)} className="muf-panel w-full text-left hover:shadow-md transition-shadow muf-finance-surface">
                <div className="muf-panel-heading"><div><h3><Coins size={21}/> {L('Loan & Credit Liability Tracker')}</h3><p>{L('Review your recorded loans and credit liabilities.')}</p></div><span className="text-xs font-bold text-farm-600 dark:text-farm-400">Open details →</span></div>
                <div className="p-4 flex flex-wrap gap-4 text-xs"><span><strong>{liabilities.filter(l => l.status !== 'Paid').length}</strong> unpaid liabilities</span><span><strong>Rs. {formatCurrency(liabilities.filter(l => l.status !== 'Paid').reduce((sum, l) => sum + (Number(l.amount_owed) || 0), 0))}</strong> outstanding</span></div>
              </button>
              {showLiabilityDetailsModal && <DetailModal open={showLiabilityDetailsModal} onClose={() => setShowLiabilityDetailsModal(false)} title={L('Loan & Credit Liability Tracker')} subtitle={L('{count} recorded liabilities', { count: liabilities.length })} icon={<Coins size={20}/>} size="big">
              <div className="space-y-4">
                <div className="muf-section-head">
                  <p className="muf-pc-muted">{L('Track fertilizer, seed credit debts, and crop dealer loans (unpaid outlays count as committed crop costs).')}</p>
                  {userRole === 'admin' && (
                    <button
                      onClick={() => { setLiaForm({ creditor: '', amount_owed: '', due_date: '', crop_id: 'farm-wide', notes: '' }); setEditingLiabilityId(null); setShowLiabilityModal(true); }}
                      className="px-3 py-1.5 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-xs shrink-0"
                    >
                      <Plus size={14} /> Log Debt
                    </button>
                  )}
                </div>

                {liabilities.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-500">{L('No loans or credit liabilities recorded.')}</p>
                ) : (
                  <ul className="muf-rowlist">
                    {liabilities.map(l => {
                      const linkedCrop = crops.find(c => c._id === l.crop_id);
                      return (
                        <li key={l._id} className="muf-row muf-row--stack">
                          <div className="flex items-start justify-between gap-3">
                            <div className="muf-row-main">
                              <span className="muf-row-title muf-row-title--wrap">{l.creditor}</span>
                              {l.notes && <span className="muf-row-sub">{l.notes}</span>}
                            </div>
                            <span className={`muf-row-value shrink-0 whitespace-nowrap ${l.status === 'Paid' ? 'line-through opacity-60' : 'muf-row-value--bad'}`}>Rs. {formatCurrency(l.amount_owed)}</span>
                          </div>
                          <div className="muf-row-foot">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="muf-chip muf-chip--muted">{L('Due Date')}: {l.due_date || 'Ongoing'}</span>
                              {linkedCrop ? (
                                <span className="muf-chip muf-chip--ok"><Sprout size={10} /> {linkedCrop.name}</span>
                              ) : (
                                <span className="muf-chip muf-chip--muted">{L('Farm-wide')}</span>
                              )}
                              <span className={`muf-chip ${l.status === 'Paid' ? 'muf-chip--muted' : 'muf-chip--warn'}`}>{l.status}</span>
                            </div>
                            {userRole === 'admin' ? (
                              <div className="muf-row-actions">
                                {l.status === 'Pending' && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handlePayLiability(l._id); }}
                                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold rounded cursor-pointer transition-colors"
                                    title={L('Mark as Paid & log expense')}
                                    aria-label={L('Settle debt')}
                                  >
                                    {L('Settle Debt')}
                                  </button>
                                )}
                                {l.status === 'Pending' && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); startEditLiability(l); }}
                                    className="p-1 text-slate-500 dark:text-slate-400 hover:text-farm-600 rounded-lg cursor-pointer transition-colors"
                                    title={L('Edit Liability')}
                                    aria-label={L('Edit liability')}
                                  >
                                    <Edit3 size={14} />
                                  </button>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteLiability(l._id); }}
                                  className="p-1 text-slate-500 dark:text-slate-400 hover:text-red-400 rounded-lg cursor-pointer transition-colors"
                                  title={L('Delete Record')}
                                  aria-label={L('Delete liability')}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-500 dark:text-slate-400 text-xs italic">{L('Read-only')}</span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              </DetailModal>}
              </>
              )}

              {/* ── INPUT INVENTORY SUB-TAB (moved from Health & Tasks) ── */}
              {agriFinanceSubTab === 'inventory' && userRole === 'admin' && (
              <>
              <button type="button" onClick={() => setShowInventoryDetailsModal(true)} className="muf-panel w-full text-left hover:shadow-md transition-shadow muf-finance-surface">
                <div className="muf-panel-heading"><div><h3><Database size={21}/> {L('Input Inventory & Stocks')}</h3><p>{L('Review recorded seed, fertilizer, and pesticide stock.')}</p></div><span className="text-xs font-bold text-farm-600 dark:text-farm-400">Open details →</span></div>
                <div className="p-4 flex flex-wrap gap-4 text-xs"><span><strong>{inventory.length}</strong> stock items</span><span><strong>{inventory.filter(i => Number(i.current_stock) <= Number(i.low_stock_threshold)).length}</strong> at or below low-stock threshold</span></div>
              </button>
              {showInventoryDetailsModal && <DetailModal open={showInventoryDetailsModal} onClose={() => setShowInventoryDetailsModal(false)} title={L('Input Inventory & Stocks')} subtitle={L('{count} recorded stock items', { count: inventory.length })} icon={<Database size={20}/>} size="big">
              <div className="space-y-4">
                <div className="muf-section-head">
                  <p className="muf-pc-muted">{L('Track seeds, fertilizer, and pesticide stock levels (manually adjust or correct counts anytime).')}</p>
                  {userRole === 'admin' && (
                    <button
                      onClick={() => { setInvForm({ name: '', category: 'fertilizer', current_stock: '', unit: 'kg', low_stock_threshold: '10' }); setShowInventoryModal(true); }}
                      className="px-3 py-1.5 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-xs shrink-0"
                    >
                      <Plus size={14} /> New Stock Item
                    </button>
                  )}
                </div>

                {inventory.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-500">{L('No stock items logged in inventory.')}</p>
                ) : (
                  <ul className="muf-rowlist">
                    {inventory.map(item => {
                      const isLow = item.current_stock <= item.low_stock_threshold;
                      return (
                        <li key={item._id} className={`muf-row muf-row--stack${isLow ? ' muf-row--bad' : ''}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="muf-row-main">
                              <span className="muf-row-title muf-row-title--wrap">{item.name}</span>
                              <span className="muf-row-sub">Threshold: {item.low_stock_threshold} {item.unit}</span>
                            </div>
                            <span className={`muf-row-value shrink-0 whitespace-nowrap ${isLow ? 'muf-row-value--bad' : ''}`}>{item.current_stock} {item.unit}</span>
                          </div>
                          <div className="muf-row-foot">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="muf-chip muf-chip--muted">{item.category}</span>
                              {isLow ? (
                                <span className="muf-chip muf-chip--bad">⚠️ Low Stock Alert</span>
                              ) : (
                                <span className="muf-chip muf-chip--ok">✓ In Stock</span>
                              )}
                            </div>
                            <div className="muf-row-actions">
                              {userRole === 'admin' && (
                                <button
                                  onClick={() => { setInvForm({ ...item, current_stock: item.current_stock.toString(), low_stock_threshold: item.low_stock_threshold.toString() }); setShowInventoryModal(true); }}
                                  className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-farm-500 rounded-lg cursor-pointer transition-colors"
                                  title={L('Edit / Correct Stock Level')}
                                >
                                  <Edit3 size={14} />
                                </button>
                              )}
                              {userRole === 'admin' && (
                                <button
                                  onClick={() => handleDeleteInventory(item._id)}
                                  className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-400 rounded-lg cursor-pointer transition-colors"
                                  title={L('Delete Stock Item')}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              </DetailModal>}
              </>
              )}

              {/* FAB — Log Entry (finance) */}
              <MufFab actions={[
                { icon: <Plus size={18} />, label: L('Log Entry'), onClick: () => { setEditingFinance(null); setFinForm(getEmptyFinForm()); setFinanceBookTab('ledger'); setShowFinanceModal(true); } },
                { icon: <Coins size={18} />, label: L('Log Debt'), onClick: () => { setLiaForm({ creditor: '', amount_owed: '', due_date: '', crop_id: 'farm-wide', notes: '' }); setEditingLiabilityId(null); setShowLiabilityModal(true); } },
              ]} />
            </div>
          )}

          {/* ───────────────── VIEW: CARE & HEALTH PORTAL ───────────────── */}
          {activeTab === 'tasks' && (
            <div className="space-y-6 animate-fade-in flex-1">
              <div className="muf-page-hero">
                <div className="muf-page-title">
                  <div className="muf-title-icon"><HeartPulse size={30}/></div>
                  <div>
                    <h2>{L('Health & Tasks')}</h2>
                    <p>Assign and monitor soil checkups, crop watering schedules, and organic pesticide treatments.</p>
                  </div>
                </div>
                {userRole === 'admin' && (
                  <button 
                    onClick={() => { setEditingTask(null); setTaskForm(getEmptyTaskForm()); setShowTaskModal(true); }}
                    className="muf-primary-action animate-fade-in"
                  >
                    <Plus size={19} /> Schedule Care
                  </button>
                )}
              </div>

              {userRole === 'admin' && (
                <div className="flex justify-end">
                  <button type="button" onClick={() => setShowTaskImport((open) => !open)} className="rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-bold">
                    {showTaskImport ? 'Hide bulk import' : 'Import tasks CSV / Excel'}
                  </button>
                </div>
              )}
              {showTaskImport && userRole === 'admin' && <AgriBulkCsvImport kind="tasks" onImportRows={async (rows) => {
                const normalized = rows.map((row) => Object.fromEntries(Object.entries(row).filter(([, value]) => value !== '')));
                let saved = 0;
                let failed = 0;
                for (let start = 0; start < normalized.length; start += 200) {
                  const chunk = normalized.slice(start, start + 200);
                  try {
                    const response = await api.addTasksBulk(chunk);
                    saved += response.data?.inserted ?? chunk.length;
                  } catch {
                    failed += chunk.length;
                  }
                }
                await refreshData();
                setShowTaskImport(false);
                showAlert(failed ? `Task import partially completed: ${saved} saved, ${failed} failed. Failed rows were not retried automatically.` : `Task import complete: ${saved} records saved.`, failed > 0);
              }} />}
              {rainForecast24h > 5 && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl text-amber-800 dark:text-amber-300 text-xs md:text-sm flex items-start gap-3 animate-fade-in shadow-xs">
                  <span className="text-xl">🌧️</span>
                  <div>
                    <span className="font-extrabold text-amber-950 dark:text-amber-200 block text-sm">Real-time Weather Alert: Rain Forecasted ({rainForecast24h.toFixed(1)}mm in next 24h)</span>
                    <span className="leading-relaxed block mt-1">
                      Our live meteorology station indicates significant incoming rainfall. 
                      Please review all <strong>irrigation, watering, and chemical spray schedules</strong>, and consider postponing them to prevent soil flooding or fertilizer run-offs.
                    </span>
                  </div>
                </div>
              )}

              {/* TODAY'S FIELD CREW — live crew presence & deployment (admin only) */}
              {userRole === 'admin' && laborers.length > 0 && (() => {
                const todayStr = mufToday();
                const todaysRows = todayAttendance.filter(a => a.date === todayStr);
                const presentIds = new Set(todaysRows.map(a => a.laborer_id));
                const pendingTasksWithCrew = tasks.filter(t => t.status === 'Pending' && (t.laborer_ids || []).length > 0);
                const deploymentOf = (lid) => {
                  const t = pendingTasksWithCrew.find(x => (x.laborer_ids || []).includes(lid));
                  if (!t) return null;
                  const cropName = t.crop_id ? (crops.find(c => c._id === t.crop_id)?.name || '') : '';
                  return { title: t.title, crop: cropName };
                };
                return (
                  <section className="muf-panel animate-fade-in">
                    <div className="muf-panel-heading">
                      <div>
                        <h3><HardHat size={21} /> {L('Today\'s Field Crew')}</h3>
                        <p>{todaysRows.length} of {laborers.length} marked present today • tap a name to open Field Labor</p>
                      </div>
                      <button onClick={() => navigateTo('labor')} className="muf-text-action">{L('Attendance Board')} <ArrowUpRight size={17}/></button>
                    </div>
                    <div className="p-5 flex flex-wrap gap-2">
                      {laborers.map(l => {
                        const present = presentIds.has(l._id);
                        const row = todaysRows.find(a => a.laborer_id === l._id);
                        const dep = deploymentOf(l._id);
                        return (
                          <button
                            key={l._id}
                            type="button"
                            onClick={() => navigateTo('labor')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-colors cursor-pointer ${
                              present
                                ? 'bg-farm-50 dark:bg-[#16301d] border-farm-200 dark:border-farm-900/40'
                                : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-80'
                            }`}
                          >
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${present ? 'bg-farm-500' : 'bg-slate-300 dark:bg-slate-700'}`} />
                            <span>
                              <span className="block text-xs font-extrabold text-slate-800 dark:text-white">{l.name}</span>
                              <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                {present
                                  ? `Present (${row?.day_type === 'half' ? 'half day' : 'full day'})${dep ? ` • ${dep.title}${dep.crop ? ` — ${dep.crop}` : ''}` : ''}`
                                  : (dep ? `Not marked yet • assigned: ${dep.title}${dep.crop ? ` — ${dep.crop}` : ''}` : 'Not marked yet')}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })()}

              {/* Tasks Roster Board inside an .muf-panel */}
              <section className="muf-panel">
                <div className="muf-panel-heading">
                  <div>
                    <h3><HeartPulse size={21}/> {L('Duty Care Roster')}</h3>
                    <p>{L('Monitor fertilizer applications, soil checkups, and water rosters.')}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{L('Crop Filter:')}</span>
                    <select 
                      className={`border rounded-lg text-xs px-3 py-2 outline-none focus:border-farm-500 cursor-pointer ${
                        isDark ? 'bg-[#0f172a] border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                      }`}
                      value={taskCropFilter}
                      onChange={e => setTaskCropFilter(e.target.value)}
                    >
                      <option value="all">{L('All Crops (Blended)')}</option>
                      {crops.map(c => (
                        <option key={c._id} value={c._id}>{c.name} ({c.season} {c.crop_year || 'N/A'})</option>
                      ))}
                    </select>
                    <select 
                      className={`border rounded-lg text-xs px-3 py-2 outline-none focus:border-farm-500 cursor-pointer ${
                        isDark ? 'bg-[#0f172a] border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                      }`}
                      value={taskFilter}
                      onChange={e => setTaskFilter(e.target.value)}
                    >
                      <option value="all">{L('All Assignments')}</option>
                      <option value="Pending">{L('Pending / In-Progress')}</option>
                      <option value="Completed">{L('Completed Duties')}</option>
                    </select>
                  </div>
                </div>

                {taskPageError && <div role="alert" className="my-3 flex items-center justify-between gap-3 rounded-xl border border-red-300/60 p-3 text-xs text-red-700"><span>{taskPageError}</span><button type="button" onClick={() => fetchTaskPage(taskPageNextSkip, taskListFilters, taskPageNextSkip === 0)} className="font-bold underline">Retry</button></div>}
                {taskPageLoading && taskPageRows.length === 0 && <p role="status" className="py-5 text-center text-xs text-slate-500">Loading task records…</p>}
                <div className="muf-crop-grid">
                  {tasks.length === 0 ? (
                    <div className="muf-empty-crops">
                      <div><HeartPulse size={36}/></div>
                      <h4>{L('Duty care roster is clean')}</h4>
                      <p>{L('No active care schedules or tasks registered in the database.')}</p>
                    </div>
                  ) : filteredTasks.length === 0 ? (
                    <div className="muf-empty-crops">
                      <div><HeartPulse size={36}/></div>
                      <h4>{L('No duties match filter')}</h4>
                      <p>{L('Try switching to another status or scheduled care assignment filter.')}</p>
                    </div>
                  ) : taskPageRows.map((t, idx) => (
                    <article 
                      key={t._id} 
                      className="muf-crop-card cursor-pointer hover:scale-[1.01] transition-transform" 
                      style={{
                        animationDelay: `${idx * .06}s`,
                        opacity: t.status === 'Completed' ? 0.75 : 1
                      }}
                      onClick={() => setSelectedTask(t)}
                    >
                      {/* Card Header styling matching Crop Manager but using icons */}
                      <div 
                        className={`h-24 relative flex items-center justify-center bg-cover bg-center ${
                          t.status === 'Completed' 
                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-500' 
                            : t.priority === 'High' 
                              ? 'bg-red-500 dark:bg-red-900/30 text-white' 
                              : 'bg-farm-600 dark:bg-farm-900/30 text-white'
                        }`}
                        style={t.image_base64 ? { backgroundImage: `url(${t.image_base64})` } : {}}
                      >
                        {t.image_base64 && <div className="absolute inset-0 bg-black/45" />}
                        <span className={`muf-status ${t.status === 'Completed' ? 'completed' : t.status === 'Pending' ? 'growing' : 'harvesting'}`}>{t.status}</span>
                        <span className="w-12 h-12 rounded-full flex items-center justify-center bg-white/10 backdrop-blur-md text-white border border-white/25 shadow-sm z-10">
                          {t.priority === 'High' ? <AlertTriangle size={24} /> : <HeartPulse size={24} />}
                        </span>
                      </div>

                      <div className="muf-crop-card-body">
                        {/* Title & Priority Tag */}
                        <div className="muf-crop-name">
                          <div>
                            <h4 className={`${t.status === 'Completed' ? 'line-through text-slate-400' : ''}`}>{t.title}</h4>
                            <p className="font-extrabold uppercase text-[9px] tracking-wider text-slate-500 mt-1">
                              {t.priority} Priority
                            </p>
                          </div>
                        </div>

                        {/* Notes / Description */}
                        {t.notes && (
                          <p className={`text-[11px] line-clamp-2 p-2 rounded-lg border my-3 ${
                            isDark ? 'text-slate-400 bg-slate-900/40 border-slate-800' : 'text-slate-600 bg-slate-50 border-slate-200'
                          }`}>
                            {t.notes}
                          </p>
                        )}

                        {/* Assignment Details */}
                        <div className="muf-crop-stats pt-2 border-t border-slate-100 dark:border-slate-800/60">
                          <span><Users size={14}/> {t.assigned_to || ((t.laborer_names || []).length ? `Crew: ${(t.laborer_names || []).join(', ')}` : 'Broadcast Duty')}</span>
                          <span><Calendar size={14}/> {t.due_date || 'Ongoing care'}</span>
                        </div>

                        {/* Deployed Field Crew chips (names snapshot — safe for all roles) */}
                        {(t.laborer_names || []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {(t.laborer_names || []).map((name, i) => (
                              <span key={`${name}-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40">
                                <HardHat size={9} /> {name}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Actions Footer */}
                        <div className="muf-crop-actions border-t border-slate-100 dark:border-slate-800/60 pt-3 mt-3">
                          {t.status === 'Pending' ? (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleCompleteTask(t._id); }}
                              className="muf-detail-btn flex items-center gap-1.5"
                            >
                              <CheckCircle size={13} /> Complete
                            </button>
                          ) : (
                            <div className="flex-1 flex justify-between items-center bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                              <span className="text-slate-400 dark:text-slate-500 font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1">
                                ✓ Done
                              </span>
                              {userRole === 'admin' && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleRevertTask(t); }}
                                  className="text-[10px] text-amber-600 hover:text-amber-500 font-bold uppercase hover:underline cursor-pointer"
                                  title={L('Undo / Revert to Pending')}
                                >
                                  {L('Undo')}
                                </button>
                              )}
                            </div>
                          )}

                          {userRole === 'admin' && (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); handleEditTask(t); }} className="muf-mini-icon" title={L('Edit Task')} aria-label={L('Edit task')}>
                                <Edit3 size={14} />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteTask(t._id); }} className="muf-mini-icon danger" title={L('Delete Task')} aria-label={L('Delete task')}>
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                {taskPageRows.length < taskPageTotal && <div className="flex justify-center py-4"><button type="button" disabled={taskPageLoading} onClick={() => fetchTaskPage(taskPageNextSkip, taskListFilters, false)} className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-bold disabled:opacity-50">{taskPageLoading ? 'Loading tasks…' : 'Load more tasks (' + taskPageRows.length + ' of ' + taskPageTotal + ')'}</button></div>}

              </section>

              {/* Input Inventory & Stocks moved to Finance tab (sub-tab: Input Inventory) */}
            </div>
          )}

          {/* ───────────────── VIEW: MONTHLY SUMMARY ───────────────── */}
          {/* ───────────────── VIEW: MONTHLY SUMMARY / REPORTS ───────────────── */}
          {activeTab === 'summary' && userRole === 'admin' && (
            <div className="space-y-6 animate-fade-in flex-1">
              <div className="muf-page-hero">
                <div className="muf-page-title">
                  <div className="muf-title-icon"><BarChart3 size={30}/></div>
                  <div>
                    <h2>{L('Summary')}</h2>
                    <p>Aggregated analytics and development trend data for crops yield and operational ledger budgets.</p>
                  </div>
                </div>
                
                {/* Period & Crop Selectors */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{L('Sort Order:')}</span>
                    <select 
                      className={`border rounded-lg text-xs px-3 py-2 outline-none focus:border-farm-500 font-bold cursor-pointer ${
                        isDark ? 'bg-[#0f172a] border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                      }`}
                      value={sortOrder}
                      onChange={e => setSortOrder(e.target.value)}
                    >
                      <option value="newest">{L('Newest First')}</option>
                      <option value="oldest">{L('Oldest First')}</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{L('Crop Filter:')}</span>
                    <select 
                      className={`border rounded-lg text-xs px-3 py-2 outline-none focus:border-farm-500 font-bold cursor-pointer ${
                        isDark ? 'bg-[#0f172a] border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                      }`}
                      value={reportsCropFilter}
                      onChange={e => setReportsCropFilter(e.target.value)}
                    >
                      <option value="all">{L('All Crops (Blended)')}</option>
                      {crops.map(c => (
                        <option key={c._id} value={c._id}>{c.name} ({c.season} {c.crop_year || 'N/A'})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Period Stats Grid using .muf-kpi-grid */}
              <div className="muf-kpi-grid">
                <div 
                  onClick={() => openLedgerProfitModal('reports', 'income')}
                  className="muf-kpi-card cursor-pointer hover:scale-[1.02] transition-transform"
                >
                  <span className="muf-kpi-icon green"><TrendingUp size={22}/></span>
                  <div>
                    <small>{L('Period Income')}</small>
                    <strong>Rs. {formatCurrency(periodIncome)}</strong>
                    <p className="up">↗ Live period revenue</p>
                  </div>
                </div>

                <div 
                  onClick={() => openLedgerProfitModal('reports', 'expense')}
                  className="muf-kpi-card cursor-pointer hover:scale-[1.02] transition-transform"
                >
                  <span className="muf-kpi-icon wheat"><TrendingDown size={22}/></span>
                  <div>
                    <small>{L('Period Expense')}</small>
                    <strong>Rs. {formatCurrency(periodExpense)}</strong>
                    <p className="down text-red-500">↘ Direct period outlays</p>
                  </div>
                </div>

                <div 
                  onClick={() => openLedgerProfitModal('reports', 'profit')}
                  className="muf-kpi-card cursor-pointer hover:scale-[1.02] transition-transform"
                >
                  <span className={`muf-kpi-icon ${periodNet >= 0 ? 'green' : 'blue'}`}><Scale size={22}/></span>
                  <div>
                    <small>{L('Operating Profit')}</small>
                    <strong className={periodNet >= 0 ? 'text-farm-600 dark:text-farm-400' : 'text-red-400'}>
                      Rs. {formatCurrency(periodNet)}
                    </strong>
                    <p>{periodNet >= 0 ? '↗ Period surplus' : '⚠️ Period deficit'}</p>
                  </div>
                </div>

                <div 
                  onClick={() => openLedgerProfitModal('reports', 'margin')}
                  className="muf-kpi-card cursor-pointer hover:scale-[1.02] transition-transform"
                >
                  <span className="muf-kpi-icon gold"><CheckCircle size={22}/></span>
                  <div>
                    <small>{L('Operating Margin')}</small>
                    <strong>{periodMargin}%</strong>
                    <p>{L('Financial efficiency')}</p>
                  </div>
                </div>
              </div>

              <div className="muf-lower-grid">
                
                {/* Month-by-Month comparative table inside .muf-panel */}
                <section className="muf-panel">
                  <div className="muf-panel-heading">
                    <div>
                      <h3><BarChart3 size={21}/> {L('Month-by-Month Trends')}</h3>
                      <p>Comparative crops and ledger cashflows per month (Click to drill down).</p>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto p-5">
                    <table className="muf-reflow w-full text-left border-collapse text-xs md:text-sm">
                      <thead>
                        <tr>
                          <th className="px-4 py-3">{L('Month')}</th>
                          <th className="px-4 py-3">{L('Crops Planted')}</th>
                          <th className="px-4 py-3">{L('Income')}</th>
                          <th className="px-4 py-3">{L('Expense')}</th>
                          <th className="px-4 py-3 text-right">{L('Net Profit')}</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y text-xs md:text-sm ${
                        isDark ? 'divide-slate-800 text-slate-300' : 'divide-slate-200 text-slate-700'
                      }`}>
                        {monthlyComparisonRows.map(([month, val]) => (
                          <tr 
                            key={month} 
                            onClick={() => setSelectedMonthRow([month, val])}
                            className="hover:bg-slate-100/40 dark:hover:bg-slate-900/30 transition-colors animate-fade-in cursor-pointer"
                          >
                            <td data-label={L('Month')} className="px-4 py-4 font-extrabold text-slate-700 dark:text-slate-300">{month}</td>
                            <td data-label={L('Crops')} className="px-4 py-4 text-slate-500">{val.cropsCount} cycles</td>
                            <td data-label={L('Income')} className="px-4 py-4 text-farm-600 dark:text-farm-400 font-bold">Rs. {formatCurrency(val.income)}</td>
                            <td data-label={L('Expense')} className="px-4 py-4 text-red-500 dark:text-red-400 font-bold">Rs. {formatCurrency(val.expense)}</td>
                            <td data-label="Net" className={`px-4 py-4 text-right font-black ${val.income - val.expense >= 0 ? 'text-farm-500' : 'text-red-500'}`}>
                              Rs. {formatCurrency(val.income - val.expense)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Expense Category Percentage Breakdown inside .muf-panel */}
                <section className="muf-panel">
                  <div className="muf-panel-heading">
                    <div>
                      <h3><TrendingDown size={21}/> {L('Outflow Breakdown')}</h3>
                      <p>{L('Direct expenditure category analysis (Click to drill down).')}</p>
                    </div>
                  </div>
                  
                  <div className="p-5 space-y-4 overflow-y-auto max-h-[350px]">
                    {expenseBreakdown.map(item => (
                      <div 
                        key={item.category} 
                        onClick={() => setSelectedExpenseCategory(item)}
                        className="space-y-1.5 cursor-pointer hover:bg-slate-100/40 dark:hover:bg-slate-900/10 p-2 rounded-lg transition-colors"
                      >
                        <div className="flex justify-between items-start gap-2 text-xs">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 min-w-0 flex-1 break-words">{item.category}</span>
                          <span className="text-slate-500 font-bold shrink-0 text-right whitespace-nowrap">Rs. {formatCurrency(item.amount)} ({item.percentage}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-red-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {expenseBreakdown.length === 0 && (
                      <p className="text-slate-500 text-xs text-center py-8 italic">{L('No expenditures logged during this period range.')}</p>
                    )}
                  </div>
                </section>

              </div>

              {/* Crop Profitability Leaderboard */}
              <section className="muf-panel">
                <div className="muf-panel-heading">
                  <div>
                    <h3><TrendingUp size={21}/> {L('Crop Profitability Leaderboard')}</h3>
                    <p>{L('Crops ranked by Net Profit per Kanal (highest profit-per-kanal first).')}</p>
                  </div>
                </div>
                <div className="p-5">
                  {sortedCropsProfitability.length === 0 ? (
                    <p className="text-center text-slate-500 italic py-8">{L('No crops found to rank.')}</p>
                  ) : (
                    <div className="muf-entity-grid">
                      {sortedCropsProfitability.map((c, index) => {
                        const normalizedYieldKg = toKg(c.yield_kg, c.yield_unit);
                        const rankTone = index === 0 ? 'good' : index === 1 ? 'info' : index === 2 ? 'warn' : 'muted';
                        const rankBadge = index === 0 ? '🥇 #1' : index === 1 ? '🥈 #2' : index === 2 ? '🥉 #3' : `#${index + 1}`;
                        return (
                          <article
                            key={c._id}
                            className="muf-entity-card"
                          >
                            <div className="muf-entity-photo muf-entity-photo-noimg">
                              <span className="muf-entity-emoji">🌱</span>
                              <span className="muf-entity-status" data-tone={rankTone}>{rankBadge}</span>
                              <span className="muf-entity-round-icon">🌱</span>
                            </div>
                            <div className="muf-entity-body">
                              <div className="muf-entity-name">
                                <div style={{ minWidth: 0 }}>
                                  <h4>{c.name}</h4>
                                  {c.variety && <p>{c.variety}</p>}
                                </div>
                                <span className={`muf-entity-chip ${c.profitPerKanal >= 0 ? '' : 'text-red-500'}`}>
                                  Rs. {formatCurrency(c.profitPerKanal.toFixed(0))}/kanal
                                </span>
                              </div>
                              <div className="muf-entity-stats">
                                <span><TrendingDown size={11}/> <span>Expenses: Rs. {formatCurrency(c.spent)}</span></span>
                                <span><TrendingUp size={11}/> <span>Income: Rs. {formatCurrency(c.earned)}</span></span>
                                <span><Scale size={11}/> <span className={c.netProfit >= 0 ? 'text-farm-600' : 'text-red-500'}>Net: Rs. {formatCurrency(c.netProfit)}</span></span>
                                <span><Ruler size={11}/> <span>Area: {c.area} Kanal</span></span>
                                {c.yield_kg > 0 && (
                                  <span><Sprout size={11}/> <span>Yield: {formatYield(normalizedYieldKg, c.yield_unit)}</span></span>
                                )}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              {/* PDF / CSV Exports Row — follows this page's Crop Filter & Sort Order */}
              <div className="flex gap-2 flex-wrap items-center pt-2">
                <button 
                  onClick={handleExportMonthlyCSV}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer border border-slate-200 dark:border-slate-700 shadow-sm"
                >
                  <Download size={14} /> Export CSV Statement
                </button>
                <button 
                  onClick={handlePrintMonthlyPDF}
                  className="px-4 py-2 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-md"
                >
                  <Printer size={14} /> Print PDF Performance Statement
                </button>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Exporting: {reportsCropName} · {sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
                </span>
              </div>
            </div>
          )}

          {activeTab === 'super_admin' && userRole === 'admin' && <SuperAdminTab />}
        </div>
      </main>

      </div> {/* closes muf-body-frame */}

      <footer className="muf-app-footer">
        <span className="muf-footer-brand">🌾 Usman Agri Farm © {new Date().getFullYear()}</span>
        <span className="muf-footer-meta">
          <span>{username}</span>
          <span>{userRole === 'admin' ? 'Administrator' : 'Worker'}</span>
        </span>
      </footer>

      </div> {/* closes muf-layout */}
      </div> {/* closes muf-app-shell */}

      {/* Floating Action/Saving Toast Indicator */}
      <AnimatePresence>
        {alertMsg.text && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-6 z-[var(--muf-z-toast)] p-4 rounded-xl shadow-2xl border text-xs md:text-sm font-bold flex items-start gap-3 max-w-sm w-auto ${
              alertMsg.isError 
                ? 'bg-red-50 dark:bg-red-950/90 border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-200' 
                : 'bg-farm-50 dark:bg-farm-950/90 border-farm-200 dark:border-farm-900/60 text-farm-800 dark:text-farm-200'
            }`}
          >
            {alertMsg.isError ? <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" /> : <CheckCircle size={18} className="text-farm-500 shrink-0 mt-0.5" />}
            <span className="min-w-0 break-words">{alertMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── MODALS ─── */}

      {/* CROP FORM MODAL */}
      <FormOverlay
        open={showCropModal}
        onClose={() => { setShowCropModal(false); setEditingCrop(null); }}
        title={editingCrop ? "Modify Crop Cycle" : "Log New Crop cycle"}
        subtitle={editingCrop ? "Update crop record" : "Plant a new crop"}
        icon={<Sprout size={16} />}
       size="small">
            <form onSubmit={handleCropSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="muf-label">Crop Name *</label>
                  <input required className="muf-field" value={cropForm.name} onChange={e => setCropForm({...cropForm, name: e.target.value})} placeholder={L('e.g. Premium Rice')} />
                </div>
                <div>
                  <label className="muf-label">{L('Variety / Classification')}</label>
                  <input className="muf-field" value={cropForm.variety} onChange={e => setCropForm({...cropForm, variety: e.target.value})} placeholder={L('e.g. Basmati 370')} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="muf-label">{L('Field / Plot Sector')}</label>
                  <input className="muf-field" value={cropForm.field} onChange={e => setCropForm({...cropForm, field: e.target.value})} placeholder={L('e.g. Sector 3A')} />
                </div>
                <div>
                  <label className="muf-label">Sizing Area (Kanal) *</label>
                  <input required type="number" step="0.1" className="muf-field" value={cropForm.area_kanal} onChange={e => setCropForm({...cropForm, area_kanal: e.target.value})} placeholder="1.0" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <label className="muf-label">{L('Expected Yield')}</label>
                    <input type="number" step="0.1" className="muf-field" value={cropForm.yield_kg} onChange={e => setCropForm({...cropForm, yield_kg: e.target.value})} placeholder="0.0" />
                  </div>
                  <div>
                    <label className="muf-label">{L('Unit')}</label>
                    <select 
                      className="muf-field font-medium"
                      value={cropForm.yield_unit}
                      onChange={e => setCropForm({...cropForm, yield_unit: e.target.value})}
                    >
                      <option value="kg">kg (Kilograms)</option>
                      <option value="maund">{L('Maund (40kg)')}</option>
                      <option value="ton">{L('Ton (25 Maund)')}</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
                  <div>
                    <label className="muf-label">{L('Season')}</label>
                    <select 
                      className="w-full bg-slate-100 border border-slate-200 text-slate-900 dark:bg-[#1e293b] dark:border-slate-700 dark:text-white rounded-lg px-3 py-2 text-xs outline-none focus:border-farm-500 font-medium cursor-pointer mb-1.5"
                      value={["Rabi", "Kharif"].includes(cropForm.season) ? cropForm.season : 'Custom'}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === 'Custom') {
                          setCropForm({ ...cropForm, season: '' });
                        } else {
                          setCropForm({ ...cropForm, season: val });
                        }
                      }}
                    >
                      <option value="Rabi">{L('Rabi')}</option>
                      <option value="Kharif">{L('Kharif')}</option>
                      <option value="Custom">{L('Custom Season')}</option>
                    </select>
                    {(!["Rabi", "Kharif"].includes(cropForm.season) || cropForm.season === '') && (
                      <input 
                        required 
                        className="w-full bg-slate-100 border border-slate-200 text-slate-900 dark:bg-[#1e293b] dark:border-slate-700 dark:text-white rounded-lg px-3 py-1.5 text-xs outline-none focus:border-farm-500" 
                        value={cropForm.season} 
                        onChange={e => setCropForm({...cropForm, season: e.target.value})} 
                        placeholder={L('Enter custom season...')} 
                      />
                    )}
                  </div>
                  <div>
                    <label className="muf-label">Crop Year *</label>
                    <input 
                      required 
                      type="number"
                      className="muf-field" 
                      value={cropForm.crop_year || ''} 
                      onChange={e => setCropForm({...cropForm, crop_year: e.target.value})} 
                      placeholder="e.g. 2026" 
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="muf-label">{L('Planted Date')}</label>
                  <input type="date" className="muf-field font-medium" value={cropForm.plant_date} onChange={e => setCropForm({...cropForm, plant_date: e.target.value})} />
                </div>
                <div>
                  <label className="muf-label">{L('Harvest Date Target')}</label>
                  <input type="date" className="muf-field font-medium" value={cropForm.harvest_date} onChange={e => setCropForm({...cropForm, harvest_date: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30">
                <div>
                  <label className="muf-label">{L('Seed Quantity')}</label>
                  <input type="number" step="any" min="0" className="w-full bg-white border border-slate-200 text-slate-900 dark:bg-[#1e293b] dark:border-slate-700 dark:text-white rounded-lg px-3 py-2 text-xs outline-none focus:border-farm-500" value={cropForm.seed_quantity} onChange={e => setCropForm({...cropForm, seed_quantity: e.target.value})} placeholder="0" />
                </div>
                <div>
                  <label className="muf-label">{L('Seed Unit')}</label>
                  <select className="w-full bg-white border border-slate-200 text-slate-900 dark:bg-[#1e293b] dark:border-slate-700 dark:text-white rounded-lg px-3 py-2 text-xs outline-none focus:border-farm-500 cursor-pointer" value={cropForm.seed_unit} onChange={e => setCropForm({...cropForm, seed_unit: e.target.value})}>
                    <option value="kg">kg</option>
                    <option value="maund">{L('Maund (40kg)')}</option>
                    <option value="bag">{L('Bag (50kg)')}</option>
                  </select>
                </div>
                <div>
                  <label className="muf-label">{L('Cost / Unit (Rs.)')}</label>
                  <input type="number" step="any" min="0" className="w-full bg-white border border-slate-200 text-slate-900 dark:bg-[#1e293b] dark:border-slate-700 dark:text-white rounded-lg px-3 py-2 text-xs outline-none focus:border-farm-500" value={cropForm.seed_cost_per_unit} onChange={e => setCropForm({...cropForm, seed_cost_per_unit: e.target.value})} placeholder="0" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider font-semibold">{L('Current Cycle Status')}</label>
                <select 
                  className="muf-field font-medium"
                  value={cropForm.status}
                  onChange={e => setCropForm({...cropForm, status: e.target.value})}
                >
                  <option value="Planted">{L('Planted')}</option>
                  <option value="Growing">{L('Growing')}</option>
                  <option value="Harvesting">{L('Harvesting')}</option>
                  <option value="Completed">{L('Completed (Inactive)')}</option>
                </select>
              </div>

              <div>
                <label className="muf-label">{L('Notes / Soil Details')}</label>
                <textarea rows="2" className="muf-field" value={cropForm.notes} onChange={e => setCropForm({...cropForm, notes: e.target.value})} placeholder={L('Soil pH is 6.5, added organic fertilizer...')} />
              </div>

              {/* Crop image upload and preview */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{L('Crop Photo (PNG / JPEG)')}</label>
                <ImageUploader
                  label={L('Upload Photo')}
                  value={cropForm.image_base64}
                  onDone={(base64) => setCropForm({ ...cropForm, image_base64: base64 })}
                  onRemove={() => setCropForm({ ...cropForm, image_base64: '' })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button type="button" onClick={() => setShowCropModal(false)} className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold uppercase tracking-wider cursor-pointer">{L('Cancel')}</button>
                <button type="submit" className="px-5 py-2 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-md cursor-pointer">
                  <CheckCircle size={14} /> {editingCrop ? "Update Crop" : "Plant Crop"}
                </button>
              </div>
            </form>
      </FormOverlay>

      {/* FINANCE FORM MODAL */}
      <FormOverlay
        open={showFinanceModal}
        onClose={() => { setShowFinanceModal(false); setEditingFinance(null); setFinanceBookTab('ledger'); }}
        title={editingFinance ? "Modify Transaction" : "Record Book Log"}
        subtitle={editingFinance ? "Update ledger entry" : "Ledger, irrigation, spray, labor, fertilizer"}
        icon={<Coins size={16} />}
        size="big"
      >
        <LedgerBookForm
          open={showFinanceModal}
          tab={financeBookTab}
          onTabChange={setFinanceBookTab}
          finForm={finForm}
          setFinForm={setFinForm}
          handleFinanceFieldChange={handleFinanceFieldChange}
          handleFinanceSubmit={handleFinanceSubmit}
          editingFinance={editingFinance}
          crops={crops}
          inventory={inventory}
          suppliers={suppliers}
          onCancel={() => { setShowFinanceModal(false); setEditingFinance(null); setFinanceBookTab('ledger'); }}
          formatCurrency={formatCurrency}
          compressAndConvertToBase64={compressAndConvertToBase64}
          showAlert={showAlert}
          refreshData={refreshData}
        />
      </FormOverlay>

      {/* DEBT/LIABILITY FORM MODAL */}
      <FormOverlay
        open={showLiabilityModal}
        onClose={resetLiabilityForm}
        title={editingLiabilityId ? "Edit Credit Debt / Loan" : "Log Credit Debt / Loan"}
        subtitle={L('Record a payable')}
        icon={<Coins size={16} />}
       size="small">
            <form onSubmit={handleLiabilitySubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="muf-label">Creditor Name *</label>
                  <input required className="muf-field font-medium" value={liaForm.creditor} onChange={e => setLiaForm({...liaForm, creditor: e.target.value})} placeholder={L('e.g. Sargodha Urea Dealer')} />
                </div>
                <div>
                  <label className="muf-label">Amount Owed (Rs) *</label>
                  <input required type="number" step="0.1" className="muf-field font-medium" value={liaForm.amount_owed} onChange={e => setLiaForm({...liaForm, amount_owed: e.target.value})} placeholder="0.00" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="muf-label">{L('Due Date')}</label>
                  <input type="date" className="muf-field font-medium" value={liaForm.due_date} onChange={e => setLiaForm({...liaForm, due_date: e.target.value})} />
                </div>
                <div>
                  <label className="muf-label">{L('Associate with Crop Sector')}</label>
                  <select 
                    className="muf-field font-medium"
                    value={liaForm.crop_id}
                    onChange={e => setLiaForm({...liaForm, crop_id: e.target.value})}
                  >
                    <option value="farm-wide">{L('General / Farm-Wide Operational')}</option>
                    {crops.map(c => (
                      <option key={c._id} value={c._id}>Crop: {c.name} ({c.status})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="muf-label">{L('Additional Notes / Terms')}</label>
                <textarea rows="2" className="muf-field font-medium" value={liaForm.notes} onChange={e => setLiaForm({...liaForm, notes: e.target.value})} placeholder={L('To be settled in cash directly upon basmati rice harvest...')} />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button type="button" onClick={resetLiabilityForm} className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold uppercase tracking-wider cursor-pointer">{L('Cancel')}</button>
                <button type="submit" className="px-5 py-2 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-md cursor-pointer">
                  <CheckCircle size={14} /> {editingLiabilityId ? 'Save Changes' : 'Log Debt'}
                </button>
              </div>
            </form>
      </FormOverlay>

      {/* INVENTORY ITEM FORM MODAL */}
      <FormOverlay
        open={showInventoryModal}
        onClose={() => setShowInventoryModal(false)}
        title={invForm._id ? "Adjust Stock Count" : "Log New Stock Item"}
        subtitle={L('Inventory')}
        icon={<Database size={16} />}
       size="small">
            <form onSubmit={handleInventorySubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="muf-label">Item Name *</label>
                  <input required className="muf-field font-medium" value={invForm.name} onChange={e => setInvForm({...invForm, name: e.target.value})} placeholder={L('e.g. Di-Ammonium Phosphate (DAP)')} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider font-semibold">{L('Stock Category')}</label>
                  <select 
                    className="w-full bg-slate-100 border border-slate-200 text-slate-900 dark:bg-[#1e293b] dark:border-slate-700 dark:text-white rounded-lg px-3 py-2 text-xs outline-none focus:border-farm-500 font-bold cursor-pointer transition-all"
                    value={invForm.category}
                    onChange={e => setInvForm({...invForm, category: e.target.value})}
                  >
                    <option value="fertilizer">{L('Fertilizer')}</option>
                    <option value="seed">{L('Seed')}</option>
                    <option value="pesticide">{L('Pesticide')}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="muf-label">Current Stock *</label>
                  <input required type="number" step="0.1" className="muf-field font-medium" value={invForm.current_stock} onChange={e => setInvForm({...invForm, current_stock: e.target.value})} placeholder="0.00" />
                </div>
                <div>
                  <label className="muf-label">{L('Stock Unit')}</label>
                  <input required className="muf-field font-medium" value={invForm.unit} onChange={e => setInvForm({...invForm, unit: e.target.value})} placeholder={L('e.g. kg or bags')} />
                </div>
                <div>
                  <label className="muf-label">Low Threshold *</label>
                  <input required type="number" step="0.1" className="muf-field font-medium" value={invForm.low_stock_threshold} onChange={e => setInvForm({...invForm, low_stock_threshold: e.target.value})} placeholder="10.00" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button type="button" onClick={() => setShowInventoryModal(false)} className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold uppercase tracking-wider cursor-pointer">{L('Cancel')}</button>
                <button type="submit" className="px-5 py-2 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-md cursor-pointer">
                  <CheckCircle size={14} /> {invForm._id ? "Adjust Stock" : "Log Stock"}
                </button>
              </div>
            </form>
      </FormOverlay>

      {/* TASK FORM MODAL */}
      <FormOverlay
        open={showTaskModal}
        onClose={() => { setShowTaskModal(false); setEditingTask(null); }}
        title={editingTask ? "Modify Task Assignment" : "Assign Farm Duty"}
        subtitle={editingTask ? "Update duty" : "Schedule care work"}
        icon={<CheckSquare size={16} />}
       size="small">
            <form onSubmit={handleTaskSubmit} className="space-y-4">
              <div>
                <label className="muf-label">Duty Description / Assignment Title *</label>
                <input required className="muf-field" value={taskForm.title} onChange={e => setTaskForm({...taskForm, title: e.target.value})} placeholder={L('e.g. Fertilize Sector 3 Wheat')} />
              </div>

              <div>
                <label className="block text-[10px] md:text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{L('Link to Crop')}</label>
                <select
                  className="muf-field font-medium"
                  value={taskForm.crop_id}
                  onChange={e => setTaskForm({...taskForm, crop_id: e.target.value})}
                >
                  <option value="farm-wide">{L('General / Farm-Wide')}</option>
                  {crops.map(c => (
                    <option key={c._id} value={c._id}>Crop: {c.name} ({c.status})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="muf-label">{L('Assign to Worker')}</label>
                  <select 
                    className="muf-field font-medium"
                    value={taskForm.assigned_to}
                    onChange={e => setTaskForm({...taskForm, assigned_to: e.target.value})}
                  >
                    <option value="">{L('General / Broadcast Task')}</option>
                    {(users.length ? users : (username ? [{ _id: 'self', username, role: userRole }] : [])).map(u => (
                      <option key={u._id} value={u.username}>{u.username} ({u.role})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="muf-label">{L('Priority Level')}</label>
                  <select 
                    className="muf-field font-medium"
                    value={taskForm.priority}
                    onChange={e => setTaskForm({...taskForm, priority: e.target.value})}
                  >
                    <option value="Low">{L('Low Priority')}</option>
                    <option value="Medium">{L('Medium Priority')}</option>
                    <option value="High">{L('High Priority')}</option>
                  </select>
                </div>
              </div>

              {/* FIELD CREW DEPLOYMENT — link real laborers to this duty */}
              {laborers.length > 0 && (
                <div className="p-3 rounded-xl border border-farm-200 dark:border-farm-900/30 bg-farm-50/50 dark:bg-[#16301d]/40 space-y-2">
                  <label className="block text-[10px] font-bold text-farm-700 dark:text-farm-300 uppercase tracking-wider flex items-center gap-1">
                    <HardHat size={12} /> Assign To Field Labor ({taskForm.laborer_ids.length} selected)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {laborers.map(l => {
                      const selected = taskForm.laborer_ids.includes(l._id);
                      return (
                        <button
                          key={l._id}
                          type="button"
                          onClick={() => {
                            const next = selected
                              ? taskForm.laborer_ids.filter(id => id !== l._id)
                              : [...taskForm.laborer_ids, l._id];
                            const wageSum = laborers
                              .filter(x => next.includes(x._id))
                              .reduce((s, x) => s + (parseFloat(x.daily_wage) || 0), 0);
                            setTaskForm({
                              ...taskForm,
                              laborer_ids: next,
                              // Auto-fill wage estimate only if admin hasn't typed a custom figure
                              labor_cost: (!parseFloat(taskForm.labor_cost) || taskForm.labor_cost === String(laborers.filter(x => taskForm.laborer_ids.includes(x._id)).reduce((s, x) => s + (parseFloat(x.daily_wage) || 0), 0)))
                                ? String(wageSum)
                                : taskForm.labor_cost
                            });
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                            selected
                              ? 'bg-farm-600 border-farm-500 text-white'
                              : 'bg-white dark:bg-[#1e293b] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-farm-400'
                          }`}
                        >
                          {selected ? '✓ ' : ''}{l.name}{l.daily_wage ? ` · Rs.${l.daily_wage}` : ''}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-farm-700/70 dark:text-farm-300/60 leading-snug">
                    When this duty is completed, the selected crew is auto-marked <strong>present (full day)</strong> in Field Labor attendance — days already marked are never overwritten.
                  </p>
                </div>
              )}

              <div>
                <label className="muf-label">{L('Duty Due Date')}</label>
                <input type="date" className="muf-field font-medium" value={taskForm.due_date} onChange={e => setTaskForm({...taskForm, due_date: e.target.value})} />
              </div>


              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="muf-label">{L('Labor Wages (Rs)')}</label>
                  <input type="number" step="0.1" className="muf-field" value={taskForm.labor_cost} onChange={e => setTaskForm({...taskForm, labor_cost: e.target.value})} placeholder="0" />
                </div>
                <div>
                  <label className="muf-label">{L('Deduct Stock')}</label>
                  <select 
                    className="muf-field font-medium"
                    value={taskForm.inventory_item_id}
                    onChange={e => setTaskForm({...taskForm, inventory_item_id: e.target.value})}
                  >
                    <option value="">{L('No Stock Consumed')}</option>
                    {inventory.map(item => (
                      <option key={item._id} value={item._id}>{item.name} ({item.current_stock} {item.unit})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="muf-label">{L('Qty Consumed')}</label>
                  <input type="number" step="0.1" className="muf-field" value={taskForm.inventory_qty_consumed} onChange={e => setTaskForm({...taskForm, inventory_qty_consumed: e.target.value})} placeholder="0.0" disabled={!taskForm.inventory_item_id} />
                </div>
              </div>

              <div>
                <label className="muf-label">{L('Task Guidelines / Operational Instructions')}</label>
                <textarea rows="2" className="muf-field" value={taskForm.notes} onChange={e => setTaskForm({...taskForm, notes: e.target.value})} placeholder={L('Ensure irrigation valves are closed after 2 hours...')} />
              </div>

              {rainForecast24h > 5 && isIrrigationRelated(taskForm.title, taskForm.notes) && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2 animate-fade-in">
                  <span className="text-sm">⚠️</span>
                  <div>
                    <span className="font-extrabold block">Heavy Rain Forecasted ({rainForecast24h.toFixed(1)}mm in next 24h)</span>
                    <span>Consider postponing irrigation or watering tasks to save resources and protect crops from waterlogging.</span>
                  </div>
                </div>
              )}

              {/* Task image upload and preview */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{L('Duty Attachment Photo (PNG / JPEG)')}</label>
                <ImageUploader
                  label={L('Upload Photo')}
                  value={taskForm.image_base64}
                  onDone={(base64) => setTaskForm({ ...taskForm, image_base64: base64 })}
                  onRemove={() => setTaskForm({ ...taskForm, image_base64: '' })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button type="button" onClick={() => setShowTaskModal(false)} className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold uppercase tracking-wider cursor-pointer">{L('Cancel')}</button>
                <button type="submit" className="px-5 py-2 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-md cursor-pointer">
                  <CheckCircle size={14} /> {editingTask ? "Update Assignment" : "Assign Duty"}
                </button>
              </div>
            </form>
      </FormOverlay>

      {/* ─── ADMIN HUB POPUP MODAL ─── */}
      <AdminMenu
        open={adminMenuOpen}
        onClose={() => setAdminMenuOpen(false)}
        userRole={userRole}
        username={username}
        currentUserEmail={currentUserEmail}
        onUpdateEmail={setCurrentUserEmail}
        currentUserAvatar={currentUserAvatar}
        onUpdateAvatar={setCurrentUserAvatar}
        isDark={isDark}
        onToggleDark={setIsDark}
        users={users}
        crops={crops}
        finance={finance}
        tasks={tasks}
        refreshData={refreshData}
        showAlert={showAlert}
      />

      {/* ─── DETAIL POPUPS (Dashboard Stat Card clicks) ─── */}

      {/* Financial Ledger Entry Detail */}
      <DetailModal
        open={showCompare}
        onClose={() => setShowCompare(false)}
        title={L('This Month vs Last Month')}
        subtitle={`${monthKeyLabel(cmpPrevKey)} → ${monthKeyLabel(cmpCurKey)}`}
        size="small"
      >
        <div className="space-y-2">
          {[
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
        open={!!selectedFinance}
        onClose={closePopup}
        title={selectedFinance ? `Ledger Entry: ${selectedFinance.category}` : "Ledger Entry"}
        subtitle={selectedFinance ? `Date: ${selectedFinance.date}` : ""}
        icon={<FileText size={16} />}
       size="small">
        {selectedFinance && (
          <div className="space-y-4 text-slate-800 dark:text-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs md:text-sm">
              <div className="muf-tile space-y-1">
                <p className="muf-caption flex items-center gap-1"><FileText size={10} /> {L('Category')}</p>
                <p className="font-extrabold">{selectedFinance.category}</p>
              </div>
              <div className="muf-tile space-y-1">
                <p className="muf-caption flex items-center gap-1"><Scale size={10} /> {L('Ledger Flow')}</p>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                  selectedFinance.type === 'expense' 
                    ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400' 
                    : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                }`}>
                  {selectedFinance.type === 'expense' ? 'Expense' : 'Income'}: {formatCurrency(selectedFinance.amount)}
                </span>
              </div>
              <div className="muf-tile space-y-1">
                <p className="muf-caption flex items-center gap-1"><Sprout size={10} /> {L('Associated Crop')}</p>
                <p className="font-extrabold">
                  {crops.find(c => c._id === selectedFinance.crop_id)?.name || 'Farm-wide'}
                </p>
              </div>
              <div className="muf-tile space-y-1">
                <p className="muf-caption flex items-center gap-1"><Calendar size={10} /> {L('Date Logged')}</p>
                <p className="font-extrabold">{selectedFinance.date}</p>
              </div>
              {selectedFinance.type === 'income' && (selectedFinance.buyer_name || selectedFinance.quantity_sold) && (
                <>
                  <div className="muf-tile space-y-1">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{L('Buyer')}</p>
                    <p className="font-extrabold">{selectedFinance.buyer_name || '—'}</p>
                  </div>
                  <div className="muf-tile space-y-1">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Qty × Rate</p>
                    <p className="font-extrabold">{selectedFinance.quantity_sold || 0} × Rs. {formatCurrency(selectedFinance.rate_per_unit || 0)}</p>
                  </div>
                </>
              )}
            </div>
            {selectedFinance.notes && (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-2">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{L('Additional Notes / Specifications')}</p>
                <p className="text-xs leading-relaxed font-medium text-slate-600 dark:text-slate-300 italic">"{selectedFinance.notes}"</p>
              </div>
            )}
            {selectedFinance.receipt_base64 && (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-2">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{L('Receipt Photo')}</p>
                <a href={selectedFinance.receipt_base64} target="_blank" rel="noopener noreferrer">
                  <img src={selectedFinance.receipt_base64} alt="Receipt" className="w-full max-h-64 object-contain rounded-lg bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 cursor-zoom-in" />
                </a>
              </div>
            )}

            {userRole === 'admin' && (
              <div className="flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-4 mt-4">
                <button 
                  onClick={() => {
                    handleEditFinance(selectedFinance);
                    setSelectedFinance(null);
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200 dark:border-slate-700 shadow-xs"
                >
                  <Edit3 size={14} /> Edit Entry
                </button>
                <button 
                  onClick={async () => {
                    const removed = await handleDeleteFinance(selectedFinance._id);
                    if (removed) setSelectedFinance(null);
                  }}
                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer border border-red-200 dark:border-red-900/30 shadow-xs"
                >
                  <Trash2 size={14} /> Delete Entry
                </button>
              </div>
            )}
          </div>
        )}
      </DetailModal>

      {/* Care & Tasks Duty Detail */}
      <DetailModal
        open={!!selectedTask}
        onClose={closePopup}
        title={selectedTask ? `Duty Task: ${selectedTask.title}` : "Duty Task"}
        subtitle={selectedTask ? `Due: ${selectedTask.due_date || 'Ongoing Care'}` : ""}
        icon={<HeartPulse size={16} />}
       size="small">
        {selectedTask && (
          <div className="space-y-4 text-slate-800 dark:text-slate-100">
            {selectedTask.image_base64 && (
              <div className="w-full h-44 rounded-xl overflow-hidden border border-[color:var(--muf-color-border)] shadow-xs">
                <img src={selectedTask.image_base64} className="w-full h-full object-cover" alt={selectedTask.title} />
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs md:text-sm">
              <div className="muf-tile space-y-1">
                <p className="muf-caption flex items-center gap-1"><Users size={10} /> {L('Assigned Worker')}</p>
                <p className="font-extrabold">{selectedTask.assigned_to || ((selectedTask.laborer_names || []).length ? `Crew: ${(selectedTask.laborer_names || []).join(', ')}` : 'Broadcast Duty')}</p>
              </div>
              <div className="muf-tile space-y-1">
                <p className="muf-caption flex items-center gap-1"><Clock size={10} /> {L('Task Status')}</p>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                  selectedTask.status === 'Completed' 
                    ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400' 
                    : 'bg-farm-50 dark:bg-farm-950/20 border-farm-200 dark:border-farm-900/30 text-farm-600 dark:text-farm-400'
                }`}>
                  {selectedTask.status}
                </span>
              </div>
              <div className="muf-tile space-y-1">
                <p className="muf-caption flex items-center gap-1"><AlertTriangle size={10} /> {L('Task Priority')}</p>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                  selectedTask.priority === 'High' 
                    ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400' 
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600'
                }`}>
                  {selectedTask.priority}
                </span>
              </div>
              <div className="muf-tile space-y-1">
                <p className="muf-caption flex items-center gap-1"><Calendar size={10} /> {L('Due Date')}</p>
                <p className="font-extrabold">{selectedTask.due_date || 'Ongoing care'}</p>
              </div>
              {userRole === 'admin' && (
                <div className="space-y-1 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 col-span-2">
                  <p className="muf-caption flex items-center gap-1"><Coins size={10} /> {L('Labor Wages Cost Contribution')}</p>
                  <p className="font-extrabold text-farm-600 dark:text-farm-400">Rs. {formatCurrency(selectedTask.labor_cost || 0)}</p>
                </div>
              )}
              {(selectedTask.laborer_names || []).length > 0 && (
                <div className="space-y-1.5 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 col-span-2">
                  <p className="muf-caption flex items-center gap-1"><HardHat size={10} /> {L('Deployed Field Crew')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedTask.laborer_names || []).map((name, i) => {
                      const lb = userRole === 'admin' ? laborers.find(x => x._id === (selectedTask.laborer_ids || [])[i]) : null;
                      return (
                        <span key={`${name}-${i}`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40">
                          <HardHat size={10} /> {name}{lb && lb.daily_wage ? ` · Rs.${lb.daily_wage}/day` : ''}
                        </span>
                      );
                    })}
                  </div>
                  {userRole === 'admin' && (
                    <p className="text-[9px] text-slate-400 leading-snug">On completion, this crew is auto-marked present (full day) in Field Labor attendance.</p>
                  )}
                </div>
              )}
            </div>

            {/* Linked Crop Navigation */}
            {(() => {
              const foundLinkedCrop = crops.find(c => {
                return cropNameInText(selectedTask.title, c.name) || cropNameInText(selectedTask.notes, c.name);
              });
              if (!foundLinkedCrop) return null;
              return (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800 rounded-xl text-xs flex justify-between items-center animate-fade-in shadow-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase tracking-wider">{L('Associated Crop Cycle')}</span>
                    <strong className="text-farm-600 dark:text-farm-400 font-extrabold">{foundLinkedCrop.name} ({foundLinkedCrop.variety || 'Standard'})</strong>
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      openPopup('selectedCrop', foundLinkedCrop);
                    }}
                    className="px-3 py-1.5 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-all shadow-xs"
                  >
                    🔍 View Crop Profile
                  </button>
                </div>
              );
            })()}

            {/* Linked Stock Consumption */}
            {selectedTask.inventory_item_id && (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800 rounded-xl text-xs animate-fade-in shadow-xs">
                <span className="text-[10px] text-slate-400 block uppercase tracking-wider">{L('Stock Material Consumed')}</span>
                <strong className="text-slate-800 dark:text-slate-200 font-extrabold">
                  {inventory.find(item => item._id === selectedTask.inventory_item_id)?.name || 'Unknown Stock Item'}
                </strong>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                  Quantity Consumed: <span className="font-extrabold text-slate-700 dark:text-slate-300">{selectedTask.inventory_qty_consumed || 0} {inventory.find(item => item._id === selectedTask.inventory_item_id)?.unit || 'kg'}</span>
                </p>
              </div>
            )}

            {rainForecast24h > 5 && isIrrigationRelated(selectedTask.title, selectedTask.notes) && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2 animate-fade-in">
                <span className="text-sm">⚠️</span>
                <div>
                  <span className="font-extrabold block">Heavy Rain Forecasted ({rainForecast24h.toFixed(1)}mm in next 24h)</span>
                  <span>Postponing irrigation or watering tasks is highly advised as natural rainfall is incoming.</span>
                </div>
              </div>
            )}

            {selectedTask.notes && (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-2">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{L('Guidelines & Directions')}</p>
                <p className="text-xs leading-relaxed font-medium text-slate-600 dark:text-slate-300 italic">"{selectedTask.notes}"</p>
              </div>
            )}
          </div>
        )}
      </DetailModal>

      {/* Month Drilled-down Detail */}
      <DetailModal
        open={!!selectedMonthRow}
        onClose={closePopup}
        title={selectedMonthRow ? `Monthly Breakdown: ${selectedMonthRow[0]}` : "Monthly Breakdown"}
        subtitle={selectedMonthRow ? `Analysis Summary` : ""}
        icon={<BarChart3 size={16} />}
       size="small">
        {selectedMonthRow && (
          <div className="space-y-4 text-slate-800 dark:text-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs md:text-sm">
              <div className="muf-tile space-y-1">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{L('Total Monthly Income')}</p>
                <p className="font-extrabold text-farm-600 dark:text-farm-400">Rs. {formatCurrency(selectedMonthRow[1].income)}</p>
              </div>
              <div className="muf-tile space-y-1">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{L('Total Monthly Expense')}</p>
                <p className="font-extrabold text-red-500">Rs. {formatCurrency(selectedMonthRow[1].expense)}</p>
              </div>
              <div className="muf-tile space-y-1">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{L('Monthly Net Profit')}</p>
                <p className={`font-extrabold ${selectedMonthRow[1].income - selectedMonthRow[1].expense >= 0 ? 'text-farm-600 dark:text-farm-400' : 'text-red-500'}`}>
                  Rs. {formatCurrency(selectedMonthRow[1].income - selectedMonthRow[1].expense)}
                </p>
              </div>
              <div className="muf-tile space-y-1">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{L('Crops Cycles Active')}</p>
                <p className="font-extrabold">{selectedMonthRow[1].cropsCount} active cycles</p>
              </div>
            </div>
            
            {/* List crops matching this month (respects the active reports crop filter) */}
            <div className="space-y-2">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Crops Planted / Monitored in {selectedMonthRow[0]}</p>
              <div className="max-h-36 overflow-y-auto space-y-2 pr-1 text-xs">
                {crops.filter(c => (reportsCropFilter === 'all' || c._id === reportsCropFilter) && String(c.plant_date || '').startsWith(selectedMonthRow[0].slice(0, 7))).map(c => (
                  <button
                    type="button"
                    key={c._id}
                    onClick={() => openPopup('selectedCrop', c)}
                    aria-label={`${L('Open crop profile')}: ${c.name}`}
                    className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/20 hover:border-farm-400 dark:hover:border-farm-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-farm-500 flex justify-between items-center gap-3 text-left transition-colors"
                  >
                    <span className="font-bold min-w-0 break-words">{c.name} ({c.variety || 'Standard'})</span>
                    <span className="shrink-0 text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-farm-900/20 text-farm-600 dark:text-farm-400 border border-farm-900/30">{c.status}</span>
                  </button>
                ))}
                {crops.filter(c => (reportsCropFilter === 'all' || c._id === reportsCropFilter) && String(c.plant_date || '').startsWith(selectedMonthRow[0].slice(0, 7))).length === 0 && (
                  <p className="text-slate-500 italic py-2">{L('No new crop cycle registrations logged in this month.')}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </DetailModal>

      {/* Expense Category Drilled-down Detail */}
      <DetailModal
        open={!!selectedExpenseCategory}
        onClose={() => setSelectedExpenseCategory(null)}
        title={selectedExpenseCategory ? `Category: ${selectedExpenseCategory.category}` : "Category Breakdown"}
        subtitle={selectedExpenseCategory ? `Total: Rs. ${formatCurrency(selectedExpenseCategory.amount)}` : ""}
        icon={<TrendingDown size={16} />}
       size="small">
        {selectedExpenseCategory && (
          <div className="space-y-4 text-slate-800 dark:text-slate-100">
            <p className="muf-pc-muted">All direct outlays and ledger transactions matching this expenditure category{reportsCropFilter !== 'all' ? ` (filtered by crop)` : ''}:</p>
            <div className="max-h-[300px] overflow-y-auto space-y-2.5 pr-1 text-xs">
              {filteredPeriodFinance.filter(f => f.type === 'expense' && f.category === selectedExpenseCategory.category).map(f => (
                <button
                  type="button"
                  key={f._id}
                  onClick={() => openPopup('selectedFinance', f)}
                  aria-label={`${L('Open ledger entry')}: ${f.category}, ${f.date}`}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/20 hover:border-farm-300 dark:hover:border-farm-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-farm-500 text-left transition-colors space-y-2"
                >
                  <div className="flex justify-between items-center gap-3">
                    <span className="font-extrabold text-slate-800 dark:text-white">{f.date}</span>
                    <span className="font-black text-red-500 dark:text-red-400 whitespace-nowrap">Rs. {formatCurrency(f.amount)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-600 dark:text-slate-300">{f.category}</span>
                    <span className="muf-pc-micro">{L('Open full details')} →</span>
                  </div>
                  <p className="muf-pc-micro">Crop sector: {crops.find(c => c._id === f.crop_id)?.name || 'Farm-wide'}</p>
                </button>
              ))}
              {filteredPeriodFinance.filter(f => f.type === 'expense' && f.category === selectedExpenseCategory.category).length === 0 && (
                <p className="text-center text-xs text-slate-500 italic py-4">No expense logs in this category for the selected crop filter.</p>
              )}
            </div>
          </div>
        )}
      </DetailModal>

      {/* 0. Individual Crop Detail with timeline */}
      <DetailModal
        open={!!selectedCrop}
        onClose={closePopup}
        title={selectedCrop ? `Crop Profile: ${selectedCrop.name}` : "Crop Profile"}
        subtitle={selectedCrop ? `Variety: ${selectedCrop.variety || 'Standard Variety'}` : ""}
        icon={<Sprout size={16} />}
       size="big">
        {selectedCrop && (
          <div className="space-y-6 text-slate-800 dark:text-slate-100">
            {selectedCrop.image_base64 && (
              <div className="w-full h-44 rounded-xl overflow-hidden border border-[color:var(--muf-color-border)] shadow-xs">
                <img src={selectedCrop.image_base64} className="w-full h-full object-cover" alt={selectedCrop.name} />
              </div>
            )}
            
            {/* Timeline Row */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/20 space-y-3">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{L('Growth Timeline Stage')}</p>
              <div className="flex items-center justify-between relative pt-2">
                {/* Connecting Line */}
                <div className="absolute top-5 left-2 right-2 h-1 bg-slate-200 dark:bg-slate-800 -z-0 rounded-full">
                  <div 
                    className="h-full bg-farm-600 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${getCropProgress(selectedCrop)}%`
                    }}
                  />
                </div>
                
                {/* Timeline nodes */}
                {["Planted", "Growing", "Harvesting", "Completed"].map((stage, idx) => {
                  const isPassedOrCurrent = 
                    (selectedCrop.status === 'Planted' && idx <= 0) ||
                    (selectedCrop.status === 'Growing' && idx <= 1) ||
                    (selectedCrop.status === 'Harvesting' && idx <= 2) ||
                    (selectedCrop.status === 'Completed' && idx <= 3);
                  
                  return (
                    <div key={stage} className="flex flex-col items-center space-y-1.5 z-10 relative">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center font-bold text-[10px] shadow-sm ${
                        isPassedOrCurrent 
                          ? 'bg-farm-600 border-farm-500 text-white' 
                          : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-400'
                      }`}>
                        {idx + 1}
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${
                        isPassedOrCurrent ? 'text-farm-600 dark:text-farm-400' : 'text-slate-400'
                      }`}>{stage}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Profile Grid */}
            {(() => {
              const initialSeedCost = (selectedCrop.seed_quantity || 0) * (selectedCrop.seed_cost_per_unit || 0);
              // Ledger Seed entries (auto-logged from the crop form, plus any extra
              // Seed purchases) are the source of truth. Legacy "Sowing Seed Purchase"
              // rows still count until they are rewritten as Seed.
              const ledgerSeedCost = finance
                .filter(f => f.crop_id === selectedCrop._id && f.type === 'expense' && isSeedLedgerCategory(f.category))
                .reduce((sum, f) => sum + f.amount, 0);
              const finalTotalSeedCost = ledgerSeedCost > 0 ? ledgerSeedCost : initialSeedCost;
              const seedCostPerKanal = finalTotalSeedCost / (parseFloat(selectedCrop.area_kanal) || 1.0);
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs md:text-sm">
                  <div className="muf-tile space-y-1">
                    <p className="muf-caption flex items-center gap-1"><MapPin size={10} /> {L('Sector Plot')}</p>
                    <p className="font-extrabold">{selectedCrop.field || 'Farm-wide'}</p>
                  </div>
                  {userRole === 'admin' && (
                    <div className="muf-tile space-y-1">
                      <p className="muf-caption flex items-center gap-1"><Scale size={10} /> {L('Yield harvested')}</p>
                      <p className="font-extrabold">{selectedCrop.yield_kg ? formatYield(toKg(selectedCrop.yield_kg, selectedCrop.yield_unit), selectedCrop.yield_unit) : 'None yet'}</p>
                    </div>
                  )}
                  <div className="muf-tile space-y-1">
                    <p className="muf-caption flex items-center gap-1"><Calendar size={10} /> {L('Planting Date')}</p>
                    <p className="font-extrabold">{selectedCrop.plant_date || 'N/A'}</p>
                  </div>
                  <div className="muf-tile space-y-1">
                    <p className="muf-caption flex items-center gap-1"><Calendar size={10} /> {L('Expected Harvest')}</p>
                    <p className="font-extrabold">{selectedCrop.harvest_date || 'N/A'}</p>
                  </div>
                  <div className="muf-tile space-y-1">
                    <p className="muf-caption flex items-center gap-1"><Sprout size={10} /> {L('Seed Variety')}</p>
                    <p className="font-extrabold text-farm-600 dark:text-farm-400">{selectedCrop.variety || 'Standard'}</p>
                  </div>
                  {userRole === 'admin' && (
                    <div className="muf-tile space-y-1">
                      <p className="muf-caption flex items-center gap-1"><Leaf size={10} /> {L('Sowed Seed Quantity')}</p>
                      <p className="font-extrabold">{selectedCrop.seed_quantity ? `${selectedCrop.seed_quantity} ${selectedCrop.seed_unit || 'kg'}` : '0 kg'}</p>
                    </div>
                  )}
                  {userRole === 'admin' && (
                    <>
                      <div className="muf-tile space-y-1">
                        <p className="muf-caption flex items-center gap-1"><Coins size={10} /> {L('Total Seed Cost')}</p>
                        <p className="font-extrabold text-red-500">Rs. {formatCurrency(finalTotalSeedCost)}</p>
                      </div>
                      <div className="muf-tile space-y-1">
                        <p className="muf-caption flex items-center gap-1"><Coins size={10} /> {L('Seed Cost / Kanal')}</p>
                        <p className="font-extrabold text-red-500">Rs. {formatCurrency(seedCostPerKanal)}</p>
                      </div>
                      <div className="space-y-1 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 col-span-2">
                        <p className="muf-caption flex items-center gap-1"><TrendingUp size={10} /> {L('Profit / Kanal')}</p>
                        <p className="font-extrabold text-farm-600 dark:text-farm-400">Rs. {formatCurrency(((() => {
                          const cropExpenses = finance.filter(f => f.crop_id === selectedCrop._id);
                          const spent = cropExpenses.filter(f => f.type === 'expense').reduce((sum, f) => sum + f.amount, 0);
                          const earned = cropExpenses.filter(f => f.type === 'income').reduce((sum, f) => sum + f.amount, 0);
                          return ((earned - spent) / (parseFloat(selectedCrop.area_kanal) || 1.0)).toFixed(2);
                        })()))}</p>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Financial Performance Cost-Center (admin-only: money data) */}
            {userRole === 'admin' && (() => {
              const cropExpenses = finance.filter(f => f.crop_id === selectedCrop._id);
              const spent = cropExpenses.filter(f => f.type === 'expense').reduce((sum, f) => sum + f.amount, 0);
              const earned = cropExpenses.filter(f => f.type === 'income').reduce((sum, f) => sum + f.amount, 0);
              const net = earned - spent;
              const marketPrice = parseFloat(breakEvenPrices[selectedCrop._id]) || 0;
              const breakEvenYield = marketPrice > 0 ? (spent / marketPrice) : 0;
              return (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-[color:var(--muf-color-border)] bg-slate-50 dark:bg-slate-900/20 space-y-3">
                    <h4 className="muf-caption flex items-center gap-1">💰 Financial Cost-Benefit Summary</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-xs md:text-sm">
                      <div className="p-2 bg-white dark:bg-[#101625]/40 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 block">{L('Total Spent')}</span>
                        <strong className="text-red-500">Rs. {formatCurrency(spent)}</strong>
                      </div>
                      <div className="p-2 bg-white dark:bg-[#101625]/40 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 block">{L('Total Earned')}</span>
                        <strong className="text-farm-600 dark:text-farm-400">Rs. {formatCurrency(earned)}</strong>
                      </div>
                      <div className="p-2 bg-white dark:bg-[#101625]/40 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 block">{L('Net Profit')}</span>
                        <strong className={net >= 0 ? "text-farm-600 dark:text-farm-400" : "text-red-500"}>
                          Rs. {formatCurrency(net)}
                        </strong>
                      </div>
                    </div>
                    {/* ── Crop story verdict (muf-story) ── */}
                    {(() => {
                      const story = mufStoryNet(earned, spent);
                      const doneStatus = selectedCrop.status === 'Harvested' || selectedCrop.status === 'Completed' || selectedCrop.status === 'Sold';
                      const days = mufDaysBetween(selectedCrop.plant_date, doneStatus ? (selectedCrop.harvest_date || undefined) : undefined);
                      return (
                        <div className={`rounded-xl p-3 text-center font-bold text-xs md:text-sm border ${
                          story.isProfit
                            ? 'bg-farm-50 dark:bg-farm-900/20 border-farm-200 dark:border-farm-800 text-farm-700 dark:text-farm-400'
                            : story.net === 0
                              ? 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                        }`}>
                          {story.isProfit ? '✅ ' : story.net === 0 ? '⚖️ ' : '⚠️ '}{mufVerdictText(story.net, lang, 'crop', doneStatus)}
                          {days !== null && <span className="block text-[10px] font-normal text-slate-400 mt-0.5">🌱 {days} {L('days in the ground')}</span>}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="p-4 rounded-xl border border-[color:var(--muf-color-border)] bg-slate-50 dark:bg-slate-900/20 space-y-3">
                    <h4 className="muf-caption flex items-center gap-1">📊 Break-Even Yield Calculator</h4>
                    <div className="flex flex-col md:flex-row md:items-center gap-4 text-xs">
                      <div className="flex-1">
                        <label className="muf-label">
                          Market Price (Rs. per {selectedCrop.yield_unit || 'kg'})
                        </label>
                        <input 
                          type="number" 
                          step="any"
                          className="w-full bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 outline-none focus:border-farm-500 font-medium" 
                          value={breakEvenPrices[selectedCrop._id] || ''} 
                          onChange={e => setBreakEvenPrices({
                            ...breakEvenPrices,
                            [selectedCrop._id]: e.target.value
                          })} 
                          placeholder="e.g. 3000" 
                        />
                      </div>
                      <div className="flex-1 flex flex-col justify-center">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">{L('Required Break-Even Yield')}</span>
                        {marketPrice > 0 ? (
                          <div className="mt-1">
                            <strong className="text-sm font-black text-farm-600 dark:text-farm-400">
                              {breakEvenYield.toFixed(2)} {selectedCrop.yield_unit || 'kg'}
                            </strong>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                              You need to harvest at least <span className="font-extrabold">{breakEvenYield.toFixed(2)} {selectedCrop.yield_unit || 'kg'}</span> to break even at today's rate.
                            </p>
                            {selectedCrop.yield_unit && selectedCrop.yield_unit !== 'kg' && (
                              <p className="muf-pc-micro">
                                (Equivalent to {toKg(breakEvenYield, selectedCrop.yield_unit).toFixed(2)} kg)
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic mt-1 block">{L('Enter a market price to calculate break-even yield.')}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-[color:var(--muf-color-border)] bg-slate-50 dark:bg-slate-900/20 space-y-3">
                    <h4 className="muf-caption flex items-center gap-1">🕌 {L('Ushr Calculator (this crop)')}</h4>
                    <p className="text-[11px] text-slate-500">
                      Ushr on this crop's harvest income of <span className="font-extrabold">Rs. {formatCurrency(earned)}</span>.
                      Pick the rate each time — the app only does the math; the ruling is your decision.
                    </p>
                    {(() => {
                      const chosen = ushrPcts[selectedCrop._id] || '';
                      const pctNum = parseFloat(chosen) || 0;
                      const ushrAmt = pctAmount(earned, pctNum);
                      const chip = (val, label) => (
                        <button
                          type="button"
                          onClick={() => setUshrPcts({ ...ushrPcts, [selectedCrop._id]: String(val) })}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition ${String(val) === chosen ? 'bg-farm-600 text-white border-farm-600' : 'bg-white dark:bg-[#1e293b] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-farm-500'}`}
                        >{label}</button>
                      );
                      return (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            {chip(USHR_RAIN_PCT, `${USHR_RAIN_PCT}% — rain-fed (barani)`)}
                            {chip(USHR_IRRIGATED_PCT, `${USHR_IRRIGATED_PCT}% — irrigated`)}
                            <input
                              type="number" step="any" min="0"
                              className="w-24 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-1.5 text-xs outline-none focus:border-farm-500"
                              placeholder={L('Custom %')}
                              value={chosen}
                              onChange={e => setUshrPcts({ ...ushrPcts, [selectedCrop._id]: e.target.value })}
                            />
                          </div>
                          {pctNum > 0 ? (
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="text-sm">
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Ushr at {pctNum}%</span>
                                <strong className="text-base font-black text-farm-600 dark:text-farm-400">Rs. {formatCurrency(ushrAmt)}</strong>
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => downloadUshrPdf({ cropLabel: `${selectedCrop.name} (${selectedCrop.season || ''} ${selectedCrop.crop_year || ''})`.trim(), base: earned, pct: pctNum })}
                                  className="px-3 py-2 bg-farm-600 hover:bg-farm-700 text-white text-[11px] font-bold rounded-lg"
                                >{L('Download ushr statement (PDF)')}</button>
                                <button
                                  type="button"
                                  onClick={() => openMufPrint({
                                    title: `Ushr Statement — ${selectedCrop.name}`,
                                    metaHtml: `<p>Generated: ${mufToday()}</p><p>Crop: ${mufEsc(selectedCrop.name)}</p>`,
                                    bodyHtml: ushrStatementBody({ cropLabel: `${selectedCrop.name} (${selectedCrop.season || ''} ${selectedCrop.crop_year || ''})`.trim(), base: earned, pct: pctNum }),
                                  })}
                                  className="px-3 py-2 border border-farm-600 text-farm-600 dark:text-farm-400 hover:bg-farm-900/10 text-[11px] font-bold rounded-lg"
                                >{L('Print')}</button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-400 italic">{L('Pick a rate above to calculate ushr.')}</p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })()}

            {/* Complete Transaction History (admin-only: money data) */}
            {userRole === 'admin' && (
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/20 space-y-2">
              <h4 className="muf-caption flex items-center gap-1">📜 Complete Ledger History</h4>
              <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
                {finance.filter(f => f.crop_id === selectedCrop._id).map(f => (
                  <div key={f._id} className="flex justify-between items-center text-xs p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-[#101625]/40 text-slate-800 dark:text-slate-100">
                    <div>
                      <p className="font-bold">{f.category}</p>
                      <p className="text-[9px] text-slate-500">{f.date}</p>
                    </div>
                    <span className={`font-extrabold ${f.type === 'expense' ? 'text-red-500' : 'text-farm-600 dark:text-farm-400'}`}>
                      {f.type === 'expense' ? '-Rs. ' : '+Rs. '}{formatCurrency(f.amount)}
                    </span>
                  </div>
                ))}
                {finance.filter(f => f.crop_id === selectedCrop._id).length === 0 && (
                  <p className="text-center text-xs text-slate-400 italic py-4">{L('No ledger transactions linked to this crop cycle.')}</p>
                )}
              </div>
            </div>
            )}

            {/* Linked Care Tasks */}
            {(() => {
              const linkedTasks = tasks.filter(t => {
                if (t.crop_id) return t.crop_id === selectedCrop._id;
                return cropNameInText(t.title, selectedCrop.name) || cropNameInText(t.notes, selectedCrop.name) || cropNameInText(t.title, selectedCrop.variety);
              });
              return (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/20 space-y-2">
                  <h4 className="muf-caption flex items-center gap-1">📋 Linked Care & Duty roster</h4>
                  <div className="space-y-2 max-h-[25vh] overflow-y-auto pr-1">
                    {linkedTasks.map(t => (
                      <div key={t._id} className="flex justify-between items-center text-xs p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-[#101625]/40 text-slate-800 dark:text-slate-100">
                        <div>
                          <p className="font-bold">{t.title}</p>
                          <p className="text-[9px] text-slate-500">Assigned: {t.assigned_to || 'Broadcast'} • Due: {t.due_date || 'Ongoing'}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                          t.status === 'Completed' 
                            ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500' 
                            : 'bg-farm-50 dark:bg-farm-950/20 border-farm-200 dark:border-farm-900/30 text-farm-600 dark:text-farm-400'
                        }`}>
                          {t.status}
                        </span>
                      </div>
                    ))}
                    {linkedTasks.length === 0 && (
                      <p className="text-center text-xs text-slate-400 italic py-4">{L('No active care tasks linked to this crop name.')}</p>
                    )}
                  </div>
                </div>
              );
            })()}

            {userRole === 'admin' && selectedCrop.notes && (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-2">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{L('Additional Notes & Comments')}</p>
                <p className="text-xs leading-relaxed font-medium text-slate-600 dark:text-slate-300 italic">"{selectedCrop.notes}"</p>
              </div>
            )}

            <CropOpsPanel
              crop={selectedCrop}
              userRole={userRole}
              compressAndConvertToBase64={compressAndConvertToBase64}
              refreshData={refreshData}
              showAlert={showAlert}
              onPlanNext={handlePlanNext}
            />
          </div>
        )}
      </DetailModal>

      {/* 1. Crops Planted Detail */}
      <DetailModal
        open={modal === 'crops_planted'}
        onClose={closePopup}
        title={L('Crop Inventory Sectors')}
        subtitle={`${crops.length} Planted Crops`}
        icon={<Sprout size={16} />}
       size="small">
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Below is a breakdown of all crop segments currently registerized inside the farm database:</p>
          <div className="grid grid-cols-1 gap-3 max-h-[50vh] overflow-y-auto pr-1">
            {crops.map(c => (
              <button
                type="button"
                key={c._id}
                onClick={() => openPopup('selectedCrop', c)}
                aria-label={`${L('Open crop profile')}: ${c.name}`}
                className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-left text-slate-800 dark:text-slate-100 hover:border-farm-400 dark:hover:border-farm-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-farm-500 transition-colors"
              >
                <div className="flex justify-between items-start gap-3 mb-2">
                  <span className="font-extrabold text-slate-800 dark:text-white">{c.name}</span>
                  <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded bg-farm-900/20 text-farm-600 dark:text-farm-400 border border-farm-900/30 uppercase">{c.status}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>{L('Variety:')} <strong className="text-slate-700 dark:text-slate-300">{c.variety || 'N/A'}</strong></span>
                  <span>{L('Plot:')} <strong className="text-slate-700 dark:text-slate-300">{c.field || 'N/A'}</strong></span>
                  <span>{L('Open crop profile for planting, yield and seed details')} →</span>
                </div>
              </button>
            ))}
            {crops.length === 0 && <p className="text-center text-xs text-slate-500 py-6">{L('No crop logs available.')}</p>}
          </div>
        </div>
      </DetailModal>

      {/* Crop Ledger Folder Group Detail Modal */}
      <DetailModal
        open={!!selectedLedgerGroup}
        onClose={closePopup}
        title={selectedLedgerGroup ? selectedLedgerGroup.name : "Ledger Folder"}
        subtitle={selectedLedgerGroup ? `Plot: ${selectedLedgerGroup.plot} • ${ledgerPageTotal} entries` : ""}
        icon={<Database size={16} />}
       size="big">
        {selectedLedgerGroup && (
          <div className="muf-ledger-group-content space-y-3 sm:space-y-4 text-slate-800 dark:text-slate-100">
            <div className="muf-ledger-net-balance flex justify-between items-center p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{L('Folder Net Balance')}</span>
              <strong className={`font-black text-base ${selectedLedgerGroup.net >= 0 ? 'text-farm-600 dark:text-farm-400' : 'text-red-500'}`}>
                Rs. {formatCurrency(selectedLedgerGroup.net)}
              </strong>
            </div>

            {ledgerPageError && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-300/60 p-3 text-xs text-red-700"><span>{ledgerPageError}</span><button type="button" onClick={() => fetchLedgerPage(selectedLedgerGroup, ledgerPageNextSkip, ledgerPageNextSkip !== 0, financeFilter)} className="font-bold underline">Retry</button></div>}
            {ledgerPageLoading && ledgerPageRows.length === 0 && <p role="status" className="py-3 text-center text-xs text-slate-500">Loading ledger entries…</p>}
            <div className="overflow-x-auto">
              <table className="muf-reflow muf-ledger-records w-full text-left border-collapse text-xs md:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="px-4 py-3">{L('Date')}</th>
                    <th className="px-4 py-3">{L('Description')}</th>
                    <th className="px-4 py-3 text-right">{L('Ledger Flow')}</th>
                    {userRole === 'admin' && <th className="px-4 py-3 text-right">{L('Actions')}</th>}
                  </tr>
                </thead>
                <tbody className={`divide-y ${
                  isDark ? 'divide-slate-800 text-slate-300' : 'divide-slate-200 text-slate-700'
                }`}>
                  {ledgerPageRows.map(f => (
                    <tr 
                      key={f._id}
                      onClick={() => openPopup('selectedFinance', f)}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openPopup('selectedFinance', f);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open ledger entry: ${f.category}`}
                      className="hover:bg-slate-100/40 dark:hover:bg-slate-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-farm-500 cursor-pointer transition-colors"
                    >
                      <td data-label={L('Date')} className="px-2 sm:px-4 py-2 sm:py-4 text-slate-500 whitespace-nowrap">{f.date}</td>
                      <td data-label={L('Description')} className="px-2 sm:px-4 py-2 sm:py-4">
                        <div className="muf-ledger-description min-w-0">
                          <div className="font-extrabold text-slate-800 dark:text-slate-100">{f.receipt_base64 ? '📷 ' : ''}{f.category}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{L('Open entry for notes, receipt and full details')}</div>
                        </div>
                      </td>
                      <td data-label={L('Ledger Flow')} className="px-2 sm:px-4 py-2 sm:py-4 text-right whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                          f.type === 'expense' 
                            ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400' 
                            : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {f.type === 'expense' ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                          Rs. {formatCurrency(f.amount)}
                        </span>
                      </td>
                      {userRole === 'admin' && (
                        <td data-label={L('Actions')} className="px-2 sm:px-4 py-2 sm:py-4 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <div className="inline-flex gap-1 justify-end">
                            <button onClick={() => { handleEditFinance(f); setSelectedLedgerGroup(null); }} className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-farm-500 rounded-lg cursor-pointer transition-colors" title={L('Edit Log')} aria-label={L('Edit ledger entry')}>
                              <Edit3 size={14} />
                            </button>
                            <button onClick={async () => { const removed = await handleDeleteFinance(f._id); if (removed) setSelectedLedgerGroup(null); }} className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-400 rounded-lg cursor-pointer transition-colors" title={L('Delete Log')} aria-label={L('Delete ledger entry')}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {ledgerPageTotal === 0 && !ledgerPageLoading && (
                    <tr>
                      <td colSpan={userRole === 'admin' ? 4 : 3} className="px-4 py-8 text-center text-slate-500 italic">{L('No transactions in this folder.')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {ledgerPageRows.length < ledgerPageTotal && <div className="flex justify-center py-2"><button type="button" disabled={ledgerPageLoading} onClick={() => fetchLedgerPage(selectedLedgerGroup, ledgerPageNextSkip, false, financeFilter)} className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-bold disabled:opacity-50">{ledgerPageLoading ? 'Loading entries…' : 'Load more ledger entries (' + ledgerPageRows.length + ' of ' + ledgerPageTotal + ')'}</button></div>}
          </div>
        )}
      </DetailModal>

      {/* 2. Operational Profit Ledger Detail */}
      <DetailModal
        open={modal === 'ledger_profit'}
        onClose={closePopup}
        title={ledgerModalData.title}
        subtitle={`Net Profit: Rs. ${formatCurrency(ledgerModalData.netProfit)}`}
        icon={<Coins size={16} />}
        size={ledgerModalData.cardType === 'profit' || ledgerModalData.cardType === 'margin' ? 'small' : 'big'}>
        <div className="space-y-4">
          {/* Default KPI Headers (Only show for non-profit/non-margin cardTypes) */}
          {ledgerModalData.cardType !== 'profit' && ledgerModalData.cardType !== 'margin' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-center border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{L('Total Revenue')}</p>
                <h5 className="text-lg font-black text-farm-600 dark:text-farm-400">Rs. {formatCurrency(ledgerModalData.income)}</h5>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{L('Total Expenditures')}</p>
                <h5 className="text-lg font-black text-red-400">Rs. {formatCurrency(ledgerModalData.expense)}</h5>
              </div>
            </div>
          )}

          {/* Profit Formula layout */}
          {ledgerModalData.cardType === 'profit' && (
            <div className="p-5 rounded-2xl border border-[color:var(--muf-color-border)] bg-slate-50 dark:bg-slate-900/20 text-center space-y-4">
              <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-wider">📐 Net Profit Equation</h4>
              <div className="flex flex-col items-stretch justify-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                <div className="p-3 bg-white dark:bg-[#101625]/60 rounded-xl border border-slate-200 dark:border-slate-800 w-full shadow-xs">
                  <span className="text-[9px] uppercase tracking-wider block text-slate-400 mb-1">{L('Total Revenue')}</span>
                  <strong className="text-farm-600 dark:text-farm-400 text-sm">Rs. {formatCurrency(ledgerModalData.income)}</strong>
                </div>
                <div className="text-xl font-bold font-mono">−</div>
                <div className="p-3 bg-white dark:bg-[#101625]/60 rounded-xl border border-slate-200 dark:border-slate-800 w-full shadow-xs">
                  <span className="text-[9px] uppercase tracking-wider block text-slate-400 mb-1">{L('Total Expenditures')}</span>
                  <strong className="text-red-500 text-sm">Rs. {formatCurrency(ledgerModalData.expense)}</strong>
                </div>
                <div className="text-xl font-bold font-mono">=</div>
                <div className="p-3 bg-white dark:bg-[#101625]/60 rounded-xl border border-slate-200 dark:border-slate-800 w-full shadow-xs">
                  <span className="text-[9px] uppercase tracking-wider block text-slate-400 mb-1">{L('Net Operating Profit')}</span>
                  <strong className={`${ledgerModalData.netProfit >= 0 ? "text-farm-600 dark:text-farm-400" : "text-red-400"} text-sm`}>Rs. {formatCurrency(ledgerModalData.netProfit)}</strong>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed italic">"Formula: Total Inflows (earned) minus direct outflows (spent) equals actual net crop/farm profit."</p>
            </div>
          )}

          {/* Margin Formula layout */}
          {ledgerModalData.cardType === 'margin' && (
            <div className="p-5 rounded-2xl border border-[color:var(--muf-color-border)] bg-slate-50 dark:bg-slate-900/20 text-center space-y-4">
              <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-wider">📐 Operating Margin Equation</h4>
              <div className="flex flex-col items-stretch justify-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                <div className="p-3 bg-white dark:bg-[#101625]/60 rounded-xl border border-slate-200 dark:border-slate-800 w-full shadow-xs">
                  <span className="text-[9px] uppercase tracking-wider block text-slate-400 mb-1">{L('Net Profit')}</span>
                  <strong className={`${ledgerModalData.netProfit >= 0 ? "text-farm-600 dark:text-farm-400" : "text-red-400"} text-sm`}>Rs. {formatCurrency(ledgerModalData.netProfit)}</strong>
                </div>
                <div className="text-xl font-bold font-mono">÷</div>
                <div className="p-3 bg-white dark:bg-[#101625]/60 rounded-xl border border-slate-200 dark:border-slate-800 w-full shadow-xs">
                  <span className="text-[9px] uppercase tracking-wider block text-slate-400 mb-1">{L('Total Revenue')}</span>
                  <strong className="text-farm-600 dark:text-farm-400 text-sm">Rs. {formatCurrency(ledgerModalData.income)}</strong>
                </div>
                <div className="text-xl font-bold font-mono">× 100 =</div>
                <div className="p-3 bg-white dark:bg-[#101625]/60 rounded-xl border border-slate-200 dark:border-slate-800 w-full shadow-xs">
                  <span className="text-[9px] uppercase tracking-wider block text-slate-400 mb-1">{L('Operating Margin (%)')}</span>
                  <strong className="text-farm-500 text-sm">
                    {ledgerModalData.income > 0 ? (((ledgerModalData.netProfit) / ledgerModalData.income) * 100).toFixed(1) : '0.0'}%
                  </strong>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed italic">"Formula: Net Profit divided by Total Inflow Revenue, multiplied by 100 represents direct operational margin."</p>
            </div>
          )}

          {/* Income source share breakdown */}
          {ledgerModalData.cardType === 'income' && ledgerModalData.breakdowns.length > 0 && (
            <div className="p-4 rounded-xl border border-[color:var(--muf-color-border)] bg-slate-50 dark:bg-slate-900/20 space-y-3 shadow-xs">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">🌾 Income Share by Source / Buyer</h4>
              <div className="space-y-2.5">
                {ledgerModalData.breakdowns.map(b => {
                  const pct = ledgerModalData.income > 0 ? Math.round((b.amount / ledgerModalData.income) * 100) : 0;
                  return (
                    <div key={b.name} className="text-xs">
                      <div className="flex justify-between font-bold mb-1">
                        <span className="text-slate-700 dark:text-slate-300">{b.name}</span>
                        <span className="font-extrabold text-farm-600 dark:text-farm-400">Rs. {formatCurrency(b.amount)} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-farm-600 h-full rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Expense category share breakdown */}
          {ledgerModalData.cardType === 'expense' && ledgerModalData.breakdowns.length > 0 && (
            <div className="p-4 rounded-xl border border-[color:var(--muf-color-border)] bg-slate-50 dark:bg-slate-900/20 space-y-3 shadow-xs">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">🚜 Expenditure Share by Category</h4>
              <div className="space-y-2.5">
                {ledgerModalData.breakdowns.map(b => {
                  const pct = ledgerModalData.expense > 0 ? Math.round((b.amount / ledgerModalData.expense) * 100) : 0;
                  return (
                    <div key={b.name} className="text-xs">
                      <div className="flex justify-between font-bold mb-1">
                        <span className="text-slate-700 dark:text-slate-300">{b.name}</span>
                        <span className="font-extrabold text-red-500">Rs. {formatCurrency(b.amount)} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-red-400 h-full rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Detailed Transaction Roster List */}
          {ledgerModalData.transactions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">📜 Recent Transaction Ledger Logs</h4>
              <div className="space-y-2.5 max-h-[40vh] overflow-y-auto pr-1">
                {ledgerModalData.transactions.map(f => (
                  <div
                    key={f._id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ledger entry: ${f.category}`}
                    onClick={() => openPopup('selectedFinance', f)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openPopup('selectedFinance', f);
                      }
                    }}
                    className="flex justify-between items-center text-xs p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/20 text-slate-800 dark:text-slate-100 cursor-pointer hover:border-farm-300 dark:hover:border-farm-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-farm-500 transition-colors"
                  >
                    <div>
                      <p className="font-bold text-slate-800 dark:text-white">{f.category}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{f.date}</p>
                    </div>
                    <span className={`font-extrabold ${f.type === 'expense' ? 'text-red-400' : 'text-farm-600 dark:text-farm-400'}`}>
                      {f.type === 'expense' ? '-Rs. ' : '+Rs. '}{formatCurrency(f.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ledgerModalData.transactions.length === 0 && ledgerModalData.cardType !== 'profit' && ledgerModalData.cardType !== 'margin' && (
            <p className="text-center text-xs text-slate-500 py-6">{L('No transaction logs available.')}</p>
          )}
        </div>
      </DetailModal>

      {/* 3. Pending Care Duties Detail */}
      <DetailModal
        open={modal === 'pending_duties'}
        onClose={closePopup}
        title={L('Active Care & Duties')}
        subtitle={`${tasks.filter(t => t.status === 'Pending').length} Pending Tasks`}
        icon={<CheckSquare size={16} />}
       size="small">
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{L('Active tasks assigned to your team:')}</p>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {tasks.filter(t => t.status === 'Pending').map(t => (
              <button
                type="button"
                key={t._id}
                onClick={() => openPopup('selectedTask', t)}
                aria-label={`${L('Open task details')}: ${t.title}`}
                className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-left text-slate-800 dark:text-slate-100 hover:border-farm-400 dark:hover:border-farm-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-farm-500 transition-colors"
              >
                <div className="flex justify-between items-start gap-3 mb-2">
                  <span className="font-extrabold text-slate-800 dark:text-white">{t.title}</span>
                  <span className="shrink-0 text-[9px] font-bold px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-900/20 uppercase">{t.priority} Priority</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>{L('Assigned to:')} <strong className="text-slate-700 dark:text-slate-300">{t.assigned_to || 'General'}</strong></span>
                  <span>{L('Due:')} <strong className="text-slate-700 dark:text-slate-300">{t.due_date || 'N/A'}</strong></span>
                  <span>{L('Open task for notes and full details')} →</span>
                </div>
              </button>
            ))}
            {tasks.filter(t => t.status === 'Pending').length === 0 && (
              <p className="text-center text-xs text-slate-500 py-6">All tasks completed! Duty roster is clean.</p>
            )}
          </div>
        </div>
      </DetailModal>

      {/* 5. System Notifications Detail */}
      <DetailModal
        open={modal === 'notifications'}
        onClose={closePopup}
        title={L('Active Farm Notifications')}
        subtitle={L('Real-time Operational Alerts')}
        icon={<Bell size={16} />}
       size="small">
        <div className="space-y-4 text-slate-800 dark:text-slate-100">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Below are the current real-time alerts and notices for Usman Agri Farm operations:</p>
          <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
            {realNotifications.map(notif => (
              <div key={notif.id} className="p-3.5 rounded-xl border border-[color:var(--muf-color-border)] bg-slate-50 dark:bg-slate-900/40 space-y-1 animate-fade-in">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-xs text-slate-800 dark:text-white flex items-center gap-1.5">
                    {notif.title}
                  </span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                    notif.type === 'danger' ? 'bg-red-900/20 text-red-600 border-red-900/30' :
                    notif.type === 'warning' ? 'bg-amber-900/20 text-amber-600 border-amber-900/30' :
                    notif.type === 'info' ? 'bg-blue-900/20 text-blue-600 border-blue-900/30' :
                    'bg-farm-900/20 text-farm-500 dark:text-farm-400 border-farm-900/30'
                  }`}>
                    {L('Alert')}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">{notif.desc}</p>
                <p className="text-[9px] text-slate-400 font-bold">{notif.time}</p>
              </div>
            ))}
            {realNotifications.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-500 italic">
                ✨ No active alerts. All farm operations are running smoothly!
              </div>
            )}
          </div>
        </div>
      </DetailModal>

      {/* Shared diary popup: entries, media, links and sharing */}
      <DetailModal open={diaryOpen} onClose={() => setDiaryOpen(false)} title={L('Notes')}
        subtitle={L('Daily notes and observations')} icon={<BookOpen size={16} />} size="big">
        <MufDiary
          entries={diaryEntries}
          onSave={saveDiaryEntry}
          onDelete={deleteDiaryEntry}
          entityOptions={[
            ...crops.map((item) => ({ id: String(item._id || item.id), type: 'crop', label: item.name || L('Crop') })),
            ...laborers.map((item) => ({ id: String(item._id || item.id), type: 'labor', label: item.name || L('Laborer') })),
            ...suppliers.map((item) => ({ id: String(item._id || item.id), type: 'dealer', label: item.name || item.company || L('Dealer') })),
          ].filter((item) => item.id && item.id !== 'undefined')}
          shareTargets={[
            ...laborers.map((item) => ({ id: String(item._id || item.id), type: 'labor', label: item.name || L('Laborer'), phone: item.phone || item.mobile })),
            ...suppliers.map((item) => ({ id: String(item._id || item.id), type: 'dealer', label: item.name || item.company || L('Dealer'), phone: item.phone || item.mobile })),
          ].filter((item) => item.id && item.id !== 'undefined')}
        />
      </DetailModal>

    </div>
  );
}

export default App;

