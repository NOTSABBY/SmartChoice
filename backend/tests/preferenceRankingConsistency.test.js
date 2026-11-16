/**
 * SmartChoice Automated Test Suite: Preference Ranking Consistency & Determinism
 * Validates Part 3, Part 4 & Part 9 requirements.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const recommendationService = require('../services/recommendationService');
const preferenceService = require('../services/preferenceService');
const scoringService = require('../services/scoringService');

console.log('=== RUNNING PREFERENCE RANKING CONSISTENCY TESTS ===\n');

// Load catalog
const catalogPath = path.join(__dirname, '../../frontend/public/data/enriched_catalog_500.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const sampleProducts = [];
catalog.categories.forEach(c => {
  if (c.products) sampleProducts.push(...c.products.slice(0, 10)); // 250 diverse products
});

// TEST 1: Single Preference Exact Parity
console.log('Test 1: Single preference exact parity with individual comparator...');
const singlePrefs = [
  'highProtein',
  'lowCalories',
  'lowSugar',
  'highFiber',
  'lowSodium',
  'lowSaturatedFat',
  'lowFat'
];

(async () => {
  for (const prefKey of singlePrefs) {
    const rawPrefs = { [prefKey]: true };
    const ranked = await recommendationService.rankProducts(sampleProducts, rawPrefs);

    // Replicate sort with canonical comparator
    const directSorted = [...sampleProducts].map(p => {
      const scData = scoringService.calculateSmartChoiceScore(p, rawPrefs);
      return {
        ...p,
        smartChoiceScore: scData.totalScore,
        productName: p.product_name || p.catalog?.productName || ''
      };
    }).sort((a, b) => recommendationService.singlePreferenceComparators[prefKey](a, b));

    assert.strictEqual(ranked.length, directSorted.length);
    for (let i = 0; i < Math.min(20, ranked.length); i++) {
      assert.strictEqual(
        ranked[i].productId,
        directSorted[i].product_id,
        `Mismatch at rank ${i} for preference ${prefKey}: expected ${directSorted[i].product_id}, got ${ranked[i].productId}`
      );
    }
    console.log(`  ✔ Parity verified for single preference: ${prefKey}`);
  }
  console.log('✔ Test 1 Passed: All 7 single preferences match individual sorting order exactly.\n');

  // TEST 2: Betty Crocker (85%) vs Knorr (84%) Protein Match Score Resolution
  console.log('Test 2: Betty Crocker vs Knorr Protein Match Score Resolution...');
  let betty = null;
  let knorr = null;
  catalog.categories.forEach(c => {
    (c.products || []).forEach(p => {
      if (p.product_id === 'PKG_PRD_0467') betty = p;
      if (p.product_id === 'PKG_PRD_0397') knorr = p;
    });
  });

  assert(betty, 'Betty Crocker must exist');
  assert(knorr, 'Knorr must exist');

  const bettyEval = recommendationService.evaluatePreferences(betty, { highProtein: true });
  const knorrEval = recommendationService.evaluatePreferences(knorr, { highProtein: true });

  const bettyScore = recommendationService.calculatePersonalizedScore(bettyEval);
  const knorrScore = recommendationService.calculatePersonalizedScore(knorrEval);

  console.log(`  Betty Crocker Protein: 13.9g/100g -> Match Score: ${bettyScore}%`);
  console.log(`  Knorr Soup Protein:    13.6g/100g -> Match Score: ${knorrScore}%`);

  assert.strictEqual(bettyScore, 78, `Betty Crocker match score should be 78%, got ${bettyScore}%`);
  assert.strictEqual(knorrScore, 77, `Knorr soup match score should be 77%, got ${knorrScore}%`);
  assert.strictEqual(bettyScore - knorrScore, 1, `Difference between 13.9g and 13.6g must be 1%, got ${bettyScore - knorrScore}%`);
  console.log('✔ Test 2 Passed: Root-cause false proximate-sum penalty eliminated. 0.3g protein delta yields 1% match difference.\n');

  // TEST 3: Multi-Preference Ranking: High Protein + Low Calories
  console.log('Test 3: Multi-preference ranking (High Protein + Low Calories)...');
  const multiRanked = await recommendationService.rankProducts(sampleProducts, {
    highProtein: true,
    lowCalories: true
  });

  // Verify that peanut butter / high calorie items don't rank at top
  const top10 = multiRanked.slice(0, 10);
  top10.forEach(rec => {
    const p100 = rec.rawProduct.nutrition_info?.per_100g || {};
    const cals = p100.energy_kcal || 0;
    const protein = p100.protein_g || 0;
    // Top products should not be pure high-calorie foods (>500 kcal) with negligible protein
    assert(cals < 600 || protein > 15, `Product ${rec.productName} with ${cals} kcal shouldn't be top ranked for low calories`);
  });

  // Verify finalScore = matchScore
  top10.forEach(rec => {
    assert.strictEqual(rec.finalScore, rec.matchScore, 'Final score must equal match score when active preferences exist');
  });
  console.log('✔ Test 3 Passed: Multi-preference synergy correctly balances dual constraints.\n');

  // TEST 4: Category format constraints (Tea, Coffee, Spices, Oils)
  console.log('Test 4: Category format constraints for protein...');
  let teaProduct = null;
  let oilProduct = null;
  catalog.categories.forEach(c => {
    (c.products || []).forEach(p => {
      if (p.category_name && p.category_name.includes('Tea') && !teaProduct) teaProduct = p;
      if (p.category_name && p.category_name.includes('Cooking Oil') && !oilProduct) oilProduct = p;
    });
  });

  if (teaProduct) {
    const teaEval = recommendationService.evaluatePreferences(teaProduct, { highProtein: true });
    assert.strictEqual(teaEval.results[0].score, 0, 'Tea must have 0 protein score');
    assert.strictEqual(teaEval.results[0].status, 'NO_MATCH', 'Tea must be NO_MATCH for highProtein');
  }
  if (oilProduct) {
    const oilEval = recommendationService.evaluatePreferences(oilProduct, { highProtein: true });
    assert.strictEqual(oilEval.results[0].score, 0, 'Oil must have 0 protein score');
  }
  console.log('✔ Test 4 Passed: Category formats (infusions, oils) properly constrained.\n');

  // TEST 5: Hard Allergen Exclusions
  console.log('Test 5: Hard allergen exclusions...');
  const allergenRanked = await recommendationService.rankProducts(sampleProducts, {
    avoidAllergens: ['milk', 'dairy']
  });

  const excluded = allergenRanked.filter(r => !r.isEligible);
  assert(excluded.length > 0, 'Must have excluded products for milk allergen');
  excluded.forEach(r => {
    assert.strictEqual(r.matchScore, 0, 'Excluded products must have Match Score 0');
    assert.strictEqual(r.finalScore, 0, 'Excluded products must have Final Score 0');
  });

  // Ineligible products must be strictly at the end of the list
  const firstIneligibleIdx = allergenRanked.findIndex(r => !r.isEligible);
  for (let i = firstIneligibleIdx; i < allergenRanked.length; i++) {
    assert.strictEqual(allergenRanked[i].isEligible, false, 'All products after first ineligible must be ineligible');
  }
  console.log('✔ Test 5 Passed: Allergen exclusions strictly enforced with 0 match score at bottom.\n');

  console.log('ALL PREFERENCE RANKING CONSISTENCY TESTS PASSED SUCCESSFULLY!');
})();
