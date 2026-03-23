const CACHE = 'stav-ugolki-v15';
const ASSETS = [
  '/shop/',
  '/apps/shop/index.html',
  '/apps/shop/css/shop.css',
  '/apps/shop/js/shop.js',
  '/apps/shared/css/theme.css',
  '/apps/shared/css/base.css',
  '/apps/shared/js/api.js',
  '/apps/shared/assets/img/logo-ember.png',
  '/apps/shared/assets/img/header-logo.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const clone = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, clone)).catch(() => {});
      return response;
    }).catch(() => cached))
  );
});
