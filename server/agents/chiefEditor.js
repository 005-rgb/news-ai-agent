'use strict';

/**
 * ChiefEditorAgent — Phase 6 (generateAdHocTopic) + Phase 8 (resolveDuplicateRisk)
 *                  + Phase 9 (runRapat — Pemimpin Redaksi Engine penuh)
 *
 * Phase 9 — runRapat(context):
 *   Orkestrasi penuh Rapat Redaksi Mingguan:
 *   Step 9.2 — predictTrends()             : LLM prediksi 10 topik dari sinyal tren
 *   Step 9.5 — generateContentCalendar()   : LLM buat kalender 7 hari per site
 *              generateNotulen()           : LLM tulis notulen rapat readable
 */

const BaseAgent = require('./base');
const { query }  = require('../db');
const { v4: uuidv4 } = require('uuid');

class ChiefEditorAgent extends BaseAgent {
  constructor() { super('ChiefEditorAgent'); }

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 6 — Ad-hoc Topic Generator
  // Dipanggil Scheduler saat content_calendar kosong.
  // ──────────────────────────────────────────────────────────────────────────

  async generateAdHocTopic(siteId, category = 'umum') {
    await this.log('info', `Generating ad-hoc topic for site ${siteId}, category: ${category}`, { siteId, category });

    const { rows: siteRows } = await query(
      `SELECT name, niche, categories, persona_description FROM sites WHERE id = $1`,
      [siteId]
    );
    if (!siteRows.length) throw new Error(`Site ${siteId} not found`);
    const site          = siteRows[0];
    const siteCategories = site.categories || [category];
    const niche          = site.niche || category;

    const { rows: recentArticles } = await query(
      `SELECT title, category FROM articles
       WHERE site_id = $1 AND created_at > NOW() - INTERVAL '14 days'
       ORDER BY created_at DESC LIMIT 20`,
      [siteId]
    );
    const recentTopics = recentArticles.map(a => `- ${a.title}`).join('\n');

    const formatByCategory = {
      akademik: 'jurnal', teknologi: 'berita_mendalam', politik: 'berita_singkat',
      bisnis:   'berita_mendalam', kesehatan: 'feature', lifestyle: 'feature',
      olahraga: 'berita_singkat', umum: 'berita_singkat',
    };
    const targetFormat = formatByCategory[category] || 'berita_singkat';

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
      const llmResponse = await this.callLLM(prompt, { temperature: 0.8, maxTokens: 300 });
      const raw = (llmResponse.text || llmResponse.content || '').trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in LLM response');
      result = JSON.parse(jsonMatch[0]);
    } catch (err) {
      await this.log('warn', `LLM topic generation failed, using fallback: ${err.message}`, { siteId });
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
        category, format: targetFormat, angle: 'Liputan berita terkini',
      };
    }

    await this.log('info', `Ad-hoc topic generated: "${result.topic}"`, { siteId, topic: result.topic });
    return {
      topic:    result.topic    || `Berita terkini ${category}`,
      category: result.category || category,
      format:   result.format   || targetFormat,
      angle:    result.angle    || '',
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 8 — Duplicate Risk Resolver
  // ──────────────────────────────────────────────────────────────────────────

  async resolveDuplicateRisk(articleId, originalTopic, duplicates, siteInfo = {}) {
    await this.log('info', `Resolving duplicate risk for article ${articleId}`, {
      articleId, originalTopic, topDuplicate: duplicates[0]?.title, topOverlap: duplicates[0]?.overlap,
    });

    const dupList = duplicates.slice(0, 3)
      .map((d, i) => `${i + 1}. "${d.title}" (${Math.round(d.overlap * 100)}% overlap)`)
      .join('\n');

    const prompt = `Kamu adalah pemimpin redaksi berpengalaman media online Indonesia.

TOPIK BARU yang akan ditulis: "${originalTopic}"

ARTIKEL YANG SUDAH ADA di site "${siteInfo.name || 'tidak diketahui'}" (niche: ${siteInfo.niche || '-'}):
${dupList}

KEPUTUSAN:
Topik baru ini mirip (>60% overlap) dengan artikel yang sudah ada.
Sebagai pemimpin redaksi, putuskan:

OPSI A — PIVOT: Ubah sudut pandang topik menjadi angle yang berbeda dan lebih segar.
OPSI B — SKIP: Topik terlalu mirip, tidak ada angle baru yang worth it saat ini.

Jawab HANYA dengan JSON:
{
  "decision": "pivot" atau "skip",
  "newAngle": "deskripsi angle baru jika pivot (1-2 kalimat), null jika skip",
  "newTopic": "judul baru yang lebih spesifik jika pivot, null jika skip",
  "reason": "alasan singkat keputusan (1 kalimat)"
}`;

    let result;
    try {
      const llmRes = await this.callLLM(prompt, { maxTokens: 300, temperature: 0.7 });
      const raw = (llmRes.text || llmRes.content || '').trim()
        .replace(/^```json\s*/i, '').replace(/\s*```$/, '');
      result = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}');
    } catch (err) {
      await this.log('warn', `LLM duplicate resolve failed: ${err.message} — defaulting to pivot`, { articleId });
      result = {
        decision: 'pivot',
        newAngle: `Liputan mendalam dengan fokus berbeda dari "${duplicates[0]?.title}"`,
        newTopic: null,
        reason:   'LLM gagal, fallback ke pivot otomatis',
      };
    }

    const decision = result.decision === 'skip' ? 'skip' : 'pivot';

    await this.log('info', `Duplicate risk resolved: ${decision.toUpperCase()} — ${result.reason}`, {
      articleId, decision, newAngle: result.newAngle,
    });

    if (decision === 'skip') {
      await query(
        `UPDATE articles SET status = 'failed', content_versions = content_versions || $1::jsonb WHERE id = $2`,
        [JSON.stringify({ duplicateDecision: 'skip', reason: result.reason }), articleId]
      );
    }

    return {
      decision,
      newAngle:  result.newAngle  || null,
      newTopic:  result.newTopic  || null,
      reason:    result.reason    || 'Keputusan otomatis',
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 9 — Step 9.2: Trend Prediction Engine
  //
  // Input : rawTrends[] dari trendFetcher, existingArticleTitles[]
  // Output: predictions[] saved ke DB dengan confidence score & reasoning
  // ──────────────────────────────────────────────────────────────────────────

  async predictTrends(rawTrends = [], existingArticleTitles = []) {
    await this.log('info', `Predicting trends from ${rawTrends.length} raw signals`);

    if (!rawTrends.length) {
      await this.log('warn', 'No raw trends to predict from');
      return [];
    }

    // Build trend list for LLM
    const trendList = rawTrends.slice(0, 30).map((t, i) =>
      `${i + 1}. "${t.topic}" (kategori: ${t.category}, confidence: ${Math.round((t.confidence_score || 0.5) * 100)}%${t.source_signals?.traffic ? ', traffic: ' + t.source_signals.traffic : ''})`
    ).join('\n');

    const existingTopics = existingArticleTitles.slice(0, 20)
      .map((t, i) => `${i + 1}. ${t}`)
      .join('\n') || '(belum ada artikel)';

    const prompt = `Kamu adalah analis tren media digital Indonesia yang berpengalaman.

DATA SINYAL TRENDING INDONESIA (dari Google Trends):
${trendList}

TOPIK YANG SUDAH PERNAH DITULIS (hindari duplikasi):
${existingTopics}

TUGAS:
Berdasarkan pola tren di atas, prediksi 10 topik artikel yang akan PALING RELEVAN untuk media Indonesia dalam 3-7 hari ke depan.

Kriteria pemilihan:
1. Relevan untuk pembaca umum Indonesia
2. Layak diliput secara jurnalistik (bukan sekadar viral tanpa substansi)
3. Belum terlalu banyak ditulis (lihat topik existing)
4. Berpotensi traffic tinggi dan engagement

Return HANYA JSON array berikut:
[
  {
    "topic": "judul artikel yang disarankan (8-15 kata, spesifik)",
    "category": "kategori (teknologi/bisnis/politik/kesehatan/olahraga/sains/hiburan/internasional/umum)",
    "confidence": 0.85,
    "peakDays": 5,
    "reasoning": "alasan singkat mengapa topik ini akan trending (1 kalimat)"
  }
]`;

    let predictions = [];
    try {
      const llmRes = await this.retry(() => this.callLLM(prompt, { maxTokens: 1500, temperature: 0.7 }), 2);
      const raw = (llmRes.text || llmRes.content || '').trim()
        .replace(/^```json\s*/i, '').replace(/\s*```$/, '');
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array in LLM response');
      predictions = JSON.parse(jsonMatch[0]);
    } catch (err) {
      await this.log('warn', `LLM trend prediction failed: ${err.message}`);
      return [];
    }

    // Cross-check: flag predicted topics that already exist (>50% overlap)
    const { keywordOverlap } = require('../utils/similarity');

    // Save predictions to DB, replacing today's existing ones
    const today = new Date().toISOString().slice(0, 10);
    // Remove LLM-predicted entries from today (keep raw RSS entries)
    await query(
      `DELETE FROM trend_predictions
       WHERE status = 'predicted'
         AND source_signals->>'source' = 'llm_prediction'
         AND created_at::date = $1::date`,
      [today]
    ).catch(() => {});

    const saved = [];
    for (const pred of predictions.slice(0, 10)) {
      if (!pred.topic) continue;

      // Cross-check duplicate
      let isDuplicate = false;
      for (const existing of existingArticleTitles) {
        if (keywordOverlap(pred.topic, existing) >= 0.5) {
          isDuplicate = true;
          break;
        }
      }
      if (isDuplicate) continue;

      const peakDate = new Date();
      peakDate.setDate(peakDate.getDate() + (pred.peakDays || 5));

      try {
        const { rows } = await query(
          `INSERT INTO trend_predictions
             (topic, category, confidence_score, predicted_peak_date, source_signals, status)
           VALUES ($1, $2, $3, $4, $5, 'predicted')
           RETURNING *`,
          [
            pred.topic.trim(),
            pred.category || 'umum',
            Math.min(1, Math.max(0, pred.confidence || 0.7)),
            peakDate.toISOString().slice(0, 10),
            JSON.stringify({ source: 'llm_prediction', reasoning: pred.reasoning || '', peakDays: pred.peakDays }),
          ]
        );
        saved.push(rows[0]);
      } catch (_) { /* skip on constraint error */ }
    }

    await this.log('info', `Trend prediction done: ${saved.length} predictions saved to DB`, {
      rawSignals: rawTrends.length,
      predictedAndSaved: saved.length,
    });

    return saved;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 9 — Step 9.5a: Generate Content Calendar untuk satu site
  // Komposisi: 60% trending, 30% evergreen baru, 10% update artikel lama
  // ──────────────────────────────────────────────────────────────────────────

  async _generateCalendarForSite(site, { trends, competitorGaps, evergreenCandidates, articlesPerDay = 1 }) {
    const siteId  = site.id;
    const siteName = site.name;
    const niche    = site.niche || 'umum';
    const categories = (site.categories || []).join(', ') || 'umum';

    // Recent topics for this site (dedup)
    const { rows: recent } = await query(
      `SELECT title FROM articles
       WHERE site_id = $1
         AND created_at > NOW() - INTERVAL '30 days'
       ORDER BY created_at DESC LIMIT 30`,
      [siteId]
    );
    const recentTitles = recent.map(a => a.title);

    // Filter trends relevant to this site's categories
    const siteCatSet = new Set((site.categories || ['umum']).map(c => c.toLowerCase()));
    const relevantTrends = trends
      .filter(t => siteCatSet.has(t.category) || t.category === 'umum' || t.category === 'internasional')
      .slice(0, 15)
      .map(t => `- "${t.topic}" (${t.category}, confidence ${Math.round((t.confidence_score || 0.5) * 100)}%)`);

    // Competitor gap topics for this site
    const siteGaps = (competitorGaps || [])
      .filter(g => g.site_id === siteId)
      .flatMap(g => {
        const gaps = g.gap_opportunities?.gaps || [];
        return gaps.slice(0, 5).map(gap => `- "${gap.topic}"`);
      })
      .slice(0, 10);

    // Evergreen candidates for update
    const evergreenList = (evergreenCandidates || []).slice(0, 5)
      .map(e => `- "${e.title}" (${e.format}, quality: ${e.quality_score || '?'})`);

    // Calculate total topics needed for 7 days
    const totalTopics = articlesPerDay * 7;
    const trendingCount  = Math.round(totalTopics * 0.6);
    const evergreenCount = Math.round(totalTopics * 0.3);
    const updateCount    = totalTopics - trendingCount - evergreenCount;

    // Generate start date (tomorrow)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    const startDateStr = startDate.toISOString().slice(0, 10);

    const prompt = `Kamu adalah pemimpin redaksi senior media online Indonesia.

PROFIL SITE:
- Nama: ${siteName}
- Niche: ${niche}
- Kategori: ${categories}

DATA INPUT RAPAT REDAKSI:

1. TRENDING TOPICS (relevan untuk niche ini):
${relevantTrends.length ? relevantTrends.join('\n') : '- (belum ada data tren)'}

2. GAP KOMPETITOR (topik yang kompetitor sudah tulis, kita belum):
${siteGaps.length ? siteGaps.join('\n') : '- (belum ada data kompetitor)'}

3. KANDIDAT EVERGREEN UPDATE:
${evergreenList.length ? evergreenList.join('\n') : '- (belum ada kandidat)'}

4. TOPIK YANG SUDAH PERNAH DITULIS (JANGAN DUPLIKASI):
${recentTitles.slice(0, 20).map(t => `- ${t}`).join('\n') || '- (belum ada artikel)'}

INSTRUKSI:
Buat content calendar 7 hari (mulai ${startDateStr}) untuk site "${siteName}".
Total ${totalTopics} topik (${articlesPerDay} artikel/hari).
Komposisi: ${trendingCount} trending, ${evergreenCount} evergreen baru, ${updateCount} update artikel lama.

Setiap topik harus:
- Spesifik dan actionable (bukan judul generic)
- Sesuai niche "${niche}"
- Tidak duplikat dengan topik yang sudah ada di atas

Return HANYA JSON array:
[
  {
    "date": "YYYY-MM-DD",
    "topic": "judul artikel spesifik 8-15 kata",
    "category": "kategori",
    "format": "berita_singkat|berita_panjang|jurnal_review|feature_opini|listicle|faq_article|evergreen",
    "priority": "normal|high",
    "type": "trending|evergreen|update",
    "notes": "alasan singkat memilih topik ini (max 1 kalimat)"
  }
]`;

    let calendarItems = [];
    try {
      const llmRes = await this.retry(() => this.callLLM(prompt, { maxTokens: 2500, temperature: 0.75 }), 2);
      const raw = (llmRes.text || llmRes.content || '').trim()
        .replace(/^```json\s*/i, '').replace(/\s*```$/, '');
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array in calendar generation');
      calendarItems = JSON.parse(jsonMatch[0]);
    } catch (err) {
      await this.log('warn', `Calendar generation failed for site ${siteName}: ${err.message}`);
      // Fallback: create 7 generic slots
      for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        calendarItems.push({
          date:     d.toISOString().slice(0, 10),
          topic:    `Berita Terkini ${niche} — ${d.toLocaleDateString('id-ID', { weekday: 'long' })}`,
          category: (site.categories || ['umum'])[0] || 'umum',
          format:   'berita_singkat',
          priority: 'normal',
          type:     'trending',
          notes:    'Topik fallback otomatis',
        });
      }
    }

    // Get existing rapat session ID (will be set by caller)
    return { siteId, siteName, calendarItems };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 9 — Step 9.5b: Generate Notulen Rapat Redaksi
  // Input: report data, trends, calendarSummary
  // Output: readable Indonesian text untuk rapat_notes.summary
  // ──────────────────────────────────────────────────────────────────────────

  async _generateNotulen({ performanceReport, trends, calendarBySite, recommendations, today }) {
    const totalPublished = performanceReport?.production?.totalPublished || 0;
    const totalFailed    = performanceReport?.production?.totalFailed    || 0;
    const avgQuality     = performanceReport?.production?.avgQuality     || '—';

    const siteLines = (performanceReport?.production?.bySite || [])
      .map(s => `• ${s.site_name || s.site_name}: ${s.published || 0} publish, ${s.failed || 0} gagal (Quality: ${s.avg_quality || '—'})`)
      .join('\n') || '• Belum ada data site.';

    const trendLines = trends.slice(0, 8)
      .map(t => `• "${t.topic}" (${t.category}, ${Math.round((t.confidence_score || 0.5) * 100)}%)`)
      .join('\n') || '• (belum ada data tren)';

    const calendarLines = Object.entries(calendarBySite)
      .map(([siteName, items]) =>
        `${siteName}:\n` + (items || []).slice(0, 3).map(it =>
          `  - [${it.date}] ${it.topic} (${it.format || 'berita'}, ${it.type || 'trending'})`
        ).join('\n')
      ).join('\n\n') || '(kalender belum dihasilkan)';

    const recLines = (recommendations || [])
      .map((r, i) => `${i + 1}. ${r}`)
      .join('\n') || '• Performa normal — pertahankan.';

    const prompt = `Kamu adalah pemimpin redaksi senior yang menulis notulen rapat.

DATA RAPAT REDAKSI — ${today}:

PERFORMA MINGGU LALU:
- Total Publish  : ${totalPublished} artikel
- Total Gagal    : ${totalFailed} artikel
- Avg Quality    : ${avgQuality}
- Per Site:
${siteLines}

TREN YANG DIIDENTIFIKASI MINGGU INI:
${trendLines}

CONTENT PLAN MINGGU DEPAN (ringkasan):
${calendarLines}

REKOMENDASI TIM:
${recLines}

TUGAS:
Tulis notulen rapat redaksi mingguan yang:
1. Profesional tapi mudah dibaca
2. Dalam Bahasa Indonesia yang natural
3. Mencakup semua poin di atas
4. Format: section jelas dengan emoji heading
5. Panjang: 300-500 kata

Format yang diharapkan:
📊 RINGKASAN PERFORMA MINGGU LALU
[isi]

📈 TREN YANG DIIDENTIFIKASI
[isi]

📅 RENCANA KONTEN MINGGU INI
[isi]

💡 REKOMENDASI & TINDAK LANJUT
[isi]`;

    try {
      const llmRes = await this.retry(() => this.callLLM(prompt, { maxTokens: 1200, temperature: 0.7 }), 2);
      return (llmRes.text || llmRes.content || '').trim();
    } catch (err) {
      await this.log('warn', `Notulen generation failed: ${err.message}`);

      // Fallback: structured plaintext
      return `=== NOTULEN RAPAT REDAKSI — ${today} ===

📊 RINGKASAN PERFORMA MINGGU LALU
Total Publish  : ${totalPublished} artikel
Total Gagal    : ${totalFailed} artikel
Avg Quality    : ${avgQuality}

${siteLines}

📈 TREN YANG DIIDENTIFIKASI
${trendLines}

📅 RENCANA KONTEN MINGGU INI
${calendarLines}

💡 REKOMENDASI
${recLines}`;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 9 — Step 9.5: runRapat() — Full Orchestration
  //
  // Proses penuh Rapat Redaksi Mingguan:
  // 1. Load performance report (AnalystAgent)
  // 2. Load / refresh trend signals
  // 3. Run trend prediction (LLM)
  // 4. Load competitor gaps
  // 5. Per site: generate 7-day content calendar (LLM)
  // 6. Save calendar to content_calendar
  // 7. Generate notulen (LLM)
  // 8. Save to rapat_notes
  // ──────────────────────────────────────────────────────────────────────────

  async runRapat(context = {}) {
    const today     = new Date().toISOString().slice(0, 10);
    const sessionId = uuidv4();

    await this.log('info', `Starting Rapat Redaksi — session ${sessionId}`, { today });

    // ── 1. Performance report ────────────────────────────────────────────────
    const AnalystAgent = require('./analyst');
    const analyst      = new AnalystAgent();
    let performanceReport;
    try {
      performanceReport = await analyst.generateWeeklyReport();
    } catch (err) {
      await this.log('warn', `Performance report failed: ${err.message} — continuing`);
      performanceReport = { production: { totalPublished: 0, totalFailed: 0, avgQuality: null, bySite: [] } };
    }

    // ── 2. Load recent trend signals from DB ─────────────────────────────────
    const { getRecentTrends } = require('../services/trendFetcher');
    let rawTrends = await getRecentTrends(48).catch(() => []);

    // If no recent trends, trigger a fresh fetch
    if (rawTrends.length < 3) {
      await this.log('info', 'Trend data sparse — triggering fresh fetch');
      try {
        const { refreshTrends } = require('../services/trendFetcher');
        await refreshTrends();
        rawTrends = await getRecentTrends(24).catch(() => []);
      } catch (err) {
        await this.log('warn', `Trend refresh failed: ${err.message}`);
      }
    }

    // ── 3. Trend prediction (Step 9.2) ───────────────────────────────────────
    // Get all existing article titles for cross-check
    const { rows: allArticles } = await query(
      `SELECT title FROM articles
       WHERE status = 'published' AND published_at > NOW() - INTERVAL '60 days'
       ORDER BY published_at DESC LIMIT 100`
    ).catch(() => ({ rows: [] }));
    const existingTitles = allArticles.map(a => a.title);

    let trendPredictions = [];
    try {
      trendPredictions = await this.predictTrends(rawTrends, existingTitles);
    } catch (err) {
      await this.log('warn', `Trend prediction failed: ${err.message} — using raw signals`);
      trendPredictions = rawTrends;
    }

    // Use combined list for calendar generation
    const allTrends = [...(trendPredictions.length ? trendPredictions : rawTrends)];

    // ── 4. Load competitor gaps ───────────────────────────────────────────────
    const { getAllGaps } = require('../services/competitorScanner');
    let competitorGaps = await getAllGaps().catch(() => []);

    // ── 5. Get active sites ───────────────────────────────────────────────────
    const { rows: sites } = await query(
      `SELECT id, name, niche, categories, config, persona_description FROM sites WHERE status = 'active'`
    );

    if (!sites.length) {
      await this.log('warn', 'No active sites found — rapat complete with no calendar generated');
      const notulen = await this._generateNotulen({
        performanceReport, trends: allTrends, calendarBySite: {}, recommendations: ['Belum ada site aktif — tambahkan site untuk memulai.'], today,
      });
      const { rows } = await query(
        `INSERT INTO rapat_notes (id, session_date, summary, trend_data, performance_report, recommendations)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [sessionId, today, notulen,
          JSON.stringify({ trends: allTrends.slice(0, 10) }),
          JSON.stringify(performanceReport),
          JSON.stringify(['Belum ada site aktif.'])]
      );
      return { sessionId, today, calendarItemsCreated: 0, sitesProcessed: 0, trendsIdentified: allTrends.length };
    }

    // ── 6. Generate content calendar per site & save ─────────────────────────
    const calendarBySite = {};
    let totalCalendarItems = 0;

    for (const site of sites) {
      try {
        const schedule       = site.config?.posting_schedule || {};
        const articlesPerDay = schedule.articles_per_day || schedule.daily_count || 1;
        const evergreenCandidates = performanceReport?.evergreen || [];

        const { calendarItems } = await this._generateCalendarForSite(site, {
          trends: allTrends,
          competitorGaps,
          evergreenCandidates,
          articlesPerDay: Math.min(5, Math.max(1, parseInt(articlesPerDay) || 1)),
        });

        // Save to content_calendar
        let savedCount = 0;
        for (const item of (calendarItems || [])) {
          if (!item.topic) continue;
          try {
            await query(
              `INSERT INTO content_calendar
                 (id, site_id, topic, category, format, priority, scheduled_date, status, rapat_session_id, notes)
               VALUES ($1, $2, $3, $4, $5, $6, $7, 'planned', $8, $9)`,
              [
                uuidv4(),
                site.id,
                item.topic.trim().slice(0, 500),
                item.category || 'umum',
                item.format   || 'berita_singkat',
                item.priority || 'normal',
                item.date     || null,
                sessionId,
                item.notes    || null,
              ]
            );
            savedCount++;
          } catch (_) { /* skip constraint error */ }
        }

        calendarBySite[site.name] = calendarItems;
        totalCalendarItems        += savedCount;

        await this.log('info', `Calendar generated for "${site.name}": ${savedCount} topics`, {
          siteId: site.id, count: savedCount,
        });

      } catch (err) {
        await this.log('warn', `Calendar generation failed for site "${site.name}": ${err.message}`);
      }
    }

    // ── 7. Build recommendations ─────────────────────────────────────────────
    const recommendations = [];
    const perf = performanceReport?.production || {};
    if ((perf.totalFailed || 0) > 3)
      recommendations.push(`${perf.totalFailed} artikel gagal minggu ini — cek API key quota dan error log.`);
    if (perf.avgQuality && parseFloat(perf.avgQuality) < 75)
      recommendations.push(`Rata-rata quality score ${perf.avgQuality} di bawah target 75 — tuning prompt diperlukan.`);
    const topGaps = competitorGaps.flatMap(g => g.gap_opportunities?.gaps || []).slice(0, 3);
    if (topGaps.length)
      recommendations.push(`${topGaps.length}+ gap kompetitor teridentifikasi — prioritaskan di content calendar.`);
    if (allTrends.length > 0)
      recommendations.push(`${allTrends.length} topik trending teridentifikasi — ${Math.round(allTrends.length * 0.6)} dimasukkan ke calendar.`);
    if (!recommendations.length)
      recommendations.push('Performa sistem normal. Pertahankan dan monitor sumber baru.');

    // ── 8. Generate & save notulen ────────────────────────────────────────────
    const notulen = await this._generateNotulen({
      performanceReport, trends: allTrends, calendarBySite, recommendations, today,
    });

    await query(
      `INSERT INTO rapat_notes (id, session_date, summary, trend_data, performance_report, recommendations)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (session_date) DO UPDATE
         SET summary            = EXCLUDED.summary,
             trend_data         = EXCLUDED.trend_data,
             performance_report = EXCLUDED.performance_report,
             recommendations    = EXCLUDED.recommendations`,
      [
        sessionId,
        today,
        notulen,
        JSON.stringify({ trends: allTrends.slice(0, 15), totalRaw: rawTrends.length }),
        JSON.stringify(performanceReport),
        JSON.stringify(recommendations),
      ]
    ).catch(async (err) => {
      // If ON CONFLICT fails due to missing unique constraint, try plain INSERT
      await query(
        `INSERT INTO rapat_notes (id, session_date, summary, trend_data, performance_report, recommendations)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          sessionId, today, notulen,
          JSON.stringify({ trends: allTrends.slice(0, 15), totalRaw: rawTrends.length }),
          JSON.stringify(performanceReport),
          JSON.stringify(recommendations),
        ]
      ).catch(() => {});
    });

    await this.log('info', `Rapat Redaksi complete — ${totalCalendarItems} calendar items, ${sites.length} sites, ${allTrends.length} trends`, {
      sessionId, calendarItems: totalCalendarItems, sites: sites.length, trends: allTrends.length,
    });

    return {
      sessionId,
      today,
      sitesProcessed:       sites.length,
      calendarItemsCreated: totalCalendarItems,
      trendsIdentified:     allTrends.length,
      recommendations,
      notulenLength:        notulen.length,
    };
  }
}

module.exports = ChiefEditorAgent;
