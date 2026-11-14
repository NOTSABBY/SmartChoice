const config = require('../config/scoringConfig');
const { getCategoryFormat, NUTRITION_THRESHOLDS } = require('../config/analysisThresholds');
const { analyzeNutrition } = require('./nutritionAnalysisService');
const { analyzeIngredientProfile } = require('./ingredientParsingService');
const { classifyNova } = require('./novaAnalysisService');
const { evaluateCompletenessAndConfidence } = require('./dataCompletenessService');
const { isValidFiniteNumber, isNonNegativeFiniteNumber } = require('./validationUtils');
const Product = require('../models/Product');

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

/**
 * 1. Calculate Score Reliability / Confidence
 * Decoupled from product quality score. Measures information completeness and basis reliability.
 */
const calculateScoreConfidence = (product) => {
  const missingFields = [];
  let confidence = 100;

  const tn = product.nutrition || {};
  if (tn.calories == null) { confidence -= 10; missingFields.push('calories'); }
  if (tn.sugar == null) { confidence -= 15; missingFields.push('sugar'); }
  if (tn.saturatedFat == null) { confidence -= 10; missingFields.push('saturatedFat'); }
  if (tn.sodium == null) { confidence -= 15; missingFields.push('sodium'); }
  if (tn.protein == null) { confidence -= 10; missingFields.push('protein'); }
  if (tn.fiber == null) { confidence -= 10; missingFields.push('fiber'); }

  const hasIngredients = (product.ingredients?.ingredients && product.ingredients.ingredients.length > 0) || !!product.ingredients?.rawText;
  if (!hasIngredients) {
    confidence -= 10;
    missingFields.push('ingredients');
  }

  if (!product.processing?.novaGroup && !product.analysis?.processingAnalysis?.novaGroup) {
    confidence -= 10;
    missingFields.push('novaGroup');
  }

  let level = 'high';
  if (confidence < 50) level = 'low';
  else if (confidence < 80) level = 'medium';

  return {
    confidence: clamp(confidence, 0, 100),
    level,
    missingFields
  };
};

/**
 * 2. Nutrition Score (Sugar, Sat Fat, Sodium, Fat, Calories)
 * Respects product category formats (SOLID_FOOD, BEVERAGE_GENERAL, BEVERAGE_DAIRY, COOKING_OIL).
 * Does NOT penalize nutrients legitimately unclassified for the category (e.g., cooking oils).
 */
const calculateNutritionScore = (product, category) => {
  const categoryId = product.identity?.categoryId || product.catalog?.categoryId;
  const categoryFormat = getCategoryFormat(categoryId);
  const thresholds = NUTRITION_THRESHOLDS[categoryFormat];

  let score = 100;
  const factors = [];
  const limitations = [];
  let evaluatedCount = 0;
  let missingCount = 0;
  let isNeutralBaseline = false;

  // Use Phase 3 nutrition analysis if available, or compute on the fly
  const nutrAnalysis = product.analysis?.nutritionAnalysis || analyzeNutrition(product);
  const n = nutrAnalysis.nutrients || {};

  // Case A: Cooking Oil
  if (categoryFormat === 'COOKING_OIL') {
    const satFat = n.saturatedFat?.valuePer100;
    if (isValidFiniteNumber(satFat)) {
      evaluatedCount++;
      if (satFat > 35.0) {
        score -= 40;
        factors.push("High saturated fat for cooking oil (> 35g/100g)");
      } else if (satFat > 15.0) {
        score -= 20;
        factors.push("Moderate saturated fat for cooking oil (15-35g/100g)");
      } else {
        factors.push("Low saturated fat for cooking oil (<= 15g/100g)");
      }
    } else {
      missingCount++;
      isNeutralBaseline = true;
      limitations.push("Missing saturated fat data for cooking oil; neutral baseline assigned.");
      score = 50;
    }
    factors.push("Cooking oil evaluation: Sugar and sodium are legitimately unclassified.");
    return {
      score: clamp(score, 0, 100),
      factors,
      limitations,
      isNeutralBaseline,
      coverage: { evaluatedCount, missingCount, categoryFormat }
    };
  }

  // Case B: General Solid Foods & Beverages
  // Sugar
  if (thresholds?.sugar) {
    const val = n.sugars?.valuePer100;
    if (isValidFiniteNumber(val)) {
      evaluatedCount++;
      if (val > thresholds.sugar.high.min) {
        score -= 30;
        factors.push(`High sugar content (> ${thresholds.sugar.high.min}g)`);
      } else if (val > thresholds.sugar.moderate.min) {
        score -= 15;
        factors.push(`Moderate sugar content (${thresholds.sugar.moderate.min}-${thresholds.sugar.moderate.max}g)`);
      } else {
        factors.push(`Low sugar content (<= ${thresholds.sugar.low.max}g)`);
      }
    } else {
      missingCount++;
      limitations.push("Missing sugar data");
    }
  }

  // Saturated Fat
  if (thresholds?.saturatedFat) {
    const val = n.saturatedFat?.valuePer100;
    if (isValidFiniteNumber(val)) {
      evaluatedCount++;
      if (val > thresholds.saturatedFat.high.min) {
        score -= 25;
        factors.push(`High saturated fat (> ${thresholds.saturatedFat.high.min}g)`);
      } else if (val > thresholds.saturatedFat.moderate.min) {
        score -= 10;
        factors.push(`Moderate saturated fat (${thresholds.saturatedFat.moderate.min}-${thresholds.saturatedFat.moderate.max}g)`);
      } else {
        factors.push(`Low saturated fat (<= ${thresholds.saturatedFat.low.max}g)`);
      }
    } else {
      missingCount++;
      limitations.push("Missing saturated fat data");
    }
  }

  // Sodium
  if (thresholds?.sodium) {
    const val = n.sodium?.valuePer100;
    if (isValidFiniteNumber(val)) {
      evaluatedCount++;
      if (val > thresholds.sodium.high.min) {
        score -= 25;
        factors.push(`High sodium content (> ${thresholds.sodium.high.min}mg)`);
      } else if (val > thresholds.sodium.moderate.min) {
        score -= 10;
        factors.push(`Moderate sodium content (${thresholds.sodium.moderate.min}-${thresholds.sodium.moderate.max}mg)`);
      } else {
        factors.push(`Low sodium content (<= ${thresholds.sodium.low.max}mg)`);
      }
    } else {
      missingCount++;
      limitations.push("Missing sodium data");
    }
  }

  // Calories (Minor adjustment)
  const calVal = product.nutrition?.calories;
  if (isValidFiniteNumber(calVal)) {
    evaluatedCount++;
    if (calVal > 300) {
      score -= 10;
      factors.push("High calorie density");
    }
  } else {
    missingCount++;
  }

  // Neutral anchoring for completely missing nutritional data
  if (evaluatedCount === 0) {
    score = 50;
    isNeutralBaseline = true;
    limitations.push("Nutritional data completely unavailable; neutral baseline assigned.");
  }

  return {
    score: clamp(score, 0, 100),
    factors,
    limitations,
    isNeutralBaseline,
    coverage: { evaluatedCount, missingCount, categoryFormat }
  };
};

/**
 * 3. Ingredient Score
 * Integrates Phase 3 additive and parsing analysis.
 */
const calculateIngredientScore = (product) => {
  let score = 100;
  const factors = [];
  const limitations = [];
  let isNeutralBaseline = false;

  const ingAnalysis = product.analysis?.ingredientAnalysis || analyzeIngredientProfile(product);

  if (ingAnalysis.parseStatus === 'EMPTY_INGREDIENTS') {
    isNeutralBaseline = true;
    return {
      score: 50,
      factors: [],
      limitations: ["Ingredient list unavailable; neutral baseline assigned."],
      isNeutralBaseline: true,
      coverage: { parseStatus: 'EMPTY_INGREDIENTS' }
    };
  }

  if (ingAnalysis.parseStatus === 'UNPARSED_TEXT_ONLY') {
    score -= 10;
    limitations.push("Raw ingredient text present but could not be structured into individual tokens.");
  }

  const additives = ingAnalysis.additives?.identifiedList || [];
  const cosmeticCount = ingAnalysis.additives?.cosmeticCount || 0;

  if (additives.length === 0) {
    factors.push("No listed food additives detected");
  } else if (additives.length <= 3) {
    score -= 10;
    factors.push(`Contains a few identified additives (${additives.length})`);
  } else {
    score -= 25;
    factors.push(`Contains multiple identified additives (${additives.length})`);
  }

  if (cosmeticCount > 0) {
    score -= 10;
    factors.push(`Contains ${cosmeticCount} cosmetic additive(s) (flavor enhancers, synthetic colors, or non-nutritive sweeteners)`);
  }

  const ingString = (product.ingredients?.rawText || (product.ingredients?.ingredients || []).join(' ')).toLowerCase();
  if (/\b(sugar|syrup|sucrose|invert sugar|high fructose|glucose)\b/i.test(ingString)) {
    score -= 15;
    factors.push("Contains added sugars or industrial syrups");
  }

  return {
    score: clamp(score, 0, 100),
    factors,
    limitations,
    isNeutralBaseline,
    coverage: {
      parseStatus: ingAnalysis.parseStatus,
      totalIngredients: ingAnalysis.totalIngredientCount,
      totalAdditives: additives.length
    }
  };
};

/**
 * 4. Processing Score
 * Integrates Phase 3 evidence-based NOVA classification.
 */
const calculateProcessingScore = (product) => {
  const novaResult = product.analysis?.processingAnalysis || classifyNova(product);
  const factors = [];
  const limitations = [];
  let score = config.processing.unknown; // 50
  let isNeutralBaseline = false;

  if (novaResult.novaGroup !== null) {
    score = config.processing[`nova${novaResult.novaGroup}`] || config.processing.unknown;
    factors.push(`Classified as NOVA ${novaResult.novaGroup} (${novaResult.sourceCertainty})`);
    if (novaResult.evidence?.corroborationScore > 0) {
      factors.push(`Evidence corroboration score: ${novaResult.evidence.corroborationScore}`);
    }
  } else {
    isNeutralBaseline = true;
    limitations.push("Processing classification (NOVA) incomplete or insufficient evidence");
    factors.push("Neutral baseline assigned due to insufficient processing evidence.");
  }

  return {
    score: clamp(score, 0, 100),
    factors,
    limitations,
    isNeutralBaseline,
    coverage: {
      novaGroup: novaResult.novaGroup,
      sourceCertainty: novaResult.sourceCertainty
    }
  };
};

/**
 * 5. Protein + Fibre Score
 */
const calculateProteinFiberScore = (product) => {
  let score = 50; // Neutral baseline start
  const tn = product.nutrition || {};
  const factors = [];
  const limitations = [];
  let evaluatedCount = 0;
  let isNeutralBaseline = false;

  const pfAnalysis = product.analysis?.nutritionAnalysis?.positiveNutrients;
  const proteinClaim = pfAnalysis?.fssaiClaims?.protein?.status;
  const fibreClaim = pfAnalysis?.fssaiClaims?.fibre?.status;

  if (isValidFiniteNumber(tn.protein)) {
    evaluatedCount++;
    if (proteinClaim === 'HIGH_PROTEIN_ELIGIBLE' || tn.protein >= 10) {
      score += 25;
      factors.push("High protein content");
    } else if (proteinClaim === 'SOURCE_OF_PROTEIN_ELIGIBLE' || tn.protein >= 5) {
      score += 15;
      factors.push("Good protein content");
    } else {
      factors.push("Low/modest protein content");
    }
  } else {
    limitations.push("Missing protein data");
  }

  if (isValidFiniteNumber(tn.fiber)) {
    evaluatedCount++;
    if (fibreClaim === 'HIGH_FIBRE_ELIGIBLE' || tn.fiber >= 6) {
      score += 25;
      factors.push("High fibre content");
    } else if (fibreClaim === 'SOURCE_OF_FIBRE_ELIGIBLE' || tn.fiber >= 3) {
      score += 15;
      factors.push("Good fibre content");
    } else {
      factors.push("Low/modest fibre content");
    }
  } else {
    limitations.push("Missing fibre data");
  }

  if (evaluatedCount === 0) {
    isNeutralBaseline = true;
  }

  return {
    score: clamp(score, 0, 100),
    factors,
    limitations,
    isNeutralBaseline,
    coverage: { evaluatedCount, missingCount: 2 - evaluatedCount }
  };
};

/**
 * 6. Preference Score & Allergen Hard Exclusion
 */
const calculatePreferenceScore = (product, prefs = {}) => {
  let score = 70; // Good neutral base
  const tn = product.nutrition || {};
  const factors = [];
  const limitations = [];
  let hardExclusionViolated = false;
  let hardExclusionReason = '';

  // Allergen Hard Exclusion Check
  if (prefs.avoidAllergens && Array.isArray(prefs.avoidAllergens) && prefs.avoidAllergens.length > 0) {
    const ing = product.ingredients || {};
    const productAllergens = (ing.allergens || []).map(a => a.toLowerCase());
    const declaredClasses = (product.analysis?.ingredientAnalysis?.allergens?.declaredAllergenClasses || []).map(a => a.toLowerCase());
    const combinedAllergens = [...new Set([...productAllergens, ...declaredClasses])];

    const rawText = (ing.rawText || (ing.ingredients || []).join(' ')).toLowerCase();

    for (const avoided of prefs.avoidAllergens) {
      const av = avoided.toLowerCase();
      const matchInClasses = combinedAllergens.some(a => a.includes(av));
      const matchInText = rawText.includes(av);

      if (matchInClasses || matchInText) {
        hardExclusionViolated = true;
        hardExclusionReason = `Contains avoided allergen: ${avoided}`;
        score = 0; // Hard exclusion
        factors.push(`HARD EXCLUSION: ${hardExclusionReason}`);
        break;
      }
    }
  }

  if (!hardExclusionViolated) {
    if (prefs.highProtein) {
      if (tn.protein != null && tn.protein >= 10) {
        score += 15;
        factors.push("Matches preference: High Protein");
      } else if (tn.protein != null && tn.protein < 5) {
        score -= 10;
        factors.push("Does not meet preference: High Protein");
      }
    }

    if (prefs.lowSugar) {
      if (tn.sugar != null && tn.sugar <= 5) {
        score += 15;
        factors.push("Matches preference: Low Sugar");
      } else if (tn.sugar != null && tn.sugar > 15) {
        score -= 10;
        factors.push("Does not meet preference: Low Sugar");
      }
    }
  }

  return {
    score: clamp(score, 0, 100),
    factors,
    limitations,
    hardExclusionViolated,
    hardExclusionReason
  };
};

const getCategory = (product) => {
  const categoryId = product.identity?.categoryId || product.catalog?.categoryId;
  return getCategoryFormat(categoryId);
};

/**
 * Main Deterministic Scoring Function
 * Strictly preserves weights: Nutrition 40%, Ingredients 20%, Processing 15%, Protein/Fibre 15%, Preferences 10%.
 */
const calculateSmartChoiceScore = (product, preferences = {}) => {
  const conf = calculateScoreConfidence(product);
  const category = getCategory(product);

  const nut = calculateNutritionScore(product, category);
  const ing = calculateIngredientScore(product);
  const proc = calculateProcessingScore(product);
  const pf = calculateProteinFiberScore(product);
  const pref = calculatePreferenceScore(product, preferences);

  // Exact statutory weights (0.40 / 0.20 / 0.15 / 0.15 / 0.10)
  const weightedSum = (
    nut.score * config.weights.nutrition +
    ing.score * config.weights.ingredients +
    proc.score * config.weights.processing +
    pf.score * config.weights.proteinFiber +
    pref.score * config.weights.preferences
  );

  let totalScore = Math.round(weightedSum);

  // Hard exclusion override: if allergen safety constraint is violated, score is 0
  if (pref.hardExclusionViolated) {
    totalScore = 0;
  }

  // Calculate Overall Data Completeness (0-100%)
  const rawNutr = product.nutrition || {};
  let nutrFilled = 0;
  ['calories', 'protein', 'sugar', 'saturatedFat', 'sodium', 'fiber'].forEach(f => {
    if (rawNutr[f] != null) nutrFilled++;
  });
  const nutrCompleteness = Math.round((nutrFilled / 6) * 100);
  const ingCompleteness = (product.ingredients?.rawText || (product.ingredients?.ingredients || []).length > 0) ? 100 : 0;
  const procCompleteness = (product.processing?.novaGroup || product.analysis?.processingAnalysis?.novaGroup) ? 100 : 0;
  
  const overallCompleteness = Math.round(
    nutrCompleteness * 0.50 +
    ingCompleteness * 0.30 +
    procCompleteness * 0.20
  );

  // Identify which components used neutral 50/100 baseline
  const neutralBaselinesApplied = [];
  if (nut.isNeutralBaseline) neutralBaselinesApplied.push('nutrition');
  if (ing.isNeutralBaseline) neutralBaselinesApplied.push('ingredients');
  if (proc.isNeutralBaseline) neutralBaselinesApplied.push('processing');
  if (pf.isNeutralBaseline) neutralBaselinesApplied.push('proteinFiber');

  const positiveFactors = [];
  const negativeFactors = [];
  const allFactors = [...nut.factors, ...ing.factors, ...proc.factors, ...pf.factors, ...pref.factors];

  allFactors.forEach(f => {
    const lf = f.toLowerCase();
    if (
      lf.includes('high sugar') ||
      lf.includes('high sodium') ||
      lf.includes('high saturated') ||
      lf.includes('added sugar') ||
      lf.includes('multiple identified additives') ||
      lf.includes('cosmetic additive') ||
      lf.includes('does not meet') ||
      lf.includes('hard exclusion')
    ) {
      negativeFactors.push(f);
    } else if (
      lf.includes('low sugar') ||
      lf.includes('low sodium') ||
      lf.includes('low saturated') ||
      lf.includes('good') ||
      lf.includes('high protein') ||
      lf.includes('high fibre') ||
      lf.includes('matches') ||
      lf.includes('no listed food additives') ||
      lf.includes('nova 1')
    ) {
      positiveFactors.push(f);
    }
  });

  const limitations = [...new Set([
    ...conf.missingFields.map(f => `Missing ${f} data`),
    ...nut.limitations, ...ing.limitations, ...proc.limitations, ...pf.limitations, ...pref.limitations
  ])];

  // Traceable explanation synthesis
  const explanation = pref.hardExclusionViolated
    ? `Product score is 0 due to safety exclusion (${pref.hardExclusionReason}).`
    : `Overall score of ${totalScore}/100 calculated from Nutrition (${Math.round(nut.score)}/100, 40% wt), Ingredients (${Math.round(ing.score)}/100, 20% wt), Processing (${Math.round(proc.score)}/100, 15% wt), Protein/Fibre (${Math.round(pf.score)}/100, 15% wt), and Preferences (${Math.round(pref.score)}/100, 10% wt). Completeness: ${overallCompleteness}%, Confidence: ${conf.confidence}% (${conf.level}).`;

  return {
    totalScore,
    breakdown: {
      nutrition: Math.round(nut.score),
      ingredients: Math.round(ing.score),
      processing: Math.round(proc.score),
      proteinFiber: Math.round(pf.score),
      preferences: Math.round(pref.score)
    },
    appliedWeights: { ...config.weights },
    confidence: {
      score: conf.confidence,
      level: conf.level
    },
    coverage: {
      overallCompleteness,
      neutralBaselinesApplied,
      nutritionCoverage: nut.coverage,
      ingredientCoverage: ing.coverage,
      processingCoverage: proc.coverage,
      proteinFiberCoverage: pf.coverage
    },
    positiveFactors: [...new Set(positiveFactors)],
    negativeFactors: [...new Set(negativeFactors)],
    limitations,
    explanation
  };
};

const getScoreForProduct = async (productId, preferences = {}) => {
  const product = await Product.findById(productId);
  if (!product) throw new Error("Product not found");
  return {
    product,
    ...calculateSmartChoiceScore(product, preferences)
  };
};

const getScoresForProducts = async (productIds, preferences = {}) => {
  const products = await Product.find({ _id: { $in: productIds } });
  return products.map(product => ({
    product,
    ...calculateSmartChoiceScore(product, preferences)
  }));
};

module.exports = {
  calculateSmartChoiceScore,
  calculateNutritionScore,
  calculateIngredientScore,
  calculateProcessingScore,
  calculateProteinFiberScore,
  calculatePreferenceScore,
  getScoreForProduct,
  getScoresForProducts
};