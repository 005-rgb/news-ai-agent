'use strict';

/**
 * BaseAgent — semua agent extends class ini
 * Menyediakan: callLLM, log, updateJobStatus, retry, handleError
 */

const logger = require('../utils/logger');
const { query } = require('../db');

class BaseAgent {
  constructor(name) {
    if (!name) throw new Error('Agent name is required');
    this.name = name;
  }

  /**
   * Call LLM via llmRouter — auto catat usage ke DB
   */
  async callLLM(prompt, options = {}) {
    const llmRouter = require('../services/llmRouter');
    return llmRouter.callLLM(prompt, { ...options, agentName: this.name });
  }

  /**
   * Log to system_logs table + console
   */
  async log(level, message, metadata = {}) {
    return logger[level] ? logger[level](this.name, message, metadata) : logger.info(this.name, message, metadata);
  }

  /**
   * Update job status in job_queue
   */
  async updateJobStatus(jobId, status, result = null) {
    if (!jobId) return;
    const updates = ['status = $1'];
    const values = [status];
    let idx = 2;

    if (status === 'processing') {
      updates.push(`started_at = NOW()`);
    } else if (status === 'done' || status === 'failed' || status === 'dead') {
      updates.push(`finished_at = NOW()`);
    }

    if (result !== null) {
      updates.push(`payload = payload || $${idx++}::jsonb`);
      values.push(JSON.stringify({ result }));
    }

    values.push(jobId);
    await query(
      `UPDATE job_queue SET ${updates.join(', ')}, attempts = attempts + 1 WHERE id = $${idx}`,
      values
    ).catch((err) => logger.error(this.name, `Failed to update job status: ${err.message}`, { jobId }));
  }

  /**
   * Retry with exponential backoff
   * @param {Function} fn - async function to retry
   * @param {number} maxAttempts
   * @param {number} baseDelayMs
   */
  async retry(fn, maxAttempts = 3, baseDelayMs = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (attempt < maxAttempts) {
          const delay = baseDelayMs * Math.pow(2, attempt - 1);
          await logger.warn(this.name, `Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms`, { error: err.message });
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    throw lastError;
  }

  /**
   * Classify and log error, re-throw if critical
   */
  handleError(err, context = {}) {
    const code = err.code || 'UNKNOWN';
    const isCritical = ['auth_error', 'ENCRYPTION_FAILED'].includes(code);
    const level = isCritical ? 'critical' : 'error';
    logger[level](this.name, err.message, { code, ...context });
    throw err;
  }
}

module.exports = BaseAgent;
