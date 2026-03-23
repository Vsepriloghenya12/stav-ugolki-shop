# Ставь Угольки — структурированная версия

Проект разделён на 3 независимые части:

- `apps/shop` — клиентская витрина для Telegram Mini App
- `apps/owner` — страница владельца
- `bot` — отдельный Telegram-бот
- `server` — лёгкий API и раздача статики без npm-зависимостей
- `data` — товары, баннеры, заказы
- `apps/shared` — общие стили, логика, assets
- `docs` — заметки по визуалу и дальнейшему развитию

## Запуск

```bash
cp .env.example .env
npm start
```

Откроется:

- магазин: `http://localhost:3000/shop/`
- владелец: `http://localhost:3000/owner/`
- также работает короткий адрес: `http://localhost:3000/admin/`

## Вход владельца

- логин: `owner`
- пароль: `stavugolki2026`

## Бот

Бот запускается отдельно:

```bash
node bot/index.js
```

Нужны переменные:

- `BOT_TOKEN`
- `MINIAPP_URL`

## Где проще всего редактировать

- визуал магазина: `apps/shop/css/shop.css`
- поведение магазина: `apps/shop/js/shop.js`
- визуал владельца: `apps/owner/css/owner.css`
- поведение владельца: `apps/owner/js/owner.js`
- общая тема: `apps/shared/css/theme.css`
- данные товаров: `data/products.json`
- данные баннеров: `data/banners.json`

## Архитектурный принцип

Сделано без внешних зависимостей, чтобы на Railway и простых Node-хостингах проект не падал из-за `dotenv`, `express` или других пакетов.
