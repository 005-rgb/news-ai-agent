'use strict';

/**
 * Scheduler API Routes — Phase 6
 *
 * GET  /api/v1/scheduler/status        — status semua site (next run, last run, dll)
 * GET  /api/v1/scheduler/next-runs     — daftar scheduled run berikutnya
 * POST /api/v1/scheduler/trigger/:id   — manual trigger pipeline untuk 1 site
 * POST /api/v1/scheduler/reload        — reload semua site crons dari DB
 * GET  /api/v1/scheduler/config/:id    — lihat posting_schedule config 1 site
 * PATCH /api/v1/scheduler/config/:id   — update posting_schedule config 1 site
 */

const express    = require('express');
const { query }  = require('../db');
const logger     = require('../utils/logger');

const router = express.Router();

// ── GET /api/v1/scheduler/status ─────────────────────────────────────────────
router.get('/status', async (req, res, next) => {
  try {
    const scheduler = require('../services/scheduler');
    const statusList = scheduler.getStatus();

    // Enrich dengan nama site dari DB
    const { rows: sites } = await query(
      `SELECT id, name, status FROM sites WHERE status = 'active'`
    );
    const siteMap = Object.fromEntries(sites.map((s) => [s.id, s]));

    const enriched = statusList.map((entry) => ({
      ...entry,
      siteName: entry.siteName || (siteMap[entry.siteId] && siteMap[entry.siteId].name) || entry.siteId,
    }));

    // Tambahkan site aktif yang belum terdaftar (belum ada di status)
    const registeredIds = new Set(enriched.map((e) => e.siteId));
    for (const site of sites) {
      if (!registeredIds.has(site.id)) {
        enriched.push({
          siteId:     site.id,
          siteName:   site.name,
          nextRun:    null,
          lastRun:    null,
          lastStatus: 'not_scheduled',
        });
      }
    }

    res.json({ success: true, data: enriched });
  } catch (err) { next(err); }
});

// ── GET /api/v1/scheduler/next-runs ──────────────────────────────────────────
router.get('/next-runs', async (req, res, next) => {
  try {
    const scheduler = require('../services/scheduler');
    const statusList = scheduler.getStatus();

    const nextRuns = statusList
      .filter((s) => s.nextRun)
      .map((s) => ({
        siteId:   s.siteId,
        siteName: s.siteName,
        nextRun:  s.nextRun,
        times:    s.times || [],
      }))
      .sort((a, b) => new Date(a.nextRun) - new Date(b.nextRun));

    res.json({ success: true, data: nextRuns });
  } catch (err) { next(err); }
});

// ── POST /api/v1/scheduler/trigger/:id ───────────────────────────────────────
router.post('/trigger/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verifikasi site ada
    const { rows } = await query(
      `SELECT id, name FROM sites WHERE id = $1`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Site not found' },
      });
    }

    await logger.info('Scheduler', `Manual trigger requested for site "${rows[0].name}"`, {
      siteId: id, triggeredBy: 'api',
    });

    const scheduler = require('../services/scheduler');

    // Fire-and-forget: tidak blokir response
    scheduler.triggerSiteNow(id).catch((err) => {
      logger.error('Scheduler', `Manual trigger failed for site ${id}: ${err.message}`, { siteId: id });
    });

    res.json({
      success: true,
      data: {
        message: `Pipeline triggered for site "${rows[0].name}". Check queue for progress.`,
        siteId: id,
        siteName: rows[0].name,
      },
    });
  } catch (err) { next(err); }
});

// ── POST /api/v1/scheduler/reload ────────────────────────────────────────────
router.post('/reload', async (req, res, next) => {
  try {
    const scheduler = require('../services/scheduler');
    const count = await scheduler.reloadSiteCrons();

    res.json({
      success: true,
      data: { message: `Scheduler reloaded: ${count} active sites registered`, siteCount: count },
    });
  } catch (err) { next(err); }
});

// ── GET /api/v1/scheduler/config/:id ─────────────────────────────────────────
router.get('/config/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, categories, config FROM sites WHERE id = $1`,
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Site not found' } });
    }

    const site = rows[0];
    const schedule = (site.config || {}).posting_schedule || {};

    const scheduler = require('../services/scheduler');
    const defaults = scheduler.getDefaultTimesForCategories(site.categories);

    res.json({
      success: true,
      data: {
        siteId: site.id,
        siteName: site.name,
        posting_schedule: {
          enabled:           schedule.enabled !== false,
          times:             schedule.times || defaults,
          use_smart_timing:  schedule.use_smart_timing !== false,
          default_category:  schedule.default_category || (site.categories && site.categories[0]) || 'umum',
          default_format:    schedule.default_format || 'berita_singkat',
        },
        defaults: {
          times: defaults,
          category_slots: scheduler.CATEGORY_TIME_SLOTS,
        },
      },
    });
  } catch (err) { next(err); }
});

// ── PATCH /api/v1/scheduler/config/:id ───────────────────────────────────────
router.patch('/config/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { enabled, times, use_smart_timing, default_category, default_format } = req.body;

    // Validasi times: array of "HH:MM"
    if (times !== undefined) {
      if (!Array.isArray(times) || times.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_TIMES', message: 'times must be a non-empty array of "HH:MM" strings' },
        });
      }
      const timePattern = /^\d{2}:\d{2}$/;
      for (const t of times) {
        if (!timePattern.test(t)) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_TIME_FORMAT', message: `Invalid time format: "${t}". Use HH:MM (e.g. "07:00")` },
          });
        }
        const [h, m] = t.split(':').map(Number);
        if (h < 0 || h > 23 || m < 0 || m > 59) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_TIME_VALUE', message: `Time out of range: "${t}"` },
          });
        }
      }
    }

    // Ambil config lama
    const { rows } = await query(`SELECT id, config FROM sites WHERE id = $1`, [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Site not found' } });
    }

    const currentConfig = rows[0].config || {};
    const currentSchedule = currentConfig.posting_schedule || {};

    const updatedSchedule = {
      ...currentSchedule,
      ...(enabled           !== undefined && { enabled }),
      ...(times             !== undefined && { times }),
      ...(use_smart_timing  !== undefined && { use_smart_timing }),
      ...(default_category  !== undefined && { default_category }),
      ...(default_format    !== undefined && { default_format }),
    };

    const updatedConfig = { ...currentConfig, posting_schedule: updatedSchedule };

    await query(
      `UPDATE sites SET config = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(updatedConfig), id]
    );

    // Reload cron untuk site ini saja
    const { rows: siteRows } = await query(
      `SELECT id, name, categories, config FROM sites WHERE id = $1`,
      [id]
    );

    // Dynamically update this site's crons
    const scheduler = require('../services/scheduler');
    await scheduler.reloadSiteCrons(); // reload semua (simpel & aman)

    await logger.info('Scheduler', `Posting schedule updated for site ${id}`, { siteId: id, updatedSchedule });

    res.json({
      success: true,
      data: {
        siteId: id,
        posting_schedule: updatedSchedule,
        message: 'Schedule updated and crons reloaded',
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
