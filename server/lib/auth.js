const crypto = require('crypto');

function getSecret() {
  return process.env.JWT_SECRET || 'stav-ugolki-local-secret';
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(input) {
  return crypto.createHmac('sha256', getSecret()).update(input).digest('base64url');
}

function createToken(username) {
  const payload = {
    sub: username,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7
  };
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [encoded, signature] = token.split('.');
  if (sign(encoded) !== signature) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function extractBearer(req) {
  const auth = req.headers.authorization || '';
  const prefix = 'Bearer ';
  if (!auth.startsWith(prefix)) return null;
  return auth.slice(prefix.length);
}

module.exports = { createToken, verifyToken, extractBearer };
