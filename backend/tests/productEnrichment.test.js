require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const assert = require('assert');
const productEnrichmentService = require('../services/productEnrichmentService');

async function runTests() {
  console.log('=== TEST SUITE 3: PRODUCT ENRICHMENT & MATCHING ===\n');
  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}: ${err.message}`);
    }
  }

  // 1. Match Evaluation: Exact Match
  await test('Matches when brand and product name strongly agree', () => {
    const catalogProduct = {
      catalog: {
        productId: 'PKG_PRD_0001',
        brand: 'Parle',
        productName: 'Parle-G Gold Biscuits',
        categoryName: 'Packaged Biscuits & Cookies'
      }
    };
    const offCandidate = {
      product_name: 'Parle-G Gold Biscuits',
      brands: 'Parle, Parle Products',
      categories: 'Biscuits, Cookies'
    };

    const res = productEnrichmentService.evaluateMatch(catalogProduct, offCandidate);
    assert.strictEqual(res.isMatch, true);
    assert.ok(res.confidence >= 0.75, `Expected >= 0.75 but got ${res.confidence}`);
  });

  // 2. Match Evaluation: Brand Mismatch
  await test('Rejects candidate when brand mismatches', () => {
    const catalogProduct = {
      catalog: {
        productId: 'PKG_PRD_0002',
        brand: 'Britannia',
        productName: 'Good Day Cashew Cookies',
        categoryName: 'Packaged Biscuits & Cookies'
      }
    };
    const offCandidate = {
      product_name: 'Good Day Cashew Cookies',
      brands: 'Sunfeast', // brand mismatch
      categories: 'Biscuits'
    };

    const res = productEnrichmentService.evaluateMatch(catalogProduct, offCandidate);
    assert.strictEqual(res.isMatch, false);
    assert.ok(res.reasons.some(r => r.includes('Brand mismatch')));
  });

  // 3. Match Evaluation: Ambiguous Match (Requires Review)
  await test('Sets requiresReview for ambiguous matches', () => {
    const catalogProduct = {
      catalog: {
        productId: 'PKG_PRD_0003',
        brand: 'Sunfeast',
        productName: 'Dark Fantasy Choco Fills',
        categoryName: 'Packaged Biscuits & Cookies'
      }
    };
    const offCandidate = {
      product_name: 'Dark Chocolate Biscuit Bites', // partial name overlap
      brands: 'Sunfeast',
      categories: 'Biscuits'
    };

    const res = productEnrichmentService.evaluateMatch(catalogProduct, offCandidate);
    assert.strictEqual(res.requiresReview, true);
    assert.ok(res.confidence >= 0.55 && res.confidence < 0.75);
  });

  // 4. Match Evaluation: No match
  await test('Flags unrelated product as not a match', () => {
    const catalogProduct = {
      catalog: {
        productId: 'PKG_PRD_0004',
        brand: 'Amul',
        productName: 'Amul Butter',
        categoryName: 'Packaged Dairy & Cheese'
      }
    };
    const offCandidate = {
      product_name: 'Tomato Ketchup',
      brands: 'Kissan',
      categories: 'Sauces'
    };

    const res = productEnrichmentService.evaluateMatch(catalogProduct, offCandidate);
    assert.strictEqual(res.isMatch, false);
    assert.strictEqual(res.requiresReview, false);
    assert.ok(res.confidence < 0.55);
  });

  // 5. Nutritional Normalization: Per 100g Detection
  await test('Correctly detects per_100g basis and extracts standard nutrients', () => {
    const offNutriments = {
      'energy-kcal_100g': 450,
      'proteins_100g': 7.5,
      'carbohydrates_100g': 70,
      'sugars_100g': 25,
      'fat_100g': 15,
      'saturated-fat_100g': 6.5,
      'sodium_100g': 0.28 // 0.28g -> 280mg
    };

    const res = productEnrichmentService.extractAndNormalizeNutriments(offNutriments, '30 g');
    assert.strictEqual(res.originalBasis, 'per_100g');
    assert.strictEqual(res.normalized.calories, 450);
    assert.strictEqual(res.normalized.protein, 7.5);
    assert.strictEqual(res.normalized.carbohydrates, 70);
    assert.strictEqual(res.normalized.sugar, 25);
    assert.strictEqual(res.normalized.fat, 15);
    assert.strictEqual(res.normalized.saturatedFat, 6.5);
    assert.strictEqual(res.normalized.sodium, 280);
    assert.strictEqual(res.normalized.fiber, null); // Zero fabrication check
    assert.strictEqual(res.normalized.addedSugars, null); // Zero fabrication check
  });

  // 6. Nutritional Normalization: Per Serving Conversion
  await test('Detects per_serving basis and converts to per_100g using serving size', () => {
    const offNutriments = {
      'energy-kcal_serving': 100, // 100 kcal in 25g -> 400 kcal per 100g
      'proteins_serving': 2,      // 2g in 25g -> 8g per 100g
      'fat_serving': 5            // 5g in 25g -> 20g per 100g
    };

    const res = productEnrichmentService.extractAndNormalizeNutriments(offNutriments, '25 g');
    assert.strictEqual(res.originalBasis, 'per_serving');
    assert.strictEqual(res.normalized.calories, 400);
    assert.strictEqual(res.normalized.protein, 8);
    assert.strictEqual(res.normalized.fat, 20);
    assert.strictEqual(res.normalized.sugar, null); // Missing nutrient stays null
  });

  // 7. Preservation of Original Payload
  await test('Preserves raw nutrient values in snapshot', () => {
    const offNutriments = {
      'energy-kcal_100g': 520,
      'proteins_100g': 9.2
    };
    const res = productEnrichmentService.extractAndNormalizeNutriments(offNutriments, '100g');
    assert.strictEqual(res.rawValuesSnapshot['energy-kcal'], 520);
    assert.strictEqual(res.rawValuesSnapshot['proteins'], 9.2);
  });

  console.log(`\nEnrichment Tests Summary: ${passed}/${total} passed.\n`);
  if (passed !== total) process.exit(1);
}

runTests().catch(err => {
  console.error('Enrichment test suite error:', err);
  process.exit(1);
});
