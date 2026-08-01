'use strict';

/**
 * Humanizer Layer — Phase 8 (Step 8.1 + 8.2)
 * 4-level post-processing untuk artikel agar tidak terdeteksi sebagai AI.
 *
 * Level 1 — Variasi Struktur         (selalu aktif)
 * Level 2 — Variasi Bahasa           (selalu aktif)
 * Level 3 — Naturalness Konten       (aktif jika config level >= 3)
 * Level 4 — Advanced Naturalness     (aktif jika config level = 4)
 *
 * aiDetectionPrecheck() — dijalankan SEBELUM LLM edit (Step 8.2)
 */

const config = require('../config');

// ── Konjungsi yang bisa disisipkan di awal kalimat (maks 1 per 5 paragraf) ───
const CONJUNCTIONS = [
  'Namun,', 'Padahal,', 'Bahkan,', 'Meski begitu,',
  'Ironisnya,', 'Ternyata,', 'Sementara itu,',
];

// ── Variasi atribusi kutipan ──────────────────────────────────────────────────
const ATTRIBUTION_VARIANTS = [
  'mengatakan', 'menyatakan', 'menegaskan', 'mengungkapkan',
  'menjelaskan', 'menuturkan', 'mengakui', 'memaparkan',
  'menyebutkan', 'menerangkan', 'menanggapi',
];
let _attrIndex = 0;
function nextAttribution() {
  return ATTRIBUTION_VARIANTS[_attrIndex++ % ATTRIBUTION_VARIANTS.length];
}

// ── Expanded AI Clichés (50+) ─────────────────────────────────────────────────
const AI_CLICHES = [
  // Pembuka klise
  [/Dalam era modern ini[,.]?\s*/gi, ''],
  [/Di era modern ini[,.]?\s*/gi, ''],
  [/Di tengah perkembangan [^,.]+[,.]/gi, ''],
  [/Di tengah dinamika [^,.]+[,.]/gi, ''],
  [/Di tengah kemajuan [^,.]+[,.]/gi, ''],
  [/Seiring perkembangan zaman[,.]?\s*/gi, ''],
  [/Seiring dengan perkembangan [^,.]+[,.]/gi, ''],
  [/Pada era globalisasi ini[,.]?\s*/gi, ''],
  [/Di era digital ini[,.]?\s*/gi, ''],
  [/Dalam konteks kekinian[,.]?\s*/gi, ''],
  [/Di zaman yang semakin maju ini[,.]?\s*/gi, ''],

  // Frasa generik berlebihan
  [/Tidak dapat dipungkiri bahwa/gi, 'Memang benar bahwa'],
  [/Tidak bisa dipungkiri bahwa/gi, 'Memang'],
  [/Sudah tidak dapat dipungkiri/gi, 'Sudah jelas'],
  [/Hal ini sangat penting karena/gi, 'Ini penting karena'],
  [/Hal ini sangat penting untuk/gi, 'Ini penting untuk'],
  [/Sangat (penting|krusial|vital|signifikan)\b/gi, (m, adj) => adj.charAt(0).toUpperCase() + adj.slice(1)],
  [/\bsignifikansi\b/gi, 'makna'],
  [/\bberimplikasi\b/gi, 'berdampak'],
  [/dampak yang signifikan/gi, 'dampak nyata'],
  [/dampak signifikan/gi, 'dampak besar'],
  [/implikasi yang luas/gi, 'dampak yang luas'],

  // Penutup klise
  [/Kesimpulannya, dapat disimpulkan\s*/gi, 'Sebagai penutup, '],
  [/Kesimpulannya,/gi, 'Akhirnya,'],
  [/Pada kesimpulannya,/gi, 'Akhirnya,'],
  [/Pada akhirnya, dapat disimpulkan bahwa/gi, 'Kesimpulannya,'],
  [/Dengan demikian, kita dapat menyimpulkan/gi, 'Dengan demikian'],
  [/Dengan demikian, dapat disimpulkan bahwa/gi, 'Dengan demikian,'],
  [/Secara keseluruhan,\s*dapat disimpulkan\s*/gi, 'Secara keseluruhan, '],

  // Transisi robot
  [/Ini menunjukkan bahwa/gi, 'Ini berarti'],
  [/Hal ini menunjukkan bahwa/gi, 'Artinya,'],
  [/Hal ini mencerminkan bahwa/gi, 'Ini mencerminkan'],
  [/Hal ini membuktikan bahwa/gi, 'Ini membuktikan'],
  [/Perlu dicatat bahwa/gi, 'Patut dicatat,'],
  [/Perlu dipahami bahwa/gi, 'Penting dipahami bahwa'],
  [/Penting untuk dicatat bahwa/gi, 'Perlu dicatat bahwa'],
  [/Penting untuk diingat bahwa/gi, 'Perlu diingat bahwa'],

  // Frasa mubazir/filler
  [/berbagai macam/gi, 'berbagai'],
  [/bermacam-macam/gi, 'beragam'],
  [/pada hakikatnya/gi, 'sebenarnya'],
  [/pada dasarnya/gi, 'pada intinya'],
  [/sebagai sebuah/gi, 'sebagai'],
  [/merupakan sebuah/gi, 'adalah'],
  [/merupakan suatu/gi, 'adalah'],
  [/adalah sebuah/gi, 'adalah'],
  [/tentunya/gi, 'tentu'],
  [/sudah tentu/gi, 'tentu'],
  [/sudah pasti/gi, 'jelas'],
  [/tidak heran jika/gi, 'wajar jika'],
  [/tidak mengherankan jika/gi, 'wajar jika'],
  [/layak untuk dipertimbangkan/gi, 'perlu dipertimbangkan'],
];

// ── Referensi waktu kontekstual (Level 3) ────────────────────────────────────
const TIME_REFERENCES = [
  'Senin lalu', 'Selasa lalu', 'Rabu lalu', 'Kamis lalu', 'Jumat lalu',
  'Awal pekan ini', 'Pertengahan pekan ini', 'Akhir pekan lalu',
  'Awal bulan ini', 'Pertengahan bulan ini', 'Menjelang akhir bulan',
  'Awal tahun ini', 'Pertengahan tahun ini', 'Beberapa hari lalu',
  'Beberapa waktu terakhir', 'Dalam beberapa hari terakhir',
];

// ── Wilayah Indonesia (Level 3) ───────────────────────────────────────────────
const INDONESIAN_REGIONS = [
  'di Jakarta', 'di Surabaya', 'di Bandung', 'di Medan', 'di Makassar',
  'di Semarang', 'di Yogyakarta', 'di Bali', 'di Palembang',
  'di berbagai kota besar Indonesia', 'di wilayah Jabodetabek',
  'di kawasan Indonesia bagian timur', 'di sejumlah provinsi',
];

// ── Pertanyaan retoris per topik umum (Level 3) ───────────────────────────────
const RHETORICAL_QUESTIONS = [
  'Lalu, apa dampaknya bagi masyarakat?',
  'Tapi, apakah langkah ini cukup?',
  'Pertanyaannya, siapa yang paling merasakan dampaknya?',
  'Lantas, apa yang bisa dilakukan ke depan?',
  'Namun, apakah hal ini akan berlangsung lama?',
  'Yang jadi pertanyaan, seberapa efektif langkah ini?',
  'Tapi, apa yang sesungguhnya terjadi di balik angka ini?',
];

// ── Penanda ketidakpastian alami (Level 3) ────────────────────────────────────
const UNCERTAINTY_MARKERS = [
  ', meski angka pastinya belum tersedia',
  ', yang masih menunggu konfirmasi resmi',
  ', berdasarkan data yang ada saat ini',
  ', meskipun belum ada pernyataan resmi',
  ', sejauh yang bisa dikonfirmasi',
  ', kendati verifikasi lanjutan masih diperlukan',
];

// ── Variasi cara mengakhiri artikel (Level 4) ─────────────────────────────────
const CLOSING_VARIATION_PATTERNS = [
  // Pola penutup yang terlalu standar → biarkan, Level 4 tidak mengubah karena berisiko
  // Level 4 fokus pada approximation number dan unexpected detail
];

// ─────────────────────────────────────────────────────────────────────────────
// LEVEL 1 — Variasi Struktur
// ─────────────────────────────────────────────────────────────────────────────
function level1_structureVariation(text) {
  const paragraphs = text.split(/\n\n+/);
  if (paragraphs.length < 3) return text;

  const result = [];
  // Detect runs of 3+ consecutive paragraphs with similar length (±10%)
  for (let i = 0; i < paragraphs.length; i++) {
    let p = paragraphs[i];

    // Check if this starts a run of 3+ same-length paragraphs
    if (
      i + 2 < paragraphs.length &&
      _similarLength(paragraphs[i], paragraphs[i + 1], 0.10) &&
      _similarLength(paragraphs[i + 1], paragraphs[i + 2], 0.10)
    ) {
      // Break the pattern on the current paragraph: split the longest sentence out
      p = _breakParagraphPattern(p);
    }

    result.push(p);
  }

  // Detect paragraphs all starting with same word/pattern → variasi subjek
  const starts = result.map(p => p.split(/\s+/)[0]?.toLowerCase());
  for (let i = 1; i < result.length - 1; i++) {
    if (starts[i] === starts[i - 1] && starts[i] === starts[i + 1] && starts[i]) {
      // Rotate the subject: prepend a connector to the middle paragraph
      result[i] = _prependConnector(result[i]);
    }
  }

  return result.join('\n\n');
}

function _similarLength(a, b, tolerance) {
  if (!a || !b) return false;
  const la = a.length, lb = b.length;
  if (!la || !lb) return false;
  return Math.abs(la - lb) / Math.max(la, lb) <= tolerance;
}

function _breakParagraphPattern(paragraph) {
  const sentences = paragraph.split(/(?<=[.!?])\s+/);
  if (sentences.length <= 2) return paragraph;
  // Move last sentence to its own paragraph (returned as two joined by \n\n)
  const main = sentences.slice(0, -1).join(' ');
  const tail = sentences[sentences.length - 1];
  return main + '\n\n' + tail;
}

function _prependConnector(paragraph) {
  const connectors = ['Adapun, ', 'Sementara itu, ', 'Lebih jauh, ', 'Terkait hal ini, '];
  const c = connectors[Math.floor(Math.random() * connectors.length)];
  // Lowercase the first char of paragraph after connector
  return c + paragraph.charAt(0).toLowerCase() + paragraph.slice(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// LEVEL 2 — Variasi Bahasa
// ─────────────────────────────────────────────────────────────────────────────
function level2_languageVariation(text) {
  let result = text;

  // Remove AI clichés
  for (const [pattern, replacement] of AI_CLICHES) {
    result = result.replace(
      pattern,
      typeof replacement === 'function' ? replacement : replacement
    );
  }

  // Rotate attribution verbs
  result = result.replace(
    /\b(mengatakan|menyatakan|menegaskan|mengungkapkan|menjelaskan|menuturkan|menyebutkan|menerangkan)\b/g,
    () => nextAttribution()
  );

  // Selective konjungsi insertion (max 1 per 5 paragraphs in a run)
  const paragraphs = result.split(/\n\n+/);
  let lastInjected = -99;
  for (let i = 3; i < paragraphs.length - 1; i++) {
    if (i - lastInjected >= 5 && !paragraphs[i].match(/^(Namun|Padahal|Bahkan|Meski|Ironisnya|Ternyata|Sementara|Adapun)/)) {
      // Only inject if paragraph doesn't already start with a conjunction
      const conj = CONJUNCTIONS[i % CONJUNCTIONS.length];
      paragraphs[i] = conj + ' ' + paragraphs[i].charAt(0).toLowerCase() + paragraphs[i].slice(1);
      lastInjected = i;
    }
  }
  result = paragraphs.join('\n\n');

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// LEVEL 3 — Naturalness Konten
// ─────────────────────────────────────────────────────────────────────────────
function level3_naturalness(text) {
  const paragraphs = text.split(/\n\n+/);
  const result = [...paragraphs];

  // 1. Tambah referensi waktu kontekstual (1 per artikel, di paragraf ke-2 atau ke-3)
  const timeInsertIdx = Math.min(2, result.length - 1);
  if (timeInsertIdx > 0 && result[timeInsertIdx]) {
    const timeRef = TIME_REFERENCES[Math.floor(Math.random() * TIME_REFERENCES.length)];
    // Insert into first sentence of the paragraph if it contains a date-neutral verb
    result[timeInsertIdx] = _insertTimeRef(result[timeInsertIdx], timeRef);
  }

  // 2. Tambah pertanyaan retoris (max 1 per 4 paragraf, di tengah artikel)
  if (result.length >= 5) {
    const rhetoricIdx = Math.floor(result.length / 2); // tengah artikel
    const existingRhetoric = result.slice(0, rhetoricIdx + 1).filter(p =>
      p.trim().endsWith('?')
    ).length;
    if (existingRhetoric === 0) {
      const q = RHETORICAL_QUESTIONS[Math.floor(Math.random() * RHETORICAL_QUESTIONS.length)];
      result[rhetoricIdx] = result[rhetoricIdx] + '\n\n' + q;
    }
  }

  // 3. Tambah ketidakpastian yang jujur (1 per artikel, di kalimat yang cocok)
  for (let i = 1; i < result.length - 1; i++) {
    // Cari paragraf yang berisi klaim angka atau statistik
    if (/\d+[%\s]|(persen|juta|miliar|ribu)/.test(result[i]) && !result[i].includes('belum')) {
      const marker = UNCERTAINTY_MARKERS[i % UNCERTAINTY_MARKERS.length];
      // Insert at end of first sentence
      result[i] = result[i].replace(/([.!])\s/, `$1${marker}. `);
      break; // hanya sekali
    }
  }

  return result.join('\n\n');
}

function _insertTimeRef(paragraph, timeRef) {
  // Cari kata kerja yang bisa diberi konteks waktu
  const timePatterns = [
    { re: /(\b(diumumkan|dirilis|diluncurkan|diterbitkan|disampaikan)\b)/, after: true },
    { re: /(\b(terjadi|berlangsung|dilaksanakan|digelar|diadakan)\b)/, after: true },
  ];
  for (const { re, after } of timePatterns) {
    if (re.test(paragraph)) {
      return paragraph.replace(re, (m) => after ? `${m} ${timeRef}` : `${timeRef} ${m}`);
    }
  }
  // Fallback: tambah "Menurut laporan [timeRef]," di awal kalimat kedua jika ada
  const sentences = paragraph.split(/(?<=[.!?])\s+/);
  if (sentences.length >= 2) {
    sentences[1] = `Menurut laporan ${timeRef}, ` + sentences[1].charAt(0).toLowerCase() + sentences[1].slice(1);
    return sentences.join(' ');
  }
  return paragraph;
}

// ─────────────────────────────────────────────────────────────────────────────
// LEVEL 4 — Advanced Naturalness
// ─────────────────────────────────────────────────────────────────────────────
function level4_advanced(text) {
  let result = text;

  // 1. Minor linguistic imprecision: "sekitar X" alih-alih angka bulat persis
  //    Hanya angka ribuan bulat (bukan tahun, bukan ID)
  result = result.replace(/\b(\d{4,})\b/g, (match, numStr) => {
    const n = parseInt(numStr);
    // Skip years (1900-2030), IDs (too large), non-round numbers
    if (n >= 1900 && n <= 2030) return match;    // tahun
    if (numStr.length > 8) return match;          // terlalu besar
    if (n % 1000 !== 0 && n % 500 !== 0) return match; // bukan angka bulat
    // 30% chance to approximate
    if (Math.random() < 0.3) return `sekitar ${match}`;
    return match;
  });

  // 2. Variasi cara mengakhiri artikel
  //    Jika paragraf terakhir diawali "Ke depannya," / "Diharapkan" / "Semoga" — variasikan
  const paragraphs = result.split(/\n\n+/);
  const lastP = paragraphs[paragraphs.length - 1];
  if (/^(Ke depannya|Diharapkan|Semoga|Harapannya)/i.test(lastP)) {
    // Replace with a factual closing restatement prefix
    const closingPrefixes = [
      'Yang jelas, ', 'Satu hal yang pasti, ', 'Yang menarik, ',
      'Catatan penting: ',
    ];
    const prefix = closingPrefixes[Math.floor(Math.random() * closingPrefixes.length)];
    paragraphs[paragraphs.length - 1] = prefix + lastP.charAt(0).toLowerCase() + lastP.slice(1);
    result = paragraphs.join('\n\n');
  }

  // 3. Variasi atribusi kutipan — ganti "mengatakan" yang berulang berturut-turut
  //    (sudah ditangani Level 2, Level 4 menambah variannya lebih jauh)

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI DETECTION PRE-CHECK (Step 8.2)
// Dijalankan SEBELUM LLM edit — identifikasi pola AI untuk dihilangkan
// ─────────────────────────────────────────────────────────────────────────────
function aiDetectionPrecheck(text) {
  const flags = [];

  // === Pola Pembuka Klise ===
  if (/^Dalam era modern ini/im.test(text))      flags.push({ type: 'opening_cliche',   msg: 'Pembuka klise: "Dalam era modern ini"' });
  if (/^Di tengah perkembangan/im.test(text))    flags.push({ type: 'opening_cliche',   msg: 'Pembuka klise: "Di tengah perkembangan"' });
  if (/^Di era digital ini/im.test(text))        flags.push({ type: 'opening_cliche',   msg: 'Pembuka klise: "Di era digital ini"' });
  if (/^Seiring perkembangan zaman/im.test(text))flags.push({ type: 'opening_cliche',   msg: 'Pembuka klise: "Seiring perkembangan zaman"' });

  // === Pola Penutup Klise ===
  if (/Kesimpulannya, dapat disimpulkan/i.test(text))
    flags.push({ type: 'closing_cliche', msg: 'Penutup klise ganda: "Kesimpulannya, dapat disimpulkan"' });
  if (/Dengan demikian, kita dapat menyimpulkan/i.test(text))
    flags.push({ type: 'closing_cliche', msg: 'Penutup klise: "Dengan demikian, kita dapat menyimpulkan"' });
  if (/Pada akhirnya, dapat disimpulkan/i.test(text))
    flags.push({ type: 'closing_cliche', msg: 'Penutup klise: "Pada akhirnya, dapat disimpulkan"' });

  // === Kata berlebihan ===
  const sigCount = (text.match(/\b(signifikansi|berimplikasi|implikasi yang)\b/gi) || []).length;
  if (sigCount > 3)
    flags.push({ type: 'overused_word', msg: `"signifikansi/berimplikasi" digunakan ${sigCount}× — terlalu banyak, ganti sinonim` });

  const dampakCount = (text.match(/dampak yang signifikan/gi) || []).length;
  if (dampakCount > 2)
    flags.push({ type: 'overused_phrase', msg: '"dampak yang signifikan" berulang — variasikan' });

  // === Pola "Hal ini..."/"Ini menunjukkan..." berulang ===
  const halIniCount = (text.match(/^Hal ini\s/gim) || []).length;
  if (halIniCount >= 3)
    flags.push({ type: 'repetitive_pattern', msg: `"Hal ini..." muncul ${halIniCount}× sebagai awal kalimat — variasikan subjek` });

  const iniMenunjukkan = (text.match(/Ini menunjukkan bahwa|Hal ini menunjukkan bahwa/gi) || []).length;
  if (iniMenunjukkan >= 2)
    flags.push({ type: 'repetitive_pattern', msg: '"Ini/Hal ini menunjukkan bahwa" berulang — gunakan transisi yang lebih variatif' });

  // === Pola "Pertama... Kedua... Ketiga..." berlebihan ===
  const listPattern = (text.match(/\b(pertama|kedua|ketiga|keempat|kelima)\b/gi) || []).length;
  if (listPattern > 5)
    flags.push({ type: 'list_pattern', msg: `"pertama/kedua/ketiga" muncul ${listPattern}× — ubah sebagian ke narasi alami` });

  // === Uniformitas paragraf ===
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  let uniformRun = 0;
  let prevLen = 0;
  let uniformFlagged = false;
  for (const p of paragraphs) {
    const len = p.length;
    if (prevLen && Math.abs(len - prevLen) / Math.max(prevLen, len) < 0.08) {
      uniformRun++;
      if (uniformRun >= 2 && !uniformFlagged) {
        flags.push({ type: 'uniform_paragraphs', msg: '3+ paragraf berurutan dengan panjang sangat mirip — perlu variasi' });
        uniformFlagged = true;
      }
    } else {
      uniformRun = 0;
    }
    prevLen = len;
  }

  // === Setiap paragraf dimulai pola sama ===
  const starts = paragraphs.map(p => p.split(/\s+/)[0]?.toLowerCase()).filter(Boolean);
  const startFreq = {};
  for (const s of starts) startFreq[s] = (startFreq[s] || 0) + 1;
  for (const [word, freq] of Object.entries(startFreq)) {
    if (freq >= 4 && word.length > 2) {
      flags.push({ type: 'repeated_starts', msg: `Paragraf terlalu sering dimulai dengan "${word}" (${freq}×)` });
    }
  }

  // === Transisi sempurna antar paragraf ===
  const perfectTransitions = [
    'Pertama-tama,', 'Selanjutnya,', 'Kemudian,', 'Selain itu,',
    'Lebih lanjut,', 'Terakhir,', 'Sebagai penutup,',
  ];
  let transitionCount = 0;
  for (const t of perfectTransitions) {
    if (text.includes(t)) transitionCount++;
  }
  if (transitionCount >= 4)
    flags.push({ type: 'perfect_transitions', msg: `Terlalu banyak transisi sempurna antar paragraf (${transitionCount} jenis) — pecah pola, tambah variasi` });

  return flags;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN humanize() function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply humanizer to text.
 * @param {string} text - Article content
 * @param {number|null} level - Override level (1-4). If null: uses config.humanizerLevel.
 * @returns {string} Humanized text
 */
function humanize(text, level = null) {
  if (!text || typeof text !== 'string') return text || '';

  const activeLevel = level !== null ? level : (config.humanizerLevel || 3);
  let result = text;

  // Level 1 & 2 always active (minimum standard)
  result = level1_structureVariation(result);
  result = level2_languageVariation(result);

  if (activeLevel >= 3) result = level3_naturalness(result);
  if (activeLevel >= 4) result = level4_advanced(result);

  return result;
}

/**
 * Get a summary of what humanize() changed (for logging/reporting).
 * @param {string} original
 * @param {string} humanized
 * @returns {{ changes: string[], aiFlags: object[] }}
 */
function humanizeReport(original, humanized) {
  const aiFlags = aiDetectionPrecheck(original);
  const changes = [];

  // Count cliché replacements
  let clicheCount = 0;
  for (const [pattern] of AI_CLICHES) {
    const matches = original.match(pattern);
    if (matches) clicheCount += matches.length;
  }
  if (clicheCount > 0) changes.push(`${clicheCount} frasa klise AI dihilangkan/diganti`);

  // Attribution rotations
  const origAttrib = (original.match(/\b(mengatakan|menyatakan|menegaskan)\b/g) || []).length;
  const newAttrib  = (humanized.match(/\b(mengatakan|menyatakan|menegaskan)\b/g) || []).length;
  if (origAttrib !== newAttrib) changes.push('Variasi atribusi kutipan diterapkan');

  // Paragraph breaks
  const origParas = original.split(/\n\n+/).length;
  const newParas  = humanized.split(/\n\n+/).length;
  if (newParas > origParas) changes.push(`${newParas - origParas} paragraf baru dari pemecahan pola seragam`);

  if (changes.length === 0) changes.push('Tidak ada perubahan signifikan (teks sudah natural)');

  return { changes, aiFlags };
}

module.exports = { humanize, aiDetectionPrecheck, humanizeReport };
