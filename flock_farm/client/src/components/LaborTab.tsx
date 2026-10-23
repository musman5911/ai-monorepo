// Field labor — named wage workers + daily attendance + month-end wage sheet.
// Cloned from agri_farm's Field Labor board; the wage math lives in the shared
// muf-labor twin so all three farm apps count days and wages identically.
// Data lives in the 'laborers' + 'laborAttendance' buckets (admin-only write);
// posting a month appends ONE labor expense to the normal expenses ledger.
import React, { useEffect, useMemo, useState } from 'react';
import { mufL } from '../muf/data/muf-urdu';
import { listBatches } from '../api';
import type { BatchWithSummary } from '../types';
import { HardHat, Plus, Trash2, CheckCircle2, QrCode, Pencil } from 'lucide-react';
import MufCardQr from '../muf/ui/muf-card-qr';
import DetailModal from '../muf/core/muf-modal';
import { Lang, LaborWorker, LaborAttendanceEntry, LaborAdvanceEntry, OtherExpense } from '../types';
import { notify, useConfirm } from '../muf/core/muf-confirm';
import {
  workerSummary,
  unpostedTotal,
  buildWageSheet,
  wageNote,
  wagePostDate,
  monthRows,
  unsettledAdvance,
  payoutAfterAdvances,
  MufLaborWorker,
  MufAttendanceRow,
  MufAdvanceRow,
} from '../muf/domain/muf-labor';

interface LaborTabProps {
  lang: Lang;
  workers: LaborWorker[];
  attendance: LaborAttendanceEntry[];
  advances: LaborAdvanceEntry[];
  onChangeWorkers: (next: LaborWorker[]) => void;
  onChangeAttendance: (next: LaborAttendanceEntry[]) => void;
  onChangeAdvances: (next: LaborAdvanceEntry[]) => void;
  onAddExpense: (expense: Omit<OtherExpense, 'id'>) => void;
}

import {mufToday, mufMonth} from '../muf/data/muf-date';

// Local-timezone today — toISOString() is UTC and gives yesterday before 5 AM PKT.
const todayStr = () => mufToday();
const monthStr = () => mufMonth();
const fieldClass = 'w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-950 outline-none focus:border-emerald-500';
const labelClass = 'block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider';

const toMufWorker = (w: LaborWorker): MufLaborWorker => ({ id: w.id, name: w.name, dailyWage: w.dailyWage });
const toMufRow = (r: LaborAttendanceEntry): MufAttendanceRow => ({ id: r.id, workerId: r.workerId, date: r.date, dayType: r.dayType, posted: r.posted });

export default function LaborTab({ lang, workers, attendance, advances, onChangeWorkers, onChangeAttendance, onChangeAdvances, onAddExpense }: LaborTabProps) {
  const L = (en: string, urOrVars?: string | Record<string, string | number | null>) => mufL(lang, en, urOrVars);
  const confirmAction = useConfirm();
  const [laborBatchRows, setLaborBatchRows] = useState<BatchWithSummary[]>([]);
  const [laborBatchUnavailable, setLaborBatchUnavailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    listBatches().then(rows => {
      if (!cancelled) { setLaborBatchRows(rows); setLaborBatchUnavailable(false); }
    }).catch(() => { if (!cancelled) setLaborBatchUnavailable(true); });
    return () => { cancelled = true; };
  }, []);
  const [month, setMonth] = useState(monthStr());
  const [workerForm, setWorkerForm] = useState({ name: '', dailyWage: '', notes: '' });
  const [markForm, setMarkForm] = useState({ workerId: '', date: todayStr(), dayType: 'full' as 'full' | 'half', notes: '' });
  const [advanceFor, setAdvanceFor] = useState<string | null>(null);
  const [qrFor, setQrFor] = useState<{ id: string; name: string } | null>(null);
  const [advForm, setAdvForm] = useState({ date: todayStr(), amount: '', notes: '' });
  const [editingWorker, setEditingWorker] = useState<LaborWorker | null>(null);
  const [editWorkerForm, setEditWorkerForm] = useState({ name: '', dailyWage: '', notes: '' });
  const [editAdvId, setEditAdvId] = useState<string | null>(null);
  const [editAtt, setEditAtt] = useState<LaborAttendanceEntry | null>(null);
  const [editAttForm, setEditAttForm] = useState({ date: '', dayType: 'full' as 'full' | 'half', notes: '' });
  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);
  const [showMarkAttModal, setShowMarkAttModal] = useState(false);

  const rowsThisMonth = useMemo(() => monthRows(attendance, month), [attendance, month]);
  const mufRows = useMemo(() => rowsThisMonth.map(toMufRow), [rowsThisMonth]);
  const summary = useMemo(
    () => workers.map((w) => ({ ...w, ...workerSummary(toMufWorker(w), mufRows) })),
    [workers, mufRows],
  );
  const unposted = useMemo(() => unpostedTotal(workers.map(toMufWorker), mufRows), [workers, mufRows]);
  const mufAdvances = useMemo<MufAdvanceRow[]>(
    () => advances.map((a) => ({ id: a.id, workerId: a.workerId, date: a.date, amount: a.amount, settled: a.settled, notes: a.notes })),
    [advances],
  );
  const payout = useMemo(() => payoutAfterAdvances(workers.map(toMufWorker), mufRows, mufAdvances), [workers, mufRows, mufAdvances]);

  function handleGiveAdvance(workerId: string) {
    const amount = parseFloat(advForm.amount);
    if (!(amount > 0)) { notify(L('Enter an advance amount above 0.'), 'error'); return; }
    if (editAdvId) {
      onChangeAdvances(advances.map((a) => (a.id === editAdvId ? { ...a, date: advForm.date || todayStr(), amount, notes: advForm.notes.trim() } : a)));
      setEditAdvId(null);
      notify(L('Advance updated.'));
    } else {
      onChangeAdvances([
        ...advances,
        { id: `lv-${Date.now()}`, workerId, date: advForm.date || todayStr(), amount, settled: false, notes: advForm.notes.trim() },
      ]);
      notify(L('Advance recorded. It will be settled with the month-end wages.'));
    }
    setAdvForm({ date: todayStr(), amount: '', notes: '' });
    setAdvanceFor(null);
  }

  function handleSaveWorkerEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingWorker) return;
    if (!editWorkerForm.name.trim()) { notify(L('Worker name is required.'), 'error'); return; }
    onChangeWorkers(workers.map((w) => (w.id === editingWorker.id ? { ...w, name: editWorkerForm.name.trim(), dailyWage: parseFloat(editWorkerForm.dailyWage) || 0, notes: editWorkerForm.notes.trim() } : w)));
    setEditingWorker(null);
    notify(L('Worker updated.'));
  }

  function handleSaveAttEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editAtt) return;
    const date = editAttForm.date;
    const clash = attendance.find((r) => r.workerId === editAtt.workerId && r.date === date && r.id !== editAtt.id);
    if (clash) { notify(L('This worker already has attendance on that date.'), 'error'); return; }
    onChangeAttendance(attendance.map((r) => (r.id === editAtt.id ? { ...r, date, dayType: editAttForm.dayType, notes: editAttForm.notes.trim() } : r)));
    setEditAtt(null);
    notify(L('Attendance updated.'));
  }

  function handleDeleteAdvance(id: string) {
    const adv = advances.find((a) => a.id === id);
    if (!adv) return;
    onChangeAdvances(advances.filter((a) => a.id !== id));
    notify(L('Advance removed.'), 'success', undefined, {
      label: L('Undo'),
      fn: () => onChangeAdvances([...advances, adv]),
    });
  }

  function handleAddWorker(e: React.FormEvent) {
    e.preventDefault();
    if (!workerForm.name.trim()) { notify(L('Worker name is required.'), 'error'); return; }
    onChangeWorkers([
      ...workers,
      { id: `lw-${Date.now()}`, name: workerForm.name.trim(), dailyWage: parseFloat(workerForm.dailyWage) || 0, notes: workerForm.notes.trim() },
    ]);
    setWorkerForm({ name: '', dailyWage: '', notes: '' });
    setShowAddWorkerModal(false);
    notify(L('Worker added. This is not an app login.'));
  }

  async function handleDeleteWorker(w: LaborWorker) {
    const ok = await confirmAction({
      title: L('Remove worker'),
      message: L('Remove {name} and their unposted attendance? Posted wage history stays in the ledger.', { name: w.name }),
      confirmLabel: L('Remove'),
      tone: 'danger',
    });
    if (!ok) return;
    const removedAtt = attendance.filter((r) => r.workerId === w.id && !r.posted);
    onChangeWorkers(workers.filter((x) => x.id !== w.id));
    onChangeAttendance(attendance.filter((r) => r.workerId !== w.id || r.posted));
    notify(L('Worker removed.'), 'success', undefined, {
      label: L('Undo'),
      fn: () => {
        onChangeWorkers([...workers, w]);
        onChangeAttendance([...attendance, ...removedAtt]);
      },
    });
  }

  function handleMark(e: React.FormEvent) {
    e.preventDefault();
    if (!markForm.workerId) { notify(L('Pick a worker first.'), 'error'); return; }
    const date = markForm.date || todayStr();
    const existing = attendance.find((r) => r.workerId === markForm.workerId && r.date === date);
    if (existing?.posted) { notify(L('This day is already posted to the wages ledger.'), 'error'); return; }
    if (existing) {
      onChangeAttendance(attendance.map((r) => (r.id === existing.id ? { ...r, dayType: markForm.dayType, notes: markForm.notes.trim() } : r)));
    } else {
      onChangeAttendance([
        ...attendance,
        { id: `la-${Date.now()}`, workerId: markForm.workerId, date, dayType: markForm.dayType, posted: false, notes: markForm.notes.trim() },
      ]);
    }
    setShowMarkAttModal(false);
    notify(L('Attendance saved.'));
  }

  function handleDeleteAttendance(id: string) {
    const row = attendance.find((r) => r.id === id);
    if (!row) return;
    onChangeAttendance(attendance.filter((r) => r.id !== id));
    notify(L('Attendance removed.'), 'success', undefined, {
      label: L('Undo'),
      fn: () => onChangeAttendance([...attendance, row]),
    });
  }

  async function handlePostMonth() {
    const sheet = buildWageSheet(workers.map(toMufWorker), mufRows);
    if (sheet.total <= 0) { notify(L('Wage total is 0. Set daily wages on workers first.'), 'error'); return; }
    const ok = await confirmAction({
      title: L('Post wages to the ledger'),
      message: L('Post unposted {month} attendance as one labor expense of Rs. {amount}?', { month, amount: Math.round(sheet.total).toLocaleString() }),
      confirmLabel: L('Post wages'),
    });
    if (!ok) return;
    onAddExpense({
      date: wagePostDate(month),
      detail: L('Labor wages {month}', { month: month }),
      category: 'Other',
      amount: sheet.total,
      notes: wageNote(month, sheet.lines),
    });
    const postedIds = new Set(mufRows.filter((r) => !r.posted).map((r) => r.id));
    onChangeAttendance(attendance.map((r) => (postedIds.has(r.id) ? { ...r, posted: true } : r)));
    // Advances were early payment of these wages — settle them now.
    onChangeAdvances(advances.map((a) => (a.settled ? a : { ...a, settled: true })));
    notify(wageNote(month, sheet.lines));
  }

  const visibleRows = useMemo(
    () => [...rowsThisMonth].sort((a, b) => b.date.localeCompare(a.date)),
    [rowsThisMonth],
  );

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{L('Batch workload context')}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{L('Use current batch size when planning daily farm labor')}</p>
        </div>
        {laborBatchUnavailable ? <p role="status" className="text-xs text-amber-700 dark:text-amber-300">{L('Batch workload data is unavailable right now.')}</p> : <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-3"><p className="text-[10px] uppercase tracking-wide text-slate-500">{L('Active batches')}</p><p className="text-xl font-bold mt-1">{laborBatchRows.filter(b => b.status === 'Active').length}</p></div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-3"><p className="text-[10px] uppercase tracking-wide text-slate-500">{L('Live birds')}</p><p className="text-xl font-bold mt-1">{laborBatchRows.reduce((sum, b) => sum + (b.summary?.live_count || 0), 0).toLocaleString()}</p></div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-3"><p className="text-[10px] uppercase tracking-wide text-slate-500">{L('Workers')}</p><p className="text-xl font-bold mt-1">{workers.length}</p></div>
          </div>
          {laborBatchRows.filter(b => b.status === 'Active').length > 0 && <div className="space-y-2">
            {laborBatchRows.filter(b => b.status === 'Active').slice(0, 4).map(batch => <div key={batch.batch_id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 dark:border-slate-800 px-3 py-2">
              <span className="min-w-0 text-xs font-semibold truncate">{batch.name}</span><span className="text-xs text-slate-500 whitespace-nowrap">{(batch.summary?.live_count || 0).toLocaleString()} {L('live birds')}</span>
            </div>)}
          </div>}
        </>}
      </section>
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
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200"><HardHat className="w-4 h-4" /> {L('Workers')}</h3>
            <button type="button" onClick={() => setShowAddWorkerModal(true)} className="px-3 py-1.5 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition">
              <Plus className="w-3.5 h-3.5" /> {L('Add worker')}
            </button>
          </div>
          <div className="space-y-2">
            {summary.length === 0 && <p className="text-xs text-slate-400 italic">{L('No workers yet.')}</p>}
            {summary.map((w) => (
              <div key={w.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{w.name}</p>
                    <p className="text-[11px] text-slate-500">Rs. {Number(w.dailyWage || 0).toLocaleString()} / {L('day')} · {w.days || 0} {L('days this month')}</p>
                    {w.notes && <p className="text-[11px] text-slate-500">{w.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setQrFor({ id: w.id, name: w.name })} className="p-1 rounded text-slate-400 hover:text-emerald-600 transition" aria-label={L('QR card')} title={L('QR card')}>
                      <QrCode className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => { setEditingWorker(w); setEditWorkerForm({ name: w.name, dailyWage: String(w.dailyWage || ''), notes: w.notes || '' }); }} className="p-1 rounded text-slate-400 hover:text-emerald-600 transition" aria-label={L('Edit worker')} title={L('Edit worker')}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => handleDeleteWorker(w)} className="p-1 rounded text-slate-400 hover:text-red-500 transition" aria-label={L('Remove worker')}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] font-bold mt-1 text-emerald-700 dark:text-emerald-400">
                  {L('Unpaid')}: {w.unpostedDays || 0}d · Rs. {Math.round(w.wageDue).toLocaleString()}
                  {unsettledAdvance(mufAdvances, w.id) > 0 && (
                    <span className="ml-2 text-amber-600">
                      − {L('advance')} Rs. {unsettledAdvance(mufAdvances, w.id).toLocaleString()}
                    </span>
                  )}
                </p>
                <div className="mt-1.5">
                  <button
                    type="button"
                    onClick={() => { setAdvanceFor(advanceFor === w.id ? null : w.id); setAdvForm({ date: todayStr(), amount: '', notes: '' }); }}
                    className="text-[11px] font-bold text-amber-600 hover:text-amber-700 transition"
                  >{advanceFor === w.id ? L('Cancel') : L('+ Give advance')}</button>
                  {advanceFor === w.id && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                      <input type="date" value={advForm.date} onChange={(e) => setAdvForm({ ...advForm, date: e.target.value })} className={fieldClass} />
                      <input type="number" min="0" step="any" placeholder={L('Amount (Rs.) *')} value={advForm.amount} onChange={(e) => setAdvForm({ ...advForm, amount: e.target.value })} className={fieldClass} />
                      <input placeholder={L('Note')} value={advForm.notes} onChange={(e) => setAdvForm({ ...advForm, notes: e.target.value })} className={fieldClass} />
                      <div className="sm:col-span-3 flex gap-2">
                        {editAdvId && (
                          <button type="button" onClick={() => { setEditAdvId(null); setAdvanceFor(null); setAdvForm({ date: todayStr(), amount: '', notes: '' }); }} className="px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-xs font-bold rounded-xl transition">{L('Cancel')}</button>
                        )}
                        <button type="button" onClick={() => handleGiveAdvance(w.id)} className="flex-1 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition">
                          {editAdvId ? L('Save changes') : L('Save advance')}
                        </button>
                      </div>
                    </div>
                  )}
                  {advances.filter((a) => a.workerId === w.id && !a.settled).map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-2 mt-1.5 text-[11px] p-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                      <span className="text-slate-500">{a.date} · Rs. {a.amount.toLocaleString()}{a.notes ? ` · ${a.notes}` : ''}</span>
                      <span className="flex items-center gap-0.5">
                        <button type="button" onClick={() => { setEditAdvId(a.id); setAdvanceFor(w.id); setAdvForm({ date: a.date, amount: String(a.amount), notes: a.notes || '' }); }} className="p-0.5 rounded text-amber-500 hover:text-emerald-600 transition" aria-label={L('Edit advance')} title={L('Edit advance')}>
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button type="button" onClick={() => handleDeleteAdvance(a.id)} className="p-0.5 rounded text-amber-400 hover:text-red-500 transition" aria-label={L('Delete advance')}>
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
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">{L('Mark attendance')}</h3>
            <button type="button" onClick={() => setShowMarkAttModal(true)} className="px-3 py-1.5 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition">
              <Plus className="w-3.5 h-3.5" /> {L('Mark attendance')}
            </button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {visibleRows.length === 0 && <p className="text-xs text-slate-400 italic">{L('No attendance in this month.')}</p>}
            {visibleRows.map((row) => {
              const worker = workers.find((w) => w.id === row.workerId);
              return (
                <div key={row.id} className="flex justify-between items-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 text-xs">
                  <div>
                    <p className="font-bold text-slate-700 dark:text-slate-200">{row.date} · {worker?.name || L('Worker')} · {row.dayType === 'half' ? L('Half') : L('Full')}</p>
                    <p className="text-[10px] text-slate-500">{row.notes || ''}{row.posted ? (row.notes ? ' · ' : '') + L('posted') : ''}</p>
                  </div>
                  {!row.posted && (
                    <span className="flex items-center gap-0.5">
                      <button type="button" onClick={() => { setEditAtt(row); setEditAttForm({ date: row.date, dayType: row.dayType, notes: row.notes || '' }); }} className="p-1 rounded text-slate-400 hover:text-emerald-600 transition" aria-label={L('Edit attendance')} title={L('Edit attendance')}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => handleDeleteAttendance(row.id)} className="p-1 rounded text-slate-400 hover:text-red-500 transition" aria-label={L('Delete attendance')}>
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
          disabled={unposted <= 0}
          onClick={handlePostMonth}
          className="px-4 py-2 bg-farm-600 hover:bg-farm-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition"
        >
          <CheckCircle2 className="w-4 h-4" /> {L('Post {month} to the ledger', { month: month })}
        </button>
      </section>
      {/* ── Edit Worker (popup) ────────────────── */}
      <DetailModal open={!!editingWorker} onClose={() => setEditingWorker(null)}
        title={L('Edit worker')} icon={<Pencil className="w-5 h-5" />} iconBg="bg-emerald-100 text-emerald-700" size="small">
        <form onSubmit={handleSaveWorkerEdit} className="space-y-3">
          <div>
            <label className={labelClass}>{L('Name *')}</label>
            <input className={fieldClass} value={editWorkerForm.name} onChange={(e) => setEditWorkerForm({ ...editWorkerForm, name: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>{L('Daily wage (Rs.)')}</label>
            <input type="number" step="any" min="0" className={fieldClass} value={editWorkerForm.dailyWage} onChange={(e) => setEditWorkerForm({ ...editWorkerForm, dailyWage: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>{L('Notes')}</label>
            <input className={fieldClass} value={editWorkerForm.notes} onChange={(e) => setEditWorkerForm({ ...editWorkerForm, notes: e.target.value })} />
          </div>
          <div className="muf-pc-actions">
            <button type="button" onClick={() => setEditingWorker(null)} className="muf-pc-btn-ghost">{L('Cancel')}</button>
            <button type="submit" className="px-4 py-2 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-xl">{L('Save changes')}</button>
          </div>
        </form>
      </DetailModal>

      {/* ── Edit Attendance (popup) ───────────── */}
      <DetailModal open={!!editAtt} onClose={() => setEditAtt(null)}
        title={L('Edit attendance')} icon={<Pencil className="w-5 h-5" />} iconBg="bg-emerald-100 text-emerald-700" size="small">
        <form onSubmit={handleSaveAttEdit} className="space-y-3">
          <div>
            <label className={labelClass}>{L('Date')}</label>
            <input type="date" className={fieldClass} value={editAttForm.date} onChange={(e) => setEditAttForm({ ...editAttForm, date: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>{L('Day')}</label>
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
            <button type="submit" className="px-4 py-2 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-xl">{L('Save changes')}</button>
          </div>
        </form>
      </DetailModal>

      <MufCardQr open={!!qrFor} onClose={() => setQrFor(null)} kind="worker" id={qrFor?.id} name={qrFor?.name} />

      {/* ── Add Worker (popup) ────────────────── */}
      <DetailModal open={showAddWorkerModal} onClose={() => setShowAddWorkerModal(false)}
        title={L('Add worker')} icon={<HardHat className="w-5 h-5" />} iconBg="bg-emerald-100 text-emerald-700" size="small">
        <form onSubmit={handleAddWorker} className="space-y-3">
          <div>
            <label className={labelClass}>{L('Name *')}</label>
            <input className={fieldClass} value={workerForm.name} onChange={(e) => setWorkerForm({ ...workerForm, name: e.target.value })} placeholder={L('e.g. Shakeel')} />
          </div>
          <div>
            <label className={labelClass}>{L('Daily wage (Rs.)')}</label>
            <input type="number" step="any" min="0" className={fieldClass} value={workerForm.dailyWage} onChange={(e) => setWorkerForm({ ...workerForm, dailyWage: e.target.value })} placeholder="300" />
          </div>
          <div>
            <label className={labelClass}>{L('Notes')}</label>
            <input className={fieldClass} value={workerForm.notes} onChange={(e) => setWorkerForm({ ...workerForm, notes: e.target.value })} placeholder={L('Optional role')} />
          </div>
          <div className="muf-pc-actions">
            <button type="button" onClick={() => setShowAddWorkerModal(false)} className="muf-pc-btn-ghost">{L('Cancel')}</button>
            <button type="submit" className="px-4 py-2 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> {L('Add worker')}</button>
          </div>
        </form>
      </DetailModal>

      {/* ── Mark Attendance (popup) ───────────── */}
      <DetailModal open={showMarkAttModal} onClose={() => setShowMarkAttModal(false)}
        title={L('Mark attendance')} icon={<CheckCircle2 className="w-5 h-5" />} iconBg="bg-emerald-100 text-emerald-700" size="small">
        <form onSubmit={handleMark} className="space-y-3">
          <div>
            <label className={labelClass}>{L('Worker *')}</label>
            <select className={fieldClass} value={markForm.workerId} onChange={(e) => setMarkForm({ ...markForm, workerId: e.target.value })}>
              <option value="">{L('Select worker')}</option>
              {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
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
            <button type="button" onClick={() => setShowMarkAttModal(false)} className="muf-pc-btn-ghost">{L('Cancel')}</button>
            <button type="submit" className="px-4 py-2 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-xl">{L('Save attendance')}</button>
          </div>
        </form>
      </DetailModal>
    </div>
  );
}
