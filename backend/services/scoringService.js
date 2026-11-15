const config = require('../config/scoringConfig');
const { getCategoryFormat, NUTRITION_THRESHOLDS } = require('../config/analysisThresholds');
const { analyzeNutrition } = require('./nutritionAnalysisService');
const { analyzeIngredientProfile } = require('./ingredientParsingService');
const { classifyNova } = require('./novaAnalysisService');
const { evaluateCompletenessAndConfidence } = require('./dataCompletenessService');
const { isValidFiniteNumber, isNonNegativeFiniteNumber } = require('./validationUtils');
const { hasActivePreferences } = require('./preferenceService');
const Product = require('../models/Product');

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

/**
 * Authoritative normalized nutrient extraction across Catalog-500 and database schemas.
 */
const getNormalizedNutrition = (product) => {
  if (!product) return {};
  const p100 = product.nutrition_info?.per_100g || {};
  const nut = product.nutrition || {};
  return {
    calories: typeof nut.calories === 'number' ? nut.calories : (typeof nut.energyKcal === 'number' ? nut.energyKcal : (typeof p100.energy_kcal === 'number' ? p100.energy_kcal : null)),
    sugar: typeof nut.sugar === 'number' ? nut.sugar : (typeof nut.sugars === 'number' ? nut.sugars : (typeof p100.total_sugars_g === 'number' ? p100.total_sugars_g : null)),
    saturatedFat: typeof nut.saturatedFat === 'number' ? nut.saturatedFat : (typeof p100.saturated_fat_g === 'number' ? p100.saturated_fat_g : null),
    sodium: typeof nut.sodium === 'number' ? nut.sodium : (typeof p100.sodium_mg === 'number' ? p100.sodium_mg : null),
    protein: typeof nut.protein === 'number' ? nut.protein : (typeof p100.protein_g === 'number' ? p100.protein_g : null),
    fiber: typeof nut.fiber === 'number' ? nut.fiber : (typeof nut.dietaryFiber === 'number' ? nut.dietaryFiber : (typeof p100.dietary_fiber_g === 'number' ? p100.dietary_fiber_g : null)),
    fat: typeof nut.fat === 'number' ? nut.fat : (typeof p100.total_fat_g === 'number' ? p100.total_fat_g : null),
    carbohydrates: typeof nut.carbohydrates === 'number' ? nut.carbohydrates : (typeof p100.carbohydrates_g === 'number' ? p100.carbohydrates_g : null)
  };
};

/**
 * 1. Calculate Score Reliability / Confidence
 * Decoupled from product quality score. Measures evidence reliability:
 * Confidence = 0.45Nr + 0.35Ir + 0.20Pr
 * Nr = Nutrition Reliability (45%), Ir = Ingredient Reliability (35%), Pr = Processing Reliability (20%)
 */
const calculateScoreConfidence = (product) => {
  const missingFields = [];
  const rawNutr = getNormalizedNutrition(product);

  // A. Nutrition Reliability Nr (0-100 scale, 45% weight)
  const evaluatedNutrients = ['calories', 'protein', 'carbohydrates', 'sugar', 'fat', 'saturatedFat', 'sodium', 'fiber'];
  let nutrFilled = 0;
  evaluatedNutrients.forEach(n => {
    if (rawNutr[n] != null) nutrFilled++;
    else missingFields.push(`nutrition.${n}`);
  });

  const basis = product.nutrition?.basis || product.nutrition_info?.basis || 'PER_100G';
  const basisFactor = (basis === 'PER_100G' || basis === 'PER_100ML') ? 1.0 : (basis === 'PER_SERVING' ? 0.70 : 0.85);
  const nutritionReliability = Math.round((nutrFilled / 8.0) * basisFactor * 100);

  // B. Ingredient Reliability Ir (0-100 scale, 35% weight)
  const hasRawText = !!product.ingredients?.rawText || !!product.nutrition_info?.ingredients_text;
  const hasTokens = (product.ingredients?.ingredients && product.ingredients.ingredients.length > 0);
  const isVerifiedSource = product.ingredients?.verificationStatus === 'VERIFIED' ||
                           product.nutrition_info?.verification_status === 'VERIFIED' ||
                           product.dietary_classification?.verificationStatus === 'VERIFIED' ||
                           product.dietaryClassification?.verificationStatus === 'VERIFIED';

  let ingredientReliability = 0;
  if (hasTokens || (hasRawText && isVerifiedSource)) {
    ingredientReliability = 100;
  } else if (hasRawText) {
    ingredientReliability = 70;
  } else {
    ingredientReliability = 0;
    missingFields.push('ingredients');
  }

  // C. Processing Reliability Pr (0-100 scale, 20% weight)
  const hasNova = product.processing?.novaGroup != null ||
                  product.analysis?.processingAnalysis?.novaGroup != null ||
                  product.nutrition_info?.nova_group != null;
  const sourceCertainty = product.analysis?.processingAnalysis?.sourceCertainty ||
                          product.processing?.sourceCertainty ||
                          (hasNova ? 'SOURCE_REPORTED' : 'UNKNOWN');

  let processingReliability = 0;
  if (sourceCertainty === 'SOURCE_REPORTED' || (hasNova && isVerifiedSource)) {
    processingReliability = 100;
  } else if (sourceCertainty === 'INTERNALLY_ESTIMATED') {
    processingReliability = 75;
  } else if (hasNova) {
    processingReliability = 60;
  } else {
    processingReliability = 0;
    missingFields.push('processing.novaGroup');
  }

  // Authoritative Formula: Confidence = 0.45Nr + 0.35Ir + 0.20Pr
  const confidenceScore = clamp(
    Math.round(0.45 * nutritionReliability + 0.35 * ingredientReliability + 0.20 * processingReliability),
    0,
    100
  );

  let level = 'high';
  let label = 'High Confidence';
  if (confidenceScore < 60) {
    level = 'low';
    label = 'Low Confidence';
  } else if (confidenceScore < 80) {
    level = 'medium';
    label = 'Moderate Confidence';
  }

  return {
    score: confidenceScore,
    confidence: confidenceScore, // backward-compatible alias
    level,
    label,
    breakdown: {
      nutrition: nutritionReliability,
      ingredients: ingredientReliability,
      processing: processingReliability
    },
    weights: {
      nutrition: 0.45,
      ingredients: 0.35,
      processing: 0.20
    },
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
  const categoryFormat = (category && NUTRITION_THRESHOLDS[category]) 
    ? category 
    : getCategoryFormat(categoryId);
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
  const p100 = product.nutrition_info?.per_100g || {};
  const tn = product.nutrition || {};
  const proteinVal = tn.protein != null ? tn.protein : (typeof p100.protein_g === 'number' ? p100.protein_g : null);
  const fiberVal = tn.fiber != null ? tn.fiber : (typeof p100.dietary_fiber_g === 'number' ? p100.dietary_fiber_g : (typeof tn.dietaryFiber === 'number' ? tn.dietaryFiber : null));
  const factors = [];
  const limitations = [];
  let evaluatedCount = 0;
  let isNeutralBaseline = false;

  const categoryFormat = getCategoryFormat(product);

  // Infusions, Spices, and Cooking Oils have specific biological / consumption baselines
  if (categoryFormat === 'BEVERAGE_INFUSION') {
    factors.push("Beverage infusion (tea/coffee) evaluated on as-consumed infusion basis (<0.1g protein, 0g fiber per 100ml); spent dry leaf biomass is not consumed.");
    return {
      score: 50,
      factors,
      limitations,
      isNeutralBaseline: true,
      coverage: { evaluatedCount: 2, missingCount: 0 }
    };
  }

  if (categoryFormat === 'CONDIMENT_SPICE') {
    factors.push("Spices/condiments are consumed in small quantities (1-5g); unconsumed dry biomass does not represent a significant macronutrient source.");
    return {
      score: 50,
      factors,
      limitations,
      isNeutralBaseline: true,
      coverage: { evaluatedCount: 2, missingCount: 0 }
    };
  }

  if (categoryFormat === 'COOKING_OIL') {
    factors.push("Cooking oils and fats naturally contain 0g protein and 0g dietary fiber.");
    return {
      score: 50,
      factors,
      limitations,
      isNeutralBaseline: true,
      coverage: { evaluatedCount: 2, missingCount: 0 }
    };
  }

  const pfAnalysis = product.analysis?.nutritionAnalysis?.positiveNutrients;
  const proteinClaim = pfAnalysis?.fssaiClaims?.protein?.status;
  const fibreClaim = pfAnalysis?.fssaiClaims?.fibre?.status;

  if (isValidFiniteNumber(proteinVal)) {
    evaluatedCount++;
    if (proteinClaim === 'HIGH_PROTEIN_ELIGIBLE' || proteinVal >= 10) {
      score += 25;
      factors.push("High protein content");
    } else if (proteinClaim === 'SOURCE_OF_PROTEIN_ELIGIBLE' || proteinVal >= 5) {
      score += 15;
      factors.push("Good protein content");
    } else {
      factors.push("Low/modest protein content");
    }
  } else {
    limitations.push("Missing protein data");
  }

  if (isValidFiniteNumber(fiberVal)) {
    evaluatedCount++;
    if (fibreClaim === 'HIGH_FIBRE_ELIGIBLE' || fiberVal >= 6) {
      score += 25;
      factors.push("High fibre content");
    } else if (fibreClaim === 'SOURCE_OF_FIBRE_ELIGIBLE' || fiberVal >= 3) {
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
 * Evaluates individual compatibility with active user preferences on a 0 - 100 scale.
 * When no preferences are active: returns score = 0, factors = [].
 */
const calculatePreferenceScore = (product, prefs = {}) => {
  if (!prefs || !hasActivePreferences(prefs)) {
    return {
      score: 0,
      factors: [],
      limitations: [],
      hardExclusionViolated: false,
      hardExclusionReason: ''
    };
  }

  const recommendationService = require('./recommendationService');
  const evalResults = recommendationService.evaluatePreferences(product, prefs);

  if (!evalResults.isEligible) {
    const hardExclusionReason = evalResults.results.find(r => r.isHardConstraint && r.status === 'NO_MATCH')?.reason || 'Safety exclusion constraint violated';
    return {
      score: 0,
      factors: [`HARD EXCLUSION: ${hardExclusionReason}`],
      limitations: [hardExclusionReason],
      hardExclusionViolated: true,
      hardExclusionReason
    };
  }

  const score = recommendationService.calculatePersonalizedScore(evalResults);
  const factors = evalResults.results
    .filter(r => !r.isHardConstraint && r.status === 'MATCH')
    .map(r => r.reason);
  const limitations = evalResults.results
    .filter(r => r.status === 'UNKNOWN' || r.status === 'NO_MATCH')
    .map(r => r.reason);

  return {
    score: clamp(score, 0, 100),
    factors,
    limitations,
    hardExclusionViolated: false,
    hardExclusionReason: ''
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

  const hasActivePrefs = hasActivePreferences(preferences);

  // Exact statutory component contributions out of 40, 20, 15, 15, 10
  const nutContribution = Math.round(nut.score * config.weights.nutrition);
  const ingContribution = Math.round(ing.score * config.weights.ingredients);
  const procContribution = Math.round(proc.score * config.weights.processing);
  const pfContribution = Math.round(pf.score * config.weights.proteinFiber);
  const prefContribution = hasActivePrefs ? Math.round(pref.score * config.weights.preferences) : 0;

  let totalScore = Math.round(
    nut.score * config.weights.nutrition +
    ing.score * config.weights.ingredients +
    proc.score * config.weights.processing +
    pf.score * config.weights.proteinFiber +
    (hasActivePrefs ? pref.score * config.weights.preferences : 0)
  );

  // Hard exclusion override: if allergen safety constraint is violated, score is 0
  if (pref.hardExclusionViolated) {
    totalScore = 0;
  }

  // Calculate Overall Data Completeness (0-100%)
  const rawNutr = getNormalizedNutrition(product);
  let nutrFilled = 0;
  ['calories', 'protein', 'sugar', 'saturatedFat', 'sodium', 'fiber'].forEach(f => {
    if (rawNutr[f] != null) nutrFilled++;
  });
  const nutrCompleteness = Math.round((nutrFilled / 6) * 100);
  const ingCompleteness = (product.ingredients?.rawText || product.nutrition_info?.ingredients_text || (product.ingredients?.ingredients || []).length > 0) ? 100 : 0;
  const procCompleteness = (product.processing?.novaGroup != null || product.analysis?.processingAnalysis?.novaGroup != null || product.nutrition_info?.nova_group != null) ? 100 : 0;
  
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
    : `Overall score of ${totalScore}/100 calculated from Nutrition (${Math.round(nut.score)}/100, 40% wt), Ingredients (${Math.round(ing.score)}/100, 20% wt), Processing (${Math.round(proc.score)}/100, 15% wt), Protein/Fibre (${Math.round(pf.score)}/100, 15% wt), and Preferences (${hasActivePrefs ? Math.round(pref.score) : 0}/100, 10% wt). Completeness: ${overallCompleteness}%, Confidence: ${conf.confidence}% (${conf.level}).`;

  return {
    totalScore,
    breakdown: {
      nutrition: Math.round(nut.score),
      ingredients: Math.round(ing.score),
      processing: Math.round(proc.score),
      proteinFiber: Math.round(pf.score),
      proteinFibre: Math.round(pf.score),
      preferences: hasActivePrefs ? Math.round(pref.score) : 0
    },
    weightedBreakdown: {
      nutrition: nutContribution,
      ingredients: ingContribution,
      processing: procContribution,
      proteinFiber: pfContribution,
      proteinFibre: pfContribution,
      preferences: prefContribution
    },
    componentScores: {
      nutrition: Math.round(nut.score),
      ingredients: Math.round(ing.score),
      processing: Math.round(proc.score),
      proteinFiber: Math.round(pf.score),
      preferences: hasActivePrefs ? Math.round(pref.score) : 0
    },
    appliedWeights: { ...config.weights },
    confidence: {
      score: conf.score,
      confidence: conf.score,
      level: conf.level,
      label: conf.label,
      breakdown: conf.breakdown,
      weights: conf.weights
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
  let product = null;
  const isDbConnected = require('mongoose').connection.readyState === 1;

  if (isDbConnected) {
    try {
      if (typeof productId === 'string' && productId.match(/^[0-9a-fA-F]{24}$/)) {
        product = await Product.findById(productId).lean();
      }
      if (!product) {
        product = await Product.findOne({
          $or: [
            { 'catalog.productId': productId },
            { 'identity.barcode': productId },
            { _id: productId }
          ]
        }).lean();
      }
    } catch (dbErr) {
      console.warn("MongoDB query in getScoreForProduct failed:", dbErr.message);
    }
  }

  if (!product) {
    const catalogLoader = require('../utils/catalogLoader');
    product = catalogLoader.getProductById(productId);
  }

  if (!product) {
    if (!isDbConnected) {
      throw new Error("Database service is currently unavailable and product was not found in local catalogue");
    }
    throw new Error("Product not found");
  }

  return {
    product,
    ...calculateSmartChoiceScore(product, preferences)
  };
};

const getScoresForProducts = async (productIds = [], preferences = {}) => {
  let products = [];
  const isDbConnected = require('mongoose').connection.readyState === 1;

  if (isDbConnected && productIds.length > 0) {
    try {
      const objectIds = productIds.filter(id => typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/));
      const catalogIds = productIds.filter(id => typeof id === 'string' && !id.match(/^[0-9a-fA-F]{24}$/));
      const orClauses = [];
      if (objectIds.length > 0) orClauses.push({ _id: { $in: objectIds } });
      if (catalogIds.length > 0) orClauses.push({ 'catalog.productId': { $in: catalogIds } });
      if (orClauses.length > 0) {
        products = await Product.find({ $or: orClauses }).lean();
      }
    } catch (dbErr) {
      console.warn("MongoDB query in getScoresForProducts failed:", dbErr.message);
    }
  }

  if (products.length < productIds.length) {
    const catalogLoader = require('../utils/catalogLoader');
    const foundIds = new Set(products.map(p => (p._id ? p._id.toString() : p.catalog?.productId)));
    const missing = productIds.filter(id => !foundIds.has(String(id)));
    const diskItems = catalogLoader.getProductsByIds(missing);
    products = [...products, ...diskItems];
  }

  return products.map(product => ({
    product,
    ...calculateSmartChoiceScore(product, preferences)
  }));
};

const SCORING_WEIGHTS = {
  NUTRITION: 40,
  INGREDIENTS: 20,
  PROCESSING: 15,
  PROTEIN_FIBRE: 15,
  PREFERENCES: 10,
  nutrition: 0.40,
  ingredients: 0.20,
  processing: 0.15,
  proteinFiber: 0.15,
  proteinFibre: 0.15,
  preferences: 0.10
};

module.exports = {
  SCORING_WEIGHTS,
  calculateSmartChoiceScore,
  calculateScoreConfidence,
  calculateConfidence: calculateScoreConfidence,
  calculateNutritionScore,
  calculateIngredientScore,
  calculateProcessingScore,
  calculateProteinFiberScore,
  calculatePreferenceScore,
  getScoreForProduct,
  getScoresForProducts
};