import React, { useEffect, useMemo, useState } from 'react';
import { HardHat, Plus, Trash2, Loader, CheckCircle, Banknote, QrCode, Pencil, Share2 } from 'lucide-react';
import MufCardQr from '../muf-card-qr';
import * as api from '../api';
import { L } from '../i18n';
import { workerSummary, unpostedTotal as mufUnpostedTotal, unsettledAdvance, payoutAfterAdvances } from '../muf-labor';

import { mufToday, mufMonth } from '../muf-date';
import DetailModal from '../muf-modal';
import { notify } from '../muf-confirm';

const todayIso = () => mufToday();
const monthIso = () => mufMonth();
const fieldClass = 'w-full bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-xs outline-none focus:border-farm-500';
const labelClass = 'block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider';

export default function LaborBoard({
  crops = [],
  userRole,
  formatCurrency,
  refreshData,
  showAlert,
  confirm
}) {
  const isAdmin = userRole === 'admin';
  const [laborers, setLaborers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [month, setMonth] = useState(monthIso());
  const [cropFilter, setCropFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [workerForm, setWorkerForm] = useState({ name: '', daily_wage: '', notes: '' });
  const [advances, setAdvances] = useState([]);
  const [qrFor, setQrFor] = useState(null);
  const [detailFor, setDetailFor] = useState(null); // worker opened for detail popup
  const [selectedAttendance, setSelectedAttendance] = useState(null); // attendance record opened for detail popup
  const [advanceFor, setAdvanceFor] = useState(null); // laborer _id with open advance form
  const [advForm, setAdvForm] = useState({ date: todayIso(), amount: '', notes: '' });
  const [editWorker, setEditWorker] = useState(null);
  const [editWorkerForm, setEditWorkerForm] = useState({ name: '', daily_wage: '', notes: '' });
  const [editAdvFor, setEditAdvFor] = useState(null); // advance _id being edited
  const [editAdvForm, setEditAdvForm] = useState({ date: todayIso(), amount: '', notes: '' });
  const [editAtt, setEditAtt] = useState(null);
  const [editAttForm, setEditAttForm] = useState({ date: '', day_type: 'full', crop_id: '', field: '', notes: '' });
  const [showWorkerForm, setShowWorkerForm] = useState(false);
  const [showMarkForm, setShowMarkForm] = useState(false);
  const [markForm, setMarkForm] = useState({
    laborer_id: '',
    date: todayIso(),
    day_type: 'full',
    crop_id: '',
    field: '',
    notes: ''
  });

  const loadLabor = async (monthKey = month) => {
    try {
      const [labRes, attRes, advRes] = await Promise.all([
        api.getLaborers(),
        api.getAttendance(monthKey),
        api.getLaborAdvances().catch(() => ({ data: [] }))
      ]);
      setLaborers(labRes.data || []);
      setAttendance(attRes.data || []);
      setAdvances(advRes.data || []);
      if (!markForm.laborer_id && (labRes.data || []).length) {
        setMarkForm(prev => ({ ...prev, laborer_id: labRes.data[0]._id }));
      }
    } catch (err) {
      console.warn('Failed to load labor:', err);
    }
  };

  useEffect(() => {
    loadLabor(month);
  }, [month]);

  const visibleAttendance = useMemo(() => {
    if (cropFilter === 'all') return attendance;
    return attendance.filter(row => (row.crop_id || '') === cropFilter);
  }, [attendance, cropFilter]);

  // Wage math lives in the shared muf-labor helper (twin in all three farm apps).
  const toMufWorker = (worker) => ({ id: worker._id, name: worker.name, dailyWage: worker.daily_wage });
  const toMufRow = (row) => ({ id: row._id, workerId: row.laborer_id, date: row.date, dayType: row.day_type, posted: row.posted });

  const summary = useMemo(() => {
    const mufRows = visibleAttendance.map(toMufRow);
    return laborers.map(worker => {
      const rows = visibleAttendance.filter(row => row.laborer_id === worker._id);
      const { days, unpostedDays, wageDue } = workerSummary(toMufWorker(worker), mufRows);
      return { ...worker, days, unpostedDays, wageDue, rows };
    });
  }, [laborers, visibleAttendance]);

  // Month-end posting always covers the whole month (all crops), regardless of the crop filter view.
  const unpostedTotal = useMemo(
    () => mufUnpostedTotal(laborers.map(toMufWorker), attendance.map(toMufRow)),
    [laborers, attendance]
  );

  const toMufAdvance = (a) => ({ id: a._id, workerId: a.laborer_id, date: a.date, amount: a.amount, settled: a.settled, notes: a.notes });
  const mufAdvances = useMemo(() => advances.map(toMufAdvance), [advances]);
  const payout = useMemo(
    () => payoutAfterAdvances(laborers.map(toMufWorker), attendance.map(toMufRow), mufAdvances),
    [laborers, attendance, mufAdvances]
  );

  const handleGiveAdvance = async (workerId) => {
    const amount = parseFloat(advForm.amount);
    if (!(amount > 0)) return showAlert('Enter an advance amount above 0.', true);
    setBusy(true);
    try {
      await api.addLaborAdvance({ laborer_id: workerId, date: advForm.date || todayIso(), amount, notes: advForm.notes });
      showAlert('Advance recorded. It will be settled with the month-end wages.');
      setAdvForm({ date: todayIso(), amount: '', notes: '' });
      setAdvanceFor(null);
      await loadLabor();
    } catch (err) {
      showAlert(err.response?.data?.detail || 'Failed to record advance.', true);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAdvance = async (id) => {
    const adv = advances.find((a) => a._id === id);
    if (!adv) return;
    setBusy(true);
    try {
      await api.deleteLaborAdvance(id);
      await loadLabor();
      notify(L('Advance removed.'), 'success', undefined, {
        label: 'Undo',
        fn: () => {
          api.addLaborAdvance({ laborer_id: adv.laborer_id, date: adv.date, amount: adv.amount, notes: adv.notes })
            .then(() => loadLabor())
            .catch(() => notify(L('Undo failed — add the advance again.'), 'error'));
        },
      });
    } catch (err) {
      showAlert(err.response?.data?.detail || 'Failed to remove advance.', true);
    } finally {
      setBusy(false);
    }
  };

  const openEditWorker = (worker) => {
    setEditWorker(worker);
    setEditWorkerForm({ name: worker.name || '', daily_wage: worker.daily_wage !== undefined ? String(worker.daily_wage) : '', notes: worker.notes || '' });
  };

  const handleSaveWorkerEdit = async () => {
    if (!editWorker) return;
    if (!editWorkerForm.name.trim()) return showAlert('Worker name is required.', true);
    setBusy(true);
    try {
      await api.updateLaborer(editWorker._id, {
        name: editWorkerForm.name.trim(),
        daily_wage: parseFloat(editWorkerForm.daily_wage) || 0,
        notes: editWorkerForm.notes
      });
      showAlert('Worker updated.');
      setEditWorker(null);
      await loadLabor();
    } catch (err) {
      showAlert(err.response?.data?.detail || 'Failed to update worker.', true);
    } finally {
      setBusy(false);
    }
  };

  const openEditAdvance = (adv) => {
    setEditAdvFor(adv._id);
    setEditAdvForm({ date: adv.date || todayIso(), amount: String(adv.amount ?? ''), notes: adv.notes || '' });
  };

  const handleSaveAdvanceEdit = async () => {
    if (!editAdvFor) return;
    const amount = parseFloat(editAdvForm.amount);
    if (!(amount > 0)) return showAlert('Enter an advance amount above 0.', true);
    setBusy(true);
    try {
      await api.updateLaborAdvance(editAdvFor, { date: editAdvForm.date || todayIso(), amount, notes: editAdvForm.notes });
      showAlert('Advance updated.');
      setEditAdvFor(null);
      await loadLabor();
    } catch (err) {
      showAlert(err.response?.data?.detail || 'Failed to update advance.', true);
    } finally {
      setBusy(false);
    }
  };

  const openEditAttendance = (row) => {
    setEditAtt(row);
    setEditAttForm({ date: row.date, day_type: row.day_type || 'full', crop_id: row.crop_id || '', field: row.field || '', notes: row.notes || '' });
  };

  const handleSaveAttEdit = async () => {
    if (!editAtt) return;
    setBusy(true);
    try {
      await api.updateAttendance(editAtt._id, {
        date: editAttForm.date || todayIso(),
        day_type: editAttForm.day_type,
        crop_id: editAttForm.crop_id || null,
        field: editAttForm.field,
        notes: editAttForm.notes
      });
      showAlert('Attendance updated.');
      setEditAtt(null);
      await loadLabor();
    } catch (err) {
      showAlert(err.response?.data?.detail || 'Failed to update attendance.', true);
    } finally {
      setBusy(false);
    }
  };

  const handleAddWorker = async (e) => {
    e.preventDefault();
    if (!workerForm.name.trim()) return showAlert('Worker name is required.', true);
    setBusy(true);
    try {
      await api.addLaborer({
        name: workerForm.name.trim(),
        daily_wage: parseFloat(workerForm.daily_wage) || 0,
        notes: workerForm.notes
      });
      showAlert('Field worker added. This is not an app login.');
      setWorkerForm({ name: '', daily_wage: '', notes: '' });
      await loadLabor();
    } catch (err) {
      showAlert(err.response?.data?.detail || 'Failed to add worker.', true);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteWorker = async (worker) => {
    const ok = await confirm({
      title: L('Remove field worker'),
      message: `Remove ${worker.name} and their unposted attendance? This does not delete any app user.`,
      tone: 'danger',
      confirmLabel: L('Remove'),
      cancelLabel: L('Cancel')
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.deleteLaborer(worker._id);
      showAlert('Field worker removed.');
      await loadLabor();
    } catch (err) {
      showAlert(err.response?.data?.detail || 'Failed to remove worker.', true);
    } finally {
      setBusy(false);
    }
  };

  const handleMark = async (e) => {
    e.preventDefault();
    if (!markForm.laborer_id) return showAlert('Pick a field worker.', true);
    setBusy(true);
    try {
      const crop = crops.find(c => c._id === markForm.crop_id);
      await api.upsertAttendance({
        laborer_id: markForm.laborer_id,
        date: markForm.date || todayIso(),
        day_type: markForm.day_type,
        crop_id: markForm.crop_id || null,
        field: markForm.field || crop?.field || '',
        notes: markForm.notes
      });
      showAlert('Attendance saved.');
      setShowMarkForm(false);
      setMarkForm({ laborer_id: laborers[0]?._id || '', date: todayIso(), day_type: 'full', crop_id: '', field: '', notes: '' });
      await loadLabor();
    } catch (err) {
      showAlert(err.response?.data?.detail || 'Failed to save attendance.', true);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAttendance = async (id) => {
    const row = attendance.find((x) => x._id === id);
    if (!row) return;
    setBusy(true);
    try {
      await api.deleteAttendance(id);
      await loadLabor();
      notify(L('Attendance removed.'), 'success', undefined, {
        label: 'Undo',
        fn: () => {
          api.upsertAttendance({ laborer_id: row.laborer_id, date: row.date, day_type: row.day_type, crop_id: row.crop_id || null, field: row.field, notes: row.notes })
            .then(() => loadLabor())
            .catch(() => notify(L('Undo failed — mark the day again.'), 'error'));
        },
      });
    } catch (err) {
      showAlert(err.response?.data?.detail || 'Failed to remove attendance.', true);
    } finally {
      setBusy(false);
    }
  };

  const handlePostMonth = async () => {
    const ok = await confirm({
      title: L('Post month to Labor ledger'),
      message: `Post unposted ${month} attendance as one Labor expense of about Rs. ${formatCurrency(unpostedTotal)}?`,
      tone: 'warning',
      confirmLabel: L('Post wages'),
      cancelLabel: L('Cancel')
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await api.postLaborWages(month);
      showAlert(res.data.notes || 'Labor wages posted to the ledger.');
      await loadLabor();
      refreshData();
    } catch (err) {
      showAlert(err.response?.data?.detail || 'Failed to post wages.', true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in flex-1">
      <div className="muf-page-hero">
        <div className="muf-page-title">
          <div className="muf-title-icon"><HardHat size={30} /></div>
          <div>
            <h2>{L('Labor')}</h2>
            <p>{L('Named field workers and daily attendance — not Admin/Worker app logins.')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[10px] font-bold text-slate-500 uppercase">{L('Crop Filter')}</label>
          <select className={fieldClass} style={{ width: 'auto' }} value={cropFilter} onChange={e => setCropFilter(e.target.value)}>
            <option value="all">{L('All Crops (Blended)')}</option>
            {crops.map(crop => (
              <option key={crop._id} value={crop._id}>{crop.name} ({crop.season} {crop.crop_year || 'N/A'})</option>
            ))}
          </select>
          <label className="text-[10px] font-bold text-slate-500 uppercase">{L('Month')}</label>
          <input type="month" className={fieldClass} style={{ width: 'auto' }} value={month} onChange={e => setMonth(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="muf-panel p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black flex items-center gap-2"><HardHat size={16} /> {L('Field workers')}</h3>
            {isAdmin && (
              <button type="button" onClick={() => setShowWorkerForm(true)} className="px-3 py-2 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5">
                <Plus size={13} /> {L('Add field worker')}
              </button>
            )}
          </div>
          <DetailModal open={showWorkerForm} onClose={() => setShowWorkerForm(false)} title={L('Add field worker')} icon={<HardHat size={20} />} iconBg="bg-farm-100 text-farm-700" size="small">
            <form onSubmit={handleAddWorker} className="space-y-3">
              <div>
                <label className={labelClass}>{L('Name')} *</label>
                <input className={fieldClass} value={workerForm.name} onChange={e => setWorkerForm({ ...workerForm, name: e.target.value })} placeholder={L('e.g. Ali')} />
              </div>
              <div>
                <label className={labelClass}>{L('Daily wage (Rs.)')}</label>
                <input type="number" step="any" min="0" className={fieldClass} value={workerForm.daily_wage} onChange={e => setWorkerForm({ ...workerForm, daily_wage: e.target.value })} placeholder="1200" />
              </div>
              <div>
                <label className={labelClass}>{L('Notes')}</label>
                <input className={fieldClass} value={workerForm.notes} onChange={e => setWorkerForm({ ...workerForm, notes: e.target.value })} placeholder={L('Optional role')} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowWorkerForm(false)} className="px-4 py-2 text-sm text-slate-600">{L('Cancel')}</button>
                <button type="submit" disabled={busy} className="px-3 py-2 bg-farm-600 hover:bg-farm-700 disabled:opacity-60 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5">
                  {busy ? <Loader size={13} className="animate-spin" /> : <Plus size={13} />} {L('Add field worker')}
                </button>
              </div>
            </form>
          </DetailModal>
          <DetailModal open={!!editWorker} onClose={() => setEditWorker(null)} title={L('Edit field worker')} icon={<HardHat size={20} />} iconBg="bg-farm-100 text-farm-700" size="small">
            <div className="space-y-3">
              <div>
                <label className={labelClass}>{L('Name')} *</label>
                <input className={fieldClass} value={editWorkerForm.name} onChange={e => setEditWorkerForm({ ...editWorkerForm, name: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>{L('Daily wage (Rs.)')}</label>
                <input type="number" step="any" min="0" className={fieldClass} value={editWorkerForm.daily_wage} onChange={e => setEditWorkerForm({ ...editWorkerForm, daily_wage: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>{L('Notes')}</label>
                <input className={fieldClass} value={editWorkerForm.notes} onChange={e => setEditWorkerForm({ ...editWorkerForm, notes: e.target.value })} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditWorker(null)} className="px-4 py-2 text-sm text-slate-600">{L('Cancel')}</button>
                <button type="button" disabled={busy} onClick={handleSaveWorkerEdit} className="px-3 py-2 bg-farm-600 hover:bg-farm-700 disabled:opacity-60 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5">
                  {busy ? <Loader size={13} className="animate-spin" /> : <Pencil size={13} />} {L('Save changes')}
                </button>
              </div>
            </div>
          </DetailModal>
          <div className="space-y-2">
            {summary.length === 0 && <p className="text-xs text-slate-400 italic">{L('No field workers yet.')}</p>}
            {summary.map(worker => (
              <div key={worker._id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 cursor-pointer hover:border-farm-300 dark:hover:border-farm-700 transition" onClick={() => setDetailFor(worker)} title={L('Open details')}>
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="text-sm font-black">{worker.name}</p>
                    <p className="text-[11px] text-slate-500">Rs. {formatCurrency(worker.daily_wage || 0)} / {L('day')} · {worker.days || 0} {L('days this month')}</p>
                    {worker.notes && <p className="text-[11px] text-slate-500">{worker.notes}</p>}
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={(e) => { e.stopPropagation(); openEditWorker(worker); }} className="text-slate-400 hover:text-farm-600" aria-label={L('Edit worker')} title={L('Edit worker')}>
                        <Pencil size={14} />
                      </button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setQrFor({ id: worker._id, name: worker.name }); }} className="text-slate-400 hover:text-emerald-600" aria-label={L('QR card')} title={L('QR card')}>
                        <QrCode size={15} />
                      </button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteWorker(worker); }} className="text-slate-400 hover:text-red-500" aria-label={L('Remove worker')}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-[11px] font-bold mt-1 text-farm-700 dark:text-farm-400">
                  {L('Unposted')}: {worker.unpostedDays || 0}d · Rs. {formatCurrency(worker.wageDue)}
                  {unsettledAdvance(mufAdvances, worker._id) > 0 && (
                    <span className="ml-2 text-amber-600">− {L('advance')} Rs. {formatCurrency(unsettledAdvance(mufAdvances, worker._id))}</span>
                  )}
                </p>
                {isAdmin && (
                  <div className="mt-1.5">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setAdvanceFor(worker._id); setAdvForm({ date: todayIso(), amount: '', notes: '' }); }}
                      className="text-[11px] font-bold text-amber-600 hover:text-amber-700"
                    >{L('+ Give advance')}</button>
                    {advances.filter(a => a.laborer_id === worker._id && !a.settled).map(a => (
                      <div key={a._id} className="flex items-center justify-between gap-2 mt-1.5 text-[11px] p-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                        <span className="text-slate-500">{a.date} · Rs. {formatCurrency(a.amount)}{a.notes ? ` · ${a.notes}` : ''}</span>
                        <span className="flex items-center gap-1.5">
                          <button type="button" onClick={(e) => { e.stopPropagation(); openEditAdvance(a); }} className="text-amber-500 hover:text-amber-700" aria-label={L('Edit advance')} title={L('Edit advance')}>
                            <Pencil size={12} />
                          </button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteAdvance(a._id); }} className="text-amber-400 hover:text-red-500" aria-label={L('Delete advance')}>
                            <Trash2 size={12} />
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="muf-panel p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black">{L('Mark attendance')}</h3>
            {isAdmin && (
              <button type="button" onClick={() => setShowMarkForm(true)} className="px-3 py-2 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5">
                <Plus size={13} /> {L('Mark attendance')}
              </button>
            )}
          </div>
          <DetailModal open={showMarkForm} onClose={() => setShowMarkForm(false)} title={L('Mark attendance')} icon={<CheckCircle size={20} />} iconBg="bg-farm-100 text-farm-700" size="small">
            <form onSubmit={handleMark} className="space-y-3">
              <div>
                <label className={labelClass}>{L('Worker')} *</label>
                <select className={fieldClass} value={markForm.laborer_id} onChange={e => setMarkForm({ ...markForm, laborer_id: e.target.value })}>
                  <option value="">{L('Select worker')}</option>
                  {laborers.map(worker => <option key={worker._id} value={worker._id}>{worker.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>{L('Date')}</label>
                <input type="date" className={fieldClass} value={markForm.date} onChange={e => setMarkForm({ ...markForm, date: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>{L('Day')}</label>
                <select className={fieldClass} value={markForm.day_type} onChange={e => setMarkForm({ ...markForm, day_type: e.target.value })}>
                  <option value="full">{L('Full day')}</option>
                  <option value="half">{L('Half day')}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{L('Crop / field')}</label>
                <select className={fieldClass} value={markForm.crop_id} onChange={e => {
                  const crop = crops.find(c => c._id === e.target.value);
                  setMarkForm({ ...markForm, crop_id: e.target.value, field: crop?.field || markForm.field });
                }}>
                  <option value="">{L('Farm-wide')}</option>
                  {crops.map(crop => <option key={crop._id} value={crop._id}>{crop.name} · {crop.field || 'Field'}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>{L('Notes')}</label>
                <input className={fieldClass} value={markForm.notes} onChange={e => setMarkForm({ ...markForm, notes: e.target.value })} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowMarkForm(false)} className="px-4 py-2 text-sm text-slate-600">{L('Cancel')}</button>
                <button type="submit" disabled={busy} className="px-3 py-2 bg-farm-600 hover:bg-farm-700 disabled:opacity-60 text-white text-xs font-bold rounded-lg">
                  {L('Save attendance')}
                </button>
              </div>
            </form>
          </DetailModal>
          <DetailModal open={!!editAtt} onClose={() => setEditAtt(null)} title={L('Edit attendance')} icon={<CheckCircle size={20} />} iconBg="bg-farm-100 text-farm-700" size="small">
            <div className="space-y-3">
              <div>
                <label className={labelClass}>{L('Date')}</label>
                <input type="date" className={fieldClass} value={editAttForm.date} onChange={e => setEditAttForm({ ...editAttForm, date: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>{L('Day')}</label>
                <select className={fieldClass} value={editAttForm.day_type} onChange={e => setEditAttForm({ ...editAttForm, day_type: e.target.value })}>
                  <option value="full">{L('Full day')}</option>
                  <option value="half">{L('Half day')}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{L('Crop / field')}</label>
                <select className={fieldClass} value={editAttForm.crop_id} onChange={e => {
                  const crop = crops.find(c => c._id === e.target.value);
                  setEditAttForm({ ...editAttForm, crop_id: e.target.value, field: crop?.field || editAttForm.field });
                }}>
                  <option value="">{L('Farm-wide')}</option>
                  {crops.map(crop => <option key={crop._id} value={crop._id}>{crop.name} · {crop.field || 'Field'}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>{L('Notes')}</label>
                <input className={fieldClass} value={editAttForm.notes} onChange={e => setEditAttForm({ ...editAttForm, notes: e.target.value })} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditAtt(null)} className="px-4 py-2 text-sm text-slate-600">{L('Cancel')}</button>
                <button type="button" disabled={busy} onClick={handleSaveAttEdit} className="px-3 py-2 bg-farm-600 hover:bg-farm-700 disabled:opacity-60 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5">
                  {busy ? <Loader size={13} className="animate-spin" /> : <Pencil size={13} />} {L('Save changes')}
                </button>
              </div>
            </div>
          </DetailModal>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {visibleAttendance.length === 0 && <p className="text-xs text-slate-400 italic">No attendance in this month{cropFilter !== 'all' ? ' for this crop' : ''}.</p>}
            {[...visibleAttendance].sort((a, b) => String(b.date).localeCompare(String(a.date))).map(row => {
              const worker = laborers.find(item => item._id === row.laborer_id);
              const crop = crops.find(item => item._id === row.crop_id);
              return (
                <div key={row._id} className="flex justify-between items-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                  <button
                    type="button"
                    aria-label={L('View attendance details') + ': ' + row.date + ' · ' + (worker?.name || L('Worker'))}
                    onClick={() => setSelectedAttendance(row)}
                    className="min-w-0 flex-1 text-left rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-farm-500"
                  >
                    <p className="font-bold">{row.date} · {worker?.name || L('Worker')} · {row.day_type === 'half' ? L('Half') : L('Full')}</p>
                    <p className="text-[10px] text-slate-500">{crop?.name || L('Farm-wide')}{row.field ? ` · ${row.field}` : ''} · {row.posted ? L('Posted to ledger') : L('Unposted')}</p>
                  </button>
                  {isAdmin && !row.posted && (
                    <span className="flex items-center gap-1.5">
                      <button type="button" onClick={() => openEditAttendance(row)} className="text-slate-400 hover:text-farm-600" aria-label={L('Edit attendance')} title={L('Edit attendance')}>
                        <Pencil size={13} />
                      </button>
                      <button type="button" onClick={() => handleDeleteAttendance(row._id)} className="text-slate-400 hover:text-red-500" aria-label={L('Delete attendance')}>
                        <Trash2 size={14} />
                      </button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {isAdmin && (
        <>
        <DetailModal open={advanceFor !== null} onClose={() => setAdvanceFor(null)} title={L('Give advance')} icon={<Banknote size={20} />} iconBg="bg-amber-100 text-amber-700" size="small">
          <div className="space-y-3">
            <div>
              <label className={labelClass}>{L('Date')}</label>
              <input type="date" className={fieldClass} value={advForm.date} onChange={e => setAdvForm({ ...advForm, date: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>{L('Amount (Rs.) *')}</label>
              <input type="number" step="any" min="0" className={fieldClass} placeholder={L('Amount (Rs.) *')} value={advForm.amount} onChange={e => setAdvForm({ ...advForm, amount: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>{L('Note')}</label>
              <input className={fieldClass} placeholder={L('Note')} value={advForm.notes} onChange={e => setAdvForm({ ...advForm, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setAdvanceFor(null)} className="px-4 py-2 text-sm text-slate-600">{L('Cancel')}</button>
              <button type="button" disabled={busy || !advanceFor} onClick={() => advanceFor && handleGiveAdvance(advanceFor)} className="px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-xs font-bold rounded-lg">
                {L('Save advance')}
              </button>
            </div>
          </div>
        </DetailModal>

        <DetailModal open={!!editAdvFor} onClose={() => setEditAdvFor(null)} title={L('Edit advance')} icon={<Banknote size={20} />} iconBg="bg-amber-100 text-amber-700" size="small">
          <div className="space-y-3">
            <div>
              <label className={labelClass}>{L('Date')}</label>
              <input type="date" className={fieldClass} value={editAdvForm.date} onChange={e => setEditAdvForm({ ...editAdvForm, date: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>{L('Amount (Rs.) *')}</label>
              <input type="number" step="any" min="0" className={fieldClass} value={editAdvForm.amount} onChange={e => setEditAdvForm({ ...editAdvForm, amount: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>{L('Note')}</label>
              <input className={fieldClass} value={editAdvForm.notes} onChange={e => setEditAdvForm({ ...editAdvForm, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditAdvFor(null)} className="px-4 py-2 text-sm text-slate-600">{L('Cancel')}</button>
              <button type="button" disabled={busy} onClick={handleSaveAdvanceEdit} className="px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5">
                {busy ? <Loader size={13} className="animate-spin" /> : <Pencil size={13} />} {L('Save changes')}
              </button>
            </div>
          </div>
        </DetailModal>

        <section className="muf-panel p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black">{L('Month-end Labor ledger')}</h3>
            <p className="text-xs text-slate-500">
              {L('Unposted wages')} ({month}): Rs. {formatCurrency(unpostedTotal)}
              {payout.advances > 0 && (
                <span className="text-amber-600"> − {L('advances')} Rs. {formatCurrency(payout.advances)} = <span className="font-extrabold">{L('cash payable')} Rs. {formatCurrency(payout.payable)}</span></span>
              )}
            </p>
          </div>
          <button
            type="button"
            disabled={busy || unpostedTotal <= 0}
            onClick={handlePostMonth}
            className="px-4 py-2 bg-farm-600 hover:bg-farm-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center gap-2"
          >
            <CheckCircle size={14} /> {L('Post to Labor ledger')} ({month})
          </button>
        </section>
        </>
      )}
      <DetailModal
        open={!!selectedAttendance}
        onClose={() => setSelectedAttendance(null)}
        title={L('Attendance details')}
        subtitle={selectedAttendance?.date || ''}
        icon={<CheckCircle size={18} />}
        iconBg="bg-farm-100 text-farm-700"
        size="small"
      >
        {selectedAttendance && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-2.5">
                <p className="text-[10px] font-bold uppercase text-slate-500">{L('Worker')}</p>
                <p className="font-bold text-slate-800 dark:text-slate-100">{laborers.find(item => item._id === selectedAttendance.laborer_id)?.name || L('Worker')}</p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-2.5">
                <p className="text-[10px] font-bold uppercase text-slate-500">{L('Attendance')}</p>
                <p className="font-bold text-slate-800 dark:text-slate-100">{selectedAttendance.day_type === 'half' ? L('Half day') : L('Full day')}</p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-2.5">
                <p className="text-[10px] font-bold uppercase text-slate-500">{L('Crop')}</p>
                <p className="font-bold text-slate-800 dark:text-slate-100">{crops.find(crop => crop._id === selectedAttendance.crop_id)?.name || L('Farm-wide')}</p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-2.5">
                <p className="text-[10px] font-bold uppercase text-slate-500">{L('Status')}</p>
                <p className="font-bold text-slate-800 dark:text-slate-100">{selectedAttendance.posted ? L('Posted to ledger') : L('Not posted')}</p>
              </div>
            </div>
            {selectedAttendance.field && (
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5">
                <p className="text-[10px] font-bold uppercase text-slate-500 mb-1">{L('Field')}</p>
                <p className="font-semibold text-slate-800 dark:text-slate-100">{selectedAttendance.field}</p>
              </div>
            )}
            {isAdmin && (
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-500 mb-1">{L('Notes')}</p>
                <p className="whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200">{selectedAttendance.notes?.trim() || L('No notes recorded.')}</p>
              </div>
            )}
          </div>
        )}
      </DetailModal>
      { /* Existing worker detail popup remains independent. */ }
      <DetailModal open={!!detailFor} onClose={() => setDetailFor(null)} title={detailFor ? detailFor.name : ''} icon={<HardHat size={20} />} iconBg="bg-farm-100 text-farm-700" size="small">
        {detailFor && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-2.5">
                <p className="text-[10px] text-slate-400 font-bold uppercase">{L('Daily wage')}</p>
                <p className="font-black text-sm">Rs. {formatCurrency(detailFor.daily_wage || 0)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-2.5">
                <p className="text-[10px] text-slate-400 font-bold uppercase">{L('Days this month')}</p>
                <p className="font-black text-sm">{detailFor.days || 0}</p>
              </div>
              <div className="rounded-lg border border-farm-200 dark:border-farm-800 bg-farm-50 dark:bg-farm-900/10 p-2.5">
                <p className="text-[10px] text-farm-600 font-bold uppercase">{L('Unposted')}: {detailFor.unpostedDays || 0}d</p>
                <p className="font-black text-sm text-farm-700 dark:text-farm-400">Rs. {formatCurrency(detailFor.wageDue)}</p>
              </div>
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-2.5">
                <p className="text-[10px] text-amber-600 font-bold uppercase">{L('Unsettled advance')}</p>
                <p className="font-black text-sm text-amber-700 dark:text-amber-400">− Rs. {formatCurrency(unsettledAdvance(mufAdvances, detailFor._id))}</p>
              </div>
            </div>
            {detailFor.notes && <p className="text-slate-500">{detailFor.notes}</p>}
            {isAdmin && (
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button type="button"
                  onClick={() => { setQrFor({ id: detailFor._id, name: detailFor.name }); setDetailFor(null); }}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition cursor-pointer">
                  <QrCode size={14} /> {L('QR card')}
                </button>
                <button type="button"
                  onClick={() => {
                    const msg = `${detailFor.name} — ${L('Worker Card')}\n${window.location.origin}/api/cards/worker/${detailFor._id}\n— Usman Agri Farm`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition cursor-pointer">
                  <Share2 size={14} /> {L('Share card on WhatsApp')}
                </button>
              </div>
            )}
          </div>
        )}
      </DetailModal>
      <MufCardQr open={!!qrFor} onClose={() => setQrFor(null)} kind="worker" id={qrFor?.id} name={qrFor?.name} />
    </div>
  );
}
