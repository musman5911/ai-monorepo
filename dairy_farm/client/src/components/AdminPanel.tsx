import { useEffect, useRef, useState } from 'react';
import { L, getLang } from '../i18n';
import type { ChangeEvent, FormEvent } from 'react';
import {
  Shield, Users, Database, Send,
  Download, Upload, History, Baby, Settings,
  Check, AlertCircle,
  FileText, RefreshCw, Globe2,
} from 'lucide-react';
import AvatarUploader from '../muf-avatar';
import { useConfirm, usePromptInput, notify } from '../muf-confirm';
import ExportCenter from './ExportCenter';
import MyFarmsPanel from './MyFarmsPanel';
import BuyerKhata from './BuyerKhata';
import { shareBackupFile, shareViaWhatsAppTo } from '../utils/share';
import TelegramPanel from '../muf-telegram-panel';
import MufAdminShell from '../muf-admin-shell';
import MufAdminCard from '../muf-admin-card';
import MufAdminButton from '../muf-admin-button';
import MufAdminUsers from '../muf-admin-users';
import MufAdminReports from '../muf-admin-reports';
import MufAdminGeneral from '../muf-admin-general';
import { api } from '../api';
import type { AuthUser, Buyer, Rate, RateHistory, UserRole } from '../types';
import { fmtPKR } from '../utils/format';
import {mufToday} from '../muf-date';

interface Props {
  username: string | null;
  onClose: () => void;
}

type Section = 'profile' | 'users' | 'buyers' | 'reports' | 'backup' | 'farms' | 'telegram';

type Status = { type: 'success' | 'error'; msg: string } | null;

const inputClass = 'w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-950 outline-none focus:border-farm-500 focus:ring-2 focus:ring-farm-500/20 transition';
const MIN_PASSWORD_LENGTH = 8;

function parseCoordinates(input: string): { lat: number; lon: number } | null {
  if (!input) return null;
  const s = input.trim();
  const dec = s.match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (dec) {
    const lat = parseFloat(dec[1]); const lon = parseFloat(dec[2]);
    if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) return { lat, lon };
  }
  return null;
}

export default function AdminPanel({ username, onClose }: Props) {
  const confirmAction = useConfirm();
  const promptInput = usePromptInput();
  const [section, setSection] = useState<Section>('profile');
  const [status, setStatus] = useState<Status>(null);

  // Farm location state
  const [farmLocInput, setFarmLocInput] = useState('');
  const [farmLocCurrent, setFarmLocCurrent] = useState<{ lat?: number; lon?: number; city?: string } | null>(null);
  const [farmLocMsg, setFarmLocMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    api.getFarmLocation().then((loc: any) => {
      if (loc.lat != null && loc.lon != null) {
        setFarmLocCurrent({ lat: loc.lat, lon: loc.lon, city: loc.city });
        if (loc.raw_dms) setFarmLocInput(loc.raw_dms);
      }
    }).catch(() => {});
  }, []);

  const handleSaveLocation = async () => {
    setFarmLocMsg(null);
    const parsed = parseCoordinates(farmLocInput);
    if (!parsed) { setFarmLocMsg({ type: 'error', msg: 'Could not parse coordinates. Use "33.9943, 72.9106" or DMS format.' }); return; }
    try {
      let cityName = '';
      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${parsed.lat}&lon=${parsed.lon}&format=json`);
        const geo = await geoRes.json();
        cityName = geo.address?.city || geo.address?.town || geo.address?.village || geo.address?.suburb || geo.address?.county || '';
      } catch { /* reverse geocode failed — save without city */ }
      await api.saveFarmLocation({ raw_dms: farmLocInput.trim(), lat: parsed.lat, lon: parsed.lon, city: cityName });
      setFarmLocCurrent({ lat: parsed.lat, lon: parsed.lon, city: cityName });
      setFarmLocMsg({
        type: 'success',
        msg: cityName
          ? `Farm location set to ${cityName} (${parsed.lat.toFixed(5)}, ${parsed.lon.toFixed(5)}). Weather updates on next load.`
          : `Farm location saved (${parsed.lat.toFixed(5)}, ${parsed.lon.toFixed(5)}). Weather updates on next load.`,
      });
    } catch { setFarmLocMsg({ type: 'error', msg: 'Failed to save farm location.' }); }
  };

  // Rate state
  const [currentRate, setCurrentRate] = useState<Rate | null>(null);
  const [rateHistory, setRateHistory] = useState<RateHistory[]>([]);
  const [newRate, setNewRate] = useState('');
  const [showRateShare, setShowRateShare] = useState(false);

  // Buyer state
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [showBuyerForm, setShowBuyerForm] = useState(false);
  const [khataBuyer, setKhataBuyer] = useState<Buyer | null>(null);
  const [newBuyer, setNewBuyer] = useState({ name: '', phone: '', address: '', defaultRate: '', notes: '' });

  // User state
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  // showUserForm moved to MufAdminUsers component
  // editUserId moved to MufAdminUsers component
  // editBusy moved to MufAdminUsers component
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'worker' as UserRole, displayName: '', email: '' });

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  // Emailed verification code path
  const [pwCode, setPwCode] = useState('');
  const [pwMsg, setPwMsg] = useState<Status>(null);
  const [sendingPwCode, setSendingPwCode] = useState(false);
  // Change admin email
  const [newEmail, setNewEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailMsg, setEmailMsg] = useState<Status>(null);
  const [sendingEmailCode, setSendingEmailCode] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  // Inline per-user profile edit box

  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editAdminPw, setEditAdminPw] = useState('');


  // Email state

  // Monthly auto-backup state
  const [autoBackup, setAutoBackup] = useState<{ available: boolean; name?: string; createdAt?: string; emailedTo?: string | null; emailedAt?: string | null; payload?: object } | null>(null);
  const [autoBackupBusy, setAutoBackupBusy] = useState(false);
  const backupToastShown = useRef(false);

  useEffect(() => {
    if (section === 'backup' && autoBackup?.emailedTo && !backupToastShown.current) {
      backupToastShown.current = true;
      notify(`Backup sent to ${autoBackup.emailedTo} on ${String(autoBackup.emailedAt || '').slice(0, 10)}`, 'success');
    }
  }, [section, autoBackup]);

  // User-account changes require the admin's own password.
  async function askAdminPassword(title: string, message: string): Promise<string | null> {
    const pw = await promptInput({
      title,
      message,
      label: 'Admin password',
      type: 'password',
      confirmLabel: 'Authorize',
    });
    if (pw === null || pw === '') return null;
    return pw;
  }

  const currentUser = users.find((user) => user.username === username) || null;

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, [onClose]);

  async function loadUsers() {
    setUsersLoading(true);
    try {
      setUsers(await api.listUsers());
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  }

  async function loadAll() {
    try {
      const [rate, history, buyersList, userList, autoBk] = await Promise.all([
        api.getRate(),
        api.getRateHistory(),
        api.getBuyers(),
        api.listUsers().catch(() => []),
        api.getAutoBackup().catch(() => ({ available: false })),
      ]);
      setCurrentRate(rate);
      setRateHistory(history);
      setBuyers(buyersList);
      setUsers(userList);
      setAutoBackup(autoBk);
    } catch (err) {
      console.error('Failed to load settings data:', err);
    }
  }

  function flash(type: 'success' | 'error', msg: string) {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 3000);
  }

  async function handleUpdateRate() {
    if (!newRate) return;
    try {
      await api.updateRate(parseFloat(newRate));
      setNewRate('');
      await loadAll();
      flash('success', 'Milk rate updated');
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Could not update milk rate');
    }
  }

  async function handleAddBuyer(event: FormEvent) {
    event.preventDefault();
    try {
      await api.addBuyer({ ...newBuyer, defaultRate: newBuyer.defaultRate ? parseFloat(newBuyer.defaultRate) : undefined });
      setNewBuyer({ name: '', phone: '', address: '', defaultRate: '', notes: '' });
      setShowBuyerForm(false);
      await loadAll();
      flash('success', 'Buyer added');
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Could not add buyer');
    }
  }

  async function handleDeleteBuyer(id: string) {
    const ok = await confirmAction({
      title: 'Delete Buyer',
      message: 'Delete this buyer? This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.deleteBuyer(id);
      await loadAll();
      flash('success', 'Buyer deleted');
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Could not delete buyer');
    }
  }

  async function handleCreateUser(event: FormEvent) {
    event.preventDefault();
    try {
      await api.createUser({
        username: newUser.username,
        password: newUser.password,
        role: newUser.role,
        displayName: newUser.displayName,
        email: newUser.email,
      });
      setNewUser({ username: '', password: '', role: 'worker', displayName: '', email: '' });
      await loadUsers();
      flash('success', `${newUser.role === 'admin' ? 'Admin' : 'Worker'} account created`);
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Could not create user');
    }
  }

  async function toggleRole(user: AuthUser) {
    if (user.username === username) {
      flash('error', "You can't change your own role");
      return;
    }
    const nextRole: UserRole = user.role === 'admin' ? 'worker' : 'admin';
    const adminPassword = await askAdminPassword(
      nextRole === 'admin' ? 'Promote to Admin' : 'Change to Worker',
      nextRole === 'admin'
        ? `Enter your admin password to make "${user.username}" an administrator.`
        : `Enter your admin password to change "${user.username}" to a worker account.`
    );
    if (!adminPassword) return;
    try {
      await api.updateUser(user._id, { role: nextRole, adminPassword });
      await loadUsers();
      flash('success', `${user.username} is now ${nextRole}`);
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Could not update role');
    }
  }

  async function toggleActive(user: AuthUser) {
    if (user.username === username) {
      flash('error', "You can't deactivate yourself");
      return;
    }
    const adminPassword = await askAdminPassword(
      user.active ? 'Deactivate Account' : 'Activate Account',
      user.active
        ? `Enter your admin password to deactivate "${user.username}". They will no longer be able to sign in.`
        : `Enter your admin password to reactivate "${user.username}".`
    );
    if (!adminPassword) return;
    try {
      await api.updateUser(user._id, { active: !user.active, adminPassword });
      await loadUsers();
      flash('success', `${user.username} ${!user.active ? 'activated' : 'deactivated'}`);
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Could not update account');
    }
  }

  // startEditUser + cancelEditUser moved to MufAdminUsers component

  async function handleSaveUserEdit(user: AuthUser) {
    if (!editUsername.trim()) {
      flash('error', 'Username cannot be empty');
      return;
    }
    if (editPassword && editPassword.length < MIN_PASSWORD_LENGTH) {
      flash('error', `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (!editAdminPw) {
      flash('error', 'Enter your admin password to save these changes');
      return;
    }
    // editBusy managed by MufAdminUsers component
    try {
      const payload: { username?: string; password?: string; adminPassword: string } = { adminPassword: editAdminPw };
      if (editUsername.trim().toLowerCase() !== user.username) payload.username = editUsername.trim().toLowerCase();
      if (editPassword) payload.password = editPassword;
      await api.updateUser(user._id, payload);
      await loadUsers();
      setEditUsername('');
      setEditPassword('');
      setEditAdminPw('');
      flash('success', `Profile for '${user.username}' updated successfully!`);
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Could not update profile');
    }
  }

  // Emails the signed-in admin a 6-digit authorization code (10 minutes).
  async function sendProfileCode(target: 'password' | 'email') {
    const setMsg = target === 'password' ? setPwMsg : setEmailMsg;
    const setBusy = target === 'password' ? setSendingPwCode : setSendingEmailCode;
    setBusy(true);
    setMsg(null);
    try {
      await api.requestProfileCode();
      setMsg({ type: 'success', msg: 'Verification authorization code has been successfully sent to your email.' });
    } catch (err) {
      setMsg({ type: 'error', msg: err instanceof Error ? err.message : 'Failed to deliver code.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleChangeEmail(event: FormEvent) {
    event.preventDefault();
    setEmailMsg(null);
    if (!newEmail.trim()) {
      setEmailMsg({ type: 'error', msg: 'Email cannot be empty.' });
      return;
    }
    if (currentUser?.email && !emailCode.trim()) {
      setEmailMsg({ type: 'error', msg: 'Verification code is mandatory. Please request a code and input it.' });
      return;
    }
    setEmailBusy(true);
    try {
      await api.updateMe({ email: newEmail.trim().toLowerCase(), code: emailCode.trim() || undefined });
      setEmailMsg({ type: 'success', msg: 'Administrator profile email updated successfully!' });
      setNewEmail('');
      setEmailCode('');
      await loadUsers();
      window.dispatchEvent(new Event('dm:profile-updated'));
    } catch (err) {
      setEmailMsg({ type: 'error', msg: err instanceof Error ? err.message : 'Failed to update email.' });
    } finally {
      setEmailBusy(false);
    }
  }

  async function editUserEmail(user: AuthUser) {
    const email = await promptInput({
      title: 'Edit email',
      message: `Set email for ${user.username} (leave blank to remove).`,
      label: 'Email address',
      type: 'email',
      initialValue: user.email || '',
      confirmLabel: 'Save email',
    });
    if (email === null) return;
    const adminPassword = await askAdminPassword(
      'Update Email',
      `Enter your admin password to change the email for "${user.username}".`
    );
    if (!adminPassword) return;
    try {
      await api.updateUser(user._id, { email: email.trim().toLowerCase(), adminPassword });
      await loadUsers();
      flash('success', `Email updated for ${user.username}`);
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Could not update email');
    }
  }

  async function handleDeleteUser(user: AuthUser) {
    if (user.username === username) return;
    const ok = await confirmAction({
      title: 'Delete User',
      message: `Delete user "${user.username}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.deleteUser(user._id);
      await loadUsers();
      flash('success', 'User deleted');
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Could not delete user');
    }
  }

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault();
    setPwMsg(null);
    if (!newPassword) {
      setPwMsg({ type: 'error', msg: 'New password is required.' });
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPwMsg({ type: 'error', msg: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
      return;
    }
    if (!currentPassword && !pwCode.trim()) {
      setPwMsg({ type: 'error', msg: 'Either your current password or an emailed verification code is required.' });
      return;
    }
    setPasswordBusy(true);
    try {
      if (pwCode.trim()) {
        await api.changePasswordWithCode(pwCode.trim(), newPassword);
      } else {
        await api.changePassword(currentPassword, newPassword);
      }
      setCurrentPassword('');
      setNewPassword('');
      setPwCode('');
      setPwMsg({ type: 'success', msg: 'Administrative access password updated successfully!' });
    } catch (err) {
      setPwMsg({ type: 'error', msg: err instanceof Error ? err.message : 'Failed to update password.' });
    } finally {
      setPasswordBusy(false);
    }
  }

  async function handleBackup() {
    try {
      const data = await api.getBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dairy_backup_${mufToday()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      flash('success', 'Backup downloaded');
    } catch (err) {
      flash('error', err instanceof Error ? `Backup failed: ${err.message}` : 'Backup failed');
    }
  }

  async function handleRestore(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const ok = await confirmAction({
      title: 'Restore from Backup',
      message: `Restore all farm data from "${file.name}"? This replaces everything currently saved.`,
      confirmLabel: 'Overwrite & Restore',
      tone: 'danger',
    });
    if (!ok) return;
    const reader = new FileReader();
    reader.onload = async (loadEvent) => {
      try {
        const data = JSON.parse(String(loadEvent.target?.result || '{}'));
        await api.restoreBackup(data);
        await loadAll();
        flash('success', 'Data restored');
      } catch (err) {
        flash('error', err instanceof Error ? `Restore failed: ${err.message}` : 'Restore failed');
      }
    };
    reader.readAsText(file);
  }


  const sections: { id: string; label: string; icon: any }[] = [
    { id: 'profile', label: L('General'), icon: Settings },
    { id: 'farms', label: L('My Farms'), icon: Globe2 },
    { id: 'users', label: L('Users'), icon: Users },
    { id: 'reports', label: L('Reports'), icon: FileText },
    { id: 'backup', label: L('Backup'), icon: Database },
    { id: 'telegram', label: L('Telegram'), icon: Send },
    { id: 'buyers', label: L('Buyers'), icon: Baby },
  ] as const;

  return (
    <MufAdminShell
      open={true}
      onClose={onClose}
      title="Settings & Admin Hub"
      subtitle={`${username || 'Admin'} · Control Panel`}
      icon={<Shield className="w-5 h-5" />}
      sections={sections}
      activeSection={section}
      onSectionChange={(id) => setSection(id as Section)}
    >
          {status && (
            <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
              status.type === 'success'
                ? 'bg-farm-50 text-farm-700 dark:bg-farm-900/30 dark:text-farm-300 border border-farm-200 dark:border-farm-800'
                : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800'
            }`}>
              {status.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {status.msg}
            </div>
          )}

          {section === 'profile' && (
            <MufAdminGeneral
              username={username || ''}
              email={currentUser?.email}
              avatarSlot={
                <AvatarUploader
                  avatar={currentUser?.avatarBase64 || ''}
                  fallbackLetter={(username || 'A')[0]}
                  onSave={async (base64) => {
                    await api.updateMe({ avatarBase64: base64 });
                    await loadUsers();
                    window.dispatchEvent(new Event('dm:profile-updated'));
                    flash('success', 'Photo updated');
                  }}
                  onRemove={async () => {
                    await api.updateMe({ avatarBase64: 'REMOVE_AVATAR' });
                    await loadUsers();
                    window.dispatchEvent(new Event('dm:profile-updated'));
                    flash('success', 'Photo removed');
                  }}
                />
              }
              newPassword={newPassword}
              currentPassword={currentPassword}
              pwCode={pwCode}
              pwMsg={pwMsg}
              sendingPwCode={sendingPwCode}
              passwordBusy={passwordBusy}
              onNewPasswordChange={setNewPassword}
              onCurrentPasswordChange={setCurrentPassword}
              onPwCodeChange={setPwCode}
              onSendPwCode={() => sendProfileCode('password')}
              onSubmitPassword={handleChangePassword}
              newEmail={newEmail}
              emailCode={emailCode}
              emailMsg={emailMsg}
              sendingEmailCode={sendingEmailCode}
              emailBusy={emailBusy}
              currentEmail={currentUser?.email}
              onNewEmailChange={setNewEmail}
              onEmailCodeChange={setEmailCode}
              onSendEmailCode={() => sendProfileCode('email')}
              onSubmitEmail={handleChangeEmail}
            >
              <MufAdminCard icon={<History className="w-5 h-5" />} title="Milk Rate Management" subtitle="Set the current per-litre rate">
                <p className="text-xs text-slate-400 uppercase mb-1">Current Rate</p>
                <p className="text-3xl font-bold text-farm-600">{fmtPKR(currentRate?.value || 0)} <span className="text-sm font-normal text-slate-400">/ litre</span></p>
                <div className="flex gap-2 mt-4">
                  <input type="number" value={newRate} onChange={(event) => setNewRate(event.target.value)} placeholder="New rate (₨)" className={inputClass} />
                  <button onClick={handleUpdateRate} className="bg-farm-600 hover:bg-farm-700 text-white rounded-xl px-4 py-2 text-sm font-semibold transition">Update</button>
                </div>

                <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3">
                  <button
                    onClick={() => setShowRateShare((v) => !v)}
                    className="text-xs font-bold transition"
                    style={{ color: '#25D366' }}
                  >💬 {showRateShare ? 'Hide' : 'Send rate to buyers on WhatsApp'}</button>
                  {showRateShare && (
                    <div className="mt-2 space-y-1.5 max-h-44 overflow-y-auto">
                      {buyers.length === 0 && <p className="text-xs text-slate-400">No buyers yet.</p>}
                      {buyers.map((buyer) => {
                        const rateForBuyer = buyer.defaultRate || currentRate?.value || 0;
                        const msg = [
                          'السلام علیکم!',
                          '*دودھ کا نیا ریٹ*',
                          `آج (${mufToday()}) سے آپ کے لیے دودھ کا ریٹ *Rs ${rateForBuyer} فی لیٹر* ہے۔`,
                          '',
                          '— Usman Dairy Farm',
                        ].join('\n');
                        return (
                          <div key={buyer._id} className="flex items-center justify-between gap-2 text-xs p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                            <span className="text-slate-700 dark:text-slate-200 font-medium truncate">
                              {buyer.name} <span className="text-slate-400 font-normal">{buyer.phone || 'no phone'}</span>
                            </span>
                            <button
                              disabled={!buyer.phone}
                              onClick={() => shareViaWhatsAppTo(buyer.phone!, msg)}
                              className="shrink-0 px-2.5 py-1 rounded-lg text-white text-[11px] font-bold disabled:opacity-40 transition"
                              style={{ backgroundColor: '#25D366' }}
                            >Send</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-4 max-h-[200px] overflow-y-auto">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Rate History</h4>
                  <div className="space-y-1">
                    {rateHistory.map((history) => (
                      <div key={history._id} className="flex justify-between text-sm border-b border-slate-100 dark:border-slate-800 pb-1">
                        <span className="text-slate-500">{history.date}</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{fmtPKR(history.value)}</span>
                      </div>
                    ))}
                    {rateHistory.length === 0 && <p className="text-xs text-slate-400">No history yet</p>}
                  </div>
                </div>
              </MufAdminCard>

              {/* Farm Location (weather widget) */}
              <MufAdminCard icon={<Globe2 className="w-5 h-5" />} title="Farm Location" subtitle="Set your farm coordinates for live weather">
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
                    className={inputClass + ' font-mono'}
                  />
                  <p className="text-[10px] text-slate-400">Enter latitude, longitude (decimal degrees). City is auto-detected.</p>
                  <MufAdminButton variant="secondary" size="md" onClick={handleSaveLocation}>Save Location</MufAdminButton>
                </div>
              </MufAdminCard>
            </MufAdminGeneral>
          )}

          {section === 'telegram' && (
            <TelegramPanel
              lang={getLang()}
              adapter={{
                status: () => api.telegramStatus(),
                listUsers: () => api.listUsers(),
                listWorkers: () => api.getLaborWorkers(),
                settings: () => api.telegramSettings(),
                saveSettings: (s) => api.telegramSaveSettings(s),
                linkCode: (o) => api.telegramLinkCode(o),
                unlink: (c) => api.telegramUnlink(c),
                sendSummary: () => api.telegramSendSummary(),
              }}
              blurbEn={'Workers send "doodh bella 12", "kharcha 500 chara", "hazri" or "hisab" — entries land in the app automatically.'}
              alarm={{ titleEn: 'Evening summary & production alarm', labelEn: 'Alarm when milk falls', defaultPct: '20' }}
              cronPath="/api/telegram/cron?key=CRON_SECRET"
            />
          )}
          {section === 'users' && (
            <MufAdminUsers
              users={users}
              usersLoading={usersLoading}
              currentUsername={username || ''}
              minPasswordLength={MIN_PASSWORD_LENGTH}
              onCreate={async (data) => {
                setNewUser({ username: data.username, password: data.password, displayName: data.displayName, role: data.role as UserRole, email: data.email });
                await handleCreateUser({ preventDefault: () => {} } as React.FormEvent);
              }}
              onToggleRole={(u) => toggleRole(u as any)}
              onEditProfile={async (user, data) => {
                setEditUsername(data.username);
                setEditPassword(data.password);
                setEditAdminPw(data.adminPassword);
                await handleSaveUserEdit(user as any);
              }}
              onEditEmail={(u) => editUserEmail(u as any)}
              onToggleActive={(u) => toggleActive(u as any)}
              onDelete={(u) => handleDeleteUser(u as any)}
            />
          )}

          {section === 'buyers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Buyers Management</h3>
                <button onClick={() => setShowBuyerForm(!showBuyerForm)} className="text-xs text-farm-600 hover:text-farm-700 font-semibold transition">
                  {showBuyerForm ? 'Cancel' : '+ Add Buyer'}
                </button>
              </div>

              {showBuyerForm && (
                <form onSubmit={handleAddBuyer} className="dm-card p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input required placeholder="Name *" value={newBuyer.name} onChange={(event) => setNewBuyer({ ...newBuyer, name: event.target.value })} className={inputClass} />
                  <input placeholder="Phone" value={newBuyer.phone} onChange={(event) => setNewBuyer({ ...newBuyer, phone: event.target.value })} className={inputClass} />
                  <input type="number" placeholder="Default Rate" value={newBuyer.defaultRate} onChange={(event) => setNewBuyer({ ...newBuyer, defaultRate: event.target.value })} className={inputClass} />
                  <input placeholder="Address" value={newBuyer.address} onChange={(event) => setNewBuyer({ ...newBuyer, address: event.target.value })} className={inputClass} />
                  <input placeholder="Notes" value={newBuyer.notes} onChange={(event) => setNewBuyer({ ...newBuyer, notes: event.target.value })} className="sm:col-span-2 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-950 outline-none focus:border-farm-500 focus:ring-2 focus:ring-farm-500/20 transition" />
                  <button type="submit" className="sm:col-span-2 bg-farm-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition hover:bg-farm-700">Add Buyer</button>
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {buyers.map((buyer) => (
                  <div key={buyer._id} className="dm-card p-4 flex items-center justify-between gap-3 cursor-pointer hover:border-farm-300 dark:hover:border-farm-700 transition" onClick={() => setKhataBuyer(buyer)} title="Open khata">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{buyer.name}</p>
                      <p className="text-xs text-slate-400">{buyer.phone || '-'} · {buyer.defaultRate ? `₨${buyer.defaultRate}/L` : 'Global rate'}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); setKhataBuyer(buyer); }} className="text-farm-600 hover:text-farm-700 text-xs font-semibold transition">Khata</button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteBuyer(buyer._id); }} className="text-red-400 hover:text-red-600 text-xs font-semibold transition">Delete</button>
                    </div>
                  </div>
                ))}
                {buyers.length === 0 && <p className="text-xs text-slate-400 text-center py-4 md:col-span-2">No buyers yet</p>}
              </div>
            </div>
          )}

          {khataBuyer && (
            <BuyerKhata
              buyer={khataBuyer}
              open={!!khataBuyer}
              onClose={() => setKhataBuyer(null)}
              isAdmin
              onFlash={flash}
            />
          )}

          {section === 'farms' && <MyFarmsPanel />}

          {section === 'reports' && (
            <MufAdminReports reportButtons={[]}>
              <ExportCenter />
            </MufAdminReports>
          )}

          {section === 'backup' && (
            <div className="space-y-6">
              {/* Manual Backup */}
              <MufAdminCard icon={<Database className="w-5 h-5" />} title="Manual Backup" subtitle="Download or share your farm data">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <MufAdminButton variant="primary" size="md" icon={<Download className="w-5 h-5" />}
                    onClick={handleBackup}
                    className="flex-col h-24 py-4"
                  >
                    <span>Download Backup</span>
                    <span className="text-[10px] font-normal opacity-80">All data as .json file</span>
                  </MufAdminButton>
                  <MufAdminButton variant="success" size="md"
                    icon={<span className="text-xl">💬</span>}
                    onClick={async () => {
                      try {
                        const data = await api.getBackup();
                        const result = await shareBackupFile(`dairy_backup_${mufToday()}.json`, JSON.stringify(data, null, 2));
                        if (result === 'shared') flash('success', 'Backup shared');
                        else if (result === 'fallback') flash('success', 'Backup downloaded — attach the file in WhatsApp');
                      } catch (err) {
                        flash('error', err instanceof Error ? err.message : 'Could not share backup');
                      }
                    }}
                    className="flex-col h-24 py-4"
                  >
                    <span>Send via WhatsApp</span>
                    <span className="text-[10px] font-normal opacity-80">Share backup file to a chat</span>
                  </MufAdminButton>
                </div>
              </MufAdminCard>

              {/* Restore from File */}
              <MufAdminCard icon={<Upload className="w-5 h-5" />} title="Restore from File" subtitle="Upload a .json backup to restore data">
                <div className="relative">
                  <input type="file" accept=".json" onChange={handleRestore} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-6 flex flex-col items-center gap-2 hover:border-farm-500 hover:bg-farm-50/30 dark:hover:bg-farm-900/10 transition cursor-pointer">
                    <Upload className="w-8 h-8 text-purple-600" />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Choose JSON file...</p>
                    <p className="text-[10px] text-red-500 font-bold">⚠️ This will overwrite all current data</p>
                  </div>
                </div>
              </MufAdminCard>

              {/* Auto-Backup */}
              <MufAdminCard icon={<RefreshCw className="w-5 h-5" />} title="Automatic Monthly Backup" subtitle="System creates a backup once per month">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-3">
                  {autoBackup?.available
                    ? `Last auto backup: ${autoBackup.name}`
                    : 'No auto backup yet.'}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <MufAdminButton variant="primary" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />}
                    disabled={autoBackupBusy}
                    onClick={async () => {
                      setAutoBackupBusy(true);
                      try {
                        await api.runAutoBackup();
                        setAutoBackup(await api.getAutoBackup());
                        flash('success', 'Backup updated');
                      } catch (err) {
                        flash('error', err instanceof Error ? err.message : 'Auto-backup failed');
                      } finally { setAutoBackupBusy(false); }
                    }}
                  >
                    Back up now
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
                    Download
                  </MufAdminButton>
                  <MufAdminButton variant="warning" size="sm" icon={<Upload className="w-3.5 h-3.5" />}
                    disabled={autoBackupBusy || !autoBackup?.available}
                    onClick={async () => {
                      const ok = await confirmAction({
                        title: 'Restore from auto-backup',
                        message: `Restore ${autoBackup?.name}? Current data will be replaced.`,
                        confirmLabel: 'Restore',
                        tone: 'warning',
                      });
                      if (!ok) return;
                      setAutoBackupBusy(true);
                      try {
                        const res = await api.restoreAutoBackup();
                        flash('success', res.message || 'Restored from auto-backup');
                        await loadAll();
                      } catch (err) {
                        flash('error', err instanceof Error ? err.message : 'Restore failed');
                      } finally { setAutoBackupBusy(false); }
                    }}
                  >
                    Restore from it
                  </MufAdminButton>
                </div>
              </MufAdminCard>
            </div>
          )}

    </MufAdminShell>
  );
}
