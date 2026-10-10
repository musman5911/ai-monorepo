import { useState } from 'react';
import type { FormEvent } from 'react';
import { KeyRound, UserRound } from 'lucide-react';
import DetailModal from '../muf-modal';
import AvatarUploader from '../muf-avatar';
import { api } from '../api';
import type { AuthUser } from '../types';

/**
 * My Profile — compact popup for the logged-in user (used by workers, who
 * don't get the full admin panel). Lets every account manage its own avatar
 * (stored as base64 in the DB — replacing/removing frees the space)
 * and change its own password.
 */
export default function MyProfilePopup({
  me,
  onClose,
  onProfileUpdated,
}: {
  me: AuthUser | null;
  onClose: () => void;
  onProfileUpdated: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const flash = (ok: boolean, text: string) => {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 3000);
  };

  const handlePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentPassword || newPassword.length < 8) {
      flash(false, 'New password must be at least 8 characters');
      return;
    }
    setBusy(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      flash(true, 'Password updated');
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Could not change password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DetailModal
      open
      onClose={onClose}
      title="My Profile"
      subtitle={`${me?.username} · ${me?.role === 'admin' ? 'Administrator' : 'Worker'}`}
      icon={<UserRound className="w-4 h-4" />}
      iconBg="bg-farm-100 text-farm-700 dark:bg-farm-900/40 dark:text-farm-300"
      size="small"
    >
        <div className="space-y-5">
          {msg && (
            <p className={`text-xs font-bold ${msg.ok ? 'text-emerald-600' : 'text-red-500'}`}>{msg.text}</p>
          )}

          <div className="dm-card p-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-3">Profile photo</h3>
            <AvatarUploader
              avatar={me?.avatarBase64 || ''}
              fallbackLetter={(me?.username || 'U')[0]}
              onSave={async (base64) => {
                await api.updateMe({ avatarBase64: base64 });
                onProfileUpdated();
                flash(true, 'Avatar updated');
              }}
              onRemove={async () => {
                await api.updateMe({ avatarBase64: 'REMOVE_AVATAR' });
                onProfileUpdated();
                flash(true, 'Photo removed');
              }}
            />
          </div>

          <form onSubmit={handlePassword} className="dm-card p-4 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-farm-600" /> Change my password
            </h3>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-950 outline-none focus:border-farm-500 transition"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 8 characters)"
              minLength={8}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-950 outline-none focus:border-farm-500 transition"
            />
            <button type="submit" disabled={busy} className="w-full bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-60 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition">
              {busy ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </div>
    </DetailModal>
  );
}
