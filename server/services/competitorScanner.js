'use strict';

/**
 * Competitor Gap Scanner — Phase 9 Step 9.3
 *
 * Setiap Sabtu 20:00 WIB:
 * 1. Fetch sitemap/RSS semua kompetitor yang didaftarkan per site
 * 2. Ekstrak topik yang mereka tulis minggu ini
 * 3. Bandingkan dengan topik yang kita tulis
 * 4. Identifikasi: (a) topik kompetitor yg belum ada di kita = gap opportunity
 *                  (b) topik kita yang lebih dalam dari kompetitor = keunggulan
 * 5. Simpan sebagai gap_opportunities di competitor_data
 *
 * Public API:
 *   scanCompetitorGaps()              — main scan, semua competitor terdaftar
 *   scanCompetitorForSite(siteId)     — scan hanya untuk satu site
 *   getGapsForSite(siteId)            — get gap_opportunities dari DB untuk site ini
 *   getAllGaps()                       — get semua gaps lintas site
 *   addCompetitor(siteId, url)        — tambah competitor URL
 */

const { query }            = require('../db');
const logger               = require('../utils/logger');
const { keywordOverlap }   = require('../utils/similarity');

// Gap threshold: jika overlap dengan artikel kita < ini → termasuk gap opportunity
const GAP_OVERLAP_THRESHOLD = 0.30;
// Our depth advantage: jika artikel kita jauh lebih banyak kata → kita lebih dalam
const DEPTH_ADVANTAGE_RATIO = 1.5;

// ── RSS feed URL candidates to try for a competitor ──────────────────────────
function _guessFeedUrls(baseUrl) {
  const base = baseUrl.replace(/\/$/, '');
  return [
    base + '/feed/',
    base + '/rss/',
    base + '/rss.xml',
    base + '/feed.xml',
    base + '/atom.xml',
    base + '/sitemap_news.xml',
    base,
  ];
}

// ── Fetch RSS feed dari competitor URL ───────────────────────────────────────
async function _fetchFeed(competitorUrl) {
  const Parser = require('rss-parser');
  const parser = new Parser({ timeout: 15000 });
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  for (const feedUrl of _guessFeedUrls(competitorUrl)) {
    try {
      const feed  = await parser.parseURL(feedUrl);
      const items = (feed.items || []);

      // Filter artikel dari 7 hari terakhir
      const recent = items.filter(item => {
        const pub = item.pubDate || item.isoDate;
        if (!pub) return true; // include if no date
        return new Date(pub) >= sevenDaysAgo;
      }).slice(0, 50);

      if (recent.length === 0 && items.length > 0) {
        // All items older than 7 days — take latest 20 anyway
        recent.push(...items.slice(0, 20));
      }

      return {
        feedUrl,
        siteTitle: feed.title || competitorUrl,
        topics: recent.map(i => (i.title || '').trim()).filter(Boolean),
        total: items.length,
      };
    } catch (_) {
      // Try next URL
    }
  }

  return { feedUrl: competitorUrl, siteTitle: competitorUrl, topics: [], total: 0 };
}

// ── Identify gap & advantage topics ──────────────────────────────────────────
function _identifyGapsAndAdvantages(competitorTopics, ourTitles) {
  const gaps       = [];
  const advantages = [];

  for (const compTopic of competitorTopics) {
    if (!compTopic.trim()) continue;

    let maxOverlap = 0;
    let mostSimilar = null;
    for (const ourTitle of ourTitles) {
      const overlap = keywordOverlap(compTopic, ourTitle);
      if (overlap > maxOverlap) {
        maxOverlap  = overlap;
        mostSimilar = ourTitle;
      }
    }

    if (maxOverlap < GAP_OVERLAP_THRESHOLD) {
      // Kompetitor punya, kita tidak → gap opportunity
      gaps.push({
        topic:      compTopic,
        overlap:    Math.round(maxOverlap * 100),
        suggestion: `Tulis artikel tentang: "${compTopic}"`,
      });
    }
    // else: kita sudah cover topik ini (bisa dianggap advantage)
  }

  return { gaps: gaps.slice(0, 20), advantages: advantages.slice(0, 10) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Scan satu site's competitors
// ─────────────────────────────────────────────────────────────────────────────
async function scanCompetitorForSite(siteId) {
  // Load competitors for this site
  const { rows: comps } = await query(
    `SELECT cd.id, cd.competitor_url, s.name AS site_name
     FROM competitor_data cd
     JOIN sites s ON s.id = cd.site_id
     WHERE cd.site_id = $1 AND cd.competitor_url IS NOT NULL`,
    [siteId]
  );

  if (!comps.length) return { scanned: 0, gaps: 0, siteId };

  // Load our articles for this site (last 30 days)
  const { rows: ourArticles } = await query(
    `SELECT title FROM articles
     WHERE site_id = $1
       AND status = 'published'
       AND published_at > NOW() - INTERVAL '30 days'
     ORDER BY published_at DESC
     LIMIT 100`,
    [siteId]
  );
  const ourTitles = ourArticles.map(a => a.title);

  let totalGaps = 0;
  let scanned   = 0;

  for (const comp of comps) {
    try {
      await logger.info('CompetitorScanner', `Scanning "${comp.competitor_url}" for site "${comp.site_name}"`);

      const { feedUrl, siteTitle, topics } = await _fetchFeed(comp.competitor_url);

      if (!topics.length) {
        await logger.warn('CompetitorScanner', `No articles found at ${comp.competitor_url}`);
        continue;
      }

      const { gaps, advantages } = _identifyGapsAndAdvantages(topics, ourTitles);

      const gapData = {
        gaps,
        advantages,
        feedUrl,
        siteTitle,
        totalCompetitorTopics: topics.length,
        totalGapsFound:        gaps.length,
        scannedAt:             new Date().toISOString(),
      };

      await query(
        `UPDATE competitor_data
         SET topics_covered    = $1,
             gap_opportunities = $2,
             last_checked_at   = NOW()
         WHERE id = $3`,
        [topics, JSON.stringify(gapData), comp.id]
      );

      totalGaps += gaps.length;
      scanned++;

      // Polite rate limit between competitors
      await new Promise(r => setTimeout(r, 3000));

    } catch (err) {
      await logger.warn('CompetitorScanner', `Failed to scan ${comp.competitor_url}: ${err.message}`);
    }
  }

  return { scanned, gaps: totalGaps, siteId };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC — Scan all registered competitors across all sites
// ─────────────────────────────────────────────────────────────────────────────
async function scanCompetitorGaps() {
  await logger.info('CompetitorScanner', 'Starting weekly competitor gap scan');

  try {
    // Get distinct site IDs that have competitors
    const { rows: sites } = await query(
      `SELECT DISTINCT cd.site_id, s.name AS site_name
       FROM competitor_data cd
       JOIN sites s ON s.id = cd.site_id
       WHERE cd.competitor_url IS NOT NULL`
    );

    if (!sites.length) {
      await logger.info('CompetitorScanner', 'No competitors registered — scan skipped');
      return { scanned: 0, gaps: 0 };
    }

    let totalScanned = 0;
    let totalGaps    = 0;

    for (const site of sites) {
      const result = await scanCompetitorForSite(site.site_id);
      totalScanned += result.scanned;
      totalGaps    += result.gaps;
    }

    await logger.info('CompetitorScanner', `Competitor scan complete: ${totalScanned} competitors, ${totalGaps} gap opportunities`, {
      totalScanned, totalGaps,
    });

    return { scanned: totalScanned, gaps: totalGaps };

  } catch (err) {
    await logger.error('CompetitorScanner', `Competitor gap scan failed: ${err.message}`);
    return { scanned: 0, gaps: 0, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC — Get gap opportunities for a specific site
// ─────────────────────────────────────────────────────────────────────────────
async function getGapsForSite(siteId) {
  const { rows } = await query(
    `SELECT id, competitor_url, topics_covered, gap_opportunities, last_checked_at
     FROM competitor_data
     WHERE site_id = $1
     ORDER BY last_checked_at DESC NULLS LAST`,
    [siteId]
  );
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC — Get all gaps across all sites
// ─────────────────────────────────────────────────────────────────────────────
async function getAllGaps() {
  const { rows } = await query(
    `SELECT cd.id, cd.site_id, s.name AS site_name,
            cd.competitor_url, cd.gap_opportunities,
            cd.topics_covered, cd.last_checked_at
     FROM competitor_data cd
     JOIN sites s ON s.id = cd.site_id
     ORDER BY cd.last_checked_at DESC NULLS LAST`
  );
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC — Register a competitor URL for a site
// ─────────────────────────────────────────────────────────────────────────────
async function addCompetitor(siteId, competitorUrl) {
  const { v4: uuidv4 } = require('uuid');
  const { rows } = await query(
    `INSERT INTO competitor_data (id, site_id, competitor_url)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [uuidv4(), siteId, competitorUrl]
  );
  return rows[0] || null;
}

module.exports = {
  scanCompetitorGaps,
  scanCompetitorForSite,
  getGapsForSite,
  getAllGaps,
  addCompetitor,
};
