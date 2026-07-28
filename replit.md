# News AI Agent

Sistem redaksi digital otomatis berbasis multi-LLM yang memproduksi, mengedit, dan mempublikasikan artikel berita ke 8 website WordPress secara otomatis.

## Cara Menjalankan

```bash
npm install       # Install semua dependencies
node server/db.js migrate  # Setup database (pertama kali saja)
npm run dev       # Development: backend + frontend secara bersamaan
# ATAU
npm start         # Production: Express serve React build
```

## Environment Variables Wajib

| Variable | Keterangan |
|---|---|
| `SESSION_SECRET` | Secret untuk session Express (sudah diset) |
| `ENCRYPTION_KEY` | 32-byte hex key untuk enkripsi AES-256 |
| `DATABASE_URL` | PostgreSQL connection string |
| `ADMIN_USERNAME` | Username admin (default: admin) |
| `ADMIN_PASSWORD_HASH` | bcrypt hash password admin (cost 12) |

## Generate ENCRYPTION_KEY

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Generate ADMIN_PASSWORD_HASH

```bash
node -e "require('bcryptjs').hash('passwordAnda', 12).then(h => console.log(h))"
```

## Stack

- **Backend**: Node.js 20 + Express.js
- **Database**: PostgreSQL 16
- **Frontend**: React 18 + Vite + Tailwind CSS
- **LLM Providers**: Gemini, Groq, DeepSeek, OpenRouter, Mistral, Together AI, Cerebras, Cohere
- **Auth**: Session-based dengan bcryptjs

## Struktur Project

```
news-ai-agent/
├── server/               # Backend Express
│   ├── agents/           # AI Agents (reporter, writer, editor, dll)
│   ├── services/         # Core services (keyPool, llmRouter, jobQueue, pipeline)
│   ├── routes/           # REST API endpoints
│   ├── middleware/        # Auth, rate limiter, error handler
│   ├── utils/            # Encryption, logger, humanizer, similarity
│   ├── config/           # Config loader, providers, prompt templates
│   ├── db.js             # PostgreSQL pool + migration
│   └── index.js          # Entry point
├── client/               # Frontend React
│   └── src/
│       ├── pages/        # 9 halaman dashboard
│       ├── components/   # Layout
│       └── lib/api.js    # API client
├── docs/                 # PRD + Build Phases
└── package.json
```

## Build Phases

- **Phase 0** ✅ Foundation & Infrastructure (selesai)
- **Phase 1** → API Key Pool Manager
- **Phase 2** → Source Intelligence (RSS, Academic, Scraper)
- **Phase 3** → Content Pipeline Core (7 agents end-to-end)
- **Phase 4** → Writing Standards Engine
- **Phase 5** → Fotografer Agent & WordPress Publisher
- **Phase 6** → Scheduler & Full Automation
- **Phase 7** → Dashboard Full (semua 9 halaman real)
- **Phase 8** → Quality & Humanizer Engine
- **Phase 9** → Rapat Redaksi Engine
- **Phase 10** → Innovation Layer
- **Phase 11** → Hardening & Production Ready

## API Endpoints

```
GET  /api/v1/health              — Health check
POST /api/v1/auth/login          — Login
POST /api/v1/auth/logout         — Logout
GET  /api/v1/auth/me             — Check session

GET  /api/v1/sites               — List sites
POST /api/v1/sites               — Tambah site
PATCH /api/v1/sites/:id          — Update site
POST /api/v1/sites/:id/test      — Test WordPress connection

GET  /api/v1/keys                — List API keys
POST /api/v1/keys                — Tambah API key
POST /api/v1/keys/:id/test       — Test API key (real LLM call)
GET  /api/v1/keys/alerts         — Active alerts

GET  /api/v1/sources             — List sumber berita
POST /api/v1/sources/:id/test    — Test fetch sumber

GET  /api/v1/articles            — List artikel (filter, paginate)
POST /api/v1/queue/run           — Jalankan pipeline manual

GET  /api/v1/analytics/overview  — Dashboard stats
GET  /api/v1/analytics/logs      — System logs
```

## User Preferences

- Bahasa Indonesia untuk kode komentar dan UI
- Stack: Node.js + Express + PostgreSQL + React + Vite + Tailwind
- Target deployment: cPanel / Laragon (tidak bergantung cloud eksklusif)
- Port: 5000 (backend), 5173 (frontend dev)
