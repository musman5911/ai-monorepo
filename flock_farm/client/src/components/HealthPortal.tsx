import React, { useMemo, useState } from 'react';
import { 
  HeartPulse, 
  ShieldAlert,
  Syringe,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Check,
  Plus,
  History,
  Eye
} from 'lucide-react';
import { Bird, DeathReason, VaccinationRecord, Lang } from '../types';
import { todayStr, diffDateOnlyDays } from '../utils/calculations';
import { useConfirm, notify } from '../muf/core/muf-confirm';
import DetailModal from '../muf/core/muf-modal';
import { L } from '../i18n';

interface HealthPortalProps {
  birds: Bird[];
  vaccinations: VaccinationRecord[];
  vaccinationIntervalDays: number;
  onUpdateBird: (id: number, bird: Bird) => void;
  onAddVaccination: (v: Omit<VaccinationRecord, 'id'>) => void;
  onUpdateVaccination: (id: number, v: Omit<VaccinationRecord, 'id'>) => void;
  onDeleteVaccination: (id: number) => void;
  canDelete?: boolean;
  isAdmin?: boolean;
  lang?: Lang;
  vaccinationOnly?: boolean;
}

export default function HealthPortal({
  birds,
  vaccinations,
  vaccinationIntervalDays,
  onUpdateBird,
  onAddVaccination,
  onUpdateVaccination,
  onDeleteVaccination,
  canDelete = true,
  isAdmin = true,
  vaccinationOnly = false,
}: HealthPortalProps) {
  const confirmAction = useConfirm();
  // --- B. MORTALITY ENGINE ---
  const deadBirds = birds.filter(b => b.status === 'Dead');
  const totalDeadCount = deadBirds.length;

  // Breakdown by death reason category
  const deathBreakdown: Record<DeathReason, number> = {
    Disease: deadBirds.filter(b => b.deathReason === 'Disease').length,
    Injury: deadBirds.filter(b => b.deathReason === 'Injury').length,
    Predator: deadBirds.filter(b => b.deathReason === 'Predator').length,
    Other: deadBirds.filter(b => b.deathReason === 'Other').length,
    Unknown: deadBirds.filter(b => b.deathReason === 'Unknown').length,
  };

  // --- C. VACCINATION ENGINE ---
  // Tracks vaccine health compliance for birds currently in the flock,
  // including birds marked Sick.
  const activeBirds = birds.filter(b => b.status === 'Active' || b.status === 'Sick');

  const getVaccinationStatus = (lastVaccinationDate: string | undefined) => {
    if (!lastVaccinationDate) {
      return { 
        status: 'Not Recorded' as const, 
        label: '⚠ Not Recorded', 
        color: 'bg-amber-50 text-amber-800 border-amber-200', 
        icon: HelpCircle,
        days: -1 
      };
    }
    const diffDays = diffDateOnlyDays(lastVaccinationDate, todayStr());

    if (diffDays > vaccinationIntervalDays) {
      return { 
        status: 'Overdue' as const, 
        label: '🔴 Overdue', 
        color: 'bg-red-50 text-red-800 border-red-200', 
        icon: XCircle,
        days: diffDays 
      };
    } else if (diffDays >= vaccinationIntervalDays - 7) {
      return { 
        status: 'Due Soon' as const, 
        label: '🟡 Due Soon', 
        color: 'bg-yellow-50 text-yellow-800 border-yellow-200', 
        icon: AlertTriangle,
        days: diffDays 
      };
    } else {
      return { 
        status: 'OK' as const, 
        label: '✅ OK', 
        color: 'bg-green-50 text-green-800 border-green-200', 
        icon: CheckCircle2,
        days: diffDays 
      };
    }
  };

  // Compile aggregate metrics for vaccinations
  const vacMetrics = {
    notRecorded: 0,
    overdue: 0,
    dueSoon: 0,
    ok: 0
  };

  activeBirds.forEach(bird => {
    const info = getVaccinationStatus(bird.lastVaccinationDate);
    if (info.status === 'Not Recorded') vacMetrics.notRecorded++;
    else if (info.status === 'Overdue') vacMetrics.overdue++;
    else if (info.status === 'Due Soon') vacMetrics.dueSoon++;
    else if (info.status === 'OK') vacMetrics.ok++;
  });

  // --- D. VACCINATION HISTORY LOG ---
  const [logBirdId, setLogBirdId] = useState<string>('');
  const [logDate, setLogDate] = useState(todayStr());
  const [logVaccineName, setLogVaccineName] = useState('');
  const [logDose, setLogDose] = useState('');
  const [logCost, setLogCost] = useState('');
  const [logNotes, setLogNotes] = useState('');
  const [activeVaccinationId, setActiveVaccinationId] = useState<number | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [editVax, setEditVax] = useState<VaccinationRecord | null>(null);
  const [editVaxForm, setEditVaxForm] = useState({ birdId: '', date: '', vaccineName: '', dose: '', cost: '', notes: '' });

  const sortedVaccinations = [...vaccinations].sort((a, b) => b.date.localeCompare(a.date));
  const activeVaccination = useMemo(
    () => vaccinations.find((record) => record.id === activeVaccinationId) || null,
    [vaccinations, activeVaccinationId],
  );

  const getBirdName = (birdId: number) => birds.find(b => b.id === birdId)?.name || `Bird #${birdId}`;

  const handleLogVaccinationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logBirdId) return notify(L('Please select a bird'), 'error');
    if (!logVaccineName.trim()) return notify(L('Please enter the vaccine name'), 'error');

    const birdId = parseInt(logBirdId);
    onAddVaccination({
      birdId,
      date: logDate,
      vaccineName: logVaccineName.trim(),
      dose: logDose.trim() || undefined,
      cost: logCost ? parseFloat(logCost) : undefined,
      notes: logNotes.trim() || undefined,
    });

    // Keep the bird's "last vaccination date" quick-glance field in sync
    const bird = birds.find(b => b.id === birdId);
    if (bird && (!bird.lastVaccinationDate || logDate >= bird.lastVaccinationDate)) {
      onUpdateBird(birdId, { ...bird, lastVaccinationDate: logDate });
    }

    setLogVaccineName('');
    setLogDose('');
    setLogCost('');
    setLogNotes('');
    setShowLogModal(false);
  };

  // Action: Mark vaccinated today (quick action) — also logs a history entry
  const handleMarkVaccinated = (bird: Bird) => {
    const today = todayStr();
    onUpdateBird(bird.id, {
      ...bird,
      lastVaccinationDate: today
    });
    onAddVaccination({
      birdId: bird.id,
      date: today,
      vaccineName: 'General',
      notes: 'Logged via quick "Vaccine Today" action',
    });
  };

  const openEditVaccination = (record: VaccinationRecord) => {
    setEditVax(record);
    setEditVaxForm({
      birdId: String(record.birdId),
      date: record.date,
      vaccineName: record.vaccineName,
      dose: record.dose || '',
      cost: record.cost !== undefined ? String(record.cost) : '',
      notes: record.notes || '',
    });
  };

  const handleEditVaccinationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editVax) return;
    if (!editVaxForm.birdId) return notify(L('Please select a bird'), 'error');
    if (!editVaxForm.vaccineName.trim()) return notify(L('Please enter the vaccine name'), 'error');
    const birdId = parseInt(editVaxForm.birdId);
    onUpdateVaccination(editVax.id, {
      birdId,
      date: editVaxForm.date,
      vaccineName: editVaxForm.vaccineName.trim(),
      dose: editVaxForm.dose.trim() || undefined,
      cost: editVaxForm.cost ? parseFloat(editVaxForm.cost) : undefined,
      notes: editVaxForm.notes.trim() || undefined,
    });
    const bird = birds.find((b) => b.id === birdId);
    if (bird && editVaxForm.date >= (bird.lastVaccinationDate || '')) {
      onUpdateBird(birdId, { ...bird, lastVaccinationDate: editVaxForm.date });
    }
    setEditVax(null);
  };

  const handleDeleteVaccinationFromDetail = async (record: VaccinationRecord) => {
    const ok = await confirmAction({
      title: L('Delete Vaccination Record'),
      message: L('Delete this vaccination record?'),
      confirmLabel: L('Delete Record'),
      cancelLabel: L('Cancel'),
      tone: 'danger',
    });
    if (!ok) return;
    setActiveVaccinationId(null);
    onDeleteVaccination(record.id);
  };

  return (
    <div className="space-y-6 muf-health-redesign muf-flock-health" id="health-portal-tab">
      {/* Header */}
      <div className="muf-page-hero">
        <div className="muf-page-title">
          <div className="muf-title-icon"><HeartPulse size={28}/></div>
          <div>
            <h2>{vaccinationOnly ? L('Vaccination') : L('Health')}</h2>
            <p>{vaccinationOnly ? L('Track vaccine schedules, due dates and vaccination history for home birds.') : 'Monitor mortality stats and track vaccination schedules to keep your flock immune and healthy.'}</p>
          </div>
        </div>
      </div>

      <div className="muf-kpi-grid">
        <HealthStatCard label="Birds In Flock" value={`${activeBirds.length}`} accent="emerald" />
        <HealthStatCard label={L('Sick Birds')} value={`${birds.filter((b) => b.status === 'Sick').length}`} accent="amber" />
        <HealthStatCard label="Vaccines Overdue" value={`${vacMetrics.overdue}`} accent="rose" />
        {!vaccinationOnly && <HealthStatCard label="Dead Birds" value={`${deadBirds.length}`} accent="slate" />}
      </div>

      {/* Grid: Vaccination compliance metrics on left, Mortality overview on right */}
      <div className={vaccinationOnly ? "grid grid-cols-1 gap-6" : "grid grid-cols-1 lg:grid-cols-2 gap-6"}>
        {/* VACCINATION TRACKER PANEL */}
        <div className="muf-panel p-4 sm:p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 font-display flex items-center gap-2">
              <Syringe className="w-5 h-5 text-indigo-600" /> Vaccination Scheduler
            </h3>
            <span className="text-2xs font-mono bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-100 font-bold shrink-0">
              Interval: {vaccinationIntervalDays} Days
            </span>
          </div>

          {/* Aggregates view */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 bg-emerald-50/60 border border-emerald-100 text-center rounded-xl">
              <span className="text-lg font-extrabold font-mono text-emerald-700">{vacMetrics.ok}</span>
              <p className="text-4xs font-semibold text-emerald-800 uppercase font-mono tracking-wider mt-1">✅ OK</p>
            </div>
            <div className="p-3 bg-amber-50/60 border border-amber-100 text-center rounded-xl">
              <span className="text-lg font-extrabold font-mono text-amber-700">{vacMetrics.dueSoon}</span>
              <p className="text-4xs font-semibold text-amber-800 uppercase font-mono tracking-wider mt-1">🟡 Due Soon</p>
            </div>
            <div className="p-3 bg-rose-50/60 border border-rose-100 text-center rounded-xl">
              <span className="text-lg font-extrabold font-mono text-rose-700">{vacMetrics.overdue}</span>
              <p className="text-4xs font-semibold text-rose-800 uppercase font-mono tracking-wider mt-1">🔴 Overdue</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 text-center rounded-xl">
              <span className="text-lg font-extrabold font-mono text-slate-700 dark:text-slate-200">{vacMetrics.notRecorded}</span>
              <p className="text-4xs font-semibold text-slate-800 dark:text-slate-100 uppercase font-mono tracking-wider mt-1">⚠ No Record</p>
            </div>
          </div>

          {/* Active birds schedule list */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-400 font-mono uppercase tracking-wider">{L('Flock Immunization Log')}</h4>
            
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
              {activeBirds.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-400 italic bg-slate-50/50">{L('No active birds registered.')}</p>
              ) : (
                activeBirds.map(bird => {
                  const info = getVaccinationStatus(bird.lastVaccinationDate);
                  const IconComponent = info.icon;
                  
                  return (
                    <div key={bird.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 text-xs bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 gap-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 dark:text-slate-100">{bird.name}</span>
                          <span className={`px-1.5 py-0.2 rounded text-3xs font-semibold ${bird.gender === 'Male' ? 'bg-sky-50 text-sky-700' : 'bg-rose-50 text-rose-700'}`}>
                            {bird.gender}
                          </span>
                        </div>
                        <p className="text-3xs text-slate-500 font-mono mt-0.5">
                          Last: {bird.lastVaccinationDate || 'Never recorded'} 
                          {info.days >= 0 && ` (${info.days} days ago)`}
                        </p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto">
                        <span className={`px-2 py-0.5 border text-3xs font-bold font-mono rounded-md flex items-center gap-1 shrink-0 ${info.color}`}>
                          <IconComponent className="w-3 h-3 shrink-0" /> {info.status}
                        </span>
                        
                        {isAdmin && (
                          <button 
                            onClick={() => handleMarkVaccinated(bird)}
                            className="px-2.5 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-3xs font-bold border border-indigo-100 transition shrink-0 flex items-center gap-0.5 cursor-pointer"
                            title={L('Click to register vaccination today')}
                          >
                            <Check className="w-3 h-3" /> Vaccine Today
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* MORTALITY LOG SUMMARY */}
        {!vaccinationOnly && (
        <div className="muf-panel p-4 sm:p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 font-display flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" /> Mortality Engine
            </h3>
            <span className="text-2xs font-mono bg-rose-50 text-rose-700 px-2.5 py-0.5 rounded-full border border-rose-100 font-bold shrink-0">
              Total Dead Count: {totalDeadCount}
            </span>
          </div>

          {/* Deaths breakdown categorized card */}
          <div>
            <h4 className="text-xs font-semibold text-slate-400 font-mono uppercase tracking-wider mb-2.5">{L('Losses Breakdown by Cause')}</h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs font-semibold">
              <div className="p-2.5 bg-red-50/50 rounded-xl border border-red-100">
                <span className="text-lg font-bold font-mono text-red-800">{deathBreakdown.Disease}</span>
                <p className="text-4xs text-red-600 mt-1 uppercase font-mono tracking-wider">{L('Disease')}</p>
              </div>
              <div className="p-2.5 bg-amber-50/50 rounded-xl border border-amber-100">
                <span className="text-lg font-bold font-mono text-amber-800">{deathBreakdown.Injury}</span>
                <p className="text-4xs text-amber-600 mt-1 uppercase font-mono tracking-wider">{L('Injury')}</p>
              </div>
              <div className="p-2.5 bg-orange-50/50 rounded-xl border border-orange-100">
                <span className="text-lg font-bold font-mono text-orange-800">{deathBreakdown.Predator}</span>
                <p className="text-4xs text-orange-600 mt-1 uppercase font-mono tracking-wider">{L('Predator')}</p>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-lg font-bold font-mono text-slate-800 dark:text-slate-100">{deathBreakdown.Other}</span>
                <p className="text-4xs text-slate-600 mt-1 uppercase font-mono tracking-wider">{L('Other')}</p>
              </div>
              <div className="p-2.5 bg-slate-100/50 rounded-xl border border-slate-200">
                <span className="text-lg font-bold font-mono text-slate-800 dark:text-slate-100">{deathBreakdown.Unknown}</span>
                <p className="text-4xs text-slate-600 mt-1 uppercase font-mono tracking-wider">{L('Unknown')}</p>
              </div>
            </div>
          </div>

          {/* Historical Dead Birds details register */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-400 font-mono uppercase tracking-wider">{L('Deceased Birds History')}</h4>
            
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
              {deadBirds.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-400 italic bg-slate-50/50">Zero mortality logs found. Excellent coop health!</p>
              ) : (
                deadBirds.map(bird => (
                  <div key={bird.id} className="p-3 bg-rose-50/10 hover:bg-rose-50/25 text-xs border-b border-slate-100 last:border-0">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 dark:text-slate-100">{bird.name}</span>
                          <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 border border-rose-200 rounded text-3xs font-bold font-mono">
                            {bird.deathReason}
                          </span>
                        </div>
                        <p className="text-3xs text-slate-500 font-mono mt-0.5">Bought: {bird.dateBought} ({bird.price ? `Rs ${bird.price}` : 'Free'})</p>
                      </div>
                      <div className="sm:text-right shrink-0">
                        <span className="text-rose-700 font-mono font-bold text-3xs uppercase tracking-wider block">Died on {bird.dateDied}</span>
                        <span className="text-3xs text-slate-400 font-mono mt-0.5 block">Age bought: {bird.ageBoughtDays} days</span>
                      </div>
                    </div>
                    {bird.deathDetail && (
                      <div className="mt-2 text-3xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-900/50 p-2 rounded-lg italic">
                        "{bird.deathDetail}"
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        )}
      </div>

      {/* VACCINATION HISTORY LOG */}
      <div className="muf-panel p-4 sm:p-6 space-y-5">
        <div className="muf-section-head border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 font-display flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" /> Vaccination History Log
          </h3>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowLogModal(true)}
              className="muf-add-btn"
              aria-label={L('Log vaccination record')}
              title={L('Log vaccination record')}
              id="btn-open-vaccination-log"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-400 font-mono uppercase tracking-wider">
            Full History ({sortedVaccinations.length} records)
          </h4>
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
            {sortedVaccinations.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-400 italic bg-slate-50/50">{L('No vaccination records logged yet.')}</p>
            ) : (
              sortedVaccinations.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => setActiveVaccinationId(record.id)}
                  className="w-full flex items-center justify-between gap-2 p-3 text-xs bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 text-left"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 dark:text-slate-100">{getBirdName(record.birdId)}</span>
                      <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded text-3xs font-semibold">
                        {record.vaccineName}
                      </span>
                    </div>
                    <p className="text-3xs text-slate-500 font-mono mt-0.5">{record.date}</p>
                  </div>
                  <div className="text-right text-3xs text-slate-400 flex items-center gap-2">
                    <span className="hidden sm:inline">{record.cost ? `Rs ${record.cost.toLocaleString()}` : 'No cost'}</span>
                    <span className="sm:hidden"><Eye className="w-4 h-4" /></span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {isAdmin && (
        <DetailModal
          open={showLogModal}
          onClose={() => setShowLogModal(false)}
          title={L('Log Vaccination Record')}
          icon={<Syringe className="w-5 h-5" />}
          iconBg="bg-indigo-100 text-indigo-700"
          size="small"
        >
          <form onSubmit={handleLogVaccinationSubmit} className="space-y-3">
              <div>
                <label className="muf-pc-label-2xs-slate">Bird *</label>
                <select
                  value={logBirdId}
                  onChange={(e) => setLogBirdId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-400 focus:outline-hidden"
                  id="vaccination-log-bird-select"
                >
                  <option value="">{L('Select a bird...')}</option>
                  {birds.filter((b) => b.status === 'Active' || b.status === 'Sick').map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.status})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="muf-pc-label-2xs-slate">Date *</label>
                  <input
                    type="date"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-400 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="muf-pc-label-2xs-slate">{L('Cost (Rs)')}</label>
                  <input
                    type="number"
                    min="0"
                    placeholder={L('Optional')}
                    value={logCost}
                    onChange={(e) => setLogCost(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-400 focus:outline-hidden"
                  />
                </div>
              </div>
              <div>
                <label className="muf-pc-label-2xs-slate">Vaccine Name *</label>
                <input
                  type="text"
                  placeholder={L('e.g. Newcastle Disease')}
                  value={logVaccineName}
                  onChange={(e) => setLogVaccineName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-400 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="muf-pc-label-2xs-slate">{L('Dose')}</label>
                <input
                  type="text"
                  placeholder="e.g. 0.5ml"
                  value={logDose}
                  onChange={(e) => setLogDose(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-400 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="muf-pc-label-2xs-slate">{L('Notes')}</label>
                <textarea
                  placeholder={L('Optional notes')}
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  rows={2}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-400 focus:outline-hidden resize-none"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
                id="btn-log-vaccination"
              >
                <Plus className="w-4 h-4" /> {L('Log Vaccination Record')}
              </button>
          </form>
        </DetailModal>
      )}

      <DetailModal
        open={!!activeVaccination}
        onClose={() => setActiveVaccinationId(null)}
        title={L('Vaccination Record Details')}
        subtitle={activeVaccination ? getBirdName(activeVaccination.birdId) : undefined}
        icon={<Syringe className="w-5 h-5" />}
        iconBg="bg-indigo-100 text-indigo-700"
        size="small"
      >
        {activeVaccination && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <HealthDetailTile label={L('Bird')} value={getBirdName(activeVaccination.birdId)} />
              <HealthDetailTile label={L('Date')} value={activeVaccination.date} />
              <HealthDetailTile label={L('Vaccine')} value={activeVaccination.vaccineName} />
              <HealthDetailTile label={L('Dose')} value={activeVaccination.dose || '—'} />
              <HealthDetailTile label="Cost" value={typeof activeVaccination.cost === 'number' ? `Rs ${activeVaccination.cost.toLocaleString()}` : '—'} />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{L('Notes')}</p>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{activeVaccination.notes || 'No notes added.'}</p>
            </div>
            {isAdmin && (
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDeleteVaccinationFromDetail(activeVaccination)}
                    className="muf-btn muf-btn-danger"
                  >
                    {L('Delete Record')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openEditVaccination(activeVaccination)}
                  className="px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold text-xs hover:bg-emerald-100"
                >
                  {L('Edit Record')}
                </button>
              </div>
            )}
          </div>
        )}
      </DetailModal>

      {/* --- EDIT VACCINATION MODAL --- */}
      <DetailModal
        open={!!editVax}
        onClose={() => setEditVax(null)}
        title={L('Edit Vaccination Record')}
        subtitle={editVax ? getBirdName(editVax.birdId) : undefined}
        icon={<Syringe className="w-5 h-5" />}
        iconBg="bg-indigo-100 text-indigo-700"
        size="small"
      >
        {editVax && (
          <form onSubmit={handleEditVaccinationSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="muf-pc-label-2xs-gray">Bird *</label>
                <select value={editVaxForm.birdId} onChange={(e) => setEditVaxForm({ ...editVaxForm, birdId: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-hidden">
                  <option value="">{L('Select bird')}</option>
                  {birds.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="muf-pc-label-2xs-gray">Date *</label>
                <input type="date" required value={editVaxForm.date} onChange={(e) => setEditVaxForm({ ...editVaxForm, date: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-hidden" />
              </div>
            </div>
            <div>
              <label className="muf-pc-label-2xs-gray">Vaccine Name *</label>
              <input type="text" required value={editVaxForm.vaccineName} onChange={(e) => setEditVaxForm({ ...editVaxForm, vaccineName: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-hidden" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="muf-pc-label-2xs-gray">{L('Dose')}</label>
                <input type="text" value={editVaxForm.dose} onChange={(e) => setEditVaxForm({ ...editVaxForm, dose: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-hidden" />
              </div>
              <div>
                <label className="muf-pc-label-2xs-gray">{L('Cost (Rs)')}</label>
                <input type="number" min="0" step="any" value={editVaxForm.cost} onChange={(e) => setEditVaxForm({ ...editVaxForm, cost: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-hidden" />
              </div>
            </div>
            <div>
              <label className="muf-pc-label-2xs-gray">{L('Notes')}</label>
              <textarea rows={2} value={editVaxForm.notes} onChange={(e) => setEditVaxForm({ ...editVaxForm, notes: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-hidden" />
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button type="button" onClick={() => setEditVax(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition">{L('Cancel')}</button>
              <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition">{L('Save Changes')}</button>
            </div>
          </form>
        )}
      </DetailModal>
    </div>
  );
}

function HealthStatCard({ label, value, accent }: { label: string; value: string; accent: 'emerald' | 'amber' | 'rose' | 'slate' }) {
  const styles = {
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300',
    amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300',
    rose: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300',
    slate: 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200',
  }[accent];

  return (
    <div className={`rounded-xl border p-4 ${styles}`}>
      <p className="text-[10px] uppercase tracking-wider font-bold opacity-80">{label}</p>
      <p className="text-lg font-bold font-mono mt-1">{value}</p>
    </div>
  );
}

function HealthDetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold font-mono text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}
