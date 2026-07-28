---
name: Phase 3 Content Pipeline Core
description: Phase 3 fully implemented — 5 agents real (Reporter, Writer, Editor, QualityRater, Orchestrator)
---

## What was done

All Phase 3 stubs replaced with full real implementations:

**Reporter Agent** (`server/agents/reporter.js`)
- Calls `selectSources` → `fetchFromSource` → keyword filter
- LLM extracts facts/quotes/stats/timeline in JSON
- Cross-verifies across sources if >1 source available
- Calculates combined credibilityScore
- Enqueues WRITE job on completion

**Writer Agent** (`server/agents/writer.js`)
- Loads site persona from DB (`sites.persona_memory`)
- Loads prompt template from `server/config/promptTemplates.js`
- LLM generates JSON with title/content/faq/keyTakeaways/socialCaption/imagePlaceholders
- Validates word count against FORMAT_WORD_TARGETS per format
- Enqueues EDIT job on completion

**Editor Agent** (`server/agents/editor.js`)
- Duplication check: keyword overlap vs recent articles in same site
- LLM review: fact check vs brief, naturalness, structure fixes, quality score 0-100
- If score < 75 && revisionCount < 2: enqueues WRITE again with revision notes
- If passes: enqueues QC job

**Quality Rater Agent** (`server/agents/qualityRater.js`)
- LLM evaluates 6 dimensions: experience/expertise/authoritativeness/trustworthiness/aiDetection/searchIntent
- Weighted formula + LLM score blended for final eeAtScore
- AI detection risk: low/medium/high — 'high' fails regardless of score
- If eeAtScore < 80 && qcRevisionCount < 1: enqueues EDIT again
- If passes: status → 'imaging'

**Pipeline Orchestrator** (`server/services/pipeline.js`)
- `runPipeline(assignment)` — creates article + enqueues RESEARCH
- `triggerStep(articleId, step)` — manual recovery / step rerun
- `getPipelineStatus(articleId)` — article + all jobs summary

**Route integrations fixed:**
- `POST /api/v1/queue/run` now calls `runPipeline()` (no duplicate SQL)
- `POST /api/v1/articles/:id/regenerate` now calls `triggerStep()`

## Phase 2 bugs also fixed (same session)
- `sourceSelector.js` was importing `scrapeUrl` (wrong) → fixed to `scrapeSource`
- `academic.js` was missing Google Scholar and SINTA → both added
- `Sources.jsx` was missing Edit button → added with inline form (PATCH endpoint was already there)

**Why:** PRD Step 3.7 says "Artikel mengalir otomatis dari topik ke siap publish tanpa intervensi." The agents now handle the full chain automatically; each agent enqueues the next job itself.

**How to apply:**
- Each agent reads payload from job_queue and enqueues next step itself
- revisionCount and qcRevisionCount are passed through payload for retry limits
- For manual re-runs use `triggerStep(articleId, 'RESEARCH'|'WRITE'|'EDIT'|'QC'|...)` 
- Phase 5 (IMAGE/SEO/PUBLISH agents) must also follow this same pattern
