const CACHE_NAME = 'doniel-zik-v1';

// Fichiers à mettre en cache pour le mode hors-ligne
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// ── Installation : mise en cache des assets statiques ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Mise en cache des assets statiques');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ── Activation : suppression des anciens caches ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Suppression ancien cache:', name);
            return caches.delete(name);
          })
      )
    )
  );
  self.clients.claim();
});

// ── Fetch : stratégie Network First avec fallback cache ──
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ne pas intercepter les requêtes Firebase / Cloudinary / APIs externes
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('cloudinary') ||
    url.hostname.includes('anthropic') ||
    request.method !== 'GET'
  ) {
    return;
  }

  // Stratégie : Network First → si réseau KO, réponse du cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Mettre à jour le cache avec la nouvelle réponse
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Réseau indisponible → chercher dans le cache
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // Fallback vers la page d'accueil pour les routes de l'app
          if (request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// ── Notification push (pour plus tard) ──
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  self.registration.showNotification(data.title || 'Doniel Zik', {
    body: data.body || 'Nouveau contenu disponible',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: { url: data.url || '/' },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});
