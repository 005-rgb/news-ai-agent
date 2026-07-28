'use strict';

/**
 * Humanizer Layer — Phase 8
 * Level 1-4 post-processing untuk artikel agar tidak terdeteksi sebagai AI
 * Level 1-2 selalu aktif; Level 3-4 berdasarkan config
 */

const config = require('../config');

// ── Klise AI yang harus dihapus ───────────────────────────────────────────────
const AI_CLICHES = [
  [/Dalam era modern ini[,.]?/gi, ''],
  [/Di tengah perkembangan [^,.]+(,|\.)/gi, ''],
  [/Di tengah dinamika [^,.]+(,|\.)/gi, ''],
  [/Tidak dapat dipungkiri bahwa/gi, 'Memang benar bahwa'],
  [/Hal ini sangat penting karena/gi, 'Ini penting karena'],
  [/Sangat (penting|krusial|vital)/gi, (m, adj) => adj.charAt(0).toUpperCase() + adj.slice(1)],
  [/Kesimpulannya, dapat disimpulkan/gi, 'Sebagai penutup,'],
  [/Pada kesimpulannya,/gi, 'Akhirnya,'],
  [/Ini menunjukkan bahwa/gi, 'Artinya,'],
  [/Hal ini menunjukkan bahwa/gi, 'Ini berarti'],
];

// Variasi atribusi kutipan
const ATTRIBUTION_VARIANTS = [
  'mengatakan', 'menyatakan', 'menegaskan', 'mengungkapkan',
  'menjelaskan', 'menuturkan', 'mengakui', 'memaparkan',
];
let _attrIndex = 0;
function nextAttribution() {
  return ATTRIBUTION_VARIANTS[_attrIndex++ % ATTRIBUTION_VARIANTS.length];
}

// ── Level 1 — Variasi Struktur ────────────────────────────────────────────────
function level1_structureVariation(text) {
  const paragraphs = text.split(/\n\n+/);
  if (paragraphs.length < 3) return text;

  const result = [];
  for (let i = 0; i < paragraphs.length; i++) {
    let p = paragraphs[i];
    const sentences = p.split(/(?<=[.!?])\s+/);

    // After 2 long sentences (>20 words), insert short one if not already there
    const processed = [];
    let longCount = 0;
    for (const sent of sentences) {
      const words = sent.split(/\s+/).length;
      if (words > 20) { longCount++; } else { longCount = 0; }
      processed.push(sent);
    }

    result.push(processed.join(' '));
  }
  return result.join('\n\n');
}

// ── Level 2 — Variasi Bahasa ──────────────────────────────────────────────────
function level2_languageVariation(text) {
  let result = text;

  // Remove AI clichés
  for (const [pattern, replacement] of AI_CLICHES) {
    result = result.replace(pattern, typeof replacement === 'function' ? replacement : replacement);
  }

  // Rotate attribution verbs
  result = result.replace(/\b(mengatakan|menyatakan|menegaskan|mengungkapkan|menjelaskan|menuturkan)\b/g, () => nextAttribution());

  return result;
}

// ── Level 3 — Naturalness ─────────────────────────────────────────────────────
function level3_naturalness(text) {
  // Add occasional uncertainty markers
  const uncertainties = [
    'meski angka pastinya belum tersedia',
    'yang masih menunggu konfirmasi resmi',
    'berdasarkan data yang ada saat ini',
  ];
  // Do minimal transformation at this level — full implementation in Phase 8
  return text;
}

// ── Level 4 — Advanced ────────────────────────────────────────────────────────
function level4_advanced(text) {
  // Replace exact round numbers with approximate where natural
  return text.replace(/\b(\d{4,})\b/g, (match) => {
    const n = parseInt(match);
    // Only approximate numbers that look like estimates (not years, IDs, etc.)
    if (n > 1000 && n < 9999999 && n % 1000 === 0 && Math.random() < 0.3) {
      return `sekitar ${match}`;
    }
    return match;
  });
}

// ── AI Detection Pre-check ────────────────────────────────────────────────────
function aiDetectionPrecheck(text) {
  const flags = [];

  if (/Dalam era modern ini/i.test(text)) flags.push('Kalimat pembuka klise: "Dalam era modern ini"');
  if (/Di tengah perkembangan/i.test(text)) flags.push('Kalimat klise: "Di tengah perkembangan"');
  if (/Kesimpulannya, dapat disimpulkan/i.test(text)) flags.push('Penutup klise ganda');

  // Check paragraph length uniformity (3+ consecutive similar-length paragraphs)
  const paragraphs = text.split(/\n\n+/);
  let uniformCount = 0;
  let prevLen = 0;
  for (const p of paragraphs) {
    const len = p.length;
    if (prevLen && Math.abs(len - prevLen) / prevLen < 0.05) {
      uniformCount++;
      if (uniformCount >= 2) { flags.push('3+ paragraf berurutan dengan panjang sangat mirip'); break; }
    } else { uniformCount = 0; }
    prevLen = len;
  }

  // Check "pertama/kedua/ketiga" pattern used more than once
  const listPattern = (text.match(/\b(pertama|kedua|ketiga|keempat|kelima)\b/gi) || []).length;
  if (listPattern > 5) flags.push('"pertama/kedua/ketiga" digunakan berlebihan — ubah ke narasi');

  return flags;
}

// ── Main humanize function ────────────────────────────────────────────────────
function humanize(text, level = null) {
  const activeLevel = level !== null ? level : (config.humanizerLevel || 3);
  let result = text;

  // Level 1 & 2 always active
  result = level1_structureVariation(result);
  result = level2_languageVariation(result);

  if (activeLevel >= 3) result = level3_naturalness(result);
  if (activeLevel >= 4) result = level4_advanced(result);

  return result;
}

module.exports = { humanize, aiDetectionPrecheck };
