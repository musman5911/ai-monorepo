// muf-worker-panel — shared "My Today" panel for worker-role users.
// Shows today's entries (milk, expenses, health, eggs, tasks) so workers
// can see what they've logged and quickly add more.
//
// TWIN FILES:
//   dairy_farm/client/src/muf-worker-panel.tsx  (this file)
//   flock_farm/client/src/muf-worker-panel.tsx  (byte-identical twin)
//   agri_farm/frontend/src/muf-worker-panel.tsx (byte-identical twin)
import React from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import { L } from './i18n';

export interface MufWorkerEntry {
  id: string;
  label: string;
  sub: string;
  time?: string;
}

interface MufWorkerPanelProps {
  /** App name for the header (e.g. "Dairy", "Flock", "Agri"). */
  appName: string;
  /** Today's milk/egg/task entries logged by anyone. */
  todayEntries: MufWorkerEntry[];
  /** Today's expense entries. */
  todayExpenses: MufWorkerEntry[];
  /** Today's health/vaccination entries. */
  todayHealth: MufWorkerEntry[];
  /** Quick-add buttons — each navigates to a tab. */
  quickActions: { label: string; icon: React.ReactNode; onClick: () => void }[];
}

export default function MufWorkerPanel({ appName, todayEntries, todayExpenses, todayHealth, quickActions }: MufWorkerPanelProps) {
  const totalToday = todayEntries.length + todayExpenses.length + todayHealth.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-farm-600" /> {L('My Today')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{L('{app} Farm — your entries today', { app: appName })}</p>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-farm-100 dark:bg-farm-900/30 text-farm-700 dark:text-farm-400 text-[10px] font-bold">
          {L('{n} entries', { n: totalToday })}
        </span>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {quickActions.map((a, i) => (
          <button key={i} onClick={a.onClick}
            className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0d1a11] hover:shadow-md transition text-left">
            <span className="w-8 h-8 rounded-lg bg-farm-100 dark:bg-farm-900/30 text-farm-600 dark:text-farm-400 flex items-center justify-center shrink-0">
              {a.icon}
            </span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{a.label}</span>
          </button>
        ))}
      </div>

      {/* Today's entries */}
      <div className="muf-panel p-4">
        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-farm-500" /> {L('Production / Tasks')} ({todayEntries.length})
        </h4>
        {todayEntries.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">{L('No entries logged today yet.')}</p>
        ) : (
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {todayEntries.map(e => (
              <div key={e.id} className="muf-row">
                <span className="text-slate-700 dark:text-slate-200 font-medium truncate flex-1">{e.label}</span>
                <span className="text-slate-400 text-[10px] shrink-0">{e.sub}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Today's expenses */}
      {todayExpenses.length > 0 && (
        <div className="muf-panel p-4">
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-2">💰 {L('Expenses')} ({todayExpenses.length})</h4>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {todayExpenses.map(e => (
              <div key={e.id} className="muf-row">
                <span className="text-slate-700 dark:text-slate-200 font-medium truncate flex-1">{e.label}</span>
                <span className="text-slate-400 text-[10px] shrink-0">{e.sub}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's health */}
      {todayHealth.length > 0 && (
        <div className="muf-panel p-4">
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-2">💊 {L('Health')} ({todayHealth.length})</h4>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {todayHealth.map(e => (
              <div key={e.id} className="muf-row">
                <span className="text-slate-700 dark:text-slate-200 font-medium truncate flex-1">{e.label}</span>
                <span className="text-slate-400 text-[10px] shrink-0">{e.sub}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
