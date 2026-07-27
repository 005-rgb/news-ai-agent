# BUILD PHASES — News AI Agent System
## Rencana Pembangunan Bertahap (Prioritas & Detail)

**Versi**: 1.0.0 | **Tanggal**: Juli 2026  
**Prinsip**: Setiap modul yang dibangun = real, full-featured, fully integrated. Tidak ada placeholder.

---

## FILOSOFI PEMBANGUNAN

```
Urutan prioritas:
1. Foundation dulu (tanpa fondasi kuat, semua di atas akan rapuh)
2. Core pipeline berikutnya (jantung sistem harus berdetak sebelum fitur lain)
3. Intelligence layer (sistem mulai "cerdas" setelah pipeline stabil)
4. Dashboard (bisa monitor setelah ada yang perlu dimonitor)
5. Innovation layer (fitur diferensiasi setelah sistem stabil)
6. Hardening (produksi-ready: logging, error handling, alerting)
```

**Aturan kualitas**:
- Setiap fase harus **fully working** sebelum fase berikutnya dimulai
- Setiap API call harus punya **error handling nyata** (bukan console.log)
- Setiap data yang disimpan harus **terenkripsi jika sensitif**
- Setiap fitur harus **bisa diuji dari dashboard** (bukan hanya lewat kode)

---

## RINGKASAN FASE

| Fase | Nama | Estimasi Kompleksitas | Output Utama |
|---|---|---|---|
| **0** | Foundation & Infrastructure | Sedang | DB, server, auth, base config |
| **1** | API Key Pool Manager | Tinggi | Multi-provider key rotation real |
| **2** | Source Intelligence | Tinggi | RSS/API/scrape semua kategori |
| **3** | Content Pipeline Core | Sangat Tinggi | 5 agent pertama berjalan end-to-end |
| **4** | Writing Standards Engine | Tinggi | Standar jurnalistik + jurnal di AI |
| **5** | WordPress Publisher | Sedang | Publish nyata ke WP + image upload |
| **6** | Scheduler & Automation | Sedang | Auto-run 24/7 tanpa intervensi |
| **7** | Dashboard Full | Tinggi | Semua menu real dan functional |
| **8** | Quality & Humanizer | Tinggi | E-E-A-T checker + anti-AI detection |
| **9** | Rapat Redaksi Engine | Tinggi | Otomasi rapat mingguan penuh |
| **10** | Innovation Layer | Sangat Tinggi | Prediksi tren, evergreen, link intel |
| **11** | Hardening & Production | Sedang | Logging, alerting, monitoring penuh |

---

## ═══════════════════════════════════════
## FASE 0 — FOUNDATION & INFRASTRUCTURE
## ═══════════════════════════════════════

**Tujuan**: Fondasi sistem yang kokoh. Semua fase berikutnya dibangun di atas ini.

### Step 0.1 — Project Structure Setup
```
news-ai-agent/
├── server/
│   ├── index.js                 # Entry point Express
│   ├── db.js                    # PostgreSQL connection pool
│   ├── middleware/
│   │   ├── auth.js              # Session auth middleware
│   │   ├── rateLimiter.js       # Rate limiting
│   │   └── errorHandler.js      # Global error handler
│   ├── routes/                  # Semua API routes
│   ├── agents/                  # Semua AI agents
│   ├── services/                # Business logic
│   ├── utils/                   # Helper functions
│   └── config/                  # Konfigurasi global
├── client/
│   ├── src/
│   │   ├── pages/               # Semua halaman dashboard
│   │   ├── components/          # Komponen reusable
│   │   ├── hooks/               # Custom React hooks
│   │   ├── store/               # Zustand state
│   │   └── lib/                 # API client, utils
│   └── index.html
├── docs/                        # PRD, build phases
├── package.json
└── vite.config.js
```
**Output**: Struktur folder siap, `package.json` lengkap semua dependency.

---

### Step 0.2 — Database Schema (Full)
Jalankan seluruh DDL dari PRD Bab 17. Semua tabel dibuat sekaligus:
- `sites` — profil 8 WordPress site
- `api_keys` — pool key semua provider
- `sources` — sumber berita per kategori
- `articles` — semua artikel dengan semua metadata
- `job_queue` — antrian pipeline
- `content_calendar` — rencana konten per minggu
- `rapat_notes` — notulen rapat mingguan
- `usage_stats` — statistik harian per site/provider
- `system_logs` — log semua aktivitas agent
- `prompt_versions` — versi prompt + performa
- `competitor_data` — data kompetitor per site
- `trend_predictions` — prediksi topik trending

**Tambahan**: Semua index yang dibutuhkan untuk query cepat.  
**Output**: Database fully migrated, semua tabel siap.

---

### Step 0.3 — Express Server Base
- Server berjalan di port 5000
- Middleware: helmet, cors, compression, express-session
- Route struktur: `/api/v1/...` untuk semua endpoint
- Global error handler: semua error terformat JSON konsisten
- Health check endpoint: `GET /api/v1/health` (cek DB + server)
- Serve React build dari `client/dist/`

**Output**: Server running, health check hijau.

---

### Step 0.4 — Authentication System
- Login dengan username + password (disimpan di env/DB)
- Session-based auth dengan SESSION_SECRET
- Middleware proteksi semua route `/api/v1/*` kecuali login
- Frontend: halaman login, auto-redirect ke dashboard jika sudah login
- Logout endpoint

**Output**: Dashboard hanya bisa diakses setelah login. Tidak ada bypass.

---

### Step 0.5 — Encryption Utility
- AES-256-GCM untuk enkripsi API key sebelum simpan ke DB
- Fungsi `encrypt(text)` dan `decrypt(ciphertext)` 
- Key enkripsi dari environment variable (tidak hardcode)
- Digunakan oleh semua modul yang tangani API key sensitif

**Output**: Semua nilai sensitif tidak pernah tersimpan plaintext.

---

### Step 0.6 — Configuration Manager
- Load semua konfigurasi dari env variables
- Validasi: sistem tidak bisa start jika env kritis kosong
- Default values yang masuk akal untuk semua optional config
- Sentralisasi timezone (WIB = Asia/Jakarta)

**Output**: Zero "undefined" errors karena env tidak diset.

---

## ═══════════════════════════════════════
## FASE 1 — API KEY POOL MANAGER
## ═══════════════════════════════════════

**Tujuan**: Jantung ekonomi sistem. Tanpa ini, LLM tidak bisa dipanggil.

### Step 1.1 — Key CRUD API
Endpoint REST lengkap:
- `POST /api/v1/keys` — tambah key baru (terenkripsi saat simpan)
- `GET /api/v1/keys` — list semua key (nilai key TIDAK ditampilkan, hanya label)
- `PATCH /api/v1/keys/:id` — update label, status, limit
- `DELETE /api/v1/keys/:id` — hapus key
- `POST /api/v1/keys/:id/test` — **test koneksi key secara real** (panggil provider dengan prompt minimal)

**Output**: CRUD berjalan, key tersimpan terenkripsi, test key real.

---

### Step 1.2 — Usage Tracker
- Setiap kali key digunakan: increment `usage_today` dan `usage_this_month`
- Cron job: reset `usage_today` setiap tengah malam
- Deteksi `reset_at` per provider (kapan kuota bulanan reset)
- Hitung `freshness_score` real-time untuk setiap key:
  ```
  freshness_score = (1 - usage_today/daily_limit) * 0.6 
                  + (waktu_sejak_digunakan_dalam_jam / 24) * 0.4
  ```

**Output**: Usage tracking akurat, freshness score dihitung real.

---

### Step 1.3 — Smart Rotation Engine
- Fungsi utama: `selectBestKey(provider?, category?)`
- Logic:
  1. Filter key ACTIVE yang belum capai 85% limit
  2. Jika provider tertentu diminta: filter provider tersebut
  3. Urutkan by freshness_score tertinggi
  4. Return key terbaik, atau null jika semua exhausted
- Fallback chain antar provider (urutan bisa dikonfigurasi)
- Jika semua provider exhausted: throw `KeyPoolExhaustedError` dengan detail

**Output**: Rotasi otomatis tanpa intervensi. Tidak pernah ada 429 error karena salah key.

---

### Step 1.4 — LLM Router (Abstraksi Semua Provider)
Satu fungsi `callLLM(prompt, options)` yang bekerja untuk semua provider:

**Provider yang diimplementasi** (semua real, bukan mock):
- **Gemini**: Google AI SDK, model gemini-1.5-flash default
- **Groq**: REST API, model llama-3.3-70b default  
- **DeepSeek**: REST API (OpenAI-compatible), model deepseek-chat
- **OpenRouter**: REST API, model bisa dipilih per call
- **Mistral**: REST API, model mistral-small
- **Together AI**: REST API, model llama-3 series
- **Cerebras**: REST API, model llama3.1-70b
- **Cohere**: REST API, model command-r

Setiap provider punya:
- Adapter function yang normalize request/response ke format standar
- Timeout handling
- Error classification: rate_limit / auth_error / server_error / network_error
- Token usage extraction dari response (untuk usage tracking)

**Output**: `callLLM("tulis artikel tentang X")` bekerja dengan provider apapun yang tersedia.

---

### Step 1.5 — Alert System untuk Key Pool
- Threshold alert: key mencapai 80% limit → flag di DB
- Endpoint: `GET /api/v1/keys/alerts` — return semua alert aktif
- Severity: `warning` (80%), `critical` (95%), `exhausted` (100%)
- Log setiap kejadian exhausted ke `system_logs`

**Output**: Dashboard bisa tampilkan alert real, bukan dummy data.

---

## ═══════════════════════════════════════
## FASE 2 — SOURCE INTELLIGENCE
## ═══════════════════════════════════════

**Tujuan**: Sistem harus tahu dari mana mencari berita sesuai kategori.

### Step 2.1 — Source Database Population
Populate tabel `sources` dengan semua sumber dari PRD Bab 7:
- 8+ kategori, masing-masing 4-10 sumber
- Setiap sumber: nama, URL, type (rss/api/scrape), kategori, credibility_score
- Data ini seed default — bisa ditambah/edit dari dashboard

**Output**: Tabel `sources` terisi penuh, bisa query by kategori.

---

### Step 2.2 — RSS Fetcher
- Library: `rss-parser` 
- Fungsi: `fetchRSS(sourceUrl)` → return array artikel dengan: title, link, pubDate, summary, content
- Support semua sumber RSS Indonesia (detik, kompas, tempo, antara, dll)
- Cache: hasil fetch disimpan 30 menit (tidak spam server sumber)
- Error handling: timeout, malformed RSS, redirect

**Output**: RSS fetch dari 20+ sumber berjalan real, tidak ada yang gagal silent.

---

### Step 2.3 — API Fetcher (Academic Sources)
Implementasi fetcher khusus untuk sumber akademik:
- **PubMed**: E-utilities API (gratis) — fetch by keyword, return metadata artikel
- **arXiv**: API v2 — fetch preprint by category/keyword
- **Semantic Scholar**: API gratis — fetch paper dengan abstract
- **Google Scholar**: scraping dengan rate limit sopan (tidak ada API resmi)
- **SINTA**: scraping portal jurnal Indonesia

Setiap fetcher return format standar yang sama dengan RSS fetcher.

**Output**: Fetcher akademik bekerja real, bisa ambil referensi jurnal nyata.

---

### Step 2.4 — Web Scraper (Fallback)
Untuk sumber tanpa RSS/API:
- Library: `cheerio` + `axios`
- Configurable CSS selectors per domain
- Rate limiting: minimum 5 detik antar request ke domain yang sama
- Respect robots.txt check sebelum scraping
- User-Agent yang sopan

**Output**: Sumber non-RSS tetap bisa difetch kontennya.

---

### Step 2.5 — Source Selector
Fungsi utama: `selectSources(category, count=3)` 
- Filter sumber berdasarkan kategori yang diminta
- Urutkan berdasarkan credibility_score
- Return top N sumber terbaik
- Exclude sumber yang baru difetch < 30 menit (cache)

**Output**: Reporter Agent tinggal panggil satu fungsi, dapat sumber terbaik otomatis.

---

### Step 2.6 — Source Management API
- `GET /api/v1/sources` — list semua sumber (filter by kategori)
- `POST /api/v1/sources` — tambah sumber baru
- `PATCH /api/v1/sources/:id` — update sumber
- `DELETE /api/v1/sources/:id` — hapus sumber
- `POST /api/v1/sources/:id/test` — **test fetch real dari sumber ini sekarang**

**Output**: Admin bisa kelola sumber dari dashboard, test langsung.

---

## ═══════════════════════════════════════
## FASE 3 — CONTENT PIPELINE CORE (5 AGENT PERTAMA)
## ═══════════════════════════════════════

**Tujuan**: Pipeline dari topik → artikel draft berjalan end-to-end.

### Step 3.1 — Agent Base Class
Semua agent mewarisi base class yang menyediakan:
- `callLLM(prompt, options)` → sudah terhubung ke Key Pool Manager
- `log(level, message, metadata)` → log ke tabel `system_logs`
- `updateJobStatus(jobId, status, result)` → update job queue
- `retry(fn, maxAttempts)` → retry dengan exponential backoff
- Nama agent yang jelas di setiap log entry

**Output**: Semua agent punya behavior konsisten, logging terpusat.

---

### Step 3.2 — Job Queue System
- Tabel `job_queue` sebagai persistent queue (tidak perlu Redis)
- Fungsi: `enqueueJob(type, payload, priority, scheduledAt)`
- Worker: `processNextJob()` — ambil job PENDING paling prioritas, jalankan
- Job processor: map setiap `job_type` ke agent yang tepat
- Status lifecycle: `pending → processing → done | failed → retry`
- Dead letter: job yang gagal 3x → status `dead`, alert di log
- Polling: worker jalan setiap 30 detik

**Output**: Queue persistent, tidak ada job hilang meski server restart.

---

### Step 3.3 — Reporter Agent (Peneliti)
Input: `{ topic, category, siteId }`

Proses real yang dijalankan:
1. `selectSources(category)` → dapat 2-3 sumber terbaik
2. Fetch konten dari setiap sumber (RSS/API/scrape)
3. Filter konten yang relevan dengan topik (keyword matching)
4. Panggil LLM: *"Dari konten berikut, ekstrak: fakta utama, kutipan narasumber, angka/statistik, tanggal kejadian, nama tokoh. Format JSON."*
5. Verifikasi silang: apakah fakta dari sumber A konsisten dengan sumber B?
6. Hitung Source Credibility Score gabungan
7. Return: brief riset JSON terstruktur

Output: `{ facts[], quotes[], statistics[], timeline, sources[], credibilityScore }`

**Output**: Brief riset nyata dari sumber nyata, bukan hallucination LLM.

---

### Step 3.4 — Penulis Agent (Writer)
Input: `{ brief, format, siteId, category }`

Proses:
1. Load Persona Memory site tujuan dari DB
2. Load prompt template sesuai format (berita/jurnal/feature/dll)
3. Load standar penulisan sesuai format (lihat Fase 4)
4. Construct prompt yang menyertakan: brief riset + persona + standar
5. Panggil LLM → draft artikel utama
6. Panggil LLM (parallel/sekuensial berdasarkan kuota) untuk:
   - Versi FAQ
   - Ringkasan Key Takeaways
   - Caption media sosial
7. Tandai placeholder gambar dengan deskripsi visual spesifik
8. Hitung word count, pastikan sesuai target format

Output: `{ mainArticle, faqVersion, summary, socialCaption, imagePlaceholders[] }`

**Output**: 4 format artikel dari satu brief, bukan dummy text.

---

### Step 3.5 — Editor Agent
Input: `{ draft, brief, siteId, format }`

Proses real:
1. Cek akurasi: apakah semua fakta di draft ada di brief riset?
2. Cek duplikasi: query DB cari artikel sebelumnya di site ini dengan topik serupa (cosine similarity sederhana)
3. Cek konsistensi persona: bandingkan gaya dengan Persona Memory
4. Panggil LLM: *"Review artikel ini sebagai editor senior. Perbaiki: akurasi, konsistensi gaya, kealamian bahasa. Return artikel yang sudah diperbaiki + daftar perubahan."*
5. Terapkan Humanizer Layer (lihat Fase 8)
6. Hitung quality score 0-100 berdasarkan: kelengkapan, akurasi, naturalness
7. Jika score < 75: flag untuk revisi, kirim kembali ke Penulis Agent dengan catatan

Output: `{ editedArticle, qualityScore, changeLog, needsRevision, revisionNotes }`

**Output**: Artikel yang sudah diedit dengan skor nyata, bukan sekadar pass-through.

---

### Step 3.6 — Quality Rater Simulator
Input: `{ article, brief, category }`

Proses real evaluasi E-E-A-T:
1. **Experience check**: Apakah ada detail spesifik yang menunjukkan "pengalaman"? (bukan generalisasi)
2. **Expertise check**: Apakah terminologi domain digunakan dengan benar? Apakah ada depth?
3. **Authoritativeness check**: Apakah ada referensi ke sumber otoritatif? Apakah nama dan organisasi disebutkan?
4. **Trustworthiness check**: Apakah klaim bisa diverifikasi? Apakah ada disclaimer untuk hal yang tidak pasti?
5. **AI Detection check**: Panggil LLM dengan prompt: *"Apakah artikel ini terasa ditulis AI? Identifikasi 5 tanda paling jelas."* → jika ada tanda kuat, flag
6. **Search Intent check**: Apakah artikel menjawab apa yang akan dicari user untuk topik ini?
7. Hitung skor E-E-A-T 0-100
8. Jika score < 80: return dengan catatan spesifik perbaikan

Output: `{ eeAtScore, passed, detailedScores{}, aiDetectionRisk, revisionNotes }`

**Output**: Gatekeeper nyata sebelum artikel boleh lanjut ke tahap berikutnya.

---

### Step 3.7 — Pipeline Orchestrator
Fungsi yang mengorkestrasi seluruh pipeline:
```
runPipeline(topicAssignment) →
  1. Buat artikel record (status: 'researching')
  2. Enqueue job: RESEARCH
  3. [Reporter] → brief riset
  4. Update artikel + status: 'writing'
  5. Enqueue job: WRITE
  6. [Penulis] → draft 4 format
  7. Update artikel + status: 'editing'
  8. Enqueue job: EDIT
  9. [Editor] → edited article + score
  10. Jika score < 75: kembali ke step 6 (max 2x retry)
  11. Enqueue job: QC
  12. [Quality Rater] → E-E-A-T score
  13. Jika score < 80: kembali ke step 8 (max 1x retry)
  14. Status: 'ready_for_image'
  15. Enqueue job: IMAGE (Fase 5)
  16. Status: 'ready_for_seo' → Enqueue job: SEO (Fase 5)
  17. Status: 'scheduled' → Enqueue job: PUBLISH (Fase 5)
```

**Output**: Artikel mengalir otomatis dari topik ke siap publish tanpa intervensi.

---

## ═══════════════════════════════════════
## FASE 4 — WRITING STANDARDS ENGINE
## ═══════════════════════════════════════

**Tujuan**: AI harus menulis sesuai kaidah jurnalistik Indonesia dan standar jurnal ilmiah — bukan sekedar artikel biasa.

### Step 4.1 — Journalism Standards Module
Prompt engineering yang menanamkan standar berita Indonesia ke Penulis Agent:

**Template Prompt Berita** (ditulis lengkap, bukan ringkasan):
```
Kamu adalah jurnalis senior Indonesia dengan pengalaman 15 tahun di media nasional.
Tulis berita dengan kaidah berikut:

STRUKTUR WAJIB (Piramida Terbalik):
1. JUDUL: 55-70 karakter, mengandung keyword utama, menarik, informatif
2. LEAD (paragraf 1): Rangkum WHO + WHAT dalam maks 40 kata
3. BODY paragraf 2-3: Jelaskan WHY + HOW dengan detail
4. BODY paragraf 4-5: Kutipan narasumber dengan atribusi lengkap
5. BODY paragraf 6+: Konteks, data pendukung, latar belakang
6. PENUTUP: Satu paragraf, prospek ke depan atau kesimpulan

KAIDAH 5W+1H (HARUS semua terpenuhi):
- What: [dari brief]
- Who: [dari brief]  
- Where: [dari brief]
- When: [dari brief]
- Why: [dari brief]
- How: [dari brief]

BAHASA:
- Kalimat aktif lebih banyak dari pasif
- Paragraf 3-5 kalimat
- Hindari jargon tanpa penjelasan
- Gunakan kata baku sesuai KBBI

LARANGAN:
- Tidak boleh ada opini penulis (harus objektif)
- Tidak boleh ada kalimat generik seperti "Hal ini sangat penting..."
- Tidak boleh ada kalimat pembuka klise
```

**Validasi**: Editor Agent cek semua poin checklist terpenuhi, jika tidak → revisi.

---

### Step 4.2 — Journal Standards Module
Template prompt untuk artikel jurnal/akademik:

**Template Prompt Jurnal**:
```
Kamu adalah peneliti dan penulis jurnal ilmiah Indonesia.
Tulis artikel akademik dengan struktur IMRAD:

STRUKTUR WAJIB:
1. JUDUL: Maks 12 kata, spesifik, mencerminkan isi
2. ABSTRAK: 100-250 kata (tujuan, metode, hasil, simpulan)
3. KATA KUNCI: 3-5 kata kunci, alfabetis
4. PENDAHULUAN: Latar belakang → State of the art → Research gap → Tujuan
5. METODE: Cara/desain penelitian yang bisa direproduksi
6. HASIL & PEMBAHASAN: Data → Analisis → Kaitan teori → Perbandingan literatur
7. SIMPULAN: Jawaban tujuan, implikasi, keterbatasan, rekomendasi
8. DAFTAR PUSTAKA: [format sesuai style yang diminta]

CITATION STYLE: {citationStyle}
[Jika APA]: Gunakan (Penulis, Tahun) dalam teks
[Jika IEEE]: Gunakan [1], [2] dalam teks
[Jika Harvard]: Gunakan (Penulis Tahun) dalam teks

BAHASA:
- Bahasa Indonesia baku (KBBI + EYD terbaru)
- Angka 1-9: ditulis huruf; 10+: angka
- Hindari plagiarisme: parafrase dari brief riset, bukan copy
```

---

### Step 4.3 — Format Selector
Fungsi `selectWritingStandard(format, category, citationStyle)` yang return template prompt yang tepat berdasarkan kombinasi format + kategori + site config.

Semua template disimpan di `server/config/prompt-templates.js` — bisa diedit dari dashboard (Fase 7).

---

### Step 4.4 — Validation Checklist per Format
Setiap format punya checklist yang diverifikasi oleh Editor Agent:

**Berita**: Piramida terbalik ✓ | 5W+1H lengkap ✓ | Lead ≤40 kata ✓ | Paragraf ≤5 kalimat ✓ | Kutipan beratribusi ✓  
**Jurnal**: IMRAD lengkap ✓ | Abstrak 100-250 kata ✓ | 3-5 kata kunci ✓ | Sitasi sesuai style ✓ | Judul ≤12 kata ✓  
**Feature**: Ada lead menarik ✓ | Sudut pandang konsisten ✓ | Minimal 3 sumber ✓  
**Listicle**: Jumlah item di judul sesuai ✓ | Setiap item mandiri ✓ | Ada intro dan outro ✓

---

## ═══════════════════════════════════════
## FASE 5 — FOTOGRAFER AGENT & WORDPRESS PUBLISHER
## ═══════════════════════════════════════

### Step 5.1 — Image Source Connectors

**Connector 1: Unsplash API** (Primary free fallback)
- Endpoint: `GET /photos/random?query={keyword}&count=5`
- Auth: Unsplash Access Key (dari key pool Unsplash)
- Return: URL full-res, URL thumbnail, photographer credit
- Filter: hanya ambil foto landscape atau relevan secara visual

**Connector 2: Pexels API** (Secondary free fallback)
- Endpoint: `GET /v1/search?query={keyword}&per_page=5`
- Auth: Pexels API Key
- Return: URL, photographer, license info

**Connector 3: AI Image Generation** (Primary jika kuota ada)
- Provider: Google Imagen 3 (jika tersedia) → OpenAI DALL-E 3 → Stable Diffusion API
- Prompt builder: baca deskripsi placeholder + isi artikel → generate prompt bahasa Inggris yang presisi
- Resolusi: 1200x630px (optimal untuk featured image & OG)
- Simpan hasil generate ke WordPress media library

---

### Step 5.2 — Fotografer Agent
Input: `{ article, imagePlaceholders[], siteId }`

Proses:
1. Cek kuota image generation API (dari Key Pool)
2. Untuk setiap placeholder:
   a. Extract deskripsi visual dari placeholder
   b. Generate image query dari deskripsi (bahasa Inggris, spesifik)
   c. Jika kuota generate ada: generate AI image
   d. Jika tidak: fetch dari Unsplash → Pexels → placeholder branded
3. Untuk setiap gambar:
   - Download dan simpan sementara
   - Generate alt text SEO: `{keyword utama} - {deskripsi singkat} | {nama site}`
   - Generate caption jika diperlukan format
4. Return array gambar yang siap upload ke WordPress

**Output**: Gambar nyata, relevan, berlisensi benar, alt text SEO-ready.

---

### Step 5.3 — SEO Specialist Agent
Input: `{ article, brief, siteId, category }`

Proses real (semua LLM-powered + rule-based):
1. **Keyword Research**: Panggil LLM → identifikasi 1 keyword utama + 5-10 LSI keyword dari konten
2. **Title Optimization**: Pastikan keyword di H1, 55-70 karakter, menarik
3. **Meta Title**: Generate 50-60 karakter mengandung keyword + angka/manfaat
4. **Meta Description**: Generate 150-160 karakter, keyword + CTA natural
5. **Heading Structure**: Evaluasi H2/H3/H4, pastikan keyword tersebar
6. **Internal Links**: Query DB → cari 2-3 artikel relevan di site yang sama → sisipkan link
7. **External Links**: Dari brief riset → 1-2 link ke sumber otoritatif
8. **Keyword Density**: Hitung, jika > 2.5% → flag untuk revisi ringan
9. **Schema Markup**: Generate JSON-LD sesuai format:
   - Berita → `NewsArticle`
   - Jurnal → `ScholarlyArticle`
   - Evergreen → `Article`
   - FAQ → tambah `FAQPage` schema
10. **URL Slug**: Generate dari keyword utama, tanpa stop word, maks 60 karakter

Output: `{ optimizedArticle, metaTitle, metaDescription, slug, schema, keywords{}, internalLinks[] }`

**Output**: Artikel siap SEO 100%, semua elemen on-page terpenuhi.

---

### Step 5.4 — WordPress Publisher Agent
Input: `{ article, metadata, siteId, scheduledAt }`

Proses real ke WordPress REST API:
1. Dapatkan config site dari DB (URL, credentials)
2. **Upload gambar featured**:
   - `POST /wp/v2/media` dengan multipart/form-data
   - Simpan `media_id` dari response
3. **Buat/cari kategori**:
   - `GET /wp/v2/categories?slug={slug}` — cari apakah ada
   - Jika tidak ada: `POST /wp/v2/categories` — buat baru
   - Return `category_id`
4. **Buat/cari tag**: sama seperti kategori
5. **Publish artikel**:
   ```
   POST /wp/v2/posts
   {
     title, content (HTML), status,
     date (scheduled), categories, tags,
     featured_media, 
     meta: { yoast_title, yoast_desc, yoast_focuskw }
   }
   ```
6. Simpan `wordpress_post_id` dan URL artikel ke DB
7. Update status artikel ke `published`
8. Log ke `system_logs`

**Error handling**:
- 401: alert + pause site, admin harus update credentials
- 429: tunggu dan retry dengan delay
- 500: retry 3x, lalu masuk dead letter queue dengan detail error

**Output**: Artikel benar-benar terbit di WordPress dengan semua metadata.

---

### Step 5.5 — Article HTML Formatter
Sebelum kirim ke WordPress, konten diformat ke HTML proper:
- Paragraf → `<p>`
- Heading → `<h2>`, `<h3>`, `<h4>`
- Kutipan → `<blockquote>`
- Daftar → `<ul>` atau `<ol>`
- Gambar inline → `<figure><img><figcaption>`
- Key Takeaways box → `<div class="key-takeaways">`
- FAQ section → accordion-ready HTML
- Schema markup → embedded `<script type="application/ld+json">`
- Internal links → `<a href="..." title="...">` dengan anchor text yang tepat

---

## ═══════════════════════════════════════
## FASE 6 — SCHEDULER & FULL AUTOMATION
## ═══════════════════════════════════════

**Tujuan**: Sistem berjalan sendiri 24/7 tanpa intervensi.

### Step 6.1 — Site Scheduler
Setiap site punya jadwal unik. Scheduler membaca config semua site aktif dan:
- Set cron job per site berdasarkan `posting_schedule`
- Saat trigger: ambil topik berikutnya dari `content_calendar`
- Jika calendar kosong: minta Pemimpin Redaksi Agent generate topik ad-hoc
- Enqueue job pipeline untuk topik tersebut

**Output**: Artikel terpublikasi otomatis sesuai jadwal masing-masing site.

---

### Step 6.2 — Smart Timing (Waktu Emas)
Default jadwal per kategori (bisa override per site):
- Politik/Breaking: 06:00-07:30
- Bisnis: 07:30-09:00
- Teknologi: 10:00-12:00
- Kesehatan: 11:00-13:00
- Akademik: 09:00-11:00
- Lifestyle: 12:00-14:00 atau 20:00-22:00
- Olahraga: 07:00-09:00 atau 19:00-21:00

Random delay: `scheduledTime + random(−15, +45)` menit → tidak robotik.

---

### Step 6.3 — Source Refresh Scheduler
- Setiap 6 jam: fetch ulang RSS semua sumber aktif
- Simpan artikel baru ke cache sementara (tidak perlu tabel baru, cukup file JSON atau kolom di `sources`)
- Tandai artikel yang sudah pernah digunakan sebagai referensi

---

### Step 6.4 — Daily Maintenance Jobs
Cron jobs harian (tengah malam):
- Reset `usage_today` semua API key
- Hitung dan simpan `usage_stats` harian
- Bersihkan `system_logs` yang > 30 hari
- Update status artikel yang sudah publish (konfirmasi masih online)
- Scan artikel kandidat evergreen update

---

### Step 6.5 — Watchdog
- Setiap 5 menit: cek apakah ada job `processing` yang sudah > 30 menit (stuck)
- Jika stuck: reset ke `pending` + log warning
- Jika ada key dengan `error_count` > 10 dalam 1 jam: auto-pause key tersebut

---

## ═══════════════════════════════════════
## FASE 7 — DASHBOARD FULL (SEMUA MENU REAL)
## ═══════════════════════════════════════

**Tujuan**: Setiap piksel di dashboard menampilkan data nyata dan setiap tombol berfungsi.

### Step 7.1 — Halaman Overview (Home)
Data nyata yang ditampilkan:
- **Kartu ringkasan**: artikel terbit hari ini, total queue, key aktif, alert count
- **Grafik produksi**: artikel per hari (7 hari terakhir) — dari `usage_stats`
- **Pipeline live**: berapa artikel di setiap stage sekarang — dari `job_queue`
- **Alert bar**: semua alert aktif dengan severity (dari key pool + watchdog)
- **Activity feed**: 10 log terbaru — dari `system_logs`
- **Site status grid**: 8 site dalam satu pandang (aktif/pause, artikel hari ini)
- Auto-refresh setiap 30 detik

---

### Step 7.2 — Halaman Sites
- Tabel 8 site dengan kolom: nama, URL, niche, status, artikel hari ini, next publish, queue
- **Form tambah site**: semua field dari profil site (URL, WP credentials, jadwal, persona, dll)
- **Form edit site**: sama dengan tambah, pre-filled dengan data existing
- **Test koneksi WordPress**: tombol yang real-test API call ke WP site tersebut
- **Pause/Aktifkan**: toggle yang update status di DB dan stop/mulai scheduler
- **Preview Persona Memory**: lihat deskripsi kumulatif gaya penulisan site

---

### Step 7.3 — Halaman API Keys
- Tabel per provider dengan kolom: label, status, usage bar visual, last used, error count
- **Usage bar**: visual persentase (merah jika > 80%, kuning jika > 60%, hijau di bawah itu)
- **Tambah key**: form dengan provider selector, label, nilai key (encrypted saat simpan)
- **Test key**: tombol test real → tampilkan response time dan status
- **Pause/Aktifkan**: toggle manual
- **Hapus key**: dengan konfirmasi
- **Priority chain editor**: drag-and-drop urutan provider fallback
- Estimasi kapan key reset (berdasarkan `reset_at`)

---

### Step 7.4 — Halaman Articles
- Tabel artikel dengan filter: site, status, kategori, tanggal, format
- Status badge berwarna sesuai stage pipeline
- **Detail artikel**: klik baris → panel samping atau halaman baru menampilkan:
  - Full content article
  - Semua 4 versi (utama, FAQ, ringkasan, caption)
  - Skor kualitas + skor E-E-A-T
  - Sumber yang digunakan
  - Log proses (setiap step pipeline dengan timestamp)
  - Metadata SEO
  - Gambar yang dipilih
- **Aksi per artikel**: Force publish, Move to draft, Regenerate (dari step mana), Delete
- **Human Review Queue**: tab khusus untuk artikel yang butuh approval manusia

---

### Step 7.5 — Halaman Queue
- **Pipeline visualizer**: 7 kolom (satu per stage), menampilkan count artikel di setiap stage
- **Job table**: semua job aktif dengan: type, artikel, status, attempts, waktu mulai
- **Dead letter queue**: job gagal permanent, tampilkan error detail + tombol retry manual
- **Force run**: jalankan pipeline untuk topik/artikel tertentu sekarang (tidak tunggu scheduler)

---

### Step 7.6 — Halaman Rapat Redaksi
- **Notulen terbaru**: tampilkan notulen rapat Senin ini (format markdown yang di-render)
- **Archive notulen**: dropdown pilih minggu sebelumnya
- **Content calendar visual**: tabel 7 hari × 8 site (topik yang direncanakan per sel)
- **Prediksi tren**: list topik dengan confidence score dan tanggal prediksi peak
- **Override manual**: tambah/edit/hapus topik dari content calendar
- **Trigger rapat sekarang**: jalankan proses rapat secara manual (tidak tunggu Senin)

---

### Step 7.7 — Halaman Sources
- Tabel semua sumber dengan filter kategori
- **Test fetch**: test real fetch dari sumber tersebut sekarang, tampilkan sample hasil
- **Tambah sumber**: form dengan URL, kategori, type, credibility score manual
- **Edit/hapus sumber**
- **Credibility score**: bisa di-edit manual oleh admin

---

### Step 7.8 — Halaman Analytics
- **Produksi artikel**: grafik line chart, filter range tanggal, per site atau total
- **Skor rata-rata**: E-E-A-T score per minggu (bar chart)
- **Provider performance**: tabel mana provider yang hasilkan artikel terbaik
- **Prompt evolution**: tabel versi prompt, sample count, skor rata-rata, champion badge
- **Evergreen candidates**: tabel artikel yang disarankan untuk di-update
- **Key usage history**: grafik penggunaan per provider per hari
- **Error rate**: grafik error per stage pipeline

---

### Step 7.9 — Halaman Settings
- **Timezone**: selector (default Asia/Jakarta)
- **Humanizer level**: slider 1-4 dengan deskripsi setiap level
- **Quality thresholds**: angka minimum skor Editor (default 75) dan E-E-A-T (default 80)
- **Human review**: toggle global + per-site override
- **Alert thresholds**: persentase limit key untuk warning/critical
- **Prompt templates**: editor teks untuk setiap template (berita, jurnal, feature, dll)
- **Fallback chain**: urutan provider LLM (drag-and-drop)
- **Image fallback chain**: urutan provider gambar
- **Export data**: export artikel/logs sebagai CSV/JSON

---

## ═══════════════════════════════════════
## FASE 8 — QUALITY & HUMANIZER ENGINE
## ═══════════════════════════════════════

**Tujuan**: Artikel tidak terdeteksi AI, lolos AdSense, dan terasa natural.

### Step 8.1 — Humanizer Layer (4 Level)

**Level 1 — Struktur** (selalu aktif):
- Variasi panjang paragraf: campuran 2-3 kalimat dan 4-5 kalimat
- Jangan biarkan 3 paragraf berturut-turut dengan panjang yang sama
- Variasi panjang kalimat: setelah kalimat panjang (>20 kata), sisipkan kalimat pendek (<10 kata)

**Level 2 — Bahasa** (selalu aktif):
- Replace pola kalimat klise AI: "Hal ini sangat penting..." → versi yang lebih spesifik
- Tambahkan konjungsi awal kalimat secara selektif: "Namun,", "Padahal,", "Bahkan,"
- Ganti kata-kata yang terlalu formal dengan sinonim yang lebih natural dalam konteks

**Level 3 — Konten** (aktif jika level ≥ 3):
- Tambahkan referensi waktu yang spesifik: "Senin lalu", "Awal tahun ini"
- Tambahkan detail geografis Indonesia yang spesifik jika relevan
- Sisipkan satu pertanyaan retoris per 3-4 paragraf
- Tambahkan "ketidakpastian yang jujur": "meski belum ada konfirmasi resmi..."

**Level 4 — Advanced** (aktif jika level = 4):
- Sisipkan satu minor imprecision yang natural (bukan kesalahan fakta, tapi cara manusia berbicara)
- Variasi atribusi kutipan: tidak selalu "mengatakan", ganti dengan "menyampaikan", "menegaskan", "mengungkapkan"
- Tambahkan satu detail "unexpected" yang relevan tapi tidak selalu disertakan AI

---

### Step 8.2 — AI Detection Pre-Check
Sebelum artikel dikirim ke Quality Rater, Editor Agent jalankan internal check:

Pola yang dicari dan dihilangkan:
- Frasa pembuka generik: "Dalam era modern ini...", "Di tengah perkembangan..."
- Penutup generik: "Kesimpulannya, ...", "Dengan demikian, kita dapat..."
- Transisi yang terlalu sempurna antar paragraf
- Penggunaan kata "pentingnya", "signifikansi", "dampak yang signifikan" berlebihan
- Pola "Pertama... Kedua... Ketiga..." yang terlalu terstruktur untuk berita

---

### Step 8.3 — Duplikasi Guard
- Hash judul + topik setiap artikel yang sudah publish
- Sebelum Penulis menulis: cek apakah topik terlalu mirip dengan yang sudah ada
- Similarity check sederhana: keyword overlap > 70% pada site yang sama → flag
- Jika ada artikel sangat mirip: Pemimpin Redaksi diberi tahu, topik diganti sudut pandangnya

---

## ═══════════════════════════════════════
## FASE 9 — RAPAT REDAKSI ENGINE
## ═══════════════════════════════════════

**Tujuan**: Sistem "berpikir" dan merencanakan dirinya sendiri setiap minggu.

### Step 9.1 — Google Trends Integration
- Fetch Google Trends data untuk Indonesia setiap 6 jam
- Library: `google-trends-api` atau scraping endpoint
- Simpan: top queries, rising queries, breakdown per kategori
- Store di DB sebagai time-series untuk analisis pola

---

### Step 9.2 — Trend Prediction Engine
Setiap Senin 06:30 (sebelum rapat dimulai):
1. Ambil 7 hari data trends terakhir
2. Panggil LLM: *"Berdasarkan pola tren ini, prediksi 10 topik yang akan trending dalam 3-7 hari ke depan di Indonesia. Berikan confidence score dan reasoning untuk setiap prediksi."*
3. Simpan prediksi ke tabel `trend_predictions`
4. Cross-check: apakah prediksi ini sudah pernah ditulis? Jika ya, skip atau cari angle baru

---

### Step 9.3 — Competitor Gap Scanner
Setiap Minggu (Sabtu 20:00):
1. Fetch sitemap/RSS semua kompetitor yang didaftarkan per site
2. Ekstrak topik-topik yang mereka tulis minggu ini
3. Bandingkan dengan topik yang kita tulis
4. Identifikasi: (a) topik yang ada di kompetitor tapi belum ada di kita, (b) topik kita yang lebih dalam dari kompetitor
5. Simpan sebagai `gap_opportunities` di `competitor_data`

---

### Step 9.4 — Performance Analyzer
Setiap Sabtu 21:00 (untuk laporan rapat Senin):
1. Query semua artikel yang publish minggu ini
2. Estimasi performa (jika tidak ada GSC: gunakan proxy — word count, internal links, E-E-A-T score sebagai predictor)
3. Identifikasi pola: format apa yang perform terbaik? Provider mana? Prompt version mana?
4. Identifikasi artikel untuk evergreen update
5. Generate laporan JSON terstruktur

---

### Step 9.5 — Content Calendar Generator (Pemimpin Redaksi Agent)
Setiap Senin 07:00:
1. Load laporan performa (dari Step 9.4)
2. Load prediksi tren (dari Step 9.2)
3. Load gap kompetitor (dari Step 9.3)
4. Untuk setiap site, generate 7 hari topik dengan instruksi ke LLM yang sangat spesifik:
   ```
   Site: [nama site], Niche: [niche], Jadwal: [X artikel/hari]
   Buat content calendar 7 hari dengan komposisi:
   - 60% topik trending yang relevan dengan niche
   - 30% evergreen yang belum dicover
   - 10% update artikel lama (dari daftar berikut)
   Hindari duplikasi dengan topik yang sudah pernah ditulis: [list]
   ```
5. Simpan ke `content_calendar`
6. Generate notulen rapat (teks readable, bukan hanya JSON)
7. Simpan ke `rapat_notes`

---

## ═══════════════════════════════════════
## FASE 10 — INNOVATION LAYER
## ═══════════════════════════════════════

### Step 10.1 — Persona Memory Builder
- Setiap kali artikel dipublish ke site X: ekstrak elemen gaya ke Persona Memory
- Ekstraksi LLM: *"Dari artikel ini, identifikasi: gaya bahasa, tingkat formalitas, sudut pandang editorial, topik favorit, cara memulai artikel, cara mengakhiri artikel."*
- Merge dengan Persona Memory yang sudah ada (jangan replace, tapi enrich)
- Simpan sebagai teks naratif yang bisa dibaca oleh Penulis Agent

---

### Step 10.2 — Evergreen Update Engine
Setiap malam (02:00 WIB):
1. Query artikel yang publish > 30 hari dengan format evergreen/feature
2. Untuk setiap kandidat: fetch sumber aslinya, cek apakah ada update terbaru
3. Jika ada update: enqueue job EVERGREEN_UPDATE
4. EVERGREEN_UPDATE pipeline:
   - Reporter: fetch info terbaru
   - Editor: tambahkan seksi "Update [tanggal]" di awal artikel
   - Update `updated_at` di WordPress
   - Re-ping ke Google (jika GSC terintegrasii)

---

### Step 10.3 — Link Intelligence Network
SEO Agent enhanced: saat proses artikel baru, query lintas semua 8 site:
- Cari artikel relevan berdasarkan keyword overlap
- Prioritaskan link ke artikel yang E-E-A-T score tinggi
- Variasikan anchor text (tidak boleh sama persis untuk topik yang sama)
- Batasi: maks 3 cross-site link per artikel (tidak spam)
- Track semua link yang pernah dibuat (hindari terlalu banyak link ke satu artikel)

---

### Step 10.4 — Prompt Evolution System
- Setiap artikel disimpan dengan `prompt_version_id`
- Setiap minggu: query DB → korelasikan prompt version dengan skor rata-rata
- Jika prompt A (n>20 sampel) memiliki rata-rata skor 5+ poin lebih tinggi dari prompt B: B menjadi `deprecated`, A menjadi `champion`
- 10% dari pipeline secara random pakai prompt versi experimental (A/B test)
- Admin bisa lihat hasil di halaman Analytics

---

### Step 10.5 — Smart Timing Learner
Setelah 30 hari data terkumpul:
- Analisis: artikel dari kategori X yang publish di jam mana punya estimasi performa terbaik?
- Secara otomatis adjust default `time_slots` per kategori per site
- Ini dilakukan oleh Analis Agent sebagai bagian dari laporan mingguan

---

## ═══════════════════════════════════════
## FASE 11 — HARDENING & PRODUCTION READY
## ═══════════════════════════════════════

### Step 11.1 — Comprehensive Logging
- Setiap aksi agent: log ke `system_logs` dengan level, agent, message, metadata
- Log rotation: hapus log > 30 hari secara otomatis
- Log viewer di dashboard: filter by level, agent, tanggal
- Critical error: tambahkan ke alert bar dashboard

### Step 11.2 — Alert & Notification System
- Alert types: key_exhausted, key_warning, pipeline_stuck, wordpress_error, quality_gate_fail_streak
- Alert dashboard: panel di halaman Overview, sorted by severity
- Alert resolution: mark as resolved dari dashboard

### Step 11.3 — Rate Limiting & Protection
- Rate limiting pada semua endpoint API internal
- Proteksi dari request berlebihan
- Timeout pada semua external API call (LLM, WordPress, RSS, image API)

### Step 11.4 — Data Backup
- Export full data: artikel, sites, keys (keys tetap terenkripsi) sebagai JSON
- Bisa diimport kembali jika pindah server

### Step 11.5 — Performance Optimization
- Database index pada kolom yang sering di-query
- Connection pooling untuk DB
- Response caching untuk endpoint yang datanya jarang berubah

---

## SUMMARY: URUTAN BUILD MUTLAK

```
FASE 0 (Foundation)
  └→ FASE 1 (Key Pool)
       └→ FASE 2 (Sources)
            └→ FASE 3 (Pipeline Core)
                 └→ FASE 4 (Writing Standards)  ← parallel dengan Fase 3
                      └→ FASE 5 (Image + Publisher)
                           └→ FASE 6 (Scheduler)
                                └→ FASE 7 (Dashboard)  ← bisa sebagian parallel
                                     └→ FASE 8 (Quality/Humanizer)
                                          └→ FASE 9 (Rapat Redaksi)
                                               └→ FASE 10 (Innovation)
                                                    └→ FASE 11 (Hardening)
```

**Milestone yang bisa di-demo**:
- Selesai Fase 3: pipeline jalan → artikel draft dihasilkan otomatis
- Selesai Fase 5: artikel terbit nyata di WordPress
- Selesai Fase 7: dashboard penuh, semua bisa dimonitor dan dikontrol
- Selesai Fase 9: sistem mandiri penuh, rapat mingguan otomatis
- Selesai Fase 11: production-ready, deploy

---

*Build phases ini adalah kontrak teknis. Setiap langkah = deliverable nyata yang bisa diverifikasi.*
