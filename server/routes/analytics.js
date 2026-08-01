'use strict';

const express = require('express');
const { query } = require('../db');
const { cacheMiddleware } = require('../utils/cache');

const router = express.Router();

// TTL constants
const TTL_30S  = 30  * 1000;
const TTL_1MIN = 60  * 1000;
const TTL_5MIN = 5   * 60 * 1000;
const TTL_15MIN= 15  * 60 * 1000;

// GET /api/v1/analytics/overview
router.get('/overview', cacheMiddleware(TTL_30S), async (req, res, next) => {
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
router.get('/production', cacheMiddleware(TTL_1MIN, req => `route:production:${req.query.days || 7}:${req.query.site_id || ''}`), async (req, res, next) => {
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
router.get('/pipeline', cacheMiddleware(TTL_30S), async (req, res, next) => {
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
router.get('/providers', cacheMiddleware(TTL_5MIN), async (req, res, next) => {
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

// GET /api/v1/analytics/eeat-weekly — avg E-E-A-T and quality score per week (last 8 weeks)
router.get('/eeat-weekly', cacheMiddleware(TTL_5MIN), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT
         DATE_TRUNC('week', published_at)::date            AS week_start,
         ROUND(AVG(eeat_score)::numeric, 1)                AS avg_eeat,
         ROUND(AVG(quality_score)::numeric, 1)             AS avg_quality,
         COUNT(*)                                          AS article_count
       FROM articles
       WHERE published_at > NOW() - INTERVAL '8 weeks'
         AND eeat_score IS NOT NULL
       GROUP BY 1
       ORDER BY 1`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /api/v1/analytics/prompts — prompt evolution table
router.get('/prompts', cacheMiddleware(TTL_5MIN), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT
         pv.id, pv.name, pv.agent_type, pv.category, pv.format_key,
         pv.is_champion, pv.is_active, pv.status,
         pv.performance_score, pv.sample_count,
         pv.created_at,
         ROUND(AVG(a.quality_score)::numeric, 1) AS avg_quality,
         ROUND(AVG(a.eeat_score)::numeric, 1)    AS avg_eeat,
         COUNT(a.id)                              AS real_sample_count
       FROM prompt_versions pv
       LEFT JOIN articles a ON a.prompt_version = pv.name
       GROUP BY pv.id
       ORDER BY pv.is_champion DESC, avg_quality DESC NULLS LAST, pv.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /api/v1/analytics/evergreen — evergreen article candidates
router.get('/evergreen', cacheMiddleware(TTL_15MIN), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT a.id, a.title, a.format, a.category, a.quality_score, a.eeat_score,
              a.published_at, a.wordpress_url, s.name AS site_name,
              a.is_evergreen_candidate,
              EXTRACT(DAY FROM NOW() - a.published_at)::int AS days_since_publish
       FROM articles a
       LEFT JOIN sites s ON s.id = a.site_id
       WHERE a.status = 'published'
         AND a.published_at < NOW() - INTERVAL '30 days'
         AND a.format IN ('evergreen','feature_opini','jurnal_review')
       ORDER BY a.eeat_score DESC NULLS LAST, a.quality_score DESC NULLS LAST
       LIMIT 30`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /api/v1/analytics/key-usage — API key daily usage per provider (last 14 days)
router.get('/key-usage', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT
         DATE(created_at)            AS date,
         provider,
         SUM(usage_today)            AS total_usage,
         COUNT(*)                    AS key_count,
         SUM(daily_limit)            AS total_limit
       FROM (
         SELECT
           NOW() AS created_at,
           provider,
           usage_today,
           daily_limit
         FROM api_keys
         WHERE provider != '_config'
       ) sub
       GROUP BY DATE(created_at), provider
       ORDER BY date DESC, provider`
    );

    // Also fetch historical from usage_stats if available
    const { rows: histRows } = await query(
      `SELECT
         us.date,
         ak.provider,
         SUM(us.tokens_used)    AS total_usage,
         SUM(us.articles_generated) AS articles
       FROM usage_stats us
       JOIN api_keys ak ON ak.id = us.api_key_id
       WHERE us.date > NOW() - INTERVAL '14 days'
         AND ak.provider != '_config'
       GROUP BY us.date, ak.provider
       ORDER BY us.date DESC, ak.provider`
    );

    res.json({ success: true, data: rows, history: histRows });
  } catch (err) { next(err); }
});

// GET /api/v1/analytics/error-rate — failed jobs per pipeline type (last 7 days)
router.get('/error-rate', cacheMiddleware(TTL_5MIN), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT
         job_type,
         COUNT(*) FILTER (WHERE status IN ('failed','dead'))  AS failed_count,
         COUNT(*) FILTER (WHERE status = 'done')              AS success_count,
         COUNT(*)                                             AS total_count,
         ROUND(
           100.0 * COUNT(*) FILTER (WHERE status IN ('failed','dead')) / NULLIF(COUNT(*), 0),
           1
         ) AS error_rate_pct
       FROM job_queue
       WHERE created_at > NOW() - INTERVAL '7 days'
       GROUP BY job_type
       ORDER BY failed_count DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 10 — Innovation Layer endpoints
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/v1/analytics/prompts/:id/promote — force-promote prompt ke champion
router.post('/prompts/:id/promote', async (req, res, next) => {
  try {
    const { adminPromote } = require('../services/promptEvolution');
    const result = await adminPromote(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

// POST /api/v1/analytics/prompts/:id/deprecate — force-deprecate prompt
router.post('/prompts/:id/deprecate', async (req, res, next) => {
  try {
    const { adminDeprecate } = require('../services/promptEvolution');
    const result = await adminDeprecate(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

// POST /api/v1/analytics/prompts/:id/experimental — set prompt as experimental (A/B test)
router.post('/prompts/:id/experimental', async (req, res, next) => {
  try {
    const { adminSetExperimental } = require('../services/promptEvolution');
    const result = await adminSetExperimental(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

// POST /api/v1/analytics/prompt-evolution/run — trigger manual evaluation
router.post('/prompt-evolution/run', async (req, res, next) => {
  try {
    const { runWeeklyEvaluation } = require('../services/promptEvolution');
    const result = await runWeeklyEvaluation();
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

// GET /api/v1/analytics/link-network — Link Intelligence stats
router.get('/link-network', async (req, res, next) => {
  try {
    const { getLinkNetworkStats, getTopLinkedArticles } = require('../services/linkIntelligence');
    const [stats, topArticles] = await Promise.all([
      getLinkNetworkStats(),
      getTopLinkedArticles(10),
    ]);
    res.json({ success: true, stats, topArticles });
  } catch (err) { next(err); }
});

// GET /api/v1/analytics/smart-timing — Smart Timing Learner summary
router.get('/smart-timing', async (req, res, next) => {
  try {
    const { getSmartTimingSummary } = require('../services/smartTimingLearner');
    const data = await getSmartTimingSummary();
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// POST /api/v1/analytics/smart-timing/run — trigger manual smart timing analysis
router.post('/smart-timing/run', async (req, res, next) => {
  try {
    const { runTimingAnalysis } = require('../services/smartTimingLearner');
    const result = await runTimingAnalysis();
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

// GET /api/v1/analytics/persona/:siteId — baca persona memory site tertentu
router.get('/persona/:siteId', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, persona_memory, persona_description, updated_at FROM sites WHERE id = $1`,
      [req.params.siteId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Site tidak ditemukan' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// GET /api/v1/analytics/evergreen-updates — riwayat evergreen updates yang sudah dijalankan
router.get('/evergreen-updates', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT a.id, a.title, a.wordpress_url, a.last_updated_at, a.format,
              s.name AS site_name,
              (a.content_versions->>'evergreenUpdate')::jsonb AS update_info
       FROM articles a
       LEFT JOIN sites s ON s.id = a.site_id
       WHERE a.content_versions ? 'evergreenUpdate'
         AND a.status = 'published'
       ORDER BY a.last_updated_at DESC
       LIMIT 30`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

module.exports = router;
