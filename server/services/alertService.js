'use strict';

/**
 * Phase 11.2 — Alert & Notification System
 *
 * Alert types:
 *   key_exhausted          — API key mencapai 100% limit harian
 *   key_critical           — API key mencapai 95% limit harian
 *   key_warning            — API key melebihi warning threshold
 *   key_error_flood        — API key error >10x dalam 1 jam
 *   all_keys_exhausted     — semua provider habis
 *   pipeline_stuck         — job processing > 30 menit
 *   wordpress_error        — error WP berulang dalam 24 jam
 *   quality_gate_fail_streak — ≥5 artikel gagal QC dalam 24 jam
 *   dead_job_queue_growing — >10 dead jobs dalam 24 jam
 */

const { query } = require('../db');
const { v4: uuidv4 } = require('uuid');

// ── Create alert (with deduplication) ────────────────────────────────────────

async function createAlert(type, severity, title, message, metadata = {}) {
  try {
    const dedupeKey = metadata.dedupeKey ? String(metadata.dedupeKey) : null;

    // C-4 Fix: Ganti pola SELECT-then-INSERT (race condition) dengan satu INSERT atomik
    // menggunakan ON CONFLICT ... DO NOTHING pada partial unique index:
    //   idx_system_alerts_dedup ON system_alerts(type, dedup_key)
    //   WHERE dedup_key IS NOT NULL AND is_resolved = false
    // Dua concurrent call dengan dedupeKey yang sama hanya akan menghasilkan satu baris.
    const { rows } = await query(
      `INSERT INTO system_alerts (id, type, severity, title, message, metadata, dedup_key, is_resolved)
       VALUES ($1,$2,$3,$4,$5,$6,$7,false)
       ON CONFLICT (type, dedup_key) WHERE dedup_key IS NOT NULL AND is_resolved = false
       DO NOTHING
       RETURNING *`,
      [uuidv4(), type, severity, title, message, JSON.stringify(metadata), dedupeKey]
    );

    if (rows.length === 0 && dedupeKey) {
      // Conflict terjadi — alert dengan dedupeKey ini sudah aktif. Kembalikan yang existing.
      const { rows: existing } = await query(
        `SELECT * FROM system_alerts WHERE type = $1 AND dedup_key = $2 AND is_resolved = false LIMIT 1`,
        [type, dedupeKey]
      );
      return existing[0] || null;
    }

    return rows[0] || null;
  } catch (err) {
    console.error('[AlertService] createAlert error:', err.message);
    return null;
  }
}

// ── Resolve individual alert ──────────────────────────────────────────────────

async function resolveAlert(id) {
  const { rows } = await query(
    `UPDATE system_alerts SET is_resolved = true, resolved_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

// ── Resolve alerts by type + optional dedupeKey ───────────────────────────────

async function resolveAlertsByType(type, dedupeKey = null) {
  try {
    if (dedupeKey) {
      await query(
        `UPDATE system_alerts SET is_resolved = true, resolved_at = NOW()
         WHERE type = $1 AND is_resolved = false AND metadata->>'dedupeKey' = $2`,
        [type, String(dedupeKey)]
      );
    } else {
      await query(
        `UPDATE system_alerts SET is_resolved = true, resolved_at = NOW()
         WHERE type = $1 AND is_resolved = false`,
        [type]
      );
    }
  } catch (err) {
    console.error('[AlertService] resolveAlertsByType error:', err.message);
  }
}

// ── Resolve all active alerts ─────────────────────────────────────────────────

async function resolveAll() {
  await query(
    `UPDATE system_alerts SET is_resolved = true, resolved_at = NOW()
     WHERE is_resolved = false`
  );
}

// ── Get active alerts (sorted by severity) ────────────────────────────────────

async function getActiveAlerts(limit = 50) {
  const { rows } = await query(
    `SELECT * FROM system_alerts WHERE is_resolved = false
     ORDER BY
       CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
       created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

// ── Get all alerts with optional resolved filter ──────────────────────────────

async function getAllAlerts({ includeResolved = false, limit = 100, offset = 0 } = {}) {
  const where = includeResolved ? '' : 'WHERE is_resolved = false';
  const { rows } = await query(
    `SELECT * FROM system_alerts ${where}
     ORDER BY
       CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
       created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  const { rows: countRows } = await query(
    `SELECT count(*) FROM system_alerts ${where}`
  );
  return { rows, total: parseInt(countRows[0].count) };
}

// ── Quick count of active alerts ──────────────────────────────────────────────

async function getAlertCount() {
  const { rows } = await query(
    `SELECT count(*) FROM system_alerts WHERE is_resolved = false`
  );
  return parseInt(rows[0].count);
}

// ─────────────────────────────────────────────────────────────────────────────
// Alert Scan — dipanggil setiap 5 menit oleh cron
// ─────────────────────────────────────────────────────────────────────────────

async function runAlertScan() {
  try {
    await Promise.all([
      _scanKeyAlerts(),
      _scanKeyErrorFlood(),
      _scanAllKeysExhausted(),
      _scanPipelineStuck(),
      _scanQualityStreak(),
      _scanWordPressErrors(),
      _scanDeadJobQueue(),
    ]);
  } catch (err) {
    console.error('[AlertService] runAlertScan error:', err.message);
  }
}

async function _scanKeyAlerts() {
  // Baca threshold dari DB (bisa di-override dari Settings)
  const { rows: cfgRows } = await query(
    `SELECT value FROM system_settings WHERE key = 'key_warning_threshold'`
  );
  const threshold = parseFloat(cfgRows[0]?.value ?? '80') / 100; // e.g. 0.80

  const { rows: keys } = await query(
    `SELECT id, label, provider, usage_today, daily_limit
     FROM api_keys
     WHERE provider != '_config' AND status = 'active' AND daily_limit > 0`
  );

  for (const key of keys) {
    const pct = key.usage_today / key.daily_limit;
    const shortId = key.id.slice(0, 8);
    const keyName = `${key.provider}${key.label ? ` (${key.label})` : ` (${shortId})`}`;

    if (pct >= 1.0) {
      await createAlert(
        'key_exhausted', 'critical',
        `API Key Exhausted: ${keyName}`,
        `Key mencapai 100% limit harian (${key.usage_today}/${key.daily_limit} token).`,
        { keyId: key.id, provider: key.provider, dedupeKey: `exhausted_${key.id}` }
      );
    } else if (pct >= 0.95) {
      await createAlert(
        'key_critical', 'warning',
        `API Key Critical: ${keyName}`,
        `Key mencapai 95% limit harian (${key.usage_today}/${key.daily_limit} token). Segera tambah key cadangan.`,
        { keyId: key.id, provider: key.provider, usagePct: Math.round(pct * 100), dedupeKey: `critical_${key.id}` }
      );
      await resolveAlertsByType('key_warning', `warning_${key.id}`);
    } else if (pct >= threshold) {
      await createAlert(
        'key_warning', 'warning',
        `API Key Warning: ${keyName}`,
        `Key mencapai ${Math.round(pct * 100)}% dari limit harian (${key.usage_today}/${key.daily_limit}).`,
        { keyId: key.id, provider: key.provider, usagePct: Math.round(pct * 100), dedupeKey: `warning_${key.id}` }
      );
    } else {
      // Usage kembali normal — resolve alert warning yang ada
      await resolveAlertsByType('key_warning', `warning_${key.id}`);
      await resolveAlertsByType('key_critical', `critical_${key.id}`);
    }
  }
}

// ── key_error_flood — API key error >10x dalam 1 jam ─────────────────────────
async function _scanKeyErrorFlood() {
  const { rows } = await query(
    `SELECT
       COALESCE(metadata->>'keyId', 'unknown') AS key_id,
       COALESCE(metadata->>'provider', 'unknown') AS provider,
       count(*) AS cnt
     FROM system_logs
     WHERE level IN ('error','critical')
       AND message ILIKE '%api key%'
       AND created_at > NOW() - INTERVAL '1 hour'
     GROUP BY metadata->>'keyId', metadata->>'provider'
     HAVING count(*) > 10`
  );
  for (const r of rows) {
    await createAlert(
      'key_error_flood', 'critical',
      `API Key Error Flood: ${r.provider}`,
      `Key ${r.key_id.slice(0,8)} mengalami ${r.cnt} error dalam 1 jam terakhir. Periksa validitas key atau rate limit.`,
      { keyId: r.key_id, provider: r.provider, errorCount: parseInt(r.cnt), dedupeKey: `err_flood_${r.key_id}` }
    );
  }
}

// ── all_keys_exhausted — semua provider habis ───────────────────────────────
async function _scanAllKeysExhausted() {
  const { rows } = await query(
    `SELECT
       provider,
       count(*) FILTER (WHERE usage_today >= daily_limit) AS exhausted,
       count(*) AS total
     FROM api_keys
     WHERE provider != '_config' AND status = 'active' AND daily_limit > 0
     GROUP BY provider`
  );
  const allExhausted = rows.length > 0 && rows.every(r => parseInt(r.exhausted) >= parseInt(r.total));
  const DEDUPE = 'all_keys_exhausted';
  if (allExhausted) {
    await createAlert(
      'all_keys_exhausted', 'critical',
      `Semua API Key Habis`,
      `Semua ${rows.length} provider telah mencapai 100% limit harian. Sistem tidak dapat generate artikel baru hingga reset.`,
      { providers: rows.map(r => r.provider), dedupeKey: DEDUPE }
    );
  } else {
    await resolveAlertsByType('all_keys_exhausted', DEDUPE);
  }
}

// ── dead_job_queue_growing — >10 dead jobs dalam 24 jam ─────────────────────
async function _scanDeadJobQueue() {
  const { rows } = await query(
    `SELECT count(*) AS cnt FROM job_queue
     WHERE status = 'dead' AND created_at > NOW() - INTERVAL '24 hours'`
  );
  const deadCount = parseInt(rows[0].cnt);
  const DEDUPE = 'dead_queue_growing';
  if (deadCount > 10) {
    await createAlert(
      'dead_job_queue_growing', 'critical',
      `Dead Job Queue Growing: ${deadCount} jobs`,
      `${deadCount} dead jobs dalam 24 jam terakhir. Periksa error patterns dan retry atau purge dead jobs.`,
      { deadCount, dedupeKey: DEDUPE }
    );
  } else {
    await resolveAlertsByType('dead_job_queue_growing', DEDUPE);
  }
}

async function _scanPipelineStuck() {
  const { rows: stuck } = await query(
    `SELECT id, job_type, article_id FROM job_queue
     WHERE status = 'processing' AND started_at < NOW() - INTERVAL '30 minutes'`
  );
  for (const job of stuck) {
    await createAlert(
      'pipeline_stuck', 'critical',
      `Pipeline Stuck: ${job.job_type}`,
      `Job ${job.id.slice(0, 8)} (${job.job_type}) berjalan > 30 menit tanpa selesai.`,
      { jobId: job.id, jobType: job.job_type, articleId: job.article_id, dedupeKey: `stuck_${job.id}` }
    );
  }
  // Resolve stuck alerts untuk job yang sudah selesai
  const { rows: doneStuck } = await query(
    `SELECT sa.metadata->>'jobId' AS job_id
     FROM system_alerts sa
     WHERE sa.type = 'pipeline_stuck' AND sa.is_resolved = false`
  );
  for (const r of doneStuck) {
    if (!r.job_id) continue;
    const { rows: jobRows } = await query(
      `SELECT status FROM job_queue WHERE id = $1`, [r.job_id]
    );
    if (jobRows[0] && jobRows[0].status !== 'processing') {
      await resolveAlertsByType('pipeline_stuck', `stuck_${r.job_id}`);
    }
  }
}

async function _scanQualityStreak() {
  const { rows } = await query(
    `SELECT count(*) AS cnt FROM articles
     WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours'`
  );
  const failCount = parseInt(rows[0].cnt);
  const STREAK_KEY = 'quality_streak_today';

  if (failCount >= 5) {
    // Update existing atau buat baru
    const existing = await query(
      `SELECT id FROM system_alerts WHERE type = 'quality_gate_fail_streak' AND is_resolved = false AND metadata->>'dedupeKey' = $1`,
      [STREAK_KEY]
    );
    if (existing.rows.length > 0) {
      // Update count di metadata
      await query(
        `UPDATE system_alerts SET message = $1, metadata = metadata || $2::jsonb
         WHERE id = $3`,
        [
          `${failCount} artikel gagal quality gate dalam 24 jam terakhir.`,
          JSON.stringify({ failCount }),
          existing.rows[0].id,
        ]
      );
    } else {
      await createAlert(
        'quality_gate_fail_streak', 'warning',
        `Quality Gate Fail Streak: ${failCount} Artikel`,
        `${failCount} artikel gagal quality gate dalam 24 jam terakhir.`,
        { failCount, dedupeKey: STREAK_KEY }
      );
    }
  } else {
    await resolveAlertsByType('quality_gate_fail_streak', STREAK_KEY);
  }
}

async function _scanWordPressErrors() {
  const { rows } = await query(
    `SELECT
       COALESCE(metadata->>'siteId', 'unknown') AS site_id,
       count(*) AS cnt
     FROM system_logs
     WHERE level IN ('error', 'critical')
       AND (message ILIKE '%wordpress%' OR message ILIKE '%wp-json%' OR message ILIKE '%WP%')
       AND created_at > NOW() - INTERVAL '24 hours'
     GROUP BY metadata->>'siteId'
     HAVING count(*) >= 3`
  );
  for (const r of rows) {
    const siteId = r.site_id;
    let siteName = siteId;
    if (siteId !== 'unknown') {
      const siteRow = await query(`SELECT name FROM sites WHERE id = $1`, [siteId]).catch(() => ({ rows: [] }));
      if (siteRow.rows[0]) siteName = siteRow.rows[0].name;
    }
    await createAlert(
      'wordpress_error', 'critical',
      `WordPress Error Berulang: ${siteName}`,
      `${r.cnt} error WordPress dalam 24 jam terakhir. Periksa credentials atau status site.`,
      { siteId, errorCount: parseInt(r.cnt), dedupeKey: `wp_err_${siteId}` }
    );
  }
}

module.exports = {
  createAlert,
  resolveAlert,
  resolveAlertsByType,
  resolveAll,
  getActiveAlerts,
  getAllAlerts,
  getAlertCount,
  runAlertScan,
};
