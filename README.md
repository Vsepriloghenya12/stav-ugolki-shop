# Ставь угольки — Telegram Mini App магазин

Готовый проект магазина для Telegram Mini App в стиле вашего лого: темный фон, бирюзовый акцент, кремовый текст, мобильный интерфейс и отдельная панель владельца.

## Что внутри

- клиентская витрина для телефона и Telegram;
- карточка товара в формате bottom sheet;
- deep link на товар через `startapp=product_6729`;
- корзина и оформление заказа;
- кабинет владельца;
- редактирование товаров;
- смена статусов заказов;
- аналитика по выручке, заказам, категориям и топ-товарам;
- опциональный Telegram-бот.

## Быстрый запуск

```bash
cp .env.example .env
npm install
npm start
```

После запуска:

- магазин: `http://localhost:3000/`
- админка: `http://localhost:3000/admin.html`

## Демо-доступ в админку

- логин: `owner`
- пароль: `stavugolki2026`

## Deep link на товар

Проект поддерживает прямое открытие карточки товара. Примеры:

- `https://your-domain.example/?startapp=product_6729`
- `https://your-domain.example/?product=product_6729`

Если Mini App открыт через Telegram и передан `start_param`, карточка тоже откроется автоматически.

## Telegram bot

1. Заполните `.env`:
   - `BOT_TOKEN`
   - `WEB_APP_URL`
   - `ADMIN_CHAT_ID` — чат владельца для уведомлений
2. Запустите:

```bash
npm run bot
```

Бот умеет:
- открывать магазин;
- открывать конкретный товар по `startapp`;
- принимать `web_app_data` после заказа.

## Структура

- `server.js` — backend API
- `public/index.html` — клиентская витрина
- `public/admin.html` — панель владельца
- `public/assets/css/styles.css` — стили
- `public/assets/js/store.js` — логика магазина
- `public/assets/js/admin.js` — логика админки
- `data/products.json` — товары
- `data/orders.json` — заказы
- `data/settings.json` — настройки магазина

## Что менять перед боевым запуском

- домен и HTTPS;
- токен бота;
- реальные контакты;
- реальные товары и цены;
- интеграцию оплаты, если нужна онлайн-оплата.

## Docker

```bash
docker compose up --build
```
