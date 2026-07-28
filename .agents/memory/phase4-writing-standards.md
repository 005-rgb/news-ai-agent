---
name: Phase 4 Writing Standards Engine
description: Durable constraints and pitfalls for the Writing Standards Engine and prompt template system
---

## Critical constraint: format_key is the only reliable lookup contract

`prompt_versions` table has a `format_key` column (VARCHAR 100) that must be set on every row to enable reliable DB template selection. `loadDbTemplate(format)` in writer.js queries `WHERE format_key = $1` (exact match). Never use fuzzy name/ILIKE matching — template names contain human-readable suffixes.

**Why:** Fuzzy name matching returns no rows for most format keys because seeded names like "Berita Singkat (200-400 kata)" don't contain the key "berita_singkat".

**How to apply:**
- Always set `format_key` when inserting into `prompt_versions`
- `seedPromptVersions()` in db.js checks `WHERE format_key = $1` before inserting — safe to re-run
- POST `/api/v1/settings/prompt-templates` accepts `format_key` as optional field; encourage users to set it for formats they want to override

## Champion lifecycle rule

At most one champion per (agent_type, format_key) scope. The PATCH route handles this: when `is_champion=true` is sent, server clears `is_champion` on all other rows in the same scope before setting it on the target.

**Why:** Writer Agent picks the top row `ORDER BY is_champion DESC` — multiple champions = unpredictable selection.

**How to apply:**
- Never set `is_champion` directly via raw SQL without also clearing others
- The PATCH route in `server/routes/settings.js` already handles this atomically

## Inactive templates must stay visible in the UI

GET `/api/v1/settings/prompt-templates` returns ALL templates (active + inactive) by default. Agents that need only active ones call `?active_only=true`.

**Why:** If the list only showed active templates, deactivating a template would make it disappear from the UI with no way to reactivate it.

## Humanizer runs AFTER editor LLM, not before

`humanize()` is called in editor.js on the LLM-edited content, before saving to DB. Do not call it on the input to the editor LLM — that would mangle the content the LLM needs to evaluate.

## Duplicate rows prevention

The first migration boot created 7 rows with `format_key = null` (before the column existed). The second boot added 7 proper rows. A cleanup script deleted the 7 old duplicates. Future boots use `WHERE format_key = $1` check so no more duplicates. If duplicates appear, run: `DELETE FROM prompt_versions WHERE id IN (SELECT id FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY name, format_key ORDER BY created_at DESC) AS rn FROM prompt_versions WHERE format_key IS NOT NULL) t WHERE rn > 1)`

## Format keys (canonical)

`berita_singkat`, `berita_panjang`, `jurnal_review`, `feature_opini`, `listicle`, `faq_article`, `evergreen` — all defined in `server/config/promptTemplates.js` TEMPLATES object keys.
