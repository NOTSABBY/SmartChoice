const assert = require('assert');
const {
  calculateSmartChoiceScore,
  calculateNutritionScore,
  calculateIngredientScore,
  calculateProcessingScore,
  calculateProteinFiberScore,
  calculatePreferenceScore
} = require('../services/scoringService');

console.log('=== TEST SUITE: PHASE 4 SCORING ENGINE INTEGRATION ===');

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

// SC-01: Normal product with complete data produces consistent score
runTest('SC-01: Normal product with complete data produces deterministic score', () => {
  const product = {
    identity: { categoryId: 1, categoryName: 'Atta, Flours & Sooji' },
    nutrition: { sugar: 2.0, saturatedFat: 0.5, sodium: 10, calories: 340, protein: 12.0, fiber: 10.0, basis: 'PER_100G' },
    ingredients: { rawText: '100% whole wheat grains' },
    processing: { novaGroup: 1 }
  };
  const score1 = calculateSmartChoiceScore(product);
  const score2 = calculateSmartChoiceScore(product);
  assert.strictEqual(score1.totalScore, score2.totalScore);
  assert.ok(score1.totalScore >= 80, `Expected high score for whole wheat, got ${score1.totalScore}`);
  assert.strictEqual(score1.breakdown.processing, 100);
});

// SC-02: Cooking Oil Category Scoring (No sugar/sodium penalty)
runTest('SC-02: Cooking Oil Category Scoring (No sugar/sodium penalty for pure oils)', () => {
  const oilProduct = {
    identity: { categoryId: 4, categoryName: 'Edible Oils & Ghee' },
    nutrition: { saturatedFat: 12.0, calories: 900, basis: 'PER_100G' }, // sugar & sodium missing legitimately
    ingredients: { rawText: 'Cold pressed mustard oil' },
    processing: { novaGroup: 2 }
  };
  const nut = calculateNutritionScore(oilProduct, 'COOKING_OIL');
  assert.strictEqual(nut.score, 100); // 12g sat fat <= 15g low threshold
  assert.ok(nut.factors.some(f => f.includes('legitimately unclassified')));
});

// SC-03: General Beverages vs Dairy Beverages Thresholds
runTest('SC-03: General Beverages vs Dairy Beverages Thresholds', () => {
  const dairyProduct = {
    identity: { categoryId: 7, categoryName: 'Dairy' },
    nutrition: { sugar: 4.5, saturatedFat: 1.5, sodium: 40, calories: 60, basis: 'PER_100ML' }
  };
  const nutDairy = calculateNutritionScore(dairyProduct, 'BEVERAGE_DAIRY');
  // 4.5g sugar in Dairy is LOW (<= 5.0g due to lactose), whereas in general beverage > 2.5g is moderate
  assert.ok(nutDairy.factors.some(f => f.includes('Low sugar')));
});

// SC-04: Missing Nutrient Handling (Never defaults to zero or worst score)
runTest('SC-04: Missing Nutrient Handling assigns neutral baseline (not 0)', () => {
  const emptyNutrProduct = {
    identity: { categoryId: 1 },
    nutrition: {}
  };
  const nut = calculateNutritionScore(emptyNutrProduct, 'SOLID_FOOD');
  assert.strictEqual(nut.score, 50); // Neutral baseline 50, not 0
  assert.ok(nut.limitations.some(l => l.includes('completely unavailable')));
});

// SC-05: Missing Ingredients Handling (Neutral baseline 50)
runTest('SC-05: Missing Ingredients Handling assigns neutral baseline 50', () => {
  const noIngProduct = {
    identity: { categoryId: 1 },
    ingredients: {}
  };
  const ing = calculateIngredientScore(noIngProduct);
  assert.strictEqual(ing.score, 50);
});

// SC-06: Unavailable Processing (NOVA) Handling (Neutral baseline 50)
runTest('SC-06: Unavailable Processing (NOVA) assigns neutral baseline 50', () => {
  const noProcProduct = {
    identity: { categoryId: 1 },
    processing: {}
  };
  const proc = calculateProcessingScore(noProcProduct);
  assert.strictEqual(proc.score, 50);
  assert.ok(proc.limitations.some(l => l.includes('incomplete')));
});

// SC-07: Allergen Hard Exclusion Check (Score drops to 0)
runTest('SC-07: Allergen Hard Exclusion drops total score to 0 regardless of quality', () => {
  const allergenProduct = {
    identity: { categoryId: 1 },
    nutrition: { sugar: 1.0, saturatedFat: 0.5, sodium: 20, calories: 300, protein: 15, fiber: 10 },
    ingredients: { rawText: 'Wheat flour, milk solids, almond nuts' },
    processing: { novaGroup: 1 }
  };
  const score = calculateSmartChoiceScore(allergenProduct, { avoidAllergens: ['almond'] });
  assert.strictEqual(score.totalScore, 0);
  assert.ok(score.explanation.includes('Contains avoided allergen: almond'));
});

// SC-08: User Preferences Integration (Normal Soft Constraints)
runTest('SC-08: User Preferences Integration (Soft constraints adjust preference score)', () => {
  const highProteinProduct = {
    identity: { categoryId: 1 },
    nutrition: { protein: 15.0, sugar: 2.0 },
    ingredients: { rawText: 'Soya chunks' },
    processing: { novaGroup: 1 }
  };
  const pref = calculatePreferenceScore(highProteinProduct, { highProtein: true, lowSugar: true });
  assert.ok(pref.score >= 90, `Preference score should reflect strong compatibility (got ${pref.score})`);
});

// SC-09: Exact Preservation of Component Weights Formula
runTest('SC-09: Exact Preservation of Component Weights Formula (40/20/15/15/10)', () => {
  const product = {
    identity: { categoryId: 1 },
    nutrition: { sugar: 0, saturatedFat: 0, sodium: 0, calories: 100, protein: 12, fiber: 8, basis: 'PER_100G' },
    ingredients: { rawText: 'Whole oats' },
    processing: { novaGroup: 1 }
  };
  const res = calculateSmartChoiceScore(product);
  const expectedTotal = Math.round(
    res.breakdown.nutrition * 0.40 +
    res.breakdown.ingredients * 0.20 +
    res.breakdown.processing * 0.15 +
    res.breakdown.proteinFiber * 0.15 +
    res.breakdown.preferences * 0.10
  );
  assert.strictEqual(res.totalScore, expectedTotal);
  assert.strictEqual(res.appliedWeights.nutrition, 0.40);
  assert.strictEqual(res.appliedWeights.ingredients, 0.20);
  assert.strictEqual(res.appliedWeights.processing, 0.15);
  assert.strictEqual(res.appliedWeights.proteinFiber, 0.15);
  assert.strictEqual(res.appliedWeights.preferences, 0.10);
});

// SC-10: Traceable Explanation Synthesis
runTest('SC-10: Traceable Explanation Synthesis contains score, breakdown, and weights', () => {
  const product = {
    identity: { categoryId: 1 },
    nutrition: { sugar: 5, saturatedFat: 2, sodium: 100, calories: 200, basis: 'PER_100G' },
    ingredients: { rawText: 'Whole wheat' },
    processing: { novaGroup: 1 }
  };
  const res = calculateSmartChoiceScore(product);
  assert.ok(res.explanation.includes('Overall score of'));
  assert.ok(res.explanation.includes('40% wt'));
  assert.ok(res.explanation.includes('20% wt'));
});

console.log(`\nScoring Engine Integration Tests Summary: ${passed}/${total} passed.\n`);
if (passed !== total) process.exit(1);