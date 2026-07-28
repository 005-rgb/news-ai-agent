'use strict';

/**
 * RSS Fetcher — Phase 2
 * fetchRSS(url) → standardized item array
 * In-memory cache: 30 minutes per URL
 */

const Parser = require('rss-parser');
const logger = require('../../utils/logger');

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; NewsAIAgent/1.0; +https://newsaiagent.com/bot)',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
  },
});

// Simple in-memory cache: url → { items, expiresAt }
const _cache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getCached(url) {
  const entry = _cache.get(url);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { _cache.delete(url); return null; }
  return entry.items;
}

function setCache(url, items) {
  _cache.set(url, { items, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * Normalize RSS item to standard format
 */
function normalize(item) {
  return {
    title:      item.title || '',
    link:       item.link || item.guid || '',
    pubDate:    item.pubDate || item.isoDate || new Date().toISOString(),
    summary:    item.contentSnippet || item.summary || '',
    content:    item.content || item['content:encoded'] || item.contentSnippet || '',
    author:     item.author || item.creator || '',
    categories: Array.isArray(item.categories) ? item.categories : [],
  };
}

/**
 * @param {string} url - RSS feed URL
 * @param {{ timeout?: number, useCache?: boolean }} options
 * @returns {Promise<Array>}
 */
async function fetchRSS(url, options = {}) {
  if (options.useCache !== false) {
    const cached = getCached(url);
    if (cached) return cached;
  }

  try {
    const feed = await parser.parseURL(url);
    const items = (feed.items || []).map(normalize);
    setCache(url, items);
    return items;
  } catch (err) {
    const msg = err.message || '';
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
      const e = new Error(`RSS fetch timeout: ${url}`);
      e.code = 'FETCH_TIMEOUT';
      throw e;
    }
    if (msg.includes('Non-whitespace') || msg.includes('parse') || msg.includes('Invalid XML')) {
      await logger.warn('RSSFetcher', `Malformed RSS at ${url}`, { error: msg });
      const e = new Error(`Malformed RSS feed: ${url}`);
      e.code = 'MALFORMED_RSS';
      throw e;
    }
    const e = new Error(`Source unavailable: ${url} — ${msg}`);
    e.code = 'SOURCE_UNAVAILABLE';
    throw e;
  }
}

module.exports = { fetchRSS };
