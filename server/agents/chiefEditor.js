'use strict';

/**
 * ChiefEditorAgent — Phase 6 (generateAdHocTopic) + Phase 9 stub (runRapat)
 *
 * Phase 6 — generateAdHocTopic(siteId, category)
 *   Dipanggil oleh Scheduler saat content_calendar kosong.
 *   Proses:
 *   1. Ambil info site (nama, niche, persona_description)
 *   2. Ambil 10 topik terakhir yang pernah ditulis di site ini (hindari duplikasi)
 *   3. Panggil LLM: "Sarankan topik berita terbaru yang relevan untuk site ini"
 *   4. Return { topic, category, format }
 *
 * Phase 9 — runRapat(context) : stub, akan diimplementasi di Phase 9
 */

const BaseAgent = require('./base');
const { query } = require('../db');

class ChiefEditorAgent extends BaseAgent {
  constructor() { super('ChiefEditorAgent'); }

  // ── Phase 6: Ad-hoc Topic Generator ─────────────────────────────────────────

  /**
   * Generate satu topik artikel yang relevan dan fresh untuk sebuah site.
   * Dipanggil oleh Scheduler saat content_calendar kosong.
   *
   * @param {string} siteId
   * @param {string} category
   * @returns {{ topic: string, category: string, format: string }}
   */
  async generateAdHocTopic(siteId, category = 'umum') {
    await this.log('info', `Generating ad-hoc topic for site ${siteId}, category: ${category}`, { siteId, category });

    // ── 1. Ambil info site ────────────────────────────────────────────────────
    const { rows: siteRows } = await query(
      `SELECT name, niche, categories, persona_description FROM sites WHERE id = $1`,
      [siteId]
    );

    if (!siteRows.length) {
      throw new Error(`Site ${siteId} not found`);
    }

    const site = siteRows[0];
    const siteCategories = site.categories || [category];
    const niche = site.niche || category;

    // ── 2. Ambil topik 14 hari terakhir untuk hindari duplikasi ───────────────
    const { rows: recentArticles } = await query(
      `SELECT title, category FROM articles
       WHERE site_id = $1
         AND created_at > NOW() - INTERVAL '14 days'
       ORDER BY created_at DESC
       LIMIT 20`,
      [siteId]
    );

    const recentTopics = recentArticles.map((a) => `- ${a.title}`).join('\n');

    // ── 3. Pilih format berdasarkan kategori ──────────────────────────────────
    const formatByCategory = {
      akademik:  'jurnal',
      teknologi: 'berita_mendalam',
      politik:   'berita_singkat',
      bisnis:    'berita_mendalam',
      kesehatan: 'feature',
      lifestyle: 'feature',
      olahraga:  'berita_singkat',
      umum:      'berita_singkat',
    };
    const targetFormat = formatByCategory[category] || 'berita_singkat';

    // ── 4. Panggil LLM ────────────────────────────────────────────────────────
    const prompt = `Kamu adalah pemimpin redaksi media online Indonesia yang berpengalaman.

PROFIL SITE:
- Nama: ${site.name}
- Niche: ${niche}
- Kategori utama: ${siteCategories.join(', ')}
${site.persona_description ? `- Karakter editorial: ${site.persona_description}` : ''}

TUGAS:
Sarankan SATU topik artikel terbaru dan relevan untuk kategori "${category}" yang:
1. Sedang hangat dibicarakan di Indonesia (dalam 1-3 hari terakhir)
2. Sesuai niche site di atas
3. Belum pernah ditulis (lihat daftar topik terakhir di bawah)
4. Menarik untuk pembaca Indonesia

TOPIK YANG SUDAH DITULIS (JANGAN DUPLIKASI):
${recentTopics || '(belum ada artikel)'}

INSTRUKSI OUTPUT:
Jawab hanya dengan JSON berikut, tanpa teks lain:
{
  "topic": "judul artikel yang akan ditulis (spesifik, 8-15 kata)",
  "angle": "sudut pandang atau fokus utama artikel (1 kalimat)",
  "category": "${category}",
  "format": "${targetFormat}",
  "reasoning": "mengapa topik ini relevan sekarang (1 kalimat singkat)"
}`;

    let result;
    try {
      const llmResponse = await this.callLLM(prompt, {
        temperature: 0.8,
        maxTokens: 300,
      });

      // Parse JSON dari response LLM
      const jsonMatch = llmResponse.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in LLM response');

      result = JSON.parse(jsonMatch[0]);
    } catch (err) {
      await this.log('warn', `LLM topic generation failed, using fallback: ${err.message}`, { siteId });

      // Fallback: topik generic berdasarkan kategori
      const fallbackTopics = {
        teknologi: `Perkembangan Terbaru Teknologi AI di Indonesia: Apa yang Perlu Diketahui`,
        bisnis:    `Kondisi Ekonomi Indonesia Terkini: Peluang dan Tantangan`,
        kesehatan: `Tips Menjaga Kesehatan di Tengah Perubahan Cuaca Indonesia`,
        politik:   `Perkembangan Politik Indonesia: Isu yang Sedang Dibahas`,
        akademik:  `Penelitian Terbaru dari Universitas Indonesia yang Patut Disimak`,
        olahraga:  `Kabar Terkini Dunia Olahraga Indonesia`,
        lifestyle:  `Tren Gaya Hidup Masyarakat Urban Indonesia Saat Ini`,
        umum:      `Berita Terkini Indonesia yang Penting Diketahui Hari Ini`,
      };

      result = {
        topic: fallbackTopics[category] || fallbackTopics.umum,
        category,
        format: targetFormat,
        angle: 'Liputan berita terkini',
      };
    }

    await this.log('info', `Ad-hoc topic generated: "${result.topic}"`, {
      siteId,
      topic: result.topic,
      category: result.category,
      format: result.format,
      angle: result.angle || '',
    });

    return {
      topic:    result.topic    || `Berita terkini ${category}`,
      category: result.category || category,
      format:   result.format   || targetFormat,
      angle:    result.angle    || '',
    };
  }

  // ── Phase 9 stub ─────────────────────────────────────────────────────────────

  /**
   * Jalankan proses Rapat Redaksi mingguan penuh.
   * Phase 9 implementation — akan diisi di Phase 9.
   *
   * @param {object} context
   * @returns {{ status: string }}
   */
  async runRapat(context = {}) {
    await this.log('info', 'Running Rapat Redaksi (Phase 9 stub)', context);
    return {
      status: 'Phase 9 implementation pending',
      message: 'Rapat Redaksi Engine akan diimplementasi di Phase 9 (Google Trends + Competitor Analysis + Content Calendar Generator)',
      runAt: new Date().toISOString(),
    };
  }
}

module.exports = ChiefEditorAgent;
