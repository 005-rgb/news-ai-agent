'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');

const router = express.Router();

// ── UUID validator — C-6 Fix ──────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(v) { return UUID_RE.test(v); }

// GET /api/v1/articles
router.get('/', async (req, res, next) => {
  try {
    const { site_id, status, format, category, from, to, sort = 'created_at', page = 1, limit = 20, human_review } = req.query;
    // C-6 Fix: Validasi site_id sebagai UUID sebelum digunakan sebagai parameter SQL
    if (site_id && !isValidUUID(site_id)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_SITE_ID', message: 'site_id harus berformat UUID yang valid' } });
    }
    const params = [];
    const conditions = [];
    let idx = 1;

    if (site_id) { conditions.push(`a.site_id = $${idx++}`); params.push(site_id); }
    if (human_review === 'true') {
      // Human review queue: articles that are ready to publish or scheduled but haven't been published
      conditions.push(`(a.needs_human_review = true OR a.status IN ('ready_to_publish','scheduled'))`);
    } else if (status) {
      const statuses = status.split(',');
      conditions.push(`a.status = ANY($${idx++})`); params.push(statuses);
    }
    if (format)   { conditions.push(`a.format = $${idx++}`);   params.push(format); }
    if (category) { conditions.push(`a.category = $${idx++}`); params.push(category); }
    if (from)     { conditions.push(`a.created_at >= $${idx++}`); params.push(from); }
    if (to)       { conditions.push(`a.created_at <= $${idx++}`); params.push(to); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const validSorts = { created_at: 'a.created_at', published_at: 'a.published_at', quality_score: 'a.quality_score', eeat_score: 'a.eeat_score' };
    const orderCol = validSorts[sort] || 'a.created_at';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { rows } = await query(
      `SELECT a.id, a.site_id, s.name AS site_name, a.title, a.status, a.format,
              a.category, a.quality_score, a.eeat_score, a.provider_used,
              a.scheduled_at, a.published_at, a.wordpress_url, a.created_at,
              a.needs_human_review, a.human_review_notes
       FROM articles a
       LEFT JOIN sites s ON s.id = a.site_id
       ${where}
       ORDER BY ${orderCol} DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, parseInt(limit), offset]
    );

    const countRes = await query(`SELECT count(*) FROM articles a ${where}`, params);
    res.json({ success: true, data: rows, pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(countRes.rows[0].count) } });
  } catch (err) { next(err); }
});

// GET /api/v1/articles/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT a.*, s.name AS site_name FROM articles a LEFT JOIN sites s ON s.id = a.site_id WHERE a.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Article not found' } });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/v1/articles/:id
router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.body || req.body.confirm !== true) {
      return res.status(400).json({ success: false, error: { code: 'CONFIRM_REQUIRED', message: 'Send { confirm: true }' } });
    }
    const { rowCount } = await query('DELETE FROM articles WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Article not found' } });
    res.json({ success: true, data: { message: 'Article deleted' } });
  } catch (err) { next(err); }
});

// POST /api/v1/articles/:id/force-publish
router.post('/:id/force-publish', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM articles WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Article not found' } });
    // Enqueue PUBLISH job immediately
    const { v4 } = require('uuid');
    await query(
      `INSERT INTO job_queue (id, article_id, job_type, status, priority, payload, scheduled_at)
       VALUES ($1, $2, 'PUBLISH', 'pending', 'high', $3, NOW())`,
      [uuidv4(), req.params.id, JSON.stringify({ forced: true })]
    );
    res.json({ success: true, data: { message: 'Force publish job queued' } });
  } catch (err) { next(err); }
});

// POST /api/v1/articles/:id/regenerate
router.post('/:id/regenerate', async (req, res, next) => {
  try {
    const { from_step } = req.body;
    const validSteps = ['RESEARCH','WRITE','EDIT','QC','IMAGE','SEO'];
    if (!from_step || !validSteps.includes(from_step)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_STEP', message: `from_step must be one of: ${validSteps.join(', ')}` } });
    }
    const { triggerStep } = require('../services/pipeline');
    const job = await triggerStep(req.params.id, from_step);
    res.json({ success: true, data: { message: `Regeneration from ${from_step} queued`, jobId: job.id } });
  } catch (err) { next(err); }
});

// POST /api/v1/articles/:id/approve — approve article for human review (enqueue PUBLISH)
router.post('/:id/approve', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM articles WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Article not found' } });
    const art = rows[0];
    // Clear human review flag, update status to scheduled, enqueue PUBLISH
    await query(
      `UPDATE articles SET needs_human_review = false, human_review_notes = NULL,
       status = 'scheduled', scheduled_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    await query(
      `INSERT INTO job_queue (id, article_id, job_type, status, priority, payload, scheduled_at)
       VALUES ($1, $2, 'PUBLISH', 'pending', 'high', $3, NOW())`,
      [uuidv4(), req.params.id, JSON.stringify({ human_approved: true })]
    );
    res.json({ success: true, data: { message: 'Article approved and queued for publishing' } });
  } catch (err) { next(err); }
});

// POST /api/v1/articles/:id/reject — reject article (move back to draft with notes)
router.post('/:id/reject', async (req, res, next) => {
  try {
    const { notes } = req.body;
    const { rowCount } = await query(
      `UPDATE articles SET status = 'draft', needs_human_review = false,
       human_review_notes = $2 WHERE id = $1`,
      [req.params.id, notes || 'Ditolak oleh editor']
    );
    if (!rowCount) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Article not found' } });
    res.json({ success: true, data: { message: 'Article rejected and moved to draft' } });
  } catch (err) { next(err); }
});

// PATCH /api/v1/articles/:id/flag-review — flag article as needing human review
router.patch('/:id/flag-review', async (req, res, next) => {
  try {
    const { needs_review, notes } = req.body;
    const { rowCount } = await query(
      `UPDATE articles SET needs_human_review = $2, human_review_notes = $3 WHERE id = $1`,
      [req.params.id, needs_review !== false, notes || null]
    );
    if (!rowCount) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Article not found' } });
    res.json({ success: true, data: { message: 'Article review flag updated' } });
  } catch (err) { next(err); }
});

// POST /api/v1/articles/:id/move-to-draft — move published article back to draft in WordPress
router.post('/:id/move-to-draft', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM articles WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Article not found' } });
    const art = rows[0];
    // If article has WP post id, try to set status=draft in WordPress
    if (art.wordpress_post_id && art.site_id) {
      try {
        const siteRes = await query('SELECT * FROM sites WHERE id = $1', [art.site_id]);
        if (siteRes.rows.length && siteRes.rows[0].wordpress_api_url && siteRes.rows[0].wordpress_username) {
          const encryption = require('../utils/encryption');
          let wpPass = siteRes.rows[0].wordpress_app_password_enc;
          if (wpPass) { try { wpPass = encryption.decrypt(wpPass); } catch { wpPass = null; } }
          if (wpPass) {
            const axios = require('axios');
            const auth = Buffer.from(`${siteRes.rows[0].wordpress_username}:${wpPass}`).toString('base64');
            await axios.post(
              `${siteRes.rows[0].wordpress_api_url}/posts/${art.wordpress_post_id}`,
              { status: 'draft' },
              { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' }, timeout: 30000 }
            );
          }
        }
      } catch (wpErr) {
        // Log but don't block — DB update still happens
        await query(
          `INSERT INTO system_logs (id, level, agent, message, metadata) VALUES (gen_random_uuid(), 'warn', 'PublisherAgent', $1, $2)`,
          [`WordPress move-to-draft failed: ${wpErr.message}`, JSON.stringify({ articleId: art.id, error: wpErr.message })]
        );
      }
    }
    await query(`UPDATE articles SET status = 'draft' WHERE id = $1`, [req.params.id]);
    res.json({ success: true, data: { message: 'Article moved to draft' } });
  } catch (err) { next(err); }
});

// GET /api/v1/articles/:id/logs — pipeline timeline logs for an article
router.get('/:id/logs', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, level, agent, message, metadata, created_at
       FROM system_logs
       WHERE metadata->>'articleId' = $1 OR metadata->>'article_id' = $1
       ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

module.exports = router;
