'use strict';

/**
 * Prompt Evolution System — Phase 10 Step 10.4
 *
 * Setiap minggu: evaluasi semua prompt versions, korelasikan dengan skor artikel.
 * Jika prompt A (n > 20 sampel) punya rata-rata skor 5+ poin lebih tinggi dari champion saat ini:
 *   → Champion lama menjadi 'active', A menjadi 'champion'
 *   → Champion lama menjadi 'deprecated' jika performanya di bawah rata-rata
 *
 * 10% A/B test: writer secara random memilih prompt 'experimental' (jika ada).
 */

const { query } = require('../db');
const logger    = require('../utils/logger');

const AGENT               = 'PromptEvolution';
const MIN_SAMPLES         = 20;    // minimal sampel untuk promosi
const CHAMPION_MARGIN     = 5.0;   // poin skor rata-rata minimum untuk promosi
const AB_TEST_PROBABILITY = 0.10;  // 10% chance pilih experimental

// ── Weekly evaluator ─────────────────────────────────────────────────────────

async function runWeeklyEvaluation() {
  logger.info(AGENT, 'Memulai evaluasi prompt mingguan...');

  try {
    // Ambil semua prompt versions dengan skor artikel yang menggunakannya
    const { rows: versions } = await query(
      `SELECT
         pv.id, pv.name, pv.format_key, pv.agent_type, pv.category,
         pv.is_champion, pv.status, pv.performance_score, pv.sample_count,
         ROUND(AVG(a.quality_score)::numeric, 2)  AS avg_quality,
         ROUND(AVG(a.eeat_score)::numeric, 2)     AS avg_eeat,
         COUNT(a.id)::int                         AS real_samples
       FROM prompt_versions pv
       LEFT JOIN articles a
         ON a.prompt_version = pv.name
         AND a.status = 'published'
         AND a.published_at > NOW() - INTERVAL '60 days'
       WHERE pv.is_active = true
       GROUP BY pv.id
       ORDER BY pv.format_key, avg_quality DESC NULLS LAST`
    );

    if (!versions.length) {
      logger.info(AGENT, 'Tidak ada prompt versions aktif untuk dievaluasi.');
      return { evaluated: 0, promoted: 0, deprecated: 0 };
    }

    // Grup berdasarkan format_key
    const byFormat = {};
    for (const v of versions) {
      const key = v.format_key || 'default';
      if (!byFormat[key]) byFormat[key] = [];
      byFormat[key].push(v);
    }

    let promoted = 0;
    let deprecated = 0;

    for (const [formatKey, group] of Object.entries(byFormat)) {
      const currentChampion = group.find(v => v.is_champion);
      const challengers = group.filter(v => !v.is_champion && v.status !== 'deprecated');

      for (const challenger of challengers) {
        const challengerScore = parseFloat(challenger.avg_quality) || 0;
        const challengerSamples = challenger.real_samples || 0;

        if (challengerSamples < MIN_SAMPLES) continue;

        const championScore = currentChampion
          ? (parseFloat(currentChampion.avg_quality) || 0)
          : 0;

        if (challengerScore >= championScore + CHAMPION_MARGIN) {
          // Promosikan challenger → champion
          await promoteToChampion(challenger.id, formatKey, currentChampion?.id);
          promoted++;
          logger.info(AGENT, `✅ Prompt baru champion: "${challenger.name}" (format: ${formatKey}, score: ${challengerScore} vs ${championScore})`, {});
        }
      }

      // Deprecated jika skor sangat di bawah rata-rata format (dan bukan champion)
      const avgGroupScore = group.reduce((sum, v) => sum + (parseFloat(v.avg_quality) || 0), 0) / group.length;
      for (const v of group) {
        if (v.is_champion || v.status === 'deprecated' || v.real_samples < 5) continue;
        const score = parseFloat(v.avg_quality) || 0;
        if (score < avgGroupScore - 10 && score < 60) {
          await query(
            `UPDATE prompt_versions SET status = 'deprecated', is_active = false WHERE id = $1`,
            [v.id]
          );
          deprecated++;
          logger.info(AGENT, `⚠️ Prompt deprecated: "${v.name}" (score: ${score}, avg group: ${avgGroupScore.toFixed(1)})`, {});
        }
      }

      // Update performance_score dari data real
      for (const v of group) {
        if (v.real_samples > 0) {
          const perfScore = parseFloat(v.avg_quality) || null;
          await query(
            `UPDATE prompt_versions SET performance_score = $1, sample_count = $2 WHERE id = $3`,
            [perfScore, v.real_samples, v.id]
          ).catch(() => {});
        }
      }
    }

    logger.info(AGENT, `Evaluasi selesai: ${promoted} dipromosikan, ${deprecated} deprecated`, {});
    return { evaluated: versions.length, promoted, deprecated };
  } catch (err) {
    logger.error(AGENT, `Weekly evaluation error: ${err.message}`, {});
    throw err;
  }
}

// ── Promote challenger ke champion ───────────────────────────────────────────

async function promoteToChampion(newChampionId, formatKey, oldChampionId) {
  // Turunkan semua champion lama untuk format ini
  await query(
    `UPDATE prompt_versions SET is_champion = false WHERE format_key = $1 AND is_champion = true`,
    [formatKey]
  );

  // Promote versi baru
  await query(
    `UPDATE prompt_versions SET is_champion = true, status = 'champion' WHERE id = $1`,
    [newChampionId]
  );

  // Jika ada champion lama yang kinerjanya buruk → deprecated
  if (oldChampionId) {
    const { rows } = await query(
      `SELECT performance_score FROM prompt_versions WHERE id = $1`,
      [oldChampionId]
    );
    const oldScore = parseFloat(rows[0]?.performance_score) || 0;
    if (oldScore < 65) {
      await query(
        `UPDATE prompt_versions SET status = 'deprecated', is_active = false WHERE id = $1`,
        [oldChampionId]
      ).catch(() => {});
    } else {
      await query(
        `UPDATE prompt_versions SET status = 'active' WHERE id = $1`,
        [oldChampionId]
      ).catch(() => {});
    }
  }
}

// ── A/B Test: pilih experimental prompt (10%) ─────────────────────────────────

/**
 * Dipanggil oleh writer.js setelah loadDbTemplate.
 * 10% chance: ganti template dengan yang berstatus 'experimental' (jika ada).
 *
 * @param {object|null} championTemplate - template champion yang sudah diload
 * @param {string} format               - format artikel
 * @returns {object|null}               - template yang akan digunakan (champion atau experimental)
 */
async function maybeSelectExperimental(championTemplate, format) {
  // Hanya 10% chance melakukan A/B test
  if (Math.random() > AB_TEST_PROBABILITY) return championTemplate;

  try {
    const { rows } = await query(
      `SELECT id, name, format_key, prompt_template, is_champion, status
       FROM prompt_versions
       WHERE status = 'experimental'
         AND is_active = true
         AND (format_key = $1 OR format_key IS NULL)
       ORDER BY RANDOM()
       LIMIT 1`,
      [format]
    );

    if (!rows.length) return championTemplate;

    logger.info(AGENT, `A/B test: menggunakan prompt experimental "${rows[0].name}" (format: ${format})`, {});
    return { ...rows[0], isExperimental: true };
  } catch (e) {
    return championTemplate;
  }
}

// ── Admin: force promote/demote ───────────────────────────────────────────────

async function adminPromote(promptVersionId) {
  const { rows } = await query(`SELECT format_key FROM prompt_versions WHERE id = $1`, [promptVersionId]);
  if (!rows.length) throw new Error('Prompt version tidak ditemukan');
  const { format_key } = rows[0];
  await promoteToChampion(promptVersionId, format_key, null);
  return { promoted: true };
}

async function adminDeprecate(promptVersionId) {
  await query(
    `UPDATE prompt_versions SET status = 'deprecated', is_active = false, is_champion = false WHERE id = $1`,
    [promptVersionId]
  );
  return { deprecated: true };
}

async function adminSetExperimental(promptVersionId) {
  await query(
    `UPDATE prompt_versions SET status = 'experimental', is_champion = false WHERE id = $1`,
    [promptVersionId]
  );
  return { experimental: true };
}

module.exports = {
  runWeeklyEvaluation,
  maybeSelectExperimental,
  adminPromote,
  adminDeprecate,
  adminSetExperimental,
};
