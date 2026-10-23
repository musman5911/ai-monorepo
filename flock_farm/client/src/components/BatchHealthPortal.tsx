import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, HeartPulse, Syringe } from 'lucide-react';
import { getBatchDetail, listBatches } from '../api';
import type { BatchMortalityLog, BatchVaccinationLog, BatchWithSummary } from '../types';

type BatchHealthEvent =
  | { kind: 'vaccination'; date: string; batchName: string; title: string; detail: string; count: number; cost: number; id: string }
  | { kind: 'mortality'; date: string; batchName: string; title: string; detail: string; count: number; cost: number; id: string };

export default function BatchHealthPortal() {
  const [batches, setBatches] = useState<BatchWithSummary[]>([]);
  const [events, setEvents] = useState<BatchHealthEvent[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listBatches();
        const details = await Promise.all(rows.map((batch) => getBatchDetail(batch.batch_id).catch(() => null)));
        const combined: BatchHealthEvent[] = [];
        details.forEach((detail, index) => {
          if (!detail) return;
          const batchName = detail.batch.name || rows[index].name;
          detail.vaccination_logs.forEach((log: BatchVaccinationLog) => combined.push({
            kind: 'vaccination', id: log._id, date: log.date, batchName,
            title: log.vaccine_name, detail: log.dose || 'Vaccination',
            count: Number(log.bird_count) || 0, cost: Number(log.cost) || 0,
          }));
          detail.mortality_logs.forEach((log: BatchMortalityLog) => combined.push({
            kind: 'mortality', id: log._id, date: log.date, batchName,
            title: log.reason || 'Mortality', detail: log.notes || 'Mortality recorded',
            count: Number(log.count) || 0, cost: 0,
          }));
        });
        if (!cancelled) {
          setBatches(rows);
          setEvents(combined.sort((a, b) => b.date.localeCompare(a.date)));
          setLoadFailed(false);
        }
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const totals = useMemo(() => ({
    live: batches.reduce((sum, batch) => sum + (batch.summary?.live_count || 0), 0),
    deaths: batches.reduce((sum, batch) => sum + (batch.summary?.total_mortality_count || 0), 0),
    vaccinationEvents: events.filter((event) => event.kind === 'vaccination').length,
    vaccineCost: events.filter((event) => event.kind === 'vaccination').reduce((sum, event) => sum + event.cost, 0),
  }), [batches, events]);

  return (
    <div className="space-y-6" id="batch-health-portal">
      <div className="muf-page-hero">
        <div className="muf-page-title">
          <div className="muf-title-icon"><HeartPulse size={28} /></div>
          <div>
            <h2>Batch Health</h2>
            <p>Health and mortality records from managed batches. Home Birds vaccination tracking stays in Home Birds.</p>
          </div>
        </div>
      </div>

      {loadFailed && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Batch health data could not be loaded. Reopen this section to retry.</p>}

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <HealthMetric label="Batches" value={batches.length.toLocaleString()} />
        <HealthMetric label="Live birds" value={totals.live.toLocaleString()} />
        <HealthMetric label="Recorded mortality" value={totals.deaths.toLocaleString()} />
        <HealthMetric label="Vaccination events" value={totals.vaccinationEvents.toLocaleString()} />
        <HealthMetric label="Batch vaccine cost" value={`Rs ${Math.round(totals.vaccineCost).toLocaleString()}`} />
      </div>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Syringe size={18} />
          <h3 className="font-semibold">Recent batch health activity</h3>
        </div>
        {events.length === 0 ? (
          <p className="text-sm text-slate-500">No batch vaccination or mortality logs recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {events.slice(0, 20).map((event) => (
              <div key={`${event.kind}-${event.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 dark:border-slate-800 px-3 py-3">
                <div className="flex min-w-0 items-start gap-2">
                  {event.kind === 'mortality' ? <AlertTriangle size={16} className="mt-0.5 text-rose-600 shrink-0" /> : <Syringe size={16} className="mt-0.5 text-indigo-600 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{event.title} · {event.batchName}</p>
                    <p className="text-xs text-slate-500">{event.date} · {event.detail}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold">{event.count.toLocaleString()} birds</p>
                  {event.kind === 'vaccination' && <p className="text-xs text-slate-500">Rs {Math.round(event.cost).toLocaleString()}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function HealthMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
