import { useState, useEffect, useRef } from 'react';
import { mufToday, mufShiftDays } from '../muf/data/muf-date';
import TelegramPanel from '../muf/ui/muf-telegram-panel';
import { X, Settings, Users, Database, UserPlus, ShieldCheck, Check, Loader, Clock, FileText, Download, Upload, RefreshCw, Sparkles, Send, Globe2 } from 'lucide-react';
import { AnimatePresence, motion } from '../muf/core/muf-motion';
import * as api from '../api';
import { getLang } from '../i18n';
import AvatarUploader from '../muf/ui/muf-avatar';
import { mufPdfStart, mufPdfSummary, mufPdfTable, mufPdfFooter, mufPdfSave, mufPdfCheckPage } from '../muf/data/muf-pdf';
import { shareBackupFile } from '../utils/share';
import MyFarmsPanel from './MyFarmsPanel';
import MufAdminShell from '../muf/admin/muf-admin-shell';
import MufAdminCard from '../muf/admin/muf-admin-card';
import MufAdminButton from '../muf/admin/muf-admin-button';
import MufAdminUsers from '../muf/admin/muf-admin-users';
import MufAdminReports from '../muf/admin/muf-admin-reports';
import YearlyArchivePanel from './YearlyArchivePanel';
import MufAdminGeneral from '../muf/admin/muf-admin-general';
import { useConfirm } from '../muf/core/muf-confirm';
import { mufPopupCard, mufPopupCloseHover, mufPopupCloseTap } from '../muf/core/muf-motion';
import { L } from '../i18n';
import { parseCoordinates } from './admin/adminHelpers';
import { ExportScopeWizard } from './admin/ExportScopeWizard';

const KG_PER_MAUND = 40;
const toKg = (value, unit) => {
  const val = parseFloat(value) || 0;
  const u = (unit || '').toLowerCase().trim();
  if (u === 'maund') return val * KG_PER_MAUND;
  if (u === 'ton') return val * KG_PER_MAUND * 25; // 25 * 40 = 1000
  return val; // already kg
};

export default function AdminMenu({
  open,
  onClose,
  userRole,
  username,
  currentUserEmail,
  onUpdateEmail,
  currentUserAvatar,
  onUpdateAvatar,
  isDark,
  onToggleDark,
  users,
  crops = [],
  finance = [],
  tasks = [],
  refreshData,
  showAlert,
}) {
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState('general');
  const ADMIN_TABS = [
    { id: 'general', icon: Settings, label: 'General' },
    { id: 'farms', icon: Globe2, label: 'My Farms' },
    { id: 'users', icon: Users, label: 'Users' },
    { id: 'reports', icon: FileText, label: 'Reports' },
    { id: 'backup', icon: Database, label: 'Backup' },
    { id: 'telegram', icon: Send, label: 'Telegram' },
    // { id: 'automations', icon: Clock, label: 'Automations' },
  ];
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState(null);

  // Email state & Secure Code Verification
  const [myEmail, setMyEmail] = useState(currentUserEmail || '');
  const [emailMsg, setEmailMsg] = useState(null);
  const [emailCode, setEmailCode] = useState('');
  const [emailCodeSent, setEmailCodeSent] = useState(false);

  // Password Form States & Secure Code Verification
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState(null);
  const [pwCode, setPwCode] = useState('');
  const [pwCodeSent, setPwCodeSent] = useState(false);
  const [pwVerifyMethod, setPwVerifyMethod] = useState('password'); // 'password' or 'email'
  const [sendingPwCode, setSendingPwCode] = useState(false);
  const [sendingEmailCode, setSendingEmailCode] = useState(false);
  const [pwSubmitting, setPwSubmitting] = useState(false);

  // New Worker Form States
  const [workerForm, setWorkerForm] = useState({ username: '', email: '', password: '', role: 'worker' });
  const [resetWorkerId, setResetWorkerId] = useState(null);
  const [workerNewPw, setWorkerNewPw] = useState('');
  const [workerNewUsername, setWorkerNewUsername] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');

  // Automations & Alerts State
  const [autoSettings, setAutoSettings] = useState({
    cron_enabled: true,
    schedule: '0 8 * * *',
    alert_soil: true,
    alert_finance: true,
    alert_tasks: true,
    recipient: ''
  });
  const [loadingAuto, setLoadingAuto] = useState(false);
  const [autoMsg, setAutoMsg] = useState(null);

  // Custom Dispatch Prompt State
  const [showDispatchPrompt, setShowDispatchPrompt] = useState(false);
  const [dispatchStartDate, setDispatchStartDate] = useState('');
  const [dispatchEndDate, setDispatchEndDate] = useState('');
  const [dispatchAllFields, setDispatchAllFields] = useState(true);
  const [dispatchIncludeCrops, setDispatchIncludeCrops] = useState(true);
  const [dispatchIncludeFinance, setDispatchIncludeFinance] = useState(true);
  const [dispatchIncludeTasks, setDispatchIncludeTasks] = useState(true);

  // Farm Location (weather source) State — admin sets GPS coordinates; the
  // city label is reverse-geocoded automatically from those coordinates.
  const [farmLocInput, setFarmLocInput] = useState('');
  const [farmLocCurrent, setFarmLocCurrent] = useState(null);
  const [farmLocMsg, setFarmLocMsg] = useState(null);
  const [farmLocLoading, setFarmLocLoading] = useState(false);
  const [autoBackup, setAutoBackup] = useState(null);
  const backupToastShown = useRef(false);

  const handleCustomDispatch = async (e) => {
    if (e) e.preventDefault();
    setSubmitting(true);
    setAutoMsg(null);
    try {
      const res = await api.triggerImmediateDigest({
        start_date: dispatchStartDate || null,
        end_date: dispatchEndDate || null,
        all_fields: dispatchAllFields,
        include_crops: dispatchIncludeCrops,
        include_finance: dispatchIncludeFinance,
        include_tasks: dispatchIncludeTasks
      });
      setShowDispatchPrompt(false);
      showAlert(res.data.message || "Custom performance report dispatched successfully!");
    } catch (err) {
      let errMsg = "Failed to dispatch custom report email.";
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (typeof detail === 'string') {
          errMsg = detail;
        } else if (Array.isArray(detail)) {
          errMsg = detail[0]?.msg || JSON.stringify(detail);
        } else {
          errMsg = JSON.stringify(detail);
        }
      }
      showAlert(errMsg, true);
    } finally {
      setSubmitting(false);
    }
  };

  // Fetch automations when switching tabs
  useEffect(() => {
    if (open && activeTab === 'backup' && userRole === 'admin') {
      api.getAutoBackup()
        .then(res => {
          setAutoBackup(res.data);
          if (res.data?.emailed_to && !backupToastShown.current) {
            backupToastShown.current = true;
            showAlert(`Backup sent to ${res.data.emailed_to} on ${String(res.data.emailed_at || '').slice(0, 10)}`);
          }
        })
        .catch(() => setAutoBackup(null));
    }
  }, [open, activeTab, userRole]);

  useEffect(() => {
    if (open && activeTab === 'automations') {
      setLoadingAuto(true);
      api.getAutomations()
        .then(res => {
          setAutoSettings(res.data);
        })
        .catch(err => {
          console.error("Failed to load automations:", err);
        })
        .finally(() => {
          setLoadingAuto(false);
        });
    }
  }, [open, activeTab]);

  useEffect(() => {
    if (open) {
      setActiveTab('general');
      setCurPw('');
      setNewPw('');
      setPwMsg(null);
      setPwCode('');
      setPwCodeSent(false);
      setPwVerifyMethod('password');
      setMyEmail(currentUserEmail || '');
      setEmailMsg(null);
      setEmailCode('');
      setEmailCodeSent(false);
      setWorkerForm({ username: '', email: '', password: '', role: 'worker' });
      setResetWorkerId(null);
      setWorkerNewPw('');
      setWorkerNewUsername('');
      setAdminConfirmPassword('');
      setAutoMsg(null);
      setFarmLocInput('');
      setFarmLocMsg(null);
    }
  }, [open, currentUserEmail]);

  // Fetch the current saved farm location whenever the admin hub opens (it is
  // shown on the General tab; no auth required to read it).
  useEffect(() => {
    if (!open) return;
    api.getFarmLocation()
      .then(res => {
        const loc = res.data || {};
        setFarmLocCurrent((loc.lat != null && loc.lon != null) ? loc : null);
      })
      .catch(() => setFarmLocCurrent(null));
  }, [open]);

  // Lock body scrolling when modal open (prevent background scroll bleed)
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    document.body._adminScrollY = scrollY;
    
    return () => {
      const sy = document.body._adminScrollY || 0;
      document.documentElement.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, sy);
    };
  }, [open]);

  const isAdmin = userRole === 'admin';

  // --- Password Change ---
  const handleRequestPwCode = async () => {
    setPwMsg(null);
    setSubmitting(true);
    try {
      await api.requestProfileCode();
      setPwCodeSent(true);
      setPwMsg({ type: 'ok', text: 'Verification authorization code has been successfully sent to your email.' });
    } catch (err) {
      setPwMsg({ type: 'err', text: err.response?.data?.detail || 'Failed to deliver code.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePw = async (e) => {
    e?.preventDefault();
    setPwMsg(null);
    if (!newPw) {
      return setPwMsg({ type: 'err', text: 'New password is required.' });
    }
    if (newPw.length < 6) {
      return setPwMsg({ type: 'err', text: 'New password must be at least 6 characters.' });
    }
    
    if (pwVerifyMethod === 'password') {
      if (!curPw) {
        return setPwMsg({ type: 'err', text: 'Current password is required.' });
      }
    } else {
      if (!pwCode) {
        return setPwMsg({ type: 'err', text: 'Verification code is required. Please request and input your code.' });
      }
    }
    
    setPwSubmitting(true);
    try {
      await api.changePassword(curPw, newPw, pwCode);
      setCurPw('');
      setNewPw('');
      setPwCode('');
      setPwCodeSent(false);
      setPwMsg({ type: 'ok', text: 'Administrative access password updated successfully!' });
    } catch (err) {
      setPwMsg({ type: 'err', text: err.response?.data?.detail || 'Failed to update password.' });
    } finally {
      setPwSubmitting(false);
    }
  };

  // --- Email Change ---
  const handleRequestEmailCode = async () => {
    setEmailMsg(null);
    setSubmitting(true);
    try {
      await api.requestProfileCode();
      setEmailCodeSent(true);
      setEmailMsg({ type: 'ok', text: 'Verification authorization code has been successfully sent to your email.' });
    } catch (err) {
      setEmailMsg({ type: 'err', text: err.response?.data?.detail || 'Failed to deliver code.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateEmail = async (e) => {
    e?.preventDefault();
    if (!myEmail.trim()) {
      return setEmailMsg({ type: 'err', text: 'Email cannot be empty.' });
    }
    if (!emailCode) {
      return setEmailMsg({ type: 'err', text: 'Verification code is mandatory. Please request a code and input it.' });
    }
    setSubmitting(true);
    setEmailMsg(null);
    try {
      await api.updateMe(myEmail, emailCode);
      setEmailMsg({ type: 'ok', text: 'Administrator profile email updated successfully!' });
      setEmailCode('');
      setEmailCodeSent(false);
      if (onUpdateEmail) {
        onUpdateEmail(myEmail);
      }
    } catch (err) {
      setEmailMsg({ type: 'err', text: err.response?.data?.detail || 'Failed to update email.' });
    } finally {
      setSubmitting(false);
    }
  };

  // --- Automations Settings ---
  const handleSaveAutomations = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setAutoMsg(null);
    try {
      await api.saveAutomations(autoSettings);
      setAutoMsg({ type: 'ok', text: 'Automation configurations successfully saved to the database!' });
    } catch (err) {
      setAutoMsg({ type: 'err', text: err.response?.data?.detail || 'Failed to save automation configurations.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTriggerImmediateDigest = async () => {
    setSubmitting(true);
    setAutoMsg(null);
    try {
      const res = await api.triggerImmediateDigest({ all_fields: true });
      setAutoMsg({ type: 'ok', text: res.data.message || 'Immediate email digest dispatched successfully!' });
    } catch (err) {
      setAutoMsg({ type: 'err', text: err.response?.data?.detail || 'Failed to dispatch email digest.' });
    } finally {
      setSubmitting(false);
    }
  };

  // --- Farm Location (weather source) ---
  // Parse the pasted coordinates, reverse-geocode once to auto-derive the city
  // name, then persist { raw_dms, lat, lon, city } to the backend settings.
  const handleSaveFarmLocation = async (e) => {
    if (e) e.preventDefault();
    setFarmLocMsg(null);
    const parsed = parseCoordinates(farmLocInput);
    if (!parsed) {
      setFarmLocMsg({ type: 'err', text: "Could not parse coordinates. Use DMS like 33°49'45.3 N 72°48'56.1 E, or decimal like 33.829, 72.816." });
      return;
    }
    setFarmLocLoading(true);
    let cityName = '';
    try {
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${parsed.lat}&lon=${parsed.lon}&format=json`);
      if (geoRes.ok) {
        const geo = await geoRes.json();
        cityName = geo.address?.city || geo.address?.town || geo.address?.village || geo.address?.suburb || geo.address?.county || '';
      }
    } catch (err) {
      console.warn('Reverse geocode failed:', err);
    }
    try {
      await api.saveFarmLocation({ raw_dms: farmLocInput.trim(), lat: parsed.lat, lon: parsed.lon, city: cityName });
      setFarmLocCurrent({ raw_dms: farmLocInput.trim(), lat: parsed.lat, lon: parsed.lon, city: cityName });
      setFarmLocMsg({ type: 'ok', text: cityName
        ? `Farm location set to ${cityName} (${parsed.lat.toFixed(5)}, ${parsed.lon.toFixed(5)}). Weather updates on next load.`
        : `Farm location saved (${parsed.lat.toFixed(5)}, ${parsed.lon.toFixed(5)}). City name could not be auto-detected; weather updates on next load.` });
      setFarmLocInput('');
    } catch (err) {
      setFarmLocMsg({ type: 'err', text: err.response?.data?.detail || 'Failed to save farm location.' });
    } finally {
      setFarmLocLoading(false);
    }
  };

  // --- Scoped PDF Reports Generation & Printing ---
  // reportType: 'finance' (Crop-Specific Cycle Summary — money only) or
  //             'yield'   (Seasonal Harvest Yield Report — production only).
  // scope: { year, season?, cropIds? } — season/cropIds optional; the deeper
  // the scope the narrower the crop set. Each report ALWAYS keeps its own
  // content type; the scope only changes WHICH crops are included.
  const handleExportPDF = async (reportType, scope = {}) => {
    // 1. Resolve the crop set from the drill-down scope
    let scopedCrops = crops.filter(c => (c.crop_year || 'N/A') === (scope.year || 'N/A'));
    if (scope.season) scopedCrops = scopedCrops.filter(c => (c.season || 'Other') === scope.season);
    if (scope.cropIds && scope.cropIds.length > 0) scopedCrops = scopedCrops.filter(c => scope.cropIds.includes(c._id));

    if (scopedCrops.length === 0) {
      showAlert("No crops found for the selected scope. Nothing to export.", true);
      return;
    }

    // 2. Human-readable scope label for headers
    const yearLabel = scope.year || 'N/A';
    let scopeLabel = `Crop Year ${yearLabel}`;
    if (scope.season) scopeLabel = `${scope.season} Season · ${yearLabel}`;
    if (scope.cropIds && scope.cropIds.length > 0) {
      scopeLabel = `${scopedCrops.map(c => c.name).join(', ')} — ${scope.season || 'All Seasons'} · ${yearLabel}`;
    }


    // One-tap PDF download in the shared muf-pdf design (no print window).
    let reportTitle = "";
    const scopedIds = scopedCrops.map(c => c._id);

    if (reportType === 'finance') {
      // ── FINANCE-ONLY REPORT: incomes, expenses & transaction logs.
      reportTitle = `Crop Cycle Financial Summary — ${scopeLabel}`;
      const scopedFinance = finance.filter(f => scopedIds.includes(f.crop_id));
      const totalIncomeVal = scopedFinance.filter(f => f.type === 'income').reduce((sum, item) => sum + item.amount, 0);
      const totalExpenseVal = scopedFinance.filter(f => f.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
      const netVal = totalIncomeVal - totalExpenseVal;

      const { doc, y } = await mufPdfStart(reportTitle, `Generated: ${mufToday()} · System Administrator`);
      let cursor = mufPdfSummary(doc, y, `Financial Overview — ${scopeLabel}`, [
        ['Crops in Scope', `${scopedCrops.length} (${scopedCrops.map(c => c.name).join(', ').slice(0, 60)})`],
        ['Total Income', `Rs. ${totalIncomeVal.toLocaleString()}`],
        ['Total Expenses', `Rs. ${totalExpenseVal.toLocaleString()}`],
        ['Net Operational Profit', `Rs. ${netVal.toLocaleString()}`],
      ]);
      for (const crop of scopedCrops) {
        const rows = scopedFinance.filter(f => f.crop_id === crop._id);
        const inc = rows.filter(f => f.type === 'income').reduce((sum2, f) => sum2 + f.amount, 0);
        const exp = rows.filter(f => f.type === 'expense').reduce((sum2, f) => sum2 + f.amount, 0);
        cursor = mufPdfCheckPage(doc, cursor, 55);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(20, 83, 45);
        doc.text(`${crop.name} (${crop.variety || 'Standard'}) — ${crop.field || 'Farm-wide'}`, 14, cursor);
        cursor += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`Income: Rs. ${inc.toLocaleString()}   |   Expense: Rs. ${exp.toLocaleString()}   |   Net: Rs. ${(inc - exp).toLocaleString()}`, 14, cursor);
        cursor += 4;
        cursor = mufPdfTable(doc, cursor,
          ['Date', 'Category', 'Type', 'Notes', 'Amount'],
          rows.length === 0
            ? [['—', 'No ledger transactions linked to this crop.', '', '', '']]
            : rows.map(f => [f.date || '—', f.category, String(f.type).toUpperCase(), f.notes || '', `Rs. ${f.amount.toLocaleString()}`])
        );
      }
      mufPdfFooter(doc, reportTitle);
      mufPdfSave(doc, `finance-report-${(scope.year || 'all')}`);
    } else if (reportType === 'yield') {
      // ── YIELD-ONLY REPORT: varieties, field dimensions & harvest weights.
      reportTitle = `Harvest Yield Report — ${scopeLabel}`;
      const totalYield = scopedCrops.reduce((sum, c) => sum + toKg(c.yield_kg, c.yield_unit), 0);
      const totalArea = scopedCrops.reduce((sum, c) => sum + (parseFloat(c.area_kanal) || 0), 0);
      const growingCrops = scopedCrops.filter(c => c.status === 'Growing').length;
      const harvestedCrops = scopedCrops.filter(c => c.status === 'Completed' || c.status === 'Harvesting').length;

      const { doc, y } = await mufPdfStart(reportTitle, `Generated: ${mufToday()} · System Administrator`);
      let cursor = mufPdfSummary(doc, y, `Harvest Overview — ${scopeLabel}`, [
        ['Crops in Scope', `${scopedCrops.length} (${scopedCrops.map(c => c.name).join(', ').slice(0, 60)})`],
        ['Total Planted Area', `${totalArea.toLocaleString()} kanal`],
        ['Total Harvested Yield', `${totalYield.toLocaleString()} kg`],
        ['Active Crops in Ground', `${growingCrops} sectors`],
        ['Completed Cycles', `${harvestedCrops} batches`],
      ]);
      mufPdfTable(doc, cursor,
        ['Crop Name', 'Variety', 'Field / Plot', 'Area (Kanal)', 'Plant Date', 'Harvest Date', 'Status', 'Yield (kg)', 'Original Unit'],
        scopedCrops.map(c => {
          const normalizedKg = toKg(c.yield_kg, c.yield_unit);
          const origUnit = c.yield_kg && c.yield_unit ? `${c.yield_kg.toLocaleString()} ${c.yield_unit}` : '—';
          return [c.name, c.variety || 'Standard', c.field || 'N/A', c.area_kanal || '—', c.plant_date || 'N/A', c.harvest_date || 'Pending', c.status, `${normalizedKg.toLocaleString()} kg`, origUnit];
        }),
        [['TOTALS', '', '', totalArea.toLocaleString(), '', '', '', `${totalYield.toLocaleString()} kg`, '']]
      );
      mufPdfFooter(doc, reportTitle);
      mufPdfSave(doc, `yield-report-${(scope.year || 'all')}`);
    }
    showAlert(`${reportTitle} downloaded as PDF.`);
  };

  // --- Add Worker ---
  const handleAddWorker = async (e) => {
    e.preventDefault();
    if (!workerForm.username || !workerForm.password) {
      return showAlert("Please complete all required fields.", true);
    }
    if (workerForm.role === 'admin' && !workerForm.email) {
      return showAlert("Email address is mandatory for administrator accounts.", true);
    }
    setSubmitting(true);
    try {
      const emailVal = workerForm.role === 'admin' ? workerForm.email : "";
      await api.signup(workerForm.username, emailVal, workerForm.password, workerForm.role);
      showAlert(`Account '${workerForm.username}' registered successfully!`);
      setWorkerForm({ username: '', email: '', password: '', role: 'worker' });
      refreshData();
    } catch (err) {
      showAlert(err.response?.data?.detail || "Failed to register account.", true);
    } finally {
      setSubmitting(false);
    }
  };

  // --- Admin Edit Worker Profile (Username and Password) ---
  const handleEditWorkerProfile = async (id, oldName) => {
    if (!workerNewUsername.trim()) {
      return showAlert("Username cannot be empty.", true);
    }
    if (!adminConfirmPassword) {
      return showAlert("Enter your admin password to save these changes.", true);
    }
    setSubmitting(true);
    setActionId(id);
    try {
      await api.editWorkerProfile(id, workerNewUsername, workerNewPw, adminConfirmPassword);
      showAlert(`Profile for '${oldName}' updated successfully!`);
      setResetWorkerId(null);
      setWorkerNewPw('');
      setWorkerNewUsername('');
      setAdminConfirmPassword('');
      refreshData();
    } catch (err) {
      showAlert(err.response?.data?.detail || "Failed to update profile.", true);
    } finally {
      setSubmitting(false);
      setActionId(null);
    }
  };

  // --- Delete User ---
  const handleDeleteUser = async (id) => {
    const ok = await confirm({
      title: L('Delete Worker Account'),
      message: L('Are you sure you want to delete this worker account? They will lose access immediately.'),
      tone: 'danger',
      confirmLabel: L('Delete'),
      cancelLabel: L('Cancel')
    });
    if (!ok) return;
    setActionId(id);
    try {
      await api.deleteUser(id);
      showAlert("Worker account deleted successfully.");
      refreshData();
    } catch (err) {
      showAlert(err.response?.data?.detail || "Failed to delete user.", true);
    } finally {
      setActionId(null);
    }
  };

  // --- Backup Export ---
  const handleExportBackup = async () => {
    try {
      const res = await api.getBackup();
      const jsonStr = JSON.stringify(res.data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agrifarm-backup-${mufToday()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showAlert("JSON Database Backup exported successfully!");
    } catch (err) {
      showAlert("Backup export failed.", true);
    }
  };

  // --- Backup share via WhatsApp (muf shared pattern) ---
  const handleShareBackup = async () => {
    try {
      const res = await api.getBackup();
      const result = await shareBackupFile(`agrifarm-backup-${mufToday()}.json`, JSON.stringify(res.data, null, 2));
      if (result === 'shared') showAlert('Backup shared!');
      else if (result === 'fallback') showAlert('Backup downloaded — attach the file in WhatsApp.');
    } catch (err) {
      showAlert('Backup share failed.', true);
    }
  };

  // --- Backup Restore ---
  const handleImportBackup = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ok = await confirm({
      title: L('Restore Database'),
      message: L('Restore farm data from this file? Current records will be replaced (user accounts are kept).'),
      tone: 'warning',
      confirmLabel: L('Overwrite & Restore'),
      cancelLabel: L('Cancel')
    });
    if (!ok) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const payload = JSON.parse(event.target.result);
        await api.restoreBackup(payload);
        showAlert("Database restored successfully!");
        refreshData();
      } catch (err) {
        const detail = err?.response?.data?.error
          || err?.response?.data?.detail
          || err?.response?.data?.message
          || err?.message;
        showAlert(detail ? `Database restore failed: ${detail}` : "Database restore failed. Ensure valid JSON structure.", true);
      }
    };
    reader.readAsText(file);
  };

  const filteredTabs = ADMIN_TABS.filter(tab => {
    if (!isAdmin && tab.id !== 'general') return false;
    return true;
  });

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <MufAdminShell
          open={true}
          onClose={onClose}
          title={isAdmin ? "Settings & Admin Hub" : "Worker Operations Hub"}
          subtitle={isAdmin ? "Control Panel" : "Standard Access Portal"}
          icon={isAdmin ? <Settings size={20} /> : <Users size={20} />}
          sections={filteredTabs}
          activeSection={activeTab}
          onSectionChange={setActiveTab}
        >

              {/* ─── TAB: GENERAL ─── */}
              {activeTab === 'general' && (
                <MufAdminGeneral
                  username={username || ''}
                  email={myEmail || currentUserEmail}
                  avatarSlot={
                    <AvatarUploader
                      avatar={currentUserAvatar || ''}
                      fallbackLetter={(username || 'A')[0]}
                      onSave={async (base64) => {
                        try {
                          setSubmitting(true);
                          await api.updateMe(currentUserEmail || '', '', base64);
                          onUpdateAvatar(base64);
                          showAlert("Avatar photo updated successfully!");
                        } catch (err) {
                          showAlert("Failed to update avatar photo.", true);
                        } finally {
                          setSubmitting(false);
                        }
                      }}
                      onRemove={async () => {
                        try {
                          setSubmitting(true);
                          await api.updateMe(currentUserEmail || '', '', 'REMOVE_AVATAR');
                          onUpdateAvatar('');
                          showAlert("Avatar photo removed.");
                        } catch (err) {
                          showAlert("Failed to remove avatar photo.", true);
                        } finally {
                          setSubmitting(false);
                        }
                      }}
                    />
                  }
                  newPassword={newPw}
                  currentPassword={curPw}
                  pwCode={pwCode}
                  pwMsg={pwMsg ? { type: pwMsg.type === 'ok' ? 'success' : 'error', msg: pwMsg.text } : null}
                  sendingPwCode={sendingPwCode}
                  passwordBusy={pwSubmitting || submitting}
                  onNewPasswordChange={setNewPw}
                  onCurrentPasswordChange={setCurPw}
                  onPwCodeChange={setPwCode}
                  onSendPwCode={async () => { setSendingPwCode(true); try { await api.requestProfileCode(); setPwCodeSent(true); setPwMsg({ type: 'ok', text: 'Code sent to your email.' }); } catch (err) { setPwMsg({ type: 'err', text: err.response?.data?.detail || 'Failed to send code.' }); } finally { setSendingPwCode(false); } }}
                  onSubmitPassword={(e) => { e.preventDefault(); handleChangePw(); }}
                  newEmail={myEmail}
                  emailCode={emailCode}
                  emailMsg={emailMsg ? { type: emailMsg.type === 'ok' ? 'success' : 'error', msg: emailMsg.text } : null}
                  sendingEmailCode={sendingEmailCode}
                  emailBusy={false}
                  currentEmail={currentUserEmail}
                  onNewEmailChange={setMyEmail}
                  onEmailCodeChange={setEmailCode}
                  onSendEmailCode={async () => { setSendingEmailCode(true); try { await api.requestProfileCode(); setEmailCodeSent(true); setEmailMsg({ type: 'ok', text: 'Code sent to your email.' }); } catch (err) { setEmailMsg({ type: 'err', text: err.response?.data?.detail || 'Failed to send code.' }); } finally { setSendingEmailCode(false); } }}
                  onSubmitEmail={(e) => { e.preventDefault(); handleUpdateEmail(); }}
                >
                  {/* Farm Location (weather widget) */}
                  <MufAdminCard icon={<Globe2 className="w-5 h-5" />} title={L('Farm Location')} subtitle={L('Set your farm coordinates for live weather')}>
                    <div className="space-y-3">
                      {farmLocCurrent && (
                        <p className="text-xs text-slate-500">
                          Current: <span className="font-semibold">{farmLocCurrent.city || 'Unknown'}</span> ({farmLocCurrent.lat?.toFixed(4)}, {farmLocCurrent.lon?.toFixed(4)})
                        </p>
                      )}
                      {farmLocMsg && (
                        <div className={`p-3 rounded-lg text-xs border font-semibold ${farmLocMsg.type === 'ok' || farmLocMsg.type === 'success' ? 'bg-farm-50 border-farm-300 text-farm-800' : 'bg-red-50 border-red-300 text-red-800'}`}>
                          {farmLocMsg.text || farmLocMsg.msg}
                        </div>
                      )}
                      <input
                        value={farmLocInput}
                        onChange={(e) => setFarmLocInput(e.target.value)}
                        placeholder="33.9943, 72.9106"
                        className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-farm-500"
                      />
                      <p className="text-[10px] text-slate-400">{L('Enter latitude, longitude. City is auto-detected.')}</p>
                      <MufAdminButton variant="secondary" size="md" onClick={() => handleSaveFarmLocation()}>{L('Save Location')}</MufAdminButton>
                    </div>
                  </MufAdminCard>
                </MufAdminGeneral>
              )}

                            {/* ─── TAB: USERS ─── */}
              {activeTab === 'telegram' && (
              <TelegramPanel
                lang={getLang()}
                adapter={{
                  status: async () => (await api.getTelegramStatus()).data,
                  listUsers: async () => (await api.getUsers()).data || [],
                  listWorkers: async () => (await api.getLaborers()).data || [],
                  settings: async () => (await api.getTelegramSettings()).data,
                  saveSettings: async (s) => (await api.saveTelegramSettings(s)).data,
                  linkCode: async (o) => (await api.createTelegramLinkCode(o)).data,
                  unlink: async (c) => (await api.deleteTelegramLink(c)).data,
                  sendSummary: async () => (await api.sendTelegramSummaryNow()).data || {},
                }}
                blurbEn={'Workers send "kharcha 500 spray", "hazri" or "hisab" — entries land in the app automatically.'}
                cronPath="/telegram/cron?key=CRON_SECRET"
              />
            )}
              {activeTab === 'users' && (
                <MufAdminUsers
                  users={users.map(u => ({ _id: u._id, username: u.username, role: u.role, email: u.email, displayName: u.username, active: true }))}
                  currentUsername={username || ''}
                  minPasswordLength={6}
                  onCreate={async (data) => {
                    setWorkerForm({ username: data.username, password: data.password, role: data.role, email: data.email });
                    await handleAddWorker({ preventDefault: () => {} });
                  }}
                  onEditProfile={async (user, data) => {
                    setWorkerNewUsername(data.username);
                    setWorkerNewPw(data.password);
                    setAdminConfirmPassword(data.adminPassword);
                    await handleEditWorkerProfile(user._id, user.username);
                  }}
                  onDelete={async (user) => {
                    await handleDeleteUser(user._id);
                  }}
                />
              )}

              {activeTab === 'automations' && (
                <div className="space-y-6 animate-fade-in">
                  {isAdmin ? (
                    <>
                    <form onSubmit={handleSaveAutomations} className="space-y-6">
                      <MufAdminCard icon={<UserPlus className="w-5 h-5" />} title={L('Profile Avatar')} subtitle={L('Upload a custom profile photo')}>
                        <div className="flex items-center gap-2 pb-2 border-b border-[color:var(--muf-color-border)]">
                          <div className="p-1.5 bg-farm-900/10 text-farm-600 dark:text-farm-400 rounded-lg">
                            <Clock size={14} />
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider font-extrabold">{L('Automated Alert Digests')}</h4>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">{L('Configure scheduled automatic email reports.')}</p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">{L('Schedule automatic email reports.')}</p>
                        
                        {autoMsg && (
                          <div className={`p-3 rounded-lg text-xs border ${
                            autoMsg.type === 'ok' ? 'bg-farm-50 border-farm-300 text-farm-800 dark:bg-farm-950/40 dark:border-farm-500 dark:text-farm-300' : 'bg-red-50 border-red-300 text-red-800 dark:bg-red-950/40 dark:border-red-500 dark:text-red-300'
                          }`}>
                            {autoMsg.text}
                          </div>
                        )}

                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            id="cron_enabled"
                            className="w-4 h-4 text-farm-600 border-slate-300 dark:border-slate-700 rounded focus:ring-farm-500 cursor-pointer"
                            checked={autoSettings.cron_enabled}
                            onChange={e => setAutoSettings({...autoSettings, cron_enabled: e.target.checked})}
                          />
                          <label htmlFor="cron_enabled" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">{L('Activate Scheduled Cronjob Engine')}</label>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          <div>
                            <label className="muf-label">{L('Report Schedule Interval')}</label>
                            <select 
                              className="w-full bg-white dark:bg-[#1a2333] border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs outline-none focus:border-farm-500 text-slate-900 dark:text-white font-medium cursor-pointer"
                              value={["0 8 * * *", "0 8 * * 0", "0 8 1 * *"].includes(autoSettings.schedule) ? autoSettings.schedule : "0 8 * * *"}
                              onChange={e => setAutoSettings({...autoSettings, schedule: e.target.value})}
                              disabled={!autoSettings.cron_enabled}
                            >
                              <option value="0 8 * * *">{L('Daily at 8:00 AM')}</option>
                              <option value="0 8 * * 0">{L('Weekly on Sunday at 8:00 AM')}</option>
                              <option value="0 8 1 * *">{L('Monthly on the 1st at 8:00 AM')}</option>
                            </select>
                          </div>
                          <div>
                            <label className="muf-label">Recipient Alert Emails (Comma-separated for multiple) *</label>
                            <input 
                              type="text"
                              required
                              className="w-full bg-white dark:bg-[#1a2333] border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs outline-none focus:border-farm-500 text-slate-900 dark:text-white"
                              placeholder="e.g. manager@farm.com, owner@farm.com"
                              value={autoSettings.recipient || ''}
                              onChange={e => setAutoSettings({...autoSettings, recipient: e.target.value})}
                              disabled={!autoSettings.cron_enabled}
                            />
                          </div>
                        </div>

                        <div className="pt-2 space-y-2">
                          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{L('Include Report Sections')}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <label className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101625]/20 text-xs cursor-pointer select-none">
                              <input 
                                type="checkbox"
                                checked={autoSettings.alert_soil}
                                onChange={e => setAutoSettings({...autoSettings, alert_soil: e.target.checked})}
                              />
                              <span className="text-slate-700 dark:text-slate-300">{L('Include Crops Register')}</span>
                            </label>
                            <label className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101625]/20 text-xs cursor-pointer select-none">
                              <input 
                                type="checkbox"
                                checked={autoSettings.alert_finance}
                                onChange={e => setAutoSettings({...autoSettings, alert_finance: e.target.checked})}
                              />
                              <span className="text-slate-700 dark:text-slate-300">{L('Include Ledger Balances')}</span>
                            </label>
                            <label className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101625]/20 text-xs cursor-pointer select-none">
                              <input 
                                type="checkbox"
                                checked={autoSettings.alert_tasks}
                                onChange={e => setAutoSettings({...autoSettings, alert_tasks: e.target.checked})}
                              />
                              <span className="text-slate-700 dark:text-slate-300">{L('Include Care Rosters')}</span>
                            </label>
                          </div>
                        </div>
                      </MufAdminCard>

                      <div className="flex gap-2 flex-wrap">
                        <button 
                          type="submit"
                          className="px-5 py-2 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer shadow-md"
                          disabled={submitting}
                        >
                          {submitting ? <Loader size={14} className="animate-spin" /> : <Check size={14} />} Save Automation Rules
                        </button>
                        
                        <button 
                          type="button"
                          onClick={() => {
                            const todayStr = mufToday();
                            setDispatchStartDate(mufShiftDays(todayStr, -90));
                            setDispatchEndDate(todayStr);
                            setDispatchAllFields(true);
                            setDispatchIncludeCrops(true);
                            setDispatchIncludeFinance(true);
                            setDispatchIncludeTasks(true);
                            setShowDispatchPrompt(true);
                          }}
                          className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer shadow-md border border-slate-200 dark:border-slate-700"
                          disabled={submitting}
                        >
                          <Sparkles size={14} className="text-amber-500 animate-pulse" /> Send Data Now
                        </button>
                      </div>
                    </form>

                    {/* Nested Custom Dispatch Parameter Prompt Overlay */}
                    <AnimatePresence>
                      {showDispatchPrompt && (
                        <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs rounded-2xl">
                          <motion.div 
                            {...mufPopupCard}
                            className="relative w-full max-w-md bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-5 space-y-4 text-slate-800 dark:text-slate-100 max-h-full overflow-y-auto my-2"
                          >
                            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-2">
                              <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                                <Sparkles size={14} className="text-amber-500" /> Dispatch Custom Report
                              </h4>
                              <motion.button 
                                type="button"
                                onClick={() => setShowDispatchPrompt(false)}
                                whileHover={mufPopupCloseHover}
                                whileTap={mufPopupCloseTap}
                                className="p-2 min-w-9 min-h-9 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              >
                                <X size={14} />
                              </motion.button>
                            </div>
                            
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{L('Start Date')}</label>
                                  <input 
                                    type="date"
                                    className="w-full bg-slate-50 dark:bg-[#1a2333] border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-farm-500 text-slate-900 dark:text-white"
                                    value={dispatchStartDate}
                                    onChange={e => setDispatchStartDate(e.target.value)}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{L('End Date')}</label>
                                  <input 
                                    type="date"
                                    className="w-full bg-slate-50 dark:bg-[#1a2333] border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-farm-500 text-slate-900 dark:text-white"
                                    value={dispatchEndDate}
                                    onChange={e => setDispatchEndDate(e.target.value)}
                                  />
                                </div>
                              </div>

                              <div className="space-y-2">
                                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#101625]/20 text-xs cursor-pointer select-none">
                                  <input 
                                    type="checkbox"
                                    checked={dispatchAllFields}
                                    onChange={e => {
                                      setDispatchAllFields(e.target.checked);
                                      if (e.target.checked) {
                                        setDispatchIncludeCrops(true);
                                        setDispatchIncludeFinance(true);
                                        setDispatchIncludeTasks(true);
                                      }
                                    }}
                                  />
                                  <span>{L('Send All Fields & Datasets')}</span>
                                </label>

                                {!dispatchAllFields && (
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pl-2 animate-fade-in">
                                    <label className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#101625]/20 text-[10px] font-bold cursor-pointer select-none">
                                      <input 
                                        type="checkbox"
                                        checked={dispatchIncludeCrops}
                                        onChange={e => setDispatchIncludeCrops(e.target.checked)}
                                      />
                                      <span>{L('Crops')}</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#101625]/20 text-[10px] font-bold cursor-pointer select-none">
                                      <input 
                                        type="checkbox"
                                        checked={dispatchIncludeFinance}
                                        onChange={e => setDispatchIncludeFinance(e.target.checked)}
                                      />
                                      <span>{L('Finances')}</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#101625]/20 text-[10px] font-bold cursor-pointer select-none">
                                      <input 
                                        type="checkbox"
                                        checked={dispatchIncludeTasks}
                                        onChange={e => setDispatchIncludeTasks(e.target.checked)}
                                      />
                                      <span>{L('Tasks')}</span>
                                    </label>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                              <button
                                type="button"
                                onClick={() => setShowDispatchPrompt(false)}
                                className="px-4 py-2.5 min-h-11 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg cursor-pointer"
                              >
                                {L('Cancel')}
                              </button>
                              <button
                                type="button"
                                onClick={handleCustomDispatch}
                                disabled={submitting || (!dispatchAllFields && !dispatchIncludeCrops && !dispatchIncludeFinance && !dispatchIncludeTasks)}
                                className="px-4 py-2.5 min-h-11 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                              >
                                {submitting ? <Loader size={12} className="animate-spin" /> : <Send size={12} />} Dispatch Report
                              </button>
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </AnimatePresence>
                    </>
                  ) : (
                    <div className="p-6 text-slate-500 flex items-center gap-3">
                      <ShieldCheck size={20} />
                      <p className="text-xs font-medium">{L('Cronjob automation and triggers configuration is restricted to Administrators.')}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ─── TAB: REPORTS ─── */}
              {activeTab === 'farms' && <MyFarmsPanel />}

              {activeTab === 'reports' && (
                <MufAdminReports reportButtons={[]}>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">💰 Crop-Specific Cycle Summary (Financial)</p>
                      <p className="text-[11px] text-slate-500">{L('Incomes, expenses and transaction logs only.')}</p>
                    </div>
                    <ExportScopeWizard crops={crops} accent="finance" onExport={(scope) => handleExportPDF('finance', scope)} />
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">🌾 Seasonal Harvest Yield Report (Production)</p>
                      <p className="text-[11px] text-slate-500">Variety, field and yield kg only — no money.</p>
                    </div>
                    <ExportScopeWizard crops={crops} accent="yield" onExport={(scope) => handleExportPDF('yield', scope)} />
                    <YearlyArchivePanel
                      isOwner={userRole === 'admin'}
                      apiBase="/api"
                      collections={[{ value: 'finance', label: 'Finance records' }]}
                      getHeaders={() => {
                        let token = ''; let farmId = '';
                        try { token = localStorage.getItem('token') || ''; farmId = localStorage.getItem('muf_active_farm_agri') || ''; } catch { /* storage unavailable */ }
                        return { ...(token ? { Authorization: `Bearer ${token}`, 'X-Access-Token': token } : {}), ...(farmId ? { 'X-Farm-Id': farmId } : {}) };
                      }}
                    />
                  </div>
                </MufAdminReports>
              )}

              {/* ─── TAB: BACKUP ─── */}
              {activeTab === 'backup' && (
                <div className="space-y-6 animate-fade-in">
                  {isAdmin ? (
                    <>
                      <MufAdminCard icon={<Database className="w-5 h-5" />} title={L('Manual Backup')} subtitle={L('Download or share your farm data')}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <MufAdminButton variant="primary" size="md" icon={<Download className="w-5 h-5" />}
                            onClick={handleExportBackup}
                            className="flex-col h-24 py-4"
                          >
                            <span>{L('Download Backup')}</span>
                            <span className="text-[10px] font-normal opacity-80">{L('All data as .json file')}</span>
                          </MufAdminButton>
                          <MufAdminButton variant="success" size="md"
                            icon={<span className="text-xl">💬</span>}
                            onClick={handleShareBackup}
                            className="flex-col h-24 py-4"
                          >
                            <span>{L('Send via WhatsApp')}</span>
                            <span className="text-[10px] font-normal opacity-80">{L('Share backup file to a chat')}</span>
                          </MufAdminButton>
                        </div>
                      </MufAdminCard>

                      <MufAdminCard icon={<Upload className="w-5 h-5" />} title={L('Restore from File')} subtitle={L('Upload a .json backup to restore data')}>
                        <div className="relative">
                          <input type="file" accept=".json" onChange={handleImportBackup} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                          <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-6 flex flex-col items-center gap-2 hover:border-farm-500 hover:bg-farm-50/30 dark:hover:bg-farm-900/10 transition cursor-pointer">
                            <Upload className="w-8 h-8 text-purple-600" />
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{L('Choose JSON file...')}</p>
                            <p className="text-[10px] text-red-500 font-bold">⚠️ This will overwrite all current data</p>
                          </div>
                        </div>
                      </MufAdminCard>

                      <MufAdminCard icon={<RefreshCw className="w-5 h-5" />} title={L('Automatic Monthly Backup')} subtitle={L('System creates a backup once per month')}>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-3">
                          {autoBackup?.exists
                            ? `Last auto backup: ${autoBackup.name}`
                            : 'No auto backup yet.'}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <MufAdminButton variant="warning" size="sm" icon={<Upload className="w-3.5 h-3.5" />}
                            disabled={!autoBackup?.exists}
                            onClick={async () => {
                              const ok = await confirm({
                                title: L('Restore last automatic monthly backup'),
                                message: `Restore ${autoBackup?.name || 'the last backup'}? Current records will be replaced (user accounts are kept).`,
                                tone: 'warning',
                                confirmLabel: L('Restore snapshot'),
                                cancelLabel: L('Cancel')
                              });
                              if (!ok) return;
                              try {
                                const res = await api.restoreAutoBackup();
                                showAlert(`Restored ${res.data.name || 'automatic monthly backup'}.`);
                                refreshData();
                              } catch (err) {
                                showAlert(err.response?.data?.detail || 'Automatic restore failed.', true);
                              }
                            }}
                          >
                            {L('Restore from it')}
                          </MufAdminButton>
                        </div>
                      </MufAdminCard>
                    </>
                  ) : (
                    <div className="p-6 text-slate-500 flex items-center gap-3">
                      <ShieldCheck size={20} />
                      <p className="text-xs font-medium">{L('Backups are available to admins only.')}</p>
                    </div>
                  )}
                </div>
              )}

        </MufAdminShell>
      )}
    </AnimatePresence>
  );
}
