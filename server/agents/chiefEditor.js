'use strict';

const BaseAgent = require('./base');

class ChiefEditorAgent extends BaseAgent {
  constructor() { super('ChiefEditorAgent'); }

  async runRapat(context = {}) {
    // Phase 9: analyze trends → competitor gaps → generate content calendar → write notulen
    await this.log('info', 'Running Rapat Redaksi', context);
    return { status: 'Phase 9 implementation pending', runAt: new Date().toISOString() };
  }

  async generateAdHocTopic(siteId, category) {
    // Phase 6: used by scheduler when content_calendar is empty
    await this.log('info', `Generating ad-hoc topic for site ${siteId}`, { category });
    return { topic: `Artikel terkini kategori ${category}`, category, format: 'berita_singkat' };
  }
}

module.exports = ChiefEditorAgent;
