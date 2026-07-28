---
name: Auth middleware path matching
description: requireAuth middleware is mounted at /api/v1 so req.path is relative
---

**Rule:** PUBLIC_PATHS in server/middleware/auth.js must use paths relative to the /api/v1 mount point: '/auth/login', '/auth/logout', '/health' — NOT '/api/v1/auth/login'.

**Why:** app.use('/api/v1', requireAuth) means Express strips the /api/v1 prefix before passing req.path to the middleware. Using the full path would never match and all routes including login would be blocked.
