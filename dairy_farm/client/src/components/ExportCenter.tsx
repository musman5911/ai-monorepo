import { useEffect, useState } from 'react';
import { FileText, Printer } from 'lucide-react';
import { api } from '../api';
import type { Cow, MilkEntry, Expense, Sale } from '../types';
import { openPrintDocument } from '../muf/data/muf-print';
import { L } from '../i18n';

/**
 * Official Farm Export Center's
 * ("💰 Crop-Specific Cycle Summary" / "🌾 Seasonal Harvest Yield Report"),
 * adapted to dairy data. Two strictly separated official PDF reports:
 *
 *   💰 Animal Cycle Summary (Financial) — purchase costs, every expense
 *      category, milk revenue and sale income. Money only.
 *   🥛 Milk Production Report (Production) — monthly milk volumes and per-cow
 *      production register. No financial data.
 *
 * Scope drill-down: the whole herd, or one hand-picked animal.
 */

type Scope = 'all' | string; // 'all' or a cowId

function money(n: number) { return `Rs. ${Math.round(n).toLocaleString()}`; }

export default function ExportCenter() {
  const [cows, setCows] = useState<Cow[]>([]);
  const [scope, setScope] = useState<Scope>('all');
  const [busy, setBusy] = useState<'' | 'finance' | 'production'>('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.getCows().then(setCows).catch(() => setCows([]));
  }, []);

  const scopedCows = () => (scope === 'all' ? cows : cows.filter((c) => c._id === scope));

  const scopeLabel = () =>
    scope === 'all' ? 'Whole Herd' : `${cows.find((c) => c._id === scope)?.name || 'Animal'} (single animal)`;

  // ── 💰 FINANCE-ONLY REPORT: costs, milk revenue & sale income. ──
  const exportFinance = async () => {
    setBusy('finance');
    setError('');
    try {
      const target = scopedCows();
      if (target.length === 0) throw new Error('No animals found for the selected scope.');
      const [expenses, milk, sales, rateRes] = await Promise.all([
        api.getExpenses() as Promise<Expense[]>,
        api.getMilk() as Promise<MilkEntry[]>,
        api.getSales() as Promise<Sale[]>,
        api.getRate().catch(() => null) as Promise<{ value?: number } | null>,
      ]);
      const rate = Number(rateRes?.value) || 0;
      const ids = new Set(target.map((c) => c._id));

      const sections = target.map((cow) => {
        const rows = expenses.filter((e) => e.cowId === cow._id);
        const byType: Record<string, number> = {};
        for (const r of rows) byType[r.type] = (byType[r.type] || 0) + (r.amount || 0);
        const totalExp = rows.reduce((s, r) => s + (r.amount || 0), 0);
        const liters = milk.filter((m) => m.cowId === cow._id).reduce((s, m) => s + (m.morning || 0) + (m.evening || 0), 0);
        const milkRevenue = liters * rate;
        const sale = sales.find((s) => s.cowId === cow._id);
        const income = milkRevenue + (sale?.salePrice || 0);
        const net = income - totalExp;
        return `
        <h3>💰 ${cow.name} — ${cow.breed || 'Unknown breed'} · ${cow.status}</h3>
        <p style="font-size:12px;color:#475569;margin:4px 0 8px;">
          Income (milk ${liters.toLocaleString()} L @ current rate${sale ? ' + animal sale' : ''}):
          <strong style="color:#16a34a;">${money(income)}</strong> &nbsp;|&nbsp;
          Expenses: <strong style="color:#dc2626;">${money(totalExp)}</strong> &nbsp;|&nbsp;
          Net: <strong style="color:${net >= 0 ? '#16a34a' : '#dc2626'};">${money(net)}</strong>
        </p>
        <table>
          <thead><tr><th>Expense Category</th><th>Entries</th><th>Amount</th></tr></thead>
          <tbody>
            ${Object.keys(byType).length === 0
              ? '<tr><td colspan="3" style="text-align:center;color:#64748b;">No direct expenses recorded for this animal.</td></tr>'
              : Object.entries(byType).map(([type, amt]) => `
                <tr>
                  <td><strong style="text-transform:capitalize;">${type}</strong></td>
                  <td>${rows.filter((r) => r.type === type).length}</td>
                  <td><strong>${money(amt)}</strong></td>
                </tr>`).join('')}
          </tbody>
        </table>`;
      }).join('');

      const scopedExpenses = expenses.filter((e) => (scope === 'all' ? true : e.cowId && ids.has(e.cowId)));
      const farmWide = scope === 'all' ? expenses.filter((e) => !e.cowId).reduce((s, e) => s + (e.amount || 0), 0) : 0;
      const totalExpAll = scopedExpenses.reduce((s, e) => s + (e.amount || 0), 0) + farmWide;
      const totalLiters = milk.filter((m) => (scope === 'all' ? true : ids.has(m.cowId))).reduce((s, m) => s + (m.morning || 0) + (m.evening || 0), 0);
      const totalSaleIncome = sales.filter((s) => (scope === 'all' ? true : ids.has(s.cowId))).reduce((s2, s) => s2 + (s.salePrice || 0), 0);
      const totalIncome = totalLiters * rate + totalSaleIncome;
      const netAll = totalIncome - totalExpAll;

      openPrintDocument(
        `Animal Cycle Financial Summary — ${scopeLabel()}`,
        'Financial Cycle Summary',
        `
        <div class="summary-box">
          <h3>Financial Overview — ${scopeLabel()}</h3>
          <p><strong>Animals in Scope:</strong> ${target.length}</p>
          <p><strong>Milk Volume:</strong> ${totalLiters.toLocaleString()} L @ ${money(rate)}/L</p>
          <p><strong>Total Income (milk + animal sales):</strong> <span style="color:#16a34a;">${money(totalIncome)}</span></p>
          <p><strong>Total Expenses${scope === 'all' ? ' (incl. farm-wide)' : ''}:</strong> <span style="color:#dc2626;">${money(totalExpAll)}</span></p>
          <p><strong>Net Operational Profit:</strong> <span style="font-weight:bold;color:${netAll >= 0 ? '#16a34a' : '#dc2626'};">${money(netAll)}</span></p>
        </div>
        ${sections}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setBusy('');
    }
  };

  // ── 🥛 PRODUCTION-ONLY REPORT: milk volumes, no money. ──
  const exportProduction = async () => {
    setBusy('production');
    setError('');
    try {
      const target = scopedCows();
      if (target.length === 0) throw new Error('No animals found for the selected scope.');
      const milk = (await api.getMilk()) as MilkEntry[];
      const ids = new Set(target.map((c) => c._id));
      const scoped = milk.filter((m) => (scope === 'all' ? true : ids.has(m.cowId)));

      // Monthly totals
      const byMonth: Record<string, { morning: number; evening: number }> = {};
      for (const m of scoped) {
        const key = (m.date || '').slice(0, 7);
        if (!key) continue;
        byMonth[key] = byMonth[key] || { morning: 0, evening: 0 };
        byMonth[key].morning += m.morning || 0;
        byMonth[key].evening += m.evening || 0;
      }
      const months = Object.keys(byMonth).sort();
      const totalAll = months.reduce((s, k) => s + byMonth[k].morning + byMonth[k].evening, 0);

      // Per-cow register
      const perCow = target.map((cow) => {
        const rows = scoped.filter((m) => m.cowId === cow._id);
        const liters = rows.reduce((s, m) => s + (m.morning || 0) + (m.evening || 0), 0);
        return { cow, days: rows.length, liters };
      }).sort((a, b) => b.liters - a.liters);

      openPrintDocument(
        `Milk Production Report — ${scopeLabel()}`,
        'Seasonal Production Report',
        `
        <div class="summary-box">
          <h3>Production Overview — ${scopeLabel()}</h3>
          <p><strong>Animals in Scope:</strong> ${target.length}</p>
          <p><strong>Months Covered:</strong> ${months.length}</p>
          <p><strong>Total Milk Produced:</strong> ${Math.round(totalAll).toLocaleString()} L</p>
        </div>

        <h3>🥛 Month-by-Month Production</h3>
        <table>
          <thead><tr><th>Month</th><th>Morning (L)</th><th>Evening (L)</th><th>Total (L)</th></tr></thead>
          <tbody>
            ${months.map((k) => `
              <tr>
                <td><strong>${k}</strong></td>
                <td>${Math.round(byMonth[k].morning).toLocaleString()}</td>
                <td>${Math.round(byMonth[k].evening).toLocaleString()}</td>
                <td><strong>${Math.round(byMonth[k].morning + byMonth[k].evening).toLocaleString()}</strong></td>
              </tr>`).join('')}
          </tbody>
          <tfoot><tr><td style="font-weight:bold;">TOTAL</td><td colspan="2"></td><td style="font-weight:bold;">${Math.round(totalAll).toLocaleString()} L</td></tr></tfoot>
        </table>

        <h3>🐄 Animal Production Register</h3>
        <table>
          <thead><tr><th>Animal</th><th>Breed</th><th>Status</th><th>Lactation #</th><th>Days Logged</th><th>Total Milk (L)</th></tr></thead>
          <tbody>
            ${perCow.map(({ cow, days, liters }) => `
              <tr>
                <td><strong>${cow.name}</strong></td>
                <td>${cow.breed || '—'}</td>
                <td style="text-transform:capitalize;">${cow.status}</td>
                <td>${cow.lactationNumber ?? '—'}</td>
                <td>${days}</td>
                <td><strong>${Math.round(liters).toLocaleString()}</strong></td>
              </tr>`).join('')}
          </tbody>
        </table>`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="p-5 rounded-[17px] border border-[color:var(--muf-color-border)] bg-[#fffefb]/60 dark:bg-[#0a140d]/40 shadow-xs space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-[color:var(--muf-color-border)]">
        <div className="p-1.5 bg-farm-900/10 text-farm-600 dark:text-farm-400 rounded-lg">
          <FileText size={14} />
        </div>
        <div>
          <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">{L('Official Farm Export Center')}</h4>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">{L('Generate and download PDF dairy reports.')}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider shrink-0">{L('Scope')}</label>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-farm-500 transition"
        >
          <option value="all">🐄 Whole Herd ({cows.length} animals)</option>
          {cows.map((c) => (
            <option key={c._id} value={c._id}>{c.name} — {c.breed || 'Unknown'} ({c.status})</option>
          ))}
        </select>
      </div>

      <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101625]/20 space-y-3">
        <div>
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">💰 Animal Cycle Summary (Financial)</p>
          <p className="text-[11px] text-slate-500">Purchase costs, every expense category, milk revenue and sale income — no production volumes mixed in.</p>
        </div>
        <button
          onClick={exportFinance}
          disabled={busy !== ''}
          className="flex items-center gap-2 bg-farm-600 hover:bg-farm-700 disabled:opacity-60 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition"
        >
          <Printer className="w-3.5 h-3.5" /> {busy === 'finance' ? 'Preparing…' : 'Export Financial PDF'}
        </button>
      </div>

      <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101625]/20 space-y-3">
        <div>
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">🥛 Milk Production Report (Production)</p>
          <p className="text-[11px] text-slate-500">Monthly milk volumes and the per-animal production register — no financial ledgers or money details.</p>
        </div>
        <button
          onClick={exportProduction}
          disabled={busy !== ''}
          className="flex items-center gap-2 bg-farm-600 hover:bg-farm-700 disabled:opacity-60 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition"
        >
          <Printer className="w-3.5 h-3.5" /> {busy === 'production' ? 'Preparing…' : 'Export Production PDF'}
        </button>
      </div>

      {error && <p className="text-xs font-bold text-red-500">{error}</p>}
    </div>
  );
}
