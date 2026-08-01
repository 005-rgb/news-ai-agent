---
name: Phase 10 Innovation Layer
description: Implementation details and integration points for Phase 10 — all 5 steps, all gaps closed.
---

# Phase 10 — Innovation Layer

## Step 10.1 — Persona Memory Builder
- `server/agents/personaMemoryBuilder.js` — `PersonaMemoryBuilder.buildForArticle(articleId, siteId)`
- Called **non-blocking** via `setImmediate` in `publisher.js` after successful WP publish
- Two LLM calls: (1) extract fingerprint JSON, (2) merge into narrative
- Stores in `sites.persona_memory` (TEXT column, cumulative enrichment)
- Writer uses it: `writer.js:36-45` queries `sites.persona_memory` → injected as `{{PERSONA}}` in prompt
- **Why non-blocking:** persona build failure must never break the publish flow

## Step 10.2 — Evergreen Update Engine
- `server/services/evergreenEngine.js` — `scanAndEnqueueEvergreenUpdates()` + `EvergreenUpdateProcessor`
- Cron: 02:00 WIB daily (in `scheduler.js`)
- Job type: `EVERGREEN_UPDATE` (registered in `jobQueue.js` dispatchJob switch)
- Scanner filter: `is_evergreen_candidate = true OR format IN (evergreen/feature/jurnal_review/feature_opini/berita_mendalam)` — PRD requires is_evergreen_candidate; OR format kept as fallback
- Max 5 articles per night, staggered 10 min each
- Pipeline: research update → LLM check hasUpdate → generate HTML update section → prepend to content → update WP post

## Step 10.3 — Link Intelligence Network
- `server/services/linkIntelligence.js` — `findCrossSiteLinks()`, `recordLinks()`, `getLinkNetworkStats()`, `getTopLinkedArticles()`
- DB table: `article_links` (source_article_id, target_article_id, target_url, anchor_text, is_cross_site, UNIQUE constraint)
- Integrated into `seoSpecialist.js`: runs alongside `findInternalLinks`, results merged (same-site + cross-site, max 5 total)
- `seoData.outbound_links` now populated: all internalLinks + externalLinks as flat array with url/anchor/type fields
- `recordLinks()` called after SEO save — non-blocking `.catch(() => {})`
- Limit: max 3 cross-site links per article, max 5 incoming per article per 30 days

## Step 10.4 — Prompt Evolution System
- `server/services/promptEvolution.js` — `runWeeklyEvaluation()`, `maybeSelectExperimental()`, admin functions
- Cron: Sunday 23:00 WIB (in `scheduler.js`)
- 10% A/B test: `maybeSelectExperimental(champion, format)` called in `writer.js` after `loadDbTemplate`
- Promotion: challenger with ≥ 20 real samples AND avg_quality ≥ champion + 5 pts → promoted to champion
- `articles.prompt_version` saved in writer.js UPDATE
- Admin endpoints: POST /api/v1/analytics/prompts/:id/promote|deprecate|experimental
- **"Buat Variasi" button** now in Settings → Prompt Templates card (calls `createVariation(tpl)`) — creates copy with status=experimental, PRD requirement

## Step 10.5 — Smart Timing Learner
- `server/services/smartTimingLearner.js` — `runTimingAnalysis()`, `getSmartTimingForCategory()`, `getSmartTimingSummary()`
- Cron: Saturday 22:00 WIB (in `scheduler.js`)
- Stores per-category best_hour + confidence in `sites.config.smart_timing` JSONB
- **Scheduler now reads `cfg.smart_timing`** in `setupSiteCrons()`: for each category with confidence ≥ 0.60, learned best_hour is added to site's posting times array
- Min 10 samples per category + confidence ≥ 0.60 before applying
- Analytics endpoint: GET /api/v1/analytics/smart-timing + POST /run

## DB Changes
- `article_links` table in `MIGRATION_SQL` in `db.js`
- `sites.config` JSONB already existed — no column change needed for smart_timing
- `articles.is_evergreen_candidate` BOOLEAN column exists (used by scanner)

## Analytics Dashboard (Analytics.jsx)
- 12 tabs total: 8 original + Smart Timing, Link Network, Evergreen Updates, Persona
- All 4 Phase 10 tabs render real data from DB endpoints

## Server startup
- Phase string: "Phase 10 — Innovation Layer" throughout
