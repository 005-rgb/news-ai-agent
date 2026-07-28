'use strict';

const BaseAgent = require('./base');
const { query } = require('../db');

class SeoSpecialistAgent extends BaseAgent {
  constructor() { super('SeoSpecialistAgent'); }

  async run(articleId, payload) {
    await this.log('info', `SEO optimization for article ${articleId}`);
    await query(`UPDATE articles SET status = 'seo' WHERE id = $1`, [articleId]);
    // Phase 5: keyword research → meta title/desc → headings → internal links → schema
    const seoData = { metaTitle: '', metaDescription: '', slug: '', keywords: {}, internalLinks: [] };
    await query(`UPDATE articles SET seo_data = $1, status = 'scheduled' WHERE id = $2`, [JSON.stringify(seoData), articleId]);
    return seoData;
  }
}

module.exports = SeoSpecialistAgent;
