import { mufL, mufUr } from './muf-urdu';
// muf shared helper — offline visibility (banner state + wording).
// TWIN FILE: dairy_farm/client/src/muf-offline.ts and flock_farm/client/src/muf-offline.ts
// must stay IDENTICAL (agri_farm/frontend/src/muf-offline.js is the JS twin).
// Run `node check-muf-sync.js` from the repo root after editing.

export interface OfflineState {
  offline: boolean;
  pending: number;
}

/**
 * Watches connectivity + a pending-entries counter (each app reads its own
 * offline queue). Calls back on every change; returns an unsubscribe fn.
 */
export function watchOffline(
  getPendingCount: () => number,
  onChange: (state: OfflineState) => void,
): () => void {
  let last = '';
  const emit = () => {
    const state = { offline: typeof navigator !== 'undefined' && !navigator.onLine, pending: getPendingCount() };
    const key = `${state.offline}:${state.pending}`;
    if (key !== last) { last = key; onChange(state); }
  };
  emit();
  const timer = setInterval(emit, 3000);
  window.addEventListener('online', emit);
  window.addEventListener('offline', emit);
  return () => {
    clearInterval(timer);
    window.removeEventListener('online', emit);
    window.removeEventListener('offline', emit);
  };
}

/** Banner wording — identical in all three apps. */
export function offlineBannerText(lang: string, state: OfflineState): string {
  const { offline, pending } = state;
  const entries = pending === 1 ? 'entry' : 'entries';
  if (offline) {
    return mufL(lang, '📴 Offline — {pending} {entries} saved on this phone, will send automatically', { pending, entries });
  }
  return mufL(lang, '🔄 Sending {pending} saved {entries}…', { pending, entries });
}

export const OFFLINE_SYNCED_TEXT = { en: '✅ All entries synced', ur: mufUr('✅ All entries synced') };
