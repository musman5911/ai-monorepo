import React, { useState, useEffect } from 'react';
import { L } from '../i18n';
import { api } from '../api';
import { useConfirm, notify } from '../muf/core/muf-confirm';
import type { Cow, Expense, ExpenseType, Supplier } from '../types';
import SupplierKhata from './SupplierKhata';
import { mufMonthStart } from '../muf/data/muf-date';
import { todayStr, formatDate } from '../utils/date';
import { compressToAvatar } from '../muf/ui/muf-avatar';
import {
  Plus,
  Calendar,
  Filter,
  Trash2,
  Edit2,
  Eye,
  X,
  Banknote,
  LayoutGrid,
  Grid3x3,
} from 'lucide-react';
import DetailModal from '../muf/core/muf-modal';
import { ZakatCalculator } from './expenses/ZakatCalculator';

interface ExpensesTabProps {
  isAdmin: boolean;
  canDelete?: boolean;
  financeCategory?: string;
}

const typeStyles: Record<ExpenseType, string> = {
  feed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  medicine: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  equipment: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  labor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  purchasing: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  misc: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
};

const ExpensesTab: React.FC<ExpensesTabProps> = ({ isAdmin, canDelete = isAdmin, financeCategory }) => {
  const confirmAction = useConfirm();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cows, setCows] = useState<Cow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Filters — default to current month
  const defaultFrom = mufMonthStart();
  const defaultTo = todayStr();
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [typeFilter, setTypeFilter] = useState<string>('');
  useEffect(() => { if (financeCategory !== undefined) setTypeFilter(financeCategory); }, [financeCategory]);

  // Form
  const [formData, setFormData] = useState({
    date: todayStr(),
    type: 'feed' as ExpenseType,
    amount: '',
    feedKg: '',
    cowId: '',
    supplierId: '',
    note: ''
  });
  const [receiptBase64, setReceiptBase64] = useState('');
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [viewReceipt, setViewReceipt] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [expensesData, cowsData, suppliersData] = await Promise.all([
        api.getExpenses({ from: dateFrom, to: dateTo, type: typeFilter || undefined }),
        api.getCows(),
        api.getSuppliers().catch(() => []),
      ]);
      setExpenses(expensesData);
      setCows(cowsData);
      setSuppliers(suppliersData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateFrom, dateTo, typeFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        date: formData.date,
        type: formData.type,
        amount: parseFloat(formData.amount),
        feedKg: formData.type === 'feed' ? (parseFloat(formData.feedKg) || 0) : 0,
        cowId: formData.cowId || null,  // null = farm-wide (explicitly clears cow)
        supplierId: formData.supplierId || '',
        note: formData.note || undefined,
        receiptBase64,
      };

      const wasEditing = !!editingId;
      if (editingId) {
        await api.updateExpense(editingId, data);
      } else {
        await api.addExpense(data);
      }
      notify(wasEditing ? 'Expense updated successfully.' : 'Expense added successfully.', 'success');

      setFormData({
        date: todayStr(),
        type: 'feed',
        amount: '',
        feedKg: '',
        cowId: '',
        supplierId: '',
        note: ''
      });
      setReceiptBase64('');
      setShowForm(false);
      setEditingId(null);
      fetchData();
    } catch (error) {
      notify(L('Failed to save expense'), 'error');
    }
  };

  const handleEdit = (expense: Expense) => {
    setFormData({
      date: expense.date.split('T')[0],
      type: expense.type,
      amount: expense.amount.toString(),
      feedKg: expense.feedKg ? String(expense.feedKg) : '',
      cowId: expense.cowId || '',
      supplierId: expense.supplierId || '',
      note: expense.note || ''
    });
    setReceiptBase64(expense.receiptBase64 || '');
    setEditingId(expense._id);
    setShowForm(true);
  };

  const handleDelete = async (id: string): Promise<boolean> => {
    const ok = await confirmAction({
      title: L('Delete Expense'),
      message: L('Are you sure you want to delete this expense?'),
      confirmLabel: L('Delete'),
      tone: 'danger',
    });
    if (!ok) return false;
    try {
      await api.deleteExpense(id);
      setExpenses(prev => prev.filter(exp => exp._id !== id));
      setSelectedExpense(current => current?._id === id ? null : current);
      notify(L('Expense deleted successfully.'), 'success');
      void fetchData();
      return true;
    } catch (error) {
      notify(L('Failed to delete expense'), 'error');
      return false;
    }
  };

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  const expByType: Record<string, number> = {};
  expenses.forEach(e => { expByType[e.type] = (expByType[e.type] || 0) + e.amount; });

  return (
    <div className="space-y-6 tab-panel muf-finance-surface">
      {/* Page Hero */}
      <div className="muf-page-hero">
        <div className="muf-page-title">
          <div className="muf-title-icon"><Banknote size={28}/></div>
          <div>
            <h2>{L('Finance')}{financeCategory !== undefined && financeCategory !== '' && <> <span className="mx-2 text-slate-300 dark:text-slate-600">›</span><span className="text-emerald-700 dark:text-emerald-400">{L(({ feed: 'Feed', medicine: 'Medicine', equipment: 'Equipment', labor: 'Labor', purchasing: 'Purchasing', misc: 'Other' } as Record<string, string>)[financeCategory] || financeCategory)}</span></>}</h2>
            <p>{L('Track feed, medicine, labor, equipment and other farm costs.')}</p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setShowForm(true); setEditingId(null); }}
            className="muf-primary-action"
          >
            <Plus size={19}/> {L('Add New Expense')}
          </button>
        )}
      </div>

      {/* KPI Grid — Total + per-type breakdown */}
      <div className="muf-kpi-grid">
        <div className="muf-kpi-card">
          <span className="muf-kpi-icon green"><Banknote size={22}/></span>
          <div>
            <small>{L('Total Expenses')}</small>
            <strong>₨ {totalExpenses.toLocaleString()}</strong>
            <p className="up">↗ {expenses.length} {L('records')}</p>
          </div>
        </div>
        {Object.entries(expByType).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([type, amount]) => (
          <div key={type} className="muf-kpi-card">
            <span className={`muf-kpi-icon ${type === 'feed' ? 'blue' : type === 'medicine' ? 'red' : type === 'labor' ? 'violet' : 'gold'}`}>
              <Banknote size={22}/>
            </span>
            <div>
              <small>{type.charAt(0).toUpperCase() + type.slice(1)}</small>
              <strong>₨ {amount.toLocaleString()}</strong>
              <p>{totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(0) : 0}% {L('of total')}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Breakdown Panel */}
      <div className="muf-panel p-5">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{L('Breakdown')}</h3>
        </div>
        <div className="space-y-2">
          {Object.entries(expByType).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([type, amount]) => {
            const pct = totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(0) : '0';
            return (
              <div key={type} className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${typeStyles[type as ExpenseType]}`}>{type}</span>
                <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-farm-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 w-20 text-right">₨{amount.toLocaleString()}</span>
                <span className="text-[10px] text-slate-400 w-8">{pct}%</span>
              </div>
            );
          })}
          {Object.entries(expByType).filter(([, v]) => v > 0).length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">{L('No expenses recorded yet.')}</p>
          )}
        </div>
      </div>

      <DetailModal open={showForm} onClose={() => { setShowForm(false); setEditingId(null); }}
        title={editingId ? L('Edit Expense') : L('Add New Expense')}
        icon={<Plus className="w-5 h-5" />} iconBg="bg-farm-100 text-farm-700" size="small">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="muf-pc-muted">Date *</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  className="muf-field"
                />
              </div>
              <div className="space-y-1">
                <label className="muf-pc-muted">Type *</label>
                <select
                  required
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value as ExpenseType })}
                  className="muf-field"
                >
                  <option value="feed">{L('Feed')}</option>
                  <option value="medicine">{L('Medicine')}</option>
                  <option value="equipment">{L('Equipment')}</option>
                  <option value="labor">{L('Labor')}</option>
                  <option value="purchasing">{L('Purchasing')}</option>
                  <option value="misc">{L('Misc')}</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="muf-pc-muted">{L('Amount')} (₨) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.amount}
                  onChange={e => setFormData({ ...formData, amount: e.target.value })}
                  className="muf-field"
                  placeholder="0.00"
                />
              </div>
              {formData.type === 'feed' && (
                <div className="space-y-1">
                  <label className="muf-pc-muted">{L('Feed quantity (kg) — for the stock card')}</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formData.feedKg}
                    onChange={e => setFormData({ ...formData, feedKg: e.target.value })}
                    className="muf-field"
                    placeholder="e.g. 350"
                  />
                </div>
              )}
              <div className="space-y-1">
                <label className="muf-pc-muted">{L('Supplier — udhaar khata (optional)')}</label>
                <select
                  value={formData.supplierId}
                  onChange={e => setFormData({ ...formData, supplierId: e.target.value })}
                  className="muf-field"
                >
                  <option value="">{L('Cash / no supplier')}</option>
                  {suppliers.map(sup => <option key={sup._id} value={sup._id}>{sup.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="muf-pc-muted">{L('Cow (Optional)')}</label>
                <select
                  value={formData.cowId}
                  onChange={e => setFormData({ ...formData, cowId: e.target.value })}
                  className="muf-field"
                >
                  <option value="">{L('Farm-wide')}</option>
                  {cows.map(cow => (
                    <option key={cow._id} value={cow._id}>{cow.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 lg:col-span-2">
                <label className="muf-pc-muted">{L('Note')}</label>
                <input
                  type="text"
                  value={formData.note}
                  onChange={e => setFormData({ ...formData, note: e.target.value })}
                  className="muf-field"
                  placeholder={L('Additional details...')}
                />
              </div>
              <div className="space-y-1 lg:col-span-3">
                <label className="muf-pc-muted">{L('Receipt photo (optional)')}</label>
                <div className="flex items-center gap-3">
                  {receiptBase64 ? (
                    <>
                      <img src={receiptBase64} alt="Receipt" className="w-14 h-14 rounded-lg object-cover border border-slate-200 dark:border-slate-700 cursor-pointer" onClick={() => setViewReceipt(receiptBase64)} />
                      <button type="button" onClick={() => setReceiptBase64('')} className="text-xs font-semibold text-red-400 hover:text-red-600 transition">{L('Remove photo')}</button>
                    </>
                  ) : (
                    <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-pointer hover:border-farm-500 hover:text-farm-600 transition">
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
                            if (b64.length > 400000) { notify(L('Photo is too large even after compression'), 'error'); return; }
                            setReceiptBase64(b64);
                          } catch {
                            notify(L('Could not read that image'), 'error');
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
              <div className="lg:col-span-3 flex justify-end space-x-2 pt-2">
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setShowForm(false);
                      setFormData({
                        date: todayStr(),
                        type: 'feed',
                        amount: '',
                        feedKg: '',
                        cowId: '',
                        supplierId: '',
                        note: ''
                      });
                    }}
                    className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                  >
                    {L('Cancel')}
                  </button>
                )}
                <button
                  type="submit"
                  className="bg-farm-600 hover:bg-farm-700 text-white rounded-lg px-6 py-2 text-sm font-medium"
                >
                  {editingId ? L('Update Expense') : L('Add Expense')}
                </button>
              </div>
            </form>
      </DetailModal>

      {/* Filters */}
      <div className="muf-panel p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
              placeholder={L('From')}
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
              placeholder="To"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
            >
                <option value="">{L('All Types')}</option>
                <option value="feed">{L('Feed')}</option>
                <option value="medicine">{L('Medicine')}</option>
                <option value="equipment">{L('Equipment')}</option>
                <option value="labor">{L('Labor')}</option>
                <option value="purchasing">{L('Purchasing')}</option>
                <option value="misc">{L('Misc')}</option>
            </select>
          </div>
          {(dateFrom || dateTo || typeFilter) && (
            <button 
              onClick={() => { setDateFrom(''); setDateTo(''); setTypeFilter(''); }}
              className="text-xs text-red-500 hover:text-red-600 flex items-center"
            >
              <X className="w-3 h-3 mr-1" /> Clear Filters
            </button>
          )}
          <div className="ml-auto muf-view-toggle">
            <button type="button" onClick={() => setViewMode('table')} className={viewMode === 'table' ? 'on' : ''}>
              <LayoutGrid className="w-3 h-3"/> Table
            </button>
            <button type="button" onClick={() => setViewMode('grid')} className={viewMode === 'grid' ? 'on' : ''}>
              <Grid3x3 className="w-3 h-3"/> Grid
            </button>
          </div>
        </div>
      </div>

      {/* Table view */}
      {viewMode === 'table' && (
      <div className="muf-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">{L('Date')}</th>
                <th className="px-6 py-4 font-medium">{L('Type')}</th>
                <th className="px-6 py-4 font-medium">{L('Amount')}</th>
                <th className="px-6 py-4 font-medium">{L('Cow')}</th>
                <th className="px-6 py-4 font-medium text-right">{L('Details / Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">{L('Loading expenses...')}</td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">{L('No expenses found')}</td>
                </tr>
              ) : expenses.map(expense => (
                <tr key={expense._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {formatDate(expense.date)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${typeStyles[expense.type]}`}>
                      {expense.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-slate-800 dark:text-slate-200">
                    ₨ {expense.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                    {expense.cowId ? cows.find(c => c._id === expense.cowId)?.name || 'Unknown' : 'Farm-wide'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        title={L('View expense details')}
                        aria-label={L('View expense details')}
                        onClick={() => setSelectedExpense(expense)}
                        className="p-1.5 text-slate-400 hover:text-farm-600 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          title={L('Edit expense')}
                          aria-label={L('Edit expense')}
                          onClick={() => handleEdit(expense)}
                          className="p-1.5 text-slate-400 hover:text-farm-600 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          title={L('Delete expense')}
                          aria-label={L('Delete expense')}
                          onClick={() => handleDelete(expense._id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Grid view */}
      {viewMode === 'grid' && (
        <div className="muf-entity-grid">
          {loading ? (
            <p className="col-span-full text-center text-slate-400 py-8">{L('Loading expenses...')}</p>
          ) : expenses.length === 0 ? (
            <p className="col-span-full text-center text-slate-400 py-8">{L('No expenses found')}</p>
          ) : expenses.map(expense => {
            const cow = expense.cowId ? cows.find(c => c._id === expense.cowId) : null;
            return (
              <article key={expense._id} className="muf-entity-card">
                <div className={expense.receiptBase64 ? "muf-entity-photo" : "muf-entity-photo muf-entity-photo-noimg"} style={expense.receiptBase64 ? { backgroundImage: `url(${expense.receiptBase64})` } : undefined}>
                  {expense.receiptBase64 ? <img src={expense.receiptBase64} alt="" /> : <span className="muf-entity-emoji">💸</span>}
                  <span className="muf-entity-status" data-tone={expense.type === 'feed' ? 'info' : expense.type === 'medicine' ? 'warn' : 'muted'}>{expense.type}</span>
                  <span className="muf-entity-round-icon">💸</span>
                </div>
                <div className="muf-entity-body">
                  <div className="muf-entity-name">
                    <div style={{ minWidth: 0 }}>
                      <h4>₨ {expense.amount.toLocaleString()}</h4>
                      <p>{formatDate(expense.date)}{cow ? ` · ${cow.name}` : ' · Farm-wide'}</p>
                    </div>
                  </div>
                  <div className="muf-entity-stats">
                    <span><Calendar className="w-3 h-3"/> <span>{formatDate(expense.date)}</span></span>
                    <span className="text-[11px] text-slate-400">{L('Open details to view notes, supplier and receipt information.')}</span>
                  </div>
                  <div className="muf-entity-actions">
                    <button type="button" onClick={() => setSelectedExpense(expense)} className="muf-mini-icon" title={L('View details')} aria-label={L('View details')}><Eye className="w-3.5 h-3.5"/></button>
                    {isAdmin && <button type="button" onClick={() => handleEdit(expense)} className="muf-mini-icon" title={L('Edit expense')} aria-label={L('Edit expense')}><Edit2 className="w-3.5 h-3.5"/></button>}
                    {canDelete && <button type="button" onClick={() => handleDelete(expense._id)} className="muf-mini-icon text-red-500" title={L('Delete expense')} aria-label={L('Delete expense')}><Trash2 className="w-3.5 h-3.5"/></button>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Summary-first expense detail: the table/grid stay compact; supporting data is opened on demand. */}
      <DetailModal
        open={!!selectedExpense}
        onClose={() => setSelectedExpense(null)}
        title={L('Expense Details')}
        subtitle={selectedExpense ? `${formatDate(selectedExpense.date)} · ${L(selectedExpense.type)}` : undefined}
        icon={<Banknote className="w-5 h-5" />}
        iconBg="bg-farm-100 text-farm-700"
        size="small"
      >
        {selectedExpense && (() => {
          const cow = selectedExpense.cowId ? cows.find(item => item._id === selectedExpense.cowId) : null;
          const supplier = selectedExpense.supplierId ? suppliers.find(item => item._id === selectedExpense.supplierId) : null;
          return (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="muf-kpi-card">
                  <small>{L('Date')}</small>
                  <strong>{formatDate(selectedExpense.date)}</strong>
                </div>
                <div className="muf-kpi-card">
                  <small>{L('Type')}</small>
                  <strong><span className={`inline-flex px-2 py-1 rounded-full text-[10px] font-bold uppercase ${typeStyles[selectedExpense.type]}`}>{L(selectedExpense.type)}</span></strong>
                </div>
                <div className="muf-kpi-card col-span-2">
                  <small>{L('Amount')}</small>
                  <strong>₨ {selectedExpense.amount.toLocaleString()}</strong>
                </div>
                <div className="muf-kpi-card">
                  <small>{L('Cow')}</small>
                  <strong>{cow?.name || (selectedExpense.cowId ? L('Unknown') : L('Farm-wide'))}</strong>
                </div>
                <div className="muf-kpi-card">
                  <small>{L('Feed quantity')}</small>
                  <strong>{selectedExpense.feedKg ? `${selectedExpense.feedKg} kg` : '—'}</strong>
                </div>
              </div>
              {supplier && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">{L('Supplier')}</p>
                  <p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">{supplier.name}</p>
                  {supplier.phone && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{supplier.phone}</p>}
                </div>
              )}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{L('Note')}</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200">{selectedExpense.note?.trim() || L('No notes added.')}</p>
              </div>
              {selectedExpense.receiptBase64 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">{L('Receipt Photo')}</p>
                  <button type="button" onClick={() => setViewReceipt(selectedExpense.receiptBase64!)} className="block w-full rounded-xl overflow-hidden bg-white dark:bg-slate-950" aria-label={L('Open receipt photo')}>
                    <img src={selectedExpense.receiptBase64} alt={L('Receipt')} className="w-full max-h-56 object-contain" />
                  </button>
                </div>
              )}
              {(isAdmin || canDelete) && (
                <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  {isAdmin && (
                    <button type="button" onClick={() => { setSelectedExpense(null); handleEdit(selectedExpense); }} className="muf-btn muf-btn-primary">
                      <Edit2 className="w-3.5 h-3.5" /> {L('Edit Expense')}
                    </button>
                  )}
                  {canDelete && (
                    <button type="button" onClick={async () => { const deleted = await handleDelete(selectedExpense._id); if (deleted) setSelectedExpense(null); }} className="muf-btn muf-btn-danger">
                      <Trash2 className="w-3.5 h-3.5" /> {L('Delete Expense')}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </DetailModal>

      {/* Receipt photo lightbox */}
      {/* canDelete = real admin (App passes isAdmin there); workers keep logging expenses but the khata stays admin-only */}
      {canDelete && <SupplierKhata canDelete={canDelete} />}

      <DetailModal open={!!viewReceipt} onClose={() => setViewReceipt(null)} title={L('Receipt Photo')} size="big">
        <img src={viewReceipt || ''} alt="Receipt" className="w-full max-h-[70vh] object-contain rounded-2xl bg-white" />
      </DetailModal>

      {/* ── Zakat calculator (moved from Summary tab) ─────────── */}
      <ZakatCalculator expenses={expenses} />
    </div>
  );
};

export default ExpensesTab;
