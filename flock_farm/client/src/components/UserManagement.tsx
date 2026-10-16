import React, { useState, useEffect } from 'react';
import { mufL } from '../muf/data/muf-urdu';
import { UserPlus, Trash2, Key, Check, X, Shield, User as UserIcon, ShieldCheck, Mail, Pencil, Send } from 'lucide-react';
import { Lang } from '../types';
import { AuthUser, listUsers, createUser, updateUser, deleteUser, changePassword, changePasswordWithCode, requestProfileCode } from '../api';
import { usePromptInput, notify } from '../muf/core/muf-confirm';
import { useConfirm } from '../muf/core/muf-confirm';

interface Props {
  currentUser: AuthUser;
  lang: Lang;
}

export default function UserManagement({ currentUser, lang }: Props) {
  // User-account changes require the admin's own password.
  const promptInput = usePromptInput();
  const askAdminPassword = async (title: string, message: string): Promise<string | null> => {
    const pw = await promptInput({
      title,
      message,
      label: L('Admin password'),
      type: 'password',
      confirmLabel: L('Authorize'),
    });
    if (pw === null || pw === '') return null;
    return pw;
  };

  const confirmAction = useConfirm();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'worker'>('worker');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Own password change
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pwSubmitting, setPwSubmitting] = useState(false);
  // Emailed verification code path
  const [pwCode, setPwCode] = useState('');
  const [sendingPwCode, setSendingPwCode] = useState(false);
  // Inline per-user profile edit box
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editAdminPw, setEditAdminPw] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  const L = (en: string, urOrVars?: string | Record<string, string | number | null>) => mufL(lang, en, urOrVars);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listUsers();
      setUsers(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showStatus = (m: string) => {
    setStatusMsg(m);
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (newRole === 'admin' && !newEmail.trim()) {
        notify(label.emailRequired, 'error');
        setSubmitting(false);
        return;
      }
      await createUser({
        username: newUsername.trim(),
        password: newPassword,
        role: newRole,
        displayName: newDisplayName.trim(),
        email: newRole === 'admin' ? newEmail.trim() : undefined,
      });
      setNewUsername('');
      setNewPassword('');
      setNewRole('worker');
      setNewDisplayName('');
      setNewEmail('');
      setShowNewForm(false);
      await reload();
      showStatus(L('User created.'));
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to create user', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleRole = async (u: AuthUser) => {
    if (u._id === currentUser._id) {
      notify(L("You can't change your own role."), 'error');
      return;
    }
    const nextRole = u.role === 'admin' ? 'worker' : 'admin';
    try {
      const adminPassword = await askAdminPassword(
        nextRole === 'admin' ? L('Promote to Admin') : L('Change to Worker'),
        nextRole === 'admin'
          ? L('Enter your admin password to make "{username}" an administrator.', { username: u.username })
          : L('Enter your admin password to change "{username}" to a worker account.', { username: u.username })
      );
      if (!adminPassword) return;
      await updateUser(u._id, { role: nextRole, adminPassword });
      await reload();
      showStatus(L('{username} role updated to {nextRole}.', { username: u.username, nextRole: nextRole }));
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update role', 'error');
    }
  };

  const toggleActive = async (u: AuthUser) => {
    if (u._id === currentUser._id) {
      notify(L("You can't deactivate yourself."), 'error');
      return;
    }
    try {
      const adminPassword = await askAdminPassword(
        u.active ? L('Deactivate Account') : L('Activate Account'),
        u.active
          ? L('Enter your admin password to deactivate "{username}". They will no longer be able to sign in.', { username: u.username })
          : L('Enter your admin password to reactivate "{username}".', { username: u.username })
      );
      if (!adminPassword) return;
      await updateUser(u._id, { active: !u.active, adminPassword } as any);
      await reload();
      showStatus(
        L('{username} is now {state}.', { username: u.username, state: L(!u.active ? 'deactivated' : 'activated') })
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to toggle active', 'error');
    }
  };

  // Inline profile edit: username and/or password, authorized with the
  // admin's own password.
  const startEditUser = (u: AuthUser) => {
    setEditUserId(u._id);
    setEditUsername(u.username);
    setEditPassword('');
    setEditAdminPw('');
  };

  const cancelEditUser = () => {
    setEditUserId(null);
    setEditUsername('');
    setEditPassword('');
    setEditAdminPw('');
  };

  const handleSaveUserEdit = async (u: AuthUser) => {
    if (!editUsername.trim()) {
      notify(L('Username cannot be empty.'), 'error');
      return;
    }
    if (editPassword && editPassword.length < 8) {
      notify(L('Password must be at least 8 characters.'), 'error');
      return;
    }
    if (!editAdminPw) {
      notify(L('Enter your admin password to save these changes.'), 'error');
      return;
    }
    setEditBusy(true);
    try {
      const payload: { username?: string; password?: string; adminPassword: string } = { adminPassword: editAdminPw };
      if (editUsername.trim().toLowerCase() !== u.username) payload.username = editUsername.trim().toLowerCase();
      if (editPassword) payload.password = editPassword;
      await updateUser(u._id, payload);
      await reload();
      cancelEditUser();
      showStatus(L('Profile for \'{username}\' updated successfully!', { username: u.username }));
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update profile', 'error');
    } finally {
      setEditBusy(false);
    }
  };

  // Emails the signed-in admin a 6-digit authorization code (10 minutes).
  const sendPwCode = async () => {
    setSendingPwCode(true);
    setPwMsg(null);
    try {
      await requestProfileCode();
      setPwMsg({ type: 'ok', text: L('Verification authorization code has been successfully sent to your email.') });
    } catch (err) {
      setPwMsg({ type: 'err', text: err instanceof Error ? err.message : 'Failed to deliver code.' });
    } finally {
      setSendingPwCode(false);
    }
  };

  const editEmail = async (u: AuthUser) => {
    if (u.role !== 'admin') return;
    const current = u.email || '';
    const email = await promptInput({
      title: L('Edit email'),
      message: L('Set email for {username} (leave blank to remove).', { username: u.username }),
      label: L('Email address'),
      type: 'email',
      initialValue: current,
      confirmLabel: L('Save email'),
    });
    if (email === null) return;
    const clean = email.trim().toLowerCase();
    if (clean && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return notify(L('Invalid email format'), 'error');
    try {
      const adminPassword = await askAdminPassword(
        L('Update Email'),
        L('Enter your admin password to change the email for "{username}".', { username: u.username })
      );
      if (!adminPassword) return;
      await updateUser(u._id, { email: clean || '', adminPassword });
      await reload();
      showStatus(L('Email updated for {username}.', { username: u.username }));
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update email', 'error');
    }
  };

  const handleDelete = async (u: AuthUser) => {
    if (u._id === currentUser._id) return;
    const ok = await confirmAction({
      title: L('Delete User'),
      message: L('Delete user "{username}"? This cannot be undone.', { username: u.username }),
      confirmLabel: L('Delete User'),
      cancelLabel: L('Cancel'),
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteUser(u._id);
      await reload();
      showStatus(L('User deleted.'));
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to delete user', 'error');
    }
  };

  const handleChangeOwnPw = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (!newPw) {
      setPwMsg({ type: 'err', text: L('New password is required.') });
      return;
    }
    if (newPw.length < 8) {
      setPwMsg({ type: 'err', text: L('New password must be at least 8 characters.') });
      return;
    }
    if (!curPw && !pwCode.trim()) {
      setPwMsg({ type: 'err', text: L('Either your current password or an emailed verification code is required.') });
      return;
    }
    setPwSubmitting(true);
    try {
      if (pwCode.trim()) {
        await changePasswordWithCode(pwCode.trim(), newPw);
      } else {
        await changePassword(curPw, newPw);
      }
      setCurPw('');
      setNewPw('');
      setPwCode('');
      setPwMsg({ type: 'ok', text: L('Password changed successfully.') });
    } catch (err) {
      setPwMsg({ type: 'err', text: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setPwSubmitting(false);
    }
  };

  const label = {
    users: L('User Accounts'),
    newUser: L('New user'),
    cancel: L('Cancel'),
    username: L('Username'),
    password: L('Password'),
    displayName: L('Display name'),
    email: L('Email'),
    role: L('Role'),
    admin: L('Admin'),
    worker: L('Worker'),
    emailRequired: L('Email is required for admin accounts'),
    create: L('Create user'),
    creating: L('Creating…'),
    loading: L('Loading users…'),
    noUsers: L('No users yet.'),
    you: L('you'),
    deactivated: L('deactivated'),
    changeMyPw: L('Change my password'),
    currentPw: L('Current password'),
    newPw: L('New password (min 8)'),
    update: L('Update password'),
    updating: L('Updating…'),
    logout: L('Sign out'),
    signedInAs: L('Signed in as'),
    optional: L('Optional'),
    min4: L('min 8 chars'),
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
        <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 font-display flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-slate-500" /> {label.users}
        </h3>
        <button
          onClick={() => setShowNewForm((v) => !v)}
          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-farm-600 text-white flex items-center gap-1.5"
        >
          <UserPlus className="w-3.5 h-3.5" />
          {showNewForm ? label.cancel : label.newUser}
        </button>
      </div>

      {statusMsg && (
        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-lg text-xs flex items-center gap-2">
          <Check className="w-4 h-4" /> {statusMsg}
        </div>
      )}
      {error && (
        <div className="p-2.5 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-lg text-xs flex items-center gap-2">
          <X className="w-4 h-4" /> {error}
        </div>
      )}

      {showNewForm && (
        <form onSubmit={handleCreate} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-2xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{label.username}</label>
              <input
                type="text" required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:border-emerald-400 font-mono"
                placeholder={L('e.g. aslam')}
              />
            </div>
            <div>
              <label className="block text-2xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{label.password}</label>
              <input
                type="password" required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:border-emerald-400 font-mono"
                placeholder={label.min4}
              />
            </div>
            <div>
              <label className="block text-2xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{label.displayName}</label>
              <input
                type="text"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:border-emerald-400"
                placeholder={label.optional}
              />
            </div>
            <div>
              <label className="block text-2xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{label.role}</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'admin' | 'worker')}
                className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:border-emerald-400 font-medium"
              >
                <option value="worker">{label.worker}</option>
                <option value="admin">{label.admin}</option>
              </select>
            </div>
            {newRole === 'admin' && (
              <div className="sm:col-span-2">
                <label className="block text-2xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  {label.email} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:border-emerald-400"
                  placeholder="admin@farm.com"
                />
                <p className="text-3xs text-slate-400 mt-1">{label.emailRequired}</p>
              </div>
            )}
          </div>
          <button
            type="submit" disabled={submitting}
            className="text-xs font-bold px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white disabled:opacity-60"
          >
            {submitting ? label.creating : label.create}
          </button>
        </form>
      )}

      <div className="space-y-2">
        {loading ? (
          <div className="text-xs text-slate-500 py-4 text-center">{label.loading}</div>
        ) : users.length === 0 ? (
          <div className="text-xs text-slate-500 py-4 text-center">{label.noUsers}</div>
        ) : (
          users.map((u) => (
            <div
              key={u._id}
              className={`flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border ${
                u.active ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 opacity-70'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${u.role === 'admin' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                  {u.role === 'admin' ? <Shield className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100 font-mono truncate">{u.username}</span>
                    {u._id === currentUser._id && (
                      <span className="text-2xs font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">{label.you}</span>
                    )}
                    {!u.active && (
                      <span className="text-2xs font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{label.deactivated}</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {u.displayName || '—'} · {u.role === 'admin' ? label.admin : label.worker}
                    {u.role === 'admin' && u.email && <><br /><span className="text-2xs font-mono text-slate-400">{u.email}</span></>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  onClick={() => toggleRole(u)}
                  disabled={u._id === currentUser._id}
                  title={u.role === 'admin' ? L('Demote to worker') : L('Promote to admin')}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30"
                >
                  <ShieldCheck className="w-4 h-4" />
                </button>
                {u.role === 'admin' && (
                  <button
                    onClick={() => editEmail(u)}
                    title={L('Edit email')}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                  >
                    <Mail className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => (editUserId === u._id ? cancelEditUser() : startEditUser(u))}
                  title={L('Edit profile (username / password)')}
                  className={`p-1.5 rounded-lg transition ${editUserId === u._id ? 'bg-farm-100 dark:bg-farm-900/40 text-farm-700 dark:text-farm-300' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleActive(u)}
                  disabled={u._id === currentUser._id}
                  title={u.active ? L('Deactivate') : L('Activate')}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30"
                >
                  {u.active ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => handleDelete(u)}
                  disabled={u._id === currentUser._id}
                  title={L('Delete user')}
                  className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 disabled:opacity-30"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {editUserId === u._id && (
                <div className="w-full mt-1 p-3 rounded-xl border border-farm-200 dark:border-farm-800 bg-farm-50/60 dark:bg-farm-950/20 space-y-2.5">
                  <p className="text-2xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {L('Edit Profile')}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} placeholder={label.username}
                      className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:border-farm-400 font-mono" />
                    <input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder={L('New password (optional, min 8)')}
                      className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:border-farm-400 font-mono" />
                    <input type="password" value={editAdminPw} onChange={(e) => setEditAdminPw(e.target.value)} placeholder={L('Enter your admin password to save')}
                      className="sm:col-span-2 w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:border-farm-400 font-mono" />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={cancelEditUser} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-2xs font-bold text-slate-600 dark:text-slate-300">{label.cancel}</button>
                    <button type="button" onClick={() => handleSaveUserEdit(u)} disabled={editBusy} className="px-3 py-1.5 rounded-lg bg-farm-600 hover:bg-farm-700 disabled:opacity-60 text-white text-2xs font-bold">
                      {editBusy ? L('Saving…') : L('Save Changes')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Own password change */}
      <form onSubmit={handleChangeOwnPw} className="pt-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
          <Key className="w-4 h-4" /> {label.changeMyPw}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)}
            placeholder={label.currentPw}
            className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:border-emerald-400 font-mono"
          />
          <input
            type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
            placeholder={label.newPw}
            className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:border-emerald-400 font-mono"
          />
        </div>
        <div className="flex items-center gap-2 text-3xs font-bold text-slate-400 uppercase tracking-widest">
          <span className="flex-1 border-t border-slate-200 dark:border-slate-700" /> {L('or verify by email')} <span className="flex-1 border-t border-slate-200 dark:border-slate-700" />
        </div>
        <div className="flex gap-2">
          <input value={pwCode} onChange={(e) => setPwCode(e.target.value)} maxLength={6}
            placeholder={L('6-digit emailed code')}
            className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:border-farm-400 font-mono" />
          <button type="button" onClick={sendPwCode} disabled={sendingPwCode}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-farm-300 dark:border-farm-700 text-farm-700 dark:text-farm-300 hover:bg-farm-50 dark:hover:bg-farm-900/30 text-2xs font-bold disabled:opacity-50">
            <Send className="w-3 h-3" /> {sendingPwCode ? L('Sending…') : L('Send Code')}
          </button>
        </div>
        {pwMsg && (
          <div className={`text-xs p-2 rounded-lg flex items-center gap-2 ${pwMsg.type === 'ok' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'}`}>
            {pwMsg.type === 'ok' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />} {pwMsg.text}
          </div>
        )}
        <button
          type="submit" disabled={pwSubmitting}
          className="text-xs font-bold px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white disabled:opacity-60"
        >
          {pwSubmitting ? label.updating : label.update}
        </button>
      </form>
    </div>
  );
}
