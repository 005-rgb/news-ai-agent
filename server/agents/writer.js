'use strict';

/**
 * Penulis Agent — Phase 3 (Step 3.4) + Phase 4 (Steps 4.1-4.3)
 * Input:  { brief, format, siteId, category, citationStyle }
 * Output: { mainArticle, faqVersion, keyTakeaways, socialCaption, imagePlaceholders[], wordCount }
 *
 * Pipeline:
 *  1. Load Persona Memory site dari DB
 *  2. Try to load champion template from DB (prompt_versions) — Step 4.3
 *  3. selectWritingStandard() — pilih template yang tepat berdasarkan format + category
 *  4. Construct prompt: brief + persona + standar format
 *  5. LLM → draft artikel (JSON berisi semua versi + placeholders)
 *  6. Validasi wordCount sesuai target format
 *  7. Enqueue EDIT
 */

const BaseAgent = require('./base');
const { query } = require('../db');
const { selectWritingStandard } = require('../config/promptTemplates');
const { enqueueJob } = require('../services/jobQueue');

const FORMAT_WORD_TARGETS = {
  berita_singkat:   { min: 200, max: 400 },
  berita_panjang:   { min: 800, max: 1500 },
  jurnal_review:    { min: 800, max: 2000 },
  feature_opini:    { min: 1000, max: 2000 },
  listicle:         { min: 500, max: 1200 },
  faq_article:      { min: 600, max: 1500 },
  evergreen:        { min: 1200, max: 2500 },
};

async function getSitePersona(siteId) {
  if (!siteId) return null;
  try {
    const { rows } = await query(
      `SELECT name, niche, persona_memory, persona_description FROM sites WHERE id = $1`,
      [siteId]
    );
    return rows[0] || null;
  } catch { return null; }
}

/**
 * Step 4.3 — Try to load the champion (or active) template from DB for the given format.
 * Uses exact format_key match for reliable selection.
 * Falls back to null if none found (caller uses hardcoded default).
 */
async function loadDbTemplate(format, agentType = 'writer') {
  try {
    // Exact format_key match — the only reliable lookup contract
    const { rows } = await query(
      `SELECT id, name, format_key, prompt_template, is_champion, status
       FROM prompt_versions
       WHERE agent_type = $1
         AND format_key = $2
         AND is_active = true
       ORDER BY is_champion DESC, performance_score DESC
       LIMIT 1`,
      [agentType, format]
    );
    return rows[0] || null;
  } catch { return null; }
}

function buildWriterPrompt(brief, format, site, citationStyle = 'APA', dbTemplate = null) {
  const personaBlock = site
    ? `Nama site: ${site.name}\nNiche: ${site.niche || 'umum'}\nPersona: ${site.persona_memory || site.persona_description || 'Jurnalis profesional Indonesia'}`
    : 'Persona: Jurnalis profesional Indonesia';

  const briefBlock = [
    `Topik: ${brief.topic}`,
    `Thesis: ${brief.mainThesis || brief.topic}`,
    brief.facts?.length     ? `Fakta:\n${brief.facts.slice(0, 8).map((f, i) => `${i + 1}. ${f}`).join('\n')}` : '',
    brief.quotes?.length    ? `Kutipan narasumber:\n${brief.quotes.slice(0, 4).map(q => `- "${q.text}" — ${q.speaker}${q.affiliation ? ` (${q.affiliation})` : ''}`).join('\n')}` : '',
    brief.statistics?.length? `Data/statistik:\n${brief.statistics.slice(0, 4).map(s => `- ${s.figure}: ${s.context}`).join('\n')}` : '',
    brief.timeline?.length  ? `Timeline:\n${brief.timeline.slice(0, 4).map(t => `- ${t.date}: ${t.event}`).join('\n')}` : '',
    brief.keyNames?.length  ? `Tokoh/lembaga: ${brief.keyNames.slice(0, 6).join(', ')}` : '',
    brief.revisionNotes     ? `\n[CATATAN REVISI DARI EDITOR]: ${brief.revisionNotes}` : '',
  ].filter(Boolean).join('\n\n');

  // Step 4.3: use selectWritingStandard to get the right template
  const { templateStr, templateName, source } = selectWritingStandard(format, null, citationStyle, dbTemplate);

  return {
    prompt: templateStr
      .replace(/\{\{PERSONA\}\}/g, personaBlock)
      .replace(/\{\{BRIEF\}\}/g, briefBlock),
    templateName,
    templateSource: source,
  };
}

function countWords(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function extractImagePlaceholders(text) {
  const placeholders = [];
  const regex = /\{\{IMAGE:\s*([^}]+)\}\}/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    placeholders.push(match[1].trim());
  }
  if (!placeholders.length) {
    placeholders.push(`Featured image untuk artikel tentang: ${(text || '').slice(0, 80)}`);
  }
  return placeholders;
}

function parseArticleOutput(rawText, topic) {
  try {
    const cleaned = rawText.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned);
    return {
      title: parsed.title || topic,
      content: parsed.content || rawText,
      faqVersion: Array.isArray(parsed.faq) ? parsed.faq : [],
      keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : [],
      socialCaption: parsed.socialCaption || '',
      imagePlaceholders: extractImagePlaceholders(parsed.content || rawText),
    };
  } catch {
    return {
      title: topic,
      content: rawText,
      faqVersion: [],
      keyTakeaways: [],
      socialCaption: '',
      imagePlaceholders: extractImagePlaceholders(rawText),
    };
  }
}

class WriterAgent extends BaseAgent {
  constructor() { super('WriterAgent'); }

  async run(articleId, payload) {
    const { brief, format = 'berita_singkat', siteId, category, citationStyle = 'APA' } = payload;
    await this.log('info', `Writing article ${articleId} (format: ${format})`, { format, category });
    await query(`UPDATE articles SET status = 'writing' WHERE id = $1`, [articleId]);

    // ── Step 1: Load site persona ─────────────────────────────────────────
    const site = await getSitePersona(siteId);

    // ── Step 2: Try to load champion template from DB (Phase 4 Step 4.3) ──
    const dbTemplate = await loadDbTemplate(format);
    if (dbTemplate) {
      await this.log('info', `Using DB template: "${dbTemplate.name}" (champion: ${dbTemplate.is_champion})`, { articleId });
    }

    // ── Step 3: Build prompt using selectWritingStandard ──────────────────
    const { prompt, templateName, templateSource } = buildWriterPrompt(brief, format, site, citationStyle, dbTemplate);
    await this.log('info', `Template: "${templateName}" (source: ${templateSource})`, { articleId });

    // ── Step 4: LLM → draft artikel ───────────────────────────────────────
    const target = FORMAT_WORD_TARGETS[format] || FORMAT_WORD_TARGETS['berita_singkat'];
    const maxTokens = Math.min(Math.round(target.max * 1.6), 4096);

    let rawText;
    let providerUsed = null;
    try {
      const llmResult = await this.retry(
        () => this.callLLM(prompt, { maxTokens, temperature: 0.75 }),
        2
      );
      rawText = llmResult.text;
      providerUsed = llmResult.provider || null;
    } catch (err) {
      await this.log('error', `LLM call failed for writer: ${err.message}`, { articleId });
      throw err;
    }

    // ── Step 5: Parse dan validasi ────────────────────────────────────────
    const parsed = parseArticleOutput(rawText, brief?.topic || '');
    const wordCount = countWords(parsed.content);

    if (wordCount < target.min) {
      await this.log('warn', `Word count ${wordCount} below target ${target.min} for format ${format}`, { articleId });
    }

    const draft = {
      title: parsed.title,
      mainArticle: parsed.content,
      faqVersion: parsed.faqVersion,
      keyTakeaways: parsed.keyTakeaways,
      socialCaption: parsed.socialCaption || `#${(brief?.category || 'berita')} #indonesia`,
      imagePlaceholders: parsed.imagePlaceholders,
      wordCount,
      format,
      templateName,
      templateSource,
      citationStyle,
      generatedAt: new Date().toISOString(),
    };

    // ── Step 6: Simpan dan enqueue EDIT ───────────────────────────────────
    await query(
      `UPDATE articles SET content_versions = $1, title = $2, content = $3,
       provider_used = COALESCE($4, provider_used), status = 'editing' WHERE id = $5`,
      [JSON.stringify(draft), parsed.title, parsed.content, providerUsed, articleId]
    );

    // Update prompt_versions sample_count if DB template was used
    if (dbTemplate?.id) {
      await query(
        `UPDATE prompt_versions SET sample_count = sample_count + 1 WHERE id = $1`,
        [dbTemplate.id]
      ).catch(() => {});
    }

    await enqueueJob('EDIT', articleId, { draft, brief, siteId, format, revisionCount: 0 }, 'normal');

    await this.log('info', `Writing complete: "${parsed.title}" — ${wordCount} words (format: ${format})`, { articleId, wordCount, format });
    return draft;
  }
}

module.exports = WriterAgent;
