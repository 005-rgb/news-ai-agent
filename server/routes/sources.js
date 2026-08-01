'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');

const router = express.Router();

// GET /api/v1/sources
router.get('/', async (req, res, next) => {
  try {
    const { category, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = '';

    if (category) {
      params.push(category);
      where = 'WHERE $1 = ANY(categories)';
    }

    const { rows } = await query(
      `SELECT id, name, url, rss_url, type, categories, credibility_score,
              is_active, fetch_interval_minutes, last_fetched_at, css_selectors, metadata, created_at
       FROM sources ${where}
       ORDER BY credibility_score DESC, name ASC
       LIMIT ${parseInt(limit)} OFFSET ${offset}`,
      params
    );

    const countRes = await query(
      `SELECT count(*) FROM sources ${where}`, params
    );

    res.json({
      success: true,
      data: rows,
      pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(countRes.rows[0].count) },
    });
  } catch (err) { next(err); }
});

// POST /api/v1/sources
router.post('/', async (req, res, next) => {
  try {
    const { name, url, rss_url, type, categories, credibility_score, fetch_interval_minutes, css_selectors } = req.body;
    if (!name || !url) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'name and url are required' } });
    }
    const { rows } = await query(
      `INSERT INTO sources (id, name, url, rss_url, type, categories, credibility_score, fetch_interval_minutes, css_selectors)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [uuidv4(), name, url, rss_url || null, type || 'rss',
       categories || [], credibility_score || 5.0,
       fetch_interval_minutes || 30, css_selectors || {}]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// PATCH /api/v1/sources/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const allowed = ['name','url','rss_url','type','categories','credibility_score',
                     'is_active','fetch_interval_minutes','css_selectors','metadata'];
    const updates = [];
    const values = [];
    let idx = 1;

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = $${idx++}`);
        values.push(req.body[key]);
      }
    }

    if (!updates.length) return res.status(400).json({ success: false, error: { code: 'NO_UPDATES', message: 'No valid fields' } });

    values.push(req.params.id);
    const { rows } = await query(
      `UPDATE sources SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Source not found' } });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/v1/sources/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM sources WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Source not found' } });
    res.json({ success: true, data: { message: 'Source deleted' } });
  } catch (err) { next(err); }
});

// PATCH /api/v1/sources/:id/toggle
router.patch('/:id/toggle', async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE sources SET is_active = NOT is_active WHERE id = $1 RETURNING id, name, is_active`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Source not found' } });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// POST /api/v1/sources/:id/test — real fetch test
router.post('/:id/test', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM sources WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Source not found' } });

    const source = rows[0];
    const start = Date.now();
    let items = [];

    if (source.type === 'rss' && source.rss_url) {
      const rssFetcher = require('../services/fetchers/rss');
      items = await rssFetcher.fetchRSS(source.rss_url, { timeout: 15000 });
    } else if (source.type === 'api') {
      // Real HTTP GET test for API-type sources
      const axios = require('axios');
      const resp = await axios.get(source.url, {
        timeout: 15000,
        headers: { 'User-Agent': 'NewsAIAgent/1.0' },
        validateStatus: null,
      });
      const statusOk = resp.status >= 200 && resp.status < 300;
      const body = resp.data;
      // Try to extract items from common API shapes: { articles }, { results }, { data }, { items }
      const raw = body?.articles || body?.results || body?.data || body?.items || (Array.isArray(body) ? body : null);
      if (Array.isArray(raw)) {
        items = raw.slice(0, 5).map((r, i) => ({
          title: r.title || r.name || r.headline || `Item ${i + 1}`,
          link:  r.url   || r.link  || r.web_url  || source.url,
        }));
      } else {
        items = [{ title: `API responded ${resp.status} — ${statusOk ? 'OK' : 'Error'}`, link: source.url }];
      }
    } else {
      const scraper = require('../services/fetchers/scraper');
      items = await scraper.scrapeSource(source.url, source.css_selectors || {});
    }

    const elapsed = Date.now() - start;
    await query('UPDATE sources SET last_fetched_at = NOW() WHERE id = $1', [source.id]);

    res.json({
      success: true,
      data: {
        source: source.name,
        fetchedAt: new Date().toISOString(),
        latencyMs: elapsed,
        itemCount: items.length,
        items: items.slice(0, 5),
      },
    });
  } catch (err) {
    res.json({ success: false, data: { error: err.message } });
  }
});

module.exports = router;
