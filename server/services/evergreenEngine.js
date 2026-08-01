'use strict';

/**
 * Evergreen Update Engine — Phase 10 Step 10.2
 *
 * Cron: setiap malam 02:00 WIB
 * - Query artikel published > 30 hari dengan format evergreen/feature
 * - Fetch sumber aslinya, cek apakah ada info terbaru
 * - Enqueue EVERGREEN_UPDATE job jika ada update
 *
 * Job EVERGREEN_UPDATE pipeline:
 *   Reporter (fetch info terbaru) → Editor (sisipkan seksi "Update [tanggal]") → Publisher (update WP post)
 */

const { query }      = require('../db');
const { enqueueJob } = require('./jobQueue');
const logger         = require('../utils/logger');
const BaseAgent      = require('../agents/base');

const AGENT = 'EvergreenEngine';

// ── Scanner: temukan kandidat dan enqueue update ──────────────────────────────

async function scanAndEnqueueEvergreenUpdates() {
  logger.info(AGENT, 'Scanning evergreen kandidat untuk update malam ini...');

  // Ambil artikel evergreen/feature yang:
  // - Published > 30 hari lalu
  // - Belum di-update dalam 14 hari terakhir
  // - Quality score >= 60 (layak dipertahankan)
  // - Belum ada EVERGREEN_UPDATE job PENDING/PROCESSING untuknya
  const { rows: candidates } = await query(
    `SELECT a.id, a.title, a.content, a.format, a.category, a.brief_data,
            a.site_id, a.wordpress_url, a.wordpress_post_id,
            s.name AS site_name, s.wordpress_api_url, s.status AS site_status
     FROM articles a
     LEFT JOIN sites s ON s.id = a.site_id
     WHERE a.status = 'published'
       AND a.published_at  < NOW() - INTERVAL '30 days'
       AND (a.last_updated_at IS NULL OR a.last_updated_at < NOW() - INTERVAL '14 days')
       AND (
         a.is_evergreen_candidate = true
         OR a.format IN ('evergreen','feature_opini','jurnal_review','feature','berita_mendalam')
       )
       AND (a.quality_score >= 60 OR a.quality_score IS NULL)
       AND s.status = 'active'
       AND NOT EXISTS (
         SELECT 1 FROM job_queue jq
         WHERE jq.article_id = a.id
           AND jq.job_type = 'EVERGREEN_UPDATE'
           AND jq.status IN ('pending','processing')
       )
     ORDER BY a.published_at ASC
     LIMIT 5`
  );

  if (!candidates.length) {
    logger.info(AGENT, 'Tidak ada kandidat evergreen update malam ini.');
    return { enqueued: 0 };
  }

  logger.info(AGENT, `Ditemukan ${candidates.length} kandidat evergreen update`, { titles: candidates.map(c => c.title) });

  let enqueued = 0;
  for (const article of candidates) {
    try {
      await enqueueJob(
        'EVERGREEN_UPDATE',
        article.id,
        {
          siteId: article.site_id,
          originalTitle: article.title,
          originalFormat: article.format,
          originalCategory: article.category,
          wordpressPostId: article.wordpress_post_id,
          wordpressUrl: article.wordpress_url,
        },
        'low',
        // Jadwalkan satu per satu dengan jeda 10 menit agar tidak membebani LLM
        new Date(Date.now() + enqueued * 10 * 60 * 1000)
      );
      enqueued++;
      logger.info(AGENT, `Enqueued EVERGREEN_UPDATE: "${article.title}"`, { articleId: article.id });
    } catch (err) {
      logger.error(AGENT, `Gagal enqueue update untuk "${article.title}": ${err.message}`, { articleId: article.id });
    }
  }

  return { enqueued };
}

// ── Processor: dijalankan oleh job queue ─────────────────────────────────────

class EvergreenUpdateProcessor extends BaseAgent {
  constructor() { super('EvergreenUpdateProcessor'); }

  async run(articleId, payload) {
    const { siteId, originalTitle, originalFormat, originalCategory } = payload;

    await this.log('info', `Memulai evergreen update: "${originalTitle}"`, { articleId });

    // ── Step 1: Load artikel saat ini ───────────────────────────────────
    const { rows: artRows } = await query(
      `SELECT a.*, s.name AS site_name, s.url AS site_url,
              s.wordpress_api_url, s.wordpress_username, s.wordpress_app_password_enc
       FROM articles a
       LEFT JOIN sites s ON s.id = a.site_id
       WHERE a.id = $1`,
      [articleId]
    );
    if (!artRows.length) throw new Error(`Artikel ${articleId} tidak ditemukan`);
    const article = artRows[0];

    // ── Step 2: Research — cari update terbaru dari sumber asli ────────
    const brief   = typeof article.brief_data === 'string'
      ? JSON.parse(article.brief_data || '{}')
      : (article.brief_data || {});
    const topic   = brief.topic || originalTitle;
    const category = originalCategory || article.category || 'umum';

    const updateBrief = await this._researchUpdate(articleId, topic, category, brief);

    if (!updateBrief.hasUpdate) {
      await this.log('info', `Tidak ada info baru untuk "${originalTitle}" — skip`, { articleId });
      await query(`UPDATE articles SET last_updated_at = NOW() WHERE id = $1`, [articleId]);
      return { updated: false, reason: 'no_new_info' };
    }

    // ── Step 3: Generate seksi update ──────────────────────────────────
    const updateSection = await this._generateUpdateSection(article, updateBrief);

    // ── Step 4: Sisipkan seksi update di awal konten ────────────────────
    const tanggal = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const updatedContent = `<div class="news-ai-update-notice">\n<h3>📌 Update ${tanggal}</h3>\n${updateSection}\n</div>\n\n${article.content}`;

    // ── Step 5: Simpan konten yang diperbarui ───────────────────────────
    await query(
      `UPDATE articles
       SET content = $1, status = 'published', last_updated_at = NOW(),
           content_versions = content_versions || $2::jsonb
       WHERE id = $3`,
      [
        updatedContent,
        JSON.stringify({ evergreenUpdate: { date: new Date().toISOString(), summary: updateBrief.summary } }),
        articleId,
      ]
    );

    await this.log('info', `✅ Evergreen update selesai: "${originalTitle}"`, { articleId });

    // ── Step 6: Update ke WordPress jika ada konfigurasi ───────────────
    if (article.wordpress_post_id && article.wordpress_api_url) {
      await this._updateWordPress(article, updatedContent).catch(err => {
        this.log('warn', `WP update gagal untuk evergreen artikel: ${err.message}`, { articleId });
      });
    }

    return { updated: true, title: originalTitle };
  }

  // ── Riset update terbaru ──────────────────────────────────────────────────

  async _researchUpdate(articleId, topic, category, originalBrief) {
    try {
      // Coba fetch dari sumber asal jika ada
      const sourceFetcher = require('./fetchers/rssFetcher');
      const sourceSelector = require('./sourceSelector');

      const sources = await sourceSelector.selectSources(category, 2).catch(() => []);
      let newItems = [];

      for (const src of sources) {
        try {
          const items = await sourceFetcher.fetchRSS(src.url);
          const relevant = (items || []).filter(item => {
            const text = `${item.title || ''} ${item.summary || ''}`.toLowerCase();
            const topicWords = topic.toLowerCase().split(/\s+/).filter(w => w.length > 4);
            return topicWords.some(w => text.includes(w));
          });
          newItems.push(...relevant.slice(0, 3));
        } catch (e) { /* sumber gagal — lanjut */ }
      }

      if (!newItems.length) return { hasUpdate: false };

      // Tanya LLM: apakah ada info baru yang signifikan?
      const prompt = `Kamu adalah editor senior. Artikel lama membahas topik: "${topic}".

Berikut konten terbaru dari sumber-sumber berita:
${newItems.slice(0, 5).map((item, i) => `[${i+1}] ${item.title}: ${item.summary || item.content || ''}`.slice(0, 300)).join('\n')}

Pertanyaan: Apakah ada FAKTA BARU atau PERKEMBANGAN SIGNIFIKAN yang belum ada di artikel lama?

Jawab dalam JSON:
{
  "hasUpdate": true/false,
  "summary": "<ringkasan 1-2 kalimat perkembangan terbaru, atau kosong jika tidak ada>",
  "newFacts": ["fakta baru 1", "fakta baru 2"],
  "sources": ["judul sumber 1", "judul sumber 2"]
}`;

      const result = await this.callLLM(prompt, { maxTokens: 400, temperature: 0.2 });
      const cleaned = result.text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
      return JSON.parse(cleaned);
    } catch (e) {
      await this.log('warn', `Research update gagal: ${e.message}`, { articleId });
      return { hasUpdate: false };
    }
  }

  // ── Generate teks seksi update ─────────────────────────────────────────────

  async _generateUpdateSection(article, updateBrief) {
    const prompt = `Kamu adalah editor jurnalis Indonesia. Tulis seksi UPDATE untuk artikel yang sudah ada.

Topik artikel: ${article.title}
Perkembangan terbaru: ${updateBrief.summary}
Fakta baru:
${(updateBrief.newFacts || []).map(f => `- ${f}`).join('\n')}

Tulis 2–3 paragraf pendek (masing-masing 2–3 kalimat) yang:
- Menjelaskan perkembangan terbaru secara jelas dan faktual
- Menggunakan bahasa Indonesia jurnalistik yang natural
- Tidak mengulangi konten artikel asli
- Langsung ke inti informasi baru

Kembalikan hanya teks HTML (gunakan <p> untuk paragraf).`;

    const result = await this.callLLM(prompt, { maxTokens: 600, temperature: 0.5 });
    return result.text.trim();
  }

  // ── Update ke WordPress ───────────────────────────────────────────────────

  async _updateWordPress(article, updatedContent) {
    const { decrypt } = require('../utils/encryption');
    const axios        = require('axios');
    const config       = require('../config');

    const wpPassword = decrypt(article.wordpress_app_password_enc);
    const credentials = Buffer.from(`${article.wordpress_username}:${wpPassword}`).toString('base64');
    const wpApiUrl    = article.wordpress_api_url.replace(/\/$/, '');

    await axios.post(
      `${wpApiUrl}/wp/v2/posts/${article.wordpress_post_id}`,
      {
        content: updatedContent,
        modified: new Date().toISOString(),
      },
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        timeout: config.wpTimeout || 30000,
      }
    );

    await this.log('info', `WP post diperbarui: post ID ${article.wordpress_post_id}`, {});
  }
}

module.exports = { scanAndEnqueueEvergreenUpdates, EvergreenUpdateProcessor };
