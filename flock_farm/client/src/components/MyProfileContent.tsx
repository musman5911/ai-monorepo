import { useState } from 'react';
import { mufL } from '../muf/data/muf-urdu';
import { Lang } from '../types';
import { AuthUser, updateMe, changePassword } from '../api';
import AvatarUploader from '../muf/ui/muf-avatar';
import { L } from '../i18n';

// ─── My Profile (avatar + own password) — used from the header profile chip ──
export function MyProfileContent({
  lang,
  currentUser,
  onUserUpdate,
}: {
  lang: Lang;
  currentUser: AuthUser | null;
  onUserUpdate: (u: AuthUser) => void;
}) {
  const L = (en: string, urOrVars?: string | Record<string, string | number | null>) => mufL(lang, en, urOrVars);
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const flash = (ok: boolean, text: string) => {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <div className="space-y-5">
      {msg && <p className={`text-xs font-bold ${msg.ok ? 'text-emerald-600' : 'text-rose-500'}`}>{msg.text}</p>}

      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40">
        <p className="text-2xs font-bold text-slate-500 uppercase tracking-wider mb-2">{L('Profile photo')}</p>
        <AvatarUploader
          lang={lang}
          avatar={currentUser?.avatarBase64 || ''}
          fallbackLetter={(currentUser?.username || 'U')[0]}
          onSave={async (base64) => {
            const updated = await updateMe({ avatarBase64: base64 });
            onUserUpdate(updated);
            flash(true, L('Avatar updated'));
          }}
          onRemove={async () => {
            const updated = await updateMe({ avatarBase64: 'REMOVE_AVATAR' });
            onUserUpdate(updated);
            flash(true, L('Photo removed'));
          }}
        />
      </div>

      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 space-y-2">
        <p className="text-2xs font-bold text-slate-500 uppercase tracking-wider">{L('Change my password')}</p>
        <input
          type="password"
          value={curPw}
          onChange={(e) => setCurPw(e.target.value)}
          placeholder={L('Current password')}
          className="w-full text-sm px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-xl font-mono"
        />
        <input
          type="password"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          placeholder={L('New password (min 8)')}
          className="w-full text-sm px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-xl font-mono"
        />
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            if (!curPw || newPw.length < 8) {
              flash(false, L('New password must be at least 8 characters'));
              return;
            }
            setBusy(true);
            try {
              await changePassword(curPw, newPw);
              setCurPw('');
              setNewPw('');
              flash(true, L('Password updated'));
            } catch (err) {
              flash(false, err instanceof Error ? err.message : L('Could not change password'));
            } finally {
              setBusy(false);
            }
          }}
          className="text-xs font-bold px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white disabled:opacity-60"
        >
          {busy ? L('Updating…') : L('Update password')}
        </button>
      </div>
    </div>
  );
}
