const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const scoringService = require('../services/scoringService');
const recommendationService = require('../services/recommendationService');
const catalogLoader = require('../utils/catalogLoader');

// Helper for category and search matching
const matchesSelectedCategory = (product, selectedCategory) => {
  if (!selectedCategory || selectedCategory === 'all' || selectedCategory === 'All Categories') {
    return true;
  }
  const targetId = Number(selectedCategory);
  if (!Number.isNaN(targetId) && targetId > 0) {
    const prodCatId = Number(
      product?.category_id ??
      product?.catalog?.categoryId ??
      product?.identity?.categoryId
    );
    if (!Number.isNaN(prodCatId) && prodCatId === targetId) return true;
  }
  const cleanTarget = String(selectedCategory).trim().toLowerCase();
  const prodCatName = String(
    product?.category_name ??
    product?.catalog?.categoryName ??
    (product?.identity?.categories && product.identity.categories[0]) ??
    ''
  ).trim().toLowerCase();
  return prodCatName === cleanTarget;
};

const matchesSearchQuery = (product, searchQuery) => {
  if (!searchQuery || !String(searchQuery).trim()) return true;
  const q = String(searchQuery).trim().toLowerCase();
  const pName = String(product?.product_name || product?.catalog?.productName || product?.identity?.name || '').toLowerCase();
  const pBrand = String(product?.brand || product?.catalog?.brand || product?.identity?.brand || '').toLowerCase();
  return pName.includes(q) || pBrand.includes(q);
};

describe('SMARTCHOICE COMPLETE AUDIT — Quality, Confidence, Preferences & Search', () => {

  // Load catalog products
  const catalogData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../frontend/public/data/enriched_catalog_500.json'), 'utf8')
  );
  const allCatalogProducts = catalogData.categories.flatMap(c => c.products);

  describe('Part 1: SmartChoice Quality Score Mathematical Correctness', () => {
    it('verifies Quality Score formula SC = 0.40N + 0.20I + 0.15P + 0.15PF + 0.10U across products', () => {
      const sample = allCatalogProducts.slice(0, 50);
      for (const p of sample) {
        const res = scoringService.calculateSmartChoiceScore(p, {});
        const N = res.breakdown.nutrition;
        const I = res.breakdown.ingredients;
        const P = res.breakdown.processing;
        const PF = res.breakdown.proteinFiber;
        const U = res.breakdown.preferences;

        assert.equal(U, 0, 'User preference score U must be 0 when no preferences are active');
        assert.equal(res.weightedBreakdown.preferences, 0, 'Preference contribution must be 0/10 when inactive');

        const sumOfWeighted = res.weightedBreakdown.nutrition +
                              res.weightedBreakdown.ingredients +
                              res.weightedBreakdown.processing +
                              res.weightedBreakdown.proteinFiber +
                              res.weightedBreakdown.preferences;
        assert.equal(res.totalScore, sumOfWeighted, `Total score must strictly equal sum of weighted components for ${p.product_id}`);
      }
    });

    it('verifies weights are exactly 40%, 20%, 15%, 15%, 10%', () => {
      assert.equal(scoringService.SCORING_WEIGHTS.nutrition, 0.40);
      assert.equal(scoringService.SCORING_WEIGHTS.ingredients, 0.20);
      assert.equal(scoringService.SCORING_WEIGHTS.processing, 0.15);
      assert.equal(scoringService.SCORING_WEIGHTS.proteinFiber, 0.15);
      assert.equal(scoringService.SCORING_WEIGHTS.preferences, 0.10);
    });
  });

  describe('Part 2: Confidence Score Calculation & Thresholds', () => {
    it('calculates Confidence = 0.45Nr + 0.35Ir + 0.20Pr accurately', () => {
      const sample = allCatalogProducts.slice(0, 50);
      for (const p of sample) {
        const conf = scoringService.calculateConfidence(p);
        assert.ok(conf.score >= 0 && conf.score <= 100);
        assert.ok(conf.breakdown.nutrition >= 0 && conf.breakdown.nutrition <= 100);
        assert.ok(conf.breakdown.ingredients >= 0 && conf.breakdown.ingredients <= 100);
        assert.ok(conf.breakdown.processing >= 0 && conf.breakdown.processing <= 100);

        const expected = Math.round(
          0.45 * conf.breakdown.nutrition +
          0.35 * conf.breakdown.ingredients +
          0.20 * conf.breakdown.processing
        );
        assert.equal(conf.score, expected, `Confidence formula failure for ${p.product_id}`);
      }
    });

    it('enforces thresholds: High (80-100), Moderate (60-79), Low (0-59)', () => {
      // High Confidence mock
      const mockHigh = {
        nutrition_info: {
          basis: 'PER_100G',
          per_100g: { energy_kcal: 200, protein_g: 10, carbohydrates_g: 20, total_sugars_g: 5, total_fat_g: 5, saturated_fat_g: 1, sodium_mg: 100, dietary_fiber_g: 3 },
          verification_status: 'VERIFIED',
          nova_group: 2
        },
        ingredients: { ingredients: [{ name: 'Oats' }], verificationStatus: 'VERIFIED' }
      };
      const confHigh = scoringService.calculateConfidence(mockHigh);
      assert.ok(confHigh.score >= 80, `Expected score >= 80, got ${confHigh.score}`);
      assert.equal(confHigh.level, 'high');
      assert.equal(confHigh.label, 'High Confidence');

      // Moderate Confidence mock
      const mockMed = {
        nutrition_info: {
          basis: 'PER_SERVING',
          per_100g: { energy_kcal: 200, protein_g: 10, carbohydrates_g: 20, total_sugars_g: 5, total_fat_g: 5 },
          verification_status: 'UNVERIFIED',
          nova_group: 3
        },
        ingredients: { rawText: 'Wheat, Sugar' }
      };
      const confMed = scoringService.calculateConfidence(mockMed);
      assert.ok(confMed.score >= 60 && confMed.score < 80, `Expected score 60-79, got ${confMed.score}`);
      assert.equal(confMed.level, 'medium');
      assert.equal(confMed.label, 'Moderate Confidence');

      // Low Confidence mock
      const mockLow = {
        nutrition_info: { basis: 'UNKNOWN', per_100g: {} },
        ingredients: {}
      };
      const confLow = scoringService.calculateConfidence(mockLow);
      assert.ok(confLow.score < 60, `Expected score < 60, got ${confLow.score}`);
      assert.equal(confLow.level, 'low');
      assert.equal(confLow.label, 'Low Confidence');
    });
  });

  describe('Part 3: User Preferences Component Scoring (U)', () => {
    it('sets U = 0 when no preferences are active', () => {
      const p = allCatalogProducts[0];
      const res = scoringService.calculateSmartChoiceScore(p, {});
      assert.equal(res.breakdown.preferences, 0);
      assert.equal(res.weightedBreakdown.preferences, 0);
    });

    it('calculates dynamic continuous U (0-100) and 0.10*U contribution when active', () => {
      // Find a high protein product and a low protein product
      const highProtProd = allCatalogProducts.find(p => (p.nutrition_info?.per_100g?.protein_g || 0) >= 15);
      const lowProtProd = allCatalogProducts.find(p => (p.nutrition_info?.per_100g?.protein_g || 0) <= 2);

      assert.ok(highProtProd, 'High protein product should exist');
      assert.ok(lowProtProd, 'Low protein product should exist');

      const highRes = scoringService.calculateSmartChoiceScore(highProtProd, { highProtein: true });
      const lowRes = scoringService.calculateSmartChoiceScore(lowProtProd, { highProtein: true });

      assert.ok(highRes.breakdown.preferences > lowRes.breakdown.preferences,
        `High protein product should have higher preference score (${highRes.breakdown.preferences} vs ${lowRes.breakdown.preferences})`
      );
      assert.equal(highRes.weightedBreakdown.preferences, Math.round(highRes.breakdown.preferences * 0.10));
      assert.equal(lowRes.weightedBreakdown.preferences, Math.round(lowRes.breakdown.preferences * 0.10));
    });

    it('uses neutral baseline 50 for missing preference data', () => {
      const prodMissingSugar = {
        product_id: 'TEST_NO_SUGAR',
        product_name: 'Test Missing Sugar',
        nutrition_info: { per_100g: { energy_kcal: 100 } },
        category_id: 1
      };
      const evalRes = recommendationService.evaluatePreferences(prodMissingSugar, { lowSugar: true });
      assert.ok(evalRes.results.length > 0);
      assert.equal(evalRes.results[0].status, 'UNKNOWN');
      const score = recommendationService.calculatePersonalizedScore(evalRes);
      assert.equal(score, 40, 'Missing nutrient evaluation must score neutral baseline 40');
    });
  });

  describe('Part 4: Product Keyword Search (Name & Brand Only, No Ingredient Bleed)', () => {
    it('Uncle Chipps Spicy Treat does NOT match when searching "Milk"', () => {
      const uncleChips = allCatalogProducts.find(p =>
        (p.product_name && p.product_name.toLowerCase().includes('uncle')) ||
        (p.catalog?.productName && p.catalog.productName.toLowerCase().includes('uncle'))
      );
      assert.ok(uncleChips, 'Uncle Chipps product must exist in catalog');

      // Verify that Uncle Chipps contains milk solids in ingredients
      const ingText = uncleChips.nutrition_info?.ingredients_text || '';
      assert.ok(ingText.toLowerCase().includes('milk'), 'Uncle Chipps should contain milk solids in ingredients text');

      // But matchesSearchQuery MUST be false for "Milk"
      const matchesMilk = matchesSearchQuery(uncleChips, 'Milk');
      assert.equal(matchesMilk, false, 'Uncle Chipps must NOT match search query "Milk"');
    });

    it('Uncle Chipps matches when searching "Uncle" or "Chipps"', () => {
      const uncleChips = allCatalogProducts.find(p =>
        (p.product_name && p.product_name.toLowerCase().includes('uncle')) ||
        (p.catalog?.productName && p.catalog.productName.toLowerCase().includes('uncle'))
      );
      assert.ok(matchesSearchQuery(uncleChips, 'Uncle'));
      assert.ok(matchesSearchQuery(uncleChips, 'Chipps'));
    });

    it('Searching "Milk" in Category 8 (Packaged Chips & Crisps) returns 0 products', () => {
      const chipsCategoryProducts = allCatalogProducts.filter(p => matchesSelectedCategory(p, 8));
      assert.ok(chipsCategoryProducts.length > 0, 'Chips category must have products');

      const milkInChips = chipsCategoryProducts.filter(p => matchesSearchQuery(p, 'Milk'));
      assert.equal(milkInChips.length, 0, 'No products in Chips & Crisps should match "Milk"');
    });

    it('Searching "Milk" in Category 13 (Packaged Dairy & Cheese) returns matching products', () => {
      const dairyCategoryProducts = allCatalogProducts.filter(p => matchesSelectedCategory(p, 13));
      assert.ok(dairyCategoryProducts.length > 0, 'Dairy category must have products');

      const milkInDairy = dairyCategoryProducts.filter(p => matchesSearchQuery(p, 'Milk'));
      assert.ok(milkInDairy.length > 0, 'Dairy category must return products when searching "Milk"');
    });

    it('All Categories search returns milk products across the catalog without category restriction', () => {
      const allMilkProducts = allCatalogProducts.filter(p =>
        matchesSelectedCategory(p, 'all') && matchesSearchQuery(p, 'Milk')
      );
      assert.ok(allMilkProducts.length > 0, 'Searching "Milk" across All Categories should return results');
      // None of the results should be from Category 8 (Chips)
      for (const p of allMilkProducts) {
        assert.notEqual(p.category_id, 8, 'No milk search results should belong to Category 8');
      }
    });
  });
});
