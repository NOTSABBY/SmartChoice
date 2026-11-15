/**
 * SmartChoice Semantic Candidate Retrieval Service
 * 
 * Retrieves candidates across the COMPLETE product catalogue (all 500 products).
 * Enforces:
 * 1. Zero candidate truncation or arbitrary top-K pre-filtering.
 * 2. Strict category scoping when requested.
 * 3. Complete deduplication across product IDs.
 */

const catalogLoader = require('../utils/catalogLoader');

/**
 * Retrieves candidate products across the complete catalogue.
 * @param {Object} options - { categoryId, products }
 * @returns {Array<Object>} Complete pool of candidate products
 */
function retrieveCandidates(options = {}) {
  let pool = options.products;

  if (!pool || !Array.isArray(pool) || pool.length === 0) {
    if (typeof catalogLoader.getCatalog500Products === 'function') {
      pool = catalogLoader.getCatalog500Products();
    } else if (typeof catalogLoader.getAllProducts === 'function') {
      const all = catalogLoader.getAllProducts();
      pool = all.filter(p => {
        const id = String(p.catalog?.productId || p.product_id || p._id || '');
        return id.startsWith('PKG_PRD_');
      });
    } else {
      pool = catalogLoader.loadProductsFromDisk();
    }
  }

  // Deduplicate products
  const uniquePool = [];
  const seenIds = new Set();
  for (const p of pool) {
    const id = String(p.product_id || p.catalog?.productId || p._id || '');
    if (!seenIds.has(id)) {
      seenIds.add(id);
      uniquePool.push(p);
    }
  }

  // Apply Category Scoping if provided
  const targetCategoryId = (options.categoryId !== undefined && options.categoryId !== null && options.categoryId !== '' && options.categoryId !== 'null' && options.categoryId !== 'all')
    ? parseInt(options.categoryId, 10)
    : null;

  if (targetCategoryId !== null && !isNaN(targetCategoryId)) {
    return uniquePool.filter(p => {
      const pCatId = Number(p.catalog?.categoryId ?? p.category_id ?? p.identity?.categoryId);
      return pCatId === targetCategoryId;
    });
  }

  return uniquePool;
}

module.exports = {
  retrieveCandidates
};
