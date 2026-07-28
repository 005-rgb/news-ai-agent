'use strict';

/**
 * Pipeline Orchestrator — Phase 3 (Step 3.7)
 *
 * runPipeline(assignment) → articleId
 *
 * Full pipeline flow:
 *   [START]
 *     ↓
 *   RESEARCH  (ReporterAgent)  → brief JSON
 *     ↓
 *   WRITE     (WriterAgent)    → draft 4 format
 *     ↓  ← retry max 2x jika editor score < 75
 *   EDIT      (EditorAgent)    → edited + score
 *     ↓  ← retry max 1x jika QC score < 80
 *   QC        (QualityRater)   → E-E-A-T score
 *     ↓
 *   [status: 'imaging']  → IMAGE job (Phase 5)
 *     ↓
 *   [status: 'seo']      → SEO job (Phase 5)
 *     ↓
 *   [status: 'scheduled'] → PUBLISH job (Phase 5)
 *
 * Setiap agent bertanggung jawab enqueue job berikutnya.
 * Orchestrator hanya memulai pipeline dan menyediakan helper triggerNext.
 */

const { query } = require('../db');
const { v4: uuidv4 } = require('uuid');
const { enqueueJob } = require('./jobQueue');
const logger = require('../utils/logger');

/**
 * Start the full pipeline for a topic assignment.
 * @param {{ topic, category, format, siteId, priority?, scheduledAt? }} assignment
 * @returns {Promise<string>} articleId
 */
async function runPipeline(assignment) {
  const {
    topic,
    category = 'umum',
    format = 'berita_singkat',
    siteId,
    priority = 'normal',
    scheduledAt = null,
  } = assignment;

  if (!topic) throw new Error('topic is required');
  if (!siteId) throw new Error('siteId is required');

  // ── Buat artikel record ───────────────────────────────────────────────────
  const articleId = uuidv4();
  await query(
    `INSERT INTO articles (id, site_id, title, status, format, category, created_at)
     VALUES ($1, $2, $3, 'researching', $4, $5, NOW())`,
    [articleId, siteId, topic, format, category]
  );

  await logger.info('Pipeline', `Started pipeline: "${topic}" [${format}] for site ${siteId}`, {
    articleId, siteId, format, category, priority,
  });

  // ── Enqueue step 1: RESEARCH ──────────────────────────────────────────────
  await enqueueJob('RESEARCH', articleId, { topic, category, format, siteId }, priority, scheduledAt);

  return articleId;
}

/**
 * Manually trigger the next pipeline step for an article (for admin use / recovery).
 * Useful when a step needs to be re-run without restarting from scratch.
 * @param {string} articleId
 * @param {'RESEARCH'|'WRITE'|'EDIT'|'QC'|'IMAGE'|'SEO'|'PUBLISH'} step
 * @param {object} extraPayload
 */
async function triggerStep(articleId, step, extraPayload = {}) {
  const { rows } = await query(
    `SELECT id, site_id, format, category, brief_data, content_versions FROM articles WHERE id = $1`,
    [articleId]
  );
  if (!rows.length) throw new Error(`Article ${articleId} not found`);

  const article = rows[0];
  const brief = article.brief_data || {};
  const draft = article.content_versions || {};

  const payloadMap = {
    RESEARCH: { topic: brief.topic || 'Unknown', category: article.category, format: article.format, siteId: article.site_id },
    WRITE:    { brief, format: article.format, siteId: article.site_id, revisionCount: 0 },
    EDIT:     { draft, brief, siteId: article.site_id, format: article.format, revisionCount: 0 },
    QC:       { editedDraft: draft, brief, siteId: article.site_id, format: article.format, qcRevisionCount: 0 },
    IMAGE:    { siteId: article.site_id },
    SEO:      { siteId: article.site_id, category: article.category },
    PUBLISH:  { siteId: article.site_id, scheduledAt: extraPayload.scheduledAt || null },
  };

  const payload = { ...(payloadMap[step] || {}), ...extraPayload };
  const job = await enqueueJob(step, articleId, payload, 'high');

  await logger.info('Pipeline', `Manually triggered ${step} for article ${articleId}`, { articleId, step, jobId: job.id });
  return job;
}

/**
 * Get pipeline status summary for an article
 */
async function getPipelineStatus(articleId) {
  const { rows: articleRows } = await query(
    `SELECT id, title, status, format, category, quality_score, eeat_score, created_at, published_at FROM articles WHERE id = $1`,
    [articleId]
  );
  if (!articleRows.length) return null;

  const { rows: jobRows } = await query(
    `SELECT job_type, status, attempts, max_attempts, error_message, created_at, finished_at
     FROM job_queue WHERE article_id = $1 ORDER BY created_at ASC`,
    [articleId]
  );

  return {
    article: articleRows[0],
    jobs: jobRows,
  };
}

module.exports = { runPipeline, triggerStep, getPipelineStatus };
