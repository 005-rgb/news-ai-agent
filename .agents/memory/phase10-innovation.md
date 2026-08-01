---
name: Phase 10 Innovation Layer
description: Implementation details and integration points for Phase 10 — all 5 steps.
---

# Phase 10 — Innovation Layer

## Step 10.1 — Persona Memory Builder
- `server/agents/personaMemoryBuilder.js` — `PersonaMemoryBuilder.buildForArticle(articleId, siteId)`
- Called **non-blocking** via `setImmediate` in `publisher.js` after successful WP publish
- Two LLM calls: (1) extract fingerprint JSON, (2) merge into narrative
- Stores in `sites.persona_memory` (TEXT column, cumulative enrichment)
- **Why non-blocking:** persona build failure must never break the publish flow

## Step 10.2 — Evergreen Update Engine
- `server/services/evergreenEngine.js` — `scanAndEnqueueEvergreenUpdates()` + `EvergreenUpdateProcessor`
- Cron: 02:00 WIB daily (in `scheduler.js`)
- Job type: `EVERGREEN_UPDATE` (registered in `jobQueue.js` dispatchJob switch)
- Criteria: published > 30 days, format in evergreen/feature/jurnal_review/feature_opini/berita_mendalam, quality >= 60, site active, no pending EVERGREEN_UPDATE job
- Max 5 articles per night, staggered 10 min each
- Pipeline: research update → LLM check hasUpdate → generate HTML update section → prepend to content → update WP post

## Step 10.3 — Link Intelligence Network
- `server/services/linkIntelligence.js` — `findCrossSiteLinks()`, `recordLinks()`, `getLinkNetworkStats()`, `getTopLinkedArticles()`
- DB table: `article_links` (source_article_id, target_article_id, target_url, anchor_text, is_cross_site, UNIQUE constraint)
- Integrated into `seoSpecialist.js`: runs alongside existing `findInternalLinks`, results merged (same-site + cross-site, max 5 total)
- `recordLinks()` called after SEO save — non-blocking `.catch(() => {})`
- Limit: max 3 cross-site links per article, max 5 incoming per article per 30 days
- **Why cross-site:** PRD spec says query across all 8 sites to build topical authority network

## Step 10.4 — Prompt Evolution System
- `server/services/promptEvolution.js` — `runWeeklyEvaluation()`, `maybeSelectExperimental()`, admin functions
- Cron: Sunday 23:00 WIB (in `scheduler.js`)
- 10% A/B test: `maybeSelectExperimental(champion, format)` called in `writer.js` after `loadDbTemplate`
- Promotion: challenger with ≥ 20 real samples AND avg_quality ≥ champion + 5 pts → promoted to champion
- `articles.prompt_version` is NOW saved in writer.js UPDATE (added `prompt_version = COALESCE($5, prompt_version)`)
- Admin endpoints: POST /api/v1/analytics/prompts/:id/promote|deprecate|experimental
- `experimental` status added to prompt_versions flow

## Step 10.5 — Smart Timing Learner
- `server/services/smartTimingLearner.js` — `runTimingAnalysis()`, `getSmartTimingForCategory()`, `getSmartTimingSummary()`
- Cron: Saturday 22:00 WIB (in `scheduler.js`)
- Stores per-category best_hour + confidence in `sites.config.smart_timing` JSONB (no new column needed)
- Min 10 samples per category + confidence ≥ 0.60 before applying
- Analytics endpoint: GET /api/v1/analytics/smart-timing + POST /run

## DB Changes
- Added `article_links` table to `MIGRATION_SQL` in `db.js` (between trend_predictions and indexes)
- Indexes: idx_article_links_source, idx_article_links_target, idx_article_links_cross
- `sites.config` JSONB already existed — no column change needed for smart_timing

## Analytics Dashboard (Analytics.jsx)
- TABS extended: +Smart Timing, +Link Network, +Evergreen Updates, +Persona (12 total)
- Prompt Evolution tab: added action buttons (promote ★, A/B, deprecate) + "Run Evaluation" button
- load() fetches Phase 10 data in parallel: smartTiming, linkNetwork, evergreenUpdates
- Persona tab: site selector + persona_memory display (LLM-built narrative) + persona_description fallback

## Server startup
- Phase string updated to "Phase 10 — Innovation Layer" throughout (index.js, Login.jsx, Layout.jsx, Settings.jsx)
