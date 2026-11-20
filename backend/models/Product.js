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

  product_id: { type: String, index: true },
  product_name: { type: String, index: true },
  brand: { type: String, index: true },
  category_id: { type: Number, index: true },
  category_name: { type: String },
  images: { type: mongoose.Schema.Types.Mixed },
  nutrition_info: { type: mongoose.Schema.Types.Mixed },

  // Core Identity (Backward compatible with legacy SmartChoice records)
  identity: {
    barcode: { type: String },
    name: { type: String, required: true, index: true },
    brand: { type: String, index: true },
    categories: { type: [String], index: true },
    productType: { type: String, default: 'food' },
    dietaryType: { type: String, enum: ['VEG', 'NON_VEG', 'UNKNOWN'], default: 'UNKNOWN' }
  },

  // Authoritative Dietary & Lifestyle Classification (Phase C/D/E)
  dietaryClassification: {
    status: { type: String, enum: ['VEGAN', 'VEGETARIAN', 'NON_VEGETARIAN', 'UNKNOWN'], default: 'UNKNOWN', index: true },
    isVegetarian: { type: Boolean, default: false },
    isNonVegetarian: { type: Boolean, default: false },
    isVegan: { type: Boolean, default: false },
    reason: { type: String, default: null },
    supportingEvidence: { type: String, default: null },
    source: { type: String, default: null },
    verificationStatus: { type: String, enum: ['VERIFIED', 'UNVERIFIED', 'CONFLICT', 'UNAVAILABLE', 'NEEDS_REVIEW'], default: 'UNVERIFIED' },
    confidence: { type: String, enum: ['HIGH', 'MODERATE', 'LOW', 'MEDIUM'], default: 'LOW' },
    lastVerifiedAt: { type: Date, default: null }
  },

  // Authoritative Evidence-Based Dairy Classification
  dairyClassification: {
    classification: {
      type: String,
      enum: ['DAIRY_CONTAINS', 'DAIRY_FREE_VERIFIED', 'DAIRY_MAY_CONTAIN', 'DAIRY_UNKNOWN', 'DAIRY_CONFLICTING_EVIDENCE'],
      default: 'DAIRY_UNKNOWN',
      index: true
    },
    isDairyFree: { type: Boolean, default: false },
    confidence: { type: Number, default: 0 },
    evidence: [{
      type: { type: String }, // 'INGREDIENT' | 'ALLERGEN_CONTAINS' | 'ALLERGEN_MAY_CONTAIN' | 'PRODUCT_IDENTITY' | 'MISSING_DATA' | 'CONFLICT' | 'VERIFIED_ABSENCE'
      matchedTerm: { type: String },
      sourceField: { type: String }
    }],
    verificationStatus: { type: String, default: 'UNVERIFIED' },
    reason: { type: String, default: null }
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

  // Ingredients and composition (FSSAI Predominance Order & Verified Provenance)
  ingredients: {
    ingredients: { type: [mongoose.Schema.Types.Mixed], default: [] },
    allergens: { type: [String], default: [] },
    additives: { type: [String], default: [] },
    rawIngredientsText: { type: String, default: null },
    rawText: { type: String, default: null },
    verificationStatus: { 
      type: String, 
      enum: ['VERIFIED', 'INGREDIENTS_UNVERIFIED', 'INGREDIENTS_UNAVAILABLE', 'INGREDIENTS_CONFLICT'], 
      default: 'INGREDIENTS_UNVERIFIED' 
    },
    sourceUrl: { type: String, default: null },
    sourceType: { type: String, default: null },
    verifiedAt: { type: Date, default: null },
    subIngredients: { type: mongoose.Schema.Types.Mixed, default: {} },
    allergenDeclarations: {
      contains: [{ type: String }],
      mayContain: [{ type: String }],
      status: { type: String, enum: ['ALLERGENS_IDENTIFIED', 'NO_ALLERGENS_DETECTED', 'UNKNOWN'], default: 'UNKNOWN' },
      source: { type: String, default: null }
    }
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

  // Phase 3: Comprehensive Product Analysis Engine Results
  analysis: {
    analyzedAt: { type: Date, default: null },
    engineVersion: { type: String, default: '3.0.0-fssai' },
    completeness: {
      overallPercentage: { type: Number, default: 0, min: 0, max: 100 },
      nutritionCompleteness: { type: Number, default: 0, min: 0, max: 100 },
      ingredientCompleteness: { type: Number, default: 0, min: 0, max: 100 },
      processingCompleteness: { type: Number, default: 0, min: 0, max: 100 },
      availabilityIndicators: {
        nutritionAvailable: { type: Boolean, default: false },
        ingredientsAvailable: { type: Boolean, default: false },
        additivesAvailable: { type: Boolean, default: false },
        allergensAvailable: { type: Boolean, default: false },
        processingAvailable: { type: Boolean, default: false }
      },
      missingEssentialFields: [{ type: String }]
    },
    confidence: {
      overallConfidence: { type: Number, default: 0, min: 0, max: 1 },
      nutritionConfidence: { type: Number, default: 0, min: 0, max: 1 },
      ingredientConfidence: { type: Number, default: 0, min: 0, max: 1 },
      processingConfidence: { type: Number, default: 0, min: 0, max: 1 },
      confidenceBand: { 
        type: String, 
        enum: ['HIGH', 'MODERATE', 'LOW', 'INSUFFICIENT'], 
        default: 'INSUFFICIENT' 
      }
    },
    nutritionAnalysis: {
      basis: { 
        type: String, 
        enum: ['PER_100G', 'PER_100ML', 'PER_SERVING', 'UNAVAILABLE', 'UNKNOWN'], 
        default: 'UNKNOWN' 
      },
      categoryFormat: { 
        type: String, 
        enum: ['SOLID_FOOD', 'BEVERAGE_GENERAL', 'BEVERAGE_DAIRY', 'COOKING_OIL', 'UNCLASSIFIED'], 
        default: 'UNCLASSIFIED' 
      },
      nutrients: {
        sugars: {
          valuePer100: { type: Number, default: null },
          declaredUnit: { type: String, default: 'g' },
          trafficLight: { type: String, enum: ['LOW', 'MODERATE', 'HIGH', 'UNCLASSIFIED'], default: 'UNCLASSIFIED' },
          thresholdSource: { type: String, default: null }
        },
        fat: {
          valuePer100: { type: Number, default: null },
          declaredUnit: { type: String, default: 'g' },
          trafficLight: { type: String, enum: ['LOW', 'MODERATE', 'HIGH', 'UNCLASSIFIED'], default: 'UNCLASSIFIED' },
          thresholdSource: { type: String, default: null }
        },
        saturatedFat: {
          valuePer100: { type: Number, default: null },
          declaredUnit: { type: String, default: 'g' },
          trafficLight: { type: String, enum: ['LOW', 'MODERATE', 'HIGH', 'UNCLASSIFIED'], default: 'UNCLASSIFIED' },
          thresholdSource: { type: String, default: null }
        },
        sodium: {
          valuePer100: { type: Number, default: null },
          declaredUnit: { type: String, default: 'mg' },
          trafficLight: { type: String, enum: ['LOW', 'MODERATE', 'HIGH', 'UNCLASSIFIED'], default: 'UNCLASSIFIED' },
          thresholdSource: { type: String, default: null }
        },
        saltEquivalent: {
          valuePer100: { type: Number, default: null },
          declaredUnit: { type: String, default: 'g' },
          trafficLight: { type: String, enum: ['LOW', 'MODERATE', 'HIGH', 'UNCLASSIFIED'], default: 'UNCLASSIFIED' },
          thresholdSource: { type: String, default: null }
        }
      },
      positiveNutrients: {
        fssaiClaims: {
          protein: {
            status: { 
              type: String, 
              enum: ['HIGH_PROTEIN_ELIGIBLE', 'SOURCE_OF_PROTEIN_ELIGIBLE', 'NOT_ELIGIBLE', 'DATA_UNAVAILABLE', 'STATUTORY_REFERENCE_UNSPECIFIED'], 
              default: 'DATA_UNAVAILABLE' 
            },
            qualifyingBasis: { type: String, default: null },
            regulatoryReference: { type: String, default: 'FSSAI (Advertising & Claims) Reg 2019' }
          },
          fibre: {
            status: { 
              type: String, 
              enum: ['HIGH_FIBRE_ELIGIBLE', 'SOURCE_OF_FIBRE_ELIGIBLE', 'NOT_ELIGIBLE', 'DATA_UNAVAILABLE'], 
              default: 'DATA_UNAVAILABLE' 
            },
            qualifyingBasis: { type: String, default: null },
            regulatoryReference: { type: String, default: 'FSSAI (Advertising & Claims) Reg 2019' }
          }
        },
        internalRating: {
          type: { type: String, default: 'SMARTCHOICE_INTERNAL_RATING' },
          proteinRating: { type: String, default: 'UNCLASSIFIED' },
          fibreRating: { type: String, default: 'UNCLASSIFIED' },
          categoryContext: { type: String, default: '' }
        }
      },
      transFatCompliance: {
        statutoryCompliance: {
          status: { 
            type: String, 
            enum: [
              'REGULATORY_COMPLIANCE_UNVERIFIABLE', 
              'POTENTIAL_STATUTORY_EXCEEDANCE_DETECTED', 
              'CERTIFIED_ANALYTICAL_EVIDENCE_REQUIRED'
            ], 
            default: 'REGULATORY_COMPLIANCE_UNVERIFIABLE' 
          },
          iTfaLimitPercent: { type: Number, default: 2.0 },
          totalTransFatPercentOfFat: { type: Number, default: null },
          analyticalEvidencePresent: { type: Boolean, default: false },
          reason: { type: String, default: 'Nutrition-label trans-fat data represents total trans fatty acids.' }
        },
        fssaiNutritionalClaim: {
          claimTag: { 
            type: String, 
            default: 'UNVERIFIABLE' 
          },
          isEligible: { type: Boolean, default: false },
          thresholdG: { type: Number, default: null },
          basisEvaluated: { type: String, default: 'UNAVAILABLE' },
          normalizedValuePer100: { type: Number, default: null },
          reason: { type: String, default: '' }
        },
        markers: {
          phvoDetected: { type: Boolean, default: false },
          ruminantFatSourceDetected: { type: Boolean, default: false }
        }
      }
    },
    processingAnalysis: {
      novaGroup: { type: Number, enum: [1, 2, 3, 4, null], default: null },
      sourceCertainty: { 
        type: String, 
        enum: ['SOURCE_REPORTED', 'INTERNALLY_ESTIMATED', 'INSUFFICIENT_DATA'], 
        default: 'INSUFFICIENT_DATA' 
      },
      externalProvenance: {
        sourceName: { type: String, default: null },
        disclaimer: { type: String, default: null }
      },
      evidence: {
        cosmeticAdditivesDetected: [{ type: String }],
        industrialIngredientsDetected: [{ type: String }],
        processingTechniques: [{ type: String }],
        categoryPriorContext: { type: String, default: null },
        corroborationScore: { type: Number, default: 0 }
      },
      rationale: { type: String, default: 'No processing analysis conducted.' }
    },
    ingredientAnalysis: {
      parseStatus: { 
        type: String, 
        enum: ['PARSED_SUCCESSFULLY', 'UNPARSED_TEXT_ONLY', 'EMPTY_INGREDIENTS'], 
        default: 'EMPTY_INGREDIENTS' 
      },
      totalIngredientCount: { type: Number, default: 0 },
      additives: {
        detectionStatus: { 
          type: String, 
          enum: ['NO_ADDITIVES_DETECTED', 'ADDITIVES_IDENTIFIED', 'UNPARSED_INGREDIENTS'], 
          default: 'UNPARSED_INGREDIENTS' 
        },
        totalDetected: { type: Number, default: 0 },
        cosmeticCount: { type: Number, default: 0 },
        identifiedList: [{
          insNumber: { type: String },
          primaryName: { type: String },
          functionalClass: [{ type: String }],
          verificationStatus: { type: String, default: 'IDENTIFIED_ONLY' }
        }]
      },
      allergens: {
        detectionStatus: { 
          type: String, 
          enum: ['NO_ALLERGENS_DETECTED', 'ALLERGENS_IDENTIFIED', 'UNKNOWN'], 
          default: 'UNKNOWN' 
        },
        declaredAllergenClasses: [{ type: String }]
      }
    }
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
