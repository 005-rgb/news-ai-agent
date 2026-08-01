'use strict';

const BaseAgent = require('./base');
const { query } = require('../db');

class AnalystAgent extends BaseAgent {
  constructor() { super('AnalystAgent'); }

  /**
   * Generate a weekly performance report from real DB data.
   * Called by the scheduler or rapat trigger.
   * Returns a structured report object saved to rapat_notes.
   */
  async generateWeeklyReport(siteIds) {
    await this.log('info', 'Generating weekly performance report', { siteCount: siteIds?.length });

    try {
      // 1. Article production per site for the last 7 days
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

      // 2. Pipeline stage breakdown
      const { rows: stages } = await query(
        `SELECT status, COUNT(*)::int AS count
         FROM articles
         WHERE created_at > NOW() - INTERVAL '7 days'
         GROUP BY status`
      );
      const pipeline = {};
      for (const r of stages) pipeline[r.status] = r.count;

      // 3. Provider performance this week
      const { rows: providers } = await query(
        `SELECT provider_used AS provider,
                COUNT(*)::int                            AS articles,
                ROUND(AVG(quality_score)::numeric, 1)   AS avg_quality,
                ROUND(AVG(eeat_score)::numeric, 1)      AS avg_eeat
         FROM articles
         WHERE created_at > NOW() - INTERVAL '7 days'
           AND provider_used IS NOT NULL
         GROUP BY provider_used
         ORDER BY avg_quality DESC NULLS LAST`
      );

      // 4. Top evergreen candidates
      const { rows: evergreen } = await query(
        `SELECT title, quality_score, eeat_score, format, published_at
         FROM articles
         WHERE status = 'published'
           AND format IN ('evergreen','feature_opini','jurnal_review')
           AND published_at < NOW() - INTERVAL '30 days'
         ORDER BY eeat_score DESC NULLS LAST
         LIMIT 5`
      );

      // 5. Failure analysis
      const { rows: failures } = await query(
        `SELECT job_type, COUNT(*)::int AS count, MAX(error_message) AS last_error
         FROM job_queue
         WHERE status IN ('failed','dead')
           AND created_at > NOW() - INTERVAL '7 days'
         GROUP BY job_type
         ORDER BY count DESC`
      );

      // 6. Key usage summary
      const { rows: keyUsage } = await query(
        `SELECT provider, COUNT(*)::int AS keys,
                SUM(usage_today)::int AS total_usage,
                SUM(daily_limit)::int AS total_limit
         FROM api_keys
         WHERE status = 'active' AND provider != '_config'
         GROUP BY provider`
      );

      const totalPublished = production.reduce((s, r) => s + (r.published || 0), 0);
      const totalFailed    = production.reduce((s, r) => s + (r.failed || 0), 0);
      const allQuality     = production.filter(r => r.avg_quality).map(r => parseFloat(r.avg_quality));
      const avgQuality     = allQuality.length
        ? (allQuality.reduce((s, v) => s + v, 0) / allQuality.length).toFixed(1)
        : null;

      // Build recommendations
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
}

module.exports = AnalystAgent;
