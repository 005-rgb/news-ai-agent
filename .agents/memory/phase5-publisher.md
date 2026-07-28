---
name: Phase 5 Publisher & Image Pipeline
description: Fotografer, SEO Specialist, WordPress Publisher agents — full implementation details and integration points
---

# Phase 5 — Fotografer + SEO + WordPress Publisher

## What was built

### PhotographerAgent (server/agents/photographer.js)
- Fetches images in order: Unsplash (if `UNSPLASH_ACCESS_KEY` set) → Pexels (if `PEXELS_API_KEY` set) → picsum.photos placeholder
- Builds English image query via LLM from Indonesian placeholder description
- Generates SEO alt text: `"{keyword} | {siteName}"` (max 125 chars)
- Saves result to `articles.image_data` as `{ featured, additional[] }`
- Sets status `imaging` → `seo`, enqueues `SEO` job

### SeoSpecialistAgent (server/agents/seoSpecialist.js)
- LLM keyword research → `{ main, lsi[] }` JSON
- Meta title: `"{title} | {siteName}"` trimmed to 60 chars
- Meta description: extracted from first paragraph or LLM-generated (150-160 chars)
- Slug: stopword-filtered lowercase from main keyword, max 60 chars
- Internal links: query published articles in same site, score by keyword overlap, top 3
- Keyword density: flags if > 2.5%
- Schema: via existing `seoFormatter.generateSchema()`
- Saves to `articles.seo_data`, sets `articles.tags`, sets status `seo` → `scheduled`, enqueues `PUBLISH`

### PublisherAgent (server/agents/publisher.js)
- Graceful fallback if no WP config: sets status `ready_to_publish`, returns `{ published: false, reason: 'no_wp_config' }`
- Image upload: downloads bytes via axios, POSTs to `/wp/v2/media` with `Content-Disposition` header
- Gets/creates WP categories + tags via slug search
- Appends "Baca Juga" internal links section before schema `<script>` tag in HTML
- POSTs to `/wp/v2/posts` with Yoast SEO meta fields (`_yoast_wpseo_title`, `_yoast_wpseo_metadesc`, `_yoast_wpseo_focuskw`)
- Error handling: 401/403 → pauses site + marks article `failed`; 429 → waits `Retry-After` + rethrows for retry()

### qualityRater.js fix
- Now enqueues `IMAGE` job after QC passes (was missing — articles got stuck at `imaging` status)
- Passes `siteId` and `category` in IMAGE payload

**Why:** qualityRater previously only set `status='imaging'` but never enqueued the IMAGE job, so Phase 5 pipeline could never start.

## Pipeline flow (complete)
```
RESEARCH → WRITE → EDIT → QC → IMAGE → SEO → PUBLISH
                    ↑___max 2x__|  ↑_max 1x_|
```
Each agent enqueues the next job itself. No external orchestration needed after `runPipeline()`.

## Status values added
- `publishing` — publisher agent in progress
- `ready_to_publish` — WP not configured, needs manual publish

## Image API keys
Optional env vars: `UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY`. Without them, picsum.photos placeholder is used.
