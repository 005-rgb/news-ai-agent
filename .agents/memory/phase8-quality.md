---
name: Phase 8 Quality & Humanizer Engine
description: Phase 8 implementation details — humanizer layers, AI detection, duplicate guard, quality API routes, and dashboard Quality tab.
---

# Phase 8 — Quality & Humanizer Engine

## What was built

### Step 8.1 — Humanizer Layer (4 Level) — `server/utils/humanizer.js`
- **Level 1**: Detects 3+ consecutive same-length paragraphs (±10% tolerance) → breaks pattern by splitting last sentence; detects repeated paragraph-starting words (4+ times) → prepends connector
- **Level 2**: 50+ AI cliché replacements (expanded from ~10); selective konjungsi insertion (max 1 per 5 paragraphs); attribution verb rotation (11 variants)
- **Level 3**: Contextual time references inserted via verb-pattern matching; rhetorical question inserted at article midpoint (1 per article); uncertainty markers inserted near numeric claims
- **Level 4**: "sekitar X" approximation for round thousands (30% chance, excluding years 1900-2030); varied article closing if starts with generic "Ke depannya/Diharapkan"
- `humanizeReport()` added for logging what changed

### Step 8.2 — AI Detection Pre-Check — `server/utils/humanizer.js::aiDetectionPrecheck()`
- Now returns structured `{ type, msg }` objects (not plain strings)
- Detects: opening clichés, closing clichés, overused "signifikansi/berimplikasi" (>3×), "Hal ini..." repetition (≥3×), list pattern overuse, uniform paragraphs (3+ consecutive ±8% length), repeated paragraph starts (≥4×), perfect transitions (≥4 different transition words)

### Step 8.3 — Duplikasi Guard
- Pre-write check in `server/agents/writer.js` at WRITE job start
- If keyword overlap ≥65% with existing articles → enqueues `DUPLICATE_RISK` job, halts WRITE
- `DUPLICATE_RISK` job in `server/services/jobQueue.js` → calls `ChiefEditorAgent.resolveDuplicateRisk()`
- `server/agents/chiefEditor.js::resolveDuplicateRisk()` → LLM decides: 'pivot' (new angle) or 'skip'
- If pivot: updates article title, re-enqueues WRITE with `duplicatePivot: true` flag
- If skip: sets article status to 'failed'

## Quality API Routes — `server/routes/quality.js`
Mounted at `/api/v1/quality/`:
- `POST /test-humanizer` — applies humanizer to text, returns before/after + AI flags + risk level
- `POST /check-duplicate` — checks topic against DB articles, returns overlap scores + recommendation
- `GET /stats` — aggregated quality/eeat stats for last N days

## Dashboard
- Settings page: new "Quality Engine" tab (between Prompt Templates and Keamanan)
  - Quality stats card (7-day stats)
  - Test Humanizer tool with level selector + before/after AI flags display
  - Duplicate Check tool with site filter + threshold slider
  - Phase 8 info card
- Articles list: duplicate risk badge (⚠ Duplicate risk) from `content_versions.isDuplicate`

## Key files modified
- `server/utils/humanizer.js` — full rewrite
- `server/routes/quality.js` — new file
- `server/agents/chiefEditor.js` — added `resolveDuplicateRisk()`
- `server/services/jobQueue.js` — added DUPLICATE_RISK dispatch
- `server/agents/writer.js` — added pre-write duplicate guard
- `server/index.js` — mounted quality routes, updated phase to 8
- `client/src/lib/api.js` — added `quality` API group
- `client/src/pages/Settings.jsx` — added Quality Engine tab
- `client/src/pages/Articles.jsx` — added duplicate risk badge + helper

**Why:** Articles that are AI-detectable or duplicate reduce SEO value and AdSense compliance; Phase 8 addresses both concerns before any article reaches WordPress.
