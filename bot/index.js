const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

loadEnv();

const token = process.env.BOT_TOKEN || '';
const appBaseUrl = resolveAppBaseUrl();
const webhookSecret = resolveWebhookSecret();
const webhookPath = `/api/telegram/webhook/${webhookSecret}`;
const webhookUrl = appBaseUrl ? `${appBaseUrl}${webhookPath}` : '';
const port = Number(process.env.PORT || 8080);

if (!token || !appBaseUrl) {
  console.error('Нужны BOT_TOKEN и APP_BASE_URL для webhook-режима');
  process.exit(1);
}

async function telegram(method, payload = {}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!data.ok) throw new Error(data.description || `Telegram API error (${response.status})`);
  return data.result;
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
  const source = String(process.env.MINIAPP_URL || '').trim();
  if (!source) return '';
  try {
    const url = new URL(source);
    return `${url.protocol}//${url.host}`;
  } catch {
    return '';
  }
}

function resolveWebhookSecret() {
  const explicit = String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
  const raw = explicit || String(process.env.CONFIG_SYNC_SECRET || '').trim() || crypto.createHash('sha256').update(String(token || 'stav-ugolki')).digest('hex');
  const sanitized = raw.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  return sanitized || crypto.createHash('sha256').update(String(token || 'stav-ugolki')).digest('hex').slice(0, 32);
}

async function ensureWebhook() {
  const me = await telegram('getMe');
  console.log('[bot] Webhook bot ready for:', me.username || me.id);
  await telegram('setWebhook', {
    url: webhookUrl,
    secret_token: webhookSecret,
    allowed_updates: ['message', 'channel_post'],
    drop_pending_updates: false
  });
  const info = await telegram('getWebhookInfo');
  console.log('[bot] Webhook configured:', {
    url: info.url || '(empty)',
    pendingUpdateCount: info.pending_update_count || 0,
    lastErrorDate: info.last_error_date || 0,
    lastErrorMessage: info.last_error_message || '',
    webhookPath
  });
}

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/_health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, mode: 'webhook-config', webhookUrl, webhookPath }));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.listen(port, '0.0.0.0', async () => {
  console.log('Бот Ставь Угольки запущен в webhook-режиме');
  console.log('[bot] Ожидаемый webhook URL:', webhookUrl);
  try {
    await ensureWebhook();
  } catch (error) {
    console.error('Ошибка настройки webhook:', error.message);
  }
});
