const CACHE_NAME = 'flockfarm-v1';
const API_CACHE_NAME = 'flockfarmapi-v2'; // user + farm-scoped offline API cache
const ASSETS = [
  '/',
  '/index.html',
  '/favicon.png',
  '/flock-farm-logo-round-192.png',
  '/flock-farm-logo-round-512.png',
  '/logo.png',
  '/manifest.webmanifest'
];

const precacheHashedBundles = async (cache) => {
  try {
    const res = await fetch('/index.html', { cache: 'reload' });
    if (!res.ok) return;
    await cache.put('/index.html', res.clone());
    const html = await res.text();
    const hrefs = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)[^"']*)["']/g)].map((m) => m[1]);
    await Promise.all(hrefs.map(async (href) => {
      try {
        const asset = await fetch(href, { cache: 'reload' });
        if (asset.ok) await cache.put(href, asset);
      } catch {
        /* ignore missing hashed files during install */
      }
    }));
  } catch {
    /* first install can still serve ASSETS */
  }
};

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(ASSETS);
      await precacheHashedBundles(cache);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => (key.startsWith('flockfarm-') && key !== CACHE_NAME) || (key.startsWith('flockfarmapi-') && key !== API_CACHE_NAME))
          .map((key) => caches.delete(key))
      )
    ).then(() => clients.claim())
  );
});

async function getApiCacheKey(request) {
  const authorization = request.headers.get('Authorization')
    || request.headers.get('X-Auth-Token')
    || request.headers.get('X-Access-Token')
    || '';
  const farmId = request.headers.get('X-Farm-Id') || '';
  if (!authorization && !farmId) return request;

  // Never put the bearer token itself in a cache URL. Hash the user + farm
  // context so cached records from two farms or two accounts cannot collide.
  if (!self.crypto || !self.crypto.subtle) return null;
  const bytes = new TextEncoder().encode(authorization + '\n' + farmId);
  const digest = await self.crypto.subtle.digest('SHA-256', bytes);
  const scope = Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
  const keyUrl = new URL(request.url);
  keyUrl.searchParams.set('__muf_api_scope', scope);
  return new Request(keyUrl.toString(), { method: 'GET' });
}

self.addEventListener('fetch', (e) => {
  // API GETs: stale-while-revalidate offline cache — when the phone is
  // offline, the app shows the last known data instead of failing.
  // Mutations (POST/PUT/DELETE) always go straight to the network.
  const isApiGet = e.request.method === 'GET'
    && e.request.url.startsWith(self.location.origin)
    && e.request.url.includes('/api/');
  if (isApiGet) {
    e.respondWith(
      caches.open(API_CACHE_NAME).then(async (cache) => {
        const authorization = e.request.headers.get('Authorization')
          || e.request.headers.get('X-Auth-Token')
          || e.request.headers.get('X-Access-Token')
          || '';
        const farmId = e.request.headers.get('X-Farm-Id') || '';
        const isPrivateApiRead = Boolean(authorization || farmId);

        if (isPrivateApiRead) {
          let cacheKey = null;
          try {
            cacheKey = await getApiCacheKey(e.request);
          } catch {
            // If a safe per-user/per-farm key cannot be created, do not serve
            // another request's cached data. Use the network without caching.
            return fetch(e.request).catch(() => new Response(
              JSON.stringify({ error: 'offline' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            ));
          }
          if (!cacheKey) {
            return fetch(e.request).catch(() => new Response(
              JSON.stringify({ error: 'offline' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            ));
          }

          // Authenticated data is network-first. If the network is unavailable,
          // fall back only to this same user's and same farm's cached response.
          try {
            const fresh = await fetch(e.request);
            if (fresh && fresh.ok) cache.put(cacheKey, fresh.clone()).catch(() => {});
            return fresh;
          } catch {
            const cached = await cache.match(cacheKey);
            if (cached) return cached;
            return new Response(JSON.stringify({ error: 'offline' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }

        // Public API reads retain stale-while-revalidate behavior.
        const cached = await cache.match(e.request);
        const network = fetch(e.request).then((response) => {
          if (response && response.ok) cache.put(e.request, response.clone());
          return response;
        }).catch(() => null);
        if (cached) { network.catch(() => {}); return cached; }
        const fresh = await network;
        if (fresh) return fresh;
        return new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  if (e.request.method !== 'GET' || e.request.url.includes('/health') || e.request.url.includes('/check-setup')) return;

  const url = new URL(e.request.url);
  const isHashedAsset = url.pathname.includes('/assets/') || /\.(?:js|css|mjs)$/.test(url.pathname);

  // Navigation and hashed Vite bundles must prefer the network so a new
  // deploy is not stuck behind a cache-first service worker.
  if (e.request.mode === 'navigate' || isHashedAsset) {
    e.respondWith(
      fetch(e.request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
        }
        return response;
      }).catch(() => caches.match(e.request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      const network = fetch(e.request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
        }
        return response;
      }).catch(() => cachedResponse || caches.match('/'));
      return cachedResponse || network;
    })
  );
});
