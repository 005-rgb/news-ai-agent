'use strict';

/**
 * Rapat Redaksi Routes — Phase 7 (CRUD) + Phase 9 (full engine)
 *
 * GET  /api/v1/rapat                  — list notulen archive
 * GET  /api/v1/rapat/latest           — notulen terbaru
 * GET  /api/v1/rapat/trends/predictions — trend predictions dari DB
 * GET  /api/v1/rapat/trends/refresh   — manual trigger trend fetch (POST)
 * GET  /api/v1/rapat/performance      — performance analysis (Phase 9 Step 9.4)
 * GET  /api/v1/rapat/competitor-gaps  — semua competitor gaps dari DB
 * POST /api/v1/rapat/competitor       — tambah competitor URL untuk site
 * POST /api/v1/rapat/trigger          — manual trigger rapat redaksi penuh
 * GET  /api/v1/rapat/:id              — detail satu rapat session
 */

const express = require('express');
const { query } = require('../db');

const router = express.Router();

// ── GET /api/v1/rapat — list notulen archive ──────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, session_date, summary, trend_data, performance_report, recommendations, created_at
       FROM rapat_notes ORDER BY session_date DESC LIMIT 12`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ── GET /api/v1/rapat/latest ──────────────────────────────────────────────────
router.get('/latest', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM rapat_notes ORDER BY session_date DESC LIMIT 1`
    );
    res.json({ success: true, data: rows[0] || null });
  } catch (err) { next(err); }
});

// ── GET /api/v1/rapat/trends/predictions ─────────────────────────────────────
router.get('/trends/predictions', async (req, res, next) => {
  try {
    const { category, limit = 20 } = req.query;
    let where = '';
    const params = [];
    if (category) {
      where = 'WHERE category = $1';
      params.push(category);
    }
    const { rows } = await query(
      `SELECT id, topic, category, confidence_score, predicted_peak_date,
              source_signals, status, created_at
       FROM trend_predictions
       ${where}
       ORDER BY confidence_score DESC NULLS LAST, created_at DESC
       LIMIT $${params.length + 1}`,
      [...params, Math.min(50, parseInt(limit) || 20)]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ── POST /api/v1/rapat/trends/refresh — manual trend fetch ───────────────────
router.post('/trends/refresh', async (req, res, next) => {
  try {
    const { refreshTrends } = require('../services/trendFetcher');
    const result = await refreshTrends();
    res.json({
      success: true,
      data: {
        message: `Trend refresh selesai: ${result.fetched} sinyal diambil, ${result.stored} disimpan`,
        fetched: result.fetched,
        stored:  result.stored,
        error:   result.error || null,
      },
    });
  } catch (err) { next(err); }
});

// ── GET /api/v1/rapat/performance — Phase 9 Step 9.4 performance analysis ────
router.get('/performance', async (req, res, next) => {
  try {
    const { days = 7 } = req.query;
    const AnalystAgent = require('../agents/analyst');
    const analyst      = new AnalystAgent();
    const report       = await analyst.analyzePerformance({ days: parseInt(days) || 7 });
    res.json({ success: true, data: report });
  } catch (err) { next(err); }
});

// ── GET /api/v1/rapat/competitor-gaps — all competitor gaps ──────────────────
router.get('/competitor-gaps', async (req, res, next) => {
  try {
    const { site_id } = req.query;
    const { getAllGaps, getGapsForSite } = require('../services/competitorScanner');
    const data = site_id ? await getGapsForSite(site_id) : await getAllGaps();
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ── POST /api/v1/rapat/competitor — register competitor for a site ─────────────
router.post('/competitor', async (req, res, next) => {
  try {
    const { site_id, competitor_url } = req.body;
    if (!site_id || !competitor_url) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'site_id dan competitor_url wajib diisi' },
      });
    }
    const { addCompetitor } = require('../services/competitorScanner');
    const row = await addCompetitor(site_id, competitor_url);
    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
});

// ── POST /api/v1/rapat/competitor/:id (DELETE competitor) ────────────────────
router.delete('/competitor/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query(
      'DELETE FROM competitor_data WHERE id = $1', [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Competitor not found' } });
    res.json({ success: true, data: { message: 'Deleted' } });
  } catch (err) { next(err); }
});

// ── POST /api/v1/rapat/trigger — manual trigger rapat redaksi ─────────────────
router.post('/trigger', async (req, res, next) => {
  try {
    const ChiefEditorAgent = require('../agents/chiefEditor');
    const chief            = new ChiefEditorAgent();

    // Run full Phase 9 rapat asynchronously and return session info
    const result = await chief.runRapat();

    res.json({
      success: true,
      data: {
        message:     `Rapat Redaksi selesai: ${result.calendarItemsCreated} topik dijadwalkan untuk ${result.sitesProcessed} site`,
        sessionId:   result.sessionId,
        today:       result.today,
        sites:       result.sitesProcessed,
        calendar:    result.calendarItemsCreated,
        trends:      result.trendsIdentified,
        recommendations: result.recommendations || [],
        note:        'Lihat tab Notulen untuk laporan lengkap.',
      },
    });
  } catch (err) {
    // If runRapat fails hard, still return informative error
    next(err);
  }
});

// ── GET /api/v1/rapat/:id — detail satu rapat session ────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM rapat_notes WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Rapat session not found' } });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
