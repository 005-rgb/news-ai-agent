---
name: Project setup & run
description: Key setup facts for news-ai-agent — module system, missing deps, workflow
---

**Why:** Project is "type": "commonjs" but original postcss.config.js and tailwind.config.js used `export default` — causes Vite build to fail.

**Rule:** Always use `module.exports = {...}` for postcss.config.js and tailwind.config.js in this project.

**React missing:** react and react-dom were not in node_modules on import — must run `npm install react react-dom` before first build.

**Workflow:** `Start application` = `npm run build && node server/index.js` on port 5000 (webview).

**Credentials:** admin / Admin@2024 (bcrypt hash stored in ADMIN_PASSWORD_HASH env var).

**ENCRYPTION_KEY:** Set as shared env var (not secret) — 64 hex chars auto-generated. Move to Replit Secret for production.
