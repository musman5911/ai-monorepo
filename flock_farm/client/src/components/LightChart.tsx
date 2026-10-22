import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Lang } from '../types';
import { t } from '../i18n';
import { formatLocalDate } from '../utils/calculations';
import { L } from '../i18n';

interface LightSparklineProps {
  title: string;
  values: number[];
  labels?: string[];
}

export function LightSparkline({ title, values, labels }: LightSparklineProps) {
  if (values.length === 0) return null;

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 100;
  const h = 32;
  const points = values
    .map((v, i) => {
      const x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
      <p className="text-3xs font-bold uppercase tracking-wider text-slate-400">{title}</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8" preserveAspectRatio="none">
        <polyline
          fill="none"
          stroke="#16a34a"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points}
        />
      </svg>
      {labels && labels.length > 0 && (
        <div className="flex justify-between text-4xs text-slate-400 font-mono">
          <span>{labels[0]}</span>
          <span>{labels[labels.length - 1]}</span>
        </div>
      )}
    </div>
  );
}

interface DateRangeFilterProps {
  lang: Lang;
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  onPreset: (preset: 'all' | 'month' | '30d') => void;
}

export function DateRangeFilter({ lang, from, to, onChange, onPreset }: DateRangeFilterProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const [cFrom, setCFrom] = useState(from);
  const [cTo, setCTo] = useState(to);

  const isCustomActive = (() => {
    // "Custom" is active if the current range doesn't exactly match this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const ms = formatLocalDate(monthStart);
    const today = formatLocalDate(now);
    return !(from === ms && to === today);
  })();

  const apply = () => {
    if (!cFrom || !cTo) return;
    if (cFrom > cTo) return;
    onChange(cFrom, cTo);
    setCustomOpen(false);
  };

  const selectMonth = () => {
    onPreset('month');
    setCustomOpen(false);
  };

  const openCustom = () => {
    setCFrom(from);
    setCTo(to);
    setCustomOpen(true);
  };


  return (
    <div className="flex flex-wrap items-center gap-2 text-xs relative">
      <span className="font-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-wider mr-1">{t(lang, 'dateRange')}:</span>
      <button
        type="button"
        onClick={selectMonth}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
          !isCustomActive
            ? 'bg-farm-600 text-white border-emerald-700 shadow-sm'
            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
        }`}
      >
        {t(lang, 'thisMonth')}
      </button>
      <button
        type="button"
        onClick={openCustom}
        title={L('Custom range')}
        className={`p-1.5 rounded-lg border transition ${
          isCustomActive
            ? 'bg-farm-600 text-white border-emerald-700 shadow-sm'
            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
        }`}
      >
        <CalendarDays className="w-4 h-4" />
      </button>

      {customOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-4 space-y-3 w-72">
          <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 uppercase tracking-wider">{L('Custom Range')}</h4>
          <div className="space-y-2">
            <label className="block space-y-1">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">{L('From')}</span>
              <input
                type="date" value={cFrom} onChange={(e) => setCFrom(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 rounded-lg font-mono"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">To</span>
              <input
                type="date" value={cTo} onChange={(e) => setCTo(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 rounded-lg font-mono"
              />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setCustomOpen(false)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200">
              {L('Cancel')}
            </button>
            <button type="button" onClick={apply}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-farm-600 hover:bg-farm-700 text-white">
              {L('Apply')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
