/**
 * SmartChoice Deterministic Product Scoring & Personalized Preference Matching
 * Mirrors backend scoring and recommendation algorithms with mathematical precision.
 */

// Format mapping for categories
export const CATEGORY_FORMATS = {
  1: 'SOLID_FOOD',         // Packaged Biscuits & Cookies
  2: 'SOLID_FOOD',         // Breakfast Cereals & Oats
  3: 'SOLID_FOOD',         // Instant Noodles & Pasta
  4: 'SOLID_FOOD',         // Chocolates & Confectionery
  5: 'BEVERAGE_GENERAL',   // Packaged Juices & Drinks
  6: 'SOLID_FOOD',         // Sauces, Ketchup & Dips
  7: 'SOLID_FOOD',         // Jams, Spreads & Honey
  8: 'SOLID_FOOD',         // Packaged Chips & Crisps
  9: 'BEVERAGE_INFUSION',  // Tea & Coffee Powders
  10: 'CONDIMENT_SPICE',   // Packaged Spices & Masalas
  11: 'COOKING_OIL',       // Cooking Oils & Ghee
  12: 'SOLID_FOOD',        // Ready-to-Eat Meals
  13: 'BEVERAGE_DAIRY',    // Packaged Dairy & Cheese
  14: 'BEVERAGE_GENERAL',  // Health & Energy Drinks
  15: 'SOLID_FOOD',        // Namkeen & Traditional Snacks
  16: 'CONDIMENT_SPICE',   // Pickles & Chutneys
  17: 'SOLID_FOOD',        // Packaged Atta, Flour & Dals
  18: 'SOLID_FOOD',        // Dry Fruits & Nuts (Packaged)
  19: 'SOLID_FOOD',        // Baking Ingredients & Cocoa
  20: 'SOLID_FOOD',        // Canned Foods & Soups
  21: 'SOLID_FOOD',        // Protein & Energy Bars
  22: 'SOLID_FOOD',        // Granola & Breakfast Bars
  23: 'BEVERAGE_GENERAL',  // Carbonated Soda & Mixers
  24: 'SOLID_FOOD',        // Custard & Dessert Mixes
  25: 'SOLID_FOOD'         // Frozen Snacks & Desserts
};

export function getProductCategoryFormat(product) {
  if (!product) return 'SOLID_FOOD';
  const catId = product.category_id || product.catalog?.categoryId || product.identity?.categoryId;
  if (catId && CATEGORY_FORMATS[catId]) return CATEGORY_FORMATS[catId];

  const catName = (product.category_name || product.catalog?.categoryName || (product.identity?.categories && product.identity.categories[0]) || product.product_name || '').toLowerCase();
  if (catName.includes('tea') || catName.includes('coffee') || catName.includes('infusion')) return 'BEVERAGE_INFUSION';
  if (catName.includes('spice') || catName.includes('masala') || catName.includes('chili') || catName.includes('pickle')) return 'CONDIMENT_SPICE';
  if (catName.includes('oil') || catName.includes('ghee')) return 'COOKING_OIL';
  if (catName.includes('juice') || catName.includes('drink') || catName.includes('soda') || catName.includes('beverage')) return 'BEVERAGE_GENERAL';
  if (catName.includes('milk') || catName.includes('dairy') || catName.includes('lassi')) return 'BEVERAGE_DAIRY';
  return 'SOLID_FOOD';
}

export function extractNutrient(product, nutrientName) {
  const p100 = product.nutrition_info?.per_100g || {};
  const nut = product.nutrition || {};
  
  switch (nutrientName) {
    case 'calories':
      return typeof p100.energy_kcal === 'number' ? p100.energy_kcal : (typeof nut.calories === 'number' ? nut.calories : (typeof nut.energyKcal === 'number' ? nut.energyKcal : null));
    case 'protein':
      return typeof p100.protein_g === 'number' ? p100.protein_g : (typeof nut.protein === 'number' ? nut.protein : null);
    case 'carbs':
      return typeof p100.carbohydrates_g === 'number' ? p100.carbohydrates_g : (typeof nut.carbohydrates === 'number' ? nut.carbohydrates : null);
    case 'sugar':
      return typeof p100.total_sugars_g === 'number' ? p100.total_sugars_g : (typeof nut.sugar === 'number' ? nut.sugar : (typeof nut.sugars === 'number' ? nut.sugars : null));
    case 'fat':
      return typeof p100.total_fat_g === 'number' ? p100.total_fat_g : (typeof nut.fat === 'number' ? nut.fat : null);
    case 'saturatedFat':
      return typeof p100.saturated_fat_g === 'number' ? p100.saturated_fat_g : (typeof nut.saturatedFat === 'number' ? nut.saturatedFat : null);
    case 'fiber':
      return typeof p100.dietary_fiber_g === 'number' ? p100.dietary_fiber_g : (typeof nut.fiber === 'number' ? nut.fiber : (typeof nut.dietaryFiber === 'number' ? nut.dietaryFiber : null));
    case 'sodium':
      return typeof p100.sodium_mg === 'number' ? p100.sodium_mg : (typeof nut.sodium === 'number' ? nut.sodium : null);
    default:
      return null;
  }
}

/**
 * Deterministic SmartChoice Product Quality Score (0 - 100)
 * Evaluates Nutrition (40%), Ingredients (20%), Processing (15%), Protein/Fibre (15%), Preferences (10%)
 * SC = 0.40N + 0.20I + 0.15P + 0.15PF + 0.10U
 */
export function calculateProductQualityScore(product, activePrefs = {}) {
  const hasPrefs = hasActivePreferences(activePrefs);

  // If backend precomputed score exists AND no active user preferences are selected, use it
  if (!hasPrefs) {
    if (product.score?.totalScore != null) return product.score.totalScore;
    if (product.analysis?.scoring?.totalScore != null) return product.analysis.scoring.totalScore;
  }

  const breakdown = calculateProductBreakdown(product, activePrefs);
  return breakdown.totalScore;
}

/**
 * Authoritative 5-Component Breakdown & Quality Score Calculation
 * SC = 0.40N + 0.20I + 0.15P + 0.15PF + 0.10U
 */
export function calculateProductBreakdown(product, activePrefs = {}) {
  const format = getProductCategoryFormat(product);
  const sugar = extractNutrient(product, 'sugar');
  const satFat = extractNutrient(product, 'saturatedFat');
  const sodium = extractNutrient(product, 'sodium');
  const protein = extractNutrient(product, 'protein');
  const fiber = extractNutrient(product, 'fiber');
  const nova = product.nutrition_info?.nova_group ?? product.processing?.novaGroup ?? 3;

  // 1. Nutrition Component (40% weight, 0-100 scale)
  let nutrScore = 100;
  if (format === 'COOKING_OIL') {
    if (satFat != null) {
      if (satFat > 35) nutrScore -= 40;
      else if (satFat > 15) nutrScore -= 20;
    }
  } else {
    const isLiquid = format.includes('BEVERAGE');
    const sugarThreshold = isLiquid ? 11.25 : 22.5;
    const satFatThreshold = isLiquid ? 2.5 : 5.0;
    const sodiumThreshold = isLiquid ? 300 : 600;

    if (sugar != null) {
      if (sugar > sugarThreshold) nutrScore -= 30;
      else if (sugar > (isLiquid ? 2.5 : 5.0)) nutrScore -= 15;
    }
    if (satFat != null) {
      if (satFat > satFatThreshold) nutrScore -= 25;
      else if (satFat > (isLiquid ? 0.75 : 1.5)) nutrScore -= 10;
    }
    if (sodium != null) {
      if (sodium > sodiumThreshold) nutrScore -= 25;
      else if (sodium > (isLiquid ? 60 : 120)) nutrScore -= 10;
    }
  }
  nutrScore = Math.max(0, Math.min(100, nutrScore));

  // 2. Ingredients Component (20% weight, 0-100 scale)
  let ingScore = 100;
  const ingredientsText = (product.nutrition_info?.ingredients_text || product.ingredients?.rawText || '').toLowerCase();
  if (ingredientsText) {
    if (/\b(sugar|syrup|sucrose|glucose|invert sugar)\b/i.test(ingredientsText)) ingScore -= 15;
    if (/\b(color|colour|flavour enhancer|preservative|ins\s*[0-9]{3})\b/i.test(ingredientsText)) ingScore -= 15;
  }
  ingScore = Math.max(0, Math.min(100, ingScore));

  // 3. Processing NOVA Component (15% weight, 0-100 scale)
  let procScore = 60;
  if (nova === 1) procScore = 100;
  else if (nova === 2) procScore = 80;
  else if (nova === 3) procScore = 60;
  else if (nova === 4) procScore = 30;

  // 4. Protein & Fibre Component (15% weight, 0-100 scale)
  let pfScore = 50;
  if (format === 'BEVERAGE_INFUSION' || format === 'CONDIMENT_SPICE' || format === 'COOKING_OIL') {
    pfScore = 50; // Neutral baseline for infusions and spices
  } else {
    if (protein != null) {
      if (protein >= 10) pfScore += 25;
      else if (protein >= 5) pfScore += 15;
    }
    if (fiber != null) {
      if (fiber >= 6) pfScore += 25;
      else if (fiber >= 3) pfScore += 15;
    }
    pfScore = Math.max(0, Math.min(100, pfScore));
  }

  // 5. User Preferences Component U (10% weight, 0-100 scale)
  let prefScore = 0;
  let isEligible = true;
  if (hasActivePreferences(activePrefs)) {
    const evalResult = evaluateProductPreferences(product, activePrefs);
    isEligible = evalResult.isEligible;
    prefScore = isEligible ? evalResult.matchScore : 0;
  }

  // Calculate weighted contributions
  const nutContribution = Math.round(nutrScore * 0.40);
  const ingContribution = Math.round(ingScore * 0.20);
  const procContribution = Math.round(procScore * 0.15);
  const pfContribution = Math.round(pfScore * 0.15);
  const prefContribution = Math.round(prefScore * 0.10);

  const rawSum = Math.round(
    nutrScore * 0.40 +
    ingScore * 0.20 +
    procScore * 0.15 +
    pfScore * 0.15 +
    prefScore * 0.10
  );

  const totalScore = !isEligible ? 0 : Math.max(0, Math.min(100, rawSum));

  return {
    totalScore,
    componentScores: {
      nutrition: nutrScore,
      ingredients: ingScore,
      processing: procScore,
      proteinFibre: pfScore,
      preferences: prefScore
    },
    weightedBreakdown: {
      nutrition: nutContribution,
      ingredients: ingContribution,
      processing: procContribution,
      proteinFibre: pfContribution,
      preferences: prefContribution
    },
    breakdown: {
      nutrition: nutContribution,
      ingredients: ingContribution,
      processing: procContribution,
      proteinFibre: pfContribution,
      preferences: prefContribution
    }
  };
}

/**
 * Authoritative Evidence-based Confidence Score (0 - 100)
 * Confidence = 0.45Nr + 0.35Ir + 0.20Pr
 * Nr = Nutrition Reliability (45%), Ir = Ingredient Reliability (35%), Pr = Processing Reliability (20%)
 */
export function calculateProductConfidence(product) {
  if (product.score?.confidence?.score != null && product.score?.confidence?.breakdown != null) {
    return product.score.confidence;
  }

  const evaluatedNutrients = ['calories', 'protein', 'carbs', 'sugar', 'fat', 'saturatedFat', 'sodium', 'fiber'];
  let nutrFilled = 0;
  evaluatedNutrients.forEach(n => {
    if (extractNutrient(product, n) != null) nutrFilled++;
  });

  const basis = product.nutrition?.basis || product.nutrition_info?.basis || 'PER_100G';
  const basisFactor = (basis === 'PER_100G' || basis === 'PER_100ML') ? 1.0 : (basis === 'PER_SERVING' ? 0.70 : 0.85);
  const nr = Math.round((nutrFilled / 8.0) * basisFactor * 100);

  const hasRawText = !!product.nutrition_info?.ingredients_text || !!product.ingredients?.rawText;
  const hasTokens = (product.ingredients?.ingredients && product.ingredients.ingredients.length > 0);
  const isVerified = product.ingredients?.verificationStatus === 'VERIFIED' ||
                     product.nutrition_info?.verification_status === 'VERIFIED' ||
                     product.dietary_classification?.verificationStatus === 'VERIFIED' ||
                     product.dietaryClassification?.verificationStatus === 'VERIFIED';

  const ir = (hasTokens || (hasRawText && isVerified)) ? 100 : (hasRawText ? 70 : 0);

  const hasNova = product.processing?.novaGroup != null || product.nutrition_info?.nova_group != null;
  const pr = (hasNova && isVerified) ? 100 : (hasNova ? 75 : 0);

  const score = Math.max(0, Math.min(100, Math.round(0.45 * nr + 0.35 * ir + 0.20 * pr)));
  const level = score >= 80 ? 'high' : (score >= 60 ? 'medium' : 'low');
  const label = score >= 80 ? 'High Confidence' : (score >= 60 ? 'Moderate Confidence' : 'Low Confidence');

  return {
    score,
    confidence: score,
    level,
    label,
    breakdown: {
      nutrition: nr,
      ingredients: ir,
      processing: pr
    },
    weights: {
      nutrition: 0.45,
      ingredients: 0.35,
      processing: 0.20
    },
    explanation: 'Evidence reliability based on Nutrition (45% wt), Ingredients (35% wt), and Processing (20% wt).'
  };
}

/**
 * Checks if the user has any active nutritional, dietary, or exclusion preferences
 */
export function hasActivePreferences(preferences = {}) {
  if (!preferences) return false;
  return Boolean(
    preferences.highProtein ||
    preferences.lowSugar ||
    preferences.lowCalories ||
    preferences.lowSaturatedFat ||
    preferences.lowSodium ||
    preferences.highFiber ||
    preferences.lowFat ||
    preferences.vegetarian ||
    preferences.vegan ||
    (preferences.avoidAllergens && preferences.avoidAllergens.length > 0) ||
    (preferences.excludedIngredients && preferences.excludedIngredients.length > 0) ||
    (preferences.avoidIngredients && preferences.avoidIngredients.length > 0)
  );
}

/**
 * Returns array of active nutritional goal keys
 */
export function getActiveNutritionalPreferences(preferences = {}) {
  const prefs = [];
  if (preferences.highProtein) prefs.push('highProtein');
  if (preferences.lowCalories) prefs.push('lowCalories');
  if (preferences.lowSugar) prefs.push('lowSugar');
  if (preferences.highFiber) prefs.push('highFiber');
  if (preferences.lowSodium) prefs.push('lowSodium');
  if (preferences.lowSaturatedFat) prefs.push('lowSaturatedFat');
  if (preferences.lowFat) prefs.push('lowFat');
  return prefs;
}

/**
 * Canonical Single-Preference Comparators
 * Shared identically between individual sorting options and single-preference SmartChoice Recommended.
 */
export const singlePreferenceComparators = {
  highProtein: (a, b) => {
    const formatA = a.format || getProductCategoryFormat(a);
    const formatB = b.format || getProductCategoryFormat(b);
    const pa = formatA === 'BEVERAGE_INFUSION' || formatA === 'COOKING_OIL' ? 0 : (extractNutrient(a, 'protein') ?? 0);
    const pb = formatB === 'BEVERAGE_INFUSION' || formatB === 'COOKING_OIL' ? 0 : (extractNutrient(b, 'protein') ?? 0);
    if (pb !== pa) return pb - pa;
    const sa = a.calculatedScore ?? a.smartChoiceScore ?? 75;
    const sb = b.calculatedScore ?? b.smartChoiceScore ?? 75;
    if (sb !== sa) return sb - sa;
    const na = a.product_name || a.catalog?.productName || a.productName || '';
    const nb = b.product_name || b.catalog?.productName || b.productName || '';
    return na.localeCompare(nb);
  },
  lowCalories: (a, b) => {
    const ca = extractNutrient(a, 'calories') ?? 9999;
    const cb = extractNutrient(b, 'calories') ?? 9999;
    if (ca !== cb) return ca - cb;
    const sa = a.calculatedScore ?? a.smartChoiceScore ?? 75;
    const sb = b.calculatedScore ?? b.smartChoiceScore ?? 75;
    if (sb !== sa) return sb - sa;
    const na = a.product_name || a.catalog?.productName || a.productName || '';
    const nb = b.product_name || b.catalog?.productName || b.productName || '';
    return na.localeCompare(nb);
  },
  lowSugar: (a, b) => {
    const sa = extractNutrient(a, 'sugar') ?? 9999;
    const sb = extractNutrient(b, 'sugar') ?? 9999;
    if (sa !== sb) return sa - sb;
    const scoreA = a.calculatedScore ?? a.smartChoiceScore ?? 75;
    const scoreB = b.calculatedScore ?? b.smartChoiceScore ?? 75;
    if (scoreB !== scoreA) return scoreB - scoreA;
    const na = a.product_name || a.catalog?.productName || a.productName || '';
    const nb = b.product_name || b.catalog?.productName || b.productName || '';
    return na.localeCompare(nb);
  },
  highFiber: (a, b) => {
    const formatA = a.format || getProductCategoryFormat(a);
    const formatB = b.format || getProductCategoryFormat(b);
    const fa = formatA === 'BEVERAGE_INFUSION' || formatA === 'CONDIMENT_SPICE' || formatA === 'COOKING_OIL' ? 0 : (extractNutrient(a, 'fiber') ?? 0);
    const fb = formatB === 'BEVERAGE_INFUSION' || formatB === 'CONDIMENT_SPICE' || formatB === 'COOKING_OIL' ? 0 : (extractNutrient(b, 'fiber') ?? 0);
    if (fb !== fa) return fb - fa;
    const sa = a.calculatedScore ?? a.smartChoiceScore ?? 75;
    const sb = b.calculatedScore ?? b.smartChoiceScore ?? 75;
    if (sb !== sa) return sb - sa;
    const na = a.product_name || a.catalog?.productName || a.productName || '';
    const nb = b.product_name || b.catalog?.productName || b.productName || '';
    return na.localeCompare(nb);
  },
  lowSodium: (a, b) => {
    const sa = extractNutrient(a, 'sodium') ?? 99999;
    const sb = extractNutrient(b, 'sodium') ?? 99999;
    if (sa !== sb) return sa - sb;
    const scoreA = a.calculatedScore ?? a.smartChoiceScore ?? 75;
    const scoreB = b.calculatedScore ?? b.smartChoiceScore ?? 75;
    if (scoreB !== scoreA) return scoreB - scoreA;
    const na = a.product_name || a.catalog?.productName || a.productName || '';
    const nb = b.product_name || b.catalog?.productName || b.productName || '';
    return na.localeCompare(nb);
  },
  lowSaturatedFat: (a, b) => {
    const sa = extractNutrient(a, 'saturatedFat') ?? 9999;
    const sb = extractNutrient(b, 'saturatedFat') ?? 9999;
    if (sa !== sb) return sa - sb;
    const scoreA = a.calculatedScore ?? a.smartChoiceScore ?? 75;
    const scoreB = b.calculatedScore ?? b.smartChoiceScore ?? 75;
    if (scoreB !== scoreA) return scoreB - scoreA;
    const na = a.product_name || a.catalog?.productName || a.productName || '';
    const nb = b.product_name || b.catalog?.productName || b.productName || '';
    return na.localeCompare(nb);
  },
  lowFat: (a, b) => {
    const fa = extractNutrient(a, 'fat') ?? 9999;
    const fb = extractNutrient(b, 'fat') ?? 9999;
    if (fa !== fb) return fa - fb;
    const scoreA = a.calculatedScore ?? a.smartChoiceScore ?? 75;
    const scoreB = b.calculatedScore ?? b.smartChoiceScore ?? 75;
    if (scoreB !== scoreA) return scoreB - scoreA;
    const na = a.product_name || a.catalog?.productName || a.productName || '';
    const nb = b.product_name || b.catalog?.productName || b.productName || '';
    return na.localeCompare(nb);
  }
};

/**
 * Continuous Normalized Preference Compatibility Evaluation (0 - 100 scale)
 * Evaluates active preferences independently and combines them with synergy/penalty for multi-preferences.
 */
export function evaluateProductPreferences(product, preferences = {}) {
  const format = getProductCategoryFormat(product);
  const protein = extractNutrient(product, 'protein');
  const calories = extractNutrient(product, 'calories');
  const sugar = extractNutrient(product, 'sugar');
  const fiber = extractNutrient(product, 'fiber');
  const sodium = extractNutrient(product, 'sodium');
  const satFat = extractNutrient(product, 'saturatedFat');

  const pVal = typeof protein === 'number' && protein > 0 ? protein : 0;
  const cVal = typeof extractNutrient(product, 'carbs') === 'number' ? extractNutrient(product, 'carbs') : 0;
  const fVal = typeof extractNutrient(product, 'fat') === 'number' ? extractNutrient(product, 'fat') : 0;
  const isPhysicallyImpossible = pVal > 100 || cVal > 100 || fVal > 100 || (pVal + cVal + fVal) > 115.0 || (calories != null && calories < 0);

  const evaluations = [];
  let isEligible = true;
  let hardExclusionReason = '';

  // 1. Hard Constraints: Avoid Allergens
  if (preferences.avoidAllergens && preferences.avoidAllergens.length > 0) {
    const ing = product.ingredients || {};
    const pAllergens = [
      ...(ing.allergens || []),
      ...(ing.allergenDeclarations?.contains || []),
      ...(ing.allergenDeclarations?.mayContain || []),
      ...(product.nutrition_info?.allergens || []),
      ...(product.nutrition_info?.may_contain || []),
      ...(product.analysis?.ingredientAnalysis?.allergens?.contains || []),
      ...(product.analysis?.ingredientAnalysis?.allergens?.mayContain || []),
      ...(product.analysis?.ingredientAnalysis?.allergens?.specificAllergens || []),
      ...(product.analysis?.ingredientAnalysis?.allergens?.declaredAllergenClasses || [])
    ].map(a => String(a).toLowerCase().trim());

    const ingText = String(
      product.declared_ingredients_text ||
      product.ingredients_text ||
      ing.rawText ||
      product.nutrition_info?.ingredients_text ||
      ''
    ).toLowerCase();
    
    for (const avoided of preferences.avoidAllergens) {
      const av = String(avoided).toLowerCase().trim();
      if (!av) continue;
      const inDeclared = pAllergens.some(a => a.includes(av) || av.includes(a));
      const inText = ingText.includes(av);
      if (inDeclared || inText) {
        isEligible = false;
        hardExclusionReason = `Contains avoided allergen: ${avoided}`;
        evaluations.push({
          preference: 'avoidAllergens',
          status: 'NO_MATCH',
          score: 0,
          reason: hardExclusionReason,
          isHardConstraint: true
        });
        break;
      }
    }
  }

  // 2. Hard Constraints: Excluded Ingredients
  const avoidIngs = [...(preferences.avoidIngredients || []), ...(preferences.excludedIngredients || [])];
  if (avoidIngs.length > 0 && isEligible) {
    const ing = product.ingredients || {};
    const productIngredients = (ing.ingredients || []).map(i => typeof i === 'string' ? i.toLowerCase() : String(i.name || '').toLowerCase());
    const ingText = String(
      product.declared_ingredients_text ||
      product.ingredients_text ||
      ing.rawText ||
      product.nutrition_info?.ingredients_text ||
      ''
    ).toLowerCase();

    for (const avoided of avoidIngs) {
      const av = String(avoided).toLowerCase().trim();
      if (!av) continue;
      const inDeclared = productIngredients.some(i => i.includes(av) || av.includes(i));
      const inText = ingText.includes(av);
      if (inDeclared || inText) {
        isEligible = false;
        hardExclusionReason = `Contains excluded ingredient: ${avoided}`;
        evaluations.push({
          preference: 'avoidIngredients',
          status: 'NO_MATCH',
          score: 0,
          reason: hardExclusionReason,
          isHardConstraint: true
        });
        break;
      }
    }
  }

  if (!isEligible) {
    return {
      matchScore: 0,
      isEligible: false,
      evaluations,
      positiveMatches: [],
      partialMatches: [],
      unmetPreferences: evaluations,
      unknownPreferences: [],
      explanation: hardExclusionReason
    };
  }

  // 3. High Protein
  if (preferences.highProtein) {
    if (isPhysicallyImpossible) {
      evaluations.push({
        preference: 'highProtein',
        status: 'INVALID',
        score: 15,
        declaredValue: 'Invalid Data',
        reason: 'Nutritional declaration exceeds physical mass boundaries (>100g/100g); marked invalid.'
      });
    } else if (format === 'BEVERAGE_INFUSION') {
      evaluations.push({
        preference: 'highProtein',
        status: 'NO_MATCH',
        score: 0,
        declaredValue: '< 0.1g',
        reason: 'Brewed tea/coffee contains negligible protein (<0.1g/100ml); spent leaves discarded.'
      });
    } else if (format === 'CONDIMENT_SPICE') {
      evaluations.push({
        preference: 'highProtein',
        status: 'NO_MATCH',
        score: 0,
        declaredValue: protein != null ? `${protein}g` : 'N/A',
        reason: 'Spices/seasonings are consumed in 1-5g pinches; not a dietary protein source.'
      });
    } else if (format === 'COOKING_OIL') {
      evaluations.push({
        preference: 'highProtein',
        status: 'NO_MATCH',
        score: 0,
        declaredValue: '0g',
        reason: 'Cooking oils naturally contain 0g protein.'
      });
    } else if (protein != null) {
      const isLiquid = format.includes('BEVERAGE');
      let score = 0;
      if (isLiquid) {
        if (protein >= 12.0) score = 100;
        else if (protein >= 6.0) score = Math.round(90 + ((protein - 6.0) / 6.0) * 10);
        else if (protein >= 3.0) score = Math.round(60 + ((protein - 3.0) / 3.0) * 30);
        else score = Math.round((protein / 3.0) * 60);
      } else {
        if (protein >= 45.0) score = 100;
        else if (protein >= 20.0) score = Math.round(90 + ((protein - 20.0) / 25.0) * 10);
        else if (protein >= 10.0) score = Math.round(70 + ((protein - 10.0) / 10.0) * 20);
        else if (protein >= 5.0) score = Math.round(35 + ((protein - 5.0) / 5.0) * 35);
        else score = Math.round((protein / 5.0) * 35);
      }
      evaluations.push({
        preference: 'highProtein',
        status: score >= 75 ? 'MATCH' : score >= 35 ? 'PARTIAL_MATCH' : 'NO_MATCH',
        score,
        declaredValue: `${protein}g/${isLiquid ? '100ml' : '100g'}`,
        reason: score >= 75 ? `High protein content (${protein}g)` : score >= 35 ? `Moderate protein (${protein}g)` : `Low protein (${protein}g)`
      });
    } else {
      evaluations.push({
        preference: 'highProtein',
        status: 'UNKNOWN',
        score: 40,
        declaredValue: 'Unavailable',
        reason: 'Protein information is unavailable.'
      });
    }
  }

  // 4. Low Calories
  if (preferences.lowCalories) {
    if (isPhysicallyImpossible) {
      evaluations.push({
        preference: 'lowCalories',
        status: 'INVALID',
        score: 15,
        declaredValue: 'Invalid Data',
        reason: 'Nutritional declaration is physically impossible; marked invalid.'
      });
    } else if (calories != null) {
      const isLiquid = format.includes('BEVERAGE');
      let score = 0;
      if (isLiquid) {
        if (calories <= 20) score = Math.round(100 - (calories / 20) * 10);
        else if (calories <= 60) score = Math.round(90 - ((calories - 20) / 40) * 30);
        else if (calories <= 120) score = Math.round(60 - ((calories - 60) / 60) * 40);
        else if (calories <= 180) score = Math.max(0, Math.round(20 - ((calories - 120) / 60) * 20));
        else score = 0;
      } else {
        if (calories <= 40) score = Math.round(100 - (calories / 40) * 10);
        else if (calories <= 120) score = Math.round(90 - ((calories - 40) / 80) * 20);
        else if (calories <= 250) score = Math.round(70 - ((calories - 120) / 130) * 35);
        else if (calories <= 400) score = Math.round(35 - ((calories - 250) / 150) * 25);
        else if (calories <= 500) score = Math.max(0, Math.round(10 - ((calories - 400) / 100) * 10));
        else score = 0;
      }
      evaluations.push({
        preference: 'lowCalories',
        status: score >= 70 ? 'MATCH' : score >= 30 ? 'PARTIAL_MATCH' : 'NO_MATCH',
        score,
        declaredValue: `${calories} kcal`,
        reason: score >= 70 ? `Low energy density (${calories} kcal)` : score >= 30 ? `Moderate energy density (${calories} kcal)` : `High energy density (${calories} kcal)`
      });
    } else {
      evaluations.push({
        preference: 'lowCalories',
        status: 'UNKNOWN',
        score: 40,
        declaredValue: 'Unavailable',
        reason: 'Calorie information is unavailable.'
      });
    }
  }

  // 5. Low Sugar
  if (preferences.lowSugar) {
    if (sugar != null) {
      const isLiquid = format.includes('BEVERAGE');
      let score = 0;
      if (isLiquid) {
        if (sugar <= 1.0) score = Math.round(100 - (sugar / 1.0) * 10);
        else if (sugar <= 2.5) score = Math.round(90 - ((sugar - 1.0) / 1.5) * 15);
        else if (sugar <= 7.5) score = Math.round(75 - ((sugar - 2.5) / 5.0) * 45);
        else if (sugar <= 11.25) score = Math.max(0, Math.round(30 - ((sugar - 7.5) / 3.75) * 30));
        else score = 0;
      } else {
        if (sugar <= 2.5) score = Math.round(100 - (sugar / 2.5) * 10);
        else if (sugar <= 5.0) score = Math.round(90 - ((sugar - 2.5) / 2.5) * 15);
        else if (sugar <= 15.0) score = Math.round(75 - ((sugar - 5.0) / 10.0) * 40);
        else if (sugar <= 25.0) score = Math.max(0, Math.round(35 - ((sugar - 15.0) / 10.0) * 35));
        else score = 0;
      }
      evaluations.push({
        preference: 'lowSugar',
        status: score >= 75 ? 'MATCH' : score >= 40 ? 'PARTIAL_MATCH' : 'NO_MATCH',
        score,
        declaredValue: `${sugar}g/100g`,
        reason: score >= 75 ? `Low sugar (${sugar}g)` : score >= 40 ? `Moderate sugar (${sugar}g)` : `High sugar (${sugar}g)`
      });
    } else {
      evaluations.push({
        preference: 'lowSugar',
        status: 'UNKNOWN',
        score: 40,
        declaredValue: 'Unavailable',
        reason: 'Sugar information is unavailable.'
      });
    }
  }

  // 6. High Fiber
  if (preferences.highFiber) {
    if (format === 'BEVERAGE_INFUSION' || format === 'CONDIMENT_SPICE' || format === 'COOKING_OIL') {
      evaluations.push({
        preference: 'highFiber',
        status: 'NO_MATCH',
        score: 0,
        declaredValue: '0g',
        reason: 'Infusions, spices, and oils do not contribute meaningful dietary fibre.'
      });
    } else if (fiber != null) {
      let score = 0;
      if (fiber >= 15.0) score = 100;
      else if (fiber >= 8.0) score = Math.round(90 + ((fiber - 8.0) / 7.0) * 10);
      else if (fiber >= 6.0) score = Math.round(80 + ((fiber - 6.0) / 2.0) * 10);
      else if (fiber >= 3.0) score = Math.round(40 + ((fiber - 3.0) / 3.0) * 40);
      else score = Math.round((fiber / 3.0) * 40);
      evaluations.push({
        preference: 'highFiber',
        status: score >= 75 ? 'MATCH' : score >= 40 ? 'PARTIAL_MATCH' : 'NO_MATCH',
        score,
        declaredValue: `${fiber}g/100g`,
        reason: score >= 75 ? `High fibre content (${fiber}g)` : score >= 40 ? `Source of fibre (${fiber}g)` : `Low fibre (${fiber}g)`
      });
    } else {
      evaluations.push({
        preference: 'highFiber',
        status: 'UNKNOWN',
        score: 40,
        declaredValue: 'Unavailable',
        reason: 'Fibre information is unavailable.'
      });
    }
  }

  // 7. Low Sodium
  if (preferences.lowSodium) {
    if (sodium != null) {
      let score = 0;
      if (sodium <= 40) score = Math.round(100 - (sodium / 40) * 5);
      else if (sodium <= 120) score = Math.round(95 - ((sodium - 40) / 80) * 10);
      else if (sodium <= 400) score = Math.round(85 - ((sodium - 120) / 280) * 35);
      else if (sodium <= 600) score = Math.round(50 - ((sodium - 400) / 200) * 30);
      else if (sodium <= 1000) score = Math.max(0, Math.round(20 - ((sodium - 600) / 400) * 20));
      else score = 0;
      evaluations.push({
        preference: 'lowSodium',
        status: score >= 75 ? 'MATCH' : score >= 40 ? 'PARTIAL_MATCH' : 'NO_MATCH',
        score,
        declaredValue: `${sodium}mg`,
        reason: score >= 75 ? `Low sodium (${sodium}mg)` : score >= 40 ? `Moderate sodium (${sodium}mg)` : `High sodium (${sodium}mg)`
      });
    } else {
      evaluations.push({
        preference: 'lowSodium',
        status: 'UNKNOWN',
        score: 40,
        declaredValue: 'Unavailable',
        reason: 'Sodium information is unavailable.'
      });
    }
  }

  // 8. Low Saturated Fat
  if (preferences.lowSaturatedFat) {
    if (satFat != null) {
      let score = 0;
      if (satFat <= 0.5) score = Math.round(100 - (satFat / 0.5) * 5);
      else if (satFat <= 1.5) score = Math.round(95 - ((satFat - 0.5) / 1.0) * 10);
      else if (satFat <= 5.0) score = Math.round(85 - ((satFat - 1.5) / 3.5) * 40);
      else if (satFat <= 10.0) score = Math.max(0, Math.round(45 - ((satFat - 5.0) / 5.0) * 45));
      else score = 0;
      evaluations.push({
        preference: 'lowSaturatedFat',
        status: score >= 75 ? 'MATCH' : score >= 40 ? 'PARTIAL_MATCH' : 'NO_MATCH',
        score,
        declaredValue: `${satFat}g/100g`,
        reason: score >= 75 ? `Low saturated fat (${satFat}g)` : score >= 40 ? `Moderate saturated fat (${satFat}g)` : `High saturated fat (${satFat}g)`
      });
    } else {
      evaluations.push({
        preference: 'lowSaturatedFat',
        status: 'UNKNOWN',
        score: 40,
        declaredValue: 'Unavailable',
        reason: 'Saturated fat information is unavailable.'
      });
    }
  }

  // 8b. Low Fat
  if (preferences.lowFat) {
    const fat = extractNutrient(product, 'fat');
    if (fat != null) {
      const isLiquid = format.includes('BEVERAGE');
      let score = 0;
      if (isLiquid) {
        if (fat <= 0.75) score = Math.round(100 - (fat / 0.75) * 5);
        else if (fat <= 1.5) score = Math.round(95 - ((fat - 0.75) / 0.75) * 10);
        else if (fat <= 3.0) score = Math.round(85 - ((fat - 1.5) / 1.5) * 35);
        else if (fat <= 10.0) score = Math.max(0, Math.round(50 - ((fat - 3.0) / 7.0) * 50));
        else score = 0;
      } else {
        if (fat <= 1.5) score = Math.round(100 - (fat / 1.5) * 5);
        else if (fat <= 3.0) score = Math.round(95 - ((fat - 1.5) / 1.5) * 10);
        else if (fat <= 10.0) score = Math.round(85 - ((fat - 3.0) / 7.0) * 35);
        else if (fat <= 25.0) score = Math.max(0, Math.round(50 - ((fat - 10.0) / 15.0) * 50));
        else score = 0;
      }
      evaluations.push({
        preference: 'lowFat',
        status: score >= 75 ? 'MATCH' : score >= 40 ? 'PARTIAL_MATCH' : 'NO_MATCH',
        score,
        declaredValue: `${fat}g/${isLiquid ? '100ml' : '100g'}`,
        reason: score >= 75 ? `Low fat (${fat}g)` : score >= 40 ? `Moderate fat (${fat}g)` : `High fat (${fat}g)`
      });
    } else {
      evaluations.push({
        preference: 'lowFat',
        status: 'UNKNOWN',
        score: 40,
        declaredValue: 'Unavailable',
        reason: 'Fat information is unavailable.'
      });
    }
  }

  // 9. Vegetarian
  if (preferences.vegetarian) {
    const dc = product.dietary_classification || product.dietaryClassification;
    const dietaryType = String(dc?.status || product.dietary_type || product.catalog?.dietaryType || '').toUpperCase();
    const isVeg = Boolean(dc ? (dc.status === 'VEGETARIAN' || dc.status === 'VEGAN' || dc.isVegetarian) : (dietaryType.includes('VEG') && !dietaryType.includes('NON')));
    const isNonVeg = Boolean(dc ? (dc.status === 'NON_VEGETARIAN' || dc.isNonVegetarian) : dietaryType.includes('NON'));

    if (isVeg) {
      evaluations.push({
        preference: 'vegetarian',
        status: 'MATCH',
        score: 100,
        declaredValue: 'Vegetarian',
        reason: 'Verified vegetarian dietary profile'
      });
    } else if (isNonVeg) {
      evaluations.push({
        preference: 'vegetarian',
        status: 'NO_MATCH',
        score: 0,
        declaredValue: 'Non-Vegetarian',
        reason: 'Non-vegetarian product formulation'
      });
    } else {
      evaluations.push({
        preference: 'vegetarian',
        status: 'UNKNOWN',
        score: 40,
        declaredValue: 'Unverified',
        reason: 'Vegetarian status cannot be verified from label'
      });
    }
  }

  // 10. Vegan
  if (preferences.vegan) {
    const dc = product.dietary_classification || product.dietaryClassification;
    const labels = (product.processing?.labels || []).map(l => String(l).toLowerCase());
    const isExplicitVegan = Boolean(dc?.status === 'VEGAN' || dc?.isVegan || labels.some(l => l.includes('vegan')));
    const isNonVegan = Boolean(
      dc?.status === 'NON_VEGETARIAN' || 
      dc?.isNonVegetarian || 
      (dc && dc.status === 'VEGETARIAN' && !isExplicitVegan)
    );

    if (isExplicitVegan) {
      evaluations.push({
        preference: 'vegan',
        status: 'MATCH',
        score: 100,
        declaredValue: 'Vegan',
        reason: 'Verified vegan plant-based product'
      });
    } else if (isNonVegan) {
      evaluations.push({
        preference: 'vegan',
        status: 'NO_MATCH',
        score: 0,
        declaredValue: 'Non-Vegan',
        reason: 'Contains animal derivatives, dairy, egg, or honey'
      });
    } else {
      evaluations.push({
        preference: 'vegan',
        status: 'UNKNOWN',
        score: 40,
        declaredValue: 'Unverified',
        reason: 'Vegan status cannot be verified from label'
      });
    }
  }

  // Combine Active Soft Preferences
  const softEvals = evaluations.filter(e => !e.isHardConstraint);
  if (softEvals.length === 0) {
    return {
      matchScore: 100, // Neutral full match when no preferences selected
      isEligible: true,
      evaluations: [],
      positiveMatches: [],
      partialMatches: [],
      unmetPreferences: [],
      unknownPreferences: [],
      explanation: 'No active nutritional preferences specified.'
    };
  }

  const scores = softEvals.map(e => e.score);
  const N = scores.length;
  let matchScore = 0;

  if (N === 0) {
    matchScore = isEligible ? 100 : 0;
  } else if (N === 1) {
    matchScore = Math.round(scores[0]);
  } else {
    const avg = scores.reduce((sum, s) => sum + s, 0) / N;
    const min = Math.min(...scores);
    const zeroCount = scores.filter(s => s === 0).length;

    // Base synergy: 65% average + 35% minimum-score constraint
    let combined = 0.65 * avg + 0.35 * min;

    // Critical Failure Guard: Prevents dilution anomaly when a product fails one goal
    if (min === 0) {
      const cap = Math.max(15, 30 - (zeroCount - 1) * 10);
      combined = Math.min(combined, cap);
    } else if (min < 35) {
      const cap = 40 + (min / 35) * 15;
      combined = Math.min(combined, cap);
    }

    matchScore = Math.max(0, Math.min(100, Math.round(combined)));
  }

  const positiveMatches = softEvals.filter(e => e.status === 'MATCH');
  const partialMatches = softEvals.filter(e => e.status === 'PARTIAL_MATCH');
  const unmetPreferences = softEvals.filter(e => e.status === 'NO_MATCH');
  const unknownPreferences = softEvals.filter(e => e.status === 'UNKNOWN');

  let explanation = '';
  if (matchScore >= 75) {
    explanation = `High compatibility with active preferences (${positiveMatches.map(m => m.preference).join(', ')}).`;
  } else if (matchScore >= 40) {
    const unmetNames = unmetPreferences.map(u => u.preference).join(', ');
    explanation = `Partial compatibility: satisfies ${positiveMatches.map(m => m.preference).join(', ') || 'some goals'}, but does not satisfy ${unmetNames}.`;
  } else {
    explanation = `Low compatibility: does not meet active goals (${unmetPreferences.map(u => u.preference).join(', ')}).`;
  }

  return {
    matchScore,
    isEligible: true,
    evaluations,
    positiveMatches,
    partialMatches,
    unmetPreferences,
    unknownPreferences,
    explanation
  };
}
