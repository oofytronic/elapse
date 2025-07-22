self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('elapse-cache').then(cache => {
      return cache.addAll([
        '/',
        '/index.html',
        '/public/styles.css',
        '/public/script.js',
        '/favicon.ico',
        '/icons/icon-192x192.png',
        '/icons/icon-512x512.png'
      ]);
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
