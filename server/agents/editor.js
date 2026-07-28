'use strict';

/**
 * Editor Agent — Phase 3 (Step 3.5)
 * Input:  { draft, brief, siteId, format, revisionCount }
 * Output: { editedArticle, qualityScore, changeLog, needsRevision, revisionNotes }
 *
 * Pipeline:
 *  1. Cek akurasi: fakta di draft vs brief
 *  2. Cek duplikasi: cari artikel serupa di DB (simple keyword matching)
 *  3. Cek konsistensi persona (jika ada site)
 *  4. LLM review → artikel diperbaiki + daftar perubahan + score
 *  5. Jika score < 75 && revisionCount < 2: enqueue WRITE lagi
 *  6. Jika lolos: enqueue QC
 */

const BaseAgent = require('./base');
const { query } = require('../db');
const { enqueueJob } = require('../services/jobQueue');

const MAX_REVISIONS = 2;
const QUALITY_THRESHOLD = 75;

async function checkDuplication(siteId, title, content) {
  if (!siteId) return { isDuplicate: false, similarArticles: [] };
  try {
    // Simple keyword overlap check — get recent articles of same site
    const { rows } = await query(
      `SELECT id, title FROM articles
       WHERE site_id = $1 AND status NOT IN ('draft','failed')
       ORDER BY created_at DESC LIMIT 50`,
      [siteId]
    );
    if (!rows.length) return { isDuplicate: false, similarArticles: [] };

    const titleWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const similar = rows.filter(r => {
      const rWords = (r.title || '').toLowerCase().split(/\s+/).filter(w => w.length > 4);
      const overlap = titleWords.filter(w => rWords.includes(w)).length;
      return overlap >= 3;
    });
    return { isDuplicate: similar.length > 0, similarArticles: similar.slice(0, 3) };
  } catch { return { isDuplicate: false, similarArticles: [] }; }
}

function buildEditorPrompt(draft, brief) {
  const factsList = (brief?.facts || []).slice(0, 6).map((f, i) => `${i + 1}. ${f}`).join('\n');
  const quotesList = (brief?.quotes || []).slice(0, 3).map(q => `- "${q.text}" (${q.speaker})`).join('\n');

  return `Kamu adalah editor senior media nasional Indonesia dengan 20 tahun pengalaman.
Review dan perbaiki artikel berikut. Bandingkan dengan brief riset untuk memastikan akurasi.

=== ARTIKEL DRAFT ===
Judul: ${draft.title || ''}

${(draft.mainArticle || '').slice(0, 3000)}

=== BRIEF RISET (FAKTA YANG HARUS ADA) ===
${factsList || 'Tidak ada fakta spesifik.'}

Kutipan narasumber seharusnya ada:
${quotesList || 'Tidak ada kutipan.'}

=== TUGAS EDITOR ===
1. Perbaiki kalimat yang tidak natural (tanda AI-generated)
2. Pastikan semua fakta dalam brief termasuk dalam artikel
3. Hilangkan kalimat klise atau generik
4. Perbaiki struktur paragraf (maks 5 kalimat)
5. Pastikan lead (paragraf 1) menjawab WHO + WHAT dalam 40 kata
6. Berikan skor kualitas 0-100

Kembalikan HANYA JSON valid:
{
  "editedTitle": "judul yang diperbaiki",
  "editedContent": "seluruh konten artikel yang sudah diperbaiki...",
  "changeLog": ["perubahan 1", "perubahan 2"],
  "qualityScore": 0-100,
  "qualityNotes": "catatan kualitas singkat",
  "revisionNeeded": false
}

Catatan: qualityScore < 75 = artikel perlu ditulis ulang (set revisionNeeded: true)`;
}

class EditorAgent extends BaseAgent {
  constructor() { super('EditorAgent'); }

  async run(articleId, payload) {
    const { draft, brief, siteId, format, revisionCount = 0 } = payload;
    await this.log('info', `Editing article ${articleId} (revision ${revisionCount})`, { articleId });
    await query(`UPDATE articles SET status = 'editing' WHERE id = $1`, [articleId]);

    // ── Step 1: Duplikasi check ────────────────────────────────────────────
    const { isDuplicate, similarArticles } = await checkDuplication(siteId, draft?.title || '', draft?.mainArticle || '');
    if (isDuplicate) {
      await this.log('warn', `Potential duplicate detected for "${draft?.title}"`, { similarArticles: similarArticles.map(a => a.title) });
    }

    // ── Step 2: LLM edit & scoring ────────────────────────────────────────
    let editResult = { editedTitle: draft?.title, editedContent: draft?.mainArticle, changeLog: [], qualityScore: 75, qualityNotes: '', revisionNeeded: false };

    try {
      const editPrompt = buildEditorPrompt(draft, brief);
      const llmResult = await this.retry(
        () => this.callLLM(editPrompt, { maxTokens: 3500, temperature: 0.4 }),
        2
      );
      const raw = llmResult.text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
      editResult = JSON.parse(raw);
    } catch (err) {
      await this.log('warn', `Editor LLM failed: ${err.message} — using draft as-is with default score`, { articleId });
      editResult.qualityScore = 70;
      editResult.revisionNeeded = revisionCount < MAX_REVISIONS;
    }

    const qualityScore = Math.max(0, Math.min(100, editResult.qualityScore || 70));
    const needsRevision = (qualityScore < QUALITY_THRESHOLD) && (revisionCount < MAX_REVISIONS);

    // ── Step 3: Simpan artikel yang sudah diedit ──────────────────────────
    const editedDraft = {
      ...draft,
      title: editResult.editedTitle || draft?.title,
      mainArticle: editResult.editedContent || draft?.mainArticle,
      changeLog: editResult.changeLog || [],
      qualityNotes: editResult.qualityNotes || '',
      editorRevision: revisionCount,
      isDuplicate,
      similarArticles,
    };

    await query(
      `UPDATE articles SET content_versions = $1, title = $2, quality_score = $3, status = $4 WHERE id = $5`,
      [JSON.stringify(editedDraft), editedDraft.title, qualityScore, needsRevision ? 'writing' : 'qc', articleId]
    );

    // ── Step 4: Decision ──────────────────────────────────────────────────
    if (needsRevision) {
      await this.log('warn', `Quality score ${qualityScore} < ${QUALITY_THRESHOLD}, sending back for revision (attempt ${revisionCount + 1}/${MAX_REVISIONS})`, { articleId, qualityScore });
      const revisionNotes = editResult.qualityNotes || 'Artikel perlu perbaikan kualitas.';
      await enqueueJob('WRITE', articleId, {
        brief: { ...brief, revisionNotes, changeLog: editResult.changeLog },
        format,
        siteId,
        revisionCount: revisionCount + 1,
      }, 'high');
    } else {
      await this.log('info', `Editing complete. Score: ${qualityScore}`, { articleId, qualityScore });
      await enqueueJob('QC', articleId, { editedDraft, brief, siteId, format }, 'normal');
    }

    return {
      editedArticle: editedDraft.mainArticle,
      qualityScore,
      changeLog: editResult.changeLog || [],
      needsRevision,
      revisionNotes: editResult.qualityNotes || '',
    };
  }
}

module.exports = EditorAgent;
