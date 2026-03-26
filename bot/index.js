const fs = require('fs');
const os = require('os');
const path = require('path');

loadEnv();

const token = process.env.BOT_TOKEN;
const miniAppUrl = process.env.MINIAPP_URL;
const dataDir = resolveDataDir();
const telegramConfigFile = path.join(dataDir, 'telegram_config.json');
const configSyncSecret = process.env.CONFIG_SYNC_SECRET || '';
const appBaseUrl = resolveAppBaseUrl();
const runtimeInfoFile = path.join(dataDir, 'bot_runtime.json');
const runtime = buildRuntimeInfo();

ensureDir(dataDir);
ensureTelegramConfigFile();
writeRuntimeInfo();

if (!token || !miniAppUrl) {
  console.error('Нужны BOT_TOKEN и MINIAPP_URL');
  process.exit(1);
}

let offset = 0;
let pollTimer = null;
let pollingStartedAt = 0;
let conflictCount = 0;
let diagnosticsInFlight = false;

function logInfo(message, extra) {
  logWithLevel('INFO', message, extra);
}

function logWarn(message, extra) {
  logWithLevel('WARN', message, extra);
}

function logError(message, extra) {
  logWithLevel('ERROR', message, extra);
}

function logWithLevel(level, message, extra) {
  const line = `[bot][${new Date().toISOString()}][${level}] ${message}`;
  if (extra === undefined) {
    console.log(line);
    return;
  }
  console.log(line, extra);
}

function buildRuntimeInfo() {
  return {
    startedAt: new Date().toISOString(),
    pid: process.pid,
    ppid: process.ppid,
    node: process.version,
    cwd: process.cwd(),
    argv: process.argv,
    hostname: os.hostname(),
    platform: process.platform,
    dataDir,
    serviceName: process.env.RAILWAY_SERVICE_NAME || '',
    environmentName: process.env.RAILWAY_ENVIRONMENT_NAME || '',
    deploymentId: process.env.RAILWAY_DEPLOYMENT_ID || '',
    replicaId: process.env.RAILWAY_REPLICA_ID || '',
    publicDomain: process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL || '',
    botTokenMask: maskToken(token),
    miniAppUrl,
    appBaseUrl,
    hasConfigSyncSecret: Boolean(configSyncSecret)
  };
}

function maskToken(value) {
  const raw = String(value || '').trim();
  if (!raw) return '(empty)';
  if (raw.length <= 10) return `${raw.slice(0, 2)}***${raw.slice(-2)}`;
  return `${raw.slice(0, 8)}***${raw.slice(-4)}`;
}

function maskUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '(empty)';
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return raw;
  }
}

async function telegram(method, payload = {}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!data.ok) {
    const error = new Error(data.description || 'Telegram API error');
    error.telegram = {
      ok: data.ok,
      error_code: data.error_code,
      description: data.description,
      parameters: data.parameters || null,
      method
    };
    throw error;
  }
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

function writeRuntimeInfo() {
  const previous = readRuntimeInfo();
  if (previous && previous.pid && previous.pid !== runtime.pid) {
    logWarn('Найден предыдущий runtime-файл бота. Это может означать второй инстанс или нештатное завершение прошлого процесса.', {
      previous: summarizeRuntime(previous),
      current: summarizeRuntime(runtime)
    });
  }
  fs.writeFileSync(runtimeInfoFile, JSON.stringify({
    ...runtime,
    lastHeartbeatAt: new Date().toISOString()
  }, null, 2) + '\n', 'utf8');
}

function touchRuntimeInfo(statusPatch = {}) {
  try {
    const current = readRuntimeInfo() || runtime;
    fs.writeFileSync(runtimeInfoFile, JSON.stringify({
      ...current,
      ...statusPatch,
      pid: runtime.pid,
      hostname: runtime.hostname,
      replicaId: runtime.replicaId,
      deploymentId: runtime.deploymentId,
      lastHeartbeatAt: new Date().toISOString()
    }, null, 2) + '\n', 'utf8');
  } catch (error) {
    logWarn('Не удалось обновить runtime-файл бота', { message: error.message });
  }
}

function readRuntimeInfo() {
  try {
    if (!fs.existsSync(runtimeInfoFile)) return null;
    return JSON.parse(fs.readFileSync(runtimeInfoFile, 'utf8'));
  } catch {
    return null;
  }
}

function summarizeRuntime(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    pid: value.pid || '',
    hostname: value.hostname || '',
    serviceName: value.serviceName || '',
    deploymentId: value.deploymentId || '',
    replicaId: value.replicaId || '',
    startedAt: value.startedAt || '',
    lastHeartbeatAt: value.lastHeartbeatAt || ''
  };
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

  let syncLine = '';
  try {
    const remote = await syncTelegramConfigRemote(patch);
    if (remote && remote.ok) {
      syncLine = '\nСинхронизация с приложением: ок';
    } else if (remote && remote.skipped) {
      syncLine = `\nСинхронизация с приложением: пропущена (${remote.reason || 'APP_BASE_URL missing'})`;
    } else {
      syncLine = '\nСинхронизация с приложением: неизвестный статус';
    }
  } catch (error) {
    syncLine = `\nСинхронизация с приложением: ошибка (${error.message})`;
  }

  await reply(chat.id, `Готово. Этот чат сохранён для ${targetName}.\nchat_id: ${chat.id}\nНазвание: ${chat.title}${syncLine}`);
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

async function logStartupDiagnostics() {
  const currentConfig = readTelegramConfig();
  logInfo('Старт бота: базовая диагностика', {
    pid: runtime.pid,
    ppid: runtime.ppid,
    hostname: runtime.hostname,
    serviceName: runtime.serviceName || '(empty)',
    environmentName: runtime.environmentName || '(empty)',
    deploymentId: runtime.deploymentId || '(empty)',
    replicaId: runtime.replicaId || '(empty)',
    publicDomain: runtime.publicDomain || '(empty)',
    dataDir: runtime.dataDir,
    miniAppUrl: maskUrl(runtime.miniAppUrl),
    appBaseUrl: maskUrl(runtime.appBaseUrl),
    botToken: runtime.botTokenMask,
    hasConfigSyncSecret: runtime.hasConfigSyncSecret,
    ordersChatConfigured: Boolean(currentConfig.ordersChatId),
    postsChatConfigured: Boolean(currentConfig.postsChatId)
  });

  try {
    const me = await telegram('getMe');
    logInfo('Telegram getMe OK', {
      id: me.id,
      username: me.username || '',
      canJoinGroups: Boolean(me.can_join_groups),
      canReadAllGroupMessages: Boolean(me.can_read_all_group_messages),
      supportsInlineQueries: Boolean(me.supports_inline_queries)
    });
  } catch (error) {
    logError('Telegram getMe ошибка', formatTelegramError(error));
  }

  try {
    const webhookInfo = await telegram('getWebhookInfo');
    logInfo('Telegram webhook info', {
      url: webhookInfo.url || '(empty)',
      hasCustomCertificate: Boolean(webhookInfo.has_custom_certificate),
      pendingUpdateCount: webhookInfo.pending_update_count || 0,
      lastErrorDate: webhookInfo.last_error_date || 0,
      lastErrorMessage: webhookInfo.last_error_message || '',
      maxConnections: webhookInfo.max_connections || 0,
      allowedUpdates: webhookInfo.allowed_updates || []
    });
  } catch (error) {
    logError('Telegram getWebhookInfo ошибка', formatTelegramError(error));
  }
}

function formatTelegramError(error) {
  return {
    message: error && error.message ? error.message : String(error),
    telegram: error && error.telegram ? error.telegram : null
  };
}

async function runConflictDiagnostics(error) {
  if (diagnosticsInFlight) return;
  diagnosticsInFlight = true;
  touchRuntimeInfo({ lastConflictAt: new Date().toISOString(), lastConflictMessage: error.message || '' });
  try {
    const currentRuntimeFile = readRuntimeInfo();
    logWarn('Обнаружен конфликт polling. Это почти всегда означает второй процесс с тем же BOT_TOKEN.', {
      conflictCount,
      uptimeSec: Math.round(process.uptime()),
      offset,
      currentRuntime: summarizeRuntime(runtime),
      runtimeFile: summarizeRuntime(currentRuntimeFile),
      hint: [
        'Проверь второй bot service',
        'Проверь локальный запуск node bot/index.js',
        'Проверь количество replicas у bot service',
        'Проверь, не использует ли другой проект тот же BOT_TOKEN'
      ]
    });

    try {
      const me = await telegram('getMe');
      logInfo('Диагностика конфликта: getMe OK', {
        id: me.id,
        username: me.username || ''
      });
    } catch (innerError) {
      logError('Диагностика конфликта: getMe ошибка', formatTelegramError(innerError));
    }

    try {
      const webhookInfo = await telegram('getWebhookInfo');
      logInfo('Диагностика конфликта: webhook info', {
        url: webhookInfo.url || '(empty)',
        pendingUpdateCount: webhookInfo.pending_update_count || 0,
        lastErrorDate: webhookInfo.last_error_date || 0,
        lastErrorMessage: webhookInfo.last_error_message || '',
        maxConnections: webhookInfo.max_connections || 0,
        allowedUpdates: webhookInfo.allowed_updates || []
      });
    } catch (innerError) {
      logError('Диагностика конфликта: getWebhookInfo ошибка', formatTelegramError(innerError));
    }
  } finally {
    diagnosticsInFlight = false;
  }
}

async function poll() {
  touchRuntimeInfo({ polling: true, offset, pollingStartedAt: new Date().toISOString() });
  try {
    const updates = await telegram('getUpdates', {
      offset,
      timeout: 25,
      allowed_updates: ['message', 'channel_post']
    });

    if (!pollingStartedAt) pollingStartedAt = Date.now();
    conflictCount = 0;
    touchRuntimeInfo({ lastPollOkAt: new Date().toISOString(), offset });

    for (const update of updates) {
      offset = update.update_id + 1;
      touchRuntimeInfo({ offset, lastUpdateId: update.update_id, lastUpdateAt: new Date().toISOString() });
      await handleUpdate(update);
    }
  } catch (error) {
    const formatted = formatTelegramError(error);
    logError('Ошибка бота в poll()', formatted);
    if (/terminated by other getUpdates request/i.test(error.message || '')) {
      conflictCount += 1;
      await runConflictDiagnostics(error);
    }
  } finally {
    touchRuntimeInfo({ offset, nextPollInMs: 1200 });
    clearTimeout(pollTimer);
    pollTimer = setTimeout(poll, 1200);
  }
}

function setupProcessDiagnostics() {
  const shutdown = signal => {
    logWarn(`Получен сигнал ${signal}. Бот завершает работу.`, {
      pid: runtime.pid,
      uptimeSec: Math.round(process.uptime()),
      offset
    });
    touchRuntimeInfo({ shuttingDownAt: new Date().toISOString(), signal, offset, polling: false });
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', error => {
    logError('uncaughtException', { message: error.message, stack: error.stack });
    touchRuntimeInfo({ uncaughtExceptionAt: new Date().toISOString(), lastFatalError: error.message || '' });
  });
  process.on('unhandledRejection', reason => {
    logError('unhandledRejection', {
      reason: reason instanceof Error ? { message: reason.message, stack: reason.stack } : String(reason)
    });
    touchRuntimeInfo({ unhandledRejectionAt: new Date().toISOString(), lastFatalError: String(reason) });
  });
}

async function main() {
  setupProcessDiagnostics();
  logInfo('Бот Ставь Угольки запущен');
  await logStartupDiagnostics();
  poll();
}

main().catch(error => {
  logError('Критическая ошибка запуска бота', {
    message: error.message,
    stack: error.stack
  });
  process.exit(1);
});
