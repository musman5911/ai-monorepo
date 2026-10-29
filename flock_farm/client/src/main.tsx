import { StrictMode, lazy, Suspense } from 'react';
import {createRoot} from 'react-dom/client';
const App = lazy(() => import('./App'));
const ConfirmProvider = lazy(() => import('./muf/core/muf-confirm'));
const MufShop = lazy(() => import('./muf-shop/MufShop'));
const isMufShopRoute = /^\/shop\/?$/.test(window.location.pathname);
import './index.css';
import './muf-style.css';
import { initMufA11y } from './muf/core/muf-a11y';

// PWA service worker — same system as the other Malik Usman Farms apps.
if ('serviceWorker' in navigator && !isMufShopRoute) {
  window.addEventListener('load', async () => {
    // Never let an old production service worker serve stale UI while using Vite dev.
    if (import.meta.env.DEV) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.filter((key) => key.startsWith('flockfarm-')).map((key) => caches.delete(key)));
        console.log('PWA development cache cleared.');
      } catch (err) {
        console.warn('Could not clear development PWA cache:', err);
      }
      return;
    }

    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('PWA Service Worker registered successfully:', reg))
      .catch((err) => console.warn('PWA Service Worker registration failed:', err));
  });
}

if (!isMufShopRoute) initMufA11y();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isMufShopRoute ? (
      <Suspense fallback={<div role="status">Loading MU Farms shop…</div>}>
        <MufShop currentFarm="flock" />
      </Suspense>
    ) : (
      <Suspense fallback={<div role="status">Loading farm app…</div>}>
        <ConfirmProvider><App /></ConfirmProvider>
      </Suspense>
    )}
  </StrictMode>
);
