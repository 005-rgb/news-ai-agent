'use strict';

/**
 * Pipeline Orchestrator — Phase 0 skeleton
 * Full implementation in Phase 3
 */

const { query } = require('../db');
const { v4: uuidv4 } = require('uuid');
const { enqueueJob } = require('./jobQueue');
const logger = require('../utils/logger');

/**
 * Start the full pipeline for a topic assignment
 * @param {{ topic, category, format, siteId }} assignment
 */
async function runPipeline(assignment) {
  const { topic, category, format = 'berita_singkat', siteId } = assignment;

  if (!topic || !siteId) throw new Error('topic and siteId are required');

  // Create article record
  const articleId = uuidv4();
  await query(
    `INSERT INTO articles (id, site_id, title, status, format, category, created_at)
     VALUES ($1,$2,$3,'researching',$4,$5,NOW())`,
    [articleId, siteId, topic, format, category || 'umum']
  );

  await logger.info('Pipeline', `Started pipeline for "${topic}"`, { articleId, siteId, format });

  // Enqueue first job — research
  await enqueueJob('RESEARCH', articleId, { topic, category, format, siteId }, 'normal');

  return articleId;
}

module.exports = { runPipeline };
