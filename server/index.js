'use strict';

// ── Load config first (validates required env vars) ──────────────────────────
const config = require('./config');
require('dotenv').config();

const express    = require('express');
const session    = require('express-session');
const helmet     = require('helmet');
const cors       = require('cors');
const compression = require('compression');
const path       = require('path');

const { pool, checkConnection, migrate } = require('./db');
const logger     = require('./utils/logger');
const { requireAuth } = require('./middleware/auth');
const { globalLimiter, authLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Routes
const authRoutes      = require('./routes/auth');
const sitesRoutes     = require('./routes/sites');
const apiKeysRoutes   = require('./routes/apiKeys');
const sourcesRoutes   = require('./routes/sources');
const articlesRoutes  = require('./routes/articles');
const queueRoutes     = require('./routes/queue');
const calendarRoutes  = require('./routes/calendar');
const rapatRoutes     = require('./routes/rapat');
const analyticsRoutes = require('./routes/analytics');
const settingsRoutes  = require('./routes/settings');

const app = express();

// ── Session store ─────────────────────────────────────────────────────────────
let sessionConfig;
try {
  const pgSession = require('connect-pg-simple')(session);
  sessionConfig = {
    store: new pgSession({ pool, tableName: 'session', createTableIfMissing: true }),
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.isProduction,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: config.isProduction ? 'strict' : 'lax',
    },
    name: 'newsai.sid',
  };
} catch {
  // Fallback to in-memory session if pg-simple not available
  sessionConfig = {
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 24 * 60 * 60 * 1000, sameSite: 'lax' },
    name: 'newsai.sid',
  };
}

// ── Middleware stack (order matters) ─────────────────────────────────────────
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for dev; enable & configure in production
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: config.isProduction ? config.corsOrigins : true,
  credentials: true,
}));

app.use(compression());

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.use(session(sessionConfig));

// Global rate limiter (all API routes)
app.use('/api/v1', globalLimiter);

// Auth middleware (protect all /api/v1/* except /auth/login and /health)
app.use('/api/v1', requireAuth);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/v1/health', async (req, res) => {
  try {
    await checkConnection();
    res.json({
      success: true,
      data: {
        status: 'ok',
        db: 'connected',
        version: '1.0.0',
        phase: 'Phase 0 — Foundation',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      error: { code: 'DB_UNAVAILABLE', message: 'Database connection failed', detail: err.message },
    });
  }
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/v1/auth',      authLimiter, authRoutes);
app.use('/api/v1/sites',     sitesRoutes);
app.use('/api/v1/keys',      apiKeysRoutes);
app.use('/api/v1/sources',   sourcesRoutes);
app.use('/api/v1/articles',  articlesRoutes);
app.use('/api/v1/queue',     queueRoutes);
app.use('/api/v1/calendar',  calendarRoutes);
app.use('/api/v1/rapat',     rapatRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/settings',  settingsRoutes);

// ── Serve React client ────────────────────────────────────────────────────────
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

// SPA fallback — serve index.html for all non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  const indexPath = path.join(clientDist, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      // Client not built yet — return JSON
      res.status(200).json({
        success: true,
        data: {
          message: 'News AI Agent API is running. Frontend not built yet.',
          hint: 'Run: npm run build (then visit / to see the dashboard)',
          apiDocs: '/api/v1/health',
        },
      });
    }
  });
});

// ── 404 & Error handlers (LAST) ───────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Boot ──────────────────────────────────────────────────────────────────────
async function start() {
  try {
    // Run DB migration
    await migrate();

    // Connect logger to DB pool
    logger.setPool(pool);

    await logger.info('Server', 'Database migrated and connected');

    // Start job queue worker
    const { startWorker } = require('./services/jobQueue');
    startWorker();
    await logger.info('Server', 'Job queue worker started');

    // Start Express
    app.listen(config.port, '0.0.0.0', () => {
      console.log(`\n[Server] News AI Agent running on port ${config.port}`);
      console.log(`[Server] Health: http://localhost:${config.port}/api/v1/health`);
      console.log(`[Server] Phase 0 — Foundation & Infrastructure ✓\n`);
    });
  } catch (err) {
    console.error('[Server] Fatal error during startup:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

start();

module.exports = app;
