# News AI Agent

Automated multi-site WordPress publishing system powered by AI agents. The system researches real news sources, writes articles in Indonesian journalistic style, edits them for quality, runs E-E-A-T checks, and publishes to WordPress — fully automated 24/7.

## Stack

- **Backend**: Node.js + Express (CommonJS), `server/index.js` entry point, port 5000
- **Frontend**: React 18 + Vite (built to `client/dist/`, served by Express)
- **Database**: Replit PostgreSQL (12 tables, auto-migrated on startup)
- **Auth**: Session-based with `express-session` + `connect-pg-simple`
- **Encryption**: AES-256-GCM for all sensitive values (API keys, WP passwords)

## Run

```bash
npm run build    # build React client
npm run start    # start Express server (serves built client + API)
npm run dev      # dev mode: concurrently runs server (node --watch) + vite (port 5173)
```

The workflow `Start application` runs `npm run build && node server/index.js`.

## Phase Status

| Phase | Name | Status |
|-------|------|--------|
| 0 | Foundation & Infrastructure | ✅ Done |
| 1.1 | Key CRUD API | ✅ Done |
| 1.2 | Usage Tracker | ✅ Done |
| 1.3 | Smart Rotation Engine | ✅ Done |
| 1.4 | LLM Router | ✅ Done |
| 1.5 | Alert System | ✅ Done |
| 2 | Source Intelligence (68 sources) | ✅ Done |
| 3 | Content Pipeline Core | ✅ Done |
| 4–11 | Writing Standards, Publisher, Dashboard… | 🔜 Planned |

## Login

- Username: `admin` (set via `ADMIN_USERNAME` env var)
- Password: `Admin@2024` (default — change via `ADMIN_PASSWORD_HASH` env var)

Generate a new hash: `node -e "require('bcryptjs').hash('yourpassword', 12).then(h => console.log(h))"`

## Key Environment Variables

| Variable | Description |
|---|---|
| `SESSION_SECRET` | Express session secret (Replit Secret) |
| `ENCRYPTION_KEY` | 64-char hex AES-256 key for encrypting API keys |
| `DATABASE_URL` | PostgreSQL connection string (auto-managed by Replit) |
| `ADMIN_USERNAME` | Admin login username (default: `admin`) |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of admin password |

## Architecture

```
server/
├── index.js              # Express app, cron jobs, boot
├── db.js                 # PostgreSQL pool + DDL migration
├── config/index.js       # Config from env vars (validates required vars)
├── config/providers.js   # LLM provider defaults
├── config/promptTemplates.js # Writing prompt templates
├── middleware/auth.js    # Session auth middleware
├── routes/apiKeys.js     # Phase 1.1: Full CRUD + test + alerts + stats
├── services/keyPool.js   # Phase 1.2-1.3: Rotation, freshness, usage tracking
├── services/llmRouter.js # Phase 1.4: 8-provider LLM abstraction
├── services/jobQueue.js  # Phase 0+3: Persistent job queue + worker
├── agents/               # 9 AI agents (reporter, writer, editor, etc.)
└── utils/                # encryption, logger, humanizer, seoFormatter, similarity
client/src/
├── pages/ApiKeys.jsx     # Phase 1.1: Full key management UI
├── pages/Overview.jsx    # Dashboard home
└── lib/api.js            # Axios API client (all endpoints)
```

## User Preferences

- Language: Bahasa Indonesia (PRD, comments, UI labels)
- Prinsip: Setiap fitur harus **real, full-featured, fully integrated** — tidak ada placeholder
- Build order follows docs/BUILD-PHASES.md strictly
