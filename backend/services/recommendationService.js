const scoringConfig = require('../config/scoringConfig');
const scoringService = require('./scoringService');
const preferenceService = require('./preferenceService');
const { getCategoryFormat } = require('../config/analysisThresholds');

const MATCH = "MATCH";
const PARTIAL_MATCH = "PARTIAL_MATCH";
const NO_MATCH = "NO_MATCH";
const UNKNOWN = "UNKNOWN";

// Simple helper to match string subsets
const matchString = (target, query) => {
  if (!target) return false;
  return target.toLowerCase().includes(query.toLowerCase());
};

/**
 * Continuous Normalized Preference Evaluation
 * Evaluates each active preference on an independent 0 - 100 scale.
 */
const evaluatePreferences = (product, prefs) => {
  const results = [];
  let matchCount = 0;
  let partialMatchCount = 0;
  let noMatchCount = 0;
  let unknownCount = 0;
  let isEligible = true;

  const p100 = product.nutrition_info?.per_100g || {};
  const nut = product.nutrition || {};
  const tn = {
    calories: typeof nut.calories === 'number' ? nut.calories : (typeof nut.energyKcal === 'number' ? nut.energyKcal : (typeof p100.energy_kcal === 'number' ? p100.energy_kcal : null)),
    protein: typeof nut.protein === 'number' ? nut.protein : (typeof p100.protein_g === 'number' ? p100.protein_g : null),
    carbohydrates: typeof nut.carbohydrates === 'number' ? nut.carbohydrates : (typeof p100.carbohydrates_g === 'number' ? p100.carbohydrates_g : null),
    sugar: typeof nut.sugar === 'number' ? nut.sugar : (typeof nut.sugars === 'number' ? nut.sugars : (typeof p100.total_sugars_g === 'number' ? p100.total_sugars_g : null)),
    fat: typeof nut.fat === 'number' ? nut.fat : (typeof p100.total_fat_g === 'number' ? p100.total_fat_g : null),
    saturatedFat: typeof nut.saturatedFat === 'number' ? nut.saturatedFat : (typeof p100.saturated_fat_g === 'number' ? p100.saturated_fat_g : null),
    fiber: typeof nut.fiber === 'number' ? nut.fiber : (typeof nut.dietaryFiber === 'number' ? nut.dietaryFiber : (typeof p100.dietary_fiber_g === 'number' ? p100.dietary_fiber_g : null)),
    sodium: typeof nut.sodium === 'number' ? nut.sodium : (typeof p100.sodium_mg === 'number' ? p100.sodium_mg : null)
  };

  const ing = product.ingredients || {};
  const ident = product.identity || {};
  const categoryFormat = getCategoryFormat(product);
  const isLiquid = categoryFormat.includes('BEVERAGE');

  const pVal = typeof tn.protein === 'number' && tn.protein > 0 ? tn.protein : 0;
  const cVal = typeof tn.carbohydrates === 'number' && tn.carbohydrates > 0 ? tn.carbohydrates : 0;
  const fVal = typeof tn.fat === 'number' && tn.fat > 0 ? tn.fat : 0;
  const isPhysicallyImpossible = pVal > 100.0 || cVal > 100.0 || fVal > 100.0 || (pVal + cVal + fVal) > 115.0 || (tn.calories != null && tn.calories < 0);

  const declaredIngText = String(
    ing.rawText ||
    ing.text ||
    ing.rawIngredientsText ||
    product.nutrition_info?.ingredients_text ||
    product.ingredients_text ||
    (Array.isArray(ing.ingredients) ? ing.ingredients.map(i => typeof i === 'string' ? i : (i.name || i.text || '')).join(' ') : '') ||
    ''
  ).toLowerCase();

  // 1. Avoid Allergens (Hard Constraint)
  if (prefs.avoidAllergens && prefs.avoidAllergens.length > 0) {
    const productAllergens = [
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
    
    const ingredientsText = declaredIngText;
    let foundAllergen = false;
    let missingInfo = (productAllergens.length === 0 && ingredientsText.length === 0);

    for (const avoided of prefs.avoidAllergens) {
      const av = String(avoided).toLowerCase().trim();
      if (!av) continue;
      const matchInDeclared = productAllergens.some(a => a.includes(av) || av.includes(a));
      const matchInText = ingredientsText.includes(av);

      if (matchInDeclared || matchInText) {
        foundAllergen = true;
        results.push({
          preference: 'avoidAllergens',
          status: NO_MATCH,
          score: 0,
          reason: `Contains avoided allergen: ${avoided}`,
          isHardConstraint: true
        });
        isEligible = false;
        break;
      }
    }
    
    if (!foundAllergen) {
      if (missingInfo) {
        results.push({
          preference: 'avoidAllergens',
          status: UNKNOWN,
          score: 50,
          reason: 'Allergen and ingredient data are unavailable.',
          isHardConstraint: true
        });
        unknownCount++;
      } else {
        results.push({
          preference: 'avoidAllergens',
          status: MATCH,
          score: 100,
          reason: 'No avoided allergens detected in formulation.',
          isHardConstraint: true
        });
        matchCount++;
      }
    }
  }

  // 2. Avoid Ingredients / Excluded Ingredients (Hard Constraint)
  const avoidIngs = [...(prefs.avoidIngredients || []), ...(prefs.excludedIngredients || [])];
  if (avoidIngs.length > 0 && isEligible) {
    const productIngredients = (ing.ingredients || []).map(i => typeof i === 'string' ? i.toLowerCase() : String(i.name || '').toLowerCase());
    const ingredientsText = declaredIngText;
    let foundIngredient = false;
    let missingInfo = (productIngredients.length === 0 && ingredientsText.length === 0);

    for (const avoided of avoidIngs) {
      const av = String(avoided).toLowerCase().trim();
      if (!av) continue;
      const matchInList = productIngredients.some(i => i.includes(av));
      const matchInText = ingredientsText.includes(av);

      if (matchInList || matchInText) {
        foundIngredient = true;
        results.push({
          preference: 'avoidIngredients',
          status: NO_MATCH,
          score: 0,
          reason: `Contains excluded ingredient: ${avoided}`,
          isHardConstraint: true
        });
        isEligible = false;
        break;
      }
    }
    
    if (!foundIngredient) {
      if (missingInfo) {
        results.push({
          preference: 'avoidIngredients',
          status: UNKNOWN,
          score: 50,
          reason: 'Ingredient list is unavailable.',
          isHardConstraint: true
        });
        unknownCount++;
      } else {
        results.push({
          preference: 'avoidIngredients',
          status: MATCH,
          score: 100,
          reason: 'No excluded ingredients detected.',
          isHardConstraint: true
        });
        matchCount++;
      }
    }
  }

  // 3. High Protein
  if (prefs.highProtein) {
    if (isPhysicallyImpossible) {
      results.push({
        preference: 'highProtein',
        status: UNKNOWN,
        score: 15,
        declaredValue: 'Physically Invalid',
        reason: 'Nutritional declaration exceeds physical mass boundaries (>100g/100g); marked invalid.',
        isHardConstraint: false
      });
      unknownCount++;
    } else if (categoryFormat === 'BEVERAGE_INFUSION') {
      results.push({
        preference: 'highProtein',
        status: NO_MATCH,
        score: 0,
        declaredValue: '< 0.1g/100ml',
        reason: 'Brewed tea/coffee contains negligible protein (<0.1g/100ml); dry leaf biomass is not consumed.',
        isHardConstraint: false
      });
      noMatchCount++;
    } else if (categoryFormat === 'CONDIMENT_SPICE') {
      results.push({
        preference: 'highProtein',
        status: NO_MATCH,
        score: 0,
        declaredValue: tn.protein != null ? `${tn.protein}g/100g` : 'N/A',
        reason: 'Spices/seasonings are consumed in 1-5g pinches; not a significant dietary protein source.',
        isHardConstraint: false
      });
      noMatchCount++;
    } else if (categoryFormat === 'COOKING_OIL') {
      results.push({
        preference: 'highProtein',
        status: NO_MATCH,
        score: 0,
        declaredValue: '0g',
        reason: 'Cooking oils naturally contain 0g protein.',
        isHardConstraint: false
      });
      noMatchCount++;
    } else if (tn.protein != null) {
      let score = 0;
      if (isLiquid) {
        if (tn.protein >= 12.0) score = 100;
        else if (tn.protein >= 6.0) score = Math.round(90 + ((tn.protein - 6.0) / 6.0) * 10);
        else if (tn.protein >= 3.0) score = Math.round(60 + ((tn.protein - 3.0) / 3.0) * 30);
        else score = Math.round((tn.protein / 3.0) * 60);
      } else {
        if (tn.protein >= 45.0) score = 100;
        else if (tn.protein >= 20.0) score = Math.round(90 + ((tn.protein - 20.0) / 25.0) * 10);
        else if (tn.protein >= 10.0) score = Math.round(70 + ((tn.protein - 10.0) / 10.0) * 20);
        else if (tn.protein >= 5.0) score = Math.round(35 + ((tn.protein - 5.0) / 5.0) * 35);
        else score = Math.round((tn.protein / 5.0) * 35);
      }

      const status = score >= 75 ? MATCH : (score >= 35 ? PARTIAL_MATCH : NO_MATCH);
      if (status === MATCH) matchCount++;
      else if (status === PARTIAL_MATCH) partialMatchCount++;
      else noMatchCount++;

      results.push({
        preference: 'highProtein',
        status,
        score,
        declaredValue: `${tn.protein}g/${isLiquid ? '100ml' : '100g'}`,
        reason: score >= 75
          ? `High protein content (${tn.protein}g/${isLiquid ? '100ml' : '100g'}) meets preference.`
          : score >= 35
          ? `Moderate protein (${tn.protein}g/${isLiquid ? '100ml' : '100g'}), partially satisfies preference.`
          : `Low protein (${tn.protein}g/${isLiquid ? '100ml' : '100g'}), does not meet high-protein preference.`,
        isHardConstraint: false
      });
    } else {
      results.push({
        preference: 'highProtein',
        status: UNKNOWN,
        score: 40,
        declaredValue: 'Unavailable',
        reason: 'Protein data is unavailable.',
        isHardConstraint: false
      });
      unknownCount++;
    }
  }

  // 4. Low Calories
  if (prefs.lowCalories) {
    if (isPhysicallyImpossible) {
      results.push({
        preference: 'lowCalories',
        status: UNKNOWN,
        score: 15,
        declaredValue: 'Physically Invalid',
        reason: 'Nutritional declaration is physically impossible; marked invalid.',
        isHardConstraint: false
      });
      unknownCount++;
    } else {
      const cals = tn.calories != null ? tn.calories : tn.energyKcal;
      if (cals != null) {
        let score = 0;
        if (isLiquid) {
          if (cals <= 20) score = Math.round(100 - (cals / 20) * 10);
          else if (cals <= 60) score = Math.round(90 - ((cals - 20) / 40) * 30);
          else if (cals <= 120) score = Math.round(60 - ((cals - 60) / 60) * 40);
          else if (cals <= 180) score = Math.max(0, Math.round(20 - ((cals - 120) / 60) * 20));
          else score = 0;
        } else {
          if (cals <= 40) score = Math.round(100 - (cals / 40) * 10);
          else if (cals <= 120) score = Math.round(90 - ((cals - 40) / 80) * 20);
          else if (cals <= 250) score = Math.round(70 - ((cals - 120) / 130) * 35);
          else if (cals <= 400) score = Math.round(35 - ((cals - 250) / 150) * 25);
          else if (cals <= 500) score = Math.max(0, Math.round(10 - ((cals - 400) / 100) * 10));
          else score = 0;
        }

        const status = score >= 70 ? MATCH : (score >= 30 ? PARTIAL_MATCH : NO_MATCH);
        if (status === MATCH) matchCount++;
        else if (status === PARTIAL_MATCH) partialMatchCount++;
        else noMatchCount++;

        results.push({
          preference: 'lowCalories',
          status,
          score,
          declaredValue: `${cals} kcal/${isLiquid ? '100ml' : '100g'}`,
          reason: score >= 70
            ? `Low energy density (${cals} kcal/${isLiquid ? '100ml' : '100g'}) meets preference.`
            : score >= 30
            ? `Moderate energy density (${cals} kcal/${isLiquid ? '100ml' : '100g'}), partially satisfies preference.`
            : `High energy density (${cals} kcal/${isLiquid ? '100ml' : '100g'}), does not meet low-calorie preference.`,
          isHardConstraint: false
        });
      } else {
        results.push({
          preference: 'lowCalories',
          status: UNKNOWN,
          score: 40,
          declaredValue: 'Unavailable',
          reason: 'Calorie data is unavailable.',
          isHardConstraint: false
        });
        unknownCount++;
      }
    }
  }

  // 5. Low Sugar
  if (prefs.lowSugar) {
    if (tn.sugar != null) {
      let score = 0;
      if (isLiquid) {
        if (tn.sugar <= 1.0) score = Math.round(100 - (tn.sugar / 1.0) * 10);
        else if (tn.sugar <= 2.5) score = Math.round(90 - ((tn.sugar - 1.0) / 1.5) * 15);
        else if (tn.sugar <= 7.5) score = Math.round(75 - ((tn.sugar - 2.5) / 5.0) * 45);
        else if (tn.sugar <= 11.25) score = Math.max(0, Math.round(30 - ((tn.sugar - 7.5) / 3.75) * 30));
        else score = 0;
      } else {
        if (tn.sugar <= 2.5) score = Math.round(100 - (tn.sugar / 2.5) * 10);
        else if (tn.sugar <= 5.0) score = Math.round(90 - ((tn.sugar - 2.5) / 2.5) * 15);
        else if (tn.sugar <= 15.0) score = Math.round(75 - ((tn.sugar - 5.0) / 10.0) * 40);
        else if (tn.sugar <= 25.0) score = Math.max(0, Math.round(35 - ((tn.sugar - 15.0) / 10.0) * 35));
        else score = 0;
      }

      const status = score >= 75 ? MATCH : (score >= 40 ? PARTIAL_MATCH : NO_MATCH);
      if (status === MATCH) matchCount++;
      else if (status === PARTIAL_MATCH) partialMatchCount++;
      else noMatchCount++;

      results.push({
        preference: 'lowSugar',
        status,
        score,
        declaredValue: `${tn.sugar}g/100g`,
        reason: score >= 75
          ? `Low sugar content (${tn.sugar}g/100g) meets preference.`
          : score >= 40
          ? `Moderate sugar (${tn.sugar}g/100g), partially satisfies preference.`
          : `High sugar content (${tn.sugar}g/100g), does not meet low-sugar preference.`,
        isHardConstraint: false
      });
    } else {
      results.push({
        preference: 'lowSugar',
        status: UNKNOWN,
        score: 40,
        declaredValue: 'Unavailable',
        reason: 'Sugar data is unavailable.',
        isHardConstraint: false
      });
      unknownCount++;
    }
  }

  // 6. High Fiber
  if (prefs.highFiber) {
    if (categoryFormat === 'BEVERAGE_INFUSION' || categoryFormat === 'CONDIMENT_SPICE' || categoryFormat === 'COOKING_OIL') {
      results.push({
        preference: 'highFiber',
        status: NO_MATCH,
        score: 0,
        declaredValue: '0g',
        reason: 'Infusions, spices, and oils do not contribute meaningful dietary fibre.',
        isHardConstraint: false
      });
      noMatchCount++;
    } else if (tn.fiber != null) {
      let score = 0;
      if (tn.fiber >= 15.0) score = 100;
      else if (tn.fiber >= 8.0) score = Math.round(90 + ((tn.fiber - 8.0) / 7.0) * 10);
      else if (tn.fiber >= 6.0) score = Math.round(80 + ((tn.fiber - 6.0) / 2.0) * 10);
      else if (tn.fiber >= 3.0) score = Math.round(40 + ((tn.fiber - 3.0) / 3.0) * 40);
      else score = Math.round((tn.fiber / 3.0) * 40);

      const status = score >= 75 ? MATCH : (score >= 40 ? PARTIAL_MATCH : NO_MATCH);
      if (status === MATCH) matchCount++;
      else if (status === PARTIAL_MATCH) partialMatchCount++;
      else noMatchCount++;

      results.push({
        preference: 'highFiber',
        status,
        score,
        declaredValue: `${tn.fiber}g/100g`,
        reason: score >= 75
          ? `High fibre content (${tn.fiber}g/100g) meets preference.`
          : score >= 40
          ? `Source of fibre (${tn.fiber}g/100g), partially satisfies preference.`
          : `Low fibre (${tn.fiber}g/100g), does not meet high-fibre preference.`,
        isHardConstraint: false
      });
    } else {
      results.push({
        preference: 'highFiber',
        status: UNKNOWN,
        score: 40,
        declaredValue: 'Unavailable',
        reason: 'Fiber data is unavailable.',
        isHardConstraint: false
      });
      unknownCount++;
    }
  }

  // 7. Low Sodium
  if (prefs.lowSodium) {
    if (tn.sodium != null) {
      let score = 0;
      if (tn.sodium <= 40) score = Math.round(100 - (tn.sodium / 40) * 5);
      else if (tn.sodium <= 120) score = Math.round(95 - ((tn.sodium - 40) / 80) * 10);
      else if (tn.sodium <= 400) score = Math.round(85 - ((tn.sodium - 120) / 280) * 35);
      else if (tn.sodium <= 600) score = Math.round(50 - ((tn.sodium - 400) / 200) * 30);
      else if (tn.sodium <= 1000) score = Math.max(0, Math.round(20 - ((tn.sodium - 600) / 400) * 20));
      else score = 0;

      const status = score >= 75 ? MATCH : (score >= 40 ? PARTIAL_MATCH : NO_MATCH);
      if (status === MATCH) matchCount++;
      else if (status === PARTIAL_MATCH) partialMatchCount++;
      else noMatchCount++;

      results.push({
        preference: 'lowSodium',
        status,
        score,
        declaredValue: `${tn.sodium}mg/100g`,
        reason: score >= 75
          ? `Low sodium (${tn.sodium}mg/100g) meets preference.`
          : score >= 40
          ? `Moderate sodium (${tn.sodium}mg/100g), partially satisfies preference.`
          : `High sodium (${tn.sodium}mg/100g), does not meet low-sodium preference.`,
        isHardConstraint: false
      });
    } else {
      results.push({
        preference: 'lowSodium',
        status: UNKNOWN,
        score: 40,
        declaredValue: 'Unavailable',
        reason: 'Sodium data is unavailable.',
        isHardConstraint: false
      });
      unknownCount++;
    }
  }

  // 8. Low Saturated Fat
  if (prefs.lowSaturatedFat) {
    if (tn.saturatedFat != null) {
      let score = 0;
      if (tn.saturatedFat <= 0.5) score = Math.round(100 - (tn.saturatedFat / 0.5) * 5);
      else if (tn.saturatedFat <= 1.5) score = Math.round(95 - ((tn.saturatedFat - 0.5) / 1.0) * 10);
      else if (tn.saturatedFat <= 5.0) score = Math.round(85 - ((tn.saturatedFat - 1.5) / 3.5) * 40);
      else if (tn.saturatedFat <= 10.0) score = Math.max(0, Math.round(45 - ((tn.saturatedFat - 5.0) / 5.0) * 45));
      else score = 0;

      const status = score >= 75 ? MATCH : (score >= 40 ? PARTIAL_MATCH : NO_MATCH);
      if (status === MATCH) matchCount++;
      else if (status === PARTIAL_MATCH) partialMatchCount++;
      else noMatchCount++;

      results.push({
        preference: 'lowSaturatedFat',
        status,
        score,
        declaredValue: `${tn.saturatedFat}g/100g`,
        reason: score >= 75
          ? `Low saturated fat (${tn.saturatedFat}g/100g) meets preference.`
          : score >= 40
          ? `Moderate saturated fat (${tn.saturatedFat}g/100g), partially satisfies preference.`
          : `High saturated fat (${tn.saturatedFat}g/100g), does not meet preference.`,
        isHardConstraint: false
      });
    } else {
      results.push({
        preference: 'lowSaturatedFat',
        status: UNKNOWN,
        score: 40,
        declaredValue: 'Unavailable',
        reason: 'Saturated fat data is unavailable.',
        isHardConstraint: false
      });
      unknownCount++;
    }
  }

  // 8b. Low Fat
  if (prefs.lowFat) {
    if (tn.fat != null) {
      let score = 0;
      if (isLiquid) {
        if (tn.fat <= 0.75) score = Math.round(100 - (tn.fat / 0.75) * 5);
        else if (tn.fat <= 1.5) score = Math.round(95 - ((tn.fat - 0.75) / 0.75) * 10);
        else if (tn.fat <= 3.0) score = Math.round(85 - ((tn.fat - 1.5) / 1.5) * 35);
        else if (tn.fat <= 10.0) score = Math.max(0, Math.round(50 - ((tn.fat - 3.0) / 7.0) * 50));
        else score = 0;
      } else {
        if (tn.fat <= 1.5) score = Math.round(100 - (tn.fat / 1.5) * 5);
        else if (tn.fat <= 3.0) score = Math.round(95 - ((tn.fat - 1.5) / 1.5) * 10);
        else if (tn.fat <= 10.0) score = Math.round(85 - ((tn.fat - 3.0) / 7.0) * 35);
        else if (tn.fat <= 25.0) score = Math.max(0, Math.round(50 - ((tn.fat - 10.0) / 15.0) * 50));
        else score = 0;
      }

      const status = score >= 75 ? MATCH : (score >= 40 ? PARTIAL_MATCH : NO_MATCH);
      if (status === MATCH) matchCount++;
      else if (status === PARTIAL_MATCH) partialMatchCount++;
      else noMatchCount++;

      results.push({
        preference: 'lowFat',
        status,
        score,
        declaredValue: `${tn.fat}g/${isLiquid ? '100ml' : '100g'}`,
        reason: score >= 75
          ? `Low fat (${tn.fat}g/${isLiquid ? '100ml' : '100g'}) meets preference.`
          : score >= 40
          ? `Moderate fat (${tn.fat}g/${isLiquid ? '100ml' : '100g'}), partially satisfies preference.`
          : `High fat (${tn.fat}g/${isLiquid ? '100ml' : '100g'}), does not meet low-fat preference.`,
        isHardConstraint: false
      });
    } else {
      results.push({
        preference: 'lowFat',
        status: UNKNOWN,
        score: 40,
        declaredValue: 'Unavailable',
        reason: 'Fat data is unavailable.',
        isHardConstraint: false
      });
      unknownCount++;
    }
  }

  // 9. Vegetarian
  if (prefs.vegetarian) {
    const dc = product.dietary_classification || product.dietaryClassification;
    const dietaryType = String(dc?.status || ident.dietaryType || product.dietary_type || product.catalog?.dietaryType || '').toUpperCase();
    const isVeg = Boolean(dc ? (dc.status === 'VEGETARIAN' || dc.status === 'VEGAN' || dc.isVegetarian) : (dietaryType.includes('VEG') && !dietaryType.includes('NON')));
    const isNonVeg = Boolean(dc ? (dc.status === 'NON_VEGETARIAN' || dc.isNonVegetarian) : dietaryType.includes('NON'));
    if (isVeg) {
      results.push({
        preference: 'vegetarian',
        status: MATCH,
        score: 100,
        declaredValue: 'Vegetarian',
        reason: 'Verified vegetarian dietary profile.',
        isHardConstraint: false
      });
      matchCount++;
    } else if (isNonVeg) {
      results.push({
        preference: 'vegetarian',
        status: NO_MATCH,
        score: 0,
        declaredValue: 'Non-Vegetarian',
        reason: 'Non-vegetarian product formulation.',
        isHardConstraint: false
      });
      noMatchCount++;
    } else {
      results.push({
        preference: 'vegetarian',
        status: UNKNOWN,
        score: 40,
        declaredValue: 'Unspecified',
        reason: 'Vegetarian status cannot be verified from label.',
        isHardConstraint: false
      });
      unknownCount++;
    }
  }

  // 10. Vegan
  if (prefs.vegan) {
    const dc = product.dietary_classification || product.dietaryClassification;
    const labels = (product.processing?.labels || []).map(l => String(l).toLowerCase());
    const isExplicitVegan = Boolean(dc?.status === 'VEGAN' || dc?.isVegan || labels.some(l => l.includes('vegan')));
    const isNonVegan = Boolean(
      dc?.status === 'NON_VEGETARIAN' || 
      dc?.isNonVegetarian || 
      (dc && dc.status === 'VEGETARIAN' && !isExplicitVegan)
    );

    if (isExplicitVegan) {
      results.push({
        preference: 'vegan',
        status: MATCH,
        score: 100,
        declaredValue: 'Vegan',
        reason: 'Product is verified vegan.',
        isHardConstraint: false
      });
      matchCount++;
    } else if (isNonVegan) {
      results.push({
        preference: 'vegan',
        status: NO_MATCH,
        score: 0,
        declaredValue: 'Non-Vegan',
        reason: 'Contains animal derivatives, dairy, egg, or honey.',
        isHardConstraint: false
      });
      noMatchCount++;
    } else {
      results.push({
        preference: 'vegan',
        status: UNKNOWN,
        score: 40,
        declaredValue: 'Unverified',
        reason: 'Vegan certification cannot be verified.',
        isHardConstraint: false
      });
      unknownCount++;
    }
  }

  return {
    results,
    matchCount,
    partialMatchCount,
    noMatchCount,
    unknownCount,
    isEligible
  };
};

/**
 * Calculates Combined Personalized Match Score (0 - 100%)
 * Employs multi-preference synergy/penalty so that satisfying one goal
 * does not disguise substantially failing another.
 */
const calculatePersonalizedScore = (evalResults) => {
  if (!evalResults.isEligible) {
    return 0; // Hard allergen or ingredient exclusion forces Match Score to 0
  }

  const softEvals = evalResults.results.filter(r => !r.isHardConstraint);
  if (softEvals.length === 0) {
    return 100; // No active soft preferences specified, 100% compatible
  }

  const scores = softEvals.map(r => r.score);
  const N = scores.length;
  let score = 0;

  if (N === 1) {
    score = Math.round(scores[0]);
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

    score = Math.max(0, Math.min(100, Math.round(combined)));
  }

  return score;
};

const extractNutrient = (product, nutrientName) => {
  const p100 = product.nutrition_info?.per_100g || {};
  const nut = product.nutrition || {};
  
  switch (nutrientName) {
    case 'calories':
      return typeof nut.calories === 'number' ? nut.calories : (typeof nut.energyKcal === 'number' ? nut.energyKcal : (typeof p100.energy_kcal === 'number' ? p100.energy_kcal : null));
    case 'protein':
      return typeof nut.protein === 'number' ? nut.protein : (typeof p100.protein_g === 'number' ? p100.protein_g : null);
    case 'carbs':
      return typeof nut.carbohydrates === 'number' ? nut.carbohydrates : (typeof p100.carbohydrates_g === 'number' ? p100.carbohydrates_g : null);
    case 'sugar':
      return typeof nut.sugar === 'number' ? nut.sugar : (typeof nut.sugars === 'number' ? nut.sugars : (typeof p100.total_sugars_g === 'number' ? p100.total_sugars_g : null));
    case 'fat':
      return typeof nut.fat === 'number' ? nut.fat : (typeof p100.total_fat_g === 'number' ? p100.total_fat_g : null);
    case 'saturatedFat':
      return typeof nut.saturatedFat === 'number' ? nut.saturatedFat : (typeof p100.saturated_fat_g === 'number' ? p100.saturated_fat_g : null);
    case 'fiber':
      return typeof nut.fiber === 'number' ? nut.fiber : (typeof nut.dietaryFiber === 'number' ? nut.dietaryFiber : (typeof p100.dietary_fiber_g === 'number' ? p100.dietary_fiber_g : null));
    case 'sodium':
      return typeof nut.sodium === 'number' ? nut.sodium : (typeof p100.sodium_mg === 'number' ? p100.sodium_mg : null);
    default:
      return null;
  }
};

const getName = (p) => p.product_name || p.catalog?.productName || p.productName || p.identity?.name || '';

const singlePreferenceComparators = {
  highProtein: (a, b) => {
    const formatA = a.categoryFormat || getCategoryFormat(a);
    const formatB = b.categoryFormat || getCategoryFormat(b);
    const pa = formatA === 'BEVERAGE_INFUSION' || formatA === 'COOKING_OIL' ? 0 : (extractNutrient(a, 'protein') ?? 0);
    const pb = formatB === 'BEVERAGE_INFUSION' || formatB === 'COOKING_OIL' ? 0 : (extractNutrient(b, 'protein') ?? 0);
    if (pb !== pa) return pb - pa;
    const sa = a.smartChoiceScore ?? 75;
    const sb = b.smartChoiceScore ?? 75;
    if (sb !== sa) return sb - sa;
    return getName(a).localeCompare(getName(b));
  },
  lowCalories: (a, b) => {
    const ca = extractNutrient(a, 'calories') ?? 9999;
    const cb = extractNutrient(b, 'calories') ?? 9999;
    if (ca !== cb) return ca - cb;
    const sa = a.smartChoiceScore ?? 75;
    const sb = b.smartChoiceScore ?? 75;
    if (sb !== sa) return sb - sa;
    return getName(a).localeCompare(getName(b));
  },
  lowSugar: (a, b) => {
    const sa = extractNutrient(a, 'sugar') ?? 9999;
    const sb = extractNutrient(b, 'sugar') ?? 9999;
    if (sa !== sb) return sa - sb;
    const scoreA = a.smartChoiceScore ?? 75;
    const scoreB = b.smartChoiceScore ?? 75;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return getName(a).localeCompare(getName(b));
  },
  highFiber: (a, b) => {
    const formatA = a.categoryFormat || getCategoryFormat(a);
    const formatB = b.categoryFormat || getCategoryFormat(b);
    const fa = formatA === 'BEVERAGE_INFUSION' || formatA === 'CONDIMENT_SPICE' || formatA === 'COOKING_OIL' ? 0 : (extractNutrient(a, 'fiber') ?? 0);
    const fb = formatB === 'BEVERAGE_INFUSION' || formatB === 'CONDIMENT_SPICE' || formatB === 'COOKING_OIL' ? 0 : (extractNutrient(b, 'fiber') ?? 0);
    if (fb !== fa) return fb - fa;
    const sa = a.smartChoiceScore ?? 75;
    const sb = b.smartChoiceScore ?? 75;
    if (sb !== sa) return sb - sa;
    return getName(a).localeCompare(getName(b));
  },
  lowSodium: (a, b) => {
    const sa = extractNutrient(a, 'sodium') ?? 99999;
    const sb = extractNutrient(b, 'sodium') ?? 99999;
    if (sa !== sb) return sa - sb;
    const scoreA = a.smartChoiceScore ?? 75;
    const scoreB = b.smartChoiceScore ?? 75;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return getName(a).localeCompare(getName(b));
  },
  lowSaturatedFat: (a, b) => {
    const sa = extractNutrient(a, 'saturatedFat') ?? 9999;
    const sb = extractNutrient(b, 'saturatedFat') ?? 9999;
    if (sa !== sb) return sa - sb;
    const scoreA = a.smartChoiceScore ?? 75;
    const scoreB = b.smartChoiceScore ?? 75;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return getName(a).localeCompare(getName(b));
  },
  lowFat: (a, b) => {
    const fa = extractNutrient(a, 'fat') ?? 9999;
    const fb = extractNutrient(b, 'fat') ?? 9999;
    if (fa !== fb) return fa - fb;
    const scoreA = a.smartChoiceScore ?? 75;
    const scoreB = b.smartChoiceScore ?? 75;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return getName(a).localeCompare(getName(b));
  }
};

/**
 * Ranks products for personalized recommendations
 */
const rankProducts = async (products, rawPrefs = {}) => {
  const prefs = preferenceService.normalizePreferences(rawPrefs);
  const recommendations = [];

  const activeNutritionalPrefs = [];
  if (prefs.highProtein) activeNutritionalPrefs.push('highProtein');
  if (prefs.lowCalories) activeNutritionalPrefs.push('lowCalories');
  if (prefs.lowSugar) activeNutritionalPrefs.push('lowSugar');
  if (prefs.highFiber) activeNutritionalPrefs.push('highFiber');
  if (prefs.lowSodium) activeNutritionalPrefs.push('lowSodium');
  if (prefs.lowSaturatedFat) activeNutritionalPrefs.push('lowSaturatedFat');
  if (prefs.lowFat) activeNutritionalPrefs.push('lowFat');

  const hasLifestylePrefs = Boolean(prefs.vegetarian || prefs.vegan);
  const hasActiveSoftPrefs = activeNutritionalPrefs.length > 0 || hasLifestylePrefs;

  for (const product of products) {
    // 1. Get base SmartChoice Score (40% Nutrition, 20% Ingredients, 15% Processing, 15% Protein/Fiber, 10% Preferences)
    const scData = scoringService.calculateSmartChoiceScore(product, prefs);
    const smartChoiceScore = scData.totalScore;

    // 2. Evaluate Preferences (Match Score)
    const evalResults = evaluatePreferences(product, prefs);
    const matchScore = calculatePersonalizedScore(evalResults);
    
    // 3. Confidence Adjustment
    const totalEvals = evalResults.matchCount + evalResults.partialMatchCount + evalResults.noMatchCount + evalResults.unknownCount;
    const prefConfidencePenalty = totalEvals > 0 ? (evalResults.unknownCount / totalEvals) * 20 : 0;
    const confidenceScore = Math.max(0, Math.round(scData.confidence.score - prefConfidencePenalty));

    // 4. Final Ranking Score
    // When active preferences exist: Match Score is primary, SmartChoice Quality is secondary tie-breaker
    // When no preferences active: Pure SmartChoice Score
    let finalScore = 0;
    if (evalResults.isEligible) {
      if (hasActiveSoftPrefs) {
        finalScore = matchScore;
      } else {
        finalScore = smartChoiceScore;
      }
    }

    const positiveMatches = evalResults.results.filter(r => r.status === MATCH);
    const partialMatches = evalResults.results.filter(r => r.status === PARTIAL_MATCH);
    const unmetPreferences = evalResults.results.filter(r => r.status === NO_MATCH);
    const missingData = evalResults.results.filter(r => r.status === UNKNOWN);

    let matchExplanation = '';
    if (!evalResults.isEligible) {
      matchExplanation = 'Ineligible due to hard allergen or excluded ingredient constraint.';
    } else if (!hasActiveSoftPrefs) {
      matchExplanation = 'Ranked by overall SmartChoice nutritional quality (no active dietary preferences).';
    } else if (matchScore >= 75) {
      matchExplanation = `High compatibility with active preferences (${positiveMatches.map(m => m.preference).join(', ')}).`;
    } else if (matchScore >= 35) {
      const satisfiedList = [...positiveMatches, ...partialMatches].map(m => m.preference).join(', ');
      const unmetList = unmetPreferences.map(u => u.preference).join(', ');
      matchExplanation = `Partial compatibility: satisfies ${satisfiedList || 'some goals'}, but does not meet ${unmetList}.`;
    } else {
      matchExplanation = `Low compatibility: does not satisfy active nutritional preferences (${unmetPreferences.map(u => u.preference).join(', ')}).`;
    }

    recommendations.push({
      productId: product.product_id || (product._id ? product._id.toString() : (product.catalog?.productId || product.identity?.barcode || 'PRD')),
      productName: product.product_name || product.catalog?.productName || product.identity?.name || 'Unknown Product',
      brand: product.brand || product.catalog?.brand || product.identity?.brand || 'Brand',
      imageUrl: product.media?.imageUrl || (product.catalog?.images && (product.catalog.images.frontThumb || product.catalog.images[0])) || '',
      packagingSize: product.packaging_size || product.serving?.servingSize || product.catalog?.packagingSize || '',
      category: product.category_name || product.catalog?.categoryName || (product.identity?.categories && product.identity.categories[0]) || '',
      isEligible: evalResults.isEligible,
      smartChoiceScore,
      matchScore,
      finalScore,
      rawProduct: product,
      personalization: {
        score: matchScore,
        preferenceResults: evalResults.results,
        positiveMatches,
        partialMatches,
        unmetPreferences,
        missingData,
        matchCount: evalResults.matchCount,
        noMatchCount: evalResults.noMatchCount,
        unknownCount: evalResults.unknownCount,
        explanation: matchExplanation
      },
      positiveMatches,
      partialMatches,
      unmetPreferences,
      missingData,
      explanation: matchExplanation,
      confidence: {
        score: confidenceScore,
        level: confidenceScore >= 80 ? 'high' : confidenceScore >= 50 ? 'medium' : 'low'
      },
      positiveFactors: scData.positiveFactors,
      negativeFactors: scData.negativeFactors,
      limitations: scData.limitations
    });
  }

  // Deterministic Sorting
  if (activeNutritionalPrefs.length === 1 && !hasLifestylePrefs) {
    const singlePrefKey = activeNutritionalPrefs[0];
    recommendations.sort((a, b) => {
      // 1. Ineligible at the bottom
      if (a.isEligible !== b.isEligible) return a.isEligible ? -1 : 1;
      // 2. Strict single preference comparator (exact parity with individual sort)
      const pA = { ...a.rawProduct, smartChoiceScore: a.smartChoiceScore, productName: a.productName };
      const pB = { ...b.rawProduct, smartChoiceScore: b.smartChoiceScore, productName: b.productName };
      return singlePreferenceComparators[singlePrefKey](pA, pB);
    });
  } else {
    recommendations.sort((a, b) => {
      // 1. Ineligible at the bottom
      if (a.isEligible !== b.isEligible) return a.isEligible ? -1 : 1;
      // 2. Final Score descending (equals matchScore when prefs active, or smartChoiceScore when none)
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
      // 3. Match Score descending
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      // 4. Missing data count ascending (fewer unknowns preferred)
      if (a.missingData.length !== b.missingData.length) return a.missingData.length - b.missingData.length;
      // 5. SmartChoice Quality Score descending (secondary tie-breaker)
      if (b.smartChoiceScore !== a.smartChoiceScore) return b.smartChoiceScore - a.smartChoiceScore;
      // 6. Lexicographical by name ascending
      return a.productName.localeCompare(b.productName);
    });
  }

  return recommendations;
};

module.exports = {
  evaluatePreferences,
  calculatePersonalizedScore,
  rankProducts,
  singlePreferenceComparators,
  extractNutrient
};
