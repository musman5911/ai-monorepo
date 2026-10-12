import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './muf-style.css';
import App from './App';
import ConfirmProvider from './muf-confirm';
import { initMufA11y } from './muf-a11y';

// PWA service worker — same system as the other Malik Usman Farms apps.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    // Never let an old production service worker serve stale UI while using Vite dev.
    if (import.meta.env.DEV) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.filter((key) => key.startsWith('dairyfarm-')).map((key) => caches.delete(key)));
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

initMufA11y();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfirmProvider>
      <App />
    </ConfirmProvider>
  </StrictMode>
);
