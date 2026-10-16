// muf shared avatar uploader — compresses in-browser (canvas → small JPEG) and stores base64 on the user
// document. New photo overwrites the old one; "Remove" clears the field. Same in all 3 apps.
import React, { useRef, useState } from 'react';
import { useConfirm } from '../core/muf-confirm';
import { mufL } from '../data/muf-urdu';
import { Camera, Trash2, Loader2 } from 'lucide-react';

/**
 * Avatar uploader — the photo is compressed in the
 * browser (canvas → small JPEG) and stored as a base64 data-URL directly on
 * the user document. Saving a new photo OVERWRITES the old one in place and
 * "Remove" clears the field entirely — so old images never pile up in the DB.
 */

export async function compressToAvatar(file: File, maxSide = 256, quality = 0.82): Promise<string> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the image file'));
    reader.readAsDataURL(file);
  });
  const img: HTMLImageElement = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Not a valid image file'));
    el.src = dataUrl;
  });
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

export default function AvatarUploader({
  avatar,
  fallbackLetter,
  onSave,
  onRemove,
  lang = 'en',
}: {
  avatar: string;
  fallbackLetter: string;
  onSave: (base64: string) => Promise<void>;
  onRemove: () => Promise<void>;
  lang?: 'en' | 'ur' | 'roman';
}) {
  const confirmAction = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const L = (en: string, urOrVars?: string | Record<string, string | number | null>) => mufL(lang, en, urOrVars);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError(L('Please choose an image file.')); return; }
    setBusy(true);
    setError('');
    try {
      const base64 = await compressToAvatar(file);
      if (base64.length > 400000) throw new Error(L('Image is too large even after compression.'));
      await onSave(base64);
    } catch (err) {
      setError(err instanceof Error ? err.message : L('Failed to update avatar'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    setError('');
    try {
      const ok = await confirmAction({
        title: L('Remove Photo'),
        message: L('Remove this profile photo?'),
        confirmLabel: L('Remove'),
        tone: 'danger',
      });
      if (!ok) return;
      await onRemove();
    } catch (err) {
      setError(err instanceof Error ? err.message : L('Failed to remove avatar'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-200 dark:border-slate-700 bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-2xl font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
        {avatar ? (
          <img src={avatar} alt="Profile avatar" className="w-full h-full object-cover" />
        ) : (
          fallbackLetter.toUpperCase()
        )}
      </div>
      <div className="space-y-1.5 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            {avatar ? L('Change photo') : L('Upload photo')}
          </button>
          {avatar && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 disabled:opacity-60 text-rose-600 dark:text-rose-400 px-3 py-1.5 rounded-lg text-xs font-bold transition"
            >
              <Trash2 className="w-3.5 h-3.5" /> {L('Remove')}
            </button>
          )}
        </div>
        {error && <p className="text-[10px] font-bold text-rose-500">{error}</p>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}
