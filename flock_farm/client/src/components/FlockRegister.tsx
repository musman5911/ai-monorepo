import React, { useEffect, useMemo, useState } from 'react';
import { L } from '../i18n';
import {
  Activity,
  Bird as BirdIcon,
  Banknote,
  Calendar,
  CalendarDays,
  Eye,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Syringe,
  ShoppingBag,
  Trash2,
  User, DollarSign,
} from 'lucide-react';
import MufEntityGrid from '../muf-entity-grid';
import MufFab from '../muf-fab';
import { Bird, Gender, BirdStatus, DeathReason, BirdBreed, Lang, VaccinationRecord } from '../types';
import BirdAvatar, { breedLabel } from './BirdAvatar';
import { todayStr as localTodayStr, diffDateOnlyDays } from '../utils/calculations';
import { calculateCurrentAge, sortBirdsForRegister, birdStatusTone } from './flock/birdUtils';
import { uploadImage } from '../api';
import DetailModal from '../muf-modal';
import { mufStoryNet, mufVerdictText, mufDaysBetween } from '../muf-story';
import { useConfirm, notify } from '../muf-confirm';

function normalizePublicAssetPath(value: string) {
  const raw = value.trim();
  if (!raw) return '';
  const normalized = raw.replace(/\\/g, '/');
  const publicIndex = normalized.toLowerCase().indexOf('/public/');
  if (publicIndex >= 0) {
    return normalized.slice(publicIndex + '/public'.length);
  }
  if (normalized.toLowerCase().startsWith('public/')) {
    return `/${normalized.slice('public/'.length)}`;
  }
  if (normalized.startsWith('/')) return normalized;
  if (normalized.startsWith('birds/')) return `/${normalized}`;
  return normalized;
}

interface FlockRegisterProps {
  birds: Bird[];
  vaccinations: VaccinationRecord[];
  onAddBird: (bird: Omit<Bird, 'id'>) => void;
  onUpdateBird: (id: number, bird: Bird) => void;
  onDeleteBird: (id: number) => void;
  shouldOpenAddModal: boolean;
  onCloseAddModal: () => void;
  birdIdToEdit?: number | null;
  onConsumeBirdEditRequest?: () => void;
  vaccinationIntervalDays: number;
  lang?: Lang;
  canDelete?: boolean;
  isAdmin?: boolean;
}

export default function FlockRegister({
  birds,
  vaccinations,
  onAddBird,
  onUpdateBird,
  onDeleteBird,
  shouldOpenAddModal,
  onCloseAddModal,
  birdIdToEdit,
  onConsumeBirdEditRequest,
  vaccinationIntervalDays,
  isAdmin = true,
  canDelete = true,
  lang = 'en',
}: FlockRegisterProps) {
  const confirmAction = useConfirm();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState<'All' | 'Male' | 'Female'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Sold' | 'Dead' | 'Sick'>('All');
  
  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(shouldOpenAddModal);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedBird, setSelectedBird] = useState<Bird | null>(null);
  const [detailBirdId, setDetailBirdId] = useState<number | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('Female');
  const [breed, setBreed] = useState<BirdBreed>('Desi');
  const [customBreed, setCustomBreed] = useState('');
  const [imagePath, setImagePath] = useState('');
  const [birdImageUploading, setBirdImageUploading] = useState(false);
  const [dateBought, setDateBought] = useState(localTodayStr());
  const [price, setPrice] = useState('0');
  const [status, setStatus] = useState<BirdStatus>('Active');
  const [salePrice, setSalePrice] = useState('');
  const [saleDate, setSaleDate] = useState(localTodayStr());
  const [ageBoughtDays, setAgeBoughtDays] = useState('0');
  const [dateOfBirth, setDateOfBirth] = useState('');

  // Mortality fields
  const [dateDied, setDateDied] = useState('');
  const [deathReason, setDeathReason] = useState<DeathReason>('Disease');
  const [deathDetail, setDeathDetail] = useState('');

  const detailBird = useMemo(
    () => (detailBirdId !== null ? birds.find((bird) => bird.id === detailBirdId) ?? null : null),
    [birds, detailBirdId],
  );
  const detailVaccinations = useMemo(
    () => (detailBird ? [...vaccinations.filter((record) => record.birdId === detailBird.id)].sort((a, b) => b.date.localeCompare(a.date)) : []),
    [detailBird, vaccinations],
  );

  // Sync isAddModalOpen with shouldOpenAddModal prop from parent
  useEffect(() => {
    if (shouldOpenAddModal) {
      setIsAddModalOpen(true);
      onCloseAddModal(); // Reset in parent so it doesn't repeatedly trigger
    }
  }, [shouldOpenAddModal]);

  useEffect(() => {
    if (!birdIdToEdit) return;
    const bird = birds.find((b) => b.id === birdIdToEdit);
    if (bird) {
      handleOpenEdit(bird);
    }
    onConsumeBirdEditRequest?.();
  }, [birdIdToEdit, birds]);

  useEffect(() => {
    if (detailBirdId !== null && !detailBird) {
      setDetailBirdId(null);
    }
  }, [detailBirdId, detailBird]);

  const handleBirdImageUpload = async (file?: File | null) => {
    if (!file) return;
    setBirdImageUploading(true);
    try {
      const path = await uploadImage(file, 'bird');
      setImagePath(path);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to upload image', 'error');
    } finally {
      setBirdImageUploading(false);
    }
  };

  // Handle resetting form fields
  const resetForm = () => {
    setName('');
    setGender('Female');
    setBreed('Desi');
    setCustomBreed('');
    setImagePath('');
    setDateBought(localTodayStr());
    setPrice('0');
    setStatus('Active');
    setSalePrice('');
    setSaleDate(localTodayStr());
    setAgeBoughtDays('0');
    setDateOfBirth('');
    setDateDied('');
    setDeathReason('Disease');
    setDeathDetail('');
  };

  // Age calculation + sort + status-tone helpers extracted to ./flock/birdUtils
  // (pure functions, no component state — same inputs, same outputs).

  // Filter birds
  const filteredAndSortedBirds = sortBirdsForRegister(
    birds.filter(bird => {
      const matchesSearch = bird.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGender = genderFilter === 'All' || bird.gender === genderFilter;
      const matchesStatus = statusFilter === 'All' || bird.status === statusFilter;
      return matchesSearch && matchesGender && matchesStatus;
    })
  );

  // ── Grid view items (muf-entity-grid) ─────────────
  // birdStatusTone imported from ./flock/birdUtils
  const gridBirds = filteredAndSortedBirds.map((bird) => ({
    id: bird.id,
    photo: bird.image || null,
    emoji: bird.gender === 'Male' ? '🐓' : '🐔',
    name: bird.name,
    sub: breedLabel(bird),
    chip: `BRD-${bird.id.toString().padStart(3, '0')}`,
    status: bird.status,
    statusTone: birdStatusTone(bird.status) as 'good' | 'warn' | 'bad' | 'info' | 'muted',
    stats: [
      { icon: <User size={14} />, text: bird.gender === 'Male' ? 'Male' : 'Female' },
      { icon: <CalendarDays size={14} />, text: `Age ${calculateCurrentAge(bird)}` },
      { icon: <Calendar size={14} />, text: `Bought ${bird.dateBought}` },
      { icon: <Banknote size={14} />, text: `Rs ${bird.price.toLocaleString()}` },
      { icon: <Syringe size={14} />, text: bird.lastVaccinationDate ? `Vax ${bird.lastVaccinationDate}` : 'No vax' },
      { icon: <DollarSign size={14} />, text: bird.salePrice ? `Sold Rs ${bird.salePrice.toLocaleString()}` : (bird.dateDied ? 'Deceased' : 'Not sold') },
    ],
    actions: (
      <>
        <button onClick={() => handleOpenDetails(bird)} className="muf-detail-btn"><Eye size={15}/> {L('Details')}</button>
        {isAdmin && (
          <>
            <button onClick={() => handleOpenEdit(bird)} className="muf-record-btn"><Pencil size={15}/> {L('Edit')}</button>
            {canDelete && (
              <button onClick={() => handleDeleteRequest(bird)} className="muf-mini-icon danger" title={L('Delete')} aria-label={L('Delete bird')}><Trash2 size={15}/></button>
            )}
          </>
        )}
      </>
    ),
  }));

  // Submit new bird
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return notify(L('Please enter bird name'), 'error');
    if (breed === 'Custom' && !customBreed.trim()) return notify(L('Please enter a custom breed name.'), 'error');

    // Mortality check
    if (status === 'Dead' && (!dateDied || !deathReason)) {
      return notify(L('Date Died and Death Reason are required for dead birds.'), 'error');
    }

    onAddBird({
      name: name.trim(),
      gender,
      breed,
      customBreed: breed === 'Custom' ? customBreed.trim() : undefined,
      image: imagePath.trim() || undefined,
      dateBought,
      price: parseFloat(price) || 0,
      status,
      salePrice: status === 'Sold' ? (parseFloat(salePrice) || 0) : undefined,
      saleDate: status === 'Sold' ? saleDate : undefined,
      ageBoughtDays: parseInt(ageBoughtDays) || 0,
      dateOfBirth: dateOfBirth || undefined,
      dateDied: status === 'Dead' ? dateDied : undefined,
      deathReason: status === 'Dead' ? deathReason : undefined,
      deathDetail: status === 'Dead' ? deathDetail : undefined,
    });

    setIsAddModalOpen(false);
    resetForm();
  };

  // Open Edit Modal
  const handleOpenEdit = (bird: Bird) => {
    setSelectedBird(bird);
    setName(bird.name);
    setGender(bird.gender);
    setBreed(bird.breed || 'Desi');
    setCustomBreed(bird.customBreed || '');
    setImagePath(bird.image || '');
    setDateBought(bird.dateBought);
    setPrice(bird.price.toString());
    setStatus(bird.status);
    setSalePrice(bird.salePrice ? String(bird.salePrice) : '');
    setSaleDate(bird.saleDate || localTodayStr());
    setAgeBoughtDays(bird.ageBoughtDays.toString());
    setDateOfBirth(bird.dateOfBirth || '');
    setDateDied(bird.dateDied || '');
    setDeathReason(bird.deathReason || 'Disease');
    setDeathDetail(bird.deathDetail || '');
    setIsEditModalOpen(true);
  };

  // Submit edit bird
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBird) return;
    if (!name.trim()) return notify(L('Please enter bird name'), 'error');
    if (breed === 'Custom' && !customBreed.trim()) return notify(L('Please enter a custom breed name.'), 'error');

    // Mortality check
    if (status === 'Dead' && (!dateDied || !deathReason)) {
      return notify(L('Date Died and Death Reason are required for dead birds.'), 'error');
    }

    onUpdateBird(selectedBird.id, {
      ...selectedBird,
      name: name.trim(),
      gender,
      breed,
      customBreed: breed === 'Custom' ? customBreed.trim() : undefined,
      image: imagePath.trim() || undefined,
      dateBought,
      price: parseFloat(price) || 0,
      status,
      salePrice: status === 'Sold' ? (parseFloat(salePrice) || 0) : undefined,
      saleDate: status === 'Sold' ? saleDate : undefined,
      ageBoughtDays: parseInt(ageBoughtDays) || 0,
      dateOfBirth: dateOfBirth || undefined,
      dateDied: status === 'Dead' ? dateDied : undefined,
      deathReason: status === 'Dead' ? deathReason : undefined,
      deathDetail: status === 'Dead' ? deathDetail : undefined,
    });

    setIsEditModalOpen(false);
    setSelectedBird(null);
    resetForm();
  };

  const handleOpenDetails = (bird: Bird) => {
    setDetailBirdId(bird.id);
  };

  const handleDeleteRequest = async (bird: Bird) => {
    const ok = await confirmAction({
      title: L('Delete Bird'),
      message: `Delete ${bird.name} from the flock registry?`,
      confirmLabel: L('Delete Bird'),
      cancelLabel: L('Cancel'),
      tone: 'danger',
    });
    if (!ok) return;
    setDetailBirdId((current) => (current === bird.id ? null : current));
    onDeleteBird(bird.id);
  };

  // Helper for vaccination status text
  const getVaccinationBadge = (lastVac: string | undefined) => {
    if (!lastVac) {
      return <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-3xs font-mono rounded-md">⚠ Unvaccinated</span>;
    }
    const current = new Date();
    const vac = new Date(lastVac);
    const diffDays = Math.floor((current.getTime() - vac.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays > vaccinationIntervalDays) {
      return <span className="px-1.5 py-0.5 bg-red-50 text-red-700 border border-red-200 text-3xs font-mono rounded-md">🔴 Overdue</span>;
    } else if (diffDays >= vaccinationIntervalDays - 7) {
      return <span className="px-1.5 py-0.5 bg-yellow-50 text-yellow-700 border border-yellow-200 text-3xs font-mono rounded-md">🟡 Due Soon</span>;
    } else {
      return <span className="px-1.5 py-0.5 bg-green-50 text-green-700 border border-green-200 text-3xs font-mono rounded-md">✅ OK</span>;
    }
  };

  const previewBird: Bird = {
    id: selectedBird?.id || 0,
    name: name.trim() || 'Preview Bird',
    gender,
    dateBought,
    price: parseFloat(price) || 0,
    status,
    ageBoughtDays: parseInt(ageBoughtDays) || 0,
    breed,
    customBreed: breed === 'Custom' ? customBreed.trim() || undefined : undefined,
    image: imagePath.trim() || undefined,
    dateOfBirth: dateOfBirth || undefined,
    salePrice: status === 'Sold' ? (parseFloat(salePrice) || 0) : undefined,
    saleDate: status === 'Sold' ? saleDate : undefined,
    dateDied: status === 'Dead' ? dateDied || undefined : undefined,
    deathReason: status === 'Dead' ? deathReason : undefined,
    deathDetail: status === 'Dead' ? deathDetail || undefined : undefined,
  };

  // Shared field block — rendered inside BOTH the add and edit bird
  // modals so the two forms never drift apart.
  const birdFormFields = (
    <>
      <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-2xs font-bold text-gray-500 uppercase tracking-wider mb-1">Bird Name *</label>
                        <input 
                          type="text"
                          required
                          placeholder={L('e.g. Purana kukar, Lali')}
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="muf-field"
                        />
                      </div>
      
                      <div>
                        <label className="block text-2xs font-bold text-gray-500 uppercase tracking-wider mb-1">Gender *</label>
                        <select 
                          value={gender}
                          onChange={(e) => setGender(e.target.value as Gender)}
                          className="muf-field"
                        >
                          <option value="Female">{L('Female (Hen)')}</option>
                          <option value="Male">{L('Male (Rooster)')}</option>
                        </select>
                      </div>
                    </div>
      
                    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_120px] gap-4 items-start">
                      <div>
                        <label className="block text-2xs font-bold text-gray-500 uppercase tracking-wider mb-1">{L('Breed / Type')}</label>
                        <select
                          value={breed}
                          onChange={(e) => setBreed(e.target.value as BirdBreed)}
                          className="muf-field"
                          id="add-bird-breed"
                        >
                          <option value="Desi">{L('Desi')}</option>
                          <option value="Aseel">{L('Aseel')}</option>
                          <option value="Rhode Island">{L('Rhode Island')}</option>
                          <option value="Golden">{L('Golden')}</option>
                          <option value="Misri">{L('Misri')}</option>
                          <option value="Broiler">{L('Broiler')}</option>
                          <option value="Layer">{L('Layer')}</option>
                          <option value="Fayoumi">{L('Fayoumi')}</option>
                          <option value="Custom">{L('Custom (type your own)')}</option>
                        </select>
                        {breed === 'Custom' && (
                          <input
                            type="text"
                            required
                            placeholder={L('Custom breed name...')}
                            value={customBreed}
                            onChange={(e) => setCustomBreed(e.target.value)}
                            className="mt-2 w-full text-xs px-3 py-2 border border-farm-200 bg-farm-50/40 rounded-xl focus:border-farm-400 focus:outline-hidden"
                          />
                        )}
                        <div className="mt-3 space-y-2">
                          <label className="block text-2xs font-bold text-gray-500 uppercase tracking-wider mb-1">{L('Bird Image')}</label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleBirdImageUpload(e.target.files?.[0])}
                            className="w-full text-xs px-3 py-2 border border-dashed border-slate-300 rounded-xl bg-slate-50"
                          />
                          {birdImageUploading && <p className="text-[10px] text-farm-600 font-semibold">Uploading image…</p>}
                          <input
                            type="text"
                            placeholder="/birds/kalu.jpg or https://..."
                            value={imagePath}
                            onChange={(e) => setImagePath(normalizePublicAssetPath(e.target.value))}
                            className="muf-field"
                          />
                          <p className="mt-1 text-[10px] text-slate-400">Upload from device or paste a public path / full image URL.</p>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 flex flex-col items-center gap-2">
                        <BirdAvatar bird={previewBird} size="lg" showBadge={false} />
                        <span className="text-[10px] text-slate-500 text-center">{L('Image preview auto-fits with crop.')}</span>
                      </div>
                    </div>
      
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-2xs font-bold text-gray-500 uppercase tracking-wider mb-1">{L('Price (Rs)')}</label>
                        <input 
                          type="number"
                          min="0"
                          placeholder={L('Acquisition cost')}
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          className="muf-field"
                        />
                      </div>
      
                      <div>
                        <label className="block text-2xs font-bold text-gray-500 uppercase tracking-wider mb-1">{L('Age Bought (Days)')}</label>
                        <input 
                          type="number"
                          min="0"
                          placeholder={L('Age in days when bought')}
                          value={ageBoughtDays}
                          onChange={(e) => setAgeBoughtDays(e.target.value)}
                          className="muf-field"
                        />
                      </div>
                    </div>
      
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-2xs font-bold text-gray-500 uppercase tracking-wider mb-1">{L('Date Bought')}</label>
                        <input 
                          type="date"
                          value={dateBought}
                          onChange={(e) => setDateBought(e.target.value)}
                          className="muf-field"
                        />
                      </div>
      
                      <div>
                        <label className="block text-2xs font-bold text-gray-500 uppercase tracking-wider mb-1">{L('Date of Birth (Optional)')}</label>
                        <input 
                          type="date"
                          value={dateOfBirth}
                          onChange={(e) => setDateOfBirth(e.target.value)}
                          className="muf-field"
                        />
                      </div>
                    </div>
      
                    <div className="rounded-2xl border border-sky-100 bg-sky-50 px-3 py-2 text-[11px] text-sky-800">
                      Vaccination date is now managed only from the Health Portal vaccination log.
                    </div>
      
                    <div className="border-t border-gray-100 pt-4">
                      <label className="block text-2xs font-bold text-gray-500 uppercase tracking-wider mb-1">{L('Registry Status')}</label>
                      <select 
                        value={status}
                        onChange={(e) => setStatus(e.target.value as BirdStatus)}
                        className="muf-field"
                      >
                        <option value="Active">{L('Active (In Flock)')}</option>
                        <option value="Sick">{L('Sick (Needs care)')}</option>
                        <option value="Sold">{L('Sold')}</option>
                        <option value="Dead">{L('Dead (Deceased)')}</option>
                      </select>
                    </div>
      
                    {status === 'Sick' && (
                      <div className="p-3 bg-orange-50 rounded-2xl border border-orange-100">
                        <p className="text-3xs font-bold text-orange-800">This bird is marked Sick. It will show in health alerts.</p>
                      </div>
                    )}
      
                    {/* Sale price input, shown when marking a bird as Sold */}
                    {status === 'Sold' && (
                      <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-2 animate-in fade-in duration-150">
                        <label className="block text-3xs font-bold text-emerald-700 uppercase tracking-wider mb-1">Sale Price (Rs) *</label>
                        <input 
                          type="number"
                          min="0"
                          required
                          placeholder={L('Amount received for this bird')}
                          value={salePrice}
                          onChange={(e) => setSalePrice(e.target.value)}
                          className="w-full text-xs px-3 py-2 border border-emerald-200 rounded-xl focus:border-emerald-400 focus:outline-hidden bg-white text-emerald-950"
                        />
                        <label className="block text-3xs font-bold text-emerald-700 uppercase tracking-wider mb-1 pt-1">Sale Date *</label>
                        <input 
                          type="date"
                          required
                          value={saleDate}
                          onChange={(e) => setSaleDate(e.target.value)}
                          className="w-full text-xs px-3 py-2 border border-emerald-200 rounded-xl focus:border-emerald-400 focus:outline-hidden bg-white text-emerald-950"
                        />
                        <p className="text-3xs text-emerald-700">{L('This is tracked as income in your Financial Ledger totals.')}</p>
                      </div>
                    )}
      
                    {/* Conditionally rendered Mortality inputs when Status == Dead */}
                    {status === 'Dead' && (
                      <div className="p-4 bg-red-50 rounded-2xl border border-red-100 space-y-3 animate-in fade-in duration-150">
                        <h4 className="font-bold text-xs text-red-800 flex items-center gap-1">
                          <ShieldAlert className="w-4 h-4" /> Mortality Log Required Fields
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-3xs font-bold text-red-700 uppercase tracking-wider mb-1">Date Died *</label>
                            <input 
                              type="date"
                              required
                              value={dateDied}
                              onChange={(e) => setDateDied(e.target.value)}
                              className="w-full text-xs px-2.5 py-1.5 border border-red-200 rounded-xl focus:border-red-400 focus:outline-hidden bg-white text-red-950"
                            />
                          </div>
                          <div>
                            <label className="block text-3xs font-bold text-red-700 uppercase tracking-wider mb-1">Reason *</label>
                            <select 
                              required
                              value={deathReason}
                              onChange={(e) => setDeathReason(e.target.value as DeathReason)}
                              className="w-full text-xs px-2.5 py-1.5 border border-red-200 rounded-xl focus:border-red-400 focus:outline-hidden bg-white text-red-950"
                            >
                              <option value="Disease">{L('Disease')}</option>
                              <option value="Injury">{L('Injury')}</option>
                              <option value="Predator">{L('Predator')}</option>
                              <option value="Other">{L('Other')}</option>
                              <option value="Unknown">{L('Unknown')}</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-3xs font-bold text-red-700 uppercase tracking-wider mb-1">{L('Death Detail Notes')}</label>
                          <textarea 
                            placeholder={L('e.g. Dawai no di thi us wqt, or secondary symptoms...')}
                            value={deathDetail}
                            onChange={(e) => setDeathDetail(e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 border border-red-200 rounded-xl focus:border-red-400 focus:outline-hidden bg-white text-red-950 h-16 resize-none"
                          />
                        </div>
                      </div>
                    )}
    </>
  );

  return (
    <div className="space-y-6" id="flock-register-tab">
      {/* Header and Add button */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-800">{L('Flock Registry')}</h2>
          <p className="text-xs text-slate-500">Auto-sorted directory of your birds: Males bought oldest-to-newest first, then Females.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="muf-view-toggle" title={L('Toggle view')}>
            <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')}><LayoutGrid className="w-3.5 h-3.5" /> {L('Grid')}</button>
            <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}><List className="w-3.5 h-3.5" /> {L('List')}</button>
          </div>
          {isAdmin && (
          <span className="text-2xs font-semibold text-slate-400 bg-slate-100 px-3 py-2 rounded-xl shrink-0 hidden">Add via FAB ↓</span>
          )}
          {!isAdmin && (
          <span className="text-2xs font-semibold text-slate-400 bg-slate-100 px-3 py-2 rounded-xl shrink-0">👀 View only (Worker mode)</span>
          )}
        </div>
      </div>

      {/* Filters section */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 grid grid-cols-1 gap-4">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder={L('Search birds by name... (e.g. \'Purana\')')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:border-farm-400 focus:outline-hidden transition"
            id="bird-search-input"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
          <div className="flex flex-wrap items-center gap-1.5 bg-gray-50 p-1.5 border border-slate-100 rounded-xl text-2xs font-semibold">
            <span className="w-full sm:w-auto text-gray-400 px-2 font-mono uppercase text-3xs">{L('Gender:')}</span>
            {(['All', 'Male', 'Female'] as const).map(g => (
              <button 
                key={g}
                onClick={() => setGenderFilter(g)}
                className={`flex-1 sm:flex-none min-w-[72px] px-3 py-1.5 rounded-lg transition-all ${
                  genderFilter === g ? 'bg-white shadow-xs text-farm-600 border border-slate-100 font-bold' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-gray-50 p-1.5 border border-slate-100 rounded-xl text-2xs font-semibold">
            <span className="w-full sm:w-auto text-gray-400 px-2 font-mono uppercase text-3xs">{L('Status:')}</span>
            {(['All', 'Active', 'Sick', 'Sold', 'Dead'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`flex-1 sm:flex-none min-w-[72px] px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === s ? 'bg-white shadow-xs text-farm-600 border border-slate-100 font-bold' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bird Directory List */}
      {filteredAndSortedBirds.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200">
          <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-500">{L('No birds match current filters.')}</p>
          <p className="text-xs text-gray-400 mt-1">Try clearing your filters or adding a new bird to the registry.</p>
        </div>
      ) : view === 'grid' ? (
        <MufEntityGrid
          items={gridBirds}
          onOpen={(it) => {
            const b = birds.find((x) => x.id === Number(it.id));
            if (b) handleOpenDetails(b);
          }}
        />
      ) : (
        <div className="space-y-2.5" id="bird-list-view">
          {filteredAndSortedBirds.map((bird) => {
            const secondaryMeta = getBirdSecondaryMeta(bird);
            return (
              <div
                key={bird.id}
                role="button"
                tabIndex={0}
                onClick={() => handleOpenDetails(bird)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleOpenDetails(bird);
                  }
                }}
                className={`group rounded-2xl border px-3 py-3.5 sm:px-4 sm:py-4 shadow-xs transition hover:shadow-md cursor-pointer ${getBirdCardTone(bird)}`}
                id={`bird-row-${bird.id}`}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <BirdAvatar bird={bird} size="md" shape="rounded" className="shrink-0" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <h3 className="truncate font-bold text-sm sm:text-base text-slate-900">{bird.name}</h3>
                          <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${getGenderTone(bird.gender)}`}>
                            {bird.gender === 'Male' ? '♂' : '♀'}
                          </span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 font-bold uppercase tracking-wider ${getBirdStatusTone(bird.status)}`}>
                            {bird.status}
                          </span>
                          <span className="inline-flex rounded-full border border-slate-200 bg-white/85 px-2 py-0.5 font-semibold text-slate-600">
                            Age {calculateCurrentAge(bird)}
                          </span>
                          <span className="inline-flex rounded-full border border-slate-200 bg-white/85 px-2 py-0.5 font-semibold text-slate-600">
                            {breedLabel(bird)}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{L('Price')}</p>
                        <p className="font-mono text-sm font-bold text-slate-900 sm:text-base">Rs {bird.price.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div className="flex min-w-0 flex-wrap items-center gap-2 text-slate-500">
                        <span className="font-mono text-slate-400">BRD-{bird.id.toString().padStart(3, '0')}</span>
                        <span>Bought {bird.dateBought}</span>
                        <span className="truncate">{secondaryMeta}</span>
                      </div>
                      <span className="font-semibold text-farm-600 transition group-hover:text-farm-700">{L('Tap for details')}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DetailModal
        open={!!detailBird}
        onClose={() => setDetailBirdId(null)}
        title={L('Bird Details')}
        subtitle={detailBird ? `${breedLabel(detailBird)} · BRD-${detailBird.id.toString().padStart(3, '0')}` : undefined}
        icon={<BirdIcon className="w-5 h-5" />}
        iconBg="bg-farm-100 text-farm-700"
        size="big"
      >
        {detailBird && (
          <div className="space-y-5">
            <div className={`rounded-3xl border p-4 sm:p-5 ${getBirdCardTone(detailBird)}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <BirdAvatar bird={detailBird} size="lg" shape="rounded" className="shrink-0" />
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900 sm:text-xl">{detailBird.name}</h3>
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-sm font-bold ${getGenderTone(detailBird.gender)}`}>
                      {detailBird.gender === 'Male' ? '♂' : '♀'}
                    </span>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${getBirdStatusTone(detailBird.status)}`}>
                      {detailBird.status}
                    </span>
                    <span className="inline-flex rounded-full border border-slate-200 bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      {breedLabel(detailBird)}
                    </span>
                    {detailBird.sourceIncubationId && (
                      <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                        Incubation #{detailBird.sourceIncubationId}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                    <DetailValueCard label={L('Age')} value={calculateCurrentAge(detailBird)} />
                    <DetailValueCard label="Price" value={`Rs ${detailBird.price.toLocaleString()}`} />
                    <DetailValueCard label={L('Bought')} value={detailBird.dateBought} />
                    <DetailValueCard label={L('Last Vaccine')} value={detailBird.lastVaccinationDate || '—'} />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Bird Story — facts only, no estimates (muf-story) ── */}
            {(() => {
              const b = detailBird;
              const sold = b.status === 'Sold';
              const myVax = vaccinations.filter((v) => v.birdId === b.id);
              const vaxCost = myVax.reduce((a, v) => a + (v.cost || 0), 0);
              const daysOnFarm = mufDaysBetween(b.dateBought, sold ? (b.saleDate || undefined) : b.status === 'Dead' ? (b.dateDied || undefined) : undefined);
              const { net, isProfit } = sold ? mufStoryNet(b.salePrice || 0, (b.price || 0) + vaxCost) : { net: 0, isProfit: false };
              return (
                <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-3">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">📖 {L('Bird Story')}</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">{L('Bought')}</p>
                      <p className="font-bold text-slate-800 dark:text-slate-100">Rs {(b.price || 0).toLocaleString()}</p>
                      <p className="text-[10px] text-slate-400">{b.dateBought || '—'}</p>
                    </div>
                    {sold && (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">{L('Sold')}</p>
                        <p className="font-bold text-purple-600">Rs {(b.salePrice || 0).toLocaleString()}</p>
                        <p className="text-[10px] text-slate-400">{b.saleDate || '—'}</p>
                      </div>
                    )}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">{L('Days on farm')}</p>
                      <p className="font-bold text-slate-800 dark:text-slate-100">{daysOnFarm === null ? '—' : daysOnFarm}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">{L('Vaccines')}</p>
                      <p className="font-bold text-slate-800 dark:text-slate-100">{myVax.length}{vaxCost > 0 ? ` · Rs ${vaxCost.toLocaleString()}` : ''}</p>
                    </div>
                  </div>
                  {sold && (
                    <div className={`rounded-xl p-2.5 text-center text-xs font-bold border ${
                      isProfit
                        ? 'bg-farm-50 dark:bg-farm-900/20 border-farm-200 dark:border-farm-800 text-farm-700 dark:text-farm-400'
                        : net === 0
                          ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                    }`}>
                      {isProfit ? '✅ ' : net === 0 ? '⚖️ ' : '⚠️ '}{mufVerdictText(net, lang || 'en', 'bird', true)}
                      <span className="block text-[10px] font-normal text-slate-400 mt-0.5">{L('(egg income is counted flock-wide, not included here)')}</span>
                    </div>
                  )}
                </section>
              );
            })()}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                  <Calendar className="h-4 w-4 text-slate-500" /> Overview
                </h4>
                <div className="space-y-2">
                  <DetailRow label="Bird ID" value={`BRD-${detailBird.id.toString().padStart(3, '0')}`} mono />
                  <DetailRow label={L('Gender')} value={detailBird.gender} />
                  <DetailRow label={L('Breed')} value={breedLabel(detailBird)} />
                  <DetailRow label={L('Date Bought')} value={detailBird.dateBought} mono />
                  <DetailRow label={L('Date of Birth')} value={detailBird.dateOfBirth || '—'} mono />
                  <DetailRow label="Purchase Price" value={`Rs ${detailBird.price.toLocaleString()}`} mono />
                  <DetailRow label={L('Vaccination Status')} valueNode={getVaccinationBadge(detailBird.lastVaccinationDate)} />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                  <ShieldAlert className="h-4 w-4 text-slate-500" /> Status Details
                </h4>
                {detailBird.status === 'Sold' ? (
                  <div className="space-y-2">
                    <DetailRow label={L('Sale Date')} value={detailBird.saleDate || '—'} mono />
                    <DetailRow label="Sale Price" value={`Rs ${(detailBird.salePrice ?? 0).toLocaleString()}`} mono />
                    <DetailRow
                      label={L('Profit / Loss')}
                      value={`Rs ${((detailBird.salePrice ?? 0) - detailBird.price).toLocaleString()}`}
                      valueClassName={((detailBird.salePrice ?? 0) - detailBird.price) >= 0 ? 'text-emerald-700' : 'text-rose-700'}
                      mono
                    />
                  </div>
                ) : detailBird.status === 'Dead' ? (
                  <div className="space-y-2">
                    <DetailRow label={L('Date Died')} value={detailBird.dateDied || '—'} mono />
                    <DetailRow label={L('Reason')} value={detailBird.deathReason || '—'} />
                    <DetailRow label={L('Notes')} value={detailBird.deathDetail || '—'} />
                  </div>
                ) : detailBird.status === 'Sick' ? (
                  <div className="rounded-2xl border border-orange-200 bg-orange-50 px-3 py-3 text-[12px] text-orange-800">
                    This bird is marked sick and should continue to appear in health alerts until status is changed.
                  </div>
                ) : (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-[12px] text-emerald-800">
                    This bird is active in the flock registry and included in normal flock counts.
                  </div>
                )}
              </section>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                <Syringe className="h-4 w-4 text-slate-500" /> Vaccination History
              </h4>
              {detailVaccinations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-[12px] text-slate-500">
                  {L('No vaccination logs found for this bird yet.')}
                </div>
              ) : (
                <div className="space-y-2">
                  {detailVaccinations.map((record) => (
                    <div key={record.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3 text-[12px] text-slate-700">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900">{record.vaccineName}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">{record.notes || 'No notes recorded'}</p>
                        </div>
                        <span className="font-mono text-[11px] text-slate-500">{record.date}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                        {record.dose && <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">Dose: {record.dose}</span>}
                        {typeof record.cost === 'number' && <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">Cost: Rs {record.cost.toLocaleString()}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {isAdmin && (
              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDeleteRequest(detailBird)}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Bird
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleOpenEdit(detailBird)}
                  className="inline-flex items-center gap-2 rounded-xl bg-farm-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-farm-700"
                >
                  <Pencil className="h-4 w-4" />
                  Edit Bird
                </button>
              </div>
            )}
          </div>
        )}
      </DetailModal>

      {/* --- ADD BIRD MODAL (muf-modal) --- */}
      <DetailModal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={L('Log New Bird in Registry')}
        subtitle={L('Register new bird acquisition records')}
        icon={<BirdIcon className="w-5 h-5" />}
        iconBg="bg-farm-100 text-farm-700"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          {birdFormFields}
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition">{L('Cancel')}</button>
            <button type="submit" className="px-4 py-2 bg-farm-600 hover:bg-farm-700 text-white font-semibold text-xs rounded-xl transition">{L('Save Bird Record')}</button>
          </div>
        </form>
      </DetailModal>

      {/* --- EDIT BIRD PROFILE MODAL (muf-modal) --- */}
      <DetailModal
        open={isEditModalOpen && !!selectedBird}
        onClose={() => { setIsEditModalOpen(false); setSelectedBird(null); }}
        title={L('Edit Bird Profile')}
        subtitle={selectedBird ? `Modify ${selectedBird.name} — price, status, or details` : undefined}
        icon={<Pencil className="w-5 h-5" />}
        iconBg="bg-farm-100 text-farm-700"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {birdFormFields}
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => { setIsEditModalOpen(false); setSelectedBird(null); }} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition">{L('Cancel')}</button>
            <button type="submit" className="px-4 py-2 bg-farm-600 hover:bg-farm-700 text-white font-semibold text-xs rounded-xl transition">{L('Save Changes')}</button>
          </div>
        </form>
      </DetailModal>

      {/* FAB — Add New Bird */}
      {isAdmin && (
        <MufFab actions={[
          { icon: <Plus size={18} />, label: 'Add Bird', onClick: () => { resetForm(); setIsAddModalOpen(true); } },
        ]} />
      )}
    </div>
  );
}

function getBirdCardTone(bird: Bird) {
  if (bird.status === 'Dead') return 'bg-rose-50/80 border-rose-200';
  if (bird.status === 'Sold') return 'bg-violet-50/80 border-violet-200';
  if (bird.status === 'Sick') return 'bg-red-50/80 border-red-200';
  return bird.gender === 'Male' ? 'bg-sky-50/70 border-sky-200' : 'bg-rose-50/60 border-rose-200';
}

function getBirdStatusTone(status: BirdStatus) {
  if (status === 'Dead') return 'bg-rose-100 text-rose-700 border-rose-200';
  if (status === 'Sold') return 'bg-violet-100 text-violet-700 border-violet-200';
  if (status === 'Sick') return 'bg-red-100 text-red-700 border-red-200';
  return 'bg-emerald-100 text-emerald-700 border-emerald-200';
}

function getGenderTone(gender: Gender) {
  return gender === 'Male'
    ? 'bg-sky-100 text-sky-700 border-sky-200'
    : 'bg-pink-100 text-pink-700 border-pink-200';
}

function getBirdSecondaryMeta(bird: Bird) {
  if (bird.status === 'Sold') return `Sold ${bird.saleDate || 'date not set'}`;
  if (bird.status === 'Dead') return `Died ${bird.dateDied || 'date not set'}`;
  if (bird.status === 'Sick') return 'Needs care';
  if (bird.sourceIncubationId) return `From incubation #${bird.sourceIncubationId}`;
  if (bird.lastVaccinationDate) return `Last vax ${bird.lastVaccinationDate}`;
  return 'No vaccination log yet';
}

function DetailValueCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 truncate font-mono text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function DetailRow({
  label,
  value,
  valueNode,
  mono = false,
  valueClassName = '',
}: {
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
  mono?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl bg-white/80 px-3 py-2 text-[12px]">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className={`max-w-[65%] text-right text-slate-800 ${mono ? 'font-mono' : ''} ${valueClassName}`}>
        {valueNode ?? value ?? '—'}
      </span>
    </div>
  );
}
