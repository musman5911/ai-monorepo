import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Truck, RefreshCw, AlertCircle } from './Icons';
import { WaybillData } from './QrWaybillModal';

interface SuperAdminViewProps {
  highContrast: boolean;
  onNavigateFarm: (farm: 'agri' | 'dairy' | 'flock') => void;
  waybills: WaybillData[];
  onOpenWaybill: () => void;
}
interface FarmSummary { farm: string; label: string; stats: { label: string; value: string | number }[] }
interface FarmResult { url: string; farm: 'agri' | 'dairy' | 'flock'; data?: FarmSummary; error?: string; loading: boolean }

const farmLabels: Record<string, string> = { agri: 'Agri Farm', dairy: 'Dairy Farm', flock: 'Flock Farm' };

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({ highContrast, onNavigateFarm, waybills, onOpenWaybill }) => {
  const [results, setResults] = useState<FarmResult[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const loadLiveData = useCallback(async () => {
    setRefreshing(true);
    let cfg: { urls?: string[]; key?: string } = {};
    try { cfg = JSON.parse(localStorage.getItem('ff_myfarms') || '{}'); } catch { cfg = {}; }
    const key = String(cfg.key || '').trim();
    const peerOrder: ('agri' | 'dairy' | 'flock')[] = ['agri', 'dairy'];
    const entries = [
      { url: window.location.origin, farm: 'flock' as const },
      ...(cfg.urls || []).map((url, index) => ({ url, farm: peerOrder[index] })).filter((entry): entry is { url: string; farm: 'agri' | 'dairy' | 'flock' } => !!entry.url && !!entry.farm),
    ].filter((entry, index, all) => !!entry.url && all.findIndex(other => other.url.replace(/\/+$/, '') === entry.url.replace(/\/+$/, '')) === index);
    if (!key) {
      setResults([]);
      setLastUpdated('');
      setRefreshing(false);
      return;
    }
    setResults(entries.map(entry => ({ url: entry.url, farm: entry.farm, loading: true })));
    await Promise.all(entries.map(async ({ url, farm }, index) => {
      let result: FarmResult;
      try {
        let response: Response | null = null;
        for (const path of ['/api/farm-summary', '/farm-summary']) {
          const candidate = await fetch(`${url.replace(/\/+$/, '')}${path}?key=${encodeURIComponent(key)}`);
          if (candidate.ok) { response = candidate; break; }
          if (candidate.status === 401) throw new Error('Shared farm key rejected');
        }
        if (!response) throw new Error('Farm endpoint unavailable');
        const data = await response.json() as FarmSummary;
        if (data.farm !== farm) throw new Error(`Farm identity mismatch: expected ${farm}, received ${String(data.farm || 'unknown')}`);
        if (!Array.isArray(data.stats)) throw new Error('Farm summary did not return a valid stats list');
        result = { url, farm, data, loading: false };
      } catch (error) {
        result = { url, farm, error: error instanceof Error ? error.message : 'Could not load farm data', loading: false };
      }
      setResults(previous => {
        const next = [...previous];
        next[index] = result;
        return next;
      });
    }));
    setLastUpdated(new Date().toLocaleString());
    setRefreshing(false);
  }, []);
  useEffect(() => { void loadLiveData(); }, [loadLiveData]);

  const connected = results.filter(item => item.data);
  const totalStats = connected.reduce((sum, item) => sum + item.data!.stats.length, 0);

  return (
    <div className="muf-superadmin space-y-5 animate-fade-in">
      <div className={`p-5 rounded-xl border flex flex-wrap items-center justify-between gap-4 ${highContrast ? 'bg-black text-white border-white' : 'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border-slate-700 shadow-sm'}`}>
        <div>
          <div className="flex items-center gap-2 mb-1"><span className="p-1 bg-amber-500/20 text-amber-400 rounded"><ShieldCheck className="w-4 h-4" /></span><span className="text-xs font-bold uppercase tracking-wider text-amber-400">Malik Usman Farms · Central Command</span></div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Executive Master Dashboard</h1>
          <p className="text-xs text-slate-300 mt-1">Live figures returned by your connected farm websites. No sample financial totals are displayed.</p>
          {lastUpdated && <p className="text-[10px] text-slate-400 mt-1">Last refreshed: {lastUpdated}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => window.print()} className={`px-3 py-2 text-xs font-semibold rounded-lg ${highContrast ? 'bg-white text-black' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600'}`}>Print Report</button>
          <button onClick={() => void loadLiveData()} disabled={refreshing} className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 flex items-center gap-1.5"><RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh data</button>
          <button onClick={onOpenWaybill} className="px-3.5 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" /> Issue Waybill</button>
        </div>
      </div>

      {!results.length && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200"><p className="font-bold flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Live farm data is not configured</p><p className="text-xs mt-1">Open Admin → My Farms in this app, add the other farm website URLs, and enter the shared CROSS_FARM_KEY. The dashboard will only show values returned by the farm APIs.</p></div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Connected farms</p><p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{connected.length} / 3</p></div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Live data points</p><p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{totalStats}</p></div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Data source</p><p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-2">Farm records API</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {(['agri', 'dairy', 'flock'] as const).map(farm => {
          const result = results.find(item => item.farm === farm);
          const label = result?.data?.label || farmLabels[farm];
          return <section key={farm} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-3"><div><h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">{label}</h2><p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{result?.data ? 'Live data connected' : result?.loading ? 'Connecting…' : result?.error || 'Not configured'}</p></div><button onClick={() => onNavigateFarm(farm)} className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline shrink-0">Open farm →</button></div>
            {result?.data ? <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{result.data.stats.map(stat => <div key={stat.label} className="rounded-lg bg-slate-50 dark:bg-slate-800/70 p-3 min-w-0"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{stat.label}</p><p className="text-sm font-black text-emerald-700 dark:text-emerald-300 mt-1 break-words">{stat.value}</p></div>)}</div> : <p className="text-xs text-slate-500 dark:text-slate-400 py-5">No verified figures available from this farm yet.</p>}
          </section>;
        })}
      </div>

      <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <div className="flex items-center justify-between gap-3 mb-3"><h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2"><Truck className="w-4 h-4 text-indigo-600" /> Waybills saved in this browser</h2><button onClick={onOpenWaybill} className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:underline">+ Issue Waybill</button></div>
        <p className="mb-3 text-[10px] text-slate-500 dark:text-slate-400">These are user-created records saved in this browser only. They are not synchronized with the farm databases.</p>
        <div className="space-y-2">{waybills.length ? waybills.map((wb: WaybillData) => <div key={wb.id} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3 text-xs flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="font-bold text-slate-900 dark:text-slate-100">#{wb.id} · {wb.item}</p><p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{wb.source.toUpperCase()} → {wb.destination.toUpperCase()} · {wb.quantity} {wb.unit} · {wb.driver}</p></div><div className="text-right"><p className="font-bold text-slate-900 dark:text-slate-100">PKR {wb.internalValueRs.toLocaleString()}</p><span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${wb.status === 'received' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{wb.status === 'received' ? 'Delivered' : 'In Transit'}</span></div></div>) : <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-5">No transfer waybills recorded yet.</p>}</div>
      </section>
    </div>
  );
};
