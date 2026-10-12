/* ─────────────────────────────────────────────────────────────
 * muf-applike — shared "feels like an app" touches (muf twin).
 *   • hideMufSplash()        — fades out the #muf-splash boot screen
 *   • initMufPullToRefresh() — pull down at the top to reload (touch)
 *   • <MufCountUpText/>      — KPI numbers count up on first render
 *   • <MufWhatsNew/>         — one-time "what's new" popup per version
 * Identical in dairy_farm & flock_farm (TSX); agri_farm carries the
 * same file with types stripped (muf-applike.jsx).
 * ──────────────────────────────────────────────────────────── */
import { mufL } from './muf-urdu';
import { useEffect, useRef, useState } from 'react';

/* ── splash ─────────────────────────────────────────────────── */
export function hideMufSplash() {
  const el = document.getElementById('muf-splash');
  if (!el) return;
  el.classList.add('muf-splash-hide');
  window.setTimeout(() => { try { el.remove(); } catch { /* gone */ } }, 500);
}

/* ── pull-to-refresh (touch devices, page scrolled to top) ──── */
export function initMufPullToRefresh(): () => void {
  if (typeof window === 'undefined' || !('ontouchstart' in window)) return () => {};
  let startY = 0;
  let lastDy = 0;
  let pulling = false;
  let bar: HTMLDivElement | null = null;

  const ensureBar = () => {
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'muf-ptr';
      bar.textContent = '↻';
      document.body.appendChild(bar);
    }
    return bar;
  };

  const reset = () => {
    if (bar) {
      bar.style.opacity = '0';
      bar.style.transform = 'translateX(-50%) translateY(0) rotate(0deg)';
      bar.classList.remove('muf-ptr-ready');
    }
  };

  // Check if the touch target (or any ancestor) is scrolled down.
  // If so, pull-to-refresh must NOT fire — the user is reading content.
  const isScrolledDown = (target: EventTarget | null): boolean => {
    let el = target as HTMLElement | null;
    while (el && el !== document.body) {
      if (el.scrollTop > 0) return true;
      el = el.parentElement;
    }
    return window.scrollY > 0;
  };

  const onStart = (e: TouchEvent) => {
    // Never reload while a popup is open or the finger starts on a form field —
    // that would throw away whatever the person is typing.
    const el = e.target as HTMLElement | null;
    if (document.body.dataset.ffScrollY !== undefined) return;
    if (el && typeof el.closest === 'function' && el.closest('[role="dialog"], input, textarea, select')) return;
    if (isScrolledDown(e.target)) return;
    startY = e.touches[0].clientY;
    lastDy = 0;
    pulling = true;
  };
  const onMove = (e: TouchEvent) => {
    if (!pulling) return;
    const dy = e.touches[0].clientY - startY;
    lastDy = dy;
    if (dy > 24 && !isScrolledDown(e.target)) {
      const b = ensureBar();
      b.style.opacity = String(Math.min(dy / 130, 1));
      b.style.transform = `translateX(-50%) translateY(${Math.min(dy / 2.2, 66)}px) rotate(${Math.round(dy * 1.7)}deg)`;
      b.classList.toggle('muf-ptr-ready', dy > 130);
    }
  };
  const onEnd = () => {
    if (!pulling) return;
    pulling = false;
    if (lastDy > 130) {
      const b = ensureBar();
      b.classList.add('muf-ptr-spin');
      window.setTimeout(() => window.location.reload(), 320);
    } else {
      reset();
    }
  };

  window.addEventListener('touchstart', onStart, { passive: true });
  window.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('touchend', onEnd, { passive: true });
  return () => {
    window.removeEventListener('touchstart', onStart);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend', onEnd);
    if (bar) { try { bar.remove(); } catch { /* gone */ } }
  };
}

/* ── KPI count-up ───────────────────────────────────────────── */
/**
 * Renders `text` but animates the FIRST number in it from 0 → value
 * (keeps prefixes like "Rs ", suffixes like " L", commas & decimals).
 * Falls back to plain text when no number is found.
 */
export function MufCountUpText({ text, duration = 750 }: { text: string; duration?: number }) {
  const [shown, setShown] = useState(text);
  const doneRef = useRef<string | null>(null);

  useEffect(() => {
    if (doneRef.current === text) { setShown(text); return; }
    // Respect "reduce motion": show the final number straight away.
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(text); doneRef.current = text; return;
    }
    const m = String(text).match(/-?[\d,]+(?:\.\d+)?/);
    if (!m || m[0].replace(/[,\-]/g, '') === '') { setShown(text); doneRef.current = text; return; }
    const raw = m[0];
    const target = parseFloat(raw.replace(/,/g, ''));
    if (!isFinite(target) || Math.abs(target) < 1) { setShown(text); doneRef.current = text; return; }
    const decimals = raw.includes('.') ? (raw.split('.')[1] || '').length : 0;
    const grouped = raw.includes(',');
    const before = String(text).slice(0, m.index);
    const after = String(text).slice((m.index || 0) + raw.length);
    const t0 = performance.now();
    let rafId = 0;
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const v = target * eased;
      const numStr = grouped
        ? v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : v.toFixed(decimals);
      setShown(`${before}${numStr}${after}`);
      if (p < 1) rafId = requestAnimationFrame(tick);
      else { setShown(text); doneRef.current = text; }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [text, duration]);

  return <>{shown}</>;
}

/* ── what's new popup ───────────────────────────────────────── */
interface MufWhatsNewProps {
  /** per-app storage key, e.g. 'dm_whats_new_seen' */
  storageKey: string;
  /** bump this string on each deploy that ships user-visible changes */
  version: string;
  lang?: string;
  /** note strings (English; Urdu from MUF_URDU) */
  notes: string[];
}

export function MufWhatsNew({ storageKey, version, lang = 'en', notes }: MufWhatsNewProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(storageKey);
      if (seen !== version && notes.length > 0) {
        // small delay so the app paints first
        const id = window.setTimeout(() => setOpen(true), 900);
        return () => window.clearTimeout(id);
      }
    } catch { /* blocked */ }
  }, [storageKey, version, notes.length]);

  const close = () => {
    try { localStorage.setItem(storageKey, version); } catch { /* blocked */ }
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  const ur = lang === 'ur';
  const L = (en: string) => mufL(lang, en);

  return (
    <div className="muf-whatsnew-backdrop fixed inset-0 z-[var(--muf-z-whatsnew)] flex items-end sm:items-center justify-center p-3 sm:p-4" onClick={close}>
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-5 muf-whatsnew-card"
        dir={ur ? 'rtl' : 'ltr'}
        role="dialog"
        aria-modal="true"
        aria-label={L("What's new")}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-lg font-black text-slate-800 dark:text-slate-100">
          🎉 {L("What's new")}
        </p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-farm-600 dark:text-farm-400 mb-3">{version}</p>
        <ul className="space-y-2 mb-4">
          {notes.map((n, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
              <span className="text-farm-600 dark:text-farm-400 mt-0.5">✓</span>
              <span>{L(n)}</span>
            </li>
          ))}
        </ul>
        <button
          onClick={close}
          className="w-full py-2.5 rounded-xl bg-farm-600 hover:bg-farm-700 text-white text-sm font-bold transition cursor-pointer"
        >{L('Got it')}</button>
      </div>
    </div>
  );
}
