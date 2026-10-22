import { Cloud, CloudOff, Loader2, Check, RefreshCw } from 'lucide-react';
import { AnimatePresence, motion } from '../muf/core/muf-motion';
import { SyncStatus } from '../types';
import { Lang } from '../types';
import { t } from '../i18n';

interface SyncIndicatorProps {
  status: SyncStatus;
  lang: Lang;
}

export default function SyncIndicator({ status, lang }: SyncIndicatorProps) {
  const config = {
    idle: { icon: Cloud, className: 'text-slate-400', label: '' },
    saving: { icon: Loader2, className: 'text-amber-500 animate-spin', label: t(lang, 'syncSaving') },
    saved: { icon: Check, className: 'text-emerald-500', label: t(lang, 'syncSaved') },
    error: { icon: CloudOff, className: 'text-rose-500', label: t(lang, 'syncError') },
    conflict: { icon: RefreshCw, className: 'text-amber-400 animate-spin', label: t(lang, 'syncConflict') },
  }[status];

  const Icon = config.icon;

  return (
    <AnimatePresence>
      {status !== 'idle' && (
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="fixed bottom-4 right-4 z-[var(--muf-z-toast)] pointer-events-none"
        >
          <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold px-3 py-2 rounded-2xl bg-slate-900/90 text-white shadow-xl shadow-slate-900/20 border border-white/10 backdrop-blur">
            <Icon className={`w-4 h-4 ${config.className}`} />
            <span>{config.label}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
