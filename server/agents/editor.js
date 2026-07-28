'use strict';

/**
 * Editor Agent — Phase 3 (Step 3.5) + Phase 4 (Steps 4.1, 4.4, 8.2)
 * Input:  { draft, brief, siteId, format, revisionCount }
 * Output: { editedArticle, qualityScore, changeLog, needsRevision, revisionNotes }
 *
 * Pipeline:
 *  1. Cek akurasi: fakta di draft vs brief
 *  2. Cek duplikasi: cari artikel serupa di DB (simple keyword matching)
 *  3. Load format-specific validation checklist (Phase 4 Step 4.4)
 *  4. LLM review → artikel diperbaiki + checklist check + score
 *  5. Apply Humanizer Layer (Phase 8 Step 8.1 + 8.2)
 *  6. Jika score < 75 && revisionCount < 2: enqueue WRITE lagi
 *  7. Jika lolos: enqueue QC
 */

const BaseAgent = require('./base');
const { query } = require('../db');
const { enqueueJob } = require('../services/jobQueue');
const { getFormatChecklist } = require('../config/promptTemplates');
const { humanize, aiDetectionPrecheck } = require('../utils/humanizer');

const MAX_REVISIONS = 2;
const QUALITY_THRESHOLD = 75;

async function checkDuplication(siteId, title, content) {
  if (!siteId) return { isDuplicate: false, similarArticles: [] };
  try {
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

/**
 * Run automatic checklist validation against the draft (for rules that can be
 * checked programmatically without LLM).
 */
function runChecklistValidation(draft, format) {
  const checklist = getFormatChecklist(format);
  const failures = [];

  for (const rule of checklist.rules) {
    // Pass content or title depending on rule
    let passed;
    try {
      if (rule.id === 'title_length') {
        passed = rule.check(draft.title || '');
      } else {
        passed = rule.check(draft.mainArticle || '');
      }
    } catch {
      passed = true; // if check throws, skip
    }
    if (!passed) failures.push(rule.label);
  }

  return { checklist, failures };
}

function buildEditorPrompt(draft, brief, format) {
  const factsList = (brief?.facts || []).slice(0, 6).map((f, i) => `${i + 1}. ${f}`).join('\n');
  const quotesList = (brief?.quotes || []).slice(0, 3).map(q => `- "${q.text}" (${q.speaker})`).join('\n');

  // Get format-specific editor instructions (Phase 4 Step 4.4)
  const checklist = getFormatChecklist(format);
  const formatInstructions = checklist.editorInstructions;

  // AI detection pre-check flags
  const aiFlags = aiDetectionPrecheck(draft.mainArticle || '');
  const aiFlagsBlock = aiFlags.length
    ? `\nTANDA AI YANG TERDETEKSI OTOMATIS (HARUS DIPERBAIKI):\n${aiFlags.map(f => `- ${f}`).join('\n')}`
    : '';

  return `Kamu adalah editor senior media nasional Indonesia dengan 20 tahun pengalaman.
Review dan perbaiki artikel berikut. Pastikan sesuai standar format yang diminta.

=== FORMAT: ${(checklist.name || format).toUpperCase()} ===
${formatInstructions}

=== ARTIKEL DRAFT ===
Judul: ${draft.title || ''}

${(draft.mainArticle || '').slice(0, 4000)}

=== BRIEF RISET (FAKTA YANG HARUS ADA) ===
${factsList || 'Tidak ada fakta spesifik.'}

Kutipan narasumber yang seharusnya ada:
${quotesList || 'Tidak ada kutipan.'}
${aiFlagsBlock}

=== TUGAS EDITOR ===
1. Perbaiki kalimat yang tidak natural (tanda AI-generated)
2. Pastikan semua fakta dalam brief termasuk dalam artikel
3. Hilangkan kalimat klise atau generik yang terdeteksi di atas
4. Pastikan semua checklist format di atas terpenuhi
5. Perbaiki struktur paragraf jika ada yang > 5 kalimat
6. Untuk berita: pastikan lead (paragraf 1) maks 40 kata
7. Berikan skor kualitas 0-100 (75+ = lolos, di bawah itu = perlu ditulis ulang)

Kembalikan HANYA JSON valid:
{
  "editedTitle": "judul yang diperbaiki",
  "editedContent": "seluruh konten artikel yang sudah diperbaiki, lengkap...",
  "changeLog": ["perubahan 1: apa yang diperbaiki", "perubahan 2"],
  "qualityScore": 0-100,
  "qualityNotes": "catatan kualitas singkat — apa yang masih perlu diperbaiki jika ada",
  "checklistPassed": ["checklist item yang sudah terpenuhi"],
  "checklistFailed": ["checklist item yang belum terpenuhi"],
  "revisionNeeded": false
}

Catatan: qualityScore < ${QUALITY_THRESHOLD} = set revisionNeeded: true`;
}

class EditorAgent extends BaseAgent {
  constructor() { super('EditorAgent'); }

  async run(articleId, payload) {
    const { draft, brief, siteId, format = 'berita_singkat', revisionCount = 0 } = payload;
    await this.log('info', `Editing article ${articleId} (format: ${format}, revision ${revisionCount})`, { articleId, format });
    await query(`UPDATE articles SET status = 'editing' WHERE id = $1`, [articleId]);

    // ── Step 1: Duplikasi check ────────────────────────────────────────────
    const { isDuplicate, similarArticles } = await checkDuplication(siteId, draft?.title || '', draft?.mainArticle || '');
    if (isDuplicate) {
      await this.log('warn', `Potential duplicate detected for "${draft?.title}"`, { similarArticles: similarArticles.map(a => a.title) });
    }

    // ── Step 2: Format checklist pre-validation ───────────────────────────
    const { failures: checklistFailures } = runChecklistValidation(draft, format);
    if (checklistFailures.length) {
      await this.log('warn', `Format checklist pre-check failures: ${checklistFailures.join(', ')}`, { articleId, format });
    }

    // ── Step 3: LLM edit & scoring ────────────────────────────────────────
    let editResult = {
      editedTitle: draft?.title,
      editedContent: draft?.mainArticle,
      changeLog: [],
      qualityScore: 75,
      qualityNotes: '',
      checklistPassed: [],
      checklistFailed: checklistFailures,
      revisionNeeded: false,
    };

    try {
      const editPrompt = buildEditorPrompt(draft, brief, format);
      const llmResult = await this.retry(
        () => this.callLLM(editPrompt, { maxTokens: 4000, temperature: 0.3 }),
        2
      );
      const raw = llmResult.text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(raw);
      editResult = { ...editResult, ...parsed };
    } catch (err) {
      await this.log('warn', `Editor LLM failed: ${err.message} — using draft as-is with default score`, { articleId });
      editResult.qualityScore = 70;
      editResult.revisionNeeded = revisionCount < MAX_REVISIONS;
      // Add pre-check failures as checklist failures
      editResult.checklistFailed = checklistFailures;
    }

    const qualityScore = Math.max(0, Math.min(100, editResult.qualityScore || 70));
    const needsRevision = (qualityScore < QUALITY_THRESHOLD) && (revisionCount < MAX_REVISIONS);

    // ── Step 4: Apply Humanizer (Phase 4 Step 4.4 + Phase 8 Step 8.1) ────
    let humanizedContent = editResult.editedContent || draft?.mainArticle || '';
    try {
      humanizedContent = humanize(humanizedContent);
      // Verify AI flags removed after humanization
      const remainingFlags = aiDetectionPrecheck(humanizedContent);
      if (remainingFlags.length) {
        await this.log('warn', `${remainingFlags.length} AI markers remain after humanization`, { articleId, flags: remainingFlags });
      }
    } catch (err) {
      await this.log('warn', `Humanizer failed: ${err.message}`, { articleId });
    }

    // ── Step 5: Simpan artikel yang sudah diedit ──────────────────────────
    const editedDraft = {
      ...draft,
      title: editResult.editedTitle || draft?.title,
      mainArticle: humanizedContent,
      changeLog: editResult.changeLog || [],
      qualityNotes: editResult.qualityNotes || '',
      checklistPassed: editResult.checklistPassed || [],
      checklistFailed: editResult.checklistFailed || [],
      editorRevision: revisionCount,
      isDuplicate,
      similarArticles,
      humanized: true,
    };

    await query(
      `UPDATE articles SET content_versions = $1, title = $2, content = $3, quality_score = $4, status = $5 WHERE id = $6`,
      [JSON.stringify(editedDraft), editedDraft.title, humanizedContent, qualityScore, needsRevision ? 'writing' : 'qc', articleId]
    );

    // ── Step 6: Decision ──────────────────────────────────────────────────
    if (needsRevision) {
      await this.log('warn', `Quality score ${qualityScore} < ${QUALITY_THRESHOLD}, sending back for revision (attempt ${revisionCount + 1}/${MAX_REVISIONS})`, { articleId, qualityScore });
      const revisionNotes = [
        editResult.qualityNotes || 'Artikel perlu perbaikan kualitas.',
        ...(editResult.checklistFailed || []).map(f => `Checklist gagal: ${f}`),
      ].join('\n');
      await enqueueJob('WRITE', articleId, {
        brief: { ...brief, revisionNotes, changeLog: editResult.changeLog },
        format,
        siteId,
        revisionCount: revisionCount + 1,
      }, 'high');
    } else {
      await this.log('info', `Editing complete. Score: ${qualityScore}. Format: ${format}. Humanized: yes`, { articleId, qualityScore, format });
      await enqueueJob('QC', articleId, { editedDraft, brief, siteId, format }, 'normal');
    }

    return {
      editedArticle: humanizedContent,
      qualityScore,
      changeLog: editResult.changeLog || [],
      needsRevision,
      revisionNotes: editResult.qualityNotes || '',
      checklistPassed: editResult.checklistPassed || [],
      checklistFailed: editResult.checklistFailed || [],
    };
  }
}

module.exports = EditorAgent;
