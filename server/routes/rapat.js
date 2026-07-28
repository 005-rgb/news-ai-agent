'use strict';

const express = require('express');
const { query } = require('../db');

const router = express.Router();

// GET /api/v1/rapat — latest notes + archive
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, session_date, summary, trend_data, performance_report, recommendations, created_at
       FROM rapat_notes ORDER BY session_date DESC LIMIT 12`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /api/v1/rapat/latest
router.get('/latest', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM rapat_notes ORDER BY session_date DESC LIMIT 1`
    );
    if (!rows.length) return res.json({ success: true, data: null });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// GET /api/v1/rapat/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM rapat_notes WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Rapat session not found' } });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// GET /api/v1/rapat/trends/predictions
router.get('/trends/predictions', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM trend_predictions ORDER BY confidence_score DESC, created_at DESC LIMIT 20`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// POST /api/v1/rapat/trigger — manually trigger rapat redaksi
router.post('/trigger', async (req, res, next) => {
  try {
    // Stub: will be fully implemented in Phase 9
    // For now, return informative response
    res.json({
      success: true,
      data: {
        message: 'Rapat Redaksi trigger queued. This feature is fully implemented in Phase 9 (Rapat Redaksi Engine).',
        note: 'Complete Phases 1–8 first for full automated rapat functionality.',
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
