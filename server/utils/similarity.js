'use strict';

/**
 * Keyword similarity utilities — duplikasi guard & internal link matching
 */

/**
 * Tokenize text → lowercase word array, filtered for stopwords
 */
const STOPWORDS = new Set([
  'yang','dan','di','ke','dari','untuk','dengan','ini','itu','adalah','dalam',
  'pada','oleh','tidak','akan','juga','sudah','ada','sebagai','telah','lebih',
  'atau','tetapi','namun','jika','saat','karena','setelah','antara','dapat',
  'harus','sangat','masih','bisa','agar','hingga','serta','kita','mereka',
  'para','tersebut','salah','satu','tahun','persen','a','an','the','in','of',
  'to','and','or','for','is','are','was','were','with','that','this','at',
  'be','by','on','as','from','have','has','had','but','not','it','its',
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * Calculate keyword overlap ratio between two texts
 * @returns {number} 0–1 (1 = identical keywords)
 */
function keywordOverlap(textA, textB) {
  const tokensA = new Set(tokenize(textA));
  const tokensB = new Set(tokenize(textB));
  if (!tokensA.size || !tokensB.size) return 0;

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }

  const union = tokensA.size + tokensB.size - intersection;
  return intersection / union; // Jaccard similarity
}

/**
 * Generate topic fingerprint: top N most significant words
 */
function topicFingerprint(text, n = 15) {
  const tokens = tokenize(text);
  const freq = {};
  for (const t of tokens) freq[t] = (freq[t] || 0) + 1;
  return Object.entries(freq)
    .sort((a,b) => b[1] - a[1])
    .slice(0, n)
    .map(([w]) => w);
}

/**
 * Check if a new topic is likely a duplicate of existing articles
 * @param {string} newTopic
 * @param {Array<{id, title, content?}>} existingArticles
 * @param {number} threshold 0–1 (default 0.7)
 */
function findDuplicates(newTopic, existingArticles, threshold = 0.7) {
  const duplicates = [];
  for (const article of existingArticles) {
    const compareText = `${article.title} ${article.content || ''}`;
    const overlap = keywordOverlap(newTopic, compareText);
    if (overlap >= threshold) {
      duplicates.push({ articleId: article.id, title: article.title, overlap });
    }
  }
  return duplicates.sort((a,b) => b.overlap - a.overlap);
}

module.exports = { tokenize, keywordOverlap, topicFingerprint, findDuplicates };
