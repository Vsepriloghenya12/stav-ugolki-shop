const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const { getMimeType } = require('./lib/mime');
const { readJson, writeJson, nextId, getDataDir, initializeDataStore, uploadsDir } = require('./lib/store');
const { createToken, verifyToken, extractBearer } = require('./lib/auth');

loadEnv();
initializeDataStore();

const rootDir = path.join(__dirname, '..');
const port = Number(process.env.PORT || 3000);
const ownerLogin = process.env.OWNER_LOGIN || 'owner';
const ownerPassword = process.env.OWNER_PASSWORD || 'stavugolki2026';
const botToken = process.env.BOT_TOKEN || '';
const adminGroupId = process.env.ADMIN_GROUP_CHAT_ID || '';
const channelChatId = process.env.CHANNEL_CHAT_ID || '';
const configSyncSecret = process.env.CONFIG_SYNC_SECRET || '';
const appBaseUrl = resolveAppBaseUrl();
const miniAppUrl = resolveMiniAppUrl();
const telegramWebhookSecret = resolveTelegramWebhookSecret();
const telegramWebhookPath = `/api/telegram/webhook/${telegramWebhookSecret}`;

function telegramConfigPath() {
  return path.join(getDataDir(), 'telegram_config.json');
}

function readTelegramConfig() {
  const filePath = telegramConfigPath();
  const fallback = {
    ordersChatId: '',
    postsChatId: '',
    ordersChatTitle: '',
    postsChatTitle: '',
    updatedAt: ''
  };
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2) + '\n', 'utf8');
      return fallback;
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return { ...fallback, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch {
    return fallback;
  }
}

function writeTelegramConfig(value) {
  fs.writeFileSync(telegramConfigPath(), JSON.stringify(value, null, 2) + '\n', 'utf8');
  return value;
}

function updateTelegramConfig(patch) {
  const next = {
    ...readTelegramConfig(),
    ...(patch && typeof patch === 'object' ? patch : {}),
    updatedAt: new Date().toISOString()
  };
  return writeTelegramConfig(next);
}


function resolveOrdersChatId() {
  const config = readTelegramConfig();
  return String(config.ordersChatId || adminGroupId || '').trim();
}

function resolvePostsChatId() {
  const config = readTelegramConfig();
  return String(config.postsChatId || channelChatId || '').trim();
}

function telegramConfigStatus() {
  const config = readTelegramConfig();
  const resolvedOrders = String(config.ordersChatId || adminGroupId || '').trim();
  const resolvedPosts = String(config.postsChatId || channelChatId || '').trim();
  return {
    hasBotToken: Boolean(botToken),
    hasAdminGroup: Boolean(resolvedOrders),
    hasChannel: Boolean(resolvedPosts),
    ordersChatId: resolvedOrders,
    postsChatId: resolvedPosts,
    ordersSource: config.ordersChatId ? 'bot-command' : (adminGroupId ? 'env' : ''),
    postsSource: config.postsChatId ? 'bot-command' : (channelChatId ? 'env' : ''),
    ordersChatTitle: String(config.ordersChatTitle || ''),
    postsChatTitle: String(config.postsChatTitle || '')
  };
}

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  raw.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const index = trimmed.indexOf('=');
    if (index === -1) return;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  });
}

function resolveAppBaseUrl() {
  const explicit = String(process.env.APP_BASE_URL || process.env.API_BASE_URL || '').trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const publicDomain = String(process.env.RAILWAY_PUBLIC_DOMAIN || '').trim();
  if (publicDomain) return `https://${publicDomain}`;
  const staticUrl = String(process.env.RAILWAY_STATIC_URL || '').trim();
  if (staticUrl) return staticUrl.replace(/\/$/, '');
  return '';
}

function resolveMiniAppUrl() {
  const explicit = String(process.env.MINIAPP_URL || '').trim();
  if (explicit) return explicit;
  return appBaseUrl ? `${appBaseUrl}/shop/` : '';
}

function telegramWebhookSecrets() {
  const rawCandidates = [
    String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim(),
    String(configSyncSecret || '').trim(),
    crypto.createHash('sha256').update(String(botToken || 'stav-ugolki')).digest('hex')
  ];
  const unique = [];
  for (const raw of rawCandidates) {
    const sanitized = String(raw || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
    if (sanitized && !unique.includes(sanitized)) unique.push(sanitized);
  }
  return unique.length ? unique : [crypto.createHash('sha256').update(String(botToken || 'stav-ugolki')).digest('hex').slice(0, 32)];
}

function resolveTelegramWebhookSecret() {
  return telegramWebhookSecrets()[0];
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function extractConfigSyncToken(req) {
  const header = String(req.headers['x-config-sync-secret'] || '').trim();
  if (header) return header;
  const authHeader = String(req.headers.authorization || '');
  if (authHeader.toLowerCase().startsWith('bearer ')) return authHeader.slice(7).trim();
  return '';
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 20 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function getAuth(req) {
  const token = extractBearer(req);
  return verifyToken(token);
}

function ensureOwner(req, res) {
  const auth = getAuth(req);
  if (!auth) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return null;
  }
  return auth;
}

function summarize(products, orders, banners) {
  const completedOrders = orders.filter(item => item.status === 'fulfilled');
  const revenue = completedOrders.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const paidCount = completedOrders.length;
  const totalItemsSold = completedOrders.reduce((sum, order) => sum + order.items.reduce((s, item) => s + Number(item.qty || 0), 0), 0);
  const averageCheck = completedOrders.length ? Math.round(revenue / completedOrders.length) : 0;
  const favorites = products.filter(item => item.favorite).length;
  const activeBanners = banners.filter(item => item.active).length;
  const lowStock = collectLowStockAlerts(products).length;

  const soldMap = new Map();
  completedOrders.forEach(order => {
    order.items.forEach(item => {
      soldMap.set(item.id, (soldMap.get(item.id) || 0) + Number(item.qty || 0));
    });
  });

  const topProducts = [...products]
    .map(product => ({ ...product, sold: soldMap.get(product.id) || 0 }))
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 5);

  return {
    revenue,
    orderCount: orders.length,
    paidCount,
    totalItemsSold,
    averageCheck,
    favorites,
    activeBanners,
    lowStock,
    topProducts,
    lowStockAlerts: collectLowStockAlerts(products)
  };
}


const ALLOWED_ORDER_STATUSES = new Set(['new', 'fulfilled', 'failed']);

function normalizeOrderStatus(status = 'new') {
  const value = String(status || 'new').trim().toLowerCase();
  if (value === 'paid' || value === 'done') return 'fulfilled';
  if (value === 'cancelled') return 'failed';
  return ALLOWED_ORDER_STATUSES.has(value) ? value : 'new';
}

function normalizeOrderRecord(order = {}) {
  const status = normalizeOrderStatus(order.status);
  return {
    ...order,
    status,
    reservationApplied: order.reservationApplied !== undefined ? Boolean(order.reservationApplied) : false,
    reservedAt: String(order.reservedAt || ''),
    stockApplied: order.stockApplied !== undefined ? Boolean(order.stockApplied) : status === 'fulfilled',
    processedAt: String(order.processedAt || (status !== 'new' ? (order.updatedAt || order.createdAt || '') : '')),
    updatedAt: String(order.updatedAt || '')
  };
}

function sanitizeOrderCustomer(input = {}) {
  return {
    name: String(input?.name || 'Telegram Client').slice(0, 80),
    phone: String(input?.phone || '').slice(0, 40),
    telegram: String(input?.telegram || '').slice(0, 200)
  };
}

function ensureCustomerHasContact(customer = {}) {
  if (!customer.phone && !customer.telegram) {
    throw new Error('Укажите телефон или ссылку на Telegram');
  }
}

function resolveValidatedOrderItems(inputItems = [], currentProducts = [], options = {}) {
  const enforceStock = options.enforceStock !== false;
  const allowHistoricalVariantFallback = options.allowHistoricalVariantFallback === true;
  const catalog = currentProducts.map(withShopStock);
  const prepared = [];

  for (const rawItem of Array.isArray(inputItems) ? inputItems : []) {
    const productId = String(rawItem?.id || '').trim();
    if (!productId) continue;

    const product = catalog.find(item => item.id === productId);
    if (!product) throw new Error('Один из товаров больше недоступен');

    const qty = Math.max(0, Math.floor(Number(rawItem?.qty || 0)));
    if (!qty) continue;

    const variants = Array.isArray(product.variants) ? product.variants : [];
    const requestedVariantId = String(rawItem?.variantId || '').trim();
    let variant = null;
    let historicalVariantItem = false;
    if (variants.length) {
      if (requestedVariantId) {
        variant = variants.find(item => item.id === requestedVariantId) || null;
        if (!variant) throw new Error(`Вариант товара «${product.name}» больше недоступен`);
      } else if (allowHistoricalVariantFallback) {
        historicalVariantItem = true;
      } else {
        throw new Error(`Выберите вариант товара «${product.name}»`);
      }
    }

    if (enforceStock && !historicalVariantItem) {
      const available = variant
        ? Math.max(0, Number(variant.stock || 0))
        : Math.max(0, Number(product.stock || 0));

      if (available <= 0) throw new Error(`Товар «${product.name}» закончился`);
      if (qty > available) {
        throw new Error(variant
          ? `Недостаточно остатка для «${product.name} · ${variant.label}»`
          : `Недостаточно остатка для «${product.name}»`);
      }
    }

    prepared.push({
      id: product.id,
      name: String(historicalVariantItem ? (rawItem?.name || product.name || '') : (product.name || '')).slice(0, 120),
      qty,
      price: Number(historicalVariantItem ? (rawItem?.price ?? product.price ?? 0) : (variant?.price ?? product.price ?? 0)),
      variantId: historicalVariantItem ? String(rawItem?.variantId || '') : (variant?.id || ''),
      variantLabel: historicalVariantItem ? String(rawItem?.variantLabel || '').slice(0, 80) : (variant?.label || '')
    });
  }

  if (!prepared.length) throw new Error('Корзина пуста');
  return prepared;
}

function prepareOrderDraft(body = {}, currentOrder = {}, currentProducts = [], options = {}) {
  const nextCustomer = body.customer !== undefined
    ? sanitizeOrderCustomer(body.customer)
    : sanitizeOrderCustomer(currentOrder.customer || {});
  ensureCustomerHasContact(nextCustomer);
  const nextItems = body.items !== undefined
    ? resolveValidatedOrderItems(body.items, currentProducts, options)
    : resolveValidatedOrderItems(currentOrder.items || [], currentProducts, { ...options, allowHistoricalVariantFallback: true });
  const total = nextItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);
  return { customer: nextCustomer, items: nextItems, total };
}

function safeFilePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const normalized = path.normalize(decoded).replace(/^([.][.][/\\])+/, '');
  return normalized;
}


function mediaExtensionFromMime(mime = '') {
  const value = String(mime || '').toLowerCase();
  if (value.includes('jpeg')) return 'jpg';
  if (value.includes('png')) return 'png';
  if (value.includes('gif')) return 'gif';
  if (value.includes('svg')) return 'svg';
  if (value.includes('webp')) return 'webp';
  if (value.includes('mp4')) return 'mp4';
  if (value.includes('webm')) return 'webm';
  if (value.includes('quicktime')) return 'mov';
  if (value.includes('x-m4v')) return 'm4v';
  return 'bin';
}

async function persistMediaAsset(input, prefix = 'media') {
  const value = String(input || '').trim();
  if (!value) return '';
  if (!value.startsWith('data:')) return value;
  const file = dataUriToFile(value, prefix);
  if (!file) return value;
  const ext = mediaExtensionFromMime(file.mime);
  const name = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const destination = path.join(uploadsDir(), name);
  const arrayBuffer = await file.blob.arrayBuffer();
  fs.writeFileSync(destination, Buffer.from(arrayBuffer));
  return `/media/${name}`;
}

function mediaTypeFromValue(input = '') {
  const value = String(input || '').toLowerCase();
  if (value.startsWith('data:video/') || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(value)) return 'video';
  if (value.startsWith('data:image/gif') || /\.gif(\?|$)/i.test(value)) return 'gif';
  return 'image';
}

function staticCacheControl(filePath) {
  const relative = path.relative(rootDir, filePath).replace(/\\/g, '/');
  const ext = path.extname(filePath).toLowerCase();
  if (relative === 'shop-sw.js' || ext === '.html') return 'no-store';
  if (['.js', '.css', '.webmanifest'].includes(ext)) return 'no-cache, max-age=0, must-revalidate';
  return 'public, max-age=3600, must-revalidate';
}

function serveStatic(res, relativePath) {
  const cleanPath = safeFilePath(relativePath);
  let filePath = path.join(rootDir, cleanPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    sendText(res, 404, 'Not found');
    return;
  }

  res.writeHead(200, {
    'Content-Type': getMimeType(filePath),
    'Cache-Control': staticCacheControl(filePath)
  });
  fs.createReadStream(filePath).pipe(res);
}

function normalizeVariants(input, fallbackStock = 0) {
  if (!Array.isArray(input)) return [];
  return input
    .map(item => ({
      id: String(item.id || nextId('var')).slice(0, 60),
      label: String(item.label || '').trim().slice(0, 60),
      price: Number(item.price || 0),
      stock: Math.max(0, Number((item.stock ?? fallbackStock ?? 0))),
      reserved: Math.max(0, Number(item.reserved ?? 0)),
      minStock: Math.max(0, Number(item.minStock ?? 0))
    }))
    .filter(item => item.label && Number.isFinite(item.price) && item.price >= 0);
}

function withOwnerStock(product) {
  const baseStock = Math.max(0, Number(product?.stock || 0));
  const baseReserved = Math.max(0, Number(product?.reserved || 0));
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) {
    return {
      ...product,
      stock: baseStock,
      reserved: Math.min(baseStock, baseReserved),
      availableStock: Math.max(0, baseStock - baseReserved),
      minStock: Math.max(0, Number(product?.minStock || 0)),
      variants: []
    };
  }

  const normalized = normalizeVariants(variants, baseStock).map(item => {
    const stock = Math.max(0, Number(item.stock || 0));
    const reserved = Math.min(stock, Math.max(0, Number(item.reserved || 0)));
    return {
      ...item,
      stock,
      reserved,
      availableStock: Math.max(0, stock - reserved),
      minStock: Math.max(0, Number(item.minStock ?? 0))
    };
  });

  const totalStock = normalized.reduce((sum, item) => sum + Number(item.stock || 0), 0);
  const totalReserved = normalized.reduce((sum, item) => sum + Number(item.reserved || 0), 0);
  return {
    ...product,
    variants: normalized,
    stock: totalStock,
    reserved: totalReserved,
    availableStock: Math.max(0, totalStock - totalReserved),
    minStock: Math.max(0, Number(product?.minStock || 0))
  };
}

function withShopStock(product) {
  const owner = withOwnerStock(product);
  if (!Array.isArray(owner.variants) || !owner.variants.length) {
    return {
      ...owner,
      physicalStock: owner.stock,
      stock: owner.availableStock
    };
  }
  return {
    ...owner,
    physicalStock: owner.stock,
    stock: owner.availableStock,
    variants: owner.variants.map(item => ({
      ...item,
      physicalStock: item.stock,
      stock: item.availableStock
    }))
  };
}

function cloneProductsList(productsList = []) {
  return JSON.parse(JSON.stringify(Array.isArray(productsList) ? productsList : []));
}

function collectLowStockAlerts(productsList = []) {
  const alerts = [];
  for (const item of Array.isArray(productsList) ? productsList : []) {
    const product = withShopStock(item);
    if (Array.isArray(product.variants) && product.variants.length) {
      for (const variant of product.variants) {
        const minStock = Math.max(0, Number(variant.minStock ?? 0));
        const stock = Math.max(0, Number(variant.availableStock ?? variant.stock ?? 0));
        if (minStock && stock <= minStock) alerts.push({ id: `${product.id}:${variant.id}`, productId: product.id, name: product.name, variantId: variant.id, variantLabel: variant.label, stock, minStock });
      }
    } else {
      const minStock = Math.max(0, Number(product.minStock ?? 0));
      const stock = Math.max(0, Number(product.availableStock ?? product.stock ?? 0));
      if (minStock && stock <= minStock) alerts.push({ id: product.id, productId: product.id, name: product.name, stock, minStock });
    }
  }
  return alerts.sort((a,b) => a.stock - b.stock || String(a.name).localeCompare(String(b.name), 'ru'));
}

function lowStockKey(item) {
  return `${item.productId || item.id}::${item.variantId || 'base'}`;
}

function mutateInventoryByOrderItem(product, orderItem, mode = 'reserve') {
  const qty = Math.max(0, Number(orderItem?.qty || 0));
  if (!qty) return;

  const variants = Array.isArray(product.variants) ? product.variants : [];
  if (variants.length) {
    const target = variants.find(variant => variant.id === orderItem.variantId) || null;
    if (!target) return;
    const stock = Math.max(0, Number(target.stock || 0));
    const reserved = Math.max(0, Number(target.reserved || 0));
    if (mode === 'reserve') {
      if (reserved + qty > stock) throw new Error(`Недостаточно остатка для «${product.name} · ${target.label}»`);
      target.reserved = reserved + qty;
    } else if (mode === 'release') {
      target.reserved = Math.max(0, reserved - qty);
    } else if (mode === 'finalize') {
      if (qty > stock) throw new Error(`Недостаточно остатка для «${product.name} · ${target.label}»`);
      target.reserved = Math.max(0, reserved - qty);
      target.stock = Math.max(0, stock - qty);
    }
    product.stock = variants.reduce((sum, item) => sum + Math.max(0, Number(item.stock || 0)), 0);
    product.reserved = variants.reduce((sum, item) => sum + Math.max(0, Number(item.reserved || 0)), 0);
    return;
  }

  const stock = Math.max(0, Number(product.stock || 0));
  const reserved = Math.max(0, Number(product.reserved || 0));
  if (mode === 'reserve') {
    if (reserved + qty > stock) throw new Error(`Недостаточно остатка для «${product.name}»`);
    product.reserved = reserved + qty;
  } else if (mode === 'release') {
    product.reserved = Math.max(0, reserved - qty);
  } else if (mode === 'finalize') {
    if (qty > stock) throw new Error(`Недостаточно остатка для «${product.name}»`);
    product.reserved = Math.max(0, reserved - qty);
    product.stock = Math.max(0, stock - qty);
  }
}

function applyOrderInventory(order, productsList = [], mode = 'reserve') {
  const current = cloneProductsList(productsList).map(withOwnerStock);
  const beforeAlerts = collectLowStockAlerts(current);
  const beforeKeys = new Set(beforeAlerts.map(lowStockKey));
  for (const orderItem of Array.isArray(order?.items) ? order.items : []) {
    const product = current.find(item => item.id === orderItem.id);
    if (!product) continue;
    mutateInventoryByOrderItem(product, orderItem, mode);
  }
  const nextAlerts = collectLowStockAlerts(current);
  const freshAlerts = nextAlerts.filter(item => !beforeKeys.has(lowStockKey(item)));
  return { products: current, freshAlerts };
}

function escapeTelegram(text) {
  return String(text || '').replace(/</g, '‹').replace(/>/g, '›');
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('ru-RU')} VND`;
}

async function telegramRequest(method, payload, isMultipart = false) {
  if (!botToken) throw new Error('BOT_TOKEN не задан');
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: isMultipart ? undefined : { 'Content-Type': 'application/json' },
    body: isMultipart ? payload : JSON.stringify(payload)
  });
  const data = await response.json();
  if (!data.ok) throw new Error(data.description || 'Telegram API error');
  return data.result;
}

function telegramWebhookUrl() {
  return appBaseUrl ? `${appBaseUrl}${telegramWebhookPath}` : '';
}

async function syncTelegramWebhook() {
  if (!botToken) return;
  const webhookUrl = telegramWebhookUrl();
  if (!webhookUrl) {
    console.warn('Telegram webhook auto-config skipped: не задан APP_BASE_URL/API_BASE_URL или Railway домен app service.');
    return;
  }
  try {
    await telegramRequest('setWebhook', {
      url: webhookUrl,
      secret_token: telegramWebhookSecret,
      allowed_updates: ['message', 'channel_post'],
      drop_pending_updates: false
    });
    const info = await telegramRequest('getWebhookInfo', {});
    console.log('Telegram webhook настроен server-процессом:', {
      url: info.url || '(empty)',
      pendingUpdateCount: info.pending_update_count || 0,
      lastErrorDate: info.last_error_date || 0,
      lastErrorMessage: info.last_error_message || ''
    });
  } catch (error) {
    console.error('Ошибка автонастройки Telegram webhook:', error.message);
  }
}

function dataUriToFile(dataUri, fallbackName = 'image.png') {
  const match = /^data:(.+?);base64,(.+)$/.exec(String(dataUri || ''));
  if (!match) return null;
  const mime = match[1] || 'image/png';
  const base64 = match[2] || '';
  const buffer = Buffer.from(base64, 'base64');
  const ext = mime.includes('jpeg') ? 'jpg' : (mime.split('/')[1] || 'png');
  const name = fallbackName.includes('.') ? fallbackName : `${fallbackName}.${ext}`;
  return {
    name,
    mime,
    blob: new Blob([buffer], { type: mime })
  };
}

async function sendTelegramMessage(chatId, text, withShop = false) {
  const payload = { chat_id: chatId, text };
  if (withShop && miniAppUrl) payload.reply_markup = shopKeyboard();
  return telegramRequest('sendMessage', payload);
}


async function sendTelegramPhoto(chatId, text, image, withShop = false) {
  const replyMarkup = withShop && miniAppUrl ? shopKeyboard() : undefined;
  if (!image) return sendTelegramMessage(chatId, text, withShop);
  const mediaType = mediaTypeFromValue(image);
  const remote = /^https?:\/\//i.test(image);
  if (mediaType === 'video') {
    if (remote) {
      const payload = { chat_id: chatId, video: image, caption: text };
      if (replyMarkup) payload.reply_markup = replyMarkup;
      return telegramRequest('sendVideo', payload);
    }
    const file = dataUriToFile(image, 'post-video');
    if (!file) return sendTelegramMessage(chatId, text, withShop);
    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('caption', text);
    if (replyMarkup) form.append('reply_markup', JSON.stringify(replyMarkup));
    form.append('video', file.blob, file.name);
    return telegramRequest('sendVideo', form, true);
  }
  if (remote) {
    const payload = {
      chat_id: chatId,
      photo: image,
      caption: text
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;
    return telegramRequest('sendPhoto', payload);
  }
  const file = dataUriToFile(image, 'post-image');
  if (!file) return sendTelegramMessage(chatId, text, withShop);
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('caption', text);
  if (replyMarkup) form.append('reply_markup', JSON.stringify(replyMarkup));
  form.append('photo', file.blob, file.name);
  return telegramRequest('sendPhoto', form, true);
}


async function publishOwnerPost(payload) {
  const target = String(payload.target || 'group');
  const chats = [];
  if (target === 'group' || target === 'both') {
    const ordersChatId = resolveOrdersChatId();
    if (!ordersChatId) throw new Error('Чат заявок не задан: используйте /manager в группе или ADMIN_GROUP_CHAT_ID');
    chats.push(ordersChatId);
  }
  if (target === 'channel' || target === 'both') {
    const postsChatId = resolvePostsChatId();
    if (!postsChatId) throw new Error('Чат для постов не задан: используйте /posts в группе/канале или CHANNEL_CHAT_ID');
    chats.push(postsChatId);
  }
  if (!chats.length) throw new Error('Не выбран получатель поста');
  for (const chatId of chats) {
    await sendTelegramPhoto(chatId, String(payload.text || '').slice(0, 4000), String(payload.image || ''), true);
  }
}

async function notifyOrder(order) {
  const ordersChatId = resolveOrdersChatId();
  if (!botToken || !ordersChatId) {
    console.warn('Order telegram notify skipped:', !botToken ? 'BOT_TOKEN missing' : 'orders chat not configured');
    return;
  }
  const lines = [
    'Новый заказ',
    '',
    `Клиент: ${escapeTelegram(order.customer.name || 'Без имени')}`,
    order.customer.phone ? `Телефон: ${escapeTelegram(order.customer.phone)}` : '',
    order.customer.telegram ? `Telegram: ${escapeTelegram(order.customer.telegram)}` : '',
    '',
    'Состав:'
  ].filter(Boolean);

  order.items.forEach((item, index) => {
    const variant = item.variantLabel ? ` • ${item.variantLabel}` : '';
    lines.push(`${index + 1}. ${escapeTelegram(item.name)}${variant} × ${item.qty} — ${formatMoney(item.price * item.qty)}`);
  });
  lines.push('', `Итого: ${formatMoney(order.total)}`);
  await sendTelegramMessage(ordersChatId, lines.join('\n'));
}

function shopKeyboard() {
  if (!miniAppUrl) return undefined;
  return {
    inline_keyboard: [[{
      text: 'Открыть магазин',
      web_app: { url: miniAppUrl }
    }]]
  };
}

function normalizeCommand(text) {
  const first = String(text || '').trim().split(/\s+/)[0] || '';
  if (!first.startsWith('/')) return '';
  return first.split('@')[0].toLowerCase();
}

function describeChat(chat) {
  const title = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || 'Без названия';
  return { id: String(chat.id || ''), title, type: String(chat.type || '') };
}

function helpText() {
  return [
    'Команды бота:',
    '/shop — открыть магазин',
    '/manager — назначить этот чат для заявок',
    '/post или /posts — назначить этот чат для постов',
    '/where — показать текущий chat_id и сохранённые чаты',
    '/help — список команд'
  ].join('\n');
}

async function isTelegramChatAdmin(updateLike) {
  const chat = updateLike.chat;
  if (!chat || !chat.id) return false;
  if (chat.type === 'private') return true;
  if (updateLike.channelPost) return true;
  const userId = updateLike.from && updateLike.from.id;
  if (!userId) return false;
  try {
    const admins = await telegramRequest('getChatAdministrators', { chat_id: chat.id });
    return admins.some(item => item && item.user && item.user.id === userId);
  } catch {
    return false;
  }
}

async function replyWithBot(chatId, text, withShop = false) {
  const payload = { chat_id: chatId, text };
  if (withShop && miniAppUrl) payload.reply_markup = shopKeyboard();
  return telegramRequest('sendMessage', payload);
}

async function handleTelegramChatAssignment(updateLike, key) {
  const chat = describeChat(updateLike.chat);
  const allowed = await isTelegramChatAdmin(updateLike);
  if (!allowed) {
    await replyWithBot(chat.id, 'Эту команду может использовать только админ чата.');
    return;
  }
  const patch = key === 'orders' ? { ordersChatId: chat.id, ordersChatTitle: chat.title } : { postsChatId: chat.id, postsChatTitle: chat.title };
  updateTelegramConfig(patch);
  const targetName = key === 'orders' ? 'заявок' : 'постов';
  await replyWithBot(chat.id, `Готово. Этот чат сохранён для ${targetName}.\nchat_id: ${chat.id}\nНазвание: ${chat.title}`);
}

async function handleTelegramWhere(chatId, chat) {
  const current = readTelegramConfig();
  const info = describeChat(chat);
  const lines = [
    `Текущий чат: ${info.title}`,
    `Тип: ${info.type}`,
    `chat_id: ${info.id}`,
    '',
    `Чат заявок: ${current.ordersChatTitle || 'не задан'}`,
    current.ordersChatId ? `ID заявок: ${current.ordersChatId}` : 'ID заявок: не задан',
    '',
    `Чат постов: ${current.postsChatTitle || 'не задан'}`,
    current.postsChatId ? `ID постов: ${current.postsChatId}` : 'ID постов: не задан'
  ];
  await replyWithBot(chatId, lines.join('\n'));
}

async function handleTelegramUpdate(update) {
  const source = update.message || update.channel_post;
  if (!source || !source.chat) return;
  const chatId = source.chat.id;
  const text = String(source.text || '').trim();
  const command = normalizeCommand(text);
  const updateLike = { chat: source.chat, from: source.from, channelPost: Boolean(update.channel_post) };

  if (command === '/start' || command === '/shop') {
    await replyWithBot(chatId, 'Ставь Угольки', true);
    return;
  }
  if (command === '/manager' || command === '/set_orders_here') {
    await handleTelegramChatAssignment(updateLike, 'orders');
    return;
  }
  if (command === '/post' || command === '/posts' || command === '/set_posts_here') {
    await handleTelegramChatAssignment(updateLike, 'posts');
    return;
  }
  if (command === '/where') {
    await handleTelegramWhere(chatId, source.chat);
    return;
  }
  if (command === '/help') {
    await replyWithBot(chatId, helpText(), true);
    return;
  }
  if (command) {
    await replyWithBot(chatId, 'Не понял команду.\n\n' + helpText(), true);
  }
}


function mergeReservedIntoVariants(nextVariants = [], prevVariants = [], productName = '') {
  const prevById = new Map((Array.isArray(prevVariants) ? prevVariants : []).map(item => [String(item.id || ''), item]));
  const nextIds = new Set((Array.isArray(nextVariants) ? nextVariants : []).map(item => String(item.id || '')));
  for (const prev of Array.isArray(prevVariants) ? prevVariants : []) {
    const reserved = Math.max(0, Number(prev?.reserved || 0));
    if (reserved > 0 && !nextIds.has(String(prev.id || ''))) {
      throw new Error(`Нельзя удалить вариант с активным резервом${productName ? `: ${productName}` : ''}`);
    }
  }
  return (Array.isArray(nextVariants) ? nextVariants : []).map(item => {
    const previous = prevById.get(String(item.id || ''));
    const reserved = Math.max(0, Number(previous?.reserved || 0));
    if (reserved > Math.max(0, Number(item.stock || 0))) {
      throw new Error(`Остаток варианта не может быть меньше зарезервированного${productName ? `: ${productName}` : ''}`);
    }
    return { ...item, reserved };
  });
}

function preserveProductReservations(nextProduct = {}, prevProduct = {}) {
  const previous = withOwnerStock(prevProduct);
  const next = { ...nextProduct };
  const nextVariants = Array.isArray(next.variants) ? next.variants : [];
  const prevVariants = Array.isArray(previous.variants) ? previous.variants : [];

  if (nextVariants.length) {
    if (!prevVariants.length && Math.max(0, Number(previous.reserved || 0)) > 0) {
      throw new Error('Нельзя переключить товар на варианты, пока по нему есть активный резерв');
    }
    next.variants = mergeReservedIntoVariants(nextVariants, prevVariants, String(next.name || previous.name || ''));
    next.stock = next.variants.reduce((sum, item) => sum + Math.max(0, Number(item.stock || 0)), 0);
    next.reserved = next.variants.reduce((sum, item) => sum + Math.max(0, Number(item.reserved || 0)), 0);
    return next;
  }

  if (prevVariants.some(item => Math.max(0, Number(item.reserved || 0)) > 0)) {
    throw new Error('Нельзя убрать варианты, пока по ним есть активный резерв');
  }

  const reserved = Math.max(0, Number(previous.reserved || 0));
  const stock = Math.max(0, Number(next.stock || 0));
  if (reserved > stock) {
    throw new Error('Остаток не может быть меньше зарезервированного');
  }
  next.reserved = reserved;
  return next;
}

function normalizeBrandRecord(body, fallback = {}) {
  return {
    id: String(body.id || fallback.id || '').slice(0, 80),
    name: String(body.name || fallback.name || '').trim().slice(0, 80),
    category: String(body.category || fallback.category || 'прочее').trim().slice(0, 40),
    logo: String(body.logo ?? fallback.logo ?? '').trim()
  };
}

function uniqueBrandsFromProducts(items = []) {
  const map = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const name = String(item.brand || '').trim();
    const category = String(item.category || 'прочее').trim();
    if (!name) continue;
    const key = `${category}::${name.toLowerCase()}`;
    if (!map.has(key)) {
      map.set(key, { id: nextId('brand'), name, category, logo: '' });
    }
  }
  return [...map.values()].sort((a, b) => a.category.localeCompare(b.category, 'ru') || a.name.localeCompare(b.name, 'ru'));
}

async function handleApi(req, res, pathname) {
  const method = req.method || 'GET';
  const products = () => readJson('products.json');
  const banners = () => readJson('banners.json');
  const orders = () => readJson('orders.json').map(normalizeOrderRecord);
  const supportContacts = () => readJson('support_contacts.json');
  const brands = () => {
    const current = readJson('brands.json');
    if (Array.isArray(current) && current.length) {
      return current.map(item => normalizeBrandRecord(item)).filter(item => item.name);
    }
    return uniqueBrandsFromProducts(readJson('products.json'));
  };
  const posts = () => readJson('posts.json');

  if (pathname === '/api/health' && method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      name: 'stav-ugolki',
      dataDir: getDataDir(),
      telegramConfig: telegramConfigStatus(),
      telegramWebhookPath,
      telegramWebhookTarget: telegramWebhookUrl(),
      hasBotToken: Boolean(botToken)
    });
  }

  if (pathname === telegramWebhookPath && method === 'POST') {
    const headerSecret = String(req.headers['x-telegram-bot-api-secret-token'] || '').trim();
    if (!botToken) return sendJson(res, 503, { error: 'BOT_TOKEN missing' });
    const acceptedSecrets = telegramWebhookSecrets();
    if (acceptedSecrets.length && !acceptedSecrets.includes(headerSecret)) {
      console.warn('Telegram webhook rejected: secret mismatch');
      return sendJson(res, 401, { error: 'Unauthorized' });
    }
    try {
      const update = await parseBody(req);
      await handleTelegramUpdate(update);
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      console.error('Telegram webhook error:', error.message);
      return sendJson(res, 200, { ok: false });
    }
  }

  if (pathname === '/api/internal/telegram-config' && method === 'GET') {
    const token = extractConfigSyncToken(req);
    if (configSyncSecret && token !== configSyncSecret) return sendJson(res, 401, { error: 'Unauthorized' });
    return sendJson(res, 200, { ok: true, telegramConfig: readTelegramConfig(), resolved: telegramConfigStatus() });
  }

  if (pathname === '/api/internal/telegram-config' && method === 'POST') {
    const token = extractConfigSyncToken(req);
    if (configSyncSecret && token !== configSyncSecret) return sendJson(res, 401, { error: 'Unauthorized' });
    try {
      const body = await parseBody(req);
      const next = updateTelegramConfig({
        ordersChatId: body.ordersChatId !== undefined ? String(body.ordersChatId || '') : readTelegramConfig().ordersChatId,
        postsChatId: body.postsChatId !== undefined ? String(body.postsChatId || '') : readTelegramConfig().postsChatId,
        ordersChatTitle: body.ordersChatTitle !== undefined ? String(body.ordersChatTitle || '') : readTelegramConfig().ordersChatTitle,
        postsChatTitle: body.postsChatTitle !== undefined ? String(body.postsChatTitle || '') : readTelegramConfig().postsChatTitle
      });
      return sendJson(res, 200, { ok: true, telegramConfig: next, resolved: telegramConfigStatus() });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (pathname === '/api/shop/bootstrap' && method === 'GET') {
    return sendJson(res, 200, {
      products: products().map(withShopStock).filter(item => !item.hiddenFromCatalog),
      brands: brands(),
      banners: banners().filter(item => item.active),
      supportContacts: supportContacts(),
      pwa: { enabled: true }
    });
  }

  if (pathname === '/api/shop/orders' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const current = orders();
      const currentProducts = products();
      const customer = sanitizeOrderCustomer(body.customer || {});
      ensureCustomerHasContact(customer);
      const items = resolveValidatedOrderItems(body.items, currentProducts, { enforceStock: true });
      const recalculatedTotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);
      const reserveResult = applyOrderInventory({ items }, currentProducts, 'reserve');
      const order = normalizeOrderRecord({
        id: nextId('order'),
        createdAt: new Date().toISOString(),
        customer,
        items,
        total: recalculatedTotal,
        status: 'new',
        reservationApplied: true,
        reservedAt: new Date().toISOString(),
        stockApplied: false,
        processedAt: '',
        updatedAt: ''
      });
      current.unshift(order);
      writeJson('orders.json', current);
      writeJson('products.json', reserveResult.products);
      if (reserveResult.freshAlerts.length) {
        notifyLowStockAlerts(reserveResult.freshAlerts).catch(error => console.error('Low stock telegram notify error:', error.message));
      }
      notifyOrder(order).catch(error => console.error('Order telegram notify error:', error.message));
      return sendJson(res, 201, { ok: true, order });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (pathname === '/api/shop/orders/history' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const ids = Array.isArray(body.ids) ? body.ids.map(item => String(item || '')) : [];
      const map = new Set(ids);
      return sendJson(res, 200, { ok: true, orders: orders().filter(item => map.has(String(item.id || ''))).slice(0, 20) });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (pathname === '/api/owner/login' && method === 'POST') {
    try {
      const body = await parseBody(req);
      if (body.login === ownerLogin && body.password === ownerPassword) {
        return sendJson(res, 200, { token: createToken(body.login) });
      }
      return sendJson(res, 401, { error: 'Неверный логин или пароль' });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (pathname === '/api/owner/bootstrap' && method === 'GET') {
    if (!ensureOwner(req, res)) return;
    const p = products().map(withOwnerStock);
    const b = banners();
    const s = supportContacts();
    const o = orders();
    return sendJson(res, 200, {
      products: p,
      banners: b,
      supportContacts: s,
      brands: brands(),
      orders: o,
      posts: posts(),
      summary: summarize(p, o, b),
      telegramConfig: telegramConfigStatus()
    });
  }

  if (pathname === '/api/owner/products' && method === 'POST') {
    if (!ensureOwner(req, res)) return;
    try {
      const body = await parseBody(req);
      const image = await persistMediaAsset(body.image, 'product');
      const current = products();
      const product = {
        id: nextId('prod'),
        name: String(body.name || 'Новый товар').slice(0, 120),
        brand: String(body.brand || '').slice(0, 80),
        description: String(body.description || '').slice(0, 5000),
        category: String(body.category || 'прочее').slice(0, 40),
        price: Number(body.price || 0),
        favorite: Boolean(body.favorite),
        isNew: Boolean(body.isNew),
        isTop: Boolean(body.isTop),
        homePriority: Number(body.homePriority || 0),
        stock: Number(body.stock || 0),
        minStock: Math.max(0, Number(body.minStock || 0)),
        hiddenFromCatalog: Boolean(body.hiddenFromCatalog),
        image,
        accent: String(body.accent || 'tiffany'),
        variants: normalizeVariants(body.variants, Number(body.stock || 0))
      };
      current.unshift(product);
      writeJson('products.json', current);
      return sendJson(res, 201, { ok: true, product });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (pathname.startsWith('/api/owner/products/') && method === 'PUT') {
    if (!ensureOwner(req, res)) return;
    const id = pathname.split('/').pop();
    try {
      const body = await parseBody(req);
      const image = body.image !== undefined ? await persistMediaAsset(body.image, 'product') : undefined;
      const current = products();
      const index = current.findIndex(item => item.id === id);
      if (index === -1) return sendJson(res, 404, { error: 'Product not found' });
      const nextProduct = {
        ...current[index],
        name: String(body.name || current[index].name),
        brand: String(body.brand ?? (current[index].brand || '')),
        description: String(body.description ?? (current[index].description || '')),
        category: String(body.category || current[index].category),
        price: Number(body.price ?? current[index].price),
        favorite: Boolean(body.favorite),
        isNew: body.isNew !== undefined ? Boolean(body.isNew) : Boolean(current[index].isNew),
        isTop: body.isTop !== undefined ? Boolean(body.isTop) : Boolean(current[index].isTop),
        homePriority: Number(body.homePriority ?? current[index].homePriority ?? 0),
        stock: Number(body.stock ?? current[index].stock),
        minStock: Math.max(0, Number(body.minStock ?? current[index].minStock ?? 0)),
        hiddenFromCatalog: body.hiddenFromCatalog !== undefined ? Boolean(body.hiddenFromCatalog) : Boolean(current[index].hiddenFromCatalog),
        image: image !== undefined ? image : current[index].image,
        accent: String(body.accent || current[index].accent || 'tiffany'),
        variants: normalizeVariants(body.variants ?? current[index].variants, Number((body.stock ?? current[index].stock ?? 0)))
      };
      current[index] = preserveProductReservations(nextProduct, current[index]);
      writeJson('products.json', current);
      return sendJson(res, 200, { ok: true, product: current[index] });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (pathname.startsWith('/api/owner/products/') && method === 'DELETE') {
    if (!ensureOwner(req, res)) return;
    const id = pathname.split('/').pop();
    const current = products();
    writeJson('products.json', current.filter(item => item.id !== id));
    return sendJson(res, 200, { ok: true });
  }


  if (pathname === '/api/owner/brands' && method === 'POST') {
    if (!ensureOwner(req, res)) return;
    try {
      const body = await parseBody(req);
      const logo = await persistMediaAsset(body.logo, 'brand');
      const current = brands();
      const item = normalizeBrandRecord({
        ...body,
        id: nextId('brand'),
        logo
      });
      if (!item.name) return sendJson(res, 400, { error: 'Введите название бренда' });
      const duplicate = current.some(entry => String(entry.category || '') === item.category && String(entry.name || '').trim().toLowerCase() === item.name.toLowerCase());
      if (duplicate) return sendJson(res, 400, { error: 'Такой бренд уже есть в этой категории' });
      current.unshift(item);
      writeJson('brands.json', current);
      return sendJson(res, 201, { ok: true, brand: item });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (pathname.startsWith('/api/owner/brands/') && method === 'PUT') {
    if (!ensureOwner(req, res)) return;
    const id = pathname.split('/').pop();
    try {
      const body = await parseBody(req);
      const logo = body.logo !== undefined ? await persistMediaAsset(body.logo, 'brand') : undefined;
      const current = brands();
      const index = current.findIndex(item => item.id === id);
      if (index === -1) return sendJson(res, 404, { error: 'Brand not found' });
      const next = normalizeBrandRecord({
        ...current[index],
        ...body,
        id,
        logo: logo !== undefined ? logo : current[index].logo
      });
      if (!next.name) return sendJson(res, 400, { error: 'Введите название бренда' });
      const duplicate = current.some((entry, entryIndex) => entryIndex !== index && String(entry.category || '') === next.category && String(entry.name || '').trim().toLowerCase() === next.name.toLowerCase());
      if (duplicate) return sendJson(res, 400, { error: 'Такой бренд уже есть в этой категории' });
      current[index] = next;
      writeJson('brands.json', current);
      return sendJson(res, 200, { ok: true, brand: next });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (pathname.startsWith('/api/owner/brands/') && method === 'DELETE') {
    if (!ensureOwner(req, res)) return;
    const id = pathname.split('/').pop();
    const current = brands();
    const brand = current.find(item => item.id === id);
    const nextBrands = current.filter(item => item.id !== id);
    writeJson('brands.json', nextBrands);
    if (brand) {
      const nextProducts = products().map(item => {
        if (String(item.category || '') === String(brand.category || '') && String(item.brand || '').trim() === String(brand.name || '').trim()) {
          return { ...item, brand: '' };
        }
        return item;
      });
      writeJson('products.json', nextProducts);
    }
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/owner/banners' && method === 'POST') {
    if (!ensureOwner(req, res)) return;
    try {
      const body = await parseBody(req);
      const image = await persistMediaAsset(body.image, 'banner');
      const current = banners();
      const banner = {
        id: nextId('banner'),
        title: String(body.title || ''),
        subtitle: String(body.subtitle || ''),
        image,
        theme: String(body.theme || 'tiffany'),
        active: Boolean(body.active ?? true),
        targetCategory: String(body.targetCategory || 'all'),
        targetBrand: String(body.targetBrand || 'all'),
        targetPriceMin: String(body.targetPriceMin || ''),
        targetPriceMax: String(body.targetPriceMax || '')
      };
      current.unshift(banner);
      writeJson('banners.json', current);
      return sendJson(res, 201, { ok: true, banner });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (pathname.startsWith('/api/owner/banners/') && method === 'PUT') {
    if (!ensureOwner(req, res)) return;
    const id = pathname.split('/').pop();
    try {
      const body = await parseBody(req);
      const image = body.image !== undefined ? await persistMediaAsset(body.image, 'banner') : undefined;
      const current = banners();
      const index = current.findIndex(item => item.id === id);
      if (index === -1) return sendJson(res, 404, { error: 'Banner not found' });
      current[index] = {
        ...current[index],
        title: String(body.title ?? current[index].title),
        subtitle: String(body.subtitle ?? current[index].subtitle),
        image: image !== undefined ? image : current[index].image,
        theme: String(body.theme || current[index].theme),
        active: typeof body.active === 'boolean' ? body.active : Boolean(current[index].active),
        targetCategory: String(body.targetCategory ?? current[index].targetCategory ?? 'all'),
        targetBrand: String(body.targetBrand ?? current[index].targetBrand ?? 'all'),
        targetPriceMin: String(body.targetPriceMin ?? current[index].targetPriceMin ?? ''),
        targetPriceMax: String(body.targetPriceMax ?? current[index].targetPriceMax ?? '')
      };
      writeJson('banners.json', current);
      return sendJson(res, 200, { ok: true, banner: current[index] });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (pathname.startsWith('/api/owner/banners/') && method === 'DELETE') {
    if (!ensureOwner(req, res)) return;
    const id = pathname.split('/').pop();
    const current = banners();
    writeJson('banners.json', current.filter(item => item.id !== id));
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/owner/support-contacts' && method === 'POST') {
    if (!ensureOwner(req, res)) return;
    try {
      const body = await parseBody(req);
      const current = supportContacts();
      const item = {
        id: nextId('support'),
        title: String(body.title || 'Контакт').slice(0, 80),
        value: String(body.value || '').slice(0, 120),
        link: String(body.link || '').slice(0, 300)
      };
      if (!item.link.trim()) return sendJson(res, 400, { error: 'Укажите ссылку для контакта' });
      current.unshift(item);
      writeJson('support_contacts.json', current);
      return sendJson(res, 201, { ok: true, item });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (pathname.startsWith('/api/owner/support-contacts/') && method === 'PUT') {
    if (!ensureOwner(req, res)) return;
    const id = pathname.split('/').pop();
    try {
      const body = await parseBody(req);
      const current = supportContacts();
      const index = current.findIndex(item => item.id === id);
      if (index === -1) return sendJson(res, 404, { error: 'Support contact not found' });
      current[index] = {
        ...current[index],
        title: String(body.title ?? current[index].title),
        value: String(body.value ?? current[index].value),
        link: String(body.link ?? current[index].link)
      };
      if (!String(current[index].link || '').trim()) return sendJson(res, 400, { error: 'Укажите ссылку для контакта' });
      writeJson('support_contacts.json', current);
      return sendJson(res, 200, { ok: true, item: current[index] });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (pathname.startsWith('/api/owner/support-contacts/') && method === 'DELETE') {
    if (!ensureOwner(req, res)) return;
    const id = pathname.split('/').pop();
    const current = supportContacts();
    writeJson('support_contacts.json', current.filter(item => item.id !== id));
    return sendJson(res, 200, { ok: true });
  }

  if (pathname.startsWith('/api/owner/orders/') && method === 'PUT') {
    if (!ensureOwner(req, res)) return;
    const id = pathname.split('/').pop();
    try {
      const body = await parseBody(req);
      const current = orders();
      const index = current.findIndex(item => item.id === id);
      if (index === -1) return sendJson(res, 404, { error: 'Order not found' });

      const currentOrder = normalizeOrderRecord(current[index]);
      const action = String(body.action || body.status || 'save').trim().toLowerCase();
      const normalizedAction = action === 'done' || action === 'paid' ? 'fulfilled' : action === 'cancelled' ? 'failed' : action;
      const currentProducts = products();
      const releasedProducts = currentOrder.reservationApplied ? applyOrderInventory(currentOrder, currentProducts, 'release').products : cloneProductsList(currentProducts);

      if (currentOrder.status !== 'new') {
        return sendJson(res, 400, { error: 'Заявка уже обработана и находится в истории' });
      }

      if (normalizedAction === 'save' || normalizedAction === 'edit') {
        const draft = prepareOrderDraft(body, currentOrder, releasedProducts, { enforceStock: true });
        const reserveResult = applyOrderInventory({ items: draft.items }, releasedProducts, 'reserve');
        current[index] = normalizeOrderRecord({
          ...currentOrder,
          ...draft,
          reservationApplied: true,
          reservedAt: currentOrder.reservedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        writeJson('orders.json', current);
        writeJson('products.json', reserveResult.products);
        if (reserveResult.freshAlerts.length) {
          notifyLowStockAlerts(reserveResult.freshAlerts).catch(error => console.error('Low stock telegram notify error:', error.message));
        }
        return sendJson(res, 200, { ok: true, order: current[index] });
      }

      if (normalizedAction === 'fulfilled') {
        const draft = prepareOrderDraft(body, currentOrder, releasedProducts, { enforceStock: true });
        const reserveResult = applyOrderInventory({ items: draft.items }, releasedProducts, 'reserve');
        const finalizeResult = applyOrderInventory({ items: draft.items }, reserveResult.products, 'finalize');
        current[index] = normalizeOrderRecord({
          ...currentOrder,
          ...draft,
          status: 'fulfilled',
          reservationApplied: false,
          stockApplied: true,
          processedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        writeJson('orders.json', current);
        writeJson('products.json', finalizeResult.products);
        if (finalizeResult.freshAlerts.length) {
          notifyLowStockAlerts(finalizeResult.freshAlerts).catch(error => console.error('Low stock telegram notify error:', error.message));
        }
        return sendJson(res, 200, { ok: true, order: current[index], lowStockAlerts: finalizeResult.freshAlerts });
      }

      if (normalizedAction === 'failed') {
        const draft = prepareOrderDraft(body, currentOrder, releasedProducts, { enforceStock: false });
        current[index] = normalizeOrderRecord({
          ...currentOrder,
          ...draft,
          status: 'failed',
          reservationApplied: false,
          stockApplied: false,
          processedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        writeJson('orders.json', current);
        writeJson('products.json', releasedProducts);
        return sendJson(res, 200, { ok: true, order: current[index] });
      }

      return sendJson(res, 400, { error: 'Недопустимое действие для заявки' });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (pathname === '/api/owner/posts' && method === 'POST') {
    if (!ensureOwner(req, res)) return;
    try {
      const body = await parseBody(req);
      const text = String(body.text || '').trim();
      if (!text) return sendJson(res, 400, { error: 'Введите текст поста' });
      await publishOwnerPost(body);
      const image = await persistMediaAsset(body.image, 'post');
      const current = posts();
      const entry = {
        id: nextId('post'),
        createdAt: new Date().toISOString(),
        target: String(body.target || 'group'),
        text: text.slice(0, 4000),
        image
      };
      current.unshift(entry);
      writeJson('posts.json', current);
      return sendJson(res, 201, { ok: true, post: entry });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  return sendJson(res, 404, { error: 'Not found' });
}

if (ownerLogin === 'owner' && ownerPassword === 'stavugolki2026') {
  console.warn('⚠️ Используются стандартные OWNER_LOGIN/OWNER_PASSWORD. Обязательно замените их в env.');
}
if ((process.env.JWT_SECRET || '') === '' || process.env.JWT_SECRET === 'stav-ugolki-local-secret') {
  console.warn('⚠️ Используется стандартный JWT_SECRET. Обязательно задайте свой секрет в env.');
}
if (!configSyncSecret) {
  console.warn('⚠️ CONFIG_SYNC_SECRET не задан. /api/internal/telegram-config доступен без секрета.');
}
if (botToken) {
  console.log(`Telegram webhook endpoint готов: ${telegramWebhookPath}`);
  console.log(`Telegram webhook target: ${telegramWebhookUrl() || '(не определён)'}`);
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = requestUrl.pathname;

    if (pathname.startsWith('/api/')) {
      return await handleApi(req, res, pathname);
    }

    if (pathname === '/health' || pathname === '/_health') {
      sendText(res, 200, 'ok');
      return;
    }

    if (pathname.startsWith('/media/')) {
      const fileName = path.basename(pathname);
      const mediaPath = path.join(uploadsDir(), fileName);
      if (!fs.existsSync(mediaPath)) {
        sendText(res, 404, 'Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': getMimeType(mediaPath), 'Cache-Control': 'public, max-age=31536000, immutable' });
      fs.createReadStream(mediaPath).pipe(res);
      return;
    }

    if (pathname === '/' || pathname === '') {
      return serveStatic(res, '/apps/shop/');
    }

    const staticPath = (pathname === '/shop' || pathname === '/shop/')
      ? '/apps/shop/'
      : (pathname === '/owner' || pathname === '/owner/' || pathname === '/admin' || pathname === '/admin/' || pathname === '/admin.html')
        ? '/apps/owner/'
        : pathname;

    return serveStatic(res, staticPath);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: 'Internal server error' });
  }
});

server.listen(port, '0.0.0.0', async () => {
  console.log(`Ставь Угольки запущен на порту ${port}`);
  await syncTelegramWebhook();
});
