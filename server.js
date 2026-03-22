const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const PUBLIC_DIR = path.join(ROOT, 'public');
const JWT_SECRET = process.env.JWT_SECRET || 'please-change-me';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'owner';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'stavugolki2026';
const CATEGORIES = ['Уголь', 'Табак', 'Кальяны', 'Прочее'];
const ORDER_STATUSES = ['new', 'confirmed', 'assembling', 'delivering', 'done', 'cancelled'];
const STATUS_LABELS = {
  new: 'Новый',
  confirmed: 'Подтвержден',
  assembling: 'Собирается',
  delivering: 'В пути',
  done: 'Завершен',
  cancelled: 'Отменен'
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(fileName, fallback) {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(fileName, payload) {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, fileName);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

const getProducts = () => readJson('products.json', []);
const getOrders = () => readJson('orders.json', []);
const getSettings = () => readJson('settings.json', {});
const getBanners = () => readJson('banners.json', []);
const saveProducts = (value) => writeJson('products.json', value);
const saveOrders = (value) => writeJson('orders.json', value);
const saveSettings = (value) => writeJson('settings.json', value);
const saveBanners = (value) => writeJson('banners.json', value);

function parseNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toBool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'on', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'off', 'no'].includes(normalized)) return false;
  }
  return fallback;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-zа-я0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeText(value) {
  return String(value || '').trim();
}

function formatCurrency(value, currency = 'VND') {
  return `${Number(value || 0).toLocaleString('ru-RU')} ${currency}`;
}

function sortProducts(items) {
  return [...items].sort((a, b) => {
    if (toBool(a.inStock, true) !== toBool(b.inStock, true)) return a.inStock ? -1 : 1;
    if (toBool(a.featured, false) !== toBool(b.featured, false)) return a.featured ? -1 : 1;
    return String(a.name || '').localeCompare(String(b.name || ''), 'ru');
  });
}

function sortBanners(items) {
  return [...items].sort((a, b) => {
    if (toBool(a.active, true) !== toBool(b.active, true)) return a.active ? -1 : 1;
    return parseNumber(a.sortOrder, 0) - parseNumber(b.sortOrder, 0);
  });
}

function normalizeProductInput(input, existing = {}) {
  const name = escapeText(input.name || existing.name);
  const id = escapeText(existing.id || input.id || `product_${Date.now().toString().slice(-6)}`);
  const category = CATEGORIES.includes(escapeText(input.category || existing.category))
    ? escapeText(input.category || existing.category)
    : (CATEGORIES.includes(existing.category) ? existing.category : 'Прочее');

  return {
    ...existing,
    id,
    slug: escapeText(input.slug || existing.slug || slugify(name || id)),
    deepLink: escapeText(input.deepLink || existing.deepLink || id),
    name,
    category,
    price: parseNumber(input.price, parseNumber(existing.price, 0)),
    description: escapeText(input.description || existing.description),
    image: escapeText(input.image || existing.image || '/assets/products/classic-cube-54.svg'),
    inStock: toBool(input.inStock, toBool(existing.inStock, true)),
    featured: toBool(input.featured, toBool(existing.featured, false)),
    stockCount: parseNumber(input.stockCount, parseNumber(existing.stockCount, 0)),
    unit: escapeText(input.unit || existing.unit || 'шт.'),
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function normalizeBannerInput(input, existing = {}) {
  return {
    ...existing,
    id: escapeText(existing.id || input.id || `banner_${Date.now().toString().slice(-6)}`),
    image: escapeText(input.image || existing.image),
    link: escapeText(input.link || existing.link),
    active: toBool(input.active, toBool(existing.active, true)),
    sortOrder: parseNumber(input.sortOrder, parseNumber(existing.sortOrder, 0)),
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function sanitizePublicSettings(settings) {
  return {
    storeName: settings.storeName || 'Ставь угольки',
    currency: settings.currency || 'VND',
    supportTelegram: settings.supportTelegram || '',
    supportPhone: settings.supportPhone || '',
    pickupAddress: settings.pickupAddress || '',
    minOrder: parseNumber(settings.minOrder, 0),
    deliveryPrice: parseNumber(settings.deliveryPrice, 0),
    freeDeliveryFrom: parseNumber(settings.freeDeliveryFrom, 0),
    accent: settings.accent || '#5a9b87',
    accentWarm: settings.accentWarm || '#ff3b30',
    background: settings.background || '#101214',
    surface: settings.surface || '#171a1c',
    textPrimary: settings.textPrimary || '#f3ead7',
    textMuted: settings.textMuted || '#9ba2a8'
  };
}

function getVisibleProducts({ q = '', category = '', includeOutOfStock = false } = {}) {
  const query = escapeText(q).toLowerCase();
  const normalizedCategory = escapeText(category);

  return sortProducts(getProducts()).filter((product) => {
    const matchesStock = includeOutOfStock || toBool(product.inStock, true);
    const matchesCategory = !normalizedCategory || product.category === normalizedCategory;
    const haystack = [product.name, product.category, product.description, product.slug, product.deepLink].join(' ').toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    return matchesStock && matchesCategory && matchesQuery;
  });
}

function getActiveBanners() {
  return sortBanners(getBanners()).filter((item) => toBool(item.active, true));
}

function buildOrderSnapshot(product, quantity) {
  return {
    productId: product.id,
    name: product.name,
    category: product.category,
    price: parseNumber(product.price, 0),
    quantity,
    lineTotal: parseNumber(product.price, 0) * quantity
  };
}

function normalizeOrderInput(body = {}) {
  const products = getProducts();
  const settings = getSettings();
  const rawItems = Array.isArray(body.items) ? body.items : [];
  const customer = body.customer || {};
  const preparedItems = rawItems
    .map((item) => {
      const product = products.find((entry) => entry.id === item.productId || entry.slug === item.productId || entry.deepLink === item.productId);
      if (!product || !toBool(product.inStock, true)) return null;
      const quantity = Math.max(1, parseNumber(item.quantity, 1));
      return buildOrderSnapshot(product, quantity);
    })
    .filter(Boolean);

  const subtotal = preparedItems.reduce((sum, item) => sum + parseNumber(item.lineTotal, 0), 0);
  const deliveryType = escapeText(customer.deliveryType || 'Самовывоз') || 'Самовывоз';
  const freeDeliveryFrom = parseNumber(settings.freeDeliveryFrom, 0);
  const deliveryPrice = parseNumber(settings.deliveryPrice, 0);
  const deliveryCost = deliveryType === 'Самовывоз' || (freeDeliveryFrom > 0 && subtotal >= freeDeliveryFrom)
    ? 0
    : deliveryPrice;

  return {
    id: `order-${Date.now()}`,
    status: 'new',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customer: {
      name: escapeText(customer.name),
      phone: escapeText(customer.phone),
      telegram: escapeText(customer.telegram),
      address: escapeText(customer.address),
      comment: escapeText(customer.comment),
      deliveryType
    },
    items: preparedItems,
    subtotal,
    deliveryCost,
    total: subtotal + deliveryCost,
    source: escapeText(body.source || 'telegram-mini-app') || 'telegram-mini-app'
  };
}

function buildAnalytics() {
  const products = getProducts();
  const orders = getOrders();
  const settings = getSettings();
  const activeOrders = orders.filter((item) => item.status !== 'cancelled');
  const revenue = activeOrders.reduce((sum, item) => sum + parseNumber(item.total, 0), 0);
  const averageCheck = activeOrders.length ? Math.round(revenue / activeOrders.length) : 0;
  const statusCounts = ORDER_STATUSES.reduce((acc, status) => ({ ...acc, [status]: 0 }), {});
  const byProduct = {};
  const byCategory = {};

  activeOrders.forEach((order) => {
    statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
    (order.items || []).forEach((item) => {
      if (!byProduct[item.productId]) {
        byProduct[item.productId] = { id: item.productId, name: item.name, quantity: 0, revenue: 0 };
      }
      byProduct[item.productId].quantity += parseNumber(item.quantity, 0);
      byProduct[item.productId].revenue += parseNumber(item.lineTotal, 0);

      if (!byCategory[item.category]) {
        byCategory[item.category] = { name: item.category, quantity: 0, revenue: 0 };
      }
      byCategory[item.category].quantity += parseNumber(item.quantity, 0);
      byCategory[item.category].revenue += parseNumber(item.lineTotal, 0);
    });
  });

  return {
    metrics: {
      revenue,
      revenueLabel: formatCurrency(revenue, settings.currency || 'VND'),
      averageCheck,
      averageCheckLabel: formatCurrency(averageCheck, settings.currency || 'VND'),
      orders: activeOrders.length,
      products: products.length,
      banners: getBanners().length,
      favoritesPlaceholder: 0
    },
    topProducts: Object.values(byProduct).sort((a, b) => b.revenue - a.revenue).slice(0, 8),
    categoryRevenue: Object.values(byCategory).sort((a, b) => b.revenue - a.revenue),
    recentOrders: [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10),
    statusCounts,
    statusMap: STATUS_LABELS
  };
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function decodeBase64url(input) {
  const normalized = String(input).replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '==='.slice((normalized.length + 3) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

function signToken(payload) {
  const body = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(body).digest('hex');
  return `${body}.${sig}`;
}

function verifyToken(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) throw new Error('missing');
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(body).digest('hex');
  const ok = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!ok) throw new Error('bad-signature');
  const payload = JSON.parse(decodeBase64url(body));
  if (!payload || payload.exp < Date.now()) throw new Error('expired');
  return payload;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 5 * 1024 * 1024) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      const contentType = String(req.headers['content-type'] || '');
      try {
        if (contentType.includes('application/json')) return resolve(JSON.parse(raw));
        if (contentType.includes('application/x-www-form-urlencoded')) {
          const params = new URLSearchParams(raw);
          return resolve(Object.fromEntries(params.entries()));
        }
        return resolve({ raw });
      } catch {
        reject(new Error('BAD_JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function sendText(res, status, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType, 'Content-Length': Buffer.byteLength(text) });
  res.end(text);
}

function sendFile(res, filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return sendJson(res, 404, { error: 'Файл не найден' });
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400'
  });
  fs.createReadStream(filePath).pipe(res);
}

function getAuth(req) {
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

function notFoundApi(res) {
  return sendJson(res, 404, { error: 'Маршрут не найден' });
}

function matchPath(pathname, prefix) {
  if (!pathname.startsWith(prefix)) return null;
  return decodeURIComponent(pathname.slice(prefix.length));
}

async function handleApi(req, res, url) {
  const pathname = url.pathname;
  const method = req.method || 'GET';

  if (method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, service: 'stav-ugolki-mobile', time: new Date().toISOString() });
  }

  if (method === 'GET' && pathname === '/api/settings') {
    return sendJson(res, 200, sanitizePublicSettings(getSettings()));
  }

  if (method === 'GET' && pathname === '/api/banners') {
    return sendJson(res, 200, { items: getActiveBanners() });
  }

  if (method === 'GET' && pathname === '/api/products') {
    const includeOutOfStock = url.searchParams.get('all') === '1';
    const category = escapeText(url.searchParams.get('category') || '');
    const q = escapeText(url.searchParams.get('q') || '');
    const items = getVisibleProducts({ q, category, includeOutOfStock });
    return sendJson(res, 200, { items, categories: CATEGORIES, count: items.length });
  }

  const productId = matchPath(pathname, '/api/products/');
  if (method === 'GET' && productId !== null) {
    const needle = escapeText(productId).toLowerCase();
    const product = getProducts().find((item) => [item.id, item.slug, item.deepLink].filter(Boolean).map((v) => String(v).toLowerCase()).includes(needle));
    if (!product) return sendJson(res, 404, { error: 'Товар не найден' });
    return sendJson(res, 200, product);
  }

  if (method === 'POST' && pathname === '/api/orders') {
    let body;
    try {
      body = await readBody(req);
    } catch (error) {
      return sendJson(res, error.message === 'PAYLOAD_TOO_LARGE' ? 413 : 400, { error: 'Некорректный запрос' });
    }
    try {
      const payload = normalizeOrderInput(body || {});
      const settings = getSettings();
      if (!payload.items.length) return sendJson(res, 400, { error: 'Корзина пуста' });
      if (!payload.customer.name || !payload.customer.phone) return sendJson(res, 400, { error: 'Укажите имя и телефон' });
      if (payload.customer.deliveryType !== 'Самовывоз' && payload.total < parseNumber(settings.minOrder, 0)) {
        return sendJson(res, 400, { error: `Минимальная сумма для доставки — ${formatCurrency(settings.minOrder, settings.currency || 'VND')}` });
      }
      const orders = getOrders();
      orders.unshift(payload);
      saveOrders(orders);
      return sendJson(res, 201, {
        message: 'Заказ создан',
        order: payload,
        shareText: `Новый заказ ${payload.id} на сумму ${formatCurrency(payload.total, settings.currency || 'VND')}`
      });
    } catch {
      return sendJson(res, 500, { error: 'Не удалось создать заказ' });
    }
  }

  if (method === 'POST' && pathname === '/api/admin/login') {
    let body;
    try {
      body = await readBody(req);
    } catch {
      return sendJson(res, 400, { error: 'Некорректный запрос' });
    }
    const { username, password } = body || {};
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return sendJson(res, 401, { error: 'Неверный логин или пароль' });
    }
    const token = signToken({ role: 'admin', username, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
    return sendJson(res, 200, { token, username });
  }

  if (pathname.startsWith('/api/admin/')) {
    const admin = getAuth(req);
    if (!admin) return sendJson(res, 401, { error: 'Сессия истекла, войдите снова' });

    if (method === 'GET' && pathname === '/api/admin/bootstrap') {
      return sendJson(res, 200, {
        products: getProducts(),
        orders: [...getOrders()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        banners: getBanners(),
        settings: getSettings(),
        categories: CATEGORIES,
        analytics: buildAnalytics(),
        statusMap: STATUS_LABELS
      });
    }

    if (method === 'GET' && pathname === '/api/admin/products') {
      return sendJson(res, 200, getProducts());
    }

    if (method === 'POST' && pathname === '/api/admin/products') {
      let body;
      try { body = await readBody(req); } catch { return sendJson(res, 400, { error: 'Некорректный запрос' }); }
      const products = getProducts();
      const product = normalizeProductInput(body || {}, {});
      if (!product.name) return sendJson(res, 400, { error: 'Укажите название товара' });
      products.unshift(product);
      saveProducts(products);
      return sendJson(res, 201, product);
    }

    const adminProductId = matchPath(pathname, '/api/admin/products/');
    if (adminProductId !== null && method === 'PUT') {
      let body;
      try { body = await readBody(req); } catch { return sendJson(res, 400, { error: 'Некорректный запрос' }); }
      const products = getProducts();
      const index = products.findIndex((item) => item.id === adminProductId);
      if (index === -1) return sendJson(res, 404, { error: 'Товар не найден' });
      const next = normalizeProductInput(body || {}, products[index]);
      if (!next.name) return sendJson(res, 400, { error: 'Укажите название товара' });
      products[index] = next;
      saveProducts(products);
      return sendJson(res, 200, next);
    }

    if (adminProductId !== null && method === 'DELETE') {
      const products = getProducts();
      const next = products.filter((item) => item.id !== adminProductId);
      if (next.length === products.length) return sendJson(res, 404, { error: 'Товар не найден' });
      saveProducts(next);
      return sendJson(res, 200, { ok: true });
    }

    if (method === 'GET' && pathname === '/api/admin/banners') {
      return sendJson(res, 200, getBanners());
    }

    if (method === 'POST' && pathname === '/api/admin/banners') {
      let body;
      try { body = await readBody(req); } catch { return sendJson(res, 400, { error: 'Некорректный запрос' }); }
      const banners = getBanners();
      const banner = normalizeBannerInput(body || {}, {});
      if (!banner.image) return sendJson(res, 400, { error: 'Укажите изображение баннера' });
      banners.unshift(banner);
      saveBanners(banners);
      return sendJson(res, 201, banner);
    }

    const bannerId = matchPath(pathname, '/api/admin/banners/');
    if (bannerId !== null && method === 'PUT') {
      let body;
      try { body = await readBody(req); } catch { return sendJson(res, 400, { error: 'Некорректный запрос' }); }
      const banners = getBanners();
      const index = banners.findIndex((item) => item.id === bannerId);
      if (index === -1) return sendJson(res, 404, { error: 'Баннер не найден' });
      const next = normalizeBannerInput(body || {}, banners[index]);
      if (!next.image) return sendJson(res, 400, { error: 'Укажите изображение баннера' });
      banners[index] = next;
      saveBanners(banners);
      return sendJson(res, 200, next);
    }

    if (bannerId !== null && method === 'DELETE') {
      const banners = getBanners();
      const next = banners.filter((item) => item.id !== bannerId);
      if (next.length === banners.length) return sendJson(res, 404, { error: 'Баннер не найден' });
      saveBanners(next);
      return sendJson(res, 200, { ok: true });
    }

    if (method === 'GET' && pathname === '/api/admin/orders') {
      return sendJson(res, 200, { items: getOrders(), statusMap: STATUS_LABELS });
    }

    const orderId = matchPath(pathname, '/api/admin/orders/');
    if (orderId !== null && method === 'PUT') {
      let body;
      try { body = await readBody(req); } catch { return sendJson(res, 400, { error: 'Некорректный запрос' }); }
      const orders = getOrders();
      const index = orders.findIndex((item) => item.id === orderId);
      const nextStatus = escapeText(body?.status);
      if (index === -1) return sendJson(res, 404, { error: 'Заказ не найден' });
      if (!ORDER_STATUSES.includes(nextStatus)) return sendJson(res, 400, { error: 'Некорректный статус' });
      orders[index].status = nextStatus;
      orders[index].updatedAt = new Date().toISOString();
      saveOrders(orders);
      return sendJson(res, 200, orders[index]);
    }

    if (method === 'GET' && pathname === '/api/admin/analytics') {
      return sendJson(res, 200, buildAnalytics());
    }

    if (method === 'GET' && pathname === '/api/admin/settings') {
      return sendJson(res, 200, getSettings());
    }

    if (method === 'PUT' && pathname === '/api/admin/settings') {
      let body;
      try { body = await readBody(req); } catch { return sendJson(res, 400, { error: 'Некорректный запрос' }); }
      const current = getSettings();
      const next = {
        ...current,
        ...body,
        minOrder: parseNumber(body?.minOrder, current.minOrder),
        deliveryPrice: parseNumber(body?.deliveryPrice, current.deliveryPrice),
        freeDeliveryFrom: parseNumber(body?.freeDeliveryFrom, current.freeDeliveryFrom)
      };
      saveSettings(next);
      return sendJson(res, 200, next);
    }

    return notFoundApi(res);
  }

  return notFoundApi(res);
}

function safeJoin(base, target) {
  const targetPath = path.normalize(path.join(base, target));
  return targetPath.startsWith(base) ? targetPath : null;
}

function handleStatic(req, res, url) {
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === '/admin' || pathname === '/admin.html') {
    return sendFile(res, path.join(PUBLIC_DIR, 'admin.html'));
  }
  if (pathname === '/' || pathname === '/index.html') {
    return sendFile(res, path.join(PUBLIC_DIR, 'index.html'));
  }
  if (pathname.startsWith('/assets/')) {
    const filePath = safeJoin(PUBLIC_DIR, pathname.slice(1));
    if (filePath) return sendFile(res, filePath);
  }

  const directFile = safeJoin(PUBLIC_DIR, pathname.slice(1));
  if (directFile && fs.existsSync(directFile) && fs.statSync(directFile).isFile()) {
    return sendFile(res, directFile);
  }

  return sendFile(res, path.join(PUBLIC_DIR, 'index.html'));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    return handleStatic(req, res, url);
  } catch (error) {
    return sendJson(res, 500, { error: 'Внутренняя ошибка сервера' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Ставь угольки запущен на 0.0.0.0:${PORT}`);
});
