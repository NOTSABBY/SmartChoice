const { NUTRITION_THRESHOLDS, getCategoryFormat } = require('../config/analysisThresholds');
const { isValidFiniteNumber, isNonNegativeFiniteNumber, isPositiveFiniteNumber } = require('./validationUtils');

/**
 * Classifies a specific nutrient against contiguous, mutually exclusive category thresholds.
 */
function classifyNutrient(val, nutrientConfig) {
  if (!isValidFiniteNumber(val) || !nutrientConfig) {
    return {
      trafficLight: 'UNCLASSIFIED',
      thresholdSource: nutrientConfig ? nutrientConfig.source : null
    };
  }

  const { low, moderate, high, source } = nutrientConfig;

  // Strict contiguous intervals:
  // Low: <= low.max
  // Moderate: > moderate.min and <= moderate.max
  // High: > high.min
  if (val <= low.max) {
    return { trafficLight: 'LOW', thresholdSource: source };
  } else if (val > moderate.min && val <= moderate.max) {
    return { trafficLight: 'MODERATE', thresholdSource: source };
  } else if (val > high.min) {
    return { trafficLight: 'HIGH', thresholdSource: source };
  }

  return { trafficLight: 'UNCLASSIFIED', thresholdSource: source };
}

/**
 * Evaluates FSSAI "Trans-Fat Free" Claim Eligibility under FSSAI Advertising & Claims Reg 2019.
 * Strictly verifies units, category-basis compatibility, and per-serving normalization.
 */
function evaluateTransFatFreeClaim({
  declaredTransFat,
  declaredUnit = 'g',
  declaredBasis = 'UNKNOWN',
  servingSize = null,
  categoryFormat = 'UNCLASSIFIED'
}) {
  const result = {
    claimTag: 'UNVERIFIABLE',
    isEligible: false,
    categoryApplied: categoryFormat,
    applicableThresholdG: null,
    provenance: {
      originalDeclaredValue: declaredTransFat,
      originalDeclaredUnit: declaredUnit,
      originalDeclaredBasis: declaredBasis,
      convertedGramsValue: null,
      servingSize: servingSize ? { value: servingSize.value, unit: servingSize.unit } : null,
      normalizedValuePer100: null,
      applicableThresholdG: null
    },
    reason: ''
  };

  if (!isValidFiniteNumber(declaredTransFat)) {
    result.reason = 'Declared trans-fat value is missing, non-numeric, or invalid.';
    return result;
  }

  if (declaredTransFat < 0) {
    result.claimTag = 'INVALID_INPUT';
    result.reason = 'Declared trans-fat cannot be negative.';
    return result;
  }

  // Unit conversion to grams
  const normalizedUnitStr = (declaredUnit || '').trim().toLowerCase();
  let transFatInGrams = null;

  if (normalizedUnitStr === 'g') {
    transFatInGrams = declaredTransFat;
  } else if (normalizedUnitStr === 'mg') {
    transFatInGrams = declaredTransFat / 1000.0;
  } else {
    result.claimTag = 'UNSUPPORTED_UNIT';
    result.reason = `Declared unit '${declaredUnit}' is unsupported. Only 'g' and 'mg' are permitted.`;
    return result;
  }
  result.provenance.convertedGramsValue = transFatInGrams;

  // Category format & statutory threshold selection
  let thresholdG = null;
  let expectedBasisType = null; // 'MASS', 'VOLUME', or 'MASS_OR_VOLUME'

  if (categoryFormat === 'SOLID_FOOD') {
    thresholdG = 0.2;
    expectedBasisType = 'MASS';
  } else if (categoryFormat === 'BEVERAGE_GENERAL' || categoryFormat === 'BEVERAGE_DAIRY') {
    thresholdG = 0.2;
    expectedBasisType = 'VOLUME';
  } else if (categoryFormat === 'COOKING_OIL' || categoryFormat === 'EDIBLE_FATS_AND_OILS') {
    thresholdG = 1.0;
    expectedBasisType = 'MASS_OR_VOLUME';
  } else {
    result.claimTag = 'UNCLASSIFIED_CATEGORY';
    result.reason = `Category format '${categoryFormat}' is unclassified. Statutory claim schedule cannot be established.`;
    return result;
  }

  result.applicableThresholdG = thresholdG;
  result.provenance.applicableThresholdG = thresholdG;

  // Validate declared basis and category compatibility
  const normBasis = (declaredBasis || '').trim().toUpperCase();

  if (normBasis === 'PER_100G') {
    if (expectedBasisType === 'VOLUME') {
      result.claimTag = 'INCOMPATIBLE_BASIS';
      result.reason = `Liquid category '${categoryFormat}' cannot be declared per 100g; must be per 100ml.`;
      return result;
    }
    result.provenance.normalizedValuePer100 = transFatInGrams;
  } else if (normBasis === 'PER_100ML') {
    if (expectedBasisType === 'MASS') {
      result.claimTag = 'INCOMPATIBLE_BASIS';
      result.reason = `Solid food category '${categoryFormat}' cannot be declared per 100ml; must be per 100g.`;
      return result;
    }
    result.provenance.normalizedValuePer100 = transFatInGrams;
  } else if (normBasis === 'PER_SERVING') {
    if (!servingSize || typeof servingSize !== 'object') {
      result.claimTag = 'CLAIM_UNVERIFIABLE_BASIS_MISMATCH';
      result.reason = 'Per-serving declaration requires a valid servingSize object.';
      return result;
    }

    const { value: sValue, unit: sUnit } = servingSize;

    if (!isPositiveFiniteNumber(sValue)) {
      result.claimTag = 'CLAIM_UNVERIFIABLE_BASIS_MISMATCH';
      result.reason = `Serving size value must be a positive number greater than zero. Received: ${sValue}.`;
      return result;
    }

    const normServingUnit = (sUnit || '').trim().toLowerCase();

    if (expectedBasisType === 'MASS') {
      if (normServingUnit !== 'g') {
        result.claimTag = 'INCOMPATIBLE_SERVING_UNIT';
        result.reason = `Solid food serving size unit must be 'g'. Received: '${sUnit}'.`;
        return result;
      }
    } else if (expectedBasisType === 'VOLUME') {
      if (normServingUnit !== 'ml') {
        result.claimTag = 'INCOMPATIBLE_SERVING_UNIT';
        result.reason = `Liquid food serving size unit must be 'ml'. Received: '${sUnit}'.`;
        return result;
      }
    } else if (expectedBasisType === 'MASS_OR_VOLUME') {
      if (normServingUnit !== 'g' && normServingUnit !== 'ml') {
        result.claimTag = 'INCOMPATIBLE_SERVING_UNIT';
        result.reason = `Edible fats/oils serving size unit must be 'g' or 'ml'. Received: '${sUnit}'.`;
        return result;
      }
    }

    const normalized = (transFatInGrams / sValue) * 100.0;
    result.provenance.normalizedValuePer100 = Number(normalized.toFixed(6));
  } else {
    result.claimTag = 'UNKNOWN_BASIS';
    result.reason = `Declared basis '${declaredBasis}' is unrecognized or unsupported.`;
    return result;
  }

  // Strict statutory threshold check: strictly less than (<) threshold
  if (result.provenance.normalizedValuePer100 < thresholdG) {
    result.isEligible = true;
    result.claimTag = 'TRANS_FAT_FREE_ELIGIBLE';
    result.reason = `Normalized trans-fat (${result.provenance.normalizedValuePer100}g/100) is strictly less than statutory threshold of ${thresholdG}g per 100 for ${categoryFormat}.`;
  } else {
    result.isEligible = false;
    result.claimTag = 'NOT_ELIGIBLE';
    result.reason = `Normalized trans-fat (${result.provenance.normalizedValuePer100}g/100) meets or exceeds statutory threshold of ${thresholdG}g per 100 for ${categoryFormat}.`;
  }

  return result;
}

/**
 * Statutory industrial trans-fat compliance evaluation.
 * Decoupled from claims and ordinary label disclosures.
 */
function evaluateTransFatCompliance({ declaredTransFatG, declaredTotalFatG, ingredientText }) {
  const result = {
    status: 'REGULATORY_COMPLIANCE_UNVERIFIABLE',
    iTfaLimitPercent: 2.0,
    totalTransFatPercentOfFat: null,
    analyticalEvidencePresent: false,
    reason: 'Nutrition-label trans-fat data represents total trans fatty acids and does not distinguish industrial trans fats from naturally occurring ruminant trans fats. Statutory compliance cannot be verified without certified laboratory analysis.',
    markers: {
      phvoDetected: false,
      ruminantFatSourceDetected: false
    }
  };

  if (ingredientText) {
    result.markers.phvoDetected = /(partially\s+hydrogenated|hydrogenated\s+(vegetable\s+)?(oil|fat)|vanaspati)/i.test(ingredientText);
    result.markers.ruminantFatSourceDetected = /(milk|butter|ghee|cheese|dairy|whey|casein)/i.test(ingredientText);
  }

  if (isPositiveFiniteNumber(declaredTotalFatG) && isNonNegativeFiniteNumber(declaredTransFatG)) {
    const ratio = (declaredTransFatG / declaredTotalFatG) * 100.0;
    result.totalTransFatPercentOfFat = Number(ratio.toFixed(2));

    if (ratio > 2.0 && result.markers.phvoDetected) {
      result.status = 'POTENTIAL_STATUTORY_EXCEEDANCE_DETECTED';
      result.reason = `Declared total trans fat is ${ratio.toFixed(2)}% of total fat and partially hydrogenated fats are indicated in ingredients. Analytical verification recommended.`;
    }
  }

  return result;
}

/**
 * Full Nutrition Analysis Orchestration for a product
 */
function analyzeNutrition(product) {
  const categoryId = product.identity?.categoryId || product.catalog?.categoryId;
  const categoryFormat = getCategoryFormat(categoryId);
  const thresholds = NUTRITION_THRESHOLDS[categoryFormat] || null;

  const rawNutr = product.nutrition || {};
  const basis = rawNutr.basis || 'UNKNOWN';
  const servingSize = product.serving || null;

  // Extract declared nutrients
  const sugarsVal = rawNutr.sugar != null ? rawNutr.sugar : null;
  const fatVal = rawNutr.fat != null ? rawNutr.fat : null;
  const satFatVal = rawNutr.saturatedFat != null ? rawNutr.saturatedFat : null;
  const sodiumVal = rawNutr.sodium != null ? rawNutr.sodium : null;
  const transFatVal = rawNutr.transFat != null ? rawNutr.transFat : null;

  // Salt conversion: Salt (g) = Sodium (g) * 2.5 = (Sodium (mg) / 1000) * 2.5
  let saltEquivalentVal = null;
  if (isNonNegativeFiniteNumber(sodiumVal)) {
    saltEquivalentVal = Number(((sodiumVal / 1000.0) * 2.5).toFixed(4));
  }

  // Classifications
  const sugarsClassification = thresholds?.sugar ? classifyNutrient(sugarsVal, thresholds.sugar) : { trafficLight: 'UNCLASSIFIED', thresholdSource: null };
  const fatClassification = thresholds?.fat ? classifyNutrient(fatVal, thresholds.fat) : { trafficLight: 'UNCLASSIFIED', thresholdSource: null };
  const satFatClassification = thresholds?.saturatedFat ? classifyNutrient(satFatVal, thresholds.saturatedFat) : { trafficLight: 'UNCLASSIFIED', thresholdSource: null };
  const sodiumClassification = thresholds?.sodium ? classifyNutrient(sodiumVal, thresholds.sodium) : { trafficLight: 'UNCLASSIFIED', thresholdSource: null };
  const saltClassification = thresholds?.salt ? classifyNutrient(saltEquivalentVal, thresholds.salt) : { trafficLight: 'UNCLASSIFIED', thresholdSource: null };

  const ingredientText = product.ingredients?.rawText || (product.ingredients?.ingredients || []).join(', ');

  const transFatClaim = evaluateTransFatFreeClaim({
    declaredTransFat: transFatVal,
    declaredUnit: 'g',
    declaredBasis: basis,
    servingSize,
    categoryFormat
  });

  const transFatCompliance = evaluateTransFatCompliance({
    declaredTransFatG: transFatVal,
    declaredTotalFatG: fatVal,
    ingredientText
  });

  return {
    basis,
    categoryFormat,
    nutrients: {
      sugars: {
        valuePer100: sugarsVal,
        declaredUnit: 'g',
        trafficLight: sugarsClassification.trafficLight,
        thresholdSource: sugarsClassification.thresholdSource
      },
      fat: {
        valuePer100: fatVal,
        declaredUnit: 'g',
        trafficLight: fatClassification.trafficLight,
        thresholdSource: fatClassification.thresholdSource
      },
      saturatedFat: {
        valuePer100: satFatVal,
        declaredUnit: 'g',
        trafficLight: satFatClassification.trafficLight,
        thresholdSource: satFatClassification.thresholdSource
      },
      sodium: {
        valuePer100: sodiumVal,
        declaredUnit: 'mg',
        trafficLight: sodiumClassification.trafficLight,
        thresholdSource: sodiumClassification.thresholdSource
      },
      saltEquivalent: {
        valuePer100: saltEquivalentVal,
        declaredUnit: 'g',
        trafficLight: saltClassification.trafficLight,
        thresholdSource: saltClassification.thresholdSource
      }
    },
    transFatCompliance: {
      statutoryCompliance: {
        status: transFatCompliance.status,
        iTfaLimitPercent: transFatCompliance.iTfaLimitPercent,
        totalTransFatPercentOfFat: transFatCompliance.totalTransFatPercentOfFat,
        analyticalEvidencePresent: transFatCompliance.analyticalEvidencePresent,
        reason: transFatCompliance.reason
      },
      fssaiNutritionalClaim: {
        claimTag: transFatClaim.claimTag,
        isEligible: transFatClaim.isEligible,
        thresholdG: transFatClaim.applicableThresholdG,
        basisEvaluated: transFatClaim.provenance.originalDeclaredBasis,
        normalizedValuePer100: transFatClaim.provenance.normalizedValuePer100,
        reason: transFatClaim.reason
      },
      markers: transFatCompliance.markers
    }
  };
}

module.exports = {
  classifyNutrient,
  evaluateTransFatFreeClaim,
  evaluateTransFatCompliance,
  analyzeNutrition
};