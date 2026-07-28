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

// ── Google Scholar ────────────────────────────────────────────────────────────

async function fetchGoogleScholar(keyword, maxResults = 10) {
  try {
    const query = encodeURIComponent(keyword);
    const res = await axios.get(`https://scholar.google.com/scholar?q=${query}&hl=id&num=${maxResults}`, {
      timeout: 20000,
      headers: {
        ...HEADERS,
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    const $ = cheerio.load(res.data);
    const results = [];

    $('.gs_r.gs_or.gs_scl').each((_, el) => {
      const $el = $(el);
      const titleEl = $el.find('.gs_rt a');
      const title = titleEl.text().trim();
      const link = titleEl.attr('href') || '';
      const snippet = $el.find('.gs_rs').text().trim();
      const meta = $el.find('.gs_a').text().trim(); // authors, year, journal

      if (title) {
        // Extract year from meta string (e.g. "Author - Journal, 2023 - publisher")
        const yearMatch = meta.match(/\b(19|20)\d{2}\b/);
        results.push({
          title,
          link: link.startsWith('http') ? link : `https://scholar.google.com${link}`,
          pubDate: yearMatch ? `${yearMatch[0]}-01-01` : new Date().toISOString(),
          summary: snippet.slice(0, 400),
          content: snippet,
          author: meta.split(' - ')[0] || '',
          categories: ['akademik'],
        });
      }
    });

    // Respectful delay after scraping
    await new Promise(r => setTimeout(r, 3000));
    return results.slice(0, maxResults);
  } catch (err) {
    await logger.warn('AcademicFetcher', `Google Scholar fetch failed: ${err.message}`);
    return [];
  }
}

// ── SINTA ─────────────────────────────────────────────────────────────────────

async function fetchSINTA(keyword, maxResults = 10) {
  try {
    const query = encodeURIComponent(keyword);
    // SINTA search portal — search across Indonesian journals
    const res = await axios.get(`https://sinta.kemdikbud.go.id/journals?q=${query}&page=1`, {
      timeout: 20000,
      headers: {
        ...HEADERS,
        'Accept-Language': 'id-ID,id;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    const $ = cheerio.load(res.data);
    const results = [];

    // SINTA journal listing selectors
    $('.journal-item, .card-journal, article.journal').each((_, el) => {
      const $el = $(el);
      const titleEl = $el.find('h3 a, h4 a, .title a, a.journal-title').first();
      const title = titleEl.text().trim();
      const link = titleEl.attr('href') || '';
      const description = $el.find('p, .description, .abstract').first().text().trim();
      const publisher = $el.find('.publisher, .institution, .university').first().text().trim();

      if (title) {
        results.push({
          title,
          link: link.startsWith('http') ? link : `https://sinta.kemdikbud.go.id${link}`,
          pubDate: new Date().toISOString(),
          summary: description.slice(0, 400) || `Jurnal Indonesia: ${title}`,
          content: description || publisher,
          author: publisher,
          categories: ['akademik'],
        });
      }
    });

    // Fallback: try articles search if journal listing empty
    if (!results.length) {
      const artRes = await axios.get(`https://sinta.kemdikbud.go.id/articles?q=${query}&page=1`, {
        timeout: 20000,
        headers: { ...HEADERS },
      });
      const $a = cheerio.load(artRes.data);
      $a('.article-item, .item, .result-item').each((_, el) => {
        const $el = $a(el);
        const titleEl = $el.find('h3 a, h4 a, .title a').first();
        const title = titleEl.text().trim();
        const link = titleEl.attr('href') || '';
        const abstract = $el.find('p, .abstract').first().text().trim();
        const authors = $el.find('.authors, .author').first().text().trim();
        if (title) {
          results.push({
            title,
            link: link.startsWith('http') ? link : `https://sinta.kemdikbud.go.id${link}`,
            pubDate: new Date().toISOString(),
            summary: abstract.slice(0, 400),
            content: abstract,
            author: authors,
            categories: ['akademik'],
          });
        }
      });
    }

    await new Promise(r => setTimeout(r, 2000));
    return results.slice(0, maxResults);
  } catch (err) {
    await logger.warn('AcademicFetcher', `SINTA fetch failed: ${err.message}`);
    return [];
  }
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

/**
 * Fetch from academic source by type
 * @param {'pubmed'|'arxiv'|'semantic_scholar'|'google_scholar'|'sinta'} sourceType
 * @param {string} keyword
 */
async function fetchAcademic(sourceType, keyword) {
  switch (sourceType) {
    case 'pubmed':           return fetchPubMed(keyword);
    case 'arxiv':            return fetchArxiv(keyword);
    case 'semantic_scholar': return fetchSemanticScholar(keyword);
    case 'google_scholar':   return fetchGoogleScholar(keyword);
    case 'sinta':            return fetchSINTA(keyword);
    default:
      throw new Error(`Unknown academic source type: ${sourceType}`);
  }
}

module.exports = { fetchAcademic, fetchPubMed, fetchArxiv, fetchSemanticScholar, fetchGoogleScholar, fetchSINTA };
