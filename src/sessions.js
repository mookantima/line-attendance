// In-memory session store for Line conversation state
// Expires after 10 minutes of inactivity

const sessions = new Map();
const TTL_MS = 10 * 60 * 1000;

function getSession(lineUserId) {
  const session = sessions.get(lineUserId);
  if (!session) return { state: 'idle', data: {} };
  if (Date.now() - session.ts > (session.ttlMs || TTL_MS)) {
    sessions.delete(lineUserId);
    return { state: 'idle', data: {} };
  }
  return session;
}

function setSession(lineUserId, state, data = {}, ttlMs = TTL_MS) {
  sessions.set(lineUserId, { state, data, ts: Date.now(), ttlMs });
}

function getSessionTTL(lineUserId) {
  const session = sessions.get(lineUserId);
  return session?.ttlMs || TTL_MS;
}

function clearSession(lineUserId) {
  sessions.set(lineUserId, { state: 'idle', data: {}, ts: Date.now() });
}

// Clean up expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.ts > TTL_MS) sessions.delete(id);
  }
}, 5 * 60 * 1000);

module.exports = { getSession, setSession, clearSession, getSessionTTL };
