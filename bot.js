try { require('dotenv').config(); } catch (_error) {}
const { Telegraf, Markup } = require('telegraf');

const token = process.env.BOT_TOKEN;
const baseUrl = process.env.WEB_APP_URL || process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
const adminChatId = process.env.ADMIN_CHAT_ID;

if (!token) {
  console.log('BOT_TOKEN не указан. Заполните .env и запустите снова.');
  process.exit(0);
}

const bot = new Telegraf(token);

function buildWebAppUrl(startParam = '') {
  if (!startParam) return baseUrl;
  const url = new URL(baseUrl);
  url.searchParams.set('startapp', startParam);
  return url.toString();
}

async function sendStoreButton(ctx, startParam = '') {
  const webAppUrl = buildWebAppUrl(startParam);
  const text = startParam
    ? `Открывайте товар ${startParam} в Mini App.`
    : 'Открывайте магазин прямо внутри Telegram.';
  await ctx.reply(text, Markup.inlineKeyboard([
    Markup.button.webApp('Открыть магазин', webAppUrl)
  ]));
}

bot.start(async (ctx) => {
  const startParam = ctx.startPayload || '';
  await sendStoreButton(ctx, startParam);
});

bot.command('shop', async (ctx) => {
  await sendStoreButton(ctx);
});

bot.command('product', async (ctx) => {
  const parts = String(ctx.message.text || '').trim().split(/\s+/);
  const param = parts[1] || 'product_6729';
  await sendStoreButton(ctx, param);
});

bot.on('message', async (ctx, next) => {
  const webAppData = ctx.message?.web_app_data?.data;
  if (!webAppData) return next();

  try {
    const parsed = JSON.parse(webAppData);
    const itemsText = Array.isArray(parsed.items)
      ? parsed.items.map((item) => `• ${item.name} × ${item.quantity}`).join('\n')
      : '—';

    const text = [
      '🔥 Новый заказ из Mini App',
      `ID: ${parsed.id || '—'}`,
      `Сумма: ${parsed.total || '—'}`,
      `Клиент: ${parsed.customer?.name || '—'}`,
      `Телефон: ${parsed.customer?.phone || '—'}`,
      `Telegram: ${parsed.customer?.telegram || '—'}`,
      `Получение: ${parsed.customer?.deliveryType || '—'}`,
      `Адрес: ${parsed.customer?.address || '—'}`,
      `Комментарий: ${parsed.customer?.comment || '—'}`,
      '',
      'Состав заказа:',
      itemsText
    ].join('\n');

    await ctx.reply('Заказ принят и передан владельцу. Спасибо!');

    if (adminChatId) {
      await bot.telegram.sendMessage(adminChatId, text);
    }
  } catch (_error) {
    await ctx.reply('Не удалось обработать данные заказа.');
  }
  return undefined;
});

bot.launch().then(() => {
  console.log('Telegram-бот «Ставь угольки» запущен');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
