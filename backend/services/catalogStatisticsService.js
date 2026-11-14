const Product = require('../models/Product');

class CatalogStatisticsService {
  /**
   * Generates comprehensive statistics across the imported catalog.
   * @returns {Promise<Object>} Statistics payload
   */
  async getCatalogStatistics() {
    const catalogMatch = { 'catalog.productId': { $exists: true } };

    // 1. Total catalog products
    const totalCatalogProducts = await Product.countDocuments(catalogMatch);

    // 2. Total unique products
    const uniqueProductIds = (await Product.distinct('catalog.productId', catalogMatch)).length;

    // 3. Category distribution
    const categoryAgg = await Product.aggregate([
      { $match: catalogMatch },
      { $group: { _id: '$catalog.categoryName', categoryId: { $first: '$catalog.categoryId' }, count: { $sum: 1 } } },
      { $sort: { categoryId: 1 } }
    ]);

    // 4. Brand distribution
    const brandAgg = await Product.aggregate([
      { $match: catalogMatch },
      { $group: { _id: '$catalog.brand', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);
    const totalUniqueBrands = (await Product.distinct('catalog.brand', catalogMatch)).length;

    // 5-9. Enrichment status breakdown
    const statusAgg = await Product.aggregate([
      { $match: catalogMatch },
      { $group: { _id: '$enrichment.status', count: { $sum: 1 } } }
    ]);
    const statusMap = statusAgg.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    const successfullyEnriched = statusMap['ENRICHED'] || 0;
    const partiallyEnriched = statusMap['PARTIALLY_ENRICHED'] || 0;
    const unmatched = statusMap['NOT_FOUND'] || 0;
    const requiresReview = statusMap['MATCH_REQUIRES_REVIEW'] || 0;
    const failedEnrichment = statusMap['FAILED'] || 0;
    const pendingEnrichment = statusMap['PENDING'] || 0;
    const matched = statusMap['MATCHED'] || 0;

    // 10. Nutrition field completeness counts
    const nutritionMetrics = [
      'calories',
      'protein',
      'carbohydrates',
      'sugar',
      'addedSugars',
      'fat',
      'saturatedFat',
      'transFat',
      'fiber',
      'sodium'
    ];

    const nutritionCompleteness = {};
    for (const metric of nutritionMetrics) {
      const count = await Product.countDocuments({
        ...catalogMatch,
        [`nutrition.${metric}`]: { $ne: null, $exists: true }
      });
      nutritionCompleteness[metric] = {
        count,
        percentage: totalCatalogProducts > 0 ? Number(((count / totalCatalogProducts) * 100).toFixed(2)) : 0
      };
    }

    // 11. Ingredient completeness
    const ingredientCount = await Product.countDocuments({
      ...catalogMatch,
      $or: [
        { 'ingredients.ingredients.0': { $exists: true } },
        { 'ingredients.rawIngredientsText': { $ne: null, $gt: '' } }
      ]
    });

    // 12. Additive completeness
    const additiveCount = await Product.countDocuments({
      ...catalogMatch,
      'ingredients.additives.0': { $exists: true }
    });

    // 13. Allergen completeness
    const allergenCount = await Product.countDocuments({
      ...catalogMatch,
      'ingredients.allergens.0': { $exists: true }
    });

    // 14. Processing classification completeness
    const novaCount = await Product.countDocuments({
      ...catalogMatch,
      'processing.novaGroup': { $ne: null, $exists: true }
    });
    const nutriScoreCount = await Product.countDocuments({
      ...catalogMatch,
      'processing.nutriScore': { $ne: null, $exists: true }
    });

    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalCatalogProducts,
        uniqueProductIds,
        totalUniqueBrands,
        categoriesCount: categoryAgg.length
      },
      enrichmentStatus: {
        PENDING: pendingEnrichment,
        MATCHED: matched,
        PARTIALLY_ENRICHED: partiallyEnriched,
        ENRICHED: successfullyEnriched,
        NOT_FOUND: unmatched,
        MATCH_REQUIRES_REVIEW: requiresReview,
        FAILED: failedEnrichment
      },
      completeness: {
        nutrition: nutritionCompleteness,
        composition: {
          ingredients: {
            count: ingredientCount,
            percentage: totalCatalogProducts > 0 ? Number(((ingredientCount / totalCatalogProducts) * 100).toFixed(2)) : 0
          },
          additives: {
            count: additiveCount,
            percentage: totalCatalogProducts > 0 ? Number(((additiveCount / totalCatalogProducts) * 100).toFixed(2)) : 0
          },
          allergens: {
            count: allergenCount,
            percentage: totalCatalogProducts > 0 ? Number(((allergenCount / totalCatalogProducts) * 100).toFixed(2)) : 0
          }
        },
        processing: {
          novaClassification: {
            count: novaCount,
            percentage: totalCatalogProducts > 0 ? Number(((novaCount / totalCatalogProducts) * 100).toFixed(2)) : 0
          },
          nutriScore: {
            count: nutriScoreCount,
            percentage: totalCatalogProducts > 0 ? Number(((nutriScoreCount / totalCatalogProducts) * 100).toFixed(2)) : 0
          }
        }
      },
      categories: categoryAgg.map(c => ({
        categoryId: c.categoryId,
        categoryName: c._id,
        count: c.count
      })),
      topBrands: brandAgg.map(b => ({ brand: b._id, count: b.count }))
    };
  }
}

module.exports = new CatalogStatisticsService();
