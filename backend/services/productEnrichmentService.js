const axios = require('axios');
const Product = require('../models/Product');
const catalogConfig = require('../config/catalogConfig');

const OFF_SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';

const axiosClient = axios.create({
  timeout: 12000,
  headers: {
    'User-Agent': 'SmartChoiceCatalogEnricher/2.0 (contact@smartchoice.org)',
    'Accept': 'application/json'
  }
});

class ProductEnrichmentService {
  constructor() {
    this.isEnrichmentRunning = false;
    this.lastRunStats = null;
  }

  /**
   * Helper delay for rate limiting.
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Evaluates match confidence between catalog product and an OFF candidate.
   * @param {Object} catalogProduct
   * @param {Object} offCandidate
   * @returns {Object} { confidence: number, reasons: string[], isMatch: boolean }
   */
  evaluateMatch(catalogProduct, offCandidate) {
    const reasons = [];
    let score = 0;

    const catName = (catalogProduct.catalog?.productName || catalogProduct.identity?.name || '').toLowerCase();
    const offName = (offCandidate.product_name || offCandidate.product_name_en || '').toLowerCase();

    const catBrand = (catalogProduct.catalog?.brand || catalogProduct.identity?.brand || '').toLowerCase();
    const offBrand = (offCandidate.brands || '').toLowerCase();

    // 1. Brand Agreement (Weight: 40%)
    if (catBrand && offBrand) {
      if (offBrand.includes(catBrand) || catBrand.includes(offBrand)) {
        score += 0.40;
        reasons.push('Brand matched candidate brands');
      } else {
        reasons.push(`Brand mismatch: catalog="${catBrand}" vs candidate="${offBrand}"`);
      }
    }

    // 2. Product Name Token Overlap / Similarity (Weight: 45%)
    if (catName && offName) {
      const catTokens = new Set(catName.split(/[^a-z0-9]+/).filter(t => t.length > 2));
      const offTokens = new Set(offName.split(/[^a-z0-9]+/).filter(t => t.length > 2));

      if (catTokens.size > 0 && offTokens.size > 0) {
        const intersection = new Set([...catTokens].filter(x => offTokens.has(x)));
        const union = new Set([...catTokens, ...offTokens]);
        const jaccard = intersection.size / union.size;
        
        score += jaccard * 0.45;
        if (jaccard > 0.4) {
          reasons.push(`High name token similarity (${(jaccard * 100).toFixed(0)}%)`);
        }
      }
    }

    // 3. Category Compatibility (Weight: 15%)
    const catCategory = (catalogProduct.catalog?.categoryName || '').toLowerCase();
    const offCategories = (offCandidate.categories || '').toLowerCase();
    if (catCategory && offCategories) {
      const catTokens = catCategory.split(/[^a-z0-9]+/).filter(t => t.length > 3);
      const hasCatOverlap = catTokens.some(t => offCategories.includes(t));
      if (hasCatOverlap) {
        score += 0.15;
        reasons.push('Category terms overlap');
      }
    }

    const confidence = Number(score.toFixed(2));
    return {
      confidence,
      reasons,
      isMatch: confidence >= catalogConfig.MATCHING.STRONG_CONFIDENCE,
      requiresReview: confidence >= catalogConfig.MATCHING.MIN_CONFIDENCE && confidence < catalogConfig.MATCHING.STRONG_CONFIDENCE
    };
  }

  /**
   * Safely normalizes Open Food Facts nutriments payload.
   * Detects the original measurement basis before conversion and avoids double-normalization.
   * Standardizes values to per 100g/ml.
   * @param {Object} nutriments - OFF nutriments object
   * @param {string} [rawServingSize] - e.g. "30 g"
   * @returns {Object} { normalized: Object, originalBasis: string }
   */
  extractAndNormalizeNutriments(nutriments = {}, rawServingSize = null) {
    if (!nutriments || typeof nutriments !== 'object') {
      return { normalized: {}, originalBasis: 'unknown' };
    }

    // Detect measurement basis
    // Case A: 100g fields exist directly (preferred, standard OFF format)
    const has100g = nutriments['energy-kcal_100g'] !== undefined || nutriments['proteins_100g'] !== undefined;
    // Case B: only serving fields exist
    const hasServing = nutriments['energy-kcal_serving'] !== undefined || nutriments['proteins_serving'] !== undefined;

    let originalBasis = 'per_100g';
    if (!has100g && hasServing) {
      originalBasis = 'per_serving';
    }

    // Parse serving size factor if per-serving conversion is needed
    let servingMultiplier = 1;
    let servingGrams = null;
    if (originalBasis === 'per_serving' && rawServingSize) {
      const match = String(rawServingSize).match(/([\d.]+)\s*(g|ml|gram|milliliter)?/i);
      if (match) {
        servingGrams = parseFloat(match[1]);
        if (servingGrams > 0) {
          servingMultiplier = 100 / servingGrams;
        }
      }
    }

    const extractMetric = (key100, keyServing) => {
      // 1. Try 100g first (No conversion needed, basis is already per 100g)
      if (nutriments[key100] !== undefined && nutriments[key100] !== null) {
        const val = parseFloat(nutriments[key100]);
        return isNaN(val) ? null : Number(val.toFixed(2));
      }
      // 2. If per serving, convert once using multiplier
      if (nutriments[keyServing] !== undefined && nutriments[keyServing] !== null) {
        const val = parseFloat(nutriments[keyServing]);
        if (!isNaN(val)) {
          return Number((val * servingMultiplier).toFixed(2));
        }
      }
      return null;
    };

    const calories = extractMetric('energy-kcal_100g', 'energy-kcal_serving') !== null
      ? extractMetric('energy-kcal_100g', 'energy-kcal_serving')
      : (extractMetric('energy_100g', 'energy_serving') ? Number((extractMetric('energy_100g', 'energy_serving') / 4.184).toFixed(2)) : null);

    const protein = extractMetric('proteins_100g', 'proteins_serving');
    const carbohydrates = extractMetric('carbohydrates_100g', 'carbohydrates_serving');
    const sugar = extractMetric('sugars_100g', 'sugars_serving');
    const addedSugars = extractMetric('added-sugars_100g', 'added-sugars_serving');
    const fat = extractMetric('fat_100g', 'fat_serving');
    const saturatedFat = extractMetric('saturated-fat_100g', 'saturated-fat_serving');
    const transFat = extractMetric('trans-fat_100g', 'trans-fat_serving');
    const fiber = extractMetric('fiber_100g', 'fiber_serving');
    const sodiumMg = extractMetric('sodium_100g', 'sodium_serving') !== null
      ? Number((extractMetric('sodium_100g', 'sodium_serving') * 1000).toFixed(2))
      : (extractMetric('salt_100g', 'salt_serving') ? Number(((extractMetric('salt_100g', 'salt_serving') / 2.5) * 1000).toFixed(2)) : null);

    const normalized = {
      basis: 'per_100g',
      calories,
      protein,
      carbohydrates,
      sugar,
      addedSugars,
      fat,
      saturatedFat,
      transFat,
      fiber,
      sodium: sodiumMg
    };

    return {
      normalized,
      originalBasis,
      rawValuesSnapshot: {
        'energy-kcal': nutriments['energy-kcal_100g'] ?? nutriments['energy-kcal_serving'] ?? null,
        'proteins': nutriments['proteins_100g'] ?? nutriments['proteins_serving'] ?? null,
        'carbohydrates': nutriments['carbohydrates_100g'] ?? nutriments['carbohydrates_serving'] ?? null,
        'sugars': nutriments['sugars_100g'] ?? nutriments['sugars_serving'] ?? null,
        'fat': nutriments['fat_100g'] ?? nutriments['fat_serving'] ?? null,
        'saturated-fat': nutriments['saturated-fat_100g'] ?? nutriments['saturated-fat_serving'] ?? null
      }
    };
  }

  /**
   * Queries Open Food Facts for a single product and enriches it in MongoDB.
   * @param {Object} product - Product Mongoose document
   * @returns {Promise<Object>} Enrichment outcome
   */
  async enrichSingleProduct(product) {
    const queryTerm = product.catalog?.openFoodFactsQueryTerm || product.catalog?.productName;
    if (!queryTerm) {
      product.enrichment.status = catalogConfig.ENRICHMENT_STATUSES.FAILED;
      product.enrichment.enrichmentError = 'Missing Open Food Facts query term';
      await product.save();
      return { productId: product.catalog?.productId, status: 'FAILED', reason: 'No query term' };
    }

    try {
      const response = await axiosClient.get(OFF_SEARCH_URL, {
        params: {
          search_terms: queryTerm,
          search_simple: 1,
          action: 'process',
          json: 1,
          page_size: 5
        }
      });

      const products = response.data?.products || [];
      if (products.length === 0) {
        product.enrichment.status = catalogConfig.ENRICHMENT_STATUSES.NOT_FOUND;
        product.enrichment.attempts += 1;
        product.enrichment.matchEvidence = { searchedQuery: queryTerm, candidateCount: 0 };
        await product.save();
        return { productId: product.catalog?.productId, status: 'NOT_FOUND' };
      }

      // Rank candidates
      let bestCandidate = null;
      let highestEvaluation = { confidence: 0, reasons: [] };

      for (const cand of products) {
        const evalResult = this.evaluateMatch(product, cand);
        if (evalResult.confidence > highestEvaluation.confidence) {
          highestEvaluation = evalResult;
          bestCandidate = cand;
        }
      }

      product.enrichment.attempts += 1;
      product.enrichment.matchConfidence = highestEvaluation.confidence;
      product.enrichment.matchEvidence = {
        searchedQuery: queryTerm,
        candidateCount: products.length,
        reasons: highestEvaluation.reasons,
        candidateName: bestCandidate?.product_name || null,
        candidateBrand: bestCandidate?.brands || null
      };

      // Review threshold check
      if (highestEvaluation.requiresReview) {
        product.enrichment.status = catalogConfig.ENRICHMENT_STATUSES.MATCH_REQUIRES_REVIEW;
        product.enrichment.matchedBarcode = bestCandidate?.code || null;
        await product.save();
        return { productId: product.catalog?.productId, status: 'MATCH_REQUIRES_REVIEW', confidence: highestEvaluation.confidence };
      }

      if (!highestEvaluation.isMatch || !bestCandidate) {
        product.enrichment.status = catalogConfig.ENRICHMENT_STATUSES.NOT_FOUND;
        await product.save();
        return { productId: product.catalog?.productId, status: 'NOT_FOUND', confidence: highestEvaluation.confidence };
      }

      // Accepted Match: Extract & Normalize
      const { normalized, originalBasis, rawValuesSnapshot } = this.extractAndNormalizeNutriments(
        bestCandidate.nutriments,
        bestCandidate.serving_size
      );

      // Ingredients & Additives
      const parsedIngredients = bestCandidate.ingredients_text
        ? bestCandidate.ingredients_text.split(/[,;]+/).map(i => i.trim()).filter(Boolean)
        : [];
      const allergens = bestCandidate.allergens_tags
        ? bestCandidate.allergens_tags.map(a => a.replace(/^en:/, '').trim())
        : [];
      const additives = bestCandidate.additives_tags
        ? bestCandidate.additives_tags.map(a => a.replace(/^en:/, '').trim())
        : [];

      // Update Document
      product.identity.barcode = product.identity.barcode || bestCandidate.code || null;
      product.media.imageUrl = bestCandidate.image_url || product.media.imageUrl;
      product.media.imageSource = bestCandidate.image_url ? 'openfoodfacts' : product.media.imageSource;
      product.media.productUrl = bestCandidate.code ? `https://world.openfoodfacts.org/product/${bestCandidate.code}` : null;

      product.ingredients.ingredients = parsedIngredients;
      product.ingredients.allergens = allergens;
      product.ingredients.additives = additives;
      product.ingredients.rawIngredientsText = bestCandidate.ingredients_text || null;

      product.nutrition = {
        ...normalized,
        servingSize: bestCandidate.serving_size || product.serving?.servingSize,
        servingSizeUnit: product.serving?.servingSizeUnit || 'g',
        originalRetrieved: {
          detectedBasis: originalBasis,
          rawValuesSnapshot
        }
      };

      if (bestCandidate.nova_group) {
        product.processing.novaGroup = Number(bestCandidate.nova_group);
        product.processing.level = `NOVA ${bestCandidate.nova_group}`;
      }
      if (bestCandidate.nutriscore_grade) {
        product.processing.nutriScore = bestCandidate.nutriscore_grade.toUpperCase();
      }

      product.provenance.enrichmentProvider = 'OpenFoodFacts';
      product.provenance.externalProductId = bestCandidate.code || null;
      product.provenance.externalSourceUrl = product.media.productUrl;
      product.provenance.lastEnrichedAt = new Date();

      // Check completeness
      const filledNutrients = ['calories', 'protein', 'carbohydrates', 'sugar', 'fat', 'saturatedFat', 'sodium']
        .filter(k => normalized[k] !== null);
      
      const isComplete = filledNutrients.length >= 6 && parsedIngredients.length > 0;
      product.enrichment.status = isComplete
        ? catalogConfig.ENRICHMENT_STATUSES.ENRICHED
        : catalogConfig.ENRICHMENT_STATUSES.PARTIALLY_ENRICHED;

      product.enrichment.matchedBarcode = bestCandidate.code || null;
      product.enrichment.enrichmentError = null;

      await product.save();
      return { productId: product.catalog?.productId, status: product.enrichment.status, confidence: highestEvaluation.confidence };

    } catch (err) {
      product.enrichment.attempts += 1;
      product.enrichment.status = catalogConfig.ENRICHMENT_STATUSES.FAILED;
      product.enrichment.enrichmentError = err.message;
      await product.save();
      return { productId: product.catalog?.productId, status: 'FAILED', error: err.message };
    }
  }

  /**
   * Resumable background enrichment batch executor.
   * Processes products with status 'PENDING' or 'FAILED' with controlled rate limiting.
   * @param {Object} [options]
   * @param {number} [options.limit=10] - Number of items to process in this run
   * @param {string[]} [options.statuses=['PENDING']] - Filter statuses
   * @returns {Promise<Object>} Run statistics
   */
  async runEnrichmentBatch(options = {}) {
    if (this.isEnrichmentRunning) {
      return { running: true, message: 'Enrichment batch is already active.' };
    }

    const limit = options.limit ? Math.min(parseInt(options.limit, 10), 50) : 10;
    const targetStatuses = options.statuses || [catalogConfig.ENRICHMENT_STATUSES.PENDING];

    this.isEnrichmentRunning = true;
    const stats = {
      startedAt: new Date().toISOString(),
      processed: 0,
      matched: 0,
      partiallyEnriched: 0,
      enriched: 0,
      notFound: 0,
      requiresReview: 0,
      failed: 0,
      outcomes: []
    };

    try {
      const candidates = await Product.find({
        'catalog.productId': { $exists: true },
        'enrichment.status': { $in: targetStatuses }
      }).limit(limit);

      for (const prod of candidates) {
        const outcome = await this.enrichSingleProduct(prod);
        stats.processed++;
        stats.outcomes.push(outcome);

        if (outcome.status === 'ENRICHED') stats.enriched++;
        else if (outcome.status === 'PARTIALLY_ENRICHED') stats.partiallyEnriched++;
        else if (outcome.status === 'MATCH_REQUIRES_REVIEW') stats.requiresReview++;
        else if (outcome.status === 'NOT_FOUND') stats.notFound++;
        else if (outcome.status === 'FAILED') stats.failed++;

        // Rate limit delay between Open Food Facts requests
        await this.sleep(catalogConfig.ENRICHMENT_RATE_LIMIT_MS);
      }
    } finally {
      this.isEnrichmentRunning = false;
      stats.completedAt = new Date().toISOString();
      this.lastRunStats = stats;
    }

    return stats;
  }
}

module.exports = new ProductEnrichmentService();
