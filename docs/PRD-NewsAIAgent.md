# PRD — News AI Agent System
## Product Requirements Document (Superdetail)
**Versi**: 1.0.0  
**Tanggal**: Juli 2026  
**Status**: Draft Final  
**Penulis**: AI Architect Session

---

## DAFTAR ISI

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Latar Belakang & Tujuan](#2-latar-belakang--tujuan)
3. [Pengguna & Stakeholder](#3-pengguna--stakeholder)
4. [Arsitektur Sistem](#4-arsitektur-sistem)
5. [Struktur Agent (Redaksi Digital)](#5-struktur-agent-redaksi-digital)
6. [Sistem API Key Pool](#6-sistem-api-key-pool)
7. [Sumber Berita Cerdas Per Kategori](#7-sumber-berita-cerdas-per-kategori)
8. [Pipeline Konten End-to-End](#8-pipeline-konten-end-to-end)
9. [Standar Penulisan Konten](#9-standar-penulisan-konten)
10. [Sistem Gambar](#10-sistem-gambar)
11. [Rapat Redaksi Mingguan (Automated)](#11-rapat-redaksi-mingguan-automated)
12. [Fitur Inovatif](#12-fitur-inovatif)
13. [Multi-Site Management](#13-multi-site-management)
14. [SEO & Anti-AI Detection](#14-seo--anti-ai-detection)
15. [WordPress Integration](#15-wordpress-integration)
16. [Dashboard & Monitoring](#16-dashboard--monitoring)
17. [Database Schema](#17-database-schema)
18. [Stack Teknologi](#18-stack-teknologi)
19. [Keamanan & Privasi](#19-keamanan--privasi)
20. [Roadmap Pengembangan](#20-roadmap-pengembangan)
21. [Kriteria Keberhasilan (KPI)](#21-kriteria-keberhasilan-kpi)

---

## 1. RINGKASAN EKSEKUTIF

**News AI Agent** adalah sistem redaksi digital otomatis berbasis multi-LLM yang mampu memproduksi, mengedit, mengoptimasi, dan mempublikasikan artikel berita serta jurnal ilmiah secara otomatis ke 8 website WordPress secara bersamaan.

Sistem ini dimodelkan seperti **struktur perusahaan media profesional** — setiap proses (riset, penulisan, editing, SEO, penerbitan) dijalankan oleh AI Agent khusus dengan peran dan tanggung jawab masing-masing. Seluruh proses berjalan **90% otomatis** dengan tingkat pengawasan manusia yang minimal namun efektif.

### Tujuan Utama:
- Produksi konten berkualitas tinggi yang lolos **Google AdSense** dan meraih **peringkat tinggi di Google**
- Artikel terasa **natural seperti ditulis manusia**, tidak terdeteksi sebagai konten AI
- Efisiensi biaya maksimal melalui **multi-provider LLM dengan rotasi API key otomatis**
- Skalabilitas untuk mengelola **8 website sekaligus** dari satu dashboard terpusat

---

## 2. LATAR BELAKANG & TUJUAN

### Masalah yang Diselesaikan:
| Masalah | Solusi Sistem Ini |
|---|---|
| Produksi konten manual membutuhkan banyak SDM | Otomasi penuh dengan AI Agent |
| Biaya LLM API mahal untuk volume besar | Multi-key pool + auto-rotate |
| Artikel AI mudah terdeteksi Google | Humanizer layer + Quality Rater Simulator |
| Sulit mengelola 8 website sekaligus | Multi-site management terpusat |
| Tren berita berubah cepat | Prediksi tren + rapat redaksi mingguan |
| SEO butuh konsistensi dan keahlian | SEO Agent khusus + E-E-A-T checker |

### Tujuan Bisnis:
1. Menghasilkan minimum **3-5 artikel/hari per website** (24-40 artikel/hari total)
2. Seluruh artikel lolos review Google AdSense
3. Minimum 30% artikel mencapai halaman 1 Google dalam 30 hari
4. Zero biaya langganan LLM di fase awal (full free tier)
5. Operasional mandiri selama **7 hari tanpa intervensi manusia**

---

## 3. PENGGUNA & STAKEHOLDER

### Primary User:
- **Pemilik/Admin**: Mengakses dashboard, mengatur site, upload API key, melihat laporan

### Secondary User:
- **Editor Manusia (opsional)**: Dapat review artikel sebelum publish lewat antrian "Human Review"

### System Actors (AI Agents):
- Pemimpin Redaksi Agent
- Reporter/Peneliti Agent
- Penulis Agent
- Editor Agent
- Fotografer Agent
- SEO Specialist Agent
- Publisher Agent
- Analis Agent

---

## 4. ARSITEKTUR SISTEM

```
┌─────────────────────────────────────────────────────────────────┐
│                    DASHBOARD (React + Vite)                      │
│   Sites | API Keys | Articles | Queue | Reports | Rapat Notes   │
└───────────────────────────┬─────────────────────────────────────┘
                            │ REST API (JSON)
┌───────────────────────────▼─────────────────────────────────────┐
│                   EXPRESS SERVER (Node.js)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  KEY POOL MANAGER                        │   │
│  │  Gemini | Groq | DeepSeek | OpenRouter | Mistral |       │   │
│  │  Together AI | Cerebras | Cohere | HuggingFace           │   │
│  │  ─────────────────────────────────────────────           │   │
│  │  Smart rotation | Usage tracking | Fallback chain        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  AGENT ORCHESTRATOR                      │   │
│  │                                                          │   │
│  │  [Pemimpin Redaksi] → merencanakan, mendelegasikan       │   │
│  │       ↓                                                  │   │
│  │  [Reporter] → riset sumber sesuai kategori               │   │
│  │       ↓                                                  │   │
│  │  [Penulis] → generate artikel natural                    │   │
│  │       ↓                                                  │   │
│  │  [Editor] → review, humanize, QC                         │   │
│  │       ↓                                                  │   │
│  │  [Quality Rater] → simulasi Google Quality Rater         │   │
│  │       ↓                                                  │   │
│  │  [Fotografer] → cari/generate gambar presisi             │   │
│  │       ↓                                                  │   │
│  │  [SEO Specialist] → optimasi on-page full                │   │
│  │       ↓                                                  │   │
│  │  [Publisher] → jadwal & publish ke WordPress             │   │
│  │       ↓                                                  │   │
│  │  [Analis] → track performa, laporan mingguan             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               CONTENT PIPELINE PROCESSOR                 │   │
│  │  Source Fetcher → Topic Filter → Dedup Guard →           │   │
│  │  AI Writer → Humanizer → SEO → Image → Publisher        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                SCHEDULER (node-cron)                     │   │
│  │  Per-site schedule | Random delay | Rapat Senin 07:00    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                      PostgreSQL Database                         │
│  sites | api_keys | articles | job_queue | sources |            │
│  rapat_notes | logs | usage_stats | persona_memory |            │
│  content_calendar | competitor_data | trend_predictions         │
└─────────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
  [WordPress Site 1]  [WordPress Site 2] ... [WordPress Site 8]
```

---

## 5. STRUKTUR AGENT (REDAKSI DIGITAL)

### 5.1 Pemimpin Redaksi Agent (Chief Editor AI)

**Peran**: Otak utama sistem. Bertanggung jawab atas arah editorial, content calendar, dan distribusi tugas.

**Tugas**:
- Setiap Senin 07:00 WIB: jalankan sesi "Rapat Redaksi"
- Analisis Google Trends Indonesia
- Baca laporan performa minggu lalu dari Analis Agent
- Identifikasi topik yang akan trending 3-7 hari ke depan (predictive)
- Susun content calendar 7 hari ke depan untuk semua 8 site
- Tentukan prioritas: topik baru vs evergreen update vs gap kompetitor
- Simpan "notulen rapat" ke database (bisa dibaca di dashboard)
- Delegasikan tugas ke Reporter Agent

**Input**: Laporan Analis + Google Trends API + Competitor gap data  
**Output**: Content calendar JSON + notulen rapat teks

---

### 5.2 Reporter / Peneliti Agent

**Peran**: Jurnalis lapangan digital. Mencari, memverifikasi, dan mengumpulkan bahan tulisan.

**Tugas**:
- Terima assignment topik dari Pemimpin Redaksi
- Identifikasi kategori topik (politik, akademik, teknologi, dll)
- Pilih sumber yang tepat berdasarkan kategori (lihat Bab 7)
- Fetch konten dari sumber (RSS, scraping, API)
- Verifikasi fakta lintas sumber (minimum 2 sumber)
- Ekstrak: fakta utama, kutipan, angka, tanggal, nama
- Evaluasi kredibilitas sumber (Source Credibility Score)
- Susun "brief riset" untuk Penulis Agent

**Input**: Topik assignment + kategori  
**Output**: Brief riset terstruktur (JSON dengan fakta, kutipan, sumber)

---

### 5.3 Penulis Agent

**Peran**: Wartawan/penulis konten. Menulis artikel berdasarkan brief riset.

**Tugas**:
- Terima brief riset dari Reporter
- Identifikasi format: berita, artikel mendalam, jurnal, atau opini
- Terapkan standar penulisan sesuai format (lihat Bab 9)
- Generate artikel dengan struktur yang tepat
- Gunakan Persona Memory site tujuan (gaya bahasa, sudut pandang historis)
- Sertakan kutipan natural dari sumber
- Generate variasi: artikel utama + FAQ section + ringkasan + caption sosmed
- Tandai placeholder gambar dengan deskripsi visual yang presisi

**Input**: Brief riset + Persona Memory site + format target  
**Output**: Draft artikel lengkap dalam 4 format (panjang/FAQ/ringkas/caption)

---

### 5.4 Editor Agent

**Peran**: Redaktur. Menjaga kualitas, akurasi, dan konsistensi konten.

**Tugas**:
- Review draft dari Penulis Agent
- Cek akurasi fakta terhadap brief riset
- Cek konsistensi dengan Persona Memory site
- Cek duplikasi dengan artikel sebelumnya di site yang sama
- Terapkan Humanizer Layer (lihat Bab 14)
- Cek plagiarisme (bandingkan dengan konten yang sudah ada)
- Pastikan standar jurnalistik/jurnal terpenuhi
- Cek kelengkapan 5W+1H untuk berita
- Cek struktur IMRAD untuk jurnal
- Berikan skor kualitas (0-100). Jika < 75 → kirim ulang ke Penulis

**Input**: Draft artikel + brief riset + Persona Memory  
**Output**: Artikel yang telah diedit + skor kualitas

---

### 5.5 Quality Rater Simulator Agent

**Peran**: Mensimulasikan Google Human Quality Rater untuk validasi E-E-A-T.

**Tugas**:
- Evaluasi artikel dengan framework E-E-A-T:
  - **Experience**: Apakah konten menunjukkan pengalaman nyata?
  - **Expertise**: Apakah konten menunjukkan keahlian?
  - **Authoritativeness**: Apakah ada referensi otoritatif?
  - **Trustworthiness**: Apakah konten bisa dipercaya?
- Deteksi pola AI yang bisa teridentifikasi
- Evaluasi naturalness of language
- Cek apakah artikel memenuhi search intent
- Scoring 0-100. Jika < 80 → kembalikan ke Editor dengan catatan spesifik

**Input**: Artikel yang telah diedit  
**Output**: Skor E-E-A-T + catatan perbaikan + status (PASS/REVISI)

---

### 5.6 Fotografer / Illustrator Agent

**Peran**: Mencari atau menghasilkan visual yang presisi dan relevan.

**Tugas**:
- Terima artikel yang sudah PASS dari Quality Rater
- Baca deskripsi placeholder gambar dari Penulis
- Tentukan strategi gambar (berdasarkan sisa token/kuota):
  - **Priority 1**: Generate AI image (Imagen/DALL-E/SD) → paling presisi
  - **Priority 2**: Fetch dari Unsplash/Pexels API (free, licensed)
  - **Priority 3**: Ambil dari sumber artikel jika ada & bebas digunakan
- Pastikan gambar benar-benar relevan dengan isi spesifik artikel
- Tambahkan alt text SEO pada setiap gambar
- Simpan gambar ke storage, siapkan URL untuk WordPress

**Input**: Artikel + deskripsi visual placeholder + status kuota image API  
**Output**: URL gambar + alt text + metadata gambar

---

### 5.7 SEO Specialist Agent

**Peran**: Mengoptimasi seluruh aspek on-page SEO sebelum publish.

**Tugas**:
- Riset keyword utama dan LSI (Latent Semantic Indexing) keyword
- Optimalkan judul (H1): mengandung keyword utama, menarik klik
- Generate meta title (50-60 karakter) dan meta description (150-160 karakter)
- Struktur heading H2/H3/H4 yang logis dan keyword-rich
- Internal linking cerdas: cari artikel relevan di site yang sama + site lain dalam jaringan
- External linking ke sumber otoritatif
- Generate schema markup (Article/NewsArticle/ScholarlyArticle JSON-LD)
- Cek keyword density (target 1-2%)
- Hitung estimasi Flesch Reading Ease score (target > 60 untuk umum)
- Generate slug URL yang SEO-friendly

**Input**: Artikel setelah Quality Rater PASS  
**Output**: Artikel dengan semua elemen SEO lengkap + metadata JSON

---

### 5.8 Publisher Agent

**Peran**: Menerbitkan konten ke WordPress sesuai jadwal yang telah direncanakan.

**Tugas**:
- Terima artikel final dari SEO Agent
- Tentukan jadwal publish berdasarkan "Waktu Emas" kategori (lihat Bab 12)
- Tambahkan random delay natural (±15-45 menit dari target waktu)
- Publish via WordPress REST API:
  - Set judul, konten, status (publish/draft)
  - Set kategori dan tag
  - Upload dan set featured image
  - Set meta SEO (via Yoast/RankMath API)
  - Set schema markup
- Konfirmasi publish berhasil, simpan URL ke database
- Jika gagal: retry 3x dengan backoff exponential, lalu alert ke log

**Input**: Artikel final + metadata + jadwal  
**Output**: URL artikel yang sudah publish + status

---

### 5.9 Analis Agent

**Peran**: Mengukur performa konten dan memberikan insight untuk perbaikan.

**Tugas**:
- Setiap hari: update status semua artikel (via Google Search Console API jika tersedia, atau proxy metrics)
- Identifikasi artikel yang turun dari halaman 1
- Identifikasi artikel yang naik atau sudah di halaman 1
- Setiap Minggu (Sabtu malam): susun laporan lengkap untuk Rapat Senin:
  - Top 10 artikel terbaik minggu ini
  - Bottom 10 artikel terburuk
  - Rata-rata skor E-E-A-T
  - Provider LLM mana yang hasilkan artikel terbaik
  - Prompt mana yang perform terbaik (Prompt Evolution data)
  - Rekomendasi artikel mana yang perlu di-update (Evergreen Engine)
- Identifikasi gap kompetitor baru

**Input**: Database artikel + metrics  
**Output**: Laporan mingguan JSON + rekomendasi teks

---

## 6. SISTEM API KEY POOL

### 6.1 Provider yang Didukung

| Provider | Model Default | Free Tier | Rate Limit |
|---|---|---|---|
| **Google Gemini** | gemini-1.5-flash | 15 RPM, 1M TPM/bulan | Per menit |
| **Groq** | llama-3.3-70b | 14,400 req/hari | Per hari |
| **DeepSeek** | deepseek-chat | $5 free credit | Per token |
| **OpenRouter** | berbagai model | Free models tersedia | Per req |
| **Mistral AI** | mistral-small | 1 req/detik | Per detik |
| **Together AI** | llama-3 series | $5 free credit | Per token |
| **Cerebras** | llama3.1-70b | Free tier ada | Per req |
| **Cohere** | command-r | 1,000 req/bulan | Per bulan |
| **HuggingFace** | berbagai model | Sangat terbatas | Per req |

### 6.2 Smart Rotation Logic

```
Algoritma Pemilihan Key:
1. Filter key dengan status ACTIVE
2. Filter key yang belum mencapai 85% dari limit (buffer 15%)
3. Urutkan berdasarkan "freshness score":
   - Waktu terakhir digunakan (makin lama makin segar = lebih diprioritaskan)
   - Jarak dari reset limit (makin jauh dari reset = lebih diprioritaskan)
4. Pilih key dengan freshness score tertinggi
5. Jika semua key provider X habis → fallback ke provider Y sesuai priority chain
```

### 6.3 Priority Chain (Default)
```
Gemini → Groq → DeepSeek → OpenRouter → Mistral → Together → Cerebras → Cohere
```
Priority bisa diubah per kategori konten di dashboard.

### 6.4 Per-Key Metadata yang Disimpan
```json
{
  "id": "uuid",
  "provider": "gemini",
  "key_value": "encrypted",
  "label": "Gemini Key #3",
  "status": "active | paused | exhausted | error",
  "usage_today": 4200,
  "usage_this_month": 45000,
  "daily_limit": 15000,
  "monthly_limit": 1000000,
  "last_used_at": "2026-07-27T10:30:00Z",
  "reset_at": "2026-07-28T00:00:00Z",
  "error_count": 0,
  "last_error": null,
  "success_rate": 99.2,
  "avg_response_time_ms": 1240
}
```

### 6.5 Alert System
- Key mencapai 80% limit → notifikasi di dashboard
- Key exhausted → otomatis pindah + log
- Semua key provider X habis → alert kritis di dashboard
- Response time > 5 detik → tandai sebagai degraded

---

## 7. SUMBER BERITA CERDAS PER KATEGORI

### 7.1 Mapping Kategori → Sumber

#### 📰 Politik & Pemerintahan
- detik.com/news, kompas.com, tempo.co, antara.id
- republika.co.id, cnnindonesia.com, mediaindonesia.com
- tribunnews.com, jpnn.com
- Situs resmi: setkab.go.id, dpr.go.id, kpu.go.id

#### 📚 Akademik & Jurnal Ilmiah
- Google Scholar (scholar.google.com)
- Semantic Scholar (semanticscholar.org)
- SINTA (sinta.kemdikbud.go.id) — jurnal Indonesia terindex
- arXiv (arxiv.org) — preprint sains & teknologi
- PubMed (pubmed.ncbi.nlm.nih.gov) — kedokteran & biologi
- BRIN Repository (repository.brin.go.id)
- Garuda (garuda.kemdikbud.go.id) — portal jurnal nasional
- DOAJ (doaj.org) — jurnal open access

#### 💻 Teknologi & Digital
- The Verge (theverge.com), Wired (wired.com)
- TechCrunch (techcrunch.com), Ars Technica (arstechnica.com)
- Gizmodo (gizmodo.com), MIT Technology Review
- IDN Times Tech, Kompas Tekno, Detik Inet
- GitHub Blog, Google AI Blog, OpenAI Blog

#### 💰 Bisnis & Ekonomi
- bisnis.com, kontan.co.id, katadata.co.id
- Reuters (reuters.com), Bloomberg (bloomberg.com)
- CNBC Indonesia, Fortune Indonesia
- Bank Indonesia (bi.go.id) — data ekonomi resmi
- BPS (bps.go.id) — data statistik nasional

#### 🏥 Kesehatan & Medis
- PubMed/NCBI, WHO (who.int), CDC (cdc.gov)
- Halodoc, Alodokter, Klikdokter
- Kemenkes RI (kemkes.go.id)
- Mayo Clinic, WebMD (untuk referensi umum)
- New England Journal of Medicine, The Lancet

#### ⚖️ Hukum
- JDIH (jdih.go.id) — Jaringan Dokumentasi Hukum Nasional
- Hukumonline (hukumonline.com)
- Mahkamah Agung (mahkamahagung.go.id)
- MK RI (mkri.id)
- Perpustakaan Hukum Nasional

#### 🔬 Sains & Lingkungan
- Nature (nature.com), Science Daily (sciencedaily.com)
- LIPI/BRIN (brin.go.id)
- LAPAN (lapan.go.id)
- BMKG (bmkg.go.id) — cuaca & iklim
- National Geographic Indonesia

#### ⚽ Olahraga
- bola.com, bola.net, goal.com/id
- ESPN (espn.com), BBC Sport
- PSSI (pssi.org), Kemenpora (kemenpora.go.id)
- World Athletics, FIFA

#### 🌏 Berita Internasional
- Reuters, Associated Press (apnews.com)
- BBC Indonesia (bbc.com/indonesia)
- VOA Indonesia (voaindonesia.com)
- DW Indonesia (dw.com/id)
- Al Jazeera Indonesia

### 7.2 Source Credibility Scoring

Setiap sumber mendapatkan skor 1-10 berdasarkan:
- Reputasi dan usia domain
- Ada redaksi resmi atau tidak
- Terindex di Google News atau tidak
- Frekuensi update
- Relevansi dengan kategori

Skor ini digunakan untuk menentukan prioritas dan bobot referensi dalam artikel.

### 7.3 Fetch Strategy per Sumber
- **RSS Feed**: Sumber yang menyediakan RSS (detik, kompas, tempo, dll)
- **API**: Sumber yang punya API publik (Google Scholar, PubMed, arXiv)
- **Web Scraping**: Sumber tanpa RSS/API (dengan rate limiting yang sopan)
- **Manual Input**: Admin bisa tambah URL spesifik dari dashboard

---

## 8. PIPELINE KONTEN END-TO-END

### 8.1 Alur Lengkap

```
TRIGGER (scheduler/manual)
│
▼
TOPIC ASSIGNMENT
│ Pemimpin Redaksi ambil topik dari content calendar
│ Tentukan: site tujuan, kategori, deadline, format
│
▼
RESEARCH PHASE (Reporter Agent)
│ Pilih sumber berdasarkan kategori
│ Fetch konten dari ≥2 sumber
│ Verifikasi silang fakta
│ Susun brief riset terstruktur
│
▼
WRITING PHASE (Penulis Agent)
│ Load Persona Memory site tujuan
│ Tulis artikel sesuai format & standar
│ Generate 4 format output sekaligus
│ Tandai placeholder gambar
│
▼
EDITING PHASE (Editor Agent)
│ Review akurasi & konsistensi
│ Cek duplikasi
│ Terapkan Humanizer Layer
│ Skor kualitas ≥75? → lanjut | < 75 → revisi
│
▼
QUALITY GATE (Quality Rater Simulator)
│ Evaluasi E-E-A-T
│ Deteksi pola AI
│ Skor ≥80? → lanjut | < 80 → kembali ke Editor
│
▼
IMAGE PHASE (Fotografer Agent)
│ Cek kuota image generation
│ Generate atau fetch gambar presisi
│ Tambah alt text SEO
│
▼
SEO PHASE (SEO Agent)
│ Keyword research & optimasi
│ Meta tags, schema markup
│ Internal & external linking
│ Slug URL
│
▼
SCHEDULING (Publisher Agent)
│ Tentukan waktu publish optimal (Waktu Emas)
│ Tambah random delay ±15-45 menit
│ Masukkan ke job queue
│
▼
PUBLISHING
│ Kirim ke WordPress via REST API
│ Upload gambar
│ Set semua metadata
│ Konfirmasi & simpan URL
│
▼
MONITORING (Analis Agent)
  Track performa artikel
  Update laporan harian
  Flag artikel yang perlu update
```

### 8.2 Job Queue System

Setiap tahap pipeline menghasilkan job yang masuk ke queue:
- Status: `pending | processing | done | failed | retry`
- Priority: `urgent | high | normal | low`
- Retry: maksimum 3x dengan exponential backoff
- Dead letter queue: job yang gagal 3x → alert + manual review

---

## 9. STANDAR PENULISAN KONTEN

### 9.1 Standar Penulisan Berita

Sistem mengikuti kaidah jurnalistik profesional Indonesia:

#### A. Struktur Berita (Piramida Terbalik)

**Judul (Headline)**
- Singkat, menarik, padat, mencerminkan inti informasi
- Panjang optimal: 55-70 karakter
- Mengandung keyword utama
- Menghindari clickbait berlebihan
- Contoh gaya: *"Harga BBM Subsidi Turun, Ini Rincian Lengkap Per Daerah"*

**Teras Berita (Lead)**
- Alinea pertama yang merangkum poin paling penting
- Wajib memuat unsur **Who** (siapa) dan **What** (apa)
- Panjang: 1 paragraf, maksimum 40 kata
- Menjawab pertanyaan paling mendasar pembaca

**Badan Berita (Body) — Piramida Terbalik**
- Paragraf 2-3: menjelaskan **Why** (mengapa) dan **How** (bagaimana)
- Paragraf 4-6: konteks, latar belakang, kutipan narasumber
- Paragraf 7+: informasi pendukung, data tambahan, sejarah

#### B. Kaidah 5W+1H (Wajib Terpenuhi Semua)
- **What** — Apa yang terjadi?
- **Who** — Siapa yang terlibat?
- **Where** — Di mana kejadian berlangsung?
- **When** — Kapan kejadian terjadi?
- **Why** — Mengapa hal ini terjadi?
- **How** — Bagaimana prosesnya?

Quality Rater Simulator akan memverifikasi semua unsur terpenuhi sebelum PASS.

#### C. Bahasa Jurnalistik
- Singkat, padat, lugas, mudah dipahami masyarakat umum
- Kalimat aktif lebih diutamakan dari kalimat pasif
- Paragraf pendek: 3-5 kalimat per paragraf
- Hindari jargon teknis tanpa penjelasan
- Hindari eufemisme berlebihan
- Gunakan KBBI sebagai acuan ejaan

#### D. Faktual dan Objektif
- Setiap klaim faktual harus bersumber dari referensi yang valid
- Tidak mencampurkan opini penulis dengan berita
- Kutipan narasumber harus diberi atribusi jelas
- Mematuhi Kode Etik Jurnalistik Dewan Pers

#### E. Format Artikel Berita di Sistem
```
[JUDUL]
[LEAD - 1 paragraf]
[BADAN - 5-8 paragraf]
  - Paragraf konteks
  - Kutipan narasumber #1
  - Data/fakta pendukung
  - Kutipan narasumber #2 (jika ada)
  - Latar belakang/sejarah
  - Informasi tambahan
[PENUTUP - 1 paragraf, kesimpulan atau prospek ke depan]
[SUMBER REFERENSI - minimal 2 sumber]
```

---

### 9.2 Standar Penulisan Jurnal Ilmiah

Sistem mengikuti ketentuan penulisan jurnal ilmiah dengan struktur baku **IMRAD**:

#### A. Struktur Utama (IMRAD)

**Judul**
- Singkat, jelas, mencerminkan isi penelitian
- Maksimal **12 kata** untuk Bahasa Indonesia
- Tidak menggunakan singkatan kecuali yang sangat umum
- Tidak menggunakan pertanyaan sebagai judul

**Nama & Afiliasi Penulis**
- Ditulis tanpa gelar akademik
- Disertai asal instansi atau lembaga
- Untuk konten berbasis literatur, dikreditkan ke "Tim Redaksi [Nama Site]"

**Abstrak & Kata Kunci**
- Ringkasan: tujuan, metode, hasil, dan simpulan
- Panjang: **100–250 kata**
- Kata kunci: **3–5 kata kunci**, diurutkan alfabetis
- Abstrak tidak mengandung referensi atau singkatan baru

**Pendahuluan (Introduction)**
- Latar belakang masalah
- Tinjauan literatur singkat (state of the art)
- Research gap (celah penelitian yang belum terjawab)
- Tujuan penelitian/tulisan
- Panjang: 300-600 kata

**Metode (Methods)**
- Cara, alat, bahan, atau desain penelitian
- Cukup detail agar bisa direproduksi
- Untuk artikel review: metode pencarian literatur

**Hasil & Pembahasan (Results & Discussion)**
- Pemaparan data/temuan secara sistematis
- Analisis kaitan dengan teori yang ada
- Perbandingan dengan penelitian sebelumnya
- Tabel dan gambar dengan nomor dan caption

**Simpulan (Conclusion)**
- Jawaban ringkas atas tujuan penelitian
- Implikasi praktis atau teoritis
- Keterbatasan studi
- Rekomendasi untuk penelitian lanjutan

**Daftar Pustaka (References)**
- Referensi yang kredibel dan mutakhir (prioritas 5 tahun terakhir)
- Format sesuai gaya sitasi yang ditentukan (lihat di bawah)

#### B. Format Teknis
- Paragraf 3-5 kalimat
- Bahasa Indonesia baku (sesuai KBBI dan EYD terbaru)
- Angka 1-9 ditulis dengan huruf, 10 ke atas dengan angka
- Persentase: gunakan simbol % dengan spasi sebelumnya

#### C. Gaya Sitasi (Dipilih Per Site/Kategori)

**APA Style** (Ilmu Sosial, Psikologi, Hukum, Pendidikan)
- Sistem Penulis-Tahun (Author-Date)
- Di dalam teks: `(Pratama, 2024)` atau `Pratama (2024)`
- Daftar pustaka: `Pratama, A. (2024). *Judul Buku*. Penerbit.`

**IEEE Style** (Teknik, Ilmu Komputer, Teknologi Informasi)
- Sistem Nomor Urut `[1]` dalam kurung siku
- Di dalam teks: `Penelitian ini menggunakan metode baru [1]`
- Daftar pustaka: `[1] A. Pratama, *Judul Buku*, Kota: Penerbit, 2024.`

**Harvard Style** (Ekonomi, Bisnis, Humaniora)
- Sistem Penulis-Tahun, mirip APA dengan beda tanda baca
- Di dalam teks: `(Pratama 2024)` atau `Pratama (2024)`
- Daftar pustaka: `Pratama, A., 2024. *Judul Buku*. Penerbit.`

Sistem otomatis memilih gaya sitasi berdasarkan kategori konten yang telah dikonfigurasi per site.

#### D. Anti-Plagiarisme
- Setiap artikel jurnal dicek similarity score internal
- Target: < 20% similarity dengan konten yang sudah ada
- Parafrase dan sintesis dari multiple sumber, bukan copy-paste
- Semua kutipan langsung harus dalam tanda kutip dengan atribusi

---

### 9.3 Format Konten Lain yang Didukung

| Format | Deskripsi | Panjang Target |
|---|---|---|
| **Berita Singkat** | Update cepat, fakta dasar | 200-400 kata |
| **Berita Panjang** | Investigatif, mendalam | 800-1500 kata |
| **Feature/Opini** | Analisis mendalam bersudut pandang | 1000-2000 kata |
| **Listicle** | Format daftar, mudah dibaca | 600-1200 kata |
| **Jurnal Review** | Review literatur ilmiah | 1500-3000 kata |
| **FAQ Article** | Format tanya-jawab | 800-1500 kata |
| **Evergreen** | Konten tidak lekang waktu | 1200-2500 kata |

---

## 10. SISTEM GAMBAR

### 10.1 Fallback Chain (Prioritas)

```
1. [UTAMA] AI Image Generation
   - Jika kuota tersedia di provider image
   - Provider: Imagen 3 (Google) > DALL-E 3 > Stable Diffusion API
   - Prompt dibangun dari: ringkasan artikel + keyword utama + kategori
   - Resolusi minimum: 1200x630px (optimal OG image)

2. [FALLBACK 1] Stock Photo API
   - Unsplash API (gratis, license Unsplash)
   - Pexels API (gratis, license CC0)
   - Query: keyword utama artikel + kategori visual

3. [FALLBACK 2] Gambar dari Sumber Artikel
   - Hanya jika sumber menyatakan bebas digunakan
   - Cek license sebelum menggunakan
   - Atribusi otomatis di alt text

4. [FALLBACK 3] Placeholder Branded
   - Gambar placeholder dengan branding site
   - Teks topik artikel di overlay
   - Lebih baik dari tidak ada gambar
```

### 10.2 Presisi Gambar

Sistem tidak menggunakan judul artikel sebagai prompt gambar. Fotografer Agent membaca **isi artikel** dan membangun prompt visual yang sangat spesifik:

```
Deskripsi dari Penulis Agent:
"Gambar harus menampilkan: suasana sidang paripurna DPR,
 ruang sidang formal, latar bendera Indonesia"

Prompt Image Generation (yang dihasilkan):
"Indonesian parliament plenary session, formal chamber interior,
 red and white Indonesian flags, legislators in formal attire,
 podium with microphone, professional editorial photography style,
 high resolution, no text overlay"
```

### 10.3 Image Metadata
Setiap gambar disimpan dengan:
- URL asli dan URL WordPress setelah upload
- Alt text yang mengandung keyword SEO
- Caption (jika diperlukan)
- Credit/atribusi sumber
- Dimensi dan ukuran file
- Biaya generation (jika menggunakan paid API)

---

## 11. RAPAT REDAKSI MINGGUAN (AUTOMATED)

### 11.1 Jadwal
- **Kapan**: Setiap Senin, 07:00 WIB
- **Durasi proses**: ~10-15 menit (background)
- **Output**: Tersedia di dashboard sebelum 07:30 WIB

### 11.2 Agenda Rapat (Urutan Eksekusi)

#### 📊 Sesi 1: Laporan Mingguan (07:00-07:05)
Analis Agent mempresentasikan:
- Total artikel terbit minggu lalu (per site)
- Artikel dengan performa terbaik (estimasi views/ranking)
- Artikel dengan performa terburuk
- Status semua API key (provider mana yang paling banyak terpakai)
- Prompt mana yang menghasilkan artikel dengan skor tertinggi
- Rata-rata skor E-E-A-T minggu lalu

#### 🔮 Sesi 2: Analisis Tren (07:05-07:10)
- Fetch Google Trends Indonesia (top rising queries)
- Identifikasi topik yang akan memuncak 3-7 hari ke depan
- Bandingkan dengan apa yang sudah pernah ditulis (avoid duplikasi)
- Identifikasi gap vs kompetitor

#### 📅 Sesi 3: Penyusunan Content Calendar (07:10-07:15)
Pemimpin Redaksi Agent menyusun:
- Topik untuk setiap site, setiap hari, selama 7 hari ke depan
- Mix: 60% topik trending, 30% evergreen, 10% update artikel lama
- Assign format konten (berita singkat/panjang/jurnal/dll)
- Set prioritas dan deadline

#### 📝 Output: Notulen Rapat
```
=== NOTULEN RAPAT REDAKSI ===
Senin, 28 Juli 2026 | 07:00 WIB

📊 RINGKASAN MINGGU LALU:
- Total artikel terbit: 187 artikel (8 site)
- Artikel terbaik: "Inflasi RI Turun..." (Site: Berita Ekonomi, est. 4.200 views)
- Rata-rata skor E-E-A-T: 83.4/100
- Provider paling efisien: Gemini (78% artikel, skor rata-rata 85)

🔮 PREDIKSI TREN MINGGU INI:
- Topik naik: pemilu kepala daerah (+340%), cuaca ekstrem (+210%)
- Topik stabil: teknologi AI, ekonomi digital
- Gap kompetitor: belum ada yang cover "regulasi AI terbaru Kemkominfo"

📅 CONTENT CALENDAR:
- Site A (Politik): 5 topik baru + 1 artikel lama di-update
- Site B (Teknologi): 4 topik baru + 2 jurnal review
- [dst...]

⚠️ CATATAN KHUSUS:
- Groq Key #2 dan #5 mendekati limit bulanan → tambah key baru
- Artikel tentang "harga BBM" perlu di-update dengan data terbaru

=== END RAPAT ===
```

---

## 12. FITUR INOVATIF

### 12.1 🔮 Prediksi Tren (Predictive, bukan Reactive)

**Cara Kerja**:
1. Ambil data Google Trends (rising queries) setiap 6 jam
2. Ambil data media sosial trending (Twitter/X Indonesia)
3. Analisis pola: topik apa yang biasanya trending 3-7 hari setelah sinyal awal?
4. Generate prediksi topik dengan confidence score
5. Artikel tentang topik prediksi dipublikasikan lebih awal dari kompetitor

**Keuntungan**: Saat topik benar-benar trending, artikel sudah terindeks dan punya authority lebih tinggi.

---

### 12.2 🧠 Persona Memory System

**Cara Kerja**:
Setiap site memiliki "memori" yang dibangun dari semua artikel yang sudah pernah ditulis:
- Gaya bahasa yang khas
- Topik yang sudah dicover (beserta sudut pandangnya)
- "Opini editorial" yang konsisten
- Narasi yang sedang dibangun secara jangka panjang

**Storage**: JSON terkompresi di database, di-load oleh Penulis Agent setiap kali menulis untuk site tersebut.

**Contoh**: Site A sudah 50 kali nulis tentang teknologi AI dari sudut pandang "skeptis tapi optimis" → artikel ke-51 otomatis mengikuti konsistensi ini tanpa perlu instruksi manual.

---

### 12.3 ♻️ Evergreen Update Engine

**Cara Kerja**:
Setiap minggu, Analis Agent scan semua artikel yang sudah > 30 hari:
1. Identifikasi artikel yang membahas topik yang masih relevan
2. Cek apakah ada informasi baru tentang topik tersebut
3. Jika ada: Reporter fetch info baru, Editor update artikel lama
4. Update tanggal artikel, tambah seksi "Update [tanggal]"
5. Re-submit ke Google Search Console untuk re-crawl

**Keuntungan**: Google menyukai konten yang diperbarui. Artikel yang sudah ranking bisa naik lebih tinggi. Biaya: hanya ~20% token dibanding menulis baru.

---

### 12.4 🕸️ Link Intelligence (Jaringan 8 Site)

**Cara Kerja**:
SEO Agent punya akses ke database semua artikel dari semua 8 site. Saat menulis artikel baru:
1. Cari artikel dari site yang sama yang relevan → internal link (boost dwell time)
2. Cari artikel dari site lain dalam jaringan yang relevan → cross-site link (boost domain authority)
3. Link antar site menggunakan anchor text yang bervariasi (tidak repetitif)

**Catatan**: Jaringan ini dikelola agar tidak terlihat seperti link farm — hanya link jika benar-benar relevan konteksnya.

---

### 12.5 🎯 Gap Analysis Kompetitor

**Cara Kerja**:
Setiap Senin, sebelum Rapat:
1. Sistem identifikasi 5-10 kompetitor per niche dari setiap site
2. Fetch sitemap atau RSS kompetitor
3. Bandingkan topik mereka dengan topik yang sudah dicover site kita
4. Identifikasi: topik yang belum ada di mana-mana (blue ocean), atau topik yang ada tapi kualitasnya rendah
5. Masukkan ke content calendar sebagai prioritas "Gap Opportunity"

---

### 12.6 📊 Prompt Evolution System

**Cara Kerja**:
- Setiap artikel disimpan dengan metadata "prompt version" yang digunakan
- Analis Agent setiap minggu korelasikan prompt version dengan skor artikel
- Prompt yang menghasilkan skor tertinggi → ditandai sebagai "Champion"
- Prompt baru sesekali diuji (A/B testing 10% traffic)
- Secara bertahap, seluruh sistem bergeser ke prompt yang terbukti lebih baik

---

### 12.7 ⏰ Waktu Emas Cerdas (Smart Timing)

**Default Schedule per Kategori**:
| Kategori | Waktu Optimal Publish |
|---|---|
| Berita Politik/Breaking | 06:00-07:30 (sebelum orang mulai kerja) |
| Bisnis & Ekonomi | 07:30-09:00 (saat perjalanan kerja) |
| Teknologi | 10:00-12:00 (mid-morning browse) |
| Kesehatan | 11:00-13:00 (istirahat makan siang) |
| Gaya Hidup | 12:00-14:00 atau 20:00-22:00 |
| Akademik/Jurnal | 09:00-11:00 (jam produktif) |
| Olahraga | 07:00-09:00 atau 19:00-21:00 |

**Catatan**: Sistem belajar dari data aktual dan menyesuaikan jadwal per site secara otomatis setelah 30 hari data terkumpul.

---

### 12.8 🎭 Multi-Format dari Satu Riset

Satu sesi riset menghasilkan:
1. **Artikel Utama** (panjang, untuk SEO utama)
2. **Versi FAQ** (format tanya-jawab, untuk Featured Snippet Google)
3. **Ringkasan "Key Takeaways"** (boks di atas artikel, untuk dwell time)
4. **Caption Media Sosial** (untuk distribusi, 280 karakter)

Biaya token untuk 4 format ≈ hanya 1.5x biaya artikel tunggal (karena riset sama).

---

### 12.9 📋 Human Review Queue (Opsional)

Untuk artikel dengan topik sensitif atau skor E-E-A-T di bawah threshold:
- Artikel masuk ke status "Pending Review" alih-alih auto-publish
- Admin mendapat notifikasi di dashboard
- Admin bisa: Approve langsung, Edit dulu, atau Reject
- Artikel yang di-approve masuk ke queue publish normal

---

## 13. MULTI-SITE MANAGEMENT

### 13.1 Profil Per Site

Setiap site memiliki profil yang bisa dikonfigurasi:

```json
{
  "id": "uuid",
  "name": "Berita Teknologi Indonesia",
  "url": "https://teknologiindo.com",
  "wordpress_api_url": "https://teknologiindo.com/wp-json/wp/v2",
  "wordpress_username": "admin",
  "wordpress_app_password": "encrypted",
  "niche": "teknologi",
  "language": "id",
  "categories": ["teknologi", "AI", "gadget", "startup"],
  "posting_schedule": {
    "articles_per_day": 4,
    "time_slots": ["07:00", "10:00", "14:00", "19:00"],
    "random_delay_minutes": 30
  },
  "content_format": "berita",
  "citation_style": "ieee",
  "preferred_providers": ["gemini", "groq"],
  "human_review_required": false,
  "seo_plugin": "yoast",
  "default_author": "Tim Redaksi",
  "persona_description": "Media teknologi dengan pendekatan edukatif, bahasa lugas, target pembaca mahasiswa dan profesional muda",
  "competitor_sites": ["tekno.kompas.com", "detik.com/inet"],
  "status": "active"
}
```

### 13.2 Dashboard Multi-Site View

- Tabel overview semua 8 site: status, artikel hari ini, queue, last publish
- Klik site → masuk ke detail site tersebut
- Filter dan sort semua artikel lintas site
- Bulk actions: pause site, change schedule, update prompt

---

## 14. SEO & ANTI-AI DETECTION

### 14.1 On-Page SEO Checklist (per Artikel)
- [ ] Keyword utama di judul (H1)
- [ ] Keyword di paragraf pertama
- [ ] Keyword di minimal 1 subjudul (H2)
- [ ] Meta title 50-60 karakter
- [ ] Meta description 150-160 karakter, mengandung keyword + CTA
- [ ] URL slug pendek, mengandung keyword, tanpa stop word
- [ ] Alt text gambar mengandung keyword
- [ ] Internal link minimal 2 (ke artikel relevan site yang sama)
- [ ] External link minimal 1 (ke sumber otoritatif)
- [ ] Schema markup Article/NewsArticle/ScholarlyArticle
- [ ] Keyword density 1-2% (tidak over-optimized)
- [ ] LSI keywords tersebar natural di seluruh teks
- [ ] FAQ schema jika format FAQ (untuk featured snippet)

### 14.2 Humanizer Layer

Teknik yang diterapkan Editor Agent untuk menghindari deteksi AI:

**Level 1 — Struktur**:
- Variasi panjang paragraf (tidak semua sama)
- Variasi panjang kalimat (mix pendek 5-10 kata dan panjang 15-25 kata)
- Sesekali mulai kalimat dengan konjungsi (tapi, namun, bahkan)

**Level 2 — Bahasa**:
- Idiom dan ungkapan khas Indonesia yang natural
- Variasi sinonim, tidak repetitif
- Sesekali gunakan kalimat tanya retoris
- Pendapat/analisis subjektif yang terasa genuine

**Level 3 — Konten**:
- Tambahkan anekdot atau contoh lokal yang spesifik
- Referensi pada peristiwa nyata yang konkret (bukan general)
- "Kesimpulan yang tidak terduga" — tidak selalu berakhir positif
- Sesekali akui ketidakpastian atau kompleksitas isu

**Level 4 — Timing**:
- Tidak publish tepat di angka bulat (bukan jam 08:00:00, tapi 08:17:43)
- Interval antar artikel tidak persis sama

### 14.3 E-E-A-T Compliance
- Setiap artikel punya minimal 2 sumber yang dapat diverifikasi
- Author page (bisa dibuat otomatis per site)
- Tanggal publish dan update yang jelas
- Kontak dan about page di site (harus disiapkan manual oleh pemilik site)

---

## 15. WORDPRESS INTEGRATION

### 15.1 Fitur yang Digunakan via REST API
- `POST /wp/v2/posts` — membuat artikel baru
- `POST /wp/v2/media` — upload gambar
- `GET /wp/v2/categories` — ambil daftar kategori
- `POST /wp/v2/tags` — buat tag baru jika belum ada
- Yoast SEO / RankMath API — set meta SEO
- WP Application Passwords untuk autentikasi aman

### 15.2 Data yang Dikirim ke WordPress
```json
{
  "title": "Judul Artikel",
  "content": "<p>Konten HTML...</p>",
  "status": "publish",
  "date": "2026-07-28T07:17:43",
  "categories": [5, 12],
  "tags": [23, 45, 67],
  "featured_media": 890,
  "meta": {
    "_yoast_wpseo_title": "Meta Title SEO",
    "_yoast_wpseo_metadesc": "Meta description...",
    "_yoast_wpseo_focuskw": "keyword utama"
  },
  "schema_markup": "{...JSON-LD...}"
}
```

### 15.3 Error Handling
- Timeout > 30 detik → retry
- 401 Unauthorized → alert + pause site
- 500 Server Error → retry 3x, lalu masuk dead letter queue
- Rate limit WordPress → slow down dengan adaptive delay

---

## 16. DASHBOARD & MONITORING

### 16.1 Halaman Utama (Overview)
- Total artikel terbit hari ini (semua site)
- Queue artikel menunggu publish
- Status semua API key (grafik usage per provider)
- Alert aktif (key hampir habis, error, dll)
- Activity log real-time (5 aktivitas terbaru)
- Mini-chart: produksi artikel 7 hari terakhir

### 16.2 Halaman Sites
- Daftar 8 site dengan status aktif/pause
- Per site: artikel hari ini, queue, jadwal berikutnya
- Tombol: Edit config, Pause, Force run

### 16.3 Halaman API Keys
- Tabel semua key per provider
- Usage bar (visual persentase limit)
- Status: Active / Degraded / Exhausted / Error
- Add new key, Delete key, Pause key
- Estimasi kapan key reset

### 16.4 Halaman Articles
- Tabel semua artikel (filter per site, status, tanggal)
- Status: Writing / Editing / QC / Imaging / SEO / Scheduled / Published / Failed
- Klik artikel → lihat full content, skor E-E-A-T, log proses
- Tombol: Force publish, Move to draft, Regenerate, Delete

### 16.5 Halaman Queue
- Visualisasi pipeline: berapa artikel di setiap stage
- Log per job: waktu mulai, waktu selesai, error jika ada
- Dead letter queue: artikel yang gagal total

### 16.6 Halaman Rapat Redaksi
- Notulen rapat minggu ini (dan archive minggu lalu)
- Content calendar visual (7 hari ke depan, per site)
- Prediksi tren minggu ini dengan confidence score
- Tombol: Regenerate rapat, Override manual topic

### 16.7 Halaman Analytics
- Grafik produksi artikel per hari/minggu/bulan
- Top performing articles
- Provider LLM performance comparison
- Prompt evolution: versi mana yang terbaik
- Evergreen candidates: artikel yang perlu di-update

### 16.8 Halaman Settings
- Global settings: bahasa default, format default, timezone
- Humanizer level (1-4)
- Alert thresholds
- Human review toggle per site
- Backup & export data

---

## 17. DATABASE SCHEMA

### Tabel Utama

```sql
-- Manajemen Site WordPress
CREATE TABLE sites (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  niche VARCHAR(100),
  status VARCHAR(50) DEFAULT 'active',
  config JSONB,           -- semua config site
  persona_memory TEXT,    -- ingatan kumulatif gaya penulisan
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pool API Key Multi-Provider
CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  provider VARCHAR(100) NOT NULL,
  label VARCHAR(255),
  key_encrypted TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  usage_today INTEGER DEFAULT 0,
  usage_this_month INTEGER DEFAULT 0,
  daily_limit INTEGER,
  monthly_limit INTEGER,
  last_used_at TIMESTAMPTZ,
  reset_at TIMESTAMPTZ,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sumber Berita
CREATE TABLE sources (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  type VARCHAR(50),        -- rss, api, scrape
  categories TEXT[],       -- kategori yang didukung
  credibility_score FLOAT, -- 1-10
  is_active BOOLEAN DEFAULT true,
  last_fetched_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Artikel
CREATE TABLE articles (
  id UUID PRIMARY KEY,
  site_id UUID REFERENCES sites(id),
  title TEXT,
  content TEXT,
  content_versions JSONB,  -- semua 4 format output
  status VARCHAR(50),      -- writing/editing/qc/imaging/seo/scheduled/published/failed
  format VARCHAR(50),      -- berita/jurnal/feature/listicle/faq/evergreen
  category VARCHAR(100),
  tags TEXT[],
  source_urls TEXT[],
  brief_data JSONB,
  seo_data JSONB,
  image_data JSONB,
  schema_markup TEXT,
  quality_score FLOAT,
  eeat_score FLOAT,
  prompt_version VARCHAR(50),
  provider_used VARCHAR(100),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  wordpress_post_id INTEGER,
  wordpress_url TEXT,
  is_evergreen_candidate BOOLEAN DEFAULT false,
  last_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job Queue
CREATE TABLE job_queue (
  id UUID PRIMARY KEY,
  article_id UUID REFERENCES articles(id),
  job_type VARCHAR(100),   -- research/write/edit/qc/image/seo/publish
  status VARCHAR(50),      -- pending/processing/done/failed/retry
  priority VARCHAR(50) DEFAULT 'normal',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  payload JSONB,
  error_message TEXT,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content Calendar
CREATE TABLE content_calendar (
  id UUID PRIMARY KEY,
  site_id UUID REFERENCES sites(id),
  topic TEXT NOT NULL,
  category VARCHAR(100),
  format VARCHAR(50),
  priority VARCHAR(50),
  scheduled_date DATE,
  status VARCHAR(50) DEFAULT 'planned',  -- planned/assigned/done
  rapat_session_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notulen Rapat Redaksi
CREATE TABLE rapat_notes (
  id UUID PRIMARY KEY,
  session_date DATE NOT NULL,
  summary TEXT,
  trend_data JSONB,
  performance_report JSONB,
  recommendations JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage Stats (untuk analytics)
CREATE TABLE usage_stats (
  id UUID PRIMARY KEY,
  date DATE NOT NULL,
  site_id UUID REFERENCES sites(id),
  api_key_id UUID REFERENCES api_keys(id),
  articles_generated INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  images_generated INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  avg_quality_score FLOAT,
  avg_eeat_score FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log Sistem
CREATE TABLE system_logs (
  id UUID PRIMARY KEY,
  level VARCHAR(50),       -- info/warn/error/critical
  agent VARCHAR(100),      -- agent mana yang log ini
  message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prompt Versions (untuk Prompt Evolution)
CREATE TABLE prompt_versions (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  agent_type VARCHAR(100),
  category VARCHAR(100),
  prompt_template TEXT,
  performance_score FLOAT,
  sample_count INTEGER DEFAULT 0,
  is_champion BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Competitor Data
CREATE TABLE competitor_data (
  id UUID PRIMARY KEY,
  site_id UUID REFERENCES sites(id),
  competitor_url TEXT,
  topics_covered TEXT[],
  last_checked_at TIMESTAMPTZ,
  gap_opportunities JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trend Predictions
CREATE TABLE trend_predictions (
  id UUID PRIMARY KEY,
  topic TEXT NOT NULL,
  category VARCHAR(100),
  confidence_score FLOAT,
  predicted_peak_date DATE,
  source_signals JSONB,
  status VARCHAR(50) DEFAULT 'predicted',  -- predicted/confirmed/missed
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 18. STACK TEKNOLOGI

### Backend
| Komponen | Teknologi | Alasan |
|---|---|---|
| Runtime | Node.js 20 LTS | Performa async, ekosistem luas |
| Framework | Express.js | Ringan, fleksibel |
| Database | PostgreSQL (Replit) | Built-in, reliable, SQL kuat |
| ORM | pg (native) + query builder | Kontrol penuh, performa |
| Scheduler | node-cron | Ringan, tidak butuh Redis |
| HTTP Client | axios | Robust, support retry |
| Encryption | crypto (built-in Node) | Enkripsi API key |

### Frontend
| Komponen | Teknologi | Alasan |
|---|---|---|
| Framework | React 18 | Komponen reusable, ekosistem |
| Build Tool | Vite | Cepat, HMR |
| UI Components | shadcn/ui + Tailwind | Modern, customizable |
| Charts | Recharts | Ringan, declarative |
| State | Zustand | Sederhana, efisien |
| HTTP | React Query | Caching, auto-refetch |

### LLM Providers
- Gemini API, Groq API, DeepSeek API, OpenRouter API
- Mistral AI, Together AI, Cerebras, Cohere, HuggingFace

### Image Providers
- Google Imagen 3, OpenAI DALL-E 3, Stability AI
- Unsplash API, Pexels API (fallback)

### WordPress Integration
- WordPress REST API v2
- Application Passwords (auth)
- Yoast SEO / RankMath (meta SEO)

---

## 19. KEAMANAN & PRIVASI

- Semua API key dienkripsi di database (AES-256)
- WordPress Application Password tidak disimpan plaintext
- Rate limiting pada semua endpoint API internal
- Input validation dan sanitasi sebelum semua query DB
- Log tidak menyimpan nilai API key (hanya label dan ID)
- Session-based auth untuk dashboard dengan SESSION_SECRET
- CORS dikonfigurasi ketat hanya untuk domain yang diizinkan

---

## 20. ROADMAP PENGEMBANGAN

### Fase 1 — Core System (Sekarang)
- [x] Database schema
- [ ] API Key Pool Manager
- [ ] LLM Router dengan rotasi
- [ ] Reporter Agent + Source Intelligence
- [ ] Penulis Agent + Standar Jurnalistik/Jurnal
- [ ] Editor Agent + Humanizer
- [ ] Quality Rater Simulator
- [ ] SEO Agent
- [ ] Publisher Agent (WordPress)
- [ ] Scheduler dasar
- [ ] Dashboard basic

### Fase 2 — Inovasi (Follow-up)
- [ ] Fotografer Agent + Image Generation
- [ ] Rapat Redaksi otomatis
- [ ] Persona Memory System
- [ ] Evergreen Update Engine
- [ ] Prediksi Tren
- [ ] Gap Analysis Kompetitor
- [ ] Prompt Evolution System
- [ ] Link Intelligence (antar 8 site)
- [ ] Waktu Emas cerdas
- [ ] Dashboard analytics lengkap

### Fase 3 — Optimasi (Jangka Panjang)
- [ ] Integrasi Google Search Console
- [ ] A/B testing artikel
- [ ] Mobile dashboard
- [ ] Telegram/Discord notifikasi
- [ ] Export laporan PDF

---

## 21. KRITERIA KEBERHASILAN (KPI)

### KPI Teknis
| Metrik | Target |
|---|---|
| Uptime sistem | > 99% |
| Artikel berhasil publish / total attempt | > 95% |
| Rata-rata skor E-E-A-T | > 80/100 |
| Artikel yang lolos Quality Gate pertama kali | > 70% |
| Waktu dari trigger ke publish | < 15 menit |

### KPI Konten
| Metrik | Target |
|---|---|
| Artikel per hari (total 8 site) | > 24 artikel |
| Artikel lolos review AdSense | 100% |
| Artikel yang reach halaman 1 Google dalam 30 hari | > 30% |
| Artikel terdeteksi AI oleh tools populer | < 5% |

### KPI Efisiensi
| Metrik | Target |
|---|---|
| Biaya LLM per 100 artikel | < $5 (dengan free tier pool) |
| Intervensi manual per minggu | < 2 jam |
| Key yang exhaust sebelum rotasi | 0 kejadian |

---

*PRD ini bersifat living document — akan diperbarui seiring pengembangan sistem.*

**Versi**: 1.0.0 | **Status**: Approved for Development
