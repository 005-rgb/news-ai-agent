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
const { globalLimiter, authLimiter, writeLimiter, pipelineLimiter } = require('./middleware/rateLimiter');
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
const analyticsRoutes   = require('./routes/analytics');
const settingsRoutes    = require('./routes/settings');
const schedulerRoutes   = require('./routes/scheduler');
const qualityRoutes     = require('./routes/quality');
const alertsRoutes      = require('./routes/alerts');

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
} catch (pgSessionErr) {
  // C-2 Fix: Jangan fallback silent ke in-memory store — gagal dengan jelas.
  // In-memory store tidak aman untuk production (session hilang saat restart,
  // tidak support multi-instance) dan tidak ada notifikasi kepada operator.
  console.error('[FATAL] Gagal memuat connect-pg-simple:', pgSessionErr.message);
  console.error('[FATAL] Server tidak dapat start tanpa persistent session store.');
  process.exit(1);
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

// ── Health check (Phase 11 — enhanced) ───────────────────────────────────────
app.get('/api/v1/health', async (req, res) => {
  try {
    await checkConnection();

    // Gather health metrics in parallel
    const [queueRes, lastJobRes, alertRes] = await Promise.all([
      pool.query(`SELECT count(*) AS pending, count(*) FILTER (WHERE status='processing') AS processing FROM job_queue WHERE status IN ('pending','processing')`),
      pool.query(`SELECT finished_at FROM job_queue WHERE status='done' ORDER BY finished_at DESC LIMIT 1`),
      pool.query(`SELECT count(*) AS active FROM system_alerts WHERE is_resolved = false`).catch(() => ({ rows: [{ active: 0 }] })),
    ]);

    const mem = process.memoryUsage();

    res.json({
      success: true,
      data: {
        status: 'ok',
        db: 'connected',
        version: '1.0.0',
        phase: 'Phase 11 — Production Ready',
        queue: {
          pending:    parseInt(queueRes.rows[0]?.pending    || 0),
          processing: parseInt(queueRes.rows[0]?.processing || 0),
        },
        lastJobAt:    lastJobRes.rows[0]?.finished_at || null,
        activeAlerts: parseInt(alertRes.rows[0]?.active || 0),
        memory: {
          heapUsedMB:  Math.round(mem.heapUsed  / 1024 / 1024),
          heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
          rssMB:       Math.round(mem.rss       / 1024 / 1024),
        },
        uptime: Math.round(process.uptime()),
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
app.use('/api/v1/analytics',  analyticsRoutes);
app.use('/api/v1/settings',   settingsRoutes);
app.use('/api/v1/scheduler',  schedulerRoutes);
app.use('/api/v1/quality',    qualityRoutes);
app.use('/api/v1/alerts',     alertsRoutes);

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
          CURRENT_DATE              AS date,
          COUNT(*)                  AS articles_generated,
          COALESCE(SUM(CASE WHEN ak.usage_today IS NOT NULL THEN 0 ELSE 0 END), 0) AS tokens_used,
          0                         AS images_generated,
          COUNT(*) FILTER (WHERE a.status = 'failed') AS errors_count,
          AVG(a.quality_score)      AS avg_quality_score,
          AVG(a.eeat_score)         AS avg_eeat_score
        FROM articles a
        WHERE a.created_at::date = CURRENT_DATE
      `);

      // Also sum tokens from api_keys usage_today
      const { rows: tokenRows } = await pool.query(`
        SELECT COALESCE(SUM(usage_today), 0) AS tokens_used
        FROM api_keys
        WHERE provider != '_config'
      `);

      if (rows.length) {
        await pool.query(
          `INSERT INTO usage_stats (date, articles_generated, tokens_used, errors_count, avg_quality_score, avg_eeat_score)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (date, site_id) DO UPDATE SET
             articles_generated = EXCLUDED.articles_generated,
             tokens_used        = EXCLUDED.tokens_used,
             errors_count       = EXCLUDED.errors_count,
             avg_quality_score  = EXCLUDED.avg_quality_score,
             avg_eeat_score     = EXCLUDED.avg_eeat_score`,
          [
            rows[0].date,
            parseInt(rows[0].articles_generated) || 0,
            parseInt(tokenRows[0].tokens_used) || 0,
            parseInt(rows[0].errors_count) || 0,
            rows[0].avg_quality_score,
            rows[0].avg_eeat_score,
          ]
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

  // ── Phase 11.2: Alert scan setiap 5 menit ────────────────────────────────
  cron.schedule('*/5 * * * *', async () => {
    try {
      const alertService = require('./services/alertService');
      await alertService.runAlertScan();
    } catch (err) {
      console.error('[Cron] Alert scan error:', err.message);
    }
  }, { timezone: 'UTC' });

  // ── Phase 11.5: Cache cleanup setiap jam ──────────────────────────────────
  cron.schedule('0 * * * *', () => {
    try {
      const cache = require('./utils/cache');
      cache.clear();
    } catch (_) {}
  }, { timezone: 'UTC' });

  console.log('[Cron] Jobs scheduled: daily-reset, rolling-reset(5min), monthly-reset, stats-snapshot, log-cleanup, alert-scan(5min), cache-clear(1h)');
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

    // ── Phase 6: Site Scheduler ────────────────────────────────────────────
    const scheduler = require('./services/scheduler');
    await scheduler.start();
    await logger.info('Server', 'Phase 10 Innovation Layer started');

    const server = app.listen(config.port, '0.0.0.0', () => {
      console.log(`\n[Server] News AI Agent running on port ${config.port}`);
      console.log(`[Server] Health: http://localhost:${config.port}/api/v1/health`);
      console.log(`[Server] Phase 11 — Production Ready ✓\n`);
    });

    // ── Phase 11: Graceful shutdown ──────────────────────────────────────────
    const shutdown = async (signal) => {
      console.log(`\n[Server] ${signal} received — shutting down gracefully...`);
      server.close(async () => {
        try {
          const { stopWorker } = require('./services/jobQueue');
          stopWorker();
          await pool.end();
          console.log('[Server] Database pool closed. Bye!');
        } catch (e) {
          console.error('[Server] Error during shutdown:', e.message);
        }
        process.exit(0);
      });
      // Force-exit setelah 10 detik jika masih belum selesai
      setTimeout(() => { console.error('[Server] Forced shutdown after timeout.'); process.exit(1); }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

  } catch (err) {
    console.error('[Server] Fatal error during startup:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

start();

module.exports = app;
