const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { getMimeType } = require('./lib/mime');
const { readJson, writeJson, nextId } = require('./lib/store');
const { createToken, verifyToken, extractBearer } = require('./lib/auth');

const rootDir = path.join(__dirname, '..');
const port = Number(process.env.PORT || 3000);
const ownerLogin = process.env.OWNER_LOGIN || 'owner';
const ownerPassword = process.env.OWNER_PASSWORD || 'stavugolki2026';

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

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 2 * 1024 * 1024) {
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

async function handleApi(req, res, pathname) {
  const method = req.method || 'GET';
  const products = () => readJson('products.json');
  const banners = () => readJson('banners.json');
  const orders = () => readJson('orders.json');

  if (pathname === '/api/health' && method === 'GET') {
    return sendJson(res, 200, { ok: true, name: 'stav-ugolki' });
  }

  if (pathname === '/api/shop/bootstrap' && method === 'GET') {
    return sendJson(res, 200, {
      products: products(),
      banners: banners().filter(item => item.active),
      supportUrl: process.env.SUPPORT_URL || 'https://t.me/your_support'
    });
  }

  if (pathname === '/api/shop/orders' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const current = orders();
      const order = {
        id: nextId('order'),
        createdAt: new Date().toISOString(),
        customer: {
          name: String(body.customer?.name || 'Telegram Client').slice(0, 80),
          phone: String(body.customer?.phone || '').slice(0, 40)
        },
        items: Array.isArray(body.items) ? body.items.map(item => ({
          id: String(item.id || ''),
          name: String(item.name || ''),
          qty: Number(item.qty || 1),
          price: Number(item.price || 0)
        })) : [],
        total: Number(body.total || 0),
        status: 'new'
      };
      current.unshift(order);
      writeJson('orders.json', current);
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
    const p = products();
    const b = banners();
    const o = orders();
    return sendJson(res, 200, {
      products: p,
      banners: b,
      orders: o,
      summary: summarize(p, o, b)
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
        category: String(body.category || 'прочее').slice(0, 40),
        price: Number(body.price || 0),
        favorite: Boolean(body.favorite),
        stock: Number(body.stock || 0),
        image: String(body.image || ''),
        accent: String(body.accent || 'ember')
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
        category: String(body.category || current[index].category),
        price: Number(body.price ?? current[index].price),
        favorite: Boolean(body.favorite),
        stock: Number(body.stock ?? current[index].stock),
        image: String(body.image ?? current[index].image),
        accent: String(body.accent || current[index].accent)
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
    const next = current.filter(item => item.id !== id);
    writeJson('products.json', next);
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
        link: String(body.link || ''),
        image: String(body.image || ''),
        theme: String(body.theme || 'ember'),
        active: Boolean(body.active ?? true)
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
        link: String(body.link ?? current[index].link),
        image: String(body.image ?? current[index].image),
        theme: String(body.theme || current[index].theme),
        active: Boolean(body.active)
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

  return sendJson(res, 404, { error: 'Not found' });
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = requestUrl.pathname;

    if (pathname.startsWith('/api/')) {
      return await handleApi(req, res, pathname);
    }

    if (pathname === '/' || pathname === '') {
      res.writeHead(302, { Location: '/shop/' });
      res.end();
      return;
    }

    const staticPath = (pathname === '/shop' || pathname === '/shop/')
      ? '/apps/shop/'
      : (pathname === '/owner' || pathname === '/owner/')
        ? '/apps/owner/'
        : pathname;

    return serveStatic(res, staticPath);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: 'Internal server error' });
  }
});

server.listen(port, () => {
  console.log(`Ставь Угольки запущен на порту ${port}`);
});
