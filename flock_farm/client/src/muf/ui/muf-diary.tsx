import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Plus, Pencil, Trash2, CalendarDays, Camera, ImagePlus, Mic, Square, Download, Share2, X, Link2, Volume2 } from 'lucide-react';
import { L } from '../../i18n';
import { mufToday } from '../data/muf-date';
import DetailModal from '../core/muf-modal';
import ModalPortal from '../core/muf-portal';
import { notify, useConfirm } from '../core/muf-confirm';
import { compressDiaryPhoto, type DiaryPhoto } from './muf-diary-media';
import { isVoiceSupported, startVoiceRecording, type VoiceRecorder } from '../data/muf-voice';

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
  resolvePhotoUrl?: (path: string) => Promise<string>;
  readOnly?: boolean;
}

const makeId = (prefix: string) => prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
const linkKey = (link?: MufDiaryLink | null) => link ? link.type + ':' + link.id : '';

export default function MufDiary({ entries, onSave, onDelete, entityOptions = [], shareTargets = [], uploadPhoto, resolvePhotoUrl, readOnly = false }: Props) {
  const confirm = useConfirm();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingExisting, setEditingExisting] = useState(false);
  const [draft, setDraft] = useState<MufDiaryEntry>(() => ({ id: '', date: mufToday(), note: '', photos: [] }));
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!resolvePhotoUrl) return;
    let cancelled = false;
    const created: string[] = [];
    const paths = [...entries.flatMap((entry) => entry.photos || []), ...(draft.photos || [])]
      .map((photo) => photo.data)
      .filter((path, index, all) => path.startsWith('/api/photos/') && all.indexOf(path) === index);
    void Promise.all(paths.map(async (path) => {
      try {
        const url = await resolvePhotoUrl(path);
        created.push(url);
        return [path, url] as const;
      } catch {
        return [path, ''] as const;
      }
    })).then((pairs) => {
      if (cancelled) {
        created.forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      setPhotoUrls((previous) => {
        Object.values(previous).forEach((url) => URL.revokeObjectURL(url));
        return Object.fromEntries(pairs.filter(([, url]) => Boolean(url)));
      });
    });
    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [entries, draft.photos, resolvePhotoUrl]);
  const [selectedLink, setSelectedLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recorder, setRecorder] = useState<VoiceRecorder | null>(null);
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [viewing, setViewing] = useState<MufDiaryEntry | null>(null);
  const [fullPhoto, setFullPhoto] = useState<DiaryPhoto | null>(null);
  const photoCloseRef = useRef<HTMLButtonElement | null>(null);
  const photoOpenerRef = useRef<HTMLElement | null>(null);
  const [shareTarget, setShareTarget] = useState('');

  useEffect(() => () => { recorderRef.current?.cancel(); }, []);

  useEffect(() => {
    if (!fullPhoto) return;
    const opener = photoOpenerRef.current;
    const focusTimer = window.setTimeout(() => photoCloseRef.current?.focus({ preventScroll: true }), 0);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setFullPhoto(null);
    };
    window.addEventListener('keydown', handleEscape, true);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleEscape, true);
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [fullPhoto]);

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
          notify(L('Only 10 photos can be added to one note.'), 'info');
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
        notify(L('Voice note recorded. Press Save to keep it with this note.'), 'success');
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
      notify(L('Note saved.'), 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : L('Could not save the note.'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function deleteEntry(entry: MufDiaryEntry) {
    if (readOnly) return;
    const ok = await confirm({ title: L('Delete note'), message: L('This note and its attachments will be removed.'), confirmLabel: L('Delete'), cancelLabel: L('Cancel'), tone: 'danger' });
    if (!ok) return;
    try {
      await onDelete(entry.id || ('legacy-' + entry.date), entry.originalDate || entry.date);
      setViewing(null);
      setEditorOpen(false);
      notify(L('Note deleted.'), 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : L('Could not delete the note.'), 'error');
    }
  }

  const currentShareTarget = shareTargets.find((t) => t.type + ':' + t.id === shareTarget);
  function openFullPhoto(photo: DiaryPhoto) {
    photoOpenerRef.current = document.activeElement as HTMLElement | null;
    setFullPhoto(photo);
  }

  const shareText = (photo: DiaryPhoto) => {
    const to = currentShareTarget ? L('For') + ' ' + currentShareTarget.label + (currentShareTarget.phone ? ' (' + currentShareTarget.phone + ')' : '') + '\n' : '';
    const body = viewing?.note ? viewing.note + '\n' : '';
    const hostedUrl = photo.data.startsWith('http') ? photo.data : (photo.data.startsWith('/') ? window.location.origin + photo.data : '');
    return to + body + L('Note photo') + ' (' + (viewing?.date || photo.date) + ')' + (hostedUrl ? '\n' + hostedUrl : '');
  };

  async function sharePhoto(photo: DiaryPhoto) {
    try {
      const response = await fetch(photo.data, { credentials: 'include' });
      if (response.ok && typeof navigator.share === 'function') {
        const blob = await response.blob();
        const file = new File([blob], 'note-photo-' + (viewing?.date || photo.date) + '.jpg', { type: blob.type || 'image/jpeg' });
        if (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] })) {
          await navigator.share({ title: L('Note photo'), text: shareText(photo), files: [file] });
          return;
        }
      }
    } catch {
      // Fall through to a direct contact share when file-sharing is unavailable.
    }
    if (currentShareTarget?.phone) {
      const phone = currentShareTarget.phone.replace(/[^0-9]/g, '');
      const text = shareText(photo) + (photo.data.startsWith('data:') ? '\n' + L('Download the photo from this note before attaching it in WhatsApp.') : '');
      window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(text), '_blank', 'noopener,noreferrer');
      return;
    }
    if (typeof navigator.share === 'function') {
      const hostedUrl = photo.data.startsWith('http') ? photo.data : (photo.data.startsWith('/') ? window.location.origin + photo.data : undefined);
      await navigator.share({ title: L('Note photo'), text: shareText(photo), ...(hostedUrl ? { url: hostedUrl } : {}) });
      return;
    }
    notify(L('Choose a contact with a phone number to share through WhatsApp, or download the photo.'), 'info');
  }

  return (
    <div className="muf-notes">
      <div className="muf-notes-header">
        <div>
          <h3 className="muf-notes-title">
            <BookOpen className="w-4 h-4 text-farm-600" /> {L('Notes')}
          </h3>
          <p className="muf-notes-subtitle">{L('Notes, photos and voice recordings saved together')}</p>
        </div>
        {!readOnly && (
          <button type="button" onClick={startNew} className="muf-btn muf-btn-primary muf-notes-add shrink-0">
            <Plus className="h-4 w-4" /> {L('Add note')}
          </button>
        )}
      </div>

      {sortedEntries.length === 0 ? (
        <div className="muf-notes-empty">
          <BookOpen className="muf-notes-empty-icon" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{L('Your notes are empty')}</p>
          <p className="mt-1 text-xs text-slate-400">{L('Press + Add note to save your first entry.')}</p>
        </div>
      ) : (
        <div className="muf-notes-list">
          {sortedEntries.map((entry) => (
            <div key={entry.id} className="muf-note-card">
              <button type="button" onClick={() => setViewing(entry)} className="muf-note-open">
                <div className="muf-note-meta">
                  <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {entry.date}</span>
                  {entry.photos.length > 0 && <span>{entry.photos.length} {L('photos')}</span>}
                  {entry.voiceBase64 && <span className="inline-flex items-center gap-1"><Volume2 className="h-3 w-3" /> {L('Voice')}</span>}
                </div>
                <p className="muf-note-preview">{entry.note || (entry.voiceBase64 ? L('Voice recording') : L('Photo note'))}</p>
                {entry.linkedEntity && (
                  <span className="muf-note-linked">
                    <Link2 className="h-3 w-3 shrink-0" /> {L('Linked to')}: {entry.linkedEntity.label}
                  </span>
                )}
              </button>
              {!readOnly && (
                <button type="button" onClick={() => editEntry(entry)} className="muf-btn-icon muf-note-edit self-start" aria-label={L('Edit note')} title={L('Edit')}>
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <DetailModal open={editorOpen} onClose={closeEditor} title={editingExisting ? L('Edit note') : L('New note')} subtitle={L('Write, add photos, or record a voice note')} size="big">
        <div className="muf-note-editor">
          <div>
            <label className="muf-label">{L('Date')}</label>
            <input type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} className="muf-field" />
          </div>
          <div>
            <label className="muf-label">{L('Message / notes')}</label>
            <textarea rows={5} value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} placeholder={L('Write your observations…')} className="muf-field muf-note-textarea" />
          </div>

          <div className="muf-note-panel">
            <div className="muf-note-panel-head">
              <p className="muf-note-panel-title">{L('Photos')} <span className="muf-note-panel-hint">{draft.photos.length}/10</span></p>
              <div className="muf-note-panel-head">
                <button type="button" disabled={busy || draft.photos.length >= 10} onClick={() => cameraRef.current?.click()} className="muf-btn muf-btn-soft"><Camera className="h-4 w-4" /> {L('Take photo')}</button>
                <button type="button" disabled={busy || draft.photos.length >= 10} onClick={() => fileRef.current?.click()} className="muf-btn muf-btn-soft"><ImagePlus className="h-4 w-4" /> {L('Add pictures')}</button>
              </div>
            </div>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void addFiles(e.target.files)} />
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void addFiles(e.target.files)} />
            {draft.photos.length === 0 ? <p className="text-xs text-slate-400">{L('No photos added yet.')}</p> : (
              <div className="muf-note-photo-grid">
                {draft.photos.map((photo) => (
                  <div key={photo.id} className="relative">
                    <button type="button" onClick={() => openFullPhoto(photo)} className="muf-note-photo"><img src={photoUrls[photo.data] || photo.data} alt="" className="h-full w-full object-cover" /></button>
                    {!readOnly && <button type="button" onClick={() => removeDraftPhoto(photo.id)} className="muf-btn-icon absolute right-1 top-1" aria-label={L('Remove photo')}><X className="h-3 w-3" /></button>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="muf-note-panel">
            <div className="muf-note-panel-head">
              <div><p className="muf-note-panel-title">{L('Voice note')}</p><p className="muf-note-panel-hint">{L('Record a spoken observation')}</p></div>
              {!readOnly && <button type="button" onClick={() => void toggleRecording()} className={`muf-btn ${recording ? 'muf-btn-danger' : 'muf-btn-primary'}`}>{recording ? <><Square className="h-4 w-4" /> {L('Stop & save')}</> : <><Mic className="h-4 w-4" /> {draft.voiceBase64 ? L('Re-record') : L('Record voice')}</>}</button>}
            </div>
            {draft.voiceBase64 && <div className="muf-note-voice"><audio controls src={draft.voiceBase64} /><button type="button" onClick={() => setDraft((d) => ({ ...d, voiceBase64: undefined }))} className="muf-btn-icon" aria-label={L('Delete voice note')}><Trash2 className="h-4 w-4" /></button></div>}
          </div>

          <div>
            <label className="muf-label">{L('Link to a bird, animal or crop')}</label>
            <select value={selectedLink} onChange={(e) => setSelectedLink(e.target.value)} className="muf-field">
              <option value="">{L('Not linked')}</option>
              {entityOptions.map((option) => <option key={option.type + ':' + option.id} value={option.type + ':' + option.id}>{option.label} ({L(option.type)})</option>)}
            </select>
          </div>
          <div className="muf-note-actions">
            {draft.createdAt && !readOnly ? <button type="button" onClick={() => void deleteEntry(draft)} className="muf-btn muf-btn-danger muf-note-delete-action"><Trash2 className="h-4 w-4" /> {L('Delete note')}</button> : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={closeEditor} className="muf-btn muf-btn-soft">{L('Cancel')}</button>
              {!readOnly && <button type="button" disabled={busy || recording} onClick={() => void saveEntry()} className="muf-btn muf-btn-primary">{busy ? L('Saving…') : L('Save note')}</button>}
            </div>
          </div>
        </div>
      </DetailModal>

      <DetailModal open={!!viewing} onClose={() => setViewing(null)} title={L('Note')} subtitle={viewing?.date || ''} size="big">
        {viewing && <div className="muf-note-viewer">
          <p className="muf-note-viewer-text">{viewing.note || L('No written note.')}</p>
          {viewing.linkedEntity && <p className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800 dark:bg-green-950/40 dark:text-green-300"><Link2 className="h-3.5 w-3.5" /> {L('Linked to')}: {viewing.linkedEntity.label}</p>}
          {viewing.voiceBase64 && <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900"><p className="mb-2 text-xs font-semibold"><Volume2 className="mr-1 inline h-4 w-4" />{L('Voice note')}</p><audio controls src={viewing.voiceBase64} className="w-full" /></div>}
          {viewing.photos?.length > 0 && <div className="muf-note-photo-grid">{viewing.photos.map((photo) => <button key={photo.id} type="button" onClick={() => { openFullPhoto(photo); setShareTarget(''); }} className="muf-note-viewer-photo"><img src={photoUrls[photo.data] || photo.data} alt={L('Note photo')} className="h-full w-full object-cover" /></button>)}</div>}
          <div className="muf-note-actions">
            {!readOnly && <button type="button" onClick={() => editEntry(viewing)} className="muf-btn muf-btn-primary"><Pencil className="h-4 w-4" /> {L('Edit note')}</button>}
            {!readOnly && <button type="button" onClick={() => void deleteEntry(viewing)} className="muf-btn muf-btn-danger"><Trash2 className="h-4 w-4" /> {L('Delete note')}</button>}
          </div>
        </div>}
      </DetailModal>

      {fullPhoto && (
        <ModalPortal>
        <div role="dialog" aria-modal="true" aria-label={L('Full-screen photo')} onClick={(e) => { if (e.target === e.currentTarget) setFullPhoto(null); }} onKeyDown={(e) => {
          if (e.key !== 'Tab') return;
          const focusable = e.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
          if (!focusable.length) { e.preventDefault(); return; }
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }} className="muf-photo-viewer flex flex-col">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-semibold">{L('Note photo')} · {viewing?.date || fullPhoto.date}</p>
            <button ref={photoCloseRef} type="button" onClick={() => setFullPhoto(null)} className="rounded-full bg-white/15 p-2.5 hover:bg-white/25" aria-label={L('Close photo')}><X className="h-5 w-5" /></button>
          </div>
          <div className="muf-photo-viewer-image" onClick={(e) => e.stopPropagation()}>
            <img src={photoUrls[fullPhoto.data] || fullPhoto.data} alt={L('Note photo')} />
          </div>
          <div className="muf-photo-viewer-toolbar">
            {shareTargets.length > 0 && <select value={shareTarget} onChange={(e) => setShareTarget(e.target.value)} className="muf-field max-w-full">
              <option value="">{L('Choose customer / buyer / labor / dealer')}</option>
              {shareTargets.map((target) => <option key={target.type + ':' + target.id} value={target.type + ':' + target.id}>{target.label} · {L(target.type)}</option>)}
            </select>}
            <button type="button" onClick={() => void sharePhoto(fullPhoto)} className="muf-btn muf-btn-primary"><Share2 className="h-4 w-4" /> {L('Share')}</button>
            <a href={photoUrls[fullPhoto.data] || fullPhoto.data} download={'note-photo-' + fullPhoto.date + '.jpg'} onClick={(e) => e.stopPropagation()} className="muf-btn muf-btn-soft"><Download className="h-4 w-4" /> {L('Download')}</a>
          </div>
          <p className="pt-2 text-center text-[10px] text-white/60">{L('For local photos, Share opens your device sharing options when supported. WhatsApp sharing uses the selected contact and note text.')}</p>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}
