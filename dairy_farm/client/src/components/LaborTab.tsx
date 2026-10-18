// Field labor — named wage workers + daily attendance + month-end wage sheet.
// Cloned from agri_farm's Field Labor board; the wage math lives in the shared
// muf-labor twin so all three farm apps count days and wages identically.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { HardHat, Plus, Trash2, Loader2, CheckCircle2, Banknote, QrCode, Pencil } from 'lucide-react';
import MufCardQr from '../muf/ui/muf-card-qr';
import { api } from '../api';
import { L } from '../i18n';
import { useConfirm, notify } from '../muf/core/muf-confirm';
import { workerSummary, unpostedTotal, unsettledAdvance, payoutAfterAdvances, type MufLaborWorker, type MufAttendanceRow, type MufAdvanceRow } from '../muf/domain/muf-labor';
import DetailModal from '../muf/core/muf-modal';

interface LaborWorkerDoc { _id: string; name: string; dailyWage: number; notes?: string; }
interface AttendanceDoc { _id: string; workerId: string; date: string; dayType: 'full' | 'half'; posted?: boolean; notes?: string; }
interface AdvanceDoc { _id: string; workerId: string; date: string; amount: number; settled?: boolean; notes?: string; }

import {mufToday, mufMonth} from '../muf/data/muf-date';

// Local-timezone today — toISOString() is UTC and gives yesterday before 5 AM PKT.
const todayStr = () => mufToday();
const monthStr = () => mufMonth();
const fieldClass = 'w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-farm-500';
const labelClass = 'block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider';

const toMufWorker = (w: LaborWorkerDoc): MufLaborWorker => ({ id: w._id, name: w.name, dailyWage: w.dailyWage });
const toMufRow = (r: AttendanceDoc): MufAttendanceRow => ({ id: r._id, workerId: r.workerId, date: r.date, dayType: r.dayType, posted: r.posted });

export default function LaborTab() {
  const confirmAction = useConfirm();
  const [workers, setWorkers] = useState<LaborWorkerDoc[]>([]);
  const [attendance, setAttendance] = useState<AttendanceDoc[]>([]);
  const [month, setMonth] = useState(monthStr());
  const [busy, setBusy] = useState(false);
  const [workerForm, setWorkerForm] = useState({ name: '', dailyWage: '', notes: '' });
  const [markForm, setMarkForm] = useState({ workerId: '', date: todayStr(), dayType: 'full' as 'full' | 'half', notes: '' });
  const [advances, setAdvances] = useState<AdvanceDoc[]>([]);
  const [advanceFor, setAdvanceFor] = useState<string | null>(null); // workerId with open advance form
  const [advForm, setAdvForm] = useState({ date: todayStr(), amount: '', notes: '' });
  const [showWorkerForm, setShowWorkerForm] = useState(false);
  const [qrFor, setQrFor] = useState<{ id: string; name: string } | null>(null); // worker QR card
  const [showMarkForm, setShowMarkForm] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<AttendanceDoc | null>(null);
  const [editAtt, setEditAtt] = useState<AttendanceDoc | null>(null);
  const [editAttForm, setEditAttForm] = useState({ date: '', dayType: 'full' as 'full' | 'half', notes: '' });
  const [editAdv, setEditAdv] = useState<AdvanceDoc | null>(null);
  const [editAdvForm, setEditAdvForm] = useState({ date: '', amount: '', notes: '' });

  const load = useCallback(async (monthKey: string) => {
    try {
      const [w, a, adv] = await Promise.all([api.getLaborWorkers(), api.getLaborAttendance(monthKey), api.getLaborAdvances()]);
      setWorkers(w || []);
      setAttendance(a || []);
      setAdvances(adv || []);
      setMarkForm((prev) => (prev.workerId || !(w || []).length ? prev : { ...prev, workerId: w[0]._id }));
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Failed to load labor data', 'error');
    }
  }, []);

  useEffect(() => { load(month); }, [month, load]);

  const mufRows = useMemo(() => attendance.map(toMufRow), [attendance]);
  const summary = useMemo(
    () => workers.map((w) => ({ ...w, ...workerSummary(toMufWorker(w), mufRows) })),
    [workers, mufRows],
  );
  const unposted = useMemo(() => unpostedTotal(workers.map(toMufWorker), mufRows), [workers, mufRows]);
  const mufAdvances = useMemo<MufAdvanceRow[]>(
    () => advances.map((a) => ({ id: a._id, workerId: a.workerId, date: a.date, amount: a.amount, settled: a.settled, notes: a.notes })),
    [advances],
  );
  const payout = useMemo(() => payoutAfterAdvances(workers.map(toMufWorker), mufRows, mufAdvances), [workers, mufRows, mufAdvances]);

  async function handleGiveAdvance(workerId: string) {
    const amount = parseFloat(advForm.amount);
    if (!(amount > 0)) { notify(L('Enter an advance amount above 0.'), 'error'); return; }
    setBusy(true);
    try {
      await api.addLaborAdvance({ workerId, date: advForm.date || todayStr(), amount, notes: advForm.notes.trim() });
      notify(L('Advance recorded. It will be settled with the month-end wages.'));
      setAdvForm({ date: todayStr(), amount: '', notes: '' });
      setAdvanceFor(null);
      await load(month);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to record advance', 'error');
    } finally { setBusy(false); }
  }

  async function handleDeleteAdvance(id: string) {
    const adv = advances.find((a) => a._id === id);
    if (!adv) return;
    setBusy(true);
    try {
      await api.deleteLaborAdvance(id);
      await load(month);
      notify(L('Advance removed.'), 'success', undefined, {
        label: L('Undo'),
        fn: () => {
          api.addLaborAdvance({ workerId: adv.workerId, date: adv.date, amount: adv.amount, notes: adv.notes })
            .then(() => load(month))
            .catch(() => notify(L('Undo failed — add the advance again'), 'error'));
        },
      });
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to remove advance', 'error');
    } finally { setBusy(false); }
  }

  async function handleAddWorker(e: React.FormEvent) {
    e.preventDefault();
    if (!workerForm.name.trim()) { notify(L('Worker name is required.'), 'error'); return; }
    setBusy(true);
    try {
      await api.addLaborWorker({ name: workerForm.name.trim(), dailyWage: parseFloat(workerForm.dailyWage) || 0, notes: workerForm.notes.trim() });
      notify(L('Worker added. This is not an app login.'));
      setWorkerForm({ name: '', dailyWage: '', notes: '' });
      setShowWorkerForm(false);
      await load(month);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to add worker', 'error');
    } finally { setBusy(false); }
  }

  async function handleDeleteWorker(w: LaborWorkerDoc) {
    const ok = await confirmAction({
      title: L('Remove worker'),
      message: L('Remove {name} and their unposted attendance? Posted wage history stays in Expenses.', { name: w.name }),
      confirmLabel: L('Remove'),
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.deleteLaborWorker(w._id);
      notify(L('Worker removed.'));
      await load(month);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to remove worker', 'error');
    } finally { setBusy(false); }
  }

  async function handleMark(e: React.FormEvent) {
    e.preventDefault();
    if (!markForm.workerId) { notify(L('Pick a worker first.'), 'error'); return; }
    setBusy(true);
    try {
      await api.markLaborAttendance({ workerId: markForm.workerId, date: markForm.date || todayStr(), dayType: markForm.dayType, notes: markForm.notes.trim() });
      notify(L('Attendance saved.'));
      setShowMarkForm(false);
      setMarkForm({ workerId: '', date: todayStr(), dayType: 'full', notes: '' });
      await load(month);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save attendance', 'error');
    } finally { setBusy(false); }
  }

  async function handleDeleteAttendance(id: string) {
    const row = attendance.find((r) => r._id === id);
    if (!row) return;
    setBusy(true);
    try {
      await api.deleteLaborAttendance(id);
      await load(month);
      notify(L('Attendance removed.'), 'success', undefined, {
        label: L('Undo'),
        fn: () => {
          api.markLaborAttendance({ workerId: row.workerId, date: row.date, dayType: row.dayType, notes: row.notes })
            .then(() => load(month))
            .catch(() => notify(L('Undo failed — mark the day again'), 'error'));
        },
      });
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to remove attendance', 'error');
    } finally { setBusy(false); }
  }

  async function handleEditAttendance(e: React.FormEvent) {
    e.preventDefault();
    if (!editAtt) return;
    setBusy(true);
    try {
      await api.updateLaborAttendance(editAtt._id, { date: editAttForm.date, dayType: editAttForm.dayType, notes: editAttForm.notes });
      setEditAtt(null);
      notify(L('Attendance updated.'));
      await load(month);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update attendance', 'error');
    } finally { setBusy(false); }
  }

  async function handleEditAdvance(e: React.FormEvent) {
    e.preventDefault();
    if (!editAdv) return;
    const amount = parseFloat(editAdvForm.amount);
    if (!amount || amount <= 0) { notify(L('Enter a valid amount'), 'error'); return; }
    setBusy(true);
    try {
      await api.updateLaborAdvance(editAdv._id, { date: editAdvForm.date, amount, notes: editAdvForm.notes });
      setEditAdv(null);
      notify(L('Advance updated.'));
      await load(month);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update advance', 'error');
    } finally { setBusy(false); }
  }

  async function handlePostMonth() {
    const ok = await confirmAction({
      title: L('Post wages to Expenses'),
      message: L('Post unposted {month} attendance as one labor expense of about Rs. {amount}?', { month, amount: Math.round(unposted).toLocaleString() }),
      confirmLabel: L('Post wages'),
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await api.postLaborWages(month);
      notify(res.note || L('Wages posted to Expenses.'));
      await load(month);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to post wages', 'error');
    } finally { setBusy(false); }
  }

  const visibleRows = useMemo(
    () => [...attendance].sort((a, b) => b.date.localeCompare(a.date)),
    [attendance],
  );

  return (
    <div className="space-y-5">
      <div className="muf-page-hero">
        <div className="muf-page-title">
          <div className="muf-title-icon"><HardHat size={28}/></div>
          <div>
            <h2>{L('Labor')}</h2>
            <p>{L('Daily attendance and the monthly wage sheet — not app logins.')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold text-slate-500 uppercase">{L('Month')}</label>
          <input type="month" className={fieldClass} style={{ width: 'auto' }} value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Workers + wage sheet */}
        <section className="muf-panel p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200"><HardHat className="w-4 h-4" /> {L('Workers')}</h3>
            <button type="button" onClick={() => setShowWorkerForm(true)} className="muf-primary-action small">
              <Plus className="w-3.5 h-3.5" /> {L('Add worker')}
            </button>
          </div>
          <div className="space-y-2">
            {summary.length === 0 && <p className="text-xs text-slate-400 italic">{L('No workers yet.')}</p>}
            {summary.map((w) => (
              <div key={w._id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{w.name}</p>
                    <p className="text-[11px] text-slate-500">Rs. {Number(w.dailyWage || 0).toLocaleString()} / {L('day')} · {w.days || 0} {L('days this month')}</p>
                    {w.notes && <p className="text-[11px] text-slate-500">{w.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1">
<button type="button" onClick={() => setQrFor({ id: w._id, name: w._id })} className="p-1 rounded text-slate-400 hover:text-emerald-600 transition" aria-label={L('QR card')} title={L('QR card')}>
                    <QrCode className="w-4 h-4" />
                  </button>
<button type="button" onClick={() => handleDeleteWorker(w)} className="p-1 rounded text-slate-400 hover:text-red-500 transition" aria-label={L('Remove worker')}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                  </div>
                </div>
                <p className="text-[11px] font-bold mt-1 text-farm-700 dark:text-farm-400">
                  {L('Unpaid')}: {w.unpostedDays || 0}d · Rs. {Math.round(w.wageDue).toLocaleString()}
                  {unsettledAdvance(mufAdvances, w._id) > 0 && (
                    <span className="ml-2 text-amber-600">
                      − {L('advance')} Rs. {unsettledAdvance(mufAdvances, w._id).toLocaleString()}
                    </span>
                  )}
                </p>
                <div className="mt-1.5">
                  <button
                    type="button"
                    onClick={() => { setAdvanceFor(w._id); setAdvForm({ date: todayStr(), amount: '', notes: '' }); }}
                    className="text-[11px] font-bold text-amber-600 hover:text-amber-700 transition"
                  >{L('+ Give advance')}</button>
                  {advances.filter((a) => a.workerId === w._id && !a.settled).map((a) => (
                    <div key={a._id} className="flex items-center justify-between gap-2 mt-1.5 text-[11px] p-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                      <span className="text-slate-500">{a.date} · Rs. {a.amount.toLocaleString()}{a.notes ? ` · ${a.notes}` : ''}</span>
                      <span className="flex items-center gap-0.5">
                        <button type="button" onClick={() => { setEditAdv(a); setEditAdvForm({ date: a.date, amount: String(a.amount), notes: a.notes || '' }); }} className="p-0.5 rounded text-amber-500 hover:text-farm-600 transition" aria-label={L('Edit advance')}>
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button type="button" onClick={() => handleDeleteAdvance(a._id)} className="p-0.5 rounded text-amber-400 hover:text-red-500 transition" aria-label={L('Delete advance')}>
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Mark attendance + list */}
        <section className="muf-panel p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">{L('Mark attendance')}</h3>
            <button type="button" onClick={() => setShowMarkForm(true)} className="muf-primary-action small">
              <Plus className="w-3.5 h-3.5" /> {L('Mark attendance')}
            </button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {visibleRows.length === 0 && <p className="text-xs text-slate-400 italic">{L('No attendance in this month.')}</p>}
            {visibleRows.map((row) => {
              const worker = workers.find((w) => w._id === row.workerId);
              return (
                <div key={row._id} className="flex justify-between items-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 text-xs">
                  <button
                    type="button"
                    aria-label={L('View attendance details') + ': ' + row.date + ' · ' + (worker?.name || L('Worker'))}
                    onClick={() => setSelectedAttendance(row)}
                    className="min-w-0 flex-1 text-left rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-farm-500"
                  >
                    <span className="block font-bold text-slate-700 dark:text-slate-200">{row.date} · {worker?.name || L('Worker')} · {row.dayType === 'half' ? L('Half') : L('Full')}</span>
                    <span className="block text-[10px] text-slate-500">{row.posted ? L('Posted to expenses') : L('Unposted attendance')}{row.notes?.trim() ? ' · ' + L('View notes') : ''}</span>
                  </button>
                  {!row.posted && (
                    <span className="flex items-center gap-0.5">
                      <button type="button" onClick={() => { setEditAtt(row); setEditAttForm({ date: row.date, dayType: row.dayType, notes: row.notes || '' }); }} className="p-1 rounded text-slate-400 hover:text-farm-600 transition" aria-label={L('Edit attendance')}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => handleDeleteAttendance(row._id)} className="p-1 rounded text-slate-400 hover:text-red-500 transition" aria-label={L('Delete attendance')}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <DetailModal
        open={!!selectedAttendance}
        onClose={() => setSelectedAttendance(null)}
        title={L('Attendance details')}
        subtitle={selectedAttendance?.date || ''}
        size="small"
      >
        {selectedAttendance && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-2.5">
                <p className="text-[10px] font-bold uppercase text-slate-500">{L('Worker')}</p>
                <p className="font-bold text-slate-800 dark:text-slate-100">{workers.find((w) => w._id === selectedAttendance.workerId)?.name || L('Worker')}</p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-2.5">
                <p className="text-[10px] font-bold uppercase text-slate-500">{L('Attendance')}</p>
                <p className="font-bold text-slate-800 dark:text-slate-100">{selectedAttendance.dayType === 'half' ? L('Half day') : L('Full day')}</p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-2.5">
                <p className="text-[10px] font-bold uppercase text-slate-500">{L('Status')}</p>
                <p className="font-bold text-slate-800 dark:text-slate-100">{selectedAttendance.posted ? L('Posted to expenses') : L('Not posted')}</p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-2.5">
                <p className="text-[10px] font-bold uppercase text-slate-500">{L('Date')}</p>
                <p className="font-bold text-slate-800 dark:text-slate-100">{selectedAttendance.date}</p>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
              <p className="text-[10px] font-bold uppercase text-slate-500 mb-1">{L('Notes')}</p>
              <p className="whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200">{selectedAttendance.notes?.trim() || L('No notes recorded.')}</p>
            </div>
          </div>
        )}
      </DetailModal>

      {/* Month-end posting */}
      <section className="muf-panel p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">{L('Month-end wage sheet')}</h3>
          <p className="text-xs text-slate-500">
            {L('Unpaid {month} wages', { month: month })}: Rs. {Math.round(unposted).toLocaleString()}
            {payout.advances > 0 && (
              <span className="text-amber-600"> − {L('advances')} Rs. {payout.advances.toLocaleString()} = <span className="font-bold">{L('cash payable')} Rs. {payout.payable.toLocaleString()}</span></span>
            )}
          </p>
        </div>
        <button
          type="button"
          disabled={busy || unposted <= 0}
          onClick={handlePostMonth}
          className="px-4 py-2 bg-farm-600 hover:bg-farm-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition"
        >
          <CheckCircle2 className="w-4 h-4" /> {L('Post {month} to Expenses', { month: month })}
        </button>
      </section>

      {/* ── Add Worker (popup) ────────────────── */}
      <DetailModal open={showWorkerForm} onClose={() => setShowWorkerForm(false)}
        title={L('Add worker')} icon={<HardHat className="w-5 h-5" />} iconBg="bg-farm-100 text-farm-700" size="small">
        <form onSubmit={handleAddWorker} className="space-y-3">
          <div>
            <label className={labelClass}>{L('Name *')}</label>
            <input className={fieldClass} value={workerForm.name} onChange={(e) => setWorkerForm({ ...workerForm, name: e.target.value })} placeholder={L('e.g. Akram')} />
          </div>
          <div>
            <label className={labelClass}>{L('Daily wage (Rs.)')}</label>
            <input type="number" step="any" min="0" className={fieldClass} value={workerForm.dailyWage} onChange={(e) => setWorkerForm({ ...workerForm, dailyWage: e.target.value })} placeholder="700" />
          </div>
          <div>
            <label className={labelClass}>{L('Notes')}</label>
            <input className={fieldClass} value={workerForm.notes} onChange={(e) => setWorkerForm({ ...workerForm, notes: e.target.value })} placeholder={L('Optional role')} />
          </div>
          <div className="muf-pc-actions">
            <button type="button" onClick={() => setShowWorkerForm(false)} className="muf-pc-btn-ghost">{L('Cancel')}</button>
            <button type="submit" disabled={busy} className="px-4 py-2 bg-farm-600 hover:bg-farm-700 disabled:opacity-60 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} {L('Add worker')}
            </button>
          </div>
        </form>
      </DetailModal>

      {/* ── Mark Attendance (popup) ───────────── */}
      <DetailModal open={showMarkForm} onClose={() => setShowMarkForm(false)}
        title={L('Mark attendance')} icon={<CheckCircle2 className="w-5 h-5" />} iconBg="bg-farm-100 text-farm-700" size="small">
        <form onSubmit={handleMark} className="space-y-3">
          <div>
            <label className={labelClass}>{L('Worker *')}</label>
            <select className={fieldClass} value={markForm.workerId} onChange={(e) => setMarkForm({ ...markForm, workerId: e.target.value })}>
              <option value="">{L('Select worker')}</option>
              {workers.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>{L('Date')}</label>
            <input type="date" className={fieldClass} value={markForm.date} onChange={(e) => setMarkForm({ ...markForm, date: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>{L('Day')}</label>
            <select className={fieldClass} value={markForm.dayType} onChange={(e) => setMarkForm({ ...markForm, dayType: e.target.value as 'full' | 'half' })}>
              <option value="full">{L('Full day')}</option>
              <option value="half">{L('Half day')}</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>{L('Notes')}</label>
            <input className={fieldClass} value={markForm.notes} onChange={(e) => setMarkForm({ ...markForm, notes: e.target.value })} />
          </div>
          <div className="muf-pc-actions">
            <button type="button" onClick={() => setShowMarkForm(false)} className="muf-pc-btn-ghost">{L('Cancel')}</button>
            <button type="submit" disabled={busy} className="px-4 py-2 bg-farm-600 hover:bg-farm-700 disabled:opacity-60 text-white text-xs font-bold rounded-lg transition">
              {L('Save attendance')}
            </button>
          </div>
        </form>
      </DetailModal>

      {/* ── Give Advance (popup) ──────────────── */}
      <DetailModal open={advanceFor !== null} onClose={() => setAdvanceFor(null)}
        title={L('Give advance')} icon={<Banknote className="w-5 h-5" />} iconBg="bg-amber-100 text-amber-700" size="small">
        <div className="space-y-3">
          <div>
            <label className={labelClass}>{L('Date')}</label>
            <input type="date" value={advForm.date} onChange={(e) => setAdvForm({ ...advForm, date: e.target.value })} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>{L('Amount (Rs.) *')}</label>
            <input type="number" min="0" step="any" placeholder={L('Amount (Rs.) *')} value={advForm.amount} onChange={(e) => setAdvForm({ ...advForm, amount: e.target.value })} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>{L('Note')}</label>
            <input placeholder={L('Note')} value={advForm.notes} onChange={(e) => setAdvForm({ ...advForm, notes: e.target.value })} className={fieldClass} />
          </div>
          <div className="muf-pc-actions">
            <button type="button" onClick={() => setAdvanceFor(null)} className="muf-pc-btn-ghost">{L('Cancel')}</button>
            <button type="button" disabled={busy || !advanceFor} onClick={() => advanceFor && handleGiveAdvance(advanceFor)} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-xs font-bold rounded-lg transition">
              {L('Save advance')}
            </button>
          </div>
        </div>
      </DetailModal>


      {/* ── Edit Attendance (popup) ───────────── */}
      <DetailModal open={!!editAtt} onClose={() => setEditAtt(null)}
        title={L('Edit attendance')} icon={<Pencil className="w-5 h-5" />} iconBg="bg-farm-100 text-farm-700" size="small">
        <form onSubmit={handleEditAttendance} className="space-y-3">
          <div>
            <label className={labelClass}>{L('Date')}</label>
            <input type="date" className={fieldClass} value={editAttForm.date} onChange={(e) => setEditAttForm({ ...editAttForm, date: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>{L('Day type')}</label>
            <select className={fieldClass} value={editAttForm.dayType} onChange={(e) => setEditAttForm({ ...editAttForm, dayType: e.target.value as 'full' | 'half' })}>
              <option value="full">{L('Full day')}</option>
              <option value="half">{L('Half day')}</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>{L('Notes')}</label>
            <input className={fieldClass} value={editAttForm.notes} onChange={(e) => setEditAttForm({ ...editAttForm, notes: e.target.value })} />
          </div>
          <div className="muf-pc-actions">
            <button type="button" onClick={() => setEditAtt(null)} className="muf-pc-btn-ghost">{L('Cancel')}</button>
            <button type="submit" disabled={busy} className="px-4 py-2 bg-farm-600 hover:bg-farm-700 disabled:opacity-60 text-white text-xs font-bold rounded-lg transition">{L('Save changes')}</button>
          </div>
        </form>
      </DetailModal>

      {/* ── Edit Advance (popup) ───────────────── */}
      <DetailModal open={!!editAdv} onClose={() => setEditAdv(null)}
        title={L('Edit advance')} icon={<Pencil className="w-5 h-5" />} iconBg="bg-amber-100 text-amber-700" size="small">
        <form onSubmit={handleEditAdvance} className="space-y-3">
          <div>
            <label className={labelClass}>{L('Date')}</label>
            <input type="date" className={fieldClass} value={editAdvForm.date} onChange={(e) => setEditAdvForm({ ...editAdvForm, date: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>{L('Amount (Rs.)')}</label>
            <input type="number" step="any" min="1" className={fieldClass} value={editAdvForm.amount} onChange={(e) => setEditAdvForm({ ...editAdvForm, amount: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>{L('Notes')}</label>
            <input className={fieldClass} value={editAdvForm.notes} onChange={(e) => setEditAdvForm({ ...editAdvForm, notes: e.target.value })} />
          </div>
          <div className="muf-pc-actions">
            <button type="button" onClick={() => setEditAdv(null)} className="muf-pc-btn-ghost">{L('Cancel')}</button>
            <button type="submit" disabled={busy} className="px-4 py-2 bg-farm-600 hover:bg-farm-700 disabled:opacity-60 text-white text-xs font-bold rounded-lg transition">{L('Save changes')}</button>
          </div>
        </form>
      </DetailModal>
    <MufCardQr open={!!qrFor} onClose={() => setQrFor(null)} kind="worker" id={qrFor?.id} name={qrFor?.name} />
      </div>
    );
  }
