'use strict';

// ── Load config first (validates required env vars) ──────────────────────────
const config = require('./config');
require('dotenv').config();

const express     = require('express');
const session     = require('express-session');
const helmet      = require('helmet');
const cors        = require('cors');
const compression = require('compression');
const cron        = require('node-cron');
const path        = require('path');

const { pool, checkConnection, migrate } = require('./db');
const logger      = require('./utils/logger');
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
    store: new pgSession({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
    }),
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.isProduction,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: config.isProduction ? 'strict' : 'lax',
    },
    name: 'newsai.sid',
  };
} catch {
  sessionConfig = {
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 24 * 60 * 60 * 1000, sameSite: 'lax' },
    name: 'newsai.sid',
  };
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false,
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

app.use('/api/v1', globalLimiter);
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
        phase: 'Phase 1 — API Key Pool Manager',
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

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  const indexPath = path.join(clientDist, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).json({
        success: true,
        data: {
          message: 'News AI Agent API running. Frontend not built yet.',
          hint: 'Run: npm run build',
          apiDocs: '/api/v1/health',
        },
      });
    }
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

// ── Cron jobs ─────────────────────────────────────────────────────────────────

function startCronJobs() {
  const keyPool = require('./services/keyPool');

  // Daily reset at 00:00 WIB (Asia/Jakarta = UTC+7 → 17:00 UTC)
  cron.schedule('0 17 * * *', async () => {
    try {
      await keyPool.resetDailyUsage();
    } catch (err) {
      console.error('[Cron] Daily reset error:', err.message);
    }
  }, { timezone: 'UTC' });

  // Monthly reset at 00:05 WIB on 1st of month
  cron.schedule('5 17 1 * *', async () => {
    try {
      await keyPool.resetMonthlyUsage();
    } catch (err) {
      console.error('[Cron] Monthly reset error:', err.message);
    }
  }, { timezone: 'UTC' });

  // Daily usage_stats snapshot at 23:55 WIB (16:55 UTC)
  cron.schedule('55 16 * * *', async () => {
    try {
      const { rows } = await pool.query(`
        SELECT
          gen_random_uuid()         AS id,
          CURRENT_DATE              AS date,
          NULL::uuid                AS site_id,
          NULL::uuid                AS api_key_id,
          COUNT(*)                  AS articles_generated,
          0                         AS tokens_used,
          0                         AS images_generated,
          COUNT(*) FILTER (WHERE status = 'failed') AS errors_count,
          AVG(quality_score)        AS avg_quality_score,
          AVG(eeat_score)           AS avg_eeat_score
        FROM articles
        WHERE created_at::date = CURRENT_DATE
      `);
      if (rows.length && rows[0].articles_generated > 0) {
        await pool.query(
          `INSERT INTO usage_stats
             (date, articles_generated, errors_count, avg_quality_score, avg_eeat_score)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT DO NOTHING`,
          [rows[0].date, rows[0].articles_generated, rows[0].errors_count,
           rows[0].avg_quality_score, rows[0].avg_eeat_score]
        );
      }
      await logger.info('Cron', 'Daily usage stats snapshot saved');
    } catch (err) {
      console.error('[Cron] Stats snapshot error:', err.message);
    }
  }, { timezone: 'UTC' });

  // Rolling-24h provider reset — cek setiap 5 menit apakah ada key yang reset_at-nya sudah lewat
  // Groq, OpenRouter, Together AI, Cerebras: quota-window bergeser 24h dari pemakaian terakhir
  cron.schedule('*/5 * * * *', async () => {
    try {
      await keyPool.resetExpiredRollingKeys();
    } catch (err) {
      console.error('[Cron] Rolling reset error:', err.message);
    }
  }, { timezone: 'UTC' });

  // Log cleanup every day at 02:00 UTC — remove system_logs > 30 days
  cron.schedule('0 2 * * *', async () => {
    try {
      const { rowCount } = await pool.query(
        `DELETE FROM system_logs WHERE created_at < NOW() - INTERVAL '30 days'`
      );
      if (rowCount > 0) {
        await logger.info('Cron', `Log cleanup: removed ${rowCount} old entries`);
      }
    } catch (err) {
      console.error('[Cron] Log cleanup error:', err.message);
    }
  }, { timezone: 'UTC' });

  console.log('[Cron] Jobs scheduled: daily-reset, rolling-reset(5min), monthly-reset, stats-snapshot, log-cleanup');
}

// ── Boot ──────────────────────────────────────────────────────────────────────
async function start() {
  try {
    await migrate();

    logger.setPool(pool);
    await logger.info('Server', 'Database migrated and connected');

    const { startWorker } = require('./services/jobQueue');
    startWorker();
    await logger.info('Server', 'Job queue worker started');

    startCronJobs();

    app.listen(config.port, '0.0.0.0', () => {
      console.log(`\n[Server] News AI Agent running on port ${config.port}`);
      console.log(`[Server] Health: http://localhost:${config.port}/api/v1/health`);
      console.log(`[Server] Phase 1 — API Key Pool Manager ✓\n`);
    });
  } catch (err) {
    console.error('[Server] Fatal error during startup:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

start();

module.exports = app;
