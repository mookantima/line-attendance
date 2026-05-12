const crypto = require('crypto');

// In-memory token store — one-time use, 10-minute TTL
const store = new Map();

function createToken(userId, action) {
  const token = crypto.randomBytes(20).toString('hex');
  store.set(token, { userId, action, ts: Date.now() });
  setTimeout(() => store.delete(token), 10 * 60 * 1000);
  return token;
}

function validateToken(token) {
  const data = store.get(token);
  if (!data) return null;
  if (Date.now() - data.ts > 10 * 60 * 1000) { store.delete(token); return null; }
  store.delete(token); // one-time use
  return data;
}

module.exports = { createToken, validateToken };
