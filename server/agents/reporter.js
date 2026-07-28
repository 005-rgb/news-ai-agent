'use strict';

/**
 * Reporter/Peneliti Agent — Phase 3 (Step 3.3)
 * Input:  { topic, category, siteId, format }
 * Output: brief riset JSON { facts[], quotes[], statistics[], timeline, sources[], credibilityScore }
 *
 * Pipeline:
 *  1. selectSources(category)         → 2-3 sumber terbaik
 *  2. fetchFromSource(source, topic)  → konten nyata
 *  3. Keyword filter relevan
 *  4. LLM: ekstrak facts/quotes/stats/timeline/narasumber (JSON)
 *  5. Cross-verify: konsistensi antar sumber
 *  6. Hitung credibilityScore gabungan
 *  7. Simpan ke articles.brief_data, enqueue WRITE
 */

const BaseAgent = require('./base');
const { query } = require('../db');
const { selectSources, fetchFromSource, updateLastFetched } = require('../services/sourceSelector');
const { enqueueJob } = require('../services/jobQueue');

// Keywords yang pasti irrelevant
const STOP_WORDS = new Set(['yang','dan','di','ke','dari','ini','itu','untuk','dengan','pada','oleh','atau','juga','sudah','akan','telah','dalam','tidak','bisa','ada','saat','karena','sebagai','tersebut','dapat','lebih','agar','sehingga','namun','seperti','antara','hingga','kepada','secara','melalui','setelah','sebelum','selama','bahwa','sebuah','setiap','semua']);

function isRelevant(text, topic) {
  if (!text || !topic) return false;
  const topicWords = topic.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w));
  const textLower = text.toLowerCase();
  return topicWords.some(w => textLower.includes(w));
}

function calcCredibilityScore(sources) {
  if (!sources.length) return 0;
  const avg = sources.reduce((sum, s) => sum + (s.credibility_score || 5), 0) / sources.length;
  return Math.round(avg * 10) / 10;
}

function buildExtractionPrompt(topic, snippets) {
  return `Kamu adalah asisten riset jurnalistik Indonesia. Berdasarkan kutipan berita berikut tentang topik "${topic}", ekstrak informasi terstruktur.

=== KONTEN SUMBER ===
${snippets.slice(0, 6).map((s, i) => `[Sumber ${i + 1}: ${s.sourceName}]\nJudul: ${s.title}\nIsi: ${s.content?.slice(0, 600) || s.summary?.slice(0, 400) || ''}`).join('\n\n---\n\n')}
===================

Ekstrak dan kembalikan HANYA JSON valid (tanpa markdown, tanpa komentar):
{
  "facts": ["fakta 1 dari sumber", "fakta 2", ...],
  "quotes": [{"text": "kutipan langsung", "speaker": "nama narasumber", "affiliation": "jabatan/lembaga"}, ...],
  "statistics": [{"figure": "angka/persentase", "context": "konteks angka ini", "source": "nama sumber"}],
  "timeline": [{"date": "tanggal/periode", "event": "kejadian"}, ...],
  "keyNames": ["nama tokoh 1", "nama lembaga 2"],
  "mainThesis": "ringkasan 1 kalimat tentang apa yang terjadi"
}

Aturan:
- Hanya fakta yang benar-benar ada di teks sumber, JANGAN mengarang
- Jika tidak ada kutipan langsung, biarkan array quotes kosong
- Format tanggal timeline: natural, contoh "15 Juli 2026"`;
}

function buildVerifyPrompt(topic, briefFromMultipleSources) {
  return `Verifikasi konsistensi berikut untuk topik "${topic}". Bandingkan fakta-fakta dari berbagai sumber dan identifikasi apakah ada kontradiksi signifikan.

FAKTA YANG DIKUMPULKAN:
${briefFromMultipleSources.map((b, i) => `Sumber ${i + 1}: ${JSON.stringify(b.facts?.slice(0, 3))}`).join('\n')}

Jawab HANYA JSON:
{
  "consistent": true/false,
  "contradictions": ["kontradiksi 1 jika ada"],
  "verifiedFacts": ["fakta yang konsisten antar sumber"],
  "confidence": 0-100
}`;
}

class ReporterAgent extends BaseAgent {
  constructor() { super('ReporterAgent'); }

  async run(articleId, payload) {
    const { topic, category, siteId, format } = payload;
    await this.log('info', `Starting research: "${topic}"`, { articleId, category });
    await query(`UPDATE articles SET status = 'researching' WHERE id = $1`, [articleId]);

    // ── Step 1: Pilih sumber terbaik ───────────────────────────────────────
    const selectedSources = await this.retry(() => selectSources(category || 'umum', 3), 2);

    if (!selectedSources.length) {
      await this.log('warn', `No sources for category "${category}", using fallback`, { articleId });
    }

    // ── Step 2: Fetch konten dari setiap sumber ────────────────────────────
    const allItems = [];
    for (const source of selectedSources) {
      try {
        const items = await fetchFromSource(source, topic);
        const relevant = items.filter(item =>
          isRelevant(item.title + ' ' + (item.summary || '') + ' ' + (item.content || ''), topic)
        );
        relevant.slice(0, 5).forEach(item => allItems.push({ ...item, sourceName: source.name, sourceCredibility: source.credibility_score || 5 }));
        if (items.length) await updateLastFetched(source.id);
        await this.log('info', `Fetched ${relevant.length} relevant items from "${source.name}"`, { articleId });
      } catch (err) {
        await this.log('warn', `Fetch failed for source "${source.name}": ${err.message}`, { articleId });
      }
    }

    // ── Step 3: LLM ekstrak fakta dari snippets ───────────────────────────
    let extractedBrief = { facts: [], quotes: [], statistics: [], timeline: [], keyNames: [], mainThesis: '' };

    if (allItems.length) {
      try {
        const extractPrompt = buildExtractionPrompt(topic, allItems);
        const llmResult = await this.callLLM(extractPrompt, { maxTokens: 1500, temperature: 0.3 });
        const raw = llmResult.text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/,'');
        extractedBrief = JSON.parse(raw);
      } catch (err) {
        await this.log('warn', `LLM extraction failed: ${err.message} — building basic brief`, { articleId });
        extractedBrief.facts = allItems.slice(0, 5).map(i => i.title).filter(Boolean);
        extractedBrief.mainThesis = `Ringkasan tentang: ${topic}`;
      }
    } else {
      // Fallback: LLM dari pengetahuan umum jika tidak ada sumber
      await this.log('warn', 'No items fetched — falling back to LLM knowledge', { articleId });
      try {
        const fallbackPrompt = `Kamu adalah jurnalis Indonesia. Buat brief riset tentang topik: "${topic}" (kategori: ${category}).
Kembalikan HANYA JSON valid:
{"facts":["fakta umum 1","fakta 2","fakta 3"],"quotes":[],"statistics":[],"timeline":[],"keyNames":[],"mainThesis":"ringkasan singkat"}`;
        const llmResult = await this.callLLM(fallbackPrompt, { maxTokens: 800, temperature: 0.4 });
        const raw = llmResult.text.trim().replace(/^```json\s*/i,'').replace(/\s*```$/,'');
        extractedBrief = JSON.parse(raw);
      } catch (e) {
        extractedBrief.facts = [`Artikel tentang ${topic} berdasarkan pengetahuan editorial.`];
        extractedBrief.mainThesis = topic;
      }
    }

    // ── Step 4: Cross-verify jika lebih dari 1 sumber ─────────────────────
    let verificationResult = { consistent: true, contradictions: [], confidence: 70 };
    if (selectedSources.length > 1 && allItems.length > 3) {
      try {
        // Group items by source
        const bySource = selectedSources.map(s => ({
          name: s.name,
          facts: allItems.filter(i => i.sourceName === s.name).slice(0, 3).map(i => i.title)
        })).filter(s => s.facts.length);

        if (bySource.length > 1) {
          const verifyPrompt = buildVerifyPrompt(topic, bySource);
          const vResult = await this.callLLM(verifyPrompt, { maxTokens: 500, temperature: 0.2 });
          const raw = vResult.text.trim().replace(/^```json\s*/i,'').replace(/\s*```$/,'');
          verificationResult = JSON.parse(raw);
          if (!verificationResult.consistent) {
            await this.log('warn', `Cross-verify: contradictions found for "${topic}"`, { contradictions: verificationResult.contradictions });
          }
        }
      } catch (err) {
        await this.log('warn', `Cross-verify LLM failed: ${err.message}`, { articleId });
      }
    }

    // ── Step 5: Bangun brief final ─────────────────────────────────────────
    const credibilityScore = calcCredibilityScore(selectedSources);
    const brief = {
      topic,
      category,
      format: format || 'berita_singkat',
      facts: Array.isArray(extractedBrief.facts) ? extractedBrief.facts.filter(Boolean) : [],
      quotes: Array.isArray(extractedBrief.quotes) ? extractedBrief.quotes.filter(q => q.text) : [],
      statistics: Array.isArray(extractedBrief.statistics) ? extractedBrief.statistics.filter(Boolean) : [],
      timeline: Array.isArray(extractedBrief.timeline) ? extractedBrief.timeline.filter(Boolean) : [],
      keyNames: Array.isArray(extractedBrief.keyNames) ? extractedBrief.keyNames : [],
      mainThesis: extractedBrief.mainThesis || topic,
      sources: selectedSources.map(s => ({ id: s.id, name: s.name, url: s.url, credibility: s.credibility_score })),
      credibilityScore,
      verification: verificationResult,
      researchedAt: new Date().toISOString(),
      itemsFetched: allItems.length,
    };

    // ── Step 6: Simpan dan enqueue WRITE ──────────────────────────────────
    await query(
      `UPDATE articles SET brief_data = $1, status = 'writing', source_urls = $2 WHERE id = $3`,
      [JSON.stringify(brief), selectedSources.map(s => s.url), articleId]
    );

    await enqueueJob('WRITE', articleId, { brief, format: format || 'berita_singkat', siteId, category }, 'normal');

    await this.log('info', `Research complete: ${brief.facts.length} facts, ${brief.quotes.length} quotes, credibility ${credibilityScore}`, { articleId });
    return brief;
  }
}

module.exports = ReporterAgent;
