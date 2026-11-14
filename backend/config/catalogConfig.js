const path = require('path');

module.exports = {
  EXCEL_PATH: process.env.CATALOG_EXCEL_PATH || path.resolve(__dirname, '../../../500Products/authentic_packaged_food_catalog_500.xlsx'),
  EXPECTED_WORKSHEET: 'Products Catalog',
  EXPECTED_HEADERS: [
    'Product ID',
    'Category ID',
    'Category Name',
    'Brand',
    'Product Name',
    'Packaging Size',
    'Open Food Facts Query Term'
  ],
  ENRICHMENT_STATUSES: {
    PENDING: 'PENDING',
    MATCHED: 'MATCHED',
    PARTIALLY_ENRICHED: 'PARTIALLY_ENRICHED',
    ENRICHED: 'ENRICHED',
    NOT_FOUND: 'NOT_FOUND',
    MATCH_REQUIRES_REVIEW: 'MATCH_REQUIRES_REVIEW',
    FAILED: 'FAILED'
  },
  MATCHING: {
    STRONG_CONFIDENCE: 0.75,
    MIN_CONFIDENCE: 0.55
  },
  ENRICHMENT_RATE_LIMIT_MS: 1000,
  DATASET_NAME: 'Catalog-500',
  DATASET_VERSION: '1.0.0'
};
