/**
 * SmartChoice Authoritative Product Verification Engine (Frontend ES Module)
 * Determines verification status from actual product evidence and field-level provenance.
 * Statuses: 'Verified' | 'Partially Verified' | 'Unverified' | 'Needs Review'
 */

export function calculateProductVerification(product) {
  if (!product) {
    return {
      status: 'Unverified',
      level: 'unverified',
      percentage: 0,
      reason: 'No product data provided',
      breakdown: { nutrition: false, ingredients: false, processing: false, dietary: false },
      conflicts: ['Missing product record']
    };
  }

  const conflicts = [];

  // Extract core fields supporting both Catalog-500 and legacy structures
  const p100 = product.nutrition_info?.per_100g || {};
  const nut = product.nutrition || {};
  const calories = typeof p100.energy_kcal === 'number' ? p100.energy_kcal : (typeof nut.calories === 'number' ? nut.calories : nut.energyKcal);
  const protein = typeof p100.protein_g === 'number' ? p100.protein_g : nut.protein;
  const fat = typeof p100.total_fat_g === 'number' ? p100.total_fat_g : nut.fat;
  const satFat = typeof p100.saturated_fat_g === 'number' ? p100.saturated_fat_g : nut.saturatedFat;
  const carbs = typeof p100.carbohydrates_g === 'number' ? p100.carbohydrates_g : nut.carbohydrates;
  const sugar = typeof p100.total_sugars_g === 'number' ? p100.total_sugars_g : nut.sugar;
  const sodium = typeof p100.sodium_mg === 'number' ? p100.sodium_mg : nut.sodium;
  const fiber = typeof p100.dietary_fiber_g === 'number' ? p100.dietary_fiber_g : nut.fiber;

  // 1. Conflict Detection -> 'Needs Review'
  // A. Mathematical macro impossibilities
  if (satFat != null && fat != null && satFat > fat + 0.5) {
    conflicts.push(`Saturated fat (${satFat}g) exceeds total fat (${fat}g)`);
  }
  if (sugar != null && carbs != null && sugar > carbs + 2.0) {
    conflicts.push(`Total sugar (${sugar}g) exceeds total carbohydrates (${carbs}g)`);
  }
  if (calories != null && calories < 0) {
    conflicts.push(`Energy value cannot be negative (${calories} kcal)`);
  }

  // B. Dietary classification vs ingredient conflicts
  const dcStatus = (
    product.dietary_classification?.status ||
    product.dietaryClassification?.status ||
    product.dietary_type ||
    ''
  ).toUpperCase();
  const rawIng = (
    product.nutrition_info?.ingredients_text ||
    product.ingredients?.rawText ||
    product.ingredients?.text ||
    ''
  ).toLowerCase();
  const prodName = String(
    product.product_name ||
    product.catalog?.productName ||
    product.identity?.name ||
    ''
  ).toLowerCase();

  const isVegDeclared = dcStatus === 'VEGETARIAN' || dcStatus === 'VEG' || dcStatus === 'VEGAN';
  const animalMarkers = ['chicken', 'mutton', 'pork', 'beef', 'poultry', 'gelatin', 'fish', 'prawn', 'shrimp', 'crab'];
  const hasAnimalMarker = animalMarkers.some(m => rawIng.includes(m));

  if (isVegDeclared && hasAnimalMarker) {
    conflicts.push('Declared vegetarian/vegan but contains confirmed meat/poultry/gelatin ingredients');
  }

  // C. Product Identity vs Ingredient Conflicts
  if (/\bghee\b/i.test(prodName) && (rawIng.includes('vegetable oil') || rawIng.includes('palmolein') || (!rawIng.includes('milk') && !rawIng.includes('butter') && !rawIng.includes('ghee')))) {
    conflicts.push('Product identity is Ghee but ingredient declaration declares vegetable oil or lacks milk fat');
  }
  if ((/\bice cream\b/i.test(prodName) || /\bkulfi\b/i.test(prodName) || /\bcornetto\b/i.test(prodName) || /\bmagnum\b/i.test(prodName)) && rawIng.includes('potato (82%)')) {
    conflicts.push('Product identity is Ice Cream/Frozen Dessert but ingredient declaration declares potato flakes');
  }
  if (rawIng.includes('tea granules / roasted & ground coffee beans')) {
    conflicts.push('Ingredient declaration contains generic unverified slash placeholder text');
  }
  if ((/\bturmeric\b/i.test(prodName) || /\bchilli powder\b/i.test(prodName) || /\bhaldi\b/i.test(prodName) || /\bdeggi mirch\b/i.test(prodName) || /\bjeera\b/i.test(prodName)) && (rawIng.includes('garam masala') || rawIng.includes('coriander, cumin, turmeric, red chilli, black pepper, dry ginger, clove'))) {
    conflicts.push('Product is single pure spice but ingredient declaration contains 10-spice Garam Masala mix');
  }

  if (conflicts.length > 0) {
    return {
      status: 'Needs Review',
      level: 'needs_review',
      percentage: 40,
      reason: conflicts.join('; '),
      breakdown: { nutrition: false, ingredients: false, processing: false, dietary: false },
      conflicts
    };
  }

  // 2. Field-level Verification Evidence
  const isNutrVerifiedSource =
    product.nutrition_info?.verification_status === 'VERIFIED' ||
    product.nutrition?.verified === true ||
    product.nutrition_info?.verified === true;

  const evaluatedNutrients = [calories, protein, carbs, sugar, fat, satFat, sodium, fiber];
  const filledNutrientsCount = evaluatedNutrients.filter(v => typeof v === 'number').length;
  const hasCompleteNutrition = filledNutrientsCount >= 6;
  const hasValidBasis = (product.nutrition?.basis || product.nutrition_info?.basis || 'PER_100G') !== 'UNKNOWN';

  const isIngVerifiedSource =
    product.ingredients?.verificationStatus === 'VERIFIED' ||
    product.ingredients?.verified === true ||
    product.nutrition_info?.verification_status === 'VERIFIED';

  const hasIngredientTokens = Array.isArray(product.ingredients?.ingredients) && product.ingredients.ingredients.length > 0;
  const hasIngredientText = rawIng.trim().length > 10;
  const hasCleanIngredients = hasIngredientTokens || (hasIngredientText && !rawIng.includes('generic') && !rawIng.includes('placeholder'));

  const hasNovaGroup =
    product.processing?.novaGroup != null ||
    product.nutrition_info?.nova_group != null ||
    product.analysis?.processingAnalysis?.novaGroup != null;
  const isNovaVerified = hasNovaGroup && (isIngVerifiedSource || product.processing?.sourceCertainty === 'SOURCE_REPORTED');

  const isDietaryVerified =
    product.dietary_classification?.verificationStatus === 'VERIFIED' ||
    product.dietaryClassification?.verificationStatus === 'VERIFIED' ||
    (dcStatus !== 'UNKNOWN' && hasCleanIngredients);

  const breakdown = {
    nutrition: hasCompleteNutrition && isNutrVerifiedSource && hasValidBasis,
    ingredients: hasCleanIngredients && isIngVerifiedSource,
    processing: isNovaVerified,
    dietary: isDietaryVerified
  };

  // Calculate Verification Percentage (0 to 100%)
  let verScore = 0;
  if (breakdown.nutrition) verScore += 40;
  else if (hasCompleteNutrition) verScore += 25;
  else if (filledNutrientsCount >= 3) verScore += 15;

  if (breakdown.ingredients) verScore += 30;
  else if (hasCleanIngredients) verScore += 20;

  if (breakdown.processing) verScore += 15;
  else if (hasNovaGroup) verScore += 10;

  if (breakdown.dietary) verScore += 15;
  else if (dcStatus !== 'UNKNOWN') verScore += 5;

  // 3. Status Determination
  if (breakdown.nutrition && breakdown.ingredients && hasNovaGroup && verScore >= 80) {
    return {
      status: 'Verified',
      level: 'verified',
      percentage: Math.min(100, Math.max(80, verScore)),
      reason: 'FSSAI label packshot verified across nutrition, ingredients, and processing profile',
      breakdown,
      conflicts: []
    };
  }

  if (verScore >= 45 || (hasCompleteNutrition && hasCleanIngredients)) {
    return {
      status: 'Partially Verified',
      level: 'partially_verified',
      percentage: verScore,
      reason: 'Core nutrition and ingredient facts present, but official laboratory verification metadata is incomplete',
      breakdown,
      conflicts: []
    };
  }

  return {
    status: 'Unverified',
    level: 'unverified',
    percentage: Math.max(0, verScore),
    reason: 'Reliable verification evidence is genuinely unavailable for this product SKU',
    breakdown,
    conflicts: []
  };
}
