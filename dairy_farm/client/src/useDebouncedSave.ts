import { useEffect, useRef, useState } from 'react';

export type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

/**
 * Debounced autosave hook.
 * Watches `value` — whenever it changes (after the initial load), waits `delay` ms
 * of inactivity, then calls `saveFn(value)`. Skips the very first render so loading
 * data from the server doesn't immediately trigger a save.
 */
export function useDebouncedSave<T>(
  value: T,
  saveFn: (value: T) => Promise<any>,
  delay = 800
): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRun = useRef(true);
  const savingIdRef = useRef(0);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }

    setStatus('unsaved');
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      const thisSaveId = ++savingIdRef.current;
      setStatus('saving');
      try {
        await saveFn(value);
        // Only apply if a newer save hasn't started/finished since this one began
        if (thisSaveId === savingIdRef.current) setStatus('saved');
      } catch (e) {
        if (thisSaveId === savingIdRef.current) setStatus('error');
      }
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return status;
}
