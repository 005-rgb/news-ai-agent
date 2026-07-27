# PRD — News AI Agent System
## Product Requirements Document (Superdetail)
**Versi**: 2.0.0  
**Tanggal**: Juli 2026  
**Status**: Approved for Development — Build Phases Integrated  
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
20. [Rencana Pembangunan Bertahap (Build Phases)](#20-rencana-pembangunan-bertahap-build-phases)
    - [Filosofi Pembangunan](#filosofi-pembangunan)
    - [Fase 0 — Foundation & Infrastructure](#fase-0--foundation--infrastructure)
    - [Fase 1 — API Key Pool Manager](#fase-1--api-key-pool-manager)
    - [Fase 2 — Source Intelligence](#fase-2--source-intelligence)
    - [Fase 3 — Content Pipeline Core](#fase-3--content-pipeline-core)
    - [Fase 4 — Writing Standards Engine](#fase-4--writing-standards-engine)
    - [Fase 5 — Fotografer Agent & WordPress Publisher](#fase-5--fotografer-agent--wordpress-publisher)
    - [Fase 6 — Scheduler & Full Automation](#fase-6--scheduler--full-automation)
    - [Fase 7 — Dashboard Full](#fase-7--dashboard-full)
    - [Fase 8 — Quality & Humanizer Engine](#fase-8--quality--humanizer-engine)
    - [Fase 9 — Rapat Redaksi Engine](#fase-9--rapat-redaksi-engine)
    - [Fase 10 — Innovation Layer](#fase-10--innovation-layer)
    - [Fase 11 — Hardening & Production Ready](#fase-11--hardening--production-ready)
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

## 20. RENCANA PEMBANGUNAN BERTAHAP (BUILD PHASES)

> **Prinsip**: Setiap modul yang dibangun = real, full-featured, fully integrated. Tidak ada placeholder, tidak ada dummy data, tidak ada tombol yang hanya hiasan.

---

### Filosofi Pembangunan

```
Urutan prioritas mutlak:
1. Foundation dulu       → tanpa fondasi kuat, semua di atas akan rapuh
2. Core pipeline         → jantung sistem harus berdetak sebelum fitur lain
3. Intelligence layer    → sistem mulai "cerdas" setelah pipeline stabil
4. Dashboard             → bisa monitor setelah ada yang perlu dimonitor
5. Innovation layer      → fitur diferensiasi setelah sistem stabil
6. Hardening             → produksi-ready: logging, error handling, alerting
```

**Aturan kualitas yang tidak bisa dikompromikan**:
- Setiap fase harus **fully working** sebelum fase berikutnya dimulai
- Setiap API call harus punya **error handling nyata** — bukan `console.log`
- Setiap data sensitif harus **terenkripsi** sebelum masuk database
- Setiap fitur harus **bisa diuji langsung dari dashboard** — bukan hanya dari kode

---

### Ringkasan 12 Fase

| Fase | Nama | Kompleksitas | Output Utama |
|---|---|---|---|
| **0** | Foundation & Infrastructure | Sedang | DB, server, auth, enkripsi, config |
| **1** | API Key Pool Manager | Tinggi | Multi-provider key rotation real |
| **2** | Source Intelligence | Tinggi | RSS/API/scrape semua kategori |
| **3** | Content Pipeline Core | Sangat Tinggi | 7 agent berjalan end-to-end |
| **4** | Writing Standards Engine | Tinggi | Standar jurnalistik + jurnal di AI |
| **5** | Fotografer Agent & Publisher | Tinggi | Gambar presisi + publish nyata ke WP |
| **6** | Scheduler & Full Automation | Sedang | Auto-run 24/7 tanpa intervensi |
| **7** | Dashboard Full | Tinggi | Semua 9 halaman real dan functional |
| **8** | Quality & Humanizer Engine | Tinggi | E-E-A-T checker + anti-AI detection |
| **9** | Rapat Redaksi Engine | Tinggi | Otomasi rapat mingguan penuh |
| **10** | Innovation Layer | Sangat Tinggi | Prediksi tren, evergreen, link intel |
| **11** | Hardening & Production | Sedang | Logging, alerting, monitoring penuh |

---

### Urutan Build Mutlak

```
FASE 0 (Foundation)
  └→ FASE 1 (Key Pool)
       └→ FASE 2 (Sources)
            └→ FASE 3 (Pipeline Core) ←─┐
                 └→ FASE 4 (Writing)  ──┘ parallel
                      └→ FASE 5 (Image + Publisher)
                           └→ FASE 6 (Scheduler)
                                └→ FASE 7 (Dashboard) ← sebagian bisa parallel
                                     └→ FASE 8 (Quality/Humanizer)
                                          └→ FASE 9 (Rapat Redaksi)
                                               └→ FASE 10 (Innovation)
                                                    └→ FASE 11 (Hardening)
```

**Milestone demo**:
- ✅ Selesai Fase 3 → artikel draft dihasilkan otomatis dari topik
- ✅ Selesai Fase 5 → artikel terbit nyata di WordPress
- ✅ Selesai Fase 7 → dashboard penuh, semua terkontrol dari UI
- ✅ Selesai Fase 9 → sistem mandiri penuh, rapat mingguan otomatis
- ✅ Selesai Fase 11 → production-ready, siap deploy

---

## ══════════════════════════════════════════════════
## FASE 0 — FOUNDATION & INFRASTRUCTURE
## ══════════════════════════════════════════════════

**Tujuan**: Fondasi sistem yang kokoh. Semua fase berikutnya dibangun di atas ini.  
**Prasyarat**: Tidak ada — ini titik awal.

---

### Step 0.1 — Project Structure Setup

Struktur folder yang ditetapkan sejak awal dan tidak berubah selama pembangunan:

```
news-ai-agent/
├── server/
│   ├── index.js                    # Entry point Express
│   ├── db.js                       # PostgreSQL connection pool
│   ├── middleware/
│   │   ├── auth.js                 # Session auth middleware
│   │   ├── rateLimiter.js          # Rate limiting per endpoint
│   │   └── errorHandler.js         # Global error handler — semua error → JSON konsisten
│   ├── routes/
│   │   ├── auth.js                 # Login, logout
│   │   ├── sites.js                # CRUD WordPress sites
│   │   ├── apiKeys.js              # CRUD + test API keys
│   │   ├── sources.js              # CRUD + test sumber berita
│   │   ├── articles.js             # CRUD + aksi artikel
│   │   ├── queue.js                # Monitor + kontrol job queue
│   │   ├── calendar.js             # Content calendar
│   │   ├── rapat.js                # Rapat redaksi + notulen
│   │   ├── analytics.js            # Statistik & laporan
│   │   └── settings.js             # Global settings
│   ├── agents/
│   │   ├── base.js                 # Agent base class
│   │   ├── reporter.js             # Reporter/Peneliti Agent
│   │   ├── writer.js               # Penulis Agent
│   │   ├── editor.js               # Editor Agent
│   │   ├── qualityRater.js         # Quality Rater Simulator
│   │   ├── photographer.js         # Fotografer Agent
│   │   ├── seoSpecialist.js        # SEO Specialist Agent
│   │   ├── publisher.js            # Publisher Agent
│   │   ├── analyst.js              # Analis Agent
│   │   └── chiefEditor.js          # Pemimpin Redaksi Agent
│   ├── services/
│   │   ├── keyPool.js              # Key Pool Manager
│   │   ├── llmRouter.js            # LLM Router abstraksi
│   │   ├── jobQueue.js             # Job queue processor
│   │   ├── scheduler.js            # Cron scheduler
│   │   ├── pipeline.js             # Pipeline orchestrator
│   │   ├── wordpress.js            # WordPress API client
│   │   ├── fetchers/
│   │   │   ├── rss.js              # RSS fetcher
│   │   │   ├── academic.js         # PubMed, arXiv, Semantic Scholar
│   │   │   └── scraper.js          # Web scraper fallback
│   │   ├── images/
│   │   │   ├── generator.js        # AI image generation
│   │   │   └── stock.js            # Unsplash + Pexels
│   │   └── trends.js               # Google Trends fetcher
│   ├── utils/
│   │   ├── encryption.js           # AES-256-GCM encrypt/decrypt
│   │   ├── humanizer.js            # Humanizer layer 1-4
│   │   ├── seoFormatter.js         # HTML formatter + schema markup
│   │   ├── similarity.js           # Keyword similarity check
│   │   └── logger.js               # Logging utility ke DB
│   └── config/
│       ├── index.js                # Config loader + validasi
│       ├── providers.js            # LLM provider definitions
│       └── promptTemplates.js      # Semua template prompt
├── client/
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Overview.jsx
│       │   ├── Sites.jsx
│       │   ├── ApiKeys.jsx
│       │   ├── Sources.jsx
│       │   ├── Articles.jsx
│       │   ├── Queue.jsx
│       │   ├── Rapat.jsx
│       │   ├── Analytics.jsx
│       │   └── Settings.jsx
│       ├── components/             # Komponen reusable UI
│       ├── hooks/                  # Custom React hooks
│       ├── store/                  # Zustand global state
│       └── lib/
│           ├── api.js              # Axios API client
│           └── utils.js
├── docs/
│   ├── PRD-NewsAIAgent.md          # Dokumen ini
│   └── BUILD-PHASES.md             # Versi standalone build phases
├── package.json                    # Semua dependency backend + scripts
├── vite.config.js                  # Vite config (proxy /api → Express)
└── replit.md                       # Cara menjalankan sistem
```

**Output yang bisa diverifikasi**: Seluruh folder dan file placeholder terbentuk, `package.json` lengkap dengan semua dependency yang dibutuhkan seluruh 11 fase.

---

### Step 0.2 — Database Schema (Full — Semua Tabel Sekaligus)

Jalankan seluruh DDL dalam satu transaksi. Tidak ada tabel yang dibuat bertahap — semua dibuat di Fase 0 agar relasi antar tabel konsisten sejak awal.

Tabel yang dibuat:

| Tabel | Fungsi |
|---|---|
| `sites` | Profil 8 WordPress site + persona memory |
| `api_keys` | Pool key semua LLM provider, terenkripsi |
| `sources` | Sumber berita per kategori dengan credibility score |
| `articles` | Semua artikel dengan semua metadata pipeline |
| `job_queue` | Antrian job setiap stage pipeline |
| `content_calendar` | Rencana konten 7 hari ke depan per site |
| `rapat_notes` | Notulen rapat redaksi mingguan |
| `usage_stats` | Statistik harian per site dan per provider |
| `system_logs` | Log semua aktivitas agent dengan level dan metadata |
| `prompt_versions` | Versi prompt + skor performa (Prompt Evolution) |
| `competitor_data` | Data kompetitor dan gap opportunities per site |
| `trend_predictions` | Prediksi topik trending dengan confidence score |

Index yang dibuat bersamaan: semua kolom yang dipakai `WHERE`, `ORDER BY`, dan `JOIN` di query-query utama.

**Output**: Database fully migrated. `SELECT * FROM information_schema.tables` menunjukkan 12 tabel.

---

### Step 0.3 — Express Server Base

- Server berjalan di **port 5000**
- Middleware stack (urutan penting):
  1. `helmet` — security headers
  2. `cors` — hanya izinkan origin yang dikonfigurasi
  3. `compression` — gzip response
  4. `express.json({ limit: '2mb' })` — body parser
  5. `express-session` — session dengan SESSION_SECRET
  6. `rateLimiter` — global rate limit
  7. Routes `/api/v1/...`
  8. `errorHandler` — global error handler paling akhir
- Health check: `GET /api/v1/health` → cek koneksi DB, return status + versi
- Static: serve `client/dist/` untuk production React build
- Semua error response: `{ success: false, error: { code, message, details? } }`

**Output**: `curl http://localhost:5000/api/v1/health` return `{ success: true, db: "connected" }`.

---

### Step 0.4 — Authentication System

- Admin credentials disimpan di environment variables (`ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`)
- Password di-hash dengan `bcrypt` (cost factor 12)
- Session-based: login → set `req.session.userId` → semua route `/api/v1/*` cek session
- Endpoint:
  - `POST /api/v1/auth/login` — verifikasi credential, set session
  - `POST /api/v1/auth/logout` — destroy session
  - `GET /api/v1/auth/me` — cek status login (untuk frontend)
- Frontend: halaman `/login`, auto-redirect ke `/` jika session aktif, redirect ke `/login` jika tidak

**Output**: Semua endpoint `/api/v1/*` (kecuali `/auth/login`) return `401` jika tidak ada session aktif. Tidak ada bypass.

---

### Step 0.5 — Encryption Utility

Modul `server/utils/encryption.js`:

```
encrypt(plaintext)  →  { iv, ciphertext, authTag }  →  disimpan sebagai string JSON
decrypt(stored)     →  plaintext asli
```

- Algoritma: AES-256-GCM (authenticated encryption — deteksi tampering)
- Key enkripsi: dari env variable `ENCRYPTION_KEY` (32 byte hex)
- Digunakan oleh: `keyPool.js` saat simpan/baca API key, `sites.js` saat simpan WP credentials
- Nilai terenkripsi tidak pernah di-log bahkan sebagai error message

**Output**: Unit test enkripsi/dekripsi pass. Nilai di kolom `key_encrypted` di DB tidak terbaca sebagai plaintext.

---

### Step 0.6 — Configuration Manager

Modul `server/config/index.js`:

- Load semua env variables saat startup
- **Validasi wajib** — server tidak bisa start jika env ini kosong:
  - `SESSION_SECRET`, `ENCRYPTION_KEY`, `DATABASE_URL`
- Default values untuk semua optional config:
  - `TIMEZONE`: `Asia/Jakarta`
  - `QUALITY_SCORE_THRESHOLD`: `75`
  - `EEAT_SCORE_THRESHOLD`: `80`
  - `HUMANIZER_LEVEL`: `3`
  - `KEY_WARNING_THRESHOLD`: `80` (persen)
  - `JOB_WORKER_INTERVAL_MS`: `30000`
  - `WATCHDOG_INTERVAL_MS`: `300000`
- Export satu object `config` yang di-import semua modul lain

**Output**: Jika env kritis tidak diset, server exit dengan pesan jelas: `"Missing required env: ENCRYPTION_KEY"`. Zero `undefined` error di runtime.

---

## ══════════════════════════════════════════════════
## FASE 1 — API KEY POOL MANAGER
## ══════════════════════════════════════════════════

**Tujuan**: Jantung ekonomi sistem. Tanpa ini, tidak ada LLM yang bisa dipanggil.  
**Prasyarat**: Fase 0 selesai.

---

### Step 1.1 — Key CRUD API

Endpoint REST lengkap di `server/routes/apiKeys.js`:

| Method | Endpoint | Fungsi |
|---|---|---|
| `GET` | `/api/v1/keys` | List semua key — nilai key **TIDAK** ditampilkan, hanya label + metadata |
| `POST` | `/api/v1/keys` | Tambah key baru — enkripsi nilai sebelum simpan |
| `PATCH` | `/api/v1/keys/:id` | Update label, status, limit override |
| `DELETE` | `/api/v1/keys/:id` | Hapus key — dengan konfirmasi `{ confirm: true }` di body |
| `POST` | `/api/v1/keys/:id/test` | **Test koneksi real** — panggil provider dengan prompt minimal, return latency + status |
| `GET` | `/api/v1/keys/alerts` | Semua alert aktif dengan severity |

**Output**: CRUD berjalan. Test endpoint benar-benar memanggil API provider. Key tersimpan terenkripsi.

---

### Step 1.2 — Usage Tracker

Di `server/services/keyPool.js`:

- Fungsi `recordUsage(keyId, tokensUsed)`:
  - Increment `usage_today` dan `usage_this_month` di DB
  - Update `last_used_at`
- Cron job tengah malam: reset `usage_today` semua key
- Hitung `freshness_score` saat query, tidak disimpan di DB (volatile):
  ```
  freshness_score = (1 - usage_today / daily_limit) × 0.6
                  + (hours_since_last_used / 24) × 0.4
  ```
  Makin jarang dipakai dan makin jauh dari limit → skor makin tinggi → diprioritaskan.
- Deteksi `reset_at` per provider (logika reset: Gemini = tengah malam UTC, Groq = rolling 24h, dll)

**Output**: Setiap kali LLM dipanggil, usage terupdate akurat di DB.

---

### Step 1.3 — Smart Rotation Engine

Fungsi utama: `selectBestKey(options?: { provider?, category? })`

Logika seleksi (berurutan):
1. Ambil semua key dengan `status = 'active'`
2. Filter: `usage_today < daily_limit × 0.85` (buffer 15% untuk safety)
3. Jika `options.provider` diisi: filter hanya provider tersebut
4. Hitung `freshness_score` untuk setiap key yang lolos filter
5. Return key dengan `freshness_score` tertinggi
6. Jika tidak ada key yang lolos: coba provider berikutnya dalam fallback chain
7. Jika semua provider exhausted: throw `KeyPoolExhaustedError` dengan detail (provider mana yang exhausted, kapan reset)

Fallback chain default (bisa dikonfigurasi di Settings):
```
Gemini → Groq → DeepSeek → OpenRouter → Mistral → Together → Cerebras → Cohere
```

**Output**: Tidak pernah ada error 429 karena memakai key yang sudah habis.

---

### Step 1.4 — LLM Router (Abstraksi Semua Provider)

Fungsi publik: `callLLM(prompt, options?)` di `server/services/llmRouter.js`

`options` yang didukung:
```json
{
  "provider": "gemini",        // opsional — paksa provider tertentu
  "model": "gemini-1.5-flash", // opsional — override model default
  "maxTokens": 2000,           // opsional — default 2000
  "temperature": 0.7,          // opsional — default 0.7
  "category": "akademik"       // opsional — untuk key selection hint
}
```

Return standar dari semua provider:
```json
{
  "text": "...",            // teks output
  "tokensUsed": 1240,       // total token input + output
  "provider": "gemini",     // provider yang dipakai
  "model": "gemini-1.5-flash",
  "latencyMs": 1820
}
```

**8 Provider yang diimplementasi** (semua real, semua dengan adapter):

| Provider | Endpoint / SDK | Model Default |
|---|---|---|
| **Gemini** | `@google/generative-ai` SDK | `gemini-1.5-flash` |
| **Groq** | REST `https://api.groq.com/openai/v1/chat/completions` | `llama-3.3-70b-versatile` |
| **DeepSeek** | REST `https://api.deepseek.com/v1/chat/completions` (OpenAI-compatible) | `deepseek-chat` |
| **OpenRouter** | REST `https://openrouter.ai/api/v1/chat/completions` | `meta-llama/llama-3.1-70b-instruct:free` |
| **Mistral** | REST `https://api.mistral.ai/v1/chat/completions` | `mistral-small-latest` |
| **Together AI** | REST `https://api.together.xyz/v1/chat/completions` | `meta-llama/Llama-3-70b-chat-hf` |
| **Cerebras** | REST `https://api.cerebras.ai/v1/chat/completions` | `llama3.1-70b` |
| **Cohere** | REST `https://api.cohere.ai/v1/chat` | `command-r` |

Setiap adapter menangani:
- Request format normalization (setiap provider punya format berbeda)
- Response parsing dan normalization ke format standar
- Timeout: 60 detik maksimum
- Error classification: `rate_limit` / `auth_error` / `server_error` / `network_error` / `context_length_exceeded`
- Token usage extraction (nama field berbeda per provider)

**Output**: `await callLLM("Tulis artikel tentang X")` bekerja tanpa tahu provider mana yang aktif.

---

### Step 1.5 — Alert System untuk Key Pool

- Setiap kali `recordUsage()` dipanggil, cek threshold:
  - `usage_today / daily_limit ≥ 0.80` → set `status = 'warning'`, log ke `system_logs` level `warn`
  - `usage_today / daily_limit ≥ 0.95` → set `status = 'critical'`, log level `error`
  - `usage_today / daily_limit ≥ 1.00` → set `status = 'exhausted'`, log level `error`
- `GET /api/v1/keys/alerts` query `system_logs` untuk alert 24 jam terakhir, return terformat
- Error count tracker: setiap kali key return error, increment `error_count`. Jika `error_count > 10` dalam 1 jam → auto-pause key + log `critical`

**Output**: Dashboard selalu tahu kondisi semua key secara real-time.

---

## ══════════════════════════════════════════════════
## FASE 2 — SOURCE INTELLIGENCE
## ══════════════════════════════════════════════════

**Tujuan**: Sistem harus tahu dari mana mencari referensi sesuai kategori konten.  
**Prasyarat**: Fase 0 selesai.

---

### Step 2.1 — Source Database Population (Seed Data)

Populate tabel `sources` dengan semua sumber dari PRD Bab 7. Data ini adalah **seed default** yang aktif langsung setelah Fase 0:

- **9 kategori** dengan masing-masing 4–10 sumber
- Setiap record: `name`, `url`, `rss_url`, `type` (`rss`/`api`/`scrape`), `categories[]`, `credibility_score`, `fetch_interval_minutes`, `css_selectors` (untuk scraper)
- Credibility score awal ditetapkan manual berdasarkan reputasi sumber

Contoh seed untuk kategori Akademik:
```json
[
  { "name": "PubMed", "url": "https://pubmed.ncbi.nlm.nih.gov", "type": "api", "credibility_score": 9.8 },
  { "name": "arXiv", "url": "https://arxiv.org", "rss_url": "https://arxiv.org/rss/", "type": "rss", "credibility_score": 9.2 },
  { "name": "Semantic Scholar", "url": "https://api.semanticscholar.org", "type": "api", "credibility_score": 8.9 },
  { "name": "SINTA Kemdikbud", "url": "https://sinta.kemdikbud.go.id", "type": "scrape", "credibility_score": 9.0 },
  { "name": "Garuda Portal", "url": "https://garuda.kemdikbud.go.id", "type": "scrape", "credibility_score": 8.7 }
]
```

**Output**: `SELECT count(*) FROM sources` return ≥ 60 record.

---

### Step 2.2 — RSS Fetcher

Modul `server/services/fetchers/rss.js`:

- Library: `rss-parser`
- Fungsi: `fetchRSS(sourceUrl, options?)` → return array item:
  ```json
  {
    "title": "...",
    "link": "...",
    "pubDate": "ISO8601",
    "summary": "...",
    "content": "...",   // full content jika tersedia
    "author": "...",
    "categories": []
  }
  ```
- **Cache in-memory**: hasil fetch disimpan 30 menit per URL — tidak spam server sumber
- Error handling:
  - Timeout > 15 detik → throw `FetchTimeoutError`
  - Malformed XML → throw `MalformedRSSError` + log warning
  - HTTP 4xx/5xx → throw `SourceUnavailableError`
- Support redirect: ikuti redirect otomatis (max 3 hop)

Sumber RSS yang divalidasi berjalan:
`detik.com`, `kompas.com`, `tempo.co`, `antara.id`, `cnnindonesia.com`, `republika.co.id`, `bisnis.com`, `kontan.co.id`, `arXiv` (berbagai kategori)

**Output**: `fetchRSS('https://rss.detik.com/index.php/detikcom')` return array 20+ item tanpa error.

---

### Step 2.3 — API Fetcher (Sumber Akademik)

Modul `server/services/fetchers/academic.js` — fetcher khusus per provider:

**PubMed E-utilities** (gratis, tanpa key):
- `GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term={query}&retmax=10`
- Ambil PMID list → fetch abstrak via `efetch.fcgi`
- Return: judul, penulis, abstrak, doi, tahun, jurnal

**arXiv API v2** (gratis):
- `GET https://export.arxiv.org/api/query?search_query={query}&max_results=10`
- Parse XML Atom feed
- Return: judul, penulis, abstrak, arxiv_id, kategori, submitted_date

**Semantic Scholar** (gratis, 100 req/5min):
- `GET https://api.semanticscholar.org/graph/v1/paper/search?query={query}&fields=title,authors,abstract,year,citationCount`
- Return: judul, penulis, abstrak, tahun, jumlah sitasi (untuk credibility)

**Google Scholar** (scraping, rate-limited):
- Fetch `https://scholar.google.com/scholar?q={query}` dengan delay 5–10 detik antar request
- Parse hasil dengan `cheerio`
- Return: judul, link, snippet, tahun, penulis

**SINTA** (scraping):
- Fetch `https://sinta.kemdikbud.go.id/journals` dengan filter kategori
- Parse tabel jurnal yang terindeks

Semua fetcher return format standar yang sama persis dengan RSS fetcher.

**Output**: `fetchAcademic('pubmed', 'diabetes treatment Indonesia')` return array paper nyata.

---

### Step 2.4 — Web Scraper (Fallback)

Modul `server/services/fetchers/scraper.js`:

- Library: `cheerio` + `axios`
- Config per domain: CSS selectors untuk title, content, author, date (disimpan di DB di kolom `css_selectors` tabel `sources`)
- **Rate limiting**: minimum 5 detik antar request ke domain yang sama (per-domain queue)
- **Robots.txt check**: fetch dan parse `robots.txt` sebelum scraping. Jika `Disallow: /`, skip dan log warning
- User-Agent: `Mozilla/5.0 (compatible; NewsAIAgent/1.0; +https://yourdomain.com/bot)`
- Timeout: 20 detik
- Max content size: 500KB (truncate jika lebih)

**Output**: Sumber tanpa RSS (contoh: `hukumonline.com`, `jdih.go.id`) tetap bisa difetch kontennya.

---

### Step 2.5 — Source Selector

Fungsi utama: `selectSources(category, count = 3)`

Logika:
1. Query DB: `SELECT * FROM sources WHERE $1 = ANY(categories) AND is_active = true`
2. Urutkan: `credibility_score DESC`
3. Filter: exclude sumber yang `last_fetched_at > NOW() - fetch_interval_minutes` (masih dalam cache window)
4. Return top `count` sumber
5. Jika tidak cukup sumber yang fresh: ambil yang ada, log warning

**Output**: Reporter Agent tinggal panggil `selectSources('akademik')` — dapat array sumber terbaik siap difetch.

---

### Step 2.6 — Source Management API

| Method | Endpoint | Fungsi |
|---|---|---|
| `GET` | `/api/v1/sources` | List semua sumber, filter by `?category=` |
| `POST` | `/api/v1/sources` | Tambah sumber baru |
| `PATCH` | `/api/v1/sources/:id` | Update sumber (URL, kategori, credibility score, selectors) |
| `DELETE` | `/api/v1/sources/:id` | Hapus sumber |
| `POST` | `/api/v1/sources/:id/test` | **Test fetch real** — return 5 item terbaru dari sumber ini |
| `PATCH` | `/api/v1/sources/:id/toggle` | Aktifkan/nonaktifkan sumber |

**Output**: Admin bisa kelola seluruh sumber dari dashboard. Tombol "Test Fetch" menampilkan hasil nyata dalam < 10 detik.

---

## ══════════════════════════════════════════════════
## FASE 3 — CONTENT PIPELINE CORE (7 AGENT PERTAMA)
## ══════════════════════════════════════════════════

**Tujuan**: Pipeline dari topik → artikel draft berjalan end-to-end secara otomatis.  
**Prasyarat**: Fase 0, 1, dan 2 selesai.

---

### Step 3.1 — Agent Base Class

`server/agents/base.js` — semua agent extends class ini:

```javascript
class BaseAgent {
  constructor(name) { this.name = name; }

  async callLLM(prompt, options = {})       // proxy ke llmRouter, otomatis catat usage
  async log(level, message, metadata = {})  // insert ke system_logs dengan agent name
  async updateJobStatus(jobId, status, result = null)  // update job_queue
  async retry(fn, maxAttempts = 3, baseDelayMs = 1000) // exponential backoff
  handleError(error, context)               // classify + log error, re-throw jika perlu
}
```

Setiap agent yang di-instantiate wajib punya nama yang muncul di setiap log entry. Tidak boleh ada log dari agent tanpa identitas.

**Output**: Semua agent punya behavior konsisten. Log di `system_logs` selalu ada kolom `agent`.

---

### Step 3.2 — Job Queue System

`server/services/jobQueue.js` — persistent queue berbasis PostgreSQL:

Fungsi yang tersedia:
- `enqueueJob(type, articleId, payload, priority?, scheduledAt?)` → insert ke `job_queue`
- `processNextJob()` → ambil 1 job `PENDING` dengan priority tertinggi dan `scheduled_at ≤ NOW()`, set ke `PROCESSING`, jalankan, update hasil
- `markJobDone(jobId, result)` → update status + simpan result
- `markJobFailed(jobId, error)` → increment attempts; jika `attempts >= max_attempts`: set `DEAD`, alert
- `getQueueStats()` → count per status per job_type (untuk dashboard)

Worker loop: `setInterval(processNextJob, config.JOB_WORKER_INTERVAL_MS)` — default 30 detik

Priority order: `urgent > high > normal > low`

Job types yang terdaftar: `RESEARCH`, `WRITE`, `EDIT`, `QC`, `IMAGE`, `SEO`, `PUBLISH`, `EVERGREEN_UPDATE`

**Output**: Restart server tidak membuat job hilang — semua tersimpan di DB. Job `PROCESSING` saat server mati akan di-recover oleh Watchdog (Fase 6).

---

### Step 3.3 — Reporter Agent (Peneliti)

`server/agents/reporter.js`

Input: `{ topic: string, category: string, siteId: string }`

Proses yang dieksekusi:
1. `selectSources(category, 3)` → dapat 2–3 sumber terbaik
2. Fetch konten dari setiap sumber (RSS/API/scrape sesuai type sumber)
3. Filter item yang relevan: hitung keyword overlap antara `topic` dan setiap item title+summary
4. Ambil top 5 item paling relevan per sumber (bukan semua item)
5. Panggil LLM:
   ```
   Dari konten berikut, ekstrak dalam format JSON:
   - facts[]: fakta utama yang bisa diverifikasi
   - quotes[]: kutipan narasumber dengan atribusi lengkap
   - statistics[]: angka/statistik/data dengan sumbernya
   - timeline: kronologi kejadian jika ada
   - key_entities[]: nama orang, organisasi, lokasi yang disebut
   - credibility_notes: hal-hal yang perlu diverifikasi atau diperjelas
   ```
6. Verifikasi silang lintas sumber: jika fakta kunci hanya ada di 1 sumber → tandai `unverified`
7. Hitung `source_credibility_score` gabungan (rata-rata tertimbang berdasarkan credibility_score sumber)

Output yang dikembalikan:
```json
{
  "facts": [...],
  "quotes": [...],
  "statistics": [...],
  "timeline": "...",
  "key_entities": [...],
  "sources": [{ "name", "url", "credibility_score" }],
  "composite_credibility_score": 8.4,
  "unverified_claims": [...]
}
```

**Output**: Brief riset berisi data nyata dari sumber nyata. Tidak ada hallucination karena LLM hanya mengekstrak dari konten yang sudah difetch.

---

### Step 3.4 — Penulis Agent

`server/agents/writer.js`

Input: `{ brief: object, format: string, siteId: string, category: string }`

Proses:
1. Load Persona Memory site dari DB (`sites.persona_memory`) — bisa berupa string kosong jika site baru
2. Load prompt template sesuai `format` dari `config/promptTemplates.js`
3. Load standar penulisan sesuai format dan kategori (dari Writing Standards Engine — Fase 4)
4. Construct prompt master:
   ```
   [SYSTEM: persona site] + [STANDAR PENULISAN] + [BRIEF RISET] + [INSTRUKSI FORMAT]
   ```
5. Panggil LLM → **artikel utama**
6. Panggil LLM → **versi FAQ** (berdasarkan artikel utama + brief)
7. Panggil LLM → **Key Takeaways** (5 poin paling penting dari artikel)
8. Panggil LLM → **caption media sosial** (280 karakter, menarik, informatif)
9. Untuk setiap bagian artikel yang butuh gambar: sisipkan placeholder dengan deskripsi visual spesifik:
   ```
   {{IMAGE: suasana sidang DPR, ruang formal, bendera Indonesia, pencahayaan dramatis}}
   ```
10. Hitung word count, pastikan sesuai target (`berita_singkat: 200-400`, `berita_panjang: 800-1500`, dll)

Output:
```json
{
  "mainArticle": "...",
  "faqVersion": "...",
  "keyTakeaways": ["...", "..."],
  "socialCaption": "...",
  "imagePlaceholders": [{ "position", "description" }],
  "wordCount": 1240,
  "format": "berita_panjang"
}
```

**Output**: 4 format konten dari satu brief, semua real, semua berbeda.

---

### Step 3.5 — Editor Agent

`server/agents/editor.js`

Input: `{ draft: object, brief: object, siteId: string, format: string }`

Proses:
1. **Akurasi check**: bandingkan klaim di draft dengan `brief.facts[]`. Klaim yang tidak ada di brief → tandai untuk dihapus atau konfirmasi
2. **Duplikasi check**: query DB `SELECT title, content FROM articles WHERE site_id = $1 AND status = 'published'`, hitung keyword overlap dengan draft. Jika overlap > 70% → flag
3. **Persona check**: bandingkan gaya draft dengan `persona_memory` site — panggil LLM untuk assessment
4. **Editing LLM call**:
   ```
   Kamu editor senior media Indonesia. Review dan perbaiki artikel berikut:
   - Perbaiki akurasi (fakta yang salah ada di daftar ini: [...])
   - Sesuaikan gaya dengan persona site: [persona]
   - Terapkan kaidah bahasa jurnalistik Indonesia
   - Kembalikan artikel yang sudah diperbaiki + daftar perubahan yang dibuat
   ```
5. Terapkan Humanizer Layer (Fase 8) — bisa dilakukan sebelum atau sesudah LLM edit
6. Hitung `quality_score` (0–100):
   - Kelengkapan 5W+1H (untuk berita): 30 poin
   - Akurasi terhadap brief: 30 poin
   - Naturalness bahasa: 20 poin
   - Kepatuhan standar format: 20 poin
7. Jika `quality_score < 75`: return dengan `needsRevision: true` + `revisionNotes` spesifik

Output:
```json
{
  "editedArticle": { "mainArticle", "faqVersion", "keyTakeaways", "socialCaption" },
  "qualityScore": 82,
  "changeLog": ["Dihapus klaim X karena tidak ada di sumber", "Diperbaiki gaya paragraf 3"],
  "needsRevision": false,
  "revisionNotes": null
}
```

**Output**: Artikel yang diedit dengan skor nyata. Jika skor < 75, pipeline otomatis kirim kembali ke Penulis Agent (max 2 kali retry).

---

### Step 3.6 — Quality Rater Simulator

`server/agents/qualityRater.js`

Input: `{ article: string, brief: object, category: string, format: string }`

Evaluasi 6 dimensi E-E-A-T (masing-masing 0–100, lalu dibobot):

| Dimensi | Bobot | Yang Diperiksa |
|---|---|---|
| **Experience** | 15% | Detail spesifik vs generalisasi, contoh konkret |
| **Expertise** | 25% | Penggunaan terminologi domain yang benar, depth konten |
| **Authoritativeness** | 25% | Referensi sumber otoritatif, nama/organisasi yang disebutkan |
| **Trustworthiness** | 20% | Klaim bisa diverifikasi, disclaimer untuk hal tidak pasti |
| **AI Detection Risk** | 10% | Pola bahasa AI, frasa klise, struktur terlalu sempurna |
| **Search Intent Match** | 5% | Apakah artikel menjawab apa yang user cari untuk topik ini |

Setiap dimensi: panggil LLM atau rule-based check, dapat skor + reasoning.

Jika `composite_eeat_score < 80`:
- Return `passed: false`
- Sertakan `revisionNotes` per dimensi yang gagal — sangat spesifik, bukan generik

**Output**: Gatekeeper nyata. Tidak ada artikel dengan E-E-A-T rendah yang lolos ke tahap berikutnya.

---

### Step 3.7 — Pipeline Orchestrator

`server/services/pipeline.js` — mengorkestrasi semua agent secara berurutan:

```
runPipeline(topicAssignment: { topic, category, siteId, format, priority })

1.  INSERT artikel ke DB dengan status 'researching'
2.  enqueueJob('RESEARCH', articleId, { topic, category, siteId })
    → [Reporter Agent] → brief riset
    → UPDATE artikel: brief_data, status = 'writing'

3.  enqueueJob('WRITE', articleId, { brief, format, siteId, category })
    → [Penulis Agent] → 4 format draft
    → UPDATE artikel: content_versions, status = 'editing'

4.  enqueueJob('EDIT', articleId, { draft, brief, siteId, format })
    → [Editor Agent] → edited article + quality_score
    → Jika quality_score < 75: kembali ke step 3 (max 2x, else DEAD)
    → UPDATE artikel: content_versions (edited), quality_score, status = 'qc'

5.  enqueueJob('QC', articleId, { article, brief, category, format })
    → [Quality Rater Simulator] → E-E-A-T score + passed
    → Jika passed = false: kembali ke step 4 (max 1x, else DEAD)
    → UPDATE artikel: eeat_score, status = 'imaging'

6.  enqueueJob('IMAGE', articleId, { article, placeholders, siteId })
    → [Fotografer Agent] → gambar-gambar final
    → UPDATE artikel: image_data, status = 'seo'

7.  enqueueJob('SEO', articleId, { article, brief, siteId, category })
    → [SEO Specialist Agent] → artikel teroptimasi
    → UPDATE artikel: seo_data, schema_markup, status = 'scheduled'

8.  enqueueJob('PUBLISH', articleId, { article, metadata, siteId, scheduledAt })
    → [Publisher Agent] → publish ke WordPress
    → UPDATE artikel: wordpress_post_id, wordpress_url, status = 'published'
```

**Output**: Satu panggilan `runPipeline({ topic: "Pemilu 2026", category: "politik", siteId: "xxx" })` menghasilkan artikel yang terbit di WordPress secara otomatis — tanpa intervensi.

---

## ══════════════════════════════════════════════════
## FASE 4 — WRITING STANDARDS ENGINE
## ══════════════════════════════════════════════════

**Tujuan**: AI harus menulis sesuai kaidah jurnalistik Indonesia dan standar jurnal ilmiah secara presisi.  
**Prasyarat**: Fase 3 (terutama Penulis Agent dan Editor Agent).

---

### Step 4.1 — Journalism Standards Module

Prompt template lengkap untuk penulisan berita yang ditanamkan ke Penulis Agent:

```
IDENTITAS: Kamu adalah jurnalis senior Indonesia dengan 15 tahun pengalaman di media
nasional ternama. Kamu menulis dengan gaya [PERSONA SITE].

STRUKTUR WAJIB — PIRAMIDA TERBALIK:
┌─ JUDUL ────────────────────────────────────────────────────────────┐
│  • 55–70 karakter                                                   │
│  • Mengandung keyword utama                                         │
│  • Informatif dan menarik klik tanpa clickbait berlebihan           │
│  • Contoh: "Inflasi Indonesia Turun 0,3%, BI Pertahankan Suku Bunga"│
├─ LEAD (Paragraf 1) ────────────────────────────────────────────────┤
│  • Maksimum 40 kata                                                  │
│  • WAJIB menjawab: WHO + WHAT                                       │
│  • Paling penting → ditulis di sini                                 │
├─ TUBUH BERITA ─────────────────────────────────────────────────────┤
│  • Par 2–3: WHY + HOW                                               │
│  • Par 4–5: Kutipan narasumber dengan atribusi lengkap              │
│  • Par 6–7: Data/statistik pendukung                                │
│  • Par 8+: Konteks, latar belakang, perbandingan historis           │
└─ PENUTUP ──────────────────────────────────────────────────────────┘
   • 1 paragraf: prospek ke depan ATAU reaksi pihak terkait

CHECKLIST 5W+1H (SEMUA wajib terpenuhi):
□ What  : [isi dari brief]
□ Who   : [isi dari brief]
□ Where : [isi dari brief]
□ When  : [isi dari brief]
□ Why   : [isi dari brief]
□ How   : [isi dari brief]

KAIDAH BAHASA:
• Kalimat aktif: minimal 70% dari total kalimat
• Paragraf: 3–5 kalimat, tidak boleh lebih
• Kutipan: selalu sertakan nama + jabatan + institusi narasumber
• Angka: tulis dengan angka (bukan huruf) untuk data faktual
• Ejaan: sesuai KBBI dan EYD terbaru

LARANGAN MUTLAK:
✗ Kalimat pembuka klise: "Dalam era modern ini...", "Di tengah dinamika..."
✗ Opini pribadi penulis (berita harus objektif)
✗ Klaim tanpa sumber yang bisa diverifikasi
✗ Paragraf > 5 kalimat
✗ Kata "sangat", "amat" untuk penekanan berlebihan
```

---

### Step 4.2 — Journal Standards Module

Prompt template untuk penulisan jurnal ilmiah:

```
IDENTITAS: Kamu adalah peneliti dan akademisi Indonesia yang menulis untuk jurnal
ilmiah nasional terindeks SINTA. Gunakan bahasa Indonesia baku.

STRUKTUR WAJIB — IMRAD:

1. JUDUL
   • Maksimum 12 kata
   • Spesifik, mencerminkan variabel utama penelitian
   • Tidak menggunakan kata tanya sebagai pembuka

2. ABSTRAK (100–250 kata, SATU paragraf)
   • Tujuan penelitian
   • Metode yang digunakan
   • Hasil utama (dengan angka jika ada)
   • Simpulan dan implikasi

3. KATA KUNCI: 3–5 kata, urutan alfabetis, dipisah titik koma

4. PENDAHULUAN
   • Latar belakang dan signifikansi topik
   • State of the art: apa yang sudah diketahui
   • Research gap: apa yang BELUM diketahui/dijawab
   • Tujuan penelitian yang spesifik dan terukur

5. METODE
   • Desain penelitian atau pendekatan
   • Data yang digunakan dan cara pengumpulannya
   • Teknik analisis
   • Cukup detail untuk bisa direproduksi

6. HASIL DAN PEMBAHASAN
   • Pemaparan temuan utama secara sistematis
   • Tabel atau daftar data jika relevan
   • Analisis: apa arti temuan ini?
   • Kaitan dengan teori yang ada
   • Perbandingan dengan penelitian sebelumnya
   • Diskusi keterbatasan temuan

7. SIMPULAN
   • Jawaban langsung atas tujuan penelitian
   • Kontribusi teoritis dan/atau praktis
   • Keterbatasan penelitian
   • Rekomendasi untuk penelitian berikutnya

8. DAFTAR PUSTAKA
   Format: {CITATION_STYLE}
   Minimum 10 referensi, prioritas publikasi 5 tahun terakhir
   Semua referensi harus disebut dalam teks (in-text citation)

GAYA BAHASA:
• Bahasa Indonesia baku sesuai KBBI dan EYD terbaru
• Angka 1–9: tulis dengan huruf. Angka 10+: gunakan angka
• Persentase: simbol % dengan spasi sebelumnya (contoh: 23 %)
• Hindari kata ganti orang pertama tunggal ("saya", "kami") — gunakan bentuk pasif
```

---

### Step 4.3 — Template Library untuk Semua Format

`server/config/promptTemplates.js` menyimpan template untuk semua format yang didukung:

| Format | Template Prompt | Standar Khusus |
|---|---|---|
| `berita_singkat` | Jurnalistik piramida terbalik | 200–400 kata, lead kuat |
| `berita_panjang` | Jurnalistik investigatif | 800–1.500 kata, multi-sumber |
| `jurnal_review` | IMRAD lengkap | Sitasi APA/IEEE/Harvard |
| `feature_opini` | Naratif dengan sudut pandang | 1.000–2.000 kata, voice konsisten |
| `listicle` | Format numbered list | Judul mencantumkan angka, setiap poin mandiri |
| `faq_article` | Tanya-jawab terstruktur | Schema FAQPage, setiap Q&A ≥ 50 kata |
| `evergreen` | Komprehensif, tidak terikat waktu | 1.200–2.500 kata, update-friendly |

Setiap template bisa **diedit dari dashboard** (Halaman Settings → Prompt Templates) tanpa deploy ulang.

---

### Step 4.4 — Validation Checklist per Format

Editor Agent menjalankan checklist ini secara programatik setelah LLM edit:

**Berita (semua sub-format)**:
- [ ] Piramida terbalik: informasi paling penting di awal
- [ ] Lead ≤ 40 kata
- [ ] Semua 6 unsur 5W+1H terpenuhi
- [ ] Setiap paragraf ≤ 5 kalimat
- [ ] Setiap kutipan punya nama + jabatan narasumber
- [ ] Tidak ada opini penulis yang tidak diberi atribusi

**Jurnal**:
- [ ] Judul ≤ 12 kata
- [ ] Abstrak 100–250 kata
- [ ] Kata kunci 3–5 item
- [ ] Semua 7 bagian IMRAD hadir
- [ ] Semua in-text citation punya entri di Daftar Pustaka
- [ ] Gaya sitasi konsisten (tidak campur APA dan IEEE)

**Feature/Opini**:
- [ ] Ada hook di paragraf pembuka (bukan langsung fakta)
- [ ] Sudut pandang editorial konsisten dari awal ke akhir
- [ ] Minimal 3 sumber berbeda direferensikan

**Listicle**:
- [ ] Angka di judul = jumlah item aktual di artikel
- [ ] Setiap item bisa dipahami tanpa membaca item lain
- [ ] Ada intro ≥ 2 paragraf dan outro ≥ 1 paragraf

Jika ada checklist yang gagal: catat di `revisionNotes`, tambah ke penilaian quality score, kirim kembali ke Penulis Agent.

---

## ══════════════════════════════════════════════════
## FASE 5 — FOTOGRAFER AGENT & WORDPRESS PUBLISHER
## ══════════════════════════════════════════════════

**Tujuan**: Artikel mendapat gambar yang presisi dan benar-benar terbit di WordPress.  
**Prasyarat**: Fase 3 dan 4 selesai.

---

### Step 5.1 — Image Source Connectors

**Connector A: AI Image Generation** (prioritas utama jika kuota tersedia)

Provider chain: Google Imagen 3 → OpenAI DALL-E 3 → Stable Diffusion API

Prompt builder — tidak pakai judul artikel, tapi baca deskripsi placeholder yang ditulis Penulis Agent:
```
Input placeholder: "suasana sidang DPR, ruang formal, bendera Indonesia"
Output prompt EN: "Indonesian parliament plenary session interior, formal legislative
  chamber, red white Indonesian flags prominent, legislators in formal attire,
  podium with microphone, dramatic lighting, editorial photography style,
  high resolution, photorealistic, no text overlay, 16:9 aspect ratio"
```
Resolusi target: **1200×630px** (optimal OG image, featured image WordPress)

**Connector B: Unsplash API** (fallback gratis)
- `GET https://api.unsplash.com/photos/random?query={keyword_en}&orientation=landscape&count=5`
- Auth: `Authorization: Client-ID {UNSPLASH_ACCESS_KEY}`
- Pilih foto dengan relevance score tertinggi dari 5 hasil
- Return: URL full-res, URL 1200px, photographer name + profile URL (untuk credit)

**Connector C: Pexels API** (fallback kedua)
- `GET https://api.pexels.com/v1/search?query={keyword_en}&orientation=landscape&per_page=5`
- Auth: `Authorization: {PEXELS_API_KEY}`
- Return: URL 1200px, photographer name

**Connector D: Placeholder Branded** (last resort)
- Generate gambar solid dengan warna brand site + teks topik
- Menggunakan `canvas` npm package — tidak butuh API eksternal
- Lebih baik dari tidak ada gambar sama sekali

---

### Step 5.2 — Fotografer Agent

`server/agents/photographer.js`

Input: `{ article: object, imagePlaceholders: array, siteId: string }`

Proses per placeholder:
1. Extract deskripsi dari `{{IMAGE: ...}}`
2. Terjemahkan deskripsi ke bahasa Inggris yang visual dan spesifik (panggil LLM)
3. Cek kuota image generation dari Key Pool
4. Pilih connector berdasarkan ketersediaan:
   - Kuota generate API ada → Connector A
   - Tidak ada → Connector B (Unsplash)
   - Unsplash error → Connector C (Pexels)
   - Semua gagal → Connector D (placeholder branded)
5. Download gambar, simpan sementara di `/tmp/`
6. Generate **alt text SEO**: `{keyword_utama} - {deskripsi singkat} | {nama_site}`
7. Generate **caption** jika format artikel memerlukan (feature, jurnal)
8. Return array gambar siap upload

Output per gambar:
```json
{
  "localPath": "/tmp/img_abc123.jpg",
  "altText": "Sidang DPR RI tentang RUU Pemilu - ruang paripurna | BeritaPolitik",
  "caption": "Suasana sidang paripurna DPR RI (Foto: Unsplash/JohnDoe)",
  "credit": "Photo by John Doe on Unsplash",
  "source": "unsplash",
  "width": 1200,
  "height": 630
}
```

**Output**: Setiap artikel mendapat gambar nyata, relevan, berlisensi benar.

---

### Step 5.3 — SEO Specialist Agent

`server/agents/seoSpecialist.js`

Input: `{ article: object, brief: object, siteId: string, category: string }`

10 proses SEO yang dijalankan secara berurutan:

**1. Keyword Research** (LLM):
```
Dari artikel ini, identifikasi:
- 1 keyword utama (volume tinggi, relevan, spesifik)
- 5–10 LSI keyword (semantically related)
- 2–3 question keywords (untuk FAQ schema)
Return JSON.
```

**2. Title Optimization**: pastikan keyword utama ada di H1, panjang 55–70 karakter, tidak diakhiri titik

**3. Meta Title** (LLM, 50–60 karakter): mengandung keyword + angka atau manfaat jika natural

**4. Meta Description** (LLM, 150–160 karakter): keyword + CTA yang natural (bukan "Klik di sini")

**5. Heading Structure**: evaluasi H2/H3/H4 — keyword utama harus ada di setidaknya 1 H2, LSI keyword tersebar di H2/H3 lainnya

**6. Internal Links**: query DB `articles` untuk semua artikel `published` di site yang sama, cari 2–3 yang paling relevan berdasarkan keyword overlap, sisipkan link natural di dalam teks

**7. External Links**: dari `brief.sources[]`, pilih 1–2 sumber paling otoritatif, sisipkan sebagai referensi (bukan di setiap kalimat)

**8. Keyword Density Check**: hitung `count(keyword) / total_words × 100`. Jika > 2.5% → tandai untuk pengurangan

**9. Schema Markup** (JSON-LD sesuai format):
- Berita → `NewsArticle` schema
- Jurnal → `ScholarlyArticle` schema
- Evergreen → `Article` schema
- FAQ → `Article` + `FAQPage` schema

**10. URL Slug**: lowercase, tanpa stop word (yang, dan, di, ke, dari, untuk), max 60 karakter, kata dipisah `-`

Output:
```json
{
  "optimizedArticle": { "...artikel dengan heading dan link yang sudah diedit..." },
  "metaTitle": "Inflasi Indonesia Turun 0,3% — Data BPS Juli 2026",
  "metaDescription": "BPS catat inflasi Indonesia turun 0,3% pada Juli 2026. Simak rincian data per kategori dan dampaknya terhadap daya beli masyarakat.",
  "slug": "inflasi-indonesia-turun-juli-2026",
  "schemaMarkup": "{...JSON-LD...}",
  "keywords": { "primary": "inflasi Indonesia", "lsi": [...], "questions": [...] },
  "internalLinks": [{ "url", "anchor", "position" }],
  "externalLinks": [{ "url", "anchor" }],
  "keywordDensity": 1.8
}
```

**Output**: Artikel siap SEO 100%. Semua elemen on-page terpenuhi sebelum publish.

---

### Step 5.4 — Article HTML Formatter

`server/utils/seoFormatter.js` — konversi artikel teks/markdown ke HTML WordPress-ready:

| Elemen | HTML Output |
|---|---|
| Paragraf | `<p>teks</p>` |
| H2 | `<h2>judul bagian</h2>` |
| H3 | `<h3>sub-judul</h3>` |
| Kutipan | `<blockquote><p>kutipan</p><cite>— Nama, Jabatan</cite></blockquote>` |
| Daftar | `<ul><li>...</li></ul>` atau `<ol>` |
| Gambar utama | Dihandle sebagai featured image WordPress, bukan inline |
| Gambar inline | `<figure><img src="..." alt="..."><figcaption>...</figcaption></figure>` |
| Key Takeaways | `<div class="news-ai-key-takeaways"><h3>Poin Penting</h3><ul>...</ul></div>` |
| FAQ section | `<div class="news-ai-faq"><div class="faq-item"><h3>Q</h3><p>A</p></div></div>` |
| Schema | `<script type="application/ld+json">{...}</script>` di akhir konten |
| Internal link | `<a href="..." title="..." rel="noopener">anchor text</a>` |
| External link | `<a href="..." title="..." rel="noopener nofollow" target="_blank">anchor</a>` |

---

### Step 5.5 — WordPress Publisher Agent

`server/agents/publisher.js`

Input: `{ articleId: string, siteId: string, scheduledAt: ISO8601 }`

Proses publikasi ke WordPress REST API:

**Step A — Upload gambar featured**:
```
POST {wp_url}/wp/v2/media
Headers: Authorization: Basic {base64(user:app_password)}
          Content-Type: image/jpeg
          Content-Disposition: attachment; filename="article-slug.jpg"
Body: [binary image data]
Response: { id: 890, source_url: "..." }
```

**Step B — Resolve/buat kategori**:
```
GET  {wp_url}/wp/v2/categories?slug={niche}
→ Jika ada: ambil id
POST {wp_url}/wp/v2/categories { name, slug }
→ Jika tidak ada: buat, ambil id
```

**Step C — Resolve/buat tag** (sama seperti kategori)

**Step D — Publish artikel**:
```json
POST {wp_url}/wp/v2/posts
{
  "title": "...",
  "content": "{HTML artikel}",
  "status": "future",
  "date": "2026-07-28T07:17:43",
  "categories": [5],
  "tags": [23, 45, 67],
  "featured_media": 890,
  "meta": {
    "_yoast_wpseo_title": "Meta title SEO...",
    "_yoast_wpseo_metadesc": "Meta description...",
    "_yoast_wpseo_focuskw": "keyword utama"
  }
}
```

**Step E — Konfirmasi dan simpan**:
- Simpan `wordpress_post_id` dan `wordpress_url` ke DB
- Update `article.status = 'published'`
- Log sukses ke `system_logs`

**Error handling**:
| HTTP Code | Aksi |
|---|---|
| 401 | Alert critical + pause site + log: "WP credentials invalid" |
| 403 | Alert: "WP user tidak punya izin publish" |
| 429 | Tunggu `Retry-After` header, retry |
| 500 | Retry 3× dengan exponential backoff, lalu DEAD queue |
| Timeout | Retry 2×, lalu DEAD queue |

**Output**: Artikel benar-benar terbit di WordPress. URL artikel tersimpan di DB dan bisa diklik dari dashboard.

---

## ══════════════════════════════════════════════════
## FASE 6 — SCHEDULER & FULL AUTOMATION
## ══════════════════════════════════════════════════

**Tujuan**: Sistem berjalan sendiri 24/7 tanpa intervensi manusia.  
**Prasyarat**: Fase 3, 4, dan 5 selesai.

---

### Step 6.1 — Site Scheduler

`server/services/scheduler.js` menggunakan `node-cron`:

Saat server start: baca semua site dengan `status = 'active'`, daftarkan cron job per time slot:

```javascript
// Contoh: site A dengan jadwal 07:00, 10:00, 14:00, 19:00
cron.schedule('0 7 * * *',  () => triggerSitePipeline(siteA, '07:00'));
cron.schedule('0 10 * * *', () => triggerSitePipeline(siteA, '10:00'));
// dst
```

`triggerSitePipeline(siteId, slot)`:
1. Ambil topik berikutnya dari `content_calendar` dengan `site_id = siteId AND status = 'planned' AND scheduled_date = TODAY ORDER BY scheduled_date, id LIMIT 1`
2. Jika ada: mark calendar item sebagai `'assigned'`, jalankan `runPipeline(topic)`
3. Jika kosong: panggil Pemimpin Redaksi Agent untuk generate topik ad-hoc berdasarkan tren hari ini
4. Tambahkan random delay: `setTimeout(run, randomInt(0, 45) * 60 * 1000)` — delay 0–45 menit

Jika site `status` berubah (pause/aktif dari dashboard): reload cron jobs tanpa restart server.

---

### Step 6.2 — Smart Timing Implementation

Default time slots per kategori (hardcoded di config, bisa override per site di dashboard):

```javascript
const SMART_TIMING = {
  'politik':   ['06:00', '07:00', '16:00'],
  'bisnis':    ['07:30', '09:00', '12:00'],
  'teknologi': ['10:00', '12:00', '15:00'],
  'kesehatan': ['11:00', '13:00', '20:00'],
  'akademik':  ['09:00', '11:00', '14:00'],
  'lifestyle': ['12:00', '14:00', '21:00'],
  'olahraga':  ['07:00', '12:00', '19:00'],
  'hukum':     ['08:00', '10:00', '14:00'],
  'default':   ['08:00', '12:00', '17:00']
};
```

Random delay formula: `publishTime = targetTime + randomInt(-15, +45) minutes`
- Negatif: publish lebih awal (bukan sebelum jam buka kantor)
- Positif: publish lebih lambat
- Batas minimum: tidak sebelum 05:30 WIB

---

### Step 6.3 — Source Refresh Scheduler

Cron: setiap 6 jam (`0 */6 * * *`):
1. Query semua `sources` dengan `is_active = true`
2. Untuk setiap sumber: cek `last_fetched_at` — jika sudah > `fetch_interval_minutes`, fetch ulang
3. Hasil fetch disimpan ke field `cached_items` (JSONB) di tabel `sources`
4. Update `last_fetched_at`
5. Tandai item yang sudah dipakai sebagai referensi (matching berdasarkan URL)

---

### Step 6.4 — Daily Maintenance Jobs

Cron: setiap tengah malam WIB (`0 17 * * *` dalam UTC):
1. Reset `usage_today = 0` semua API key
2. Hitung `usage_stats` harian: aggregate dari log hari ini, insert ke `usage_stats`
3. Delete `system_logs` yang `created_at < NOW() - INTERVAL '30 days'`
4. Query artikel `status = 'published'` yang lebih dari 30 hari: tandai sebagai `is_evergreen_candidate = true` jika format = evergreen/feature
5. Log: "Daily maintenance completed" ke `system_logs`

---

### Step 6.5 — Watchdog

Cron: setiap 5 menit (`*/5 * * * *`):

**Stuck job detection**:
- Query: `SELECT * FROM job_queue WHERE status = 'processing' AND started_at < NOW() - INTERVAL '30 minutes'`
- Jika ada: reset ke `status = 'pending'`, increment `attempts`, log warning
- Jika `attempts >= max_attempts`: set `dead`, log critical alert

**Error key detection**:
- Query: `SELECT key_id, count(*) FROM system_logs WHERE level = 'error' AND message LIKE '%api_key%' AND created_at > NOW() - INTERVAL '1 hour' GROUP BY key_id HAVING count(*) > 10`
- Jika ada: auto-set key `status = 'paused'`, log critical alert

---

## ══════════════════════════════════════════════════
## FASE 7 — DASHBOARD FULL (9 HALAMAN, SEMUA REAL)
## ══════════════════════════════════════════════════

**Tujuan**: Setiap piksel menampilkan data nyata. Setiap tombol berfungsi nyata.  
**Prasyarat**: Fase 0–6 selesai. Data nyata sudah ada di DB.

---

### Step 7.1 — Halaman Overview (Home Dashboard)

Data dari DB, auto-refresh setiap 30 detik:

**Kartu ringkasan (baris atas)**:
- Total artikel terbit hari ini (dari `articles WHERE DATE(published_at) = TODAY`)
- Total job dalam queue (dari `job_queue WHERE status IN ('pending','processing')`)
- Jumlah API key aktif (dari `api_keys WHERE status = 'active'`)
- Jumlah alert aktif — merah jika ada critical

**Grafik produksi** (line chart, 7 hari terakhir):
- Data: `SELECT DATE(published_at), count(*) FROM articles GROUP BY 1 ORDER BY 1 DESC LIMIT 7`
- Per site bisa di-toggle on/off

**Pipeline visualizer** (horizontal funnel):
- Count artikel di setiap stage: researching → writing → editing → qc → imaging → seo → scheduled → published hari ini

**Alert bar**: semua alert aktif dari `system_logs WHERE level IN ('warn','error','critical') AND created_at > NOW() - INTERVAL '24 hours'` — sorted by severity, bisa di-dismiss per item

**Activity feed** (10 log terbaru): streaming dari `system_logs ORDER BY created_at DESC LIMIT 10`

**Site status grid** (8 kartu site):
- Nama site, niche, status (aktif/pause)
- Artikel terbit hari ini
- Next publish: waktu job PUBLISH berikutnya dari queue
- Klik → masuk ke detail site

---

### Step 7.2 — Halaman Sites

**Tabel site**:
Kolom: Nama | URL | Niche | Status | Artikel Hari Ini | Next Publish | Queue | Aksi

**Form tambah/edit site** (semua field dari profil PRD Bab 13):
- Nama, URL, WP API URL
- WordPress username + Application Password (dienkripsi saat simpan)
- Niche, kategori default
- Jadwal posting: articles per day + time slots
- Format default (berita/jurnal/feature)
- Citation style (APA/IEEE/Harvard)
- SEO plugin (Yoast/RankMath)
- Deskripsi persona site (textarea — digunakan sebagai seed Persona Memory)
- Kompetitor (list URL untuk Gap Analysis)
- Human review toggle

**Tombol "Test Koneksi WP"**: panggil `GET {wp_url}/wp/v2/posts?per_page=1` — tampilkan response time + status + nama site dari WP. Gagal = tampilkan error spesifik.

**Preview Persona Memory**: modal yang tampilkan `sites.persona_memory` — kumulatif gaya penulisan yang sudah terbentuk

---

### Step 7.3 — Halaman API Keys

**Tabel per provider** dengan grouping:
- Kolom: Label | Status Badge | Usage Bar | Usage/Limit | Last Used | Error Count | Aksi
- Usage Bar: warna hijau (<60%) → kuning (60–80%) → merah (>80%)
- Status badge: Active (hijau) | Warning (kuning) | Critical (oranye) | Exhausted (merah) | Paused (abu)

**Form tambah key**:
- Provider selector (dropdown 8 provider)
- Label (contoh: "Gemini Key #3")
- Nilai API key (input type=password, tidak pernah ditampilkan setelah disimpan)
- Daily limit, monthly limit (opsional — override default provider)
- Reset date/time

**Tombol "Test Key"**: panggil LLM dengan prompt "Say OK" — tampilkan: ✓ Connected (latency: 1.2s) atau ✗ Error: Invalid API key

**Priority chain editor**: daftar provider yang bisa di-drag-and-drop untuk atur urutan fallback

**Estimasi reset**: "Resets in 4h 23m" berdasarkan `reset_at` di DB

---

### Step 7.4 — Halaman Articles

**Tabel dengan filter**:
- Filter: site (multi-select) | status (multi-select) | format | kategori | tanggal dari–sampai
- Sort: published_at DESC (default) | quality_score | eeat_score
- Kolom: Judul | Site | Format | Status | Skor QE | Skor EEAT | Published At | Aksi

**Status badge berwarna** per stage pipeline

**Panel detail artikel** (slide-in dari kanan):
- Tab "Konten": artikel utama (rendered), FAQ, Key Takeaways, Social Caption
- Tab "Skor": quality score gauge, E-E-A-T score breakdown per dimensi, AI detection risk
- Tab "Sumber": list sumber yang digunakan Reporter, credibility score per sumber
- Tab "SEO": meta title, meta description, slug, keywords, schema preview
- Tab "Gambar": thumbnail gambar yang dipilih + alt text + credit
- Tab "Log": timeline setiap step pipeline dengan timestamp dan durasi

**Aksi per artikel**:
- Force Publish Now (skip scheduled time)
- Move to Draft (di WordPress)
- Regenerate from step... (pilih step mana: research/write/edit/qc)
- View on WordPress (open URL)
- Delete (dengan konfirmasi)

**Human Review Queue**: tab terpisah, artikel yang butuh approval — tombol Approve/Reject per artikel

---

### Step 7.5 — Halaman Queue

**Pipeline board** (Kanban-style, 7 kolom):
```
[Researching] [Writing] [Editing] [QC] [Imaging] [SEO] [Scheduled]
     3            2         1       0      4         2       12
```
Setiap kolom: count + scroll list judul artikel di stage tersebut

**Job table**: semua job aktif
- Kolom: Job Type | Artikel (link) | Status | Attempts | Started At | Provider Used

**Dead Letter Queue**: tab terpisah
- Job yang gagal total (attempts >= max)
- Tampilkan: error message lengkap, stack trace (jika ada), tombol Retry Manual, tombol Delete

**Force Run**: form input topik + pilih site → jalankan `runPipeline()` langsung (tidak tunggu scheduler)

---

### Step 7.6 — Halaman Rapat Redaksi

**Notulen terbaru**: render markdown notulen dari `rapat_notes` terbaru — tampil sebagai "briefing memo" yang bisa dibaca

**Archive notulen**: dropdown pilih minggu sebelumnya

**Content Calendar** (tabel 8 site × 7 hari):
- Setiap sel: topik yang direncanakan (atau kosong jika belum ada)
- Klik sel: edit topik, ubah format, ubah prioritas
- Tambah topik baru: klik "+" di sel mana saja

**Prediksi Tren** (kartu per topik):
- Topik | Kategori | Confidence Score (badge) | Perkiraan Peak Date
- Status: Predicted / Confirmed (kalau sudah tren) / Missed

**Tombol "Trigger Rapat Sekarang"**: jalankan proses rapat redaksi secara manual, refresh halaman setelah selesai

---

### Step 7.7 — Halaman Sources

**Tabel sumber** dengan filter kategori:
- Kolom: Nama | URL | Type | Kategori | Credibility | Status | Last Fetched | Aksi

**Tombol "Test Fetch"**: fetch 5 item terbaru dari sumber ini sekarang, tampilkan dalam modal:
```
✓ Berhasil fetch 5 artikel dari Detik.com (1.2 detik)
1. "Inflasi Indonesia Turun 0,3%..." — 2 jam lalu
2. "KPU Tetapkan Jadwal Pemilu..."  — 5 jam lalu
...
```

**Form tambah/edit sumber**: Nama, URL, RSS URL (opsional), Type, Kategori (multi-select), Credibility Score manual, CSS Selectors (untuk scraper, textarea JSON)

**Credibility Score**: bisa di-edit langsung dari tabel (inline edit)

---

### Step 7.8 — Halaman Analytics

**Grafik produksi** (line chart dengan range picker):
- Total artikel per hari, bisa filter per site
- Overlay: target harian per site

**E-E-A-T Score** (bar chart mingguan):
- Rata-rata per minggu, bisa filter per site atau per format

**Provider Performance** (tabel):
- Provider | Artikel Generated | Rata-rata Quality Score | Rata-rata E-E-A-T | Avg Latency | Error Rate
- Identifikasi provider mana yang paling efektif

**Prompt Evolution** (tabel):
- Prompt Version | Agent Type | Sample Count | Avg Score | Status (Champion/Active/Deprecated/Experimental)
- Tombol: "Set as Champion", "Create Variation", "Deprecate"

**Evergreen Candidates** (tabel):
- Artikel | Site | Published | Days Old | Last E-E-A-T Score | Tombol "Schedule Update"

**Key Usage History** (area chart):
- Penggunaan per provider per hari (7/30 hari)

**Error Rate** (bar chart):
- Error per stage pipeline per hari — identifikasi bottleneck

---

### Step 7.9 — Halaman Settings

**Global Settings**:
- Timezone (selector, default Asia/Jakarta)
- Admin password change
- Humanizer Level (slider 1–4 dengan preview deskripsi setiap level)
- Quality Score Threshold (number input, default 75)
- E-E-A-T Score Threshold (number input, default 80)
- Key Warning Threshold % (number input, default 80)
- Human Review Global Toggle

**Prompt Templates Editor**:
- Dropdown pilih template (per format)
- Textarea untuk edit template
- Tombol "Save", "Reset to Default", "Test Template" (generate artikel singkat dengan template ini)

**Fallback Chains**:
- LLM Provider chain (drag-and-drop)
- Image Provider chain (drag-and-drop)

**Data Export**:
- Export Articles (filter range tanggal) → CSV/JSON
- Export Logs → CSV
- Export Config (sites + settings, no API keys plaintext) → JSON

---

## ══════════════════════════════════════════════════
## FASE 8 — QUALITY & HUMANIZER ENGINE
## ══════════════════════════════════════════════════

**Tujuan**: Artikel tidak terdeteksi AI oleh tools apapun, terasa natural seperti ditulis jurnalis manusia.  
**Prasyarat**: Fase 3 (Editor Agent) selesai.

---

### Step 8.1 — Humanizer Layer (4 Level)

`server/utils/humanizer.js` — diterapkan oleh Editor Agent setelah LLM edit:

**Level 1 — Variasi Struktur** (selalu aktif):
- Deteksi 3 paragraf berturut-turut dengan panjang mirip → variasikan salah satunya (pendekkan atau panjangkan)
- Setelah setiap 2 kalimat panjang (>20 kata): sisipkan kalimat pendek (<10 kata)
- Pastikan tidak semua paragraf dimulai dengan pola yang sama (subjek + predikat)

**Level 2 — Variasi Bahasa** (selalu aktif):
- Cari dan replace frasa klise AI (daftar 50+ frasa):
  - "Hal ini sangat penting karena..." → versi lebih spesifik dengan alasan konkret
  - "Di era modern ini..." → hilangkan, mulai langsung dengan substansi
  - "Tidak dapat dipungkiri bahwa..." → hilangkan
  - "Kesimpulannya, ..." → ubah ke kalimat yang lebih organik
- Sisipkan konjungsi awal kalimat secara selektif (max 1 per 5 paragraf): "Namun,", "Padahal,", "Bahkan,"
- Variasi atribusi kutipan: rotate antara "mengatakan", "menyatakan", "menegaskan", "mengungkapkan", "menjelaskan", "menuturkan"

**Level 3 — Naturalness Konten** (aktif jika config level ≥ 3):
- Tambahkan referensi waktu yang kontekstual: "Senin lalu", "Awal pekan ini", "Menjelang akhir bulan"
- Tambahkan detail geografis Indonesia yang spesifik jika relevan: nama kota, provinsi, kawasan
- Sisipkan maksimal 1 pertanyaan retoris per 4 paragraf: "Lalu, apa dampaknya bagi masyarakat?"
- Tambahkan "ketidakpastian yang jujur" di tempat yang sesuai: "meski angka pastinya belum tersedia", "yang masih menunggu konfirmasi resmi"

**Level 4 — Advanced Naturalness** (aktif jika config level = 4):
- Variasi cara mengakhiri artikel: tidak selalu "harapan ke depan" — bisa diakhiri dengan fakta mengejutkan, kutipan kuat, atau pertanyaan terbuka
- Satu minor linguistic imprecision alami per artikel (cara manusia berbicara, bukan kesalahan fakta): "sekitar 40 ribu" alih-alih "40.000"
- Tambahkan satu detail "unexpected" yang relevan — sesuatu yang tidak selalu ada di semua artikel tentang topik ini

---

### Step 8.2 — AI Detection Pre-Check

Dijalankan oleh Editor Agent SEBELUM memanggil Humanizer:

Pola yang dicari dan dieliminasi secara regex + rule-based:

| Pola | Aksi |
|---|---|
| Kalimat pembuka: "Dalam era modern...", "Di tengah perkembangan..." | Hapus, tulis ulang lead |
| Penutup: "Kesimpulannya, dapat disimpulkan..." | Hapus, ganti dengan konklusi substantif |
| 3+ paragraf berurutan dengan panjang ±5% sama | Flag untuk variasi di Humanizer |
| "pertama... kedua... ketiga..." berulang > 1 kali | Ubah ke narasi atau variasi struktur |
| Kata "signifikansi", "berimplikasi", "dampak signifikan" berlebihan (>3×) | Ganti sinonim, variasikan |
| Setiap paragraf dimulai "Hal ini..." atau "Ini menunjukkan..." | Variasikan subjek kalimat |
| Pola paralel sempurna di setiap bagian | Pecah pola, tambah variasi |

---

### Step 8.3 — Duplikasi Guard

Dijalankan oleh Editor Agent sebelum writing (bukan setelah):

1. Generate "topic fingerprint" dari topik: 10–15 keyword kunci
2. Query DB: semua artikel `published` + `scheduled` + `editing` di site yang sama
3. Hitung keyword overlap untuk setiap artikel yang ditemukan
4. Jika overlap > 70% dengan artikel yang sudah ada:
   - Flag artikel ini sebagai `DUPLICATE_RISK`
   - Kirim ke Pemimpin Redaksi Agent: "Topik X mirip dengan artikel Y (70% overlap). Pilihan: (a) ubah sudut pandang, (b) skip topik ini"
   - Pemimpin Redaksi memutuskan berdasarkan Persona Memory dan content calendar

---

## ══════════════════════════════════════════════════
## FASE 9 — RAPAT REDAKSI ENGINE
## ══════════════════════════════════════════════════

**Tujuan**: Sistem "berpikir strategis" dan merencanakan kontennya sendiri setiap minggu.  
**Prasyarat**: Fase 6 (Scheduler) dan Fase 3 (Pipeline) selesai.

---

### Step 9.1 — Google Trends Integration

`server/services/trends.js`:

- Fetch Google Trends data setiap 6 jam menggunakan `google-trends-api` npm package atau scraping endpoint `trends.google.com`
- Data yang diambil:
  - `realTimeTrends()` → topik yang sedang trending sekarang di Indonesia
  - `dailyTrends({ geo: 'ID' })` → topik trending harian Indonesia
  - `interestOverTime({ keyword, geo: 'ID' })` → grafik tren keyword tertentu
- Simpan sebagai time-series di JSONB column di `rapat_notes` (tidak butuh tabel baru)
- Setiap fetch: simpan snapshot dengan timestamp → untuk analisis pola

---

### Step 9.2 — Trend Prediction Engine

Dijalankan setiap Senin 06:30 WIB (30 menit sebelum rapat):

1. Load 7 hari data Google Trends Indonesia
2. Load data media sosial trending jika tersedia (Twitter trending ID)
3. Panggil LLM dengan data tersebut:
   ```
   Berdasarkan data tren Indonesia 7 hari terakhir berikut, prediksi
   10 topik yang akan memuncak dalam 3–7 hari ke depan.

   Untuk setiap prediksi berikan:
   - Topik (spesifik, bukan generik)
   - Kategori (politik/teknologi/bisnis/dll)
   - Confidence Score (0–100)
   - Reasoning (mengapa topik ini akan trending)
   - Estimated peak date

   Format: JSON array
   ```
4. Simpan ke tabel `trend_predictions`
5. Cross-check dengan artikel yang sudah pernah ditulis di semua site: jika sudah ada → tandai, beri flag "needs different angle"

---

### Step 9.3 — Competitor Gap Scanner

Dijalankan setiap Sabtu 20:00 WIB:

1. Untuk setiap site: ambil list `competitor_sites` dari `sites.config`
2. Fetch sitemap atau RSS setiap kompetitor: ambil 50 artikel terbaru
3. Ekstrak topik dari judul menggunakan LLM (batch 50 judul → extract topik)
4. Bandingkan dengan topik artikel kita 30 hari terakhir di site yang sama
5. Kategorisasi gap:
   - **Blue Ocean**: topik yang ada di kompetitor, belum pernah ditulis kita (high priority)
   - **Depth Gap**: topik yang kita tulis tapi lebih dangkal dari kompetitor (update opportunity)
   - **Our Advantage**: topik yang kita cover lebih baik dari kompetitor (maintain)
6. Simpan ke `competitor_data.gap_opportunities` sebagai JSON

---

### Step 9.4 — Performance Analyzer

Dijalankan setiap Sabtu 21:00 WIB:

1. Query semua artikel publish minggu ini per site
2. Hitung proxy metrics (tanpa Google Search Console):
   - Estimated performance = (eeat_score × 0.4) + (quality_score × 0.3) + (word_count_ratio × 0.15) + (internal_links_count × 0.15)
   - `word_count_ratio`: actual / target × 100
3. Analisis pattern:
   - Format mana yang rata-rata scoringnya tertinggi?
   - Provider LLM mana yang hasilkan artikel dengan skor tertinggi?
   - Prompt version mana yang perform terbaik?
   - Jam publish mana yang korelasi dengan skor tertinggi?
4. Identifikasi evergreen candidates: artikel > 30 hari, format evergreen, skor > 75
5. Generate laporan JSON terstruktur untuk digunakan di Rapat Senin

---

### Step 9.5 — Pemimpin Redaksi Agent & Content Calendar Generator

`server/agents/chiefEditor.js` — dijalankan setiap Senin 07:00 WIB:

**Input yang diterima**:
- Laporan performa dari Step 9.4
- Prediksi tren dari Step 9.2
- Gap kompetitor dari Step 9.3
- Persona Memory semua 8 site

**Proses untuk setiap site**:
```
Panggil LLM dengan context:

SITE PROFILE: {nama, niche, target_pembaca, persona_memory_ringkas}
JADWAL: {articles_per_day} artikel per hari × 7 hari = {total} artikel

DATA INPUT:
1. Prediksi tren minggu ini: [list 10 prediksi dengan confidence score]
2. Gap kompetitor: [list gap opportunities]
3. Artikel untuk diupdate: [list evergreen candidates]
4. Topik yang sudah pernah ditulis (hindari): [last 30 artikel, judul saja]

INSTRUKSI:
Buat content calendar {total} topik untuk 7 hari ke depan dengan komposisi:
- 60% topik trending yang relevan dengan niche site ini
- 30% topik evergreen atau evergreen update
- 10% gap kompetitor (blue ocean)

Untuk setiap topik:
- Judul deskriptif (bukan clickbait)
- Kategori
- Format yang direkomendasikan
- Sumber utama yang harus dicek
- Tanggal publish yang direkomendasikan
- Alasan pemilihan topik ini

Format: JSON array
```

**Setelah generate calendar**:
- Insert semua topik ke `content_calendar` dengan `status = 'planned'`
- Panggil LLM untuk generate notulen rapat dalam format yang readable:
  ```
  === NOTULEN RAPAT REDAKSI ===
  Senin, {tanggal} | 07:00 WIB

  📊 RINGKASAN MINGGU LALU:
  [data dari laporan performa]

  🔮 PREDIKSI TREN MINGGU INI:
  [top 5 prediksi dengan reasoning]

  📋 KOMPETITOR: PELUANG YANG DITEMUKAN:
  [gap opportunities terpenting]

  📅 CONTENT CALENDAR MINGGU INI:
  [ringkasan per site, bukan detail semua topik]

  ⚠️ CATATAN OPERASIONAL:
  [key pool status, artikel yang perlu attention]
  === END ===
  ```
- Insert notulen ke `rapat_notes`

---

## ══════════════════════════════════════════════════
## FASE 10 — INNOVATION LAYER
## ══════════════════════════════════════════════════

**Tujuan**: Fitur-fitur yang membedakan sistem ini dari tool konten biasa.  
**Prasyarat**: Fase 7 (Dashboard), Fase 9 (Rapat Redaksi) selesai.

---

### Step 10.1 — Persona Memory Builder

Setiap kali artikel dipublish ke site X:

1. Panggil LLM:
   ```
   Baca artikel berikut dan identifikasi karakteristik gaya penulisannya:
   - Gaya bahasa (formal/semi-formal/santai)
   - Tingkat teknis konten (umum/menengah/ahli)
   - Sudut pandang editorial yang dominan
   - Cara membuka artikel (lead style)
   - Cara menutup artikel
   - Topik atau angle yang khas/berulang
   - Kosakata atau frasa yang khas

   Return sebagai paragraf deskriptif singkat (100 kata).
   ```
2. Ambil `persona_memory` site yang ada dari DB
3. Panggil LLM untuk merge (bukan replace):
   ```
   Persona lama: [existing memory]
   Observasi baru dari artikel terbaru: [new observations]

   Update persona menjadi deskripsi kumulatif yang mencerminkan KEDUANYA.
   Jika ada kontradiksi, ambil yang paling konsisten/dominan.
   Maksimum 200 kata.
   ```
4. Update `sites.persona_memory` di DB

Persona Memory digunakan oleh Penulis Agent setiap kali menulis untuk site tersebut — memastikan konsistensi suara dari artikel ke artikel.

---

### Step 10.2 — Evergreen Update Engine

Cron: setiap malam 02:00 WIB:

1. Query: `SELECT * FROM articles WHERE is_evergreen_candidate = true AND last_updated_at < NOW() - INTERVAL '30 days' LIMIT 5`
2. Untuk setiap kandidat:
   a. Fetch sumber-sumber yang dipakai saat artikel pertama dibuat (dari `articles.source_urls`)
   b. Fetch konten terbaru dari sumber tersebut
   c. Panggil LLM: "Apakah ada informasi baru yang signifikan tentang topik ini dibandingkan artikel berikut? List hal-hal baru jika ada."
   d. Jika ada informasi baru (LLM jawab "yes" dengan list konkret): enqueue `EVERGREEN_UPDATE` job
3. `EVERGREEN_UPDATE` pipeline:
   - Reporter Agent: fetch info terbaru dari sumber
   - Editor Agent: tambahkan seksi "**Update — {tanggal}**: ..." di awal artikel
   - Update artikel di WordPress: `PATCH /wp/v2/posts/{id}` dengan konten baru + ubah `date_modified`
   - Update `articles.last_updated_at` di DB

---

### Step 10.3 — Link Intelligence Network

Tambahan di SEO Specialist Agent (Step 5.3):

Saat proses internal linking, query tidak hanya site yang sama, tapi semua 8 site:
```sql
SELECT id, site_id, title, wordpress_url, tags
FROM articles
WHERE status = 'published'
  AND site_id != $currentSiteId   -- cross-site links
  AND eeat_score > 75             -- hanya link ke artikel berkualitas
ORDER BY eeat_score DESC
LIMIT 100
```

Hitung keyword overlap antara artikel baru dengan setiap artikel yang ditemukan.
Jika overlap > 30%: kandidat cross-site link.

**Batasan untuk menghindari link farm**:
- Maksimum 3 cross-site link per artikel (di samping internal link)
- Satu artikel sumber tidak boleh menerima lebih dari 5 cross-site link dalam 7 hari
- Anchor text harus bervariasi: tidak boleh sama persis untuk 2 link ke artikel yang sama
- Track semua link yang dibuat di `articles.seo_data.outbound_links`

---

### Step 10.4 — Prompt Evolution System

Setiap artikel saat dibuat: simpan `prompt_version_id` di field `articles.prompt_version`.

**Weekly evolution** (bagian dari proses Analis Agent, Sabtu 21:00):
1. Group artikel per `prompt_version_id`
2. Hitung rata-rata `quality_score` dan `eeat_score` per versi (minimum 20 sampel)
3. Jika versi A memiliki rata-rata 5+ poin lebih tinggi dari versi B di agent yang sama:
   - Versi A → `status = 'champion'`, `is_active = true`
   - Versi B → `status = 'deprecated'`, `is_active = false`
4. 10% dari pipeline secara random: pilih prompt dari `status = 'experimental'` (jika ada) untuk A/B testing

**Cara membuat versi baru**: di halaman Settings → Prompt Templates → "Create Variation" → otomatis dibuat sebagai `experimental`

---

### Step 10.5 — Smart Timing Learner

Setelah 30 hari data terkumpul (Analis Agent, bagian dari laporan mingguan):

1. Query:
   ```sql
   SELECT
     EXTRACT(HOUR FROM published_at) AS hour,
     category,
     AVG((quality_score + eeat_score) / 2) AS avg_score,
     COUNT(*) AS sample_count
   FROM articles
   WHERE status = 'published'
     AND published_at > NOW() - INTERVAL '30 days'
   GROUP BY 1, 2
   HAVING COUNT(*) >= 5
   ORDER BY 2, 3 DESC
   ```
2. Identifikasi: untuk setiap kategori, jam publish mana yang korelasi dengan skor tertinggi?
3. Jika ada korelasi jelas (perbedaan > 10 poin antara jam terbaik dan terburuk): update `SMART_TIMING` config untuk kategori tersebut
4. Log perubahan ke `system_logs` dan tampilkan di dashboard Analytics

---

## ══════════════════════════════════════════════════
## FASE 11 — HARDENING & PRODUCTION READY
## ══════════════════════════════════════════════════

**Tujuan**: Sistem siap berjalan di production dengan zero silent failure.  
**Prasyarat**: Semua fase 0–10 selesai dan diuji.

---

### Step 11.1 — Comprehensive Logging

Setiap aksi agent, setiap error, setiap job completion → insert ke `system_logs`:

```json
{
  "level": "info | warn | error | critical",
  "agent": "ReporterAgent | WriterAgent | ...",
  "message": "Deskripsi singkat kejadian",
  "metadata": {
    "articleId": "...",
    "siteId": "...",
    "provider": "gemini",
    "latencyMs": 1240,
    "error": { "code": "...", "detail": "..." }
  },
  "created_at": "ISO8601"
}
```

Log rotation: cron tengah malam → `DELETE FROM system_logs WHERE created_at < NOW() - INTERVAL '30 days'`

Log viewer di dashboard (Halaman Settings → Logs):
- Filter: level, agent, site, tanggal dari–sampai
- Search: free text di `message`
- Export: download sebagai CSV

---

### Step 11.2 — Alert & Notification System

Alert types yang terdaftar:

| Alert Type | Severity | Trigger |
|---|---|---|
| `key_warning` | Warning | Key mencapai 80% limit |
| `key_critical` | Critical | Key mencapai 95% limit |
| `key_exhausted` | Critical | Key 100% habis |
| `key_error_flood` | Critical | Key error > 10× dalam 1 jam |
| `pipeline_stuck` | Warning | Job processing > 30 menit |
| `wordpress_auth_error` | Critical | WP 401 — credentials invalid |
| `all_keys_exhausted` | Critical | Semua key provider exhausted |
| `quality_gate_fail_streak` | Warning | 5+ artikel berturut gagal QC |
| `dead_job_queue_growing` | Warning | Dead jobs > 10 dalam 24 jam |

Semua alert disimpan di `system_logs` dengan level yang sesuai.
Dashboard Alert Bar: tampilkan semua alert aktif (24 jam terakhir), bisa dismiss per item.

---

### Step 11.3 — Rate Limiting & Protection

- Global rate limiter: 100 req/menit per IP pada semua endpoint `/api/v1/`
- Auth endpoint: 10 req/menit per IP (anti brute force)
- Timeout semua external calls:
  - LLM API: 60 detik
  - WordPress API: 30 detik
  - RSS/Scraper: 20 detik
  - Image API: 45 detik
- Request body size limit: 2MB
- SQL injection protection: semua query menggunakan parameterized queries (tidak ada string interpolation)

---

### Step 11.4 — Data Backup & Portability

Endpoint `GET /api/v1/settings/export` (admin only):
```json
{
  "exported_at": "ISO8601",
  "sites": [{ semua config, tanpa WP credentials plaintext }],
  "sources": [...],
  "prompt_versions": [...],
  "settings": {...},
  "articles_count": 1240,
  "note": "API keys tidak di-export karena alasan keamanan"
}
```

Import: `POST /api/v1/settings/import` — restore config dari file export

---

### Step 11.5 — Performance Optimization

Database:
- Index pada: `articles(site_id, status)`, `articles(published_at)`, `job_queue(status, priority, scheduled_at)`, `system_logs(level, created_at)`, `api_keys(provider, status)`
- Connection pool: `pg` pool min 2, max 10

API:
- Response caching untuk: `GET /api/v1/sources` (5 menit), `GET /api/v1/settings` (1 menit)
- Pagination wajib pada semua endpoint yang return list (default 20, max 100)
- `gzip` compression untuk semua response > 1KB

Frontend:
- React Query dengan `staleTime: 30000` untuk data yang tidak perlu real-time
- Komponen berat (chart, table besar) di-lazy load
- Image placeholder loading state di semua tempat

---

*Setiap langkah dalam 12 fase ini adalah kontrak teknis yang terverifikasi. Tidak ada fase yang dianggap selesai jika outputnya belum bisa dibuktikan berjalan.*

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

**Versi**: 2.0.0 | **Status**: Approved for Development — Build Phases Fully Integrated  
**Total**: 21 Bab | 3.413 baris | 12 Fase Build | 50+ Step Detail
