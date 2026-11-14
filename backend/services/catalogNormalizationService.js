const catalogConfig = require('../config/catalogConfig');

class CatalogNormalizationService {
  /**
   * Safely trims and collapses consecutive whitespace characters.
   * @param {any} val
   * @returns {string|null}
   */
  cleanString(val) {
    if (val === null || val === undefined) return null;
    if (typeof val !== 'string') return String(val).trim();
    const cleaned = val.replace(/\s+/g, ' ').trim();
    return cleaned.length > 0 ? cleaned : null;
  }

  /**
   * Parses serving size string into numeric serving size and unit.
   * @param {string} rawServing
   * @returns {Object} { servingSize: string|null, servingSizeUnit: string|null }
   */
  parseServingSize(rawServing) {
    const cleaned = this.cleanString(rawServing);
    if (!cleaned || cleaned.toLowerCase() === 'standard pack') {
      return { servingSize: cleaned || 'Standard Pack', servingSizeUnit: null };
    }

    const match = cleaned.match(/^([\d.,]+)\s*([a-zA-Z]+)?$/);
    if (match) {
      return {
        servingSize: match[1],
        servingSizeUnit: match[2] ? match[2].toLowerCase() : null
      };
    }

    return { servingSize: cleaned, servingSizeUnit: null };
  }

  /**
   * Transforms a validated raw row into a canonical SmartChoice Product document structure.
   * @param {Object} row - Validated raw row from Excel
   * @returns {Object} Canonical product payload
   */
  normalizeRecord(row) {
    const rawId = this.cleanString(row['Product ID']);
    const rawCatId = Number(row['Category ID']);
    const rawCatName = this.cleanString(row['Category Name']);
    const rawBrand = this.cleanString(row['Brand']);
    const rawName = this.cleanString(row['Product Name']);
    const rawPackaging = this.cleanString(row['Packaging Size']);
    const rawQuery = this.cleanString(row['Open Food Facts Query Term']);

    const serving = this.parseServingSize(rawPackaging);

    return {
      // 1. Catalog subdocument preserving source fields exactly
      catalog: {
        productId: rawId,
        categoryId: rawCatId,
        categoryName: rawCatName,
        brand: rawBrand,
        productName: rawName,
        packagingSize: rawPackaging,
        openFoodFactsQueryTerm: rawQuery
      },

      // 2. Canonical Identity
      identity: {
        barcode: null, // Catalog products initially have no barcode
        name: rawName,
        brand: rawBrand,
        categories: rawCatName ? [rawCatName] : [],
        productType: 'food',
        dietaryType: 'UNKNOWN'
      },

      // 3. Serving
      serving: {
        servingSize: serving.servingSize,
        servingSizeUnit: serving.servingSizeUnit
      },

      // 4. Media
      media: {
        imageUrl: null,
        thumbnailUrl: null,
        productUrl: null,
        imageSource: null
      },

      // 5. Composition (Empty arrays / nulls, zero fabrication)
      ingredients: {
        ingredients: [],
        allergens: [],
        additives: [],
        rawIngredientsText: null
      },

      // 6. Nutrition (All null initially before verified enrichment)
      nutrition: {
        basis: 'per_100g',
        servingSize: serving.servingSize,
        servingSizeUnit: serving.servingSizeUnit,
        calories: null,
        protein: null,
        carbohydrates: null,
        sugar: null,
        addedSugars: null,
        fat: null,
        saturatedFat: null,
        transFat: null,
        fiber: null,
        sodium: null,
        originalRetrieved: null
      },

      // 7. Processing (Nulls before enrichment)
      processing: {
        level: null,
        novaGroup: null,
        nutriScore: null,
        labels: []
      },

      // 8. Commercial info (Nulls, never fabricated)
      commerce: {
        mrp: null,
        price: null,
        discountPercent: null,
        deliveryTimeMins: null,
        rating: null,
        reviewCount: null,
        inStock: null,
        categoryId: rawCatId
      },

      // 9. Provenance
      provenance: {
        originalDataset: catalogConfig.DATASET_NAME,
        datasetVersion: catalogConfig.DATASET_VERSION,
        sourceRecordId: rawId,
        enrichmentProvider: null,
        externalProductId: null,
        externalSourceUrl: null,
        lastEnrichedAt: null,
        lastSyncAt: new Date()
      },

      // 10. Enrichment Lifecycle
      enrichment: {
        status: catalogConfig.ENRICHMENT_STATUSES.PENDING,
        matchConfidence: null,
        matchEvidence: {},
        matchedBarcode: null,
        enrichmentError: null,
        attempts: 0
      },

      // 11. Legacy Source compatibility
      source: {
        source: catalogConfig.DATASET_NAME,
        sourceId: rawId,
        lastUpdated: new Date()
      },

      // 12. Data quality
      dataQuality: {
        completeness: 0,
        missingNutritionFields: [
          'calories',
          'protein',
          'carbohydrates',
          'sugar',
          'fat',
          'saturatedFat',
          'fiber',
          'sodium'
        ],
        dataQualityScore: 0
      }
    };
  }
}

module.exports = new CatalogNormalizationService();
