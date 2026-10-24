import { useEffect, useState } from 'react';
import { Globe2, RefreshCw, ExternalLink, AlertCircle, TrendingUp } from 'lucide-react';
import { L } from '../i18n';

/* muf shared "My Farms" panel — keep identical in all three farm apps
   (only STORAGE_KEY and SELF differ). Shows live numbers from the other
   Malik Usman farms via their /farm-summary endpoints.
   Enhanced: combined summary header + per-farm KPI cards + alerts feed. */
const STORAGE_KEY = 'ff_myfarms';
const SELF: string = 'flock';

interface FarmSummary {
  farm: string;
  label: string;
  stats: { label: string; value: string | number }[];
  farms?: { farmId: string; farmName: string; stats: { label: string; value: string | number }[] }[];
  alerts?: { count: number; items: string[] };
}
interface PeerState { url: string; loading: boolean; error?: string; data?: FarmSummary }

function loadCfg(): { urls: string[]; key: string } {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '') || { urls: ['', ''], key: '' }; }
  catch { return { urls: ['', ''], key: '' }; }
}

async function fetchSummary(base: string, key: string): Promise<FarmSummary> {
  const clean = base.replace(/\/+$/, '');
  for (const path of ['/api/farm-summary', '/farm-summary']) {
    try {
      const res = await fetch(`${clean}${path}?key=${encodeURIComponent(key)}`);
      if (res.ok) return await res.json();
      if (res.status === 401) throw new Error('Wrong key');
    } catch (e) {
      if (e instanceof Error && e.message === 'Wrong key') throw e;
    }
  }
  throw new Error('Could not reach this farm');
}

export default function MyFarmsPanel() {
  const [cfg, setCfg] = useState(loadCfg);
  const [peers, setPeers] = useState<PeerState[]>([]);
  const [editing, setEditing] = useState(() => !loadCfg().urls.some(Boolean));

  const refresh = (c = cfg) => {
    const urls = c.urls.filter(Boolean);
    setPeers(urls.map((url) => ({ url, loading: true })));
    urls.forEach((url, i) => {
      fetchSummary(url, c.key)
        .then((data) => setPeers((p) => p.map((x, j) => (j === i ? { ...x, loading: false, data } : x))))
        .catch((e) => setPeers((p) => p.map((x, j) => (j === i ? { ...x, loading: false, error: e.message } : x))));
    });
  };

  useEffect(() => { if (cfg.urls.some(Boolean)) refresh(); /* eslint-disable-next-line */ }, []);

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    setEditing(false);
    refresh(cfg);
  };

  const others = SELF === 'dairy' ? ['Agri Farm', 'Flock Farm'] : SELF === 'flock' ? ['Agri Farm', 'Dairy Farm'] : ['Dairy Farm', 'Flock Farm'];

  // Combined stats across all connected farms
  const connected = peers.filter(p => p.data);
  const totalAlerts = connected.reduce((sum, p) => sum + (p.data?.alerts?.count || 0), 0);
  const allAlerts = connected.flatMap(p => (p.data?.alerts?.items || []).map(a => ({ farm: p.data!.label, text: a })));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-farm-600" /> My Farms
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{L('Live numbers from your other farms.')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refresh()} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition" title={L('Refresh')}>
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setEditing((v) => !v)} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 transition">
            {editing ? 'Close' : 'Setup'}
          </button>
        </div>
      </div>

      {/* Combined summary banner */}
      {connected.length > 0 && (
        <div className="muf-panel p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-farm-100 dark:bg-farm-900/30 text-farm-600 dark:text-farm-400 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{connected.length} farm{connected.length > 1 ? 's' : ''} connected</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {totalAlerts > 0 ? `${totalAlerts} alert${totalAlerts > 1 ? 's' : ''} across all farms` : 'All farms healthy — no alerts'}
            </p>
          </div>
          {totalAlerts > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold">
              {totalAlerts} ⚠
            </span>
          )}
        </div>
      )}

      {/* Combined alerts feed */}
      {allAlerts.length > 0 && (
        <div className="muf-panel p-4">
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" /> Cross-Farm Alerts
          </h4>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {allAlerts.slice(0, 10).map((a, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 text-xs">
                <span className="font-bold text-amber-700 dark:text-amber-400 shrink-0">{a.farm}:</span>
                <span className="text-slate-700 dark:text-slate-300">{a.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Setup form */}
      {editing && (
        <div className="muf-panel p-4 space-y-3">
          {others.map((name, i) => (
            <div key={name}>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{name} address</label>
              <input
                value={cfg.urls[i] || ''}
                onChange={(e) => setCfg({ ...cfg, urls: cfg.urls.map((u, j) => (j === i ? e.target.value.trim() : u)) })}
                placeholder="https://your-farm.replit.app"
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-950 outline-none focus:border-farm-500 focus:ring-2 focus:ring-farm-500/20 transition font-mono"
              />
            </div>
          ))}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{L('Shared farm key')}</label>
            <input
              value={cfg.key}
              onChange={(e) => setCfg({ ...cfg, key: e.target.value.trim() })}
              placeholder={L('Same CROSS_FARM_KEY set on every farm')}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-950 outline-none focus:border-farm-500 focus:ring-2 focus:ring-farm-500/20 transition font-mono"
            />
          </div>
          <button onClick={save} className="bg-farm-600 hover:bg-farm-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition">Save &amp; Connect</button>
        </div>
      )}

      {!editing && peers.length === 0 && (
        <div className="muf-panel p-6 text-center text-xs text-slate-500">{L('Use Setup to add your other farms.')}</div>
      )}

      {/* Per-farm cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {peers.map((p) => (
          <div key={p.url} className="muf-panel p-4 space-y-2.5">
            {p.loading ? (
              <div className="text-xs text-slate-500 py-6 text-center">Connecting…</div>
            ) : p.error ? (
              <div className="text-xs text-red-500 py-4 text-center font-semibold">{p.error}</div>
            ) : p.data ? (
              <>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">{p.data.label}</h4>
                  <div className="flex items-center gap-1">
                    {p.data.alerts && p.data.alerts.count > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[9px] font-bold">{p.data.alerts.count} ⚠</span>
                    )}
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-farm-600 transition" title={L('Open')}>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {p.data.stats.map((st) => (
                    <div key={st.label} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2.5">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{st.label}</p>
                      <p className="text-sm font-black text-farm-700 dark:text-farm-300">{st.value}</p>
                    </div>
                  ))}
                </div>
                {p.data.farms && p.data.farms.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h5 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Farm-by-farm breakdown</h5>
                    {p.data.farms.map((farm) => (
                      <section key={farm.farmId} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                        <h6 className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-2">{farm.farmName}</h6>
                        <div className="grid grid-cols-2 gap-2">
                          {farm.stats.map((st) => (
                            <div key={st.label} className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2">
                              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{st.label}</p>
                              <p className="text-xs font-black text-farm-700 dark:text-farm-300">{st.value}</p>
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
