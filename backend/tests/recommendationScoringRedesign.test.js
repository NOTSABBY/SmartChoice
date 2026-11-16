const assert = require('assert');
const path = require('path');
const fs = require('fs');

const recommendationService = require('../services/recommendationService');
const scoringService = require('../services/scoringService');
const catalogLoader = require('../utils/catalogLoader');

let passedCount = 0;
let failedCount = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}`);
    failedCount++;
  }
}

async function runAsyncTest(name, asyncFn) {
  try {
    await asyncFn();
    console.log(`[PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}`);
    failedCount++;
  }
}

async function main() {
  console.log('======================================================================');
  console.log('   RECOMMENDATION ENGINE SCORING REDESIGN — VERIFICATION TEST SUITE   ');
  console.log('======================================================================\n');

  // Load frontend scoring module dynamically
  const frontendScoring = await import('../../frontend/src/utils/productScoring.js');
  const feScoring = frontendScoring.default || frontendScoring;

  // Load 500 catalog products
  const catalogPath = path.join(__dirname, '../../frontend/public/data/enriched_catalog_500.json');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const products = catalog.categories.flatMap(c => c.products);
  assert(products.length === 500, `Expected exactly 500 catalog products, got ${products.length}`);

  // =========================================================================
  // TEST SUITE 1: INDIVIDUAL PREFERENCE NORMALIZATION & BOUNDARY ACCURACY
  // =========================================================================
  console.log('--- SUITE 1: INDIVIDUAL PREFERENCE NORMALIZATION & BOUNDARY VALUES ---');

  runTest('1.1: Low Sodium Continuous Curve (Solid)', () => {
    const makeProd = (sodium) => ({
      identity: { categoryId: 1 },
      nutrition: { sodium }
    });

    const cases = [
      { val: 0, expected: 100 },
      { val: 40, expected: 95 },
      { val: 120, expected: 85 },
      { val: 125, expected: 84 },
      { val: 400, expected: 50 },
      { val: 600, expected: 20 },
      { val: 1000, expected: 0 },
      { val: 1500, expected: 0 }
    ];

    cases.forEach(({ val, expected }) => {
      const p = makeProd(val);
      const res = recommendationService.evaluatePreferences(p, { lowSodium: true });
      const score = recommendationService.calculatePersonalizedScore(res);
      assert.strictEqual(score, expected, `Low Sodium at ${val}mg: expected ${expected}%, got ${score}%`);
    });
  });

  runTest('1.2: High Protein Continuous Curve (Solid & Liquid)', () => {
    const makeSolid = (protein) => ({
      identity: { categoryId: 1 }, // solid
      nutrition: { protein }
    });
    const makeLiquid = (protein) => ({
      identity: { categoryId: 5 }, // liquid beverage
      nutrition: { protein }
    });

    const solidCases = [
      { val: 0, expected: 0 },
      { val: 5, expected: 35 },
      { val: 10, expected: 70 },
      { val: 20, expected: 90 },
      { val: 45, expected: 100 },
      { val: 60, expected: 100 }
    ];

    solidCases.forEach(({ val, expected }) => {
      const p = makeSolid(val);
      const res = recommendationService.evaluatePreferences(p, { highProtein: true });
      const score = recommendationService.calculatePersonalizedScore(res);
      assert.strictEqual(score, expected, `High Protein Solid at ${val}g: expected ${expected}%, got ${score}%`);
    });

    const liquidCases = [
      { val: 0, expected: 0 },
      { val: 3, expected: 60 },
      { val: 6, expected: 90 },
      { val: 12, expected: 100 },
      { val: 20, expected: 100 }
    ];

    liquidCases.forEach(({ val, expected }) => {
      const p = makeLiquid(val);
      const res = recommendationService.evaluatePreferences(p, { highProtein: true });
      const score = recommendationService.calculatePersonalizedScore(res);
      assert.strictEqual(score, expected, `High Protein Liquid at ${val}g: expected ${expected}%, got ${score}%`);
    });
  });

  runTest('1.3: Low Sugar Continuous Curve (Solid & Liquid)', () => {
    const makeSolid = (sugar) => ({
      identity: { categoryId: 1 },
      nutrition: { sugar }
    });
    const makeLiquid = (sugar) => ({
      identity: { categoryId: 5 }, // liquid beverage
      nutrition: { sugar }
    });

    const solidCases = [
      { val: 0, expected: 100 },
      { val: 2.5, expected: 90 },
      { val: 5, expected: 75 },
      { val: 15, expected: 35 },
      { val: 25, expected: 0 },
      { val: 30, expected: 0 }
    ];

    solidCases.forEach(({ val, expected }) => {
      const p = makeSolid(val);
      const res = recommendationService.evaluatePreferences(p, { lowSugar: true });
      const score = recommendationService.calculatePersonalizedScore(res);
      assert.strictEqual(score, expected, `Low Sugar Solid at ${val}g: expected ${expected}%, got ${score}%`);
    });

    const liquidCases = [
      { val: 0, expected: 100 },
      { val: 1, expected: 90 },
      { val: 2.5, expected: 75 },
      { val: 7.5, expected: 30 },
      { val: 11.25, expected: 0 },
      { val: 15, expected: 0 }
    ];

    liquidCases.forEach(({ val, expected }) => {
      const p = makeLiquid(val);
      const res = recommendationService.evaluatePreferences(p, { lowSugar: true });
      const score = recommendationService.calculatePersonalizedScore(res);
      assert.strictEqual(score, expected, `Low Sugar Liquid at ${val}g: expected ${expected}%, got ${score}%`);
    });
  });

  runTest('1.4: High Fiber Continuous Curve & Format Constraints', () => {
    const makeSolid = (fiber) => ({
      identity: { categoryId: 1 },
      nutrition: { fiber }
    });
    const makeOil = (fiber) => ({
      identity: { categoryId: 11 }, // Cooking Oils
      nutrition: { fiber }
    });

    const solidCases = [
      { val: 0, expected: 0 },
      { val: 3, expected: 40 },
      { val: 6, expected: 80 },
      { val: 8, expected: 90 },
      { val: 15, expected: 100 }
    ];

    solidCases.forEach(({ val, expected }) => {
      const p = makeSolid(val);
      const res = recommendationService.evaluatePreferences(p, { highFiber: true });
      const score = recommendationService.calculatePersonalizedScore(res);
      assert.strictEqual(score, expected, `High Fiber Solid at ${val}g: expected ${expected}%, got ${score}%`);
    });

    // Cooking oils / infusions format constraint
    const oilProd = makeOil(20);
    const oilRes = recommendationService.evaluatePreferences(oilProd, { highFiber: true });
    const oilScore = recommendationService.calculatePersonalizedScore(oilRes);
    assert.strictEqual(oilScore, 0, `Cooking Oil format constraint must score 0% for High Fiber`);
  });

  runTest('1.5: Low Saturated Fat and Low Fat Curves', () => {
    const makeSatFat = (satFat) => ({
      identity: { categoryId: 1 },
      nutrition: { saturatedFat: satFat }
    });
    const makeFatSolid = (fat) => ({
      identity: { categoryId: 1 },
      nutrition: { fat }
    });
    const makeFatLiquid = (fat) => ({
      identity: { categoryId: 5 },
      nutrition: { fat }
    });

    const satFatCases = [
      { val: 0, expected: 100 },
      { val: 0.5, expected: 95 },
      { val: 1.5, expected: 85 },
      { val: 5, expected: 45 },
      { val: 10, expected: 0 }
    ];
    satFatCases.forEach(({ val, expected }) => {
      const res = recommendationService.evaluatePreferences(makeSatFat(val), { lowSaturatedFat: true });
      const score = recommendationService.calculatePersonalizedScore(res);
      assert.strictEqual(score, expected, `Low SatFat at ${val}g: expected ${expected}%, got ${score}%`);
    });

    const fatSolidCases = [
      { val: 0, expected: 100 },
      { val: 1.5, expected: 95 },
      { val: 3, expected: 85 },
      { val: 10, expected: 50 },
      { val: 25, expected: 0 }
    ];
    fatSolidCases.forEach(({ val, expected }) => {
      const res = recommendationService.evaluatePreferences(makeFatSolid(val), { lowFat: true });
      const score = recommendationService.calculatePersonalizedScore(res);
      assert.strictEqual(score, expected, `Low Fat Solid at ${val}g: expected ${expected}%, got ${score}%`);
    });
  });

  // =========================================================================
  // TEST SUITE 2: STRICT MONOTONICITY ACROSS DENSE RANGES
  // =========================================================================
  console.log('\n--- SUITE 2: STRICT MONOTONICITY ACROSS DENSE RANGES ---');

  runTest('2.1: Monotonicity of Low-X Preferences (ds / dx <= 0)', () => {
    // Low Sodium dense sweep (0 to 1200 mg in steps of 5 mg)
    let prevScore = 101;
    for (let mg = 0; mg <= 1200; mg += 5) {
      const p = { identity: { categoryId: 1 }, nutrition: { sodium: mg } };
      const res = recommendationService.evaluatePreferences(p, { lowSodium: true });
      const score = recommendationService.calculatePersonalizedScore(res);
      assert(score <= prevScore, `Monotonicity violated for Low Sodium at ${mg}mg (${score} > ${prevScore})`);
      prevScore = score;
    }

    // Low Sugar dense sweep (0 to 30 g in steps of 0.2 g)
    prevScore = 101;
    for (let g = 0; g <= 30; g += 0.2) {
      const p = { identity: { categoryId: 1 }, nutrition: { sugar: g } };
      const res = recommendationService.evaluatePreferences(p, { lowSugar: true });
      const score = recommendationService.calculatePersonalizedScore(res);
      assert(score <= prevScore, `Monotonicity violated for Low Sugar at ${g}g (${score} > ${prevScore})`);
      prevScore = score;
    }

    // Low Calories dense sweep (0 to 600 kcal in steps of 2 kcal)
    prevScore = 101;
    for (let cal = 0; cal <= 600; cal += 2) {
      const p = { identity: { categoryId: 1 }, nutrition: { calories: cal } };
      const res = recommendationService.evaluatePreferences(p, { lowCalories: true });
      const score = recommendationService.calculatePersonalizedScore(res);
      assert(score <= prevScore, `Monotonicity violated for Low Calories at ${cal} kcal (${score} > ${prevScore})`);
      prevScore = score;
    }
  });

  runTest('2.2: Monotonicity of High-X Preferences (ds / dx >= 0)', () => {
    // High Protein dense sweep (0 to 50 g in steps of 0.5 g)
    let prevScore = -1;
    for (let g = 0; g <= 50; g += 0.5) {
      const p = { identity: { categoryId: 1 }, nutrition: { protein: g } };
      const res = recommendationService.evaluatePreferences(p, { highProtein: true });
      const score = recommendationService.calculatePersonalizedScore(res);
      assert(score >= prevScore, `Monotonicity violated for High Protein at ${g}g (${score} < ${prevScore})`);
      prevScore = score;
    }

    // High Fiber dense sweep (0 to 20 g in steps of 0.5 g)
    prevScore = -1;
    for (let g = 0; g <= 20; g += 0.5) {
      const p = { identity: { categoryId: 1 }, nutrition: { fiber: g } };
      const res = recommendationService.evaluatePreferences(p, { highFiber: true });
      const score = recommendationService.calculatePersonalizedScore(res);
      assert(score >= prevScore, `Monotonicity violated for High Fiber at ${g}g (${score} < ${prevScore})`);
      prevScore = score;
    }
  });

  // =========================================================================
  // TEST SUITE 3: LOW CALORIES CONTINUITY AT 399 - 401 KCAL
  // =========================================================================
  console.log('\n--- SUITE 3: CONTINUITY AT 399-401 KCAL ---');

  runTest('3.1: Continuity around 400 kcal (Smooth transition, no cliff)', () => {
    const makeCal = (calories) => ({
      identity: { categoryId: 1 },
      nutrition: { calories }
    });

    const s399 = recommendationService.calculatePersonalizedScore(
      recommendationService.evaluatePreferences(makeCal(399), { lowCalories: true })
    );
    const s400 = recommendationService.calculatePersonalizedScore(
      recommendationService.evaluatePreferences(makeCal(400), { lowCalories: true })
    );
    const s401 = recommendationService.calculatePersonalizedScore(
      recommendationService.evaluatePreferences(makeCal(401), { lowCalories: true })
    );

    console.log(`     Score at 399 kcal: ${s399}%`);
    console.log(`     Score at 400 kcal: ${s400}%`);
    console.log(`     Score at 401 kcal: ${s401}%`);

    assert(s399 >= s400, 'Score at 399 must be >= score at 400');
    assert(s400 >= s401, 'Score at 400 must be >= score at 401');
    assert(Math.abs(s399 - s400) <= 1, `Jump between 399 and 400 must be <= 1%, was ${Math.abs(s399 - s400)}%`);
    assert(Math.abs(s400 - s401) <= 1, `Jump between 400 and 401 must be <= 1%, was ${Math.abs(s400 - s401)}%`);
    assert(s401 > 0, `Score at 401 kcal must remain positive (got ${s401}%)`);
  });

  // =========================================================================
  // TEST SUITE 4: MULTI-PREFERENCE AGGREGATION & ANTI-DILUTION GUARDS
  // =========================================================================
  console.log('\n--- SUITE 4: MULTI-PREFERENCE AGGREGATION & ANTI-DILUTION GUARDS ---');

  runTest('4.1: Critical Failure Guard (zero-match containment)', () => {
    // A product with 100% on one preference and 0% on another
    const mockProd2 = {
      identity: { categoryId: 1 },
      nutrition: { sodium: 0, calories: 550 } // Low Sodium = 100%, Low Calories = 0%
    };
    const res2 = recommendationService.evaluatePreferences(mockProd2, {
      lowSodium: true,
      lowCalories: true
    });
    const score2 = recommendationService.calculatePersonalizedScore(res2);
    assert(score2 <= 30, `Dual preference with one 0% must be capped <= 30%, got ${score2}%`);

    // A product with [100%, 0%, 100%]
    const mockProd3 = {
      identity: { categoryId: 1 },
      nutrition: { sodium: 0, calories: 550, sugar: 0 } // Low Sodium=100%, Low Cal=0%, Low Sugar=100%
    };
    const res3 = recommendationService.evaluatePreferences(mockProd3, {
      lowSodium: true,
      lowCalories: true,
      lowSugar: true
    });
    const score3 = recommendationService.calculatePersonalizedScore(res3);
    assert(score3 <= 30, `3-way preference with one 0% must be capped <= 30%, got ${score3}%`);

    // A product with [100%, 0%, 100%, 100%]
    const mockProd4 = {
      identity: { categoryId: 1 },
      nutrition: { sodium: 0, calories: 550, sugar: 0, saturatedFat: 0 }
    };
    const res4 = recommendationService.evaluatePreferences(mockProd4, {
      lowSodium: true,
      lowCalories: true,
      lowSugar: true,
      lowSaturatedFat: true
    });
    const score4 = recommendationService.calculatePersonalizedScore(res4);
    assert(score4 <= 30, `4-way preference with one 0% must be capped <= 30%, got ${score4}%`);

    // Multiple zeros decay: [100, 0, 0] should cap at 20%
    const mockProdMultiZero = {
      identity: { categoryId: 1 },
      nutrition: { sodium: 0, calories: 550, sugar: 30 } // 100%, 0%, 0%
    };
    const resMultiZero = recommendationService.evaluatePreferences(mockProdMultiZero, {
      lowSodium: true,
      lowCalories: true,
      lowSugar: true
    });
    const scoreMultiZero = recommendationService.calculatePersonalizedScore(resMultiZero);
    assert(scoreMultiZero <= 20, `Preference with two 0% scores must cap <= 20%, got ${scoreMultiZero}%`);
  });

  runTest('4.2: Severe Weakness Guard (min < 35)', () => {
    // 100% and 20% (e.g. sodium: 0mg, calories: 350 kcal -> cals = 20%)
    const prod = {
      identity: { categoryId: 1 },
      nutrition: { sodium: 0, calories: 350 }
    };
    const res = recommendationService.evaluatePreferences(prod, {
      lowSodium: true,
      lowCalories: true
    });
    const score = recommendationService.calculatePersonalizedScore(res);
    // Min = 20 < 35. Severe Weakness Cap = 40 + (20/35)*15 = 48.57%
    assert(score <= 49, `Score with severe weakness (min=20) must be capped <= 49%, got ${score}%`);
  });

  // =========================================================================
  // TEST SUITE 5: MISSING AND INVALID DATA HANDLING
  // =========================================================================
  console.log('\n--- SUITE 5: MISSING AND INVALID DATA POLICIES ---');

  runTest('5.1: Missing Nutrient assigns UNKNOWN (40%)', () => {
    const prodMissing = {
      identity: { categoryId: 1 },
      nutrition: { calories: 100 } // protein is missing
    };
    const res = recommendationService.evaluatePreferences(prodMissing, {
      highProtein: true
    });
    const item = res.results.find(r => r.preference === 'highProtein');
    assert.strictEqual(item.status, 'UNKNOWN', `Missing nutrient must be marked UNKNOWN`);
    assert.strictEqual(item.score, 40, `Missing nutrient must receive 40%`);
  });

  runTest('5.2: Aggregation with Missing Data', () => {
    // One known 100%, one missing 40%
    const prod = {
      identity: { categoryId: 1 },
      nutrition: { sodium: 0 } // calories missing
    };
    const res = recommendationService.evaluatePreferences(prod, {
      lowSodium: true,
      lowCalories: true
    });
    const score = recommendationService.calculatePersonalizedScore(res);
    // avg = (100 + 40)/2 = 70. min = 40.
    // 0.65 * 70 + 0.35 * 40 = 45.5 + 14 = 59.5 -> 60%
    assert.strictEqual(score, 60, `[100%, missing] must aggregate to 60%, got ${score}%`);
  });

  runTest('5.3: Physically Impossible Declarations (>105g/100g) assign 15%', () => {
    const corruptProduct = {
      identity: { categoryId: 1 },
      nutrition: { protein: 40, carbohydrates: 300, fat: 50, calories: 10 } // 390g macros per 100g
    };
    const res = recommendationService.evaluatePreferences(corruptProduct, {
      highProtein: true
    });
    const item = res.results.find(r => r.preference === 'highProtein');
    assert.strictEqual(item.status, 'UNKNOWN');
    assert.strictEqual(item.score, 15, `Physically invalid data must receive 15% severe penalty, got ${item.score}%`);
  });

  // =========================================================================
  // TEST SUITE 6: STRICT FRONTEND & BACKEND EXACT PARITY (500 SKUs)
  // =========================================================================
  console.log('\n--- SUITE 6: FRONTEND & BACKEND EXACT PARITY ACROSS 500 SKUs ---');

  const preferenceProfiles = [
    { name: 'Single: Low Sodium', prefs: { lowSodium: true } },
    { name: 'Single: High Protein', prefs: { highProtein: true } },
    { name: 'Single: Low Sugar', prefs: { lowSugar: true } },
    { name: 'Single: Low Calories', prefs: { lowCalories: true } },
    { name: 'Single: High Fiber', prefs: { highFiber: true } },
    { name: 'Single: Low Saturated Fat', prefs: { lowSaturatedFat: true } },
    { name: 'Single: Low Fat', prefs: { lowFat: true } },
    { name: 'Dual: Protein + Calories', prefs: { highProtein: true, lowCalories: true } },
    { name: 'Dual: Sugar + Saturated Fat', prefs: { lowSugar: true, lowSaturatedFat: true } },
    { name: '3-Way: Protein + Fiber + Sodium', prefs: { highProtein: true, highFiber: true, lowSodium: true } },
    { name: '4-Way: Protein + Cal + Sugar + Fiber', prefs: { highProtein: true, lowCalories: true, lowSugar: true, highFiber: true } },
    { name: 'All 7 Nutritional Goals', prefs: { highProtein: true, lowCalories: true, lowSugar: true, highFiber: true, lowSodium: true, lowSaturatedFat: true, lowFat: true } },
    { name: 'Lifestyle: Vegan Only', prefs: { vegan: true } },
    { name: 'Lifestyle: Vegetarian Only', prefs: { vegetarian: true } },
    { name: 'Allergen Exclusion: Peanuts', prefs: { avoidAllergens: ['peanuts', 'peanut'] } }
  ];

  preferenceProfiles.forEach(({ name, prefs }) => {
    runTest(`6.Parity: ${name} (500 SKUs)`, () => {
      let mismatches = 0;
      for (const product of products) {
        const beEval = recommendationService.evaluatePreferences(product, prefs);
        const beScore = recommendationService.calculatePersonalizedScore(beEval);

        const feEval = feScoring.evaluateProductPreferences(product, prefs);
        const feScore = feEval.matchScore;

        if (beScore !== feScore || beEval.isEligible !== feEval.isEligible) {
          mismatches++;
          console.error(`       Mismatch in ${product.identity?.name || product.product_name}: BE=${beScore}% (elig=${beEval.isEligible}), FE=${feScore}% (elig=${feEval.isEligible})`);
        }
      }
      assert.strictEqual(mismatches, 0, `Found ${mismatches} mismatches between frontend and backend for profile '${name}'`);
    });
  });

  // =========================================================================
  // TEST SUITE 7: QUALITY SCORE FORMULA LOCK & METRIC INDEPENDENCE
  // =========================================================================
  console.log('\n--- SUITE 7: QUALITY SCORE FORMULA LOCK & METRIC INDEPENDENCE ---');

  runTest('7.1: Quality Score Formula Weights are Strictly Locked (40/20/15/15/10)', () => {
    const weights = require('../config/scoringConfig').weights;
    assert.strictEqual(weights.nutrition, 0.40, 'Nutrition weight must be exactly 0.40');
    assert.strictEqual(weights.ingredients, 0.20, 'Ingredients weight must be exactly 0.20');
    assert.strictEqual(weights.processing, 0.15, 'Processing weight must be exactly 0.15');
    assert.strictEqual(weights.proteinFiber, 0.15, 'Protein & Fiber weight must be exactly 0.15');
    assert.strictEqual(weights.preferences, 0.10, 'Preferences weight must be exactly 0.10');
  });

  runTest('7.2: Changing User Preferences Does NOT Contaminate Catalog Quality Score', () => {
    const sample = products.slice(0, 30);
    sample.forEach(prod => {
      // Quality score without preferences
      const baselineScore = scoringService.calculateSmartChoiceScore(prod, {});

      // Quality score with high preferences
      const withPrefsScore = scoringService.calculateSmartChoiceScore(prod, {
        highProtein: true,
        lowCalories: true,
        lowSugar: true
      });

      // Product quality metrics (Nutrition, Ingredients, NOVA processing, Protein/Fiber) must remain identical
      assert.strictEqual(
        baselineScore.breakdown.nutrition.score,
        withPrefsScore.breakdown.nutrition.score,
        'Nutrition component of Quality Score must not change when preferences change'
      );
      assert.strictEqual(
        baselineScore.breakdown.ingredients.score,
        withPrefsScore.breakdown.ingredients.score,
        'Ingredients component of Quality Score must not change when preferences change'
      );
      assert.strictEqual(
        baselineScore.breakdown.processing.score,
        withPrefsScore.breakdown.processing.score,
        'Processing component of Quality Score must not change when preferences change'
      );
    });
  });

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n======================================================================');
  console.log(`TEST SUITE RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('======================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
