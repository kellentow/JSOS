const cacheName = 'my-pwa-cache-v1';
const assetsToCache = [
  '/'
];

self.addEventListener('install',  (event) => {
  event.waitUntil(
    caches.open(cacheName).then(cache => cache.addAll(assetsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request)/*.then((response) => {
        if (event.request.method === 'GET' && response.status === 200) {
          caches.open(cacheName).then((cache) => cache.put(event.request, response.clone()));
        }
        return response;
      });*/
    }).catch(() => {
      return new Response('Offline', { status: 503 });
    })
  );
});