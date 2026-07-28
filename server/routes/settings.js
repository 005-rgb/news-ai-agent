'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const config = require('../config');

const router = express.Router();

// GET /api/v1/settings
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT count(*) AS total FROM sources WHERE is_active = true`);
    res.json({
      success: true,
      data: {
        timezone: config.timezone,
        qualityScoreThreshold: config.qualityScoreThreshold,
        eeatScoreThreshold: config.eeatScoreThreshold,
        humanizerLevel: config.humanizerLevel,
        keyWarningThreshold: config.keyWarningThreshold,
        jobWorkerIntervalMs: config.jobWorkerIntervalMs,
        activeSources: parseInt(rows[0].total),
        adminUsername: config.adminUsername,
        authConfigured: !!config.adminPasswordHash,
      },
    });
  } catch (err) { next(err); }
});

// POST /api/v1/settings/change-password
router.post('/change-password', async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'current_password and new_password are required' } });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ success: false, error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters' } });
    }
    const valid = await bcrypt.compare(current_password, config.adminPasswordHash);
    if (!valid) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' } });
    }
    const newHash = await bcrypt.hash(new_password, 12);
    res.json({
      success: true,
      data: {
        message: 'Password hash generated. Update ADMIN_PASSWORD_HASH env variable with the value below and restart server.',
        newHash,
      },
    });
  } catch (err) { next(err); }
});

// GET /api/v1/settings/export — config export (no plaintext secrets)
router.get('/export', async (req, res, next) => {
  try {
    const [sitesRes, sourcesRes, promptsRes] = await Promise.all([
      query(`SELECT id, name, url, wordpress_api_url, wordpress_username, niche, categories, status, config, persona_description FROM sites`),
      query(`SELECT id, name, url, rss_url, type, categories, credibility_score, fetch_interval_minutes FROM sources`),
      query(`SELECT id, name, agent_type, category, format_key, prompt_template, is_champion, is_active FROM prompt_versions`),
    ]);

    const articlesCount = await query(`SELECT count(*) FROM articles`);

    res.json({
      success: true,
      data: {
        exported_at: new Date().toISOString(),
        sites: sitesRes.rows,
        sources: sourcesRes.rows,
        prompt_versions: promptsRes.rows,
        articles_count: parseInt(articlesCount.rows[0].count),
        settings: {
          timezone: config.timezone,
          qualityScoreThreshold: config.qualityScoreThreshold,
          eeatScoreThreshold: config.eeatScoreThreshold,
          humanizerLevel: config.humanizerLevel,
        },
        note: 'API keys and WordPress credentials not exported for security reasons.',
      },
    });
  } catch (err) { next(err); }
});

// GET /api/v1/settings/prompt-templates
// Returns ALL templates (active + inactive) so the UI can manage them.
// Query param ?active_only=true to filter only active ones (used internally by agents).
router.get('/prompt-templates', async (req, res, next) => {
  try {
    const activeOnly = req.query.active_only === 'true';
    const whereClause = activeOnly ? 'WHERE is_active = true' : '';
    const { rows } = await query(
      `SELECT id, name, agent_type, category, format_key, prompt_template,
              is_champion, is_active, status, performance_score, sample_count, created_at
       FROM prompt_versions
       ${whereClause}
       ORDER BY agent_type, format_key NULLS LAST, is_champion DESC, created_at ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// POST /api/v1/settings/prompt-templates
router.post('/prompt-templates', async (req, res, next) => {
  try {
    const { name, agent_type, category, format_key, prompt_template } = req.body;
    if (!name || !agent_type || !prompt_template) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'name, agent_type, prompt_template required' } });
    }
    const { v4: uuidv4 } = require('uuid');
    const { rows } = await query(
      `INSERT INTO prompt_versions (id, name, agent_type, category, format_key, prompt_template, is_champion, status)
       VALUES ($1,$2,$3,$4,$5,$6, false,'experimental') RETURNING *`,
      [uuidv4(), name, agent_type, category || null, format_key || null, prompt_template]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// PATCH /api/v1/settings/prompt-templates/:id
// Supports: prompt_template, is_active, status, is_champion
// Champion lifecycle: setting is_champion=true on a row also clears it on all
// other rows with the same (agent_type, format_key) scope, ensuring at most one
// champion per format/agent combination at any time.
router.patch('/prompt-templates/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { prompt_template, is_active, status, is_champion } = req.body;

    // Nothing to update
    if (prompt_template === undefined && is_active === undefined && status === undefined && is_champion === undefined) {
      return res.status(400).json({ success: false, error: { code: 'NO_UPDATES', message: 'No fields provided' } });
    }

    // Fetch target row first (needed for champion scope logic)
    const targetRes = await query(`SELECT * FROM prompt_versions WHERE id = $1`, [id]);
    if (!targetRes.rows.length) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } });
    }
    const target = targetRes.rows[0];

    // ── Champion lifecycle ────────────────────────────────────────────────────
    // When setting is_champion = true: clear champion flag on all other rows
    // with the same agent_type + format_key scope (one champion per scope).
    if (is_champion === true) {
      const scope_format_key = target.format_key;
      const scope_agent_type = target.agent_type;
      if (scope_format_key) {
        await query(
          `UPDATE prompt_versions
           SET is_champion = false
           WHERE id != $1 AND agent_type = $2 AND format_key = $3`,
          [id, scope_agent_type, scope_format_key]
        );
      } else {
        // No format_key: scope by agent_type only
        await query(
          `UPDATE prompt_versions
           SET is_champion = false
           WHERE id != $1 AND agent_type = $2 AND format_key IS NULL`,
          [id, scope_agent_type]
        );
      }
    }

    // ── Build update ──────────────────────────────────────────────────────────
    const updates = [];
    const values = [];
    let idx = 1;
    if (prompt_template !== undefined) { updates.push(`prompt_template = $${idx++}`); values.push(prompt_template); }
    if (is_active !== undefined)       { updates.push(`is_active = $${idx++}`);       values.push(is_active); }
    if (status !== undefined)          { updates.push(`status = $${idx++}`);           values.push(status); }
    if (is_champion !== undefined)     { updates.push(`is_champion = $${idx++}`);      values.push(is_champion); }

    values.push(id);
    const { rows } = await query(
      `UPDATE prompt_versions SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
