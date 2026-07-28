'use strict';

/**
 * SEO Formatter — Phase 5
 * Konversi teks/markdown artikel ke HTML WordPress-ready
 * Dengan schema markup JSON-LD
 */

/**
 * Convert article text to clean HTML
 * @param {string} text - raw article text
 * @returns {string} HTML
 */
function textToHtml(text) {
  if (!text) return '';
  let html = text;

  // Headings
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');

  // Blockquote
  html = html.replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>');

  // Ordered list
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ol>${match}</ol>`);

  // Unordered list
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
    if (!match.startsWith('<ol>')) return `<ul>${match}</ul>`;
    return match;
  });

  // Bold & italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Paragraphs — double newline → <p>
  html = html
    .split(/\n\n+/)
    .map(block => {
      if (/^<(h[1-6]|blockquote|ul|ol|div|figure)/.test(block.trim())) return block;
      const trimmed = block.trim();
      if (!trimmed) return '';
      return `<p>${trimmed.replace(/\n/g, ' ')}</p>`;
    })
    .filter(Boolean)
    .join('\n');

  return html;
}

/**
 * Build Key Takeaways box HTML
 */
function buildKeyTakeaways(takeaways) {
  if (!Array.isArray(takeaways) || !takeaways.length) return '';
  const items = takeaways.map(t => `<li>${t}</li>`).join('\n');
  return `<div class="news-ai-key-takeaways">\n<h3>Poin Penting</h3>\n<ul>\n${items}\n</ul>\n</div>`;
}

/**
 * Build FAQ section HTML
 */
function buildFaqHtml(faqItems) {
  if (!Array.isArray(faqItems) || !faqItems.length) return '';
  const items = faqItems
    .map(item => `<div class="faq-item"><h3>${item.question || item.q}</h3><p>${item.answer || item.a}</p></div>`)
    .join('\n');
  return `<div class="news-ai-faq">\n${items}\n</div>`;
}

/**
 * Generate schema markup JSON-LD by format
 */
function generateSchema(article, format, siteConfig = {}) {
  const base = {
    '@context': 'https://schema.org',
    'headline': article.title || '',
    'datePublished': article.published_at || new Date().toISOString(),
    'dateModified':  article.last_updated_at || article.published_at || new Date().toISOString(),
    'author': { '@type': 'Organization', 'name': siteConfig.name || 'News AI Agent' },
    'publisher': { '@type': 'Organization', 'name': siteConfig.name || 'News AI Agent', 'url': siteConfig.url || '' },
  };

  let schema;
  if (format === 'jurnal_review') {
    schema = { '@type': 'ScholarlyArticle', ...base };
  } else if (['berita_singkat','berita_panjang'].includes(format)) {
    schema = { '@type': 'NewsArticle', ...base };
  } else {
    schema = { '@type': 'Article', ...base };
  }

  const faq = article.content_versions?.faq;
  if (Array.isArray(faq) && faq.length) {
    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': faq.map(item => ({
        '@type': 'Question',
        'name': item.question || item.q,
        'acceptedAnswer': { '@type': 'Answer', 'text': item.answer || item.a },
      })),
    };
    return [schema, faqSchema];
  }

  return [schema];
}

/**
 * Build complete WordPress-ready HTML
 */
function buildWordPressHtml(article, siteConfig = {}) {
  const parts = [];
  const versions = article.content_versions || {};
  const takeaways = versions.keyTakeaways;
  const faq = versions.faq;

  // Key takeaways box (before main content)
  if (takeaways) parts.push(buildKeyTakeaways(takeaways));

  // Main content
  const mainContent = article.content || '';
  parts.push(textToHtml(mainContent));

  // FAQ section
  if (faq && faq.length) parts.push(buildFaqHtml(faq));

  // Schema markup
  const schemas = generateSchema(article, article.format, siteConfig);
  for (const s of schemas) {
    parts.push(`<script type="application/ld+json">\n${JSON.stringify(s, null, 2)}\n</script>`);
  }

  return parts.filter(Boolean).join('\n\n');
}

module.exports = { textToHtml, buildKeyTakeaways, buildFaqHtml, generateSchema, buildWordPressHtml };
