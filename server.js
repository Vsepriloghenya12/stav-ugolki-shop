try { require('dotenv').config(); } catch (_error) {}
const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
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

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/assets', express.static(path.join(PUBLIC_DIR, 'assets')));
app.use(express.static(PUBLIC_DIR));

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJson(fileName, fallback) {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_error) {
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

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (_error) {
    return res.status(401).json({ error: 'Сессия истекла, войдите снова' });
  }
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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'stav-ugolki-mobile', time: new Date().toISOString() });
});

app.get('/api/settings', (_req, res) => {
  res.json(sanitizePublicSettings(getSettings()));
});

app.get('/api/banners', (_req, res) => {
  res.json({ items: getActiveBanners() });
});

app.get('/api/products', (req, res) => {
  const includeOutOfStock = req.query.all === '1';
  const category = escapeText(req.query.category || '');
  const q = escapeText(req.query.q || '');
  const items = getVisibleProducts({ q, category, includeOutOfStock });
  res.json({ items, categories: CATEGORIES, count: items.length });
});

app.get('/api/products/:id', (req, res) => {
  const needle = escapeText(req.params.id).toLowerCase();
  const product = getProducts().find((item) => [item.id, item.slug, item.deepLink].filter(Boolean).map((v) => String(v).toLowerCase()).includes(needle));
  if (!product) return res.status(404).json({ error: 'Товар не найден' });
  return res.json(product);
});

app.post('/api/orders', (req, res) => {
  try {
    const payload = normalizeOrderInput(req.body || {});
    const settings = getSettings();
    if (!payload.items.length) {
      return res.status(400).json({ error: 'Корзина пуста' });
    }
    if (!payload.customer.name || !payload.customer.phone) {
      return res.status(400).json({ error: 'Укажите имя и телефон' });
    }
    if (payload.customer.deliveryType !== 'Самовывоз' && payload.total < parseNumber(settings.minOrder, 0)) {
      return res.status(400).json({
        error: `Минимальная сумма для доставки — ${formatCurrency(settings.minOrder, settings.currency || 'VND')}`
      });
    }
    const orders = getOrders();
    orders.unshift(payload);
    saveOrders(orders);
    return res.status(201).json({
      message: 'Заказ создан',
      order: payload,
      shareText: `Новый заказ ${payload.id} на сумму ${formatCurrency(payload.total, settings.currency || 'VND')}`
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Не удалось создать заказ' });
  }
});

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  const token = jwt.sign({ role: 'admin', username }, JWT_SECRET, { expiresIn: '7d' });
  return res.json({ token, username });
});

app.get('/api/admin/bootstrap', authRequired, (_req, res) => {
  return res.json({
    products: getProducts(),
    orders: [...getOrders()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    banners: getBanners(),
    settings: getSettings(),
    categories: CATEGORIES,
    analytics: buildAnalytics(),
    statusMap: STATUS_LABELS
  });
});

app.get('/api/admin/products', authRequired, (_req, res) => {
  return res.json(getProducts());
});

app.post('/api/admin/products', authRequired, (req, res) => {
  const products = getProducts();
  const product = normalizeProductInput(req.body || {}, {});
  if (!product.name) return res.status(400).json({ error: 'Укажите название товара' });
  products.unshift(product);
  saveProducts(products);
  return res.status(201).json(product);
});

app.put('/api/admin/products/:id', authRequired, (req, res) => {
  const products = getProducts();
  const index = products.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Товар не найден' });
  const next = normalizeProductInput(req.body || {}, products[index]);
  if (!next.name) return res.status(400).json({ error: 'Укажите название товара' });
  products[index] = next;
  saveProducts(products);
  return res.json(next);
});

app.delete('/api/admin/products/:id', authRequired, (req, res) => {
  const products = getProducts();
  const next = products.filter((item) => item.id !== req.params.id);
  if (next.length === products.length) return res.status(404).json({ error: 'Товар не найден' });
  saveProducts(next);
  return res.json({ ok: true });
});

app.get('/api/admin/banners', authRequired, (_req, res) => {
  return res.json(getBanners());
});

app.post('/api/admin/banners', authRequired, (req, res) => {
  const banners = getBanners();
  const banner = normalizeBannerInput(req.body || {}, {});
  if (!banner.image) return res.status(400).json({ error: 'Укажите изображение баннера' });
  banners.unshift(banner);
  saveBanners(banners);
  return res.status(201).json(banner);
});

app.put('/api/admin/banners/:id', authRequired, (req, res) => {
  const banners = getBanners();
  const index = banners.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Баннер не найден' });
  const next = normalizeBannerInput(req.body || {}, banners[index]);
  if (!next.image) return res.status(400).json({ error: 'Укажите изображение баннера' });
  banners[index] = next;
  saveBanners(banners);
  return res.json(next);
});

app.delete('/api/admin/banners/:id', authRequired, (req, res) => {
  const banners = getBanners();
  const next = banners.filter((item) => item.id !== req.params.id);
  if (next.length === banners.length) return res.status(404).json({ error: 'Баннер не найден' });
  saveBanners(next);
  return res.json({ ok: true });
});

app.get('/api/admin/orders', authRequired, (_req, res) => {
  return res.json({ items: getOrders(), statusMap: STATUS_LABELS });
});

app.put('/api/admin/orders/:id', authRequired, (req, res) => {
  const orders = getOrders();
  const index = orders.findIndex((item) => item.id === req.params.id);
  const nextStatus = escapeText(req.body?.status);
  if (index === -1) return res.status(404).json({ error: 'Заказ не найден' });
  if (!ORDER_STATUSES.includes(nextStatus)) return res.status(400).json({ error: 'Некорректный статус' });
  orders[index].status = nextStatus;
  orders[index].updatedAt = new Date().toISOString();
  saveOrders(orders);
  return res.json(orders[index]);
});

app.get('/api/admin/analytics', authRequired, (_req, res) => {
  return res.json(buildAnalytics());
});

app.get('/api/admin/settings', authRequired, (_req, res) => {
  return res.json(getSettings());
});

app.put('/api/admin/settings', authRequired, (req, res) => {
  const current = getSettings();
  const next = {
    ...current,
    ...req.body,
    minOrder: parseNumber(req.body?.minOrder, current.minOrder),
    deliveryPrice: parseNumber(req.body?.deliveryPrice, current.deliveryPrice),
    freeDeliveryFrom: parseNumber(req.body?.freeDeliveryFrom, current.freeDeliveryFrom)
  };
  saveSettings(next);
  return res.json(next);
});

app.get('/admin', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));
app.get('/admin.html', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Маршрут не найден' });
  }
  return res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Ставь угольки запущен на http://localhost:${PORT}`);
});
