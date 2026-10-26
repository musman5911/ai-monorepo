import React, { useEffect, useState } from 'react';
import { Check, Pencil, Plus, Ruler, Trash2, X } from 'lucide-react';
import * as api from '../api';
import { useConfirm } from '../muf/core/muf-confirm';
import { L } from '../i18n';

type FieldRecord = { _id: string; name: string; acres?: number; notes?: string };

export default function AgriFieldsPanel({ open, onClose, showAlert, onFieldsChange }) {
  const confirm = useConfirm();
  const [fields, setFields] = useState<FieldRecord[]>([]);
  const [name, setName] = useState('');
  const [acres, setAcres] = useState('');
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => { setName(''); setAcres(''); setNotes(''); setEditingId(''); };
  const loadFields = async () => {
    setLoading(true);
    try {
      const response = await api.getFields();
      const rows = Array.isArray(response.data) ? response.data : [];
      setFields(rows);
      onFieldsChange?.(rows);
    } catch (error) {
      showAlert(error?.response?.data?.detail || L('Failed to load fields.', 'کھیتوں کی فہرست لوڈ نہیں ہو سکی۔'), true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) void loadFields(); }, [open]);

  const submit = async (event) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const acreage = Number(acres);
    if (!trimmedName) return showAlert(L('Field name is required.', 'کھیت کا نام ضروری ہے۔'), true);
    if (acres !== '' && (!Number.isFinite(acreage) || acreage < 0)) return showAlert(L('Acres must be zero or greater.', 'رقبہ صفر یا اس سے زیادہ ہونا چاہیے۔'), true);
    setSaving(true);
    try {
      const payload = { name: trimmedName, acres: acres === '' ? 0 : acreage, notes: notes.trim() };
      if (editingId) await api.updateField(editingId, payload);
      else await api.addField(payload);
      await loadFields();
      reset();
      showAlert(editingId ? L('Field updated.', 'کھیت کی معلومات اپ ڈیٹ ہو گئیں۔') : L('Field added.', 'کھیت شامل ہو گیا۔'));
    } catch (error) {
      showAlert(error?.response?.data?.detail || L('Failed to save field.', 'کھیت محفوظ نہیں ہو سکا۔'), true);
    } finally {
      setSaving(false);
    }
  };

  const edit = (field) => {
    setEditingId(field._id);
    setName(field.name || '');
    setAcres(String(field.acres ?? 0));
    setNotes(field.notes || '');
  };

  const remove = async (field) => {
    const ok = await confirm({ title: L('Delete field', 'کھیت حذف کریں'), message: L('Delete this field?', 'کیا یہ کھیت حذف کرنا ہے؟'), tone: 'danger', confirmLabel: L('Delete', 'حذف کریں'), cancelLabel: L('Cancel', 'منسوخ کریں') });
    if (!ok) return;
    try {
      await api.deleteField(field._id);
      const rows = fields.filter(item => item._id !== field._id);
      setFields(rows);
      onFieldsChange?.(rows);
      if (editingId === field._id) reset();
      showAlert(L('Field deleted.', 'کھیت حذف ہو گیا۔'));
    } catch (error) {
      showAlert(error?.response?.data?.detail || L('Cannot delete a field linked to crop cycles or finance entries.', 'فصل کے دورانیے یا مالی اندراجات سے منسلک کھیت حذف نہیں کیا جا سکتا۔'), true);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[var(--muf-z-modal)] flex items-end sm:items-center justify-center bg-black/50 p-3" role="dialog" aria-modal="true" aria-labelledby="agri-fields-title">
      <section className="w-full max-w-2xl max-h-[85dvh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div><h2 id="agri-fields-title" className="text-lg font-black">{L('Fields', 'کھیت')}</h2><p className="text-xs text-slate-500">{L('Manage field names and acreage.', 'کھیتوں کے نام اور رقبہ منظم کریں۔')}</p></div>
          <button type="button" onClick={onClose} aria-label={L('Close fields', 'کھیت بند کریں')} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18}/></button>
        </header>
        <form onSubmit={submit} className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className="muf-label">{L('Field name', 'کھیت کا نام')} *</label><input required className="muf-field" value={name} onChange={event => setName(event.target.value)} /></div>
          <div><label className="muf-label">{L('Acres', 'ایکڑ')}</label><input min="0" step="0.01" type="number" className="muf-field" value={acres} onChange={event => setAcres(event.target.value)} /></div>
          <div className="sm:col-span-2"><label className="muf-label">{L('Notes', 'نوٹس')}</label><textarea rows={2} className="muf-field" value={notes} onChange={event => setNotes(event.target.value)} /></div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-farm-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{editingId ? <Check size={15}/> : <Plus size={15}/>} {saving ? L('Saving...', 'محفوظ ہو رہا ہے...') : editingId ? L('Update field', 'کھیت اپ ڈیٹ کریں') : L('Add field', 'کھیت شامل کریں')}</button>
            {editingId && <button type="button" onClick={reset} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold dark:border-slate-700">{L('Cancel edit', 'ترمیم منسوخ کریں')}</button>}
          </div>
        </form>
        <div className="space-y-2">
          {loading ? <p className="py-6 text-center text-xs text-slate-500">{L('Loading fields...', 'کھیت لوڈ ہو رہے ہیں...')}</p> : fields.length === 0 ? <p className="py-6 text-center text-xs text-slate-500">{L('No fields yet. Add your first field above.', 'ابھی کوئی کھیت نہیں۔ اوپر پہلا کھیت شامل کریں۔')}</p> : fields.map(field => (
            <article key={field._id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="min-w-0"><p className="font-bold">{field.name}</p><p className="flex items-center gap-1 text-xs text-slate-500"><Ruler size={12}/>{Number(field.acres || 0).toLocaleString()} {L('acres', 'ایکڑ')}</p>{field.notes && <p className="mt-1 break-words text-xs text-slate-500">{field.notes}</p>}</div>
              <div className="flex shrink-0 gap-1"><button type="button" onClick={() => edit(field)} aria-label={L('Edit field', 'کھیت میں ترمیم کریں')} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><Pencil size={15}/></button><button type="button" onClick={() => void remove(field)} aria-label={L('Delete field', 'کھیت حذف کریں')} className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 size={15}/></button></div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
