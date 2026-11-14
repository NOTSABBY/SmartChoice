const assert = require('assert');
const { calculateSmartChoiceScore } = require('../services/scoringService');

console.log('=== TEST SUITE: PHASE 4 FINAL SCORING RELIABILITY & CONFIDENCE VERIFICATION ===');

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

// RV-01: Reliability/confidence is calculated separately from quality score
runTest('RV-01: Score confidence is calculated separately and does not conflate with totalScore', () => {
  const incompleteProduct = {
    identity: { categoryId: 1 },
    nutrition: { sugar: 0, saturatedFat: 0 }, // missing 4 nutrients (-50)
    ingredients: {}, // missing ingredients (-10)
    processing: {}   // missing processing (-10) -> total confidence = 30
  };
  const res = calculateSmartChoiceScore(incompleteProduct);
  assert.ok(res.totalScore > 40, `totalScore should reflect evaluated quality (${res.totalScore})`);
  assert.strictEqual(res.confidence.score, 35);
  assert.strictEqual(res.confidence.level, 'low');
});

// RV-02: Component coverage and overallCompleteness are exposed
runTest('RV-02: Component coverage and overall completeness are explicitly exposed', () => {
  const product = {
    identity: { categoryId: 1 },
    nutrition: { sugar: 2, saturatedFat: 1, sodium: 50, calories: 150, protein: 10, fiber: 5 },
    ingredients: { rawText: 'Whole wheat flour' },
    processing: { novaGroup: 1 }
  };
  const res = calculateSmartChoiceScore(product);
  assert.strictEqual(res.coverage.overallCompleteness, 100);
  assert.strictEqual(res.confidence.score, 100);
  assert.strictEqual(res.confidence.level, 'high');
  assert.ok(res.coverage.nutritionCoverage);
  assert.ok(res.coverage.ingredientCoverage);
  assert.ok(res.coverage.processingCoverage);
  assert.ok(res.coverage.proteinFiberCoverage);
});

// RV-03: Explicit identification of neutral 50/100 baselines
runTest('RV-03: Neutral 50/100 baselines for missing data are explicitly reported in coverage', () => {
  const missingProduct = {
    identity: { categoryId: 1 },
    nutrition: {},    // missing nutrition -> neutral 50
    ingredients: {},  // missing ingredients -> neutral 50
    processing: {}    // missing processing -> neutral 50
  };
  const res = calculateSmartChoiceScore(missingProduct);
  assert.ok(res.coverage.neutralBaselinesApplied.includes('nutrition'));
  assert.ok(res.coverage.neutralBaselinesApplied.includes('ingredients'));
  assert.ok(res.coverage.neutralBaselinesApplied.includes('processing'));
  assert.ok(res.coverage.neutralBaselinesApplied.includes('proteinFiber'));
});

// RV-04: Distinguishing incomplete product from fully evaluated product with identical score
runTest('RV-04: Products with same numerical score but different completeness are transparently distinguishable', () => {
  const productA = {
    identity: { categoryId: 1 },
    nutrition: {},
    ingredients: {},
    processing: {}
  };
  const productB = {
    identity: { categoryId: 1 },
    nutrition: { sugar: 15, saturatedFat: 4, sodium: 350, calories: 250, protein: 4, fiber: 2 },
    ingredients: { rawText: 'Wheat flour, salt, sugar, palm oil' },
    processing: { novaGroup: 3 }
  };

  const resA = calculateSmartChoiceScore(productA);
  const resB = calculateSmartChoiceScore(productB);

  assert.notStrictEqual(resA.confidence.score, resB.confidence.score);
  assert.strictEqual(resA.coverage.overallCompleteness, 0);
  assert.strictEqual(resB.coverage.overallCompleteness, 100);
  assert.ok(resA.coverage.neutralBaselinesApplied.length >= 3);
  assert.strictEqual(resB.coverage.neutralBaselinesApplied.length, 0);
});

// RV-05: Boundary conditions and repeatability
runTest('RV-05: Repeatability and boundary conditions (Clamped between 0 and 100)', () => {
  const product = {
    identity: { categoryId: 1 },
    nutrition: { sugar: 100, saturatedFat: 100, sodium: 5000, calories: 1000 },
    ingredients: { rawText: 'Sugar, palm oil, salt, INS 621, INS 627, INS 631, INS 102, INS 110' },
    processing: { novaGroup: 4 }
  };
  const res1 = calculateSmartChoiceScore(product);
  const res2 = calculateSmartChoiceScore(product);
  assert.strictEqual(res1.totalScore, res2.totalScore);
  assert.ok(res1.totalScore >= 0 && res1.totalScore <= 100);
  assert.ok(res1.breakdown.nutrition >= 0);
  assert.ok(res1.breakdown.ingredients >= 0);
});

// RV-06: Allergen exclusion independent of ordinary preference score
runTest('RV-06: Allergen exclusions enforced independently of ordinary soft preferences', () => {
  const product = {
    identity: { categoryId: 1 },
    nutrition: { protein: 25, sugar: 0 },
    ingredients: { rawText: 'Isolated soy protein, peanuts' },
    processing: { novaGroup: 1 }
  };
  const res = calculateSmartChoiceScore(product, { highProtein: true, avoidAllergens: ['peanut'] });
  assert.strictEqual(res.totalScore, 0);
  assert.strictEqual(res.breakdown.preferences, 0);
  assert.ok(res.explanation.includes('Contains avoided allergen: peanut'));
});

console.log(`\nFinal Reliability Verification Summary: ${passed}/${total} passed.\n`);
if (passed !== total) process.exit(1);