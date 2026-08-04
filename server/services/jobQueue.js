'use strict';

/**
 * Job Queue Processor — Phase 0 skeleton
 * Full agent dispatch implemented in Phase 3
 */

const { query, getClient } = require('../db');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const config = require('../config');

let _workerTimer = null;
let _watchdogTimer = null;

// ── Enqueue ──────────────────────────────────────────────────────────────────

async function enqueueJob(jobType, articleId, payload = {}, priority = 'normal', scheduledAt = null) {
  const { rows } = await query(
    `INSERT INTO job_queue (id, article_id, job_type, status, priority, payload, scheduled_at)
     VALUES ($1,$2,$3,'pending',$4,$5,$6)
     RETURNING id, job_type, status`,
    [uuidv4(), articleId, jobType, priority, JSON.stringify(payload), scheduledAt || new Date()]
  );
  await logger.info('JobQueue', `Enqueued ${jobType} job for article ${articleId}`, { jobId: rows[0].id });
  return rows[0];
}

// ── Process next pending job ─────────────────────────────────────────────────

async function processNextJob() {
  // C-3 Fix: Gunakan dedicated client untuk menahan pg_advisory_lock selama
  // job berjalan. Advisory lock bersifat session-level — selama koneksi dipegang,
  // watchdog tidak bisa mengambil lock dan tidak akan mereset job yang masih aktif.
  const client = await getClient();
  let job = null;
  let lockId = null;

  try {
    // Claim one pending job atomically
    const { rows } = await client.query(
      `UPDATE job_queue
       SET status = 'processing', started_at = NOW(), attempts = attempts + 1
       WHERE id = (
         SELECT id FROM job_queue
         WHERE status = 'pending'
           AND scheduled_at <= NOW()
         ORDER BY
           CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
           scheduled_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *`
    );

    if (!rows.length) return null; // No pending jobs

    job = rows[0];

    // Acquire session-level advisory lock keyed by job id.
    // Lock ini ditahan selama proses job berjalan.
    // Watchdog menggunakan pg_try_advisory_lock dengan lock_id yang sama —
    // jika gagal mendapat lock, berarti job masih aktif dan tidak direset.
    const lockRes = await client.query(
      `SELECT hashtext($1)::bigint AS lock_id`, [job.id]
    );
    lockId = lockRes.rows[0].lock_id;
    await client.query(`SELECT pg_advisory_lock($1)`, [lockId]);

    await logger.info('JobQueue', `Processing ${job.job_type} (job ${job.id})`, { jobType: job.job_type, articleId: job.article_id });

    await dispatchJob(job);
    await query(
      `UPDATE job_queue SET status = 'done', finished_at = NOW() WHERE id = $1`,
      [job.id]
    );
    await logger.info('JobQueue', `${job.job_type} completed`, { jobId: job.id });

  } catch (err) {
    if (job) {
      const isFinal = job.attempts >= job.max_attempts;
      const newStatus = isFinal ? 'dead' : 'pending';
      const nextRun = isFinal ? null : new Date(Date.now() + 5000 * Math.pow(2, job.attempts));

      await query(
        `UPDATE job_queue SET status = $1, error_message = $2, finished_at = NOW()
         ${nextRun ? `, scheduled_at = $3` : ''}
         WHERE id = ${nextRun ? '$4' : '$3'}`,
        nextRun
          ? [newStatus, err.message, nextRun, job.id]
          : [newStatus, err.message, job.id]
      );

      if (isFinal) {
        await logger.critical('JobQueue', `Job ${job.id} (${job.job_type}) moved to DEAD after ${job.attempts} attempts`, { error: err.message });
      } else {
        await logger.warn('JobQueue', `Job ${job.id} failed, will retry`, { error: err.message, attempt: job.attempts });
      }
    }
  } finally {
    // Lepas advisory lock (jika berhasil diperoleh) lalu kembalikan koneksi ke pool
    if (lockId !== null) {
      await client.query(`SELECT pg_advisory_unlock($1)`, [lockId]).catch(() => {});
    }
    client.release();
  }

  return job;
}

// ── Dispatch by type ─────────────────────────────────────────────────────────

async function dispatchJob(job) {
  const type = job.job_type;
  const payload = job.payload || {};

  // Agents are loaded lazily — they may not exist in Phase 0
  switch (type) {
    case 'RESEARCH': {
      const ReporterAgent = require('../agents/reporter');
      const agent = new ReporterAgent();
      await agent.run(job.article_id, payload);
      break;
    }
    case 'WRITE': {
      const WriterAgent = require('../agents/writer');
      const agent = new WriterAgent();
      await agent.run(job.article_id, payload);
      break;
    }
    case 'EDIT': {
      const EditorAgent = require('../agents/editor');
      const agent = new EditorAgent();
      await agent.run(job.article_id, payload);
      break;
    }
    case 'QC': {
      const QualityRater = require('../agents/qualityRater');
      const agent = new QualityRater();
      await agent.run(job.article_id, payload);
      break;
    }
    case 'IMAGE': {
      const Photographer = require('../agents/photographer');
      const agent = new Photographer();
      await agent.run(job.article_id, payload);
      break;
    }
    case 'SEO': {
      const SeoAgent = require('../agents/seoSpecialist');
      const agent = new SeoAgent();
      await agent.run(job.article_id, payload);
      break;
    }
    case 'PUBLISH': {
      const Publisher = require('../agents/publisher');
      const agent = new Publisher();
      await agent.run(job.article_id, payload);
      break;
    }
    case 'DUPLICATE_RISK': {
      // Phase 8 Step 8.3 — ChiefEditor resolves duplicate risk decision
      const ChiefEditorAgent = require('../agents/chiefEditor');
      const { query: dbQuery } = require('../db');
      const agent = new ChiefEditorAgent();

      const { originalTopic, duplicates, siteId } = payload;

      // Load site info for context
      let siteInfo = {};
      if (siteId) {
        const { rows: siteRows } = await dbQuery(
          `SELECT name, niche, persona_description FROM sites WHERE id = $1`, [siteId]
        );
        siteInfo = siteRows[0] || {};
      }

      const result = await agent.resolveDuplicateRisk(
        job.article_id, originalTopic, duplicates || [], siteInfo
      );

      // If pivot: update article brief with new angle and re-enqueue WRITE
      if (result.decision === 'pivot' && payload.brief) {
        const { enqueueJob: eq } = require('../services/jobQueue');
        const updatedBrief = {
          ...payload.brief,
          duplicatePivot: true,
          originalTopic,
          pivotAngle: result.newAngle,
          pivotTopic: result.newTopic,
          revisionNotes: `Topik diganti sudut pandang: ${result.newAngle}`,
        };
        // Update article title if newTopic provided
        if (result.newTopic) {
          await dbQuery(
            `UPDATE articles SET title = $1 WHERE id = $2`,
            [result.newTopic, job.article_id]
          );
        }
        await eq('WRITE', job.article_id, {
          brief: updatedBrief,
          format: payload.format,
          siteId,
          category: payload.category,
        }, 'high');
      }
      break;
    }
    case 'EVERGREEN_UPDATE': {
      // Phase 10 Step 10.2 — Evergreen Update Engine
      const { EvergreenUpdateProcessor } = require('../services/evergreenEngine');
      const processor = new EvergreenUpdateProcessor();
      await processor.run(job.article_id, payload);
      break;
    }
    default:
      throw new Error(`Unknown job type: ${type}`);
  }
}

// ── Watchdog — detect stuck jobs ─────────────────────────────────────────────

async function runWatchdog() {
  // Stuck jobs: processing > 30 minutes
  const { rows: stuck } = await query(
    `SELECT id, job_type, attempts, max_attempts FROM job_queue
     WHERE status = 'processing' AND started_at < NOW() - INTERVAL '30 minutes'`
  );

  for (const job of stuck) {
    // C-3 Fix: Gunakan dedicated client untuk setiap operasi advisory lock.
    // pg_try_advisory_lock / pg_advisory_unlock HARUS berjalan pada sesi (koneksi) yang sama.
    // Menggunakan query() (pool) dapat mengirim lock ke koneksi A dan unlock ke koneksi B,
    // meninggalkan stale lock yang memblokir workers.
    const watchdogClient = await getClient();
    try {
      // Hitung lock ID pada koneksi yang sama yang akan dipakai untuk try-lock & unlock
      const lockRes = await watchdogClient.query(
        `SELECT hashtext($1)::bigint AS lock_id`, [job.id]
      );
      const lockId = lockRes.rows[0].lock_id;

      // Coba ambil advisory lock. Jika gagal → worker masih aktif (proses lambat, bukan crash)
      // → SKIP reset untuk menghindari dual execution / artikel duplikat.
      const tryRes = await watchdogClient.query(
        `SELECT pg_try_advisory_lock($1) AS acquired`, [lockId]
      );

      if (!tryRes.rows[0].acquired) {
        // Worker masih menahan lock — job masih aktif, jangan direset
        await logger.warn('Watchdog', `Job ${job.id} (${job.job_type}) >30min tapi worker masih aktif — skip reset`);
        continue;
      }

      // Berhasil ambil lock → worker sudah hilang (crash).
      // Lepas lock DULU pada koneksi yang sama, lalu reset job via pool.
      await watchdogClient.query(`SELECT pg_advisory_unlock($1)`, [lockId]);

      const isFinal = job.attempts >= job.max_attempts;
      await query(
        `UPDATE job_queue SET status = $1, error_message = 'Watchdog: stuck job reset (worker crash)'
         WHERE id = $2`,
        [isFinal ? 'dead' : 'pending', job.id]
      );
      await logger.warn('Watchdog', `Stuck job ${job.id} (${job.job_type}) reset to ${isFinal ? 'dead' : 'pending'}`);
    } finally {
      // Pastikan koneksi selalu dikembalikan ke pool, bahkan jika ada error
      watchdogClient.release();
    }
  }

  // Keys with error flood
  const { rows: badKeys } = await query(
    `SELECT metadata->>'keyId' AS key_id, count(*) AS cnt
     FROM system_logs
     WHERE level = 'error'
       AND message LIKE '%LLM call FAILED%'
       AND created_at > NOW() - INTERVAL '1 hour'
     GROUP BY 1
     HAVING count(*) > 10`
  );
  for (const r of badKeys) {
    if (!r.key_id) continue;
    await query(`UPDATE api_keys SET status = 'paused' WHERE id = $1`, [r.key_id]);
    await logger.critical('Watchdog', `Key ${r.key_id} auto-paused: ${r.cnt} errors in 1h`);
  }
}

// ── Start/stop ────────────────────────────────────────────────────────────────

function startWorker() {
  if (_workerTimer) return;
  _workerTimer = setInterval(async () => {
    try { await processNextJob(); } catch (err) {
      logger.error('JobQueue', `Worker error: ${err.message}`);
    }
  }, config.jobWorkerIntervalMs || 30000);

  _watchdogTimer = setInterval(async () => {
    try { await runWatchdog(); } catch (err) {
      logger.error('Watchdog', `Watchdog error: ${err.message}`);
    }
  }, config.watchdogIntervalMs || 300000);

  logger.info('JobQueue', `Worker started (interval: ${config.jobWorkerIntervalMs}ms)`);
}

function stopWorker() {
  if (_workerTimer)  { clearInterval(_workerTimer);  _workerTimer = null; }
  if (_watchdogTimer){ clearInterval(_watchdogTimer); _watchdogTimer = null; }
}

module.exports = { enqueueJob, processNextJob, startWorker, stopWorker, runWatchdog };
