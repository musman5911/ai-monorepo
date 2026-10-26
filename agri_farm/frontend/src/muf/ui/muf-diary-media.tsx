// muf-diary-media — photos (+ optional voice notes) for the Diary, saved per date.
//
// PHOTOS are shrunk on the phone before saving (long side <= 1280px, JPEG, quality
// lowered step by step until the picture is about 90 KB; hard limit 160 KB) and are
// then saved through the host app's own save call (`onChange`), so they live with
// the farm records in the database and show on every device:
//   • agri  → /diary-media/:date      • dairy → daily log (`photos`)
//   • flock → MongoDB Image store; `uploadPhoto` returns an /api/images/<id> path.
// VOICE NOTES (`allowVoice`, used by agri which has no server voice notes) are kept
// on this device only (IndexedDB).
//
// TWIN FILES (byte-identical):
//   agri_farm/frontend/src/muf-diary-media.tsx
//   dairy_farm/client/src/muf-diary-media.tsx
//   flock_farm/client/src/muf-diary-media.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Mic, Square, Trash2, Volume2 } from 'lucide-react';
import { L } from '../../i18n';
import DetailModal from '../core/muf-modal';
import { notify, useConfirm } from '../core/muf-confirm';
import { isVoiceSupported, startVoiceRecording, type VoiceRecorder } from '../data/muf-voice';

export interface DiaryPhoto {
  id: string;
  date: string;
  /** data:image/jpeg;base64,… (agri, dairy) or an /api/images/<id> path (flock). */
  data: string;
  bytes: number;
  createdAt: string;
}

export const DIARY_MAX_PHOTOS_PER_DAY = 10;
export const DIARY_MAX_VOICE_PER_DAY = 5;
const TARGET_PHOTO_BYTES = 90 * 1024;
const MAX_PHOTO_BYTES = 160 * 1024; // the servers reject anything bigger

/* ───────────── voice notes: tiny IndexedDB store (device only) ───────────── */
interface VoiceItem { id: string; date: string; data: string; bytes: number; createdAt: string; }
const DB_NAME = 'muf-diary-media';
const STORE = 'items';
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('Storage is not available in this browser')); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('date', 'date', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Could not open storage'));
  });
}
async function listVoice(date: string): Promise<VoiceItem[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).index('date').getAll(date);
    req.onsuccess = () => resolve(((req.result as (VoiceItem & { kind?: string })[]).filter((i) => (i.kind ?? 'voice') === 'voice')).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    req.onerror = () => reject(req.error);
  });
}
async function putVoice(item: VoiceItem): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ ...item, kind: 'voice' });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Could not save'));
    tx.onabort = () => reject(tx.error || new Error('Storage is full'));
  });
}
async function deleteVoice(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ───────────── photo compression ───────────── */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Not a valid image file')); };
    img.src = url;
  });
}
function drawJpeg(img: HTMLImageElement, maxSide: number, quality: number): string {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}
const dataUrlBytes = (u: string) => Math.round((u.length - u.indexOf(',') - 1) * 0.75);

/** Shrinks a photo to about 90 KB (side and quality are lowered together). */
export async function compressDiaryPhoto(file: File): Promise<{ data: string; bytes: number }> {
  const img = await loadImage(file);
  const steps: [number, number][] = [[1280, 0.72], [1100, 0.62], [960, 0.55], [800, 0.48], [640, 0.42], [480, 0.38]];
  let data = '';
  for (const [side, q] of steps) {
    data = drawJpeg(img, side, q);
    if (dataUrlBytes(data) <= TARGET_PHOTO_BYTES) break;
  }
  if (dataUrlBytes(data) > MAX_PHOTO_BYTES) throw new Error(L('This photo is too large even after compression. Try a smaller image.'));
  return { data, bytes: dataUrlBytes(data) };
}

const fmtBytes = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

interface Props {
  /** YYYY-MM-DD of the diary day being edited. */
  date: string;
  /** Photos currently saved for this day (comes from the app's own data). */
  photos: DiaryPhoto[];
  /** Called with the full new list; throw to report a save failure. */
  onChange: (next: DiaryPhoto[]) => void | Promise<void>;
  /** false = view only. */
  canEdit?: boolean;
  /** Optional: upload the file yourself and return its stored path. */
  uploadPhoto?: (file: File) => Promise<string>;
  /** Resolve authenticated photo paths to temporary browser object URLs. */
  resolvePhotoUrl?: (path: string) => Promise<string>;
  /** Also show device-only voice notes (apps without server voice notes pass true). */
  allowVoice?: boolean;
}

export default function MufDiaryMedia({ date, photos, onChange, canEdit = true, uploadPhoto, resolvePhotoUrl, allowVoice = false }: Props) {
  const confirm = useConfirm();
  const [current, setCurrent] = useState<DiaryPhoto[]>(photos);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<DiaryPhoto | null>(null);
  const [voices, setVoices] = useState<VoiceItem[]>([]);
  const [recorder, setRecorder] = useState<VoiceRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  useEffect(() => setCurrent(photos), [photos]);
  useEffect(() => {
    if (!resolvePhotoUrl) return;
    let cancelled = false;
    const created: string[] = [];
    const load = async () => {
      const pairs = await Promise.all(current
        .filter((photo) => photo.data.startsWith('/api/photos/'))
        .map(async (photo) => {
          try {
            const url = await resolvePhotoUrl(photo.data);
            created.push(url);
            return [photo.id, url] as const;
          } catch {
            return [photo.id, ''] as const;
          }
        }));
      if (cancelled) {
        created.forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      setPhotoUrls((previous) => {
        Object.values(previous).forEach((url) => URL.revokeObjectURL(url));
        return Object.fromEntries(pairs.filter(([, url]) => Boolean(url)));
      });
    };
    void load();
    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [current, resolvePhotoUrl]);

  const refreshVoice = useCallback(async () => {
    if (!allowVoice) return;
    try { setVoices(await listVoice(date)); } catch { setVoices([]); }
  }, [date, allowVoice]);
  useEffect(() => { void refreshVoice(); }, [refreshVoice]);
  useEffect(() => () => { recorder?.cancel(); }, [recorder]);

  async function addFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setBusy(true);
    try {
      const next = [...current];
      for (const file of Array.from(files)) {
        if (next.length >= DIARY_MAX_PHOTOS_PER_DAY) { notify(L('Only {n} photos can be saved for one day.', { n: DIARY_MAX_PHOTOS_PER_DAY }), 'info'); break; }
        if (!file.type.startsWith('image/')) continue;
        const out = uploadPhoto ? { data: await uploadPhoto(file), bytes: file.size } : await compressDiaryPhoto(file);
        next.push({ id: newId('diary-photo'), date, data: out.data, bytes: out.bytes, createdAt: new Date().toISOString() });
      }
      await onChange(next);
      setCurrent(next);
      notify(L('Photos added to the diary.'), 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : L('Could not save the photo.'), 'error');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
      if (camRef.current) camRef.current.value = '';
    }
  }

  async function removePhoto(photo: DiaryPhoto) {
    const ok = await confirm({ title: L('Delete photo'), message: L('This cannot be undone.'), confirmLabel: L('Delete'), cancelLabel: L('Cancel'), tone: 'danger' });
    if (!ok) return;
    const next = current.filter((p) => p.id !== photo.id);
    try {
      await onChange(next);
      setCurrent(next);
      setViewing(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : L('Could not delete the photo.'), 'error');
    }
  }

  async function toggleRecord() {
    if (recording && recorder) {
      try {
        const data = await recorder.stop();
        await putVoice({ id: newId('dv'), date, data, bytes: dataUrlBytes(data), createdAt: new Date().toISOString() });
        notify(L('Voice note saved.'), 'success');
      } catch (err) {
        notify(err instanceof Error ? err.message : L('Recording failed'), 'error');
      } finally {
        setRecorder(null);
        setRecording(false);
        void refreshVoice();
      }
      return;
    }
    if (voices.length >= DIARY_MAX_VOICE_PER_DAY) { notify(L('Only {n} voice notes can be saved for one day.', { n: DIARY_MAX_VOICE_PER_DAY }), 'info'); return; }
    if (!isVoiceSupported()) { notify(L('This browser cannot record audio.'), 'error'); return; }
    try {
      const r = await startVoiceRecording(() => setRecording(false));
      setRecorder(r);
      setRecording(true);
    } catch {
      notify(L('Microphone permission is needed to record.'), 'error');
    }
  }

  async function removeVoice(item: VoiceItem) {
    const ok = await confirm({ title: L('Delete voice note'), message: L('This cannot be undone.'), confirmLabel: L('Delete'), cancelLabel: L('Cancel'), tone: 'danger' });
    if (!ok) return;
    try { await deleteVoice(item.id); } catch { /* ignore */ }
    void refreshVoice();
  }

  const full = current.length >= DIARY_MAX_PHOTOS_PER_DAY;

  return (
    <section className="muf-diary-media" aria-label={L('Diary photos')}>
      <div className="muf-diary-media-head">
        <h4>{L('Photos')} <span className="muf-diary-count">{current.length}/{DIARY_MAX_PHOTOS_PER_DAY}</span></h4>
        {canEdit && (
          <div className="muf-diary-media-actions">
            <button type="button" className="muf-btn muf-btn-soft" disabled={busy || full} onClick={() => camRef.current?.click()}>
              <Camera size={14} /> {L('Take photo')}
            </button>
            <button type="button" className="muf-btn muf-btn-soft" disabled={busy || full} onClick={() => fileRef.current?.click()}>
              <ImagePlus size={14} /> {L('Add photo')}
            </button>
          </div>
        )}
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void addFiles(e.target.files)} />
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void addFiles(e.target.files)} />

      {current.length === 0 ? (
        <p className="muf-diary-empty">{L('No photos for this day yet.')}</p>
      ) : (
        <div className="muf-diary-grid">
          {current.map((p) => (
            <button key={p.id} type="button" className="muf-diary-thumb" onClick={() => setViewing(p)} aria-label={L('Open photo')}>
              <img src={photoUrls[p.id] || p.data} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {allowVoice && (
        <div className="muf-diary-voice">
          <div className="muf-diary-media-head">
            <h4>{L('Voice notes')} <span className="muf-diary-count">{voices.length}/{DIARY_MAX_VOICE_PER_DAY}</span></h4>
            {canEdit && (
              <button type="button" className={`muf-btn ${recording ? 'muf-btn-danger' : 'muf-btn-soft'}`} onClick={() => void toggleRecord()}>
                {recording ? <><Square size={14} /> {L('Stop')}</> : <><Mic size={14} /> {L('Record')}</>}
              </button>
            )}
          </div>
          {voices.length === 0 ? (
            <p className="muf-diary-empty">{L('No voice notes for this day yet.')}</p>
          ) : (
            <ul className="muf-diary-voice-list">
              {voices.map((v) => (
                <li key={v.id}>
                  <Volume2 size={14} aria-hidden="true" />
                  <audio controls src={v.data} preload="none" />
                  {canEdit && (
                    <button type="button" className="muf-icon-plain" onClick={() => void removeVoice(v)} aria-label={L('Delete voice note')}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="muf-diary-hint">{L('Voice notes are saved on this phone only.')}</p>
        </div>
      )}

      <p className="muf-diary-hint">{L('Photos are made small and saved with your farm records, so they show on other devices too.')}</p>

      <DetailModal open={!!viewing} onClose={() => setViewing(null)} title={L('Photo')} subtitle={date} size="small">
        {viewing && (
          <div className="muf-diary-viewer">
            <img src={photoUrls[viewing.id] || viewing.data} alt={L('Diary photo')} />
            <p className="muf-diary-hint">{fmtBytes(viewing.bytes)}</p>
            {canEdit && (
              <button type="button" className="muf-btn muf-btn-danger" onClick={() => void removePhoto(viewing)}>
                <Trash2 size={14} /> {L('Delete photo')}
              </button>
            )}
          </div>
        )}
      </DetailModal>
    </section>
  );
}
