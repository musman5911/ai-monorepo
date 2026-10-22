import { useEffect } from 'react';

let lockCount = 0;

export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked || typeof document === 'undefined') return;

    const html = document.documentElement;
    const body = document.body;

    if (lockCount === 0) {
      const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
      body.dataset.ffScrollY = String(scrollY);
      html.style.overflow = 'hidden';
      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      body.style.overflow = 'hidden';
    }

    lockCount += 1;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount > 0) return;

      const scrollY = Number(body.dataset.ffScrollY || '0');
      delete body.dataset.ffScrollY;
      html.style.overflow = '';
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.width = '';
      body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}
