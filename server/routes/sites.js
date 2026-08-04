'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');
const { encrypt, decrypt } = require('../utils/encryption');
const axios = require('axios');
const config = require('../config');

const router = express.Router();

// C-5 Fix: Daftar kolom yang diizinkan untuk UPDATE — immutable, tidak bisa dimanipulasi.
// Kolom SET dibangun hanya dari whitelist ini; user input TIDAK PERNAH langsung masuk
// ke nama kolom dalam query. Pola ini wajib dipertahankan untuk semua route PATCH/PUT.
const SITES_ALLOWED_COLS = Object.freeze([
  'name','url','wordpress_api_url','wordpress_username','wordpress_app_password',
  'niche','categories','persona_description','config','status','persona_memory',
  'citation_style','seo_plugin','human_review_required','default_author',
  'competitor_sites','preferred_providers',
]);

// GET /api/v1/sites
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, url, wordpress_api_url, wordpress_username,
              niche, categories, status, persona_memory, persona_description,
              config, citation_style, seo_plugin, human_review_required,
              default_author, competitor_sites, preferred_providers,
              created_at, updated_at
       FROM sites ORDER BY created_at ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /api/v1/sites/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, url, wordpress_api_url, wordpress_username,
              niche, categories, status, persona_memory, persona_description,
              config, citation_style, seo_plugin, human_review_required,
              default_author, competitor_sites, preferred_providers,
              created_at, updated_at
       FROM sites WHERE id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Site not found' } });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// POST /api/v1/sites
router.post('/', async (req, res, next) => {
  try {
    const {
      name, url, wordpress_api_url, wordpress_username, wordpress_app_password,
      niche, categories, persona_description, config: siteConfig, status,
    } = req.body;

    if (!name || !url) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'name and url are required' } });
    }

    const encPassword = wordpress_app_password ? encrypt(wordpress_app_password) : null;

    const { rows } = await query(
      `INSERT INTO sites (id, name, url, wordpress_api_url, wordpress_username,
                          wordpress_app_password_enc, niche, categories,
                          persona_description, config, status,
                          citation_style, seo_plugin, human_review_required,
                          default_author, competitor_sites, preferred_providers)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING id, name, url, wordpress_api_url, wordpress_username, niche, categories,
                 status, persona_description, config, citation_style, seo_plugin,
                 human_review_required, default_author, competitor_sites, preferred_providers,
                 created_at, updated_at`,
      [uuidv4(), name, url, wordpress_api_url || null, wordpress_username || null,
       encPassword, niche || null, categories || [],
       persona_description || null, siteConfig || {}, status || 'active',
       req.body.citation_style || 'APA', req.body.seo_plugin || 'yoast',
       req.body.human_review_required || false, req.body.default_author || null,
       req.body.competitor_sites || [], req.body.preferred_providers || []]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// PATCH /api/v1/sites/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const updates = [];
    const values = [];
    let idx = 1;

    // C-5 Fix: Iterasi hanya atas kolom yang ada di whitelist SITES_ALLOWED_COLS.
    // Nama kolom tidak pernah berasal dari user input — hanya nilai yang diparameterkan.
    for (const key of SITES_ALLOWED_COLS) {
      if (req.body[key] !== undefined) {
        if (key === 'wordpress_app_password') {
          updates.push(`wordpress_app_password_enc = $${idx++}`);
          values.push(encrypt(req.body[key]));
        } else {
          updates.push(`${key} = $${idx++}`);
          values.push(req.body[key]);
        }
      }
    }

    if (!updates.length) {
      return res.status(400).json({ success: false, error: { code: 'NO_UPDATES', message: 'No valid fields provided' } });
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);

    const { rows } = await query(
      `UPDATE sites SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, name, url, niche, status, updated_at`,
      values
    );
    if (!rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Site not found' } });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/v1/sites/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM sites WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Site not found' } });
    res.json({ success: true, data: { message: 'Site deleted' } });
  } catch (err) { next(err); }
});

// POST /api/v1/sites/:id/test
router.post('/:id/test', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM sites WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Site not found' } });

    const site = rows[0];
    if (!site.wordpress_api_url) {
      return res.status(400).json({ success: false, error: { code: 'NO_WP_URL', message: 'WordPress API URL not configured' } });
    }

    const password = site.wordpress_app_password_enc ? decrypt(site.wordpress_app_password_enc) : '';
    const credentials = Buffer.from(`${site.wordpress_username}:${password}`).toString('base64');

    const start = Date.now();
    const response = await axios.get(`${site.wordpress_api_url}/wp/v2/posts?per_page=1`, {
      headers: { Authorization: `Basic ${credentials}` },
      timeout: config.wpTimeout,
    });

    res.json({
      success: true,
      data: {
        connected: true,
        latencyMs: Date.now() - start,
        siteName: response.headers['x-wp-total'] !== undefined ? `WordPress (${response.headers['x-wp-total']} posts total)` : 'WordPress',
        status: response.status,
      },
    });
  } catch (err) {
    if (err.response) {
      return res.json({ success: false, data: { connected: false, statusCode: err.response.status, message: err.response.data?.message || err.message } });
    }
    next(err);
  }
});

module.exports = router;
