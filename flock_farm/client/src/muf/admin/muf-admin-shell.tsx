// muf-admin-shell — the shared admin popup shell (overlay + card + header +
// tab nav + scrollable body). Used by AdminPanel (dairy), AdminMenu (flock),
// AdminMenu (agri). Each app passes its own sections + body content as
// children — the shell handles all the visual chrome (icon, title, tabs,
// close button, scrolling).
//
// TWIN FILES:
//   dairy_farm/client/src/muf-admin-shell.tsx  (this file)
//   flock_farm/client/src/muf-admin-shell.tsx  (byte-identical twin)
//   agri_farm/frontend/src/muf-admin-shell.tsx (byte-identical twin)
//
// RULE: per RULES.md §8 "Admin popups are reskin-only — do not add or remove
// functions unless explicitly requested." This shell does NOT change any
// admin functionality — it only centralises the shared chrome (overlay,
// header, tabs, scroll container) so the 3 apps look identical.
//
// DESIGN: The header (icon + title + close) stays pinned at the top and the tab
// strip stays pinned under it while the active section scrolls. The dialog
// closes with Esc / the X button / a tap on the dark backdrop, locks the page
// behind it, moves focus inside and gives focus back when it closes.
import React, { useEffect, useId, useRef } from 'react';
import { motion, modalSpring } from '../core/muf-motion';
import ModalPortal from '../core/muf-portal';
import { X } from 'lucide-react';
import { L } from '../../i18n';
import { useBodyScrollLock } from '../core/muf-scroll-lock';

export interface MufAdminSection {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface MufAdminShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  sections: MufAdminSection[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  children: React.ReactNode;
  /** Optional extra buttons before the close button (language toggle, logout, etc.) */
  headerActions?: React.ReactNode;
}

/**
 * The shared admin popup shell. Renders:
 *   1. ModalPortal (body-level root, never clipped)
 *   2. Backdrop overlay (click-to-close, dark blur)
 *   3. Card (max-w-5xl, fixed stable height, rounded-2xl)
 *   4. Header (icon + title + subtitle + close button) — PINNED
 *   5. Body (muf-scroll, overflow-y-auto) — contains:
 *      a. Tab nav (muf-top-nav, horizontal scroll, hidden scrollbar) — scrolls with content
 *      b. Children (the active section's body content)
 *
 * Each app passes `children` = the body content for the active section.
 * All state/handlers/API calls stay in the app's own admin component.
 */
export default function MufAdminShell({
  open, onClose, title, subtitle, icon,
  sections, activeSection, onSectionChange, children, headerActions,
}: MufAdminShellProps) {
  const titleId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Only the top-most popup reacts — a detail popup opened from here closes first.
      const hosts = document.querySelectorAll('.ff-modal-host');
      if (hosts.length && hosts[hosts.length - 1] !== overlayRef.current) return;
      closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => {
      const card = cardRef.current;
      if (card && !card.contains(document.activeElement)) card.focus({ preventScroll: true });
    }, 30);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
      if (opener && document.contains(opener) && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
    };
  }, [open]);

  // Keep the active tab visible in the horizontally scrolling tab strip.
  useEffect(() => {
    if (!open) return;
    const el = tabsRef.current?.querySelector('.active') as HTMLElement | null;
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [open, activeSection]);

  if (!open) return null;

  return (
    <ModalPortal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="ff-modal-host muf-popup-stage muf-overlay muf-admin-backdrop modal-overlay fixed inset-0 z-[var(--muf-z-hub)] flex items-center justify-center"
        
        ref={overlayRef}
        onClick={onClose}
        role="presentation"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 2 }}
          transition={modalSpring}
          className="muf-admin-shell muf-admin-shell-card flex flex-col overflow-hidden"
          ref={cardRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(event) => event.stopPropagation()}
        >
          {/* Header — PINNED at top (icon + title + close) */}
          <div className="muf-admin-shell-header flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <motion.div
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.06 }}
                className="muf-admin-shell-icon shrink-0"
              >
                {icon}
              </motion.div>
              <div className="min-w-0">
                <h2 id={titleId} className="muf-pup-title muf-admin-shell-title truncate">{title}</h2>
                <p className="muf-admin-shell-subtitle truncate">
                  {subtitle}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
              {headerActions}
              <motion.button whileHover={{ rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={onClose} aria-label={L('Close')} className="muf-admin-shell-close transition">
                <X className="w-5 h-5" />
              </motion.button>
            </div>
          </div>

          {/* Body — the tab strip remains pinned while the active section scrolls. */}
          <motion.div
            key={activeSection}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, delay: 0.08 }}
            className="flex-1 min-h-0 overflow-y-auto muf-scroll muf-admin-body"
          >
            {/* Tabs — horizontal scroll with a sticky surface for easy section switching. */}
            <div className="muf-top-nav muf-admin-tabs-inline muf-admin-tabs-sticky select-none px-3 sm:px-4">
              <div className="muf-top-nav-scroll" ref={tabsRef}>
                {sections.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeSection === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => onSectionChange(tab.id)}
                      className={`muf-nav-link ${active ? 'active' : ''}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section content */}
            <div className="muf-admin-content">
              {children}
            </div>
          </motion.div>
          <div className="muf-admin-footer shrink-0 flex items-center justify-between gap-3">
            <span className="font-bold tracking-wider uppercase">{L('Farm management')}</span>
            <span>{L('Settings & administration')}</span>
          </div>
        </motion.div>
      </motion.div>
    </ModalPortal>
  );
}
