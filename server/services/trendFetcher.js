'use strict';

/**
 * Trend Fetcher — Phase 9 Step 9.1
 *
 * Fetch Google Trends Daily Trending Searches untuk Indonesia setiap 6 jam.
 * Menyimpan: top queries, rising queries, breakdown per kategori.
 * Store di DB sebagai time-series di tabel trend_predictions.
 *
 * Public API:
 *   refreshTrends()        — fetch & store trending searches Indonesia
 *   getRecentTrends(hours) — ambil trend dari N jam terakhir
 *   classifyCategory(kw)   — klasifikasi keyword ke kategori berita Indonesia
 */

const { query } = require('../db');
const logger    = require('../utils/logger');

// ── Google Trends endpoints Indonesia ─────────────────────────────────────────
const TRENDS_RSS_URL      = 'https://trends.google.com/trending/rss?geo=ID';
const TRENDS_REALTIME_URL = 'https://trends.google.com/trends/api/realtimetrends?hl=id&tz=-420&cat=all&fi=0&fs=0&geo=ID&ri=300&rs=20&sort=0';

// ── Kategori keyword map untuk klasifikasi otomatis ───────────────────────────
const CATEGORY_SIGNALS = {
  teknologi:    ['ai','artificial','tech','digital','software','aplikasi','google','apple','microsoft',
                 'startup','crypto','blockchain','programming','internet','robot','chatgpt','llm',
                 'iphone','android','samsung','gadget','hack','siber','cyber'],
  bisnis:       ['ekonomi','saham','bursa','investasi','rupiah','bank','inflasi','ekspor','impor',
                 'keuangan','market','perdagangan','bisnis','perusahaan','bumn','merger','akuisisi',
                 'bbm','subsidi','pajak','tarif','imf','worldbank','apbn'],
  politik:      ['presiden','dpr','menteri','partai','pemilu','pilpres','pilkada','koalisi','kabinet',
                 'pemerintah','gubernur','bupati','walikota','kpu','bawaslu','sidang','ruu','uu',
                 'jokowi','prabowo','anies','ganjar','mahfud','muhaimin','megawati'],
  kesehatan:    ['kesehatan','virus','covid','vaksin','obat','rumah sakit','dokter','penyakit',
                 'medis','kemenkes','bpjs','kanker','diabetes','stunting','gizi','flu','demam',
                 'wabah','epidemi','pandemi','farmasi','apotek'],
  olahraga:     ['sepak bola','bola','liga','timnas','sea games','asian games','olimpik','tenis',
                 'badminton','basket','voli','pertandingan','gol','skor','transfer','pemain',
                 'pssi','persib','persija','arema','piala','wc','world cup','bundesliga','epl'],
  hukum:        ['hukum','pengadilan','hakim','jaksa','polisi','kasus','korupsi','pidana',
                 'tersangka','mahkamah','mk','kpk','bkn','ditangkap','ditahan','vonis','putusan',
                 'sidang','dakwaan','tuntutan','kasasi'],
  sains:        ['sains','penelitian','ilmiah','riset','penemuan','astronomi','fisika','kimia',
                 'biologi','bumi','alam','lingkungan','iklim','cuaca','gempa','tsunami','banjir',
                 'bmkg','lapan','lipi','brin'],
  hiburan:      ['film','musik','artis','selebritis','konser','award','sinetron','drakor','netflix',
                 'youtube','idol','celebrity','kpop','bts','blackpink','dramakorea','bioskop',
                 'oscar','grammy','wibu','anime','manga'],
  internasional:['internasional','global','dunia','luar negeri','Amerika','Eropa','China','Cina',
                 'PBB','nato','perang','konflik','Gaza','Ukraina','Rusia','Israel','Korea','Jepang',
                 'Australia','ASEAN','G20','WHO','IMF','geopolitik'],
  lifestyle:    ['fashion','kuliner','makanan','resep','wisata','travel','pariwisata','budaya',
                 'seni','komunitas','hobi','otomotif','mobil','motor','properti','rumah','desain',
                 'gaya hidup','workout','gym','diet','beauty','kecantikan'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Klasifikasi keyword ke kategori berita Indonesia
// ─────────────────────────────────────────────────────────────────────────────
function classifyCategory(keyword) {
  const kw = keyword.toLowerCase();
  let bestCategory = 'umum';
  let bestScore    = 0;

  for (const [cat, signals] of Object.entries(CATEGORY_SIGNALS)) {
    const score = signals.filter(s => kw.includes(s)).length;
    if (score > bestScore) {
      bestScore    = score;
      bestCategory = cat;
    }
  }

  return bestCategory;
}

// ─────────────────────────────────────────────────────────────────────────────
// Traffic string → confidence score 0–1
// "1M+"=0.95, "500K+"=0.90, "200K+"=0.80, "100K+"=0.70, "50K+"=0.60, else=0.50
// ─────────────────────────────────────────────────────────────────────────────
function trafficToConfidence(trafficStr) {
  if (!trafficStr) return 0.5;
  const str = trafficStr.toString().toUpperCase().replace(/[^0-9KMB+]/g, '');
  if (str.includes('M') || str.includes('B')) return 0.95;
  const num = parseInt(str.replace(/[^0-9]/g, '')) || 0;
  const isK = str.includes('K');
  const val  = isK ? num * 1000 : num;
  if (val >= 500000) return 0.90;
  if (val >= 200000) return 0.80;
  if (val >= 100000) return 0.70;
  if (val >= 50000)  return 0.60;
  return 0.50;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 9.1a — Fetch Google Trends Daily Trending RSS for Indonesia
// ─────────────────────────────────────────────────────────────────────────────
async function _fetchTrendsRSS() {
  const results = [];
  try {
    // rss-parser is already a project dependency
    const Parser = require('rss-parser');
    const parser = new Parser({
      timeout: 20000,
      customFields: {
        item: [
          ['ht:approx_traffic', 'approxTraffic'],
          ['ht:news_item',      'newsItems'],
        ],
      },
    });

    const feed = await parser.parseURL(TRENDS_RSS_URL);

    for (const item of (feed.items || [])) {
      const keyword = (item.title || '').trim();
      if (!keyword) continue;

      const traffic       = item.approxTraffic || item['ht:approx_traffic'] || '';
      const relatedTopics = [];

      // Extract related news item titles as context
      const newsRaw = item.newsItems || item['ht:news_item'];
      const newsArr = Array.isArray(newsRaw) ? newsRaw : (newsRaw ? [newsRaw] : []);
      for (const n of newsArr.slice(0, 3)) {
        const t = n['ht:news_item_title'] || n.title || '';
        if (t && typeof t === 'string') relatedTopics.push(t.trim());
      }

      results.push({
        keyword,
        traffic:        traffic.toString().replace(/[^0-9KMB+]/gi, '') || '50K+',
        relatedTopics,
        source: 'google_trends_rss',
      });
    }

    await logger.info('TrendFetcher', `RSS: ${results.length} trends fetched`);
  } catch (err) {
    await logger.warn('TrendFetcher', `Google Trends RSS failed: ${err.message}`);
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 9.1b — Fetch Google Trends Realtime (JSON hidden API, best-effort)
// Berguna sebagai supplementary signal ketika RSS tersedia
// ─────────────────────────────────────────────────────────────────────────────
async function _fetchTrendsRealtime() {
  const results = [];
  try {
    const axios = require('axios');
    const res   = await axios.get(TRENDS_REALTIME_URL, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsAIAgent/1.0)',
        'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
      },
    });

    // Google wraps JSON in ")]}'\n" — strip that prefix
    const raw  = (typeof res.data === 'string') ? res.data : JSON.stringify(res.data);
    const json = JSON.parse(raw.replace(/^\)\]\}'\n/, ''));

    const stories = json?.storySummaries?.trendingStories || [];
    for (const story of stories.slice(0, 20)) {
      const keyword = story.title || story.entityNames?.[0] || '';
      if (!keyword) continue;
      results.push({
        keyword: keyword.trim(),
        traffic: '100K+',
        relatedTopics: (story.articles || []).slice(0, 2).map(a => a.articleTitle || '').filter(Boolean),
        source: 'google_trends_realtime',
      });
    }

    await logger.info('TrendFetcher', `Realtime: ${results.length} trending stories fetched`);
  } catch (err) {
    // Realtime endpoint often has CORS/auth changes — expected to fail occasionally
    await logger.warn('TrendFetcher', `Google Trends Realtime failed (non-critical): ${err.message}`);
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Store trend signals to DB
// Dedupe: hapus entri 'predicted' hari ini sebelum insert baru
// ─────────────────────────────────────────────────────────────────────────────
async function _storeTrendSignals(signals) {
  if (!signals || !signals.length) return 0;

  const today = new Date().toISOString().slice(0, 10);

  // Clear today's raw (predicted) entries to avoid stale duplicates
  await query(
    `DELETE FROM trend_predictions WHERE status = 'predicted' AND created_at::date = $1::date`,
    [today]
  ).catch(() => {});

  let stored = 0;
  for (const s of signals) {
    try {
      const peakDate = new Date();
      peakDate.setDate(peakDate.getDate() + 3); // peak dalam 3–7 hari
      const peakStr = peakDate.toISOString().slice(0, 10);

      await query(
        `INSERT INTO trend_predictions
           (topic, category, confidence_score, predicted_peak_date, source_signals, status)
         VALUES ($1, $2, $3, $4, $5, 'predicted')`,
        [
          s.keyword,
          s.category || classifyCategory(s.keyword),
          s.confidence || trafficToConfidence(s.traffic),
          s.peakDate || peakStr,
          JSON.stringify({
            traffic:       s.traffic,
            relatedTopics: s.relatedTopics || [],
            source:        s.source,
            fetchedAt:     new Date().toISOString(),
          }),
        ]
      );
      stored++;
    } catch (_) { /* skip duplicates / constraint errors */ }
  }

  return stored;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC — Main refresh function (dipanggil cron setiap 6 jam & manual trigger)
// ─────────────────────────────────────────────────────────────────────────────
async function refreshTrends() {
  await logger.info('TrendFetcher', 'Starting Google Trends refresh for Indonesia');

  try {
    // Fetch from both sources in parallel
    const [rssResults, realtimeResults] = await Promise.all([
      _fetchTrendsRSS(),
      _fetchTrendsRealtime(),
    ]);

    // Merge, deduplicate by keyword (RSS takes precedence)
    const seen    = new Set();
    const merged  = [];
    for (const s of [...rssResults, ...realtimeResults]) {
      const key = s.keyword.toLowerCase().slice(0, 60);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push({
          ...s,
          category:   classifyCategory(s.keyword),
          confidence: trafficToConfidence(s.traffic),
        });
      }
    }

    if (!merged.length) {
      await logger.warn('TrendFetcher', 'No trend signals fetched — check connectivity');
      return { fetched: 0, stored: 0 };
    }

    const stored = await _storeTrendSignals(merged);

    await logger.info('TrendFetcher', `Trend refresh done: ${merged.length} fetched, ${stored} stored`, {
      total: merged.length, stored,
    });

    return { fetched: merged.length, stored };

  } catch (err) {
    await logger.error('TrendFetcher', `Trend refresh failed: ${err.message}`);
    return { fetched: 0, stored: 0, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC — Get recent trends from DB
// ─────────────────────────────────────────────────────────────────────────────
async function getRecentTrends(hours = 48) {
  const { rows } = await query(
    `SELECT id, topic, category, confidence_score, predicted_peak_date,
            source_signals, status, created_at
     FROM trend_predictions
     WHERE created_at > NOW() - ($1 || ' hours')::interval
     ORDER BY confidence_score DESC NULLS LAST, created_at DESC
     LIMIT 60`,
    [hours]
  );
  return rows;
}

module.exports = { refreshTrends, getRecentTrends, classifyCategory, trafficToConfidence };
