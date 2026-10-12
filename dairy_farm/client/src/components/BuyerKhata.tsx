import { useEffect, useMemo, useState } from 'react';
import { Wallet, FileDown, Plus, Trash2, Share2, QrCode, Pencil } from 'lucide-react';
import MufCardQr from '../muf-card-qr';
import DetailModal from '../muf-modal';
import { api } from '../api';
import { notify } from '../muf-confirm';
import type { Buyer, BuyerPayment, MilkEntry, RateHistory } from '../types';
import { fmtPKR, monthKey, monthLabel, lastNMonths } from '../utils/format';
import { todayStr } from '../utils/date';
import { getRateForDate, saleableMilkLiters } from '../utils/rates';
import { shareViaWhatsAppTo, urduMonthLabel } from '../utils/share';
import { generateBuyerStatement, type BuyerLedgerRow } from '../reportExport';
import { L } from '../i18n';

/* Buyer khata (udhaar ledger) — every milk delivery adds to the buyer's
   balance, every collected payment reduces it. Mirrors the flock farm's
   customer ledger. */

interface BuyerKhataProps {
  buyer: Buyer;
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  onFlash: (type: 'success' | 'error', text: string) => void;
}

export default function BuyerKhata({ buyer, open, onClose, isAdmin, onFlash }: BuyerKhataProps) {
  const [milk, setMilk] = useState<MilkEntry[]>([]);
  const [payments, setPayments] = useState<BuyerPayment[]>([]);
  const [rateHistory, setRateHistory] = useState<RateHistory[]>([]);
  const [rate, setRate] = useState(0);
  const [rateDate, setRateDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => monthKey(todayStr()));
  const [showPayForm, setShowPayForm] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [payDate, setPayDate] = useState(todayStr());
  const [payAmount, setPayAmount] = useState('');
  const [editPay, setEditPay] = useState<{ id: string; date: string; amount: string; note: string } | null>(null);
  const [payNote, setPayNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      api.getMilk().catch(() => []),
      api.getBuyerPayments(buyer._id).catch(() => []),
      api.getRateHistory().catch(() => []),
      api.getRate().catch(() => null),
    ]).then(([milkData, payData, histData, rateData]) => {
      setMilk((milkData as MilkEntry[]).filter((m) => m.buyerId === buyer._id));
      setPayments(payData as BuyerPayment[]);
      setRateHistory(histData as RateHistory[]);
      if (rateData) { setRate(rateData.value || 0); setRateDate(rateData.date || ''); }
    }).finally(() => setLoading(false));
  }, [open, buyer._id]);

  const chargeFor = (m: MilkEntry) => {
    const liters = saleableMilkLiters(m);
    const r = buyer.defaultRate && buyer.defaultRate > 0
      ? buyer.defaultRate
      : getRateForDate(m.date, rateHistory, rate, rateDate);
    return Math.round(liters * r * 100) / 100;
  };

  const ledger = useMemo(() => {
    type Ev = { date: string; kind: 'milk' | 'payment'; detail: string; charge: number; payment: number; id?: string };
    const events: Ev[] = [
      ...milk.map((m) => ({
        date: m.date, kind: 'milk' as const,
        detail: `${saleableMilkLiters(m).toFixed(1)} L milk`,
        charge: chargeFor(m), payment: 0,
      })),
      ...payments.map((p) => ({
        date: p.date, kind: 'payment' as const,
        detail: p.note || 'Payment collected',
        charge: 0, payment: p.amount || 0, id: p._id,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'milk' ? -1 : 1));

    let opening = 0;
    const monthRows: (BuyerLedgerRow & { id?: string })[] = [];
    let running = 0;
    for (const ev of events) {
      if (ev.date.slice(0, 7) < month) opening += ev.charge - ev.payment;
    }
    running = opening;
    for (const ev of events) {
      if (ev.date.slice(0, 7) !== month) continue;
      running += ev.charge - ev.payment;
      monthRows.push({ ...ev, balance: Math.round(running * 100) / 100 });
    }
    const charges = monthRows.reduce((a, r) => a + r.charge, 0);
    const collected = monthRows.reduce((a, r) => a + r.payment, 0);
    const totalBalance = events.reduce((a, e) => a + e.charge - e.payment, 0);
    return {
      opening: Math.round(opening * 100) / 100,
      rows: monthRows,
      charges: Math.round(charges * 100) / 100,
      collected: Math.round(collected * 100) / 100,
      closing: Math.round((opening + charges - collected) * 100) / 100,
      totalBalance: Math.round(totalBalance * 100) / 100,
    };
  }, [milk, payments, rateHistory, rate, rateDate, month, buyer.defaultRate]);

  async function handleCollect(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(payAmount);
    if (!(amount > 0)) { onFlash('error', 'Enter an amount more than 0'); return; }
    setSaving(true);
    try {
      const created = await api.addBuyerPayment(buyer._id, { date: payDate, amount, note: payNote.trim() });
      setPayments((p) => [...p, created]);
      setPayAmount(''); setPayNote(''); setShowPayForm(false);
      onFlash('success', `Payment of ${fmtPKR(amount)} saved`);
    } catch (err) {
      onFlash('error', err instanceof Error ? err.message : 'Could not save payment');
    } finally { setSaving(false); }
  }

  async function handleDeletePayment(id: string) {
    const payment = payments.find((x) => x._id === id);
    if (!payment) return;
    try {
      await api.deleteBuyerPayment(buyer._id, id);
      setPayments((p) => p.filter((x) => x._id !== id));
      notify(L('Payment deleted'), 'success', undefined, {
        label: 'Undo',
        fn: () => {
          api.addBuyerPayment(buyer._id, { date: payment.date, amount: payment.amount, note: payment.note || undefined })
            .then(() => setPayments((prev) => [...prev, payment]))
            .catch(() => notify(L('Undo failed — add the payment again'), 'error'));
        },
      });
    } catch (err) {
      onFlash('error', err instanceof Error ? err.message : 'Could not delete payment');
    }
  }

  function openEditPayment(paymentId: string) {
    const p = payments.find((x) => x._id === paymentId);
    if (!p) return;
    setEditPay({ id: p._id, date: p.date, amount: String(p.amount), note: p.note || '' });
  }

  async function handleEditPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!editPay) return;
    const amount = Number(editPay.amount);
    if (!(amount > 0)) { onFlash('error', 'Enter an amount more than 0'); return; }
    setSaving(true);
    try {
      const updated = await api.updateBuyerPayment(buyer._id, editPay.id, { date: editPay.date, amount, note: editPay.note.trim() });
      setPayments((p) => p.map((x) => (x._id === editPay.id ? { ...x, ...updated } : x)));
      setEditPay(null);
      onFlash('success', 'Payment updated');
    } catch (err) {
      onFlash('error', err instanceof Error ? err.message : 'Could not update payment');
    } finally { setSaving(false); }
  }

  const inputClass = 'w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-950 outline-none focus:border-farm-500 focus:ring-2 focus:ring-farm-500/20 transition';

  return (
    <DetailModal
      open={open}
      onClose={onClose}
      title={`${buyer.name} — Khata`}
      subtitle={buyer.phone || 'Milk udhaar ledger'}
      icon={<Wallet className="w-5 h-5 text-white" />}
      iconBg="bg-gradient-to-br from-farm-500 to-farm-700"
      size="big"
    >
      <div className="space-y-4">
        <MufCardQr open={qrOpen} onClose={() => setQrOpen(false)} kind="buyer" id={buyer._id} name={buyer.name} />
        {/* Balance strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Balance before month', value: fmtPKR(ledger.opening), tone: 'text-slate-700 dark:text-slate-200' },
            { label: 'Milk this month', value: fmtPKR(ledger.charges), tone: 'text-slate-700 dark:text-slate-200' },
            { label: 'Collected', value: fmtPKR(ledger.collected), tone: 'text-farm-600' },
            { label: 'Balance to collect', value: fmtPKR(ledger.closing), tone: ledger.closing > 0 ? 'text-red-500' : 'text-farm-600' },
          ].map((c) => (
            <div key={c.label} className="dm-card p-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{c.label}</p>
              <p className={`text-sm font-black ${c.tone}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Month picker + actions */}
        <div className="flex flex-wrap items-center gap-2">
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold bg-white dark:bg-slate-950 outline-none focus:border-farm-500 transition cursor-pointer">
            {lastNMonths(13).map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <button onClick={() => setShowPayForm((v) => !v)} className="flex items-center gap-1.5 bg-farm-600 hover:bg-farm-700 text-white px-3 py-2 rounded-xl text-xs font-semibold transition">
            <Plus className="w-3.5 h-3.5" /> {showPayForm ? 'Cancel' : 'Collect payment'}
          </button>
          <button
            onClick={() => generateBuyerStatement(buyer, month, ledger.opening, ledger.rows)}
            className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white px-3 py-2 rounded-xl text-xs font-semibold transition"
          >
            <FileDown className="w-3.5 h-3.5" /> Statement PDF
          </button>
          <button
            onClick={() => setQrOpen(true)}
            className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white px-3 py-2 rounded-xl text-xs font-semibold transition"
            title={L('QR card for this buyer')}
          >
            <QrCode className="w-3.5 h-3.5" /> QR card
          </button>
          <button
            onClick={() => {
              if (!buyer.phone) { onFlash('error', 'Add a phone number for this buyer first (Buyers tab)'); return; }
              const lines = [
                `*${buyer.name} — ${urduMonthLabel(month)}*`,
                ...(ledger.opening ? [`پچھلا بقایا: Rs ${Math.round(ledger.opening).toLocaleString()}`] : []),
                `دودھ دیا گیا: Rs ${Math.round(ledger.charges).toLocaleString()}`,
                `وصول ہوئے: Rs ${Math.round(ledger.collected).toLocaleString()}`,
                `*باقی رقم: Rs ${Math.round(ledger.closing).toLocaleString()}*`,
                '— Usman Dairy Farm',
              ];
              shareViaWhatsAppTo(buyer.phone, lines.join('\n'));
            }}
            className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1ebe5b] text-white px-3 py-2 rounded-xl text-xs font-semibold transition"
            title={L('Send this month\'s khata to the buyer on WhatsApp')}
          >
            <Share2 className="w-3.5 h-3.5" /> WhatsApp khata
          </button>
        </div>

        {showPayForm && (
          <form onSubmit={handleCollect} className="dm-card p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input type="date" required value={payDate} onChange={(e) => setPayDate(e.target.value)} className={inputClass} />
            <input type="number" min="1" step="any" required placeholder={L('Amount (Rs) *')} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className={inputClass} />
            <input placeholder={L('Note')} value={payNote} onChange={(e) => setPayNote(e.target.value)} className={inputClass} />
            <button type="submit" disabled={saving} className="sm:col-span-3 bg-farm-600 hover:bg-farm-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition">
              {saving ? 'Saving…' : 'Save payment'}
            </button>
          </form>
        )}

        {editPay && (
          <form onSubmit={handleEditPayment} className="dm-card p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input type="date" required value={editPay.date} onChange={(e) => setEditPay({ ...editPay, date: e.target.value })} className={inputClass} />
            <input type="number" min="1" step="any" required placeholder={L('Amount (Rs) *')} value={editPay.amount} onChange={(e) => setEditPay({ ...editPay, amount: e.target.value })} className={inputClass} />
            <input placeholder={L('Note')} value={editPay.note} onChange={(e) => setEditPay({ ...editPay, note: e.target.value })} className={inputClass} />
            <div className="sm:col-span-3 flex justify-end gap-2">
              <button type="button" onClick={() => setEditPay(null)} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition">{L('Cancel')}</button>
              <button type="submit" disabled={saving} className="bg-farm-600 hover:bg-farm-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-xs font-semibold transition">
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        )}

        {/* Ledger table */}
        <div className="dm-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-4 py-2.5">{L('Date')}</th>
                  <th className="px-4 py-2.5">{L('Details')}</th>
                  <th className="px-4 py-2.5 text-right">{L('Milk value')}</th>
                  <th className="px-4 py-2.5 text-right">{L('Collected')}</th>
                  <th className="px-4 py-2.5 text-right">{L('Balance')}</th>
                  {isAdmin && <th className="px-2 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                <tr className="text-xs border-b border-slate-50 dark:border-slate-800/50 bg-slate-50/60 dark:bg-slate-800/30">
                  <td className="px-4 py-2 text-slate-400" colSpan={2}>{L('Balance carried forward')}</td>
                  <td className="px-4 py-2 text-right text-slate-400">—</td>
                  <td className="px-4 py-2 text-right text-slate-400">—</td>
                  <td className="px-4 py-2 text-right font-bold text-slate-600 dark:text-slate-300">{fmtPKR(ledger.opening)}</td>
                  {isAdmin && <td />}
                </tr>
                {loading ? (
                  <tr><td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-xs text-slate-400">Loading…</td></tr>
                ) : ledger.rows.length === 0 ? (
                  <tr><td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-xs text-slate-400">{L('No entries this month')}</td></tr>
                ) : ledger.rows.map((r, i) => (
                  <tr key={i} className="text-xs border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">{r.date}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mr-1.5 ${r.kind === 'milk' ? 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300' : 'bg-farm-50 text-farm-700 dark:bg-farm-900/30 dark:text-farm-300'}`}>
                        {r.kind === 'milk' ? 'Milk' : 'Payment'}
                      </span>
                      <span className="text-slate-600 dark:text-slate-300">{r.detail}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">{r.charge ? fmtPKR(r.charge) : '—'}</td>
                    <td className="px-4 py-2.5 text-right text-farm-600 font-semibold">{r.payment ? fmtPKR(r.payment) : '—'}</td>
                    <td className={`px-4 py-2.5 text-right font-bold ${r.balance > 0 ? 'text-red-500' : 'text-farm-600'}`}>{fmtPKR(r.balance)}</td>
                    {isAdmin && (
                      <td className="px-2 py-2.5">
                        {r.kind === 'payment' && (r as { id?: string }).id && (
                          <>
                            <button onClick={() => openEditPayment((r as { id?: string }).id!)} className="p-1 rounded-lg text-farm-500 hover:text-farm-700 hover:bg-farm-50 dark:hover:bg-farm-900/20 transition" title={L('Edit payment')}>
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeletePayment((r as { id?: string }).id!)} className="p-1 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition" title={L('Delete payment')}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 text-center">
          Total balance across all months: <span className={`font-bold ${ledger.totalBalance > 0 ? 'text-red-500' : 'text-farm-600'}`}>{fmtPKR(ledger.totalBalance)}</span>
        </p>
      </div>
    </DetailModal>
  );
}
