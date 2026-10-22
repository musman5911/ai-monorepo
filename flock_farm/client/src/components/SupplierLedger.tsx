// ─── Supplier khata (dealers the farm buys from on credit) ───────
// Flock version of the dairy SupplierKhata. Purchases are the existing
// feed records + other expenses tagged with a supplierId in their
// forms; payments live in the 'supplierPayments' bucket. Shared math +
// Urdu WhatsApp text come from the muf-supplier twin.
import { useEffect, useMemo, useState } from 'react';
import { mufL } from '../muf/data/muf-urdu';
import { Store, Plus, Trash2, Share2, Wallet, QrCode } from 'lucide-react';
import MufCardQr from '../muf/ui/muf-card-qr';
import DetailModal from '../muf/core/muf-modal';
import { loadData, saveData } from '../api';
import { useConfirm, notify } from '../muf/core/muf-confirm';
import type { FeedRecord, OtherExpense, Supplier, SupplierPayment, Lang } from '../types';
import { shareViaWhatsAppTo } from '../utils/share';
import { supplierBalances, supplierTotals, supplierHisabText, type SupplierRow } from '../muf/domain/muf-supplier';
import {mufDateStr} from '../muf/data/muf-date';

const FARM_SIGNATURE = '— Usman Flock Farm';

function todayLocal() {
  const d = new Date();
  return mufDateStr(d);
}

interface SupplierLedgerProps {
  lang?: Lang;
  suppliers: Supplier[];
  onChangeSuppliers: (next: Supplier[]) => void;
  feedRecords: FeedRecord[];
  otherExpenses: OtherExpense[];
  canDelete?: boolean;
}

export default function SupplierLedger({ lang = 'en', suppliers, onChangeSuppliers, feedRecords, otherExpenses, canDelete = true }: SupplierLedgerProps) {
  const L = (en: string, urOrVars?: string | Record<string, string | number | null>) => mufL(lang, en, urOrVars);
  const confirmAction = useConfirm();
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [khataOf, setKhataOf] = useState<Supplier | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [payDate, setPayDate] = useState(todayLocal());
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');

  useEffect(() => {
    loadData<SupplierPayment[]>('supplierPayments', []).then(setPayments).catch(() => setPayments([]));
  }, []);

  // Purchases = tagged feed records (kg × rate) + tagged other expenses.
  const purchases = useMemo(() => ([
    ...feedRecords.filter((f) => f.supplierId).map((f) => ({
      supplierId: String(f.supplierId), amount: (f.quantityKg || 0) * (f.rateRsPerKg || 0), date: f.date,
      detail: `${f.feedType} ${f.quantityKg} kg`,
    })),
    ...otherExpenses.filter((e) => e.supplierId).map((e) => ({
      supplierId: String(e.supplierId), amount: e.amount || 0, date: e.date, detail: e.detail,
    })),
  ]), [feedRecords, otherExpenses]);

  const rows: SupplierRow[] = useMemo(() => supplierBalances(
    suppliers.map((s) => ({ id: String(s.id), name: s.name, phone: s.phone })),
    purchases,
    payments.map((p) => ({ ...p, supplierId: String(p.supplierId) })),
  ), [suppliers, purchases, payments]);
  const totals = useMemo(() => supplierTotals(rows), [rows]);

  const persistSuppliers = async (next: Supplier[]) => {
    onChangeSuppliers(next);
    await saveData('suppliers', next);
  };
  const persistPayments = async (next: SupplierPayment[]) => {
    setPayments(next);
    await saveData('supplierPayments', next);
  };

  const addSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await persistSuppliers([...suppliers, { id: Date.now(), name: newName.trim(), phone: newPhone.trim() || undefined }]);
    setNewName(''); setNewPhone(''); setShowAdd(false);
    notify(L('Supplier added ✓'), 'success');
  };

  const removeSupplier = async (s: Supplier) => {
    const ok = await confirmAction({
      title: L('Delete supplier'),
      message: L('Delete {name}? Expense records stay — only the khata link and payment history go.', { name: s.name }),
      confirmLabel: L('Delete'), cancelLabel: L('Cancel'), tone: 'danger',
    });
    if (!ok) return;
    await persistSuppliers(suppliers.filter((x) => x.id !== s.id));
    await persistPayments(payments.filter((p) => String(p.supplierId) !== String(s.id)));
  };

  const addPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!khataOf) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { notify(L('Enter a valid amount'), 'error'); return; }
    await persistPayments([...payments, { id: Date.now(), supplierId: khataOf.id, date: payDate, amount, note: payNote.trim() || undefined }]);
    setPayAmount(''); setPayNote('');
    notify(L('Payment saved ✓'), 'success');
  };

  const removePayment = async (id: number | string) => {
    const ok = await confirmAction({
      title: L('Delete payment'),
      message: L('Delete this payment entry?'),
      confirmLabel: L('Delete'), cancelLabel: L('Cancel'), tone: 'danger',
    });
    if (!ok) return;
    await persistPayments(payments.filter((p) => p.id !== id));
  };

  const ledger = useMemo(() => {
    if (!khataOf) return [];
    const events = [
      ...purchases.filter((p) => String(p.supplierId) === String(khataOf.id)).map((p) => ({
        date: p.date || '', detail: p.detail || '', purchase: p.amount || 0, payment: 0, paymentId: undefined as (number | string | undefined),
      })),
      ...payments.filter((p) => String(p.supplierId) === String(khataOf.id)).map((p) => ({
        date: p.date, detail: p.note || L('Payment'), purchase: 0, payment: p.amount || 0, paymentId: p.id,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    let bal = 0;
    return events.map((ev) => { bal += ev.purchase - ev.payment; return { ...ev, balance: bal }; }).reverse().slice(0, 200);
  }, [khataOf, purchases, payments]);

  const khataRow = khataOf ? rows.find((r) => r.id === String(khataOf.id)) : null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <Store className="w-4 h-4 text-emerald-600" /> {L('Supplier Khata')}
        </h3>
        <div className="flex items-center gap-2">
          {totals.totalOwed > 0 && (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-600">
              {L('To pay: Rs {v0}', { v0: totals.totalOwed.toLocaleString() })}
            </span>
          )}
          {canDelete && (
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 px-3 py-1.5 bg-farm-600 hover:bg-farm-700 text-white text-[11px] font-bold rounded-lg transition">
              <Plus className="w-3.5 h-3.5" /> {L('Supplier')}
            </button>
          )}
        </div>
      </div>
      <p className="text-[11px] text-slate-400">
        {L('Dealers you buy from on credit. Tag purchases in the feed / expense forms; record payments here.')}
      </p>

      {/* add-supplier form lives in a muf popup (DetailModal), like every other form */}
      <DetailModal open={showAdd} onClose={() => setShowAdd(false)} title={L('Add supplier')}
        icon={<Store className="w-5 h-5" />} iconBg="bg-emerald-100 text-emerald-700" size="small">
        <form onSubmit={addSupplier} className="space-y-3 text-xs">
          <div className="space-y-1">
            <label className="text-slate-500">{L('Supplier / shop name *')}</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} required autoFocus
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:border-emerald-400" />
          </div>
          <div className="space-y-1">
            <label className="text-slate-500">{L('Phone (03xx…)')}</label>
            <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:border-emerald-400" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg transition">{L('Cancel')}</button>
            <button type="submit" className="px-4 py-2 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-lg transition">{L('Save')}</button>
          </div>
        </form>
      </DetailModal>

      {rows.length === 0 && <p className="text-xs text-slate-400 italic">{L('No suppliers yet — add your feed / medicine dealer.')}</p>}
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700 transition"
            onClick={() => { const sp = suppliers.find((x) => String(x.id) === r.id); if (sp) { setKhataOf(sp); setPayDate(todayLocal()); } }} title={L('Open khata')}>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-700 truncate">{r.name}</p>
              {r.phone && <p className="text-[10px] text-slate-400">{r.phone}</p>}
            </div>
            <span className={`shrink-0 font-bold ${r.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              Rs {Math.abs(r.balance).toLocaleString()}{r.balance > 0 ? '' : ' ✓'}
            </span>
            <button onClick={(e) => { e.stopPropagation(); const sp = suppliers.find((x) => String(x.id) === r.id); if (sp) { setKhataOf(sp); setPayDate(todayLocal()); } }}
              className="shrink-0 text-emerald-600 hover:text-emerald-700 font-bold transition">{L('Khata')}</button>
            {canDelete && (
              <button onClick={(e) => { e.stopPropagation(); const sp = suppliers.find((x) => String(x.id) === r.id); if (sp) removeSupplier(sp); }}
                className="shrink-0 text-slate-300 hover:text-red-500 transition"><Trash2 className="w-3.5 h-3.5" /></button>
            )}
          </div>
        ))}
      </div>

      {/* ── Khata popup ── */}
      <DetailModal open={!!khataOf} onClose={() => setKhataOf(null)} title={khataOf ? `${khataOf.name} — ${L('Khata')}` : ''}
        icon={<Wallet className="w-5 h-5" />} iconBg="bg-emerald-100 text-emerald-700" size="big">
        {khataOf && khataRow && (<>
          <MufCardQr open={qrOpen} onClose={() => setQrOpen(false)} kind="supplier" id={khataOf.id} name={khataOf.name} />
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5">
                <p className="text-[10px] text-slate-400 font-bold uppercase">{L('Purchased')}</p>
                <p className="font-black text-sm text-slate-700">Rs {khataRow.purchased.toLocaleString()}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5">
                <p className="text-[10px] text-emerald-600 font-bold uppercase">{L('Paid')}</p>
                <p className="font-black text-sm text-emerald-700">Rs {khataRow.paid.toLocaleString()}</p>
              </div>
              <div className={`rounded-xl p-2.5 border ${khataRow.balance > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                <p className={`text-[10px] font-bold uppercase ${khataRow.balance > 0 ? 'text-red-500' : 'text-slate-400'}`}>{L('Balance')}</p>
                <p className={`font-black text-sm ${khataRow.balance > 0 ? 'text-red-600' : 'text-slate-700'}`}>Rs {khataRow.balance.toLocaleString()}</p>
              </div>
            </div>

            {khataOf.phone && (
              <button onClick={() => shareViaWhatsAppTo(khataOf.phone!, supplierHisabText(khataOf.name, khataRow, FARM_SIGNATURE))}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-lg transition">
                <Share2 className="w-3.5 h-3.5" /> {L('Send hisab on WhatsApp')}
              </button>
            )}
            <button onClick={() => setQrOpen(true)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition">
              <QrCode className="w-3.5 h-3.5" /> {L('QR card for supplier')}
            </button>

            {canDelete && (
            <form onSubmit={addPayment} className="flex flex-wrap gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
              <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} required
                className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs outline-none" />
              <input type="number" min="1" step="any" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder={L('Amount paid (Rs)')} required
                className="flex-1 min-w-[120px] px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs outline-none" />
              <input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder={L('Note (optional)')}
                className="flex-1 min-w-[120px] px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs outline-none" />
              <button type="submit" className="px-4 py-2 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-lg transition">
                {L('Add payment')}
              </button>
            </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-200">
                    <th className="py-1.5 pr-2">{L('Date')}</th>
                    <th className="py-1.5 pr-2">{L('Detail')}</th>
                    <th className="py-1.5 pr-2 text-right">{L('Purchase')}</th>
                    <th className="py-1.5 pr-2 text-right">{L('Paid')}</th>
                    <th className="py-1.5 pr-2 text-right">{L('Balance')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((row, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-1.5 pr-2 whitespace-nowrap text-slate-500">{row.date}</td>
                      <td className="py-1.5 pr-2 text-slate-700 max-w-[200px] truncate">{row.detail}</td>
                      <td className="py-1.5 pr-2 text-right text-slate-700">{row.purchase ? `Rs ${Math.round(row.purchase).toLocaleString()}` : ''}</td>
                      <td className="py-1.5 pr-2 text-right text-emerald-600">{row.payment ? `Rs ${Math.round(row.payment).toLocaleString()}` : ''}</td>
                      <td className={`py-1.5 pr-2 text-right font-bold ${row.balance > 0 ? 'text-red-500' : 'text-slate-500'}`}>Rs {Math.round(row.balance).toLocaleString()}</td>
                      <td className="py-1.5 text-right">
                        {row.paymentId !== undefined && canDelete && (
                          <button onClick={() => removePayment(row.paymentId!)} className="text-slate-300 hover:text-red-500 transition"><Trash2 className="w-3 h-3" /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {ledger.length === 0 && (
                    <tr><td colSpan={6} className="py-4 text-center text-slate-400 italic">{L('Nothing yet — tag feed/expenses with this supplier or add a payment.')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>)
        }
      </DetailModal>
    </div>
  );
}
