'use strict';

/**
 * Reporter/Peneliti Agent — Phase 3
 * Input: { topic, category, siteId }
 * Output: brief riset JSON (facts, quotes, statistics, sources)
 */

const BaseAgent = require('./base');
const { query } = require('../db');

class ReporterAgent extends BaseAgent {
  constructor() { super('ReporterAgent'); }

  async run(articleId, payload) {
    const { topic, category, siteId } = payload;
    await this.log('info', `Starting research for: "${topic}"`, { articleId, category });
    await query(`UPDATE articles SET status = 'researching' WHERE id = $1`, [articleId]);

    // Phase 3 full implementation: selectSources → fetch → LLM extract → verify
    // Phase 0 stub: placeholder brief
    const brief = {
      topic,
      category,
      facts: [`Topik "${topic}" perlu diriset dari sumber berita terpercaya.`],
      quotes: [],
      statistics: [],
      sources: [],
      credibilityScore: 0,
      researchedAt: new Date().toISOString(),
    };

    await query(
      `UPDATE articles SET brief_data = $1, status = 'writing' WHERE id = $2`,
      [JSON.stringify(brief), articleId]
    );
    await this.log('info', `Research complete for: "${topic}"`, { articleId });
    return brief;
  }
}

module.exports = ReporterAgent;
