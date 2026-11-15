const UserPreference = require('../models/UserPreference');

const getDefaultPreferences = () => {
  return {
    highProtein: false,
    lowSugar: false,
    lowCalories: false,
    lowSaturatedFat: false,
    lowSodium: false,
    highFiber: false,
    lowFat: false,
    vegetarian: false,
    vegan: false,
    avoidAllergens: [],
    avoidIngredients: [],
    preferredCategories: [],
    excludedCategories: [],
    preferredBrands: [],
    excludedBrands: [],
    maxCalories: null,
    maxSugar: null,
    minProtein: null,
    minFiber: null
  };
};

const normalizeArray = (arr, type = 'general') => {
  if (!arr) return [];
  let rawItems = [];
  if (Array.isArray(arr)) {
    rawItems = arr;
  } else if (typeof arr === 'string') {
    rawItems = arr.split(',');
  } else {
    return [];
  }

  const result = [];
  const seen = new Set();

  for (const item of rawItems) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim().toLowerCase();
    if (!trimmed || trimmed.length < 2 || trimmed.length > 100) continue;

    let canonical = trimmed;
    if (type === 'allergen') {
      if (/^(peanut|peanuts|groundnut|groundnuts)$/.test(trimmed)) canonical = 'peanuts';
      else if (/^(tree\s*nuts?|treenuts?|nuts?)$/.test(trimmed)) canonical = 'tree nuts';
      else if (/^(milk|dairy|lactose)$/.test(trimmed)) canonical = 'milk';
      else if (/^(soya|soy|soybean)$/.test(trimmed)) canonical = 'soy';
      else if (/^(wheat|atta|maida|gluten)$/.test(trimmed)) canonical = 'gluten';
      else if (/^(egg|eggs)$/.test(trimmed)) canonical = 'egg';
      else if (/^(crustacean|crustaceans|shrimp|prawn|prawns|crab|lobster|shellfish)$/.test(trimmed)) canonical = 'crustaceans';
      else if (/^(sulphite|sulphites|sulfite|sulfites)$/.test(trimmed)) canonical = 'sulphites';
    } else if (type === 'ingredient') {
      if (/^(palm\s*oil|palmate|palmitate|rbd\s*palm\s*oil)$/.test(trimmed)) canonical = 'palm oil';
      else if (/^(msg|monosodium\s*glutamate|ins\s*621|e621)$/.test(trimmed)) canonical = 'MSG';
      else if (/^(artificial\s*colou?rs?|synthetic\s*colou?rs?|tartrazine|sunset\s*yellow)$/.test(trimmed)) canonical = 'artificial colour';
      else if (/^(hfcs|high\s*fructose\s*corn\s*syrup)$/.test(trimmed)) canonical = 'high fructose corn syrup';
      else if (/^(preservatives?|sodium\s*benzoate|potassium\s*sorbate|ins\s*211)$/.test(trimmed)) canonical = 'preservatives';
    }

    if (!seen.has(canonical.toLowerCase())) {
      seen.add(canonical.toLowerCase());
      result.push(canonical);
    }
  }

  return result;
};

const normalizePreferences = (input = {}) => {
  const defaults = getDefaultPreferences();
  
  const avoidAllergens = normalizeArray([...(input.avoidAllergens || []), ...(input.allergens || [])], 'allergen');
  const excludedIngredients = normalizeArray([...(input.avoidIngredients || []), ...(input.excludedIngredients || [])], 'ingredient');

  return {
    highProtein: Boolean(input.highProtein ?? defaults.highProtein),
    lowSugar: Boolean(input.lowSugar ?? defaults.lowSugar),
    lowCalories: Boolean(input.lowCalories ?? defaults.lowCalories),
    lowSaturatedFat: Boolean(input.lowSaturatedFat ?? defaults.lowSaturatedFat),
    lowSodium: Boolean(input.lowSodium ?? defaults.lowSodium),
    highFiber: Boolean(input.highFiber ?? defaults.highFiber),
    lowFat: Boolean(input.lowFat ?? defaults.lowFat),
    vegetarian: Boolean(input.vegetarian ?? defaults.vegetarian),
    vegan: Boolean(input.vegan ?? defaults.vegan),
    
    avoidAllergens,
    avoidIngredients: excludedIngredients,
    excludedIngredients,
    preferredCategories: normalizeArray(input.preferredCategories),
    excludedCategories: normalizeArray(input.excludedCategories),
    preferredBrands: normalizeArray(input.preferredBrands),
    excludedBrands: normalizeArray(input.excludedBrands),
    
    maxCalories: typeof input.maxCalories === 'number' && input.maxCalories > 0 ? input.maxCalories : null,
    maxSugar: typeof input.maxSugar === 'number' && input.maxSugar >= 0 ? input.maxSugar : null,
    minProtein: typeof input.minProtein === 'number' && input.minProtein >= 0 ? input.minProtein : null,
    minFiber: typeof input.minFiber === 'number' && input.minFiber >= 0 ? input.minFiber : null
  };
};

const mergePreferences = (base, updates) => {
  return normalizePreferences({ ...base, ...updates });
};

const hasActivePreferences = (input = {}) => {
  if (!input) return false;
  return Boolean(
    input.highProtein ||
    input.lowSugar ||
    input.lowCalories ||
    input.lowSaturatedFat ||
    input.lowSodium ||
    input.highFiber ||
    input.lowFat ||
    input.vegetarian ||
    input.vegan ||
    (input.avoidAllergens && input.avoidAllergens.length > 0) ||
    (input.avoidIngredients && input.avoidIngredients.length > 0) ||
    (input.excludedIngredients && input.excludedIngredients.length > 0) ||
    (input.preferredCategories && input.preferredCategories.length > 0) ||
    (input.excludedCategories && input.excludedCategories.length > 0) ||
    (input.preferredBrands && input.preferredBrands.length > 0) ||
    (input.excludedBrands && input.excludedBrands.length > 0)
  );
};

module.exports = {
  getDefaultPreferences,
  normalizePreferences,
  mergePreferences,
  hasActivePreferences
};
