'use strict';

/**
 * Fotografer Agent — Phase 5 (Step 5.1 + 5.2)
 * Input:  { siteId, category }
 * Output: { featured: ImageObj, additional: ImageObj[] }
 *
 * Urutan provider per gambar:
 *  1. AI Image Generation (PRIMARY jika kuota ada):
 *       a. Gemini Imagen 3  (gunakan key gemini dari pool)
 *       b. DALL-E 3         (gunakan key openai dari pool)
 *  2. Unsplash API         (jika UNSPLASH_ACCESS_KEY ada)
 *  3. Pexels API           (jika PEXELS_API_KEY ada)
 *  4. picsum.photos        (branded placeholder, selalu berhasil)
 */

'use strict';

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

    await this.log('info', `Fotografer: mencari gambar untuk "${article.title}"`, { articleId });
    await query(`UPDATE articles SET status = 'imaging' WHERE id = $1`, [articleId]);

    // Site name for alt text
    let siteName = 'News AI Agent';
    if (siteId || article.site_id) {
      const sr = await query(`SELECT name FROM sites WHERE id = $1`, [siteId || article.site_id]);
      if (sr.rows.length) siteName = sr.rows[0].name;
    }

    const versions = article.content_versions || {};
    const placeholders = Array.isArray(versions.imagePlaceholders) ? versions.imagePlaceholders : [];

    // ── Featured image ──────────────────────────────────────────────────────
    const featuredDesc = (placeholders[0]?.description || placeholders[0] || article.title || category || 'berita Indonesia').toString();
    const featuredEnQuery = await this.buildEnglishPrompt(featuredDesc, article.title, article.category || category);
    const featured = await this.fetchImage(featuredEnQuery, featuredDesc, article.title, siteName, 'featured');

    // ── Additional images (maks 2) ──────────────────────────────────────────
    const additional = [];
    for (let i = 1; i < Math.min(placeholders.length, 3); i++) {
      const desc = (placeholders[i]?.description || placeholders[i] || featuredDesc).toString();
      const enQ = await this.buildEnglishPrompt(desc, article.title, article.category || category);
      const img = await this.fetchImage(enQ, desc, article.title, siteName, `inline-${i}`);
      additional.push(img);
    }

    const imageData = { featured, additional };

    await query(
      `UPDATE articles SET image_data = $1, status = 'seo' WHERE id = $2`,
      [JSON.stringify(imageData), articleId]
    );

    await this.log('info', `Gambar selesai: source=${featured.source}`, { articleId, imageSource: featured.source });

    // ── Enqueue SEO ─────────────────────────────────────────────────────────
    await enqueueJob('SEO', articleId, {
      siteId: siteId || article.site_id,
      category: category || article.category,
    }, 'normal');

    return imageData;
  }

  // ── Build English prompt via LLM ─────────────────────────────────────────

  async buildEnglishPrompt(description, articleTitle, category) {
    try {
      const prompt = `Convert this Indonesian news article context to a precise English image generation prompt (max 70 words). The prompt must describe a realistic, professional news photograph:
Context: "${description}"
Article: "${(articleTitle || '').slice(0, 120)}"
Category: ${category || 'news'}

Rules:
- Describe a real photographic scene, not illustration
- Include lighting, composition, setting
- No text, logos, or watermarks
- Indonesian context if relevant (people, locations, culture)

Return ONLY the English prompt, nothing else.`;

      const result = await this.callLLM(prompt, { maxTokens: 100, temperature: 0.4 });
      const q = (result.text || '').trim().replace(/^["']|["']$/g, '').slice(0, 200);
      return q || description;
    } catch {
      // Fallback: simple English keyword extraction
      return (articleTitle || description).slice(0, 100);
    }
  }

  // ── Image fetch orchestrator ─────────────────────────────────────────────

  async fetchImage(aiPrompt, description, articleTitle, siteName, role = 'featured') {
    // 1. Try Gemini Imagen 3 (PRIMARY AI generation)
    try {
      return await this.generateGeminiImagen(aiPrompt, articleTitle, siteName, role);
    } catch (e) {
      await this.log('warn', `Imagen 3 skip: ${e.message}`, { role });
    }

    // 2. Try DALL-E 3 (SECONDARY AI generation)
    try {
      return await this.generateDalle3(aiPrompt, articleTitle, siteName, role);
    } catch (e) {
      await this.log('warn', `DALL-E 3 skip: ${e.message}`, { role });
    }

    // 2b. Try Stable Diffusion (TERTIARY AI generation)
    try {
      return await this.generateStableDiffusion(aiPrompt, articleTitle, siteName, role);
    } catch (e) {
      await this.log('warn', `Stable Diffusion skip: ${e.message}`, { role });
    }

    // 3. Try Unsplash
    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
    if (unsplashKey) {
      try {
        // Use shorter keyword for Unsplash search
        const searchQuery = (description || articleTitle || 'news').slice(0, 80);
        return await this.fetchUnsplash(searchQuery, articleTitle, siteName, role);
      } catch (e) {
        await this.log('warn', `Unsplash gagal: ${e.message}`, { role });
      }
    }

    // 4. Try Pexels
    const pexelsKey = process.env.PEXELS_API_KEY;
    if (pexelsKey) {
      try {
        const searchQuery = (description || articleTitle || 'news').slice(0, 80);
        return await this.fetchPexels(searchQuery, articleTitle, siteName, role);
      } catch (e) {
        await this.log('warn', `Pexels gagal: ${e.message}`, { role });
      }
    }

    // 5. Branded placeholder (picsum.photos — always works)
    return this.buildPlaceholder(description || articleTitle, articleTitle, siteName, role);
  }

  // ── Gemini Imagen 3 (PRIMARY) ────────────────────────────────────────────

  async generateGeminiImagen(prompt, articleTitle, siteName, role) {
    // Select Gemini key from pool
    const keyPool = require('../services/keyPool');
    let keyValue;
    try {
      const { keyRow, keyValue: kv } = await keyPool.selectBestKey({ provider: 'gemini' });
      keyValue = kv;
      // Record usage after call succeeds
      this._pendingKeyId = keyRow.id;
    } catch {
      throw new Error('No gemini key available for Imagen');
    }

    const safePrompt = prompt.slice(0, 1000);
    // C-8 Fix: Gunakan endpoint v1 stable, bukan v1beta yang dapat berubah tanpa notice.
    const url = `https://generativelanguage.googleapis.com/v1/models/imagen-3.0-generate-001:predict?key=${keyValue}`;

    const resp = await axios.post(url, {
      instances: [{ prompt: safePrompt }],
      parameters: { sampleCount: 1, aspectRatio: '16:9', safetyFilterLevel: 'block_few' },
    }, { timeout: config.imageTimeout });

    const predictions = resp.data?.predictions;
    if (!Array.isArray(predictions) || !predictions.length) {
      throw new Error('Imagen 3: no predictions returned');
    }

    const pred = predictions[0];
    const mimeType = pred.mimeType || 'image/png';
    const base64 = pred.bytesBase64Encoded;
    if (!base64) throw new Error('Imagen 3: no image data');

    // Record key usage
    if (this._pendingKeyId) {
      await keyPool.recordUsage(this._pendingKeyId, 1, 0).catch(() => {});
    }

    await this.log('info', `Imagen 3 generated (${mimeType})`, { role });

    return {
      source: 'imagen3',
      role,
      url: `data:${mimeType};base64,${base64}`,    // data URL — publisher will decode
      urlFull: `data:${mimeType};base64,${base64}`,
      urlThumb: null,
      mimeType,
      base64,   // stored for direct Buffer creation in publisher
      width: 1216,
      height: 684,
      altText: this.buildAltText(articleTitle, siteName),
      caption: '',
      credit: 'Generated by Google Imagen 3',
      creditUrl: '',
      license: 'AI Generated',
      prompt: safePrompt,
    };
  }

  // ── DALL-E 3 (SECONDARY AI) ──────────────────────────────────────────────

  async generateDalle3(prompt, articleTitle, siteName, role) {
    const keyPool = require('../services/keyPool');
    let keyValue;
    try {
      const { keyRow, keyValue: kv } = await keyPool.selectBestKey({ provider: 'openai' });
      keyValue = kv;
      this._pendingOpenAIKeyId = keyRow.id;
    } catch {
      throw new Error('No openai key available for DALL-E');
    }

    const safePrompt = `Photorealistic news photograph: ${prompt}`.slice(0, 900);

    const resp = await axios.post('https://api.openai.com/v1/images/generations', {
      model: 'dall-e-3',
      prompt: safePrompt,
      n: 1,
      size: '1792x1024',
      quality: 'standard',
      response_format: 'url',
    }, {
      headers: { Authorization: `Bearer ${keyValue}`, 'Content-Type': 'application/json' },
      timeout: config.imageTimeout,
    });

    const imgUrl = resp.data?.data?.[0]?.url;
    if (!imgUrl) throw new Error('DALL-E 3: no URL returned');

    if (this._pendingOpenAIKeyId) {
      await keyPool.recordUsage(this._pendingOpenAIKeyId, 1, 0).catch(() => {});
    }

    await this.log('info', `DALL-E 3 generated`, { role });

    return {
      source: 'dalle3',
      role,
      url: imgUrl,
      urlFull: imgUrl,
      urlThumb: imgUrl,
      width: 1792,
      height: 1024,
      altText: this.buildAltText(articleTitle, siteName),
      caption: '',
      credit: 'Generated by OpenAI DALL-E 3',
      creditUrl: '',
      license: 'AI Generated',
      prompt: safePrompt,
    };
  }

  // ── Stable Diffusion connector (tertiary AI generation) ────────────────────

  async generateStableDiffusion(prompt, articleTitle, siteName, role) {
    const keyPool = require('../services/keyPool');
    let keyValue;
    try {
      const { keyRow, keyValue: kv } = await keyPool.selectBestKey({ provider: 'stability' });
      keyValue = kv;
      this._pendingStabilityKeyId = keyRow.id;
    } catch {
      throw new Error('No stability API key available');
    }

    const safePrompt = `Photorealistic news photograph: ${prompt}`.slice(0, 900);

    const resp = await axios.post(
      'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
      {
        text_prompts: [{ text: safePrompt, weight: 1 }],
        cfg_scale: 7,
        height: 1024,
        width: 1024,
        samples: 1,
        steps: 30,
      },
      {
        headers: { Authorization: `Bearer ${keyValue}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        timeout: config.imageTimeout,
      }
    );

    const b64 = resp.data?.artifacts?.[0]?.base64;
    if (!b64) throw new Error('Stable Diffusion: no image returned');

    if (this._pendingStabilityKeyId) {
      await keyPool.recordUsage(this._pendingStabilityKeyId, 1, 0).catch(() => {});
    }

    await this.log('info', `Stable Diffusion generated`, { role });

    return {
      source: 'stable_diffusion',
      role,
      url: `data:image/png;base64,${b64}`,
      urlFull: `data:image/png;base64,${b64}`,
      urlThumb: `data:image/png;base64,${b64}`,
      width: 1024,
      height: 1024,
      altText: this.buildAltText(articleTitle, siteName),
      caption: '',
      credit: 'Generated by Stable Diffusion XL',
      creditUrl: '',
      license: 'AI Generated',
      prompt: safePrompt,
    };
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
      altText: this.buildAltText(articleTitle, siteName),
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
    const photo = photos[Math.floor(Math.random() * Math.min(photos.length, 5))];

    return {
      source: 'pexels',
      role,
      url: photo.src?.large || photo.src?.original,
      urlFull: photo.src?.original,
      urlThumb: photo.src?.medium,
      width: photo.width,
      height: photo.height,
      altText: this.buildAltText(articleTitle, siteName),
      caption: photo.alt || '',
      credit: `Photo by ${photo.photographer || 'Pexels'} on Pexels`,
      creditUrl: photo.photographer_url || 'https://www.pexels.com',
      license: 'Pexels License',
    };
  }

  // ── Branded placeholder ──────────────────────────────────────────────────

  buildPlaceholder(description, articleTitle, siteName, role) {
    const seed = encodeURIComponent((description || articleTitle || 'news').slice(0, 20).replace(/\s+/g, '-'));
    return {
      source: 'placeholder',
      role,
      url: `https://picsum.photos/seed/${seed}/1200/630`,
      urlFull: `https://picsum.photos/seed/${seed}/1200/630`,
      urlThumb: `https://picsum.photos/seed/${seed}/400/210`,
      width: 1200,
      height: 630,
      altText: this.buildAltText(articleTitle, siteName),
      caption: '',
      credit: '',
      creditUrl: '',
      license: 'placeholder',
    };
  }

  buildAltText(articleTitle, siteName) {
    const base = (articleTitle || '').slice(0, 80);
    return `${base} | ${siteName}`.slice(0, 125);
  }
}

module.exports = PhotographerAgent;
