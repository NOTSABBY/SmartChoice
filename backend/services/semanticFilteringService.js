/**
 * SmartChoice Semantic Evidence-Based Filtering Service
 * 
 * Implements Section 7: Independent Evidence-Based Filtering.
 * Evaluates dietary restrictions, allergen exclusions, ingredient exclusions,
 * preparation states, and packaging types independently from semantic retrieval.
 * 
 * CRITICAL RULE:
 * Vector similarity or semantic proximity CANNOT establish dietary compliance,
 * allergen safety, or ingredient absence. All filters rely on factual evidence.
 */

const { classifyProductDietary } = require('../utils/dietaryClassifier');
const { classifyProductDairy } = require('./dairyClassificationService');

/**
 * Evaluates a product against structured filters and global user preferences.
 * @param {Object} product - Product record
 * @param {Object} structuredFilters - From query understanding { dietary, allergens_to_exclude, ingredients_to_exclude, preparation_state, packaging_type }
 * @param {Object} globalPreferences - User saved preferences { vegetarian, vegan, avoidAllergens, excludedIngredients, scope }
 * @returns {Object} { isEligible, rejectionReason, filterAudit }
 */
function evaluateStructuredFilters(product, structuredFilters = {}, globalPreferences = {}) {
  const dietaryStatus = product.dietary_classification?.status ||
                        product.dietaryClassification?.status ||
                        classifyProductDietary(product).status;

  const dairyClassification = product.dairyClassification || classifyProductDairy(product);

  const allergensList = (
    product.nutrition_info?.allergens ||
    product.ingredients?.allergens ||
    product.ingredients?.allergenDeclarations?.contains ||
    []
  ).map(a => String(a).toLowerCase().trim());

  const mayContainList = (
    product.nutrition_info?.may_contain ||
    product.ingredients?.allergenDeclarations?.mayContain ||
    []
  ).map(a => String(a).toLowerCase().trim());

  const ingredientsText = String(
    product.ingredients?.rawIngredientsText ||
    product.ingredients?.rawText ||
    product.nutrition_info?.ingredients_text ||
    ''
  ).toLowerCase();

  const ingredientsTokens = (product.ingredients?.ingredients || []).map(i => String(i).toLowerCase().trim());
  const fullIngredients = [ingredientsText, ...ingredientsTokens].join(' ');

  const hasIngredientsEvidence = ingredientsText.length > 0 || ingredientsTokens.length > 0;
  const pName = (product.product_name || product.catalog?.productName || product.identity?.name || '').toLowerCase();
  const catId = Number(product.category_id ?? product.catalog?.categoryId ?? product.identity?.categoryId);
  const catName = (product.category_name || product.catalog?.categoryName || '').toLowerCase();

  // --------------------------------------------------------------------------
  // 1. DIETARY LIFESTYLE FILTERING (VEGAN / VEGETARIAN)
  // --------------------------------------------------------------------------
  const requestedDietary = (structuredFilters.dietary || []).map(d => String(d).toUpperCase());
  const isVeganRequested = requestedDietary.includes('VEGAN') || globalPreferences.vegan === true;
  const isVegRequested = requestedDietary.includes('VEGETARIAN') || globalPreferences.vegetarian === true;

  if (isVeganRequested && isVegRequested) {
    // Both requested: must be compatible with both
    if (dietaryStatus !== 'VEGAN' && dietaryStatus !== 'VEGETARIAN') {
      return { isEligible: false, rejectionReason: `Not compliant with both Vegan and Vegetarian (Status: ${dietaryStatus})` };
    }
  } else if (isVeganRequested) {
    if (dietaryStatus !== 'VEGAN') {
      return { isEligible: false, rejectionReason: `Product is not certified Vegan (Status: ${dietaryStatus})` };
    }
  } else if (isVegRequested) {
    // In SmartChoice: Vegetarian selection requires VEGETARIAN status
    if (dietaryStatus !== 'VEGETARIAN' && dietaryStatus !== 'VEGAN') {
      return { isEligible: false, rejectionReason: `Product is not Vegetarian (Status: ${dietaryStatus})` };
    }
  }

  // --------------------------------------------------------------------------
  // 2. DAIRY-FREE / DAIRY STATUS STRICT EVIDENCE CHECK
  // --------------------------------------------------------------------------
  if (structuredFilters.dairy_status === 'DAIRY_CONTAINS' || structuredFilters.dairy_classification === 'DAIRY_CONTAINS') {
    if (dairyClassification.classification !== 'DAIRY_CONTAINS') {
      return { isEligible: false, rejectionReason: 'Product does not contain verified milk ingredients' };
    }
  }

  if (structuredFilters.dairy_status === 'DAIRY_MAY_CONTAIN' || structuredFilters.dairy_classification === 'DAIRY_MAY_CONTAIN') {
    if (dairyClassification.classification !== 'DAIRY_MAY_CONTAIN') {
      return { isEligible: false, rejectionReason: 'Product does not declare may-contain milk warning' };
    }
  }

  if (requestedDietary.includes('DAIRY_FREE') || (globalPreferences.avoidAllergens || []).some(a => String(a).toLowerCase().includes('milk') || String(a).toLowerCase().includes('dairy'))) {
    if (dairyClassification.classification !== 'DAIRY_FREE_VERIFIED') {
      return {
        isEligible: false,
        rejectionReason: `Failed strict dairy-free evidence check (${dairyClassification.classification}: ${dairyClassification.reason})`
      };
    }
  }

  // --------------------------------------------------------------------------
  // 3. GLUTEN-FREE STRICT EVIDENCE CHECK
  // --------------------------------------------------------------------------
  if (requestedDietary.includes('GLUTEN_FREE') || (globalPreferences.avoidAllergens || []).some(a => String(a).toLowerCase().includes('gluten'))) {
    const hasGlutenAllergen = allergensList.some(a => a.includes('gluten') || a.includes('wheat') || a.includes('barley') || a.includes('rye'));
    const hasGlutenInText = /\b(wheat|atta|maida|sooji|rava|semolina|durum|barley|malt|rye|spelt|gluten)\b/i.test(fullIngredients);
    const hasGlutenInName = /\b(atta|maida|sooji|rava|semolina|durum|barley|malt|noodles?|pasta|macaroni|biscuit|biscuits|cookies?)\b/i.test(pName);

    if (hasGlutenAllergen || hasGlutenInText || hasGlutenInName) {
      return { isEligible: false, rejectionReason: 'Contains gluten or gluten-containing cereals' };
    }
  }

  // --------------------------------------------------------------------------
  // 4. STRICT ALLERGEN EXCLUSIONS
  // --------------------------------------------------------------------------
  const allergensToExclude = [
    ...(structuredFilters.allergens_to_exclude || []),
    ...(globalPreferences.avoidAllergens || [])
  ].map(a => String(a).toLowerCase().trim()).filter(Boolean);

  for (const allergen of allergensToExclude) {
    if (allergensList.some(a => a.includes(allergen)) || mayContainList.some(a => a.includes(allergen))) {
      return { isEligible: false, rejectionReason: `Declares avoided allergen: ${allergen}` };
    }

    // Common allergen ingredient checks
    if (allergen === 'peanuts' || allergen === 'peanut') {
      if (/\b(peanuts?|groundnuts?|arachis)\b/i.test(fullIngredients) || /\b(peanuts?|groundnuts?)\b/i.test(pName)) {
        return { isEligible: false, rejectionReason: 'Contains peanuts' };
      }
    } else if (allergen === 'milk' || allergen === 'dairy') {
      if (dairyClassification.classification !== 'DAIRY_FREE_VERIFIED') {
        return { isEligible: false, rejectionReason: `Contains dairy or declared milk cross-contact` };
      }
    } else if (allergen === 'soy' || allergen === 'soya') {
      if (/\b(soy|soya|soybean|edamame)\b/i.test(fullIngredients)) {
        return { isEligible: false, rejectionReason: 'Contains soy' };
      }
    }
  }

  // --------------------------------------------------------------------------
  // 5. STRICT INGREDIENT EXCLUSIONS
  // --------------------------------------------------------------------------
  const ingredientsToExclude = [
    ...(structuredFilters.ingredients_to_exclude || []),
    ...(globalPreferences.excludedIngredients || [])
  ].map(i => String(i).toLowerCase().trim()).filter(Boolean);

  for (const ingredient of ingredientsToExclude) {
    if (!hasIngredientsEvidence) {
      return { isEligible: false, rejectionReason: `Missing ingredient evidence to verify absence of ${ingredient}` };
    }

    if (ingredient === 'palm oil') {
      if (/\b(palm\s*oil|palmate|palmitate|palm\s*kernel|elaeis\s*guineensis|palmolein)\b/i.test(fullIngredients)) {
        return { isEligible: false, rejectionReason: 'Contains palm oil' };
      }
    } else if (ingredient === 'sugar') {
      if (/\b(sugar|sucrose|glucose|fructose|corn\s*syrup|dextrose|invert\s*sugar)\b/i.test(fullIngredients)) {
        return { isEligible: false, rejectionReason: 'Contains added sugar' };
      }
    } else if (ingredient === 'msg') {
      if (/\b(msg|monosodium\s*glutamate|ins\s*621|e621)\b/i.test(fullIngredients)) {
        return { isEligible: false, rejectionReason: 'Contains MSG' };
      }
    } else {
      if (fullIngredients.includes(ingredient)) {
        return { isEligible: false, rejectionReason: `Contains excluded ingredient: ${ingredient}` };
      }
    }
  }

  // --------------------------------------------------------------------------
  // 6. PREPARATION STATE FILTERING
  // e.g. FROZEN, INSTANT, READY_TO_EAT, FRESH
  // --------------------------------------------------------------------------
  const prepStates = (structuredFilters.preparation_state || []).map(p => String(p).toUpperCase());
  for (const prep of prepStates) {
    if (prep === 'FROZEN') {
      // Category 25 is Frozen Snacks & Desserts
      const isFrozenCat = catId === 25;
      const hasFrozenName = /\b(?:frozen|ice\s*cream|kulfi|cassatta)\b/i.test(pName);
      if (!isFrozenCat && !hasFrozenName) {
        return { isEligible: false, rejectionReason: 'Product is not in frozen preparation state' };
      }
    } else if (prep === 'INSTANT') {
      // Category 3 is Instant Noodles & Pasta
      const isInstantCat = catId === 3;
      const hasInstantName = /\b(?:instant|ramen|quick|ready\s*mix)\b/i.test(pName);
      if (!isInstantCat && !hasInstantName) {
        return { isEligible: false, rejectionReason: 'Product is not an instant preparation item' };
      }
    } else if (prep === 'READY_TO_EAT') {
      // Category 12 is Ready-to-Eat Meals, snacks are ready to eat
      const isRteCat = catId === 12 || catId === 1 || catId === 8 || catId === 15 || catId === 4;
      const hasRteName = /\b(?:ready\s*to\s*eat|rte)\b/i.test(pName);
      if (!isRteCat && !hasRteName) {
        return { isEligible: false, rejectionReason: 'Product is not a ready-to-eat item' };
      }
    }
  }

  // --------------------------------------------------------------------------
  // 7. PACKAGING TYPE FILTERING
  // e.g. BOTTLE, CAN, POUCH, JAR
  // --------------------------------------------------------------------------
  const packagingTypes = (structuredFilters.packaging_type || []).map(p => String(p).toUpperCase());
  const pkgSize = (product.packaging_size || product.catalog?.packagingSize || '').toLowerCase();
  const pkgText = `${pName} ${pkgSize}`;

  for (const pt of packagingTypes) {
    if (pt === 'BOTTLE') {
      if (!/\b(?:bottle|pet\s*jar|glass)\b/i.test(pkgText)) {
        return { isEligible: false, rejectionReason: 'Packaging is not a bottle' };
      }
    } else if (pt === 'CAN') {
      if (!/\b(?:can|tin)\b/i.test(pkgText)) {
        return { isEligible: false, rejectionReason: 'Packaging is not a can or tin' };
      }
    } else if (pt === 'POUCH') {
      if (!/\b(?:pouch|packet|refill)\b/i.test(pkgText)) {
        return { isEligible: false, rejectionReason: 'Packaging is not a pouch' };
      }
    }
  }

  return {
    isEligible: true,
    filterAudit: {
      dietaryStatus,
      dairyClassification: dairyClassification.classification,
      allergensChecked: allergensToExclude.length,
      ingredientsChecked: ingredientsToExclude.length
    }
  };
}

module.exports = {
  evaluateStructuredFilters
};
