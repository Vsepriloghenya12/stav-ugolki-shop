const ASSET_VERSION = '70';
const CACHE = `stav-ugolki-v${ASSET_VERSION}-cache-safe`;
const versioned = path => `${path}?v=${ASSET_VERSION}`;
const APP_SHELL = [
  '/shop/',
  '/apps/shop/index.html',
  versioned('/apps/shop/manifest.webmanifest'),
  versioned('/apps/shared/css/theme.css'),
  versioned('/apps/shared/css/base.css'),
  versioned('/apps/shop/css/shop.css'),
  versioned('/apps/shared/js/api.js'),
  versioned('/apps/shop/js/shop.js'),
  '/apps/shop/js/modules/shop-helpers.js',
  '/apps/shop/js/modules/shop-ui.js',
  versioned('/apps/shared/assets/img/logo-ember.png'),
  versioned('/apps/shared/assets/img/header-logo.png')
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
  return caches.match(request);
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request, { cache: 'no-store' });
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
  const response = await fetch(request, { cache: 'no-store' });
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
