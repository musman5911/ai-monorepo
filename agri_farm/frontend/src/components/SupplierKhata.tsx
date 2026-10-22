// ─── Supplier khata (dealers the farm buys from on credit) ───────
// Agri version of the dairy/flock supplier khata. Purchases are the
// finance expenses tagged with supplier_id in the ledger form; payments
// live in their own collection. Shared balance math + the Urdu WhatsApp
// text come from the muf-supplier twin (src/muf-supplier.js).
import { useMemo, useState } from 'react';
import { Store, Plus, Trash2, Share2, Wallet, QrCode, Pencil } from 'lucide-react';
import MufCardQr from '../muf/ui/muf-card-qr';
import DetailModal from '../muf/core/muf-modal';
import * as api from '../api';
import { L } from '../i18n';
import { useConfirm, notify } from '../muf/core/muf-confirm';
import { supplierBalances, supplierTotals, supplierHisabText } from '../muf/domain/muf-supplier';
import {mufDateStr} from '../muf/data/muf-date';

const FARM_SIGNATURE = '— Usman Agri Farm';

function todayLocal() {
  const d = new Date();
  return mufDateStr(d);
}

function shareViaWhatsAppTo(phone, text) {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  const intl = digits.startsWith('0') ? `92${digits.slice(1)}` : digits;
  window.open(`https://wa.me/${intl}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

export default function SupplierKhata({ suppliers = [], payments = [], financeEntries = [], onChanged, showAlert }) {
  const confirmAction = useConfirm();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [khataOf, setKhataOf] = useState(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [payDate, setPayDate] = useState(todayLocal());
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [editPay, setEditPay] = useState(null); // { paymentId, date, amount, note }

  // Purchases = finance expenses tagged with supplier_id.
  const purchases = useMemo(() => financeEntries
    .filter((f) => f.type === 'expense' && f.supplier_id)
    .map((f) => ({ supplierId: f.supplier_id, amount: f.amount || 0, date: f.date || '', detail: f.category })),
  [financeEntries]);

  const rows = useMemo(() => supplierBalances(
    suppliers.map((s) => ({ id: s._id, name: s.name, phone: s.phone })),
    purchases,
    payments.map((p) => ({ supplierId: p.supplier_id, amount: p.amount, date: p.date })),
  ), [suppliers, purchases, payments]);
  const totals = useMemo(() => supplierTotals(rows), [rows]);

  const addSupplier = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await api.addSupplier({ name: newName.trim(), phone: newPhone.trim() });
      setNewName(''); setNewPhone(''); setShowAdd(false);
      showAlert(L('Supplier added!'));
      onChanged && onChanged();
    } catch (err) { showAlert(err?.response?.data?.detail || 'Failed to add supplier.', true); }
  };

  const removeSupplier = async (s) => {
    const ok = await confirmAction({
      title: L('Delete supplier'),
      message: L('Delete {name}? Ledger entries stay — only the khata link and payment history go.', { name: s.name }),
      confirmLabel: L('Delete'), tone: 'danger',
    });
    if (!ok) return;
    try { await api.deleteSupplier(s._id); onChanged && onChanged(); }
    catch (err) { showAlert(err?.response?.data?.detail || 'Failed.', true); }
  };

  const addPayment = async (e) => {
    e.preventDefault();
    if (!khataOf) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { showAlert(L('Enter a valid amount.'), true); return; }
    setSaving(true);
    try {
      await api.addSupplierPayment(khataOf._id, { date: payDate, amount, note: payNote.trim() });
      setPayAmount(''); setPayNote('');
      showAlert(L('Payment saved!'));
      onChanged && onChanged();
    } catch (err) { showAlert(err?.response?.data?.detail || 'Failed to save payment.', true); }
    finally { setSaving(false); }
  };

  const openEditPayment = (paymentId) => {
    const p = payments.find((x) => x._id === paymentId);
    if (!p) return;
    setEditPay({ paymentId: p._id, date: p.date, amount: String(p.amount ?? ''), note: p.note || '' });
  };

  const updatePayment = async (e) => {
    e.preventDefault();
    if (!khataOf || !editPay) return;
    const amount = parseFloat(editPay.amount);
    if (!amount || amount <= 0) { showAlert(L('Enter a valid amount.'), true); return; }
    setSaving(true);
    try {
      await api.updateSupplierPayment(khataOf._id, editPay.paymentId, { date: editPay.date, amount, note: editPay.note.trim() });
      setEditPay(null);
      showAlert(L('Payment updated!'));
      onChanged && onChanged();
    } catch (err) { showAlert(err?.response?.data?.detail || 'Failed to update payment.', true); }
    finally { setSaving(false); }
  };

  const removePayment = async (paymentId) => {
    if (!khataOf) return;
    const payment = payments.find((x) => x._id === paymentId);
    if (!payment) return;
    try {
      await api.deleteSupplierPayment(khataOf._id, paymentId);
      onChanged && onChanged();
      notify(L('Payment deleted'), 'success', undefined, {
        label: L('Undo'),
        fn: () => {
          api.addSupplierPayment(khataOf._id, { date: payment.date, amount: payment.amount, note: payment.note || undefined })
            .then(() => { onChanged && onChanged(); })
            .catch(() => notify(L('Undo failed — add the payment again'), 'error'));
        },
      });
    } catch (err) { showAlert(err?.response?.data?.detail || 'Failed.', true); }
  };

  const ledger = useMemo(() => {
    if (!khataOf) return [];
    const events = [
      ...purchases.filter((p) => p.supplierId === khataOf._id).map((p) => ({
        date: p.date, detail: p.detail || '', purchase: p.amount || 0, payment: 0, paymentId: undefined,
      })),
      ...payments.filter((p) => p.supplier_id === khataOf._id).map((p) => ({
        date: p.date, detail: p.note || L('Payment'), purchase: 0, payment: p.amount || 0, paymentId: p._id,
      })),
    ].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    let bal = 0;
    return events.map((ev) => { bal += ev.purchase - ev.payment; return { ...ev, balance: bal }; }).reverse().slice(0, 200);
  }, [khataOf, purchases, payments]);

  const khataRow = khataOf ? rows.find((r) => r.id === khataOf._id) : null;

  return (
    <section className="muf-panel">
      <div className="muf-panel-heading">
        <div>
          <h3><Store size={21} /> {L('Supplier Khata')}</h3>
          <p>{L('Dealers you buy from on credit — tag purchases in the ledger form, record payments here.')}</p>
        </div>
        <div className="flex items-center gap-2">
          {totals.totalOwed > 0 && (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {L('To pay: Rs {v0}', { v0: totals.totalOwed.toLocaleString() })}
            </span>
          )}
          <button onClick={() => setShowAdd(true)} className="muf-primary-action">
            <Plus size={14} /> {L('Supplier')}
          </button>
        </div>
      </div>

      {/* add-supplier form lives in a muf popup (DetailModal), like every other form */}
      <DetailModal open={showAdd} onClose={() => setShowAdd(false)} title={L('Add supplier')}
        icon={<Store size={20} />} iconBg="bg-farm-100 text-farm-700" size="small">
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
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg transition cursor-pointer">{L('Cancel')}</button>
            <button type="submit" className="px-4 py-2 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-lg transition cursor-pointer">{L('Save')}</button>
          </div>
        </form>
      </DetailModal>

      {rows.length === 0 && <p className="text-xs text-slate-400 italic">{L('No suppliers yet — add your khad / beej / diesel dealer.')}</p>}
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 cursor-pointer hover:border-farm-300 dark:hover:border-farm-700 transition"
            onClick={() => { const sp = suppliers.find((x) => x._id === r.id); if (sp) { setKhataOf(sp); setPayDate(todayLocal()); } }} title={L('Open khata')}>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-700 dark:text-slate-200 truncate">{r.name}</p>
              {r.phone && <p className="text-[10px] text-slate-400">{r.phone}</p>}
            </div>
            <span className={`shrink-0 font-bold ${r.balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-farm-600 dark:text-farm-400'}`}>
              Rs {Math.abs(r.balance).toLocaleString()}{r.balance > 0 ? '' : ' ✓'}
            </span>
            <button onClick={(e) => { e.stopPropagation(); const sp = suppliers.find((x) => x._id === r.id); if (sp) { setKhataOf(sp); setPayDate(todayLocal()); } }}
              className="shrink-0 text-farm-600 hover:text-farm-700 font-bold transition cursor-pointer">{L('Khata')}</button>
            <button onClick={(e) => { e.stopPropagation(); const sp = suppliers.find((x) => x._id === r.id); if (sp) removeSupplier(sp); }}
              className="shrink-0 text-slate-300 hover:text-red-500 transition cursor-pointer"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>

      {/* ── Khata popup ── */}
      <DetailModal open={!!khataOf} onClose={() => setKhataOf(null)} title={khataOf ? `${khataOf.name} — ${L('Khata')}` : ''}
        icon={<Wallet size={20} />} iconBg="bg-farm-100 text-farm-700" size="big">
        {khataOf && khataRow && (<>
          <MufCardQr open={qrOpen} onClose={() => setQrOpen(false)} kind="supplier" id={khataOf._id} name={khataOf.name} />
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-2.5">
                <p className="text-[10px] text-slate-400 font-bold uppercase">{L('Purchased')}</p>
                <p className="font-black text-sm text-slate-700 dark:text-slate-200">Rs {khataRow.purchased.toLocaleString()}</p>
              </div>
              <div className="rounded-xl bg-farm-50 dark:bg-farm-900/10 border border-farm-200 dark:border-farm-800 p-2.5">
                <p className="text-[10px] text-farm-600 font-bold uppercase">{L('Paid')}</p>
                <p className="font-black text-sm text-farm-700 dark:text-farm-400">Rs {khataRow.paid.toLocaleString()}</p>
              </div>
              <div className={`rounded-xl p-2.5 border ${khataRow.balance > 0 ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'}`}>
                <p className={`text-[10px] font-bold uppercase ${khataRow.balance > 0 ? 'text-red-500' : 'text-slate-400'}`}>{L('Balance')}</p>
                <p className={`font-black text-sm ${khataRow.balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>Rs {khataRow.balance.toLocaleString()}</p>
              </div>
            </div>

            {khataOf.phone && (
              <button onClick={() => shareViaWhatsAppTo(khataOf.phone, supplierHisabText(khataOf.name, khataRow, FARM_SIGNATURE))}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-lg transition cursor-pointer">
                <Share2 size={14} /> {L('Send hisab on WhatsApp')}
              </button>
            )}
            <button onClick={() => setQrOpen(true)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition cursor-pointer">
              <QrCode size={14} /> {L('QR card for supplier')}
            </button>

            {editPay && (
              <form onSubmit={updatePayment} className="flex flex-wrap gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl p-3">
                <span className="w-full text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1"><Pencil size={11} /> {L('Edit payment')}</span>
                <input type="date" value={editPay.date} onChange={(e) => setEditPay({ ...editPay, date: e.target.value })} required
                  className="px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-800 text-xs outline-none" />
                <input type="number" min="1" step="any" value={editPay.amount} onChange={(e) => setEditPay({ ...editPay, amount: e.target.value })} required
                  className="flex-1 min-w-[120px] px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-800 text-xs outline-none" />
                <input value={editPay.note} onChange={(e) => setEditPay({ ...editPay, note: e.target.value })} placeholder={L('Note (optional)')}
                  className="flex-1 min-w-[120px] px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-800 text-xs outline-none" />
                <span className="flex items-center gap-2">
                  <button type="button" onClick={() => setEditPay(null)} className="px-3 py-2 border border-amber-200 dark:border-amber-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg transition cursor-pointer">{L('Cancel')}</button>
                  <button type="submit" disabled={saving} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition">
                    {saving ? '…' : L('Save changes')}
                  </button>
                </span>
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
                      <td className="py-1.5 pr-2 whitespace-nowrap text-slate-500">{row.date}</td>
                      <td className="py-1.5 pr-2 text-slate-700 dark:text-slate-300 max-w-[200px] truncate">{row.detail}</td>
                      <td className="py-1.5 pr-2 text-right text-slate-700 dark:text-slate-300">{row.purchase ? `Rs ${Math.round(row.purchase).toLocaleString()}` : ''}</td>
                      <td className="py-1.5 pr-2 text-right text-farm-600">{row.payment ? `Rs ${Math.round(row.payment).toLocaleString()}` : ''}</td>
                      <td className={`py-1.5 pr-2 text-right font-bold ${row.balance > 0 ? 'text-red-500' : 'text-slate-500'}`}>Rs {Math.round(row.balance).toLocaleString()}</td>
                      <td className="py-1.5 text-right">
                        <span className="inline-flex items-center gap-1.5">
                          {row.paymentId && (
                            <button onClick={() => openEditPayment(row.paymentId)} className="text-slate-300 hover:text-amber-500 transition cursor-pointer" title={L('Edit payment')}><Pencil size={13} /></button>
                          )}
                          {row.paymentId && (
                            <button onClick={() => removePayment(row.paymentId)} className="text-slate-300 hover:text-red-500 transition cursor-pointer"><Trash2 size={12} /></button>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {ledger.length === 0 && (
                    <tr><td colSpan={6} className="py-4 text-center text-slate-400 italic">{L('Nothing yet — tag ledger expenses with this supplier or add a payment.')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>)
        }
      </DetailModal>
    </section>
  );
}
