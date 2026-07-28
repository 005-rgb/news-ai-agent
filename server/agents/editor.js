'use strict';

/**
 * Editor Agent — Phase 3
 * Input: { draft, brief, siteId, format }
 * Output: { editedArticle, qualityScore, changeLog, needsRevision, revisionNotes }
 */

const BaseAgent = require('./base');
const { query } = require('../db');

class EditorAgent extends BaseAgent {
  constructor() { super('EditorAgent'); }

  async run(articleId, payload) {
    await this.log('info', `Editing article ${articleId}`);
    await query(`UPDATE articles SET status = 'editing' WHERE id = $1`, [articleId]);

    // Phase 3 full: accuracy check → dedup check → persona check → LLM edit → humanizer → score
    // Phase 0 stub:
    const qualityScore = 80;
    await query(
      `UPDATE articles SET quality_score = $1, status = 'qc' WHERE id = $2`,
      [qualityScore, articleId]
    );
    await this.log('info', `Editing complete. Score: ${qualityScore}`, { articleId });
    return { qualityScore, needsRevision: false };
  }
}

module.exports = EditorAgent;
