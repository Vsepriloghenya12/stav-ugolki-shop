const CACHE = 'stav-ugolki-v56-brand-transparent';
const APP_SHELL = [
  '/apps/shared/assets/img/logo-ember.png?v=56',
  '/apps/shared/assets/img/header-logo.png?v=56',
  '/apps/shop/secret-theme/assets/secret-logo.png?v=56',
  '/shop/',
  '/apps/shop/index.html',
  '/apps/shop/css/shop.css',
  '/apps/shop/js/shop.js',
  '/apps/shared/css/theme.css',
  '/apps/shared/css/base.css',
  '/apps/shared/js/api.js',
  '/apps/shared/assets/img/logo-ember.png',
  '/apps/shared/assets/img/header-logo.png',
  '/apps/shop/secret-theme/index.js',
  '/apps/shop/secret-theme/theme.css',
  '/apps/shop/secret-theme/assets/secret-logo.png'
];

const NETWORK_FIRST_PATTERNS = [
  /^\/shop\/?$/,
  /^\/apps\/shop\/index\.html$/,
  /^\/apps\/shop\/css\//,
  /^\/apps\/shop\/js\//,
  /^\/apps\/shared\/css\//,
  /^\/apps\/shared\/js\//,
  /\/header-logo\.png$/,
  /\/logo-ember\.png$/,
  /\/secret-logo\.png$/,
  /^\/apps\/shop\/secret-theme\//
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())
  );
});

function isNetworkFirst(pathname) {
  return NETWORK_FIRST_PATTERNS.some(pattern => pattern.test(pathname));
}


async function matchCached(request) {
  return caches.match(request, { ignoreSearch: true });
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const cached = await matchCached(request);
    if (cached) return cached;
    throw new Error('offline');
  }
}

async function cacheFirst(request) {
  const cached = await matchCached(request);
  if (cached) return cached;
  const response = await fetch(request);
  const cache = await caches.open(CACHE);
  if (response && response.ok) {
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/media/')) return;
  if (!url.pathname.startsWith('/shop/') && !url.pathname.startsWith('/apps/')) return;

  event.respondWith(
    (isNetworkFirst(url.pathname) ? networkFirst(event.request) : cacheFirst(event.request)).catch(() => matchCached(event.request))
  );
});
