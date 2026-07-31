---
name: Phase 7 Dashboard Full
description: Complete Phase 7 dashboard — all 8 menus real, no placeholders. Key decisions for future phases.
---

## What was built
- **Analytics** — 7 tabs: Produksi (14-day bar chart), E-E-A-T Mingguan (weekly table with trend arrows), Provider (quality/eeat table), Prompt Evolution (template A/B table), Evergreen (30+ day candidates), Key Usage (provider aggregation), Error Rate (per pipeline stage), System Logs (filterable).
- **Settings** — Added "Operasional" tab first in nav: humanizer level slider (1–4), quality/eeat/key-warning threshold inputs, human review toggle (boolean, stored in system_settings table), image fallback chain reorder editor (↑↓ buttons, saved to system_settings).
- **Articles** — Added Human Review mode (toggle button): shows articles with needs_human_review=true OR status in (ready_to_publish, scheduled). Inline approve (enqueues PUBLISH) and reject (back to draft with notes) with confirm flow.
- **Rapat** — Added Content Calendar tab with 7-day × sites visual grid. Each cell shows planned topics; click + to add, hover shows edit/delete buttons. Full modal for add/edit with all fields. List view below grid.

## Backend additions
- `server/routes/settings.js` — GET/PATCH `/system-config`, GET/PUT `/image-chain`
- `server/routes/articles.js` — POST `/:id/approve`, POST `/:id/reject`, PATCH `/:id/flag-review`; GET now accepts `?human_review=true`
- `server/routes/analytics.js` — GET `/eeat-weekly`, `/prompts`, `/evergreen`, `/key-usage`, `/error-rate`
- `server/db.js` — `system_settings` table + seed, `needs_human_review` + `human_review_notes` columns on articles

**Why:** PRD Phase 7 spec required all menus to be real/functional. system_settings stores editable runtime config separate from env vars.

**How to apply:** Any future config that needs to be editable at runtime (without restart) should use system_settings table with INSERT ON CONFLICT DO UPDATE pattern.
