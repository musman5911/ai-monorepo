// muf shared offline banner — makes the app's offline queue / sync state VISIBLE.
// The app provides its own pendingCount source and current language; the
// watch logic and both banner states are shared (muf-offline twin).
// Tap the banner to see queued entries + manually sync.
import { useEffect, useRef, useState } from 'react';
import { watchOffline, offlineBannerText, OFFLINE_SYNCED_TEXT, type OfflineState } from '../data/muf-offline';

interface MufOfflineBannerProps {
  /** Current number of queued offline actions (app-specific source; stable reference). */
  pendingCount: () => number;
  /** Current app language. */
  lang: 'en' | 'ur' | 'roman';
  /** Optional: read the raw queue for display (returns array of {path, method} entries). */
  readQueue?: () => { path: string; method: string }[];
  /** Optional: manually trigger a sync. */
  onSync?: () => Promise<void>;
}

export default function OfflineBanner({ pendingCount, lang, readQueue, onSync }: MufOfflineBannerProps) {
  const [state, setState] = useState<OfflineState>({ offline: false, pending: 0 });
  const [justSynced, setJustSynced] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const prev = useRef<OfflineState>({ offline: false, pending: 0 });

  useEffect(() => watchOffline(pendingCount, (next) => {
    if (!next.offline && next.pending === 0 && (prev.current.offline || prev.current.pending > 0)) {
      setJustSynced(true);
      setTimeout(() => setJustSynced(false), 4000);
    }
    prev.current = next;
    setState(next);
  }), []); // pendingCount must be a stable reference (module scope or useCallback)

  if (justSynced) {
    return <div className="sticky top-0 z-[var(--muf-z-offline)] text-center text-xs font-bold py-1.5 bg-emerald-600 text-white">{lang === 'ur' ? OFFLINE_SYNCED_TEXT.ur : OFFLINE_SYNCED_TEXT.en}</div>;
  }
  if (!state.offline && state.pending === 0) return null;

  const handleSync = async () => {
    if (!onSync || syncing) return;
    setSyncing(true);
    try { await onSync(); } finally { setSyncing(false); setExpanded(false); }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className={`sticky top-0 z-[var(--muf-z-offline)] w-full text-center text-xs font-bold py-1.5 text-white ${state.offline ? 'bg-amber-600' : 'bg-sky-600'}`}
      >
        {offlineBannerText(lang, state)} {state.pending > 0 ? '· tap to view' : ''}
      </button>
      {expanded && (
        <div className="fixed inset-0 z-[var(--muf-z-offline-step)] flex items-start justify-center pt-16 px-4" onClick={() => setExpanded(false)}>
          <div className="bg-black/30 fixed inset-0" />
          <div className="relative bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-md w-full p-4 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {state.offline ? '⚠️ Offline' : '📡 Pending Sync'}
              </h3>
              <button onClick={() => setExpanded(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {state.pending > 0
                ? `${state.pending} entr${state.pending === 1 ? 'y' : 'ies'} queued — will sync automatically when back online.`
                : 'You are offline. New entries will be queued.'}
            </p>
            {readQueue && state.pending > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {readQueue().slice(0, 20).map((item, i) => (
                  <div key={i} className="muf-row">
                    <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${
                      item.method === 'POST' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                      item.method === 'PUT' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      item.method === 'DELETE' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}>{item.method}</span>
                    <span className="text-slate-600 dark:text-slate-300 truncate flex-1">{item.path.replace('/api/', '')}</span>
                  </div>
                ))}
              </div>
            )}
            {onSync && !state.offline && state.pending > 0 && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="w-full px-4 py-2 bg-farm-600 hover:bg-farm-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition"
              >
                {syncing ? 'Syncing…' : 'Sync Now'}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
