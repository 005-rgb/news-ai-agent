'use strict';

/**
 * Global error handler — all errors normalized to JSON
 * Must be the LAST middleware in the chain
 */

function errorHandler(err, req, res, next) {
  // Already sent headers — let default Express handle
  if (res.headersSent) return next(err);

  const status = err.status || err.statusCode || 500;
  const code   = err.code   || 'INTERNAL_ERROR';
  const message = err.message || 'An unexpected error occurred';

  // Don't leak stack traces in production
  const details = process.env.NODE_ENV !== 'production' ? err.stack : undefined;

  console.error(`[ErrorHandler] ${status} ${code}: ${message}`);

  res.status(status).json({
    success: false,
    error: { code, message, ...(details ? { details } : {}) },
  });
}

// 404 handler — mount before errorHandler
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
  });
}

module.exports = { errorHandler, notFoundHandler };
