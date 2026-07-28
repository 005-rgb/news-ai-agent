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
    // In a real deployment: update env/config store. Here we log the new hash.
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
      query(`SELECT id, name, agent_type, category, prompt_template, is_champion, is_active FROM prompt_versions`),
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
router.get('/prompt-templates', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM prompt_versions WHERE is_active = true ORDER BY agent_type, is_champion DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// POST /api/v1/settings/prompt-templates
router.post('/prompt-templates', async (req, res, next) => {
  try {
    const { name, agent_type, category, prompt_template } = req.body;
    if (!name || !agent_type || !prompt_template) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'name, agent_type, prompt_template required' } });
    }
    const { v4: uuidv4 } = require('uuid');
    const { rows } = await query(
      `INSERT INTO prompt_versions (id, name, agent_type, category, prompt_template, status)
       VALUES ($1,$2,$3,$4,$5,'experimental') RETURNING *`,
      [uuidv4(), name, agent_type, category || null, prompt_template]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// PATCH /api/v1/settings/prompt-templates/:id
router.patch('/prompt-templates/:id', async (req, res, next) => {
  try {
    const { prompt_template, is_active, status } = req.body;
    const updates = [];
    const values = [];
    let idx = 1;
    if (prompt_template !== undefined) { updates.push(`prompt_template = $${idx++}`); values.push(prompt_template); }
    if (is_active !== undefined)       { updates.push(`is_active = $${idx++}`);       values.push(is_active); }
    if (status !== undefined)          { updates.push(`status = $${idx++}`);           values.push(status); }
    if (!updates.length) return res.status(400).json({ success: false, error: { code: 'NO_UPDATES', message: 'No fields' } });

    values.push(req.params.id);
    const { rows } = await query(`UPDATE prompt_versions SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    if (!rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
