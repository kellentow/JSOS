const cacheName = 'cache-v1';
const assetsToCache = [
  '/',
  '/static/os.js',
  '/static/os-classes.js',
];

self.addEventListener('install',  (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(assetsToCache)));
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {console.error('Fetch failed for', event.request.url)});
    }),
  );
});