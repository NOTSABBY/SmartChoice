/**
 * SmartChoice Client Nutritional Conversion & Serving-Size Utility
 * Mirrors backend nutritionConversion with identical mathematical precision.
 * Formula:
 * Solid: Per Serving = Per 100g * Serving Size (g) / 100
 * Liquid: Per Serving = Per 100ml * Serving Size (ml) / 100
 */

export function parseServingSize(servingSizeStr, categoryFormat = 'SOLID_FOOD') {
  if (!servingSizeStr || typeof servingSizeStr !== 'string') {
    const isLiquid = String(categoryFormat).toUpperCase().includes('BEVERAGE');
    return {
      value: isLiquid ? 200 : 30,
      unit: isLiquid ? 'ml' : 'g',
      displayStr: isLiquid ? '200 ml' : '30 g',
      isEstimated: true
    };
  }

  const str = servingSizeStr.trim();

  // 1. Look for explicit parenthesized measurement first: e.g. "(38 g)" in "1/10 package (38 g)"
  const parenMatch = str.match(/\(\s*(\d+(?:\.\d+)?)\s*(g|gm|gms|gram|grams|ml|m-l|milliliter|millilitres|l|liter|litres)\s*\)/i);
  if (parenMatch) {
    const rawVal = parseFloat(parenMatch[1]);
    const rawUnit = parenMatch[2].toLowerCase();
    const isLiter = rawUnit.startsWith('l') && !rawUnit.startsWith('ml');
    const isMl = rawUnit.includes('ml') || isLiter;
    return {
      value: isLiter ? rawVal * 1000 : rawVal,
      unit: isMl ? 'ml' : 'g',
      displayStr: `${isLiter ? rawVal * 1000 : rawVal} ${isMl ? 'ml' : 'g'}`,
      isEstimated: false
    };
  }

  // 2. Look for measure with unit, prioritizing tokens after words like "serving", "package", or standalone
  const unitRegex = /(\d+(?:\.\d+)?)\s*(g|gm|gms|gram|grams|ml|m-l|milliliter|millilitres|l|liter|litres)\b/gi;
  let match;
  let lastUnitMatch = null;
  while ((match = unitRegex.exec(str)) !== null) {
    lastUnitMatch = match;
  }

  if (lastUnitMatch) {
    const rawVal = parseFloat(lastUnitMatch[1]);
    const rawUnit = lastUnitMatch[2].toLowerCase();
    const isLiter = rawUnit.startsWith('l') && !rawUnit.startsWith('ml');
    const isMl = rawUnit.includes('ml') || isLiter;
    return {
      value: isLiter ? rawVal * 1000 : rawVal,
      unit: isMl ? 'ml' : 'g',
      displayStr: `${isLiter ? rawVal * 1000 : rawVal} ${isMl ? 'ml' : 'g'}`,
      isEstimated: false
    };
  }

  // 3. Standalone number without unit: avoid fractions like 1/10
  const cleanStr = str.replace(/\b\d+\s*\/\s*\d+\b/g, '');
  const numMatch = cleanStr.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) {
    const rawVal = parseFloat(numMatch[1]);
    const isLiquid = String(categoryFormat).toUpperCase().includes('BEVERAGE');
    return {
      value: rawVal,
      unit: isLiquid ? 'ml' : 'g',
      displayStr: `${rawVal} ${isLiquid ? 'ml' : 'g'}`,
      isEstimated: false
    };
  }

  // 4. Fallback default
  const isLiquid = String(categoryFormat).toUpperCase().includes('BEVERAGE');
  return {
    value: isLiquid ? 200 : 30,
    unit: isLiquid ? 'ml' : 'g',
    displayStr: isLiquid ? '200 ml' : '30 g',
    isEstimated: true
  };
}

export function calculateNutrientPerServing(per100Value, servingSizeValue) {
  if (per100Value == null || isNaN(per100Value)) return null;
  const multiplier = servingSizeValue / 100.0;
  return Number((per100Value * multiplier).toFixed(2));
}

/**
 * Extracts a normalized per100g dictionary from either a per100g object or full product record
 */
export function extractPer100g(input) {
  if (!input || typeof input !== 'object') return {};
  if (input.energy_kcal !== undefined || input.protein_g !== undefined) {
    return input;
  }
  if (input.nutrition_info?.per_100g) {
    return input.nutrition_info.per_100g;
  }
  if (input.nutrition) {
    return {
      energy_kcal: input.nutrition.calories ?? input.nutrition.energyKcal ?? null,
      protein_g: input.nutrition.protein ?? null,
      carbohydrates_g: input.nutrition.carbohydrates ?? null,
      total_sugars_g: input.nutrition.sugar ?? input.nutrition.sugars ?? null,
      added_sugars_g: input.nutrition.addedSugars ?? null,
      total_fat_g: input.nutrition.fat ?? null,
      saturated_fat_g: input.nutrition.saturatedFat ?? null,
      trans_fat_g: input.nutrition.transFat ?? 0,
      dietary_fiber_g: input.nutrition.fiber ?? input.nutrition.dietaryFiber ?? null,
      sodium_mg: input.nutrition.sodium ?? null
    };
  }
  return input;
}

/**
 * Computes complete per-serving nutritional breakdown from per-100g/ml object or product record.
 */
export function calculateAllNutrientsPerServing(productOrPer100g = {}, servingSizeStr = '', categoryFormat = 'SOLID_FOOD') {
  const isProduct = productOrPer100g && (productOrPer100g.nutrition_info || productOrPer100g.nutrition || productOrPer100g.product_id);
  const resolvedServingStr = servingSizeStr || (isProduct ? (productOrPer100g.nutrition_info?.serving_size || productOrPer100g.serving?.servingSize || productOrPer100g.packaging_size) : '') || '';
  const resolvedFormat = categoryFormat || (isProduct ? (productOrPer100g.categoryFormat || 'SOLID_FOOD') : 'SOLID_FOOD');
  const per100g = extractPer100g(productOrPer100g);

  const servingInfo = parseServingSize(resolvedServingStr, resolvedFormat);
  const multiplier = servingInfo.value / 100.0;

  const nutrients = [
    { key: 'energy_kcal', name: 'Energy', unit: 'kcal', precision: 1 },
    { key: 'protein_g', name: 'Protein', unit: 'g', precision: 2 },
    { key: 'carbohydrates_g', name: 'Carbohydrates', unit: 'g', precision: 2 },
    { key: 'total_sugars_g', name: 'Total Sugars', unit: 'g', precision: 2 },
    { key: 'added_sugars_g', name: 'Added Sugars', unit: 'g', precision: 2 },
    { key: 'total_fat_g', name: 'Total Fat', unit: 'g', precision: 2 },
    { key: 'saturated_fat_g', name: 'Saturated Fat', unit: 'g', precision: 2 },
    { key: 'trans_fat_g', name: 'Trans Fat', unit: 'g', precision: 2 },
    { key: 'dietary_fiber_g', name: 'Dietary Fibre', unit: 'g', precision: 2 },
    { key: 'sodium_mg', name: 'Sodium', unit: 'mg', precision: 1 }
  ];

  const perServing = {};
  nutrients.forEach(n => {
    const val100 = per100g[n.key];
    if (val100 != null && !isNaN(val100)) {
      const converted = val100 * multiplier;
      perServing[n.key] = Number(converted.toFixed(n.precision));
    } else {
      perServing[n.key] = null;
    }
  });

  return {
    servingSize: servingInfo.value,
    servingUnit: servingInfo.unit,
    servingDisplayStr: servingInfo.displayStr,
    servingLabel: servingInfo.displayStr,
    servingMultiplier: multiplier,
    isEstimated: servingInfo.isEstimated,
    per100g,
    perServing
  };
}
