const CACHE_NAME = 'todo-app-v1';

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key))
      )
    )
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // WebSocket und GraphQL NIEMALS cachen!
  if (url.protocol === 'ws:' || url.protocol === 'wss:' || 
      url.pathname === '/graphql' || url.pathname === '/chat') {
    return;  // ← Wichtig: nicht anfassen!
  }

  // App-Shell → Cache First
  if (APP_SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request)
        .then(cached => cached || fetch(event.request))
    );
    return;
  }

  // Assets → Network First
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});