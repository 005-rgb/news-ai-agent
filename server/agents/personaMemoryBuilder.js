'use strict';

/**
 * PersonaMemoryBuilder — Phase 10 Step 10.1
 *
 * Dipanggil setelah setiap artikel berhasil dipublish ke site X.
 * LLM mengekstrak fingerprint gaya dari artikel → merge (enrich) ke sites.persona_memory.
 * TIDAK replace persona yang sudah ada — hanya memperkaya secara kumulatif.
 */

const BaseAgent = require('./base');
const { query }  = require('../db');

// ── Prompt: ekstrak fingerprint gaya dari satu artikel ───────────────────────

function buildExtractPrompt(article) {
  const preview = (article.content || '').slice(0, 2500);
  return `Kamu adalah analis gaya jurnalistik senior Indonesia.
Analisis artikel berikut dan ekstrak fingerprint gaya penulisannya secara presisi.

=== ARTIKEL ===
Judul: ${article.title}
Format: ${article.format || 'berita'}
Kategori: ${article.category || '-'}
Konten:
${preview}
=== AKHIR ARTIKEL ===

Kembalikan HANYA JSON valid (tanpa penjelasan, tanpa markdown):
{
  "tone": "formal|semi_formal|informal|akademik",
  "opening_style": "<cara artikel dibuka, maks 30 kata>",
  "closing_style": "<cara artikel ditutup, maks 30 kata>",
  "avg_sentence_length": "pendek|sedang|panjang",
  "paragraph_density": "padat (2-3 kalimat)|sedang (3-4)|longgar (4-5+)",
  "vocabulary_level": "populer|semi_teknis|teknis|akademik",
  "quote_usage": "sering|kadang|jarang|tidak ada",
  "distinctive_features": ["fitur khas 1","fitur khas 2","fitur khas 3"],
  "recurring_topics": ["topik/kategori yang dibahas"]
}`;
}

// ── Prompt: merge fingerprint baru ke dalam narasi persona yang sudah ada ────

function buildMergePrompt(existingPersona, fingerprint, siteName) {
  return `Kamu adalah kurator identitas editorial. Tugasmu: perbarui (enrich) profil persona site "${siteName}" berdasarkan data fingerprint terbaru.

ATURAN WAJIB:
- JANGAN hapus atau ganti informasi yang sudah ada
- TAMBAHKAN dan PERKUAT pola yang berulang
- Jika ada kontradiksi: gabungkan menjadi "terkadang X, terkadang Y tergantung konteks"
- Jangan tulis "berdasarkan analisis artikel terbaru" atau frasa meta semacamnya

=== PERSONA SAAT INI ===
${existingPersona || '(belum ada — buat persona baru dari fingerprint berikut)'}

=== FINGERPRINT ARTIKEL TERBARU ===
${JSON.stringify(fingerprint, null, 2)}

Tulis NARASI PERSONA yang diperbarui. Format:
- 3–5 paragraf pendek (masing-masing 2–4 kalimat)
- Deskripsikan: gaya bahasa, tingkat formalitas, cara memulai dan mengakhiri artikel,
  pilihan kosakata, topik yang sering diangkat, karakteristik khas gaya penulisan
- Bahasa Indonesia natural dan ringkas
- Maksimal 450 kata

Tulis hanya narasi persona, tanpa judul, tanpa bullet, tanpa penjelasan tambahan.`;
}

// ── Agent ────────────────────────────────────────────────────────────────────

class PersonaMemoryBuilder extends BaseAgent {
  constructor() { super('PersonaMemoryBuilder'); }

  /**
   * Main entry: dipanggil setelah publisher berhasil publish artikel.
   * Non-blocking — error tidak di-throw agar publisher tidak gagal.
   *
   * @param {string} articleId
   * @param {string} siteId
   */
  async buildForArticle(articleId, siteId) {
    try {
      // ── Load artikel ────────────────────────────────────────────────────
      const { rows: artRows } = await query(
        `SELECT id, title, content, format, category FROM articles WHERE id = $1`,
        [articleId]
      );
      if (!artRows.length) return;
      const article = artRows[0];

      if (!article.content || article.content.length < 200) {
        await this.log('warn', `Konten artikel terlalu pendek untuk persona extraction`, { articleId });
        return;
      }

      // ── Load site persona saat ini ──────────────────────────────────────
      const { rows: siteRows } = await query(
        `SELECT id, name, persona_memory FROM sites WHERE id = $1`,
        [siteId]
      );
      if (!siteRows.length) return;
      const site = siteRows[0];

      await this.log('info', `Memperbarui persona site "${site.name}" dari artikel "${article.title}"`, { articleId, siteId });

      // ── Step 1: Ekstrak fingerprint ─────────────────────────────────────
      let fingerprint;
      try {
        const extractResult = await this.callLLM(buildExtractPrompt(article), {
          maxTokens: 500,
          temperature: 0.2,
        });
        const cleaned = extractResult.text.trim()
          .replace(/^```json\s*/i, '').replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '');
        fingerprint = JSON.parse(cleaned);
      } catch (e) {
        await this.log('warn', `Fingerprint extraction gagal: ${e.message} — persona tidak diperbarui`, { articleId });
        return;
      }

      // ── Step 2: Merge ke narasi persona ────────────────────────────────
      const mergeResult = await this.callLLM(
        buildMergePrompt(site.persona_memory, fingerprint, site.name),
        { maxTokens: 900, temperature: 0.35 }
      );
      const updatedPersona = mergeResult.text.trim();

      if (updatedPersona.length < 100) {
        await this.log('warn', `Hasil merge persona terlalu pendek (${updatedPersona.length} chars) — dibatalkan`, { siteId });
        return;
      }

      // ── Step 3: Simpan ──────────────────────────────────────────────────
      await query(
        `UPDATE sites SET persona_memory = $1, updated_at = NOW() WHERE id = $2`,
        [updatedPersona, siteId]
      );

      await this.log('info', `✅ Persona site "${site.name}" diperbarui (${updatedPersona.length} chars)`, { siteId });
      return { updated: true, siteId, chars: updatedPersona.length };
    } catch (err) {
      // Non-blocking — log saja, tidak throw
      await this.log('error', `PersonaMemoryBuilder error: ${err.message}`, { articleId, siteId });
    }
  }
}

module.exports = PersonaMemoryBuilder;
