'use strict';

/**
 * Phase 6 — Scheduler & Full Automation
 *
 * Step 6.1 — Site Scheduler     : per-site cron berdasarkan posting_schedule
 * Step 6.2 — Smart Timing       : default time-slot per kategori + random delay
 * Step 6.3 — Source Refresh     : fetch ulang semua RSS aktif setiap 6 jam
 * Step 6.4 — Daily Maintenance  : article status check + evergreen scan
 * Step 6.5 — Watchdog           : dihandle oleh jobQueue.js (runWatchdog setiap 5 menit)
 *
 * Public API:
 *   scheduler.start()              — init semua cron, panggil saat boot
 *   scheduler.stop()               — hentikan semua cron
 *   scheduler.reloadSiteCrons()    — panggil setelah site di-create/update/delete
 *   scheduler.triggerSiteNow(siteId) — manual trigger pipeline untuk 1 site
 *   scheduler.getStatus()          — return status semua site + next-run info
 */

const cron = require('node-cron');
const { query } = require('../db');
const logger = require('../utils/logger');

// ── Lazy requires (agents/services belum tentu load urutan) ──────────────────
function getPipeline()      { return require('./pipeline'); }
function getChiefEditor()   { return require('../agents/chiefEditor'); }
function getFetchers()      { return require('./fetchers/rss'); }
function getSourceQuery()   { return require('../db').query; }

// ── Step 6.2 — Smart Timing: default slot per kategori (WIB) ─────────────────
const CATEGORY_TIME_SLOTS = {
  politik:    ['06:00', '07:00'],
  breaking:   ['06:00', '07:00'],
  bisnis:     ['07:30', '08:00', '08:30'],
  ekonomi:    ['07:30', '08:00', '08:30'],
  teknologi:  ['10:00', '11:00', '12:00'],
  kesehatan:  ['11:00', '12:00', '13:00'],
  akademik:   ['09:00', '10:00', '11:00'],
  lifestyle:  ['12:00', '13:00', '20:00', '21:00'],
  olahraga:   ['07:00', '08:00', '19:00', '20:00'],
  hiburan:    ['12:00', '15:00', '20:00'],
  umum:       ['08:00', '12:00', '17:00'],
};

const DEFAULT_TIMES = ['08:00', '12:00', '18:00'];

/**
 * Pilih default times berdasarkan kategori site
 * @param {string[]} categories
 * @returns {string[]}
 */
function getDefaultTimesForCategories(categories) {
  if (!categories || !categories.length) return DEFAULT_TIMES;
  const primary = categories[0].toLowerCase();
  return CATEGORY_TIME_SLOTS[primary] || DEFAULT_TIMES;
}

/**
 * Tambahkan random delay: base + random(-15, +45) menit
 * Sesuai spec: tidak terlihat robotik
 * @param {Date} baseTime
 * @returns {number} delay dalam ms sebelum jalankan
 */
function smartDelayMs() {
  const minOffset = -15 * 60 * 1000;  // -15 menit
  const maxOffset =  45 * 60 * 1000;  // +45 menit
  return Math.floor(Math.random() * (maxOffset - minOffset + 1)) + minOffset;
}

// ── State management ──────────────────────────────────────────────────────────
/** @type {Map<string, cron.ScheduledTask[]>} siteId → array of cron tasks */
const _siteCrons = new Map();

/** @type {Map<string, { nextRun: Date|null, lastRun: Date|null, lastStatus: string }>} */
const _siteStatus = new Map();

/** Cron tasks tidak terkait site (source refresh, daily maintenance) */
const _systemCrons = [];

// ── Step 6.1 — Per-site cron setup ───────────────────────────────────────────

/**
 * Parse "HH:MM" → { hour, minute }
 */
function parseTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return { hour: isNaN(h) ? 8 : h, minute: isNaN(m) ? 0 : m };
}

/**
 * Buat cron expression dari "HH:MM" (WIB = UTC+7 → kurangi 7 jam)
 * node-cron timezone 'Asia/Jakarta' didukung, gunakan langsung.
 */
function timeToCronExpr(timeStr) {
  const { hour, minute } = parseTime(timeStr);
  return `${minute} ${hour} * * *`;
}

/**
 * Hapus semua cron milik satu site
 */
function stopSiteCrons(siteId) {
  const tasks = _siteCrons.get(siteId) || [];
  tasks.forEach((t) => { try { t.stop(); } catch (_) {} });
  _siteCrons.delete(siteId);
}

/**
 * Daftarkan cron job untuk satu site
 */
async function setupSiteCrons(site) {
  stopSiteCrons(site.id);

  const cfg = site.config || {};
  const schedule = cfg.posting_schedule || {};

  if (schedule.enabled === false) {
    _siteStatus.set(site.id, { nextRun: null, lastRun: null, lastStatus: 'disabled' });
    return;
  }

  const times = (schedule.times && schedule.times.length)
    ? schedule.times
    : getDefaultTimesForCategories(site.categories);

  const useSmartTiming = schedule.use_smart_timing !== false; // default true

  const tasks = [];

  for (const timeStr of times) {
    const cronExpr = timeToCronExpr(timeStr);

    const task = cron.schedule(cronExpr, async () => {
      const delayMs = useSmartTiming ? Math.max(0, smartDelayMs()) : 0;
      setTimeout(async () => {
        await runSitePublishCycle(site.id, schedule);
      }, delayMs);
    }, { timezone: 'Asia/Jakarta' });

    tasks.push(task);
  }

  _siteCrons.set(site.id, tasks);

  // Hitung next run (waktu cron pertama hari ini atau besok)
  const nextRun = computeNextRun(times);
  _siteStatus.set(site.id, {
    nextRun,
    lastRun: null,
    lastStatus: 'scheduled',
    times,
    siteName: site.name,
  });

  await logger.info('Scheduler', `Site "${site.name}" scheduled at: ${times.join(', ')} WIB`, {
    siteId: site.id, times, smartTiming: useSmartTiming,
  });
}

/**
 * Hitung waktu run berikutnya dari array "HH:MM"
 */
function computeNextRun(times) {
  const now = new Date();
  // Waktu saat ini dalam WIB (UTC+7)
  const wibOffset = 7 * 60 * 60 * 1000;
  const nowWib = new Date(now.getTime() + wibOffset);
  const todayY = nowWib.getUTCFullYear();
  const todayM = nowWib.getUTCMonth();
  const todayD = nowWib.getUTCDate();

  let nearest = null;

  for (const t of times) {
    const { hour, minute } = parseTime(t);
    const candidateWib = new Date(Date.UTC(todayY, todayM, todayD, hour, minute, 0));
    // Konversi kembali ke UTC
    const candidateUtc = new Date(candidateWib.getTime() - wibOffset);
    if (candidateUtc > now) {
      if (!nearest || candidateUtc < nearest) nearest = candidateUtc;
    }
  }

  if (!nearest) {
    // Semua waktu hari ini sudah lewat → ambil waktu pertama besok
    const { hour, minute } = parseTime(times[0]);
    const tomorrowWib = new Date(Date.UTC(todayY, todayM, todayD + 1, hour, minute, 0));
    nearest = new Date(tomorrowWib.getTime() - wibOffset);
  }

  return nearest;
}

// ── Step 6.1 — Run cycle untuk satu site ─────────────────────────────────────

/**
 * Jalankan satu siklus publish untuk sebuah site:
 * 1. Ambil topik berikutnya dari content_calendar
 * 2. Jika kosong → ChiefEditorAgent.generateAdHocTopic
 * 3. Jalankan pipeline
 */
async function runSitePublishCycle(siteId, schedule = {}) {
  const status = _siteStatus.get(siteId) || {};
  _siteStatus.set(siteId, { ...status, lastStatus: 'running' });

  try {
    await logger.info('Scheduler', `Starting publish cycle for site ${siteId}`);

    // ── Ambil topik dari content_calendar ────────────────────────────────────
    const { rows: calItems } = await query(
      `SELECT * FROM content_calendar
       WHERE site_id = $1
         AND status = 'planned'
         AND (scheduled_date IS NULL OR scheduled_date <= CURRENT_DATE)
       ORDER BY
         CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
         scheduled_date ASC NULLS LAST,
         created_at ASC
       LIMIT 1`,
      [siteId]
    );

    let assignment;

    if (calItems.length) {
      const item = calItems[0];

      // Tandai sebagai 'in_progress'
      await query(
        `UPDATE content_calendar SET status = 'in_progress' WHERE id = $1`,
        [item.id]
      );

      assignment = {
        siteId,
        topic:    item.topic,
        category: item.category || 'umum',
        format:   item.format   || 'berita_singkat',
        priority: item.priority || 'normal',
        calendarItemId: item.id,
      };

      await logger.info('Scheduler', `Using calendar topic: "${item.topic}"`, { siteId, calendarItemId: item.id });

    } else {
      // ── Content calendar kosong → minta ChiefEditor generate topik ad-hoc ──
      await logger.info('Scheduler', `Content calendar empty for site ${siteId}, generating ad-hoc topic`);

      const defaultCategory = schedule.default_category
        || (schedule.categories && schedule.categories[0])
        || 'umum';

      const ChiefEditorAgent = getChiefEditor();
      const chief = new ChiefEditorAgent();
      const adHoc = await chief.generateAdHocTopic(siteId, defaultCategory);

      assignment = {
        siteId,
        topic:    adHoc.topic,
        category: adHoc.category || defaultCategory,
        format:   adHoc.format   || 'berita_singkat',
        priority: 'normal',
      };

      await logger.info('Scheduler', `Ad-hoc topic generated: "${adHoc.topic}"`, { siteId });
    }

    // ── Jalankan pipeline ─────────────────────────────────────────────────────
    const pipeline = getPipeline();
    const articleId = await pipeline.runPipeline(assignment);

    const now = new Date();
    const times = status.times || DEFAULT_TIMES;
    _siteStatus.set(siteId, {
      ...status,
      lastRun: now,
      lastStatus: 'ok',
      lastArticleId: articleId,
      nextRun: computeNextRun(times),
      times,
    });

    await logger.info('Scheduler', `Publish cycle done. Article created: ${articleId}`, { siteId, articleId });

  } catch (err) {
    const now = new Date();
    _siteStatus.set(siteId, { ..._siteStatus.get(siteId), lastRun: now, lastStatus: `error: ${err.message}` });
    await logger.error('Scheduler', `Publish cycle failed for site ${siteId}: ${err.message}`, { siteId, error: err.message });
  }
}

// ── Step 6.3 — Source Refresh Scheduler ──────────────────────────────────────

/**
 * Fetch ulang semua sumber RSS aktif, update cached_items di DB.
 * Jalan setiap 6 jam.
 * Rate limit: 3 detik antar sumber agar tidak DOS.
 */
async function refreshAllSources() {
  await logger.info('Scheduler', 'Starting source refresh cycle (6h)');

  try {
    const { rows: sources } = await query(
      `SELECT id, name, url, rss_url, type FROM sources
       WHERE is_active = true AND type = 'rss'
       ORDER BY last_fetched_at ASC NULLS FIRST`
    );

    if (!sources.length) {
      await logger.info('Scheduler', 'No active RSS sources to refresh');
      return;
    }

    const { fetchRSS } = getFetchers();
    let refreshed = 0;
    let failed = 0;

    for (const src of sources) {
      try {
        const feedUrl = src.rss_url || src.url;
        const items = await fetchRSS(feedUrl, { useCache: false });

        if (items && items.length) {
          // Simpan max 50 item terbaru ke cached_items
          const toStore = items.slice(0, 50);
          await query(
            `UPDATE sources
             SET cached_items = $1::jsonb,
                 last_fetched_at = NOW()
             WHERE id = $2`,
            [JSON.stringify(toStore), src.id]
          );
          refreshed++;
        }

        // Rate limit: 3 detik antar sumber
        await new Promise((r) => setTimeout(r, 3000));

      } catch (err) {
        failed++;
        await logger.warn('Scheduler', `Source refresh failed for "${src.name}": ${err.message}`, {
          sourceId: src.id, url: src.url,
        });
        // Tetap lanjut ke sumber berikutnya
      }
    }

    await logger.info('Scheduler', `Source refresh done: ${refreshed} refreshed, ${failed} failed`, {
      total: sources.length, refreshed, failed,
    });

  } catch (err) {
    await logger.error('Scheduler', `Source refresh cycle error: ${err.message}`, { error: err.message });
  }
}

// ── Step 6.4 — Daily Maintenance ─────────────────────────────────────────────

/**
 * Cek status artikel yang sudah dipublish (konfirmasi masih online via WP API).
 * Hanya cek artikel dari 7 hari terakhir — tidak spam WP untuk semua artikel.
 */
async function checkPublishedArticleStatus() {
  await logger.info('Scheduler', 'Checking published article status');

  try {
    const { rows: articles } = await query(
      `SELECT a.id, a.title, a.wordpress_post_id, a.wordpress_url, a.site_id,
              s.wordpress_api_url, s.wordpress_username, s.wordpress_app_password_enc
       FROM articles a
       JOIN sites s ON s.id = a.site_id
       WHERE a.status = 'published'
         AND a.published_at > NOW() - INTERVAL '7 days'
         AND a.wordpress_post_id IS NOT NULL
         AND s.wordpress_api_url IS NOT NULL`
    );

    if (!articles.length) return;

    const axios = require('axios');
    const { decrypt } = require('../utils/encryption');
    let verified = 0;
    let notFound = 0;

    for (const art of articles) {
      try {
        const password = decrypt(art.wordpress_app_password_enc);
        const token = Buffer.from(`${art.wordpress_username}:${password}`).toString('base64');

        const res = await axios.get(
          `${art.wordpress_api_url}/wp/v2/posts/${art.wordpress_post_id}`,
          {
            headers: { Authorization: `Basic ${token}` },
            timeout: 10000,
          }
        );

        if (res.data && res.data.id) {
          // Update URL jika berubah (redirect dll)
          if (res.data.link && res.data.link !== art.wordpress_url) {
            await query(
              `UPDATE articles SET wordpress_url = $1 WHERE id = $2`,
              [res.data.link, art.id]
            );
          }
          verified++;
        }

      } catch (err) {
        if (err.response && err.response.status === 404) {
          // Artikel sudah dihapus dari WP
          await query(
            `UPDATE articles SET status = 'removed_from_wp' WHERE id = $1`,
            [art.id]
          );
          await logger.warn('Scheduler', `Article ${art.id} ("${art.title}") not found on WP (404)`, {
            articleId: art.id, wpPostId: art.wordpress_post_id,
          });
          notFound++;
        }
        // Error lain (timeout, auth) — skip, coba lagi besok
      }

      // Rate limit: 2 detik antar artikel
      await new Promise((r) => setTimeout(r, 2000));
    }

    await logger.info('Scheduler', `Article status check done: ${verified} verified, ${notFound} removed`, {
      total: articles.length,
    });

  } catch (err) {
    await logger.error('Scheduler', `Article status check error: ${err.message}`);
  }
}

/**
 * Scan artikel kandidat evergreen:
 * Artikel yang: format feature/evergreen + umur > 30 hari + skor bagus
 * → set is_evergreen_candidate = true
 */
async function scanEvergreenCandidates() {
  try {
    const { rowCount } = await query(
      `UPDATE articles
       SET is_evergreen_candidate = true
       WHERE status = 'published'
         AND published_at < NOW() - INTERVAL '30 days'
         AND format IN ('feature', 'evergreen', 'berita_mendalam', 'jurnal')
         AND quality_score >= 75
         AND eeat_score >= 75
         AND is_evergreen_candidate = false`
    );

    if (rowCount > 0) {
      await logger.info('Scheduler', `Evergreen scan: ${rowCount} articles marked as candidates`);
    }
  } catch (err) {
    await logger.error('Scheduler', `Evergreen scan error: ${err.message}`);
  }
}

/**
 * Update usage_stats untuk hari ini per-site
 */
async function snapshotDailyStatsBySite() {
  try {
    const { rows: siteStats } = await query(
      `SELECT
         a.site_id,
         CURRENT_DATE AS date,
         COUNT(*) FILTER (WHERE a.created_at::date = CURRENT_DATE)          AS articles_generated,
         COUNT(*) FILTER (WHERE a.status = 'published' AND a.published_at::date = CURRENT_DATE) AS articles_published,
         COUNT(*) FILTER (WHERE a.status IN ('failed','dead') AND a.created_at::date = CURRENT_DATE) AS errors_count,
         AVG(a.quality_score) FILTER (WHERE a.created_at::date = CURRENT_DATE) AS avg_quality_score,
         AVG(a.eeat_score)    FILTER (WHERE a.created_at::date = CURRENT_DATE) AS avg_eeat_score
       FROM articles a
       WHERE a.site_id IS NOT NULL
       GROUP BY a.site_id`
    );

    for (const row of siteStats) {
      if (!row.site_id) continue;
      await query(
        `INSERT INTO usage_stats (date, site_id, articles_generated, errors_count, avg_quality_score, avg_eeat_score)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT ON CONSTRAINT usage_stats_date_site_id_key DO UPDATE SET
           articles_generated = EXCLUDED.articles_generated,
           errors_count       = EXCLUDED.errors_count,
           avg_quality_score  = EXCLUDED.avg_quality_score,
           avg_eeat_score     = EXCLUDED.avg_eeat_score`,
        [
          row.date,
          row.site_id,
          parseInt(row.articles_generated) || 0,
          parseInt(row.errors_count) || 0,
          row.avg_quality_score || null,
          row.avg_eeat_score    || null,
        ]
      );
    }

    await logger.info('Scheduler', `Daily stats by site saved: ${siteStats.length} sites`);
  } catch (err) {
    await logger.error('Scheduler', `Daily stats by site error: ${err.message}`);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Load semua site aktif dari DB dan buat cron jobs mereka
 */
async function reloadSiteCrons() {
  // Stop semua site cron yang ada
  for (const [siteId] of _siteCrons) {
    stopSiteCrons(siteId);
  }
  _siteCrons.clear();

  const { rows: sites } = await query(
    `SELECT id, name, categories, config FROM sites WHERE status = 'active'`
  );

  for (const site of sites) {
    await setupSiteCrons(site);
  }

  await logger.info('Scheduler', `Site crons reloaded: ${sites.length} active sites`);
  return sites.length;
}

/**
 * Manual trigger pipeline untuk satu site (dari dashboard atau API)
 */
async function triggerSiteNow(siteId) {
  const { rows } = await query(
    `SELECT id, name, categories, config FROM sites WHERE id = $1`,
    [siteId]
  );
  if (!rows.length) throw new Error(`Site ${siteId} not found`);

  const site = rows[0];
  const schedule = (site.config || {}).posting_schedule || {};

  // Jalankan segera (no delay)
  await runSitePublishCycle(siteId, schedule);
}

/**
 * Return status semua site yang terdaftar di scheduler
 */
function getStatus() {
  const result = [];
  for (const [siteId, status] of _siteStatus) {
    result.push({ siteId, ...status });
  }
  return result;
}

// ── Phase 9 — Rapat Redaksi cron functions ───────────────────────────────────

async function runTrendRefresh() {
  try {
    const { refreshTrends } = require('./trendFetcher');
    const result = await refreshTrends();
    await logger.info('Scheduler', `Phase 9 trend refresh done: ${result.fetched} fetched, ${result.stored} stored`);
  } catch (err) {
    await logger.error('Scheduler', `Phase 9 trend refresh error: ${err.message}`);
  }
}

async function runCompetitorScan() {
  try {
    const { scanCompetitorGaps } = require('./competitorScanner');
    const result = await scanCompetitorGaps();
    await logger.info('Scheduler', `Phase 9 competitor scan done: ${result.scanned} scanned, ${result.gaps} gaps`);
  } catch (err) {
    await logger.error('Scheduler', `Phase 9 competitor scan error: ${err.message}`);
  }
}

async function runPerformanceAnalysis() {
  try {
    const AnalystAgent = require('../agents/analyst');
    const analyst      = new AnalystAgent();
    await analyst.analyzePerformance({ days: 7 });
    await logger.info('Scheduler', 'Phase 9 performance analysis complete (Saturday pre-rapat)');
  } catch (err) {
    await logger.error('Scheduler', `Phase 9 performance analysis error: ${err.message}`);
  }
}

async function runRapatRedaksi() {
  try {
    const ChiefEditorAgent = getChiefEditor();
    const chief            = new ChiefEditorAgent();
    const result           = await chief.runRapat();
    await logger.info('Scheduler', `Phase 9 Rapat Redaksi done: ${result.calendarItemsCreated} calendar items, ${result.sitesProcessed} sites`);
  } catch (err) {
    await logger.error('Scheduler', `Phase 9 Rapat Redaksi error: ${err.message}`);
  }
}

/**
 * Start semua cron jobs (dipanggil saat server boot)
 */
async function start() {
  // ── Setup per-site crons (6.1) ────────────────────────────────────────────
  await reloadSiteCrons();

  // ── Source Refresh + Trend Refresh setiap 6 jam (6.3 + 9.1) ─────────────
  const sourceRefreshTask = cron.schedule('0 */6 * * *', async () => {
    await refreshAllSources();
    await runTrendRefresh();          // Phase 9.1: fetch Google Trends setiap 6 jam
  }, { timezone: 'Asia/Jakarta' });
  _systemCrons.push(sourceRefreshTask);

  // ── Article status check harian: 01:00 WIB (6.4) ─────────────────────────
  const articleCheckTask = cron.schedule('0 1 * * *', async () => {
    await checkPublishedArticleStatus();
    await scanEvergreenCandidates();
  }, { timezone: 'Asia/Jakarta' });
  _systemCrons.push(articleCheckTask);

  // ── Daily stats per-site snapshot: 23:50 WIB (6.4) ────────────────────────
  const statsTask = cron.schedule('50 23 * * *', async () => {
    await snapshotDailyStatsBySite();
  }, { timezone: 'Asia/Jakarta' });
  _systemCrons.push(statsTask);

  // ── Phase 9: Competitor gap scan — Sabtu 20:00 WIB (9.3) ─────────────────
  const competitorScanTask = cron.schedule('0 20 * * 6', async () => {
    await runCompetitorScan();
  }, { timezone: 'Asia/Jakarta' });
  _systemCrons.push(competitorScanTask);

  // ── Phase 9: Performance analysis — Sabtu 21:00 WIB (9.4) ────────────────
  const perfAnalysisTask = cron.schedule('0 21 * * 6', async () => {
    await runPerformanceAnalysis();
  }, { timezone: 'Asia/Jakarta' });
  _systemCrons.push(perfAnalysisTask);

  // ── Phase 9: Trend prediction (LLM) — Senin 06:30 WIB (9.2) ─────────────
  const trendPredictTask = cron.schedule('30 6 * * 1', async () => {
    await runTrendRefresh();         // Refresh sinyal fresh terlebih dahulu
  }, { timezone: 'Asia/Jakarta' });
  _systemCrons.push(trendPredictTask);

  // ── Phase 9: Rapat Redaksi (Content Calendar + Notulen) — Senin 07:00 WIB ─
  const rapatTask = cron.schedule('0 7 * * 1', async () => {
    await runRapatRedaksi();
  }, { timezone: 'Asia/Jakarta' });
  _systemCrons.push(rapatTask);

  await logger.info('Scheduler', 'Phase 9 Scheduler started: site-crons, source-refresh(6h), article-check(01:00), stats(23:50), competitor-scan(Sat20:00), perf-analysis(Sat21:00), trend-predict(Mon06:30), rapat(Mon07:00)');
}

/**
 * Stop semua cron jobs
 */
function stop() {
  for (const [siteId] of _siteCrons) {
    stopSiteCrons(siteId);
  }
  _siteCrons.clear();
  _siteStatus.clear();

  _systemCrons.forEach((t) => { try { t.stop(); } catch (_) {} });
  _systemCrons.length = 0;
}

module.exports = {
  start,
  stop,
  reloadSiteCrons,
  triggerSiteNow,
  getStatus,
  // Export untuk testing
  refreshAllSources,
  checkPublishedArticleStatus,
  scanEvergreenCandidates,
  getDefaultTimesForCategories,
  CATEGORY_TIME_SLOTS,
};
