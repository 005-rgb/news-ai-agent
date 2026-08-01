'use strict';

/**
 * Phase 11.5 — In-memory response cache with TTL
 * Lightweight cache tanpa dependency eksternal.
 */

const _store = new Map();

/**
 * Get cached value. Returns null jika tidak ada atau sudah expired.
 */
function get(key) {
  const entry = _store.get(key);
  if (!entry) return null;
  if (entry.exp < Date.now()) {
    _store.delete(key);
    return null;
  }
  return entry.val;
}

/**
 * Set cached value dengan TTL (milliseconds).
 */
function set(key, val, ttlMs) {
  _store.set(key, { val, exp: Date.now() + ttlMs });
}

/**
 * Delete a specific key.
 */
function del(key) {
  _store.delete(key);
}

/**
 * Delete all keys matching a prefix.
 */
function delPrefix(prefix) {
  for (const key of _store.keys()) {
    if (key.startsWith(prefix)) _store.delete(key);
  }
}

/**
 * Clear all cached entries.
 */
function clear() {
  _store.clear();
}

/**
 * Current cache size.
 */
function size() {
  return _store.size;
}

/**
 * Express middleware factory — cache GET responses by URL + query string.
 * Usage: router.get('/heavy', cacheMiddleware(60000), handler)
 */
function cacheMiddleware(ttlMs, keyFn = null) {
  return (req, res, next) => {
    const cacheKey = keyFn ? keyFn(req) : `route:${req.originalUrl}`;
    const cached = get(cacheKey);
    if (cached !== null) {
      return res.json(cached);
    }
    // Intercept res.json to store in cache
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200 && body?.success) {
        set(cacheKey, body, ttlMs);
      }
      return originalJson(body);
    };
    next();
  };
}

module.exports = { get, set, del, delPrefix, clear, size, cacheMiddleware };
