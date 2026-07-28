'use strict';

/**
 * Logger utility — inserts into system_logs table
 * Falls back to console if DB not available (startup)
 */

let _pool = null;
const { v4: uuidv4 } = require('uuid');

function setPool(pool) {
  _pool = pool;
}

/**
 * @param {'info'|'warn'|'error'|'critical'} level
 * @param {string} agent - agent/service name
 * @param {string} message
 * @param {object} [metadata]
 */
async function log(level, agent, message, metadata = {}) {
  const entry = {
    id: uuidv4(),
    level,
    agent,
    message,
    metadata,
    created_at: new Date().toISOString(),
  };

  // Always console-print for visibility
  const prefix = `[${level.toUpperCase()}][${agent}]`;
  if (level === 'error' || level === 'critical') {
    console.error(prefix, message, Object.keys(metadata).length ? metadata : '');
  } else if (level === 'warn') {
    console.warn(prefix, message);
  } else {
    console.log(prefix, message);
  }

  if (!_pool) return; // DB not ready yet — console only

  try {
    await _pool.query(
      `INSERT INTO system_logs (id, level, agent, message, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [entry.id, entry.level, entry.agent, entry.message, JSON.stringify(entry.metadata)]
    );
  } catch (err) {
    // Never let logging crash the application
    console.error('[Logger] Failed to write to DB:', err.message);
  }
}

const logger = {
  setPool,
  info:     (agent, msg, meta) => log('info', agent, msg, meta),
  warn:     (agent, msg, meta) => log('warn', agent, msg, meta),
  error:    (agent, msg, meta) => log('error', agent, msg, meta),
  critical: (agent, msg, meta) => log('critical', agent, msg, meta),
};

module.exports = logger;
