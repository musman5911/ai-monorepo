import { useState, useEffect } from 'react';
import { Droplets, Heart, DollarSign, Baby, Tag, Scale, Activity, Store, Trash2, Camera } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../api';
import type { Cow, MilkEntry, Expense, HealthRecord, RateHistory, CowLifetime, MarketNote, WeightEntry, GalleryPhoto } from '../types';
import { fmt, fmtPKR, fmtL } from '../utils/format';
import { calcRevenueWithHistory } from '../utils/rates';
import { L } from '../i18n';
import { mufStoryNet, mufVerdictText, mufDaysBetween } from '../muf-story';
import { getLang } from '../i18n';
import { todayStr, shiftDate } from '../utils/date';
import DetailModal from '../muf-modal';
import { useConfirm, notify } from '../muf-confirm';
import { compressGalleryImage, GALLERY_MAX_PHOTOS } from '../muf-image';
import { mufFmt } from '../muf-date';

interface CowSummary {
  cow: Cow;
  milk: { last7Days: number; last30Days: number; calfMilk30Days: number; records30: MilkEntry[]; totalLiters: number };
  expenses: { total30: number; byType: Record<string, number>; records30: Expense[]; totalAll: number };
  health: HealthRecord[];
  offspring: Cow[];
  mother: Cow | null;
  sale: { salePrice: number; date?: string } | null;
  lifetime: CowLifetime;
}

function CowImg({ src, name, size = 'w-10 h-10' }: { src?: string; name: string; size?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return <div className={`${size} rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-lg shrink-0`}>🐄</div>;
  }
  return <img src={src} alt={name} className={`${size} rounded-full object-cover border-2 border-farm-300 shrink-0`} onError={() => setBroken(true)} />;
}

interface Props {
  cowId: string;
  rate: number;
  rateHistory?: RateHistory[];
  rateDate?: string;
  onClose: () => void;
  isAdmin?: boolean;
  onCowUpdated?: (cow: Cow) => void;
}

export default function CowDetailPopup({ cowId, rate, rateHistory = [], rateDate = '', onClose, isAdmin = false, onCowUpdated }: Props) {
  const [data, setData] = useState<CowSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const confirmAction = useConfirm();
  // Marketplace (sale/purchase) section state
  const [priceInput, setPriceInput] = useState('');
  const [editingPrice, setEditingPrice] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteBuyer, setNoteBuyer] = useState('');
  const [notePhone, setNotePhone] = useState('');
  const [noteOffer, setNoteOffer] = useState('');
  const [noteText, setNoteText] = useState('');
  const [marketBusy, setMarketBusy] = useState(false);
  // Photo gallery state
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [lightbox, setLightbox] = useState<GalleryPhoto | null>(null);

  // Weight history section state
  const [showWeightForm, setShowWeightForm] = useState(false);
  const [wDate, setWDate] = useState(todayStr());
  const [wKg, setWKg] = useState('');
  const [wNote, setWNote] = useState('');

  async function saveMarket(fields: { expectedPrice?: number; marketNotes?: MarketNote[]; weightHistory?: WeightEntry[]; gallery?: GalleryPhoto[] }) {
    if (!data) return;
    setMarketBusy(true);
    try {
      const updated = await api.updateCow(data.cow._id, fields);
      const mergedCow = { ...data.cow, ...updated, _id: data.cow._id };
      setData({ ...data, cow: mergedCow });
      onCowUpdated?.(mergedCow);
      notify(updated?.offline ? L('Saved on this device. It will sync when internet returns.') : L('Saved'), updated?.offline ? 'info' : 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save', 'error');
    } finally { setMarketBusy(false); }
  }

  useEffect(() => {
    setLoading(true);
    api.getCowSummary(cowId)
      .then(setData)
      .catch(err => console.error('Failed to load cow summary:', err))
      .finally(() => setLoading(false));
  }, [cowId]);

  if (loading) {
    return (
      <DetailModal open onClose={onClose} title={L('Loading…')} size="small">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-farm-600 mx-auto" />
      </DetailModal>
    );
  }

  if (!data) return null;

  const { cow, milk, expenses, health, offspring, mother } = data;
  const milkRev30 = calcRevenueWithHistory(milk.records30, rateHistory, rate, rateDate);

  return (
    <DetailModal
      open
      onClose={onClose}
      title={cow.name}
      subtitle={`${cow.breed} · ${cow.status} · Lact #${cow.lactationNumber || 0}`}
      icon={<CowImg src={cow.image} name={cow.name} size="w-10 h-10" />}
      iconBg=""
     size="big">
        <div className="space-y-6">
          {/* ── Lifetime Story — every animal, alive or sold (muf-story) ── */}
          {data.lifetime && (
            <div className="bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">📖 {L('Lifetime Story')}</h4>
              {(() => {
                const l = data.lifetime;
                const sold = cow.status === 'sold';
                const milkRev = calcRevenueWithHistory(l.milkRecords || [], rateHistory, rate, rateDate);
                // Medicine expenses auto-created from health are already inside totalDirectExpenses.
                // Only add unlinked health costs (legacy rows without a mirrored expense).
                const unlinkedHealth = l.unlinkedHealthCost ?? 0;
                const totalCost = l.purchasePrice + l.totalDirectExpenses + unlinkedHealth;
                const totalIncome = (sold ? l.salePrice : 0) + milkRev;
                const { net, isProfit } = mufStoryNet(totalIncome, totalCost);
                const days = mufDaysBetween(cow.birthDate || undefined, sold ? (data.sale?.date || undefined) : undefined);
                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-stone-400">{L('Purchase Price:')}</span> <span className="font-medium">{fmtPKR(l.purchasePrice)}</span></div>
                      {sold && <div><span className="text-stone-400">{L('Sale Price:')}</span> <span className="font-medium text-purple-600">{fmtPKR(l.salePrice)}</span></div>}
                      <div><span className="text-stone-400">{L('Milk earned')} ({fmt(l.totalMilkLiters)}L):</span> <span className="font-medium text-farm-600">{fmtPKR(milkRev)}</span></div>
                      <div><span className="text-stone-400">{L('Operating Expenses:')}</span> <span className="font-medium text-red-500">{fmtPKR(l.totalDirectExpenses)}</span></div>
                      {days !== null && <div><span className="text-stone-400">{L('Age:')}</span> <span className="font-medium">{Math.floor(days / 365)}y {Math.floor((days % 365) / 30)}m</span></div>}
                      <div className="col-span-2 text-[10px] text-stone-400">
                        {L('Health recorded')}: {fmtPKR(l.totalHealthCost)}
                        {unlinkedHealth > 0
                          ? ` · ${fmtPKR(unlinkedHealth)} ${L('not yet mirrored in expenses (added to P&L)')}`
                          : L('(already included in operating expenses when linked)')}
                      </div>
                    </div>
                    {/* Big verdict card */}
                    <div className={`rounded-xl p-3 text-center font-bold text-sm border ${
                      isProfit
                        ? 'bg-farm-50 dark:bg-farm-900/20 border-farm-200 dark:border-farm-800 text-farm-700 dark:text-farm-400'
                        : net === 0
                          ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                    }`}>
                      {isProfit ? '✅ ' : net === 0 ? '⚖️ ' : '⚠️ '}{mufVerdictText(net, getLang(), 'animal', sold)}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── Info Row ──────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InfoItem icon={Tag} label="Tag" value={`#${cow._id.slice(-6).toUpperCase()}`} />
            <InfoItem icon={Scale} label="Weight" value={cow.weight ? `${fmt(cow.weight)} kg` : 'N/A'} />
            <InfoItem icon={Activity} label={L('Birth')} value={cow.birthDate || 'N/A'} />
            <InfoItem icon={Activity} label={L('Batch')} value={cow.batch || 'N/A'} />
          </div>

          {/* ── Mother / Offspring ────────────────── */}
          {(mother || offspring.length > 0) && (
            <div className="bg-pink-50 dark:bg-pink-900/10 border border-pink-200 dark:border-pink-800 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-pink-700 dark:text-pink-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Baby className="w-3.5 h-3.5" /> Lineage
              </h4>
              {mother && <p className="text-sm text-slate-700 dark:text-slate-300">{L('Mother:')} <span className="font-medium">{mother.name}</span> ({mother.breed})</p>}
              {cow.nursingUntil && (
                <p className="text-sm text-slate-700 dark:text-slate-300">{L('Nursing until:')} <span className="font-medium">{cow.nursingUntil}</span></p>
              )}
              {offspring.length > 0 && (
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                  Offspring: {offspring.map(o => o.name).join(', ')}
                </p>
              )}
            </div>
          )}

          {/* ── Milk Stats ────────────────────────── */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5" /> Milk Production
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatBox label={L('Last 7 Days')} value={fmtL(milk.last7Days)} />
              <StatBox label={L('Last 30 Days')} value={fmtL(milk.last30Days)} />
              <StatBox label={L('Calf Milk (30d)')} value={fmtL(milk.calfMilk30Days)} color="text-pink-600" />
              <StatBox label={L('Revenue (30d)')} value={fmtPKR(milkRev30)} color="text-emerald-600" />
            </div>
          </div>

          {/* ── 14-Day Milk Chart ──────────────────── */}
          {milk.records30.length > 0 && (() => {
            const chartData = [];
            for (let i = 13; i >= 0; i--) {
              const dateStr = shiftDate(todayStr(), -i);
              const entry = milk.records30.find(m => m.date === dateStr);
              const total = entry ? Math.round(((entry.morning || 0) + (entry.evening || 0)) * 10) / 10 : 0;
              chartData.push({ name: mufFmt(new Date(dateStr + 'T00:00:00'), 'weekday'), milk: total });
            }
            return (
              <div className="bg-slate-50 dark:bg-slate-800/30 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{L('Last 14 Days Milk')}</h4>
                <div className="h-36 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                      <Line type="monotone" dataKey="milk" stroke="#1b854a" strokeWidth={2} dot={{ r: 3, fill: '#1b854a', strokeWidth: 0 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })()}

          {/* ── Expenses ──────────────────────────── */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5" /> Expenses (30 days)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatBox label={L('Total')} value={fmtPKR(expenses.total30)} color="text-red-500" />
              {Object.entries(expenses.byType).filter(([, v]) => v > 0).map(([type, amount]) => (
                <StatBox key={type} label={type.charAt(0).toUpperCase() + type.slice(1)} value={fmtPKR(amount)} />
              ))}
            </div>
          </div>

          {/* ── Photo gallery (dated photos over time) ── */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1">
              <Camera className="w-3.5 h-3.5" /> Photos
            </h4>
            <div className="bg-slate-50 dark:bg-slate-800/30 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {(cow.gallery || []).map((g) => (
                  <button key={g.id} onClick={() => setLightbox(g)} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                    <img src={g.base64} alt={g.caption || g.date} className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[9px] px-1 py-0.5 truncate">{g.date}</span>
                  </button>
                ))}
                {isAdmin && (cow.gallery || []).length < GALLERY_MAX_PHOTOS && (
                  <label className={`aspect-square rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center text-slate-400 hover:border-farm-500 hover:text-farm-600 cursor-pointer transition ${galleryBusy ? 'opacity-50 pointer-events-none' : ''}`}>
                    <Camera className="w-5 h-5" />
                    <span className="text-[9px] font-bold mt-1">{galleryBusy ? '…' : 'Add photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        setGalleryBusy(true);
                        try {
                          const base64 = await compressGalleryImage(file);
                          const next: GalleryPhoto[] = [...(cow.gallery || []), { id: `g-${Date.now()}`, date: todayStr(), base64, caption: '' }];
                          await saveMarket({ gallery: next } as any);
                          notify(L('Photo added'));
                        } catch (err) {
                          notify(err instanceof Error ? err.message : 'Could not add the photo', 'error');
                        } finally { setGalleryBusy(false); }
                      }}
                    />
                  </label>
                )}
              </div>
              {(cow.gallery || []).length === 0 && !isAdmin && (
                <p className="text-xs text-slate-400 italic">{L('No photos yet.')}</p>
              )}
            </div>
          </div>

          {/* ── Weight history (growth tracking) ──── */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1">
              <Scale className="w-3.5 h-3.5" /> Weight & Growth
            </h4>
            <div className="bg-slate-50 dark:bg-slate-800/30 rounded-lg p-4 space-y-3">
              {(() => {
                const wh = [...(cow.weightHistory || [])].sort((a, b) => a.date.localeCompare(b.date));
                const latest = wh[wh.length - 1];
                const first = wh[0];
                const gain = latest && first && latest !== first ? Math.round((latest.weightKg - first.weightKg) * 10) / 10 : null;
                return (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase">{L('Current weight')}</p>
                        <p className="text-base font-bold text-slate-800 dark:text-slate-100">
                          {latest ? `${latest.weightKg} kg` : 'Not recorded'}
                          {gain !== null && (
                            <span className={`ml-2 text-xs font-bold ${gain >= 0 ? 'text-farm-600' : 'text-red-500'}`}>
                              {gain >= 0 ? '▲' : '▼'} {Math.abs(gain)} kg since {first.date}
                            </span>
                          )}
                        </p>
                      </div>
                      {isAdmin && (
                        <button onClick={() => setShowWeightForm(v => !v)} className="text-xs font-semibold text-farm-600 hover:text-farm-700 transition">
                          {showWeightForm ? 'Cancel' : '+ Log weight'}
                        </button>
                      )}
                    </div>

                    {showWeightForm && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input type="date" value={wDate} onChange={e => setWDate(e.target.value)} className="muf-field muf-field-auto" />
                        <input type="number" min="0" step="any" placeholder={L('Weight (kg) *')} value={wKg} onChange={e => setWKg(e.target.value)} className="muf-field muf-field-auto" />
                        <input placeholder={L('Note')} value={wNote} onChange={e => setWNote(e.target.value)} className="muf-field muf-field-auto" />
                        <button
                          disabled={marketBusy}
                          onClick={async () => {
                            const kg = Number(wKg);
                            if (!(kg > 0)) { notify(L('Enter a weight above 0'), 'error'); return; }
                            const next: WeightEntry[] = [...(cow.weightHistory || []), { id: `w-${Date.now()}`, date: wDate, weightKg: kg, note: wNote.trim() }];
                            await saveMarket({ weightHistory: next } as any);
                            setWKg(''); setWNote(''); setShowWeightForm(false);
                          }}
                          className="sm:col-span-3 bg-farm-600 hover:bg-farm-700 disabled:opacity-60 text-white px-3 py-2 rounded-lg text-xs font-semibold transition"
                        >{L('Save weight')}</button>
                      </div>
                    )}

                    {wh.length >= 2 && (
                      <div className="h-32 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={wh.map(w => ({ name: w.date.slice(2), kg: w.weightKg }))}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#94a3b8' }} />
                            <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                            <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                            <Line type="monotone" dataKey="kg" stroke="#1b854a" strokeWidth={2} dot={{ r: 3, fill: '#1b854a', strokeWidth: 0 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {wh.length > 0 && (
                      <div className="space-y-1 max-h-36 overflow-y-auto">
                        {[...wh].reverse().map(w => (
                          <div key={w.id} className="flex items-center justify-between gap-2 text-xs p-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg">
                            <span className="text-slate-500">{w.date}</span>
                            <span className="font-bold text-slate-700 dark:text-slate-200">{w.weightKg} kg</span>
                            <span className="text-slate-400 truncate flex-1 text-right">{w.note || ''}</span>
                            {isAdmin && (
                              <button
                                onClick={async () => {
                                  const ok = await confirmAction({ title: 'Delete Weight Entry', message: `Remove the ${w.date} weight entry?`, confirmLabel: 'Delete', tone: 'danger' });
                                  if (!ok) return;
                                  await saveMarket({ weightHistory: (cow.weightHistory || []).filter(x => x.id !== w.id) } as any);
                                }}
                                className="p-1 rounded text-red-400 hover:text-red-600 transition shrink-0"
                              ><Trash2 className="w-3 h-3" /></button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* ── Marketplace / Sale notes ──────────── */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1">
              <Store className="w-3.5 h-3.5" /> Sale &amp; Buyer Interest
            </h4>
            <div className="bg-slate-50 dark:bg-slate-800/30 rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">{L('Expected sale price')}</p>
                  {editingPrice ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="number" min="0" autoFocus
                        value={priceInput}
                        onChange={e => setPriceInput(e.target.value)}
                        className="w-32 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-950 outline-none focus:border-farm-500"
                        placeholder="Rs"
                      />
                      <button
                        disabled={marketBusy}
                        onClick={async () => { await saveMarket({ expectedPrice: Number(priceInput) || 0 }); setEditingPrice(false); }}
                        className="text-xs font-semibold text-white bg-farm-600 hover:bg-farm-700 disabled:opacity-60 px-3 py-1.5 rounded-lg transition"
                      >{L('Save')}</button>
                      <button onClick={() => setEditingPrice(false)} className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition">{L('Cancel')}</button>
                    </div>
                  ) : (
                    <p className="text-base font-bold text-slate-800 dark:text-slate-100">
                      {cow.expectedPrice ? fmtPKR(cow.expectedPrice) : 'Not set'}
                    </p>
                  )}
                </div>
                {isAdmin && !editingPrice && (
                  <button
                    onClick={() => { setPriceInput(String(cow.expectedPrice || '')); setEditingPrice(true); }}
                    className="text-xs font-semibold text-farm-600 hover:text-farm-700 transition"
                  >{cow.expectedPrice ? 'Change price' : 'Set price'}</button>
                )}
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-slate-400 uppercase">{L('Interested buyers')}</p>
                  {isAdmin && (
                    <button onClick={() => setShowNoteForm(v => !v)} className="text-xs font-semibold text-farm-600 hover:text-farm-700 transition">
                      {showNoteForm ? 'Cancel' : '+ Add buyer'}
                    </button>
                  )}
                </div>

                {showNoteForm && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    <input placeholder={L('Buyer name *')} value={noteBuyer} onChange={e => setNoteBuyer(e.target.value)} className="muf-field muf-field-auto" />
                    <input placeholder={L('Phone')} value={notePhone} onChange={e => setNotePhone(e.target.value)} className="muf-field muf-field-auto" />
                    <input type="number" min="0" placeholder={L('Offer (Rs)')} value={noteOffer} onChange={e => setNoteOffer(e.target.value)} className="muf-field muf-field-auto" />
                    <input placeholder={L('Note')} value={noteText} onChange={e => setNoteText(e.target.value)} className="muf-field muf-field-auto" />
                    <button
                      disabled={marketBusy}
                      onClick={async () => {
                        if (!noteBuyer.trim()) { notify(L('Enter the buyer name'), 'error'); return; }
                        const next: MarketNote[] = [...(cow.marketNotes || []), {
                          id: `mn-${Date.now()}`,
                          date: todayStr(),
                          buyer: noteBuyer.trim(),
                          phone: notePhone.trim(),
                          offer: Number(noteOffer) || 0,
                          note: noteText.trim(),
                        }];
                        await saveMarket({ marketNotes: next });
                        setNoteBuyer(''); setNotePhone(''); setNoteOffer(''); setNoteText(''); setShowNoteForm(false);
                      }}
                      className="sm:col-span-2 bg-farm-600 hover:bg-farm-700 disabled:opacity-60 text-white px-3 py-2 rounded-lg text-xs font-semibold transition"
                    >{L('Save buyer')}</button>
                  </div>
                )}

                {(cow.marketNotes || []).length === 0 ? (
                  <p className="text-sm text-slate-400">{L('No interested buyers noted yet')}</p>
                ) : (
                  <div className="space-y-2">
                    {(cow.marketNotes || []).map(n => (
                      <div key={n.id} className="flex items-start justify-between gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm">
                        <div>
                          <p className="font-medium text-slate-800 dark:text-slate-100">
                            {n.buyer}
                            {n.offer ? <span className="ml-2 text-farm-600 font-bold">{fmtPKR(n.offer)}</span> : null}
                          </p>
                          <p className="text-xs text-slate-400">{n.date}{n.phone ? ` · ${n.phone}` : ''}{n.note ? ` · ${n.note}` : ''}</p>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={async () => {
                              const ok = await confirmAction({ title: 'Remove Buyer Note', message: `Remove ${n.buyer} from the list?`, confirmLabel: 'Remove', tone: 'danger' });
                              if (!ok) return;
                              await saveMarket({ marketNotes: (cow.marketNotes || []).filter(x => x.id !== n.id) });
                            }}
                            className="p-1 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition shrink-0"
                            title={L('Remove')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Health Records ────────────────────── */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1">
              <Heart className="w-3.5 h-3.5" /> Health Records (last 10)
            </h4>
            {health.length > 0 ? (
              <div className="space-y-2">
                {health.map(h => (
                  <div key={h._id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-sm">
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-100">{h.description}</p>
                      <p className="text-xs text-slate-400">{h.date} · {h.type}{h.medicine ? ` · ${h.medicine}` : ''}</p>
                    </div>
                    <div className="text-right">
                      {h.cost ? <p className="text-xs font-medium text-slate-600">{fmtPKR(h.cost)}</p> : null}
                      {h.nextDueDate && <p className="text-[10px] text-amber-500">Due: {h.nextDueDate}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">{L('No health records')}</p>
            )}
          </div>
        </div>
      {lightbox && (
        <div className="fixed inset-0 z-[var(--muf-z-popup-step)] bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.base64} alt={lightbox.caption || lightbox.date} className="w-full max-h-[75vh] object-contain rounded-xl" />
            <div className="flex items-center justify-between mt-2 text-white text-xs">
              <span>{lightbox.date}{lightbox.caption ? ` · ${lightbox.caption}` : ''}</span>
              <div className="flex gap-2">
                {isAdmin && (
                  <button
                    onClick={async () => {
                      const ok = await confirmAction({ title: 'Delete Photo', message: `Remove the ${lightbox.date} photo?`, confirmLabel: 'Delete', tone: 'danger' });
                      if (!ok) return;
                      await saveMarket({ gallery: (cow.gallery || []).filter((g) => g.id !== lightbox.id) } as any);
                      setLightbox(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 font-bold transition"
                  >{L('Delete')}</button>
                )}
                <button onClick={() => setLightbox(null)} className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 font-bold transition">{L('Close')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DetailModal>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3 h-3 text-slate-400" />
        <span className="text-[10px] text-slate-400 uppercase">{label}</span>
      </div>
      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
      <p className="text-[10px] text-slate-400 uppercase mb-1">{label}</p>
      <p className={`text-base font-bold ${color || 'text-slate-800 dark:text-slate-100'}`}>{value}</p>
    </div>
  );
}
