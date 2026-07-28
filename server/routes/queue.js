'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');

const router = express.Router();

// GET /api/v1/queue — all active jobs with pipeline counts
router.get('/', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (status) {
      const statuses = status.split(',');
      conditions.push(`j.status = ANY($${idx++})`);
      params.push(statuses);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { rows } = await query(
      `SELECT j.id, j.job_type, j.status, j.priority, j.attempts, j.max_attempts,
              j.error_message, j.scheduled_at, j.started_at, j.finished_at, j.created_at,
              a.title AS article_title, a.site_id, s.name AS site_name
       FROM job_queue j
       LEFT JOIN articles a ON a.id = j.article_id
       LEFT JOIN sites s ON s.id = a.site_id
       ${where}
       ORDER BY j.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, parseInt(limit), offset]
    );

    // Pipeline stage counts
    const stageRes = await query(
      `SELECT status, count(*) FROM articles
       WHERE status IN ('researching','writing','editing','qc','imaging','seo','scheduled')
       GROUP BY status`
    );
    const stages = {};
    for (const r of stageRes.rows) stages[r.status] = parseInt(r.count);

    const countRes = await query(`SELECT count(*) FROM job_queue j ${where}`, params);

    res.json({
      success: true,
      data: rows,
      stages,
      pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(countRes.rows[0].count) },
    });
  } catch (err) { next(err); }
});

// GET /api/v1/queue/dead — dead letter queue
router.get('/dead', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT j.*, a.title AS article_title, s.name AS site_name
       FROM job_queue j
       LEFT JOIN articles a ON a.id = j.article_id
       LEFT JOIN sites s ON s.id = a.site_id
       WHERE j.status = 'dead'
       ORDER BY j.created_at DESC LIMIT 100`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// POST /api/v1/queue/dead/:id/retry — manual retry of dead job
router.post('/dead/:id/retry', async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE job_queue SET status = 'pending', attempts = 0, error_message = NULL
       WHERE id = $1 AND status = 'dead'
       RETURNING id, job_type, status`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Dead job not found' } });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/v1/queue/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM job_queue WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Job not found' } });
    res.json({ success: true, data: { message: 'Job deleted' } });
  } catch (err) { next(err); }
});

// POST /api/v1/queue/run — force run pipeline for a topic
router.post('/run', async (req, res, next) => {
  try {
    const { topic, site_id, category, format } = req.body;
    if (!topic || !site_id) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'topic and site_id are required' } });
    }

    // Create article record
    const articleId = uuidv4();
    await query(
      `INSERT INTO articles (id, site_id, title, status, format, category, created_at)
       VALUES ($1,$2,$3,'researching',$4,$5,NOW())`,
      [articleId, site_id, topic, format || 'berita_singkat', category || 'umum']
    );

    // Enqueue research job
    await query(
      `INSERT INTO job_queue (id, article_id, job_type, status, priority, payload, scheduled_at)
       VALUES ($1,$2,'RESEARCH','pending','high',$3,NOW())`,
      [uuidv4(), articleId, JSON.stringify({ topic, site_id, category, format })]
    );

    res.status(201).json({ success: true, data: { articleId, message: 'Pipeline started' } });
  } catch (err) { next(err); }
});

module.exports = router;
