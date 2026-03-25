const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..', '..');
const bundledDataDir = path.join(projectRoot, 'data');
const configuredDir = process.env.DATA_DIR || process.env.PERSISTENT_DATA_DIR || '';
const defaultPersistentDir = fs.existsSync('/data') ? '/data' : bundledDataDir;
const dataDir = path.resolve(configuredDir || defaultPersistentDir);

const seedFiles = [
  'products.json',
  'banners.json',
  'orders.json',
  'posts.json',
  'support_contacts.json',
  'brands.json',
  'telegram_config.json'
];

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function ensureSeedFile(name) {
  ensureDir(dataDir);
  const destination = path.join(dataDir, name);
  if (fs.existsSync(destination)) return destination;

  const bundled = path.join(bundledDataDir, name);
  if (fs.existsSync(bundled)) {
    fs.copyFileSync(bundled, destination);
    return destination;
  }

  if (name === 'telegram_config.json') {
    fs.writeFileSync(destination, JSON.stringify({
      ordersChatId: '',
      postsChatId: '',
      ordersChatTitle: '',
      postsChatTitle: '',
      updatedAt: ''
    }, null, 2) + '\n', 'utf8');
    return destination;
  }

  fs.writeFileSync(destination, '[]\n', 'utf8');
  return destination;
}


function uploadsDir() {
  const dir = path.join(dataDir, 'uploads');
  ensureDir(dir);
  return dir;
}

function initializeDataStore() {
  ensureDir(dataDir);
  uploadsDir();
  seedFiles.forEach(ensureSeedFile);
}

function fileFor(name) {
  return ensureSeedFile(name);
}

function readJson(name) {
  const raw = fs.readFileSync(fileFor(name), 'utf8');
  return JSON.parse(raw);
}

function writeJson(name, value) {
  const destination = fileFor(name);
  const tempFile = `${destination}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tempFile, destination);
  return value;
}

function nextId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getDataDir() {
  return dataDir;
}

initializeDataStore();

module.exports = { readJson, writeJson, nextId, getDataDir, initializeDataStore, uploadsDir, ensureDir };
