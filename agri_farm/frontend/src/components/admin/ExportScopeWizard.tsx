import { useState } from 'react';
import { Check, Printer } from 'lucide-react';

/**
 * Drill-down export wizard: Year → (whole year OR dig) → Season → (whole
 * season OR dig) → specific crops. Used by both the finance-focused and the
 * yield-focused report cards; only the onExport target differs.
 */
export function ExportScopeWizard({ crops = [], accent = 'finance', onExport }) {
  const [year, setYear] = useState('');
  const [step, setStep] = useState('year');        // 'year' | 'season' | 'crops'
  const [season, setSeason] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  const years = [...new Set(crops.map(c => c.crop_year).filter(Boolean))].sort().reverse();
  const hasUnyeared = crops.some(c => !c.crop_year);
  if (hasUnyeared) years.push('N/A');

  const yearCrops = crops.filter(c => (c.crop_year || 'N/A') === year);
  const seasonsInYear = [...new Set(yearCrops.map(c => c.season || 'Other'))];
  // Keep a friendly, predictable order: Rabi, Kharif, then anything else
  const orderedSeasons = ['Rabi', 'Kharif', ...seasonsInYear.filter(s => s !== 'Rabi' && s !== 'Kharif')]
    .filter(s => seasonsInYear.includes(s));
  const seasonCrops = yearCrops.filter(c => (c.season || 'Other') === season);

  const emoji = accent === 'finance' ? '💰' : '🌾';
  const noun = accent === 'finance' ? 'Financial' : 'Yield';

  const btnPrimary = "px-3 py-1.5 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const btnGhost = "px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors";

  const resetTo = (target) => {
    if (target === 'year') { setStep('year'); setSeason(''); setSelectedIds([]); }
    if (target === 'season') { setStep('season'); setSelectedIds([]); }
  };

  const toggleCrop = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  if (crops.length === 0) {
    return <p className="text-xs text-slate-500 italic">No crop cycles registered yet. Seed or create crops to enable export.</p>;
  }

  return (
    <div className="space-y-3">
      {/* Breadcrumb of current drill path */}
      <div className="flex flex-wrap items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        <button type="button" onClick={() => resetTo('year')} className={`px-2 py-0.5 rounded cursor-pointer ${step === 'year' ? 'bg-farm-600 text-white' : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
          1. Year{year ? `: ${year}` : ''}
        </button>
        <span>→</span>
        <button type="button" disabled={step === 'year'} onClick={() => resetTo('season')} className={`px-2 py-0.5 rounded ${step === 'season' ? 'bg-farm-600 text-white' : step === 'crops' ? 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer' : 'opacity-40'}`}>
          2. Season{season && step !== 'year' ? `: ${season}` : ''}
        </button>
        <span>→</span>
        <span className={`px-2 py-0.5 rounded ${step === 'crops' ? 'bg-farm-600 text-white' : 'opacity-40'}`}>3. Crops</span>
      </div>

      {/* ── STEP 1: YEAR ── */}
      {step === 'year' && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={year}
              onChange={e => { setYear(e.target.value); setSeason(''); setSelectedIds([]); }}
              className="bg-white dark:bg-[#1a2333] border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-farm-500 text-slate-900 dark:text-white font-medium cursor-pointer"
            >
              <option value="">— Select Crop Year —</option>
              {years.map(y => (
                <option key={y} value={y}>{y === 'N/A' ? 'No Year Set (N/A)' : y}</option>
              ))}
            </select>
            {year && (
              <span className="text-[10px] text-slate-500 font-semibold">
                {yearCrops.length} crop{yearCrops.length !== 1 ? 's' : ''} in {year}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!year || yearCrops.length === 0} onClick={() => onExport({ year })} className={btnPrimary}>
              <Printer size={13} /> {emoji} Export Full Year {noun} PDF
            </button>
            <button type="button" disabled={!year || yearCrops.length === 0} onClick={() => setStep('season')} className={btnGhost}>
              Dig into {year || 'Year'} →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: SEASON ── */}
      {step === 'season' && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-2 items-center">
            {orderedSeasons.map(s => {
              const count = yearCrops.filter(c => (c.season || 'Other') === s).length;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setSeason(s); setSelectedIds([]); }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border cursor-pointer transition-colors ${
                    season === s
                      ? 'bg-farm-600 border-farm-600 text-white'
                      : 'bg-white dark:bg-[#1a2333] border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-farm-500'
                  }`}
                >
                  {s === 'Rabi' ? '❄️ Rabi' : s === 'Kharif' ? '☀️ Kharif' : s} ({count})
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => resetTo('year')} className={btnGhost}>← Back to Year</button>
            <button type="button" disabled={!season || seasonCrops.length === 0} onClick={() => onExport({ year, season })} className={btnPrimary}>
              <Printer size={13} /> {emoji} Export Full {season || 'Season'} {noun} PDF
            </button>
            <button type="button" disabled={!season || seasonCrops.length === 0} onClick={() => setStep('crops')} className={btnGhost}>
              Dig into {season || 'Season'} →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: CROPS ── */}
      {step === 'crops' && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-2">
            {seasonCrops.map(c => (
              <label
                key={c._id}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border cursor-pointer transition-colors select-none ${
                  selectedIds.includes(c._id)
                    ? 'bg-farm-600 border-farm-600 text-white'
                    : 'bg-white dark:bg-[#1a2333] border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-farm-500'
                }`}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={selectedIds.includes(c._id)}
                  onChange={() => toggleCrop(c._id)}
                />
                {selectedIds.includes(c._id) ? <Check size={12} /> : null}
                {c.name} ({c.field || 'Sector'})
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => resetTo('season')} className={btnGhost}>← Back to Season</button>
            <button type="button" disabled={selectedIds.length === 0} onClick={() => onExport({ year, season, cropIds: selectedIds })} className={btnPrimary}>
              <Printer size={13} /> {emoji} Export {selectedIds.length || ''} Selected Crop{selectedIds.length !== 1 ? 's' : ''} {noun} PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
