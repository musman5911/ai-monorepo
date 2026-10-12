// muf-diary-media — photos + voice notes for the Diary, saved per date.
// Photos are shrunk on the phone before saving (long side <= 1280px, JPEG,
// quality lowered step by step until the picture is about 90 KB or less), so a
// 4 MB camera photo becomes roughly 2% of its size. Everything is stored in the
// browser's IndexedDB on this device (no server call, no backend change).
//
// TWIN FILES (byte-identical):
//   agri_farm/frontend/src/muf-diary-media.tsx
//   dairy_farm/client/src/muf-diary-media.tsx
//   flock_farm/client/src/muf-diary-media.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Mic, Square, Trash2, Volume2 } from 'lucide-react';
import { L } from './i18n';
import DetailModal from './muf-modal';
import { notify, useConfirm } from './muf-confirm';
import { isVoiceSupported, startVoiceRecording, type VoiceRecorder } from './muf-voice';

type MediaKind = 'photo' | 'voice';
interface MediaItem {
  id: string;
  date: string;
  kind: MediaKind;
  data: string;      // data-URL (compressed JPEG or audio)
  thumb?: string;    // small preview for photos
  bytes: number;     // stored size
  origBytes?: number; // original photo size (to show how much was saved)
  createdAt: string;
}

const DB_NAME = 'muf-diary-media';
const STORE = 'items';
export const DIARY_MAX_PHOTOS_PER_DAY = 10;
export const DIARY_MAX_VOICE_PER_DAY = 5;
const TARGET_PHOTO_BYTES = 90 * 1024;

/* ───────────── tiny IndexedDB helpers ───────────── */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('Storage is not available in this browser')); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Could not open storage'));
  });
}
async function listByDate(date: string): Promise<MediaItem[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).index('date').getAll(date);
    req.onsuccess = () => resolve((req.result as MediaItem[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    req.onerror = () => reject(req.error);
  });
}
async function putItem(item: MediaItem): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Could not save'));
    tx.onabort = () => reject(tx.error || new Error('Storage is full'));
  });
}
async function deleteItem(id: string): Promise<void> {
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

/** Shrinks a photo until it is <= ~90 KB (side and quality are lowered together). */
export async function compressDiaryPhoto(file: File): Promise<{ data: string; thumb: string; bytes: number }> {
  const img = await loadImage(file);
  const steps: [number, number][] = [[1280, 0.72], [1100, 0.62], [960, 0.55], [800, 0.48], [640, 0.42], [480, 0.38]];
  let data = '';
  for (const [side, q] of steps) {
    data = drawJpeg(img, side, q);
    if (dataUrlBytes(data) <= TARGET_PHOTO_BYTES) break;
  }
  return { data, thumb: drawJpeg(img, 220, 0.6), bytes: dataUrlBytes(data) };
}

const fmtBytes = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const newId = () => `dm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

interface Props {
  /** YYYY-MM-DD of the diary day being edited. */
  date: string;
  /** false = view only. */
  canEdit?: boolean;
  /** Show voice notes too (apps that already keep voice notes on the server pass false). */
  allowVoice?: boolean;
}

export default function MufDiaryMedia({ date, canEdit = true, allowVoice = false }: Props) {
  const confirm = useConfirm();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<MediaItem | null>(null);
  const [recorder, setRecorder] = useState<VoiceRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try { setItems(await listByDate(date)); } catch { setItems([]); }
  }, [date]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => () => { recorder?.cancel(); }, [recorder]);

  const photos = items.filter((i) => i.kind === 'photo');
  const voices = items.filter((i) => i.kind === 'voice');

  async function addFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setBusy(true);
    let room = DIARY_MAX_PHOTOS_PER_DAY - photos.length;
    try {
      for (const file of Array.from(files)) {
        if (room <= 0) { notify(L('Only {n} photos can be saved for one day.', { n: DIARY_MAX_PHOTOS_PER_DAY }), 'info'); break; }
        const out = await compressDiaryPhoto(file);
        await putItem({ id: newId(), date, kind: 'photo', data: out.data, thumb: out.thumb, bytes: out.bytes, origBytes: file.size, createdAt: new Date().toISOString() });
        room -= 1;
        notify(L('Photo saved ({from} → {to})', { from: fmtBytes(file.size), to: fmtBytes(out.bytes) }), 'success');
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : L('Could not save the photo.'), 'error');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
      if (camRef.current) camRef.current.value = '';
      void refresh();
    }
  }

  async function toggleRecord() {
    if (recording && recorder) {
      try {
        const data = await recorder.stop();
        await putItem({ id: newId(), date, kind: 'voice', data, bytes: dataUrlBytes(data), createdAt: new Date().toISOString() });
        notify(L('Voice note saved.'), 'success');
      } catch (err) {
        notify(err instanceof Error ? err.message : L('Recording failed'), 'error');
      } finally {
        setRecorder(null);
        setRecording(false);
        void refresh();
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

  async function remove(item: MediaItem) {
    const ok = await confirm({
      title: item.kind === 'photo' ? L('Delete photo') : L('Delete voice note'),
      message: L('This cannot be undone.'),
      confirmLabel: L('Delete'),
      cancelLabel: L('Cancel'),
      tone: 'danger',
    });
    if (!ok) return;
    try { await deleteItem(item.id); } catch { /* ignore */ }
    setViewing(null);
    void refresh();
  }

  return (
    <section className="muf-diary-media" aria-label={L('Photos')}>
      <div className="muf-diary-media-head">
        <h4>{L('Photos')} <span className="muf-diary-count">{photos.length}/{DIARY_MAX_PHOTOS_PER_DAY}</span></h4>
        {canEdit && (
          <div className="muf-diary-media-actions">
            <button type="button" className="muf-btn muf-btn-soft" disabled={busy} onClick={() => camRef.current?.click()}>
              <Camera size={14} /> {L('Take photo')}
            </button>
            <button type="button" className="muf-btn muf-btn-soft" disabled={busy} onClick={() => fileRef.current?.click()}>
              <ImagePlus size={14} /> {L('Add photo')}
            </button>
          </div>
        )}
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void addFiles(e.target.files)} />
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void addFiles(e.target.files)} />

      {photos.length === 0 ? (
        <p className="muf-diary-empty">{L('No photos for this day yet.')}</p>
      ) : (
        <div className="muf-diary-grid">
          {photos.map((p) => (
            <button key={p.id} type="button" className="muf-diary-thumb" onClick={() => setViewing(p)} aria-label={L('Open photo')}>
              <img src={p.thumb || p.data} alt="" loading="lazy" />
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
                    <button type="button" className="muf-icon-plain" onClick={() => void remove(v)} aria-label={L('Delete voice note')}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="muf-diary-hint">{L('Photos are made small and saved on this phone only.')}</p>

      <DetailModal open={!!viewing} onClose={() => setViewing(null)} title={L('Photo')} subtitle={date} size="small">
        {viewing && (
          <div className="muf-diary-viewer">
            <img src={viewing.data} alt={L('Diary photo')} />
            <p className="muf-diary-hint">
              {viewing.origBytes ? L('Saved as {to} (original {from})', { to: fmtBytes(viewing.bytes), from: fmtBytes(viewing.origBytes) }) : fmtBytes(viewing.bytes)}
            </p>
            {canEdit && (
              <button type="button" className="muf-btn muf-btn-danger" onClick={() => void remove(viewing)}>
                <Trash2 size={14} /> {L('Delete photo')}
              </button>
            )}
          </div>
        )}
      </DetailModal>
    </section>
  );
}
