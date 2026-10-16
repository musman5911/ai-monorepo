import { useState } from 'react';
import { Download } from 'lucide-react';
import type { Cow, MilkEntry, RateHistory } from '../../types';
import { generateCowReport } from '../../reportExport';
import DetailModal from '../../muf/core/muf-modal';
import { L } from '../../i18n';

export function buildDairyProfileData(cows: Cow[], milkEntries: MilkEntry[]): Omit<import('../../muf/data/muf-profile').MufProfileOpts, 'contact'> {
  const herd = cows.filter(c => c.status !== 'sold');
  const milking = herd.filter(c => c.gender !== 'male' && !c.isCalf && c.status !== 'dry');
  const breeds = Array.from(new Set(herd.map(c => c.breed).filter(Boolean))).slice(0, 4).join(', ');
  const byMonth: Record<string, { liters: number; days: Set<string> }> = {};
  milkEntries.forEach(m => {
    const mk = (m.date || '').slice(0, 7);
    if (!mk) return;
    if (!byMonth[mk]) byMonth[mk] = { liters: 0, days: new Set() };
    byMonth[mk].liters += (m.morning || 0) + (m.evening || 0);
    byMonth[mk].days.add(m.date);
  });
  const rows = Object.keys(byMonth).sort().slice(-6).map(mk => {
    const v = byMonth[mk];
    const avg = v.days.size ? v.liters / v.days.size : 0;
    return [mk, `${Math.round(v.liters).toLocaleString()} L`, `${avg.toFixed(1)} L/day`];
  });
  return {
    tagline: 'Fresh milk from a healthy, well-fed herd — daily records for every animal.',
    stats: [
      ['Herd size', `${herd.length} animals`],
      ['Milking cows', `${milking.length}`],
      ...(breeds ? [['Breeds', breeds] as [string, string]] : []),
      ['Records kept', 'Daily milk, feed & health logs'],
    ],
    monthlyTitle: 'Monthly milk production (last 6 months)',
    monthlyHead: ['Month', 'Total Milk', 'Average'],
    monthlyRows: rows,
  };
}

export function ExportButton({ label, color: _color, onGenerate }: { label: string; color: string; onGenerate: (days: number) => void }) {
  const [range, setRange] = useState('30');
  const [showConfirm, setShowConfirm] = useState(false);
  const rangeLabels: Record<string, string> = { '1': 'Last 1 Day', '7': 'Last 7 Days', '30': 'Last 1 Month', '180': 'Last 6 Months', '365': 'Last 1 Year' };

  return (
    <>
      <div className="flex flex-col gap-2 bg-farm-50 dark:bg-farm-900/20 border border-farm-200 dark:border-farm-800 rounded-lg px-3 py-2">
        <p className="text-xs font-medium text-stone-700 dark:text-stone-300">{label}</p>
        <div className="flex items-center gap-2">
          <select className="flex-1 bg-transparent text-[10px] text-stone-500 outline-none" value={range} onChange={e => setRange(e.target.value)}>
            <option value="1">1 Day</option><option value="7">7 Days</option><option value="30">1 Month</option><option value="180">6 Months</option><option value="365">1 Year</option>
          </select>
          <button onClick={() => setShowConfirm(true)} className="p-1.5 text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg transition-colors">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
      <DetailModal open={showConfirm} onClose={() => setShowConfirm(false)} title={`Download ${label}`} size="small">
        <p className="text-sm text-stone-500 mb-4">{L('Export data for')} <span className="font-medium">{rangeLabels[range]}</span>?</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setShowConfirm(false)} className="px-4 py-2 text-sm text-stone-600">{L('Cancel')}</button>
          <button onClick={() => { onGenerate(parseInt(range)); setShowConfirm(false); }} className="px-4 py-2 bg-farm-600 hover:bg-farm-700 text-white text-sm font-medium rounded-lg flex items-center gap-2">
            <Download className="w-4 h-4" /> Download PDF
          </button>
        </div>
      </DetailModal>
    </>
  );
}

export function CowReportButton({ cows, rate, rateHistory, rateDate }: { cows: Cow[]; rate: number; rateHistory: RateHistory[]; rateDate: string }) {
  const [selectedCow, setSelectedCow] = useState('');
  const [range, setRange] = useState('30');
  const [showConfirm, setShowConfirm] = useState(false);

  function handleDownload() {
    if (!selectedCow) return;
    setShowConfirm(true);
  }

  function confirmDownload() {
    generateCowReport(selectedCow, rate, rateHistory, rateDate, parseInt(range));
    setShowConfirm(false);
  }

  const rangeLabel: Record<string, string> = {
    '1': 'Last 1 Day',
    '7': 'Last 7 Days',
    '30': 'Last 1 Month',
    '180': 'Last 6 Months',
    '365': 'Last 1 Year',
  };

  return (
    <>
      <div className="flex flex-col gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
        <select
          className="bg-transparent text-sm text-amber-700 dark:text-amber-400 outline-none"
          value={selectedCow}
          onChange={e => setSelectedCow(e.target.value)}
        >
          <option value="">{L('Select Cow...')}</option>
          {cows.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <select
            className="flex-1 bg-transparent text-[10px] text-amber-600 dark:text-amber-500 outline-none"
            value={range}
            onChange={e => setRange(e.target.value)}
          >
            <option value="1">1 Day</option>
            <option value="7">7 Days</option>
            <option value="30">1 Month</option>
            <option value="180">6 Months</option>
            <option value="365">1 Year</option>
          </select>
          <button
            onClick={handleDownload}
            disabled={!selectedCow}
            className="p-1.5 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-lg disabled:opacity-30 transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      <DetailModal open={showConfirm} onClose={() => setShowConfirm(false)} title={L('Download Cow Report')} size="small">
        <p className="text-sm text-slate-500 mb-4">
          Export <span className="font-medium text-slate-700 dark:text-slate-300">{cows.find(c => c._id === selectedCow)?.name}</span> data for <span className="font-medium">{rangeLabel[range]}</span>?
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setShowConfirm(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">{L('Cancel')}</button>
          <button onClick={confirmDownload} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg flex items-center gap-2">
            <Download className="w-4 h-4" /> Download PDF
          </button>
        </div>
      </DetailModal>
    </>
  );
}
