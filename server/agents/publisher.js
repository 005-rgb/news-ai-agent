'use strict';

const BaseAgent = require('./base');
const { query } = require('../db');

class PublisherAgent extends BaseAgent {
  constructor() { super('PublisherAgent'); }

  async run(articleId, payload) {
    await this.log('info', `Publishing article ${articleId}`);
    await query(`UPDATE articles SET status = 'scheduled' WHERE id = $1`, [articleId]);
    // Phase 5: upload image → create category/tags → POST to WordPress REST API
    // For now mark as published placeholder
    await query(
      `UPDATE articles SET status = 'published', published_at = NOW(), last_updated_at = NOW() WHERE id = $1`,
      [articleId]
    );
    return { published: true };
  }
}

module.exports = PublisherAgent;
