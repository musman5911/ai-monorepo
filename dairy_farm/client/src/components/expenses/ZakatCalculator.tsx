import { useState } from 'react';
import { L } from '../../i18n';
import type { Expense } from '../../types';
import DetailModal from '../../muf/core/muf-modal';
import { zakatStatementBody, pctAmount, ZAKAT_DEFAULT_PCT, downloadZakatPdf } from '../../muf/domain/muf-zakat';
import { openMufPrint } from '../../muf/data/muf-print';

// ── Zakat calculator (simplified version for Finance tab) ────────────
export function ZakatCalculator({ expenses }: { expenses: Expense[] }) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(String(thisYear));
  const [pct, setPct] = useState(String(ZAKAT_DEFAULT_PCT));
  const [incomeOv, setIncomeOv] = useState<string | null>(null);
  const [expenseOv, setExpenseOv] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const years: string[] = [];
  for (let y = thisYear; y >= thisYear - 4; y--) years.push(String(y));
  const autoExpenses = Math.round(expenses.filter(e => (e.date || '').startsWith(year)).reduce((a, e) => a + e.amount, 0));
  const income = incomeOv === null ? Math.round(autoExpenses * 1.5) : (parseFloat(incomeOv) || 0);
  const expensesTotal = expenseOv === null ? autoExpenses : (parseFloat(expenseOv) || 0);
  const profit = income - expensesTotal;
  const pctNum = parseFloat(pct) || 0;
  const amount = pctAmount(profit, pctNum);
  const inputClass = 'w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-farm-500';
  return (
    <>
      <button onClick={() => setOpen(true)} className="muf-card-link w-full flex items-center gap-3 p-4 text-left">
        <span className="shrink-0 w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center text-lg">🕌</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{L('Zakat calculator (yearly)')}</p>
          <p className="text-[11px] text-slate-400 truncate">{L('Income − expenses = profit, then the rate you choose.')}</p>
        </div>
        <span className="shrink-0 text-[10px] font-bold text-farm-600 dark:text-farm-400 uppercase tracking-wider">{L('Open')} →</span>
      </button>
      <DetailModal open={open} onClose={() => setOpen(false)} title={L('Zakat calculator (yearly)')} size="big"
        icon={<span className="text-lg leading-none">🕌</span>} iconBg="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-slate-500 flex-1">{L('Income − expenses = profit, then the rate you choose. The app only does the math — the ruling is your decision.')}</p>
            <select value={year} onChange={e => { setYear(e.target.value); setIncomeOv(null); setExpenseOv(null); }} className={inputClass} style={{ width: 'auto' }}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <label className="muf-pc-label-micro">{L('Income')} ({year})</label>
              <input type="number" className={inputClass} value={incomeOv === null ? income : incomeOv} onChange={e => setIncomeOv(e.target.value)} />
            </div>
            <div>
              <label className="muf-pc-label-micro">{L('Expenses')} ({year})</label>
              <input type="number" className={inputClass} value={expenseOv === null ? autoExpenses : expenseOv} onChange={e => setExpenseOv(e.target.value)} />
            </div>
            <div>
              <label className="muf-pc-label-micro">{L('Rate %')}</label>
              <input type="number" step="any" min="0" className={inputClass} value={pct} onChange={e => setPct(e.target.value)} />
            </div>
            <div className="flex flex-col justify-end">
              <p className="text-[10px] text-slate-400 uppercase">{L('Profit')}: <span className={profit >= 0 ? 'text-farm-600 font-bold' : 'text-red-500 font-bold'}>{profit >= 0 ? '+' : ''}Rs {profit.toLocaleString()}</span></p>
              <p className="text-base font-black text-farm-700 dark:text-farm-400">{L('Zakat')}: Rs {amount.toLocaleString()}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => downloadZakatPdf({ periodLabel: year, income, expenses: expensesTotal, pct: pctNum })} className="px-4 py-2 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-lg transition">{L('Download zakat statement (PDF)')}</button>
            <button onClick={() => openMufPrint({ title: `Zakat Statement — ${year}`, metaHtml: `<p>Period: ${year}</p>`, bodyHtml: zakatStatementBody({ periodLabel: year, income, expenses: expensesTotal, pct: pctNum }) })} className="px-4 py-2 border border-farm-600 text-farm-700 dark:text-farm-400 hover:bg-farm-50 dark:hover:bg-farm-900/20 text-xs font-bold rounded-lg transition">{L('Print')}</button>
          </div>
        </div>
      </DetailModal>
    </>
  );
}
