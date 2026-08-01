'use strict';

/**
 * SEO Specialist Agent — Phase 5 (Step 5.3)
 * Input:  { siteId, category }
 * Output: { metaTitle, metaDescription, slug, keywords, internalLinks[], schema }
 *
 * Pipeline:
 *  1. Keyword research via LLM → keyword utama + 5-10 LSI
 *  2. Meta title 50-60 karakter
 *  3. Meta description 150-160 karakter
 *  4. URL slug dari keyword utama
 *  5. Heading structure check
 *  6. Internal links: query DB, cari 2-3 artikel relevan di site yang sama
 *  7. External links: dari brief.sources
 *  8. Keyword density check (flag jika > 2.5%)
 *  9. Schema markup (via seoFormatter)
 *  10. Simpan ke articles.seo_data, status → 'scheduled', enqueue PUBLISH
 */

const BaseAgent = require('./base');
const { query } = require('../db');
const { enqueueJob } = require('../services/jobQueue');
const { generateSchema } = require('../utils/seoFormatter');
const linkIntelligence = require('../services/linkIntelligence');

class SeoSpecialistAgent extends BaseAgent {
  constructor() { super('SeoSpecialistAgent'); }

  // ── Main entry ────────────────────────────────────────────────────────────

  async run(articleId, payload) {
    const { siteId, category } = payload;

    const { rows } = await query(`SELECT a.*, s.name AS site_name, s.url AS site_url FROM articles a LEFT JOIN sites s ON s.id = a.site_id WHERE a.id = $1`, [articleId]);
    if (!rows.length) throw new Error(`Article ${articleId} not found`);
    const article = rows[0];

    await this.log('info', `SEO optimization untuk artikel: "${article.title}"`, { articleId });
    await query(`UPDATE articles SET status = 'seo' WHERE id = $1`, [articleId]);

    const brief = article.brief_data || {};
    const content = article.content || '';
    const title = article.title || '';
    const effectiveSiteId = siteId || article.site_id;
    const siteConfig = { name: article.site_name, url: article.site_url };

    // ── 1. Keyword research ─────────────────────────────────────────────────
    const keywords = await this.runKeywordResearch(title, content, category || article.category);

    // ── 2. Meta title ───────────────────────────────────────────────────────
    const metaTitle = this.buildMetaTitle(title, keywords.main, siteConfig.name);

    // ── 3. Meta description ─────────────────────────────────────────────────
    const metaDescription = await this.buildMetaDescription(title, content, keywords.main);

    // ── 4. URL slug ─────────────────────────────────────────────────────────
    const slug = this.buildSlug(keywords.main || title);

    // ── 5. Heading structure check ──────────────────────────────────────────
    const headingCheck = this.checkHeadings(content, keywords.main);

    // ── 6. Internal links (same-site) + Phase 10: cross-site Link Intelligence
    const sameLinks   = await this.findInternalLinks(effectiveSiteId, title, keywords, articleId);
    let crossLinks    = [];
    try {
      crossLinks = await linkIntelligence.findCrossSiteLinks({
        currentArticleId: articleId,
        currentSiteId:    effectiveSiteId,
        title,
        keywords: [keywords.main, ...(keywords.lsi || [])].filter(Boolean),
        category: category || article.category,
      });
    } catch (e) {
      await this.log('warn', `Cross-site link intelligence gagal: ${e.message}`, { articleId });
    }
    // Gabungkan: same-site diutamakan, cross-site sebagai tambahan (total maks 5)
    const internalLinks = [...sameLinks, ...crossLinks.filter(c => c.isCrossSite)].slice(0, 5);

    // ── 7. External links (from brief sources) ──────────────────────────────
    const externalLinks = this.extractExternalLinks(brief);

    // ── 8. Keyword density ──────────────────────────────────────────────────
    const densityInfo = this.calcKeywordDensity(content, keywords.main);

    // ── 9. Schema markup ────────────────────────────────────────────────────
    const schemas = generateSchema(article, article.format || 'berita_singkat', siteConfig);

    const seoData = {
      metaTitle,
      metaDescription,
      slug,
      focusKeyword: keywords.main,
      lsiKeywords: keywords.lsi,
      headingCheck,
      internalLinks,
      externalLinks,
      keywordDensity: densityInfo,
      schemas,
      optimizedAt: new Date().toISOString(),
    };

    // Save seo_data, update article tags, set status scheduled
    const articleTags = keywords.lsi.slice(0, 5);
    await query(
      `UPDATE articles SET seo_data = $1, tags = $2, status = 'scheduled', schema_markup = $3, last_updated_at = NOW() WHERE id = $4`,
      [JSON.stringify(seoData), articleTags, JSON.stringify(schemas), articleId]
    );

    await this.log('info', `SEO selesai: slug="${slug}", keyword="${keywords.main}", density=${densityInfo.percent}%`, { articleId });

    // ── Phase 10 Step 10.3: Catat link yang dibuat ke article_links ─────────
    const allLinks = internalLinks.filter(l => l.id);
    if (allLinks.length) {
      linkIntelligence.recordLinks(articleId, allLinks).catch(() => {});
    }

    // ── Enqueue PUBLISH ─────────────────────────────────────────────────────
    await enqueueJob('PUBLISH', articleId, {
      siteId: effectiveSiteId,
      scheduledAt: null, // publish immediately
    }, 'normal');

    return seoData;
  }

  // ── Keyword research via LLM ─────────────────────────────────────────────

  async runKeywordResearch(title, content, category) {
    const snippet = content.slice(0, 2000);
    const prompt = `Kamu adalah SEO specialist Indonesia. Analisis artikel ini dan identifikasi keyword.

Judul: "${title}"
Kategori: ${category || 'umum'}
Konten (ringkasan): ${snippet}

Kembalikan HANYA JSON valid:
{
  "mainKeyword": "satu keyword utama paling relevan (2-5 kata)",
  "lsiKeywords": ["keyword lsi 1", "keyword lsi 2", "keyword lsi 3", "keyword lsi 4", "keyword lsi 5"]
}

Keyword harus:
- Bahasa Indonesia
- Relevan dengan konten
- Yang kemungkinan dicari orang Indonesia di Google`;

    try {
      const result = await this.retry(
        () => this.callLLM(prompt, { maxTokens: 300, temperature: 0.3 }),
        2
      );
      const raw = result.text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(raw);
      return {
        main: (parsed.mainKeyword || title.split(' ').slice(0, 4).join(' ')).slice(0, 60),
        lsi: Array.isArray(parsed.lsiKeywords) ? parsed.lsiKeywords.slice(0, 10).map(k => String(k).slice(0, 60)) : [],
      };
    } catch (e) {
      await this.log('warn', `Keyword research LLM gagal: ${e.message} — fallback ke title`, {});
      const words = title.split(/\s+/).filter(w => w.length > 3);
      return {
        main: words.slice(0, 4).join(' ') || title,
        lsi: words.slice(0, 5),
      };
    }
  }

  // ── Meta title (50-60 chars) ─────────────────────────────────────────────

  buildMetaTitle(title, mainKeyword, siteName) {
    // Try: "[Title] | [SiteName]" — ensure keyword is included
    const base = title || mainKeyword || '';
    const suffix = siteName ? ` | ${siteName}` : '';
    let metaTitle = base + suffix;

    if (metaTitle.length > 60) {
      // Truncate title to fit
      const maxBase = 60 - suffix.length - 1;
      metaTitle = base.slice(0, maxBase).trimEnd() + suffix;
    }
    if (metaTitle.length < 30 && mainKeyword && !base.toLowerCase().includes(mainKeyword.toLowerCase())) {
      // Inject keyword if title is too short
      metaTitle = `${mainKeyword} - ${base}${suffix}`.slice(0, 60);
    }
    return metaTitle.slice(0, 70); // hard cap
  }

  // ── Meta description (150-160 chars) ────────────────────────────────────

  async buildMetaDescription(title, content, mainKeyword) {
    // Try to extract a natural description from the first paragraph
    const firstPara = content.split(/\n\n+/)[0] || content;
    const snippet = firstPara.replace(/\n/g, ' ').trim().slice(0, 200);

    if (snippet.length >= 100) {
      // Build from content
      const desc = this.trimToSentence(snippet, 155);
      if (desc.length >= 100) return desc;
    }

    // LLM fallback
    try {
      const prompt = `Buat meta description SEO untuk artikel ini dalam Bahasa Indonesia.
Judul: "${title}"
Keyword utama: "${mainKeyword}"
Isi: "${snippet}"

Syarat:
- 150-160 karakter
- Mengandung keyword utama
- Ada CTA natural (Baca selengkapnya, Temukan, Pelajari, dll)
- Deskriptif dan menarik

Kembalikan HANYA teks meta description, tanpa tanda kutip.`;

      const result = await this.callLLM(prompt, { maxTokens: 100, temperature: 0.4 });
      const desc = (result.text || '').trim().replace(/^["']|["']$/g, '');
      if (desc.length >= 50) return desc.slice(0, 160);
    } catch { /* fallback below */ }

    // Hard fallback
    return this.trimToSentence(`${mainKeyword || title} — ${snippet}`, 155);
  }

  trimToSentence(text, maxLen) {
    if (text.length <= maxLen) return text;
    const cut = text.slice(0, maxLen);
    const lastDot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    if (lastDot > maxLen * 0.7) return cut.slice(0, lastDot + 1);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '…';
  }

  // ── URL slug ─────────────────────────────────────────────────────────────

  buildSlug(text) {
    const stopWords = new Set(['dan', 'di', 'ke', 'dari', 'yang', 'untuk', 'pada', 'dengan', 'ini', 'itu', 'adalah', 'the', 'a', 'an', 'of', 'in', 'to']);
    return text
      .toLowerCase()
      .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[^a-z0-9\s-]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 1 && !stopWords.has(w))
      .join('-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
  }

  // ── Heading structure ────────────────────────────────────────────────────

  checkHeadings(content, mainKeyword) {
    const h2s = (content.match(/^## .+$/gm) || []).length;
    const h3s = (content.match(/^### .+$/gm) || []).length;
    const keywordInHeading = mainKeyword
      ? (content.match(/^##+ .+$/gm) || []).some(h => h.toLowerCase().includes(mainKeyword.toLowerCase()))
      : false;
    return { h2Count: h2s, h3Count: h3s, keywordInHeading };
  }

  // ── Internal links from DB ───────────────────────────────────────────────

  async findInternalLinks(siteId, articleTitle, keywords, excludeId) {
    if (!siteId) return [];
    try {
      const { rows } = await query(
        `SELECT id, title, wordpress_url, category
         FROM articles
         WHERE site_id = $1
           AND id != $2
           AND status = 'published'
           AND wordpress_url IS NOT NULL
         ORDER BY published_at DESC
         LIMIT 30`,
        [siteId, excludeId]
      );
      if (!rows.length) return [];

      const allKeywords = [keywords.main, ...keywords.lsi].filter(Boolean).map(k => k.toLowerCase());
      const titleWords = articleTitle.toLowerCase().split(/\s+/).filter(w => w.length > 4);

      // Score each candidate by keyword overlap
      const scored = rows.map(r => {
        const rTitle = (r.title || '').toLowerCase();
        const rWords = rTitle.split(/\s+/).filter(w => w.length > 4);
        const kwOverlap = allKeywords.filter(kw => rTitle.includes(kw)).length;
        const titleOverlap = titleWords.filter(w => rWords.includes(w)).length;
        return { ...r, score: kwOverlap * 3 + titleOverlap };
      }).filter(r => r.score > 0).sort((a, b) => b.score - a.score);

      // Top 3 relevant articles
      return scored.slice(0, 3).map(r => ({
        id: r.id,
        title: r.title,
        url: r.wordpress_url,
        anchorText: r.title,
      }));
    } catch (e) {
      await this.log('warn', `Internal link query gagal: ${e.message}`, {});
      return [];
    }
  }

  // ── External links from brief ────────────────────────────────────────────

  extractExternalLinks(brief) {
    const sources = Array.isArray(brief.sources) ? brief.sources : [];
    return sources
      .filter(s => s.url && s.url.startsWith('http'))
      .slice(0, 2)
      .map(s => ({ url: s.url, title: s.name || s.title || s.url, isExternal: true }));
  }

  // ── Keyword density ──────────────────────────────────────────────────────

  calcKeywordDensity(content, mainKeyword) {
    if (!mainKeyword || !content) return { percent: 0, count: 0, flagged: false };
    const words = content.split(/\s+/).length;
    const kwWords = mainKeyword.split(/\s+/).length;
    const regex = new RegExp(mainKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const count = (content.match(regex) || []).length;
    const percent = words > 0 ? Math.round((count * kwWords / words) * 1000) / 10 : 0;
    return { percent, count, wordCount: words, flagged: percent > 2.5 };
  }
}

module.exports = SeoSpecialistAgent;
