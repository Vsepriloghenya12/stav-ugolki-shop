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

const ORDER_STATUSES = ['new', 'confirmed', 'delivering', 'done', 'cancelled'];
const STATUS_LABELS = {
  new: 'Новый',
  confirmed: 'Подтвержден',
  delivering: 'В доставке',
  done: 'Завершен',
  cancelled: 'Отменен'
};

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/assets', express.static(path.join(PUBLIC_DIR, 'assets')));
app.use(express.static(PUBLIC_DIR));

function readJson(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    return fileName === 'settings.json' ? {} : [];
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(fileName, payload) {
  const filePath = path.join(DATA_DIR, fileName);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

function getProducts() {
  return readJson('products.json');
}

function getOrders() {
  return readJson('orders.json');
}

function getSettings() {
  return readJson('settings.json');
}

function saveProducts(products) {
  return writeJson('products.json', products);
}

function saveOrders(orders) {
  return writeJson('orders.json', orders);
}

function saveSettings(settings) {
  return writeJson('settings.json', settings);
}

function formatCurrency(value, currency = '₽') {
  return `${Number(value || 0).toLocaleString('ru-RU')} ${currency}`;
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
    minOrder: settings.minOrder,
    deliveryPrice: settings.deliveryPrice,
    currency: settings.currency,
    accent: settings.accent,
    background: settings.background,
    surface: settings.surface,
    textPrimary: settings.textPrimary,
    textMuted: settings.textMuted,
    heroBadges: Array.isArray(settings.heroBadges) ? settings.heroBadges : []
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
  } catch (error) {
    return res.status(401).json({ error: 'Сессия истекла, войдите снова' });
  }
}

function buildAnalytics(products, orders, settings) {
  const activeOrders = orders.filter((order) => order.status !== 'cancelled');
  const doneOrders = orders.filter((order) => order.status === 'done');
  const totalRevenue = activeOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const averageCheck = activeOrders.length ? Math.round(totalRevenue / activeOrders.length) : 0;
  const newOrders = orders.filter((order) => order.status === 'new').length;
  const featuredProducts = products.filter((product) => product.featured).length;
  const totalStock = products.reduce((sum, product) => sum + Number(product.stockCount || 0), 0);

  const byProduct = {};
  const byCategory = {};
  const byDay = {};

  activeOrders.forEach((order) => {
    const orderDate = new Date(order.createdAt || Date.now());
    const dayKey = orderDate.toISOString().slice(0, 10);
    if (!byDay[dayKey]) {
      byDay[dayKey] = 0;
    }
    byDay[dayKey] += Number(order.total || 0);

    (order.items || []).forEach((item) => {
      const matchedProduct = products.find((product) => product.id === item.productId);
      const productName = item.name || matchedProduct?.name || 'Без названия';
      const categoryName = matchedProduct?.category || 'Без категории';

      if (!byProduct[productName]) {
        byProduct[productName] = { name: productName, quantity: 0, revenue: 0 };
      }
      byProduct[productName].quantity += Number(item.quantity || 0);
      byProduct[productName].revenue += Number(item.lineTotal || 0);

      if (!byCategory[categoryName]) {
        byCategory[categoryName] = { name: categoryName, quantity: 0, revenue: 0 };
      }
      byCategory[categoryName].quantity += Number(item.quantity || 0);
      byCategory[categoryName].revenue += Number(item.lineTotal || 0);
    });
  });

  const dailyRevenue = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([date, value]) => ({
      date,
      label: new Date(date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
      revenue: value
    }));

  const topProducts = Object.values(byProduct)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const topCategories = Object.values(byCategory)
    .sort((a, b) => b.revenue - a.revenue);

  return {
    metrics: {
      revenue: totalRevenue,
      revenueLabel: formatCurrency(totalRevenue, settings.currency),
      averageCheck,
      averageCheckLabel: formatCurrency(averageCheck, settings.currency),
      orders: activeOrders.length,
      doneOrders: doneOrders.length,
      newOrders,
      featuredProducts,
      totalStock
    },
    statusMap: STATUS_LABELS,
    dailyRevenue,
    topProducts,
    topCategories,
    recentOrders: [...orders]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 8)
  };
}

function normalizeProductInput(input, existing = {}) {
  return {
    ...existing,
    id: existing.id || `prod-${crypto.randomUUID()}`,
    name: String(input.name || existing.name || '').trim(),
    category: String(input.category || existing.category || 'Без категории').trim(),
    price: Number(input.price ?? existing.price ?? 0),
    oldPrice: Number(input.oldPrice ?? existing.oldPrice ?? 0),
    description: String(input.description || existing.description || '').trim(),
    image: String(input.image || existing.image || '/assets/products/c26-premium.svg').trim(),
    inStock: Boolean(typeof input.inStock === 'boolean' ? input.inStock : existing.inStock),
    featured: Boolean(typeof input.featured === 'boolean' ? input.featured : existing.featured),
    rating: Number(input.rating ?? existing.rating ?? 4.8),
    stockCount: Number(input.stockCount ?? existing.stockCount ?? 0),
    unit: String(input.unit || existing.unit || 'шт').trim(),
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function normalizeOrderInput({ items, customer, source }) {
  const products = getProducts();
  const settings = getSettings();
  const preparedItems = (Array.isArray(items) ? items : [])
    .map((item) => {
      const product = products.find((entry) => entry.id === item.productId);
      if (!product || !product.inStock) {
        return null;
      }
      const quantity = Math.max(1, Number(item.quantity || 1));
      return {
        productId: product.id,
        name: product.name,
        price: Number(product.price),
        quantity,
        lineTotal: Number(product.price) * quantity
      };
    })
    .filter(Boolean);

  const total = preparedItems.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
  const deliveryType = customer?.deliveryType || 'Доставка';
  const deliveryCost = deliveryType === 'Самовывоз' ? 0 : Number(settings.deliveryPrice || 0);

  return {
    id: `order-${Date.now()}`,
    status: 'new',
    createdAt: new Date().toISOString(),
    customer: {
      name: String(customer?.name || '').trim(),
      phone: String(customer?.phone || '').trim(),
      telegram: String(customer?.telegram || '').trim(),
      address: String(customer?.address || '').trim(),
      comment: String(customer?.comment || '').trim(),
      deliveryType
    },
    items: preparedItems,
    subtotal: total,
    deliveryCost,
    total: total + deliveryCost,
    source: source || 'telegram-mini-app'
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'stav-ugolki-shop', time: new Date().toISOString() });
});

app.get('/api/settings', (_req, res) => {
  const settings = sanitizePublicSettings(getSettings());
  res.json(settings);
});

app.get('/api/products', (req, res) => {
  const products = getProducts();
  const query = String(req.query.q || '').trim().toLowerCase();
  const category = String(req.query.category || '').trim().toLowerCase();
  const includeOutOfStock = req.query.all === '1';

  let filtered = products.filter((product) => includeOutOfStock || product.inStock);

  if (query) {
    filtered = filtered.filter((product) => {
      const haystack = [product.name, product.description, product.category].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }

  if (category && category !== 'all') {
    filtered = filtered.filter((product) => product.category.toLowerCase() === category);
  }

  filtered.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return a.price - b.price;
  });

  const categories = Array.from(new Set(products.map((product) => product.category)));

  res.json({
    items: filtered,
    categories,
    count: filtered.length
  });
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

    if (payload.total < Number(settings.minOrder || 0) && payload.customer.deliveryType !== 'Самовывоз') {
      return res.status(400).json({
        error: `Минимальная сумма для доставки — ${formatCurrency(settings.minOrder, settings.currency)}`
      });
    }

    const orders = getOrders();
    orders.unshift(payload);
    saveOrders(orders);

    res.status(201).json({
      message: 'Заказ создан',
      order: payload,
      shareText: `Новый заказ ${payload.id} на сумму ${formatCurrency(payload.total, settings.currency)}`
    });
  } catch (error) {
    res.status(500).json({ error: 'Не удалось создать заказ' });
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

app.get('/api/admin/products', authRequired, (_req, res) => {
  res.json(getProducts());
});

app.post('/api/admin/products', authRequired, (req, res) => {
  const products = getProducts();
  const product = normalizeProductInput(req.body || {}, { inStock: true, featured: false });

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
  res.json({ items: orders, statusMap: STATUS_LABELS });
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
    minOrder: Number(req.body?.minOrder ?? current.minOrder ?? 0),
    deliveryPrice: Number(req.body?.deliveryPrice ?? current.deliveryPrice ?? 0),
    heroBadges: Array.isArray(req.body?.heroBadges)
      ? req.body.heroBadges
      : String(req.body?.heroBadges || current.heroBadges?.join(', ') || '')
          .split(',')
          .map((badge) => badge.trim())
          .filter(Boolean)
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
