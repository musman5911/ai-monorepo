// muf-admin-users — shared Users tab content for all 3 farm apps.
// Renders the same UI (create form + user list + edit panel) across all apps.
// Each app passes its own callbacks — the component manages only the display state
// (show/hide create form, which user is being edited).
//
// TWIN FILES (all 3 apps, byte-identical .tsx):
//   dairy_farm/client/src/muf-admin-users.tsx
//   flock_farm/client/src/muf-admin-users.tsx
//   agri_farm/frontend/src/muf-admin-users.tsx
import React, { useState } from 'react';
import { UserPlus, Users, Shield, ShieldCheck, UserRound, Pencil, Mail, Power, Trash2 } from 'lucide-react';
import MufAdminCard from './muf-admin-card';
import MufAdminButton from './muf-admin-button';

export interface MufAdminUser {
  _id: string;
  username: string;
  role: string;
  email?: string;
  displayName?: string;
  active?: boolean;
}

interface MufAdminUsersProps {
  users: MufAdminUser[];
  usersLoading?: boolean;
  currentUsername: string;
  minPasswordLength?: number;
  // Create
  onCreate: (data: { username: string; password: string; displayName: string; role: string; email: string }) => Promise<void>;
  // Per-user actions
  onToggleRole?: (user: MufAdminUser) => Promise<void> | void;
  onEditProfile: (user: MufAdminUser, data: { username: string; password: string; adminPassword: string }) => Promise<void>;
  onEditEmail?: (user: MufAdminUser) => void;
  onToggleActive?: (user: MufAdminUser) => Promise<void> | void;
  onDelete: (user: MufAdminUser) => Promise<void> | void;
}

const inputClass = 'w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-farm-500 focus:ring-2 focus:ring-farm-500/20 transition text-slate-800 dark:text-slate-100 placeholder:text-slate-400';

export default function MufAdminUsers({
  users, usersLoading, currentUsername, minPasswordLength = 8,
  onCreate, onToggleRole, onEditProfile, onEditEmail, onToggleActive, onDelete,
}: MufAdminUsersProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', displayName: '', role: 'worker', email: '' });
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editAdminPw, setEditAdminPw] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await onCreate({ ...form });
      setForm({ username: '', password: '', displayName: '', role: 'worker', email: '' });
      setShowForm(false);
    } finally { setCreating(false); }
  };

  const startEdit = (user: MufAdminUser) => {
    setEditId(user._id);
    setEditUsername(user.username);
    setEditPassword('');
    setEditAdminPw('');
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditUsername('');
    setEditPassword('');
    setEditAdminPw('');
  };

  const handleSaveEdit = async (user: MufAdminUser) => {
    setEditBusy(true);
    try {
      await onEditProfile(user, { username: editUsername, password: editPassword, adminPassword: editAdminPw });
      cancelEdit();
    } finally { setEditBusy(false); }
  };

  return (
    <div className="space-y-6">
      {/* ── Register New User ── */}
      <MufAdminCard icon={<UserPlus className="w-5 h-5" />} title="Register New User" subtitle="Create admin and worker accounts for your farm team">
        <div className="flex items-center justify-end gap-2 mb-3">
          <MufAdminButton variant={showForm ? 'secondary' : 'primary'} size="sm" icon={<UserPlus className="w-4 h-4" />}
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Cancel' : 'New User'}
          </MufAdminButton>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Username" className={inputClass} />
              <input required type="password" minLength={minPasswordLength} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={`Password (min ${minPasswordLength})`} className={inputClass} />
              <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="Display name (optional)" className={inputClass} />
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputClass}>
                <option value="worker">Worker</option>
                <option value="admin">Admin</option>
              </select>
              <input type="email" required={form.role === 'admin'} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={form.role === 'admin' ? 'Email (required for admins)' : 'Email (optional)'} className="sm:col-span-2 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-950 outline-none focus:border-farm-500 focus:ring-2 focus:ring-farm-500/20 transition" />
            </div>
            <MufAdminButton type="submit" variant="secondary" size="md" disabled={creating}>
              {creating ? 'Creating...' : `Create ${form.role === 'admin' ? 'Admin' : 'Worker'}`}
            </MufAdminButton>
          </form>
        )}
      </MufAdminCard>

      {/* ── Registered Users ── */}
      <MufAdminCard icon={<Users className="w-5 h-5" />} title={`Registered Users (${users.length})`} subtitle="Manage access levels and credentials">
        <div className="space-y-2">
          {usersLoading ? (
            <div className="text-sm text-slate-500 py-8 text-center">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="text-sm text-slate-500 py-8 text-center">No users found.</div>
          ) : (
            users.map((user) => (
              <div key={user._id} className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 ${user.active === false ? 'opacity-60' : ''}`}>
                {/* Left: Avatar + info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${user.role === 'admin' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                    {user.role === 'admin' ? <Shield className="w-4 h-4" /> : <UserRound className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-100 font-mono truncate">{user.username}</span>
                      {user.username === currentUsername && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-farm-100 dark:bg-farm-900/40 text-farm-700 dark:text-farm-300">you</span>}
                      {user.active === false && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">inactive</span>}
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">{user.role}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {user.displayName || 'No display name'}
                      {user.email ? ` · ${user.email}` : ''}
                    </p>
                  </div>
                </div>

                {/* Right: Action buttons */}
                <div className="flex items-center gap-1 flex-wrap">
                  {onToggleRole && (
                    <button onClick={() => onToggleRole(user)} disabled={user.username === currentUsername} title={user.role === 'admin' ? 'Make worker' : 'Make admin'} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 transition">
                      <ShieldCheck className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => (editId === user._id ? cancelEdit() : startEdit(user))} title="Edit profile" className={`p-2 rounded-xl transition ${editId === user._id ? 'bg-farm-100 dark:bg-farm-900/40 text-farm-700 dark:text-farm-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  {onEditEmail && (
                    <button onClick={() => onEditEmail(user)} title="Edit reset email" className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition">
                      <Mail className="w-4 h-4" />
                    </button>
                  )}
                  {onToggleActive && (
                    <button onClick={() => onToggleActive(user)} disabled={user.username === currentUsername} title={user.active ? 'Deactivate' : 'Activate'} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 transition">
                      <Power className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => onDelete?.(user)} disabled={user.username === currentUsername} title="Delete user" className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 disabled:opacity-30 transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Inline edit panel */}
                {editId === user._id && (
                  <div className="w-full mt-1 p-4 rounded-xl border border-farm-200 dark:border-farm-800 bg-farm-50/60 dark:bg-farm-950/20 space-y-3">
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Edit Profile</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} placeholder="Username" className={inputClass} />
                      <input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder={`New password (optional, min ${minPasswordLength})`} className={inputClass} />
                      <input type="password" value={editAdminPw} onChange={(e) => setEditAdminPw(e.target.value)} placeholder="Enter your admin password to save" className={`sm:col-span-2 ${inputClass}`} />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <MufAdminButton variant="secondary" size="sm" onClick={cancelEdit}>Cancel</MufAdminButton>
                      <MufAdminButton variant="primary" size="sm" disabled={editBusy} onClick={() => handleSaveEdit(user)}>
                        {editBusy ? 'Saving…' : 'Save Changes'}
                      </MufAdminButton>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </MufAdminCard>
    </div>
  );
}
