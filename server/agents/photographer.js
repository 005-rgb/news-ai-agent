'use strict';

const BaseAgent = require('./base');
const { query } = require('../db');

class PhotographerAgent extends BaseAgent {
  constructor() { super('PhotographerAgent'); }

  async run(articleId, payload) {
    await this.log('info', `Finding images for article ${articleId}`);
    await query(`UPDATE articles SET status = 'imaging' WHERE id = $1`, [articleId]);
    // Phase 5: AI generate → Unsplash → Pexels → placeholder branded
    const imageData = { source: 'placeholder', altText: 'Featured image', caption: '' };
    await query(`UPDATE articles SET image_data = $1, status = 'seo' WHERE id = $2`, [JSON.stringify(imageData), articleId]);
    return imageData;
  }
}

module.exports = PhotographerAgent;
