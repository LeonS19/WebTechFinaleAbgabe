const CACHE_NAME = 'todo-app-v1';

// App-Shell: diese Dateien werden beim Installieren des Service Workers gecacht
const APP_SHELL = [
  './',
  './index.html',
  './js/script.js',
  './js/components/todo-card.js',
  './js/components/chat-window.js',
  './css/style.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './manifest.json',
];

// ─── INSTALL ────────────────────────────────────────────────────────────────
// Wird einmal ausgeführt wenn der Service Worker installiert wird.
// Wir cachen die App-Shell sofort.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] App-Shell wird gecacht');
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

// ─── ACTIVATE ───────────────────────────────────────────────────────────────
// Wird ausgeführt wenn der Service Worker aktiv wird.
// Alte Caches werden hier gelöscht.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Alter Cache wird gelöscht:', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// ─── FETCH ──────────────────────────────────────────────────────────────────
// Wird bei jedem Netzwerk-Request ausgeführt.
// Strategie: Cache First für App-Shell, Network First für API-Calls
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API-Calls (localhost:3000) -> Network First
  // Wenn der Server nicht erreichbar ist, aus dem Cache laden
  if (url.port === '3000') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Erfolgreiche API-Antwort im Cache speichern (nur GET)
          if (event.request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline: gecachte API-Antwort zurückgeben
          console.log('[SW] Offline – lade aus Cache:', event.request.url);
          return caches.match(event.request);
        })
    );
    return;
  }

  // App-Shell (HTML, CSS, JS, Icons) -> Cache First
  // Zuerst aus dem Cache, dann Netzwerk als Fallback
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});
