const Product = require('../models/Product');
const embeddingService = require('./embeddingService');
const { executeSemanticSearch } = require('./semanticSearchEngine');
const semanticQueryUnderstandingService = require('./semanticQueryUnderstandingService');
const catalogLoader = require('../utils/catalogLoader');

class VectorSearchService {
  /**
   * Performs semantic product search using LLM query understanding,
   * product-name-only vector retrieval, and independent evidence-based filtering.
   * @param {string} query - The search query text
   * @param {Object} options - Search options { limit, page, categoryId, preferences, products, scope }
   * @returns {Promise<Object>} - Object with data, results, understanding, filters_applied, pagination
   */
  async semanticProductSearch(query, options = {}) {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('Search query must be a non-empty string.');
    }

    if (query.length > 200) {
      throw new Error('Search query is too long.');
    }

    const limit = options.limit ? parseInt(options.limit, 10) : 500;
    if (isNaN(limit) || limit <= 0 || limit > 1000) {
      throw new Error('Invalid limit option.');
    }

    // Step 1: LLM-Powered Query Understanding Layer
    const understanding = await semanticQueryUnderstandingService.understandQuery(query);

    // Step 2: Product-Name-Only Vector Search
    // Query embedding is generated strictly from the optimized product identity query
    let vectorScoreMap = null;
    try {
      if (require('mongoose').connection.readyState === 1 && embeddingService.hf) {
        const vectorQuery = understanding.optimized_vector_query || query;
        const queryVector = await embeddingService.generateEmbedding(vectorQuery);
        if (queryVector && queryVector.length) {
          const numCandidates = 500;
          const pipeline = [
            {
              $vectorSearch: {
                index: "product_vector_index",
                path: "embedding.vector",
                queryVector: queryVector,
                numCandidates: numCandidates,
                limit: 500
              }
            },
            {
              $project: {
                _id: 1,
                semanticScore: { $meta: "vectorSearchScore" }
              }
            }
          ];
          const vectorResults = await Product.aggregate(pipeline);
          if (vectorResults && vectorResults.length > 0) {
            vectorScoreMap = new Map();
            vectorResults.forEach(v => {
              if (v._id) vectorScoreMap.set(String(v._id), v.semanticScore);
            });
          }
        }
      }
    } catch (err) {
      // Gracefully fall back to local semantic pipeline
      console.warn("Atlas Vector Search unavailable; using advanced local semantic pipeline:", err.message);
    }

    // Always evaluate across the full candidate pool (strictly Catalog 500 products)
    let candidatePool = options.products;
    if (!candidatePool || !Array.isArray(candidatePool) || candidatePool.length === 0) {
      candidatePool = catalogLoader.getCatalog500Products
        ? catalogLoader.getCatalog500Products()
        : catalogLoader.getAllProducts();
    }

    // If vector search scores are available, attach them to products for similarity ranking
    if (vectorScoreMap && vectorScoreMap.size > 0) {
      candidatePool = candidatePool.map(p => {
        const id = String(p._id || p.catalog?.productId || p.product_id);
        if (vectorScoreMap.has(id)) {
          return {
            ...p,
            vectorSimilarityScore: vectorScoreMap.get(id)
          };
        }
        return p;
      });
    }

    // Execute comprehensive semantic search engine across all candidates
    const searchResult = await executeSemanticSearch(query, {
      ...options,
      understanding,
      limit,
      products: candidatePool
    });

    return searchResult;
  }
}

module.exports = new VectorSearchService();
