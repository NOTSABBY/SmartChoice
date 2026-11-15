/**
 * SmartChoice Semantic Ranking & Pagination Service
 * 
 * Ranks eligible products based STRICTLY on product-name semantic relevance:
 * 1. Concept-to-Name semantic alignment.
 * 2. Modifiers matching in product name (e.g. dark, crunchy, almond).
 * 3. Exact brand / token overlap.
 * 4. Vector similarity score (if present from Atlas vector search).
 * 5. Applies pagination ONLY after complete filtering and ranking.
 */

const { normalizeProductName } = require('./productNameNormalizationService');

/**
 * Calculates a semantic relevance score (0-100) for a product based on its name.
 * @param {Object} product - Product record
 * @param {Object} intent - Parsed semantic intent
 * @param {Object} eligibility - Eligibility evaluation result
 * @returns {number} Score from 0 to 100
 */
function calculateSemanticScore(product, intent, eligibility) {
  const name = product.product_name || product.catalog?.productName || product.identity?.name || '';
  const brand = (product.brand || product.catalog?.brand || product.identity?.brand || '').toLowerCase();
  const { normalizedText, tokens } = normalizeProductName(name);

  let baseScore = eligibility.relevanceBoost || 50;

  // 1. Modifiers bonus
  let modifierHits = 0;
  for (const mod of intent.modifiers || []) {
    if (normalizedText.includes(mod)) {
      modifierHits++;
    }
  }
  baseScore += modifierHits * 5;

  // 2. Token overlap bonus
  const queryTokens = intent.tokens || [];
  let tokenMatches = 0;
  for (const qt of queryTokens) {
    if (tokens.includes(qt)) {
      tokenMatches++;
    } else if (normalizedText.includes(qt)) {
      tokenMatches += 0.5;
    }
  }
  const tokenRatio = queryTokens.length > 0 ? (tokenMatches / queryTokens.length) : 0;
  baseScore += Math.round(tokenRatio * 15);

  // 3. Exact Brand Match bonus
  if (brand && intent.cleanQuery.includes(brand)) {
    baseScore += 10;
  }

  // 4. Vector similarity bonus (if Atlas vector search provided a score)
  if (product.vectorSimilarityScore !== undefined && product.vectorSimilarityScore !== null) {
    const vScore = Number(product.vectorSimilarityScore);
    if (!isNaN(vScore) && vScore > 0) {
      baseScore = (baseScore * 0.7) + (vScore * 100 * 0.3);
    }
  }

  return Math.min(100, Math.max(10, Math.round(baseScore)));
}

/**
 * Ranks all eligible products and returns structured paginated results.
 * @param {Array<Object>} eligibleItems - Array of { product, eligibility }
 * @param {Object} intent - Parsed semantic intent
 * @param {Object} paginationOptions - { page, limit }
 * @returns {Object} Paginated and ranked search response
 */
function rankAndPaginateResults(eligibleItems, intent, paginationOptions = {}) {
  const page = Math.max(1, parseInt(paginationOptions.page || 1, 10));
  const limit = Math.max(1, parseInt(paginationOptions.limit || 500, 10));

  // Compute scores
  const scoredItems = eligibleItems.map(item => {
    const score = calculateSemanticScore(item.product, intent, item.eligibility);
    return {
      product: item.product,
      semanticScore: score,
      matchExplanation: item.eligibility.explanation || `Matches semantic intent: ${intent.rawQuery}`,
      matchedConcepts: item.eligibility.matchedConcepts || []
    };
  });

  // Sort descending by semantic score, with stable tie-breaker by product name
  scoredItems.sort((a, b) => {
    if (b.semanticScore !== a.semanticScore) {
      return b.semanticScore - a.semanticScore;
    }
    const nameA = a.product.product_name || a.product.catalog?.productName || '';
    const nameB = b.product.product_name || b.product.catalog?.productName || '';
    return nameA.localeCompare(nameB);
  });

  const totalMatches = scoredItems.length;
  const totalPages = Math.ceil(totalMatches / limit) || 1;
  const startIndex = (page - 1) * limit;
  const paginatedResults = scoredItems.slice(startIndex, startIndex + limit);

  return {
    totalMatches,
    totalPages,
    page,
    limit,
    items: paginatedResults
  };
}

module.exports = {
  calculateSemanticScore,
  rankAndPaginateResults
};
