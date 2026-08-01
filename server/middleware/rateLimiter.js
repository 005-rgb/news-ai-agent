'use strict';

const rateLimit = require('express-rate-limit');

// ── Global rate limiter: 300 req/min per IP ───────────────────────────────────
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

// ── Auth endpoints: 10 req/min per IP (anti brute-force) ─────────────────────
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

// ── Write operations: 60 req/min per IP (POST/PUT/PATCH/DELETE) ───────────────
// Mencegah spam write ke API (sites, keys, sources, dll)
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many write requests. Please slow down.' },
  },
});

// ── Import/export: 5 req/min per IP ──────────────────────────────────────────
// Operasi berat yang bisa load data besar
const importLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many import/export requests. Please wait.' },
  },
});

// ── Pipeline trigger: 10 req/min per IP ──────────────────────────────────────
// Force run, regenerate, trigger rapat, dll
const pipelineLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many pipeline trigger requests. Please wait.' },
  },
});

module.exports = { globalLimiter, authLimiter, writeLimiter, importLimiter, pipelineLimiter };
