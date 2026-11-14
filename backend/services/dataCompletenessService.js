const { isValidFiniteNumber } = require('./validationUtils');

/**
 * Calculates decoupled completeness (0-100%) and analytical confidence (0-1.0).
 */
function evaluateCompletenessAndConfidence(product, nutritionAnalysis, ingredientProfile, novaResult) {
  const missingEssentialFields = [];

  // --- 1. SECTION COMPLETENESS ---
  // A. Nutrition Completeness (Evaluates 8 key fields: 12.5% each)
  const rawNutr = product.nutrition || {};
  let nutrCount = 0;
  const evaluatedNutrients = ['calories', 'protein', 'carbohydrates', 'sugar', 'fat', 'saturatedFat', 'sodium', 'fiber'];
  
  evaluatedNutrients.forEach(n => {
    if (isValidFiniteNumber(rawNutr[n])) nutrCount++;
    else missingEssentialFields.push(`nutrition.${n}`);
  });
  const nutritionCompleteness = Number(((nutrCount / 8.0) * 100).toFixed(2));

  // B. Ingredient Completeness
  let ingredientCompleteness = 0;
  if (ingredientProfile.parseStatus === 'PARSED_SUCCESSFULLY' && ingredientProfile.totalIngredientCount > 0) {
    ingredientCompleteness = 100;
  } else if (ingredientProfile.parseStatus === 'UNPARSED_TEXT_ONLY') {
    ingredientCompleteness = 50;
    missingEssentialFields.push('ingredients.parsedTokens');
  } else {
    missingEssentialFields.push('ingredients.rawText');
  }

  // C. Processing Completeness
  let processingCompleteness = 0;
  if (novaResult.novaGroup !== null) {
    processingCompleteness = 100;
  } else {
    missingEssentialFields.push('processing.novaGroup');
  }

  // D. Catalog Completeness
  let catScore = 0;
  if (product.identity?.productName || product.catalog?.productName) catScore += 25;
  if (product.identity?.brand || product.catalog?.brand) catScore += 25;
  if (product.identity?.categoryId || product.catalog?.categoryId) catScore += 25;
  if (product.serving?.packageSize || product.serving?.servingSize) catScore += 25;
  const catalogCompleteness = catScore;

  // Total Completeness = 0.40 * nutr + 0.30 * ing + 0.15 * proc + 0.15 * cat
  const overallPercentage = Number((
    0.40 * nutritionCompleteness +
    0.30 * ingredientCompleteness +
    0.15 * processingCompleteness +
    0.15 * catalogCompleteness
  ).toFixed(2));

  // Availability Indicators
  const availabilityIndicators = {
    nutritionAvailable: nutrCount >= 4,
    ingredientsAvailable: ingredientProfile.parseStatus !== 'EMPTY_INGREDIENTS',
    additivesAvailable: ingredientProfile.additives.availability.isAvailable,
    allergensAvailable: ingredientProfile.allergens.availability.isAvailable,
    processingAvailable: novaResult.novaGroup !== null
  };

  // --- 2. DOMAIN CONFIDENCES ---
  // A. Nutrition Confidence
  let basisFactor = 0.0;
  if (nutritionAnalysis.basis === 'PER_100G' || nutritionAnalysis.basis === 'PER_100ML') basisFactor = 1.0;
  else if (nutritionAnalysis.basis === 'PER_SERVING') basisFactor = 0.70;
  
  const nutritionConfidence = Number(((nutrCount / 8.0) * basisFactor).toFixed(4));

  // B. Ingredient Confidence
  let ingredientConfidence = 0.0;
  if (ingredientProfile.parseStatus === 'PARSED_SUCCESSFULLY') ingredientConfidence = 1.0;
  else if (ingredientProfile.parseStatus === 'UNPARSED_TEXT_ONLY') ingredientConfidence = 0.50;

  // C. Processing Confidence
  let processingConfidence = 0.0;
  if (novaResult.sourceCertainty === 'SOURCE_REPORTED') processingConfidence = 1.0;
  else if (novaResult.sourceCertainty === 'INTERNALLY_ESTIMATED') {
    processingConfidence = novaResult.evidence.corroborationScore >= 2 ? 0.75 : 0.50;
  }

  // Overall Confidence: 0.45 * nutr + 0.35 * ing + 0.20 * proc
  const overallConfidence = Number((
    0.45 * nutritionConfidence +
    0.35 * ingredientConfidence +
    0.20 * processingConfidence
  ).toFixed(4));

  let confidenceBand = 'INSUFFICIENT';
  if (overallConfidence >= 0.75) confidenceBand = 'HIGH';
  else if (overallConfidence >= 0.50) confidenceBand = 'MODERATE';
  else if (overallConfidence > 0) confidenceBand = 'LOW';

  return {
    completeness: {
      overallPercentage,
      nutritionCompleteness,
      ingredientCompleteness,
      processingCompleteness,
      availabilityIndicators,
      missingEssentialFields
    },
    confidence: {
      overallConfidence,
      nutritionConfidence,
      ingredientConfidence,
      processingConfidence,
      confidenceBand
    }
  };
}

module.exports = {
  evaluateCompletenessAndConfidence
};