'use strict';

/**
 * Quality Routes — Phase 8
 * Endpoints untuk testing dan monitoring quality/humanizer engine.
 *
 * POST /api/v1/quality/test-humanizer   — test humanizer pada teks input
 * POST /api/v1/quality/check-duplicate  — cek duplikasi topik vs DB
 * GET  /api/v1/quality/stats            — statistik quality & E-E-A-T
 */

const express = require('express');
const { query } = require('../db');
const { humanize, aiDetectionPrecheck, humanizeReport } = require('../utils/humanizer');
const { findDuplicates, keywordOverlap, topicFingerprint } = require('../utils/similarity');

const router = express.Router();

// ── UUID validator — C-6 Fix ──────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(v) { return UUID_RE.test(v); }

// ── POST /api/v1/quality/test-humanizer ──────────────────────────────────────
// Test humanizer pada teks input, return before/after + AI detection report
router.post('/test-humanizer', async (req, res, next) => {
  try {
    const { text, level } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_TEXT', message: 'Field "text" wajib diisi (string)' },
      });
    }

    const activeLevel = level !== null && level !== undefined
      ? Math.max(1, Math.min(4, parseInt(level) || 3))
      : 3;

    // Run AI detection on original
    const aiFlags = aiDetectionPrecheck(text);

    // Apply humanizer
    const humanized = humanize(text, activeLevel);

    // Generate report
    const report = humanizeReport(text, humanized);

    // AI detection on humanized result
    const aiFlagsAfter = aiDetectionPrecheck(humanized);

    res.json({
      success: true,
      data: {
        level: activeLevel,
        original: {
          text,
          wordCount:   text.split(/\s+/).filter(Boolean).length,
          paragraphs:  text.split(/\n\n+/).filter(p => p.trim()).length,
          aiFlags,
          aiRisk: _classifyRisk(aiFlags),
        },
        humanized: {
          text: humanized,
          wordCount:   humanized.split(/\s+/).filter(Boolean).length,
          paragraphs:  humanized.split(/\n\n+/).filter(p => p.trim()).length,
          aiFlags: aiFlagsAfter,
          aiRisk: _classifyRisk(aiFlagsAfter),
        },
        changes: report.changes,
        summary: {
          flagsRemoved: Math.max(0, aiFlags.length - aiFlagsAfter.length),
          flagsRemaining: aiFlagsAfter.length,
        },
      },
    });
  } catch (err) { next(err); }
});

// ── POST /api/v1/quality/check-duplicate ─────────────────────────────────────
// Cek apakah topik/judul baru terlalu mirip dengan artikel existing di site
router.post('/check-duplicate', async (req, res, next) => {
  try {
    const { topic, site_id, threshold = 0.6 } = req.body;

    if (!topic) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_TOPIC', message: 'Field "topic" wajib diisi' },
      });
    }

    // C-6 Fix: Validasi site_id sebagai UUID sebelum digunakan sebagai parameter SQL
    if (site_id && !isValidUUID(site_id)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_SITE_ID', message: 'site_id harus berformat UUID yang valid' } });
    }

    // Query artikel existing di site (atau semua site jika site_id tidak diberikan)
    const params = [topic.length > 0];
    let whereClause = `status NOT IN ('failed', 'draft')`;
    if (site_id) {
      whereClause += ` AND site_id = $2`;
      params.push(site_id);
    }

    const { rows } = await query(
      `SELECT id, title, category, status, created_at
       FROM articles
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT 100`,
      site_id ? [site_id] : []
    );

    // Run duplicate check
    const duplicates = findDuplicates(topic, rows.map(r => ({
      id: r.id,
      title: r.title,
      content: r.title, // use title only for speed
    })), parseFloat(threshold) || 0.6);

    const fingerprint = topicFingerprint(topic, 15);

    res.json({
      success: true,
      data: {
        topic,
        site_id: site_id || null,
        threshold: parseFloat(threshold) || 0.6,
        fingerprint,
        isDuplicate: duplicates.length > 0,
        duplicates: duplicates.slice(0, 5).map(d => ({
          articleId: d.articleId,
          title: d.title,
          overlap: Math.round(d.overlap * 100),
          risk: d.overlap >= 0.7 ? 'high' : d.overlap >= 0.5 ? 'medium' : 'low',
        })),
        recommendation: duplicates.length === 0
          ? 'Topik aman — tidak ada duplikasi signifikan'
          : duplicates[0].overlap >= 0.7
            ? 'DUPLICATE_RISK tinggi — ubah sudut pandang atau skip topik ini'
            : 'Mirip tapi masih bisa ditulis dengan angle berbeda',
      },
    });
  } catch (err) { next(err); }
});

// ── GET /api/v1/quality/stats ─────────────────────────────────────────────────
// Statistik quality dan E-E-A-T gabungan untuk monitoring Phase 8
router.get('/stats', async (req, res, next) => {
  try {
    const { days = 7 } = req.query;
    const daysInt = Math.max(1, Math.min(90, parseInt(days) || 7));

    const [overallRes, dailyRes, flagsRes, duplicateRes] = await Promise.all([
      // Overall quality stats
      query(
        `SELECT
           count(*)                                            AS total_articles,
           count(*) FILTER (WHERE quality_score IS NOT NULL)  AS with_quality_score,
           ROUND(AVG(quality_score)::numeric, 1)              AS avg_quality_score,
           ROUND(AVG(eeat_score)::numeric, 1)                 AS avg_eeat_score,
           count(*) FILTER (WHERE quality_score >= 75)        AS passed_quality_gate,
           count(*) FILTER (WHERE eeat_score >= 80)           AS passed_eeat_gate,
           count(*) FILTER (WHERE quality_score < 75
                             AND quality_score IS NOT NULL)    AS failed_quality_gate,
           count(*) FILTER (WHERE eeat_score < 80
                             AND eeat_score IS NOT NULL)       AS failed_eeat_gate,
           ROUND(MIN(quality_score)::numeric, 1)              AS min_quality,
           ROUND(MAX(quality_score)::numeric, 1)              AS max_quality,
           ROUND(MIN(eeat_score)::numeric, 1)                 AS min_eeat,
           ROUND(MAX(eeat_score)::numeric, 1)                 AS max_eeat
         FROM articles
         WHERE created_at > NOW() - ($1 || ' days')::interval`,
        [daysInt]
      ),
      // Daily quality trend
      query(
        `SELECT
           DATE(created_at)                   AS date,
           count(*)                           AS articles,
           ROUND(AVG(quality_score)::numeric,1) AS avg_quality,
           ROUND(AVG(eeat_score)::numeric,1)    AS avg_eeat,
           count(*) FILTER (WHERE quality_score >= 75) AS passed_qc,
           count(*) FILTER (WHERE eeat_score >= 80)    AS passed_eeat
         FROM articles
         WHERE created_at > NOW() - ($1 || ' days')::interval
           AND quality_score IS NOT NULL
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
        [daysInt]
      ),
      // AI detection flags from system_logs
      query(
        `SELECT
           count(*) AS total_ai_flag_events,
           count(*) FILTER (WHERE message LIKE '%AI markers remain%') AS articles_with_remaining_flags,
           count(*) FILTER (WHERE message LIKE '%quality_score%') AS quality_score_events
         FROM system_logs
         WHERE created_at > NOW() - ($1 || ' days')::interval
           AND agent = 'EditorAgent'`,
        [daysInt]
      ),
      // Duplicate risk articles
      query(
        `SELECT count(*) AS duplicate_risk_count
         FROM articles
         WHERE content_versions::text LIKE '%isDuplicate":true%'
           AND created_at > NOW() - ($1 || ' days')::interval`,
        [daysInt]
      ),
    ]);

    const overall = overallRes.rows[0] || {};
    const totalArticles = parseInt(overall.total_articles) || 0;
    const passedQuality = parseInt(overall.passed_quality_gate) || 0;
    const passedEeat    = parseInt(overall.passed_eeat_gate) || 0;

    res.json({
      success: true,
      data: {
        period_days: daysInt,
        overall: {
          totalArticles,
          withQualityScore:   parseInt(overall.with_quality_score) || 0,
          avgQualityScore:    parseFloat(overall.avg_quality_score) || 0,
          avgEeatScore:       parseFloat(overall.avg_eeat_score) || 0,
          passedQualityGate:  passedQuality,
          failedQualityGate:  parseInt(overall.failed_quality_gate) || 0,
          passedEeatGate:     passedEeat,
          failedEeatGate:     parseInt(overall.failed_eeat_gate) || 0,
          qualityPassRate:    totalArticles ? Math.round(passedQuality / totalArticles * 100) : 0,
          eeatPassRate:       totalArticles ? Math.round(passedEeat    / totalArticles * 100) : 0,
          minQuality:         parseFloat(overall.min_quality) || 0,
          maxQuality:         parseFloat(overall.max_quality) || 0,
          minEeat:            parseFloat(overall.min_eeat)    || 0,
          maxEeat:            parseFloat(overall.max_eeat)    || 0,
        },
        dailyTrend:  dailyRes.rows,
        aiDetection: {
          totalAiFlagEvents:        parseInt(flagsRes.rows[0]?.total_ai_flag_events) || 0,
          articlesWithRemainingFlags: parseInt(flagsRes.rows[0]?.articles_with_remaining_flags) || 0,
        },
        duplication: {
          duplicateRiskCount: parseInt(duplicateRes.rows[0]?.duplicate_risk_count) || 0,
        },
      },
    });
  } catch (err) { next(err); }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function _classifyRisk(flags) {
  if (!flags || flags.length === 0) return 'low';
  const critical = flags.filter(f =>
    ['opening_cliche', 'closing_cliche', 'list_pattern', 'uniform_paragraphs'].includes(f.type)
  ).length;
  if (critical >= 3 || flags.length >= 5) return 'high';
  if (critical >= 1 || flags.length >= 2) return 'medium';
  return 'low';
}

module.exports = router;
