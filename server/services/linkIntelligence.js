'use strict';

/**
 * Link Intelligence Network — Phase 10 Step 10.3
 *
 * Enhanced SEO Agent: saat proses artikel baru, query lintas semua 8 site untuk
 * menemukan artikel relevan yang bisa dihubungkan (cross-site internal linking).
 *
 * Aturan:
 * - Maks 3 cross-site link per artikel (tidak spam)
 * - Prioritaskan artikel dengan E-E-A-T score tinggi
 * - Variasikan anchor text (tidak boleh sama persis untuk topik yang sama)
 * - Track semua link yang pernah dibuat → hindari terlalu banyak link ke satu artikel
 * - Batasi: satu artikel target maks menerima 5 link baru per bulan
 */

const { query } = require('../db');
const logger    = require('../utils/logger');

const AGENT = 'LinkIntelligence';
const MAX_CROSS_SITE_LINKS   = 3;
const MAX_INCOMING_PER_MONTH = 5;

/**
 * Cari artikel relevan lintas semua site untuk dijadikan cross-site internal link.
 *
 * @param {object} params
 * @param {string} params.currentArticleId   - ID artikel yang sedang diproses
 * @param {string} params.currentSiteId      - Site artikel yang sedang diproses
 * @param {string} params.title              - Judul artikel
 * @param {string[]} params.keywords         - [mainKeyword, ...lsiKeywords]
 * @param {string} params.category           - Kategori artikel
 * @returns {Promise<Array>}                 - Array link objects { id, title, url, anchorText, siteId, siteName }
 */
async function findCrossSiteLinks({ currentArticleId, currentSiteId, title, keywords = [], category }) {
  try {
    if (!keywords.length && !title) return [];

    // ── Kumpulkan semua keyword untuk scoring ─────────────────────────
    const allKeywords = [
      ...keywords.map(k => k.toLowerCase()),
      ...title.toLowerCase().split(/\s+/).filter(w => w.length > 4),
    ];
    const uniqueKeywords = [...new Set(allKeywords)].slice(0, 15);

    // ── Query artikel dari semua site lain (atau site yang sama) yang sudah published ──
    // Exclude artikel saat ini, prioritaskan high E-E-A-T
    const { rows: candidates } = await query(
      `SELECT a.id, a.title, a.wordpress_url, a.site_id, a.eeat_score, a.quality_score,
              a.category, s.name AS site_name, s.url AS site_url
       FROM articles a
       LEFT JOIN sites s ON s.id = a.site_id
       WHERE a.status = 'published'
         AND a.wordpress_url IS NOT NULL
         AND a.wordpress_url != ''
         AND a.id != $1
         AND s.status = 'active'
       ORDER BY a.eeat_score DESC NULLS LAST, a.quality_score DESC NULLS LAST
       LIMIT 100`,
      [currentArticleId]
    );

    if (!candidates.length) return [];

    // ── Score setiap kandidat berdasarkan keyword overlap ─────────────
    const scored = candidates
      .map(candidate => {
        const cText = `${candidate.title} ${candidate.category || ''}`.toLowerCase();
        const kwOverlap = uniqueKeywords.filter(kw => cText.includes(kw)).length;
        const catMatch  = candidate.category === category ? 2 : 0;
        const isSameSite = candidate.site_id === currentSiteId ? 1 : 0;
        // Cross-site bonus (lebih diutamakan untuk Link Intelligence)
        const crossSiteBonus = candidate.site_id !== currentSiteId ? 1.5 : 1.0;
        const eeAtBonus = (candidate.eeat_score || 0) / 100;

        const rawScore = (kwOverlap * 3 + catMatch + isSameSite) * crossSiteBonus + eeAtBonus;
        return { ...candidate, score: rawScore, kwOverlap };
      })
      .filter(c => c.kwOverlap > 0 || c.score > 0)
      .sort((a, b) => b.score - a.score);

    if (!scored.length) return [];

    // ── Filter: hindari artikel yang sudah terlalu banyak menerima link bulan ini ──
    const topCandidates = scored.slice(0, 15);
    const candidateIds  = topCandidates.map(c => c.id);

    // Cek berapa banyak link yang sudah diterima masing-masing artikel bulan ini
    const { rows: linkCounts } = await query(
      `SELECT target_article_id, COUNT(*) AS cnt
       FROM article_links
       WHERE target_article_id = ANY($1::uuid[])
         AND created_at > NOW() - INTERVAL '30 days'
       GROUP BY target_article_id`,
      [candidateIds]
    );
    const incomingMap = {};
    linkCounts.forEach(r => { incomingMap[r.target_article_id] = parseInt(r.cnt, 10); });

    // Filter yang sudah terlalu banyak
    const eligible = topCandidates.filter(c => (incomingMap[c.id] || 0) < MAX_INCOMING_PER_MONTH);

    // ── Pilih top N dengan anchor text yang bervariasi ────────────────
    const selected = [];
    const usedAnchors = new Set();

    for (const candidate of eligible) {
      if (selected.length >= MAX_CROSS_SITE_LINKS) break;

      // Generate anchor text: cari keyword overlap yang tepat sebagai anchor
      const anchorKeyword = uniqueKeywords.find(kw => candidate.title.toLowerCase().includes(kw));
      const anchor = anchorKeyword
        ? `${anchorKeyword.charAt(0).toUpperCase()}${anchorKeyword.slice(1)}`
        : candidate.title.split(':')[0].trim().slice(0, 50);

      // Variasi: jangan anchor yang sama persis
      if (usedAnchors.has(anchor.toLowerCase())) continue;
      usedAnchors.add(anchor.toLowerCase());

      selected.push({
        id:         candidate.id,
        title:      candidate.title,
        url:        candidate.wordpress_url,
        anchorText: anchor,
        siteId:     candidate.site_id,
        siteName:   candidate.site_name,
        eeatScore:  candidate.eeat_score,
        isCrossSite: candidate.site_id !== currentSiteId,
      });
    }

    return selected;
  } catch (err) {
    logger.error(AGENT, `findCrossSiteLinks error: ${err.message}`, {});
    return [];
  }
}

/**
 * Catat link yang dibuat ke tabel article_links.
 * Dipanggil oleh SEO Agent setelah final link selection.
 *
 * @param {string} sourceArticleId - Artikel yang memuat link
 * @param {Array}  links           - Array link objects dari findCrossSiteLinks
 */
async function recordLinks(sourceArticleId, links = []) {
  if (!links.length) return;
  try {
    for (const link of links) {
      if (!link.id) continue;
      await query(
        `INSERT INTO article_links (source_article_id, target_article_id, target_url, anchor_text, is_cross_site)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (source_article_id, target_article_id) DO UPDATE
           SET anchor_text = EXCLUDED.anchor_text, updated_at = NOW()`,
        [sourceArticleId, link.id, link.url, link.anchorText, link.isCrossSite || false]
      );
    }
  } catch (err) {
    logger.warn(AGENT, `recordLinks error: ${err.message}`, { sourceArticleId });
  }
}

/**
 * Statistik link network: digunakan oleh Analytics.
 */
async function getLinkNetworkStats() {
  try {
    const { rows } = await query(
      `SELECT
         COUNT(*)                                         AS total_links,
         COUNT(*) FILTER (WHERE is_cross_site = true)    AS cross_site_links,
         COUNT(*) FILTER (WHERE is_cross_site = false)   AS same_site_links,
         COUNT(DISTINCT source_article_id)               AS source_articles,
         COUNT(DISTINCT target_article_id)               AS target_articles
       FROM article_links
       WHERE created_at > NOW() - INTERVAL '30 days'`
    );
    return rows[0] || {};
  } catch (err) {
    return {};
  }
}

/**
 * Top artikel yang paling banyak menerima link (authority pages).
 */
async function getTopLinkedArticles(limit = 10) {
  try {
    const { rows } = await query(
      `SELECT a.id, a.title, a.wordpress_url, s.name AS site_name,
              COUNT(al.id) AS incoming_links,
              AVG(a.eeat_score)::numeric(4,1) AS avg_eeat
       FROM article_links al
       JOIN articles a ON a.id = al.target_article_id
       LEFT JOIN sites s ON s.id = a.site_id
       GROUP BY a.id, a.title, a.wordpress_url, s.name
       ORDER BY incoming_links DESC
       LIMIT $1`,
      [limit]
    );
    return rows;
  } catch (err) {
    return [];
  }
}

module.exports = { findCrossSiteLinks, recordLinks, getLinkNetworkStats, getTopLinkedArticles };
