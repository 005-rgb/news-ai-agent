'use strict';

/**
 * sourceSelector.js — Phase 2, Step 2.5
 *
 * selectSources(category, count = 3)
 * ------------------------------------
 * Returns the best `count` active sources for a given category, ordered by
 * credibility_score DESC.  Sources still inside their fetch-interval window
 * (last_fetched_at > NOW() - fetch_interval_minutes) are deprioritised — they
 * get bumped to the end of the list, but are still returned if there are not
 * enough fresh sources.
 *
 * Exported helpers
 * ─────────────────
 *   selectSources(category, count)  → Promise<sourceRow[]>
 *   fetchFromSource(source)         → Promise<item[]>  (dispatches to correct fetcher)
 */

const { query } = require('../db');
const logger = require('../utils/logger');

const { fetchRSS } = require('./fetchers/rss');
const { fetchAcademic } = require('./fetchers/academic');
const { scrapeUrl } = require('./fetchers/scraper');

// ── selectSources ─────────────────────────────────────────────────────────────

/**
 * @param {string}  category  — e.g. 'teknologi', 'akademik', 'politik'
 * @param {number}  count     — number of sources to return (default 3)
 * @returns {Promise<Array>}  — array of source rows, best first
 */
async function selectSources(category, count = 3) {
  // Step 1: all active sources for this category
  const { rows } = await query(
    `SELECT *
     FROM sources
     WHERE $1 = ANY(categories)
       AND is_active = true
     ORDER BY credibility_score DESC`,
    [category]
  );

  if (!rows.length) {
    await logger.warn('SourceSelector',
      `No active sources found for category: ${category}`,
      { category }
    );
    return [];
  }

  // Step 2: split into fresh vs. stale (inside cache window)
  const now = Date.now();
  const fresh = [];
  const stale = [];

  for (const src of rows) {
    const intervalMs = (src.fetch_interval_minutes || 30) * 60 * 1000;
    const lastFetched = src.last_fetched_at ? new Date(src.last_fetched_at).getTime() : 0;
    const isStillCached = lastFetched > 0 && (now - lastFetched) < intervalMs;

    if (isStillCached) {
      stale.push(src);
    } else {
      fresh.push(src);
    }
  }

  // Step 3: try to fill `count` from fresh, then fall back to stale
  const selected = [...fresh, ...stale].slice(0, count);

  if (selected.length < count) {
    await logger.warn('SourceSelector',
      `Only ${selected.length}/${count} sources available for category: ${category}`,
      { category, available: selected.length, requested: count }
    );
  }

  await logger.info('SourceSelector',
    `Selected ${selected.length} source(s) for category: ${category}`,
    { category, sources: selected.map(s => s.name) }
  );

  return selected;
}

// ── fetchFromSource ───────────────────────────────────────────────────────────

/**
 * Dispatch to the correct fetcher based on source.type.
 * Returns an array of normalised items.
 *
 * @param {object} source  — a row from the sources table
 * @param {string} [query] — optional search query (used by 'api' sources)
 * @returns {Promise<Array>}
 */
async function fetchFromSource(source, searchQuery = '') {
  const { type, rss_url, url, name } = source;

  try {
    if (type === 'rss') {
      const feedUrl = rss_url || url;
      return await fetchRSS(feedUrl);
    }

    if (type === 'api') {
      // Map source URL to the correct academic provider
      let provider;
      if (url.includes('pubmed') || url.includes('ncbi'))    provider = 'pubmed';
      else if (url.includes('arxiv'))                         provider = 'arxiv';
      else if (url.includes('semanticscholar'))               provider = 'semantic_scholar';
      else if (url.includes('doaj'))                          provider = 'doaj';
      else {
        await logger.warn('SourceSelector', `Unknown API source: ${name}`, { url });
        return [];
      }
      return await fetchAcademic(provider, searchQuery || 'Indonesia');
    }

    if (type === 'scrape') {
      return await scrapeUrl(url, source.css_selectors || {});
    }

    await logger.warn('SourceSelector', `Unknown source type: ${type} for "${name}"`, { url });
    return [];

  } catch (err) {
    await logger.error('SourceSelector',
      `Failed to fetch from "${name}": ${err.message}`,
      { sourceId: source.id, url, type, error: err.message }
    );
    return [];
  }
}

// ── updateLastFetched ─────────────────────────────────────────────────────────

/**
 * Call after a successful fetch to mark the source as recently fetched.
 * @param {string} sourceId
 */
async function updateLastFetched(sourceId) {
  await query(
    `UPDATE sources SET last_fetched_at = NOW() WHERE id = $1`,
    [sourceId]
  );
}

// ── getSourcesByIds ───────────────────────────────────────────────────────────

/**
 * Fetch specific sources by ID array (used by Reporter Agent).
 * @param {string[]} ids
 */
async function getSourcesByIds(ids) {
  if (!ids || !ids.length) return [];
  const { rows } = await query(
    `SELECT * FROM sources WHERE id = ANY($1)`,
    [ids]
  );
  return rows;
}

module.exports = {
  selectSources,
  fetchFromSource,
  updateLastFetched,
  getSourcesByIds,
};
