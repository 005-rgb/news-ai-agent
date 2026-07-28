'use strict';

/**
 * Fotografer Agent — Phase 5 (Step 5.1 + 5.2)
 * Input:  { siteId, category }
 * Output: { featured: ImageObj, additional: ImageObj[] }
 *
 * Pipeline per placeholder:
 *  1. Cek kuota image API (UNSPLASH_ACCESS_KEY / PEXELS_API_KEY)
 *  2. Generate image query bahasa Inggris dari deskripsi placeholder via LLM
 *  3. Coba Unsplash API → jika gagal/tidak ada key: Pexels → fallback placeholder branded
 *  4. Generate alt text SEO
 *  5. Update articles.image_data
 *  6. Set status → 'seo', enqueue SEO job
 */

const BaseAgent = require('./base');
const { query } = require('../db');
const { enqueueJob } = require('../services/jobQueue');
const axios = require('axios');
const config = require('../config');

class PhotographerAgent extends BaseAgent {
  constructor() { super('PhotographerAgent'); }

  // ── Main entry point ─────────────────────────────────────────────────────

  async run(articleId, payload) {
    const { siteId, category } = payload;

    const { rows } = await query(`SELECT * FROM articles WHERE id = $1`, [articleId]);
    if (!rows.length) throw new Error(`Article ${articleId} not found`);
    const article = rows[0];

    await this.log('info', `Mencari gambar untuk artikel: "${article.title}"`, { articleId });
    await query(`UPDATE articles SET status = 'imaging' WHERE id = $1`, [articleId]);

    // Site name for alt text
    let siteName = 'News AI Agent';
    if (siteId) {
      const sr = await query(`SELECT name FROM sites WHERE id = $1`, [siteId]);
      if (sr.rows.length) siteName = sr.rows[0].name;
    }

    const versions = article.content_versions || {};
    const placeholders = Array.isArray(versions.imagePlaceholders) ? versions.imagePlaceholders : [];

    // ── Featured image ──────────────────────────────────────────────────────
    const featuredDesc = placeholders[0]?.description || article.title || category || 'news article Indonesia';
    const featuredQuery = await this.buildImageQuery(featuredDesc, article.title);
    const featured = await this.fetchImage(featuredQuery, article.title, siteName, 'featured');

    // ── Additional images (maks 2) ──────────────────────────────────────────
    const additional = [];
    for (let i = 1; i < Math.min(placeholders.length, 3); i++) {
      const desc = placeholders[i]?.description || featuredDesc;
      const q = await this.buildImageQuery(desc, article.title);
      const img = await this.fetchImage(q, article.title, siteName, `inline-${i}`);
      additional.push(img);
    }

    const imageData = { featured, additional };

    await query(
      `UPDATE articles SET image_data = $1, status = 'seo' WHERE id = $2`,
      [JSON.stringify(imageData), articleId]
    );

    await this.log('info', `Gambar selesai: source=${featured.source}`, { articleId, imageSource: featured.source });

    // ── Enqueue SEO job ─────────────────────────────────────────────────────
    await enqueueJob('SEO', articleId, {
      siteId: siteId || article.site_id,
      category: category || article.category,
    }, 'normal');

    return imageData;
  }

  // ── Build English image query via LLM ────────────────────────────────────

  async buildImageQuery(description, articleTitle) {
    try {
      const prompt = `Convert this Indonesian article description to a concise English image search query (5-8 words max, no quotes):
Description: "${description}"
Article: "${(articleTitle || '').slice(0, 100)}"

Return ONLY the English search query, nothing else.`;

      const result = await this.callLLM(prompt, { maxTokens: 50, temperature: 0.3 });
      const q = (result.text || '').trim().replace(/["']/g, '').slice(0, 100);
      return q || description;
    } catch {
      // Fallback: use description as-is
      return description.slice(0, 100);
    }
  }

  // ── Image fetch orchestrator ─────────────────────────────────────────────

  async fetchImage(imageQuery, articleTitle, siteName, role = 'featured') {
    const keyword = (imageQuery || articleTitle || 'news').slice(0, 80);

    // 1. Try Unsplash
    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
    if (unsplashKey) {
      try {
        return await this.fetchUnsplash(keyword, articleTitle, siteName, role);
      } catch (e) {
        await this.log('warn', `Unsplash gagal: ${e.message}`, { keyword });
      }
    }

    // 2. Try Pexels
    const pexelsKey = process.env.PEXELS_API_KEY;
    if (pexelsKey) {
      try {
        return await this.fetchPexels(keyword, articleTitle, siteName, role);
      } catch (e) {
        await this.log('warn', `Pexels gagal: ${e.message}`, { keyword });
      }
    }

    // 3. Branded placeholder
    return this.buildPlaceholder(keyword, articleTitle, siteName, role);
  }

  // ── Unsplash connector ───────────────────────────────────────────────────

  async fetchUnsplash(keyword, articleTitle, siteName, role) {
    const resp = await axios.get('https://api.unsplash.com/photos/random', {
      params: { query: keyword, orientation: 'landscape', count: 1 },
      headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` },
      timeout: config.imageTimeout,
    });

    const photos = Array.isArray(resp.data) ? resp.data : [resp.data];
    if (!photos.length || !photos[0]) throw new Error('No Unsplash result');
    const photo = photos[0];

    return {
      source: 'unsplash',
      role,
      url: photo.urls?.regular || photo.urls?.full,
      urlFull: photo.urls?.full,
      urlThumb: photo.urls?.thumb,
      width: photo.width,
      height: photo.height,
      altText: this.buildAltText(keyword, articleTitle, siteName),
      caption: photo.description || photo.alt_description || '',
      credit: `Photo by ${photo.user?.name || 'Unsplash'} on Unsplash`,
      creditUrl: photo.user?.links?.html || 'https://unsplash.com',
      downloadUrl: photo.links?.download_location,
      license: 'Unsplash License',
    };
  }

  // ── Pexels connector ─────────────────────────────────────────────────────

  async fetchPexels(keyword, articleTitle, siteName, role) {
    const resp = await axios.get('https://api.pexels.com/v1/search', {
      params: { query: keyword, per_page: 5, orientation: 'landscape' },
      headers: { Authorization: process.env.PEXELS_API_KEY },
      timeout: config.imageTimeout,
    });

    const photos = resp.data?.photos || [];
    if (!photos.length) throw new Error('No Pexels result');

    // Pick a random one from top 5 for variety
    const photo = photos[Math.floor(Math.random() * Math.min(photos.length, 5))];

    return {
      source: 'pexels',
      role,
      url: photo.src?.large || photo.src?.original,
      urlFull: photo.src?.original,
      urlThumb: photo.src?.medium,
      width: photo.width,
      height: photo.height,
      altText: this.buildAltText(keyword, articleTitle, siteName),
      caption: photo.alt || '',
      credit: `Photo by ${photo.photographer || 'Pexels'} on Pexels`,
      creditUrl: photo.photographer_url || 'https://www.pexels.com',
      license: 'Pexels License',
    };
  }

  // ── Branded placeholder ──────────────────────────────────────────────────

  buildPlaceholder(keyword, articleTitle, siteName, role) {
    // Use picsum.photos as neutral placeholder (no API key required)
    const seed = encodeURIComponent((keyword || articleTitle || 'news').slice(0, 20));
    const width = 1200;
    const height = 630;
    return {
      source: 'placeholder',
      role,
      url: `https://picsum.photos/seed/${seed}/${width}/${height}`,
      urlFull: `https://picsum.photos/seed/${seed}/${width}/${height}`,
      urlThumb: `https://picsum.photos/seed/${seed}/400/210`,
      width,
      height,
      altText: this.buildAltText(keyword, articleTitle, siteName),
      caption: '',
      credit: '',
      creditUrl: '',
      license: 'placeholder',
    };
  }

  // ── Alt text builder ─────────────────────────────────────────────────────

  buildAltText(keyword, articleTitle, siteName) {
    const base = (keyword || articleTitle || '').slice(0, 60);
    return `${base} | ${siteName}`.slice(0, 125);
  }
}

module.exports = PhotographerAgent;
