'use strict';

/**
 * WordPress Publisher Agent — Phase 5 (Step 5.4 + 5.5)
 * Input:  { siteId, scheduledAt? }
 * Output: { published: bool, wordpressPostId, wordpressUrl }
 *
 * Pipeline:
 *  1. Load artikel + site config dari DB
 *  2. Build HTML WordPress-ready via seoFormatter
 *  3. Upload featured image ke WP Media Library
 *     - Handle: base64 data (Imagen 3), URL download (DALL-E / Unsplash / Pexels / placeholder)
 *  4. Get/create kategori WordPress
 *  5. Get/create tags WordPress
 *  6. Append internal links ("Baca Juga") sebelum schema
 *  7. Append external source links ("Referensi") dari brief
 *  8. POST /wp/v2/posts dengan Yoast SEO fields
 *  9. Simpan wordpress_post_id, wordpress_url, status → published
 *
 * Error handling:
 *  - No WP config    → status ready_to_publish (graceful)
 *  - 401/403         → pause site + mark failed
 *  - 429             → tunggu Retry-After + retry
 *  - 5xx / network   → retry 3x exponential, lalu dead letter
 */

const BaseAgent = require('./base');
const { query } = require('../db');
const { decrypt } = require('../utils/encryption');
const { buildWordPressHtml } = require('../utils/seoFormatter');
const axios = require('axios');
const config = require('../config');

class PublisherAgent extends BaseAgent {
  constructor() { super('PublisherAgent'); }

  // ── Main entry point ─────────────────────────────────────────────────────

  async run(articleId, payload) {
    const { siteId, scheduledAt } = payload;

    // ── Load artikel + site ───────────────────────────────────────────────
    const { rows: artRows } = await query(
      `SELECT a.*, s.wordpress_api_url, s.wordpress_username, s.wordpress_app_password_enc,
              s.name AS site_name, s.url AS site_url, s.categories AS site_categories
       FROM articles a
       LEFT JOIN sites s ON s.id = a.site_id
       WHERE a.id = $1`,
      [articleId]
    );
    if (!artRows.length) throw new Error(`Article ${articleId} not found`);
    const article = artRows[0];
    const effectiveSiteId = siteId || article.site_id;

    await this.log('info', `Publishing: "${article.title}"`, { articleId });
    await query(`UPDATE articles SET status = 'publishing' WHERE id = $1`, [articleId]);

    // ── Cek WP config ─────────────────────────────────────────────────────
    if (!article.wordpress_api_url || !article.wordpress_username || !article.wordpress_app_password_enc) {
      await this.log('warn', `Site tidak punya konfigurasi WordPress — status: ready_to_publish`, { articleId });
      await query(`UPDATE articles SET status = 'ready_to_publish', last_updated_at = NOW() WHERE id = $1`, [articleId]);
      return { published: false, reason: 'no_wp_config' };
    }

    // ── Dekripsi kredensial ───────────────────────────────────────────────
    let wpPassword;
    try {
      wpPassword = decrypt(article.wordpress_app_password_enc);
    } catch (e) {
      throw new Error(`Gagal dekripsi WP password: ${e.message}`);
    }

    const wpApiUrl = article.wordpress_api_url.replace(/\/$/, '');
    const credentials = Buffer.from(`${article.wordpress_username}:${wpPassword}`).toString('base64');
    const authHeader = `Basic ${credentials}`;
    const siteConfig = { name: article.site_name, url: article.site_url };

    // ── Build HTML ────────────────────────────────────────────────────────
    let wpHtml = buildWordPressHtml(article, siteConfig);

    // ── Tambahkan internal links + external links ─────────────────────────
    const seoData = typeof article.seo_data === 'string'
      ? JSON.parse(article.seo_data || '{}')
      : (article.seo_data || {});
    const brief = typeof article.brief_data === 'string'
      ? JSON.parse(article.brief_data || '{}')
      : (article.brief_data || {});

    wpHtml = this.appendRelatedSection(wpHtml, seoData.internalLinks || [], seoData.externalLinks || [], brief);

    // ── Upload featured image ─────────────────────────────────────────────
    let featuredMediaId = null;
    const imageData = typeof article.image_data === 'string'
      ? JSON.parse(article.image_data || '{}')
      : (article.image_data || {});
    const featuredImage = imageData.featured;

    if (featuredImage && featuredImage.source !== 'placeholder') {
      try {
        featuredMediaId = await this.uploadFeaturedImage(wpApiUrl, authHeader, featuredImage, article.title, seoData);
      } catch (e) {
        await this.log('warn', `Upload gambar gagal: ${e.message} — publish tanpa featured image`, { articleId });
      }
    }

    // ── Kategori & tags ───────────────────────────────────────────────────
    const categoryIds = await this.getOrCreateCategories(wpApiUrl, authHeader, article.category, article.site_categories);
    const tagIds = await this.getOrCreateTags(wpApiUrl, authHeader, article.tags || []);

    // ── Status dan tanggal publish ────────────────────────────────────────
    const wpStatus = scheduledAt ? 'future' : 'publish';
    const publishDate = scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString();

    // ── Post payload ──────────────────────────────────────────────────────
    const postPayload = {
      title:      article.title || '',
      content:    wpHtml,
      status:     wpStatus,
      date:       publishDate,
      categories: categoryIds,
      tags:       tagIds,
      ...(featuredMediaId ? { featured_media: featuredMediaId } : {}),
      ...(seoData.slug    ? { slug: seoData.slug }             : {}),
      meta: {
        _yoast_wpseo_title:    seoData.metaTitle       || article.title || '',
        _yoast_wpseo_metadesc: seoData.metaDescription || '',
        _yoast_wpseo_focuskw:  seoData.focusKeyword    || '',
      },
    };

    // ── POST ke WordPress (retry 3x) ──────────────────────────────────────
    let wpPost;
    try {
      wpPost = await this.retry(
        () => this.wpRequest('POST', `${wpApiUrl}/wp/v2/posts`, postPayload, authHeader),
        3, 2000
      );
    } catch (err) {
      await this.handleWpError(err, articleId, effectiveSiteId);
      throw err;
    }

    const wordpressPostId = wpPost.id;
    const wordpressUrl    = wpPost.link || wpPost.guid?.rendered || '';

    // ── Update DB ─────────────────────────────────────────────────────────
    await query(
      `UPDATE articles
       SET status = 'published', wordpress_post_id = $1, wordpress_url = $2,
           published_at = NOW(), last_updated_at = NOW()
       WHERE id = $3`,
      [wordpressPostId, wordpressUrl, articleId]
    );

    await this.log('info', `✅ Terbit: ${wordpressUrl}`, { articleId, wordpressPostId, wordpressUrl });

    // ── Phase 10 Step 10.1: Update persona memory (non-blocking) ─────────
    setImmediate(async () => {
      try {
        const PersonaMemoryBuilder = require('./personaMemoryBuilder');
        const pmb = new PersonaMemoryBuilder();
        await pmb.buildForArticle(articleId, effectiveSiteId);
      } catch (e) { /* non-blocking — tidak gagalkan publish */ }
    });

    return { published: true, wordpressPostId, wordpressUrl };
  }

  // ── Upload featured image ─────────────────────────────────────────────────

  async uploadFeaturedImage(wpApiUrl, authHeader, imageObj, articleTitle, seoData) {
    let imageBuffer;
    let mimeType = 'image/jpeg';

    if (imageObj.base64) {
      // AI-generated image (Gemini Imagen 3) — already have bytes as base64
      mimeType = imageObj.mimeType || 'image/png';
      imageBuffer = Buffer.from(imageObj.base64, 'base64');
    } else {
      // URL-based image (DALL-E, Unsplash, Pexels, placeholder)
      const imgUrl = imageObj.url;
      if (!imgUrl || imgUrl.startsWith('data:')) {
        // data: URL fallback (should not happen, but safety)
        const b64match = imgUrl?.match(/^data:([^;]+);base64,(.+)$/);
        if (!b64match) throw new Error('No valid image URL to download');
        mimeType = b64match[1];
        imageBuffer = Buffer.from(b64match[2], 'base64');
      } else {
        const imgResp = await axios.get(imgUrl, {
          responseType: 'arraybuffer',
          timeout: config.imageTimeout,
          headers: { 'User-Agent': 'NewsAIAgent/1.0' },
        });
        const ct = imgResp.headers['content-type'] || 'image/jpeg';
        mimeType = ct.split(';')[0].trim();
        imageBuffer = Buffer.from(imgResp.data);
      }
    }

    const ext   = mimeType.includes('png') ? 'png' : mimeType.includes('gif') ? 'gif' : 'jpg';
    const slug  = (seoData.slug || articleTitle || 'article').slice(0, 40).replace(/\s+/g, '-').toLowerCase();
    const filename = `${slug}-featured.${ext}`;

    const mediaResp = await this.wpRequest(
      'POST', `${wpApiUrl}/wp/v2/media`, imageBuffer,
      authHeader, { 'Content-Disposition': `attachment; filename="${filename}"`, 'Content-Type': mimeType }
    );

    const mediaId = mediaResp?.id;
    if (!mediaId) throw new Error('WP media upload: no ID returned');

    // Set alt text (non-critical)
    if (imageObj.altText) {
      await this.wpRequest('POST', `${wpApiUrl}/wp/v2/media/${mediaId}`,
        { alt_text: imageObj.altText, caption: imageObj.caption || '' }, authHeader
      ).catch(() => {});
    }

    return mediaId;
  }

  // ── Get or create WordPress categories ───────────────────────────────────

  async getOrCreateCategories(wpApiUrl, authHeader, category, siteCategories) {
    const categoryMap = {
      teknologi: 'Teknologi', bisnis: 'Bisnis', kesehatan: 'Kesehatan',
      pendidikan: 'Pendidikan', olahraga: 'Olahraga', politik: 'Politik',
      hiburan: 'Hiburan', sains: 'Sains', umum: 'Umum',
      gaya_hidup: 'Gaya Hidup', akademik: 'Akademik',
    };
    const names = [];
    if (category) names.push(categoryMap[category] || category);
    if (Array.isArray(siteCategories) && siteCategories.length) names.push(...siteCategories.slice(0, 2));
    if (!names.length) names.push('Umum');

    const ids = [];
    for (const name of [...new Set(names)]) {
      try {
        const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const found = await this.wpRequest('GET', `${wpApiUrl}/wp/v2/categories?slug=${slug}&per_page=1`, null, authHeader);
        if (Array.isArray(found) && found.length) { ids.push(found[0].id); continue; }
        const created = await this.wpRequest('POST', `${wpApiUrl}/wp/v2/categories`, { name, slug }, authHeader);
        if (created?.id) ids.push(created.id);
      } catch { /* skip */ }
    }
    return ids;
  }

  // ── Get or create WordPress tags ─────────────────────────────────────────

  async getOrCreateTags(wpApiUrl, authHeader, tags) {
    if (!Array.isArray(tags) || !tags.length) return [];
    const ids = [];
    for (const name of tags.slice(0, 10)) {
      if (!name) continue;
      try {
        const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const found = await this.wpRequest('GET', `${wpApiUrl}/wp/v2/tags?slug=${slug}&per_page=1`, null, authHeader);
        if (Array.isArray(found) && found.length) { ids.push(found[0].id); continue; }
        const created = await this.wpRequest('POST', `${wpApiUrl}/wp/v2/tags`, { name, slug }, authHeader);
        if (created?.id) ids.push(created.id);
      } catch { /* skip */ }
    }
    return ids;
  }

  // ── WordPress HTTP helper ─────────────────────────────────────────────────

  async wpRequest(method, url, data, authHeader, extraHeaders = {}) {
    const isBuffer = Buffer.isBuffer(data);
    const headers = {
      Authorization: authHeader,
      ...(isBuffer ? {} : { 'Content-Type': 'application/json' }),
      ...extraHeaders,
    };

    try {
      let resp;
      if (method === 'GET') {
        resp = await axios.get(url, { headers, timeout: config.wpTimeout });
      } else if (method === 'POST') {
        resp = await axios.post(url, data, { headers, timeout: config.wpTimeout });
      } else {
        resp = await axios({ method, url, data, headers, timeout: config.wpTimeout });
      }
      return resp.data;
    } catch (err) {
      const status = err.response?.status;
      if (status === 429) {
        const retryAfter = parseInt(err.response.headers?.['retry-after'] || '30', 10);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
      }
      const msg = err.response?.data?.message || err.message;
      const enhanced = new Error(`WP ${method} ${status || 'error'}: ${msg}`);
      enhanced.wpStatus = status;
      enhanced.wpCode   = err.response?.data?.code;
      throw enhanced;
    }
  }

  // ── Handle WP-specific error ──────────────────────────────────────────────

  async handleWpError(err, articleId, siteId) {
    const status = err.wpStatus;
    if (status === 401 || status === 403) {
      await this.log('critical', `WP auth gagal (${status}) — site ${siteId} di-pause`, { articleId, siteId });
      if (siteId) await query(`UPDATE sites SET status = 'paused' WHERE id = $1`, [siteId]).catch(() => {});
    } else {
      await this.log('error', `WP publish gagal: ${err.message}`, { articleId, wpStatus: status });
    }
    await query(`UPDATE articles SET status = 'failed', last_updated_at = NOW() WHERE id = $1`, [articleId]).catch(() => {});
  }

  // ── Append related + external links before schema ─────────────────────────

  appendRelatedSection(html, internalLinks, externalLinks, brief) {
    const sections = [];

    // Internal: "Baca Juga"
    if (Array.isArray(internalLinks) && internalLinks.length) {
      const items = internalLinks
        .map(l => `<li><a href="${l.url}" title="${l.title}">${l.anchorText || l.title}</a></li>`)
        .join('\n');
      sections.push(`<div class="news-ai-related">\n<h3>Baca Juga</h3>\n<ul>\n${items}\n</ul>\n</div>`);
    }

    // External: "Referensi" — from seo_data AND brief sources
    const extLinks = [...(externalLinks || [])];
    const briefSources = Array.isArray(brief?.sources) ? brief.sources : [];
    for (const src of briefSources) {
      if (src.url && src.url.startsWith('http') && !extLinks.find(l => l.url === src.url)) {
        extLinks.push({ url: src.url, title: src.name || src.title || src.url, isExternal: true });
      }
    }
    const topExtLinks = extLinks.slice(0, 2);

    if (topExtLinks.length) {
      const items = topExtLinks
        .map(l => `<li><a href="${l.url}" target="_blank" rel="noopener noreferrer">${l.title}</a></li>`)
        .join('\n');
      sections.push(`<div class="news-ai-referensi">\n<h3>Referensi</h3>\n<ul>\n${items}\n</ul>\n</div>`);
    }

    if (!sections.length) return html;

    const block = '\n\n' + sections.join('\n\n') + '\n\n';

    // Insert before first <script type="application/ld+json">
    const schemaIdx = html.indexOf('<script type="application/ld+json">');
    if (schemaIdx !== -1) return html.slice(0, schemaIdx) + block + html.slice(schemaIdx);
    return html + block;
  }
}

module.exports = PublisherAgent;
