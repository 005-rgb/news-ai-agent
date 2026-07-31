---
name: Phase 6 Scheduler
description: Phase 6 full implementation — Site Scheduler, Smart Timing, Source Refresh, Daily Maintenance, Watchdog
---

# Phase 6 — Scheduler & Full Automation

## What was built
- `server/services/scheduler.js` — main Phase 6 scheduler (all 5 steps)
- `server/agents/chiefEditor.js` — real `generateAdHocTopic` with LLM + fallback
- `server/routes/scheduler.js` — full REST API for dashboard control
- `server/index.js` — imports scheduler, mounts `/api/v1/scheduler`, calls `scheduler.start()` in boot

## Key rules

**Site config shape** (stored in `sites.config JSONB`):
```json
{
  "posting_schedule": {
    "enabled": true,
    "times": ["07:00", "12:00", "19:00"],
    "use_smart_timing": true,
    "default_category": "teknologi",
    "default_format": "berita_singkat"
  }
}
```

**Why:** `config` is a free JSONB column; all scheduler settings nested under `posting_schedule` key to avoid conflicts with other site config.

**How to apply:** Any code that reads site schedule must navigate `site.config.posting_schedule`.

## Watchdog (Step 6.5)
Already fully implemented in `jobQueue.js` via `runWatchdog()` — called every 5 min via `setInterval` in `startWorker()`. Covers: stuck job reset + auto-pause bad keys. No additional cron needed.

## Cron schedule summary (Asia/Jakarta timezone)
| Job | Schedule | File |
|-----|----------|------|
| Per-site publish | per-site `posting_schedule.times` | scheduler.js |
| Source RSS refresh | every 6h | scheduler.js |
| Article status check + evergreen scan | 01:00 daily | scheduler.js |
| Per-site usage_stats snapshot | 23:50 daily | scheduler.js |
| Key daily reset | 00:00 (17:00 UTC) | index.js |
| Key monthly reset | 00:05 on 1st (17:05 UTC) | index.js |
| Global stats snapshot | 23:55 (16:55 UTC) | index.js |
| Rolling key reset | every 5 min | index.js |
| Log cleanup | 02:00 UTC | index.js |
| Watchdog (stuck jobs + bad keys) | every 5 min | jobQueue.js |

## Scheduler API endpoints
- `GET /api/v1/scheduler/status` — status + next run per site
- `GET /api/v1/scheduler/next-runs` — sorted next runs
- `POST /api/v1/scheduler/trigger/:id` — manual trigger (fire-and-forget)
- `POST /api/v1/scheduler/reload` — reload all site crons from DB
- `GET /api/v1/scheduler/config/:id` — get site schedule config
- `PATCH /api/v1/scheduler/config/:id` — update schedule + auto-reload crons

## Smart timing (Step 6.2)
`smartDelayMs()` returns random offset in range `[-15min, +45min]`. Applied only when `use_smart_timing: true` (default). Avoids robotic posting pattern.

## reloadSiteCrons() must be called after site create/update/delete
Routes `sites.js` does NOT auto-call it yet — add that in a follow-up when sites route is updated.
