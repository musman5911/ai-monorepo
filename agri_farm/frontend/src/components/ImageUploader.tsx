import React, { useRef, useState } from 'react';
import { Loader, X, UploadCloud, ImagePlus, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { compressImage, formatBytes } from '../imageUtils';
import { L } from '../i18n';
import PhotoImage from './PhotoImage';

/**
 * Reusable image upload control with:
 *  - a drag & drop zone (click also opens the file picker)
 *  - live animated progress while the image is read + compressed
 *  - a proper preview card with replace / remove overlay actions
 *  - original vs. compressed size (and % saved) once done
 *
 * Props:
 *   label       - button/dropzone text (default 'Upload Photo')
 *   accept      - file accept filter (default 'image/*')
 *   maxDim      - longest edge for compression (default 400)
 *   quality     - JPEG quality 0..1 (default 0.7)
 *   value       - current base64 preview
 *   onDone      - (base64, { originalSize, compressedSize }) => void
 *   onRemove    - () => void
 *   variant     - 'default' | 'avatar' | 'compact'
 */
export default function ImageUploader({
  label = 'Upload Photo',
  accept = 'image/*',
  maxDim = 400,
  quality = 0.7,
  value = '',
  onDone,
  onRemove,
  variant = 'default',
  showPreview = true,
  className = '',
}) {
  const [progress, setProgress] = useState(null); // null = idle, 0..100 = working
  const [stage, setStage] = useState(null);       // 'reading' | 'compressing' | 'done'
  const [sizes, setSizes] = useState(null);       // { original, compressed }
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const busy = progress !== null && progress < 100;

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) {
      setError('That file is not an image. Please choose a PNG or JPEG.');
      return;
    }
    setError(null);
    setProgress(0);
    setStage('reading');
    setSizes({ original: file.size || 0, compressed: null });
    try {
      const res = await compressImage(file, { maxDim, quality, onProgress: setProgress, onStatus: setStage });
      setSizes({ original: res.originalSize, compressed: res.compressedSize });
      setProgress(100);
      setStage('done');
      if (onDone) onDone(res.base64, res);
    } catch (err) {
      setError('Could not process this image. Try a different file.');
      setProgress(null);
      setStage(null);
      setSizes(null);
    }
  };

  const openPicker = () => {
    if (!busy && inputRef.current) inputRef.current.click();
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (busy) return;
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  };

  const savedPct =
    sizes && sizes.original > 0 && sizes.compressed != null
      ? Math.max(0, Math.round((1 - sizes.compressed / sizes.original) * 100))
      : null;

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept={accept}
      className="hidden"
      onChange={(e) => {
        handleFile(e.target.files[0]);
        e.target.value = '';
      }}
    />
  );

  const progressBar = (
    <div className="w-full space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold text-farm-700 dark:text-farm-400 uppercase tracking-wider flex items-center gap-1">
          <Loader size={10} className="animate-spin" />
          {stage === 'compressing' ? 'Optimizing image…' : 'Reading file…'}
        </span>
        <span className="text-[10px] font-black text-farm-700 dark:text-farm-400 tabular-nums">{progress}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-farm-500 to-farm-400 transition-all duration-150 relative overflow-hidden"
          style={{ width: `${Math.max(progress || 0, 4)}%` }}
        >
          <span className="absolute inset-0 animate-pulse bg-white/25" />
        </div>
      </div>
    </div>
  );

  const successLine = sizes && !busy && stage === 'done' && (
    <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 flex-wrap">
      <CheckCircle2 size={11} className="text-farm-600 dark:text-farm-400 shrink-0" />
      <span className="text-farm-700 dark:text-farm-300 font-bold">{L('Optimized:')}</span>
      {formatBytes(sizes.original)} → <span className="text-farm-600 dark:text-farm-400 font-bold">{formatBytes(sizes.compressed)}</span>
      {savedPct != null && savedPct > 0 && (
        <span className="px-1.5 py-px rounded-full bg-farm-100 dark:bg-farm-900/40 text-farm-700 dark:text-farm-300 font-black">−{savedPct}%</span>
      )}
    </p>
  );

  const errorLine = error && (
    <p className="text-[10px] font-bold text-red-500 flex items-center gap-1">
      <AlertTriangle size={11} className="shrink-0" /> {error}
    </p>
  );

  /* ── AVATAR / COMPACT VARIANT: pill button (no dropzone) ── */
  if (variant === 'avatar' || variant === 'compact' || !showPreview) {
    const buttonStyle = variant === 'avatar'
      ? 'bg-farm-600 hover:bg-farm-700 text-white border-transparent shadow-sm'
      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    return (
      <div className={`space-y-1.5 ${className}`}>
        <button
          type="button"
          onClick={openPicker}
          disabled={busy}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-[10px] font-bold rounded-lg cursor-pointer transition-all border active:scale-95 disabled:opacity-60 disabled:pointer-events-none ${buttonStyle}`}
        >
          {busy ? <Loader size={12} className="animate-spin" /> : <ImagePlus size={12} />}
          {busy ? (stage === 'compressing' ? 'Optimizing…' : 'Reading…') : label}
        </button>
        {fileInput}
        {busy && <div className="max-w-[240px]">{progressBar}</div>}
        {successLine}
        {errorLine}
      </div>
    );
  }

  /* ── DEFAULT VARIANT: drag & drop zone OR preview card ── */
  return (
    <div className={`space-y-1.5 ${className}`}>
      {fileInput}

      {value && !busy ? (
        /* Preview card with overlay actions */
        <div className="relative inline-flex group rounded-xl overflow-hidden border-2 border-farm-500/50 dark:border-farm-600/50 shadow-sm">
          <PhotoImage src={value} className="h-24 w-36 object-cover" alt="Uploaded preview" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/45 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <button
              type="button"
              onClick={openPicker}
              className="p-2 rounded-lg bg-white/90 text-slate-700 hover:bg-white cursor-pointer shadow"
              title={L('Replace photo')}
              aria-label={L('Replace image')}
            >
              <RefreshCw size={14} />
            </button>
            {onRemove && (
              <button
                type="button"
                onClick={() => { onRemove(); setSizes(null); setStage(null); setProgress(null); }}
                className="p-2 rounded-lg bg-red-500/95 text-white hover:bg-red-600 cursor-pointer shadow"
                title={L('Remove photo')}
                aria-label={L('Remove image')}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <span className="absolute bottom-1 left-1 px-1.5 py-px rounded bg-black/55 text-white text-[9px] font-bold uppercase tracking-wider pointer-events-none group-hover:opacity-0 transition-opacity">
            {L('Photo attached')}
          </span>
        </div>
      ) : (
        /* Drop zone */
        <div
          role="button"
          tabIndex={0}
          onClick={openPicker}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); } }}
          onDragOver={(e) => { e.preventDefault(); if (!busy) setDragOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
          onDrop={onDrop}
          className={`w-full max-w-xs rounded-xl border-2 border-dashed px-4 py-4 flex flex-col items-center justify-center gap-1.5 text-center transition-all select-none ${
            busy
              ? 'border-farm-400 bg-farm-50/60 dark:bg-farm-900/10 cursor-wait'
              : dragOver
                ? 'border-farm-500 bg-farm-50 dark:bg-farm-900/20 scale-[1.01] cursor-copy'
                : 'border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/30 hover:border-farm-500 hover:bg-farm-50/50 dark:hover:bg-farm-900/10 cursor-pointer'
          }`}
        >
          {busy ? (
            <div className="w-full px-1">{progressBar}</div>
          ) : (
            <>
              <span className={`p-2 rounded-full transition-colors ${dragOver ? 'bg-farm-100 dark:bg-farm-900/40 text-farm-600 dark:text-farm-400' : 'bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                <UploadCloud size={18} />
              </span>
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                {dragOver ? 'Drop the photo here' : label}
              </span>
              <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Click or drag & drop · PNG / JPEG
              </span>
            </>
          )}
        </div>
      )}

      {successLine}
      {errorLine}
    </div>
  );
}
