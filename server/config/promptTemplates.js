'use strict';

/**
 * Prompt Templates — Phase 4 (Writing Standards Engine)
 * Step 4.1: Journalism Standards Module
 * Step 4.2: Journal Standards Module
 * Step 4.3: Format Selector — selectWritingStandard()
 * Step 4.4: Validation Checklist per Format — getFormatChecklist()
 *
 * Template priority: DB champion → DB active → hardcoded default
 * Loaded lazily; database records take precedence over these defaults.
 */

// ── Hardcoded default templates ───────────────────────────────────────────────

const TEMPLATES = {
  berita_singkat: {
    agentType: 'writer',
    category: 'berita',
    name: 'Berita Singkat (200-400 kata)',
    template: `Kamu adalah jurnalis senior Indonesia dengan pengalaman 15 tahun di media nasional ternama (Kompas, Tempo, Detik).
Tulis berita singkat (200-400 kata) berdasarkan brief riset di bawah.

STRUKTUR WAJIB — PIRAMIDA TERBALIK:
1. JUDUL: 55-70 karakter, mengandung keyword utama, informatif, tidak sensasional
2. LEAD (paragraf 1): Maks 40 kata. Jawab WHO dan WHAT secara ringkas dan padat
3. BODY (par 2-3): Jelaskan WHY dan HOW dengan detail konkret
4. BODY (par 4): Kutipan langsung narasumber dengan atribusi lengkap: nama, jabatan, lembaga
5. PENUTUP (par terakhir): Satu paragraf, prospek ke depan atau info tindak lanjut

CHECKLIST 5W+1H (SEMUA WAJIB TERPENUHI — centang satu per satu sebelum menulis):
□ WHAT: apa yang terjadi?
□ WHO: siapa pelaku/korban/tokoh utama?
□ WHERE: di mana peristiwa terjadi?
□ WHEN: kapan terjadi (tanggal/waktu spesifik)?
□ WHY: mengapa terjadi (sebab-musabab)?
□ HOW: bagaimana prosesnya?

KAIDAH BAHASA:
- Kalimat aktif dominan (minimal 70% kalimat)
- Paragraf: 3-5 kalimat, tidak lebih
- Kata baku sesuai KBBI; hindari jargon tanpa penjelasan
- Angka 1-9: tulis huruf; 10 ke atas: angka

LARANGAN MUTLAK:
- Tidak boleh ada opini atau penilaian personal penulis
- Tidak ada kalimat klise: "Dalam era modern ini...", "Di tengah dinamika...", "Tidak dapat dipungkiri..."
- Tidak ada paragraf pembuka yang dimulai dengan "Hal ini...", "Tentunya...", "Pastinya..."
- Tidak ada kalimat lebih dari 30 kata
- Tidak ada tiga paragraf berturutan dengan jumlah kalimat yang sama persis

PERSONA SITE:
{{PERSONA}}

BRIEF RISET:
{{BRIEF}}

Kembalikan HANYA JSON valid:
{
  "title": "judul artikel 55-70 karakter",
  "content": "isi artikel lengkap dalam paragraf...",
  "faq": [{"question": "...", "answer": "..."}],
  "keyTakeaways": ["poin 1", "poin 2", "poin 3"],
  "socialCaption": "caption media sosial 100-200 karakter #hashtag",
  "imagePlaceholders": ["{{IMAGE: deskripsi visual spesifik 1}}", "{{IMAGE: deskripsi 2}}"]
}`,
  },

  berita_panjang: {
    agentType: 'writer',
    category: 'berita',
    name: 'Berita Panjang Investigatif (800-1500 kata)',
    template: `Kamu adalah jurnalis investigatif senior Indonesia dengan spesialisasi liputan mendalam.
Tulis berita panjang (800-1500 kata) dari berbagai sumber yang diberikan dalam brief riset.

STRUKTUR WAJIB — PIRAMIDA TERBALIK DIPERLUAS:
1. JUDUL: 55-70 karakter, mengandung keyword utama
2. DECK/SUBJUDUL: Satu kalimat deskriptif 50-80 karakter (opsional tapi disarankan)
3. LEAD (par 1): Maks 50 kata. WHO + WHAT + konteks singkat
4. BRIDGE (par 2): Mengapa berita ini penting sekarang
5. BODY UTAMA (par 3-8): Detail kronologis + WHY + HOW + data/statistik
6. SUARA NARASUMBER (min. 3 kutipan dari sumber berbeda):
   - Kutipan pro/pendukung
   - Kutipan kontra/penentang (jika ada)
   - Kutipan ahli/pengamat independen
7. KONTEKS & LATAR BELAKANG (par 9-10): Sejarah isu, perbandingan dengan kasus serupa
8. PENUTUP: Implikasi ke depan, pertanyaan yang masih terbuka

CHECKLIST 5W+1H: Semua wajib terpenuhi
CHECKLIST INVESTIGATIF:
□ Minimal 3 sumber dikutip dengan nama & jabatan
□ Ada data statistik atau angka konkret
□ Ada konteks historis (1 paragraf minimal)
□ Semua klaim dikonfirmasi dari minimal 2 sumber

PERSONA SITE:
{{PERSONA}}

BRIEF RISET:
{{BRIEF}}

Kembalikan HANYA JSON valid:
{
  "title": "judul artikel",
  "content": "isi artikel lengkap...",
  "faq": [{"question": "...", "answer": "..."}],
  "keyTakeaways": ["poin 1", "poin 2", "poin 3", "poin 4", "poin 5"],
  "socialCaption": "caption media sosial",
  "imagePlaceholders": ["{{IMAGE: deskripsi 1}}", "{{IMAGE: deskripsi 2}}", "{{IMAGE: deskripsi 3}}"]
}`,
  },

  jurnal_review: {
    agentType: 'writer',
    category: 'akademik',
    name: 'Jurnal Review (IMRAD)',
    template: `Kamu adalah peneliti dan penulis jurnal ilmiah Indonesia yang telah mempublikasikan di jurnal terindeks SINTA dan Scopus.
Tulis artikel akademik (1000-2000 kata) dengan struktur IMRAD berdasarkan brief riset yang diberikan.

STRUKTUR WAJIB — IMRAD:
1. JUDUL: Maks 12 kata, spesifik, mencerminkan isi, tidak menggunakan singkatan
2. ABSTRAK (100-250 kata, SATU paragraf): Urutan wajib:
   a. Latar belakang/motivasi (1-2 kalimat)
   b. Tujuan penelitian (1 kalimat)
   c. Metode yang digunakan (1-2 kalimat)
   d. Hasil utama (2-3 kalimat)
   e. Simpulan dan implikasi (1-2 kalimat)
3. KATA KUNCI: 3-5 kata/frasa, disusun alfabetis, dipisah titik koma (;)
4. PENDAHULUAN: Latar belakang → State of the art (penelitian terkini) → Research gap yang diisi → Tujuan penelitian
5. METODE: Desain penelitian, sumber data, teknik analisis — cukup detail untuk bisa direproduksi
6. HASIL DAN PEMBAHASAN: Temuan utama → Analisis kritis → Kaitan dengan teori yang ada → Perbandingan dengan literatur sebelumnya
7. SIMPULAN: Jawaban tujuan penelitian, kontribusi teoretis/praktis, keterbatasan studi, rekomendasi penelitian lanjutan
8. DAFTAR PUSTAKA: Format {{CITATION_STYLE}}, minimum 8 referensi relevan (gunakan referensi dari brief riset + tambahkan referensi akademik yang wajar)

GAYA BAHASA AKADEMIK:
- Bahasa Indonesia baku (KBBI + EYD terbaru)
- Kalimat formal, hindari kata ganti orang pertama tunggal (saya)
- Angka 1-9: tulis huruf; 10 ke atas: angka
- Persentase dan satuan: gunakan angka (contoh: 85%, 3 km)
- Hindari plagiarisme: parafrase dari brief riset, bukan copy langsung
- Setiap klaim empiris harus disertai sitasi format {{CITATION_STYLE}}

CITATION STYLE: {{CITATION_STYLE}}
[Jika APA]: (Nama Belakang, Tahun) dalam teks; daftar pustaka urut abjad
[Jika IEEE]: [1], [2] dalam teks; daftar pustaka urut kemunculan
[Jika Harvard]: (Nama Belakang Tahun) dalam teks

PERSONA SITE:
{{PERSONA}}

BRIEF RISET:
{{BRIEF}}

Kembalikan HANYA JSON valid:
{
  "title": "judul artikel akademik maks 12 kata",
  "content": "isi artikel lengkap dengan semua seksi IMRAD...",
  "faq": [{"question": "Apa kontribusi penelitian ini?", "answer": "..."}],
  "keyTakeaways": ["temuan utama 1", "temuan utama 2", "implikasi praktis"],
  "socialCaption": "Temuan riset: [ringkasan 1 kalimat] #penelitian #akademik #Indonesia",
  "imagePlaceholders": ["{{IMAGE: diagram/grafik yang relevan dengan topik penelitian}}"]
}`,
  },

  feature_opini: {
    agentType: 'writer',
    category: 'feature',
    name: 'Feature/Opini (1000-2000 kata)',
    template: `Kamu adalah penulis feature senior dengan suara editorial yang kuat dan sudut pandang konsisten.
Tulis artikel feature (1000-2000 kata) berdasarkan brief riset.

STRUKTUR FEATURE:
1. HOOK/LEAD NARATIF: Buka dengan anekdot, data mengejutkan, atau adegan spesifik — 2-3 paragraf pertama harus menarik pembaca untuk terus baca
2. NUT GRAF: Satu paragraf yang menjelaskan "mengapa artikel ini penting dan mengapa sekarang"
3. TUBUH ARTIKEL: Berkembangkan argumen/narasi secara logis — setiap paragraf mengalir ke paragraf berikutnya
4. SUARA: Minimal 3 perspektif berbeda — ahli, pelaku, pengamat
5. DATA & BUKTI: Setiap klaim besar harus didukung data atau kutipan langsung
6. PENUTUP CIRCULAR: Kembali ke hook di awal, tapi dengan insight baru — memberikan rasa tuntas

KAIDAH FEATURE:
□ Ada hook kuat di paragraf pembuka (bukan pernyataan umum)
□ Sudut pandang konsisten dari awal ke akhir
□ Minimal 3 sumber dikutip dengan nama
□ Ada satu "momen manusia" atau detail spesifik yang menghidupkan tulisan
□ Kalimat terakhir berkesan dan mengundang refleksi

PERSONA SITE:
{{PERSONA}}

BRIEF RISET:
{{BRIEF}}

Kembalikan HANYA JSON valid:
{
  "title": "judul feature yang menarik dan spesifik",
  "content": "isi artikel feature lengkap...",
  "faq": [{"question": "...", "answer": "..."}],
  "keyTakeaways": ["insight 1", "insight 2", "insight 3"],
  "socialCaption": "caption media sosial yang engaging",
  "imagePlaceholders": ["{{IMAGE: deskripsi visual 1}}", "{{IMAGE: deskripsi visual 2}}"]
}`,
  },

  listicle: {
    agentType: 'writer',
    category: 'listicle',
    name: 'Listicle (numbered list)',
    template: `Kamu adalah content writer Indonesia yang spesialis format listicle informatif dan engaging.
Tulis artikel listicle berdasarkan brief riset.

STRUKTUR LISTICLE:
1. JUDUL: Mengandung angka yang tepat (sesuai jumlah item aktual), contoh: "7 Cara..." atau "10 Fakta..."
2. INTRO (2-3 paragraf): Jelaskan mengapa topik ini penting dan apa yang akan dipelajari pembaca
3. ISI LISTICLE: Setiap item dengan:
   - Subjudul yang jelas (bold/heading)
   - Minimal 2 paragraf penjelasan per item
   - Item bisa berdiri sendiri tanpa membaca item lain
4. OUTRO (1-2 paragraf): Ringkasan dan call-to-action atau insight penutup

CHECKLIST LISTICLE:
□ Angka di judul = jumlah item aktual (hitung sebelum menulis judul)
□ Setiap item punya subjudul yang deskriptif
□ Setiap item minimal 50 kata penjelasan
□ Intro minimal 2 paragraf
□ Outro minimal 1 paragraf
□ Tidak ada pengulangan informasi antar item

PERSONA SITE:
{{PERSONA}}

BRIEF RISET:
{{BRIEF}}

Kembalikan HANYA JSON valid:
{
  "title": "judul listicle dengan angka",
  "content": "isi artikel listicle lengkap...",
  "faq": [{"question": "...", "answer": "..."}],
  "keyTakeaways": ["item kunci 1", "item kunci 2", "item kunci 3"],
  "socialCaption": "caption media sosial",
  "imagePlaceholders": ["{{IMAGE: deskripsi gambar utama}}", "{{IMAGE: infografik atau ilustrasi}}"]
}`,
  },

  faq_article: {
    agentType: 'writer',
    category: 'faq',
    name: 'FAQ Article',
    template: `Kamu adalah content writer Indonesia yang spesialis format FAQ (Frequently Asked Questions).
Tulis artikel tanya-jawab yang menjawab pertanyaan yang paling sering dicari tentang topik ini.

STRUKTUR FAQ:
1. JUDUL: Format tanya ("Apa itu...", "Bagaimana cara...", "Mengapa...") atau deskriptif
2. INTRO (1-2 paragraf): Kenapa topik ini sering ditanya, gambaran umum
3. DAFTAR FAQ: Minimal 8 pasang Q&A, berurutan dari dasar ke lanjutan:
   - Pertanyaan: natural, seperti yang diketik di Google
   - Jawaban: minimal 50 kata per jawaban, konkret dan actionable
4. PENUTUP (1 paragraf): Ringkasan atau resource tambahan

CHECKLIST FAQ:
□ Minimal 8 pasang Q&A
□ Pertanyaan menggunakan bahasa natural (bukan bahasa buku)
□ Setiap jawaban minimal 50 kata
□ Urutan logis: dari pertanyaan umum ke spesifik
□ Tidak ada duplikasi topik antar pertanyaan

PERSONA SITE:
{{PERSONA}}

BRIEF RISET:
{{BRIEF}}

Kembalikan HANYA JSON valid:
{
  "title": "judul FAQ artikel",
  "content": "isi artikel FAQ lengkap dengan semua pasang Q&A...",
  "faq": [{"question": "pertanyaan paling umum 1", "answer": "jawaban lengkap..."}],
  "keyTakeaways": ["jawaban singkat poin 1", "jawaban singkat poin 2"],
  "socialCaption": "Punya pertanyaan tentang [topik]? Kami jawab semuanya 👇",
  "imagePlaceholders": ["{{IMAGE: ilustrasi yang menggambarkan topik FAQ}}"]
}`,
  },

  evergreen: {
    agentType: 'writer',
    category: 'evergreen',
    name: 'Evergreen/Panduan Lengkap (1200-2500 kata)',
    template: `Kamu adalah content writer Indonesia yang spesialis konten evergreen komprehensif dan panduan definitif.
Tulis panduan lengkap (1200-2500 kata) yang tidak terikat waktu dan tetap relevan bertahun-tahun.

STRUKTUR PANDUAN EVERGREEN:
1. JUDUL: Definitif ("Panduan Lengkap...", "Cara [Verb]...", "Apa Itu X: Penjelasan Lengkap")
2. INTRO HOOK (2-3 paragraf): Masalah yang dipecahkan + mengapa panduan ini berbeda
3. TABLE OF CONTENTS: Daftar seksi (H2) untuk navigasi mudah
4. DEFINISI & KONSEP DASAR (H2): Penjelasan fundamental yang tidak berubah
5. PENJELASAN MENDALAM (H2 per subtopik): Setiap aspek penting dibahas dalam seksi sendiri
6. CONTOH PRAKTIS (H2): Minimal 2 contoh nyata yang konkret
7. KESALAHAN UMUM (H2): "Jangan lakukan ini" — lebih diingat pembaca
8. TIPS & BEST PRACTICES (H2): Actionable advice yang bisa langsung diterapkan
9. PENUTUP & NEXT STEPS (H2): Apa langkah selanjutnya setelah baca panduan ini

CHECKLIST EVERGREEN:
□ Tidak ada referensi tanggal spesifik yang akan kedaluwarsa ("tahun ini", "bulan lalu")
□ Struktur heading yang jelas (H2 untuk seksi utama, H3 untuk sub-seksi)
□ Minimal 3 contoh konkret dan spesifik
□ Definisi terminologi kunci yang digunakan
□ Bisa diupdate sebagian tanpa menulis ulang semua

PERSONA SITE:
{{PERSONA}}

BRIEF RISET:
{{BRIEF}}

Kembalikan HANYA JSON valid:
{
  "title": "judul panduan definitif",
  "content": "isi panduan evergreen lengkap dengan semua seksi...",
  "faq": [{"question": "pertanyaan paling sering tentang topik ini", "answer": "..."}],
  "keyTakeaways": ["poin panduan 1", "poin panduan 2", "poin panduan 3", "poin panduan 4"],
  "socialCaption": "Panduan lengkap [topik] — simpan untuk referensi 📌",
  "imagePlaceholders": ["{{IMAGE: gambar featured yang representatif}}", "{{IMAGE: diagram atau ilustrasi konsep}}", "{{IMAGE: contoh visual praktis}}"]
}`,
  },
};

// ── Format Validation Checklists — Step 4.4 ───────────────────────────────────

const FORMAT_CHECKLISTS = {
  berita_singkat: {
    name: 'Berita Singkat',
    rules: [
      { id: 'pyramid', label: 'Struktur piramida terbalik (judul → lead → body → penutup)', check: (text) => !!text },
      { id: 'lead_length', label: 'Lead paragraf pertama maksimal 40 kata', check: (text) => { const first = text.split('\n').filter(Boolean)[0] || ''; return first.split(/\s+/).length <= 45; } },
      { id: 'fivew', label: '5W+1H lengkap dalam artikel', check: () => true }, // verified by LLM
      { id: 'word_count', label: 'Panjang artikel 200-400 kata', check: (text) => { const wc = text.split(/\s+/).filter(Boolean).length; return wc >= 150 && wc <= 500; } },
      { id: 'no_opinion', label: 'Tidak ada opini atau penilaian personal penulis', check: () => true }, // LLM check
      { id: 'attribution', label: 'Kutipan narasumber disertai atribusi lengkap', check: () => true }, // LLM check
    ],
    editorInstructions: `Format ini adalah BERITA SINGKAT (200-400 kata) dengan piramida terbalik.
Verifikasi checklist berikut:
1. Lead (paragraf 1) maks 40 kata, menjawab WHO + WHAT
2. 5W+1H terpenuhi semua (What, Who, Where, When, Why, How)
3. Ada kutipan narasumber dengan atribusi: nama, jabatan, lembaga
4. Tidak ada opini penulis — hanya fakta dan kutipan
5. Tidak ada kalimat klise AI: "Dalam era modern...", "Di tengah dinamika..."
6. Setiap paragraf maks 5 kalimat`,
  },

  berita_panjang: {
    name: 'Berita Panjang',
    rules: [
      { id: 'word_count', label: 'Panjang artikel 800-1500 kata', check: (text) => { const wc = text.split(/\s+/).filter(Boolean).length; return wc >= 600 && wc <= 1800; } },
      { id: 'three_sources', label: 'Minimal 3 kutipan narasumber berbeda', check: () => true },
      { id: 'data', label: 'Ada data statistik atau angka konkret', check: () => true },
      { id: 'context', label: 'Ada paragraf konteks/latar belakang', check: () => true },
    ],
    editorInstructions: `Format ini adalah BERITA PANJANG/INVESTIGATIF (800-1500 kata).
Verifikasi:
1. Minimal 3 kutipan narasumber berbeda (nama + jabatan)
2. Ada data statistik atau angka konkret pendukung
3. Ada konteks historis atau latar belakang (minimal 1 paragraf)
4. 5W+1H terpenuhi
5. Tidak ada opini personal penulis`,
  },

  jurnal_review: {
    name: 'Jurnal Akademik (IMRAD)',
    rules: [
      { id: 'abstract', label: 'Abstrak 100-250 kata dalam satu paragraf', check: () => true },
      { id: 'keywords', label: 'Kata kunci 3-5 item, alfabetis', check: () => true },
      { id: 'imrad', label: 'Struktur IMRAD lengkap (Pendahuluan, Metode, Hasil, Simpulan)', check: (text) => /pendahuluan|metode|hasil|simpulan/i.test(text) },
      { id: 'citations', label: 'Sitasi format konsisten (APA/IEEE/Harvard)', check: () => true },
      { id: 'title_length', label: 'Judul maksimal 12 kata', check: (title) => (title || '').split(/\s+/).length <= 14 },
    ],
    editorInstructions: `Format ini adalah JURNAL AKADEMIK (IMRAD).
Verifikasi checklist wajib:
1. ABSTRAK: 100-250 kata dalam satu paragraf (cek panjangnya)
2. KATA KUNCI: 3-5 item, disusun alfabetis, dipisah titik koma
3. IMRAD lengkap: ada seksi Pendahuluan, Metode, Hasil dan Pembahasan, Simpulan
4. SITASI: format konsisten (APA: "(Nama, Tahun)", IEEE: "[1]", Harvard: "(Nama Tahun)")
5. JUDUL: maksimal 12 kata, spesifik, tidak ada singkatan
6. DAFTAR PUSTAKA: minimal 8 referensi
7. Bahasa baku akademik — tidak ada kata informal`,
  },

  feature_opini: {
    name: 'Feature/Opini',
    rules: [
      { id: 'hook', label: 'Ada hook kuat di paragraf pembuka (bukan pernyataan umum)', check: () => true },
      { id: 'consistent_pov', label: 'Sudut pandang konsisten dari awal ke akhir', check: () => true },
      { id: 'three_sources', label: 'Minimal 3 sumber dikutip dengan nama', check: () => true },
      { id: 'word_count', label: 'Panjang 1000-2000 kata', check: (text) => { const wc = text.split(/\s+/).filter(Boolean).length; return wc >= 800 && wc <= 2500; } },
    ],
    editorInstructions: `Format ini adalah FEATURE/OPINI (1000-2000 kata).
Verifikasi:
1. Paragraf pembuka berupa hook: anekdot, data mengejutkan, atau adegan spesifik — bukan pernyataan umum
2. Sudut pandang konsisten sepanjang artikel
3. Minimal 3 sumber dikutip dengan nama lengkap
4. Ada "nut graf" (paragraf yang jelaskan mengapa artikel ini penting)
5. Penutup yang berkesan dan mengundang refleksi`,
  },

  listicle: {
    name: 'Listicle',
    rules: [
      { id: 'number_match', label: 'Angka di judul = jumlah item aktual', check: () => true },
      { id: 'subheadings', label: 'Setiap item punya subjudul deskriptif', check: () => true },
      { id: 'item_length', label: 'Setiap item minimal 50 kata', check: () => true },
      { id: 'intro_outro', label: 'Ada intro minimal 2 paragraf dan outro minimal 1 paragraf', check: () => true },
    ],
    editorInstructions: `Format ini adalah LISTICLE.
Verifikasi:
1. Angka di judul HARUS sama dengan jumlah item aktual (hitung!)
2. Setiap item punya subjudul yang deskriptif
3. Setiap item minimal 50 kata penjelasan mandiri
4. Ada intro minimal 2 paragraf sebelum daftar
5. Ada outro minimal 1 paragraf setelah daftar
6. Tidak ada pengulangan informasi antar item`,
  },

  faq_article: {
    name: 'FAQ Article',
    rules: [
      { id: 'min_questions', label: 'Minimal 8 pasang Q&A', check: () => true },
      { id: 'natural_questions', label: 'Pertanyaan menggunakan bahasa natural (bukan formal)', check: () => true },
      { id: 'answer_length', label: 'Setiap jawaban minimal 50 kata', check: () => true },
      { id: 'logical_order', label: 'Urutan pertanyaan: dari umum ke spesifik', check: () => true },
    ],
    editorInstructions: `Format ini adalah FAQ ARTICLE.
Verifikasi:
1. Minimal 8 pasang Q&A (hitung!)
2. Pertanyaan menggunakan bahasa natural seperti yang dicari di Google
3. Setiap jawaban minimal 50 kata, konkret dan actionable
4. Urutan logis: dari pertanyaan umum ke spesifik
5. Tidak ada duplikasi topik antar pertanyaan`,
  },

  evergreen: {
    name: 'Evergreen/Panduan Lengkap',
    rules: [
      { id: 'no_date_ref', label: 'Tidak ada referensi waktu yang akan kedaluwarsa', check: (text) => !/tahun ini|bulan lalu|minggu ini|terbaru \d{4}/i.test(text) },
      { id: 'heading_structure', label: 'Struktur heading jelas (minimal 4 H2)', check: () => true },
      { id: 'examples', label: 'Minimal 3 contoh konkret dan spesifik', check: () => true },
      { id: 'word_count', label: 'Panjang 1200-2500 kata', check: (text) => { const wc = text.split(/\s+/).filter(Boolean).length; return wc >= 1000 && wc <= 3000; } },
    ],
    editorInstructions: `Format ini adalah EVERGREEN/PANDUAN LENGKAP (1200-2500 kata).
Verifikasi:
1. Tidak ada referensi waktu yang akan kedaluwarsa ("tahun ini", "bulan lalu")
2. Minimal 4 seksi H2 yang terstruktur jelas
3. Minimal 3 contoh konkret dan spesifik
4. Ada definisi terminologi kunci
5. Ada seksi tips/best practices yang actionable
6. Struktur bisa diupdate sebagian`,
  },
};

// ── Step 4.3 — Format Selector ────────────────────────────────────────────────

/**
 * selectWritingStandard(format, category, citationStyle)
 * Returns the prompt template string for the given format.
 * Priority: DB champion template → DB active template → hardcoded default
 *
 * @param {string} format - e.g. 'berita_singkat', 'jurnal_review'
 * @param {string} category - e.g. 'berita', 'akademik'
 * @param {string} citationStyle - 'APA' | 'IEEE' | 'Harvard'
 * @param {object|null} dbTemplate - champion template row from DB (optional)
 * @returns {{ templateStr: string, templateName: string, source: string }}
 */
function selectWritingStandard(format, category = null, citationStyle = 'APA', dbTemplate = null) {
  let templateStr;
  let templateName;
  let source;

  if (dbTemplate && dbTemplate.prompt_template) {
    // DB champion/active takes precedence
    templateStr = dbTemplate.prompt_template;
    templateName = dbTemplate.name || format;
    source = 'db';
  } else {
    // Fall back to hardcoded defaults
    const key = format || (category === 'akademik' ? 'jurnal_review' : 'berita_singkat');
    const tpl = TEMPLATES[key] || TEMPLATES['berita_singkat'];
    templateStr = tpl.template;
    templateName = tpl.name;
    source = 'default';
  }

  // Substitute citation style placeholder
  templateStr = templateStr.replace(/\{\{CITATION_STYLE\}\}/g, citationStyle);

  return { templateStr, templateName, source };
}

/**
 * getFormatChecklist(format)
 * Returns the validation checklist and editor instructions for a given format.
 */
function getFormatChecklist(format) {
  return FORMAT_CHECKLISTS[format] || FORMAT_CHECKLISTS['berita_singkat'];
}

/**
 * getAllTemplateKeys()
 * Returns all available template format keys.
 */
function getAllTemplateKeys() {
  return Object.keys(TEMPLATES);
}

module.exports = { TEMPLATES, FORMAT_CHECKLISTS, selectWritingStandard, getFormatChecklist, getAllTemplateKeys };
