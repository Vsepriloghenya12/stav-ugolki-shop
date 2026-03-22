require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const PUBLIC_DIR = path.join(ROOT, 'public');

const JWT_SECRET = process.env.JWT_SECRET || 'please-change-me';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'owner';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'stavugolki2026';

const ORDER_STATUSES = ['new', 'confirmed', 'assembling', 'delivering', 'done', 'cancelled'];
const STATUS_LABELS = {
  new: 'Новый',
  confirmed: 'Подтвержден',
  assembling: 'Собирается',
  delivering: 'В пути',
  done: 'Завершен',
  cancelled: 'Отменен'
};

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/assets', express.static(path.join(PUBLIC_DIR, 'assets')));
app.use(express.static(PUBLIC_DIR));

function readJson(fileName, fallback) {
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_error) {
    return fallback;
  }
}

function writeJson(fileName, payload) {
  const filePath = path.join(DATA_DIR, fileName);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

function getProducts() {
  return readJson('products.json', []);
}

function getOrders() {
  return readJson('orders.json', []);
}

function getSettings() {
  return readJson('settings.json', {});
}

function saveProducts(payload) {
  return writeJson('products.json', payload);
}

function saveOrders(payload) {
  return writeJson('orders.json', payload);
}

function saveSettings(payload) {
  return writeJson('settings.json', payload);
}

function formatCurrency(value, currency = '₽') {
  return `${Number(value || 0).toLocaleString('ru-RU')} ${currency}`;
}

function toBool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['true', '1', 'on', 'yes'].includes(value.toLowerCase());
  }
  if (typeof value === 'number') return value > 0;
  return fallback;
}

function parseNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function parseTags(input, fallback = []) {
  if (Array.isArray(input)) {
    return input.map((tag) => String(tag).trim()).filter(Boolean);
  }
  if (typeof input === 'string') {
    return input
      .split(/,|\n/)
      .map((tag) => tag.trim())
      .filter(Boolean);
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

function sanitizePublicSettings(settings) {
  return {
    storeName: settings.storeName,
    headline: settings.headline,
    subheadline: settings.subheadline,
    announcement: settings.announcement,
    supportTelegram: settings.supportTelegram,
    supportPhone: settings.supportPhone,
    pickupAddress: settings.pickupAddress,
    workingHours: settings.workingHours,
    minOrder: parseNumber(settings.minOrder),
    deliveryPrice: parseNumber(settings.deliveryPrice),
    freeDeliveryFrom: parseNumber(settings.freeDeliveryFrom),
    city: settings.city,
    currency: settings.currency || '₽',
    accent: settings.accent,
    background: settings.background,
    surface: settings.surface,
    textPrimary: settings.textPrimary,
    textMuted: settings.textMuted,
    heroBadges: Array.isArray(settings.heroBadges) ? settings.heroBadges : [],
    highlights: Array.isArray(settings.highlights) ? settings.highlights : []
  };
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.admin = payload;
    return next();
  } catch (_error) {
    return res.status(401).json({ error: 'Сессия истекла, войдите снова' });
  }
}

function sortProducts(products) {
  return [...products].sort((a, b) => {
    if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    if ((a.price || 0) !== (b.price || 0)) return (a.price || 0) - (b.price || 0);
    return String(a.name || '').localeCompare(String(b.name || ''), 'ru');
  });
}

function normalizeProductInput(input, existing = {}) {
  const name = String(input.name || existing.name || '').trim();
  const generatedId = existing.id || String(input.id || `product_${Date.now().toString().slice(-6)}`);
  const normalized = {
    ...existing,
    id: generatedId,
    slug: String(input.slug || existing.slug || slugify(name || generatedId)).trim(),
    deepLink: String(input.deepLink || existing.deepLink || generatedId).trim(),
    name,
    subtitle: String(input.subtitle || existing.subtitle || '').trim(),
    category: String(input.category || existing.category || 'Без категории').trim(),
    brand: String(input.brand || existing.brand || 'Ставь угольки').trim(),
    price: parseNumber(input.price, parseNumber(existing.price, 0)),
    oldPrice: parseNumber(input.oldPrice, parseNumber(existing.oldPrice, 0)),
    description: String(input.description || existing.description || '').trim(),
    image: String(input.image || existing.image || '/assets/products/premium-coconut-72.svg').trim(),
    inStock: toBool(input.inStock, toBool(existing.inStock, true)),
    featured: toBool(input.featured, toBool(existing.featured, false)),
    rating: parseNumber(input.rating, parseNumber(existing.rating, 4.8)),
    stockCount: parseNumber(input.stockCount, parseNumber(existing.stockCount, 0)),
    unit: String(input.unit || existing.unit || 'шт.').trim(),
    badge: String(input.badge || existing.badge || '').trim(),
    pack: String(input.pack || existing.pack || '').trim(),
    heat: String(input.heat || existing.heat || '').trim(),
    tags: parseTags(input.tags, Array.isArray(existing.tags) ? existing.tags : []),
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  return normalized;
}

function productSnapshot(product, quantity) {
  return {
    productId: product.id,
    name: product.name,
    category: product.category,
    price: parseNumber(product.price),
    quantity,
    lineTotal: parseNumber(product.price) * quantity
  };
}

function normalizeOrderInput({ items, customer, source }) {
  const products = getProducts();
  const settings = getSettings();

  const preparedItems = (Array.isArray(items) ? items : [])
    .map((item) => {
      const product = products.find((entry) => entry.id === item.productId || entry.slug === item.productId);
      if (!product || !product.inStock) return null;
      const quantity = Math.max(1, parseNumber(item.quantity, 1));
      return productSnapshot(product, quantity);
    })
    .filter(Boolean);

  const subtotal = preparedItems.reduce((sum, item) => sum + parseNumber(item.lineTotal), 0);
  const deliveryType = String(customer?.deliveryType || 'Доставка');
  const freeDeliveryFrom = parseNumber(settings.freeDeliveryFrom, 0);
  const defaultDelivery = parseNumber(settings.deliveryPrice, 0);
  const deliveryCost = deliveryType === 'Самовывоз' || (freeDeliveryFrom > 0 && subtotal >= freeDeliveryFrom) ? 0 : defaultDelivery;

  return {
    id: `order-${Date.now()}`,
    status: 'new',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customer: {
      name: String(customer?.name || '').trim(),
      phone: String(customer?.phone || '').trim(),
      telegram: String(customer?.telegram || '').trim(),
      address: String(customer?.address || '').trim(),
      comment: String(customer?.comment || '').trim(),
      deliveryType
    },
    items: preparedItems,
    subtotal,
    deliveryCost,
    total: subtotal + deliveryCost,
    source: source || 'telegram-mini-app'
  };
}

function buildAnalytics(products, orders, settings) {
  const activeOrders = orders.filter((order) => order.status !== 'cancelled');
  const totalRevenue = activeOrders.reduce((sum, order) => sum + parseNumber(order.total), 0);
  const averageCheck = activeOrders.length ? Math.round(totalRevenue / activeOrders.length) : 0;
  const newOrders = orders.filter((order) => order.status === 'new').length;
  const doneOrders = orders.filter((order) => order.status === 'done').length;
  const lowStockProducts = products.filter((product) => product.inStock && parseNumber(product.stockCount) <= 8);

  const byProduct = {};
  const byCategory = {};
  const byDay = {};
  const bySource = {};
  const statusCounts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0]));

  activeOrders.forEach((order) => {
    statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
    const sourceKey = order.source || 'web';
    bySource[sourceKey] = (bySource[sourceKey] || 0) + 1;

    const dateKey = new Date(order.createdAt || Date.now()).toISOString().slice(0, 10);
    byDay[dateKey] = (byDay[dateKey] || 0) + parseNumber(order.total);

    (order.items || []).forEach((item) => {
      const productName = item.name || 'Без названия';
      const categoryName = item.category || 'Без категории';

      if (!byProduct[productName]) {
        byProduct[productName] = { name: productName, quantity: 0, revenue: 0 };
      }
      byProduct[productName].quantity += parseNumber(item.quantity);
      byProduct[productName].revenue += parseNumber(item.lineTotal);

      if (!byCategory[categoryName]) {
        byCategory[categoryName] = { name: categoryName, quantity: 0, revenue: 0 };
      }
      byCategory[categoryName].quantity += parseNumber(item.quantity);
      byCategory[categoryName].revenue += parseNumber(item.lineTotal);
    });
  });

  const lastDates = Array.from({ length: 10 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (9 - index));
    return date.toISOString().slice(0, 10);
  });

  const dailyRevenue = lastDates.map((date) => ({
    date,
    label: new Date(date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
    revenue: parseNumber(byDay[date], 0)
  }));

  return {
    metrics: {
      revenue: totalRevenue,
      revenueLabel: formatCurrency(totalRevenue, settings.currency),
      averageCheck,
      averageCheckLabel: formatCurrency(averageCheck, settings.currency),
      orders: activeOrders.length,
      doneOrders,
      newOrders,
      products: products.length,
      featuredProducts: products.filter((item) => item.featured).length,
      lowStock: lowStockProducts.length
    },
    statusMap: STATUS_LABELS,
    statusCounts,
    dailyRevenue,
    topProducts: Object.values(byProduct).sort((a, b) => b.revenue - a.revenue).slice(0, 6),
    categoryRevenue: Object.values(byCategory).sort((a, b) => b.revenue - a.revenue),
    sources: Object.entries(bySource).map(([name, value]) => ({ name, value })),
    recentOrders: [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8),
    lowStockProducts
  };
}

function getCollections(products) {
  const sorted = sortProducts(products).filter((product) => product.inStock);
  return {
    featured: sorted.filter((product) => product.featured).slice(0, 6),
    deals: sorted.filter((product) => parseNumber(product.oldPrice) > parseNumber(product.price)).slice(0, 6),
    starters: sorted.filter((product) => product.category === 'Наборы' || (product.tags || []).includes('старт')).slice(0, 6)
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'stav-ugolki-analog', time: new Date().toISOString() });
});

app.get('/api/settings', (_req, res) => {
  res.json(sanitizePublicSettings(getSettings()));
});

app.get('/api/products', (req, res) => {
  const allProducts = getProducts();
  const query = String(req.query.q || '').trim().toLowerCase();
  const category = String(req.query.category || '').trim().toLowerCase();
  const includeOutOfStock = req.query.all === '1';
  const onlyFeatured = req.query.featured === '1';

  let filtered = sortProducts(allProducts).filter((product) => includeOutOfStock || product.inStock);
  if (query) {
    filtered = filtered.filter((product) => {
      const haystack = [product.name, product.subtitle, product.description, product.category, product.brand, ...(product.tags || [])]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  if (category && category !== 'all') {
    filtered = filtered.filter((product) => product.category.toLowerCase() === category);
  }

  if (onlyFeatured) {
    filtered = filtered.filter((product) => product.featured);
  }

  res.json({
    items: filtered,
    categories: Array.from(new Set(allProducts.map((product) => product.category))).sort((a, b) => a.localeCompare(b, 'ru')),
    count: filtered.length,
    collections: getCollections(allProducts)
  });
});

app.get('/api/products/:id', (req, res) => {
  const needle = String(req.params.id || '').toLowerCase();
  const product = getProducts().find((item) => [item.id, item.slug, item.deepLink].filter(Boolean).map((v) => String(v).toLowerCase()).includes(needle));
  if (!product) {
    return res.status(404).json({ error: 'Товар не найден' });
  }
  return res.json(product);
});

app.post('/api/orders', (req, res) => {
  try {
    const payload = normalizeOrderInput(req.body || {});
    const settings = getSettings();

    if (!payload.items.length) {
      return res.status(400).json({ error: 'Корзина пуста или выбранные товары недоступны' });
    }
    if (!payload.customer.name || !payload.customer.phone) {
      return res.status(400).json({ error: 'Укажите имя и телефон' });
    }
    if (payload.customer.deliveryType !== 'Самовывоз' && payload.total < parseNumber(settings.minOrder, 0)) {
      return res.status(400).json({
        error: `Минимальная сумма для доставки — ${formatCurrency(settings.minOrder, settings.currency)}`
      });
    }

    const orders = getOrders();
    orders.unshift(payload);
    saveOrders(orders);

    return res.status(201).json({
      message: 'Заказ создан',
      order: payload,
      shareText: `Новый заказ ${payload.id} на сумму ${formatCurrency(payload.total, settings.currency)}`
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
  const products = getProducts();
  const orders = getOrders().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const settings = getSettings();
  return res.json({
    products,
    orders,
    settings,
    analytics: buildAnalytics(products, orders, settings),
    statusMap: STATUS_LABELS
  });
});

app.get('/api/admin/products', authRequired, (_req, res) => {
  return res.json(getProducts());
});

app.post('/api/admin/products', authRequired, (req, res) => {
  const products = getProducts();
  const product = normalizeProductInput(req.body || {}, { inStock: true, featured: false, rating: 4.8 });
  if (!product.name) {
    return res.status(400).json({ error: 'Укажите название товара' });
  }
  products.unshift(product);
  saveProducts(products);
  return res.status(201).json(product);
});

app.put('/api/admin/products/:id', authRequired, (req, res) => {
  const products = getProducts();
  const index = products.findIndex((product) => product.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Товар не найден' });
  }
  const updated = normalizeProductInput(req.body || {}, products[index]);
  if (!updated.name) {
    return res.status(400).json({ error: 'Укажите название товара' });
  }
  products[index] = updated;
  saveProducts(products);
  return res.json(updated);
});

app.delete('/api/admin/products/:id', authRequired, (req, res) => {
  const products = getProducts();
  const nextProducts = products.filter((product) => product.id !== req.params.id);
  if (nextProducts.length === products.length) {
    return res.status(404).json({ error: 'Товар не найден' });
  }
  saveProducts(nextProducts);
  return res.json({ ok: true });
});

app.get('/api/admin/orders', authRequired, (_req, res) => {
  const orders = getOrders().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return res.json({ items: orders, statusMap: STATUS_LABELS });
});

app.put('/api/admin/orders/:id', authRequired, (req, res) => {
  const orders = getOrders();
  const index = orders.findIndex((order) => order.id === req.params.id);
  const nextStatus = req.body?.status;

  if (index === -1) {
    return res.status(404).json({ error: 'Заказ не найден' });
  }
  if (!ORDER_STATUSES.includes(nextStatus)) {
    return res.status(400).json({ error: 'Некорректный статус' });
  }

  orders[index].status = nextStatus;
  orders[index].updatedAt = new Date().toISOString();
  saveOrders(orders);
  return res.json(orders[index]);
});

app.get('/api/admin/analytics', authRequired, (_req, res) => {
  const products = getProducts();
  const orders = getOrders();
  const settings = getSettings();
  return res.json(buildAnalytics(products, orders, settings));
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
    freeDeliveryFrom: parseNumber(req.body?.freeDeliveryFrom, current.freeDeliveryFrom),
    heroBadges: parseTags(req.body?.heroBadges, current.heroBadges || []),
    highlights: parseTags(req.body?.highlights, current.highlights || [])
  };
  saveSettings(next);
  return res.json(next);
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Маршрут не найден' });
  }
  return res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Ставь угольки запущен на http://localhost:${PORT}`);
});
