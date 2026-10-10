// muf-fab — shared floating action button with quick-action menu.
// Renders a fixed "+" button at the bottom-right that expands into a
// vertical list of quick-action buttons when tapped.
//
// TWIN FILES:
//   dairy_farm/client/src/muf-fab.tsx  (this file)
//   flock_farm/client/src/muf-fab.tsx  (byte-identical twin)
//   agri_farm/frontend/src/muf-fab.tsx (byte-identical twin)
import React, { useState } from 'react';
import { motion, AnimatePresence } from './muf-motion';
import { Plus, X } from 'lucide-react';
import ModalPortal from './muf-portal';

export interface MufFabAction {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

interface MufFabProps {
  actions: MufFabAction[];
}

export default function MufFab({ actions }: MufFabProps) {
  const [open, setOpen] = useState(false);
  if (actions.length === 0) return null;

  // Render through a body-level portal so the FAB's `position: fixed` is
  // anchored to the viewport — never trapped by an ancestor that has
  // `transform` (e.g. framer-motion's `motion.main` page transition) or a
  // `relative z-*` stacking context. Without the portal, those ancestors
  // become the containing block for the fixed FAB and it scrolls with the
  // page instead of staying pinned bottom-right.
  return (
    <ModalPortal>
      {/* Backdrop — tap to close */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[var(--muf-z-search)] bg-black/20 backdrop-blur-[1px] md:hidden"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Action list — expands upward from the FAB */}
      <div className="fixed bottom-5 right-5 z-[var(--muf-z-confirm)] flex flex-col items-end gap-2.5 pointer-events-none">
        <AnimatePresence>
          {open && actions.map((action, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              transition={{ duration: 0.15, delay: i * 0.03 }}
              onClick={() => { action.onClick(); setOpen(false); }}
              className="flex items-center gap-2.5 pl-3 pr-4 py-2.5 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 hover:shadow-xl transition-shadow pointer-events-auto group"
            >
              <span className="w-8 h-8 rounded-full bg-farm-100 dark:bg-farm-900/30 text-farm-600 dark:text-farm-400 flex items-center justify-center shrink-0">
                {action.icon}
              </span>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">{action.label}</span>
            </motion.button>
          ))}
        </AnimatePresence>

        {/* The FAB itself */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setOpen(o => !o)}
          className="w-14 h-14 rounded-full bg-gradient-to-br from-farm-500 to-farm-700 text-white shadow-xl flex items-center justify-center pointer-events-auto border-2 border-white/20"
          aria-label={open ? 'Close quick actions' : 'Open quick actions'}
        >
          <motion.div
            animate={{ rotate: open ? 45 : 0 }}
            transition={{ duration: 0.2 }}
          >
            {open ? <X size={26} /> : <Plus size={26} />}
          </motion.div>
        </motion.button>
      </div>
    </ModalPortal>
  );
}
