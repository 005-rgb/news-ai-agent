'use strict';

/**
 * Penulis Agent — Phase 3
 * Input: { brief, format, siteId, category }
 * Output: { mainArticle, faqVersion, summary, socialCaption, imagePlaceholders }
 */

const BaseAgent = require('./base');
const { query } = require('../db');

class WriterAgent extends BaseAgent {
  constructor() { super('WriterAgent'); }

  async run(articleId, payload) {
    await this.log('info', `Writing article ${articleId}`, { format: payload.format });
    await query(`UPDATE articles SET status = 'writing' WHERE id = $1`, [articleId]);

    // Phase 3 full implementation: load persona → load template → call LLM
    // Phase 0 stub: placeholder content
    const draft = {
      mainArticle: `[Draft konten untuk artikel ${articleId}. Akan diisi oleh Penulis Agent di Phase 3.]`,
      faqVersion: [],
      keyTakeaways: ['Poin penting 1', 'Poin penting 2', 'Poin penting 3'],
      socialCaption: `Artikel baru tersedia. #berita #indonesia`,
      imagePlaceholders: ['{{IMAGE: featured image relevan dengan topik}}'],
      wordCount: 0,
    };

    await query(
      `UPDATE articles SET content_versions = $1, status = 'editing' WHERE id = $2`,
      [JSON.stringify(draft), articleId]
    );
    await this.log('info', `Writing complete for article ${articleId}`);
    return draft;
  }
}

module.exports = WriterAgent;
