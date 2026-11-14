const { analyzeNutrition } = require('./nutritionAnalysisService');
const { analyzeIngredientProfile } = require('./ingredientParsingService');
const { classifyNova } = require('./novaAnalysisService');
const { evaluateProteinClaim, evaluateFibreClaim, calculateCategoryNutrientDensity } = require('./proteinFibreAnalysisService');
const { evaluateCompletenessAndConfidence } = require('./dataCompletenessService');
const { getCategoryFormat } = require('../config/analysisThresholds');

/**
 * Unified Product Analysis Engine
 * Coordinates all modular analytical services into the complete analysis document.
 */
function analyzeProduct(product, options = {}) {
  const categoryId = product.identity?.categoryId || product.catalog?.categoryId;
  const categoryFormat = getCategoryFormat(categoryId);

  // 1. Nutrition Analysis
  const nutritionAnalysis = analyzeNutrition(product);

  // 2. Ingredient, Additive & Allergen Analysis
  const ingredientProfile = analyzeIngredientProfile(product);

  // 3. Processing & NOVA Analysis
  const novaResult = classifyNova(product);

  // 4. Protein and Fibre Evaluation
  const rawNutr = product.nutrition || {};
  const proteinVal = rawNutr.protein != null ? rawNutr.protein : null;
  const fibreVal = rawNutr.fiber != null ? rawNutr.fiber : null;
  const energyKcal = rawNutr.calories != null ? rawNutr.calories : null;
  const basis = rawNutr.basis || 'UNKNOWN';

  const proteinClaim = evaluateProteinClaim({
    declaredProtein: proteinVal,
    declaredUnit: 'g',
    declaredBasis: basis,
    energyKcal,
    energyBasis: basis,
    servingSize: product.serving,
    categoryFormat,
    statutoryReferenceRdaG: options.statutoryReferenceRdaG || null,
    statutoryReferenceSource: options.statutoryReferenceSource || null,
    personalizedProfileKey: options.personalizedProfileKey || null
  });

  const fibreClaim = evaluateFibreClaim({
    declaredFibre: fibreVal,
    declaredUnit: 'g',
    declaredBasis: basis,
    energyKcal,
    energyBasis: basis,
    servingSize: product.serving,
    categoryFormat
  });

  const internalRating = calculateCategoryNutrientDensity(proteinVal, fibreVal, categoryId);

  // 5. Completeness and Confidence
  const quality = evaluateCompletenessAndConfidence(product, nutritionAnalysis, ingredientProfile, novaResult);

  return {
    analyzedAt: new Date(),
    engineVersion: '3.0.0-fssai',
    completeness: quality.completeness,
    confidence: quality.confidence,
    nutritionAnalysis: {
      basis: nutritionAnalysis.basis,
      categoryFormat: nutritionAnalysis.categoryFormat,
      nutrients: nutritionAnalysis.nutrients,
      positiveNutrients: {
        fssaiClaims: {
          protein: {
            status: proteinClaim.statutoryClaim.status,
            qualifyingBasis: proteinClaim.statutoryClaim.qualifyingBasis,
            regulatoryReference: 'FSSAI (Advertising & Claims) Regulations, 2019'
          },
          fibre: {
            status: fibreClaim.status,
            qualifyingBasis: fibreClaim.qualifyingBasis,
            regulatoryReference: fibreClaim.regulatoryReference
          }
        },
        internalRating
      },
      transFatCompliance: nutritionAnalysis.transFatCompliance
    },
    processingAnalysis: {
      novaGroup: novaResult.novaGroup,
      sourceCertainty: novaResult.sourceCertainty,
      externalProvenance: novaResult.externalProvenance,
      evidence: novaResult.evidence,
      rationale: novaResult.rationale
    },
    ingredientAnalysis: {
      parseStatus: ingredientProfile.parseStatus,
      totalIngredientCount: ingredientProfile.totalIngredientCount,
      additives: {
        detectionStatus: ingredientProfile.additives.detectionStatus,
        totalDetected: ingredientProfile.additives.totalDetected,
        cosmeticCount: ingredientProfile.additives.cosmeticCount,
        identifiedList: ingredientProfile.additives.identifiedList
      },
      allergens: {
        detectionStatus: ingredientProfile.allergens.detectionStatus,
        declaredAllergenClasses: ingredientProfile.allergens.declaredAllergenClasses
      }
    }
  };
}

module.exports = {
  analyzeProduct
};