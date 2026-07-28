'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');

const router = express.Router();

// GET /api/v1/articles
router.get('/', async (req, res, next) => {
  try {
    const { site_id, status, format, category, from, to, sort = 'created_at', page = 1, limit = 20 } = req.query;
    const params = [];
    const conditions = [];
    let idx = 1;

    if (site_id) { conditions.push(`a.site_id = $${idx++}`); params.push(site_id); }
    if (status) {
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
              a.scheduled_at, a.published_at, a.wordpress_url, a.created_at
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

module.exports = router;
