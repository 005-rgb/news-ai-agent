'use strict';

const express = require('express');
const { query } = require('../db');

const router = express.Router();

// GET /api/v1/analytics/overview
router.get('/overview', async (req, res, next) => {
  try {
    const [articlesRes, queueRes, keysRes, alertsRes] = await Promise.all([
      query(`SELECT count(*) FROM articles WHERE DATE(published_at) = CURRENT_DATE`),
      query(`SELECT count(*) FROM job_queue WHERE status IN ('pending','processing')`),
      query(`SELECT count(*) FROM api_keys WHERE status = 'active'`),
      query(`SELECT count(*) FROM system_logs WHERE level IN ('warn','error','critical') AND created_at > NOW() - INTERVAL '24 hours'`),
    ]);

    res.json({
      success: true,
      data: {
        articlesPublishedToday: parseInt(articlesRes.rows[0].count),
        jobsInQueue:            parseInt(queueRes.rows[0].count),
        activeApiKeys:          parseInt(keysRes.rows[0].count),
        activeAlerts:           parseInt(alertsRes.rows[0].count),
      },
    });
  } catch (err) { next(err); }
});

// GET /api/v1/analytics/production — articles per day for 7 days
router.get('/production', async (req, res, next) => {
  try {
    const { site_id, days = 7 } = req.query;
    const params = [parseInt(days)];
    let siteFilter = '';
    if (site_id) { siteFilter = 'AND site_id = $2'; params.push(site_id); }

    const { rows } = await query(
      `SELECT DATE(published_at) AS date, count(*) AS count
       FROM articles
       WHERE published_at > NOW() - ($1 || ' days')::INTERVAL
         ${siteFilter}
       GROUP BY 1 ORDER BY 1`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /api/v1/analytics/pipeline — funnel counts
router.get('/pipeline', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT status, count(*) AS count
       FROM articles
       WHERE status IN ('researching','writing','editing','qc','imaging','seo','scheduled','published','failed')
       GROUP BY status`
    );
    const result = {};
    for (const r of rows) result[r.status] = parseInt(r.count);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// GET /api/v1/analytics/providers — provider performance
router.get('/providers', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT provider_used AS provider,
              count(*) AS articles_generated,
              ROUND(AVG(quality_score)::numeric, 1) AS avg_quality_score,
              ROUND(AVG(eeat_score)::numeric, 1) AS avg_eeat_score
       FROM articles
       WHERE provider_used IS NOT NULL
       GROUP BY provider_used
       ORDER BY avg_quality_score DESC NULLS LAST`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /api/v1/analytics/logs — system logs with filters
router.get('/logs', async (req, res, next) => {
  try {
    const { level, agent, from, to, search, page = 1, limit = 50 } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (level)  { conditions.push(`level = ANY($${idx++})`); params.push(level.split(',')); }
    if (agent)  { conditions.push(`agent ILIKE $${idx++}`); params.push(`%${agent}%`); }
    if (from)   { conditions.push(`created_at >= $${idx++}`); params.push(from); }
    if (to)     { conditions.push(`created_at <= $${idx++}`); params.push(to); }
    if (search) { conditions.push(`message ILIKE $${idx++}`); params.push(`%${search}%`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { rows } = await query(
      `SELECT * FROM system_logs ${where}
       ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, parseInt(limit), offset]
    );
    const countRes = await query(`SELECT count(*) FROM system_logs ${where}`, params);
    res.json({ success: true, data: rows, pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(countRes.rows[0].count) } });
  } catch (err) { next(err); }
});

// GET /api/v1/analytics/activity — recent activity feed
router.get('/activity', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 20`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

module.exports = router;
