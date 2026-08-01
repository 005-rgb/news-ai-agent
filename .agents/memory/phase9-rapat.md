---
name: Phase 9 — Rapat Redaksi Engine
description: Full implementation details and architecture decisions for Phase 9 (trend fetching, competitor scanning, runRapat orchestration)
---

## What was built

**Phase 9 — Rapat Redaksi Engine** is now complete. Five steps:

### Step 9.1 — Google Trends Integration (`server/services/trendFetcher.js`)
- Fetches `https://trends.google.com/trending/rss?geo=ID` (public RSS, no auth)
- Also tries Google Trends Realtime JSON endpoint (hidden API, best-effort)
- Merges + dedupes both sources; classifies each keyword into 10 Indonesian categories
- Runs every 6 hours (merged into the existing source-refresh cron)
- Stores to `trend_predictions` table; deletes today's `predicted` entries before insert (daily refresh)

### Step 9.2 — Trend Prediction Engine (`server/agents/chiefEditor.js` → `predictTrends()`)
- LLM takes raw trend signals → outputs 10 predicted topics with confidence scores
- Cross-checks against existing articles (keywordOverlap ≥ 0.5 → skip duplicate)
- Saves to `trend_predictions` with `source_signals.source = 'llm_prediction'`
- Called during Monday 06:30 cron and as part of `runRapat()`

### Step 9.3 — Competitor Gap Scanner (`server/services/competitorScanner.js`)
- Tries 6 candidate RSS URLs per competitor (e.g., `/feed/`, `/rss/`, `/rss.xml`, etc.)
- Filters articles from last 7 days; falls back to latest 20 if all are older
- Identifies gaps using Jaccard similarity < 0.30 threshold (30%)
- 3-second polite rate limit between competitors
- Saves `topics_covered` (array) + `gap_opportunities` (JSONB) to `competitor_data`
- Saturday 20:00 WIB cron

### Step 9.4 — Performance Analyzer (`server/agents/analyst.js` → `analyzePerformance()`)
- Added to AnalystAgent alongside existing `generateWeeklyReport()`
- Returns: format perf, provider perf, prompt version champion, evergreen candidates, category breakdown, quality gate stats, pattern recommendations
- Saturday 21:00 WIB cron (pre-rapat prep)

### Step 9.5 — Content Calendar + Notulen (`server/agents/chiefEditor.js` → `runRapat()`)
- Full orchestration: perf report → trend signals → predictTrends → competitor gaps → per-site calendar → notulen
- If `trend_predictions` has < 3 recent entries, triggers a fresh `refreshTrends()` automatically
- Per-site calendar uses: 60% trending, 30% evergreen new, 10% update old articles
- LLM generates 7-day × articles_per_day items per site
- Graceful fallback if LLM fails (creates 7 generic slots)
- Saves to `content_calendar` with `rapat_session_id` FK
- Generates notulen via LLM (300-500 kata, markdown sections with emoji)
- Saves to `rapat_notes`; handles both unique constraint (ON CONFLICT) and plain INSERT
- Monday 07:00 WIB cron

## Key decisions

**Why RSS not google-trends-api npm package?**
The `google-trends-api` npm package is not in package.json and has CORS/auth issues in server environments. RSS `https://trends.google.com/trending/rss?geo=ID` is free, public, and reliable.

**Why `rss-parser` with customFields for `ht:approx_traffic`?**
Google Trends RSS uses `ht:` XML namespace for traffic data. The `customFields.item` config in rss-parser maps `ht:approx_traffic` to `approxTraffic`. Without this, traffic is `undefined` and confidence defaults to 0.5.

**Why delete today's predicted entries before re-inserting?**
Prevents duplicates on multiple daily runs. Only deletes entries with `status = 'predicted'` (not `confirmed`/`missed`).

**Why ON CONFLICT + fallback INSERT for rapat_notes?**
If `session_date` has a unique constraint, `ON CONFLICT DO UPDATE` upserts. If the constraint doesn't exist (older DB), the catch block retries with plain INSERT.

**Competitor gap threshold: 0.30 (30% Jaccard)**
Lower than duplicate-check threshold (0.7). Intentionally permissive — we want to flag any topic the competitor covers that we haven't fully explored.

## New routes

- `POST /api/v1/rapat/trends/refresh` — manual trend fetch
- `GET  /api/v1/rapat/performance?days=7` — Phase 9.4 analysis
- `GET  /api/v1/rapat/competitor-gaps?site_id=...` — gap opportunities
- `POST /api/v1/rapat/competitor` — register competitor URL
- `DELETE /api/v1/rapat/competitor/:id` — remove competitor
- `POST /api/v1/rapat/trigger` — now calls full `runRapat()` (previously stubbed)

## New client api.js methods

`rapat.refreshTrends()`, `rapat.performance(days)`, `rapat.competitorGaps(siteId)`, `rapat.addCompetitor(data)`, `rapat.deleteCompetitor(id)`

## New crons in scheduler.js

All in `Asia/Jakarta` timezone:
- Trend refresh: merged into existing `0 */6 * * *` cron (alongside source refresh)
- Competitor scan: `0 20 * * 6` (Saturday 20:00)
- Performance analysis: `0 21 * * 6` (Saturday 21:00)
- Trend prediction fresh fetch: `30 6 * * 1` (Monday 06:30)
- Rapat Redaksi: `0 7 * * 1` (Monday 07:00)
