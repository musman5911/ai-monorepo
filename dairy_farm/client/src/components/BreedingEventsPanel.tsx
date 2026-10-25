import { useEffect, useMemo, useState } from 'react';
import { CalendarHeart, Plus, Pencil, Trash2, History, RefreshCw } from 'lucide-react';
import { api } from '../api';
import { L } from '../i18n';
import { Cow } from '../types';
import { notify, useConfirm } from '../muf/core/muf-confirm';
import DetailModal from '../muf/core/muf-modal';
import { todayStr } from '../utils/date';

type EventType = 'heat' | 'service' | 'pregnancy_check' | 'calving';
type SireSource = '' | 'farm_bull' | 'outside_bull' | 'outside_straw';
interface BreedingEvent {
  _id: string; cowId: string; type: EventType; date: string;
  sireSource?: SireSource; bullId?: string; bullName?: string; semenCode?: string;
  technician?: string; result?: string; notes?: string;
}
interface EventDraft {
  cowId: string; type: EventType; date: string; sireSource: SireSource;
  bullId: string; bullName: string; semenCode: string; technician: string; result: string; notes: string;
}
const emptyDraft = (): EventDraft => ({
  cowId: '', type: 'heat', date: todayStr(), sireSource: '', bullId: '', bullName: '',
  semenCode: '', technician: '', result: '', notes: '',
});
const TYPE_LABEL: Record<EventType, string> = {
  heat: 'Heat', service: 'Service / Tikka', pregnancy_check: 'Pregnancy check', calving: 'Calving',
};

export default function BreedingEventsPanel({ isAdmin }: { isAdmin: boolean }) {
  const confirm = useConfirm();
  const [cows, setCows] = useState<Cow[]>([]);
  const [events, setEvents] = useState<BreedingEvent[]>([]);
  const [filterCow, setFilterCow] = useState('');
  const [filterType, setFilterType] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<EventDraft>(emptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bullSearch, setBullSearch] = useState('');

  const females = useMemo(() => cows.filter(c => c.gender !== 'male' && c.status !== 'sold' && c.status !== 'inactive' && c.status !== 'calf' && !c.isCalf), [cows]);
  const bulls = useMemo(() => cows.filter(c => c.gender === 'male' && c.status !== 'sold' && c.status !== 'calf' && !c.isCalf), [cows]);
  const cowNames = useMemo(() => Object.fromEntries(cows.map(c => [c._id, c.name])), [cows]);
  const filteredBulls = useMemo(() => bulls.filter(b => `${b.name} ${b.breed}`.toLowerCase().includes(bullSearch.trim().toLowerCase())), [bulls, bullSearch]);

  const load = async () => {
    setLoading(true);
    try {
      const [cowData, eventData] = await Promise.all([
        api.getCows(),
        api.getBreedingEvents({ cowId: filterCow || undefined, type: filterType || undefined, limit: '200' }),
      ]);
      setCows(cowData as Cow[]);
      setEvents((eventData?.events || []) as BreedingEvent[]);
    } catch (error) {
      notify(error instanceof Error ? error.message : L('Failed to load breeding events'), 'error');
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [filterCow, filterType]);

  const openNew = () => {
    setEditingId(null);
    setBullSearch('');
    setDraft({ ...emptyDraft(), cowId: filterCow || females[0]?._id || '' });
    setModalOpen(true);
  };
  const openEdit = (event: BreedingEvent) => {
    setEditingId(event._id);
    setBullSearch('');
    setDraft({
      cowId: event.cowId, type: event.type, date: event.date, sireSource: event.sireSource || '',
      bullId: event.bullId || '', bullName: event.bullName || '', semenCode: event.semenCode || '',
      technician: event.technician || '', result: event.result || '', notes: event.notes || '',
    });
    setModalOpen(true);
  };
  const change = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) =>
    setDraft(current => ({ ...current, [key]: value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.cowId) { notify(L('Choose a cow'), 'error'); return; }
    if (draft.sireSource === 'farm_bull' && !draft.bullId) { notify(L('Choose a farm bull'), 'error'); return; }
    if ((draft.sireSource === 'outside_bull' || draft.sireSource === 'outside_straw') && !draft.bullName.trim()) {
      notify(L('Enter the outside bull name'), 'error'); return;
    }
    if (draft.sireSource === 'outside_straw' && !draft.semenCode.trim()) { notify(L('Enter the semen code'), 'error'); return; }
    const payload = {
      ...draft,
      sireSource: draft.sireSource || undefined,
      bullId: draft.sireSource === 'farm_bull' ? draft.bullId : '',
      bullName: draft.sireSource === 'outside_bull' || draft.sireSource === 'outside_straw' ? draft.bullName.trim() : '',
      semenCode: draft.sireSource === 'outside_straw' ? draft.semenCode.trim() : '',
      technician: draft.technician.trim(), result: draft.result.trim(), notes: draft.notes.trim(),
    };
    setSaving(true);
    try {
      if (editingId) await api.updateBreedingEvent(editingId, payload);
      else await api.addBreedingEvent(payload);
      notify(L('Breeding event saved'), 'success');
      setModalOpen(false);
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : L('Failed to save breeding event'), 'error');
    } finally { setSaving(false); }
  };

  const remove = async (event: BreedingEvent) => {
    const accepted = await confirm({ title: L('Delete event'), message: L('Delete this breeding event?'), confirmLabel: L('Delete'), tone: 'danger' });
    if (!accepted) return;
    try {
      await api.deleteBreedingEvent(event._id);
      notify(L('Breeding event deleted'), 'success');
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : L('Failed to delete breeding event'), 'error');
    }
  };

  const field = 'muf-field';
  const label = 'muf-label block mb-1';
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 sm:p-4" aria-label={L('Breeding event history')}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-farm-600" />
          <div>
            <h3 className="font-bold text-sm">{L('Breeding event history')}</h3>
            <p className="text-[11px] text-slate-500">{L('Record heat, service, pregnancy checks and calving for each cow.')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} className="muf-icon-button" title={L('Refresh')} aria-label={L('Refresh')}><RefreshCw size={15} /></button>
          <button type="button" onClick={openNew} disabled={females.length === 0} className="inline-flex items-center gap-1.5 rounded-lg bg-farm-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Plus size={14} />{L('Add breeding event')}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div><label className={label}>{L('Filter by cow')}</label><select className={field} value={filterCow} onChange={e => setFilterCow(e.target.value)}><option value="">{L('All cows')}</option>{females.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
        <div><label className={label}>{L('Event type')}</label><select className={field} value={filterType} onChange={e => setFilterType(e.target.value)}><option value="">{L('All event types')}</option>{(Object.keys(TYPE_LABEL) as EventType[]).map(type => <option key={type} value={type}>{L(TYPE_LABEL[type])}</option>)}</select></div>
      </div>

      {loading ? <p className="py-5 text-center text-xs text-slate-500">{L('Loading…')}</p> : events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-xs text-slate-500">{L('No breeding events recorded yet.')}</div>
      ) : (
        <div className="space-y-2">
          {events.map(event => (
            <article key={event._id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex flex-col sm:flex-row sm:items-start gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm">{cowNames[event.cowId] || L('Unknown cow')}</strong>
                  <span className="rounded-full bg-farm-50 dark:bg-farm-900/30 px-2 py-0.5 text-[10px] font-bold text-farm-700 dark:text-farm-300">{L(TYPE_LABEL[event.type])}</span>
                  <time className="text-[11px] text-slate-500">{event.date}</time>
                </div>
                {(event.bullName || event.bullId || event.semenCode) && <p className="text-xs text-slate-600 dark:text-slate-300">{L('Father')}: {event.bullId ? cowNames[event.bullId] || L('Farm bull') : event.bullName}{event.semenCode ? ` · ${L('Semen code')}: ${event.semenCode}` : ''}</p>}
                {event.technician && <p className="text-xs text-slate-500">{L('Technician')}: {event.technician}</p>}
                {event.result && <p className="text-xs text-slate-600 dark:text-slate-300">{L('Result')}: {event.result}</p>}
                {event.notes && <p className="text-xs text-slate-500 whitespace-pre-wrap">{event.notes}</p>}
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => openEdit(event)} className="muf-icon-button" title={L('Edit event')} aria-label={L('Edit event')}><Pencil size={14} /></button>
                {isAdmin && <button type="button" onClick={() => void remove(event)} className="muf-icon-button text-red-600" title={L('Delete event')} aria-label={L('Delete event')}><Trash2 size={14} /></button>}
              </div>
            </article>
          ))}
          <p className="text-[10px] text-slate-500">{L('Showing up to 200 events. Use filters to narrow the history.')}</p>
        </div>
      )}

      <DetailModal open={modalOpen} onClose={() => setModalOpen(false)} title={L(editingId ? 'Edit breeding event' : 'Add breeding event')} subtitle={L('Breeding records stay attached to the selected farm.')} icon={<CalendarHeart className="w-5 h-5" />} iconBg="bg-pink-100 text-pink-700" size="big">
        <form onSubmit={save} className="space-y-3 text-xs">
          <div><label className={label}>{L('Cow')} *</label><select required className={field} value={draft.cowId} onChange={e => change('cowId', e.target.value)}><option value="">{L('Choose a cow')}</option>{females.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
          <div className="muf-pc-form-grid">
            <div><label className={label}>{L('Event type')} *</label><select required className={field} value={draft.type} onChange={e => change('type', e.target.value as EventType)}>{(Object.keys(TYPE_LABEL) as EventType[]).map(type => <option key={type} value={type}>{L(TYPE_LABEL[type])}</option>)}</select></div>
            <div><label className={label}>{L('Date')} *</label><input required type="date" className={field} value={draft.date} onChange={e => change('date', e.target.value)} /></div>
          </div>
          {(draft.type === 'service' || draft.type === 'pregnancy_check') && <>
            <div><label className={label}>{L('Father source')}</label><select className={field} value={draft.sireSource} onChange={e => { const source = e.target.value as SireSource; setDraft(current => ({ ...current, sireSource: source, bullId: '', bullName: '', semenCode: '' })); setBullSearch(''); }}><option value="">{L('Not recorded')}</option><option value="farm_bull">{L('Bull on this farm')}</option><option value="outside_bull">{L('Outside bull')}</option><option value="outside_straw">{L('Outside semen straw')}</option></select></div>
            {draft.sireSource === 'farm_bull' && <div><label className={label}>{L('Choose a farm bull')} *</label><input type="search" className={field} value={bullSearch} onChange={e => setBullSearch(e.target.value)} placeholder={L('Search farm bulls')} aria-label={L('Search farm bulls')} /><select required className={field + ' mt-2'} value={draft.bullId} onChange={e => change('bullId', e.target.value)}><option value="">{L('Choose a bull')}</option>{filteredBulls.map(b => <option key={b._id} value={b._id}>{b.name} · {b.breed}</option>)}</select>{bulls.length === 0 && <p className="mt-1 text-amber-600">{L('No eligible farm bulls found.')}</p>}{bulls.length > 0 && filteredBulls.length === 0 && <p className="mt-1 text-slate-500">{L('No matching bulls.')}</p>}</div>}
            {(draft.sireSource === 'outside_bull' || draft.sireSource === 'outside_straw') && <div><label className={label}>{L('Outside bull name')} *</label><input required maxLength={160} className={field} value={draft.bullName} onChange={e => change('bullName', e.target.value)} /></div>}
            {draft.sireSource === 'outside_straw' && <div><label className={label}>{L('Semen code')} *</label><input required maxLength={100} className={field} value={draft.semenCode} onChange={e => change('semenCode', e.target.value)} /></div>}
          </>}
          <div><label className={label}>{L('Technician')}</label><input maxLength={120} className={field} value={draft.technician} onChange={e => change('technician', e.target.value)} /></div>
          <div><label className={label}>{L('Result')}</label><input maxLength={500} className={field} value={draft.result} onChange={e => change('result', e.target.value)} placeholder={L(draft.type === 'pregnancy_check' ? 'e.g. Positive / Negative' : 'Optional result')} /></div>
          <div><label className={label}>{L('Notes')}</label><textarea rows={3} maxLength={2000} className={field} value={draft.notes} onChange={e => change('notes', e.target.value)} /></div>
          <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 font-bold">{L('Cancel')}</button><button type="submit" disabled={saving} className="rounded-lg bg-farm-600 px-4 py-2 font-bold text-white disabled:opacity-50">{saving ? L('Saving…') : L('Save')}</button></div>
        </form>
      </DetailModal>
    </section>
  );
}
