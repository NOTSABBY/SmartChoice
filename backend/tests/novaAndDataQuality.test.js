const assert = require('assert');
const { classifyNova } = require('../services/novaAnalysisService');
const { parseIngredientTokens, analyzeIngredientProfile } = require('../services/ingredientParsingService');
const { evaluateCompletenessAndConfidence } = require('../services/dataCompletenessService');
const { analyzeNutrition } = require('../services/nutritionAnalysisService');

console.log('=== TEST SUITE: NOVA, ADDITIVES, ALLERGENS & COMPLETENESS ===');

let passed = 0;
let total = 0;

function runTest(name, fn) {
  total++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
  }
}

// NV-01: Rejects NOVA Inference from Category Priors alone
runTest('NV-01: Rejects NOVA Inference from Category Priors alone (returns INSUFFICIENT_DATA)', () => {
  const product = {
    identity: { categoryId: 9, categoryName: 'Biscuits & Cookies' },
    ingredients: { ingredients: [] },
    processing: {}
  };
  const res = classifyNova(product);
  assert.strictEqual(res.novaGroup, null);
  assert.strictEqual(res.sourceCertainty, 'INSUFFICIENT_DATA');
});

// NV-02: Corroborated Multi-Factor NOVA 4
runTest('NV-02: Corroborated Multi-Factor NOVA 4 requires >= 2 lines of evidence', () => {
  const product = {
    identity: { categoryId: 9, categoryName: 'Biscuits & Cookies' },
    ingredients: { rawText: 'Refined wheat flour, invert sugar, maltodextrin, emulsifier (INS 471), flavor enhancer (INS 621)' }
  };
  const res = classifyNova(product);
  assert.strictEqual(res.novaGroup, 4);
  assert.strictEqual(res.sourceCertainty, 'INTERNALLY_ESTIMATED');
  assert.ok(res.evidence.corroborationScore >= 2);
});

// NV-03: Single Additive does NOT trigger NOVA 4
runTest('NV-03: Single Additive alone does not trigger NOVA 4', () => {
  const product = {
    identity: { categoryId: 7, categoryName: 'Dairy' },
    ingredients: { rawText: 'Pasteurized toned milk, citric acid (INS 330)' }
  };
  const res = classifyNova(product);
  assert.notStrictEqual(res.novaGroup, 4);
});

// NV-04: External Source Separation (Preserves SOURCE_REPORTED)
runTest('NV-04: External Source Separation (Preserves SOURCE_REPORTED with disclaimer)', () => {
  const product = {
    processing: { novaGroup: 4 },
    ingredients: { rawText: 'Wheat, salt' }
  };
  const res = classifyNova(product);
  assert.strictEqual(res.novaGroup, 4);
  assert.strictEqual(res.sourceCertainty, 'SOURCE_REPORTED');
  assert.ok(res.externalProvenance.disclaimer.includes('not independently verified'));
});

// AD-01: Failed Parsing Safety for Additives & Allergens
runTest('AD-01: Failed Parsing yields UNPARSED_INGREDIENTS and UNKNOWN (Never false negatives)', () => {
  const profile = analyzeIngredientProfile({ ingredients: {} });
  assert.strictEqual(profile.additives.detectionStatus, 'UNPARSED_INGREDIENTS');
  assert.strictEqual(profile.allergens.detectionStatus, 'UNKNOWN');
});

// AD-02: Verified Zero Additives
runTest('AD-02: Verified Zero Additives yields NO_ADDITIVES_DETECTED', () => {
  const profile = analyzeIngredientProfile({
    ingredients: { rawText: 'Whole wheat flour, water, yeast, salt' }
  });
  assert.strictEqual(profile.additives.detectionStatus, 'NO_ADDITIVES_DETECTED');
  assert.strictEqual(profile.additives.totalDetected, 0);
});

// AL-01: Detects FSSAI 8 Allergen Classes
runTest('AL-01: Detects FSSAI mandatory allergen classes', () => {
  const profile = analyzeIngredientProfile({
    ingredients: { rawText: 'Wheat flour, milk solids, almond paste, soy lecithin' }
  });
  assert.strictEqual(profile.allergens.detectionStatus, 'ALLERGENS_IDENTIFIED');
  const classes = profile.allergens.declaredAllergenClasses;
  assert.ok(classes.includes('CEREALS_CONTAINING_GLUTEN'));
  assert.ok(classes.includes('MILK_AND_DAIRY'));
  assert.ok(classes.includes('PEANUTS_AND_TREENUTS'));
  assert.ok(classes.includes('SOYBEANS'));
});

// CP-01: Decoupling Completeness vs Confidence
runTest('CP-01: Decoupling Completeness vs Confidence (Missing NOVA depresses processing completeness and confidence)', () => {
  const product = {
    nutrition: { calories: 200, protein: 10, carbohydrates: 30, sugar: 5, fat: 5, saturatedFat: 1, sodium: 100, fiber: 4, basis: 'PER_100G' },
    ingredients: { rawText: 'Wheat, water' },
    identity: { productName: 'Atta', brand: 'BrandX', categoryId: 1 }
  };
  const nutr = analyzeNutrition(product);
  const ing = analyzeIngredientProfile(product);
  const nova = classifyNova(product); // NOVA 1
  const qual = evaluateCompletenessAndConfidence(product, nutr, ing, nova);

  assert.strictEqual(qual.completeness.nutritionCompleteness, 100);
  assert.strictEqual(qual.confidence.nutritionConfidence, 1.0);
  assert.strictEqual(qual.confidence.confidenceBand, 'HIGH');
});

console.log(`\nNOVA & Data Quality Tests Summary: ${passed}/${total} passed.\n`);
if (passed !== total) process.exit(1);