// muf-admin-general — shared General tab content for all 3 farm apps.
// Renders: Profile card + Password card + Email card + optional Farm Settings slot.
// Each app passes its own state + handlers + optional farm settings as children.
//
// TWIN FILES (all 3 apps, byte-identical .tsx):
//   dairy_farm/client/src/muf-admin-general.tsx
//   flock_farm/client/src/muf-admin-general.tsx
//   agri_farm/frontend/src/muf-admin-general.tsx
import React, { useState, useEffect } from 'react';
import { Shield, KeyRound, Mail, Send, Bell, BellOff } from 'lucide-react';
import MufAdminCard from './muf-admin-card';
import MufAdminButton from './muf-admin-button';
import { loadNotifPrefs, saveNotifPrefs, requestNotifPermission, notifPermission, type MufNotifPrefs } from '../core/muf-notifications';
import { L } from '../../i18n';

const inputClass = 'w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-farm-500 focus:ring-2 focus:ring-farm-500/20 transition text-slate-800 dark:text-slate-100 placeholder:text-slate-400';

interface MufAdminGeneralProps {
  // Profile
  username: string;
  email?: string;
  avatarSlot?: React.ReactNode;

  // Password change
  newPassword: string;
  currentPassword: string;
  pwCode: string;
  pwMsg?: { type: 'success' | 'error'; msg: string } | null;
  sendingPwCode: boolean;
  passwordBusy: boolean;
  onNewPasswordChange: (v: string) => void;
  onCurrentPasswordChange: (v: string) => void;
  onPwCodeChange: (v: string) => void;
  onSendPwCode: () => void;
  onSubmitPassword: (e: React.FormEvent) => void;

  // Email change
  newEmail: string;
  emailCode: string;
  emailMsg?: { type: 'success' | 'error'; msg: string } | null;
  sendingEmailCode: boolean;
  emailBusy: boolean;
  currentEmail?: string;
  onNewEmailChange: (v: string) => void;
  onEmailCodeChange: (v: string) => void;
  onSendEmailCode: () => void;
  onSubmitEmail: (e: React.FormEvent) => void;

  // Farm-specific settings (optional slot)
  children?: React.ReactNode;
}

export default function MufAdminGeneral({
  username, email, avatarSlot,
  newPassword, currentPassword, pwCode, pwMsg, sendingPwCode, passwordBusy,
  onNewPasswordChange, onCurrentPasswordChange, onPwCodeChange, onSendPwCode, onSubmitPassword,
  newEmail, emailCode, emailMsg, sendingEmailCode, emailBusy, currentEmail,
  onNewEmailChange, onEmailCodeChange, onSendEmailCode, onSubmitEmail,
  children,
}: MufAdminGeneralProps) {
  const [prefs, setPrefs] = useState<MufNotifPrefs>(loadNotifPrefs);
  const [permission, setPermission] = useState<NotificationPermission>(notifPermission());

  useEffect(() => { setPermission(notifPermission()); }, []);

  const handleRequestPermission = async () => {
    const result = await requestNotifPermission();
    setPermission(result);
    if (result === 'granted') {
      setPrefs(p => { const n = { ...p, enabled: true }; saveNotifPrefs(n); return n; });
      try { new Notification('Notifications enabled', { body: 'You will now receive farm alerts.', icon: '/logo.png' }); } catch { /* */ }
    }
  };

  const updatePref = (key: keyof MufNotifPrefs, value: boolean) => {
    setPrefs(p => { const n = { ...p, [key]: value }; saveNotifPrefs(n); return n; });
  };

  return (
    <div className="space-y-6">
      {/* ── Profile ── */}
      {avatarSlot && (
        <MufAdminCard icon={<Shield className="w-5 h-5" />} title={L('Admin Profile')} subtitle={L('Your account information')}>
          <div className="mb-4">
            <p className="text-base font-bold text-slate-800 dark:text-slate-100">{username}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{L('Administrator account')}</p>
            {email && <p className="text-xs font-mono text-slate-400 mt-1">{email}</p>}
          </div>
          {avatarSlot}
        </MufAdminCard>
      )}

      {/* ── Change Password ── */}
      <MufAdminCard icon={<KeyRound className="w-5 h-5" />} title={L('Change Password')} subtitle={L('Update your access password')}>
        <form onSubmit={onSubmitPassword} className="space-y-3">
          {pwMsg && (
            <div className={`p-3 rounded-lg text-xs border font-semibold ${
              pwMsg.type === 'success'
                ? 'bg-farm-50 border-farm-300 text-farm-800 dark:bg-farm-950/40 dark:border-farm-500 dark:text-farm-300'
                : 'bg-red-50 border-red-300 text-red-800 dark:bg-red-950/40 dark:border-red-500 dark:text-red-300'
            }`}>
              {pwMsg.msg}
            </div>
          )}
          <input type="password" value={newPassword} onChange={(e) => onNewPasswordChange(e.target.value)}
            placeholder={L('New password (min 8 characters)')} className={inputClass} minLength={8} />
          <input type="password" value={currentPassword} onChange={(e) => onCurrentPasswordChange(e.target.value)}
            placeholder={L('Current password')} className={inputClass} />
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <span className="flex-1 border-t border-slate-200 dark:border-slate-700" /> or verify by email <span className="flex-1 border-t border-slate-200 dark:border-slate-700" />
          </div>
          <div className="flex gap-2">
            <input value={pwCode} onChange={(e) => onPwCodeChange(e.target.value)}
              placeholder="6-digit emailed code" className={inputClass} maxLength={6} />
            <MufAdminButton type="button" variant="secondary" size="sm" icon={<Send className="w-3.5 h-3.5" />}
              disabled={sendingPwCode} onClick={onSendPwCode}
            >
              {sendingPwCode ? 'Sending...' : 'Send Code'}
            </MufAdminButton>
          </div>
          <MufAdminButton type="submit" variant="secondary" size="md" disabled={passwordBusy}>
            {passwordBusy ? 'Updating...' : 'Update Password'}
          </MufAdminButton>
        </form>
      </MufAdminCard>

      {/* ── Change Email ── */}
      <MufAdminCard icon={<Mail className="w-5 h-5" />} title={L('Change Email')} subtitle={L('Update your email address')}>
        <form onSubmit={onSubmitEmail} className="space-y-3">
          {emailMsg && (
            <div className={`p-3 rounded-lg text-xs border font-semibold ${
              emailMsg.type === 'success'
                ? 'bg-farm-50 border-farm-300 text-farm-800 dark:bg-farm-950/40 dark:border-farm-500 dark:text-farm-300'
                : 'bg-red-50 border-red-300 text-red-800 dark:bg-red-950/40 dark:border-red-500 dark:text-red-300'
            }`}>
              {emailMsg.msg}
            </div>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Current: <span className="font-mono font-semibold">{currentEmail || 'not set'}</span>
          </p>
          <input type="email" value={newEmail} onChange={(e) => onNewEmailChange(e.target.value)}
            placeholder={L('New email address')} className={inputClass} />
          <div className="flex gap-2">
            <input value={emailCode} onChange={(e) => onEmailCodeChange(e.target.value)}
              placeholder="6-digit emailed code" className={inputClass} maxLength={6} />
            <MufAdminButton type="button" variant="secondary" size="sm" icon={<Send className="w-3.5 h-3.5" />}
              disabled={sendingEmailCode} onClick={onSendEmailCode}
            >
              {sendingEmailCode ? 'Sending...' : 'Send Code'}
            </MufAdminButton>
          </div>
          <MufAdminButton type="submit" variant="secondary" size="md" disabled={emailBusy}>
            {emailBusy ? 'Updating...' : 'Update Email'}
          </MufAdminButton>
        </form>
      </MufAdminCard>

      {/* ── Notification Preferences ── */}
      <MufAdminCard icon={prefs.enabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />} title={L('Browser Notifications')} subtitle={L('Get desktop alerts for important farm events')}>
        <div className="space-y-3">
          {permission !== 'granted' && permission !== 'denied' && (
            <MufAdminButton type="button" variant="secondary" size="md" icon={<Bell className="w-4 h-4" />} onClick={handleRequestPermission}>
              {L('Enable Browser Notifications')}
            </MufAdminButton>
          )}
          {permission === 'denied' && (
            <p className="text-xs text-red-500 font-medium">Notifications are blocked. Enable them in your browser settings to receive alerts.</p>
          )}
          {permission === 'granted' && (
            <>
              <label className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 cursor-pointer">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{L('Enable notifications')}</span>
                <input type="checkbox" checked={prefs.enabled} onChange={(e) => updatePref('enabled', e.target.checked)} className="w-5 h-5 accent-farm-600" />
              </label>
              {prefs.enabled && (
                <div className="space-y-2 pl-2 border-l-2 border-farm-200 dark:border-farm-800">
                  {([
                    { key: 'healthAlerts', label: 'Health alerts' },
                    { key: 'lowFeed', label: 'Low feed stock' },
                    { key: 'productionDrop', label: 'Production drop alarm' },
                    { key: 'financialDeficit', label: 'Financial deficit' },
                  ] as { key: keyof Omit<MufNotifPrefs, 'enabled'>; label: string }[]).map(item => (
                    <label key={item.key} className="flex items-center justify-between p-2 cursor-pointer">
                      <span className="text-xs text-slate-600 dark:text-slate-400">{item.label}</span>
                      <input type="checkbox" checked={prefs[item.key]} onChange={(e) => updatePref(item.key, e.target.checked)} className="w-4 h-4 accent-farm-600" />
                    </label>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </MufAdminCard>

      {/* ── Farm-specific settings (optional slot) ── */}
      {children}
    </div>
  );
}
