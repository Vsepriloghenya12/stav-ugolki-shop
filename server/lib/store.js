const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', '..', 'data');

function fileFor(name) {
  return path.join(dataDir, name);
}

function readJson(name) {
  const raw = fs.readFileSync(fileFor(name), 'utf8');
  return JSON.parse(raw);
}

function writeJson(name, value) {
  fs.writeFileSync(fileFor(name), JSON.stringify(value, null, 2), 'utf8');
  return value;
}

function nextId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

module.exports = { readJson, writeJson, nextId };
