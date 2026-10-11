import React, { useState, useEffect } from 'react';
import { L } from '../i18n';
import { compressToAvatar } from '../muf-avatar';
import { api } from '../api';
import { useConfirm, notify } from '../muf-confirm';
import type { Cow, CowStatus } from '../types';
import { fmt, fmtPKR } from '../utils/format';
import { todayStr } from '../utils/date';
import {
  Plus, Edit2, Trash2, Save,
  CheckCircle2, Info, Tag, Activity, Banknote, Baby,
  Scale, CalendarDays, Eye, LayoutGrid, List, Clock, Droplets, User
} from 'lucide-react';
import DetailModal from '../muf-modal';
import MufEntityGrid from '../muf-entity-grid';
import MufFab from '../muf-fab';
import CowDetailPopup from './CowDetailPopup';
import {mufDateStr} from '../muf-date';

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

  const loadCows = async () => {
    try {
      setLoading(true);
      const [data, batchData] = await Promise.all([api.getCows(), api.getCowBatches()]);
      setCows(data);
      setBatches(batchData);
    } catch (error) {
      console.error('Failed to load cows:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCows(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const wasEditing = !!editingCow;
      if (editingCow) {
        await api.updateCow(editingCow._id, formData);
      } else {
        await api.createCow(formData);
      }
      notify(wasEditing ? 'Animal updated successfully.' : 'Animal added successfully.', 'success');
      if (wasEditing && editingCow) setCows(prev => prev.map(c => c._id === editingCow._id ? { ...c, ...formData } as Cow : c));
      setShowForm(false);
      setEditingCow(null);
      resetForm();
      await loadCows();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Failed to save cow', 'error');
    }
  };

  const handleAddCalf = async (e: React.FormEvent) => {
    e.preventDefault();
    const mother = cows.find(c => c._id === calfForm.motherId);
    if (!mother) { notify('Select a mother cow', 'error'); return; }
    const nursingBase = new Date(calfForm.birthDate + 'T00:00:00');
    nursingBase.setDate(nursingBase.getDate() + Math.round(calfForm.nursingMonths * 30));
    const nursingUntil = mufDateStr(nursingBase);
    try {
      await api.createCow({
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
      notify('Calf added successfully.', 'success');
      setShowCalfForm(false);
      setCalfForm({ name: '', breed: '', gender: 'female', motherId: '', birthDate: todayStr(), weight: '', notes: '', nursingMonths: 2.5, purchasePrice: '' });
      await loadCows();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Failed to add calf', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmAction({
      title: 'Delete Animal',
      message: 'Delete this animal AND all linked milk, expenses, health, and sales records? This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try { await api.deleteCow(id); setCows(prev => prev.filter(c => c._id !== id)); setDetailCowId(current => current === id ? null : current); notify('Animal deleted successfully.', 'success'); void loadCows(); } catch (error) { notify(error instanceof Error ? error.message : 'Failed to delete', 'error'); }
  };

  const handleRecordSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleCow) return;
    const price = parseFloat(saleForm.salePrice);
    if (!price || price <= 0) { notify('Enter a valid sale price', 'error'); return; }
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

  const stats = {
    total: cows.length,
    female: cows.filter(c => c.gender !== 'male').length,
    male: cows.filter(c => c.gender === 'male').length,
    active: cows.filter(c => c.status === 'active').length,
    pregnant: cows.filter(c => c.status === 'pregnant').length,
    dry: cows.filter(c => c.status === 'dry').length,
    calf: cows.filter(c => c.status === 'calf').length,
    sold: cows.filter(c => c.status === 'sold').length,
  };

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

  const filteredCows = cows.filter(cow => {
    const matchesSearch = cow.name.toLowerCase().includes(search.toLowerCase()) || cow._id.toLowerCase().includes(search.toLowerCase());
    let matchesFilter = true;
    if (statusFilter === 'female') matchesFilter = cow.gender !== 'male';
    else if (statusFilter === 'male') matchesFilter = cow.gender === 'male';
    else if (statusFilter !== 'all') matchesFilter = cow.status === statusFilter;
    const matchesBatch = !batchFilter || cow.batch === batchFilter;
    return matchesSearch && matchesFilter && matchesBatch;
  });

  const activeMothers = cows.filter(c => (c.status === 'active' || c.status === 'dry') && c.gender !== 'male');

  // ── Grid view items (muf-entity-grid) ─────────────
  const statusToneMap: Record<CowStatus, 'good' | 'warn' | 'bad' | 'info' | 'muted'> = {
    active: 'good', pregnant: 'info', dry: 'warn', calf: 'good', sold: 'muted', inactive: 'muted',
  };
  const gridItems = filteredCows.map((cow) => {
    const mother = cow.motherId ? cows.find(c => c._id === cow.motherId) : null;
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
          <button onClick={() => setDetailCowId(cow._id)} className="muf-detail-btn"><Eye size={15}/> Details</button>
          {isAdmin && cow.status !== 'sold' && (
            <button onClick={() => setSaleCow(cow)} className="muf-record-btn"><Banknote size={15}/> Sale</button>
          )}
          {isAdmin && (
            <>
              <button onClick={() => handleEdit(cow)} className="muf-record-btn"><Edit2 size={15}/> Edit</button>
              <button onClick={() => handleDelete(cow._id)} className="muf-mini-icon danger" title="Delete" aria-label="Delete cow"><Trash2 size={15}/></button>
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
              className={`bg-white dark:bg-slate-900 rounded-xl border shadow-sm p-3 text-left transition-all cursor-pointer ${
                isActive ? 'border-farm-500 ring-2 ring-farm-500/20 dark:border-farm-400' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}>
              <p className="text-slate-500 dark:text-slate-400 text-[10px]">{card.label}</p>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{card.value}</p>
            </button>
          );
        })}
      </div>

      {/* ── Filter Bar ────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        <input type="text" placeholder="Search by name or ID..." className="w-full md:w-64 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-farm-500" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {batches.length > 0 && (
            <select className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none" value={batchFilter} onChange={e => setBatchFilter(e.target.value)}>
              <option value="">{L('All Batches')}</option>
              {batches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
          <div className="muf-view-toggle" title="Toggle view">
            <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')}><LayoutGrid className="w-3.5 h-3.5" /> Grid</button>
            <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}><List className="w-3.5 h-3.5" /> List</button>
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
            <Field label="Name *" children={<input required className="inp" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />} />
            <Field label="Breed *" children={<input required className="inp" value={formData.breed} onChange={e => setFormData({ ...formData, breed: e.target.value })} />} />
            <Field label="Gender" children={
              <select className="inp" value={formData.gender || 'female'} onChange={e => setFormData({ ...formData, gender: e.target.value as 'female' | 'male' })}>
                <option value="female">Female (Cow)</option>
                <option value="male">Male (Bull)</option>
              </select>
            } />
            <Field label="Status" children={
              <select className="inp" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as CowStatus })}>
                <option value="active">Active</option>
                {formData.gender !== 'male' && <><option value="dry">Dry</option><option value="pregnant">Pregnant</option></>}
                <option value="inactive">Inactive</option>
              </select>
            } />
            <Field label="Birth Date" children={<input type="date" className="inp" value={formData.birthDate} onChange={e => setFormData({ ...formData, birthDate: e.target.value })} />} />
            <Field label="Weight (kg)" children={<input type="number" className="inp" value={formData.weight || ''} onChange={e => setFormData({ ...formData, weight: parseFloat(e.target.value) || undefined })} />} />
            <Field label="Purchase Price (₨)" children={<input type="number" className="inp" placeholder="e.g. 150000" value={formData.purchasePrice || ''} onChange={e => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })} />} />
            {formData.gender !== 'male' && (
              <>
                <Field label="Lactation #" children={<input type="number" className="inp" value={formData.lactationNumber || 0} onChange={e => setFormData({ ...formData, lactationNumber: parseInt(e.target.value) || 0 })} />} />
                <Field label="Calving Date" children={<input type="date" className="inp" value={formData.calvingDate} onChange={e => setFormData({ ...formData, calvingDate: e.target.value })} />} />
                <Field label="Pregnancy Date" children={<input type="date" className="inp" value={formData.pregnancyDate} onChange={e => setFormData({ ...formData, pregnancyDate: e.target.value })} />} />
              </>
            )}
            <Field label="Batch" children={<input className="inp" placeholder="e.g. Jan 2026 Batch" value={formData.batch} onChange={e => setFormData({ ...formData, batch: e.target.value })} />} />
            <Field label="Photo (upload or URL)" children={
              <div className="flex items-center gap-2">
                {formData.image && (
                  <img src={formData.image} alt="Cow" className="w-9 h-9 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                )}
                <input className="inp" placeholder="Paste image link or upload →" value={(formData.image || '').startsWith('data:image/') ? '(uploaded photo)' : (formData.image || '')} onChange={e => setFormData({ ...formData, image: e.target.value })} readOnly={(formData.image || '').startsWith('data:image/')} />
                <label className="shrink-0 cursor-pointer bg-farm-600 hover:bg-farm-700 text-white rounded-lg px-2.5 py-2 text-xs font-semibold" title="Upload a photo (compressed & stored in the DB — a new photo replaces the old one, no space wasted)">
                  📷
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    (e.target as HTMLInputElement).value = '';
                    if (!file) return;
                    try {
                      const base64 = await compressToAvatar(file, 384, 0.8);
                      setFormData((prev) => ({ ...prev, image: base64 }));
                    } catch { notify('Could not read that image file.', 'error'); }
                  }} />
                </label>
                {formData.image && (
                  <button type="button" onClick={() => setFormData((prev) => ({ ...prev, image: '' }))} title="Remove photo" className="shrink-0 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 text-red-500 rounded-lg px-2.5 py-2 text-xs font-semibold">✕</button>
                )}
              </div>
            } />
            <div className="md:col-span-3"><Field label="Notes" children={<textarea rows={2} className="inp" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />} /></div>
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
            <Field label="Calf Name *" children={<input required className="inp" value={calfForm.name} onChange={e => setCalfForm({ ...calfForm, name: e.target.value })} />} />
            <Field label="Gender *" children={
              <select required className="inp" value={calfForm.gender} onChange={e => setCalfForm({ ...calfForm, gender: e.target.value as 'female' | 'male' })}>
                <option value="female">Female (Heifer)</option>
                <option value="male">Male (Bull calf)</option>
              </select>
            } />
            <Field label="Mother Cow *" children={
              <select required className="inp" value={calfForm.motherId} onChange={e => setCalfForm({ ...calfForm, motherId: e.target.value })}>
                <option value="">Select mother</option>
                {activeMothers.map(c => <option key={c._id} value={c._id}>{c.name} ({c.breed})</option>)}
              </select>
            } />
            <Field label="Breed (auto from mother)" children={<input className="inp" placeholder="Auto if blank" value={calfForm.breed} onChange={e => setCalfForm({ ...calfForm, breed: e.target.value })} />} />
            <Field label="Birth Date *" children={<input type="date" required className="inp" value={calfForm.birthDate} onChange={e => setCalfForm({ ...calfForm, birthDate: e.target.value })} />} />
            <Field label="Weight (kg)" children={<input type="number" className="inp" value={calfForm.weight} onChange={e => setCalfForm({ ...calfForm, weight: e.target.value })} />} />
            <Field label="Purchase Price (₨)" children={<input type="number" className="inp" placeholder="e.g. 50000" value={calfForm.purchasePrice} onChange={e => setCalfForm({ ...calfForm, purchasePrice: e.target.value })} />} />
            <Field label="Nursing Period (months)" children={<input type="number" step="0.5" className="inp" value={calfForm.nursingMonths} onChange={e => setCalfForm({ ...calfForm, nursingMonths: parseFloat(e.target.value) || 2.5 })} />} />
            <div className="md:col-span-3"><Field label="Notes" children={<textarea rows={2} className="inp" value={calfForm.notes} onChange={e => setCalfForm({ ...calfForm, notes: e.target.value })} />} /></div>
            <div className="md:col-span-3 flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowCalfForm(false)} className="px-4 py-2 text-sm text-slate-600">{L('Cancel')}</button>
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
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Breed</th>
                <th className="px-5 py-3">Gender</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Batch</th>
                <th className="px-5 py-3">Mother</th>
                <th className="px-5 py-3">Weight</th>
                <th className="px-5 py-3 text-right">Purchase</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={9} className="px-5 py-12 text-center text-slate-400">Loading...</td></tr>
              ) : filteredCows.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-12 text-center text-slate-400">No animals found</td></tr>
              ) : (
                filteredCows.map(cow => {
                  const mother = cow.motherId ? cows.find(c => c._id === cow.motherId) : null;
                  const isMale = cow.gender === 'male';
                  return (
                    <tr key={cow._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer" onClick={() => setDetailCowId(cow._id)}>
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
                              <button onClick={(e) => { e.stopPropagation(); setSaleCow(cow); }} className="p-1.5 text-slate-400 hover:text-purple-600" title="Record Sale"><Banknote className="h-4 w-4" /></button>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); handleEdit(cow); }} className="p-1.5 text-slate-400 hover:text-farm-600" title="Edit"><Edit2 className="h-4 w-4" /></button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(cow._id); }} className="p-1.5 text-slate-400 hover:text-red-500" title="Delete"><Trash2 className="h-4 w-4" /></button>
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

      {/* ── Sale Modal ────────────────────────── */}
      {saleCow && (
        <DetailModal open onClose={() => setSaleCow(null)} title={`Record Sale — ${saleCow.name} ${saleCow.gender === 'male' ? '🐂' : '🐄'}`} size="small">
          <form onSubmit={handleRecordSale} className="space-y-4">
            <Field label="Sale Date *" children={<input required type="date" className="inp" value={saleForm.date} onChange={e => setSaleForm({ ...saleForm, date: e.target.value })} />} />
            <Field label="Sale Price (₨) *" children={<input required type="number" min="1" className="inp" value={saleForm.salePrice} onChange={e => setSaleForm({ ...saleForm, salePrice: e.target.value })} />} />
            <Field label="Buyer" children={<input className="inp" value={saleForm.buyer} onChange={e => setSaleForm({ ...saleForm, buyer: e.target.value })} />} />
            <Field label="Notes" children={<textarea rows={2} className="inp" value={saleForm.notes} onChange={e => setSaleForm({ ...saleForm, notes: e.target.value })} />} />
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setSaleCow(null)} className="px-4 py-2 text-sm text-slate-600">{L('Cancel')}</button>
              <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-6 py-2 text-sm font-medium flex items-center gap-2"><Banknote className="h-4 w-4" /> Record Sale</button>
            </div>
          </form>
        </DetailModal>
      )}

      <style>{`.inp{width:100%;border:1px solid #e2e8f0;border-radius:0.5rem;padding:0.5rem 0.75rem;font-size:0.875rem;background:white;outline:none}.inp:focus{border-color:#1b854a}.dark .inp{background:#0f172a;border-color:#334155;color:#e2e8f0}`}</style>
      {/* ── Cow Detail (any card / row click) ───── */}
      {detailCowId && (
        <CowDetailPopup cowId={detailCowId} rate={rate.value} rateDate={rate.date} isAdmin={isAdmin} onClose={() => setDetailCowId(null)} />
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
