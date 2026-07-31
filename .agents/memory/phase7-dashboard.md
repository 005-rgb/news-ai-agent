---
name: Phase 7 Dashboard Full
description: Complete Phase 7 dashboard — all 8 menus real, no placeholders. Key decisions for future phases.
---

## What was built
- **Analytics** — 7 tabs: Produksi (bar chart with date range selector 7/14/30/60/90d + per-site filter), E-E-A-T Mingguan (weekly table with trend arrows), Provider (quality/eeat table), Prompt Evolution (template A/B table), Evergreen (30+ day candidates), Key Usage (provider aggregation), Error Rate (per pipeline stage), System Logs (filterable).
- **Settings** — "Operasional" tab first in nav: humanizer level slider (1–4), quality/eeat/key-warning threshold inputs, human review toggle, timezone selector (saved to system_settings), LLM fallback chain editor (↑↓ buttons, reuses apiKeys.order/saveOrder), image fallback chain reorder editor.
- **Articles** — Human Review mode (toggle button): shows articles with needs_human_review=true OR status in (ready_to_publish, scheduled). Inline approve (enqueues PUBLISH) and reject (back to draft with notes) with confirm flow.
- **Rapat** — Content Calendar tab with 7-day × sites visual grid. Each cell shows planned topics; click + to add, hover shows edit/delete buttons. Full modal for add/edit. List view below grid.
- **Overview** — Added 7-day production bar chart between stat cards and pipeline funnel.
- **Sites** — Added Pause/Activate toggle (clickable status badge that calls PATCH with status=paused/active), Persona preview modal (fetches full site data including persona_memory).
- **Queue** — Added Force Run form: topic, site, category, format; calls POST /queue/run.
- **ApiKeys** — Pause/Activate, priority chain editor, usage bars — already complete.

## Backend additions
- `server/routes/settings.js` — GET/PATCH `/system-config` (added `timezone` to ALLOWED_KEYS; GET reads from DB first then falls back to env), GET/PUT `/image-chain`, GET/PATCH `/prompt-templates/:id`
- `server/routes/articles.js` — POST `/:id/approve`, POST `/:id/reject`, PATCH `/:id/flag-review`; GET accepts `?human_review=true`
- `server/routes/analytics.js` — GET `/eeat-weekly`, `/prompts`, `/evergreen`, `/key-usage`, `/error-rate`; production endpoint supports `?days=N&site_id=X`
- `server/db.js` — `system_settings` table + seed, `needs_human_review` + `human_review_notes` columns on articles

## Key decisions
- Timezone: stored in system_settings (DB overrides env); note shown in UI that restart needed for cron effect
- LLM chain order: reuses `/keys/order` and `/keys/order PUT` endpoints (sentinel row in api_keys)
- Sites pause/activate: uses existing PATCH `/sites/:id` with `status` field — no new endpoint needed
- Persona preview: calls GET `/sites/:id` to get full data including `persona_memory` column

**Why:** PRD Phase 7 spec required all menus to be real/functional. system_settings stores editable runtime config separate from env vars.

**How to apply:** Any future config that needs to be editable at runtime (without restart) should use system_settings table with INSERT ON CONFLICT DO UPDATE pattern. Timezone is exception — requires restart for node-cron effect.
