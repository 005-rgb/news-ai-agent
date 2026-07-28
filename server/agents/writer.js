'use strict';

/**
 * Penulis Agent — Phase 3 (Step 3.4)
 * Input:  { brief, format, siteId, category }
 * Output: { mainArticle, faqVersion, keyTakeaways, socialCaption, imagePlaceholders[], wordCount }
 *
 * Pipeline:
 *  1. Load Persona Memory site dari DB
 *  2. Load prompt template sesuai format
 *  3. Construct prompt: brief + persona + standar
 *  4. LLM → draft artikel (JSON berisi semua versi + placeholders)
 *  5. Validasi wordCount sesuai target format
 *  6. Enqueue EDIT
 */

const BaseAgent = require('./base');
const { query } = require('../db');
const { TEMPLATES } = require('../config/promptTemplates');
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

function buildWriterPrompt(brief, format, site, citationStyle = 'APA') {
  const template = TEMPLATES[format] || TEMPLATES['berita_singkat'];
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
  ].filter(Boolean).join('\n\n');

  return template.template
    .replace('{{PERSONA}}', personaBlock)
    .replace('{{BRIEF}}', briefBlock)
    .replace('{{CITATION_STYLE}}', citationStyle);
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
  // Always include at least one featured image placeholder
  if (!placeholders.length) {
    placeholders.push(`Featured image untuk artikel tentang: ${text.slice(0, 80)}`);
  }
  return placeholders;
}

function parseArticleOutput(rawText, topic) {
  // Try JSON parse first
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
    // Fallback: treat entire response as content
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
    const { brief, format = 'berita_singkat', siteId, category } = payload;
    await this.log('info', `Writing article ${articleId} (format: ${format})`, { format, category });
    await query(`UPDATE articles SET status = 'writing' WHERE id = $1`, [articleId]);

    // ── Step 1: Load site persona ─────────────────────────────────────────
    const site = await getSitePersona(siteId);

    // ── Step 2 & 3: Build prompt ──────────────────────────────────────────
    const prompt = buildWriterPrompt(brief, format, site);

    // ── Step 4: LLM → draft artikel ───────────────────────────────────────
    const target = FORMAT_WORD_TARGETS[format] || FORMAT_WORD_TARGETS['berita_singkat'];
    // tokensUsed ≈ 1.3x word count to be safe
    const maxTokens = Math.min(Math.round(target.max * 1.5), 4000);

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
      generatedAt: new Date().toISOString(),
    };

    // ── Step 6: Simpan dan enqueue EDIT ───────────────────────────────────
    // Save to content_versions (full structured data) AND content (plain text for quick display)
    await query(
      `UPDATE articles SET content_versions = $1, title = $2, content = $3,
       provider_used = COALESCE($4, provider_used), status = 'editing' WHERE id = $5`,
      [JSON.stringify(draft), parsed.title, parsed.content, providerUsed, articleId]
    );

    await enqueueJob('EDIT', articleId, { draft, brief, siteId, format, revisionCount: 0 }, 'normal');

    await this.log('info', `Writing complete: "${parsed.title}" — ${wordCount} words`, { articleId, wordCount });
    return draft;
  }
}

module.exports = WriterAgent;
