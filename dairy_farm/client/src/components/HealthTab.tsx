import React, { useState, useEffect } from 'react';
import { L } from '../i18n';
import { api } from '../api';
import { useConfirm, notify } from '../muf-confirm';
import type { Cow, HealthRecord, HealthType } from '../types';
import { todayStr, formatDate, isDateBeforeToday } from '../utils/date';
import DetailModal from '../muf-modal';
import {
  Plus,
  Filter,
  Trash2,
  Edit2,
  X,
  Stethoscope,
  AlertCircle,
  Activity,
  CalendarDays,
  HeartPulse,
  LayoutGrid,
  Grid3x3,
  Calendar,
} from 'lucide-react';

interface HealthTabProps {
  isAdmin: boolean;
  canDelete?: boolean;
}

const typeStyles: Record<HealthType, string> = {
  vaccination: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  treatment: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  checkup: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  deworming: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  other: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
};

const HealthTab: React.FC<HealthTabProps> = ({ isAdmin, canDelete = isAdmin }) => {
  const confirmAction = useConfirm();
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [upcoming, setUpcoming] = useState<HealthRecord[]>([]);
  const [cows, setCows] = useState<Cow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<HealthRecord | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  const genderLabel = (cow: Cow) => cow.gender === 'male' ? '🐂' : '🐄';

  // Filters
  const [cowFilter, setCowFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Form
  const [formData, setFormData] = useState({
    cowId: '',
    date: todayStr(),
    type: 'checkup' as HealthType,
    description: '',
    medicine: '',
    vet: '',
    nextDueDate: '',
    cost: '',
    notes: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [healthData, cowsData, upcomingData] = await Promise.all([
        api.getHealth({ cowId: cowFilter || undefined, type: typeFilter || undefined }),
        api.getCows(),
        api.getUpcomingHealth()
      ]);
      setRecords(healthData);
      setCows(cowsData);
      setUpcoming(upcomingData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [cowFilter, typeFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        cost: formData.cost ? parseFloat(formData.cost) : undefined,
        nextDueDate: formData.nextDueDate || undefined,
        medicine: formData.medicine || undefined,
        vet: formData.vet || undefined,
        notes: formData.notes || undefined
      };

      if (editingId) {
        await api.updateHealth(editingId, data);
      } else {
        await api.addHealth(data);
      }

      setFormData({
        cowId: '',
        date: todayStr(),
        type: 'checkup',
        description: '',
        medicine: '',
        vet: '',
        nextDueDate: '',
        cost: '',
        notes: ''
      });
      setShowForm(false);
      setEditingId(null);
      fetchData();
    } catch (error) {
      notify('Failed to save health record', 'error');
    }
  };

  const handleEdit = (record: HealthRecord) => {
    setFormData({
      cowId: record.cowId,
      date: record.date.split('T')[0],
      type: record.type,
      description: record.description,
      medicine: record.medicine || '',
      vet: record.vet || '',
      nextDueDate: record.nextDueDate ? record.nextDueDate.split('T')[0] : '',
      cost: record.cost ? record.cost.toString() : '',
      notes: record.notes || ''
    });
    setEditingId(record._id);
    setShowForm(true);

  };

  const handleDelete = async (id: string) => {
    const ok = await confirmAction({
      title: 'Delete Health Record',
      message: 'Are you sure you want to delete this record?',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.deleteHealth(id);
      fetchData();
    } catch (error) {
      notify('Failed to delete record', 'error');
    }
  };

  const isOverdue = (date: string) => isDateBeforeToday(date);

  return (
    <div className="space-y-6 tab-panel muf-health-redesign">
      {/* Page Hero */}
      <div className="muf-page-hero">
        <div className="muf-page-title">
          <div className="muf-title-icon"><HeartPulse size={28}/></div>
          <div>
            <h2>{L('Health')}</h2>
            <p>{L('Track vaccinations, treatments and health alerts for your herd.')}</p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setShowForm(true); setEditingId(null); }}
            className="muf-primary-action"
          >
            <Plus size={19}/> {L('Add Health Record')}
          </button>
        )}
      </div>

      {/* KPI Grid */}
      <div className="muf-kpi-grid">
        <div className="muf-kpi-card">
          <span className="muf-kpi-icon green"><Activity size={22}/></span>
          <div>
            <small>{L('Total Records')}</small>
            <strong>{records.length}</strong>
            <p className="up">↗ {L('all time')}</p>
          </div>
        </div>
        <div className="muf-kpi-card">
          <span className="muf-kpi-icon gold"><CalendarDays size={22}/></span>
          <div>
            <small>{L('Upcoming')}</small>
            <strong className="text-amber-600">{upcoming.length}</strong>
            <p>{L('due soon')}</p>
          </div>
        </div>
        <div className="muf-kpi-card">
          <span className="muf-kpi-icon red"><AlertCircle size={22}/></span>
          <div>
            <small>{L('Overdue')}</small>
            <strong className="text-red-600">{upcoming.filter(u => u.nextDueDate && isOverdue(u.nextDueDate)).length}</strong>
            <p className="down">⚠ {L('needs attention')}</p>
          </div>
        </div>
      </div>

      {/* Upcoming / Overdue Panel */}
      <div className="muf-panel p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{L('Upcoming / Overdue')}</h3>
          <CalendarDays className="w-5 h-5 text-farm-600" />
        </div>
        <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2">
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No upcoming health events</p>
          ) : upcoming.map(item => {
            const cow = cows.find(c => c._id === item.cowId);
            return (
              <button key={item._id} onClick={() => setSelectedRecord(item)}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:shadow-sm transition text-left">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className={`p-2 rounded-lg ${typeStyles[item.type]}`}>
                    <Stethoscope className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                      {cow ? `${genderLabel(cow)} ${cow.name}` : 'Unknown'} - {item.type}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.description}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className={`text-xs font-bold ${isOverdue(item.nextDueDate!) ? 'text-red-500' : 'text-amber-500'}`}>
                    {formatDate(item.nextDueDate)}
                  </p>
                  {isOverdue(item.nextDueDate!) && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                      <AlertCircle className="w-2.5 h-2.5 mr-1" /> Overdue
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <DetailModal open={showForm} onClose={() => { setShowForm(false); setEditingId(null); }}
        title={editingId ? L('Edit Health Record') : L('Add Health Record')}
        icon={<Plus className="w-5 h-5" />} iconBg="bg-farm-100 text-farm-700" size="small">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-slate-500 dark:text-slate-400 text-xs">Cow *</label>
                <select
                  required
                  value={formData.cowId}
                  onChange={e => setFormData({ ...formData, cowId: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-farm-500 text-slate-800 dark:text-slate-100"
                >
                  <option value="">Select Cow</option>
                  {cows.map(cow => (
                    <option key={cow._id} value={cow._id}>{cow.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 dark:text-slate-400 text-xs">Date *</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-farm-500 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 dark:text-slate-400 text-xs">Type *</label>
                <select
                  required
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value as HealthType })}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-farm-500 text-slate-800 dark:text-slate-100"
                >
                  <option value="vaccination">Vaccination</option>
                  <option value="treatment">Treatment</option>
                  <option value="checkup">Checkup</option>
                  <option value="deworming">Deworming</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-1 lg:col-span-2">
                <label className="text-slate-500 dark:text-slate-400 text-xs">Description *</label>
                <input
                  type="text"
                  required
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-farm-500 text-slate-800 dark:text-slate-100"
                  placeholder="e.g. FMD Vaccination"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 dark:text-slate-400 text-xs">Medicine</label>
                <input
                  type="text"
                  value={formData.medicine}
                  onChange={e => setFormData({ ...formData, medicine: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-farm-500 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 dark:text-slate-400 text-xs">Vet Name</label>
                <input
                  type="text"
                  value={formData.vet}
                  onChange={e => setFormData({ ...formData, vet: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-farm-500 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 dark:text-slate-400 text-xs">Next Due Date</label>
                <input
                  type="date"
                  value={formData.nextDueDate}
                  onChange={e => setFormData({ ...formData, nextDueDate: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-farm-500 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 dark:text-slate-400 text-xs">Cost (₨)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.cost}
                  onChange={e => setFormData({ ...formData, cost: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-farm-500 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="space-y-1 lg:col-span-3">
                <label className="text-slate-500 dark:text-slate-400 text-xs">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-farm-500 text-slate-800 dark:text-slate-100 min-h-[80px]"
                ></textarea>
              </div>
              <div className="lg:col-span-3 flex justify-end space-x-2 pt-2">
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setShowForm(false);
                      setFormData({
                        cowId: '',
                        date: todayStr(),
                        type: 'checkup',
                        description: '',
                        medicine: '',
                        vet: '',
                        nextDueDate: '',
                        cost: '',
                        notes: ''
                      });
                    }}
                    className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="bg-farm-600 hover:bg-farm-700 text-white rounded-lg px-6 py-2 text-sm font-medium"
                >
                  {editingId ? L('Update Record') : L('Add Record')}
                </button>
              </div>
            </form>
      </DetailModal>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={cowFilter}
              onChange={e => setCowFilter(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
            >
              <option value="">All Cows</option>
              {cows.map(cow => (
                <option key={cow._id} value={cow._id}>{cow.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
            >
              <option value="">All Types</option>
              <option value="vaccination">Vaccination</option>
              <option value="treatment">Treatment</option>
              <option value="checkup">Checkup</option>
              <option value="deworming">Deworming</option>
              <option value="other">Other</option>
            </select>
          </div>
          {(cowFilter || typeFilter) && (
            <button 
              onClick={() => { setCowFilter(''); setTypeFilter(''); }}
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
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Cow</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium">Description</th>
                <th className="px-6 py-4 font-medium">Medicine/Vet</th>
                <th className="px-6 py-4 font-medium">Next Due</th>
                <th className="px-6 py-4 font-medium">Cost</th>
                {isAdmin && <th className="px-6 py-4 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="px-6 py-8 text-center text-slate-400">Loading records...</td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="px-6 py-8 text-center text-slate-400">No records found</td>
                </tr>
              ) : records.map(record => (
                <tr key={record._id} onClick={() => setSelectedRecord(record)} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors text-sm cursor-pointer">
                  <td className="px-6 py-4 text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {formatDate(record.date)}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">
                    {cows.find(c => c._id === record.cowId)?.name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${typeStyles[record.type]}`}>
                      {record.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                    {record.description}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-700 dark:text-slate-300">{record.medicine || '-'}</div>
                    <div className="text-xs text-slate-500">{record.vet}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {record.nextDueDate ? (
                      <span className={isOverdue(record.nextDueDate) ? 'text-red-500 font-medium' : 'text-slate-600 dark:text-slate-400'}>
                        {formatDate(record.nextDueDate)}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 text-slate-800 dark:text-slate-200">
                    {record.cost ? `₨ ${record.cost.toLocaleString()}` : '-'}
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-2">
                        <button 
                          onClick={() => handleEdit(record)}
                          className="p-1.5 text-slate-400 hover:text-farm-600 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {canDelete && (
                          <button 
                            onClick={() => handleDelete(record._id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
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
            <p className="col-span-full text-center text-slate-400 py-8">Loading health records...</p>
          ) : records.length === 0 ? (
            <p className="col-span-full text-center text-slate-400 py-8">No health records found</p>
          ) : records.map(rec => {
            const cow = cows.find(c => c._id === rec.cowId);
            return (
              <article key={rec._id} className="muf-entity-card" onClick={() => setSelectedRecord(rec)}>
                <div className={cow?.image ? "muf-entity-photo" : "muf-entity-photo muf-entity-photo-noimg"} style={cow?.image ? { backgroundImage: `url(${cow.image})` } : undefined}>
                  {cow?.image ? <img src={cow.image} alt="" /> : <span className="muf-entity-emoji">🐄</span>}
                  <span className="muf-entity-status" data-tone={rec.type === 'vaccination' ? 'good' : rec.type === 'treatment' ? 'warn' : 'muted'}>{rec.type}</span>
                  <span className="muf-entity-round-icon">⚕️</span>
                </div>
                <div className="muf-entity-body">
                  <div className="muf-entity-name">
                    <div style={{ minWidth: 0 }}>
                      <h4>{cow?.name || 'Unknown'}</h4>
                      <p>{formatDate(rec.date)}</p>
                    </div>
                    <span className="muf-entity-chip">{rec.cost ? `₨${rec.cost}` : '-'}</span>
                  </div>
                  <div className="muf-entity-stats">
                    <span><Calendar className="w-3 h-3"/> <span>{rec.description || '-'}</span></span>
                    {rec.nextDueDate && <span><CalendarDays className="w-3 h-3"/> <span>Next: {formatDate(rec.nextDueDate)}</span></span>}
                  </div>
                  {isAdmin && (
                    <div className="muf-entity-actions">
                      <button onClick={(e) => { e.stopPropagation(); handleEdit(rec); }} className="muf-mini-icon"><Edit2 className="w-3.5 h-3.5"/></button>
                      {canDelete && <button onClick={(e) => { e.stopPropagation(); handleDelete(rec._id); }} className="muf-mini-icon text-red-500"><Trash2 className="w-3.5 h-3.5"/></button>}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Record Detail Popup */}
      {selectedRecord && (
        <DetailModal open={true} onClose={() => setSelectedRecord(null)}
          title={L('Health Record Details')}
          icon={<Stethoscope className="w-5 h-5" />} iconBg="bg-farm-100 text-farm-700" size="small">
          <div className="space-y-3">
            {(() => {
              const cow = cows.find(c => c._id === selectedRecord.cowId);
              return (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                      <p className="text-[10px] uppercase text-slate-400 font-bold">{L('Animal')}</p>
                      <p className="font-medium text-slate-800 dark:text-slate-100">{cow ? `${genderLabel(cow)} ${cow.name}` : 'Unknown'}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                      <p className="text-[10px] uppercase text-slate-400 font-bold">{L('Date')}</p>
                      <p className="font-medium text-slate-800 dark:text-slate-100">{formatDate(selectedRecord.date)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                      <p className="text-[10px] uppercase text-slate-400 font-bold">{L('Type')}</p>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${typeStyles[selectedRecord.type]}`}>{selectedRecord.type}</span>
                    </div>
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                      <p className="text-[10px] uppercase text-slate-400 font-bold">{L('Cost')}</p>
                      <p className="font-medium text-slate-800 dark:text-slate-100">{selectedRecord.cost ? `₨ ${selectedRecord.cost.toLocaleString()}` : '-'}</p>
                    </div>
                    {selectedRecord.medicine && (
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                        <p className="text-[10px] uppercase text-slate-400 font-bold">{L('Medicine')}</p>
                        <p className="font-medium text-slate-800 dark:text-slate-100">{selectedRecord.medicine}</p>
                      </div>
                    )}
                    {selectedRecord.vet && (
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                        <p className="text-[10px] uppercase text-slate-400 font-bold">{L('Vet')}</p>
                        <p className="font-medium text-slate-800 dark:text-slate-100">{selectedRecord.vet}</p>
                      </div>
                    )}
                    {selectedRecord.nextDueDate && (
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                        <p className="text-[10px] uppercase text-slate-400 font-bold">{L('Next Due')}</p>
                        <p className={`font-medium ${isOverdue(selectedRecord.nextDueDate) ? 'text-red-500' : 'text-slate-800 dark:text-slate-100'}`}>{formatDate(selectedRecord.nextDueDate)}</p>
                      </div>
                    )}
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                    <p className="text-[10px] uppercase text-slate-400 font-bold mb-1">{L('Description')}</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{selectedRecord.description}</p>
                  </div>
                  {selectedRecord.notes && (
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                      <p className="text-[10px] uppercase text-slate-400 font-bold mb-1">{L('Notes')}</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{selectedRecord.notes}</p>
                    </div>
                  )}
                  {isAdmin && (
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => { setEditingId(selectedRecord._id); setShowForm(true); setSelectedRecord(null); }}
                        className="flex-1 px-4 py-2 bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2">
                        <Edit2 className="w-3.5 h-3.5" /> {L('Edit')}
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </DetailModal>
      )}
    </div>
  );
};

export default HealthTab;
