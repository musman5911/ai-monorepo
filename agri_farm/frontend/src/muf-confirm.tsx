// muf shared confirm/prompt/toast provider — replaces native window dialogs in all three farm apps.
// API: useConfirm() -> confirm({...}), usePromptInput() -> prompt({...}), notify(msg, tone).
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Info, ShieldAlert, KeyRound, CheckCircle2, XCircle } from 'lucide-react';
import DetailModal from './muf-modal';
import { motion, AnimatePresence } from './muf-motion';

type ConfirmTone = 'default' | 'danger' | 'warning';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}

type PromptFn = (options: PromptOptions) => Promise<string | null>;

interface PromptOptions {
  title: string;
  message?: string;
  label?: string;
  placeholder?: string;
  type?: 'text' | 'password' | 'email';
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface PendingPrompt extends PromptOptions {
  resolve: (value: string | null) => void;
}

const PromptContext = createContext<PromptFn | null>(null);

/** Styled replacement for window.prompt() — same muf dialog in all 3 farm apps. */
export function usePromptInput() {
  const ctx = useContext(PromptContext);
  if (!ctx) throw new Error('usePromptInput must be used within ConfirmProvider');
  return ctx;
}

type NoticeTone = 'success' | 'error' | 'info';
interface NoticeItem {
  message: string;
  tone: NoticeTone;
  title?: string;
  action?: { label: string; fn: () => void };
}

let globalEnqueueNotice: ((n: NoticeItem) => void) | null = null;
const queuedNotices: NoticeItem[] = [];

/** Styled replacement for window.alert() — same muf dialog in all 3 farm apps.
 *  Plain function (no hook) so it works anywhere, including non-component code. */
export function notify(message: unknown, tone: NoticeTone = 'info', title?: string, action?: { label: string; fn: () => void }) {
  const msg = typeof message === 'string' ? message : String(message ?? '');
  if (globalEnqueueNotice) {
    globalEnqueueNotice({ message: msg, tone, title, action });
  } else {
    // Queue until the provider mounts instead of falling back to a native browser alert.
    queuedNotices.push({ message: msg, tone, title, action });
  }
}


interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export default function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<PendingPrompt | null>(null);
  const [promptValue, setPromptValue] = useState('');

  const promptInput = useCallback<PromptFn>((options) => {
    return new Promise((resolve) => {
      setPromptValue(options.initialValue || '');
      setPendingPrompt({ ...options, resolve });
    });
  }, []);

  const closePrompt = useCallback((result: string | null) => {
    setPendingPrompt((current) => {
      if (current) current.resolve(result);
      return null;
    });
  }, []);

  const [notices, setNotices] = useState<NoticeItem[]>([]);
  useEffect(() => {
    globalEnqueueNotice = (n) => setNotices((q) => [...q, n]);
    if (queuedNotices.length) {
      const queued = queuedNotices.splice(0, queuedNotices.length);
      setNotices((current) => [...current, ...queued]);
    }
    return () => { globalEnqueueNotice = null; };
  }, []);
  const currentNotice = notices.length > 0 ? notices[0] : null;
  const dismissNotice = useCallback(() => setNotices((q) => q.slice(1)), []);

  // Auto-dismiss after 4 seconds.
  useEffect(() => {
    if (!currentNotice) return;
    const hasAction = !!currentNotice.action;
    const t = setTimeout(() => setNotices((q) => q.slice(1)), hasAction ? 6000 : 4000);
    return () => clearTimeout(t);
  }, [currentNotice]);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise((resolve) => {
      setPending({
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        tone: 'default',
        ...options,
        resolve,
      });
    });
  }, []);

  const close = useCallback((result: boolean) => {
    setPending((current) => {
      if (current) current.resolve(result);
      return null;
    });
  }, []);

  const toneConfig = useMemo(() => {
    switch (pending?.tone) {
      case 'danger':
        return {
          icon: <ShieldAlert className="w-5 h-5" />,
          iconBg: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
          confirmBtn: 'bg-rose-600 hover:bg-rose-700 text-white',
          panel: 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-5 h-5" />,
          iconBg: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
          confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white',
          panel: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300',
        };
      default:
        return {
          icon: <Info className="w-5 h-5" />,
          iconBg: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
          confirmBtn: 'bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600',
          panel: 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200',
        };
    }
  }, [pending?.tone]);

  return (
    <ConfirmContext.Provider value={confirm}>
      <PromptContext.Provider value={promptInput}>
      {children}
      <DetailModal
        open={!!pending}
        onClose={() => close(false)}
        title={pending?.title || 'Confirm'}
        icon={toneConfig.icon}
        iconBg={toneConfig.iconBg}
        size="small"
        zIndex={1500}
      >
        <div className="space-y-4">
          <div className={`rounded-xl border p-4 text-sm ${toneConfig.panel}`}>
            {pending?.message}
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
            <button
              type="button"
              onClick={() => close(false)}
              className="w-full sm:w-auto px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200"
            >
              {pending?.cancelLabel || 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => close(true)}
              className={`w-full sm:w-auto px-4 py-2 rounded-xl text-sm font-semibold ${toneConfig.confirmBtn}`}
            >
              {pending?.confirmLabel || 'Confirm'}
            </button>
          </div>
        </div>
      </DetailModal>

      {/* Styled input prompt — replaces window.prompt() everywhere */}
      <DetailModal
        open={!!pendingPrompt}
        onClose={() => closePrompt(null)}
        title={pendingPrompt?.title || 'Input required'}
        icon={<KeyRound className="w-5 h-5" />}
        iconBg="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
        size="small"
        zIndex={1500}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            closePrompt(promptValue);
          }}
        >
          {pendingPrompt?.message && (
            <p className="text-sm text-slate-600 dark:text-slate-300">{pendingPrompt.message}</p>
          )}
          <div>
            {pendingPrompt?.label && (
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                {pendingPrompt.label}
              </label>
            )}
            <input
              autoFocus
              type={pendingPrompt?.type || 'text'}
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              placeholder={pendingPrompt?.placeholder || ''}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition"
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
            <button
              type="button"
              onClick={() => closePrompt(null)}
              className="w-full sm:w-auto px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200"
            >
              {pendingPrompt?.cancelLabel || 'Cancel'}
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto px-4 py-2 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              {pendingPrompt?.confirmLabel || 'OK'}
            </button>
          </div>
        </form>
      </DetailModal>

      {/* Floating toast — replaces window.alert() */}
      <AnimatePresence>
        {currentNotice && (
          <motion.div
            key={`${currentNotice.message}-${notices.length}`}
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            onClick={dismissNotice}
            role="status"
            aria-live={currentNotice.tone === 'error' ? 'assertive' : 'polite'}
            aria-atomic="true"
            className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-6 z-[var(--muf-z-toast)] p-4 rounded-xl shadow-2xl border text-xs md:text-sm font-bold flex items-start gap-3 max-w-sm w-auto cursor-pointer ${
              currentNotice.tone === 'error'
                ? 'bg-red-50 dark:bg-red-950/90 border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-200'
                : currentNotice.tone === 'success'
                  ? 'bg-farm-50 dark:bg-farm-950/90 border-farm-200 dark:border-farm-900/60 text-farm-800 dark:text-farm-200'
                  : 'bg-sky-50 dark:bg-sky-950/90 border-sky-200 dark:border-sky-900/60 text-sky-800 dark:text-sky-200'
            }`}
          >
            <span className="shrink-0 mt-0.5">
              {currentNotice.tone === 'error' ? <XCircle className="w-4 h-4" />
                : currentNotice.tone === 'success' ? <CheckCircle2 className="w-4 h-4" />
                : <Info className="w-4 h-4" />}
            </span>
            <span className="min-w-0 break-words flex-1">
              {currentNotice.title && <span className="block font-black mb-0.5">{currentNotice.title}</span>}
              <span className="block font-semibold">{currentNotice.message}</span>
            </span>
            {currentNotice.action && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); currentNotice.action?.fn(); dismissNotice(); }}
                className="shrink-0 px-3 py-1.5 rounded-lg border border-current bg-white/70 dark:bg-black/30 text-[11px] font-black hover:opacity-75 transition"
              >
                {currentNotice.action.label}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </PromptContext.Provider>
    </ConfirmContext.Provider>
  );
}
