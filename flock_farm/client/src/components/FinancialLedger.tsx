import React, { useEffect, useMemo, useState } from 'react';
import { L } from '../i18n';
import {
  Plus,
  Pencil,
  Egg,
  ShoppingBag,
  Coins,
  Search,
  Eye,
  DollarSign,
} from 'lucide-react';
import { Bird, Customer, CustomerSale, EggProduction, ExpenseCategory, FeedRecord, FeedType, GlobalSettings, Lang, OtherExpense, Supplier, VaccinationRecord } from '../types';
import { loadData } from '../api';
import { todayStr } from '../utils/calculations';
import DetailModal from '../muf-modal';
import { compressToAvatar } from '../muf-avatar';
import { useConfirm, notify } from '../muf-confirm';
import CustomerLedger from './CustomerLedger';
import SupplierLedger from './SupplierLedger';
import { useLedgerTotals } from './ledger/useLedgerTotals';

interface FinancialLedgerProps {
  birds: Bird[];
  vaccinations: VaccinationRecord[];
  customers: Customer[];
  feedRecords: FeedRecord[];
  otherExpenses: OtherExpense[];
  eggProduction: EggProduction[];
  customerSales: CustomerSale[];
  settings: GlobalSettings;
  onAddFeedRecord: (record: Omit<FeedRecord, 'id'>) => void;
  onUpdateFeedRecord: (id: number, record: FeedRecord) => void;
  onDeleteFeedRecord: (id: number) => void;
  onAddOtherExpense: (expense: Omit<OtherExpense, 'id'>) => void;
  onUpdateOtherExpense: (id: number, expense: OtherExpense) => void;
  onDeleteOtherExpense: (id: number) => void;
  onAddEggRecord: (record: EggProduction) => void;
  onUpdateEggRecord: (date: string, record: EggProduction) => void;
  onDeleteEggRecord: (date: string) => void;
  onAddCustomer: (customer: Omit<Customer, 'id'>) => void;
  onUpdateCustomer: (id: number, customer: Customer) => void;
  onDeleteCustomer: (id: number) => void;
  onAddCustomerSale: (sale: Omit<CustomerSale, 'id'>) => void;
  onUpdateCustomerSale: (id: number, sale: CustomerSale) => void;
  onDeleteCustomerSale: (id: number) => void;
  onUpdateBird: (id: number, bird: Bird) => void;
  onAddVaccination: (record: Omit<VaccinationRecord, 'id'>) => void;
  onUpdateVaccination: (id: number, v: Omit<VaccinationRecord, 'id'>) => void;
  onDeleteVaccination: (id: number) => void;
  quickOpenTab: 'feed' | 'expense' | 'egg' | 'customers' | null;
  onResetQuickOpenTab: () => void;
  isAdmin?: boolean;
  canDelete?: boolean;
  canManageCustomers?: boolean;
  canLogSales?: boolean;
  lang?: Lang;
}

export default function FinancialLedger({
  birds,
  vaccinations,
  customers,
  feedRecords,
  otherExpenses,
  eggProduction,
  customerSales,
  settings,
  onAddFeedRecord,
  onUpdateFeedRecord,
  onDeleteFeedRecord,
  onAddOtherExpense,
  onUpdateOtherExpense,
  onDeleteOtherExpense,
  onAddEggRecord,
  onUpdateEggRecord,
  onDeleteEggRecord,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  onAddCustomerSale,
  onUpdateCustomerSale,
  onDeleteCustomerSale,
  onUpdateBird,
  onAddVaccination,
  onUpdateVaccination,
  onDeleteVaccination,
  quickOpenTab,
  onResetQuickOpenTab,
  isAdmin = true,
  canDelete = true,
  canManageCustomers = false,
  canLogSales = true,
  lang = 'en',
}: FinancialLedgerProps) {
  const confirmAction = useConfirm();
  // Main Sub-tabs
  const [activeSubTab, setActiveSubTab] = useState<'feed' | 'expense' | 'egg' | 'customers' | 'suppliers'>('feed');
  // Supplier khata: list shared with the feed/expense forms' dropdowns.
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  useEffect(() => {
    loadData<Supplier[]>('suppliers', []).then(setSuppliers).catch(() => setSuppliers([]));
  }, []);

  // Sync quickOpenTab prop from parent (e.g. Dashboard quick actions)
  useEffect(() => {
    if (quickOpenTab) {
      if (quickOpenTab === 'feed') setActiveSubTab('feed');
      if (quickOpenTab === 'expense') setActiveSubTab('expense');
      if (quickOpenTab === 'egg') setActiveSubTab('egg');
      if (quickOpenTab === 'customers') setActiveSubTab('customers');
      onResetQuickOpenTab();
    }
  }, [quickOpenTab, onResetQuickOpenTab]);

  // Form states - Feed
  const [feedDate, setFeedDate] = useState(todayStr());
  const [feedType, setFeedType] = useState<FeedType>('Khal & Choker');
  const [feedQty, setFeedQty] = useState('');
  const [feedRate, setFeedRate] = useState('');
  const [feedNotes, setFeedNotes] = useState('');
  const [feedSupplier, setFeedSupplier] = useState('');

  // Form states - Expense
  const [expDate, setExpDate] = useState(todayStr());
  const [expDetail, setExpDetail] = useState('');
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('Medicine');
  const [expAmount, setExpAmount] = useState('');
  const [expNotes, setExpNotes] = useState('');
  const [expSupplier, setExpSupplier] = useState('');
  const [expReceipt, setExpReceipt] = useState('');
  const [viewReceipt, setViewReceipt] = useState<string | null>(null);

  // Form states - Egg
  const [eggDate, setEggDate] = useState(todayStr());
  const [eggsCollected, setEggsCollected] = useState('');
  const [eggsSold, setEggsSold] = useState('');
  const [eggsHomeUse, setEggsHomeUse] = useState('');
  const [eggsBroken, setEggsBroken] = useState('');

  // Search terms for filters
  const [feedSearch, setFeedSearch] = useState('');
  const [expenseSearch, setExpenseSearch] = useState('');
  const [eggSearch, setEggSearch] = useState('');

  // Which record (if any) is currently being edited in each form
  const [editingFeedId, setEditingFeedId] = useState<number | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [editingEggDate, setEditingEggDate] = useState<string | null>(null);
  const [addModal, setAddModal] = useState<null | 'feed' | 'expense' | 'egg'>(null);

  // Compact-list detail popups
  const [activeFeedDetailId, setActiveFeedDetailId] = useState<number | null>(null);
  const [activeExpenseDetailId, setActiveExpenseDetailId] = useState<number | null>(null);
  const [activeEggDetailDate, setActiveEggDetailDate] = useState<string | null>(null);

  const customerEggsOnDate = (date: string) =>
    customerSales
      .filter((sale) => sale.date === date)
      .reduce((sum, sale) => sum + (sale.eggsQty || 0), 0);

  const activeFeedDetail = useMemo(
    () => feedRecords.find((record) => record.id === activeFeedDetailId) || null,
    [feedRecords, activeFeedDetailId],
  );
  const activeExpenseDetail = useMemo(
    () => otherExpenses.find((record) => record.id === activeExpenseDetailId) || null,
    [otherExpenses, activeExpenseDetailId],
  );
  const activeEggDetail = useMemo(
    () => eggProduction.find((record) => record.date === activeEggDetailDate) || null,
    [eggProduction, activeEggDetailDate],
  );

  const startEditFeed = (record: FeedRecord) => {
    setEditingFeedId(record.id);
    setFeedDate(record.date);
    setFeedType(record.feedType);
    setFeedQty(String(record.quantityKg));
    setFeedRate(String(record.rateRsPerKg));
    setFeedNotes(record.notes || '');
    setFeedSupplier(record.supplierId !== undefined && record.supplierId !== null ? String(record.supplierId) : '');
  };
  const cancelEditFeed = () => {
    setEditingFeedId(null);
    setFeedQty('');
    setFeedRate('');
    setFeedNotes('');
  };

  const startEditExpense = (record: OtherExpense) => {
    setEditingExpenseId(record.id);
    setExpDate(record.date);
    setExpDetail(record.detail);
    setExpCategory(record.category);
    setExpAmount(String(record.amount));
    setExpNotes(record.notes || '');
    setExpReceipt(record.receiptBase64 || '');
    setExpSupplier(record.supplierId !== undefined && record.supplierId !== null ? String(record.supplierId) : '');
  };
  const cancelEditExpense = () => {
    setEditingExpenseId(null);
    setExpDetail('');
    setExpAmount('');
    setExpNotes('');
    setExpReceipt('');
    setExpSupplier('');
  };

  const startEditEgg = (record: EggProduction) => {
    setEditingEggDate(record.date);
    setEggDate(record.date);
    setEggsCollected(String(record.totalEggsCollected));
    setEggsSold(String(record.sold));
    setEggsHomeUse(String(record.homeUse));
    setEggsBroken(String(record.brokenWasted));
  };
  const cancelEditEgg = () => {
    setEditingEggDate(null);
    setEggsCollected('');
    setEggsSold('');
    setEggsHomeUse('');
    setEggsBroken('');
  };

  const openFeedDetail = (record: FeedRecord) => setActiveFeedDetailId(record.id);
  const openExpenseDetail = (record: OtherExpense) => setActiveExpenseDetailId(record.id);
  const openEggDetail = (record: EggProduction) => setActiveEggDetailDate(record.date);

  const handleDeleteFeedFromDetail = async (record: FeedRecord) => {
    const ok = await confirmAction({
      title: 'Delete Feed Record',
      message: 'Delete this feed record?',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    setActiveFeedDetailId(null);
    onDeleteFeedRecord(record.id);
  };

  const handleDeleteExpenseFromDetail = async (record: OtherExpense) => {
    const ok = await confirmAction({
      title: 'Delete Expense Record',
      message: 'Delete this operating expense record?',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    setActiveExpenseDetailId(null);
    onDeleteOtherExpense(record.id);
  };

  const handleDeleteEggFromDetail = async (record: EggProduction) => {
    const ok = await confirmAction({
      title: 'Delete Egg Record',
      message: 'Delete this egg collection record?',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    setActiveEggDetailDate(null);
    onDeleteEggRecord(record.date);
  };

  // Submit Feed Record
  const handleFeedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(feedQty);
    const rate = parseFloat(feedRate);
    if (!qty || qty <= 0 || !rate || rate <= 0) {
      return notify('Please enter valid quantity and rate', 'error');
    }
    const payload = {
      date: feedDate,
      feedType,
      quantityKg: qty,
      rateRsPerKg: rate,
      notes: feedNotes.trim() || undefined,
      supplierId: feedSupplier || undefined
    };
    if (editingFeedId !== null) {
      onUpdateFeedRecord(editingFeedId, { ...payload, id: editingFeedId });
      setEditingFeedId(null);
    } else {
      onAddFeedRecord(payload);
      setAddModal(null);
    }
    // Reset Form
    setFeedQty('');
    setFeedRate('');
    setFeedNotes('');
    setFeedSupplier('');
  };

  // Submit Expense Record
  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(expAmount);
    if (!expDetail.trim()) return notify('Please enter expense detail', 'error');
    if (!amt || amt <= 0) return notify('Please enter a valid amount', 'error');

    const payload = {
      date: expDate,
      detail: expDetail.trim(),
      category: expCategory,
      amount: amt,
      notes: expNotes.trim() || undefined,
      supplierId: expSupplier || undefined,
      receiptBase64: expReceipt || undefined
    };
    if (editingExpenseId !== null) {
      onUpdateOtherExpense(editingExpenseId, { ...payload, id: editingExpenseId });
      setEditingExpenseId(null);
    } else {
      onAddOtherExpense(payload);
      setAddModal(null);
    }
    // Reset Form
    setExpDetail('');
    setExpAmount('');
    setExpNotes('');
    setExpReceipt('');
  };

  // Submit Egg Production Record
  const handleEggSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const col = parseInt(eggsCollected) || 0;
    const sold = parseInt(eggsSold) || 0;
    const home = parseInt(eggsHomeUse) || 0;
    const brok = parseInt(eggsBroken) || 0;

    if (col < 0 || sold < 0 || home < 0 || brok < 0) {
      return notify('Values cannot be negative', 'error');
    }

    const customerQty = customerEggsOnDate(eggDate);

    if (sold + home + brok > col) {
      return notify(`Sum of Direct/Cash Sold (${sold}), Home Use (${home}), and Broken (${brok}) cannot exceed Total Eggs Collected (${col})`, 'error');
    }

    if (sold + customerQty + home + brok > col) {
      return notify(
        `This day would be over-allocated.\n\n` +
        `Collected: ${col}\n` +
        `Direct/Cash Sold: ${sold}\n` +
        `Customer Sales (separate ledger): ${customerQty}\n` +
        `Home Use: ${home}\n` +
        `Broken: ${brok}\n\n` +
        `Please reduce Direct/Cash Sold or update customer sales / collection count.`
      , 'error');
    }

    const payload = {
      date: eggDate,
      totalEggsCollected: col,
      sold,
      homeUse: home,
      brokenWasted: brok
    };

    if (editingEggDate !== null) {
      onUpdateEggRecord(editingEggDate, payload);
      setEditingEggDate(null);
    } else {
      // Check if egg record already exists for this date
      const exists = eggProduction.some(ep => ep.date === eggDate);
      if (exists) {
        const ok = await confirmAction({
          title: 'Update Existing Egg Log',
          message: `An egg production log already exists for date ${eggDate}. Do you want to update it with these new values?`,
          confirmLabel: 'Update Log',
          cancelLabel: 'Cancel',
          tone: 'warning',
        });
        if (!ok) {
          return;
        }
      }
      onAddEggRecord(payload);
      setAddModal(null);
    }

    // Reset Form
    setEggsCollected('');
    setEggsSold('');
    setEggsHomeUse('');
    setEggsBroken('');
  };

  // Calculations for Summary Badges — extracted to ./ledger/useLedgerTotals
  // (pure data transformation, same inputs + outputs as the inline reduces).
  const {
    totalFeedExpense, totalFeedWeight,
    totalOtherExpensesSum,
    totalEggsCollectedSum, totalEggsSoldSum, totalCustomerEggsSum,
    totalEggsHomeSum, totalEggsBrokenSum,
    totalEggIncome, totalCustomerEggIncome,
  } = useLedgerTotals({ feedRecords, otherExpenses, eggProduction, customerSales, settings });

  const filteredFeedRecords = feedRecords
    .filter((record) => record.feedType.toLowerCase().includes(feedSearch.toLowerCase()) || (record.notes && record.notes.toLowerCase().includes(feedSearch.toLowerCase())))
    .sort((a, b) => b.date.localeCompare(a.date));

  const filteredExpenseRecords = otherExpenses
    .filter((record) => record.detail.toLowerCase().includes(expenseSearch.toLowerCase()) || (record.notes && record.notes.toLowerCase().includes(expenseSearch.toLowerCase())))
    .sort((a, b) => b.date.localeCompare(a.date));

  const filteredEggRecords = eggProduction
    .filter((record) => record.date.includes(eggSearch))
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6 muf-finance-surface" id="financial-ledger-tab">
      {/* Page Hero */}
      <div className="muf-page-hero">
        <div className="muf-page-title">
          <div className="muf-title-icon"><DollarSign size={28}/></div>
          <div>
            <h2>{L('Finance')}</h2>
            <p>{L('Manage feed, expenses, egg production, customers, and health activity from one place.')}</p>
          </div>
        </div>
      </div>

      {/* Finance sections dropdown */}
      <div className="muf-panel p-3 flex flex-wrap items-center gap-3 muf-finance-surface">
        <label htmlFor="flock-finance-section" className="text-xs font-bold text-slate-600 dark:text-slate-300">Finance section</label>
        <select id="flock-finance-section" value={activeSubTab} onChange={e => setActiveSubTab(e.target.value as typeof activeSubTab)} className="min-w-0 flex-1 sm:flex-none sm:min-w-[230px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          {([
            { id: 'feed', label: `${L('Feed')} (${feedRecords.length})` },
            { id: 'expense', label: `${L('Expenses')} (${otherExpenses.length})` },
            { id: 'egg', label: `${L('Eggs')} (${eggProduction.length})` },
            { id: 'customers', label: `${L('Customers')} (${customers.length})` },
            { id: 'suppliers', label: `${L('Suppliers')} (${suppliers.length})` },
          ] as { id: 'feed' | 'expense' | 'egg' | 'customers' | 'suppliers'; label: string }[]).map(tab => <option key={tab.id} value={tab.id}>{tab.label}</option>)}
        </select>
      </div>

      {/* --- FEED RECORDS SECTION --- */}
      {activeSubTab === 'feed' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-150">
          {/* Data Entry Button (popup) */}
          {isAdmin && (
          <div className="muf-panel p-6 h-fit space-y-4">
            <button type="button" onClick={() => setAddModal('feed')}
              className="w-full flex items-center justify-center gap-2 muf-primary-action">
              <Plus className="w-4 h-4" /> Record Feed Purchase
            </button>
          </div>
          )}

          <DetailModal open={addModal === 'feed'} onClose={() => setAddModal(null)} title="Record Feed Purchase" icon={<Plus className="w-5 h-5" />} iconBg="bg-indigo-100 text-indigo-700" size="small">
            <form onSubmit={handleFeedSubmit} className="space-y-3.5 text-xs text-gray-700">
              <div>
                <label className="block text-3xs font-bold text-gray-400 uppercase tracking-wider mb-1">Purchase Date</label>
                <input 
                  type="date"
                  required
                  value={feedDate}
                  onChange={(e) => setFeedDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:border-amber-400 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-3xs font-bold text-gray-400 uppercase tracking-wider mb-1">Feed Type</label>
                <select 
                  value={feedType}
                  onChange={(e) => setFeedType(e.target.value as FeedType)}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:border-amber-400 focus:outline-hidden"
                >
                  <option value="Khal & Choker">Khal & Choker</option>
                  <option value="Corn">Corn</option>
                  <option value="Wheat">Wheat</option>
                  <option value="Grains">Grains</option>
                  <option value="Supplements">Supplements</option>
                  <option value="Medicine">Medicine</option>
                  <option value="Eggs">Eggs</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-3xs font-bold text-gray-400 uppercase tracking-wider mb-1">Quantity (kg) *</label>
                  <input 
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="e.g. 50"
                    value={feedQty}
                    onChange={(e) => setFeedQty(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:border-amber-400 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-3xs font-bold text-gray-400 uppercase tracking-wider mb-1">Rate (Rs/kg) *</label>
                  <input 
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="e.g. 110"
                    value={feedRate}
                    onChange={(e) => setFeedRate(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:border-amber-400 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Automatic live multiplication display */}
              {parseFloat(feedQty) > 0 && parseFloat(feedRate) > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-900 font-mono text-2xs flex justify-between">
                  <span>Auto-Calculated Total:</span>
                  <span className="font-bold">Rs {(parseFloat(feedQty) * parseFloat(feedRate)).toLocaleString()}</span>
                </div>
              )}

              <div>
                <label className="block text-3xs font-bold text-gray-400 uppercase tracking-wider mb-1">{L('Supplier — udhaar khata (optional)')}</label>
                <select value={feedSupplier} onChange={(e) => setFeedSupplier(e.target.value)} className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl bg-white">
                  <option value="">{L('Cash / no supplier')}</option>
                  {suppliers.map((sup) => <option key={String(sup.id)} value={String(sup.id)}>{sup.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-3xs font-bold text-gray-400 uppercase tracking-wider mb-1">Optional Notes</label>
                <textarea 
                  placeholder="Brand, seller, or quality details..."
                  value={feedNotes}
                  onChange={(e) => setFeedNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:border-amber-400 focus:outline-hidden h-16 resize-none"
                />
              </div>

              <div className="flex gap-2">
                <button 
                  type="submit"
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl transition cursor-pointer"
                >
                  Save Feed Purchase
                </button>
                {editingFeedId !== null && (
                  <button
                    type="button"
                    onClick={cancelEditFeed}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </DetailModal>

          {/* Table / List */}
          <div className={isAdmin ? "lg:col-span-2 space-y-4" : "lg:col-span-3 space-y-4"}>
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-4 muf-panel p-4">
              <div>
                <span className="text-3xs font-bold text-amber-700 uppercase tracking-wider block font-mono">Total Feed Purchased</span>
                <span className="text-lg font-bold font-mono text-amber-900">{totalFeedWeight.toFixed(1)} kg</span>
              </div>
              <div>
                <span className="text-3xs font-bold text-amber-700 uppercase tracking-wider block font-mono">Total Feed Investment</span>
                <span className="text-lg font-bold font-mono text-amber-900">Rs {totalFeedExpense.toLocaleString()}</span>
              </div>
            </div>

            {/* Filter Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Search feed records by type or notes..."
                value={feedSearch}
                onChange={(e) => setFeedSearch(e.target.value)}
                className="w-full text-xs pl-9 pr-4 py-2 border border-gray-200 rounded-xl focus:border-amber-400 focus:outline-hidden"
              />
            </div>

            {/* Table */}
            <div className="muf-panel overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-semibold font-mono uppercase text-3xs tracking-wider">
                      <th className="p-3">Date</th>
                      <th className="p-3">Feed Type</th>
                      <th className="p-3">Qty (kg)</th>
                      <th className="p-3 text-right">Total Cost</th>
                      <th className="p-3 sm:hidden text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredFeedRecords.map((record) => (
                      <tr
                        key={record.id}
                        className="hover:bg-gray-50/50 font-medium cursor-pointer"
                        onClick={() => openFeedDetail(record)}
                        title="View full feed record"
                      >
                        <td className="p-3 font-mono text-gray-600 shrink-0">{record.date}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-100 rounded-md text-2xs font-bold">
                            {record.feedType}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-gray-800">{record.quantityKg} kg</td>
                        <td className="p-3 font-mono font-bold text-gray-900 text-right">
                          Rs {(record.quantityKg * record.rateRsPerKg).toLocaleString()}
                        </td>
                        <td className="p-3 sm:hidden text-right text-slate-400"><Eye className="w-4 h-4 inline-block" /></td>
                      </tr>
                    ))}
                    {filteredFeedRecords.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-gray-400 italic">No feed records logged.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- OTHER EXPENSES SECTION --- */}
      {activeSubTab === 'expense' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-150">
          {/* Data Entry Button (popup) */}
          {isAdmin && (
          <div className="muf-panel p-6 h-fit space-y-4">
            <button type="button" onClick={() => setAddModal('expense')}
              className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl px-4 py-3 transition cursor-pointer">
              <Plus className="w-4 h-4" /> Record Other Expense
            </button>
          </div>
          )}

          <DetailModal open={addModal === 'expense'} onClose={() => setAddModal(null)} title="Record Other Expense" icon={<Plus className="w-5 h-5" />} iconBg="bg-rose-100 text-rose-700" size="small">
            <form onSubmit={handleExpenseSubmit} className="space-y-3.5 text-xs text-gray-700">
              <div>
                <label className="block text-3xs font-bold text-gray-400 uppercase tracking-wider mb-1">Expense Date</label>
                <input 
                  type="date"
                  required
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:border-rose-400 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-3xs font-bold text-gray-400 uppercase tracking-wider mb-1">Expense Detail (e.g. Jali Darwazy) *</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Jali Darwazy ka liya"
                  value={expDetail}
                  onChange={(e) => setExpDetail(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:border-rose-400 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-3xs font-bold text-gray-400 uppercase tracking-wider mb-1">Category</label>
                  <select 
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value as ExpenseCategory)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:border-rose-400 focus:outline-hidden"
                  >
                    <option value="Medicine">Medicine</option>
                    <option value="Repair">Repair</option>
                    <option value="Utility">Utility</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-3xs font-bold text-gray-400 uppercase tracking-wider mb-1">Amount (Rs) *</label>
                  <input 
                    type="number"
                    min="1"
                    required
                    placeholder="e.g. 3500"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:border-rose-400 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-3xs font-bold text-gray-400 uppercase tracking-wider mb-1">{L('Supplier — udhaar khata (optional)')}</label>
                <select value={expSupplier} onChange={(e) => setExpSupplier(e.target.value)} className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl bg-white">
                  <option value="">{L('Cash / no supplier')}</option>
                  {suppliers.map((sup) => <option key={String(sup.id)} value={String(sup.id)}>{sup.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-3xs font-bold text-gray-400 uppercase tracking-wider mb-1">Optional Notes</label>
                <textarea 
                  placeholder="Detailed observations or descriptions..."
                  value={expNotes}
                  onChange={(e) => setExpNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:border-rose-400 focus:outline-hidden h-16 resize-none"
                />
              </div>

              <div>
                <label className="block text-3xs font-bold text-gray-400 uppercase tracking-wider mb-1">Receipt Photo (Optional)</label>
                {expReceipt ? (
                  <div className="flex items-center gap-3">
                    <img src={expReceipt} alt="Receipt" className="w-12 h-12 rounded-lg object-cover border border-gray-200 cursor-pointer" onClick={() => setViewReceipt(expReceipt)} />
                    <button type="button" onClick={() => setExpReceipt('')} className="text-2xs font-semibold text-rose-500 hover:text-rose-700 transition cursor-pointer">Remove photo</button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-gray-300 text-2xs font-semibold text-gray-500 cursor-pointer hover:border-rose-400 hover:text-rose-600 transition w-fit">
                    📷 Add receipt photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        try {
                          const b64 = await compressToAvatar(file, 900, 0.72);
                          if (b64.length > 400000) { notify('Photo is too large even after compression', 'error'); return; }
                          setExpReceipt(b64);
                        } catch {
                          notify('Could not read that image', 'error');
                        }
                      }}
                    />
                  </label>
                )}
              </div>

              <div className="flex gap-2">
                <button 
                  type="submit"
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl transition cursor-pointer"
                >
                  Save Expense Record
                </button>
                {editingExpenseId !== null && (
                  <button
                    type="button"
                    onClick={cancelEditExpense}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </DetailModal>

          {/* Table / List */}
          <div className={isAdmin ? "lg:col-span-2 space-y-4" : "lg:col-span-3 space-y-4"}>
            {/* Quick Metrics */}
            <div className="grid grid-cols-1 gap-4 muf-panel p-4">
              <div>
                <span className="text-3xs font-bold text-rose-700 uppercase tracking-wider block font-mono">Total Other Operating Expenses</span>
                <span className="text-lg font-bold font-mono text-rose-900">Rs {totalOtherExpensesSum.toLocaleString()}</span>
              </div>
            </div>

            {/* Filter Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Search operating expenses by detail or notes..."
                value={expenseSearch}
                onChange={(e) => setExpenseSearch(e.target.value)}
                className="w-full text-xs pl-9 pr-4 py-2 border border-gray-200 rounded-xl focus:border-rose-400 focus:outline-hidden"
              />
            </div>

            {/* Table */}
            <div className="muf-panel overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-semibold font-mono uppercase text-3xs tracking-wider">
                      <th className="p-3">Date</th>
                      <th className="p-3">Detail</th>
                      <th className="p-3">Category</th>
                      <th className="p-3 text-right">Amount</th>
                      <th className="p-3 sm:hidden text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredExpenseRecords.map((record) => (
                      <tr
                        key={record.id}
                        className="hover:bg-gray-50/50 font-medium cursor-pointer"
                        onClick={() => openExpenseDetail(record)}
                        title="View full expense record"
                      >
                        <td className="p-3 font-mono text-gray-600 shrink-0">{record.date}</td>
                        <td className="p-3 text-gray-900 font-semibold">
                          <span className="inline-flex items-center gap-1.5">
                            {record.receiptBase64 && <span title="Has receipt photo">📷</span>}
                            {record.detail}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-100 rounded-md text-2xs font-bold">
                            {record.category}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-gray-900 text-right">
                          Rs {record.amount.toLocaleString()}
                        </td>
                        <td className="p-3 sm:hidden text-right text-slate-400"><Eye className="w-4 h-4 inline-block" /></td>
                      </tr>
                    ))}
                    {filteredExpenseRecords.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-gray-400 italic">No non-feed expenses logged.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- EGG PRODUCTION SECTION --- */}
      {activeSubTab === 'egg' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-150">
          {/* Data Entry Button (popup) */}
          {isAdmin && (
          <div className="muf-panel p-6 h-fit space-y-4">
            <button type="button" onClick={() => setAddModal('egg')}
              className="w-full flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-sm rounded-xl px-4 py-3 transition cursor-pointer">
              <Plus className="w-4 h-4" /> Log Daily Egg Collections
            </button>
          </div>
          )}

          <DetailModal open={addModal === 'egg'} onClose={() => setAddModal(null)} title="Log Daily Egg Collections" icon={<Plus className="w-5 h-5" />} iconBg="bg-yellow-100 text-yellow-700" size="small">
            <form onSubmit={handleEggSubmit} className="space-y-3.5 text-xs text-gray-700">
              <div>
                <label className="block text-3xs font-bold text-gray-400 uppercase tracking-wider mb-1">Collection Date</label>
                <input 
                  type="date"
                  required
                  value={eggDate}
                  onChange={(e) => setEggDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:border-yellow-400 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-3xs font-bold text-gray-400 uppercase tracking-wider mb-1">Eggs Collected (Qty) *</label>
                <input 
                  type="number"
                  min="0"
                  required
                  placeholder="e.g. 15"
                  value={eggsCollected}
                  onChange={(e) => setEggsCollected(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:border-yellow-400 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-3xs font-bold text-gray-400 uppercase tracking-wider mb-1">Direct / Cash Sold</label>
                  <input 
                    type="number"
                    min="0"
                    placeholder="0"
                    value={eggsSold}
                    onChange={(e) => setEggsSold(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-xl focus:border-yellow-400 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-3xs font-bold text-gray-400 uppercase tracking-wider mb-1">Home Use</label>
                  <input 
                    type="number"
                    min="0"
                    placeholder="0"
                    value={eggsHomeUse}
                    onChange={(e) => setEggsHomeUse(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-xl focus:border-yellow-400 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-3xs font-bold text-gray-400 uppercase tracking-wider mb-1">Broken</label>
                  <input 
                    type="number"
                    min="0"
                    placeholder="0"
                    value={eggsBroken}
                    onChange={(e) => setEggsBroken(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-xl focus:border-yellow-400 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Automatic live formula calculations display */}
              {parseInt(eggsCollected) >= 0 && (
                <div className="p-3 bg-yellow-50/50 border border-yellow-100 rounded-xl text-yellow-950 font-mono text-2xs space-y-1">
                  <div className="flex justify-between">
                    <span>Customer eggs on this date:</span>
                    <span className="font-bold">{customerEggsOnDate(eggDate)} eggs</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Remaining (In Stock):</span>
                    <span className="font-bold">
                      {parseInt(eggsCollected) - (parseInt(eggsSold) || 0) - customerEggsOnDate(eggDate) - (parseInt(eggsHomeUse) || 0) - (parseInt(eggsBroken) || 0)} eggs
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-600">
                    Daily “Sold” should be direct/cash sales only. Customer/credit sales are tracked in the Customers tab.
                  </div>
                  {parseInt(eggsSold) > 0 && (
                    <div className="flex justify-between border-t border-yellow-100/50 pt-1 mt-1">
                      <span>Projected Direct Sale Revenue:</span>
                      <span className="font-bold text-emerald-700">Rs {((parseInt(eggsSold) || 0) * settings.defaultPricePerEgg).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button 
                  type="submit"
                  className="flex-1 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold text-xs rounded-xl transition cursor-pointer"
                >
                  Log Egg Production
                </button>
                {editingEggDate !== null && (
                  <button
                    type="button"
                    onClick={cancelEditEgg}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </DetailModal>

          {/* Table / List */}
          <div className={isAdmin ? "lg:col-span-2 space-y-4" : "lg:col-span-3 space-y-4"}>
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 muf-panel p-4">
              <div>
                <span className="text-3xs font-bold text-yellow-700 uppercase tracking-wider block font-mono">Total Collected</span>
                <span className="text-base font-bold font-mono text-yellow-900">{totalEggsCollectedSum} eggs</span>
              </div>
              <div>
                <span className="text-3xs font-bold text-yellow-700 uppercase tracking-wider block font-mono">Direct Sold</span>
                <span className="text-base font-bold font-mono text-yellow-900">{totalEggsSoldSum} eggs</span>
              </div>
              <div>
                <span className="text-3xs font-bold text-yellow-700 uppercase tracking-wider block font-mono">Customer Sales</span>
                <span className="text-base font-bold font-mono text-yellow-900">{totalCustomerEggsSum} eggs</span>
              </div>
              <div>
                <span className="text-3xs font-bold text-yellow-700 uppercase tracking-wider block font-mono">Total Remaining</span>
                <span className="text-base font-bold font-mono text-yellow-900">
                  {totalEggsCollectedSum - totalEggsSoldSum - totalCustomerEggsSum - totalEggsHomeSum - totalEggsBrokenSum} eggs
                </span>
              </div>
              <div>
                <span className="text-3xs font-bold text-yellow-700 uppercase tracking-wider block font-mono">Income</span>
                <span className="text-base font-bold font-mono text-emerald-800">Rs {(totalEggIncome + totalCustomerEggIncome).toLocaleString()}</span>
              </div>
            </div>

            {/* Filter Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Search egg records by date (YYYY-MM-DD)..."
                value={eggSearch}
                onChange={(e) => setEggSearch(e.target.value)}
                className="w-full text-xs pl-9 pr-4 py-2 border border-gray-200 rounded-xl focus:border-yellow-400 focus:outline-hidden"
              />
            </div>

            {/* Table */}
            <div className="muf-panel overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-semibold font-mono uppercase text-3xs tracking-wider">
                      <th className="p-3">Date</th>
                      <th className="p-3 text-center">Collected</th>
                      <th className="p-3 text-center">Sold / Remaining</th>
                      <th className="p-3 text-right">Income (Rs)</th>
                      <th className="p-3 sm:hidden text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {filteredEggRecords.map((record) => {
                      const customerQty = customerEggsOnDate(record.date);
                      const totalSold = record.sold + customerQty;
                      const remaining = record.totalEggsCollected - totalSold - record.homeUse - record.brokenWasted;
                      const saleIncome = (record.sold * (record.pricePerEgg ?? settings.defaultPricePerEgg)) + customerSales.filter((sale) => sale.date === record.date).reduce((sum, sale) => sum + (sale.eggsQty || 0) * (sale.pricePerEgg || 0), 0);
                      return (
                        <tr
                          key={record.date}
                          className="hover:bg-gray-50/50 cursor-pointer"
                          onClick={() => openEggDetail(record)}
                          title="View full egg record"
                        >
                          <td className="p-3 font-mono text-gray-600 shrink-0">{record.date}</td>
                          <td className="p-3 text-center font-mono text-gray-900 font-bold">{record.totalEggsCollected}</td>
                          <td className="p-3 text-center font-mono text-slate-700">{totalSold} / {remaining}</td>
                          <td className="p-3 font-mono font-bold text-right text-emerald-600">
                            Rs {saleIncome.toLocaleString()}
                          </td>
                          <td className="p-3 sm:hidden text-right text-slate-400"><Eye className="w-4 h-4 inline-block" /></td>
                        </tr>
                      );
                    })}
                    {filteredEggRecords.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-gray-400 italic">No egg production records logged.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      <DetailModal
        open={!!activeFeedDetail}
        onClose={() => setActiveFeedDetailId(null)}
        title="Feed Record Details"
        subtitle={activeFeedDetail?.feedType}
        icon={<ShoppingBag className="w-5 h-5" />}
        iconBg="bg-amber-100 text-amber-700"
        size="small"
      >
        {activeFeedDetail && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <LedgerDetailTile label="Date" value={activeFeedDetail.date} />
              <LedgerDetailTile label="Feed Type" value={activeFeedDetail.feedType} />
              <LedgerDetailTile label="Quantity" value={`${activeFeedDetail.quantityKg} kg`} />
              <LedgerDetailTile label="Rate" value={`Rs ${activeFeedDetail.rateRsPerKg.toLocaleString()}`} />
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Total Cost</p>
              <p className="mt-1 text-lg font-bold font-mono text-amber-900">Rs {(activeFeedDetail.quantityKg * activeFeedDetail.rateRsPerKg).toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Notes</p>
              <p className="mt-1 text-sm text-slate-700">{activeFeedDetail.notes || 'No notes added.'}</p>
            </div>
            {(isAdmin || canDelete) && (
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDeleteFeedFromDetail(activeFeedDetail)}
                    className="px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-semibold text-xs hover:bg-rose-100"
                  >
                    Delete
                  </button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      startEditFeed(activeFeedDetail);
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700"
                  >
                    Edit Record
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </DetailModal>

      <DetailModal
        open={!!activeExpenseDetail}
        onClose={() => setActiveExpenseDetailId(null)}
        title="Expense Record Details"
        subtitle={activeExpenseDetail?.detail}
        icon={<Coins className="w-5 h-5" />}
        iconBg="bg-rose-100 text-rose-700"
        size="small"
      >
        {activeExpenseDetail && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <LedgerDetailTile label="Date" value={activeExpenseDetail.date} />
              <LedgerDetailTile label="Category" value={activeExpenseDetail.category} />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Detail</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{activeExpenseDetail.detail}</p>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-rose-700">Amount</p>
              <p className="mt-1 text-lg font-bold font-mono text-rose-900">Rs {activeExpenseDetail.amount.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Notes</p>
              <p className="mt-1 text-sm text-slate-700">{activeExpenseDetail.notes || 'No notes added.'}</p>
            </div>
            {activeExpenseDetail.receiptBase64 && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Receipt Photo</p>
                <img
                  src={activeExpenseDetail.receiptBase64}
                  alt="Receipt"
                  className="w-full max-h-64 object-contain rounded-xl bg-white border border-slate-100 cursor-zoom-in"
                  onClick={() => setViewReceipt(activeExpenseDetail.receiptBase64!)}
                />
              </div>
            )}
            {(isAdmin || canDelete) && (
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDeleteExpenseFromDetail(activeExpenseDetail)}
                    className="px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-semibold text-xs hover:bg-rose-100"
                  >
                    Delete
                  </button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      startEditExpense(activeExpenseDetail);
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700"
                  >
                    Edit Record
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </DetailModal>

      <DetailModal
        open={!!activeEggDetail}
        onClose={() => setActiveEggDetailDate(null)}
        title="Egg Record Details"
        subtitle={activeEggDetail?.date}
        icon={<Egg className="w-5 h-5" />}
        iconBg="bg-yellow-100 text-yellow-700"
        size="small"
      >
        {activeEggDetail && (() => {
          const customerQty = customerEggsOnDate(activeEggDetail.date);
          const totalSold = activeEggDetail.sold + customerQty;
          const remaining = activeEggDetail.totalEggsCollected - totalSold - activeEggDetail.homeUse - activeEggDetail.brokenWasted;
          const saleIncome = (activeEggDetail.sold * (activeEggDetail.pricePerEgg ?? settings.defaultPricePerEgg)) + customerSales.filter((sale) => sale.date === activeEggDetail.date).reduce((sum, sale) => sum + (sale.eggsQty || 0) * (sale.pricePerEgg || 0), 0);
          return (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <LedgerDetailTile label="Collected" value={`${activeEggDetail.totalEggsCollected}`} />
                <LedgerDetailTile label="Direct Sold" value={`${activeEggDetail.sold}`} />
                <LedgerDetailTile label="Customer Sales" value={`${customerQty}`} />
                <LedgerDetailTile label="Remaining" value={`${remaining}`} />
                <LedgerDetailTile label="Home Use" value={`${activeEggDetail.homeUse}`} />
                <LedgerDetailTile label="Broken" value={`${activeEggDetail.brokenWasted}`} />
                <LedgerDetailTile label="Total Sold" value={`${totalSold}`} />
                <LedgerDetailTile label="Price/Egg" value={`Rs ${(activeEggDetail.pricePerEgg ?? settings.defaultPricePerEgg).toLocaleString()}`} />
              </div>
              <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-yellow-700">Income</p>
                <p className="mt-1 text-lg font-bold font-mono text-yellow-900">Rs {saleIncome.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                Daily “Sold” is direct/cash sale only. Customer/credit sales are tracked separately and included above.
              </div>
              {(isAdmin || canDelete) && (
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDeleteEggFromDetail(activeEggDetail)}
                      className="px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-semibold text-xs hover:bg-rose-100"
                    >
                      Delete
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        startEditEgg(activeEggDetail);
                      }}
                      className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700"
                    >
                      Edit Record
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </DetailModal>

      {activeSubTab === 'customers' && (
        <CustomerLedger
          lang={lang}
          customers={customers}
          sales={customerSales}
          eggProduction={eggProduction}
          defaultPricePerEgg={settings.defaultPricePerEgg}
          onAddCustomer={onAddCustomer}
          onUpdateCustomer={onUpdateCustomer}
          onDeleteCustomer={onDeleteCustomer}
          onAddSale={onAddCustomerSale}
          onUpdateSale={onUpdateCustomerSale}
          onDeleteSale={onDeleteCustomerSale}
          canDelete={canDelete}
          canManageCustomers={canManageCustomers}
          canLogSales={canLogSales}
        />
      )}

      {activeSubTab === 'suppliers' && (
        <SupplierLedger
          lang={lang}
          suppliers={suppliers}
          onChangeSuppliers={setSuppliers}
          feedRecords={feedRecords}
          otherExpenses={otherExpenses}
          canDelete={canDelete}
        />
      )}

      <DetailModal open={editingFeedId !== null} onClose={cancelEditFeed} title="Edit Feed Purchase" icon={<Pencil className="w-5 h-5" />} iconBg="bg-indigo-100 text-indigo-700" size="small">
        <form onSubmit={handleFeedSubmit} className="space-y-3.5 text-xs text-gray-700">
          <input type="date" required value={feedDate} onChange={(e) => setFeedDate(e.target.value)} className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl" />
          <select value={feedType} onChange={(e) => setFeedType(e.target.value as FeedType)} className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl">
            <option value="Khal & Choker">Khal & Choker</option>
            <option value="Corn">Corn</option>
            <option value="Wheat">Wheat</option>
            <option value="Grains">Grains</option>
            <option value="Supplements">Supplements</option>
            <option value="Medicine">Medicine</option>
            <option value="Eggs">Eggs</option>
            <option value="Other">Other</option>
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" step="0.01" min="0.01" required placeholder="Quantity (kg)" value={feedQty} onChange={(e) => setFeedQty(e.target.value)} className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl" />
            <input type="number" step="0.01" min="0.01" required placeholder="Rate (Rs/kg)" value={feedRate} onChange={(e) => setFeedRate(e.target.value)} className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl" />
          </div>
          <select value={feedSupplier} onChange={(e) => setFeedSupplier(e.target.value)} className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl bg-white">
            <option value="">{L('Cash / no supplier')}</option>
            {suppliers.map((sup) => <option key={String(sup.id)} value={String(sup.id)}>{sup.name}</option>)}
          </select>
          <textarea placeholder="Notes" value={feedNotes} onChange={(e) => setFeedNotes(e.target.value)} className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl h-16 resize-none" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={cancelEditFeed} className="px-4 py-2 border rounded-xl">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700">Update Feed Purchase</button>
          </div>
        </form>
      </DetailModal>

      <DetailModal open={editingExpenseId !== null} onClose={cancelEditExpense} title="Edit Other Expense" icon={<Pencil className="w-5 h-5" />} iconBg="bg-rose-100 text-rose-700" size="small">
        <form onSubmit={handleExpenseSubmit} className="space-y-3.5 text-xs text-gray-700">
          <input type="date" required value={expDate} onChange={(e) => setExpDate(e.target.value)} className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl" />
          <input type="text" required placeholder="Expense Detail" value={expDetail} onChange={(e) => setExpDetail(e.target.value)} className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            <select value={expCategory} onChange={(e) => setExpCategory(e.target.value as ExpenseCategory)} className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl">
              <option value="Medicine">Medicine</option>
              <option value="Repair">Repair</option>
              <option value="Utility">Utility</option>
              <option value="Other">Other</option>
            </select>
            <input type="number" min="1" required placeholder="Amount (Rs)" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl" />
          </div>
          <select value={expSupplier} onChange={(e) => setExpSupplier(e.target.value)} className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl bg-white">
            <option value="">{L('Cash / no supplier')}</option>
            {suppliers.map((sup) => <option key={String(sup.id)} value={String(sup.id)}>{sup.name}</option>)}
          </select>
          <textarea placeholder="Notes" value={expNotes} onChange={(e) => setExpNotes(e.target.value)} className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl h-16 resize-none" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={cancelEditExpense} className="px-4 py-2 border rounded-xl">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-700">Update Expense Record</button>
          </div>
        </form>
      </DetailModal>

      <DetailModal open={editingEggDate !== null} onClose={cancelEditEgg} title="Edit Egg Collection" subtitle={editingEggDate || ''} icon={<Pencil className="w-5 h-5" />} iconBg="bg-yellow-100 text-yellow-700" size="small">
        <form onSubmit={handleEggSubmit} className="space-y-3.5 text-xs text-gray-700">
          <input type="date" required value={eggDate} onChange={(e) => setEggDate(e.target.value)} className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl" />
          <input type="number" min="0" required placeholder="Eggs Collected" value={eggsCollected} onChange={(e) => setEggsCollected(e.target.value)} className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl" />
          <div className="grid grid-cols-3 gap-2">
            <input type="number" min="0" placeholder="Direct Sold" value={eggsSold} onChange={(e) => setEggsSold(e.target.value)} className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-xl" />
            <input type="number" min="0" placeholder="Home Use" value={eggsHomeUse} onChange={(e) => setEggsHomeUse(e.target.value)} className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-xl" />
            <input type="number" min="0" placeholder="Broken" value={eggsBroken} onChange={(e) => setEggsBroken(e.target.value)} className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-xl" />
          </div>
          <div className="rounded-xl border px-3 py-2 text-[11px] bg-yellow-50 border-yellow-200 text-yellow-900">
            Customer eggs on this date: {customerEggsOnDate(eggDate)} eggs. Keep direct/cash sold separate from customer sales.
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={cancelEditEgg} className="px-4 py-2 border rounded-xl">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-yellow-500 text-white rounded-xl font-semibold hover:bg-yellow-600">Update Egg Collection</button>
          </div>
        </form>
      </DetailModal>

      {/* Receipt photo lightbox */}
      {viewReceipt && (
        <div
          className="fixed inset-0 z-[var(--muf-z-popup-2)] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setViewReceipt(null)}
        >
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setViewReceipt(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-slate-700 shadow-lg flex items-center justify-center font-bold hover:rotate-90 transition-transform cursor-pointer"
              aria-label="Close"
            >
              ✕
            </button>
            <img src={viewReceipt} alt="Receipt" className="w-full max-h-[80vh] object-contain rounded-2xl bg-white" />
          </div>
        </div>
      )}
    </div>
  );
}

function LedgerDetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold font-mono text-slate-800">{value}</p>
    </div>
  );
}
