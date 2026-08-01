'use strict';

/**
 * Smart Timing Learner — Phase 10 Step 10.5
 *
 * Setelah 30+ hari data terkumpul, analisis jam posting mana yang menghasilkan
 * performa terbaik per kategori per site.
 *
 * Hasilnya disimpan ke sites.config.smart_timing sebagai:
 * {
 *   "teknologi": { "best_hour": 10, "confidence": 0.82 },
 *   "bisnis":    { "best_hour": 8,  "confidence": 0.75 },
 *   ...
 * }
 *
 * Scheduler membaca sites.config.smart_timing untuk menyesuaikan jam posting.
 * Jika confidence < 0.6 atau data < 10 sampel: tidak override default.
 */

const { query }  = require('../db');
const logger     = require('../utils/logger');

const AGENT           = 'SmartTimingLearner';
const MIN_SAMPLES     = 10;      // minimal sampel per bucket jam+kategori
const MIN_CONFIDENCE  = 0.60;    // confidence minimum untuk dipakai
const DATA_DAYS       = 60;      // analisis dari N hari terakhir

/**
 * Jalankan analisis timing untuk semua site aktif.
 * Dipanggil oleh analyst agent dan scheduler.
 */
async function runTimingAnalysis() {
  logger.info(AGENT, 'Memulai analisis smart timing...');

  try {
    // Ambil semua site aktif
    const { rows: sites } = await query(
      `SELECT id, name, config FROM sites WHERE status = 'active'`
    );

    if (!sites.length) return { analyzed: 0, updated: 0 };

    let updated = 0;

    for (const site of sites) {
      const result = await analyzeSiteTiming(site);
      if (result.hasLearning) updated++;
    }

    logger.info(AGENT, `Smart timing analysis selesai: ${updated}/${sites.length} site diperbarui`, {});
    return { analyzed: sites.length, updated };
  } catch (err) {
    logger.error(AGENT, `runTimingAnalysis error: ${err.message}`, {});
    throw err;
  }
}

/**
 * Analisis timing untuk satu site.
 */
async function analyzeSiteTiming(site) {
  try {
    // Ambil artikel published dari site ini, grup berdasarkan kategori + jam publish
    // Gunakan quality_score + eeat_score sebagai proxy performa
    const { rows: buckets } = await query(
      `SELECT
         category,
         EXTRACT(HOUR FROM published_at AT TIME ZONE 'Asia/Jakarta')::int AS hour,
         COUNT(*)::int                                     AS cnt,
         ROUND(AVG(quality_score)::numeric, 2)             AS avg_quality,
         ROUND(AVG(eeat_score)::numeric, 2)                AS avg_eeat,
         ROUND(AVG(COALESCE(quality_score, 0) * 0.5 + COALESCE(eeat_score, 0) * 0.5)::numeric, 2) AS avg_perf
       FROM articles
       WHERE site_id = $1
         AND status = 'published'
         AND published_at > NOW() - INTERVAL '${DATA_DAYS} days'
         AND published_at IS NOT NULL
         AND category IS NOT NULL
       GROUP BY category, hour
       HAVING COUNT(*) >= 3
       ORDER BY category, avg_perf DESC`,
      [site.id]
    );

    if (!buckets.length) return { hasLearning: false };

    // Per kategori: temukan jam terbaik dan hitung confidence
    const byCategory = {};
    for (const row of buckets) {
      if (!byCategory[row.category]) byCategory[row.category] = [];
      byCategory[row.category].push(row);
    }

    const smartTiming = {};
    let hasLearning = false;

    for (const [category, rows] of Object.entries(byCategory)) {
      // Total sampel dalam kategori
      const totalSamples = rows.reduce((sum, r) => sum + r.cnt, 0);
      if (totalSamples < MIN_SAMPLES) continue;

      // Jam terbaik: yang punya avg_perf tertinggi
      const best = rows[0]; // sudah di-sort desc
      const worst = rows[rows.length - 1];

      // Confidence: (best.avg_perf - worst.avg_perf) / best.avg_perf
      const bestPerf  = parseFloat(best.avg_perf) || 0;
      const worstPerf = parseFloat(worst.avg_perf) || 0;
      const confidence = bestPerf > 0 ? Math.min((bestPerf - worstPerf) / bestPerf, 1.0) : 0;

      if (confidence < MIN_CONFIDENCE || best.cnt < 3) continue;

      smartTiming[category] = {
        best_hour:   best.hour,
        avg_perf:    bestPerf,
        confidence:  Math.round(confidence * 100) / 100,
        samples:     totalSamples,
        analyzed_at: new Date().toISOString(),
      };
      hasLearning = true;
    }

    if (!hasLearning) return { hasLearning: false };

    // Merge ke sites.config.smart_timing (tidak hapus yang sudah ada)
    const existingConfig = typeof site.config === 'string'
      ? JSON.parse(site.config || '{}')
      : (site.config || {});

    const updatedConfig = {
      ...existingConfig,
      smart_timing: {
        ...(existingConfig.smart_timing || {}),
        ...smartTiming,
        last_updated: new Date().toISOString(),
      },
    };

    await query(
      `UPDATE sites SET config = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(updatedConfig), site.id]
    );

    logger.info(AGENT, `Smart timing diperbarui untuk site "${site.name}": ${Object.keys(smartTiming).length} kategori`, { siteId: site.id, categories: Object.keys(smartTiming) });

    return { hasLearning: true, categories: Object.keys(smartTiming), smartTiming };
  } catch (err) {
    logger.error(AGENT, `analyzeSiteTiming gagal untuk site ${site.name}: ${err.message}`, { siteId: site.id });
    return { hasLearning: false };
  }
}

/**
 * Baca smart timing untuk site tertentu.
 * Digunakan oleh scheduler untuk memilih jam posting.
 *
 * @param {string} siteId
 * @param {string} category
 * @returns {{ best_hour: number, confidence: number }|null}
 */
async function getSmartTimingForCategory(siteId, category) {
  try {
    const { rows } = await query(
      `SELECT config FROM sites WHERE id = $1`,
      [siteId]
    );
    if (!rows.length) return null;

    const config = typeof rows[0].config === 'string'
      ? JSON.parse(rows[0].config || '{}')
      : (rows[0].config || {});

    const timing = config.smart_timing?.[category];
    if (!timing || timing.confidence < MIN_CONFIDENCE) return null;

    return timing;
  } catch {
    return null;
  }
}

/**
 * Ambil summary smart timing semua site untuk Analytics dashboard.
 */
async function getSmartTimingSummary() {
  try {
    const { rows: sites } = await query(
      `SELECT id, name, config FROM sites WHERE status = 'active' ORDER BY name`
    );

    return sites.map(site => {
      const config = typeof site.config === 'string'
        ? JSON.parse(site.config || '{}')
        : (site.config || {});
      const timing = config.smart_timing || {};
      const lastUpdated = timing.last_updated || null;
      const { last_updated, ...categories } = timing;
      return {
        siteId:    site.id,
        siteName:  site.name,
        lastUpdated,
        categories: Object.entries(categories).map(([cat, data]) => ({
          category:   cat,
          best_hour:  data.best_hour,
          confidence: data.confidence,
          samples:    data.samples,
          avg_perf:   data.avg_perf,
        })).sort((a, b) => b.confidence - a.confidence),
      };
    });
  } catch (err) {
    logger.error(AGENT, `getSmartTimingSummary error: ${err.message}`, {});
    return [];
  }
}

module.exports = { runTimingAnalysis, analyzeSiteTiming, getSmartTimingForCategory, getSmartTimingSummary };
