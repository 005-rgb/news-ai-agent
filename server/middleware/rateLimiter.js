'use strict';

const rateLimit = require('express-rate-limit');

// Global rate limiter: 300 req/min per IP (dev-friendly; tighten in production)
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please slow down.' },
  },
});

// Auth endpoints: 10 req/min per IP (anti brute-force)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many login attempts. Please wait.' },
  },
});

module.exports = { globalLimiter, authLimiter };
