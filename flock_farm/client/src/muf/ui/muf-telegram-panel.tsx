// muf shared Telegram bot admin panel — generate link codes, see linked workers.
// The bot itself lives in the backend (routes/telegram.js + muf-telegram twin).
// Each app injects its own `adapter` (API plumbing differs per app) plus its
// domain copy (worker command examples, optional production-drop alarm).
import { useEffect, useState } from 'react';
import { Send, RefreshCw, X } from 'lucide-react';
import { mufL } from '../data/muf-urdu';

interface TgStatus {
  configured: boolean;
  botUsername: string | null;
  links: { chatId: string; username?: string; laborerName?: string; tgName?: string }[];
}

/** App-specific API plumbing — all methods resolve to unwrapped data. */
export interface MufTelegramAdapter {
  status(): Promise<TgStatus | null>;
  listUsers(): Promise<any[]>;
  listWorkers(): Promise<any[]>;
  settings(): Promise<{ dailySummary: boolean; dropPct?: number } | null>;
  saveSettings(s: { dailySummary: boolean; dropPct?: number }): Promise<{ dailySummary: boolean; dropPct?: number } | null>;
  linkCode(opts: { userId?: string; laborerId?: string }): Promise<{ code: string }>;
  unlink(chatId: string): Promise<unknown>;
  sendSummary(): Promise<{ sent?: number; reason?: string }>;
}

interface MufTelegramPanelProps {
  lang: 'en' | 'ur' | 'roman';
  adapter: MufTelegramAdapter;
  /** Example worker commands shown in the blurb (English; Urdu from MUF_URDU). */
  blurbEn: string;
  /** Optional production-drop alarm (dairy/flock). Omit for apps without a daily production number. */
  alarm?: { titleEn: string; labelEn: string; defaultPct: string };
  /** Cron endpoint mentioned in the footer hint (differs per app). */
  cronPath: string;
}

export default function TelegramPanel({ lang, adapter, blurbEn, alarm, cronPath }: MufTelegramPanelProps) {
  const L = (en: string, urOrVars?: string | Record<string, string | number | null | undefined>) => mufL(lang, en, urOrVars);
  const [status, setStatus] = useState<TgStatus | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [selUser, setSelUser] = useState('');
  const [selWorker, setSelWorker] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // Evening auto-summary (+ production-drop alarm when provided) settings
  const [cfg, setCfg] = useState<{ dailySummary: boolean; dropPct?: number } | null>(null);
  const [pctDraft, setPctDraft] = useState(alarm?.defaultPct || '20');
  const [saveMsg, setSaveMsg] = useState('');
  const [sending, setSending] = useState(false);

  const load = () => {
    adapter.status().then(setStatus).catch(() => setStatus(null));
    adapter.listUsers().then(setUsers).catch(() => setUsers([]));
    adapter.listWorkers().then(setWorkers).catch(() => setWorkers([]));
    adapter.settings().then((s) => { setCfg(s); if (s?.dropPct != null) setPctDraft(String(s.dropPct)); }).catch(() => setCfg(null));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const flash = (m: string) => { setSaveMsg(m); setTimeout(() => setSaveMsg(''), 5000); };

  const saveCfg = async () => {
    if (!cfg) return;
    try {
      const next = await adapter.saveSettings({ dailySummary: cfg.dailySummary, dropPct: alarm ? (Number(pctDraft) || cfg.dropPct) : undefined });
      setCfg(next);
      if (alarm && next?.dropPct != null) setPctDraft(String(next.dropPct));
      flash(L('✅ Saved'));
    } catch (e: any) { flash(e?.response?.data?.detail || e.message || 'Failed'); }
  };

  const sendNow = async () => {
    setSending(true);
    try {
      const r = await adapter.sendSummary();
      if ((r.sent || 0) > 0) flash(L('✅ Summary sent ({sent})', { sent: r.sent }));
      else if (r.reason === 'no linked admin chat') flash(L('No admin linked yet — link your own admin login above first.'));
      else flash(L('Not sent — {v0}', { v0: r.reason || '' }));
    } catch (e: any) { flash(e?.response?.data?.detail || e.message || 'Failed'); }
    finally { setSending(false); }
  };

  const makeCode = async () => {
    setBusy(true); setErr(''); setCode(null);
    try {
      const r = await adapter.linkCode({ userId: selUser || undefined, laborerId: selWorker || undefined });
      setCode(r.code);
    } catch (e: any) { setErr(e?.response?.data?.detail || e.message || 'Failed'); }
    finally { setBusy(false); }
  };

  const unlink = async (chatId: string) => {
    try { await adapter.unlink(chatId); load(); } catch { /* ignore */ }
  };

  const selectClass = 'w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 outline-none';

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2"><Send className="w-4 h-4 text-sky-500" /> {L('Telegram Bot')}</h3>
        <p className="text-[11px] text-slate-400 mt-0.5">{L(blurbEn)}</p>
      </div>

      {!status?.configured ? (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-400">
          {L('Not configured yet. Make a bot with @BotFather on Telegram, then add TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET (any long random text) in Replit Secrets and redeploy.')}
        </div>
      ) : (
        <>
          {status.botUsername && (
            <p className="text-xs text-slate-500">{L('Bot')}: <a className="font-bold text-sky-600" href={`https://t.me/${status.botUsername}`} target="_blank" rel="noreferrer">@{status.botUsername}</a></p>
          )}

          {/* generate code */}
          <div className="muf-panel-soft space-y-2">
            <p className="text-[11px] font-bold text-slate-500 uppercase">{L('Link a worker')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select className={selectClass} value={selUser} onChange={(e) => setSelUser(e.target.value)}>
                <option value="">{L('App login (optional)')}</option>
                {users.map((u) => <option key={u._id || u.id} value={u._id || u.id}>{u.username}</option>)}
              </select>
              <select className={selectClass} value={selWorker} onChange={(e) => setSelWorker(e.target.value)}>
                <option value="">{L('Wage worker — for hazri (optional)')}</option>
                {workers.map((w) => <option key={w._id || w.id} value={w._id || w.id}>{w.name}</option>)}
              </select>
            </div>
            <button onClick={makeCode} disabled={busy || (!selUser && !selWorker)} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition">
              {busy ? '…' : L('Make link code')}
            </button>
            {err && <p className="text-[11px] text-red-500">{err}</p>}
            {code && (
              <div className="bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800 rounded-lg p-3 text-center">
                <p className="text-2xl font-black tracking-[0.3em] text-sky-600">{code}</p>
                <p className="text-[11px] text-slate-500 mt-1">{L('Worker opens the bot on Telegram and sends:')} <span className="font-mono font-bold">/start {code}</span></p>
                <p className="text-[10px] text-slate-400">{L('Valid for 15 minutes')}</p>
              </div>
            )}
          </div>

          {/* linked list */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-slate-500 uppercase">{L('Linked')} ({status.links.length})</p>
              <button onClick={load} className="text-slate-400 hover:text-slate-600" title={L('Refresh')}><RefreshCw className="w-3.5 h-3.5" /></button>
            </div>
            {status.links.length === 0 && <p className="text-xs text-slate-400 italic">{L('Nobody linked yet.')}</p>}
            {status.links.map((l) => (
              <div key={l.chatId} className="flex items-center gap-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2">
                <span className="font-bold text-slate-700 dark:text-slate-200">{l.laborerName || l.username || l.chatId}</span>
                {l.tgName && <span className="text-slate-400">· TG: {l.tgName}</span>}
                <button onClick={() => unlink(l.chatId)} className="ml-auto text-slate-400 hover:text-red-500" title={L('Unlink')}><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>

          {/* evening auto-summary (+ production-drop alarm when provided) */}
          <div className="muf-panel-soft space-y-2">
            <p className="text-[11px] font-bold text-slate-500 uppercase">{alarm ? L(alarm.titleEn) : L('Evening summary')}</p>
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-sky-600" checked={cfg?.dailySummary ?? true} onChange={(e) => cfg && setCfg({ ...cfg, dailySummary: e.target.checked })} />
              {L("Send me the day's summary on Telegram every evening")}
            </label>
            {alarm && (
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 flex-wrap">
                <span>{L(alarm.labelEn)}</span>
                <input type="number" min={5} max={90} value={pctDraft} onChange={(e) => setPctDraft(e.target.value)} className="w-16 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-center outline-none" />
                <span>{L('% below the 7-day average')}</span>
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={saveCfg} disabled={!cfg} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition">{L('Save')}</button>
              <button onClick={sendNow} disabled={sending} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition">{sending ? '…' : L('Send summary now')}</button>
            </div>
            {saveMsg && <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{saveMsg}</p>}
            <p className="text-[10px] text-slate-400">{L('Summary goes to linked ADMIN logins only. For the evening auto-send, add a free cron-job.org job that opens {path} every evening.', { path: cronPath })}</p>
          </div>
        </>
      )}
    </div>
  );
}
