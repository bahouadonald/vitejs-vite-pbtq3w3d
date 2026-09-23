const CACHE_NAME = 'doniel-zik-v3';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json', '/icons/icon-192x192.png', '/icons/icon-512x512.png'];

// Installation
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

// Activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Fetch — assets statiques en cache-first (rapide), navigation en reseau-d'abord
const ASSET_RE = /\.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|svg|gif|ico)$/;

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.includes('/api/')) return;

  // Cross-origin : seulement les polices Google en cache, le reste au reseau (Firestore, Cloudinary...)
  if (url.origin !== self.location.origin) {
    if (/fonts\.(googleapis|gstatic)\.com$/.test(url.host)) {
      event.respondWith(cacheFirst(event.request));
    }
    return;
  }

  // Assets statiques (JS/CSS/images/polices) -> cache-first = instantane
  if (ASSET_RE.test(url.pathname)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Navigation (HTML) -> reseau-d'abord, cache en secours hors-ligne
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request).then((r) => r || caches.match('/')))
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res && res.status === 200) cache.put(request, res.clone());
  return res;
}

// Background Sync — resilience aux mauvaises connexions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'SYNC_COMPLETE' }));
      })
    );
  }
});

// Periodic Background Sync — donnees fraiches en arriere-plan
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-content') {
    event.waitUntil(
      fetch('/').then((response) => {
        const clone = response.clone();
        return caches.open(CACHE_NAME).then((cache) => cache.put('/', clone));
      }).catch(() => {})
    );
  }
});

// Push Notifications
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Doniel Zik';
  const options = {
    body: data.body || 'Vous avez une nouvelle notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Clic sur notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const url = event.notification.data?.url || '/';
      const client = clients.find((c) => c.url === url);
      if (client) return client.focus();
      return self.clients.openWindow(url);
    })
  );
});
