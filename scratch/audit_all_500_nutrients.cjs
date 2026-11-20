const fs = require('fs');
const path = require('path');

const cat500Path = path.join(__dirname, '../frontend/public/data/enriched_catalog_500.json');
const cat500 = JSON.parse(fs.readFileSync(cat500Path, 'utf8'));

let products = [];
cat500.categories.forEach(cat => {
  (cat.products || []).forEach(p => {
    products.push({
      ...p,
      category_id: p.category_id || cat.id,
      category_name: p.category_name || cat.name
    });
  });
});

console.log(`Auditing all ${products.length} products across 25 categories...`);

const findings = [];

products.forEach(p => {
  const p100 = p.nutrition_info?.per_100g || {};
  const nut = p.nutrition || {};

  const energy = p100.energy_kcal ?? nut.calories;
  const protein = p100.protein_g ?? nut.protein;
  const carbs = p100.carbohydrates_g ?? nut.carbohydrates;
  const sugar = p100.total_sugars_g ?? nut.sugar;
  const addedSugar = p100.added_sugars_g ?? nut.addedSugars;
  const fat = p100.total_fat_g ?? nut.fat;
  const satFat = p100.saturated_fat_g ?? nut.saturatedFat;
  const transFat = p100.trans_fat_g ?? nut.transFat;
  const fiber = p100.dietary_fiber_g ?? nut.fiber;
  const sodium = p100.sodium_mg ?? nut.sodium;

  const productIssues = [];

  // 1. Missing fields
  const missing = [];
  if (energy == null) missing.push('energy');
  if (protein == null) missing.push('protein');
  if (carbs == null) missing.push('carbs');
  if (sugar == null) missing.push('sugar');
  if (fat == null) missing.push('fat');
  if (satFat == null) missing.push('satFat');
  if (sodium == null) missing.push('sodium');
  if (fiber == null) missing.push('fiber');
  if (addedSugar == null) missing.push('addedSugar');
  if (transFat == null) missing.push('transFat');

  // 2. Physical & Biological Contradictions
  // A. Sugar > Carbs
  if (sugar != null && carbs != null && sugar > carbs + 0.5) {
    productIssues.push({
      type: 'SUGAR_EXCEEDS_CARBS',
      severity: 'CONFIRMED_ERROR',
      detail: `Sugar (${sugar}g) exceeds Carbohydrates (${carbs}g)`
    });
  }

  // B. Added Sugar > Total Sugar
  if (addedSugar != null && sugar != null && addedSugar > sugar + 0.2) {
    productIssues.push({
      type: 'ADDED_SUGAR_EXCEEDS_TOTAL_SUGAR',
      severity: 'CONFIRMED_ERROR',
      detail: `Added Sugar (${addedSugar}g) exceeds Total Sugar (${sugar}g)`
    });
  }

  // C. Saturated Fat > Total Fat
  if (satFat != null && fat != null && satFat > fat + 0.2) {
    productIssues.push({
      type: 'SAT_FAT_EXCEEDS_TOTAL_FAT',
      severity: 'CONFIRMED_ERROR',
      detail: `Saturated Fat (${satFat}g) exceeds Total Fat (${fat}g)`
    });
  }

  // D. Trans Fat > Total Fat
  if (transFat != null && fat != null && transFat > fat + 0.1) {
    productIssues.push({
      type: 'TRANS_FAT_EXCEEDS_TOTAL_FAT',
      severity: 'CONFIRMED_ERROR',
      detail: `Trans Fat (${transFat}g) exceeds Total Fat (${fat}g)`
    });
  }

  // E. Macro Sum > 105g (Impossible per 100g)
  let macroSum = null;
  if (protein != null && carbs != null && fat != null) {
    macroSum = protein + carbs + fat;
    if (macroSum > 105.0) {
      productIssues.push({
        type: 'MACRO_SUM_EXCEEDS_100G',
        severity: 'CONFIRMED_ERROR',
        detail: `Sum of Protein (${protein}g) + Carbs (${carbs}g) + Fat (${fat}g) = ${macroSum.toFixed(1)}g > 105g`
      });
    }
  }

  // F. Energy Impossibility (Atwater check)
  if (protein != null && carbs != null && fat != null && energy != null && energy > 0) {
    const atwater = 4 * protein + 4 * carbs + 9 * fat;
    const diff = Math.abs(energy - atwater);
    // Large deviation (> 180 kcal) indicates kJ entered as kcal, or wrong numbers
    if (diff > 180 && (macroSum == null || macroSum > 20)) {
      productIssues.push({
        type: 'ATWATER_ENERGY_MISMATCH',
        severity: 'SUSPICIOUS_REQUIRES_VERIFICATION',
        detail: `Declared Energy (${energy} kcal) deviates by ${Math.round(diff)} kcal from Atwater estimate (${Math.round(atwater)} kcal)`
      });
    }
  }

  // G. Category-Specific Sodium Anomalies
  // Packaged Juices (Cat 5): natural juices should not have >= 80mg sodium unless salted lemon/spiced
  const isJuice = p.category_id === 5;
  const isPlainJuice = isJuice && !p.product_name.toLowerCase().includes('masala') && !p.product_name.toLowerCase().includes('salted') && !p.product_name.toLowerCase().includes('soup');
  if (isPlainJuice && sodium != null && sodium >= 80) {
    productIssues.push({
      type: 'JUICE_HIGH_SODIUM',
      severity: 'CONFIRMED_ERROR',
      detail: `Plain fruit juice has suspiciously high sodium (${sodium}mg / 100ml). Natural fruit juice sodium is 1-15mg.`
    });
  }

  // H. Cooking Oils & Ghee (Cat 11): Pure fats must have 0g protein, 0g carbs, 0g sugar, 0mg sodium, and ~100g fat
  const isOil = p.category_id === 11;
  if (isOil) {
    if (protein != null && protein > 1.0) productIssues.push({ type: 'OIL_PROTEIN_ANOMALY', severity: 'CONFIRMED_ERROR', detail: `Cooking oil has ${protein}g protein (expected 0g)` });
    if (carbs != null && carbs > 1.0) productIssues.push({ type: 'OIL_CARB_ANOMALY', severity: 'CONFIRMED_ERROR', detail: `Cooking oil has ${carbs}g carbs (expected 0g)` });
    if (sugar != null && sugar > 1.0) productIssues.push({ type: 'OIL_SUGAR_ANOMALY', severity: 'CONFIRMED_ERROR', detail: `Cooking oil has ${sugar}g sugar (expected 0g)` });
    if (sodium != null && sodium > 10.0) productIssues.push({ type: 'OIL_SODIUM_ANOMALY', severity: 'CONFIRMED_ERROR', detail: `Cooking oil has ${sodium}mg sodium (expected 0mg)` });
  }

  // I. Salted Biscuit with abnormally low sodium (e.g. Monaco with 120mg when it should be 600-800mg)
  if (p.product_name.toLowerCase().includes('monaco') && sodium != null && sodium < 300) {
    productIssues.push({
      type: 'SALTED_BISCUIT_LOW_SODIUM',
      severity: 'CONFIRMED_ERROR',
      detail: `Parle Monaco Salted Biscuit has only ${sodium}mg sodium (typical salted biscuit is 600-800mg)`
    });
  }

  // J. Missing Ingredients
  const ingText = p.nutrition_info?.ingredients_text || p.ingredients?.rawText || '';
  const ingTokens = p.ingredients?.ingredients || [];
  if (!ingText.trim() && ingTokens.length === 0) {
    productIssues.push({
      type: 'MISSING_INGREDIENTS',
      severity: 'CONFIRMED_ERROR',
      detail: 'Product has no ingredients list or tokens'
    });
  }

  // K. French / Foreign Language Ingredient Statements in Indian Catalog
  if (ingText && (ingText.includes("Jus d'orange") || ingText.includes("Farine de") || ingText.includes("Ingrédients :") || ingText.includes("Huile de"))) {
    productIssues.push({
      type: 'FOREIGN_LANGUAGE_INGREDIENTS',
      severity: 'CONFIRMED_ERROR',
      detail: `Ingredients appear in French/Foreign language from un-localized OpenFoodFacts import: "${ingText.substring(0, 40)}..."`
    });
  }

  if (productIssues.length > 0 || missing.length > 0) {
    findings.push({
      id: p.product_id,
      name: p.product_name,
      brand: p.brand,
      category: p.category_name,
      categoryId: p.category_id,
      missing,
      issues: productIssues
    });
  }
});

console.log(`\n=== CATALOGUE-WIDE NUTRITIONAL AUDIT SUMMARY ===`);
console.log(`Total products audited: ${products.length}`);
const withIssues = findings.filter(f => f.issues.length > 0);
console.log(`Products with confirmed errors or suspicious values: ${withIssues.length}`);

// Group issues by type
const issueCounts = {};
withIssues.forEach(f => {
  f.issues.forEach(iss => {
    issueCounts[iss.type] = (issueCounts[iss.type] || 0) + 1;
  });
});
console.log('\nIssues by Type:', issueCounts);

console.log('\n--- ALL DETECTED PRODUCTS WITH ISSUES ---');
withIssues.forEach(f => {
  console.log(`\n[${f.id}] ${f.name} (${f.brand}) - Category ${f.categoryId}: ${f.category}`);
  f.issues.forEach(iss => {
    console.log(`  -> [${iss.severity}] ${iss.type}: ${iss.detail}`);
  });
});
