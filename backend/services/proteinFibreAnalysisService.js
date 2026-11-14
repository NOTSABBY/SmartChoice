const { getIcmrRdaProfile } = require('../config/icmrRdaReference');
const { getCategoryFormat } = require('../config/analysisThresholds');
const { isValidFiniteNumber, isNonNegativeFiniteNumber, isPositiveFiniteNumber } = require('./validationUtils');

/**
 * Evaluates Protein Claim Eligibility under FSSAI Advertising & Claims Regulations, 2019,
 * and optional personalized evaluation against specific ICMR-NIN 2020 reference profiles.
 */
function evaluateProteinClaim({
  declaredProtein,
  declaredUnit = 'g',
  declaredBasis = 'UNKNOWN',
  energyKcal = null,
  energyBasis = null,
  servingSize = null,
  categoryFormat = 'UNCLASSIFIED',
  statutoryReferenceRdaG = null,   // Explicit statutory baseline established by authority
  statutoryReferenceSource = null, // Documented citation for statutory baseline
  personalizedProfileKey = null    // Optional explicit profile, e.g. "ADULT_WOMEN.SEDENTARY"
}) {
  const result = {
    statutoryClaim: {
      status: 'DATA_UNAVAILABLE',
      isEligible: false,
      claimLevel: 'NONE', // 'HIGH_PROTEIN', 'SOURCE_OF_PROTEIN', 'NONE'
      qualifyingBasis: null,
      evaluatedBasis: declaredBasis,
      normalizedValuePer100: null,
      statutoryReferenceUsed: null,
      reason: ''
    },
    personalizedAssessment: null,
    provenance: {
      originalDeclaredProtein: declaredProtein,
      declaredUnit,
      declaredBasis,
      energyKcal,
      energyBasis,
      servingSize: servingSize ? { ...servingSize } : null
    }
  };

  if (!isValidFiniteNumber(declaredProtein) || declaredProtein < 0) {
    result.statutoryClaim.reason = 'Declared protein value is missing, non-numeric, or negative.';
    return result;
  }

  const normUnit = (declaredUnit || '').trim().toLowerCase();
  let proteinG = null;
  if (normUnit === 'g') {
    proteinG = declaredProtein;
  } else if (normUnit === 'mg') {
    proteinG = declaredProtein / 1000.0;
  } else {
    result.statutoryClaim.status = 'UNSUPPORTED_UNIT';
    result.statutoryClaim.reason = `Unsupported protein unit: '${declaredUnit}'.`;
    return result;
  }

  const isSolid = categoryFormat === 'SOLID_FOOD';
  const isLiquid = categoryFormat === 'BEVERAGE_GENERAL' || categoryFormat === 'BEVERAGE_DAIRY';
  if (!isSolid && !isLiquid) {
    result.statutoryClaim.status = 'UNCLASSIFIED_CATEGORY';
    result.statutoryClaim.reason = `Category format '${categoryFormat}' cannot establish statutory protein claim schedule.`;
    return result;
  }

  if (!isPositiveFiniteNumber(statutoryReferenceRdaG)) {
    result.statutoryClaim.status = 'STATUTORY_REFERENCE_UNSPECIFIED';
    result.statutoryClaim.reason = 'Statutory reference RDA is unspecified or invalid. Cannot evaluate statutory claim without explicit reference value.';
    return result;
  }

  result.statutoryClaim.statutoryReferenceUsed = {
    rdaG: statutoryReferenceRdaG,
    sourceCitation: statutoryReferenceSource || 'FSSAI (Labelling & Display / Claims) Regulations'
  };

  const normBasis = (declaredBasis || '').trim().toUpperCase();
  let normalizedPer100 = null;
  let validServingSize = null;

  if (normBasis === 'PER_100G' && isSolid) {
    normalizedPer100 = proteinG;
  } else if (normBasis === 'PER_100ML' && isLiquid) {
    normalizedPer100 = proteinG;
  } else if (normBasis === 'PER_SERVING') {
    if (!servingSize || !isPositiveFiniteNumber(servingSize.value)) {
      result.statutoryClaim.status = 'CLAIM_UNVERIFIABLE_BASIS_MISMATCH';
      result.statutoryClaim.reason = 'Per-serving declaration lacks a verified positive serving size.';
      return result;
    }
    const sUnit = (servingSize.unit || '').trim().toLowerCase();
    if ((isSolid && sUnit !== 'g') || (isLiquid && sUnit !== 'ml')) {
      result.statutoryClaim.status = 'INCOMPATIBLE_SERVING_UNIT';
      result.statutoryClaim.reason = `Mismatched serving unit '${servingSize.unit}' for category '${categoryFormat}'.`;
      return result;
    }
    validServingSize = servingSize.value;
    normalizedPer100 = (proteinG / validServingSize) * 100.0;
  } else {
    result.statutoryClaim.status = 'INCOMPATIBLE_BASIS';
    result.statutoryClaim.reason = `Basis '${declaredBasis}' is incompatible with category format '${categoryFormat}'.`;
    return result;
  }

  result.statutoryClaim.normalizedValuePer100 = Number(normalizedPer100.toFixed(4));

  const highReqPer100 = isSolid ? (0.20 * statutoryReferenceRdaG) : (0.10 * statutoryReferenceRdaG);
  const sourceReqPer100 = isSolid ? (0.10 * statutoryReferenceRdaG) : (0.05 * statutoryReferenceRdaG);

  // Check 1: Per 100 Unit
  if (normalizedPer100 >= highReqPer100) {
    result.statutoryClaim.status = 'HIGH_PROTEIN_ELIGIBLE';
    result.statutoryClaim.isEligible = true;
    result.statutoryClaim.claimLevel = 'HIGH_PROTEIN';
    result.statutoryClaim.qualifyingBasis = isSolid ? 'PER_100G' : 'PER_100ML';
    result.statutoryClaim.reason = `Protein (${result.statutoryClaim.normalizedValuePer100}g/100) meets High Protein requirement (>= ${highReqPer100.toFixed(2)}g).`;
    return result;
  }

  // Check 2: Per 100 kcal (requires matching energy basis)
  if (isPositiveFiniteNumber(energyKcal) && energyBasis && energyBasis.trim().toUpperCase() === normBasis) {
    const proteinPer100Kcal = (proteinG / energyKcal) * 100.0;
    const highReqKcal = 0.10 * statutoryReferenceRdaG;
    const sourceReqKcal = 0.05 * statutoryReferenceRdaG;

    if (proteinPer100Kcal >= highReqKcal) {
      result.statutoryClaim.status = 'HIGH_PROTEIN_ELIGIBLE';
      result.statutoryClaim.isEligible = true;
      result.statutoryClaim.claimLevel = 'HIGH_PROTEIN';
      result.statutoryClaim.qualifyingBasis = 'PER_100_KCAL';
      result.statutoryClaim.reason = `Protein per 100 kcal (${proteinPer100Kcal.toFixed(2)}g) meets High Protein requirement (>= ${highReqKcal.toFixed(2)}g).`;
      return result;
    }
    if (proteinPer100Kcal >= sourceReqKcal) {
      result.statutoryClaim.status = 'SOURCE_OF_PROTEIN_ELIGIBLE';
      result.statutoryClaim.isEligible = true;
      result.statutoryClaim.claimLevel = 'SOURCE_OF_PROTEIN';
      result.statutoryClaim.qualifyingBasis = 'PER_100_KCAL';
      result.statutoryClaim.reason = `Protein per 100 kcal (${proteinPer100Kcal.toFixed(2)}g) meets Source of Protein requirement (>= ${sourceReqKcal.toFixed(2)}g).`;
      return result;
    }
  }

  // Check 3: Per Serving Basis (when declared per serving)
  if (normBasis === 'PER_SERVING' && validServingSize !== null) {
    const highReqServing = isSolid ? (0.20 * statutoryReferenceRdaG) : (0.10 * statutoryReferenceRdaG);
    const sourceReqServing = isSolid ? (0.10 * statutoryReferenceRdaG) : (0.05 * statutoryReferenceRdaG);

    if (proteinG >= highReqServing) {
      result.statutoryClaim.status = 'HIGH_PROTEIN_ELIGIBLE';
      result.statutoryClaim.isEligible = true;
      result.statutoryClaim.claimLevel = 'HIGH_PROTEIN';
      result.statutoryClaim.qualifyingBasis = 'PER_SERVING';
      result.statutoryClaim.reason = `Protein per serving (${proteinG}g) meets High Protein requirement (>= ${highReqServing.toFixed(2)}g).`;
      return result;
    }
    if (proteinG >= sourceReqServing) {
      result.statutoryClaim.status = 'SOURCE_OF_PROTEIN_ELIGIBLE';
      result.statutoryClaim.isEligible = true;
      result.statutoryClaim.claimLevel = 'SOURCE_OF_PROTEIN';
      result.statutoryClaim.qualifyingBasis = 'PER_SERVING';
      result.statutoryClaim.reason = `Protein per serving (${proteinG}g) meets Source of Protein requirement (>= ${sourceReqServing.toFixed(2)}g).`;
      return result;
    }
  }

  // Check 4: Source of Protein per 100 Unit
  if (normalizedPer100 >= sourceReqPer100) {
    result.statutoryClaim.status = 'SOURCE_OF_PROTEIN_ELIGIBLE';
    result.statutoryClaim.isEligible = true;
    result.statutoryClaim.claimLevel = 'SOURCE_OF_PROTEIN';
    result.statutoryClaim.qualifyingBasis = isSolid ? 'PER_100G' : 'PER_100ML';
    result.statutoryClaim.reason = `Protein (${result.statutoryClaim.normalizedValuePer100}g/100) meets Source of Protein requirement (>= ${sourceReqPer100.toFixed(2)}g).`;
    return result;
  }

  result.statutoryClaim.status = 'NOT_ELIGIBLE';
  result.statutoryClaim.reason = `Protein content does not meet statutory thresholds for ${categoryFormat}.`;

  // Personalized assessment
  if (personalizedProfileKey) {
    const profile = getIcmrRdaProfile(personalizedProfileKey);
    if (profile) {
      result.personalizedAssessment = {
        profileKey: profile.key,
        targetRdaG: profile.rdaProteinG,
        categoryLabel: profile.categoryLabel,
        percentRdaPer100: Number(((normalizedPer100 / profile.rdaProteinG) * 100).toFixed(2))
      };
    }
  }

  return result;
}

/**
 * Evaluates Dietary Fibre Claim Eligibility under FSSAI Advertising & Claims Regulations, 2019, Sched II.
 * Strictly normalizes per-serving declarations and validates energy parity for per-100-kcal claims.
 */
function evaluateFibreClaim({
  declaredFibre,
  declaredUnit = 'g',
  declaredBasis = 'UNKNOWN',
  energyKcal = null,
  energyBasis = null,
  servingSize = null,
  categoryFormat = 'UNCLASSIFIED'
}) {
  const result = {
    status: 'DATA_UNAVAILABLE',
    isEligible: false,
    claimLevel: 'NONE',
    qualifyingBasis: null,
    provenance: {
      originalDeclaredFibre: declaredFibre,
      declaredUnit,
      declaredBasis,
      convertedGramsValue: null,
      servingSize: servingSize ? { value: servingSize.value, unit: servingSize.unit } : null,
      normalizedValuePer100: null,
      per100KcalValue: null
    },
    regulatoryReference: 'FSSAI (Advertising & Claims) Regulations, 2019, Schedule II',
    reason: ''
  };

  if (!isValidFiniteNumber(declaredFibre) || declaredFibre < 0) {
    result.reason = 'Declared fibre value is missing, non-numeric, or negative.';
    return result;
  }

  const normUnit = (declaredUnit || '').trim().toLowerCase();
  let fibreG = null;
  if (normUnit === 'g') {
    fibreG = declaredFibre;
  } else if (normUnit === 'mg') {
    fibreG = declaredFibre / 1000.0;
  } else {
    result.status = 'UNSUPPORTED_UNIT';
    result.reason = `Unsupported fibre unit: '${declaredUnit}'.`;
    return result;
  }
  result.provenance.convertedGramsValue = fibreG;

  const isSolid = categoryFormat === 'SOLID_FOOD';
  const isLiquid = categoryFormat === 'BEVERAGE_GENERAL' || categoryFormat === 'BEVERAGE_DAIRY';
  if (!isSolid && !isLiquid) {
    result.status = 'UNCLASSIFIED_CATEGORY';
    result.reason = `Category format '${categoryFormat}' is unclassified. Fibre claim schedule cannot be established.`;
    return result;
  }

  const thresholdHigh = isLiquid ? 3.0 : 6.0;
  const thresholdSource = isLiquid ? 1.5 : 3.0;

  const normBasis = (declaredBasis || '').trim().toUpperCase();
  let normalizedPer100 = null;

  if (normBasis === 'PER_100G') {
    if (isLiquid) {
      result.status = 'INCOMPATIBLE_BASIS';
      result.reason = `Liquid category '${categoryFormat}' cannot be declared per 100g; must be per 100ml.`;
      return result;
    }
    normalizedPer100 = fibreG;
  } else if (normBasis === 'PER_100ML') {
    if (isSolid) {
      result.status = 'INCOMPATIBLE_BASIS';
      result.reason = `Solid food category '${categoryFormat}' cannot be declared per 100ml; must be per 100g.`;
      return result;
    }
    normalizedPer100 = fibreG;
  } else if (normBasis === 'PER_SERVING') {
    if (!servingSize || !isPositiveFiniteNumber(servingSize.value)) {
      result.status = 'CLAIM_UNVERIFIABLE_BASIS_MISMATCH';
      result.reason = 'Per-serving fibre declaration lacks a verified positive serving size.';
      return result;
    }
    const sUnit = (servingSize.unit || '').trim().toLowerCase();
    if (isSolid && sUnit !== 'g') {
      result.status = 'INCOMPATIBLE_SERVING_UNIT';
      result.reason = `Solid food serving unit must be 'g'. Received: '${servingSize.unit}'.`;
      return result;
    }
    if (isLiquid && sUnit !== 'ml') {
      result.status = 'INCOMPATIBLE_SERVING_UNIT';
      result.reason = `Liquid food serving unit must be 'ml'. Received: '${servingSize.unit}'.`;
      return result;
    }

    normalizedPer100 = (fibreG / servingSize.value) * 100.0;
  } else {
    result.status = 'UNKNOWN_BASIS';
    result.reason = `Declared basis '${declaredBasis}' is unrecognized.`;
    return result;
  }

  result.provenance.normalizedValuePer100 = Number(normalizedPer100.toFixed(4));

  // High Fibre per 100
  if (normalizedPer100 >= thresholdHigh) {
    result.status = 'HIGH_FIBRE_ELIGIBLE';
    result.isEligible = true;
    result.claimLevel = 'HIGH_FIBRE';
    result.qualifyingBasis = isLiquid ? 'PER_100ML' : 'PER_100G';
    result.reason = `Fibre (${result.provenance.normalizedValuePer100}g/100) meets High Fibre requirement (>= ${thresholdHigh}g).`;
    return result;
  }

  // Per 100 kcal (requires verified energy parity)
  if (
    isPositiveFiniteNumber(energyKcal) &&
    energyBasis &&
    energyBasis.trim().toUpperCase() === normBasis
  ) {
    const fibrePer100Kcal = (fibreG / energyKcal) * 100.0;
    result.provenance.per100KcalValue = Number(fibrePer100Kcal.toFixed(4));

    if (fibrePer100Kcal >= 3.0) {
      result.status = 'HIGH_FIBRE_ELIGIBLE';
      result.isEligible = true;
      result.claimLevel = 'HIGH_FIBRE';
      result.qualifyingBasis = 'PER_100_KCAL';
      result.reason = `Fibre per 100 kcal (${result.provenance.per100KcalValue}g) meets High Fibre requirement (>= 3.0g).`;
      return result;
    }
    if (fibrePer100Kcal >= 1.5) {
      result.status = 'SOURCE_OF_FIBRE_ELIGIBLE';
      result.isEligible = true;
      result.claimLevel = 'SOURCE_OF_FIBRE';
      result.qualifyingBasis = 'PER_100_KCAL';
      result.reason = `Fibre per 100 kcal (${result.provenance.per100KcalValue}g) meets Source of Fibre requirement (>= 1.5g).`;
      return result;
    }
  }

  // Source of Fibre per 100
  if (normalizedPer100 >= thresholdSource) {
    result.status = 'SOURCE_OF_FIBRE_ELIGIBLE';
    result.isEligible = true;
    result.claimLevel = 'SOURCE_OF_FIBRE';
    result.qualifyingBasis = isLiquid ? 'PER_100ML' : 'PER_100G';
    result.reason = `Fibre (${result.provenance.normalizedValuePer100}g/100) meets Source of Fibre requirement (>= ${thresholdSource}g).`;
    return result;
  }

  result.status = 'NOT_ELIGIBLE';
  result.reason = `Fibre content (${result.provenance.normalizedValuePer100}g/100) does not meet statutory threshold of >= ${thresholdSource}g.`;
  return result;
}

/**
 * Internal SmartChoice category-aware density rating.
 * Clearly separate from statutory claims.
 */
function calculateCategoryNutrientDensity(proteinG, fibreG, categoryId) {
  let proteinRating = 'LOW';
  let fibreRating = 'LOW';

  if (isNonNegativeFiniteNumber(proteinG)) {
    if (proteinG >= 10.0) proteinRating = 'EXCELLENT';
    else if (proteinG >= 5.0) proteinRating = 'MODERATE';
  } else {
    proteinRating = 'UNCLASSIFIED';
  }

  if (isNonNegativeFiniteNumber(fibreG)) {
    if (fibreG >= 6.0) fibreRating = 'EXCELLENT';
    else if (fibreG >= 3.0) fibreRating = 'MODERATE';
  } else {
    fibreRating = 'UNCLASSIFIED';
  }

  return {
    type: 'SMARTCHOICE_INTERNAL_RATING',
    proteinRating,
    fibreRating,
    categoryContext: `Comparative category benchmark for category ${categoryId || 'general'}`
  };
}

module.exports = {
  evaluateProteinClaim,
  evaluateFibreClaim,
  calculateCategoryNutrientDensity
};