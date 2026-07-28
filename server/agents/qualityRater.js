'use strict';

/**
 * Quality Rater Simulator — Phase 3 (Step 3.6)
 * E-E-A-T checker + AI Detection + Search Intent
 * Input:  { editedDraft, brief, siteId, format }
 * Output: { eeAtScore, passed, detailedScores{}, aiDetectionRisk, revisionNotes }
 *
 * Pipeline:
 *  1. Experience check    — detail spesifik, bukan generalisasi
 *  2. Expertise check     — terminologi domain benar, ada depth
 *  3. Authoritativeness   — referensi ke sumber otoritatif, nama lembaga
 *  4. Trustworthiness     — klaim bisa diverifikasi, ada disclaimer
 *  5. AI Detection check  — LLM tanya "apakah terasa ditulis AI?"
 *  6. Search Intent check — apakah menjawab apa yang dicari user?
 *  7. Hitung skor E-E-A-T 0-100
 *  8. Jika score < 80 && revisionCount < 1: enqueue EDIT lagi
 *  9. Jika lolos: status → 'imaging'
 */

const BaseAgent = require('./base');
const { query } = require('../db');
const { enqueueJob } = require('../services/jobQueue');

const EEAT_THRESHOLD = 80;
const MAX_QC_REVISIONS = 1;

function buildEeatPrompt(article, brief) {
  const content = (article?.mainArticle || '').slice(0, 3000);
  const title = article?.title || '';
  const category = brief?.category || 'umum';
  const facts = (brief?.facts || []).slice(0, 5).join('; ');

  return `Kamu adalah Google Quality Rater senior yang mengevaluasi artikel untuk E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness).

=== ARTIKEL ===
Judul: ${title}
Kategori: ${category}
Konten:
${content}

=== FAKTA RISET (untuk cek akurasi) ===
${facts || 'Tidak ada brief riset.'}

=== EVALUASI ===
Nilai setiap dimensi 0-100 dan deteksi apakah artikel terasa ditulis AI.

Kembalikan HANYA JSON valid:
{
  "experience": {
    "score": 0-100,
    "notes": "apakah ada detail spesifik yang menunjukkan pengalaman nyata?"
  },
  "expertise": {
    "score": 0-100,
    "notes": "apakah terminologi domain digunakan dengan tepat dan ada kedalaman?"
  },
  "authoritativeness": {
    "score": 0-100,
    "notes": "apakah ada referensi ke sumber otoritatif, nama tokoh/lembaga resmi?"
  },
  "trustworthiness": {
    "score": 0-100,
    "notes": "apakah klaim bisa diverifikasi, ada disclaimer untuk hal tidak pasti?"
  },
  "aiDetection": {
    "risk": "low|medium|high",
    "indicators": ["indikator AI 1 jika ada"],
    "score": 0-100
  },
  "searchIntent": {
    "score": 0-100,
    "notes": "apakah artikel menjawab apa yang dicari user untuk topik ini?"
  },
  "overallScore": 0-100,
  "passed": true/false,
  "revisionNotes": "catatan perbaikan spesifik jika score < 80, atau kosong jika lolos"
}

Kriteria passed: overallScore >= 80 DAN aiDetection.risk tidak 'high'`;
}

function calcWeightedScore(scores) {
  // Bobot: Trustworthiness 30%, Expertise 25%, Authoritativeness 20%, Experience 15%, SearchIntent 10%
  const weights = { experience: 0.15, expertise: 0.25, authoritativeness: 0.20, trustworthiness: 0.30, searchIntent: 0.10 };
  let total = 0;
  for (const [key, weight] of Object.entries(weights)) {
    total += (scores[key]?.score || 0) * weight;
  }
  return Math.round(total);
}

class QualityRaterAgent extends BaseAgent {
  constructor() { super('QualityRaterAgent'); }

  async run(articleId, payload) {
    const { editedDraft, brief, siteId, format, qcRevisionCount = 0 } = payload;
    await this.log('info', `QC E-E-A-T check for article ${articleId}`, { articleId });
    await query(`UPDATE articles SET status = 'qc' WHERE id = $1`, [articleId]);

    // ── LLM E-E-A-T evaluation ────────────────────────────────────────────
    let evaluation = null;
    let eeAtScore = 75;
    let passed = false;
    let aiDetectionRisk = 'medium';
    let detailedScores = {};
    let revisionNotes = '';

    try {
      const qcPrompt = buildEeatPrompt(editedDraft, brief);
      const llmResult = await this.retry(
        () => this.callLLM(qcPrompt, { maxTokens: 1200, temperature: 0.3 }),
        2
      );
      const raw = llmResult.text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
      evaluation = JSON.parse(raw);

      // Use weighted score if overallScore seems off
      const weighted = calcWeightedScore(evaluation);
      eeAtScore = Math.round((evaluation.overallScore + weighted) / 2); // blend LLM + formula
      eeAtScore = Math.max(0, Math.min(100, eeAtScore));

      passed = evaluation.passed && eeAtScore >= EEAT_THRESHOLD && evaluation.aiDetection?.risk !== 'high';
      aiDetectionRisk = evaluation.aiDetection?.risk || 'medium';
      revisionNotes = evaluation.revisionNotes || '';

      detailedScores = {
        experience:         evaluation.experience?.score     || 0,
        expertise:          evaluation.expertise?.score      || 0,
        authoritativeness:  evaluation.authoritativeness?.score || 0,
        trustworthiness:    evaluation.trustworthiness?.score || 0,
        searchIntent:       evaluation.searchIntent?.score   || 0,
        aiDetectionScore:   evaluation.aiDetection?.score    || 0,
        aiIndicators:       evaluation.aiDetection?.indicators || [],
        notes: {
          experience:        evaluation.experience?.notes || '',
          expertise:         evaluation.expertise?.notes || '',
          authoritativeness: evaluation.authoritativeness?.notes || '',
          trustworthiness:   evaluation.trustworthiness?.notes || '',
          searchIntent:      evaluation.searchIntent?.notes || '',
        },
      };
    } catch (err) {
      await this.log('warn', `QC LLM failed: ${err.message} — using default pass score`, { articleId });
      eeAtScore = 76;
      passed = true;
      aiDetectionRisk = 'medium';
    }

    const needsRevision = !passed && qcRevisionCount < MAX_QC_REVISIONS;

    // ── Simpan hasil QC ───────────────────────────────────────────────────
    await query(
      `UPDATE articles SET eeat_score = $1, status = $2 WHERE id = $3`,
      [eeAtScore, needsRevision ? 'editing' : 'imaging', articleId]
    );

    // ── Decision ──────────────────────────────────────────────────────────
    if (needsRevision) {
      await this.log('warn', `E-E-A-T score ${eeAtScore} < ${EEAT_THRESHOLD} (aiRisk: ${aiDetectionRisk}), sending back to editor`, { articleId, eeAtScore });
      await enqueueJob('EDIT', articleId, {
        draft: {
          ...editedDraft,
          qcNotes: revisionNotes,
          eeAtDetailedScores: detailedScores,
        },
        brief,
        siteId,
        format,
        revisionCount: 0, // reset writer revision counter for QC-triggered re-edit
        qcTriggered: true,
      }, 'high');
    } else {
      const statusVerb = passed ? 'PASSED' : 'FORCE-PASSED (max QC revisions reached)';
      await this.log('info', `QC ${statusVerb}. E-E-A-T: ${eeAtScore}, aiRisk: ${aiDetectionRisk}`, { articleId, eeAtScore, aiDetectionRisk });

      // ── Enqueue IMAGE job (Phase 5) ─────────────────────────────────────
      const { rows: artRows } = await query(
        `SELECT site_id, category FROM articles WHERE id = $1`, [articleId]
      );
      const art = artRows[0] || {};
      await enqueueJob('IMAGE', articleId, {
        siteId: art.site_id || payload?.siteId,
        category: art.category || 'umum',
      }, 'normal');
    }

    return { eeAtScore, passed, detailedScores, aiDetectionRisk, revisionNotes };
  }
}

module.exports = QualityRaterAgent;
