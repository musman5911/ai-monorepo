import { useEffect, useRef, useState } from 'react';
import { saveData, DataConflictError } from '../api';
import { SyncStatus } from '../types';

export function useDebouncedSave<T>(
  key: string,
  value: T,
  isLoaded: boolean,
  delay = 1500
): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const isFirst = useRef(true);

  // When the app reloads fresh data (isLoaded goes false then true again,
  // e.g. after a conflict), skip the save that the fresh state itself triggers
  // and clear any lingering conflict/error status.
  useEffect(() => {
    if (!isLoaded) {
      isFirst.current = true;
      setStatus('idle');
    }
  }, [isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }

    setStatus('saving');
    const timer = setTimeout(async () => {
      try {
        await saveData(key, value);
        setStatus('saved');
        setTimeout(() => setStatus('idle'), 2000);
      } catch (err) {
        // Conflict: another user saved first. The app listens for the
        // 'flockfarm:data-conflict' event and reloads fresh data — surface a
        // distinct status so the user understands what happened.
        setStatus(err instanceof DataConflictError ? 'conflict' : 'error');
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [key, value, isLoaded, delay]);

  return status;
}

export function mergeSyncStatus(statuses: SyncStatus[]): SyncStatus {
  if (statuses.includes('conflict')) return 'conflict';
  if (statuses.includes('error')) return 'error';
  if (statuses.includes('saving')) return 'saving';
  if (statuses.includes('saved')) return 'saved';
  return 'idle';
}
