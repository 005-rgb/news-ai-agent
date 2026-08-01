---
name: Phase 11 Hardening
description: Alert system, caching, graceful shutdown, enhanced health check, backup/restore — all Phase 11 production hardening details
---

# Phase 11 — Hardening & Production Ready

## Step 11.1 — Comprehensive Logging
- Logger sudah ada sejak awal; critical logs sekarang auto-trigger `alertService.createAlert()` (non-blocking via `setImmediate`)
- Log rotation cron: 02:00 UTC, hapus `system_logs` > 30 hari

## Step 11.2 — Alert & Notification System
- Tabel baru: `system_alerts` (id, type, severity, title, message, metadata JSONB, is_resolved, resolved_at, created_at)
- Index: `idx_system_alerts_active` dan `idx_system_alerts_type`
- Service: `server/services/alertService.js` — createAlert (dengan dedup by `metadata.dedupeKey`), resolveAlert, resolveAlertsByType, resolveAll, getActiveAlerts, getAllAlerts, getAlertCount, runAlertScan
- 5 alert types: `key_exhausted`, `key_warning`, `pipeline_stuck`, `wordpress_error`, `quality_gate_fail_streak`
- Routes: `server/routes/alerts.js` → `GET /api/v1/alerts`, `GET /api/v1/alerts/count`, `PATCH /api/v1/alerts/:id/resolve`, `POST /api/v1/alerts/resolve-all`, `POST /api/v1/alerts/scan`
- Cron: setiap 5 menit panggil `runAlertScan()`
- Overview.jsx: menggunakan `/api/v1/alerts` (bukan apiKeys.alerts), ada tombol resolve per-alert + resolve-all

## Step 11.3 — Rate Limiting
- `writeLimiter` (60 req/min) — untuk operasi write umum
- `importLimiter` (5 req/min) — untuk export/import endpoint
- `pipelineLimiter` (10 req/min) — untuk pipeline trigger
- Semua diexport dari `server/middleware/rateLimiter.js`

## Step 11.4 — Data Backup
- Export enhanced: `GET /api/v1/settings/export?include_articles=true&articles_limit=500`
  - Mencakup: sites (tanpa WP creds), sources, prompt_versions, system_settings, optional article metadata
- Import: `POST /api/v1/settings/import` — upsert by id untuk sites/sources/prompt_versions, allowed keys untuk system_settings
- Settings.jsx tab renamed dari "Export" → "Backup & Restore", ada UI pilih file + preview apa yang diimport

## Step 11.5 — Performance Optimization
- `server/utils/cache.js` — in-memory TTL cache dengan `cacheMiddleware(ttlMs, keyFn)` Express middleware factory
- Applied to analytics endpoints: overview (30s), production (60s), pipeline (30s), providers (5min), eeat-weekly (5min), prompts (5min), evergreen (15min), error-rate (5min)
- Cache clear cron: setiap jam
- DB indexes dan connection pool sudah ada sejak awal

## Graceful Shutdown
- `SIGTERM` + `SIGINT` handler di `server/index.js`
- Urutan: `server.close()` → `stopWorker()` → `pool.end()` → `process.exit(0)`
- Force-exit timeout: 10 detik

## Enhanced Health Check
- `GET /api/v1/health` sekarang mengembalikan: queue (pending, processing), lastJobAt, activeAlerts, memory (heap/rss MB), uptime, phase: "Phase 11 — Production Ready"

**Why:** Production readiness — sistem harus bisa monitor dirinya sendiri, alert saat ada masalah, shutdown bersih, dan tidak overload DB dengan query berulang.
