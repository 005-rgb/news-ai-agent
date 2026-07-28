'use strict';

/**
 * API Keys Routes — Phase 1.1 (Full Implementation)
 * CRUD + real test + freshness score + alerts + stats + fallback chain order
 */

const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');
const { encrypt, decrypt } = require('../utils/encryption');
const { calcFreshnessScore } = require('../services/keyPool');
const logger   = require('../utils/logger');
const config   = require('../config');

const router = express.Router();

const VALID_PROVIDERS = ['gemini','groq','deepseek','openrouter','mistral','together','cerebras','cohere'];

// Default limits per provider (from providers.js)
const PROVIDER_DEFAULTS = {
  gemini:     { daily: 1500,  monthly: 45000 },
  groq:       { daily: 14400, monthly: 432000 },
  deepseek:   { daily: 500,   monthly: 15000 },
  openrouter: { daily: 200,   monthly: 6000 },
  mistral:    { daily: 500,   monthly: 15000 },
  together:   { daily: 1000,  monthly: 30000 },
  cerebras:   { daily: 1000,  monthly: 30000 },
  cohere:     { daily: 1000,  monthly: 30000 },
};

// ── GET /api/v1/keys ──────────────────────────────────────────────────────────
// List all keys — key values NOT returned, freshness_score computed
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, provider, label, status,
              usage_today, usage_this_month,
              daily_limit, monthly_limit,
              last_used_at, reset_at,
              error_count, last_error,
              metadata, created_at
       FROM api_keys
       ORDER BY provider, created_at ASC`
    );

    // Attach computed freshness_score to each row
    const data = rows.map(r => ({
      ...r,
      freshness_score: parseFloat(calcFreshnessScore(r).toFixed(3)),
      usage_pct_daily: r.daily_limit
        ? parseFloat(((r.usage_today / r.daily_limit) * 100).toFixed(1))
        : 0,
      usage_pct_monthly: r.monthly_limit
        ? parseFloat(((r.usage_this_month / r.monthly_limit) * 100).toFixed(1))
        : 0,
    }));

    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ── GET /api/v1/keys/stats ────────────────────────────────────────────────────
// Overview numbers for dashboard cards
router.get('/stats', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT
        COUNT(*)                                          AS total,
        COUNT(*) FILTER (WHERE status = 'active')        AS active,
        COUNT(*) FILTER (WHERE status = 'paused')        AS paused,
        COUNT(*) FILTER (WHERE status = 'exhausted')     AS exhausted,
        COUNT(*) FILTER (WHERE status = 'warning')       AS warning,
        COUNT(*) FILTER (WHERE status = 'critical')      AS critical,
        COALESCE(SUM(usage_today),0)                     AS total_usage_today,
        COUNT(DISTINCT provider)                         AS providers_count
      FROM api_keys
    `);
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// ── GET /api/v1/keys/alerts ───────────────────────────────────────────────────
// Structured alerts: keys at warning/critical/exhausted + recent error logs
router.get('/alerts', async (req, res, next) => {
  try {
    // 1. Key-level alerts from api_keys status
    const { rows: keyAlerts } = await query(`
      SELECT id, provider, label, status, usage_today, daily_limit,
             usage_this_month, monthly_limit, error_count, last_error, last_used_at
      FROM api_keys
      WHERE status IN ('warning','critical','exhausted','paused')
      ORDER BY
        CASE status
          WHEN 'exhausted' THEN 0
          WHEN 'critical'  THEN 1
          WHEN 'warning'   THEN 2
          ELSE 3
        END
    `);

    // 2. Recent system log errors (last 6h)
    const { rows: logAlerts } = await query(`
      SELECT id, level, agent, message, metadata, created_at
      FROM system_logs
      WHERE level IN ('error','critical','warn')
        AND created_at > NOW() - INTERVAL '6 hours'
      ORDER BY created_at DESC
      LIMIT 20
    `);

    // Build structured alert list
    const alerts = keyAlerts.map(k => {
      const pct = k.daily_limit ? Math.round((k.usage_today / k.daily_limit) * 100) : 0;
      const severity = k.status === 'exhausted' ? 'critical'
                     : k.status === 'critical'  ? 'critical'
                     : k.status === 'warning'   ? 'warning'
                     : 'info';
      return {
        id: `key-${k.id}`,
        type: 'key_usage',
        severity,
        provider: k.provider,
        label: k.label,
        message: k.status === 'exhausted'
          ? `${k.provider} key "${k.label}" exhausted (${pct}% daily limit)`
          : k.status === 'paused'
          ? `${k.provider} key "${k.label}" paused (${k.error_count} errors)`
          : `${k.provider} key "${k.label}" at ${pct}% daily limit (${k.status})`,
        usage_pct: pct,
        key_id: k.id,
        created_at: k.last_used_at || new Date().toISOString(),
      };
    });

    res.json({
      success: true,
      data: {
        alerts,
        logs: logAlerts,
        summary: {
          critical: alerts.filter(a => a.severity === 'critical').length,
          warning:  alerts.filter(a => a.severity === 'warning').length,
          total:    alerts.length,
        },
      },
    });
  } catch (err) { next(err); }
});

// ── GET /api/v1/keys/order ────────────────────────────────────────────────────
// Get current fallback chain order (from metadata or default)
router.get('/order', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT metadata->>'fallback_chain' AS chain FROM api_keys
       WHERE metadata ? 'fallback_chain' LIMIT 1`
    );

    let chain = VALID_PROVIDERS;
    if (rows.length && rows[0].chain) {
      try { chain = JSON.parse(rows[0].chain); } catch {}
    }

    res.json({ success: true, data: { chain } });
  } catch (err) { next(err); }
});

// ── PUT /api/v1/keys/order ────────────────────────────────────────────────────
// Save fallback chain order
router.put('/order', async (req, res, next) => {
  try {
    const { chain } = req.body;
    if (!Array.isArray(chain) || !chain.every(p => VALID_PROVIDERS.includes(p))) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_CHAIN', message: 'chain must be array of valid providers' },
      });
    }

    // Ensure all providers present
    const full = [...chain, ...VALID_PROVIDERS.filter(p => !chain.includes(p))];

    // Store in a special sentinel row or use a simple table-level approach
    // We use a JSONB marker in a temporary row — simplest without adding a new table
    await query(`
      INSERT INTO api_keys (id, provider, label, key_encrypted, status, metadata)
      VALUES ('00000000-0000-0000-0000-000000000000', '_config', '_fallback_chain', '{}', 'paused',
              jsonb_build_object('fallback_chain', $1::text, 'is_config', true))
      ON CONFLICT (id) DO UPDATE SET metadata = jsonb_build_object(
        'fallback_chain', $1::text, 'is_config', true
      )
    `, [JSON.stringify(full)]);

    await logger.info('KeyPool', 'Fallback chain updated', { chain: full });
    res.json({ success: true, data: { chain: full } });
  } catch (err) { next(err); }
});

// ── POST /api/v1/keys ─────────────────────────────────────────────────────────
// Add new key — encrypted on save, defaults from provider config
router.post('/', async (req, res, next) => {
  try {
    const { provider, label, key_value, daily_limit, monthly_limit, reset_at } = req.body;

    if (!provider || !key_value) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'provider and key_value are required' },
      });
    }
    if (!VALID_PROVIDERS.includes(provider)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PROVIDER', message: `provider must be one of: ${VALID_PROVIDERS.join(', ')}` },
      });
    }

    const defaults = PROVIDER_DEFAULTS[provider] || { daily: 1000, monthly: 30000 };
    const encKey   = encrypt(key_value);

    // Auto-set reset_at if not provided — midnight UTC tomorrow
    const autoResetAt = reset_at || (() => {
      const d = new Date();
      d.setUTCHours(24, 0, 0, 0);
      return d.toISOString();
    })();

    const { rows } = await query(
      `INSERT INTO api_keys
         (id, provider, label, key_encrypted, daily_limit, monthly_limit, reset_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, provider, label, status, usage_today, usage_this_month,
                 daily_limit, monthly_limit, reset_at, error_count, created_at`,
      [
        uuidv4(), provider,
        label || `${provider} key`,
        encKey,
        daily_limit  || defaults.daily,
        monthly_limit|| defaults.monthly,
        autoResetAt,
      ]
    );

    await logger.info('KeyPool', `New key added: ${provider} — ${rows[0].label}`, { keyId: rows[0].id });
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// ── PATCH /api/v1/keys/:id ────────────────────────────────────────────────────
// Update label, status, limits, reset_at, or re-encrypt key_value
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const allowed = ['label','status','daily_limit','monthly_limit','reset_at'];
    const updates = [];
    const values  = [];
    let idx = 1;

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${idx++}`);
        values.push(req.body[field]);
      }
    }

    // Allow re-encrypting key value
    if (req.body.key_value) {
      updates.push(`key_encrypted = $${idx++}`);
      values.push(encrypt(req.body.key_value));
    }

    if (!updates.length) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_UPDATES', message: 'No valid fields provided' },
      });
    }

    values.push(id);
    const { rows } = await query(
      `UPDATE api_keys SET ${updates.join(', ')}
       WHERE id = $${idx} AND provider != '_config'
       RETURNING id, provider, label, status, usage_today, usage_this_month,
                 daily_limit, monthly_limit, reset_at, error_count, last_used_at`,
      values
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Key not found' },
      });
    }

    await logger.info('KeyPool', `Key updated: ${rows[0].provider} — ${rows[0].label}`, { keyId: id });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// ── DELETE /api/v1/keys/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.body || req.body.confirm !== true) {
      return res.status(400).json({
        success: false,
        error: { code: 'CONFIRM_REQUIRED', message: 'Send { confirm: true } to delete' },
      });
    }

    const { rows } = await query(
      `DELETE FROM api_keys WHERE id = $1 AND provider != '_config' RETURNING id, provider, label`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Key not found' },
      });
    }

    await logger.info('KeyPool', `Key deleted: ${rows[0].provider} — ${rows[0].label}`, { keyId: req.params.id });
    res.json({ success: true, data: { message: 'Key deleted', id: req.params.id } });
  } catch (err) { next(err); }
});

// ── POST /api/v1/keys/:id/test ────────────────────────────────────────────────
// Real LLM call to verify the key works — returns latency + excerpt
router.post('/:id/test', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM api_keys WHERE id = $1 AND provider != '_config'`,
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Key not found' },
      });
    }

    const keyRow   = rows[0];
    const keyValue = decrypt(keyRow.key_encrypted);
    const start    = Date.now();

    const llmRouter = require('../services/llmRouter');
    const result = await llmRouter.callWithKey(keyRow.provider, keyValue, 'Reply with exactly one word: OK');

    const latencyMs = Date.now() - start;

    await query(
      `UPDATE api_keys
       SET last_used_at = NOW(), error_count = 0, last_error = NULL
       WHERE id = $1`,
      [keyRow.id]
    );

    await logger.info('KeyPool', `Key test OK: ${keyRow.provider} — ${keyRow.label} — ${latencyMs}ms`, {
      keyId: keyRow.id, latencyMs,
    });

    res.json({
      success: true,
      data: {
        connected:  true,
        latencyMs,
        provider:   keyRow.provider,
        model:      result.model || 'default',
        response:   (result.text || '').slice(0, 120),
        tokensUsed: result.tokensUsed || 0,
      },
    });
  } catch (err) {
    await query(
      `UPDATE api_keys SET error_count = error_count + 1, last_error = $1 WHERE id = $2`,
      [err.message, req.params.id]
    ).catch(() => {});

    await logger.error('KeyPool', `Key test FAILED: ${req.params.id} — ${err.message}`, { keyId: req.params.id });

    res.json({
      success: false,
      data: { connected: false, error: err.message, provider: null },
    });
  }
});

module.exports = router;
