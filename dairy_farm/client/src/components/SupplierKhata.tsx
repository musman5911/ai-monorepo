// ─── Supplier khata (dealers the farm buys from on credit) ───────
// The other half of the buyer khata: money going OUT. Purchases are the
// existing expense records tagged with a supplierId (added in the
// expense form), payments live in their own records — shared balance
// math + the Urdu WhatsApp text come from the muf-supplier twin.
import { useEffect, useMemo, useState } from 'react';
import { Store, Plus, Trash2, Share2, Wallet, QrCode, Pencil } from 'lucide-react';
import MufCardQr from '../muf-card-qr';
import DetailModal from '../muf-modal';
import { api } from '../api';
import { L } from '../i18n';
import { useConfirm, notify } from '../muf-confirm';
import type { Supplier, SupplierPayment, Expense } from '../types';
import { todayStr, formatDate } from '../utils/date';
import { shareViaWhatsAppTo } from '../utils/share';
import { supplierBalances, supplierTotals, supplierHisabText, type SupplierRow } from '../muf-supplier';

const FARM_SIGNATURE = '— Usman Dairy Farm';

export default function SupplierKhata({ canDelete = true }: { canDelete?: boolean }) {
  const confirmAction = useConfirm();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [khataOf, setKhataOf] = useState<Supplier | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [payDate, setPayDate] = useState(todayStr());
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [editPay, setEditPay] = useState<{ id: string; date: string; amount: string; note: string } | null>(null);

  const load = () => {
    api.getSuppliers().then(setSuppliers).catch(() => setSuppliers([]));
    api.getAllSupplierPayments().then(setPayments).catch(() => setPayments([]));
    api.getExpenses().then(setExpenses).catch(() => setExpenses([]));
  };
  useEffect(load, []);

  const rows: SupplierRow[] = useMemo(() => supplierBalances(
    suppliers.map((s) => ({ id: s._id, name: s.name, phone: s.phone })),
    expenses, payments,
  ), [suppliers, expenses, payments]);
  const totals = useMemo(() => supplierTotals(rows), [rows]);

  const addSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await api.addSupplier({ name: newName.trim(), phone: newPhone.trim() });
      setNewName(''); setNewPhone(''); setShowAdd(false);
      notify(L('Supplier added ✓'), 'success');
      load();
    } catch (err) { notify(err instanceof Error ? err.message : 'Failed', 'error'); }
  };

  const removeSupplier = async (s: Supplier) => {
    const ok = await confirmAction({
      title: L('Delete supplier'),
      message: L('Delete {name}? Expense records stay — only the khata link and payment history go.', { name: s.name }),
      confirmLabel: L('Delete'), tone: 'danger',
    });
    if (!ok) return;
    try { await api.deleteSupplier(s._id); load(); } catch { notify('Failed', 'error'); }
  };

  const addPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!khataOf) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { notify(L('Enter a valid amount'), 'error'); return; }
    setSaving(true);
    try {
      await api.addSupplierPayment(khataOf._id, { date: payDate, amount, note: payNote || undefined });
      setPayAmount(''); setPayNote('');
      notify(L('Payment saved ✓'), 'success');
      load();
    } catch (err) { notify(err instanceof Error ? err.message : 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  const removePayment = async (paymentId: string) => {
    if (!khataOf) return;
    const payment = payments.find((x) => x._id === paymentId);
    if (!payment) return;
    try {
      await api.deleteSupplierPayment(khataOf._id, paymentId);
      load();
      notify(L('Payment deleted'), 'success', undefined, {
        label: L('Undo'),
        fn: () => {
          api.addSupplierPayment(khataOf._id, { date: payment.date, amount: payment.amount, note: payment.note || undefined })
            .then(() => load())
            .catch(() => notify(L('Undo failed — add the payment again'), 'error'));
        },
      });
    } catch { notify(L('Failed'), 'error'); }
  };

  // Ledger for the open khata popup: purchases + payments, oldest first
  // with a running balance, shown newest first.
  const ledger = useMemo(() => {
    if (!khataOf) return [];
    type Row = { date: string; detail: string; purchase: number; payment: number; balance: number; paymentId?: string };
    const events = [
      ...expenses.filter((e) => e.supplierId === khataOf._id).map((e) => ({
        date: e.date, detail: e.note || e.type, purchase: e.amount || 0, payment: 0, paymentId: undefined as string | undefined,
      })),
      ...payments.filter((p) => p.supplierId === khataOf._id).map((p) => ({
        date: p.date, detail: p.note || L('Payment'), purchase: 0, payment: p.amount || 0, paymentId: p._id,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    let bal = 0;
    const out: Row[] = events.map((ev) => {
      bal += ev.purchase - ev.payment;
      return { ...ev, balance: bal };
    });
    return out.reverse().slice(0, 200);
  }, [khataOf, expenses, payments]);

  const khataRow = khataOf ? rows.find((r) => r.id === khataOf._id) : null;

  const openEditPayment = (paymentId: string) => {
    const p = payments.find((x) => x._id === paymentId);
    if (!p) return;
    setEditPay({ id: p._id, date: p.date, amount: String(p.amount), note: p.note || '' });
  };

  const updatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!khataOf || !editPay) return;
    const amount = parseFloat(editPay.amount);
    if (!amount || amount <= 0) { notify(L('Enter a valid amount'), 'error'); return; }
    setSaving(true);
    try {
      await api.updateSupplierPayment(khataOf._id, editPay.id, { date: editPay.date, amount, note: editPay.note.trim() });
      setEditPay(null);
      notify(L('Payment updated ✓'), 'success');
      load();
    } catch (err) { notify(err instanceof Error ? err.message : 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
          <Store className="w-4 h-4 text-farm-600" /> {L('Supplier Khata')}
        </h3>
        <div className="flex items-center gap-2">
          {totals.totalOwed > 0 && (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {L('To pay: Rs {v0}', { v0: totals.totalOwed.toLocaleString() })}
            </span>
          )}
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 px-3 py-1.5 bg-farm-600 hover:bg-farm-700 text-white text-[11px] font-bold rounded-lg transition">
            <Plus className="w-3.5 h-3.5" /> {L('Supplier')}
          </button>
        </div>
      </div>
      <p className="text-[11px] text-slate-400">
        {L('Dealers you buy from on credit. Tag purchases in the expense form; record payments here.')}
      </p>

      {/* add-supplier form lives in a muf popup (DetailModal), like every other form */}
      <DetailModal open={showAdd} onClose={() => setShowAdd(false)} title={L('Add supplier')}
        icon={<Store className="w-5 h-5" />} iconBg="bg-farm-100 text-farm-700" size="small">
        <form onSubmit={addSupplier} className="space-y-3 text-xs">
          <div className="space-y-1">
            <label className="text-slate-500 dark:text-slate-400">{L('Supplier / shop name *')}</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} required autoFocus
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none focus:border-farm-500" />
          </div>
          <div className="space-y-1">
            <label className="text-slate-500 dark:text-slate-400">{L('Phone (03xx…)')}</label>
            <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none focus:border-farm-500" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg transition">{L('Cancel')}</button>
            <button type="submit" className="px-4 py-2 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-lg transition">{L('Save')}</button>
          </div>
        </form>
      </DetailModal>

      {rows.length === 0 && <p className="text-xs text-slate-400 italic">{L('No suppliers yet — add your feed / medicine dealer.')}</p>}
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 cursor-pointer hover:border-farm-300 dark:hover:border-farm-700 transition"
            onClick={() => { const sp = suppliers.find((x) => x._id === r.id); if (sp) { setKhataOf(sp); setPayDate(todayStr()); } }} title={L('Open khata')}>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-700 dark:text-slate-200 truncate">{r.name}</p>
              {r.phone && <p className="text-[10px] text-slate-400">{r.phone}</p>}
            </div>
            <span className={`shrink-0 font-bold ${r.balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              Rs {Math.abs(r.balance).toLocaleString()}{r.balance > 0 ? '' : ' ✓'}
            </span>
            <button onClick={(e) => { e.stopPropagation(); const sp = suppliers.find((x) => x._id === r.id); if (sp) { setKhataOf(sp); setPayDate(todayStr()); } }}
              className="shrink-0 text-farm-600 hover:text-farm-700 font-bold transition">{L('Khata')}</button>
            {canDelete && (
              <button onClick={(e) => { e.stopPropagation(); const sp = suppliers.find((x) => x._id === r.id); if (sp) removeSupplier(sp); }}
                className="shrink-0 text-slate-300 hover:text-red-500 transition"><Trash2 className="w-3.5 h-3.5" /></button>
            )}
          </div>
        ))}
      </div>

      {/* ── Khata popup ── */}
      <DetailModal open={!!khataOf} onClose={() => setKhataOf(null)} title={khataOf ? `${khataOf.name} — ${L('Khata')}` : ''}
        icon={<Wallet className="w-5 h-5" />} iconBg="bg-farm-100 text-farm-700" size="big">
        {khataOf && khataRow && (<>
          <MufCardQr open={qrOpen} onClose={() => setQrOpen(false)} kind="supplier" id={khataOf._id} name={khataOf.name} />
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-2.5">
                <p className="text-[10px] text-slate-400 font-bold uppercase">{L('Purchased')}</p>
                <p className="font-black text-sm text-slate-700 dark:text-slate-200">Rs {khataRow.purchased.toLocaleString()}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 p-2.5">
                <p className="text-[10px] text-emerald-600 font-bold uppercase">{L('Paid')}</p>
                <p className="font-black text-sm text-emerald-700 dark:text-emerald-400">Rs {khataRow.paid.toLocaleString()}</p>
              </div>
              <div className={`rounded-xl p-2.5 border ${khataRow.balance > 0 ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'}`}>
                <p className={`text-[10px] font-bold uppercase ${khataRow.balance > 0 ? 'text-red-500' : 'text-slate-400'}`}>{L('Balance')}</p>
                <p className={`font-black text-sm ${khataRow.balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>Rs {khataRow.balance.toLocaleString()}</p>
              </div>
            </div>

            {khataOf.phone && (
              <button onClick={() => shareViaWhatsAppTo(khataOf.phone!, supplierHisabText(khataOf.name, khataRow, FARM_SIGNATURE))}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition">
                <Share2 className="w-3.5 h-3.5" /> {L('Send hisab on WhatsApp')}
              </button>
            )}
            <button onClick={() => setQrOpen(true)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition">
              <QrCode className="w-3.5 h-3.5" /> {L('QR card for supplier')}
            </button>

            {editPay && (
              <form onSubmit={updatePayment} className="flex flex-wrap gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                <input type="date" value={editPay.date} onChange={(e) => setEditPay({ ...editPay, date: e.target.value })} required
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none" />
                <input type="number" min="1" step="any" value={editPay.amount} onChange={(e) => setEditPay({ ...editPay, amount: e.target.value })} placeholder={L('Amount (Rs)')} required
                  className="flex-1 min-w-[100px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none" />
                <input value={editPay.note} onChange={(e) => setEditPay({ ...editPay, note: e.target.value })} placeholder={L('Note')}
                  className="flex-1 min-w-[100px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none" />
                <button type="button" onClick={() => setEditPay(null)} className="px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition">{L('Cancel')}</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-farm-600 hover:bg-farm-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition">
                  {saving ? '…' : L('Save changes')}
                </button>
              </form>
            )}
            <form onSubmit={addPayment} className="flex flex-wrap gap-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
              <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} required
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none" />
              <input type="number" min="1" step="any" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder={L('Amount paid (Rs)')} required
                className="flex-1 min-w-[120px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none" />
              <input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder={L('Note (optional)')}
                className="flex-1 min-w-[120px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none" />
              <button type="submit" disabled={saving} className="px-4 py-2 bg-farm-600 hover:bg-farm-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition">
                {saving ? '…' : L('Add payment')}
              </button>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-200 dark:border-slate-700">
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
                    <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-1.5 pr-2 whitespace-nowrap text-slate-500">{formatDate(row.date)}</td>
                      <td className="py-1.5 pr-2 text-slate-700 dark:text-slate-300 max-w-[200px] truncate">{row.detail}</td>
                      <td className="py-1.5 pr-2 text-right text-slate-700 dark:text-slate-300">{row.purchase ? `Rs ${row.purchase.toLocaleString()}` : ''}</td>
                      <td className="py-1.5 pr-2 text-right text-emerald-600">{row.payment ? `Rs ${row.payment.toLocaleString()}` : ''}</td>
                      <td className={`py-1.5 pr-2 text-right font-bold ${row.balance > 0 ? 'text-red-500' : 'text-slate-500'}`}>Rs {row.balance.toLocaleString()}</td>
                      <td className="py-1.5 text-right">
                        {row.paymentId && canDelete && (
                          <span className="inline-flex gap-1">
                            <button onClick={() => openEditPayment(row.paymentId!)} className="text-slate-400 hover:text-farm-600 transition" title={L('Edit payment')}><Pencil className="w-3 h-3" /></button>
                            <button onClick={() => removePayment(row.paymentId!)} className="text-slate-300 hover:text-red-500 transition"><Trash2 className="w-3 h-3" /></button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {ledger.length === 0 && (
                    <tr><td colSpan={6} className="py-4 text-center text-slate-400 italic">{L('Nothing yet — tag expenses with this supplier or add a payment.')}</td></tr>
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
