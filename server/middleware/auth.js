'use strict';

/**
 * Session-based authentication middleware.
 * Mounted at /api/v1 — req.path is relative to that mount point.
 * Public paths: /auth/login, /auth/logout, /health
 */

const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/logout',
  '/health',
];

function requireAuth(req, res, next) {
  // Allow public endpoints (path is relative to /api/v1 mount)
  if (PUBLIC_PATHS.some(p => req.path === p || req.path.startsWith(p + '/'))) {
    return next();
  }

  if (req.session && req.session.userId) {
    return next();
  }

  return res.status(401).json({
    success: false,
    error: { code: 'UNAUTHORIZED', message: 'Authentication required. Please login.' },
  });
}

module.exports = { requireAuth };
