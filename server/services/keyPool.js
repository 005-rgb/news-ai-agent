'use strict';

/**
 * Key Pool Manager — Phase 1
 * selectBestKey, usage tracking, freshness scoring, alert thresholds, cron resets
 */

const { query } = require('../db');
const { decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');
const config = require('../config');
const { PROVIDERS: PROVIDER_DEFS } = require('../config/providers');

// Providers yang reset setiap rolling 24h sejak pemakaian terakhir
const ROLLING_24H_PROVIDERS  = ['groq', 'openrouter', 'together', 'cerebras'];
// Providers yang reset tepat midnight UTC setiap hari
const MIDNIGHT_UTC_PROVIDERS = ['gemini', 'deepseek', 'mistral', 'cohere'];

const DEFAULT_FALLBACK_CHAIN = [
  'gemini','groq','deepseek','openrouter','mistral','together','cerebras','cohere',
];

// ── Error type ────────────────────────────────────────────────────────────────

class KeyPoolExhaustedError extends Error {
  constructor(details) {
    super('All LLM providers are exhausted or unavailable');
    this.code    = 'KEY_POOL_EXHAUSTED';
    this.details = details;
  }
}

// ── Freshness score ───────────────────────────────────────────────────────────

/**
 * freshness_score = (1 − usage_today/daily_limit) × 0.6
 *                 + (hours_since_last_used / 24) × 0.4
 * Range: 0.0 … 1.0 — higher = fresher (prefer this key)
 */
function calcFreshnessScore(row) {
  const limit      = row.daily_limit || 1000;
  const usageRatio = Math.min((row.usage_today || 0) / limit, 1);
  const usagePart  = (1 - usageRatio) * 0.6;

  let agePart = 0.4; // never used → maximum age part
  if (row.last_used_at) {
    const hoursSince = (Date.now() - new Date(row.last_used_at).getTime()) / 3_600_000;
    agePart = Math.min(hoursSince / 24, 1) * 0.4;
  }

  return usagePart + agePart;
}

// ── Fallback chain loader ─────────────────────────────────────────────────────

async function getFallbackChain() {
  try {
    const { rows } = await query(
      `SELECT metadata->>'fallback_chain' AS chain
       FROM api_keys
       WHERE id = '00000000-0000-0000-0000-000000000000'
       LIMIT 1`
    );
    if (rows.length && rows[0].chain) {
      const parsed = JSON.parse(rows[0].chain);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch { /* fall through */ }
  return DEFAULT_FALLBACK_CHAIN;
}

// ── selectBestKey ─────────────────────────────────────────────────────────────

/**
 * @param {{ provider?: string, category?: string }} options
 * @returns {{ keyRow, keyValue }}
 */
async function selectBestKey(options = {}) {
  const USAGE_CAP = 0.85; // 85% of daily_limit

  // Fetch all eligible active keys
  const baseQuery = options.provider
    ? `SELECT * FROM api_keys
       WHERE status = 'active'
         AND usage_today < daily_limit * ${USAGE_CAP}
         AND provider = $1
         AND provider != '_config'
       ORDER BY provider`
    : `SELECT * FROM api_keys
       WHERE status = 'active'
         AND usage_today < daily_limit * ${USAGE_CAP}
         AND provider != '_config'
       ORDER BY provider`;

  const params = options.provider ? [options.provider] : [];
  const { rows } = await query(baseQuery, params);

  if (rows.length) {
    // Score and sort — best first
    const scored = rows
      .map(r => ({ ...r, _freshness: calcFreshnessScore(r) }))
      .sort((a, b) => b._freshness - a._freshness);
    const best = scored[0];
    return { keyRow: best, keyValue: decrypt(best.key_encrypted) };
  }

  // No key found — walk fallback chain
  const chain = await getFallbackChain();
  const providers = options.provider ? [options.provider] : chain;

  for (const provider of providers) {
    const { rows: fb } = await query(
      `SELECT * FROM api_keys
       WHERE provider = $1
         AND status = 'active'
         AND provider != '_config'
       LIMIT 10`,
      [provider]
    );
    const eligible = fb.filter(r => r.usage_today < (r.daily_limit || 1000) * USAGE_CAP);
    if (eligible.length) {
      const best = eligible.sort((a, b) => calcFreshnessScore(b) - calcFreshnessScore(a))[0];
      return { keyRow: best, keyValue: decrypt(best.key_encrypted) };
    }
  }

  throw new KeyPoolExhaustedError({ checked: providers });
}

// ── recordUsage ───────────────────────────────────────────────────────────────

async function recordUsage(keyId, tokensUsed = 0) {
  const { rows } = await query(
    // reset_at diperbarui per-provider:
    //   rolling_24h  → NOW() + 24h (setiap kali key dipakai quota-window bergeser)
    //   midnight_utc → tidak berubah (sudah di-set ke midnight UTC berikutnya saat create/reset)
    `UPDATE api_keys
     SET usage_today      = usage_today + 1,
         usage_this_month = usage_this_month + 1,
         last_used_at     = NOW(),
         error_count      = 0,
         reset_at = CASE
           WHEN provider = ANY($2) THEN NOW() + INTERVAL '24 hours'
           ELSE reset_at
         END
     WHERE id = $1
     RETURNING id, provider, label, usage_today, daily_limit,
               usage_this_month, monthly_limit, status`,
    [keyId, ROLLING_24H_PROVIDERS]
  );
  if (!rows.length) return;

  const row = rows[0];
  const pct = (row.usage_today / (row.daily_limit || 1000)) * 100;
  const threshold = config.keyWarningThreshold || 80;

  if (pct >= 100) {
    await query(`UPDATE api_keys SET status = 'exhausted' WHERE id = $1`, [keyId]);
    await logger.error('KeyPool',
      `Key exhausted: ${row.provider} "${row.label}" — 100% daily limit`,
      { keyId, provider: row.provider, pct: 100 }
    );
  } else if (pct >= 95) {
    await query(`UPDATE api_keys SET status = 'critical' WHERE id = $1`, [keyId]);
    await logger.error('KeyPool',
      `Key critical: ${row.provider} "${row.label}" — ${pct.toFixed(0)}% daily limit`,
      { keyId, provider: row.provider, pct }
    );
  } else if (pct >= threshold) {
    await query(`UPDATE api_keys SET status = 'warning' WHERE id = $1`, [keyId]);
    await logger.warn('KeyPool',
      `Key warning: ${row.provider} "${row.label}" — ${pct.toFixed(0)}% daily limit`,
      { keyId, provider: row.provider, pct }
    );
  }
}

// ── recordError ───────────────────────────────────────────────────────────────

async function recordError(keyId, errorMessage) {
  const { rows } = await query(
    `UPDATE api_keys
     SET error_count = error_count + 1,
         last_error  = $1
     WHERE id = $2
     RETURNING id, provider, label, error_count`,
    [errorMessage, keyId]
  );
  if (!rows.length) return;

  const row = rows[0];
  if (row.error_count > 10) {
    await query(`UPDATE api_keys SET status = 'paused' WHERE id = $1`, [keyId]);
    await logger.critical('KeyPool',
      `Key auto-paused: ${row.provider} "${row.label}" after ${row.error_count} errors`,
      { keyId, errorCount: row.error_count }
    );
  }
}

// ── resetDailyUsage ───────────────────────────────────────────────────────────
// Dipanggil cron setiap tengah malam WIB (17:00 UTC).
// Hanya me-reset midnight_utc providers (gemini, deepseek, mistral, cohere).
// Rolling_24h providers (groq, openrouter, together, cerebras) di-reset oleh
// resetExpiredRollingKeys() yang jalan tiap 5 menit berdasarkan reset_at per-key.

async function resetDailyUsage() {
  // Hitung reset_at berikutnya = midnight UTC hari berikutnya
  const nextMidnightUTC = new Date();
  nextMidnightUTC.setUTCHours(24, 0, 0, 0);

  const { rowCount } = await query(
    `UPDATE api_keys
     SET usage_today = 0,
         status      = 'active',
         reset_at    = $1
     WHERE status IN ('warning','critical','exhausted')
       AND provider = ANY($2)`,
    [nextMidnightUTC.toISOString(), MIDNIGHT_UTC_PROVIDERS]
  );
  await logger.info('KeyPool', `Daily usage reset — ${rowCount} midnight_utc keys restored to active`);
}

// ── resetExpiredRollingKeys ───────────────────────────────────────────────────
// Dipanggil cron setiap 5 menit.
// Reset rolling_24h providers yang reset_at-nya sudah lewat.

async function resetExpiredRollingKeys() {
  const { rowCount } = await query(
    `UPDATE api_keys
     SET usage_today = 0,
         status      = 'active',
         reset_at    = NOW() + INTERVAL '24 hours'
     WHERE status IN ('warning','critical','exhausted')
       AND provider = ANY($1)
       AND reset_at IS NOT NULL
       AND reset_at <= NOW()`,
    [ROLLING_24H_PROVIDERS]
  );
  if (rowCount > 0) {
    await logger.info('KeyPool',
      `Rolling reset — ${rowCount} rolling_24h keys restored to active`);
  }
  return rowCount;
}

// ── resetMonthlyUsage ─────────────────────────────────────────────────────────
// Called by cron on 1st of each month

async function resetMonthlyUsage() {
  await query(
    `UPDATE api_keys
     SET usage_this_month = 0
     WHERE provider != '_config'`
  );
  await logger.info('KeyPool', 'Monthly usage counters reset');
}

// ── getPoolStatus ─────────────────────────────────────────────────────────────
// Summary for dashboard

async function getPoolStatus() {
  const { rows } = await query(`
    SELECT
      provider,
      COUNT(*)                                        AS total,
      COUNT(*) FILTER (WHERE status = 'active')       AS active,
      COUNT(*) FILTER (WHERE status = 'exhausted')    AS exhausted,
      COUNT(*) FILTER (WHERE status = 'warning')      AS warning,
      COUNT(*) FILTER (WHERE status = 'critical')     AS critical,
      COUNT(*) FILTER (WHERE status = 'paused')       AS paused,
      COALESCE(SUM(usage_today), 0)                   AS total_usage_today
    FROM api_keys
    WHERE provider != '_config'
    GROUP BY provider
    ORDER BY provider
  `);
  return rows;
}

module.exports = {
  selectBestKey,
  recordUsage,
  recordError,
  resetDailyUsage,
  resetExpiredRollingKeys,
  resetMonthlyUsage,
  getPoolStatus,
  calcFreshnessScore,
  KeyPoolExhaustedError,
  ROLLING_24H_PROVIDERS,
  MIDNIGHT_UTC_PROVIDERS,
};
