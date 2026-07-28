---
name: Phase 1 Key Pool implementation details
description: Non-obvious decisions made during Phase 1 Key Pool Manager implementation
---

**calcFreshnessScore exported:** server/services/keyPool.js exports calcFreshnessScore so server/routes/apiKeys.js can attach it to GET /keys responses without duplicating logic.

**Fallback chain storage:** The configurable provider fallback chain is stored as a sentinel row in api_keys with id='00000000-0000-0000-0000-000000000000', provider='_config'. All queries that list real keys filter `WHERE provider != '_config'`. PUT /api/v1/keys/order uses ON CONFLICT (id) DO UPDATE to upsert this row.

**Rate limiter:** Global limiter is 300 req/min (increased from 100) — the dashboard polls many endpoints every 30s and 100/min was too tight during dev.

**Cron timezone:** Cron jobs use UTC schedule equivalent to WIB (UTC+7): daily reset at 17:00 UTC = 00:00 WIB.
