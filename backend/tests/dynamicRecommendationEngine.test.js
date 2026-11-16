const assert = require('assert');
const catalogLoader = require('../utils/catalogLoader');
const recommendationService = require('../services/recommendationService');
const scoringService = require('../services/scoringService');
const { singlePreferenceComparators, extractNutrient } = recommendationService;

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`[PASS] ${description}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${description}`);
    console.error(`       Error: ${err.message}`);
    failed++;
  }
}

async function runAsyncTest(description, asyncFn) {
  try {
    await asyncFn();
    console.log(`[PASS] ${description}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${description}`);
    console.error(`       Error: ${err.message}`);
    failed++;
  }
}

async function runAllTests() {
  console.log('=== TEST SUITE: COMPLETE DYNAMIC, MULTI-PREFERENCE RECOMMENDATION ENGINE ===\n');

  const products = catalogLoader.loadProductsFromDisk();
  console.log(`Loaded ${products.length} live products from disk/catalog.\n`);
  assert(products.length >= 100, 'Catalog must load at least 100 products for testing');

  // ==========================================
  // SECTION 1: SINGLE-PREFERENCE PARITY TESTS
  // ==========================================
  console.log('--- 1. SINGLE-PREFERENCE EXACT PARITY TESTS ---');

  const singlePrefs = [
    { key: 'highProtein', name: 'High Protein', sortKey: 'highProtein' },
    { key: 'lowCalories', name: 'Low Calories', sortKey: 'lowCalories' },
    { key: 'lowSugar', name: 'Low Sugar', sortKey: 'lowSugar' },
    { key: 'highFiber', name: 'High Fibre', sortKey: 'highFiber' },
    { key: 'lowSodium', name: 'Low Sodium', sortKey: 'lowSodium' },
    { key: 'lowSaturatedFat', name: 'Low Saturated Fat', sortKey: 'lowSaturatedFat' }
  ];

  for (const p of singlePrefs) {
    await runAsyncTest(`SP-${p.key}: SmartChoice Recommended when only [${p.name}] is active exactly matches individual sort`, async () => {
      const recs = await recommendationService.rankProducts(products, { [p.key]: true });
      const recIds = recs.map(r => r.productId);

      // Directly sort using the individual canonical comparator with calculated quality score for tie-breaking
      const directSorted = [...products].sort((a, b) => {
        const sa = scoringService.calculateSmartChoiceScore(a, { [p.key]: true }).totalScore;
        const sb = scoringService.calculateSmartChoiceScore(b, { [p.key]: true }).totalScore;
        const pA = { ...a, smartChoiceScore: sa, productName: a.identity?.name || a.product_name || '' };
        const pB = { ...b, smartChoiceScore: sb, productName: b.identity?.name || b.product_name || '' };
        return singlePreferenceComparators[p.sortKey](pA, pB);
      });
      const directIds = directSorted.map(item => item._id ? item._id.toString() : (item.catalog?.productId || item.identity?.barcode));

      // Assert top 20 ordered IDs match exactly
      const topRec = recIds.slice(0, 20);
      const topDirect = directIds.slice(0, 20);
      assert.deepStrictEqual(topRec, topDirect, `Top 20 IDs must be identical for ${p.name}`);
    });
  }

  // ==========================================
  // SECTION 2: MULTI-PREFERENCE DYNAMIC COMBINATIONS
  // ==========================================
  console.log('\n--- 2. DYNAMIC MULTI-PREFERENCE COMBINATION TESTS ---');

  const testCombinations = [
    { name: 'High Protein + Low Calories', prefs: { highProtein: true, lowCalories: true } },
    { name: 'High Protein + Low Sugar', prefs: { highProtein: true, lowSugar: true } },
    { name: 'High Protein + Low Sodium', prefs: { highProtein: true, lowSodium: true } },
    { name: 'High Protein + High Fibre', prefs: { highProtein: true, highFiber: true } },
    { name: 'Low Calories + Low Sugar', prefs: { lowCalories: true, lowSugar: true } },
    { name: 'Low Sugar + Low Saturated Fat', prefs: { lowSugar: true, lowSaturatedFat: true } },
    { name: 'High Protein + Low Calories + Low Sugar', prefs: { highProtein: true, lowCalories: true, lowSugar: true } },
    { name: 'High Protein + High Fibre + Low Sodium', prefs: { highProtein: true, highFiber: true, lowSodium: true } },
    { name: 'Low Calories + Low Sodium + Low Saturated Fat', prefs: { lowCalories: true, lowSodium: true, lowSaturatedFat: true } },
    { name: '4-Way: Protein + Calories + Sugar + Fibre', prefs: { highProtein: true, lowCalories: true, lowSugar: true, highFiber: true } },
    { name: '5-Way: Protein + Calories + Sugar + Fibre + Sodium', prefs: { highProtein: true, lowCalories: true, lowSugar: true, highFiber: true, lowSodium: true } },
    { name: 'All 6 Nutritional Goals Combined', prefs: { highProtein: true, lowCalories: true, lowSugar: true, highFiber: true, lowSodium: true, lowSaturatedFat: true } }
  ];

  for (const combo of testCombinations) {
    await runAsyncTest(`MP-Combo: ${combo.name}`, async () => {
      const recs = await recommendationService.rankProducts(products, combo.prefs);
      assert(recs.length > 0, 'Must produce ranked recommendations');

      const topItem = recs[0];
      assert(topItem.matchScore != null, 'Top item must have a calculated matchScore');
      assert(topItem.personalization?.preferenceResults?.length >= Object.keys(combo.prefs).length,
        'Every active preference must be independently evaluated in results');

      // Verify that all active preferences are present in evaluation results
      const evaluatedKeys = topItem.personalization.preferenceResults.map(r => r.preference);
      for (const k of Object.keys(combo.prefs)) {
        assert(evaluatedKeys.includes(k), `Preference ${k} must be evaluated`);
      }

      // Check synergy formula: no top product should have 0 score on a preference while receiving >= 85% match score
      const anyZero = topItem.personalization.preferenceResults.some(r => r.score === 0);
      if (anyZero) {
        assert(topItem.matchScore < 80, 'Synergy formula must pull down match score if any goal has 0 compatibility');
      }
    });
  }

  // ==========================================
  // SECTION 3: DIETARY LIFESTYLE & HARD EXCLUSIONS
  // ==========================================
  console.log('\n--- 3. HARD CONSTRAINTS & DIETARY EXCLUSIONS ---');

  await runAsyncTest('HC-01: Avoid Allergens hard exclusion marks products ineligible', async () => {
    const recs = await recommendationService.rankProducts(products, {
      highProtein: true,
      avoidAllergens: ['milk']
    });

    const milkProducts = recs.filter(r => {
      const ing = (r.rawProduct?.nutrition_info?.ingredients_text || r.rawProduct?.ingredients?.rawText || '').toLowerCase();
      const declared = (r.rawProduct?.nutrition_info?.allergens || []).map(a => String(a).toLowerCase());
      return ing.includes('milk') || declared.some(d => d.includes('milk'));
    });

    assert(milkProducts.length > 0, 'Catalog must contain milk products to test');
    for (const p of milkProducts) {
      assert.strictEqual(p.isEligible, false, `Product ${p.productName} containing milk must be marked isEligible: false`);
      assert.strictEqual(p.matchScore, 0, `Ineligible product ${p.productName} must have matchScore: 0`);
    }

    // Ineligible products must be ranked after eligible products
    const firstIneligibleIdx = recs.findIndex(r => !r.isEligible);
    const lastEligibleIdx = recs.map(r => r.isEligible).lastIndexOf(true);
    if (firstIneligibleIdx !== -1 && lastEligibleIdx !== -1) {
      assert(firstIneligibleIdx > lastEligibleIdx, 'All eligible products must rank above ineligible products');
    }
  });

  await runAsyncTest('HC-02: Excluded Ingredients hard exclusion drops eligibility', async () => {
    const recs = await recommendationService.rankProducts(products, {
      highProtein: true,
      excludedIngredients: ['palm oil']
    });

    const palmProducts = recs.filter(r => {
      const ing = (r.rawProduct?.nutrition_info?.ingredients_text || '').toLowerCase();
      return ing.includes('palm oil');
    });

    for (const p of palmProducts) {
      assert.strictEqual(p.isEligible, false, `Product ${p.productName} containing palm oil must be ineligible`);
    }
  });

  await runAsyncTest('HC-03: Vegetarian dietary lifestyle prioritizes vegetarian foods', async () => {
    const recs = await recommendationService.rankProducts(products, { vegetarian: true });
    assert(recs.length > 0);
    const top10 = recs.slice(0, 10);
    for (const p of top10) {
      const vegEval = p.personalization.preferenceResults.find(r => r.preference === 'vegetarian');
      assert(vegEval && (vegEval.status === 'MATCH' || vegEval.score >= 50),
        `Top products under vegetarian filter must satisfy vegetarian criteria: ${p.productName}`);
    }
  });

  // ==========================================
  // SECTION 4: MISSING DATA & PHYSICAL PLAUSIBILITY
  // ==========================================
  console.log('\n--- 4. MISSING DATA & PHYSICAL VALIDITY BOUNDARIES ---');

  test('MD-01: Incomplete nutrient data marked UNKNOWN with confidence penalty', () => {
    const mockProduct = {
      _id: 'mock_missing_data_1',
      identity: { name: 'Mystery Food' },
      nutrition: {}, // No protein, calories, etc.
      nutrition_info: { per_100g: {} }
    };

    const evalRes = recommendationService.evaluatePreferences(mockProduct, {
      highProtein: true,
      lowCalories: true
    });

    assert.strictEqual(evalRes.unknownCount, 2, 'Both missing preferences must be counted as unknown');
    const pEval = evalRes.results.find(r => r.preference === 'highProtein');
    assert.strictEqual(pEval.status, 'UNKNOWN');
    assert(pEval.score <= 50, 'Unknown preference must not receive full compatibility score');
  });

  test('MD-02: Physically impossible declarations (>105g/100g) rejected from top matches', () => {
    const corruptProduct = {
      _id: 'mock_corrupt_1',
      identity: { name: 'Impossible Spread' },
      nutrition: { protein: 40, carbohydrates: 300, fat: 50, calories: 10 }, // 390g macros / 100g
      nutrition_info: { per_100g: { protein_g: 40, carbohydrates_g: 300, total_fat_g: 50, energy_kcal: 10 } }
    };

    const evalRes = recommendationService.evaluatePreferences(corruptProduct, {
      highProtein: true,
      lowCalories: true
    });

    const pEval = evalRes.results.find(r => r.preference === 'highProtein');
    assert.strictEqual(pEval.status, 'UNKNOWN');
    assert.strictEqual(pEval.score, 15);
  });

  // ==========================================
  // SECTION 5: EMPTY STATE BEHAVIOUR
  // ==========================================
  console.log('\n--- 5. EMPTY STATE LOGIC ---');

  await runAsyncTest('ES-01: No active preferences preserves baseline SmartChoice quality ranking', async () => {
    const recs = await recommendationService.rankProducts(products, {});
    assert(recs.length > 0);
    // When no preferences, finalScore equals smartChoiceScore
    for (let i = 0; i < Math.min(20, recs.length); i++) {
      assert.strictEqual(recs[i].finalScore, recs[i].smartChoiceScore,
        'Without active preferences, finalScore must equal smartChoiceScore');
    }
  });

  console.log(`\n==========================================`);
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
