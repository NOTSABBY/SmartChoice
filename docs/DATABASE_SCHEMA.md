# SmartChoice Canonical Database Schema Specification

**Document:** `docs/DATABASE_SCHEMA.md`  
**Phase:** Phase 2 — Catalog Integration, MongoDB Database Migration & Product Data Enrichment  
**Date:** November 2026  
**Status:** Implemented & Verified in MongoDB Atlas  

---

## 1. Schema Design Principles

The redesigned `Product.js` Mongoose schema accomplishes three architectural goals:
1. **Catalog-500 Grounding**: Integrates the 500 Virtual Dataset products with `catalog.productId` (`PKG_PRD_0001` - `PKG_PRD_0500`) as the unique catalog identifier.
2. **Backward Compatibility**: Maintains 100% compatibility with legacy retail records (which have `identity.barcode` but no `catalog` subdocument).
3. **No False Assumptions**: Nutritional and composition fields default to `null` or empty arrays; missing values are never fabricated or coerced to zero.

---

## 2. Complete Mongoose Schema Definition (`backend/models/Product.js`)

```javascript
const productSchema = new mongoose.Schema({
  // 1. Catalog-500 Specific Fields (Source dataset preservation)
  catalog: {
    productId: { type: String }, // e.g. "PKG_PRD_0001"
    categoryId: { type: Number, index: true }, // 1 to 25
    categoryName: { type: String, index: true },
    brand: { type: String },
    productName: { type: String, index: true },
    packagingSize: { type: String },
    openFoodFactsQueryTerm: { type: String }
  },

  // 2. Core Identity (Common across catalog & retail products)
  identity: {
    barcode: { type: String }, // e.g. "8901719125478" (optional for catalog)
    name: { type: String, required: true, index: true },
    brand: { type: String, index: true },
    categories: { type: [String], index: true },
    productType: { type: String, default: 'food' },
    dietaryType: { type: String, enum: ['VEG', 'NON_VEG', 'UNKNOWN'], default: 'UNKNOWN' }
  },

  // 3. Serving Details
  serving: {
    servingSize: { type: String },
    servingSizeUnit: { type: String }
  },

  // 4. Media References
  media: {
    imageUrl: { type: String },
    thumbnailUrl: { type: String },
    productUrl: { type: String },
    imageSource: { type: String, default: null } // 'openfoodfacts' | 'placeholder' | 'user'
  },

  // 5. Composition & Ingredients
  ingredients: {
    ingredients: { type: [String], default: [] },
    allergens: { type: [String], default: [] },
    additives: { type: [String], default: [] },
    rawIngredientsText: { type: String, default: null }
  },

  // 6. Nutritional Information (Standardized to per 100g/ml)
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
    // Preserves original measurement basis and retrieved values before conversion
    originalRetrieved: { type: mongoose.Schema.Types.Mixed, default: null }
  },

  // 7. Processing Classifications
  processing: {
    level: { type: String, default: null }, // e.g. "NOVA 4"
    novaGroup: { type: Number, default: null }, // 1 to 4
    nutriScore: { type: String, default: null }, // 'A' through 'E'
    labels: { type: [String], default: [] }
  },

  // 8. Commercial Attributes (Optional, never fabricated)
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

  // 9. Data Provenance
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

  // 10. Enrichment Lifecycle
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

  // 11. Legacy System Source
  source: {
    source: { type: String, default: 'Catalog-500', index: true },
    sourceId: { type: String, index: true },
    lastUpdated: { type: Date, default: Date.now }
  },

  // 12. Data Quality
  dataQuality: {
    completeness: { type: Number, default: 0 },
    missingNutritionFields: { type: [String], default: [] },
    dataQualityScore: { type: Number, default: 0 }
  },

  // 13. Semantic Embeddings
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
```

---

## 3. Partial Unique Index Architecture

In MongoDB Atlas, defining simple `{ unique: true }` on a field causes all documents where that field is omitted or `null` to collide on the second insertion (`E11000 duplicate key error`).

To resolve this conflict permanently:
1. **Catalog Product ID Partial Unique Index**:
   ```javascript
   productSchema.index(
     { 'catalog.productId': 1 },
     {
       unique: true,
       partialFilterExpression: { 'catalog.productId': { $exists: true, $type: 'string', $gt: '' } }
     }
   );
   ```
   *Behavior*: Enforces strict uniqueness among Catalog-500 items while allowing existing retail products without a `catalog` subdocument to exist without conflict.

2. **Retail Barcode Partial Unique Index**:
   ```javascript
   productSchema.index(
     { 'identity.barcode': 1 },
     {
       unique: true,
       partialFilterExpression: { 'identity.barcode': { $exists: true, $type: 'string', $gt: '' } }
     }
   );
   ```
   *Behavior*: Enforces strict uniqueness among products with barcodes while allowing catalog products without barcodes to exist with `barcode: null`.
