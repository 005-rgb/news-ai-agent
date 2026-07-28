---
name: Phase 1 & 2 completion
description: Phase 1 bugs fixed and Phase 2 Source Intelligence fully implemented
---

## Phase 1 Bugs Fixed

**LLM Router retry** — was using `Object.keys(PROVIDERS)` for fallback order; now calls `keyPool.getFallbackChain()` which reads the DB-configured chain. `getFallbackChain` now exported from keyPool.js.

**Alert log window** — `GET /api/v1/keys/alerts` was querying 6h window; changed to 24h per PRD spec.

**latencyMs tracking** — `recordUsage(keyId, tokensUsed, latencyMs)` now accepts latency and stores exponential-weighted `avg_response_time_ms` in `api_keys.metadata` JSONB. Keys with latency > 5000ms get `status = 'degraded'`; keys with latency < 2000ms that were degraded auto-restore to `active`.

**`degraded` status** — new status added throughout: selectBestKey includes it, resetDailyUsage/resetExpiredRollingKeys clear it, alerts endpoint shows it, ApiKeys.jsx has purple badge for it.

**Overview.jsx alerts bug** — `setAlerts(al.data || [])` was setting alerts to the full data object (not the array). Fixed to `al.data?.alerts || []`. Alert display fields corrected (severity not level).

**Usage stats daily cron** — `tokens_used` was hardcoded 0; now sums from api_keys.usage_today. Added `ON CONFLICT (date, site_id) DO UPDATE` to prevent duplicate rows.

**`usage_stats` unique constraint** — added `UNIQUE (date, site_id)` via DO block in migration SQL.

## Phase 2 — Source Intelligence

**Step 2.1** — Seed data expanded from 30 → 68 sources covering all 9 PRD categories: politik, akademik, teknologi, bisnis, kesehatan, hukum, sains, olahraga, internasional. Verified in logs: `[DB] Sources table: 68 records.`

**Step 2.2** — `server/services/fetchers/rss.js` was already real. ✅

**Step 2.3** — `server/services/fetchers/academic.js` was already real (PubMed, arXiv, Semantic Scholar). ✅

**Step 2.4** — `server/services/fetchers/scraper.js` was already real (robots.txt + rate limiting). ✅

**Step 2.5** — Created `server/services/sourceSelector.js`:
  - `selectSources(category, count=3)` — queries DB, orders by credibility_score DESC, deprioritises sources still in cache window
  - `fetchFromSource(source, query)` — dispatches to rss/academic/scraper fetcher by source.type
  - `updateLastFetched(sourceId)` — marks source as recently fetched
  - `getSourcesByIds(ids)` — batch fetch by ID array

**Step 2.6** — `server/routes/sources.js` was already complete (GET/POST/PATCH/DELETE/toggle/test). ✅

**Sources.jsx** — CATEGORIES updated to include `sains` and `internasional` (was missing both).

## What:
- **Why:** PRD requires Phase 1 100% before Phase 2; multiple bugs would cause silent failures in production (wrong alert window, bad fallback ordering, no latency tracking)
- **How to apply:** Don't add new LLM provider retries without calling getFallbackChain(). Always pass latencyMs to recordUsage(). The 'degraded' status is functional — keys auto-restore.
