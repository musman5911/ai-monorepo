import React, { useState, useEffect } from 'react';
import { L } from '../i18n';
import { compressToAvatar } from '../muf/ui/muf-avatar';
import { api } from '../api';
import { useConfirm, notify } from '../muf/core/muf-confirm';
import type { Cow, CowStatus } from '../types';
import { fmt, fmtPKR } from '../utils/format';
import { todayStr } from '../utils/date';
import {
  Plus, Edit2, Trash2, Save,
  CheckCircle2, Info, Tag, Activity, Banknote, Baby,
  Scale, CalendarDays, Eye, LayoutGrid, List, Clock, Droplets, User
} from 'lucide-react';
import DetailModal from '../muf/core/muf-modal';
import MufEntityGrid from '../muf/ui/muf-entity-grid';
import MufFab from '../muf/core/muf-fab';
import CowDetailPopup from './CowDetailPopup';
import {mufDateStr} from '../muf/data/muf-date';

interface CowsTabProps {
  isAdmin: boolean;
}

const statusColors: Record<CowStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
  dry: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
  pregnant: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
  inactive: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800',
  sold: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800',
  calf: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-900/20 dark:text-pink-400 dark:border-pink-800',
};

export default function CowsTab({ isAdmin }: CowsTabProps) {
  const confirmAction = useConfirm();
  const [cows, setCows] = useState<Cow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [statsData, setStatsData] = useState({ total: 0, female: 0, male: 0, active: 0, pregnant: 0, dry: 0, calf: 0, sold: 0 });
  const [mothers, setMothers] = useState<Cow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showCalfForm, setShowCalfForm] = useState(false);
  const [editingCow, setEditingCow] = useState<Cow | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CowStatus | 'all' | 'female' | 'male'>('all');
  const [batches, setBatches] = useState<string[]>([]);
  const [batchFilter, setBatchFilter] = useState('');
  const [saleCow, setSaleCow] = useState<Cow | null>(null);
  const [saleForm, setSaleForm] = useState({ date: todayStr(), salePrice: '', buyer: '', notes: '' });
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [detailCowId, setDetailCowId] = useState<string | null>(null);
  const [rate, setRate] = useState({ value: 0, date: '' });

  useEffect(() => {
    api.getRate().then((r: any) => { if (r) setRate({ value: r.value || 0, date: r.date || '' }); }).catch(() => {});
  }, []);

  const [formData, setFormData] = useState<Partial<Cow>>({
    name: '', breed: '', gender: 'female', status: 'active', birthDate: '', weight: undefined,
    lactationNumber: 0, notes: '', calvingDate: '', pregnancyDate: '', batch: '', image: '', purchasePrice: 0,
  });

  const [calfForm, setCalfForm] = useState({
    name: '', breed: '', gender: 'female' as 'female' | 'male', motherId: '', birthDate: todayStr(),
    weight: '', notes: '', nursingMonths: 2.5, purchasePrice: '',
  });

  const loadCows = async (append = false) => {
    try {
      if (append) setLoadingMore(true);
      else setLoading(true);
      const query = {
        page: append ? page + 1 : 1,
        limit: 50,
        search: search.trim() || undefined,
        batch: batchFilter || undefined,
        status: statusFilter !== 'all' && statusFilter !== 'female' && statusFilter !== 'male' ? statusFilter : undefined,
        gender: statusFilter === 'female' ? 'female' : statusFilter === 'male' ? 'male' : undefined,
      };
      const [pageData, batchData, stats, motherData] = await Promise.all([
        api.getCowPage(query),
        api.getCowBatches(),
        api.getCowStats(),
        api.getCowMothers(),
      ]);
      setCows(previous => {
        if (!append) return pageData.data;
        const known = new Set(previous.map(cow => cow._id));
        return [...previous, ...pageData.data.filter((cow: Cow) => !known.has(cow._id))];
      });
      setPage(pageData.page);
      setTotalCount(pageData.total);
      setHasMore(pageData.page < pageData.totalPages);
      setBatches(batchData);
      setStatsData(stats);
      setMothers(motherData);
    } catch (error) {
      console.error('Failed to load cows:', error);
      if (!append) notify(error instanceof Error ? error.message : 'Failed to load animals', 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadCows(false); }, 250);
    return () => window.clearTimeout(timer);
  }, [search, statusFilter, batchFilter]);

  useEffect(() => {
    const handleOfflineSynced = () => { void loadCows(false); };
    window.addEventListener('dm:offline-synced', handleOfflineSynced);
    return () => window.removeEventListener('dm:offline-synced', handleOfflineSynced);
  }, [search, statusFilter, batchFilter, page]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const wasEditing = !!editingCow;
      const savedCow = editingCow
        ? await api.updateCow(editingCow._id, formData)
        : await api.createCow(formData);
      // Reconcile the visible list from the successful write response first. The
      // follow-up fetch refreshes derived fields/batches without delaying the UI.
      if (editingCow) {
        setCows(prev => prev.map(c => c._id === editingCow._id ? { ...c, ...formData, ...(savedCow && typeof savedCow === 'object' ? savedCow : {}), _id: editingCow._id } as Cow : c));
      } else if (savedCow && typeof savedCow === 'object' && savedCow._id) {
        setCows(prev => [savedCow as Cow, ...prev.filter(c => c._id !== savedCow._id)]);
      }
      notify(savedCow?.offline ? 'Saved on this device. It will sync when internet returns.' : (wasEditing ? 'Animal updated successfully.' : 'Animal added successfully.'), savedCow?.offline ? 'info' : 'success');
      setShowForm(false);
      setEditingCow(null);
      resetForm();
      // Keep the successful server response as the source of truth for this render.
      // A background list request can race the write and restore stale records.
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Failed to save cow', 'error');
    }
  };

  const handleAddCalf = async (e: React.FormEvent) => {
    e.preventDefault();
    const mother = cows.find(c => c._id === calfForm.motherId);
    if (!mother) { notify(L('Select a mother cow'), 'error'); return; }
    const nursingBase = new Date(calfForm.birthDate + 'T00:00:00');
    nursingBase.setDate(nursingBase.getDate() + Math.round(calfForm.nursingMonths * 30));
    const nursingUntil = mufDateStr(nursingBase);
    try {
      const savedCalf = await api.createCow({
        name: calfForm.name,
        breed: calfForm.breed || mother.breed,
        gender: calfForm.gender,
        status: 'calf',
        birthDate: calfForm.birthDate,
        weight: calfForm.weight ? parseFloat(calfForm.weight) : undefined,
        motherId: calfForm.motherId,
        isCalf: true,
        nursingUntil,
        notes: calfForm.notes,
        lactationNumber: 0,
        purchasePrice: calfForm.purchasePrice ? parseFloat(calfForm.purchasePrice) : 0,
      });
      if (savedCalf && typeof savedCalf === 'object' && savedCalf._id) {
        setCows(prev => [savedCalf as Cow, ...prev.filter(c => c._id !== savedCalf._id)]);
      }
      notify(savedCalf?.offline ? 'Saved on this device. It will sync when internet returns.' : 'Calf added successfully.', savedCalf?.offline ? 'info' : 'success');
      setShowCalfForm(false);
      setCalfForm({ name: '', breed: '', gender: 'female', motherId: '', birthDate: todayStr(), weight: '', notes: '', nursingMonths: 2.5, purchasePrice: '' });
      // The newly-created calf is already reconciled into local state above.
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Failed to add calf', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmAction({
      title: L('Delete Animal'),
      message: L('Delete this animal AND all linked milk, expenses, health, and sales records? This cannot be undone.'),
      confirmLabel: L('Delete'),
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const deleteResult = await api.deleteCow(id);
      // Only remove after the server confirms deletion (or the offline queue accepts it).
      setCows(prev => prev.filter(c => c._id !== id));
      setDetailCowId(current => current === id ? null : current);
      notify(deleteResult?.offline ? 'Delete queued on this device. It will sync when internet returns.' : 'Animal deleted successfully.', deleteResult?.offline ? 'info' : 'success');
      // Do not immediately refetch: some deployments briefly return a stale list after DELETE.
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Failed to delete', 'error');
    }
  };

  const handleRecordSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleCow) return;
    const price = parseFloat(saleForm.salePrice);
    if (!price || price <= 0) { notify(L('Enter a valid sale price'), 'error'); return; }
    try {
      await api.addSale({ cowId: saleCow._id, date: saleForm.date, salePrice: price, buyer: saleForm.buyer, notes: saleForm.notes });
      setSaleCow(null);
      setSaleForm({ date: todayStr(), salePrice: '', buyer: '', notes: '' });
      loadCows();
    } catch (error) { notify(error instanceof Error ? error.message : 'Failed to record sale', 'error'); }
  };

  const handleEdit = (cow: Cow) => {
    setEditingCow(cow);
    setFormData({
      name: cow.name, breed: cow.breed, gender: cow.gender || 'female', status: cow.status, birthDate: cow.birthDate || '',
      weight: cow.weight, lactationNumber: cow.lactationNumber || 0, notes: cow.notes || '',
      calvingDate: cow.calvingDate || '', pregnancyDate: cow.pregnancyDate || '', batch: cow.batch || '', image: cow.image || '', purchasePrice: cow.purchasePrice || 0,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({ name: '', breed: '', gender: 'female', status: 'active', birthDate: '', weight: undefined, lactationNumber: 0, notes: '', calvingDate: '', pregnancyDate: '', batch: '', image: '', purchasePrice: 0 });
    setEditingCow(null);
  };

  const stats = statsData;

  const statCards = [
    { label: 'Total', value: stats.total, filter: 'all' as const, icon: Tag, color: 'text-slate-600' },
    { label: 'Cows', value: stats.female, filter: 'female' as const, icon: CheckCircle2, color: 'text-emerald-600' },
    { label: 'Bulls', value: stats.male, filter: 'male' as const, icon: Banknote, color: 'text-amber-600' },
    { label: 'Active', value: stats.active, filter: 'active' as const, icon: CheckCircle2, color: 'text-emerald-600' },
    { label: 'Pregnant', value: stats.pregnant, filter: 'pregnant' as const, icon: Activity, color: 'text-blue-600' },
    { label: 'Dry', value: stats.dry, filter: 'dry' as const, icon: Info, color: 'text-amber-600' },
    { label: 'Calves', value: stats.calf, filter: 'calf' as const, icon: Baby, color: 'text-pink-600' },
    { label: 'Sold', value: stats.sold, filter: 'sold' as const, icon: Banknote, color: 'text-purple-600' },
  ];

  const filteredCows = cows;

  const activeMothers = mothers;

  // ── Grid view items (muf-entity-grid) ─────────────
  const statusToneMap: Record<CowStatus, 'good' | 'warn' | 'bad' | 'info' | 'muted'> = {
    active: 'good', pregnant: 'info', dry: 'warn', calf: 'good', sold: 'muted', inactive: 'muted',
  };
  const gridItems = filteredCows.map((cow) => {
    const mother = cow.motherId ? [...cows, ...mothers].find(c => c._id === cow.motherId) : null;
    const dayDiff = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
    const today = todayStr();
    const ageMonths = cow.birthDate ? Math.max(1, Math.round(dayDiff(cow.birthDate, today) / 30.44)) : 0;
    const ageText = ageMonths ? (ageMonths < 12 ? `Age ${ageMonths} mo` : `Age ${cow.ageYears ? cow.ageYears.toFixed(1) : (ageMonths / 12).toFixed(1)} yr`) : 'Age —';
    const calvingDays = cow.calvingDate ? dayDiff(cow.calvingDate, today) : null;
    const calvingText = calvingDays == null || calvingDays < 0 ? 'Not calved yet' : calvingDays < 30 ? `Calved ${calvingDays}d ago` : `Calved ${Math.round(calvingDays / 30.44)} mo ago`;
    return {
      id: cow._id,
      photo: cow.image || null,
      emoji: cow.gender === 'male' ? '🐂' : '🐄',
      name: cow.name,
      sub: cow.breed || '—',
      chip: cow.isCalf ? 'CALF' : (cow.batch || undefined),
      status: cow.status,
      statusTone: statusToneMap[cow.status],
      stats: [
        { icon: <Scale size={14} />, text: cow.weight ? `${fmt(cow.weight)} kg` : 'Weight —' },
        { icon: <Clock size={14} />, text: ageText },
        { icon: <User size={14} />, text: cow.gender === 'male' ? 'Bull' : 'Cow' },
        { icon: <Baby size={14} />, text: calvingText },
        { icon: <Droplets size={14} />, text: cow.lactationNumber ? `Lact ${cow.lactationNumber}` : 'No lactation' },
        { icon: <Banknote size={14} />, text: cow.purchasePrice ? fmtPKR(cow.purchasePrice) : 'No price' },
        { icon: <CalendarDays size={14} />, text: mother ? `Mother: ${mother.name}` : (cow.batch ? `Batch ${cow.batch}` : 'No batch') },
      ],
      actions: (
        <>
          <button onClick={() => setDetailCowId(cow._id)} className="muf-detail-btn"><Eye size={15}/> {L('Details')}</button>
          {isAdmin && cow.status !== 'sold' && (
            <button onClick={() => setSaleCow(cow)} className="muf-record-btn"><Banknote size={15}/> {L('Sale')}</button>
          )}
          {isAdmin && (
            <>
              <button onClick={() => handleEdit(cow)} className="muf-record-btn"><Edit2 size={15}/> {L('Edit')}</button>
              <button onClick={() => handleDelete(cow._id)} className="muf-mini-icon danger" title={L('Delete')} aria-label={L('Delete cow')}><Trash2 size={15}/></button>
            </>
          )}
        </>
      ),
    };
  });

  return (
    <div className="space-y-6 tab-panel">
      {/* ── Clickable Stat Cards ──────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {statCards.map((card) => {
          const isActive = statusFilter === card.filter;
          return (
            <button key={card.filter} onClick={() => setStatusFilter(isActive ? 'all' : card.filter)}
              className={`bg-white dark:bg-slate-900 rounded-xl border shadow-sm p-2 sm:p-3 text-left transition-all cursor-pointer min-w-0 ${
                isActive ? 'border-farm-500 ring-2 ring-farm-500/20 dark:border-farm-400' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}>
              <p className="text-slate-500 dark:text-slate-400 text-[9px] sm:text-[10px] leading-tight break-words">{card.label}</p>
              <p className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 leading-tight">{card.value}</p>
            </button>
          );
        })}
      </div>

      {/* ── Filter Bar ────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        <input type="text" placeholder={L('Search by name or ID...')} className="w-full md:w-64 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-farm-500" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {batches.length > 0 && (
            <select className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none" value={batchFilter} onChange={e => setBatchFilter(e.target.value)}>
              <option value="">{L('All Batches')}</option>
              {batches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
          <div className="muf-view-toggle" title={L('Toggle view')}>
            <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')}><LayoutGrid className="w-3.5 h-3.5" /> {L('Grid')}</button>
            <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}><List className="w-3.5 h-3.5" /> {L('List')}</button>
          </div>
          {isAdmin && (
            <>
            </>
          )}
        </div>
      </div>

      {/* ── Add/Edit Form (popup) ─────────────── */}
      <DetailModal open={showForm} onClose={() => { setShowForm(false); resetForm(); }}
        title={editingCow ? L('Edit Animal') : L('Add New Animal')}
        icon={<Plus className="w-5 h-5" />} iconBg="bg-farm-100 text-farm-700" size="small">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={L('Name *')} children={<input required className="muf-field" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />} />
            <Field label={L('Breed *')} children={<input required className="muf-field" value={formData.breed} onChange={e => setFormData({ ...formData, breed: e.target.value })} />} />
            <Field label={L('Gender')} children={
              <select className="muf-field" value={formData.gender || 'female'} onChange={e => setFormData({ ...formData, gender: e.target.value as 'female' | 'male' })}>
                <option value="female">{L('Female (Cow)')}</option>
                <option value="male">{L('Male (Bull)')}</option>
              </select>
            } />
            <Field label={L('Status')} children={
              <select className="muf-field" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as CowStatus })}>
                <option value="active">{L('Active')}</option>
                {formData.gender !== 'male' && <><option value="dry">{L('Dry')}</option><option value="pregnant">{L('Pregnant')}</option></>}
                <option value="inactive">{L('Inactive')}</option>
              </select>
            } />
            <Field label={L('Birth Date')} children={<input type="date" className="muf-field" value={formData.birthDate} onChange={e => setFormData({ ...formData, birthDate: e.target.value })} />} />
            <Field label={L('Weight (kg)')} children={<input type="number" className="muf-field" value={formData.weight || ''} onChange={e => setFormData({ ...formData, weight: parseFloat(e.target.value) || undefined })} />} />
            <Field label={L('Purchase Price (₨)')} children={<input type="number" className="muf-field" placeholder="e.g. 150000" value={formData.purchasePrice || ''} onChange={e => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })} />} />
            {formData.gender !== 'male' && (
              <>
                <Field label={L('Lactation #')} children={<input type="number" className="muf-field" value={formData.lactationNumber || 0} onChange={e => setFormData({ ...formData, lactationNumber: parseInt(e.target.value) || 0 })} />} />
                <Field label={L('Calving Date')} children={<input type="date" className="muf-field" value={formData.calvingDate} onChange={e => setFormData({ ...formData, calvingDate: e.target.value })} />} />
                <Field label={L('Pregnancy Date')} children={<input type="date" className="muf-field" value={formData.pregnancyDate} onChange={e => setFormData({ ...formData, pregnancyDate: e.target.value })} />} />
              </>
            )}
            <Field label={L('Batch')} children={<input className="muf-field" placeholder={L('e.g. Jan 2026 Batch')} value={formData.batch} onChange={e => setFormData({ ...formData, batch: e.target.value })} />} />
            <Field label={L('Photo (upload or URL)')} children={
              <div className="flex items-center gap-2">
                {formData.image && (
                  <img src={formData.image} alt="Cow" className="w-9 h-9 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                )}
                <input className="muf-field" placeholder={L('Paste image link or upload →')} value={(formData.image || '').startsWith('data:image/') ? '(uploaded photo)' : (formData.image || '')} onChange={e => setFormData({ ...formData, image: e.target.value })} readOnly={(formData.image || '').startsWith('data:image/')} />
                <label className="shrink-0 cursor-pointer bg-farm-600 hover:bg-farm-700 text-white rounded-lg px-2.5 py-2 text-xs font-semibold" title="Upload a photo (compressed & stored in the DB — a new photo replaces the old one, no space wasted)">
                  📷
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    (e.target as HTMLInputElement).value = '';
                    if (!file) return;
                    try {
                      const base64 = await compressToAvatar(file, 384, 0.8);
                      setFormData((prev) => ({ ...prev, image: base64 }));
                    } catch { notify(L('Could not read that image file.'), 'error'); }
                  }} />
                </label>
                {formData.image && (
                  <button type="button" onClick={() => setFormData((prev) => ({ ...prev, image: '' }))} title={L('Remove photo')} className="shrink-0 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 text-red-500 rounded-lg px-2.5 py-2 text-xs font-semibold">✕</button>
                )}
              </div>
            } />
            <div className="md:col-span-3"><Field label={L('Notes')} children={<textarea rows={2} className="muf-field" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />} /></div>
            <div className="md:col-span-3 flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">{L('Cancel')}</button>
              <button type="submit" className="bg-farm-600 hover:bg-farm-700 text-white rounded-lg px-6 py-2 text-sm font-medium flex items-center gap-2"><Save className="h-4 w-4" /> {editingCow ? L('Update') : L('Save')}</button>
            </div>
          </form>
      </DetailModal>

      {/* ── Add Calf Form (popup) ─────────────── */}
      <DetailModal open={showCalfForm} onClose={() => setShowCalfForm(false)}
        title={L('Add Calf')}
        icon={<Baby className="w-5 h-5" />} iconBg="bg-pink-100 text-pink-700" size="small">
        <form onSubmit={handleAddCalf} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={L('Calf Name *')} children={<input required className="muf-field" value={calfForm.name} onChange={e => setCalfForm({ ...calfForm, name: e.target.value })} />} />
            <Field label={L('Gender *')} children={
              <select required className="muf-field" value={calfForm.gender} onChange={e => setCalfForm({ ...calfForm, gender: e.target.value as 'female' | 'male' })}>
                <option value="female">{L('Female (Heifer)')}</option>
                <option value="male">{L('Male (Bull calf)')}</option>
              </select>
            } />
            <Field label={L('Mother Cow *')} children={
              <select required className="muf-field" value={calfForm.motherId} onChange={e => setCalfForm({ ...calfForm, motherId: e.target.value })}>
                <option value="">{L('Select mother')}</option>
                {activeMothers.map(c => <option key={c._id} value={c._id}>{c.name} ({c.breed})</option>)}
              </select>
            } />
            <Field label={L('Breed (auto from mother)')} children={<input className="muf-field" placeholder={L('Auto if blank')} value={calfForm.breed} onChange={e => setCalfForm({ ...calfForm, breed: e.target.value })} />} />
            <Field label={L('Birth Date *')} children={<input type="date" required className="muf-field" value={calfForm.birthDate} onChange={e => setCalfForm({ ...calfForm, birthDate: e.target.value })} />} />
            <Field label={L('Weight (kg)')} children={<input type="number" className="muf-field" value={calfForm.weight} onChange={e => setCalfForm({ ...calfForm, weight: e.target.value })} />} />
            <Field label={L('Purchase Price (₨)')} children={<input type="number" className="muf-field" placeholder="e.g. 50000" value={calfForm.purchasePrice} onChange={e => setCalfForm({ ...calfForm, purchasePrice: e.target.value })} />} />
            <Field label={L('Nursing Period (months)')} children={<input type="number" step="0.5" className="muf-field" value={calfForm.nursingMonths} onChange={e => setCalfForm({ ...calfForm, nursingMonths: parseFloat(e.target.value) || 2.5 })} />} />
            <div className="md:col-span-3"><Field label={L('Notes')} children={<textarea rows={2} className="muf-field" value={calfForm.notes} onChange={e => setCalfForm({ ...calfForm, notes: e.target.value })} />} /></div>
            <div className="md:col-span-3 flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowCalfForm(false)} className="muf-pc-btn-ghost">{L('Cancel')}</button>
              <button type="submit" className="bg-pink-600 hover:bg-pink-700 text-white rounded-lg px-6 py-2 text-sm font-medium flex items-center gap-2"><Baby className="h-4 w-4" /> {L('Add Calf')}</button>
            </div>
          </form>
      </DetailModal>

      {/* ── Grid / List ────────────────────────── */}
      {view === 'grid' ? (
        <MufEntityGrid
          items={gridItems}
          onOpen={(it) => setDetailCowId(String(it.id))}
          emptyIcon={<Tag size={36} />}
          emptyTitle="No animals found"
          emptyHint="Try clearing the filters or add your first animal."
        />
      ) : (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">{L('Name')}</th>
                <th className="px-5 py-3">{L('Breed')}</th>
                <th className="px-5 py-3">{L('Gender')}</th>
                <th className="px-5 py-3">{L('Status')}</th>
                <th className="px-5 py-3">{L('Batch')}</th>
                <th className="px-5 py-3">{L('Mother')}</th>
                <th className="px-5 py-3">{L('Weight')}</th>
                <th className="px-5 py-3 text-right">{L('Purchase')}</th>
                <th className="px-5 py-3 text-right">{L('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={9} className="px-5 py-12 text-center text-slate-400">{L('Loading...')}</td></tr>
              ) : filteredCows.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-12 text-center text-slate-400">{L('No animals found')}</td></tr>
              ) : (
                filteredCows.map(cow => {
                  const mother = cow.motherId ? cows.find(c => c._id === cow.motherId) : null;
                  const isMale = cow.gender === 'male';
                  return (
                    <tr
                      key={cow._id}
                      onClick={() => setDetailCowId(cow._id)}
                      onKeyDown={event => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setDetailCowId(cow._id);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`${L('Open cow details')}: ${cow.name}`}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-farm-500 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <CowImg src={cow.image} name={cow.name} />
                          <div>
                            <p className="text-sm font-medium text-stone-800 dark:text-stone-100">{cow.name}</p>
                            {cow.isCalf && <span className="text-[10px] text-pink-500">(calf)</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-600 dark:text-slate-400">{cow.breed}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          isMale ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
                                 : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                        }`}>
                          {isMale ? '🐂 Bull' : '🐄 Cow'}
                        </span>
                      </td>
                      <td className="px-5 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColors[cow.status]}`}>{cow.status}</span></td>
                      <td className="px-5 py-3 text-xs text-slate-500">{cow.batch || '-'}</td>
                      <td className="px-5 py-3 text-xs text-slate-500">{mother ? mother.name : '-'}</td>
                      <td className="px-5 py-3 text-sm text-slate-600 dark:text-slate-400">{cow.weight ? `${fmt(cow.weight)} kg` : '-'}</td>
                      <td className="px-5 py-3 text-sm text-amber-600 text-right">{cow.purchasePrice ? fmtPKR(cow.purchasePrice) : '-'}</td>
                      <td className="px-5 py-3 text-right">
                        {isAdmin && (
                          <div className="flex justify-end gap-1.5">
                            {cow.status !== 'sold' && (
                              <button onClick={(e) => { e.stopPropagation(); setSaleCow(cow); }} className="p-1.5 text-slate-400 hover:text-purple-600" title={L('Record Sale')}><Banknote className="h-4 w-4" /></button>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); handleEdit(cow); }} className="p-1.5 text-slate-400 hover:text-farm-600" title={L('Edit')}><Edit2 className="h-4 w-4" /></button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(cow._id); }} className="p-1.5 text-slate-400 hover:text-red-500" title={L('Delete')}><Trash2 className="h-4 w-4" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {hasMore && (
        <div className="flex flex-col items-center gap-2 py-3">
          <p className="text-xs text-slate-500">{cows.length} of {totalCount} animals loaded</p>
          <button type="button" onClick={() => { void loadCows(true); }} disabled={loadingMore || loading}
            className="muf-btn muf-btn-secondary disabled:opacity-50">
            {loadingMore ? L('Loading...') : L('Load 50 More Animals')}
          </button>
        </div>
      )}

      {/* ── Sale Modal ────────────────────────── */}
      {saleCow && (
        <DetailModal open onClose={() => setSaleCow(null)} title={`Record Sale — ${saleCow.name} ${saleCow.gender === 'male' ? '🐂' : '🐄'}`} size="small">
          <form onSubmit={handleRecordSale} className="space-y-4">
            <Field label={L('Sale Date *')} children={<input required type="date" className="muf-field" value={saleForm.date} onChange={e => setSaleForm({ ...saleForm, date: e.target.value })} />} />
            <Field label={L('Sale Price (₨) *')} children={<input required type="number" min="1" className="muf-field" value={saleForm.salePrice} onChange={e => setSaleForm({ ...saleForm, salePrice: e.target.value })} />} />
            <Field label={L('Buyer')} children={<input className="muf-field" value={saleForm.buyer} onChange={e => setSaleForm({ ...saleForm, buyer: e.target.value })} />} />
            <Field label={L('Notes')} children={<textarea rows={2} className="muf-field" value={saleForm.notes} onChange={e => setSaleForm({ ...saleForm, notes: e.target.value })} />} />
            <div className="muf-pc-actions">
              <button type="button" onClick={() => setSaleCow(null)} className="muf-pc-btn-ghost">{L('Cancel')}</button>
              <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-6 py-2 text-sm font-medium flex items-center gap-2"><Banknote className="h-4 w-4" /> {L('Record Sale')}</button>
            </div>
          </form>
        </DetailModal>
      )}

      {/* ── Cow Detail (any card / row click) ───── */}
      {detailCowId && (
        <CowDetailPopup cowId={detailCowId} rate={rate.value} rateDate={rate.date} isAdmin={isAdmin} onClose={() => setDetailCowId(null)} onCowUpdated={(updatedCow) => setCows(prev => prev.map(c => c._id === updatedCow._id ? { ...c, ...updatedCow } : c))} />
      )}

      {/* FAB — Add Animal / Add Calf */}
      {isAdmin && (
        <MufFab actions={[
          { icon: <Plus size={18} />, label: L('Add Animal'), onClick: () => { setShowForm(true); setShowCalfForm(false); } },
          { icon: <Baby size={18} />, label: L('Add Calf'), onClick: () => { setShowCalfForm(true); setShowForm(false); } },
        ]} />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><label className="text-stone-500 dark:text-stone-400 text-xs">{label}</label>{children}</div>;
}

function CowImg({ src, name, size = 'w-8 h-8' }: { src?: string; name: string; size?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return <div className={`${size} rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-sm shrink-0`}>🐄</div>;
  }
  return <img src={src} alt={name} className={`${size} rounded-full object-cover border border-stone-200 dark:border-stone-700 shrink-0`} onError={() => setBroken(true)} />;
}
