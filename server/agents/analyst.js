'use strict';

/**
 * AnalystAgent — Phase 7 (generateWeeklyReport) + Phase 9 (analyzePerformance)
 *
 * generateWeeklyReport(siteIds?)  — weekly perf report dari real DB data (dipakai runRapat & rapat trigger)
 * analyzePerformance()            — detailed performance analysis untuk Phase 9 Step 9.4
 *                                   Identifikasi: format terbaik, provider terbaik, prompt version champion,
 *                                   evergreen update candidates, & rekomendasi per pola.
 */

const BaseAgent = require('./base');
const { query }  = require('../db');

class AnalystAgent extends BaseAgent {
  constructor() { super('AnalystAgent'); }

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 7 — Weekly Report (dipakai oleh rapat trigger & Phase 9)
  // ──────────────────────────────────────────────────────────────────────────

  async generateWeeklyReport(siteIds) {
    await this.log('info', 'Generating weekly performance report', { siteCount: siteIds?.length });

    try {
      const siteFilter = siteIds?.length
        ? `AND a.site_id = ANY(ARRAY[${siteIds.map((_, i) => `$${i + 1}`).join(',')}]::uuid[])`
        : '';
      const params = siteIds?.length ? siteIds : [];

      const { rows: production } = await query(
        `SELECT s.name AS site_name,
                COUNT(a.id)::int                                        AS total,
                COUNT(a.id) FILTER (WHERE a.status = 'published')::int  AS published,
                COUNT(a.id) FILTER (WHERE a.status = 'failed')::int     AS failed,
                ROUND(AVG(a.quality_score)::numeric, 1)                 AS avg_quality,
                ROUND(AVG(a.eeat_score)::numeric, 1)                    AS avg_eeat
         FROM sites s
         LEFT JOIN articles a ON a.site_id = s.id
           AND a.created_at > NOW() - INTERVAL '7 days'
           ${siteFilter}
         WHERE s.status = 'active'
         GROUP BY s.id, s.name
         ORDER BY published DESC`,
        params
      );

      const { rows: stages } = await query(
        `SELECT status, COUNT(*)::int AS count FROM articles
         WHERE created_at > NOW() - INTERVAL '7 days' GROUP BY status`
      );
      const pipeline = {};
      for (const r of stages) pipeline[r.status] = r.count;

      const { rows: providers } = await query(
        `SELECT provider_used AS provider,
                COUNT(*)::int                            AS articles,
                ROUND(AVG(quality_score)::numeric, 1)   AS avg_quality,
                ROUND(AVG(eeat_score)::numeric, 1)      AS avg_eeat
         FROM articles
         WHERE created_at > NOW() - INTERVAL '7 days' AND provider_used IS NOT NULL
         GROUP BY provider_used ORDER BY avg_quality DESC NULLS LAST`
      );

      const { rows: evergreen } = await query(
        `SELECT title, quality_score, eeat_score, format, published_at
         FROM articles
         WHERE status = 'published'
           AND format IN ('evergreen','feature_opini','jurnal_review')
           AND published_at < NOW() - INTERVAL '30 days'
         ORDER BY eeat_score DESC NULLS LAST LIMIT 5`
      );

      const { rows: failures } = await query(
        `SELECT job_type, COUNT(*)::int AS count, MAX(error_message) AS last_error
         FROM job_queue
         WHERE status IN ('failed','dead') AND created_at > NOW() - INTERVAL '7 days'
         GROUP BY job_type ORDER BY count DESC`
      );

      const { rows: keyUsage } = await query(
        `SELECT provider, COUNT(*)::int AS keys,
                SUM(usage_today)::int AS total_usage, SUM(daily_limit)::int AS total_limit
         FROM api_keys WHERE status = 'active' AND provider != '_config'
         GROUP BY provider`
      );

      const totalPublished = production.reduce((s, r) => s + (r.published || 0), 0);
      const totalFailed    = production.reduce((s, r) => s + (r.failed || 0), 0);
      const allQuality     = production.filter(r => r.avg_quality).map(r => parseFloat(r.avg_quality));
      const avgQuality     = allQuality.length
        ? (allQuality.reduce((s, v) => s + v, 0) / allQuality.length).toFixed(1)
        : null;

      const recommendations = [];
      if (totalFailed > 3)
        recommendations.push(`${totalFailed} artikel gagal — cek API key quota dan error log.`);
      if (avgQuality && parseFloat(avgQuality) < 75)
        recommendations.push(`Avg quality ${avgQuality} di bawah target 75 — tuning prompt diperlukan.`);
      if (failures.length > 0)
        recommendations.push(`Stage ${failures[0].job_type} paling banyak gagal (${failures[0].count}x) — investigasi segera.`);
      if (evergreen.length > 0)
        recommendations.push(`${evergreen.length} artikel evergreen siap di-update untuk mempertahankan relevansi.`);
      if (recommendations.length === 0)
        recommendations.push('Performa sistem normal. Pertahankan dan pantau sumber baru.');

      const report = {
        generatedAt: new Date().toISOString(),
        period: 'last_7_days',
        production: { totalPublished, totalFailed, avgQuality, bySite: production },
        pipeline,
        providers,
        evergreen,
        failures,
        keyUsage,
        recommendations,
      };

      await this.log('info', 'Weekly report generated', { totalPublished, totalFailed, avgQuality });
      return report;

    } catch (err) {
      await this.log('error', `generateWeeklyReport failed: ${err.message}`);
      throw err;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 9 Step 9.4 — Detailed Performance Analyzer
  //
  // Lebih detail dari generateWeeklyReport. Fokus pada:
  // - Format apa yang perform terbaik? (by avg quality + eeat)
  // - Provider mana yang hasilkan artikel terbaik?
  // - Prompt version mana yang jadi champion?
  // - Artikel evergreen mana yang perlu di-update?
  // - Pola apa yang harus dipertahankan / diperbaiki?
  // ──────────────────────────────────────────────────────────────────────────

  async analyzePerformance(options = {}) {
    const { days = 7 } = options;
    await this.log('info', `Analyzing performance for last ${days} days (Phase 9 Step 9.4)`);

    try {
      // ── Format performance (format mana yang paling bagus?) ────────────────
      const { rows: byFormat } = await query(
        `SELECT format,
                COUNT(*)::int                              AS total,
                COUNT(*) FILTER (WHERE status = 'published')::int AS published,
                ROUND(AVG(quality_score)::numeric, 1)     AS avg_quality,
                ROUND(AVG(eeat_score)::numeric, 1)        AS avg_eeat,
                ROUND(AVG(word_count)::numeric, 0)        AS avg_words
         FROM articles
         WHERE created_at > NOW() - ($1 || ' days')::interval
           AND format IS NOT NULL
         GROUP BY format
         ORDER BY avg_quality DESC NULLS LAST`,
        [days]
      );

      // ── Provider performance ─────────────────────────────────────────────
      const { rows: byProvider } = await query(
        `SELECT provider_used AS provider,
                COUNT(*)::int                              AS total,
                ROUND(AVG(quality_score)::numeric, 1)     AS avg_quality,
                ROUND(AVG(eeat_score)::numeric, 1)        AS avg_eeat,
                COUNT(*) FILTER (WHERE quality_score >= 75)::int AS passed_qc,
                COUNT(*) FILTER (WHERE eeat_score >= 80)::int    AS passed_eeat
         FROM articles
         WHERE created_at > NOW() - ($1 || ' days')::interval
           AND provider_used IS NOT NULL
         GROUP BY provider_used
         ORDER BY avg_quality DESC NULLS LAST`,
        [days]
      );

      // ── Prompt version performance ────────────────────────────────────────
      const { rows: promptVersions } = await query(
        `SELECT pv.id, pv.name, pv.format_key, pv.is_champion,
                pv.sample_count, pv.performance_score,
                COUNT(a.id)::int                              AS recent_articles,
                ROUND(AVG(a.quality_score)::numeric, 1)       AS avg_quality_recent,
                ROUND(AVG(a.eeat_score)::numeric, 1)          AS avg_eeat_recent
         FROM prompt_versions pv
         LEFT JOIN articles a ON a.prompt_version_id = pv.id
           AND a.created_at > NOW() - ($1 || ' days')::interval
         WHERE pv.is_active = true
         GROUP BY pv.id, pv.name, pv.format_key, pv.is_champion,
                  pv.sample_count, pv.performance_score
         ORDER BY avg_quality_recent DESC NULLS LAST, pv.performance_score DESC NULLS LAST`,
        [days]
      );

      // ── Evergreen update candidates (umur > 30 hari, format evergreen/feature) ─
      const { rows: evergreenCandidates } = await query(
        `SELECT a.id, a.title, a.format, a.quality_score, a.eeat_score,
                a.published_at, a.wordpress_url, s.name AS site_name
         FROM articles a
         LEFT JOIN sites s ON s.id = a.site_id
         WHERE a.status = 'published'
           AND a.published_at < NOW() - INTERVAL '30 days'
           AND a.format IN ('evergreen','feature_opini','jurnal_review','feature','berita_mendalam')
           AND a.quality_score >= 70
         ORDER BY a.eeat_score DESC NULLS LAST, a.published_at ASC
         LIMIT 10`
      );

      // ── Category distribution (mana yang paling banyak diproduksi?) ──────
      const { rows: byCategory } = await query(
        `SELECT category,
                COUNT(*)::int                           AS total,
                COUNT(*) FILTER (WHERE status = 'published')::int AS published,
                ROUND(AVG(quality_score)::numeric, 1)  AS avg_quality
         FROM articles
         WHERE created_at > NOW() - ($1 || ' days')::interval
           AND category IS NOT NULL
         GROUP BY category
         ORDER BY published DESC`,
        [days]
      );

      // ── Quality gate analysis ─────────────────────────────────────────────
      const { rows: qualityStats } = await query(
        `SELECT
           COUNT(*)::int                                           AS total,
           COUNT(*) FILTER (WHERE quality_score >= 75)::int       AS passed_quality,
           COUNT(*) FILTER (WHERE eeat_score >= 80)::int          AS passed_eeat,
           COUNT(*) FILTER (WHERE quality_score < 75
                             AND quality_score IS NOT NULL)::int   AS failed_quality,
           ROUND(AVG(quality_score)::numeric, 1)                  AS avg_quality,
           ROUND(AVG(eeat_score)::numeric, 1)                     AS avg_eeat
         FROM articles
         WHERE created_at > NOW() - ($1 || ' days')::interval`,
        [days]
      );

      // ── Best performing articles this period ──────────────────────────────
      const { rows: topArticles } = await query(
        `SELECT a.title, a.quality_score, a.eeat_score, a.format, a.category,
                s.name AS site_name
         FROM articles a
         LEFT JOIN sites s ON s.id = a.site_id
         WHERE a.status = 'published'
           AND a.created_at > NOW() - ($1 || ' days')::interval
           AND a.quality_score IS NOT NULL
         ORDER BY a.quality_score DESC
         LIMIT 5`,
        [days]
      );

      // ── Build pattern-based recommendations ───────────────────────────────
      const patternRecs = [];
      const topFormat = byFormat.find(f => f.published > 0);
      if (topFormat)
        patternRecs.push(`Format terbaik: "${topFormat.format}" (avg quality: ${topFormat.avg_quality}) — pertahankan & perbanyak.`);

      const topProvider = byProvider.find(p => p.total > 0);
      if (topProvider)
        patternRecs.push(`Provider terbaik: ${topProvider.provider} (avg quality: ${topProvider.avg_quality}) — prioritaskan di key pool.`);

      const q = qualityStats[0] || {};
      const passRate = q.total ? Math.round(q.passed_quality / q.total * 100) : 0;
      if (passRate < 60)
        patternRecs.push(`Quality gate pass rate ${passRate}% — lebih dari 40% artikel gagal QC, perlu revisi prompt.`);

      if (evergreenCandidates.length > 0)
        patternRecs.push(`${evergreenCandidates.length} artikel evergreen siap di-update (umur >30 hari, skor bagus).`);

      const champVersion = promptVersions.find(p => p.is_champion);
      if (champVersion)
        patternRecs.push(`Champion prompt: "${champVersion.name}" (${champVersion.sample_count} sampel) — jangan ubah tanpa A/B test.`);

      const report = {
        generatedAt:       new Date().toISOString(),
        periodDays:        days,
        formatPerformance: byFormat,
        providerPerformance: byProvider,
        promptVersions,
        evergreenCandidates,
        categoryDistribution: byCategory,
        qualityGateStats:  qualityStats[0] || {},
        topArticles,
        patternRecommendations: patternRecs,
      };

      await this.log('info', 'Performance analysis complete (Phase 9 Step 9.4)', {
        formats: byFormat.length, providers: byProvider.length, evergreen: evergreenCandidates.length,
      });

      return report;

    } catch (err) {
      await this.log('error', `analyzePerformance failed: ${err.message}`);
      throw err;
    }
  }
}

module.exports = AnalystAgent;
