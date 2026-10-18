// ─── Gaabh (Breeding) Calendar tab ───────────────────────────────
// Computed entirely by the backend (/api/breeding) from the breeding
// fields already on each cow: pregnancyDate (cross date), calvingDate,
// heatDate, dryDate. Quick actions just PUT those fields through the
// existing cows API (admin only) — nothing new is stored anywhere.
import { useEffect, useState } from 'react';
import { CalendarHeart, Baby, Droplets, Flame, RefreshCw, Repeat } from 'lucide-react';
import { api } from '../api';
import { L } from '../i18n';
import { Cow } from '../types';
import { notify } from '../muf/core/muf-confirm';
import DetailModal from '../muf/core/muf-modal';
import CowDetailPopup from './CowDetailPopup';
import type { RateHistory } from '../types';
import { todayStr } from '../utils/date';

interface BreedingInfo {
  cowId: string;
  name: string;
  breed: string;
  status: string;
  gestation: number;
  stage: 'pregnant' | 'open';
  daysPregnant: number | null;
  expectedCalving: string | null;
  daysToCalving: number | null;
  dryOffDate: string | null;
  dryOffDue: boolean;
  dried: boolean;
  lastCalving: string | null;
  daysSinceCalving: number | null;
  rebreedFrom: string | null;
  rebreedTo: string | null;
  rebreedState: 'wait' | 'window' | 'overdue' | null;
  nextHeat: string | null;
  noRecords: boolean;
}

interface Reminder {
  cowId: string;
  name: string;
  kind: 'dryoff' | 'calving' | 'rebreed' | 'heat';
  date: string;
  days: number;
  en: string;
  ur: string;
}

const KIND_ICON: Record<Reminder['kind'], string> = {
  dryoff: '🍼', calving: '🐄', rebreed: '🔁', heat: '🔥',
};

function CowImg({ src, name }: { src?: string; name: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return <div className="w-10 h-10 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-lg shrink-0">🐄</div>;
  }
  return <img src={src} alt={name} className="w-10 h-10 rounded-full object-cover border border-stone-200 dark:border-stone-700 shrink-0" onError={() => setBroken(true)} />;
}

export default function BreedingTab({ isAdmin }: { isAdmin: boolean }) {
  const [infos, setInfos] = useState<BreedingInfo[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [cowById, setCowById] = useState<Record<string, Cow>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  // Quick actions open a muf popup (DetailModal) with a date field —
  // default today, older dates allowed.
  const [pendingAction, setPendingAction] = useState<{ info: BreedingInfo; action: 'heat' | 'cross' | 'dry' | 'calved' } | null>(null);
  const [actionDate, setActionDate] = useState(todayStr());
  // muf rule: click on an animal opens its detail popup
  const [selectedCowId, setSelectedCowId] = useState<string | null>(null);
  const [rate, setRate] = useState(0);
  const [rateDate, setRateDate] = useState('');
  const [rateHistory, setRateHistory] = useState<RateHistory[]>([]);

  const load = async () => {
    try {
      const [b, cows, rateData, histData] = await Promise.all([
        api.getBreeding(), api.getCows(),
        api.getRate().catch(() => null), api.getRateHistory().catch(() => []),
      ]);
      setInfos(b.cows || []);
      setReminders(b.reminders || []);
      setCowById(Object.fromEntries((cows as Cow[]).map((c) => [c._id, c])));
      if (rateData) { setRate(rateData.value || 0); setRateDate(rateData.date || ''); }
      setRateHistory(histData as RateHistory[]);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Failed to load breeding data', 'error');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openAction = (info: BreedingInfo, action: 'heat' | 'cross' | 'dry' | 'calved') => {
    setActionDate(todayStr());
    setPendingAction({ info, action });
  };

  const actionTitle = (a: 'heat' | 'cross' | 'dry' | 'calved') =>
    a === 'heat' ? L('Heat') :
    a === 'cross' ? L('Crossed') :
    a === 'dry' ? L('Dried off') : L('Calved');

  const actionNote = (info: BreedingInfo, a: 'heat' | 'cross' | 'dry' | 'calved') =>
    a === 'heat' ? L('Next heat will be expected 21 days after this date.') :
    a === 'cross' ? L('Calving will be expected {gestation} days after this date.', { gestation: info.gestation }) :
    a === 'dry' ? L('Milking stops from this date — status becomes Dry.') :
    L('Records the calving and starts a new lactation. Add the new calf separately in the Cows tab.');

  // Each action just PUTs the cow's breeding fields through the existing
  // admin cows API — nothing new is stored anywhere.
  const saveAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingAction) return;
    const { info, action } = pendingAction;
    const cow = cowById[info.cowId];
    const data =
      action === 'heat' ? { heatDate: actionDate } :
      action === 'cross' ? { pregnancyDate: actionDate, status: 'pregnant' } :
      action === 'dry' ? { dryDate: actionDate, status: 'dry' } :
      { calvingDate: actionDate, status: 'active', lactationNumber: (cow?.lactationNumber || 0) + 1 };
    setBusy(info.cowId + action);
    try {
      await api.updateCow(info.cowId, data);
      notify(L('Saved ✓'), 'success');
      setPendingAction(null);
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed', 'error');
    } finally { setBusy(''); }
  };

  if (loading) return <div className="p-8 text-center text-slate-400 text-sm">…</div>;

  const stats = {
    pregnant: infos.filter((i) => i.stage === 'pregnant').length,
    dryoffDue: infos.filter((i) => i.dryOffDue).length,
    calvingSoon: infos.filter((i) => i.stage === 'pregnant' && (i.daysToCalving ?? 999) <= 30).length,
    rebreed: infos.filter((i) => i.rebreedState === 'window' || i.rebreedState === 'overdue').length,
  };

  const chip = 'rounded-2xl border p-3 text-center';
  const btn = 'px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition disabled:opacity-50';

  return (
    <div className="space-y-5 tab-panel">
      <div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <CalendarHeart className="w-5 h-5 text-pink-500" /> {L('Breeding Calendar')}
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          {L('Gestation: cow 283 days, buffalo 310 · dry-off 60 days before calving · heat every 21 days · re-breed 45–60 days after calving')}
        </p>
      </div>

      {/* summary chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className={`${chip} bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800`}>
          <p className="text-2xl font-black text-blue-600">{stats.pregnant}</p>
          <p className="text-[11px] font-bold text-blue-700 dark:text-blue-400">{L('Pregnant')}</p>
        </div>
        <div className={`${chip} bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800`}>
          <p className="text-2xl font-black text-amber-600">{stats.dryoffDue}</p>
          <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400">{L('Dry-off due')}</p>
        </div>
        <div className={`${chip} bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800`}>
          <p className="text-2xl font-black text-emerald-600">{stats.calvingSoon}</p>
          <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">{L('Calving ≤ 30 days')}</p>
        </div>
        <div className={`${chip} bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800`}>
          <p className="text-2xl font-black text-rose-600">{stats.rebreed}</p>
          <p className="text-[11px] font-bold text-rose-700 dark:text-rose-400">{L('Cross due')}</p>
        </div>
      </div>

      {/* upcoming reminders */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-bold text-slate-500 uppercase">{L('Next 30 days')}</p>
          <button onClick={load} className="text-slate-400 hover:text-slate-600" title={L('Refresh')}><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
        {reminders.length === 0 && (
          <p className="text-xs text-slate-400 italic">{L('Nothing due — sab theek hai.')}</p>
        )}
        <div className="space-y-1.5">
          {reminders.map((r, i) => (
            <button key={i} onClick={() => setSelectedCowId(r.cowId)} className="w-full text-left cursor-pointer flex items-center gap-2.5 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 hover:border-farm-300 dark:hover:border-farm-700 transition-colors">
              <span className="text-base">{KIND_ICON[r.kind]}</span>
              <span className="flex-1 text-slate-700 dark:text-slate-200">{L(r.en, r.ur)}</span>
              <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                r.days < 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : r.days <= 7 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              }`}>
                {r.days < 0 ? L('{v0}d late', { v0: -r.days }) : r.days === 0 ? L('Today') : L('{days}d', { days: r.days })}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* per-cow cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {infos.map((b) => {
          const cow = cowById[b.cowId];
          const pct = b.stage === 'pregnant' && b.daysPregnant !== null
            ? Math.min(100, Math.round((b.daysPregnant / b.gestation) * 100)) : 0;
          return (
            <div key={b.cowId} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <button onClick={() => setSelectedCowId(b.cowId)} className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer group">
                  <CowImg src={cow?.image} name={b.name} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate group-hover:text-farm-600 transition-colors">{b.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{b.breed}</p>
                  </div>
                </button>
                {b.stage === 'pregnant' ? (
                  <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    {b.dried ? L('Pregnant · dry') : L('Pregnant')}
                  </span>
                ) : (
                  <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {L('Open')}
                  </span>
                )}
              </div>

              {b.stage === 'pregnant' ? (
                <>
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>{L('{daysPregnant} days pregnant', { daysPregnant: b.daysPregnant })}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="text-xs space-y-1 text-slate-600 dark:text-slate-300">
                    <p className="flex items-center gap-1.5"><Baby className="w-3.5 h-3.5 text-emerald-500" />
                      {L('Calving: {expectedCalving} ({daysToCalving} days)', { expectedCalving: b.expectedCalving, daysToCalving: b.daysToCalving })}
                    </p>
                    <p className={`flex items-center gap-1.5 ${b.dryOffDue ? 'text-amber-600 dark:text-amber-400 font-bold' : ''}`}>
                      <Droplets className="w-3.5 h-3.5 text-amber-500" />
                      {b.dried
                        ? L('Dried off ✓')
                        : L('Dry off: {dryOffDate}{v1}', { dryOffDate: b.dryOffDate, v1: b.dryOffDue ? ' — due!' : '' })}
                    </p>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1.5 flex-wrap pt-0.5">
                      {!b.dried && (
                        <button disabled={busy === b.cowId + 'dry'} onClick={() => openAction(b, 'dry')}
                          className={`${btn} border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/20`}>
                          🍼 {L('Dried off')}
                        </button>
                      )}
                      <button disabled={busy === b.cowId + 'calved'} onClick={() => openAction(b, 'calved')}
                        className={`${btn} border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/20`}>
                        🐄 {L('Calved')}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="text-xs space-y-1 text-slate-600 dark:text-slate-300">
                    {b.lastCalving && (
                      <p className="flex items-center gap-1.5"><Baby className="w-3.5 h-3.5 text-slate-400" />
                        {L('Last calving: {daysSinceCalving} days ago', { daysSinceCalving: b.daysSinceCalving })}
                      </p>
                    )}
                    {b.rebreedState && (
                      <p className={`flex items-center gap-1.5 ${b.rebreedState !== 'wait' ? 'text-rose-600 dark:text-rose-400 font-bold' : ''}`}>
                        <Repeat className="w-3.5 h-3.5 text-rose-400" />
                        {b.rebreedState === 'wait'
                          ? L('Cross window: {rebreedFrom} → {rebreedTo}', { rebreedFrom: b.rebreedFrom, rebreedTo: b.rebreedTo })
                          : b.rebreedState === 'window'
                            ? L('Cross window OPEN — best time now')
                            : L('Cross overdue — get her bred')}
                      </p>
                    )}
                    {b.nextHeat && (
                      <p className="flex items-center gap-1.5"><Flame className="w-3.5 h-3.5 text-orange-400" />
                        {L('Next heat: {nextHeat}', { nextHeat: b.nextHeat })}
                      </p>
                    )}
                    {b.noRecords && (
                      <p className="text-slate-400 italic">{L('No breeding records yet')}</p>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1.5 flex-wrap pt-0.5">
                      <button disabled={busy === b.cowId + 'heat'} onClick={() => openAction(b, 'heat')}
                        className={`${btn} border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-900/20`}>
                        🔥 {L('Heat today')}
                      </button>
                      <button disabled={busy === b.cowId + 'cross'} onClick={() => openAction(b, 'cross')}
                        className={`${btn} border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/20`}>
                        💉 {L('Crossed')}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* quick-action form in a muf popup (DetailModal) */}
      <DetailModal open={!!pendingAction} onClose={() => setPendingAction(null)}
        title={pendingAction ? `${pendingAction.info.name} — ${actionTitle(pendingAction.action)}` : ''}
        icon={<CalendarHeart className="w-5 h-5" />} iconBg="bg-pink-100 text-pink-700" size="small">
        {pendingAction && (
          <form onSubmit={saveAction} className="space-y-3 text-xs">
            <p className="text-slate-500 dark:text-slate-400">{actionNote(pendingAction.info, pendingAction.action)}</p>
            <div className="space-y-1">
              <label className="text-slate-500 dark:text-slate-400">{L('Date')}</label>
              <input type="date" value={actionDate} onChange={(e) => setActionDate(e.target.value)} required
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none focus:border-farm-500" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setPendingAction(null)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg transition">{L('Cancel')}</button>
              <button type="submit" disabled={busy !== ''} className="px-4 py-2 bg-farm-600 hover:bg-farm-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition">
                {busy ? '…' : L('Save')}
              </button>
            </div>
          </form>
        )}
      </DetailModal>

      {/* animal detail popup — same popup the rest of the app uses */}
      {selectedCowId && (
        <CowDetailPopup cowId={selectedCowId} rate={rate} rateHistory={rateHistory} rateDate={rateDate} isAdmin={isAdmin} onClose={() => setSelectedCowId(null)} />
      )}

      <p className="text-[10px] text-slate-400">
        {L('Evening Telegram summary includes these reminders automatically. Tap any animal to open its full profile.')}
      </p>
    </div>
  );
}
