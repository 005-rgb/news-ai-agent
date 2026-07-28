'use strict';

require('dotenv').config();

// ── Required env variables — server will not start without these ──────────────
const REQUIRED = ['SESSION_SECRET', 'ENCRYPTION_KEY', 'DATABASE_URL'];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`\n[CONFIG] Missing required environment variables: ${missing.join(', ')}`);
  console.error('[CONFIG] Server cannot start. Please set these variables and restart.\n');
  process.exit(1);
}

const config = {
  // ── Server ─────────────────────────────────────────────────────────────────
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // ── Database ───────────────────────────────────────────────────────────────
  databaseUrl: process.env.DATABASE_URL,

  // ── Security ───────────────────────────────────────────────────────────────
  sessionSecret: process.env.SESSION_SECRET,
  encryptionKey: process.env.ENCRYPTION_KEY, // 32-byte hex string

  // ── Admin credentials ──────────────────────────────────────────────────────
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || '', // bcrypt hash

  // ── Timezone ───────────────────────────────────────────────────────────────
  timezone: process.env.TIMEZONE || 'Asia/Jakarta',

  // ── Pipeline quality gates ─────────────────────────────────────────────────
  qualityScoreThreshold: parseInt(process.env.QUALITY_SCORE_THRESHOLD || '75', 10),
  eeatScoreThreshold: parseInt(process.env.EEAT_SCORE_THRESHOLD || '80', 10),

  // ── Humanizer ─────────────────────────────────────────────────────────────
  humanizerLevel: parseInt(process.env.HUMANIZER_LEVEL || '3', 10),

  // ── Key pool ──────────────────────────────────────────────────────────────
  keyWarningThreshold: parseInt(process.env.KEY_WARNING_THRESHOLD || '80', 10), // percent

  // ── Job worker ────────────────────────────────────────────────────────────
  jobWorkerIntervalMs: parseInt(process.env.JOB_WORKER_INTERVAL_MS || '30000', 10),
  watchdogIntervalMs: parseInt(process.env.WATCHDOG_INTERVAL_MS || '300000', 10),

  // ── CORS ──────────────────────────────────────────────────────────────────
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:5173', 'http://localhost:5000'],

  // ── LLM defaults ─────────────────────────────────────────────────────────
  llmTimeout: parseInt(process.env.LLM_TIMEOUT_MS || '60000', 10),
  wpTimeout: parseInt(process.env.WP_TIMEOUT_MS || '30000', 10),
  rssTimeout: parseInt(process.env.RSS_TIMEOUT_MS || '20000', 10),
  imageTimeout: parseInt(process.env.IMAGE_TIMEOUT_MS || '45000', 10),
};

module.exports = config;
