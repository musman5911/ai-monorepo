import { useEffect, useState } from 'react';
import { mufL } from '../muf/data/muf-urdu';
import { openPrintDocument } from '../muf/data/muf-print';
import { FileText, Printer } from 'lucide-react';
import { listBatches } from '../api';
import {
  Bird, OtherExpense, FeedRecord, EggProduction, GlobalSettings,
  VaccinationRecord, CustomerSale, Lang, BatchWithSummary,
} from '../types';
import { eggSaleIncome } from '../utils/calculations';

/**
 * Official Farm Export Center's
 * ("💰 Crop-Specific Cycle Summary" / "🌾 Seasonal Harvest Yield Report"),
 * adapted to poultry data. Two strictly separated official PDF reports:
 *
 *   💰 Flock/Batch Cycle Summary (Financial) — bird purchases, feed costs,
 *      expenses, vaccination costs, egg income and sale revenue. Money only.
 *   🥚 Egg Production Report (Production) — monthly egg volumes and the
 *      flock/batch production register. No financial data.
 *
 * Scope drill-down: the whole flock, or one hand-picked batch.
 */

type Scope = 'flock' | string; // 'flock' or a batch_id

function money(n: number) { return `Rs. ${Math.round(n).toLocaleString()}`; }

export default function ExportCenter({
  lang,
  birds,
  otherExpenses,
  feedRecords,
  eggProduction,
  vaccinations,
  customerSales,
  settings,
}: {
  lang: Lang;
  birds: Bird[];
  otherExpenses: OtherExpense[];
  feedRecords: FeedRecord[];
  eggProduction: EggProduction[];
  vaccinations: VaccinationRecord[];
  customerSales: CustomerSale[];
  settings: GlobalSettings;
}) {
  const L = (en: string, urOrVars?: string | Record<string, string | number | null>) => mufL(lang, en, urOrVars);
  const [batches, setBatches] = useState<BatchWithSummary[]>([]);
  const [scope, setScope] = useState<Scope>('flock');
  const [error, setError] = useState('');

  useEffect(() => {
    listBatches().then(setBatches).catch(() => setBatches([]));
  }, []);

  const scopeLabel = () =>
    scope === 'flock'
      ? 'Whole Flock'
      : `Batch: ${batches.find((b) => b.batch_id === scope)?.name || scope}`;

  // ── 💰 FINANCE-ONLY REPORT ──
  const exportFinance = () => {
    setError('');
    try {
      if (scope === 'flock') {
        const birdPurchase = birds.reduce((s, b) => s + (b.price || 0), 0);
        const feedCost = feedRecords.reduce((s, f) => s + f.quantityKg * f.rateRsPerKg, 0);
        const otherCost = otherExpenses.reduce((s, e) => s + (e.amount || 0), 0);
        const vacCost = vaccinations.reduce((s, v) => s + (v.cost || 0), 0);
        const eggIncome = eggProduction.reduce((s, e) => s + eggSaleIncome(e, settings), 0);
        const birdSales = birds.filter((b) => b.status === 'Sold').reduce((s, b) => s + (b.salePrice || 0), 0);
        const customerPaid = customerSales.reduce((s, c) => s + (c.amountPaid || 0), 0);
        const totalExpense = birdPurchase + feedCost + otherCost + vacCost;
        const totalIncome = eggIncome + birdSales;
        const net = totalIncome - totalExpense;

        const expenseRows: Array<[string, number, string]> = [
          ['Bird purchases', birdPurchase, `${birds.filter((b) => (b.price || 0) > 0).length} birds`],
          ['Feed', feedCost, `${feedRecords.length} purchases`],
          ['Other expenses', otherCost, `${otherExpenses.length} entries`],
          ['Vaccinations', vacCost, `${vaccinations.length} records`],
        ];
        const incomeRows: Array<[string, number, string]> = [
          ['Egg sales', eggIncome, `${eggProduction.reduce((s, e) => s + (e.sold || 0), 0).toLocaleString()} eggs sold`],
          ['Bird sales', birdSales, `${birds.filter((b) => b.status === 'Sold').length} birds sold`],
        ];

        openPrintDocument(
          `Flock Cycle Financial Summary — ${scopeLabel()}`,
          'Financial Cycle Summary',
          `
          <div class="summary-box">
            <h3>Financial Overview — ${scopeLabel()}</h3>
            <p><strong>Total Income:</strong> <span style="color:#16a34a;">${money(totalIncome)}</span></p>
            <p><strong>Total Expenses:</strong> <span style="color:#dc2626;">${money(totalExpense)}</span></p>
            <p><strong>Net Balance:</strong> <span style="font-weight:bold;color:${net >= 0 ? '#16a34a' : '#dc2626'};">${money(net)}</span></p>
            <p><strong>Customer payments received (ledger):</strong> ${money(customerPaid)}</p>
          </div>
          <h3>💸 Expense Breakdown</h3>
          <table>
            <thead><tr><th>Category</th><th>Details</th><th>Amount</th></tr></thead>
            <tbody>${expenseRows.map(([k, v, d]) => `<tr><td><strong>${k}</strong></td><td>${d}</td><td><strong>${money(v)}</strong></td></tr>`).join('')}</tbody>
            <tfoot><tr><td style="font-weight:bold;">TOTAL EXPENSES</td><td></td><td style="font-weight:bold;color:#dc2626;">${money(totalExpense)}</td></tr></tfoot>
          </table>
          <h3>💰 Income Breakdown</h3>
          <table>
            <thead><tr><th>Source</th><th>Details</th><th>Amount</th></tr></thead>
            <tbody>${incomeRows.map(([k, v, d]) => `<tr><td><strong>${k}</strong></td><td>${d}</td><td><strong>${money(v)}</strong></td></tr>`).join('')}</tbody>
            <tfoot><tr><td style="font-weight:bold;">TOTAL INCOME</td><td></td><td style="font-weight:bold;color:#16a34a;">${money(totalIncome)}</td></tr></tfoot>
          </table>
          ${batches.length > 0 ? `
          <h3>📦 Batch P&amp;L Register</h3>
          <table>
            <thead><tr><th>{L('Batch')}</th><th>{L('Type')}</th><th>{L('Status')}</th><th>{L('Total Cost')}</th><th>{L('Revenue')}</th><th>{L('Profit / Loss')}</th></tr></thead>
            <tbody>${batches.map((b) => `
              <tr>
                <td><strong>${b.name}</strong></td>
                <td>${b.type}</td>
                <td>${b.status}</td>
                <td>${money(b.summary?.total_cost || 0)}</td>
                <td>${money(b.summary?.total_revenue || 0)}</td>
                <td style="font-weight:bold;color:${(b.summary?.profit_loss || 0) >= 0 ? '#16a34a' : '#dc2626'};">${money(b.summary?.profit_loss || 0)}</td>
              </tr>`).join('')}</tbody>
          </table>` : ''}`
        );
      } else {
        const batch = batches.find((b) => b.batch_id === scope);
        if (!batch) throw new Error('Batch not found.');
        const s = batch.summary;
        const net = s?.profit_loss || 0;
        openPrintDocument(
          `Batch Cycle Financial Summary — ${batch.name}`,
          'Financial Cycle Summary',
          `
          <div class="summary-box">
            <h3>Financial Overview — ${batch.name} (${batch.type})</h3>
            <p><strong>Status:</strong> ${batch.status} · started ${batch.start_date}</p>
            <p><strong>Intake:</strong> ${batch.intake_count} birds @ ${money(batch.cost_per_bird)} each</p>
            <p><strong>Total Cost (intake + feed + expenses):</strong> <span style="color:#dc2626;">${money(s?.total_cost || 0)}</span></p>
            <p><strong>Total Revenue (sales):</strong> <span style="color:#16a34a;">${money(s?.total_revenue || 0)}</span></p>
            <p><strong>Profit / Loss:</strong> <span style="font-weight:bold;color:${net >= 0 ? '#16a34a' : '#dc2626'};">${money(net)}</span></p>
          </div>
          <h3>💸 Cost Stack</h3>
          <table>
            <thead><tr><th>Category</th><th>Amount</th></tr></thead>
            <tbody>
              <tr><td><strong>Bird intake</strong></td><td>${money(s?.intake_cost || 0)}</td></tr>
              <tr><td><strong>Feed</strong></td><td>${money(s?.total_feed_cost || 0)}</td></tr>
              <tr><td><strong>Other expenses</strong></td><td>${money(s?.total_expense_cost || 0)}</td></tr>
            </tbody>
            <tfoot><tr><td style="font-weight:bold;">TOTAL</td><td style="font-weight:bold;color:#dc2626;">${money(s?.total_cost || 0)}</td></tr></tfoot>
          </table>
          <p style="font-size:12px;color:#475569;">Cost per bird so far: <strong>${money(s?.cost_per_bird || 0)}</strong> · Sold: <strong>${s?.total_sold_count || 0}</strong> birds for <strong>${money(s?.total_revenue || 0)}</strong></p>`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  };

  // ── 🥚 PRODUCTION-ONLY REPORT ──
  const exportProduction = () => {
    setError('');
    try {
      if (scope === 'flock') {
        const byMonth: Record<string, { collected: number; sold: number; home: number; broken: number }> = {};
        for (const e of eggProduction) {
          const key = (e.date || '').slice(0, 7);
          if (!key) continue;
          byMonth[key] = byMonth[key] || { collected: 0, sold: 0, home: 0, broken: 0 };
          byMonth[key].collected += e.totalEggsCollected || 0;
          byMonth[key].sold += e.sold || 0;
          byMonth[key].home += e.homeUse || 0;
          byMonth[key].broken += e.brokenWasted || 0;
        }
        const months = Object.keys(byMonth).sort();
        const totals = months.reduce(
          (acc, k) => ({
            collected: acc.collected + byMonth[k].collected,
            sold: acc.sold + byMonth[k].sold,
            home: acc.home + byMonth[k].home,
            broken: acc.broken + byMonth[k].broken,
          }),
          { collected: 0, sold: 0, home: 0, broken: 0 }
        );
        const active = birds.filter((b) => b.status === 'Active' || b.status === 'Sick');

        openPrintDocument(
          `Egg Production Report — ${scopeLabel()}`,
          'Seasonal Production Report',
          `
          <div class="summary-box">
            <h3>Production Overview — ${scopeLabel()}</h3>
            <p><strong>Months Covered:</strong> ${months.length}</p>
            <p><strong>Total Eggs Collected:</strong> ${totals.collected.toLocaleString()}</p>
            <p><strong>Sold:</strong> ${totals.sold.toLocaleString()} · <strong>Home Use:</strong> ${totals.home.toLocaleString()} · <strong>Broken/Wasted:</strong> ${totals.broken.toLocaleString()}</p>
            <p><strong>Current Flock:</strong> ${active.length} active birds (${birds.length} total registered)</p>
          </div>
          <h3>🥚 Month-by-Month Production</h3>
          <table>
            <thead><tr><th>Month</th><th>Collected</th><th>Sold</th><th>Home Use</th><th>Broken</th></tr></thead>
            <tbody>${months.map((k) => `
              <tr>
                <td><strong>${k}</strong></td>
                <td><strong>${byMonth[k].collected.toLocaleString()}</strong></td>
                <td>${byMonth[k].sold.toLocaleString()}</td>
                <td>${byMonth[k].home.toLocaleString()}</td>
                <td>${byMonth[k].broken.toLocaleString()}</td>
              </tr>`).join('')}</tbody>
            <tfoot><tr><td style="font-weight:bold;">TOTAL</td><td style="font-weight:bold;">${totals.collected.toLocaleString()}</td><td style="font-weight:bold;">${totals.sold.toLocaleString()}</td><td style="font-weight:bold;">${totals.home.toLocaleString()}</td><td style="font-weight:bold;">${totals.broken.toLocaleString()}</td></tr></tfoot>
          </table>
          <h3>🐔 Flock Register</h3>
          <table>
            <thead><tr><th>Bird</th><th>Gender</th><th>Breed</th><th>Status</th><th>Bought / Born</th><th>Last Vaccination</th></tr></thead>
            <tbody>${birds.map((b) => `
              <tr>
                <td><strong>${b.name}</strong></td>
                <td>${b.gender}</td>
                <td>${b.breed || '—'}</td>
                <td>${b.status}</td>
                <td>${b.dateBought || b.dateOfBirth || '—'}</td>
                <td>${b.lastVaccinationDate || 'Never'}</td>
              </tr>`).join('')}</tbody>
          </table>`
        );
      } else {
        const batch = batches.find((b) => b.batch_id === scope);
        if (!batch) throw new Error('Batch not found.');
        const s = batch.summary;
        openPrintDocument(
          `Batch Production Report — ${batch.name}`,
          'Seasonal Production Report',
          `
          <div class="summary-box">
            <h3>Production Overview — ${batch.name} (${batch.type})</h3>
            <p><strong>Status:</strong> ${batch.status} · started ${batch.start_date}${batch.expected_end_date ? ` · expected end ${batch.expected_end_date}` : ''}</p>
            <p><strong>Source:</strong> ${batch.source || '—'}</p>
          </div>
          <h3>📦 Batch Production Register</h3>
          <table>
            <thead><tr><th>Metric</th><th>Value</th></tr></thead>
            <tbody>
              <tr><td><strong>Birds intake</strong></td><td>${batch.intake_count}</td></tr>
              <tr><td><strong>Mortality</strong></td><td>${s?.total_mortality_count || 0} (${s?.mortality_pct || 0}%)</td></tr>
              <tr><td><strong>Sold</strong></td><td>${s?.total_sold_count || 0}</td></tr>
              <tr><td><strong>Live now</strong></td><td><strong>${s?.live_count || 0}</strong></td></tr>
            </tbody>
          </table>`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  };

  return (
    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-farm-900/10 text-farm-600 dark:text-farm-400 rounded-lg">
          <FileText size={14} />
        </div>
        <div>
          <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            {L('Official Farm Export Center')}
          </h4>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
            {L('Generate and download PDF poultry reports.')}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider shrink-0">{L('Scope')}</label>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className="w-full text-sm px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:border-emerald-400"
        >
          <option value="flock">🐔 {L('Whole Flock')} ({birds.length} birds)</option>
          {batches.map((b) => (
            <option key={b.batch_id} value={b.batch_id}>📦 {b.name} — {b.type} ({b.status})</option>
          ))}
        </select>
      </div>

      <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101625]/20 space-y-3">
        <div>
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">💰 {L('Flock/Batch Cycle Summary (Financial)')}</p>
          <p className="text-[11px] text-slate-500">{L('Bird purchases, feed, expenses, vaccination costs, egg income and sale revenue — money only.')}</p>
        </div>
        <button
          onClick={exportFinance}
          className="flex items-center gap-2 bg-farm-600 hover:bg-farm-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition"
        >
          <Printer className="w-3.5 h-3.5" /> {L('Export Financial PDF')}
        </button>
      </div>

      <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101625]/20 space-y-3">
        <div>
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">🥚 {L('Egg Production Report (Production)')}</p>
          <p className="text-[11px] text-slate-500">{L('Monthly egg volumes and the flock/batch production register — no financial details.')}</p>
        </div>
        <button
          onClick={exportProduction}
          className="flex items-center gap-2 bg-farm-600 hover:bg-farm-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition"
        >
          <Printer className="w-3.5 h-3.5" /> {L('Export Production PDF')}
        </button>
      </div>

      {error && <p className="text-xs font-bold text-rose-500">{error}</p>}
    </div>
  );
}
