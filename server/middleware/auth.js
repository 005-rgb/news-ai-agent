'use strict';

/**
 * Session-based authentication middleware
 * Protects all /api/v1/* routes except /api/v1/auth/login and /api/v1/health
 */

const PUBLIC_PATHS = [
  '/api/v1/auth/login',
  '/api/v1/health',
];

function requireAuth(req, res, next) {
  // Allow public paths
  if (PUBLIC_PATHS.includes(req.path)) return next();

  // Check session
  if (req.session && req.session.userId) {
    return next();
  }

  return res.status(401).json({
    success: false,
    error: { code: 'UNAUTHORIZED', message: 'Authentication required. Please login.' },
  });
}

module.exports = { requireAuth };
