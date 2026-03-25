const fs = require('fs');
const path = require('path');

loadEnv();

const token = process.env.BOT_TOKEN;
const miniAppUrl = process.env.MINIAPP_URL;
const dataDir = resolveDataDir();
const telegramConfigFile = path.join(dataDir, 'telegram_config.json');
const configSyncSecret = process.env.CONFIG_SYNC_SECRET || '';
const appBaseUrl = resolveAppBaseUrl();

ensureDir(dataDir);
ensureTelegramConfigFile();

if (!token || !miniAppUrl) {
  console.error('Нужны BOT_TOKEN и MINIAPP_URL');
  process.exit(1);
}

let offset = 0;

async function telegram(method, payload = {}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!data.ok) throw new Error(data.description || 'Telegram API error');
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

function resolveDataDir() {
  const configured = process.env.DATA_DIR || process.env.PERSISTENT_DATA_DIR || '';
  if (configured) return path.resolve(configured);
  if (fs.existsSync('/data')) return '/data';
  return path.join(__dirname, '..', 'data');
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function ensureTelegramConfigFile() {
  if (fs.existsSync(telegramConfigFile)) return;
  fs.writeFileSync(telegramConfigFile, JSON.stringify({
    ordersChatId: '',
    postsChatId: '',
    ordersChatTitle: '',
    postsChatTitle: '',
    updatedAt: ''
  }, null, 2) + '\n', 'utf8');
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

async function syncTelegramConfigRemote(patch) {
  if (!appBaseUrl) return { skipped: true, reason: 'APP_BASE_URL missing' };
  const response = await fetch(`${appBaseUrl}/api/internal/telegram-config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(configSyncSecret ? { 'x-config-sync-secret': configSyncSecret } : {})
    },
    body: JSON.stringify(patch || {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}


function readTelegramConfig() {
  ensureTelegramConfigFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(telegramConfigFile, 'utf8'));
    return {
      ordersChatId: '',
      postsChatId: '',
      ordersChatTitle: '',
      postsChatTitle: '',
      updatedAt: '',
      ...(parsed && typeof parsed === 'object' ? parsed : {})
    };
  } catch {
    return {
      ordersChatId: '',
      postsChatId: '',
      ordersChatTitle: '',
      postsChatTitle: '',
      updatedAt: ''
    };
  }
}

function writeTelegramConfig(value) {
  fs.writeFileSync(telegramConfigFile, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function updateTelegramConfig(patch) {
  const next = {
    ...readTelegramConfig(),
    ...patch,
    updatedAt: new Date().toISOString()
  };
  writeTelegramConfig(next);
  return next;
}

function shopKeyboard() {
  return {
    inline_keyboard: [[
      {
        text: 'Открыть магазин',
        web_app: { url: miniAppUrl }
      }
    ]]
  };
}

function normalizeCommand(text) {
  const first = String(text || '').trim().split(/\s+/)[0] || '';
  if (!first.startsWith('/')) return '';
  return first.split('@')[0].toLowerCase();
}

function describeChat(chat) {
  const title = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || 'Без названия';
  return {
    id: String(chat.id || ''),
    title,
    type: String(chat.type || '')
  };
}

function helpText() {
  return [
    'Команды бота:',
    '/shop — открыть магазин',
    '/manager — назначить этот чат для заявок',
    '/posts — назначить этот чат для постов',
    '/where — показать текущий chat_id и сохранённые чаты',
    '/help — список команд'
  ].join('\n');
}

async function isAdmin(updateLike) {
  const chat = updateLike.chat;
  if (!chat || !chat.id) return false;
  if (chat.type === 'private') return true;
  if (updateLike.channelPost) return true;
  const userId = updateLike.from && updateLike.from.id;
  if (!userId) return false;
  try {
    const admins = await telegram('getChatAdministrators', { chat_id: chat.id });
    return admins.some(item => item && item.user && item.user.id === userId);
  } catch {
    return false;
  }
}

async function reply(chatId, text, withShop = false) {
  const payload = {
    chat_id: chatId,
    text
  };
  if (withShop) payload.reply_markup = shopKeyboard();
  return telegram('sendMessage', payload);
}

async function handleChatAssignment(updateLike, key) {
  const chat = describeChat(updateLike.chat);
  const allowed = await isAdmin(updateLike);
  if (!allowed) {
    await reply(chat.id, 'Эту команду может использовать только админ чата.');
    return;
  }
  const patch = key === 'orders'
    ? { ordersChatId: chat.id, ordersChatTitle: chat.title }
    : { postsChatId: chat.id, postsChatTitle: chat.title };
  updateTelegramConfig(patch);
  const targetName = key === 'orders' ? 'заявок' : 'постов';
  await reply(chat.id, `Готово. Этот чат сохранён для ${targetName}.\nchat_id: ${chat.id}\nНазвание: ${chat.title}`);
}

async function handleWhere(chatId, chat) {
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
  await reply(chatId, lines.join('\n'));
}

async function handleUpdate(update) {
  const source = update.message || update.channel_post;
  if (!source || !source.chat) return;
  const chatId = source.chat.id;
  const text = (source.text || '').trim();
  const command = normalizeCommand(text);
  const updateLike = {
    chat: source.chat,
    from: source.from,
    channelPost: Boolean(update.channel_post)
  };

  if (command === '/start' || command === '/shop') {
    await reply(chatId, 'Ставь Угольки', true);
    return;
  }

  if (command === '/manager' || command === '/set_orders_here') {
    await handleChatAssignment(updateLike, 'orders');
    return;
  }

  if (command === '/posts' || command === '/set_posts_here') {
    await handleChatAssignment(updateLike, 'posts');
    return;
  }

  if (command === '/where') {
    await handleWhere(chatId, source.chat);
    return;
  }

  if (command === '/help') {
    await reply(chatId, helpText(), true);
    return;
  }

  if (command) {
    await reply(chatId, 'Не понял команду.\n\n' + helpText(), true);
  }
}

async function poll() {
  try {
    const updates = await telegram('getUpdates', {
      offset,
      timeout: 25,
      allowed_updates: ['message', 'channel_post']
    });

    for (const update of updates) {
      offset = update.update_id + 1;
      await handleUpdate(update);
    }
  } catch (error) {
    console.error('Ошибка бота:', error.message);
  } finally {
    setTimeout(poll, 1200);
  }
}

console.log('Бот Ставь Угольки запущен');
poll();
