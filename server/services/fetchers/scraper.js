'use strict';

/**
 * Web Scraper Fallback — Phase 2
 * For sources without RSS/API
 * Rate-limited: 5 seconds between requests to same domain
 * Respects robots.txt
 */

const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../../utils/logger');

const USER_AGENT = 'Mozilla/5.0 (compatible; NewsAIAgent/1.0; +https://newsaiagent.com/bot)';
const TIMEOUT = 20000;
const MAX_CONTENT_BYTES = 500 * 1024; // 500KB

// Per-domain rate limiting: last request time
const _domainQueue = new Map();
const MIN_DELAY_MS = 5000;

function getDomain(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

async function respectRateLimit(domain) {
  const lastTime = _domainQueue.get(domain) || 0;
  const elapsed = Date.now() - lastTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise(r => setTimeout(r, MIN_DELAY_MS - elapsed));
  }
  _domainQueue.set(domain, Date.now());
}

async function checkRobotsTxt(domain) {
  try {
    const res = await axios.get(`https://${domain}/robots.txt`, {
      timeout: 5000,
      headers: { 'User-Agent': USER_AGENT },
    });
    const lines = res.data.split('\n');
    let inOurBlock = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.toLowerCase().startsWith('user-agent:')) {
        const agent = trimmed.split(':')[1].trim();
        inOurBlock = agent === '*' || agent.toLowerCase().includes('newsaiagent');
      }
      if (inOurBlock && trimmed.toLowerCase() === 'disallow: /') return false;
    }
    return true;
  } catch {
    return true; // if can't fetch, assume allowed
  }
}

/**
 * Scrape a source using configurable CSS selectors
 * @param {string} url
 * @param {{ listSelector?, titleSelector?, linkSelector?, contentSelector? }} selectors
 */
async function scrapeSource(url, selectors = {}) {
  const domain = getDomain(url);
  const allowed = await checkRobotsTxt(domain);
  if (!allowed) {
    await logger.warn('Scraper', `robots.txt disallows scraping ${domain}`);
    return [];
  }

  await respectRateLimit(domain);

  const res = await axios.get(url, {
    timeout: TIMEOUT,
    headers: { 'User-Agent': USER_AGENT },
    maxContentLength: MAX_CONTENT_BYTES,
    responseType: 'text',
  });

  const $ = cheerio.load(res.data);
  const items = [];

  // Use provided selectors or auto-detect common patterns
  const listSel    = selectors.listSelector   || 'article, .article, .post, .news-item, li';
  const titleSel   = selectors.titleSelector  || 'h1, h2, h3, .title, .headline';
  const linkSel    = selectors.linkSelector   || 'a';
  const contentSel = selectors.contentSelector || 'p';

  $(listSel).each((_, el) => {
    const $el = $(el);
    const title = $el.find(titleSel).first().text().trim();
    const link  = $el.find(linkSel).first().attr('href') || '';
    const content = $el.find(contentSel).map((_, p) => $(p).text().trim()).get().join(' ');

    if (title.length > 10) {
      items.push({
        title,
        link: link.startsWith('http') ? link : `https://${domain}${link}`,
        pubDate: new Date().toISOString(),
        summary: content.slice(0, 400),
        content,
        author: '',
        categories: [],
      });
    }
  });

  return items.slice(0, 20);
}

module.exports = { scrapeSource };
