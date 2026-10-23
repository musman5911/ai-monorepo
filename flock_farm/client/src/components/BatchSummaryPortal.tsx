import React, { useEffect, useMemo, useState } from 'react';
import { BarChart2, Egg, Package, TrendingUp, Wallet } from 'lucide-react';
import { listBatches } from '../api';
import type { BatchWithSummary } from '../types';

const money = (value: number) => `Rs ${Math.round(value || 0).toLocaleString()}`;

export default function BatchSummaryPortal() {
  const [batches, setBatches] = useState<BatchWithSummary[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listBatches().then((rows) => {
      if (!cancelled) { setBatches(rows); setLoadFailed(false); }
    }).catch(() => {
      if (!cancelled) setLoadFailed(true);
    });
    return () => { cancelled = true; };
  }, []);

  const totals = useMemo(() => batches.reduce((sum, batch) => {
    const row = batch.summary;
    sum.live += row?.live_count || 0;
    sum.revenue += row?.total_revenue || 0;
    sum.cost += row?.total_cost || 0;
    sum.profit += row?.profit_loss || 0;
    sum.eggsAvailable += row?.total_eggs_available || 0;
    return sum;
  }, { live: 0, revenue: 0, cost: 0, profit: 0, eggsAvailable: 0 }), [batches]);

  return (
    <div className="space-y-6" id="batch-summary-portal">
      <div className="muf-page-hero">
        <div className="muf-page-title">
          <div className="muf-title-icon"><BarChart2 size={28} /></div>
          <div>
            <h2>Batch Summary</h2>
            <p>All-time production and financial totals from batch records. Home Birds reports remain separate.</p>
          </div>
        </div>
      </div>

      {loadFailed && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Batch summary data could not be loaded. Reopen this section to retry.</p>}

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <SummaryMetric icon={<Package size={17} />} label="Batches" value={batches.length.toLocaleString()} />
        <SummaryMetric icon={<Egg size={17} />} label="Net eggs available" value={totals.eggsAvailable.toLocaleString()} />
        <SummaryMetric icon={<TrendingUp size={17} />} label="Batch revenue" value={money(totals.revenue)} />
        <SummaryMetric icon={<Wallet size={17} />} label="Batch cost" value={money(totals.cost)} />
        <SummaryMetric icon={<BarChart2 size={17} />} label="Batch profit / loss" value={money(totals.profit)} />
      </div>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
        <h3 className="font-semibold">Performance by batch</h3>
        {batches.length === 0 ? (
          <p className="text-sm text-slate-500">No batches have been created yet. Create a batch to start tracking production and financial results.</p>
        ) : (
          <div className="space-y-2">
            {batches.map((batch) => (
              <div key={batch.batch_id} className="grid grid-cols-2 md:grid-cols-5 gap-2 rounded-xl border border-slate-100 dark:border-slate-800 p-3">
                <div className="col-span-2 md:col-span-1 min-w-0">
                  <p className="font-semibold truncate">{batch.name}</p>
                  <p className="text-xs text-slate-500">{batch.status} · {batch.summary?.live_count || 0} live</p>
                </div>
                <MetricCell label="Net eggs" value={(batch.summary?.total_eggs_available || 0).toLocaleString()} />
                <MetricCell label="Revenue" value={money(batch.summary?.total_revenue || 0)} />
                <MetricCell label="Cost" value={money(batch.summary?.total_cost || 0)} />
                <MetricCell label="Profit / loss" value={money(batch.summary?.profit_loss || 0)} negative={(batch.summary?.profit_loss || 0) < 0} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <div className="flex items-center gap-2 text-slate-500"><span>{icon}</span><span className="text-xs">{label}</span></div>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function MetricCell({ label, value, negative = false }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-sm font-semibold truncate ${negative ? 'text-rose-600' : ''}`}>{value}</p>
    </div>
  );
}
