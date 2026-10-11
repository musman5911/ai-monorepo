// muf shared detail popup — the reference popup shell for all three farm apps.
// Same structure, sizes and physics everywhere (see muf-motion for the variants).
import React, { useEffect, useId, useRef, useState } from 'react';
import { X, ArrowLeft } from 'lucide-react';
import { AnimatePresence, motion } from './muf-motion';
import ModalPortal from './muf-portal';
import { MUF_Z } from './muf-z';
import { useBodyScrollLock } from './muf-scroll-lock';

interface DetailModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  iconBg?: string;
  children: React.ReactNode;
  size?: 'small' | 'big';
  onBack?: () => void;
  backLabel?: string;
  zIndex?: number;
}

// Track only currently-open modals, in open order. Mount order is not a reliable
// proxy for visual order because many dialogs stay mounted while closed.
const activeModalStack: string[] = [];

export default function DetailModal({
  open, onClose, title, subtitle, icon, iconBg = 'bg-emerald-100 text-emerald-700',
  children, size = 'small', onBack, backLabel, zIndex,
}: DetailModalProps) {
  const modalId = useId();
  const closeRef = useRef(onClose);
  const [stackLevel, setStackLevel] = useState(0);
  closeRef.current = onClose;
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    // Re-register when opening so the latest opened modal becomes the top modal.
    const existing = activeModalStack.indexOf(modalId);
    if (existing >= 0) activeModalStack.splice(existing, 1);
    activeModalStack.push(modalId);
    setStackLevel(activeModalStack.length);
    document.body.dataset.topModal = modalId;

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && document.body.dataset.topModal === modalId) {
        event.preventDefault();
        closeRef.current();
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      const index = activeModalStack.indexOf(modalId);
      if (index >= 0) activeModalStack.splice(index, 1);
      const top = activeModalStack[activeModalStack.length - 1];
      if (top) document.body.dataset.topModal = top;
      else delete document.body.dataset.topModal;
    };
  }, [open, modalId]);

  if (!open) return null;
const widthCls = size === 'small' ? 'w-[calc(100vw-2rem)] sm:w-[min(92vw,28rem)]' : 'w-[calc(100vw-1rem)] sm:w-[min(90vw,42rem,100vh)]';
  const alignCls = 'items-center';
  const computedZ = zIndex ?? (MUF_Z.POPUP + Math.max(0, stackLevel - 1) * MUF_Z.POPUP_STEP);
  const isChild = !!onBack;

  return (
    <ModalPortal>
      <AnimatePresence>
        {open && (
          <div
            className={`ff-modal-host muf-overlay fixed inset-0 flex ${alignCls} justify-center p-3 sm:p-4 pointer-events-none overflow-y-auto muf-scroll`}
            style={{ zIndex: computedZ }}
          >
            {/* Backdrop: when this is a child modal (on top of another modal), darken a little more so layering is obvious */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className={`ff-modal-host absolute inset-0 ${isChild ? 'bg-black/40' : 'bg-black/50'} backdrop-blur-sm pointer-events-auto`}
              onClick={() => { if (document.body.dataset.topModal === modalId) onClose(); }}
            />
            {/* Card-style modal on ALL screen sizes: never full-screen, rounded corners, capped height, vertical+horizontal centering */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 2 }}
              transition={{ type: 'spring', stiffness: 480, damping: 30, mass: 0.6 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${modalId}-title`}
              onKeyDown={(event) => {
                if (event.key !== 'Tab' || document.body.dataset.topModal !== modalId) return;
                const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
                  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                );
                if (!focusable.length) { event.preventDefault(); return; }
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
              }}
              className={`relative pointer-events-auto my-2 sm:my-0 max-h-[88vh] sm:max-h-[86vh] ${widthCls} ${size === 'small' ? 'muf-pup-sm' : 'muf-pup-lg'} bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden ${isChild ? 'ring-2 ring-emerald-400/30' : ''}`}
            >
              <div className="flex items-start sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-gradient-to-br from-slate-50 to-white/95 dark:from-slate-800 dark:to-slate-800/90 backdrop-blur" style={{ padding: 'var(--pup-head-pad)', gap: 'var(--pup-gap)' }}>
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  {onBack && (
                    <button onClick={onBack}
                      className="shrink-0 min-w-11 min-h-11 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      title={backLabel || 'Back'}
                      aria-label="Back">
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  )}
                  {icon && (
                    <motion.div
                      initial={{ scale: 0, rotate: -10 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.06 }}
                      className={`rounded-xl flex items-center justify-center shrink-0 ${iconBg}`} style={{ width: 'var(--pup-icon)', height: 'var(--pup-icon)' }}
                    >
                      {icon}
                    </motion.div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 id={`${modalId}-title`} className="font-display font-bold muf-pup-title text-slate-800 dark:text-slate-100 break-words sm:truncate">{title}</h3>
                    {subtitle && <p className="muf-pup-sub text-slate-500 dark:text-slate-400 break-words sm:truncate">{subtitle}</p>}
                  </div>
                </div>
                <motion.button
                  onClick={onClose}
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ rotate: 90 }}
                  transition={{ duration: 0.15 }}
                  className="min-w-11 min-h-11 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, delay: 0.08 }}
                className="flex-1 overflow-y-auto overflow-x-hidden muf-scroll bg-white dark:bg-slate-900 dark:text-slate-200" style={{ padding: 'var(--pup-body-pad)', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
              >
                {children}
              </motion.div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ModalPortal>
  );
}
