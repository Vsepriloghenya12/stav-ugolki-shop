const fs = require('fs');
const path = require('path');
const { readJson, writeJson, initializeDataStore } = require('../server/lib/store');

loadEnv();
initializeDataStore();

const token = process.env.BOT_TOKEN;
const miniAppUrl = process.env.MINIAPP_URL || process.env.WEB_APP_URL;

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

function targetStore() {
  try {
    const value = readJson('chat_targets.json');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveTargets(items) {
  writeJson('chat_targets.json', items);
}

function registerChat(chat, role) {
  const current = targetStore().filter(item => String(item.chatId) !== String(chat.id) || item.role !== role);
  current.push({
    chatId: String(chat.id),
    role,
    title: chat.title || chat.username || 'Telegram chat',
    type: chat.type || 'group',
    username: chat.username || '',
    registeredAt: new Date().toISOString()
  });
  saveTargets(current);
  return current;
}

function removeChat(chatId) {
  const current = targetStore().filter(item => String(item.chatId) !== String(chatId));
  saveTargets(current);
  return current;
}

function rolesForChat(chatId) {
  return targetStore().filter(item => String(item.chatId) === String(chatId));
}

async function reply(chatId, text, extra = {}) {
  return telegram('sendMessage', {
    chat_id: chatId,
    text,
    ...extra
  });
}

async function handleUpdate(update) {
  const message = update.message;
  if (!message || !message.chat) return;
  const chat = message.chat;
  const chatId = chat.id;
  const text = (message.text || '').trim();
  const isGroup = ['group', 'supergroup'].includes(chat.type);

  if (text === '/start' || text === '/shop') {
    await reply(chatId, 'Ставь Угольки', { reply_markup: shopKeyboard() });
    return;
  }

  if (isGroup && (text === '/meneger' || text === '/manager')) {
    registerChat(chat, 'manager');
    await reply(chatId, 'Эта группа сохранена как группа менеджера. Сюда будут приходить заказы.');
    return;
  }

  if (isGroup && text === '/postgroup') {
    registerChat(chat, 'post');
    await reply(chatId, 'Эта группа сохранена как группа для постов.');
    return;
  }

  if (isGroup && text === '/roles') {
    const roles = rolesForChat(chatId);
    const line = roles.length ? roles.map(item => item.role).join(', ') : 'ролей нет';
    await reply(chatId, `Для этой группы зарегистрированы роли: ${line}`);
    return;
  }

  if (isGroup && text === '/unregister') {
    removeChat(chatId);
    await reply(chatId, 'Роли этой группы очищены.');
    return;
  }

  if (text === '/help') {
    const help = isGroup
      ? ['/meneger — назначить группу менеджера для заказов', '/postgroup — назначить группу для постов', '/roles — показать роли группы', '/unregister — убрать роли группы', '/shop — открыть магазин'].join('\n')
      : '/shop — открыть магазин';
    await reply(chatId, help, isGroup ? {} : { reply_markup: shopKeyboard() });
    return;
  }

  if (!isGroup) {
    await reply(chatId, 'Напиши /shop чтобы открыть магазин.', { reply_markup: shopKeyboard() });
  }
}

async function poll() {
  try {
    const updates = await telegram('getUpdates', {
      offset,
      timeout: 25,
      allowed_updates: ['message']
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
