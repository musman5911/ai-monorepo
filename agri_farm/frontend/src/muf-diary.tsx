import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Plus, Pencil, Trash2, CalendarDays, Camera, ImagePlus, Mic, Square, Download, Share2, X, Link2, Volume2 } from 'lucide-react';
import { L } from './i18n';
import { mufToday } from './muf-date';
import DetailModal from './muf-modal';
import { notify, useConfirm } from './muf-confirm';
import { compressDiaryPhoto, type DiaryPhoto } from './muf-diary-media';
import { isVoiceSupported, startVoiceRecording, type VoiceRecorder } from './muf-voice';

export interface MufDiaryLink {
  id: string;
  type: string;
  label: string;
}
export interface MufDiaryChoice {
  id: string;
  type: string;
  label: string;
  phone?: string;
}
export interface MufDiaryEntry {
  id: string;
  date: string;
  note: string;
  photos: DiaryPhoto[];
  voiceBase64?: string;
  linkedEntity?: MufDiaryLink | null;
  createdAt?: string;
  updatedAt?: string;
  originalDate?: string;
}
interface Props {
  entries: MufDiaryEntry[];
  onSave: (entry: MufDiaryEntry) => void | Promise<void>;
  onDelete: (id: string, date: string) => void | Promise<void>;
  entityOptions?: MufDiaryChoice[];
  shareTargets?: MufDiaryChoice[];
  uploadPhoto?: (file: File) => Promise<string>;
  readOnly?: boolean;
}

const makeId = (prefix: string) => prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
const linkKey = (link?: MufDiaryLink | null) => link ? link.type + ':' + link.id : '';

export default function MufDiary({ entries, onSave, onDelete, entityOptions = [], shareTargets = [], uploadPhoto, readOnly = false }: Props) {
  const confirm = useConfirm();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingExisting, setEditingExisting] = useState(false);
  const [draft, setDraft] = useState<MufDiaryEntry>(() => ({ id: '', date: mufToday(), note: '', photos: [] }));
  const [selectedLink, setSelectedLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recorder, setRecorder] = useState<VoiceRecorder | null>(null);
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [viewing, setViewing] = useState<MufDiaryEntry | null>(null);
  const [fullPhoto, setFullPhoto] = useState<DiaryPhoto | null>(null);
  const [shareTarget, setShareTarget] = useState('');

  useEffect(() => () => { recorderRef.current?.cancel(); }, []);

  const sortedEntries = useMemo(
    () => [...entries].map((e) => ({ ...e, id: e.id || ('legacy-' + e.date), photos: Array.isArray(e.photos) ? e.photos : [] }))
      .sort((a, b) => b.date.localeCompare(a.date) || String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''))),
    [entries],
  );

  function closeEditor() {
    if (recorderRef.current) recorderRef.current.cancel();
    recorderRef.current = null;
    setRecorder(null);
    setRecording(false);
    setBusy(false);
    setEditorOpen(false);
    setEditingExisting(false);
  }

  function startNew() {
    setViewing(null);
    setEditingExisting(false);
    setDraft({ id: makeId('diary'), date: mufToday(), note: '', photos: [], createdAt: new Date().toISOString() });
    setSelectedLink('');
    setEditorOpen(true);
  }

  function editEntry(entry: MufDiaryEntry) {
    if (readOnly) return;
    setViewing(null);
    setEditingExisting(true);
    setDraft({ ...entry, id: entry.id || ('legacy-' + entry.date), originalDate: entry.date, photos: [...(entry.photos || [])] });
    setSelectedLink(linkKey(entry.linkedEntity));
    setEditorOpen(true);
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const next = [...(draft.photos || [])];
      for (const file of Array.from(files)) {
        if (next.length >= 10) {
          notify(L('Only 10 photos can be added to one diary note.'), 'info');
          break;
        }
        if (!file.type.startsWith('image/')) continue;
        const photo = uploadPhoto
          ? { data: await uploadPhoto(file), bytes: file.size }
          : await compressDiaryPhoto(file);
        next.push({ id: makeId('photo'), date: draft.date, data: photo.data, bytes: photo.bytes, createdAt: new Date().toISOString() });
      }
      setDraft((d) => ({ ...d, photos: next }));
    } catch (err) {
      notify(err instanceof Error ? err.message : L('Could not add the photo.'), 'error');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
      if (cameraRef.current) cameraRef.current.value = '';
    }
  }

  function removeDraftPhoto(id: string) {
    setDraft((d) => ({ ...d, photos: d.photos.filter((p) => p.id !== id) }));
  }

  async function toggleRecording() {
    if (recording && recorder) {
      try {
        const voiceBase64 = await recorder.stop();
        setDraft((d) => ({ ...d, voiceBase64 }));
        notify(L('Voice note recorded. Press Save to keep it with this diary note.'), 'success');
      } catch (err) {
        notify(err instanceof Error ? err.message : L('Recording failed.'), 'error');
      } finally {
        recorderRef.current = null;
        setRecorder(null);
        setRecording(false);
      }
      return;
    }
    if (!isVoiceSupported()) {
      notify(L('This browser cannot record audio.'), 'error');
      return;
    }
    try {
      const next = await startVoiceRecording(() => setRecording(false));
      recorderRef.current = next;
      setRecorder(next);
      setRecording(true);
    } catch {
      notify(L('Microphone permission is needed to record.'), 'error');
    }
  }

  async function saveEntry() {
    if (readOnly || busy || recording) return;
    const link = entityOptions.find((o) => o.type + ':' + o.id === selectedLink);
    const note: MufDiaryEntry = {
      ...draft,
      id: draft.id || makeId('diary'),
      note: draft.note.trim(),
      photos: draft.photos || [],
      linkedEntity: link ? { id: link.id, type: link.type, label: link.label } : null,
      updatedAt: new Date().toISOString(),
      originalDate: draft.originalDate,
    };
    if (!note.note && !note.photos.length && !note.voiceBase64) {
      notify(L('Add a note, photo, or voice recording before saving.'), 'info');
      return;
    }
    try {
      setBusy(true);
      await onSave(note);
      setEditorOpen(false);
      setViewing(null);
      notify(L('Diary note saved.'), 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : L('Could not save the diary note.'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function deleteEntry(entry: MufDiaryEntry) {
    if (readOnly) return;
    const ok = await confirm({ title: L('Delete diary note'), message: L('This note and its attachments will be removed.'), confirmLabel: L('Delete'), cancelLabel: L('Cancel'), tone: 'danger' });
    if (!ok) return;
    try {
      await onDelete(entry.id || ('legacy-' + entry.date), entry.originalDate || entry.date);
      setViewing(null);
      setEditorOpen(false);
      notify(L('Diary note deleted.'), 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : L('Could not delete the diary note.'), 'error');
    }
  }

  const currentShareTarget = shareTargets.find((t) => t.type + ':' + t.id === shareTarget);
  const shareText = (photo: DiaryPhoto) => {
    const to = currentShareTarget ? L('For') + ' ' + currentShareTarget.label + (currentShareTarget.phone ? ' (' + currentShareTarget.phone + ')' : '') + '\n' : '';
    const body = viewing?.note ? viewing.note + '\n' : '';
    const hostedUrl = photo.data.startsWith('http') ? photo.data : (photo.data.startsWith('/') ? window.location.origin + photo.data : '');
    return to + body + L('Diary photo') + ' (' + (viewing?.date || photo.date) + ')' + (hostedUrl ? '\n' + hostedUrl : '');
  };

  async function sharePhoto(photo: DiaryPhoto) {
    try {
      const response = await fetch(photo.data, { credentials: 'include' });
      if (response.ok && typeof navigator.share === 'function') {
        const blob = await response.blob();
        const file = new File([blob], 'diary-photo-' + (viewing?.date || photo.date) + '.jpg', { type: blob.type || 'image/jpeg' });
        if (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] })) {
          await navigator.share({ title: L('Diary photo'), text: shareText(photo), files: [file] });
          return;
        }
      }
    } catch {
      // Fall through to a direct contact share when file-sharing is unavailable.
    }
    if (currentShareTarget?.phone) {
      const phone = currentShareTarget.phone.replace(/[^0-9]/g, '');
      const text = shareText(photo) + (photo.data.startsWith('data:') ? '\n' + L('Download the photo from this diary note before attaching it in WhatsApp.') : '');
      window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(text), '_blank', 'noopener,noreferrer');
      return;
    }
    if (typeof navigator.share === 'function') {
      const hostedUrl = photo.data.startsWith('http') ? photo.data : (photo.data.startsWith('/') ? window.location.origin + photo.data : undefined);
      await navigator.share({ title: L('Diary photo'), text: shareText(photo), ...(hostedUrl ? { url: hostedUrl } : {}) });
      return;
    }
    notify(L('Choose a contact with a phone number to share through WhatsApp, or download the photo.'), 'info');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
            <BookOpen className="w-4 h-4 text-farm-600" /> {L('Diary notes')}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{L('Notes, photos and voice recordings saved together')}</p>
        </div>
        {!readOnly && (
          <button type="button" onClick={startNew} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-farm-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-farm-700">
            <Plus className="h-4 w-4" /> {L('Add note')}
          </button>
        )}
      </div>

      {sortedEntries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 px-5 py-10 text-center">
          <BookOpen className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{L('Your diary is empty')}</p>
          <p className="mt-1 text-xs text-slate-400">{L('Press + Add note to save your first entry.')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedEntries.map((entry) => (
            <div key={entry.id} className="flex items-stretch gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <button type="button" onClick={() => setViewing(entry)} className="min-w-0 flex-1 text-left">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-slate-500">
                  <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {entry.date}</span>
                  {entry.photos.length > 0 && <span>{entry.photos.length} {L('photos')}</span>}
                  {entry.voiceBase64 && <span className="inline-flex items-center gap-1"><Volume2 className="h-3 w-3" /> {L('Voice')}</span>}
                </div>
                <p className="line-clamp-2 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">{entry.note || (entry.voiceBase64 ? L('Voice recording') : L('Photo note'))}</p>
                {entry.linkedEntity && (
                  <span className="mt-2 inline-flex max-w-full items-center gap-1 truncate rounded-full bg-green-50 px-2 py-1 text-[10px] font-semibold text-green-800 dark:bg-green-950/40 dark:text-green-300">
                    <Link2 className="h-3 w-3 shrink-0" /> {L('Linked to')}: {entry.linkedEntity.label}
                  </span>
                )}
              </button>
              {!readOnly && (
                <button type="button" onClick={() => editEntry(entry)} className="self-start rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-farm-700 dark:hover:bg-slate-800" aria-label={L('Edit diary note')} title={L('Edit')}>
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <DetailModal open={editorOpen} onClose={closeEditor} title={editingExisting ? L('Edit diary note') : L('New diary note')} subtitle={L('Write, add photos, or record a voice note')} size="big">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">{L('Date')}</label>
            <input type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">{L('Message / notes')}</label>
            <textarea rows={5} value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} placeholder={L('Write your observations…')} className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
          </div>

          <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{L('Photos')} <span className="text-slate-400">{draft.photos.length}/10</span></p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy || draft.photos.length >= 10} onClick={() => cameraRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"><Camera className="h-4 w-4" /> {L('Take photo')}</button>
                <button type="button" disabled={busy || draft.photos.length >= 10} onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"><ImagePlus className="h-4 w-4" /> {L('Add pictures')}</button>
              </div>
            </div>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void addFiles(e.target.files)} />
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void addFiles(e.target.files)} />
            {draft.photos.length === 0 ? <p className="text-xs text-slate-400">{L('No photos added yet.')}</p> : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {draft.photos.map((photo) => (
                  <div key={photo.id} className="relative">
                    <button type="button" onClick={() => setFullPhoto(photo)} className="block aspect-square w-full overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800"><img src={photo.data} alt="" className="h-full w-full object-cover" /></button>
                    {!readOnly && <button type="button" onClick={() => removeDraftPhoto(photo.id)} className="absolute right-1 top-1 rounded-full bg-black/70 p-1.5 text-white" aria-label={L('Remove photo')}><X className="h-3 w-3" /></button>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><p className="text-xs font-bold text-slate-700 dark:text-slate-200">{L('Voice note')}</p><p className="text-[11px] text-slate-400">{L('Record a spoken observation')}</p></div>
              {!readOnly && <button type="button" onClick={() => void toggleRecording()} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-white ${recording ? 'bg-red-600' : 'bg-farm-600'}`}>{recording ? <><Square className="h-4 w-4" /> {L('Stop & save')}</> : <><Mic className="h-4 w-4" /> {draft.voiceBase64 ? L('Re-record') : L('Record voice')}</>}</button>}
            </div>
            {draft.voiceBase64 && <div className="mt-3 flex items-center gap-2"><audio controls src={draft.voiceBase64} className="h-9 min-w-0 flex-1" /><button type="button" onClick={() => setDraft((d) => ({ ...d, voiceBase64: undefined }))} className="rounded-lg p-2 text-slate-400 hover:text-red-600" aria-label={L('Delete voice note')}><Trash2 className="h-4 w-4" /></button></div>}
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">{L('Link to a bird, animal or crop')}</label>
            <select value={selectedLink} onChange={(e) => setSelectedLink(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
              <option value="">{L('Not linked')}</option>
              {entityOptions.map((option) => <option key={option.type + ':' + option.id} value={option.type + ':' + option.id}>{option.label} ({L(option.type)})</option>)}
            </select>
          </div>
          <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            {draft.createdAt && !readOnly ? <button type="button" onClick={() => void deleteEntry(draft)} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/20"><Trash2 className="h-4 w-4" /> {L('Delete note')}</button> : <span />}
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={closeEditor} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-200">{L('Cancel')}</button>
              {!readOnly && <button type="button" disabled={busy || recording} onClick={() => void saveEntry()} className="rounded-xl bg-farm-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-farm-700 disabled:opacity-50">{busy ? L('Saving…') : L('Save note')}</button>}
            </div>
          </div>
        </div>
      </DetailModal>

      <DetailModal open={!!viewing} onClose={() => setViewing(null)} title={L('Diary note')} subtitle={viewing?.date || ''} size="big">
        {viewing && <div className="space-y-4">
          <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">{viewing.note || L('No written note.')}</p>
          {viewing.linkedEntity && <p className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800 dark:bg-green-950/40 dark:text-green-300"><Link2 className="h-3.5 w-3.5" /> {L('Linked to')}: {viewing.linkedEntity.label}</p>}
          {viewing.voiceBase64 && <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900"><p className="mb-2 text-xs font-semibold"><Volume2 className="mr-1 inline h-4 w-4" />{L('Voice note')}</p><audio controls src={viewing.voiceBase64} className="w-full" /></div>}
          {viewing.photos?.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{viewing.photos.map((photo) => <button key={photo.id} type="button" onClick={() => { setFullPhoto(photo); setShareTarget(''); }} className="aspect-square overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800"><img src={photo.data} alt={L('Diary photo')} className="h-full w-full object-cover" /></button>)}</div>}
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            {!readOnly && <button type="button" onClick={() => editEntry(viewing)} className="inline-flex items-center gap-2 rounded-xl bg-farm-600 px-4 py-2.5 text-xs font-bold text-white"><Pencil className="h-4 w-4" /> {L('Edit note')}</button>}
            {!readOnly && <button type="button" onClick={() => void deleteEntry(viewing)} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-xs font-bold text-red-600"><Trash2 className="h-4 w-4" /> {L('Delete note')}</button>}
          </div>
        </div>}
      </DetailModal>

      {fullPhoto && (
        <div role="dialog" aria-modal="true" aria-label={L('Full-screen photo')} onClick={(e) => { if (e.target === e.currentTarget) setFullPhoto(null); }} className="fixed inset-0 z-[9999] flex flex-col bg-black/95 p-3 text-white sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-semibold">{L('Diary photo')} · {viewing?.date || fullPhoto.date}</p>
            <button type="button" onClick={() => setFullPhoto(null)} className="rounded-full bg-white/15 p-2.5 hover:bg-white/25" aria-label={L('Close photo')}><X className="h-5 w-5" /></button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center py-3" onClick={(e) => e.stopPropagation()}>
            <img src={fullPhoto.data} alt={L('Diary photo')} className="max-h-full max-w-full object-contain" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/15 pt-3">
            {shareTargets.length > 0 && <select value={shareTarget} onChange={(e) => setShareTarget(e.target.value)} className="max-w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-2.5 text-xs text-white">
              <option value="">{L('Choose customer / buyer / labor / dealer')}</option>
              {shareTargets.map((target) => <option key={target.type + ':' + target.id} value={target.type + ':' + target.id}>{target.label} · {L(target.type)}</option>)}
            </select>}
            <button type="button" onClick={() => void sharePhoto(fullPhoto)} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-slate-900"><Share2 className="h-4 w-4" /> {L('Share')}</button>
            <a href={fullPhoto.data} download={'diary-photo-' + fullPhoto.date + '.jpg'} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-4 py-2.5 text-xs font-bold text-white"><Download className="h-4 w-4" /> {L('Download')}</a>
          </div>
          <p className="pt-2 text-center text-[10px] text-white/60">{L('For local photos, Share opens your device sharing options when supported. WhatsApp sharing uses the selected contact and note text.')}</p>
        </div>
      )}
    </div>
  );
}
