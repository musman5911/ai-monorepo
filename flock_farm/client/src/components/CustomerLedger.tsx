import React, { useMemo, useState } from 'react';
import { shareViaWhatsAppTo, urduMonthLabel } from '../utils/share';
import { Users, Pencil, AlertTriangle, Eye, QrCode, Plus } from 'lucide-react';
import MufCardQr from '../muf-card-qr';
import { Customer, CustomerSale, EggProduction, Lang } from '../types';
import { t, L } from '../i18n';
import { customerBalance, todayStr } from '../utils/calculations';
import DetailModal from '../muf-modal';
import { useConfirm, notify } from '../muf-confirm';

interface CustomerLedgerProps {
  lang: Lang;
  customers: Customer[];
  sales: CustomerSale[];
  eggProduction: EggProduction[];
  defaultPricePerEgg: number;
  onAddCustomer: (c: Omit<Customer, 'id'>) => void;
  onUpdateCustomer: (id: number, c: Customer) => void;
  onDeleteCustomer: (id: number) => void;
  onAddSale: (s: Omit<CustomerSale, 'id'>) => void;
  onUpdateSale: (id: number, s: CustomerSale) => void;
  onDeleteSale: (id: number) => void;
  canDelete: boolean;
  /** Can add/edit/delete customers (admin only). */
  canManageCustomers?: boolean;
  /** Can log/edit sales (admin + worker). Defaults to true if canDelete is true. */
  canLogSales?: boolean;
}

export default function CustomerLedger({
  lang,
  customers,
  sales,
  eggProduction,
  defaultPricePerEgg,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  onAddSale,
  onUpdateSale,
  onDeleteSale,
  canDelete,
  canManageCustomers,
  canLogSales,
}: CustomerLedgerProps) {
  const confirmAction = useConfirm();
  const manageCust = canManageCustomers ?? canDelete;
  const logSales = canLogSales ?? true;
  const [showRateShare, setShowRateShare] = useState(false);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [editCustId, setEditCustId] = useState<number | null>(null);

  const [saleDate, setSaleDate] = useState(todayStr());
  const [saleCustomerId, setSaleCustomerId] = useState('');
  const [saleEggs, setSaleEggs] = useState('');
  const [salePrice, setSalePrice] = useState(String(defaultPricePerEgg));
  const [salePaid, setSalePaid] = useState('');
  const [editSaleId, setEditSaleId] = useState<number | null>(null);

  const [activeCustomerId, setActiveCustomerId] = useState<number | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [activeSaleId, setActiveSaleId] = useState<number | null>(null);
  const [showAddCustModal, setShowAddCustModal] = useState(false);
  const [showLogSaleModal, setShowLogSaleModal] = useState(false);

  const eggRecordForSaleDate = useMemo(
    () => eggProduction.find((entry) => entry.date === saleDate) || null,
    [eggProduction, saleDate]
  );

  const customerEggsForDate = (date: string, exceptId?: number | null) =>
    sales
      .filter((sale) => sale.date === date && sale.id !== exceptId)
      .reduce((sum, sale) => sum + (sale.eggsQty || 0), 0);

  const handleCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim()) return;
    const data = {
      name: custName.trim(),
      phone: custPhone.trim() || undefined,
      email: custEmail.trim() || undefined,
    };
    if (editCustId) {
      onUpdateCustomer(editCustId, { id: editCustId, ...data });
      resetCustomerEdit();
    } else {
      onAddCustomer(data);
      setCustName('');
      setCustPhone('');
      setCustEmail('');
      setShowAddCustModal(false);
    }
  };

  const handleSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cid = parseInt(saleCustomerId);
    const qty = parseInt(saleEggs);
    const price = parseFloat(salePrice);
    const paid = parseFloat(salePaid) || 0;
    if (!cid || !qty || qty <= 0 || !price || price <= 0) return notify(L('Fill all sale fields'), 'error');
    if (paid < 0) return notify(L('Amount paid cannot be negative'), 'error');
    const total = qty * price;
    if (paid > total) {
      const ok = await confirmAction({
        title: L('Overpayment Confirmation'),
        message: `Amount paid (Rs ${paid}) exceeds sale total (Rs ${total}). This will record an advance/overpayment. Continue?`,
        confirmLabel: L('Continue'),
        cancelLabel: L('Cancel'),
        tone: 'warning',
      });
      if (!ok) {
        return;
      }
    }

    const sameDayCustomerEggs = customerEggsForDate(saleDate, editSaleId);
    const eggRecord = eggProduction.find((entry) => entry.date === saleDate) || null;
    if (!eggRecord) {
      const ok = await confirmAction({
        title: L('No Egg Record Found'),
        message: `No daily egg record exists for ${saleDate}. Save this customer sale anyway? (Recommended: also log that day's egg collection and keep direct/cash sales separate from customer sales.)`,
        confirmLabel: L('Save Anyway'),
        cancelLabel: L('Cancel'),
        tone: 'warning',
      });
      if (!ok) {
        return;
      }
    } else {
      const totalAllocated = (eggRecord.sold || 0) + (eggRecord.homeUse || 0) + (eggRecord.brokenWasted || 0) + sameDayCustomerEggs + qty;
      if (totalAllocated > eggRecord.totalEggsCollected) {
        return notify(
          `This customer sale would over-allocate eggs for ${saleDate}.\n\n` +
          `Collected: ${eggRecord.totalEggsCollected}\n` +
          `Direct/Cash sold: ${eggRecord.sold || 0}\n` +
          `Customer sales (existing): ${sameDayCustomerEggs}\n` +
          `This sale: ${qty}\n` +
          `Home use: ${eggRecord.homeUse || 0}\n` +
          `Broken: ${eggRecord.brokenWasted || 0}\n\n` +
          `Please reduce the sale quantity or update the egg record first.`
        , 'error');
      }
    }

    const data = {
      customerId: cid,
      date: saleDate,
      eggsQty: qty,
      pricePerEgg: price,
      amountPaid: paid,
    };
    if (editSaleId) {
      onUpdateSale(editSaleId, { id: editSaleId, ...data });
      resetSaleEdit();
    } else {
      onAddSale(data);
      setSaleCustomerId('');
      setSaleEggs('');
      setSalePrice(String(defaultPricePerEgg));
      setSalePaid('');
      setShowLogSaleModal(false);
    }
  };

  const getCustomerSales = (id: number) => sales.filter((s) => s.customerId === id);
  const balance = (id: number) => customerBalance(getCustomerSales(id));

  const sortedRecentSales = useMemo(
    () => [...sales].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10),
    [sales],
  );

  const activeCustomer = useMemo(
    () => customers.find((customer) => customer.id === activeCustomerId) || null,
    [customers, activeCustomerId],
  );
  const activeCustomerSales = useMemo(
    () => (activeCustomer ? [...getCustomerSales(activeCustomer.id)].sort((a, b) => b.date.localeCompare(a.date)) : []),
    [activeCustomer, sales],
  );
  const activeSale = useMemo(
    () => sales.find((sale) => sale.id === activeSaleId) || null,
    [sales, activeSaleId],
  );
  const activeSaleCustomer = useMemo(
    () => (activeSale ? customers.find((customer) => customer.id === activeSale.customerId) || null : null),
    [customers, activeSale],
  );

  const resetCustomerEdit = () => {
    setEditCustId(null);
    setCustName('');
    setCustPhone('');
    setCustEmail('');
  };

  const resetSaleEdit = () => {
    setEditSaleId(null);
    setSaleDate(todayStr());
    setSaleCustomerId('');
    setSaleEggs('');
    setSalePrice(String(defaultPricePerEgg));
    setSalePaid('');
  };

  const openCustomerDetail = (customer: Customer) => setActiveCustomerId(customer.id);
  const openSaleDetail = (sale: CustomerSale) => setActiveSaleId(sale.id);

  const handleDeleteCustomerFromDetail = async (customer: Customer) => {
    const ok = await confirmAction({
      title: L('Delete Customer'),
      message: L('Delete this customer from the active list? Their past sales history will remain.'),
      confirmLabel: L('Delete Customer'),
      cancelLabel: L('Cancel'),
      tone: 'danger',
    });
    if (!ok) return;
    setActiveCustomerId(null);
    onDeleteCustomer(customer.id);
  };

  const handleDeleteSaleFromDetail = async (sale: CustomerSale) => {
    const ok = await confirmAction({
      title: L('Delete Sale'),
      message: L('Delete this customer sale entry?'),
      confirmLabel: L('Delete Sale'),
      cancelLabel: L('Cancel'),
      tone: 'danger',
    });
    if (!ok) return;
    setActiveSaleId(null);
    onDeleteSale(sale.id);
    if (editSaleId === sale.id) resetSaleEdit();
  };

  return (
    <div className="space-y-6">
      <div className="muf-page-hero">
        <div className="muf-page-title">
          <div className="muf-title-icon"><Users size={28}/></div>
          <div>
            <h2>{t(lang, 'customers')}</h2>
            <p>{L('Track buyers, egg sales, and outstanding balances.')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {manageCust && (
            <button type="button" onClick={() => { resetCustomerEdit(); setShowAddCustModal(true); }} className="muf-primary-action">
              <Plus size={18}/> {t(lang, 'add')} Customer
            </button>
          )}
          {logSales && (
            <button type="button" onClick={() => { resetSaleEdit(); setShowLogSaleModal(true); }} className="px-4 py-2 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition">
              <Plus size={16}/> Log Sale
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {!manageCust && !logSales && (
          <div className="lg:col-span-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 text-center">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{L('Read-only view.')}</p>
          </div>
        )}
      </div>

      {/* Manual rate alert — send the current egg rate to customers on WhatsApp (Urdu). Admin only. */}
      {manageCust && (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
        <button
          type="button"
          onClick={() => setShowRateShare((v) => !v)}
          className="text-xs font-bold transition"
          style={{ color: '#25D366' }}
        >💬 {showRateShare
          ? (L('Hide'))
          : (L('Send egg rate to customers on WhatsApp'))}</button>
        {showRateShare && (
          <div className="space-y-1.5 max-h-44 overflow-y-auto">
            <p className="text-[11px] text-slate-500">
              {L('Current rate: Rs {defaultPricePerEgg} per egg', { defaultPricePerEgg: defaultPricePerEgg })}
            </p>
            {customers.length === 0 && <p className="text-xs text-slate-400">{L('No customers yet.')}</p>}
            {customers.map((customer) => {
              const msg = [
                'السلام علیکم!',
                '*انڈوں کا نیا ریٹ*',
                `آج (${todayStr()}) سے انڈوں کا ریٹ *Rs ${defaultPricePerEgg} فی انڈہ* ہے۔`,
                '',
                '— Usman Flock Farm',
              ].join('\n');
              return (
                <div key={customer.id} className="flex items-center justify-between gap-2 text-xs p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                  <span className="text-slate-700 dark:text-slate-200 font-medium truncate">
                    {customer.name} <span className="text-slate-400 font-normal">{customer.phone || (L('no phone'))}</span>
                  </span>
                  <button
                    type="button"
                    disabled={!customer.phone}
                    onClick={() => shareViaWhatsAppTo(customer.phone!, msg)}
                    className="shrink-0 px-2.5 py-1 rounded-lg text-white text-[11px] font-bold disabled:opacity-40 transition"
                    style={{ backgroundColor: '#25D366' }}
                  >{L('Send')}</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800 text-3xs uppercase text-slate-500">
              <th className="p-3">{L('Customer')}</th>
              <th className="p-3">{L('Contact')}</th>
              <th className="p-3 text-right">{L('Balance Due')}</th>
              <th className="p-3 sm:hidden text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {customers.map((customer) => {
              const bal = balance(customer.id);
              return (
                <tr
                  key={customer.id}
                  className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  onClick={() => openCustomerDetail(customer)}
                  title={L('View customer details')}
                >
                  <td className="p-3 font-semibold">{customer.name}</td>
                  <td className="p-3 text-slate-500">{customer.phone || customer.email || '—'}</td>
                  <td className={`p-3 text-right font-mono font-bold ${bal > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    Rs {bal.toLocaleString()}
                  </td>
                  <td className="p-3 sm:hidden text-right text-slate-400"><Eye className="w-4 h-4 inline-block" /></td>
                </tr>
              );
            })}
            {customers.length === 0 && (
              <tr><td colSpan={4} className="p-8 text-center text-slate-400 italic">{L('No customers yet')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {sales.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border overflow-hidden">
          <h4 className="p-3 font-bold text-sm border-b">{L('Recent Sales')}</h4>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-3xs uppercase text-slate-500">
                <th className="p-3">{L('Date')}</th>
                <th className="p-3">{L('Customer')}</th>
                <th className="p-3">{L('Eggs')}</th>
                <th className="p-3 text-right">{L('Total')}</th>
                <th className="p-3 sm:hidden text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedRecentSales.map((sale) => {
                const customer = customers.find((c) => c.id === sale.customerId);
                return (
                  <tr
                    key={sale.id}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    onClick={() => openSaleDetail(sale)}
                    title={L('View sale details')}
                  >
                    <td className="p-3 font-mono">{sale.date}</td>
                    <td className="p-3">{customer?.name ?? '—'}</td>
                    <td className="p-3">{sale.eggsQty}</td>
                    <td className="p-3 text-right font-mono">Rs {(sale.eggsQty * sale.pricePerEgg).toLocaleString()}</td>
                    <td className="p-3 sm:hidden text-right text-slate-400"><Eye className="w-4 h-4 inline-block" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <DetailModal
        open={!!activeCustomer}
        onClose={() => setActiveCustomerId(null)}
        title={L('Customer Details')}
        subtitle={activeCustomer?.name}
        icon={<Users className="w-5 h-5" />}
        iconBg="bg-indigo-100 text-indigo-700"
        size="small"
      >
        {activeCustomer && (() => {
          const customerSalesList = activeCustomerSales;
          const totalEggs = customerSalesList.reduce((sum, sale) => sum + (sale.eggsQty || 0), 0);
          const totalValue = customerSalesList.reduce((sum, sale) => sum + (sale.eggsQty || 0) * (sale.pricePerEgg || 0), 0);
          const totalPaid = customerSalesList.reduce((sum, sale) => sum + (sale.amountPaid || 0), 0);
          const balanceDue = totalValue - totalPaid;
          return (
            <div className="space-y-4 text-sm">
              <MufCardQr open={qrOpen} onClose={() => setQrOpen(false)} kind="customer" id={activeCustomer.id} name={activeCustomer.name} />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <CustomerDetailTile label="Sales" value={`${customerSalesList.length}`} />
                <CustomerDetailTile label="Eggs Bought" value={`${totalEggs}`} />
                <CustomerDetailTile label="Paid" value={`Rs ${totalPaid.toLocaleString()}`} />
                <CustomerDetailTile label="Balance" value={`Rs ${balanceDue.toLocaleString()}`} />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
                <CustomerDetailRow label={L('Name')} value={activeCustomer.name} />
                <CustomerDetailRow label={L('Phone')} value={activeCustomer.phone || '—'} />
                <CustomerDetailRow label={L('Email')} value={activeCustomer.email || '—'} />
              </div>

              <button
                type="button"
                onClick={() => setQrOpen(true)}
                className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" /> {L('QR card for customer')}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!activeCustomer.phone) { notify(L('Add a phone number for this customer first'), 'error'); return; }
                  const mk = todayStr().slice(0, 7);
                  const monthSales = customerSalesList.filter((x) => String(x.date || '').startsWith(mk));
                  const mEggs = monthSales.reduce((a, x) => a + (x.eggsQty || 0), 0);
                  const mValue = monthSales.reduce((a, x) => a + (x.eggsQty || 0) * (x.pricePerEgg || 0), 0);
                  const mPaid = monthSales.reduce((a, x) => a + (x.amountPaid || 0), 0);
                  const lines = [
                    `*${activeCustomer.name} — ${urduMonthLabel(mk)}*`,
                    `انڈے دیے گئے: ${mEggs.toLocaleString()} (Rs ${Math.round(mValue).toLocaleString()})`,
                    `وصول ہوئے: Rs ${Math.round(mPaid).toLocaleString()}`,
                    `*کل باقی رقم: Rs ${Math.round(balanceDue).toLocaleString()}*`,
                    '— Usman Flock Farm',
                  ];
                  shareViaWhatsAppTo(activeCustomer.phone, lines.join('\n'));
                }}
                className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5b] text-white px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                💬 {L('Send khata on WhatsApp')}
              </button>

              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h4 className="text-sm font-bold text-slate-800">{L('Sales History')}</h4>
                </div>
                {customerSalesList.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-slate-400">{L('No sales recorded for this customer yet.')}</div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                    {customerSalesList.map((sale) => {
                      const total = (sale.eggsQty || 0) * (sale.pricePerEgg || 0);
                      const due = total - (sale.amountPaid || 0);
                      return (
                        <button
                          key={sale.id}
                          type="button"
                          onClick={() => setActiveSaleId(sale.id)}
                          className="w-full px-4 py-3 text-left hover:bg-slate-50"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-800">{sale.eggsQty} eggs @ Rs {sale.pricePerEgg}</p>
                              <p className="text-xs text-slate-500 font-mono mt-0.5">{sale.date}</p>
                            </div>
                            <div className="text-right text-xs">
                              <p className="font-mono font-bold text-emerald-700">Rs {total.toLocaleString()}</p>
                              <p className="text-slate-400">Due: Rs {due.toLocaleString()}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {(manageCust || canDelete) && (
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomerFromDetail(activeCustomer)}
                      className="muf-btn muf-btn-danger"
                    >
                      {L('Delete Customer')}
                    </button>
                  )}
                  {manageCust && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditCustId(activeCustomer.id);
                        setCustName(activeCustomer.name);
                        setCustPhone(activeCustomer.phone ?? '');
                        setCustEmail(activeCustomer.email ?? '');
                      }}
                      className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700"
                    >
                      {L('Edit Customer')}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </DetailModal>

      <DetailModal
        open={!!activeSale}
        onClose={() => setActiveSaleId(null)}
        title={L('Sale Details')}
        subtitle={activeSaleCustomer?.name}
        icon={<AlertTriangle className="w-5 h-5" />}
        iconBg="bg-emerald-100 text-emerald-700"
        size="small"
      >
        {activeSale && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <CustomerDetailTile label={L('Date')} value={activeSale.date} />
              <CustomerDetailTile label="Customer" value={activeSaleCustomer?.name || `#${activeSale.customerId}`} />
              <CustomerDetailTile label="Eggs" value={`${activeSale.eggsQty}`} />
              <CustomerDetailTile label="Price/Egg" value={`Rs ${activeSale.pricePerEgg.toLocaleString()}`} />
              <CustomerDetailTile label="Total" value={`Rs ${(activeSale.eggsQty * activeSale.pricePerEgg).toLocaleString()}`} />
              <CustomerDetailTile label="Paid" value={`Rs ${activeSale.amountPaid.toLocaleString()}`} />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{L('Balance Due')}</p>
              <p className="mt-1 text-lg font-bold font-mono text-slate-800">Rs {((activeSale.eggsQty * activeSale.pricePerEgg) - activeSale.amountPaid).toLocaleString()}</p>
            </div>
            <div className="rounded-xl border px-3 py-2 text-[11px] bg-amber-50 border-amber-200 text-amber-800">
              Customer sales stay separate from the daily egg “Sold” field.
            </div>
            {(logSales || canDelete) && (
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDeleteSaleFromDetail(activeSale)}
                    className="muf-btn muf-btn-danger"
                  >
                    {L('Delete Sale')}
                  </button>
                )}
                {logSales && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditSaleId(activeSale.id);
                      setSaleDate(activeSale.date);
                      setSaleCustomerId(String(activeSale.customerId));
                      setSaleEggs(String(activeSale.eggsQty));
                      setSalePrice(String(activeSale.pricePerEgg));
                      setSalePaid(String(activeSale.amountPaid));
                    }}
                    className="px-4 py-2 rounded-xl bg-green-700 text-white font-semibold text-xs hover:bg-green-800"
                  >
                    {L('Edit Sale')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </DetailModal>

      <DetailModal open={editCustId !== null} onClose={resetCustomerEdit} title={L('Edit Customer')} icon={<Pencil className="w-5 h-5" />} iconBg="bg-indigo-100 text-indigo-700" size="small">
        <form onSubmit={handleCustomerSubmit} className="space-y-3 text-xs">
          <input required placeholder={L('Name')} value={custName} onChange={(e) => setCustName(e.target.value)} className="muf-field" />
          <input placeholder={L('Phone')} value={custPhone} onChange={(e) => setCustPhone(e.target.value)} className="muf-field" />
          <input placeholder={L('Email')} value={custEmail} onChange={(e) => setCustEmail(e.target.value)} className="muf-field" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={resetCustomerEdit} className="px-4 py-2 border rounded-xl dark:border-slate-700 dark:text-slate-100">{t(lang, 'cancel')}</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700">{t(lang, 'save')}</button>
          </div>
        </form>
      </DetailModal>

      <DetailModal open={editSaleId !== null} onClose={resetSaleEdit} title={L('Edit Sale')} icon={<Pencil className="w-5 h-5" />} iconBg="bg-green-100 text-green-700" size="small">
        <form onSubmit={handleSaleSubmit} className="space-y-3 text-xs">
          <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} className="muf-field" />
          <div className={`rounded-xl border px-3 py-2 text-[11px] ${eggRecordForSaleDate ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300' : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300'}`}>
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Keep customer sales separate from the daily egg "Sold" field.</p>
                {eggRecordForSaleDate ? (
                  <p>Egg log for {saleDate}: {eggRecordForSaleDate.totalEggsCollected} collected · {eggRecordForSaleDate.sold || 0} direct/cash sold · {customerEggsForDate(saleDate, editSaleId)} customer eggs already logged.</p>
                ) : (
                  <p>No egg record exists for this date yet. Add one in Egg Production for better stock accuracy.</p>
                )}
              </div>
            </div>
          </div>
          <select required value={saleCustomerId} onChange={(e) => setSaleCustomerId(e.target.value)} className="muf-field">
            <option value="">{L('Select customer')}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <input type="number" min="1" placeholder={L('Eggs')} value={saleEggs} onChange={(e) => setSaleEggs(e.target.value)} className="px-2 py-2 border rounded-xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
            <input type="number" step="0.1" placeholder={L('Rs/egg')} value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className="px-2 py-2 border rounded-xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
            <input type="number" placeholder={L('Paid')} value={salePaid} onChange={(e) => setSalePaid(e.target.value)} className="px-2 py-2 border rounded-xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={resetSaleEdit} className="px-4 py-2 border rounded-xl dark:border-slate-700 dark:text-slate-100">{t(lang, 'cancel')}</button>
            <button type="submit" className="px-4 py-2 bg-green-700 text-white rounded-xl font-semibold hover:bg-green-800">{t(lang, 'save')}</button>
          </div>
        </form>
      </DetailModal>

      {/* ── Add Customer (popup) ───────────────── */}
      <DetailModal open={showAddCustModal} onClose={() => setShowAddCustModal(false)}
        title={`${t(lang, 'add')} Customer`} icon={<Users className="w-5 h-5" />} iconBg="bg-indigo-100 text-indigo-700" size="small">
        <form onSubmit={handleCustomerSubmit} className="space-y-3 text-xs">
          <div>
            <label className="muf-label">Name *</label>
            <input required placeholder={L('Name')} value={custName} onChange={(e) => setCustName(e.target.value)} className="muf-field" />
          </div>
          <div>
            <label className="muf-label">{L('Phone')}</label>
            <input placeholder={L('Phone')} value={custPhone} onChange={(e) => setCustPhone(e.target.value)} className="muf-field" />
          </div>
          <div>
            <label className="muf-label">{L('Email')}</label>
            <input placeholder={L('Email')} value={custEmail} onChange={(e) => setCustEmail(e.target.value)} className="muf-field" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowAddCustModal(false)} className="px-4 py-2 border rounded-xl dark:border-slate-700 dark:text-slate-100">{t(lang, 'cancel')}</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 flex items-center gap-1.5"><Plus size={14}/> {t(lang, 'save')}</button>
          </div>
        </form>
      </DetailModal>

      {/* ── Log Sale (popup) ───────────────────── */}
      <DetailModal open={showLogSaleModal} onClose={() => setShowLogSaleModal(false)}
        title={L('Log Sale')} icon={<AlertTriangle className="w-5 h-5" />} iconBg="bg-emerald-100 text-emerald-700" size="big">
        <form onSubmit={handleSaleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="muf-label">{L('Date')}</label>
            <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} className="muf-field" />
          </div>
          <div className={`rounded-xl border px-3 py-2 text-[11px] ${eggRecordForSaleDate ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300' : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300'}`}>
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Keep customer sales separate from the daily egg "Sold" field.</p>
                {eggRecordForSaleDate ? (
                  <p>
                    Egg log for {saleDate}: {eggRecordForSaleDate.totalEggsCollected} collected · {eggRecordForSaleDate.sold || 0} direct/cash sold · {customerEggsForDate(saleDate, editSaleId)} customer eggs already logged.
                  </p>
                ) : (
                  <p>No egg record exists for this date yet. Add one in Egg Production for better stock accuracy.</p>
                )}
              </div>
            </div>
          </div>
          <div>
            <label className="muf-label">Customer *</label>
            <select required value={saleCustomerId} onChange={(e) => setSaleCustomerId(e.target.value)} className="muf-field">
              <option value="">{L('Select customer')}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="muf-label">Eggs *</label>
              <input type="number" min="1" placeholder={L('Eggs')} value={saleEggs} onChange={(e) => setSaleEggs(e.target.value)} className="w-full px-2 py-2 border rounded-xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
            </div>
            <div>
              <label className="muf-label">Rs/egg *</label>
              <input type="number" step="0.1" placeholder={L('Rs/egg')} value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className="w-full px-2 py-2 border rounded-xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
            </div>
            <div>
              <label className="muf-label">{L('Paid')}</label>
              <input type="number" placeholder={L('Paid')} value={salePaid} onChange={(e) => setSalePaid(e.target.value)} className="w-full px-2 py-2 border rounded-xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowLogSaleModal(false)} className="px-4 py-2 border rounded-xl dark:border-slate-700 dark:text-slate-100">{t(lang, 'cancel')}</button>
            <button type="submit" className="px-4 py-2 bg-green-700 text-white rounded-xl font-semibold hover:bg-green-800 flex items-center gap-1.5"><Plus size={14}/> {t(lang, 'save')}</button>
          </div>
        </form>
      </DetailModal>
    </div>
  );
}

function CustomerDetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold font-mono text-slate-800">{value}</p>
    </div>
  );
}

function CustomerDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="text-slate-800">{value}</span>
    </div>
  );
}
