---
name: Phase 3 Content Pipeline Core
description: Phase 3 fully implemented — 5 agents + orchestrator + full frontend
---

## What was done

All Phase 3 steps completed:

**Step 3.1 — Base class** (`server/agents/base.js`)
- callLLM, log, updateJobStatus, retry, handleError

**Step 3.2 — Job Queue** (`server/services/jobQueue.js`)
- enqueueJob, processNextJob, startWorker, runWatchdog
- Full dispatch for RESEARCH, WRITE, EDIT, QC, IMAGE, SEO, PUBLISH
- Stuck job watchdog resets processing > 30min back to pending

**Step 3.3 — Reporter Agent** (`server/agents/reporter.js`)
- selectSources → fetchFromSource → keyword filter
- LLM extracts facts/quotes/stats/timeline in JSON
- Cross-verifies across sources if >1 source available
- Fallback: LLM from general knowledge if no sources fetched
- Calculates combined credibilityScore
- Enqueues WRITE job on completion

**Step 3.4 — Writer Agent** (`server/agents/writer.js`)
- Loads site persona from DB (sites.persona_memory)
- Loads prompt template from server/config/promptTemplates.js
- LLM generates JSON with title/content/faq/keyTakeaways/socialCaption/imagePlaceholders
- Saves to BOTH articles.content (plain text) AND articles.content_versions (full JSON)
- Records provider_used to articles.provider_used
- Validates word count against FORMAT_WORD_TARGETS per format
- Enqueues EDIT job on completion

**Step 3.5 — Editor Agent** (`server/agents/editor.js`)
- Duplication check: keyword overlap vs recent articles in same site
- LLM review: fact check vs brief, naturalness, structure fixes, quality score 0-100
- If score < 75 && revisionCount < 2: enqueues WRITE again with revision notes
- If passes: enqueues QC job

**Step 3.6 — Quality Rater Agent** (`server/agents/qualityRater.js`)
- LLM evaluates 6 dimensions: experience/expertise/authoritativeness/trustworthiness/aiDetection/searchIntent
- Weighted formula + LLM score blended for final eeAtScore
- AI detection risk: low/medium/high — 'high' fails regardless of score
- If eeAtScore < 80 && qcRevisionCount < 1: enqueues EDIT again
- If passes: status → 'imaging'

**Step 3.7 — Pipeline Orchestrator** (`server/services/pipeline.js`)
- runPipeline(assignment) — creates article + enqueues RESEARCH
- triggerStep(articleId, step) — manual recovery / step rerun
- getPipelineStatus(articleId) — article + all jobs summary

**Route integrations:**
- POST /api/v1/queue/run → runPipeline()
- POST /api/v1/articles/:id/regenerate → triggerStep()

**Frontend completed:**
- Articles.jsx: list + filter + pipeline run form with error feedback + full detail panel (fetch GET /articles/:id on click) with 3 tabs (konten/brief riset/skor) + Regenerate from step UI + filter resets page to 1
- Queue.jsx: live jobs + dead queue + pipeline kanban + 15s auto-refresh
- Overview.jsx: pipeline funnel + alerts + activity log + stats

## Phase 2 bugs also fixed (same session)
- sourceSelector.js was importing scrapeUrl (wrong) → fixed to scrapeSource
- academic.js was missing Google Scholar and SINTA → both added
- Sources.jsx was missing Edit button → added

**Why:** PRD Step 3.7 says "Artikel mengalir otomatis dari topik ke siap publish tanpa intervensi." The agents handle the full chain automatically; each agent enqueues the next job itself.

**How to apply:**
- Each agent reads payload from job_queue and enqueues next step itself
- revisionCount and qcRevisionCount are passed through payload for retry limits
- For manual re-runs use triggerStep(articleId, 'RESEARCH'|'WRITE'|'EDIT'|'QC'|...)
- articles.content = plain text (for display), articles.content_versions = full JSON (for pipeline)
- Phase 5 (IMAGE/SEO/PUBLISH agents) must also follow this same pattern
