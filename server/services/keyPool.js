'use strict';

/**
 * Key Pool Manager — Phase 1
 * Smart rotation, usage tracking, freshness scoring, alert system
 */

const { query } = require('../db');
const { decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');
const config = require('../config');

const FALLBACK_CHAIN = ['gemini','groq','deepseek','openrouter','mistral','together','cerebras','cohere'];

class KeyPoolExhaustedError extends Error {
  constructor(details) {
    super('All LLM providers are exhausted or unavailable');
    this.code = 'KEY_POOL_EXHAUSTED';
    this.details = details;
  }
}

/**
 * Calculate freshness score (not stored in DB — computed at runtime)
 * score = (1 - usage_today / daily_limit) * 0.6 + (hours_since_last_used / 24) * 0.4
 */
function calcFreshnessScore(row) {
  const limit = row.daily_limit || 1000;
  const usageRatio = Math.min(row.usage_today / limit, 1);
  const usagePart = (1 - usageRatio) * 0.6;

  let agePart = 0.4; // default if never used
  if (row.last_used_at) {
    const hoursSince = (Date.now() - new Date(row.last_used_at).getTime()) / 3600000;
    agePart = Math.min(hoursSince / 24, 1) * 0.4;
  }
  return usagePart + agePart;
}

/**
 * Select best available key
 * @param {{ provider?: string, category?: string }} options
 * @returns {{ keyRow, keyValue }} — keyRow from DB, keyValue decrypted
 */
async function selectBestKey(options = {}) {
  const { rows } = await query(
    `SELECT * FROM api_keys
     WHERE status = 'active'
       AND usage_today < daily_limit * 0.85
       ${options.provider ? `AND provider = $1` : ''}
     ORDER BY provider`,
    options.provider ? [options.provider] : []
  );

  if (!rows.length) {
    // Try each provider in fallback chain
    const chain = options.provider ? [options.provider] : FALLBACK_CHAIN;
    for (const provider of chain) {
      const { rows: fallback } = await query(
        `SELECT * FROM api_keys WHERE provider = $1 AND status = 'active' LIMIT 5`,
        [provider]
      );
      const fresh = fallback.filter(r => r.usage_today < (r.daily_limit || 1000) * 0.85);
      if (fresh.length) {
        const best = fresh.sort((a,b) => calcFreshnessScore(b) - calcFreshnessScore(a))[0];
        return { keyRow: best, keyValue: decrypt(best.key_encrypted) };
      }
    }
    throw new KeyPoolExhaustedError({ checked: FALLBACK_CHAIN });
  }

  const scored = rows.map(r => ({ ...r, _freshness: calcFreshnessScore(r) }));
  scored.sort((a,b) => b._freshness - a._freshness);
  const best = scored[0];
  return { keyRow: best, keyValue: decrypt(best.key_encrypted) };
}

/**
 * Record usage after a successful LLM call
 */
async function recordUsage(keyId, tokensUsed = 0) {
  const { rows } = await query(
    `UPDATE api_keys
     SET usage_today = usage_today + 1,
         usage_this_month = usage_this_month + 1,
         last_used_at = NOW(),
         error_count = 0
     WHERE id = $1
     RETURNING id, provider, usage_today, daily_limit, usage_this_month, monthly_limit, status`,
    [keyId]
  );
  if (!rows.length) return;

  const row = rows[0];
  const pct = (row.usage_today / (row.daily_limit || 1000)) * 100;
  const threshold = config.keyWarningThreshold || 80;

  if (pct >= 100) {
    await query(`UPDATE api_keys SET status = 'exhausted' WHERE id = $1`, [keyId]);
    await logger.error('KeyPool', `Key ${keyId} (${row.provider}) exhausted — 100% daily limit`, { keyId, provider: row.provider });
  } else if (pct >= 95) {
    await query(`UPDATE api_keys SET status = 'critical' WHERE id = $1`, [keyId]);
    await logger.error('KeyPool', `Key ${keyId} (${row.provider}) critical — ${pct.toFixed(0)}% daily limit`, { keyId, provider: row.provider });
  } else if (pct >= threshold) {
    await query(`UPDATE api_keys SET status = 'warning' WHERE id = $1`, [keyId]);
    await logger.warn('KeyPool', `Key ${keyId} (${row.provider}) warning — ${pct.toFixed(0)}% daily limit`, { keyId, provider: row.provider });
  }
}

/**
 * Record error on key, auto-pause if > 10 errors
 */
async function recordError(keyId, errorMessage) {
  const { rows } = await query(
    `UPDATE api_keys
     SET error_count = error_count + 1, last_error = $1
     WHERE id = $2
     RETURNING id, provider, error_count`,
    [errorMessage, keyId]
  );
  if (!rows.length) return;
  const row = rows[0];
  if (row.error_count > 10) {
    await query(`UPDATE api_keys SET status = 'paused' WHERE id = $1`, [keyId]);
    await logger.critical('KeyPool', `Key ${keyId} (${row.provider}) auto-paused after ${row.error_count} errors`, { keyId });
  }
}

/**
 * Daily reset — call from cron at midnight WIB
 */
async function resetDailyUsage() {
  await query(`UPDATE api_keys SET usage_today = 0, status = 'active' WHERE status IN ('warning','critical','exhausted')`);
  await logger.info('KeyPool', 'Daily usage reset completed');
}

module.exports = { selectBestKey, recordUsage, recordError, resetDailyUsage, KeyPoolExhaustedError };
