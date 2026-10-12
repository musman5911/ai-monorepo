import React, { useMemo, useState } from 'react';
import { Egg, Plus, Pencil, Bird as BirdIcon, Eye } from 'lucide-react';
import { Bird, BirdBreed, IncubationRecord, Lang } from '../types';
import { t } from '../i18n';
import { todayStr } from '../utils/calculations';
import DetailModal from '../muf-modal';
import { useConfirm, notify } from '../muf-confirm';
import { L } from '../i18n';

interface IncubationModuleProps {
  lang: Lang;
  records: IncubationRecord[];
  onAdd: (record: Omit<IncubationRecord, 'id'>) => void;
  onUpdate: (id: number, record: IncubationRecord) => void;
  onDelete: (id: number) => void;
  onAddHatchedToFlock?: (recordId: number, birds: Omit<Bird, 'id'>[]) => void;
  canDelete: boolean;
  canEdit?: boolean;
  canTransferToFlock?: boolean;
}

function getLossTotals(record: Pick<IncubationRecord, 'brokenEggs' | 'spoiledEggs' | 'infertileEggs' | 'deadInShellEggs'>) {
  const broken = record.brokenEggs || 0;
  const spoiled = record.spoiledEggs || 0;
  const infertile = record.infertileEggs || 0;
  const deadInShell = record.deadInShellEggs || 0;
  return {
    broken,
    spoiled,
    infertile,
    deadInShell,
    total: broken + spoiled + infertile + deadInShell,
  };
}

function accountedEggs(record: IncubationRecord) {
  return (record.hatched || 0) + getLossTotals(record).total;
}

function remainingEggs(record: IncubationRecord) {
  return Math.max(0, (record.eggsSet || 0) - accountedEggs(record));
}

function incubationStatus(record: IncubationRecord) {
  const remaining = remainingEggs(record);
  if (record.hatchDate) {
    if (remaining === 0) return { label: 'Completed', className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800' };
    return { label: 'Completed / Partial', className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800' };
  }
  if (accountedEggs(record) > 0) {
    return { label: 'In Progress', className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800' };
  }
  return { label: 'Set / Waiting', className: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' };
}

function hatchRate(record: IncubationRecord) {
  return record.eggsSet > 0 ? (record.hatched / record.eggsSet) * 100 : 0;
}

export default function IncubationModule({
  lang,
  records,
  onAdd,
  onUpdate,
  onDelete,
  onAddHatchedToFlock,
  canDelete,
  canEdit,
  canTransferToFlock,
}: IncubationModuleProps) {
  const confirmAction = useConfirm();
  const canChange = canEdit ?? canDelete;
  const [startDate, setStartDate] = useState(todayStr());
  const [eggsSet, setEggsSet] = useState('');
  const [hatchDate, setHatchDate] = useState('');
  const [hatched, setHatched] = useState('');
  const [brokenEggs, setBrokenEggs] = useState('');
  const [spoiledEggs, setSpoiledEggs] = useState('');
  const [infertileEggs, setInfertileEggs] = useState('');
  const [deadInShellEggs, setDeadInShellEggs] = useState('');
  const [notes, setNotes] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [activeDetailId, setActiveDetailId] = useState<number | null>(null);

  const [transferRecordId, setTransferRecordId] = useState<number | null>(null);
  const [transferNamePrefix, setTransferNamePrefix] = useState('');
  const [transferBreed, setTransferBreed] = useState<BirdBreed>('Desi');
  const [transferCustomBreed, setTransferCustomBreed] = useState('');
  const [transferFemaleCount, setTransferFemaleCount] = useState('');
  const [transferMaleCount, setTransferMaleCount] = useState('');
  const [transferPricePerBird, setTransferPricePerBird] = useState('0');

  const editRecord = useMemo(
    () => (editId !== null ? records.find((record) => record.id === editId) ?? null : null),
    [editId, records],
  );
  const transferRecord = useMemo(
    () => (transferRecordId !== null ? records.find((record) => record.id === transferRecordId) ?? null : null),
    [transferRecordId, records],
  );
  const activeDetailRecord = useMemo(
    () => (activeDetailId !== null ? records.find((record) => record.id === activeDetailId) ?? null : null),
    [activeDetailId, records],
  );
  const isTransferredRecord = !!editRecord?.flockTransferDate;

  const resetForm = () => {
    setStartDate(todayStr());
    setEggsSet('');
    setHatchDate('');
    setHatched('');
    setBrokenEggs('');
    setSpoiledEggs('');
    setInfertileEggs('');
    setDeadInShellEggs('');
    setNotes('');
    setEditId(null);
  };

  const resetTransferForm = () => {
    setTransferRecordId(null);
    setTransferNamePrefix('');
    setTransferBreed('Desi');
    setTransferCustomBreed('');
    setTransferFemaleCount('');
    setTransferMaleCount('');
    setTransferPricePerBird('0');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const set = parseInt(eggsSet) || 0;
    const hatchedN = parseInt(hatched) || 0;
    const brokenN = parseInt(brokenEggs) || 0;
    const spoiledN = parseInt(spoiledEggs) || 0;
    const infertileN = parseInt(infertileEggs) || 0;
    const deadInShellN = parseInt(deadInShellEggs) || 0;

    if (!set || set <= 0) return notify(L('Enter eggs set count'), 'error');
    if ([hatchedN, brokenN, spoiledN, infertileN, deadInShellN].some((n) => n < 0)) {
      return notify(L('Counts cannot be negative'), 'error');
    }
    const accounted = hatchedN + brokenN + spoiledN + infertileN + deadInShellN;
    if (accounted > set) return notify(`Total accounted eggs (${accounted}) cannot exceed eggs set (${set}).`, 'error');
    if (hatchDate && hatchDate < startDate) return notify(L('Hatch date cannot be before start date'), 'error');

    const payload = {
      startDate,
      eggsSet: set,
      hatchDate: hatchDate || undefined,
      hatched: hatchedN,
      brokenEggs: brokenN || undefined,
      spoiledEggs: spoiledN || undefined,
      infertileEggs: infertileN || undefined,
      deadInShellEggs: deadInShellN || undefined,
      notes: notes.trim() || undefined,
    };

    if (editId !== null) {
      const existing = records.find((record) => record.id === editId);
      onUpdate(editId, {
        ...existing,
        id: editId,
        ...payload,
      });
    } else {
      onAdd(payload);
    }
    resetForm();
  };

  const startEdit = (record: IncubationRecord) => {
    setEditId(record.id);
    setStartDate(record.startDate);
    setEggsSet(String(record.eggsSet));
    setHatchDate(record.hatchDate ?? '');
    setHatched(String(record.hatched));
    setBrokenEggs(String(record.brokenEggs || ''));
    setSpoiledEggs(String(record.spoiledEggs || ''));
    setInfertileEggs(String(record.infertileEggs || ''));
    setDeadInShellEggs(String(record.deadInShellEggs || ''));
    setNotes(record.notes ?? '');
  };

  const startTransfer = (record: IncubationRecord) => {
    setTransferRecordId(record.id);
    setTransferNamePrefix(`Hatch ${record.id}`);
    setTransferBreed('Desi');
    setTransferCustomBreed('');
    setTransferFemaleCount(String(record.hatched));
    setTransferMaleCount('0');
    setTransferPricePerBird('0');
  };

  const openRecordDetail = (record: IncubationRecord) => setActiveDetailId(record.id);

  const handleDeleteFromDetail = async (record: IncubationRecord) => {
    const ok = await confirmAction({
      title: L('Delete Incubation Record'),
      message: record.flockTransferDate
        ? 'Delete this incubation record? Birds already added to flock will stay in the flock registry.'
        : 'Delete this incubation record?',
      confirmLabel: L('Delete Record'),
      cancelLabel: L('Cancel'),
      tone: 'danger',
    });
    if (!ok) return;
    setActiveDetailId(null);
    onDelete(record.id);
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferRecord || !transferRecord.hatchDate || transferRecord.hatched <= 0 || transferRecord.flockTransferDate || !onAddHatchedToFlock) {
      return;
    }

    const femaleCount = parseInt(transferFemaleCount) || 0;
    const maleCount = parseInt(transferMaleCount) || 0;
    const pricePerBird = parseFloat(transferPricePerBird) || 0;

    if ([femaleCount, maleCount].some((value) => value < 0)) {
      return notify(L('Bird counts cannot be negative'), 'error');
    }
    if (femaleCount + maleCount !== transferRecord.hatched) {
      return notify(`Female + Male count must equal hatched chicks (${transferRecord.hatched}).`, 'info');
    }
    if (transferBreed === 'Custom' && !transferCustomBreed.trim()) {
      return notify(L('Please enter a custom breed name.'), 'error');
    }

    const prefix = transferNamePrefix.trim() || `Hatch ${transferRecord.id}`;
    const birdsToAdd: Omit<Bird, 'id'>[] = [];
    let sequence = 1;
    const makeBird = (gender: 'Female' | 'Male'): Omit<Bird, 'id'> => ({
      name: `${prefix} ${String(sequence++).padStart(2, '0')}`,
      gender,
      dateBought: transferRecord.hatchDate!,
      price: pricePerBird,
      status: 'Active',
      ageBoughtDays: 0,
      breed: transferBreed,
      customBreed: transferBreed === 'Custom' ? transferCustomBreed.trim() : undefined,
      dateOfBirth: transferRecord.hatchDate!,
      sourceIncubationId: transferRecord.id,
    });

    for (let i = 0; i < femaleCount; i += 1) {
      birdsToAdd.push(makeBird('Female'));
    }
    for (let i = 0; i < maleCount; i += 1) {
      birdsToAdd.push(makeBird('Male'));
    }

    onAddHatchedToFlock(transferRecord.id, birdsToAdd);
    resetTransferForm();
  };

  const transferPreviewTotal = (parseInt(transferFemaleCount) || 0) + (parseInt(transferMaleCount) || 0);

  const formPreview = useMemo(() => {
    const set = parseInt(eggsSet) || 0;
    const hatchedN = parseInt(hatched) || 0;
    const brokenN = parseInt(brokenEggs) || 0;
    const spoiledN = parseInt(spoiledEggs) || 0;
    const infertileN = parseInt(infertileEggs) || 0;
    const deadN = parseInt(deadInShellEggs) || 0;
    const losses = brokenN + spoiledN + infertileN + deadN;
    const accounted = hatchedN + losses;
    const remaining = Math.max(0, set - accounted);
    const rate = set > 0 ? (hatchedN / set) * 100 : 0;
    return { set, losses, accounted, remaining, rate };
  }, [eggsSet, hatched, brokenEggs, spoiledEggs, infertileEggs, deadInShellEggs]);

  const sortedRecords = useMemo(() => [...records].sort((a, b) => b.startDate.localeCompare(a.startDate)), [records]);
  const totals = useMemo(() => {
    const completed = sortedRecords.filter((record) => !!record.hatchDate);
    const totalSet = sortedRecords.reduce((sum, record) => sum + (record.eggsSet || 0), 0);
    const totalHatched = sortedRecords.reduce((sum, record) => sum + (record.hatched || 0), 0);
    const totalLosses = sortedRecords.reduce((sum, record) => sum + getLossTotals(record).total, 0);
    const totalRemaining = sortedRecords.reduce((sum, record) => sum + remainingEggs(record), 0);
    const avgCompletedRate = completed.length > 0 ? completed.reduce((sum, record) => sum + hatchRate(record), 0) / completed.length : 0;
    return { totalSet, totalHatched, totalLosses, totalRemaining, avgCompletedRate, completedCount: completed.length };
  }, [sortedRecords]);

  return (
    <div className="space-y-6 muf-incubation-redesign">
      <div className="muf-incubation-heading">
        <h2 className="text-xl font-bold font-display text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Egg className="w-5 h-5" /> {t(lang, 'incubation')}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Track eggs set, hatch dates, broken/kharab losses, and true hatch outcomes.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard label={L('Eggs Set')} value={String(totals.totalSet)} accent="amber" />
        <MetricCard label={L('Hatched')} value={String(totals.totalHatched)} accent="emerald" />
        <MetricCard label={L('Losses')} value={String(totals.totalLosses)} accent="rose" helper={L('Broken + rotten + infertile + dead-in-shell')} />
        <MetricCard label={L('Open / Unaccounted')} value={String(totals.totalRemaining)} accent="sky" helper={L('Still incubating or not finalized')} />
        <MetricCard label="Avg Hatch Rate" value={`${totals.completedCount > 0 ? totals.avgCompletedRate.toFixed(0) : 0}%`} accent="violet" helper={totals.completedCount > 0 ? `${totals.completedCount} completed record(s)` : 'No completed records yet'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {canChange && (
          <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
            <h3 className="font-bold text-sm flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Plus className="w-4 h-4" /> {t(lang, 'add')}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="muf-field" />
              <input type="date" value={hatchDate} onChange={(e) => setHatchDate(e.target.value)} className="muf-field" />
            </div>
            <input type="number" min="1" required placeholder={L('Eggs set')} value={eggsSet} onChange={(e) => setEggsSet(e.target.value)} className="muf-field" />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min="0" placeholder={L('Hatched chicks')} value={hatched} onChange={(e) => setHatched(e.target.value)} className="muf-field" />
              <input type="number" min="0" placeholder={L('Broken eggs')} value={brokenEggs} onChange={(e) => setBrokenEggs(e.target.value)} className="muf-field" />
              <input type="number" min="0" placeholder={L('Rotten / kharab')} value={spoiledEggs} onChange={(e) => setSpoiledEggs(e.target.value)} className="muf-field" />
              <input type="number" min="0" placeholder={L('Infertile')} value={infertileEggs} onChange={(e) => setInfertileEggs(e.target.value)} className="muf-field" />
              <input type="number" min="0" placeholder={L('Dead in shell')} value={deadInShellEggs} onChange={(e) => setDeadInShellEggs(e.target.value)} className="w-full px-3 py-2 border rounded-xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 col-span-2" />
            </div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={L('Notes (hatch quality, humidity issue, rotten eggs, etc.)')} className="w-full px-3 py-2 border rounded-xl h-20 resize-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
            {formPreview.set > 0 && (
              <div className="p-3 rounded-xl border border-amber-100 bg-amber-50/70 dark:bg-amber-900/10 dark:border-amber-900 space-y-1 text-[11px] font-mono text-slate-700 dark:text-slate-300">
                <div className="flex justify-between"><span>{L('Accounted:')}</span><span className="font-bold">{formPreview.accounted} / {formPreview.set}</span></div>
                <div className="flex justify-between"><span>{L('Losses:')}</span><span className="font-bold">{formPreview.losses}</span></div>
                <div className="flex justify-between"><span>{L('Open / unaccounted:')}</span><span className="font-bold">{formPreview.remaining}</span></div>
                <div className="flex justify-between border-t border-amber-100 dark:border-amber-900 pt-1 mt-1"><span>{L('Hatch rate:')}</span><span className="font-bold text-emerald-700 dark:text-emerald-400">{formPreview.rate.toFixed(0)}%</span></div>
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-2 bg-green-700 text-white rounded-xl font-semibold hover:bg-green-800">{t(lang, 'save')}</button>
            </div>
          </form>
        )}

        <div className={canChange ? 'lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden' : 'lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden'}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 text-3xs uppercase text-slate-500 dark:text-slate-400">
                  <th className="p-3">{L('Start')}</th>
                  <th className="p-3">{L('Hatch')}</th>
                  <th className="p-3">{L('Status')}</th>
                  <th className="p-3">{L('Set')}</th>
                  <th className="p-3">{L('Hatched')}</th>
                  <th className="p-3 sm:hidden text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sortedRecords.map((record) => {
                  const status = incubationStatus(record);
                  return (
                    <tr
                      key={record.id}
                      className="align-top cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      onClick={() => openRecordDetail(record)}
                      title={L('View incubation details')}
                    >
                      <td className="p-3 font-mono whitespace-nowrap dark:text-slate-200">{record.startDate}</td>
                      <td className="p-3 font-mono whitespace-nowrap dark:text-slate-200">{record.hatchDate || '—'}</td>
                      <td className="p-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${status.className}`}>{status.label}</span></td>
                      <td className="p-3 dark:text-slate-200">{record.eggsSet}</td>
                      <td className="p-3 font-semibold text-emerald-700 dark:text-emerald-400">{record.hatched}</td>
                      <td className="p-3 sm:hidden text-right text-slate-400"><Eye className="w-4 h-4 inline-block" /></td>
                    </tr>
                  );
                })}
                {records.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">{L('No incubation records')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <DetailModal
        open={!!activeDetailRecord}
        onClose={() => setActiveDetailId(null)}
        title={L('Incubation Record Details')}
        subtitle={activeDetailRecord ? `Record #${activeDetailRecord.id}` : undefined}
        icon={<Egg className="w-5 h-5" />}
        iconBg="bg-emerald-100 text-emerald-700"
        size="small"
      >
        {activeDetailRecord && (() => {
          const losses = getLossTotals(activeDetailRecord);
          const open = remainingEggs(activeDetailRecord);
          const status = incubationStatus(activeDetailRecord);
          const canTransferRecord = !!onAddHatchedToFlock && !!canTransferToFlock && !!activeDetailRecord.hatchDate && activeDetailRecord.hatched > 0 && !activeDetailRecord.flockTransferDate;
          return (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <IncubationDetailTile label={L('Start Date')} value={activeDetailRecord.startDate} />
                <IncubationDetailTile label={L('Hatch Date')} value={activeDetailRecord.hatchDate || '—'} />
                <IncubationDetailTile label="Eggs Set" value={`${activeDetailRecord.eggsSet}`} />
                <IncubationDetailTile label="Hatched" value={`${activeDetailRecord.hatched}`} />
                <IncubationDetailTile label="Losses" value={`${losses.total}`} />
                <IncubationDetailTile label="Open" value={`${open}`} />
                <IncubationDetailTile label="Hatch Rate" value={activeDetailRecord.hatchDate ? `${hatchRate(activeDetailRecord).toFixed(0)}%` : 'In progress'} />
                <IncubationDetailTile label={L('Status')} value={status.label} />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{L('Loss Breakdown')}</p>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono text-slate-700">
                  <span>Broken: {losses.broken}</span>
                  <span>Spoiled: {losses.spoiled}</span>
                  <span>Infertile: {losses.infertile}</span>
                  <span>Dead in Shell: {losses.deadInShell}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{L('Notes')}</p>
                <p className="mt-1 text-sm text-slate-700">{activeDetailRecord.notes || 'No notes added.'}</p>
              </div>

              {activeDetailRecord.flockTransferDate && (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                  Added to flock: {activeDetailRecord.flockTransferCount || activeDetailRecord.hatched} chick(s) on {activeDetailRecord.flockTransferDate}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDeleteFromDetail(activeDetailRecord)}
                    className="muf-btn muf-btn-danger"
                  >
                    {L('Delete Record')}
                  </button>
                )}
                {canChange && (
                  <button
                    type="button"
                    onClick={() => {
                      startEdit(activeDetailRecord);
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700"
                  >
                    {L('Edit Record')}
                  </button>
                )}
                {canTransferRecord && (
                  <button
                    type="button"
                    onClick={() => {
                      startTransfer(activeDetailRecord);
                    }}
                    className="px-4 py-2 rounded-xl bg-farm-600 text-white font-semibold text-xs hover:bg-farm-700"
                  >
                    {L('Add to Flock')}
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </DetailModal>

      <DetailModal open={editId !== null} onClose={resetForm} title={L('Edit Incubation Record')} icon={<Pencil className="w-5 h-5" />} iconBg="bg-green-100 text-green-700" size="small">
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {isTransferredRecord && (
            <div className="rounded-2xl border border-sky-100 bg-sky-50 px-3 py-2 text-[11px] text-sky-800">
              This hatch has already been added to the flock registry, so core hatch counts are locked to keep flock totals consistent.
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input type="date" required disabled={isTransferredRecord} value={startDate} onChange={(e) => setStartDate(e.target.value)} className="muf-field" />
            <input type="date" disabled={isTransferredRecord} value={hatchDate} onChange={(e) => setHatchDate(e.target.value)} className="muf-field" />
          </div>
          <input type="number" min="1" required disabled={isTransferredRecord} placeholder={L('Eggs set')} value={eggsSet} onChange={(e) => setEggsSet(e.target.value)} className="muf-field" />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min="0" disabled={isTransferredRecord} placeholder={L('Hatched chicks')} value={hatched} onChange={(e) => setHatched(e.target.value)} className="muf-field" />
            <input type="number" min="0" disabled={isTransferredRecord} placeholder={L('Broken eggs')} value={brokenEggs} onChange={(e) => setBrokenEggs(e.target.value)} className="muf-field" />
            <input type="number" min="0" disabled={isTransferredRecord} placeholder={L('Rotten / kharab')} value={spoiledEggs} onChange={(e) => setSpoiledEggs(e.target.value)} className="muf-field" />
            <input type="number" min="0" disabled={isTransferredRecord} placeholder={L('Infertile')} value={infertileEggs} onChange={(e) => setInfertileEggs(e.target.value)} className="muf-field" />
            <input type="number" min="0" disabled={isTransferredRecord} placeholder={L('Dead in shell')} value={deadInShellEggs} onChange={(e) => setDeadInShellEggs(e.target.value)} className="w-full px-3 py-2 border rounded-xl col-span-2 disabled:bg-slate-100 disabled:text-slate-400" />
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={L('Notes')} className="w-full px-3 py-2 border rounded-xl h-20 resize-none" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={resetForm} className="px-4 py-2 border rounded-xl">{L('Cancel')}</button>
            <button type="submit" className="px-4 py-2 bg-green-700 text-white rounded-xl font-semibold hover:bg-green-800">{L('Update Record')}</button>
          </div>
        </form>
      </DetailModal>

      <DetailModal
        open={transferRecordId !== null}
        onClose={resetTransferForm}
        title={L('Add Hatched Chicks to Flock Registry')}
        subtitle={transferRecord ? `Incubation #${transferRecord.id} · ${transferRecord.hatched} chick(s)` : undefined}
        icon={<BirdIcon className="w-5 h-5" />}
        iconBg="bg-emerald-100 text-emerald-700"
        size="small"
      >
        <form onSubmit={handleTransferSubmit} className="space-y-4 text-xs">
          {transferRecord && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
              This will create {transferRecord.hatched} active bird record(s) with hatch date <span className="font-mono">{transferRecord.hatchDate}</span>. This action can only be run once for this incubation record.
            </div>
          )}

          <div>
            <label className="block text-2xs font-bold text-slate-500 uppercase tracking-wider mb-1">{L('Bird Name Prefix')}</label>
            <input
              type="text"
              value={transferNamePrefix}
              onChange={(e) => setTransferNamePrefix(e.target.value)}
              placeholder={L('e.g. August Hatch')}
              className="w-full px-3 py-2 border rounded-xl"
            />
            <p className="mt-1 text-[10px] text-slate-400">Birds will be named automatically like “{transferNamePrefix || 'Hatch'} 01, 02...”</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-2xs font-bold text-slate-500 uppercase tracking-wider mb-1">Female Chicks *</label>
              <input
                type="number"
                min="0"
                required
                value={transferFemaleCount}
                onChange={(e) => setTransferFemaleCount(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>
            <div>
              <label className="block text-2xs font-bold text-slate-500 uppercase tracking-wider mb-1">Male Chicks *</label>
              <input
                type="number"
                min="0"
                required
                value={transferMaleCount}
                onChange={(e) => setTransferMaleCount(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
            Planned: <span className="font-bold">{transferPreviewTotal}</span>
            {transferRecord && (
              <span> / Required: <span className="font-bold">{transferRecord.hatched}</span></span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-2xs font-bold text-slate-500 uppercase tracking-wider mb-1">{L('Breed / Type')}</label>
              <select
                value={transferBreed}
                onChange={(e) => setTransferBreed(e.target.value as BirdBreed)}
                className="w-full px-3 py-2 border rounded-xl"
              >
                <option value="Desi">{L('Desi')}</option>
                <option value="Aseel">{L('Aseel')}</option>
                <option value="Rhode Island">{L('Rhode Island')}</option>
                <option value="Golden">{L('Golden')}</option>
                <option value="Misri">{L('Misri')}</option>
                <option value="Broiler">{L('Broiler')}</option>
                <option value="Layer">{L('Layer')}</option>
                <option value="Fayoumi">{L('Fayoumi')}</option>
                <option value="Custom">{L('Custom')}</option>
              </select>
            </div>
            <div>
              <label className="block text-2xs font-bold text-slate-500 uppercase tracking-wider mb-1">{L('Cost per Chick (Rs)')}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={transferPricePerBird}
                onChange={(e) => setTransferPricePerBird(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>
          </div>

          {transferBreed === 'Custom' && (
            <div>
              <label className="block text-2xs font-bold text-slate-500 uppercase tracking-wider mb-1">Custom Breed Name *</label>
              <input
                type="text"
                required
                value={transferCustomBreed}
                onChange={(e) => setTransferCustomBreed(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>
          )}

          <div className="rounded-2xl border border-sky-100 bg-sky-50 px-3 py-2 text-[11px] text-sky-800">
            Vaccination date is not set here. Use the Health Portal later when vaccination is actually logged.
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={resetTransferForm} className="px-4 py-2 border rounded-xl">{L('Cancel')}</button>
            <button type="submit" className="px-4 py-2 bg-farm-600 text-white rounded-xl font-semibold hover:bg-farm-700">{L('Add Chicks')}</button>
          </div>
        </form>
      </DetailModal>
    </div>
  );
}

function MetricCard({ label, value, accent, helper }: { label: string; value: string; accent: 'amber' | 'emerald' | 'rose' | 'sky' | 'violet'; helper?: string }) {
  const styles = {
    amber: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/10 dark:border-amber-900 dark:text-amber-300',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/10 dark:border-emerald-900 dark:text-emerald-300',
    rose: 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-900/10 dark:border-rose-900 dark:text-rose-300',
    sky: 'bg-sky-50 border-sky-200 text-sky-800 dark:bg-sky-900/10 dark:border-sky-900 dark:text-sky-300',
    violet: 'bg-violet-50 border-violet-200 text-violet-800 dark:bg-violet-900/10 dark:border-violet-900 dark:text-violet-300',
  }[accent];

  return (
    <div className={`rounded-xl border p-4 ${styles}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold font-mono mt-1">{value}</p>
      {helper && <p className="text-[11px] opacity-80 mt-1">{helper}</p>}
    </div>
  );
}

function IncubationDetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold font-mono text-slate-800">{value}</p>
    </div>
  );
}
