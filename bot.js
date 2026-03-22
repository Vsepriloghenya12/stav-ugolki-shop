require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

const token = process.env.BOT_TOKEN;
const webAppUrl = process.env.WEB_APP_URL || process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
const adminChatId = process.env.ADMIN_CHAT_ID;

if (!token) {
  console.log('BOT_TOKEN не указан. Заполните .env и запустите снова.');
  process.exit(0);
}

const bot = new Telegraf(token);

bot.start(async (ctx) => {
  await ctx.reply(
    '🔥 Добро пожаловать в «Ставь угольки». Открывайте магазин кнопкой ниже.',
    Markup.inlineKeyboard([
      Markup.button.webApp('Открыть магазин', webAppUrl)
    ])
  );
});

bot.command('shop', async (ctx) => {
  await ctx.reply(
    'Каталог открывается прямо внутри Telegram.',
    Markup.inlineKeyboard([
      Markup.button.webApp('Перейти в магазин', webAppUrl)
    ])
  );
});

bot.on('message', async (ctx, next) => {
  const webAppData = ctx.message?.web_app_data?.data;
  if (!webAppData) {
    return next();
  }

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
      `Доставка: ${parsed.customer?.deliveryType || '—'}`,
      `Адрес: ${parsed.customer?.address || '—'}`,
      `Комментарий: ${parsed.customer?.comment || '—'}`,
      '',
      'Состав заказа:',
      itemsText
    ].join('\n');

    await ctx.reply('Заказ передан владельцу. Спасибо!');

    if (adminChatId) {
      await bot.telegram.sendMessage(adminChatId, text);
    }
  } catch (error) {
    await ctx.reply('Не удалось обработать данные заказа.');
  }

  return undefined;
});

bot.launch().then(() => {
  console.log('Telegram-бот «Ставь угольки» запущен');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
