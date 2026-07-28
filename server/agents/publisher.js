'use strict';

/**
 * WordPress Publisher Agent — Phase 5 (Step 5.4 + 5.5)
 * Input:  { siteId, scheduledAt? }
 * Output: { published: bool, wordpressPostId, wordpressUrl }
 *
 * Pipeline:
 *  1. Ambil artikel + config site dari DB
 *  2. Build HTML WordPress-ready via seoFormatter
 *  3. Upload featured image ke WP Media Library
 *  4. Get/create kategori WordPress
 *  5. Get/create tags WordPress
 *  6. POST /wp/v2/posts dengan semua metadata (Yoast SEO fields)
 *  7. Simpan wordpress_post_id, wordpress_url ke DB
 *  8. Status → 'published'
 *
 * Error handling:
 *  - 401: alert + pause site, log critical
 *  - 429: retry 3x dengan delay eksponensial
 *  - 5xx: retry 3x, lalu dead letter
 *  - No WP config: tandai sebagai 'ready_to_publish' untuk manual
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

    // ── Load artikel ──────────────────────────────────────────────────────
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

    await this.log('info', `Publishing artikel: "${article.title}"`, { articleId });
    await query(`UPDATE articles SET status = 'publishing' WHERE id = $1`, [articleId]);

    // ── Cek apakah WP dikonfigurasi ───────────────────────────────────────
    if (!article.wordpress_api_url || !article.wordpress_username || !article.wordpress_app_password_enc) {
      await this.log('warn', `Site tidak punya konfigurasi WordPress — tandai ready_to_publish`, { articleId });
      await query(
        `UPDATE articles SET status = 'ready_to_publish', last_updated_at = NOW() WHERE id = $1`,
        [articleId]
      );
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

    const siteConfig = {
      name: article.site_name,
      url: article.site_url,
    };

    // ── Build WordPress HTML ──────────────────────────────────────────────
    const wpHtml = buildWordPressHtml(article, siteConfig);

    // ── Tambahkan internal links section ──────────────────────────────────
    const seoData = article.seo_data || {};
    const internalLinks = Array.isArray(seoData.internalLinks) ? seoData.internalLinks : [];
    const htmlWithLinks = this.appendInternalLinks(wpHtml, internalLinks);

    // ── Upload featured image ─────────────────────────────────────────────
    let featuredMediaId = null;
    const imageData = article.image_data || {};
    const featuredImage = imageData.featured;

    if (featuredImage && featuredImage.url && featuredImage.source !== 'placeholder') {
      try {
        featuredMediaId = await this.uploadFeaturedImage(
          wpApiUrl, authHeader, featuredImage, article.title, seoData
        );
      } catch (e) {
        await this.log('warn', `Upload gambar gagal: ${e.message} — publish tanpa featured image`, { articleId });
      }
    }

    // ── Get/create kategori ───────────────────────────────────────────────
    const categoryIds = await this.getOrCreateCategories(
      wpApiUrl, authHeader, article.category, article.site_categories
    );

    // ── Get/create tags ───────────────────────────────────────────────────
    const tagIds = await this.getOrCreateTags(
      wpApiUrl, authHeader, article.tags || []
    );

    // ── Tentukan status dan tanggal publish ───────────────────────────────
    const wpStatus = scheduledAt ? 'future' : 'publish';
    const publishDate = scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString();

    // ── Build post payload ────────────────────────────────────────────────
    const postPayload = {
      title: article.title || '',
      content: htmlWithLinks,
      status: wpStatus,
      date: publishDate,
      categories: categoryIds,
      tags: tagIds,
      ...(featuredMediaId ? { featured_media: featuredMediaId } : {}),
      // Yoast SEO fields (supported if Yoast plugin active)
      meta: {
        _yoast_wpseo_title: seoData.metaTitle || article.title || '',
        _yoast_wpseo_metadesc: seoData.metaDescription || '',
        _yoast_wpseo_focuskw: seoData.focusKeyword || '',
      },
      // Slug
      ...(seoData.slug ? { slug: seoData.slug } : {}),
    };

    // ── POST ke WordPress ─────────────────────────────────────────────────
    let wpPost;
    try {
      wpPost = await this.retry(
        () => this.wpPost(`${wpApiUrl}/wp/v2/posts`, postPayload, authHeader, wpApiUrl),
        3,
        2000
      );
    } catch (err) {
      await this.handleWpError(err, articleId, effectiveSiteId);
      throw err;
    }

    const wordpressPostId = wpPost.id;
    const wordpressUrl = wpPost.link || wpPost.guid?.rendered || '';

    // ── Update DB ─────────────────────────────────────────────────────────
    await query(
      `UPDATE articles
       SET status = 'published',
           wordpress_post_id = $1,
           wordpress_url = $2,
           published_at = NOW(),
           last_updated_at = NOW()
       WHERE id = $3`,
      [wordpressPostId, wordpressUrl, articleId]
    );

    await this.log('info', `✅ Artikel terbit di WordPress: ${wordpressUrl}`, { articleId, wordpressPostId, wordpressUrl });

    return { published: true, wordpressPostId, wordpressUrl };
  }

  // ── Upload featured image ke WP Media Library ────────────────────────────

  async uploadFeaturedImage(wpApiUrl, authHeader, imageObj, articleTitle, seoData) {
    // Download image bytes
    const imgResp = await axios.get(imageObj.url, {
      responseType: 'arraybuffer',
      timeout: config.imageTimeout,
      headers: { 'User-Agent': 'NewsAIAgent/1.0' },
    });

    const contentType = imgResp.headers['content-type'] || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : contentType.includes('gif') ? 'gif' : 'jpg';
    const slug = (seoData.slug || articleTitle || 'article').slice(0, 40).replace(/\s+/g, '-').toLowerCase();
    const filename = `${slug}-featured.${ext}`;

    const mediaResp = await axios.post(`${wpApiUrl}/wp/v2/media`, imgResp.data, {
      headers: {
        Authorization: authHeader,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': contentType,
      },
      timeout: config.imageTimeout,
    });

    const mediaId = mediaResp.data?.id;
    if (!mediaId) throw new Error('WP media upload: no ID returned');

    // Set alt text
    if (imageObj.altText) {
      await axios.post(`${wpApiUrl}/wp/v2/media/${mediaId}`, {
        alt_text: imageObj.altText,
        caption: imageObj.caption || '',
      }, {
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        timeout: 10000,
      }).catch(() => {}); // non-critical
    }

    return mediaId;
  }

  // ── Get or create WordPress category ────────────────────────────────────

  async getOrCreateCategories(wpApiUrl, authHeader, category, siteCategories) {
    const categoryNames = [];

    // Map system category ke nama display Indonesia
    const categoryMap = {
      teknologi: 'Teknologi', bisnis: 'Bisnis', kesehatan: 'Kesehatan',
      pendidikan: 'Pendidikan', olahraga: 'Olahraga', politik: 'Politik',
      hiburan: 'Hiburan', sains: 'Sains', umum: 'Umum', gaya_hidup: 'Gaya Hidup',
    };
    if (category) categoryNames.push(categoryMap[category] || category);
    if (Array.isArray(siteCategories) && siteCategories.length) {
      categoryNames.push(...siteCategories.slice(0, 2));
    }
    if (!categoryNames.length) categoryNames.push('Umum');

    const ids = [];
    for (const name of [...new Set(categoryNames)]) {
      try {
        const slug = name.toLowerCase().replace(/\s+/g, '-');
        // Search existing
        const search = await axios.get(`${wpApiUrl}/wp/v2/categories`, {
          params: { slug, per_page: 1 },
          headers: { Authorization: authHeader },
          timeout: 10000,
        });
        if (search.data && search.data.length) {
          ids.push(search.data[0].id);
        } else {
          // Create new
          const created = await axios.post(`${wpApiUrl}/wp/v2/categories`, { name, slug }, {
            headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
            timeout: 10000,
          });
          if (created.data?.id) ids.push(created.data.id);
        }
      } catch { /* skip failed categories */ }
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
        const search = await axios.get(`${wpApiUrl}/wp/v2/tags`, {
          params: { slug, per_page: 1 },
          headers: { Authorization: authHeader },
          timeout: 8000,
        });
        if (search.data && search.data.length) {
          ids.push(search.data[0].id);
        } else {
          const created = await axios.post(`${wpApiUrl}/wp/v2/tags`, { name, slug }, {
            headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
            timeout: 8000,
          });
          if (created.data?.id) ids.push(created.data.id);
        }
      } catch { /* skip failed tags */ }
    }
    return ids;
  }

  // ── POST ke WP dengan error classification ────────────────────────────────

  async wpPost(url, data, authHeader, wpApiUrl) {
    try {
      const resp = await axios.post(url, data, {
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        timeout: config.wpTimeout,
      });
      return resp.data;
    } catch (err) {
      const status = err.response?.status;
      if (status === 429) {
        // Rate limited — will be retried by retry()
        const retryAfter = parseInt(err.response.headers?.['retry-after'] || '30', 10);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        throw err;
      }
      // Attach WP error message for better logging
      const wpMsg = err.response?.data?.message || err.message;
      const wpCode = err.response?.data?.code || status;
      const enhancedErr = new Error(`WP API ${status || 'error'}: ${wpMsg}`);
      enhancedErr.wpCode = wpCode;
      enhancedErr.wpStatus = status;
      throw enhancedErr;
    }
  }

  // ── Handle WP-specific errors ────────────────────────────────────────────

  async handleWpError(err, articleId, siteId) {
    const status = err.wpStatus;

    if (status === 401 || status === 403) {
      // Credentials invalid → pause site, alert
      await this.log('critical', `WP auth gagal (${status}) untuk site ${siteId} — site di-pause`, { articleId, siteId, wpStatus: status });
      if (siteId) {
        await query(`UPDATE sites SET status = 'paused' WHERE id = $1`, [siteId]).catch(() => {});
      }
      await query(
        `UPDATE articles SET status = 'failed', last_updated_at = NOW() WHERE id = $1`,
        [articleId]
      ).catch(() => {});
    } else {
      await this.log('error', `WP publish gagal: ${err.message}`, { articleId, wpStatus: status });
      await query(
        `UPDATE articles SET status = 'failed', last_updated_at = NOW() WHERE id = $1`,
        [articleId]
      ).catch(() => {});
    }
  }

  // ── Append related articles section ──────────────────────────────────────

  appendInternalLinks(html, internalLinks) {
    if (!internalLinks || !internalLinks.length) return html;

    const linkItems = internalLinks
      .map(l => `<li><a href="${l.url}" title="${l.title}">${l.anchorText || l.title}</a></li>`)
      .join('\n');

    const relatedSection = `\n\n<div class="news-ai-related-articles">
<h3>Baca Juga</h3>
<ul>
${linkItems}
</ul>
</div>`;

    // Insert before the first <script type="application/ld+json"> (schema markup)
    const schemaIdx = html.indexOf('<script type="application/ld+json">');
    if (schemaIdx !== -1) {
      return html.slice(0, schemaIdx) + relatedSection + '\n\n' + html.slice(schemaIdx);
    }
    return html + relatedSection;
  }
}

module.exports = PublisherAgent;
