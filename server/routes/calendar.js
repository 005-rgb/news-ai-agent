'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');

const router = express.Router();

// GET /api/v1/calendar
router.get('/', async (req, res, next) => {
  try {
    const { site_id, from, to, status } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (site_id) { conditions.push(`c.site_id = $${idx++}`); params.push(site_id); }
    if (status)  { conditions.push(`c.status = $${idx++}`);  params.push(status); }
    if (from)    { conditions.push(`c.scheduled_date >= $${idx++}`); params.push(from); }
    if (to)      { conditions.push(`c.scheduled_date <= $${idx++}`); params.push(to); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT c.*, s.name AS site_name
       FROM content_calendar c
       LEFT JOIN sites s ON s.id = c.site_id
       ${where}
       ORDER BY c.scheduled_date ASC, c.priority DESC`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// POST /api/v1/calendar
router.post('/', async (req, res, next) => {
  try {
    const { site_id, topic, category, format, priority, scheduled_date, notes } = req.body;
    if (!site_id || !topic) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'site_id and topic are required' } });
    }
    const { rows } = await query(
      `INSERT INTO content_calendar (id, site_id, topic, category, format, priority, scheduled_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [uuidv4(), site_id, topic, category || 'umum', format || 'berita_singkat',
       priority || 'normal', scheduled_date || null, notes || null]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// PATCH /api/v1/calendar/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const allowed = ['topic','category','format','priority','scheduled_date','status','notes'];
    const updates = [];
    const values = [];
    let idx = 1;

    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        updates.push(`${k} = $${idx++}`);
        values.push(req.body[k]);
      }
    }
    if (!updates.length) return res.status(400).json({ success: false, error: { code: 'NO_UPDATES', message: 'No valid fields' } });

    values.push(req.params.id);
    const { rows } = await query(
      `UPDATE content_calendar SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, values
    );
    if (!rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Calendar item not found' } });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/v1/calendar/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM content_calendar WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Calendar item not found' } });
    res.json({ success: true, data: { message: 'Deleted' } });
  } catch (err) { next(err); }
});

module.exports = router;
