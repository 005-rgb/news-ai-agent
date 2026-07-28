'use strict';

/**
 * Academic Fetcher — Phase 2
 * PubMed, arXiv, Semantic Scholar, Google Scholar, SINTA
 * All return standard format: { title, link, pubDate, summary, content, author, categories }
 */

const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../../utils/logger');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; NewsAIAgent/1.0; +https://newsaiagent.com/bot)',
};

// ── PubMed ────────────────────────────────────────────────────────────────────

async function fetchPubMed(keyword, maxResults = 10) {
  try {
    // Step 1: Search for IDs
    const searchRes = await axios.get('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi', {
      params: { db: 'pubmed', term: keyword, retmax: maxResults, retmode: 'json' },
      timeout: 15000, headers: HEADERS,
    });
    const ids = searchRes.data.esearchresult?.idlist || [];
    if (!ids.length) return [];

    // Step 2: Fetch abstracts
    const fetchRes = await axios.get('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi', {
      params: { db: 'pubmed', id: ids.join(','), retmode: 'json', rettype: 'abstract' },
      timeout: 20000, headers: HEADERS,
    });

    const articles = fetchRes.data.PubmedArticleSet?.PubmedArticle || [];
    return articles.map((a) => {
      const art = a.MedlineCitation?.Article || {};
      const title = art.ArticleTitle?._?.toString() || art.ArticleTitle?.toString() || '';
      const abstract = art.Abstract?.AbstractText?.join(' ') || '';
      const authors = (art.AuthorList?.Author || []).map(au => `${au.LastName || ''} ${au.ForeName || ''}`.trim()).join(', ');
      const pmid = a.MedlineCitation?.PMID?._ || '';
      return {
        title,
        link: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        pubDate: new Date().toISOString(),
        summary: abstract.slice(0, 400),
        content: abstract,
        author: authors,
        categories: ['akademik'],
      };
    }).filter(a => a.title);
  } catch (err) {
    await logger.warn('AcademicFetcher', `PubMed fetch failed: ${err.message}`);
    return [];
  }
}

// ── arXiv ─────────────────────────────────────────────────────────────────────

async function fetchArxiv(keyword, maxResults = 10) {
  try {
    const res = await axios.get('https://export.arxiv.org/api/query', {
      params: { search_query: `all:${keyword}`, max_results: maxResults, sortBy: 'submittedDate', sortOrder: 'descending' },
      timeout: 15000, headers: HEADERS,
    });

    const $ = cheerio.load(res.data, { xmlMode: true });
    const entries = [];
    $('entry').each((_, el) => {
      const $el = $(el);
      entries.push({
        title:      $el.find('title').first().text().trim(),
        link:       $el.find('id').text().trim(),
        pubDate:    $el.find('published').text().trim(),
        summary:    $el.find('summary').text().trim().slice(0, 400),
        content:    $el.find('summary').text().trim(),
        author:     $el.find('author > name').map((_, a) => $(a).text()).get().join(', '),
        categories: ['akademik'],
      });
    });
    return entries.filter(e => e.title);
  } catch (err) {
    await logger.warn('AcademicFetcher', `arXiv fetch failed: ${err.message}`);
    return [];
  }
}

// ── Semantic Scholar ──────────────────────────────────────────────────────────

async function fetchSemanticScholar(keyword, maxResults = 10) {
  try {
    const res = await axios.get('https://api.semanticscholar.org/graph/v1/paper/search', {
      params: { query: keyword, limit: maxResults, fields: 'title,authors,abstract,year,citationCount,url' },
      timeout: 15000,
      headers: { ...HEADERS, 'x-api-key': process.env.SEMANTIC_SCHOLAR_API_KEY || '' },
    });

    return (res.data.data || []).map((p) => ({
      title:      p.title || '',
      link:       p.url || `https://www.semanticscholar.org/paper/${p.paperId}`,
      pubDate:    p.year ? `${p.year}-01-01` : new Date().toISOString(),
      summary:    (p.abstract || '').slice(0, 400),
      content:    p.abstract || '',
      author:     (p.authors || []).map(a => a.name).join(', '),
      categories: ['akademik'],
    })).filter(p => p.title);
  } catch (err) {
    await logger.warn('AcademicFetcher', `Semantic Scholar fetch failed: ${err.message}`);
    return [];
  }
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

/**
 * Fetch from academic source by type
 * @param {'pubmed'|'arxiv'|'semantic_scholar'} sourceType
 * @param {string} keyword
 */
async function fetchAcademic(sourceType, keyword) {
  switch (sourceType) {
    case 'pubmed':           return fetchPubMed(keyword);
    case 'arxiv':            return fetchArxiv(keyword);
    case 'semantic_scholar': return fetchSemanticScholar(keyword);
    default:
      throw new Error(`Unknown academic source type: ${sourceType}`);
  }
}

module.exports = { fetchAcademic, fetchPubMed, fetchArxiv, fetchSemanticScholar };
