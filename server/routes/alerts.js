'use strict';

/**
 * Phase 11.2 — Alert Routes
 *
 * GET    /api/v1/alerts           — list alert aktif (+ opsional resolved)
 * GET    /api/v1/alerts/count     — quick count untuk overview
 * PATCH  /api/v1/alerts/:id/resolve
 * POST   /api/v1/alerts/resolve-all
 * POST   /api/v1/alerts/scan      — trigger manual scan
 */

const express = require('express');
const alertService = require('../services/alertService');

const router = express.Router();

// GET /api/v1/alerts
router.get('/', async (req, res, next) => {
  try {
    const {
      include_resolved = 'false',
      limit = 100,
      offset = 0,
    } = req.query;

    const { rows, total } = await alertService.getAllAlerts({
      includeResolved: include_resolved === 'true',
      limit: Math.min(parseInt(limit) || 100, 500),
      offset: parseInt(offset) || 0,
    });

    res.json({ success: true, data: rows, total });
  } catch (err) { next(err); }
});

// GET /api/v1/alerts/count — lightweight count untuk polling
router.get('/count', async (req, res, next) => {
  try {
    const count = await alertService.getAlertCount();
    res.json({ success: true, data: { count } });
  } catch (err) { next(err); }
});

// PATCH /api/v1/alerts/:id/resolve
router.patch('/:id/resolve', async (req, res, next) => {
  try {
    const alert = await alertService.resolveAlert(req.params.id);
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Alert tidak ditemukan atau sudah di-resolve.' },
      });
    }
    res.json({ success: true, data: alert });
  } catch (err) { next(err); }
});

// POST /api/v1/alerts/resolve-all
router.post('/resolve-all', async (req, res, next) => {
  try {
    await alertService.resolveAll();
    res.json({ success: true, data: { message: 'Semua alert aktif berhasil di-resolve.' } });
  } catch (err) { next(err); }
});

// POST /api/v1/alerts/scan — trigger manual alert scan
router.post('/scan', async (req, res, next) => {
  try {
    await alertService.runAlertScan();
    const count = await alertService.getAlertCount();
    res.json({ success: true, data: { message: 'Alert scan selesai.', activeAlerts: count } });
  } catch (err) { next(err); }
});

module.exports = router;
