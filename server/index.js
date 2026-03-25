const http = require('http');
const fs = require('fs');
const path = require('path');
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
  const revenue = orders.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const paidCount = orders.filter(item => item.status === 'paid').length;
  const totalItemsSold = orders.reduce((sum, order) => sum + order.items.reduce((s, item) => s + Number(item.qty || 0), 0), 0);
  const averageCheck = orders.length ? Math.round(revenue / orders.length) : 0;
  const favorites = products.filter(item => item.favorite).length;
  const activeBanners = banners.filter(item => item.active).length;
  const lowStock = products.filter(item => Number(item.stock) <= 10).length;

  const soldMap = new Map();
  orders.forEach(order => {
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
    topProducts
  };
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

  res.writeHead(200, { 'Content-Type': getMimeType(filePath) });
  fs.createReadStream(filePath).pipe(res);
}

function normalizeVariants(input, fallbackStock = 0) {
  if (!Array.isArray(input)) return [];
  return input
    .map(item => ({
      id: String(item.id || nextId('var')).slice(0, 60),
      label: String(item.label || '').trim().slice(0, 60),
      price: Number(item.price || 0),
      stock: Math.max(0, Number((item.stock ?? fallbackStock ?? 0)))
    }))
    .filter(item => item.label && Number.isFinite(item.price) && item.price >= 0);
}

function withVariantStock(product) {
  const baseStock = Math.max(0, Number(product?.stock || 0));
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) return { ...product, stock: baseStock, variants: [] };
  const hasExplicitStock = variants.some(item => item.stock !== undefined && item.stock !== null && item.stock !== '');
  let normalized;
  if (hasExplicitStock) {
    normalized = variants.map(item => ({
      ...item,
      stock: Math.max(0, Number((item.stock ?? 0)))
    }));
  } else {
    const perVariant = variants.length ? Math.floor(baseStock / variants.length) : 0;
    let remainder = variants.length ? baseStock % variants.length : 0;
    normalized = variants.map(item => {
      const extra = remainder > 0 ? 1 : 0;
      remainder = Math.max(0, remainder - 1);
      return {
        ...item,
        stock: perVariant + extra
      };
    });
  }
  const total = normalized.reduce((sum, item) => sum + Number(item.stock || 0), 0);
  return { ...product, variants: normalized, stock: total };
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

async function sendTelegramMessage(chatId, text) {
  return telegramRequest('sendMessage', { chat_id: chatId, text });
}


async function sendTelegramPhoto(chatId, text, image) {
  if (!image) return sendTelegramMessage(chatId, text);
  const mediaType = mediaTypeFromValue(image);
  const remote = /^https?:\/\//i.test(image);
  if (mediaType === 'video') {
    if (remote) return telegramRequest('sendVideo', { chat_id: chatId, video: image, caption: text });
    const file = dataUriToFile(image, 'post-video');
    if (!file) return sendTelegramMessage(chatId, text);
    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('caption', text);
    form.append('video', file.blob, file.name);
    return telegramRequest('sendVideo', form, true);
  }
  if (remote) {
    return telegramRequest('sendPhoto', {
      chat_id: chatId,
      photo: image,
      caption: text
    });
  }
  const file = dataUriToFile(image, 'post-image');
  if (!file) return sendTelegramMessage(chatId, text);
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('caption', text);
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
    await sendTelegramPhoto(chatId, String(payload.text || '').slice(0, 4000), String(payload.image || ''));
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

async function handleApi(req, res, pathname) {
  const method = req.method || 'GET';
  const products = () => readJson('products.json');
  const banners = () => readJson('banners.json');
  const orders = () => readJson('orders.json');
  const supportContacts = () => readJson('support_contacts.json');
  const posts = () => readJson('posts.json');

  if (pathname === '/api/health' && method === 'GET') {
    return sendJson(res, 200, { ok: true, name: 'stav-ugolki', dataDir: getDataDir(), telegramConfig: telegramConfigStatus() });
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
      products: products().map(withVariantStock),
      banners: banners().filter(item => item.active),
      supportContacts: supportContacts(),
      pwa: { enabled: true }
    });
  }

  if (pathname === '/api/shop/orders' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const customer = {
        name: String(body.customer?.name || 'Telegram Client').slice(0, 80),
        phone: String(body.customer?.phone || '').slice(0, 40),
        telegram: String(body.customer?.telegram || '').slice(0, 200)
      };
      if (!customer.phone && !customer.telegram) {
        return sendJson(res, 400, { error: 'Укажите телефон или ссылку на Telegram' });
      }
      const items = Array.isArray(body.items)
        ? body.items.map(item => ({
            id: String(item.id || ''),
            name: String(item.name || ''),
            qty: Number(item.qty || 1),
            price: Number(item.price || 0),
            variantId: String(item.variantId || ''),
            variantLabel: String(item.variantLabel || '')
          })).filter(item => item.id && item.qty > 0)
        : [];
      if (!items.length) return sendJson(res, 400, { error: 'Корзина пуста' });
      const current = orders();
      const order = {
        id: nextId('order'),
        createdAt: new Date().toISOString(),
        customer,
        items,
        total: Number(body.total || 0),
        status: 'new'
      };
      current.unshift(order);
      writeJson('orders.json', current);
      notifyOrder(order).catch(error => console.error('Order telegram notify error:', error.message));
      return sendJson(res, 201, { ok: true, order });
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
    const p = products().map(withVariantStock);
    const b = banners();
    const s = supportContacts();
    const o = orders();
    return sendJson(res, 200, {
      products: p,
      banners: b,
      supportContacts: s,
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
      const current = products();
      const product = {
        id: nextId('prod'),
        name: String(body.name || 'Новый товар').slice(0, 120),
        brand: String(body.brand || '').slice(0, 80),
        description: String(body.description || '').slice(0, 5000),
        category: String(body.category || 'прочее').slice(0, 40),
        price: Number(body.price || 0),
        favorite: Boolean(body.favorite),
        homePriority: Number(body.homePriority || 0),
        stock: Number(body.stock || 0),
        image: await persistMediaAsset(body.image, 'product'),
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
      const current = products();
      const index = current.findIndex(item => item.id === id);
      if (index === -1) return sendJson(res, 404, { error: 'Product not found' });
      current[index] = {
        ...current[index],
        name: String(body.name || current[index].name),
        brand: String(body.brand ?? (current[index].brand || '')),
        description: String(body.description ?? (current[index].description || '')),
        category: String(body.category || current[index].category),
        price: Number(body.price ?? current[index].price),
        favorite: Boolean(body.favorite),
        homePriority: Number(body.homePriority ?? current[index].homePriority ?? 0),
        stock: Number(body.stock ?? current[index].stock),
        image: body.image !== undefined ? await persistMediaAsset(body.image, 'product') : current[index].image,
        accent: String(body.accent || current[index].accent || 'tiffany'),
        variants: normalizeVariants(body.variants ?? current[index].variants, Number((body.stock ?? current[index].stock ?? 0)))
      };
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

  if (pathname === '/api/owner/banners' && method === 'POST') {
    if (!ensureOwner(req, res)) return;
    try {
      const body = await parseBody(req);
      const current = banners();
      const banner = {
        id: nextId('banner'),
        title: String(body.title || ''),
        subtitle: String(body.subtitle || ''),
        image: await persistMediaAsset(body.image, 'banner'),
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
      const current = banners();
      const index = current.findIndex(item => item.id === id);
      if (index === -1) return sendJson(res, 404, { error: 'Banner not found' });
      current[index] = {
        ...current[index],
        title: String(body.title ?? current[index].title),
        subtitle: String(body.subtitle ?? current[index].subtitle),
        image: body.image !== undefined ? await persistMediaAsset(body.image, 'banner') : current[index].image,
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
      current[index] = { ...current[index], status: String(body.status || current[index].status) };
      writeJson('orders.json', current);
      return sendJson(res, 200, { ok: true, order: current[index] });
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
      const current = posts();
      const entry = {
        id: nextId('post'),
        createdAt: new Date().toISOString(),
        target: String(body.target || 'group'),
        text: text.slice(0, 4000),
        image: await persistMediaAsset(body.image, 'post')
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

server.listen(port, '0.0.0.0', () => {
  console.log(`Ставь Угольки запущен на порту ${port}`);
});
