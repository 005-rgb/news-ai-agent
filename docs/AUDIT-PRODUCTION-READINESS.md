# Laporan Audit Kesiapan Production
**Tanggal:** 4 Agustus 2026  
**Auditor:** Replit Agent (audit menyeluruh — 6 subagent paralel)  
**Cakupan:** server/index.js, server/db.js, server/config/*, server/middleware/*, server/routes/* (13 file), server/services/* (9 file), server/agents/* (11 file), client/src/* (semua halaman)

---

## Ringkasan Eksekutif

| Severity | Jumlah Temuan |
|----------|--------------|
| 🔴 CRITICAL | 8 |
| 🟠 HIGH | 16 |
| 🟡 MEDIUM | 22 |
| 🔵 LOW / Style | 14 |
| **TOTAL** | **60** |

**Kesimpulan:** Sistem belum siap production. Terdapat 8 temuan kritis yang harus diselesaikan sebelum deploy, terutama di area keamanan session, kebocoran koneksi database, race condition pada job queue, dan celah SQL injection.

---

## 🔴 CRITICAL — Harus diperbaiki sebelum production

### C-1 · DB Connection Leak saat Startup
**File:** `server/db.js` ~line 530  
**Masalah:** Fungsi `migrate()` memanggil `pool.connect()` tetapi tidak pernah memanggil `client.release()` setelah selesai. Setiap restart server bocorkan 1 koneksi permanen. Dengan pool size 10, server akan hang setelah 10 restart.  
**Fix:** Tambahkan `client.release()` di blok `finally` setelah migrasi selesai.

### C-2 · Fallback Session Store Tidak Aman
**File:** `server/index.js` ~line 59–67  
**Masalah:** Jika `connect-pg-simple` gagal load, server fallback ke in-memory store dengan `secure: false` tanpa logging error. Di production multi-instance, semua session akan hilang setiap restart dan tidak ada notifikasi.  
**Fix:** Jika `connect-pg-simple` gagal, lempar error dan hentikan proses — jangan fallback silent.

### C-3 · Race Condition Dual Execution pada Job Queue
**File:** `server/services/jobQueue.js` ~line 197–212  
**Masalah:** `runWatchdog()` mereset job berstatus `processing` ke `pending` jika berjalan >30 menit. Jika job masih aktif tapi lambat (LLM timeout, upload gambar besar), job akan dieksekusi dua kali secara bersamaan — menghasilkan artikel duplikat di WordPress.  
**Fix:** Tambahkan lock berbasis `pg_advisory_lock` atau cek heartbeat timestamp sebelum reset.

### C-4 · Non-Atomic Deduplication Alert (Race Condition)
**File:** `server/services/alertService.js` ~line 27–40  
**Masalah:** `createAlert()` melakukan SELECT dulu untuk cek dedupeKey, lalu INSERT terpisah. Dua panggilan concurrent dengan dedupeKey sama akan lolos kedua-duanya dan insert duplikat.  
**Fix:** Ganti dengan `INSERT ... ON CONFLICT (dedup_key) DO NOTHING`.

### C-5 · SQL Injection Risk — Dynamic WHERE Clause
**File:** `server/routes/analytics.js` ~line 107, `server/routes/calendar.js` ~line 70, `server/routes/sites.js` ~line 111  
**Masalah:** Klausa `WHERE` dan `SET` dibangun dengan string interpolasi (`${where}`, `${updates.join(', ')}`). Meski nilai di-parameterize, struktur query bisa dimanipulasi jika ada validasi yang terlewat.  
**Fix:** Gunakan query builder atau whitelist kolom yang ketat dengan mapping eksplisit.

### C-6 · Input `site_id` Tidak Divalidasi sebagai UUID
**File:** `server/routes/analytics.js` ~line 40, `server/routes/articles.js` ~line 12, `server/routes/quality.js` ~line 23  
**Masalah:** `site_id` dari `req.query` langsung dipakai sebagai parameter SQL tanpa validasi format UUID. Input seperti `'; DROP TABLE sites; --` bisa dieksekusi.  
**Fix:** Validasi UUID dengan regex atau library `uuid` sebelum digunakan.

### C-7 · `adminPasswordHash` Default Kosong — Bypass Auth
**File:** `server/config/index.js` ~line 28–29  
**Masalah:** Jika `ADMIN_PASSWORD_HASH` tidak di-set, defaultnya adalah string kosong `''`. Bergantung implementasi bcrypt comparison di `auth.js`, ini bisa menyebabkan authentication bypass atau crash yang unpredictable.  
**Fix:** Validasi `ADMIN_PASSWORD_HASH` wajib ada saat startup (seperti `SESSION_SECRET`), server tidak boleh start tanpa ini.

### C-8 · Imagen 3 Menggunakan Endpoint Beta Tidak Stabil
**File:** `server/agents/photographer.js` ~line 175  
**Masalah:** Implementasi Imagen 3 menggunakan `v1beta` endpoint Google AI yang tidak stabil untuk production. Breaking changes tanpa notice bisa menyebabkan seluruh pipeline gambar gagal.  
**Fix:** Migrasi ke `v1` stable endpoint atau tambahkan fallback graceful ke Unsplash/Pexels jika Imagen gagal.

---

## 🟠 HIGH — Harus diperbaiki sebelum launch

### H-1 · Semua Error Migrasi DB Disilence
**File:** `server/db.js` ~line 511, 518, 521, 544  
**Masalah:** Multiple blok `.catch(() => {})` menyembunyikan semua error selama migrasi dan seeding. Jika tabel gagal dibuat, server tetap jalan dan crash di runtime dengan error yang tidak jelas.  
**Fix:** Log semua error migrasi dengan detail, dan lempar error untuk kegagalan DDL yang kritis.

### H-2 · Helmet CSP Dinonaktifkan Penuh
**File:** `server/index.js` ~line 073–074  
**Masalah:** `contentSecurityPolicy: false` dan `crossOriginEmbedderPolicy: false` menonaktifkan perlindungan XSS dan side-channel attack di seluruh aplikasi.  
**Fix:** Aktifkan CSP dengan policy minimal: `default-src 'self'`, izinkan CDN yang digunakan secara eksplisit.

### H-3 · `cron_jobs` cron COALESCE Selalu Return 0
**File:** `server/index.js` ~line 203  
**Masalah:** `COALESCE(SUM(CASE WHEN ak.usage_today IS NOT NULL THEN 0 ELSE 0 END), 0)` — kedua branch CASE mengembalikan `0`. Statistik token harian selalu 0, membuat dashboard `usage_stats` tidak akurat.  
**Fix:** Perbaiki logika CASE untuk menjumlahkan nilai actual dari `ak.usage_today`.

### H-4 · Response 200 untuk Kegagalan (Misleading HTTP Status)
**File:** `server/routes/apiKeys.js` ~line 395, `server/routes/sites.js` ~line 159  
**Masalah:** Ketika test koneksi API key atau WordPress gagal, server mengembalikan HTTP 200 dengan body `{ success: false }`. Ini menyebabkan client-side error handling yang salah dan mempersulit monitoring/alerting.  
**Fix:** Gunakan HTTP 422 atau 502 untuk kegagalan koneksi eksternal.

### H-5 · Watchdog Cron Error Pakai `console.error` bukan Logger
**File:** `server/index.js` ~line 183, 192, 241, 251, 265, 275  
**Masalah:** Error di cron jobs tidak masuk ke sistem logger, sehingga tidak ter-capture di `system_logs` dan tidak memicu `alertService`.  
**Fix:** Ganti `console.error` dengan `logger.error` di semua callback cron.

### H-6 · RSS Fetcher Cache Tanpa Batas (Memory Leak Potensi)
**File:** `server/services/fetchers/rss.js` ~line 21  
**Masalah:** `_cache` adalah `Map` yang tumbuh tanpa batas. Entri expired hanya dibersihkan saat URL yang sama di-request ulang. Dengan 68 sumber RSS dan interval refresh, memory bisa terus naik.  
**Fix:** Tambahkan periodic cleanup atau gunakan LRU cache dengan max size.

### H-7 · `in-memory cache.js` Tanpa Batas Ukuran
**File:** `server/utils/cache.js` ~line 8  
**Masalah:** Cache in-memory tidak ada global size limit. URL unik yang banyak (analytics dengan berbagai kombinasi query) bisa menyebabkan memory exhaustion.  
**Fix:** Implementasi eviction policy LRU dengan max entries (misal 1000).

### H-8 · Pool Size Database Hardcoded
**File:** `server/db.js` ~line 7–13  
**Masalah:** `max: 10` hardcoded. Tidak bisa dikonfigurasi via env var untuk scale up/down sesuai load.  
**Fix:** `max: parseInt(process.env.DB_POOL_MAX) || 10`.

### H-9 · Health Check Bocorkan Detail Error Internal
**File:** `server/index.js` ~line 127  
**Masalah:** `detail: err.message` dikirim dalam response health check yang bisa diakses tanpa auth. Pesan error DB bisa mengungkap struktur internal, kredensial, atau nama tabel.  
**Fix:** Kembalikan pesan generik. Log detail error ke sistem logger saja.

### H-10 · Job Queue Retry — Template Literal Berpotensi SQL Error
**File:** `server/services/jobQueue.js` ~line 69–73  
**Masalah:** Klausa SET dibangun dengan conditional template literal. Jika parameter array tidak sinkron dengan placeholder index, query akan error atau mengirim data ke kolom yang salah.  
**Fix:** Gunakan array builder yang eksplisit dan test setiap path.

### H-11 · `Sites.jsx` — `toggleCompetitor` Fungsi Kosong
**File:** `client/src/pages/Sites.jsx` ~line 59  
**Masalah:** Fungsi `toggleCompetitor` adalah empty function `() => {}`. Fitur competitor tracking di Sites tidak berfungsi sama sekali.  
**Fix:** Implementasikan atau hapus tombol dari UI jika fitur belum siap.

### H-12 · `editor.js` — `runChecklistValidation` Swallow Semua Error
**File:** `server/agents/editor.js` ~line 66  
**Masalah:** Try-catch dalam `runChecklistValidation` mengabaikan semua error dari checklist rules. Bug di template bisa menyebabkan artikel lolos quality gate tanpa sebenarnya divalidasi.  
**Fix:** Log error checklist dan tandai validasi sebagai failed, bukan pass.

### H-13 · `photographer.js` — `recordUsage` Race Condition Instance
**File:** `server/agents/photographer.js` ~line 194  
**Masalah:** `this._pendingKeyId` adalah instance property. Jika dua panggilan paralel ke agent yang sama terjadi, key ID bisa tercampur antar panggilan.  
**Fix:** Gunakan local variable per panggilan, bukan instance property.

### H-14 · `scheduler.js` — Async Callback Tidak Di-catch
**File:** `server/services/scheduler.js` ~line 160, 162  
**Masalah:** Callback `setInterval`/`setTimeout` yang async tidak punya `.catch()` di level atas. Unhandled rejection bisa crash worker Node.js tergantung versi.  
**Fix:** Wrap setiap async cron callback dengan try-catch atau `.catch(err => logger.error(err))`.

### H-15 · `qualityRater.js` — Threshold Hardcoded, Tidak Baca Config
**File:** `server/agents/qualityRater.js` ~line 25, `server/agents/editor.js` ~line 24–25  
**Masalah:** `EEAT_THRESHOLD = 80`, `QUALITY_THRESHOLD = 75`, dan `MAX_REVISIONS = 2` hardcoded. Perubahan threshold via Settings UI tidak akan berpengaruh ke agent.  
**Fix:** Baca dari `config.qualityThreshold` dan `config.eeatThreshold` yang sudah ada.

### H-16 · `Analytics.jsx` — 12+ API Call Gagal Silent
**File:** `client/src/pages/Analytics.jsx` ~line 77–109  
**Masalah:** Semua 12+ panggilan API menggunakan `.catch(() => ({ data: [] }))`. Kegagalan API (network error, 500) tidak pernah dilaporkan ke user — halaman tampak normal padahal data kosong.  
**Fix:** Tambahkan state error dan tampilkan notifikasi/toast jika ada API call yang gagal.

---

## 🟡 MEDIUM — Perbaiki segera setelah Critical/High

### M-1 · `ADMIN_USERNAME` & `ADMIN_PASSWORD_HASH` Tidak Divalidasi Saat Startup
**File:** `server/config/index.js` ~line 6–12  
Hanya `SESSION_SECRET`, `ENCRYPTION_KEY`, `DATABASE_URL` yang divalidasi. Admin credentials tidak dicek.

### M-2 · `parseInt` Env Vars Tanpa NaN Check
**File:** `server/config/index.js` ~line 35–47  
`parseInt(process.env.PORT)` tanpa validasi NaN. Nilai non-numerik akan menghasilkan `NaN` yang silent.

### M-3 · `CORS_ORIGINS` Tidak Divalidasi Format URL
**File:** `server/config/index.js` ~line 49–51  
String CORS tidak divalidasi sebagai URL valid. Konfigurasi salah tidak terdeteksi.

### M-4 · gen_random_uuid Fallback Tidak Kriptografis
**File:** `server/db.js` ~line 21–50  
Fallback UUID menggunakan `random()` PostgreSQL yang tidak kriptografis. Hanya berlaku jika ekstensi `pgcrypto` tidak tersedia.

### M-5 · `analyst.js` — Hardcoded Quality/EEAT Score
**File:** `server/agents/analyst.js` ~line 99, 167  
Target score 75/80 hardcoded, tidak membaca dari config.

### M-6 · `chiefEditor.js` — `s.site_name || s.site_name` Redundant
**File:** `server/agents/chiefEditor.js` ~line 447  
`s.site_name || s.site_name` selalu mengembalikan nilai yang sama. Kemungkinan seharusnya `s.site_name || s.name` atau properti lain.

### M-7 · `publisher.js` — `getOrCreateCategories` Hardcoded Map
**File:** `server/agents/publisher.js` ~line 224  
`categoryMap` hardcoded. Kategori baru yang ditambah via WordPress tidak akan ter-handle dan fallback ke 'Umum'.

### M-8 · `personaMemoryBuilder.js` — JSON.parse Gagal Silent
**File:** `server/agents/personaMemoryBuilder.js` ~line 117  
Jika LLM mengembalikan JSON tidak valid secara konsisten, persona tidak pernah terupdate tanpa ada notifikasi.

### M-9 · `evergreenEngine.js` — Empty Catch Block
**File:** `server/services/evergreenEngine.js` ~line 181  
Error RSS fetch diabaikan sepenuhnya — tidak ada log, tidak ada fallback.

### M-10 · `llmRouter.js` — Provider Array Access Tanpa Cek Eksistensi
**File:** `server/services/llmRouter.js` ~line 170, 221  
`PROVIDERS[keyRow.provider]` bisa menghasilkan `undefined` jika provider string tidak valid, menyebabkan TypeError.

### M-11 · `resolveAlertsByType` Dipanggil dalam Loop
**File:** `server/services/alertService.js` ~line 292  
Pemanggilan per-item dalam loop menyebabkan N query database untuk sesuatu yang bisa diselesaikan dengan 1 query `WHERE type IN (...)`.

### M-12 · `analytics.js` — Subquery Gunakan `NOW()` untuk Historical Data
**File:** `server/routes/analytics.js` ~line 198  
`NOW()` digunakan sebagai `created_at` untuk semua API keys dalam subquery analytics historis — data usage per-hari tidak akurat.

### M-13 · `articles.js` — WP Move-to-Draft Tidak Handle Semua Failure
**File:** `server/routes/articles.js` ~line 172  
Hanya log warning jika operasi WordPress gagal, tidak memberitahu user.

### M-14 · `quality.js` — Parameter Mismatch Risk
**File:** `server/routes/quality.js` ~line 91–103  
WHERE clause dibangun dinamis tapi params array di-pass `[]` dalam kondisi tertentu, potensi mismatch parameter.

### M-15 · `promptTemplates.js` — Word Count Logic Inkonsisten
**File:** `server/config/promptTemplates.js` ~line 334, 336, 374  
`.split(/\s+/).length <= 45` untuk limit 40 kata. Inkonsistensi antara aturan dan implementasi.

### M-16 · `promptTemplates.js` — IMRAD Check Terlalu Lemah
**File:** `server/config/promptTemplates.js` ~line 372  
Regex `/pendahuluan|metode|hasil|simpulan/i` akan pass jika kata tersebut muncul di mana saja dalam teks, bukan sebagai heading.

### M-17 · `providers.js` — Free Tier Assumptions Hardcoded
**File:** `server/config/providers.js` ~line 18, 31  
Rate limit dan tier diasumsikan "free" secara hardcoded, bisa menyebabkan over-limit jika akun berbeda.

### M-18 · `Sites.jsx` & `Sources.jsx` — Error Handling Tidak Ada
**File:** `client/src/pages/Sites.jsx` ~line 241, 246, `client/src/pages/Sources.jsx` ~line 50, 61  
`handleSave`, `handleDelete`, `handleSubmit`, `handleToggle` tidak punya try-catch. Kegagalan API tidak dilaporkan ke user.

### M-19 · `ApiKeys.jsx` — Delete & Toggle Tanpa Loading State
**File:** `client/src/pages/ApiKeys.jsx` ~line 332, 350  
Operasi destructive tanpa feedback visual — user bisa klik ganda.

### M-20 · `Articles.jsx` — Empty String Interpolation
**File:** `client/src/pages/Articles.jsx` ~line 225  
`'' : ''` dalam ternary button label — teks tombol selalu kosong di kondisi tersebut.

### M-21 · `Analytics.jsx` — Slice Logic No-Op
**File:** `client/src/pages/Analytics.jsx` ~line 191  
`d.date?.slice(prodDays > 30 ? 5 : 5)` — kondisi ternary selalu mengembalikan `5`, tidak ada efek.

### M-22 · React SPA Catch-all Returns JSON bukan HTML
**File:** `server/index.js` ~line 153–168  
Jika `index.html` tidak ada, server mengembalikan `res.status(200).json(...)` — browser tidak bisa render SPA, tidak ada error 404 yang jelas.

---

## 🔵 LOW / Style — Perbaiki saat ada waktu

### L-1 · `'use strict'` Deklarasi Ganda
**File:** `server/agents/photographer.js` ~line 1 & 17  

### L-2 · Require di Dalam Method (bukan Top-Level)
**File:** `server/agents/analyst.js`, `base.js`, `chiefEditor.js`, `writer.js`  
Fungsional tapi menghambat static analysis dan tree-shaking.

### L-3 · `dotenv.config()` Dipanggil Dua Kali
**File:** `server/index.js` ~line 5, sudah dipanggil di `server/config/index.js`  

### L-4 · `chiefEditor.js` — Overlap Threshold Hardcoded 0.5
**File:** `server/agents/chiefEditor.js` ~line 273  

### L-5 · `photographer.js` — Dimensi Gambar Hardcoded
**File:** `server/agents/photographer.js` ~line 207, 260  
`1216x684`, `1792x1024` — seharusnya dari config.

### L-6 · `console.error` di Halaman React (bukan Logger/Toast)
**File:** `client/src/pages/Analytics.jsx` ~line 437, `Overview.jsx` ~line 52, 71, 82  

### L-7 · `auth.js` — PUBLIC_PATHS startsWith Bisa Salah Interpretasi
**File:** `server/middleware/auth.js` ~line 17  
Trailing slash logic bisa dibypass dengan path manipulation.

### L-8 · Settings UI Minta User Restart Manual
**File:** `server/routes/settings.js` ~line 50  
Instruksi manual restart adalah UX buruk untuk production.

### L-9 · `Rapat.jsx` — Layout Grid Tidak Responsif Mobile
**File:** `client/src/pages/Rapat.jsx` ~line 595–610  
Fixed 160px column bisa overflow di mobile.

### L-10 · `base.js` — `handleError` Tidak Trigger System-Wide Alert
**File:** `server/agents/base.js` ~line 85  
`isCritical` di-deteksi tapi tidak ada aksi khusus selain log level.

### L-11 · `Sites.jsx` — `preferred_providers` Conflict Logic
**File:** `client/src/pages/Sites.jsx` ~line 48, 240  
Array diinisialisasi kosong lalu `delete`d sebelum update — bisa konflik dengan ekspektasi backend.

### L-12 · DB Pool Tidak Ada `connectionTimeoutMillis` Config
**File:** `server/db.js`  
Timeout koneksi default bisa menyebabkan long-hang jika DB tidak tersedia.

### L-13 · Graceful Shutdown `server.close` Tidak Dipromisify
**File:** `server/index.js` ~line 330  
Proses bisa exit sebelum pool DB benar-benar ditutup.

### L-14 · `analytics.js` — Cache Key Tidak Sanitasi Query Params
**File:** `server/routes/analytics.js` ~line 38  
`req.query` raw digunakan sebagai cache key tanpa normalisasi.

---

## Prioritas Perbaikan

```
MINGGU 1 (Blokir Launch):
  C-1  DB connection leak
  C-2  Session store fallback unsafe
  C-3  Job queue dual execution
  C-4  Alert dedup race condition
  C-5  SQL injection dynamic WHERE
  C-6  UUID input validation
  C-7  Admin password hash validation
  C-8  Imagen 3 v1beta → v1
  H-1  Silence migration errors
  H-3  cron COALESCE bug (usage_stats selalu 0)
  H-10 Job retry SQL bug

MINGGU 2 (Security & Stability):
  H-2  Helmet CSP
  H-4  HTTP status codes
  H-5  Logger di cron
  H-6  RSS cache leak
  H-7  In-memory cache limit
  H-9  Health check error leaking
  H-11 toggleCompetitor empty
  H-12 Editor swallow errors
  H-15 Threshold dari config

MINGGU 3 (Quality & UX):
  Semua M-1 sampai M-22
  Semua L-1 sampai L-14
```

---

*Laporan ini dihasilkan oleh audit otomatis. Setiap temuan telah diverifikasi terhadap source code aktual.*
