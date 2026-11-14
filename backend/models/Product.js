const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  // Original / Catalog-500 specific fields
  catalog: {
    productId: { type: String },
    categoryId: { type: Number, index: true },
    categoryName: { type: String, index: true },
    brand: { type: String },
    productName: { type: String, index: true },
    packagingSize: { type: String },
    openFoodFactsQueryTerm: { type: String }
  },

  // Core Identity (Backward compatible with legacy SmartChoice records)
  identity: {
    barcode: { type: String },
    name: { type: String, required: true, index: true },
    brand: { type: String, index: true },
    categories: { type: [String], index: true },
    productType: { type: String, default: 'food' },
    dietaryType: { type: String, enum: ['VEG', 'NON_VEG', 'UNKNOWN'], default: 'UNKNOWN' }
  },

  // Serving details
  serving: {
    servingSize: { type: String },
    servingSizeUnit: { type: String }
  },

  // Media references
  media: {
    imageUrl: { type: String },
    thumbnailUrl: { type: String },
    productUrl: { type: String },
    imageSource: { type: String, default: null } // 'openfoodfacts' | 'placeholder' | 'user'
  },

  // Ingredients and composition
  ingredients: {
    ingredients: { type: [String], default: [] },
    allergens: { type: [String], default: [] },
    additives: { type: [String], default: [] },
    rawIngredientsText: { type: String, default: null }
  },

  // Nutritional information (standardized to per 100g/ml)
  nutrition: {
    basis: { type: String, default: 'per_100g' }, // 'per_100g' | 'per_serving'
    servingSize: { type: String, default: null },
    servingSizeUnit: { type: String, default: null },
    calories: { type: Number, default: null },
    protein: { type: Number, default: null },
    carbohydrates: { type: Number, default: null },
    sugar: { type: Number, default: null },
    addedSugars: { type: Number, default: null },
    fat: { type: Number, default: null },
    saturatedFat: { type: Number, default: null },
    transFat: { type: Number, default: null },
    fiber: { type: Number, default: null },
    sodium: { type: Number, default: null },
    // Preserves original retrieved payload before normalization
    originalRetrieved: { type: mongoose.Schema.Types.Mixed, default: null }
  },

  // Food processing analysis
  processing: {
    level: { type: String, default: null },
    novaGroup: { type: Number, default: null },
    nutriScore: { type: String, default: null },
    labels: { type: [String], default: [] }
  },

  // Commercial attributes (Optional, never fabricated)
  commerce: {
    mrp: { type: Number, default: null },
    price: { type: Number, default: null },
    discountPercent: { type: Number, default: null },
    deliveryTimeMins: { type: Number, default: null },
    rating: { type: Number, default: null },
    reviewCount: { type: Number, default: null },
    inStock: { type: Boolean, default: null },
    categoryId: { type: Number, default: null }
  },

  // Data provenance tracking
  provenance: {
    originalDataset: { type: String, default: 'Catalog-500' },
    datasetVersion: { type: String, default: '1.0.0' },
    sourceRecordId: { type: String, default: null },
    enrichmentProvider: { type: String, default: null },
    externalProductId: { type: String, default: null },
    externalSourceUrl: { type: String, default: null },
    lastEnrichedAt: { type: Date, default: null },
    lastSyncAt: { type: Date, default: Date.now }
  },

  // Enrichment state tracking
  enrichment: {
    status: {
      type: String,
      enum: ['PENDING', 'MATCHED', 'PARTIALLY_ENRICHED', 'ENRICHED', 'NOT_FOUND', 'MATCH_REQUIRES_REVIEW', 'FAILED'],
      default: 'PENDING',
      index: true
    },
    matchConfidence: { type: Number, default: null },
    matchEvidence: { type: mongoose.Schema.Types.Mixed, default: {} },
    matchedBarcode: { type: String, default: null },
    enrichmentError: { type: String, default: null },
    attempts: { type: Number, default: 0 }
  },

  // System source tracking (legacy compatibility)
  source: {
    source: { type: String, default: 'Catalog-500', index: true },
    sourceId: { type: String, index: true },
    lastUpdated: { type: Date, default: Date.now }
  },

  // Data quality score and completeness
  dataQuality: {
    completeness: { type: Number, default: 0 },
    missingNutritionFields: { type: [String], default: [] },
    dataQualityScore: { type: Number, default: 0 }
  },

  // Vector embeddings for Atlas Vector Search
  embedding: {
    vector: { type: [Number] },
    model: { type: String },
    dimensions: { type: Number },
    version: { type: String },
    textHash: { type: String },
    generatedAt: { type: Date }
  }
}, {
  timestamps: true
});

// Partial unique index on catalog.productId ensuring legacy records without catalog IDs are not blocked
productSchema.index(
  { 'catalog.productId': 1 },
  {
    unique: true,
    partialFilterExpression: { 'catalog.productId': { $exists: true, $type: 'string', $gt: '' } }
  }
);

// Partial unique index on identity.barcode allowing catalog records without barcodes to coexist with scanned retail records
productSchema.index(
  { 'identity.barcode': 1 },
  {
    unique: true,
    partialFilterExpression: { 'identity.barcode': { $exists: true, $type: 'string', $gt: '' } }
  }
);

// Helpful compound indexes
productSchema.index({ 'catalog.categoryId': 1, 'enrichment.status': 1 });
productSchema.index({ 'catalog.brand': 1 });

module.exports = mongoose.model('Product', productSchema);
