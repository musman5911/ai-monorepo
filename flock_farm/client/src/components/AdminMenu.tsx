import React, { useState, useEffect, useRef } from 'react';
import { mufL } from '../muf/data/muf-urdu';
import {
  Shield, LogOut, X, AlertCircle, Check, Settings,
  Languages, Save, RotateCcw, AlertTriangle, RefreshCw,
  FileSpreadsheet, Download, Upload, Users, UserRound,
  Database, FileText, Send, Loader2, MessageCircle, Mail, Globe2,
} from 'lucide-react';
import { AnimatePresence, motion } from '../muf/core/muf-motion';
import { Lang, GlobalSettings, Bird, OtherExpense, FeedRecord, EggProduction, VaccinationRecord, Customer, CustomerSale, IncubationRecord, DailyChecklistEntry, DiaryEntry, LaborWorker, LaborAttendanceEntry, LaborAdvanceEntry } from '../types';
import {
  logout as apiLogout, changePassword, changePasswordWithCode, requestProfileCode, AuthUser, updateMe, getToken,
  getTodaySummary, sendSummaryEmail, exportAllBatchData,
  getAutoBackup, runAutoBackup, restoreAutoBackup,
  telegramStatus, telegramLinkCode, telegramUnlink, telegramSettings, telegramSaveSettings, telegramSendSummary, listUsers,
  createUser, updateUser, deleteUser,
} from '../api';
import AvatarUploader from '../muf/ui/muf-avatar';
import MyFarmsPanel from './MyFarmsPanel';
import TelegramPanel from '../muf/ui/muf-telegram-panel';
import { shareBackupFile } from '../utils/share';
import ExportCenter from './ExportCenter';
import { shareViaWhatsApp } from '../utils/share';
import { todayStr as localTodayStr } from '../utils/calculations';
import UserManagement from './UserManagement';
import ModalPortal from '../muf/core/muf-portal';
import MufAdminShell from '../muf/admin/muf-admin-shell';
import MufAdminCard from '../muf/admin/muf-admin-card';
import MufAdminButton from '../muf/admin/muf-admin-button';
import MufAdminUsers from '../muf/admin/muf-admin-users';
import MufAdminReports from '../muf/admin/muf-admin-reports';
import YearlyArchivePanel from './YearlyArchivePanel';
import MufAdminGeneral from '../muf/admin/muf-admin-general';
import { getFarmLocation, saveFarmLocation } from '../api';
import { useConfirm, notify } from '../muf/core/muf-confirm';
import { useBodyScrollLock } from '../muf/core/muf-scroll-lock';
import {
  exportEggPDF,
  exportExpensePDF,
  exportMonthlySummaryPDF,
  exportEggExcel,
  exportExpenseExcel,
  buildBackup, downloadBackupFile,
  parseBackupFile,
} from '../reportExport';
import type { FlockFarmBackup } from '../reportExport';
import { mufToday } from '../muf/data/muf-date';

interface AdminMenuProps {
  open: boolean;
  onClose: () => void;
  currentUser: AuthUser;
  onLoginStateChange: (user: AuthUser | null) => void;
  lang: Lang;
  onToggleLang: () => void;
  settings: GlobalSettings;
  birds: Bird[];
  otherExpenses: OtherExpense[];
  feedRecords: FeedRecord[];
  eggProduction: EggProduction[];
  vaccinations: VaccinationRecord[];
  customers: Customer[];
  customerSales: CustomerSale[];
  incubation: IncubationRecord[];
  checklist: DailyChecklistEntry[];
  diary: DiaryEntry[];
  laborers: LaborWorker[];
  laborAttendance: LaborAttendanceEntry[];
  laborAdvances: LaborAdvanceEntry[];
  onSaveSettings: (s: GlobalSettings) => void;
  onResetDatabase: () => void | Promise<void>;
  onClearDatabase: () => void | Promise<void>;
  onRestoreBackup: (data: FlockFarmBackup) => void | Promise<void>;
  onUserUpdate?: (u: AuthUser) => void;
}

type Section = 'general' | 'users' | 'farms' | 'reports' | 'backup' | 'danger' | 'telegram';
const ADMIN_TABS: { id: Section; icon: React.ElementType; en: string }[] = [
  { id: 'general',  icon: Settings,    en: 'General' },
  { id: 'farms',    icon: Globe2,      en: 'My Farms' },
  { id: 'users',    icon: Users,       en: 'Users' },
  { id: 'reports',  icon: FileText,    en: 'Reports' },
  { id: 'backup',   icon: Database,    en: 'Backup' },
  { id: 'telegram', icon: Send,        en: 'Telegram' },
  { id: 'danger',   icon: AlertTriangle, en: 'Database' },
];

export default function AdminMenu(props: AdminMenuProps) {
  const confirmAction = useConfirm();
  const {
    open, onClose, currentUser, onLoginStateChange,
    lang, onToggleLang,
    settings, birds, otherExpenses, feedRecords, eggProduction,
    vaccinations, customers, customerSales, incubation, checklist, diary,
    laborers, laborAttendance, laborAdvances,
    onSaveSettings, onResetDatabase, onClearDatabase, onRestoreBackup, onUserUpdate,
  } = props;

  const [section, setSection] = useState<Section>('general');
  const [eggPrice, setEggPrice] = useState(settings.defaultPricePerEgg.toString());
  const [vacInterval, setVacInterval] = useState(settings.vaccinationIntervalDays.toString());
  // Farm location
  const [farmLocInput, setFarmLocInput] = useState('');
  const [farmLocCurrent, setFarmLocCurrent] = useState<{ lat?: number; lon?: number; city?: string } | null>(null);
  const [farmLocMsg, setFarmLocMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    getFarmLocation().then((loc: any) => {
      if (loc.lat != null && loc.lon != null) {
        setFarmLocCurrent({ lat: loc.lat, lon: loc.lon, city: loc.city });
        if (loc.raw_dms) setFarmLocInput(loc.raw_dms);
      }
    }).catch(() => {});
  }, []);

  const handleSaveLocation = async () => {
    setFarmLocMsg(null);
    const s = farmLocInput.trim();
    const dec = s.match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
    if (!dec) { setFarmLocMsg({ type: 'error', msg: 'Use "lat, lon" format, e.g. 33.9943, 72.9106' }); return; }
    const lat = parseFloat(dec[1]); const lon = parseFloat(dec[2]);
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) { setFarmLocMsg({ type: 'error', msg: 'Invalid coordinates.' }); return; }
    try {
      let city = '';
      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
        const geo = await geoRes.json();
        city = geo.address?.city || geo.address?.town || geo.address?.village || '';
      } catch { /* */ }
      await saveFarmLocation({ raw_dms: s, lat, lon, city });
      setFarmLocCurrent({ lat, lon, city });
      setFarmLocMsg({ type: 'success', msg: city ? `Location set to ${city} (${lat.toFixed(4)}, ${lon.toFixed(4)}). Weather updates on next load.` : `Location saved. Weather updates on next load.` });
    } catch { setFarmLocMsg({ type: 'error', msg: 'Failed to save location.' }); }
  };
  const [myEmail, setMyEmail] = useState(currentUser?.email || '');
  // Emailed verification codes
  const [emailCode, setEmailCode] = useState('');
  const [sendingEmailCode, setSendingEmailCode] = useState(false);
  const [pwCode, setPwCode] = useState('');
  const [sendingPwCode, setSendingPwCode] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [emailMsg, setEmailMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [users, setUsers] = useState<any[]>([]);

  // Monthly auto-backup state
  const [autoBackup, setAutoBackup] = useState<{ available: boolean; name?: string; createdAt?: string; emailedTo?: string | null; emailedAt?: string | null; payload?: object } | null>(null);
  const [autoBackupBusy, setAutoBackupBusy] = useState(false);
  const backupToastShown = useRef(false);

  useEffect(() => {
    if (section === 'backup' && autoBackup?.emailedTo && !backupToastShown.current) {
      backupToastShown.current = true;
      notify(
        L('Backup sent to {emailedTo} on {v1}', { emailedTo: autoBackup.emailedTo, v1: String(autoBackup.emailedAt || '').slice(0, 10) }),
        'success'
      );
    }
  }, [section, autoBackup, lang]);
  useEffect(() => {
    if (!open) return;
    getAutoBackup().then(setAutoBackup).catch(() => setAutoBackup({ available: false }));
  }, [open]);
  const [pwSubmitting, setPwSubmitting] = useState(false);

  // Fetch users when tab opens
  useEffect(() => {
    if (!open) return;
    listUsers().then(setUsers).catch(() => {});
  }, [open]);

  // ----- Share Today's Summary (email / WhatsApp) -----
  const summaryDateStr = localTodayStr();
  const [summaryText, setSummaryText] = useState<string>('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryLoadErr, setSummaryLoadErr] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [summaryMsg, setSummaryMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (open) {
      setSection('general');
      setEggPrice(settings.defaultPricePerEgg.toString());
      setVacInterval(settings.vaccinationIntervalDays.toString());
      setMyEmail(currentUser?.email || '');
      setSettingsSaved(false);
      setCurPw(''); setNewPw(''); setPwMsg(null);
      setSummaryText(''); setSummaryLoadErr(false); setSummaryMsg(null);
    }
  }, [open, settings, currentUser]);

  // Lazily load today's summary the first time the Reports tab is opened.
  useEffect(() => {
    if (!open || section !== 'reports' || summaryText || summaryLoading) return;
    setSummaryLoading(true);
    setSummaryLoadErr(false);
    getTodaySummary()
      .then((d) => { if (d?.text) setSummaryText(d.text); })
      .catch(() => setSummaryLoadErr(true))
      .finally(() => setSummaryLoading(false));
  }, [open, section]);

  const handleSendSummaryEmail = async () => {
    setSendingEmail(true);
    setSummaryMsg(null);
    try {
      const { recipients } = await sendSummaryEmail();
      setSummaryMsg({
        type: 'ok',
        text: recipients.length
          ? `Summary emailed to ${recipients.length} recipient${recipients.length === 1 ? '' : 's'}: ${recipients.join(', ')}`
          : 'No recipient emails configured — add one in General.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send email. Check SMTP settings.';
      setSummaryMsg({ type: 'err', text: message });
    } finally {
      setSendingEmail(false);
    }
  };

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [open, onClose]);

  const handleLogout = async () => {
    await apiLogout();
    onLoginStateChange(null);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(eggPrice);
    const interval = parseInt(vacInterval);
    if (!price || price <= 0) return notify(L('Enter a valid egg price'), 'error');
    if (!interval || interval <= 0) return notify(L('Enter a valid interval'), 'error');
    onSaveSettings({ ...settings, defaultPricePerEgg: price, vaccinationIntervalDays: interval });
    // Save email if changed — an account with a
    // registered email must confirm the change with an emailed code.
    const cleanedEmail = myEmail.trim().toLowerCase();
    if (cleanedEmail !== (currentUser?.email || '')) {
      if (currentUser?.email && !emailCode.trim()) {
        notify(L('Verification code is required to change your email. Use "Send Code" first.'), 'error');
        return;
      }
      try {
        await updateMe({ email: cleanedEmail || '', code: emailCode.trim() || undefined });
        setEmailCode('');
        // Refresh the user in parent
        if (onUserUpdate && currentUser) onUserUpdate({ ...currentUser, email: cleanedEmail || null });
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Failed to update email', 'error');
        return;
      }
    }
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  };

  // Emails the signed-in admin a 6-digit authorization code (10 minutes).
  const sendProfileCode = async (target: 'password' | 'email') => {
    const setBusy = target === 'password' ? setSendingPwCode : setSendingEmailCode;
    setBusy(true);
    try {
      await requestProfileCode();
      notify(L('Verification authorization code has been successfully sent to your email.'), 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to deliver code.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleChangePw = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setPwMsg(null);
    if (!newPw) return setPwMsg({ type: 'err', text: L('New password is required.') });
    if (newPw.length < 8) return setPwMsg({ type: 'err', text: L('New password must be at least 8 characters.') });
    if (!curPw && !pwCode.trim()) return setPwMsg({ type: 'err', text: L('Either your current password or an emailed verification code is required.') });
    setPwSubmitting(true);
    try {
      if (pwCode.trim()) {
        await changePasswordWithCode(pwCode.trim(), newPw);
      } else {
        await changePassword(curPw, newPw);
      }
      setCurPw(''); setNewPw(''); setPwCode('');
      setPwMsg({ type: 'ok', text: L('Password changed.') });
    } catch (err) {
      setPwMsg({ type: 'err', text: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setPwSubmitting(false);
    }
  };

  const handleUpdateEmail = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setEmailMsg(null);
    const cleanedEmail = myEmail.trim().toLowerCase();
    if (cleanedEmail !== (currentUser?.email || '')) {
      if (currentUser?.email && !emailCode.trim()) {
        return setEmailMsg({ type: 'err', text: L('Verification code is required to change your email.') });
      }
      try {
        await updateMe({ email: cleanedEmail || '', code: emailCode.trim() || undefined });
        setEmailCode('');
        setEmailMsg({ type: 'ok', text: L('Email updated.') });
      } catch (err) {
        setEmailMsg({ type: 'err', text: err instanceof Error ? err.message : 'Failed to update email' });
      }
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const backup = await parseBackupFile(file);
      const ok = await confirmAction({
        title: L('Restore Backup'),
        message: L('Restore backup from {date}?', { date: backup.exportedAt?.slice(0, 10) || 'this file' }),
        confirmLabel: L('Restore'),
        cancelLabel: L('Cancel'),
        tone: 'warning',
      });
      if (ok) {
        await onRestoreBackup(backup);
        notify(L('Backup restored.'), 'success');
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not read backup file.', 'error');
    } finally {
      e.target.value = '';
    }
  };

  if (!open) return null;

  const L = (en: string, urOrVars?: string | Record<string, string | number | null>) => mufL(lang, en, urOrVars);

  return (
    <AnimatePresence>
      {open && (
        <MufAdminShell
          open={true}
          onClose={onClose}
          title={L('Settings & Admin Hub')}
          subtitle={`${currentUser?.username || ''} · Control Panel`}
          icon={<Shield className="w-5 h-5" />}
          sections={ADMIN_TABS.map(t => ({ id: t.id, label: mufL(lang, t.en), icon: t.icon }))}
          activeSection={section}
          onSectionChange={(id) => setSection(id as Section)}
          headerActions={
            <>
              <motion.button whileTap={{ scale: 0.9 }} whileHover={{ rotate: -12 }} onClick={handleLogout} title={L('Sign out')}
                className="w-9 h-9 rounded-full hover:bg-rose-100 dark:hover:bg-rose-900/30 flex items-center justify-center text-rose-500 dark:text-rose-400 transition">
                <LogOut className="w-4 h-4" />
              </motion.button>
              <span className="w-px h-5 bg-[#e6e6de] dark:bg-[#203528] mx-0.5 sm:mx-1" />
            </>
          }
        >
            {section === 'general' && (
              <MufAdminGeneral
                username={currentUser?.username || ''}
                email={currentUser?.email}
                avatarSlot={
                  <AvatarUploader
                    lang={lang}
                    avatar={currentUser?.avatarBase64 || ''}
                    fallbackLetter={(currentUser?.username || 'A')[0]}
                    onSave={async (base64) => {
                      const updated = await updateMe({ avatarBase64: base64 });
                      onUserUpdate?.(updated);
                    }}
                    onRemove={async () => {
                      const updated = await updateMe({ avatarBase64: 'REMOVE_AVATAR' });
                      onUserUpdate?.(updated);
                    }}
                  />
                }
                newPassword={newPw}
                currentPassword={curPw}
                pwCode={pwCode}
                pwMsg={pwMsg ? { type: pwMsg.type === 'ok' ? 'success' : 'error', msg: pwMsg.text } : null}
                sendingPwCode={sendingPwCode}
                passwordBusy={pwSubmitting}
                onNewPasswordChange={setNewPw}
                onCurrentPasswordChange={setCurPw}
                onPwCodeChange={setPwCode}
                onSendPwCode={() => sendProfileCode('password')}
                onSubmitPassword={(e) => { e.preventDefault(); handleChangePw(); }}
                newEmail={myEmail}
                emailCode={emailCode}
                emailMsg={emailMsg ? { type: emailMsg.type === 'ok' ? 'success' : 'error', msg: emailMsg.text } : null}
                sendingEmailCode={sendingEmailCode}
                emailBusy={false}
                currentEmail={currentUser?.email}
                onNewEmailChange={setMyEmail}
                onEmailCodeChange={setEmailCode}
                onSendEmailCode={() => sendProfileCode('email')}
                onSubmitEmail={(e) => { e.preventDefault(); handleUpdateEmail(); }}
              >
                <MufAdminCard icon={<Settings className="w-5 h-5" />} title={L('Farm Settings')} subtitle={L('Egg price, vaccination interval')}>
                  {settingsSaved && (
                    <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-lg text-xs flex items-center gap-2 mb-3">
                      <Check className="w-4 h-4" /> {L('Saved.')}
                    </div>
                  )}
                  <form onSubmit={handleSaveSettings} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-2xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                          {L('Default Price Per Egg (Rs)')}
                        </label>
                        <input type="number" step="0.1" min="1" required value={eggPrice}
                          onChange={(e) => setEggPrice(e.target.value)}
                          className="w-full text-sm px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-xl font-mono focus:outline-none focus:border-emerald-400" />
                      </div>
                      <div>
                        <label className="block text-2xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                          {L('Vaccination Interval (Days)')}
                        </label>
                        <input type="number" min="1" required value={vacInterval}
                          onChange={(e) => setVacInterval(e.target.value)}
                          className="w-full text-sm px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-xl font-mono focus:outline-none focus:border-emerald-400" />
                      </div>
                    </div>
                    <button type="submit"
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700">
                      <Save className="w-4 h-4" />{L('Save Configuration')}
                    </button>
                  </form>
                </MufAdminCard>

                {/* Farm Location (weather widget) */}
                <MufAdminCard icon={<Globe2 className="w-5 h-5" />} title={L('Farm Location')} subtitle={L('Set your farm coordinates for live weather')}>
                  <div className="space-y-3">
                    {farmLocCurrent && (
                      <p className="text-xs text-slate-500">
                        Current: <span className="font-semibold">{farmLocCurrent.city || 'Unknown'}</span> ({farmLocCurrent.lat?.toFixed(4)}, {farmLocCurrent.lon?.toFixed(4)})
                      </p>
                    )}
                    {farmLocMsg && (
                      <div className={`p-3 rounded-lg text-xs border font-semibold ${farmLocMsg.type === 'success' ? 'bg-farm-50 border-farm-300 text-farm-800' : 'bg-red-50 border-red-300 text-red-800'}`}>
                        {farmLocMsg.msg}
                      </div>
                    )}
                    <input
                      value={farmLocInput}
                      onChange={(e) => setFarmLocInput(e.target.value)}
                      placeholder="33.9943, 72.9106"
                      className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-farm-500"
                    />
                    <p className="text-[10px] text-slate-400">{L('Enter latitude, longitude (decimal degrees). City is auto-detected.')}</p>
                    <MufAdminButton variant="secondary" size="md" onClick={handleSaveLocation}>{L('Save Location')}</MufAdminButton>
                  </div>
                </MufAdminCard>
              </MufAdminGeneral>
            )}

            {section === 'users' && currentUser && (
              <MufAdminUsers
                users={users.map(u => ({ _id: u._id || u.username, username: u.username, role: u.role, email: u.email, displayName: u.displayName, active: u.active !== false }))}
                currentUsername={currentUser.username}
                minPasswordLength={8}
                onCreate={async (data) => {
                  await createUser({ username: data.username, password: data.password, role: data.role as any, displayName: data.displayName, email: data.email });
                }}
                onEditProfile={async (user, data) => {
                  await updateUser(user._id, { username: data.username, password: data.password || undefined, adminPassword: data.adminPassword } as any);
                }}
                onDelete={async (user) => {
                  const ok = await confirmAction({
                    title: L('Delete user'),
                    message: L('Delete {v0}? This cannot be undone.', { v0: user.username }),
                    confirmLabel: L('Delete'),
                    tone: 'danger',
                  });
                  if (ok) await deleteUser(user._id);
                }}
              />
            )}

            {section === 'farms' && <MyFarmsPanel />}
            {section === 'telegram' && (
            <TelegramPanel
              lang={lang}
              adapter={{
                status: () => telegramStatus(),
                listUsers: () => listUsers(),
                listWorkers: async () => {
                  const r = await fetch('/api/data/laborers', { headers: { Authorization: `Bearer ${getToken() || ''}` } });
                  const dd = await r.json();
                  return Array.isArray(dd?.value) ? dd.value : [];
                },
                settings: () => telegramSettings(),
                saveSettings: (s) => telegramSaveSettings(s),
                linkCode: (o) => telegramLinkCode(o),
                unlink: (c) => telegramUnlink(c),
                sendSummary: () => telegramSendSummary(),
              }}
              blurbEn={'Workers send "anday 320", "kharcha 500 chara", "hazri" or "hisab" — entries land in the app automatically.'}
              alarm={{ titleEn: 'Evening summary & egg alarm', labelEn: 'Alarm when eggs fall', defaultPct: '20' }}
              cronPath="/api/telegram/cron?key=CRON_SECRET"
            />
          )}

            {section === 'reports' && (
              <MufAdminReports
                reportButtons={[
                  { label: L('Egg Report (PDF)'), onClick: () => exportEggPDF(eggProduction, settings) },
                  { label: L('Expense Report (PDF)'), onClick: () => exportExpensePDF(birds, otherExpenses, feedRecords, vaccinations) },
                  { label: L('Monthly Summary (PDF)'), onClick: () => exportMonthlySummaryPDF(birds, otherExpenses, feedRecords, eggProduction, vaccinations, customerSales, settings) },
                  { label: L('Egg CSV'), onClick: () => exportEggExcel(eggProduction, settings), light: true },
                  { label: L('Expense CSV'), onClick: () => exportExpenseExcel(birds, otherExpenses, feedRecords, vaccinations), light: true },
                ]}
              >
                <ExportCenter
                  lang={lang}
                  birds={birds}
                  otherExpenses={otherExpenses}
                  feedRecords={feedRecords}
                  eggProduction={eggProduction}
                  vaccinations={vaccinations}
                  customerSales={customerSales}
                  settings={settings}
                />
                <YearlyArchivePanel
                  isOwner={currentUser?.farmRole === 'owner' || currentUser?.role === 'admin'}
                  apiBase="/api"
                  collections={[
                    { value: 'batchFeedLogs', label: 'Batch feed logs' },
                    { value: 'batchMortalityLogs', label: 'Batch mortality logs' },
                    { value: 'batchExpenseLogs', label: 'Batch expense logs' },
                    { value: 'batchSaleLogs', label: 'Batch sale logs' },
                    { value: 'batchWeightLogs', label: 'Batch weight logs' },
                    { value: 'batchEggLogs', label: 'Batch egg logs' },
                    { value: 'batchVaccinationLogs', label: 'Batch vaccination logs' },
                  ]}
                  getHeaders={() => {
                    let token = ''; let farmId = '';
                    try { token = localStorage.getItem('flockfarm_token') || ''; farmId = localStorage.getItem('muf_active_farm_flock') || ''; } catch { /* storage unavailable */ }
                    return { ...(token ? { Authorization: `Bearer ${token}`, 'X-Auth-Token': token } : {}), ...(farmId ? { 'X-Farm-Id': farmId } : {}) };
                  }}
                />
              </MufAdminReports>
            )}

            {section === 'backup' && (
              <div className="space-y-6">
                <MufAdminCard icon={<Database className="w-5 h-5" />} title={L('Manual Backup')} subtitle={L('Download or share your farm data')}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <MufAdminButton variant="primary" size="md" icon={<Download className="w-5 h-5" />}
                      onClick={async () => {
                        try {
                          const batchData = await exportAllBatchData();
                          downloadBackupFile(buildBackup(birds, otherExpenses, feedRecords, eggProduction, settings, vaccinations, customers, customerSales, incubation, checklist, diary, batchData, laborers, laborAttendance, laborAdvances));
                        } catch (err) {
                          notify(err instanceof Error ? err.message : 'Failed to export batch data', 'error');
                        }
                      }}
                      className="flex-col h-24 py-4"
                    >
                      <span>{L('Download Backup')}</span>
                      <span className="text-[10px] font-normal opacity-80">{L('All data as .json file')}</span>
                    </MufAdminButton>
                    <MufAdminButton variant="success" size="md"
                      icon={<span className="text-xl">💬</span>}
                      onClick={async () => {
                        try {
                          const batchData = await exportAllBatchData();
                          const backup = buildBackup(birds, otherExpenses, feedRecords, eggProduction, settings, vaccinations, customers, customerSales, incubation, checklist, diary, batchData, laborers, laborAttendance, laborAdvances);
                          const result = await shareBackupFile(`usman-flock-farm-backup-${mufToday()}.json`, JSON.stringify(backup, null, 2));
                          if (result === 'shared') notify(L('Backup shared'), 'success');
                          else if (result === 'fallback') notify(L('Backup downloaded — attach the file in WhatsApp'), 'success');
                        } catch (err) {
                          notify(err instanceof Error ? err.message : 'Failed to share backup', 'error');
                        }
                      }}
                      className="flex-col h-24 py-4"
                    >
                      <span>{L('Send via WhatsApp')}</span>
                      <span className="text-[10px] font-normal opacity-80">{L('Share backup file to a chat')}</span>
                    </MufAdminButton>
                  </div>
                </MufAdminCard>

                <MufAdminCard icon={<Upload className="w-5 h-5" />} title={L('Restore from File')} subtitle={L('Upload a .json backup to restore data')}>
                  <div className="relative">
                    <input ref={restoreInputRef} type="file" accept="application/json" onChange={handleRestore} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-6 flex flex-col items-center gap-2 hover:border-farm-500 hover:bg-farm-50/30 dark:hover:bg-farm-900/10 transition cursor-pointer">
                      <Upload className="w-8 h-8 text-purple-600" />
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{L('Choose JSON file...')}</p>
                      <p className="text-[10px] text-red-500 font-bold">⚠️ {L('This will overwrite all current data')}</p>
                    </div>
                  </div>
                </MufAdminCard>

                <MufAdminCard icon={<RefreshCw className="w-5 h-5" />} title={L('Automatic Monthly Backup')} subtitle={L('System creates a backup once per month')}>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-3">
                    {autoBackup?.available
                      ? `${L('Last auto backup:')} ${autoBackup.name}`
                      : L('No auto backup yet.')}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <MufAdminButton variant="primary" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />}
                      disabled={autoBackupBusy}
                      onClick={async () => {
                        setAutoBackupBusy(true);
                        try {
                          await runAutoBackup();
                          setAutoBackup(await getAutoBackup());
                        } catch (err) {
                          notify(err instanceof Error ? err.message : 'Auto-backup failed', 'error');
                        } finally { setAutoBackupBusy(false); }
                      }}
                    >
                      {L('Back up now')}
                    </MufAdminButton>
                    <MufAdminButton variant="secondary" size="sm" icon={<Download className="w-3.5 h-3.5" />}
                      disabled={autoBackupBusy || !autoBackup?.available}
                      onClick={() => {
                        if (!autoBackup?.payload) return;
                        const blob = new Blob([JSON.stringify(autoBackup.payload, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${autoBackup.name || 'auto-backup'}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      {L('Download')}
                    </MufAdminButton>
                    <MufAdminButton variant="warning" size="sm" icon={<Upload className="w-3.5 h-3.5" />}
                      disabled={autoBackupBusy || !autoBackup?.available}
                      onClick={async () => {
                        const ok = await confirmAction({
                          title: L('Restore from auto-backup'),
                          message: L('Restore {v0}? Current data will be replaced.', { v0: autoBackup?.name }),
                          confirmLabel: L('Restore'),
                          cancelLabel: L('Cancel'),
                          tone: 'warning',
                        });
                        if (!ok) return;
                        setAutoBackupBusy(true);
                        try {
                          await restoreAutoBackup();
                          notify(L('Restored. The app will reload fresh data.'), 'success');
                          window.location.reload();
                        } catch (err) {
                          notify(err instanceof Error ? err.message : 'Restore failed', 'error');
                        } finally { setAutoBackupBusy(false); }
                      }}
                    >
                      {L('Restore from it')}
                    </MufAdminButton>
                  </div>
                </MufAdminCard>
              </div>
            )}

            {section === 'danger' && (
              <div className="max-w-xl mx-auto space-y-3">
                <h3 className="text-sm font-bold font-display text-slate-800 dark:text-slate-100">
                  {L('Database Utilities')}
                </h3>
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900 rounded-xl text-red-800 dark:text-red-300 space-y-1 text-xs">
                  <p className="font-bold flex items-center gap-1"><AlertTriangle className="w-4 h-4" />{L('Caution Area')}</p>
                  <p>{L('These actions overwrite data. Backup first!')}</p>
                </div>
                <div className="space-y-2">
                  <button onClick={async () => {
                    const ok = await confirmAction({
                      title: L('Restore Seed Records'),
                      message: L('Restore default seed dataset?'),
                      confirmLabel: L('Restore'),
                      cancelLabel: L('Cancel'),
                      tone: 'warning',
                    });
                    if (ok) {
                      await onResetDatabase();
                      notify(L('Database restored.'), 'success');
                    }
                  }}
                    className="w-full py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl flex items-center justify-center gap-2">
                    <RotateCcw className="w-4 h-4" />{L('Restore Seed Records')}
                  </button>
                  <button onClick={async () => {
                    const ok = await confirmAction({
                      title: L('Wipe Database Fresh'),
                      message: L('PERMANENTLY delete all records?'),
                      confirmLabel: L('Delete All'),
                      cancelLabel: L('Cancel'),
                      tone: 'danger',
                    });
                    if (ok) {
                      await onClearDatabase();
                      notify(L('Database wiped.'), 'success');
                    }
                  }}
                    className="w-full py-2 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 font-semibold text-xs rounded-xl flex items-center justify-center gap-2">
                    <AlertTriangle className="w-4 h-4" />{L('Wipe Database Fresh')}
                  </button>
                </div>
              </div>
            )}
        </MufAdminShell>
      )}
    </AnimatePresence>
  );
}

function ReportBtn({ onClick, label, light }: { onClick: () => void; label: string; light?: boolean }) {
  return (
    <button onClick={onClick}
      className={`flex items-center justify-center gap-2 px-4 py-2.5 font-semibold text-xs rounded-xl transition ${
        light
          ? 'bg-white dark:bg-slate-800 hover:bg-farm-50 dark:hover:bg-slate-700 border border-farm-200 dark:border-farm-800 text-farm-700 dark:text-farm-300'
          : 'bg-farm-600 hover:bg-farm-700 text-white'
      }`}>
      <FileSpreadsheet className="w-4 h-4" />{label}
    </button>
  );
}
