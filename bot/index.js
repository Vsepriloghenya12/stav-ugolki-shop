const fs = require('fs');
const path = require('path');

loadEnv();

const token = process.env.BOT_TOKEN;
const miniAppUrl = process.env.MINIAPP_URL;

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

async function handleUpdate(update) {
  const message = update.message;
  if (!message || !message.chat) return;
  const chatId = message.chat.id;
  const text = (message.text || '').trim();

  if (text === '/start' || text === '/shop') {
    await telegram('sendMessage', {
      chat_id: chatId,
      text: 'Ставь Угольки',
      reply_markup: shopKeyboard()
    });
    return;
  }

  await telegram('sendMessage', {
    chat_id: chatId,
    text: 'Напиши /shop чтобы открыть магазин.',
    reply_markup: shopKeyboard()
  });
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
