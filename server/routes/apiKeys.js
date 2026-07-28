'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');
const { encrypt, decrypt } = require('../utils/encryption');

const router = express.Router();

// GET /api/v1/keys
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, provider, label, status, usage_today, usage_this_month,
              daily_limit, monthly_limit, last_used_at, reset_at,
              error_count, last_error, metadata, created_at
       FROM api_keys ORDER BY provider, created_at ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /api/v1/keys/alerts
router.get('/alerts', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, level, agent, message, metadata, created_at
       FROM system_logs
       WHERE level IN ('warn','error','critical')
         AND created_at > NOW() - INTERVAL '24 hours'
       ORDER BY created_at DESC
       LIMIT 50`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// POST /api/v1/keys
router.post('/', async (req, res, next) => {
  try {
    const { provider, label, key_value, daily_limit, monthly_limit } = req.body;

    if (!provider || !key_value) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'provider and key_value are required' } });
    }

    const PROVIDERS = ['gemini','groq','deepseek','openrouter','mistral','together','cerebras','cohere'];
    if (!PROVIDERS.includes(provider)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_PROVIDER', message: `provider must be one of: ${PROVIDERS.join(', ')}` } });
    }

    const encKey = encrypt(key_value);
    const { rows } = await query(
      `INSERT INTO api_keys (id, provider, label, key_encrypted, daily_limit, monthly_limit)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, provider, label, status, usage_today, usage_this_month, daily_limit, monthly_limit, created_at`,
      [uuidv4(), provider, label || `${provider} key`, encKey,
       daily_limit || 1000, monthly_limit || 30000]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// PATCH /api/v1/keys/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const allowed = ['label','status','daily_limit','monthly_limit','reset_at'];
    const updates = [];
    const values = [];
    let idx = 1;

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = $${idx++}`);
        values.push(req.body[key]);
      }
    }

    if (!updates.length) {
      return res.status(400).json({ success: false, error: { code: 'NO_UPDATES', message: 'No valid fields provided' } });
    }

    values.push(req.params.id);
    const { rows } = await query(
      `UPDATE api_keys SET ${updates.join(', ')} WHERE id = $${idx}
       RETURNING id, provider, label, status, usage_today, daily_limit, monthly_limit`,
      values
    );
    if (!rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Key not found' } });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/v1/keys/:id
router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.body || req.body.confirm !== true) {
      return res.status(400).json({ success: false, error: { code: 'CONFIRM_REQUIRED', message: 'Send { confirm: true } to delete' } });
    }
    const { rowCount } = await query('DELETE FROM api_keys WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Key not found' } });
    res.json({ success: true, data: { message: 'Key deleted' } });
  } catch (err) { next(err); }
});

// POST /api/v1/keys/:id/test — real LLM call with minimal prompt
router.post('/:id/test', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM api_keys WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Key not found' } });

    const keyRow = rows[0];
    const keyValue = decrypt(keyRow.key_encrypted);
    const start = Date.now();

    const llmRouter = require('../services/llmRouter');
    const result = await llmRouter.callWithKey(keyRow.provider, keyValue, 'Say OK in one word only.');

    // Update last_used_at and clear error_count on success
    await query('UPDATE api_keys SET last_used_at = NOW(), error_count = 0 WHERE id = $1', [keyRow.id]);

    res.json({
      success: true,
      data: {
        connected: true,
        latencyMs: Date.now() - start,
        provider: keyRow.provider,
        response: result.text.slice(0, 100),
      },
    });
  } catch (err) {
    // Increment error_count
    await query('UPDATE api_keys SET error_count = error_count + 1, last_error = $1 WHERE id = $2',
      [err.message, req.params.id]).catch(() => {});
    res.json({ success: false, data: { connected: false, error: err.message } });
  }
});

module.exports = router;
