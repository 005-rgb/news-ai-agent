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
// Aggregates real DB data to generate a notulen and saves it to rapat_notes
router.post('/trigger', async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    // 1. Article stats for the last 7 days per site
    const { rows: siteStats } = await query(
      `SELECT s.name AS site_name,
              COUNT(a.id)::int                           AS total_articles,
              COUNT(a.id) FILTER (WHERE a.status = 'published')::int AS published,
              COUNT(a.id) FILTER (WHERE a.status = 'failed')::int    AS failed,
              ROUND(AVG(a.quality_score)::numeric, 1)   AS avg_quality,
              ROUND(AVG(a.eeat_score)::numeric, 1)      AS avg_eeat
       FROM sites s
       LEFT JOIN articles a ON a.site_id = s.id
         AND a.created_at > NOW() - INTERVAL '7 days'
       WHERE s.status = 'active'
       GROUP BY s.id, s.name
       ORDER BY published DESC`
    );

    // 2. Pipeline bottleneck — counts per status in last 7 days
    const { rows: pipelineRows } = await query(
      `SELECT status, COUNT(*)::int AS count
       FROM articles
       WHERE created_at > NOW() - INTERVAL '7 days'
       GROUP BY status
       ORDER BY count DESC`
    );
    const pipeline = {};
    for (const r of pipelineRows) pipeline[r.status] = r.count;

    // 3. Top performing articles this week
    const { rows: topArticles } = await query(
      `SELECT a.title, a.quality_score, a.eeat_score, s.name AS site_name
       FROM articles a
       LEFT JOIN sites s ON s.id = a.site_id
       WHERE a.status = 'published'
         AND a.published_at > NOW() - INTERVAL '7 days'
         AND a.quality_score IS NOT NULL
       ORDER BY a.quality_score DESC
       LIMIT 5`
    );

    // 4. Active alerts
    const { rows: alertRows } = await query(
      `SELECT message, level FROM system_logs
       WHERE level IN ('warn','error','critical')
         AND created_at > NOW() - INTERVAL '24 hours'
       ORDER BY created_at DESC LIMIT 5`
    );

    // 5. Failed jobs this week
    const { rows: failedJobs } = await query(
      `SELECT job_type, COUNT(*)::int AS count
       FROM job_queue
       WHERE status IN ('failed','dead')
         AND created_at > NOW() - INTERVAL '7 days'
       GROUP BY job_type
       ORDER BY count DESC`
    );

    // 6. Source health
    const { rows: sourceStats } = await query(
      `SELECT COUNT(*) FILTER (WHERE is_active = true)::int  AS active,
              COUNT(*) FILTER (WHERE is_active = false)::int AS inactive,
              COUNT(*)::int                                   AS total
       FROM sources`
    );
    const sources = sourceStats[0] || { active: 0, inactive: 0, total: 0 };

    // ── Build performance_report ──────────────────────────────────────────────
    const totalPublished = siteStats.reduce((s, r) => s + (r.published || 0), 0);
    const totalFailed    = siteStats.reduce((s, r) => s + (r.failed || 0), 0);
    const avgQuality     = siteStats.length
      ? (siteStats.reduce((s, r) => s + (parseFloat(r.avg_quality) || 0), 0) / siteStats.length).toFixed(1)
      : null;

    const performance_report = {
      period: 'last_7_days',
      total_published: totalPublished,
      total_failed: totalFailed,
      avg_quality_score: avgQuality,
      pipeline_snapshot: pipeline,
      site_breakdown: siteStats,
      top_articles: topArticles,
      source_health: sources,
    };

    // ── Build recommendations ─────────────────────────────────────────────────
    const recommendations = [];
    if (totalFailed > 3) recommendations.push(`Pipeline menghasilkan ${totalFailed} artikel gagal — cek API key dan quota.`);
    if (parseFloat(avgQuality) < 75) recommendations.push(`Rata-rata quality score ${avgQuality} di bawah target 75 — pertimbangkan tuning prompt.`);
    if (sources.inactive > sources.active) recommendations.push(`${sources.inactive} sumber tidak aktif lebih banyak dari aktif — review dan aktifkan sumber relevan.`);
    if (failedJobs.length > 0) {
      const topFail = failedJobs[0];
      recommendations.push(`Stage ${topFail.job_type} paling banyak gagal (${topFail.count}x) — perlu investigasi.`);
    }
    if (alertRows.length > 0) recommendations.push(`${alertRows.length} alert sistem aktif dalam 24 jam terakhir — segera tindaklanjuti.`);
    if (recommendations.length === 0) recommendations.push('Sistem berjalan normal. Pertahankan performa dan monitor sumber baru.');

    // ── Build human-readable summary ─────────────────────────────────────────
    const siteLines = siteStats.map(s =>
      `• ${s.site_name}: ${s.published} publish, ${s.failed} gagal (Quality: ${s.avg_quality || '—'}, E-E-A-T: ${s.avg_eeat || '—'})`
    ).join('\n') || '• Belum ada site aktif.';

    const topLines = topArticles.map((a, i) =>
      `${i + 1}. "${a.title}" — ${a.site_name} (Quality: ${a.quality_score}, E-E-A-T: ${a.eeat_score})`
    ).join('\n') || 'Belum ada artikel publish minggu ini.';

    const alertLines = alertRows.length
      ? alertRows.map(a => `[${a.level.toUpperCase()}] ${a.message}`).join('\n')
      : 'Tidak ada alert kritis.';

    const recLines = recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n');

    const summary =
`=== NOTULEN RAPAT REDAKSI — ${today} ===

📊 RINGKASAN PRODUKSI (7 HARI TERAKHIR)
Total Publish  : ${totalPublished} artikel
Total Gagal    : ${totalFailed} artikel
Avg Quality    : ${avgQuality || '—'}
Sumber Aktif   : ${sources.active}/${sources.total}

📍 PER SITE
${siteLines}

🏆 TOP ARTIKEL MINGGU INI
${topLines}

🚨 ALERT SISTEM (24 JAM)
${alertLines}

💡 REKOMENDASI
${recLines}

--- Notulen dibuat otomatis oleh Analyst Agent ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} ---`;

    // ── Save to rapat_notes ───────────────────────────────────────────────────
    const { rows: saved } = await query(
      `INSERT INTO rapat_notes (session_date, summary, trend_data, performance_report, recommendations)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [
        today,
        summary,
        JSON.stringify({ generated_at: new Date().toISOString(), sources_active: sources.active }),
        JSON.stringify(performance_report),
        JSON.stringify({ items: recommendations }),
      ]
    );

    // If same-day conflict, upsert with explicit id
    let note = saved[0];
    if (!note) {
      const { rows: upserted } = await query(
        `UPDATE rapat_notes
         SET summary = $2, trend_data = $3, performance_report = $4, recommendations = $5, created_at = NOW()
         WHERE session_date = $1
         RETURNING *`,
        [
          today,
          summary,
          JSON.stringify({ generated_at: new Date().toISOString(), sources_active: sources.active }),
          JSON.stringify(performance_report),
          JSON.stringify({ items: recommendations }),
        ]
      );
      note = upserted[0];
    }

    res.json({
      success: true,
      data: {
        message: `Rapat Redaksi ${today} berhasil dibuat dari data real-time.`,
        notulen: note,
        stats: { totalPublished, totalFailed, avgQuality, sourcesActive: sources.active },
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
