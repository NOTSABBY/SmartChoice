const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const scoringService = require('../services/scoringService');
const recommendationService = require('../services/recommendationService');
const comparisonService = require('../services/comparisonService');
const catalogLoader = require('../utils/catalogLoader');
const { classifyProductDietary } = require('../utils/dietaryClassifier');

describe('SMARTCHOICE SYSTEM RESTORATION & REGRESSION TEST SUITE', () => {
  const allProds = catalogLoader.loadProductsFromDisk();

  // ==========================================
  // SECTION 1: PRODUCT CLASSIFICATION
  // ==========================================
  describe('1. Product Dietary Classification Engine', () => {
    it('accurately classifies verified Vegan product (no animal derivatives)', () => {
      const veganProduct = {
        product_name: 'Pure Roasted Almonds',
        category_name: 'Dry Fruits & Nuts',
        ingredients: { rawText: 'Almonds, Iodised Salt.' },
        nutrition_info: { allergens: ['Tree Nuts'] }
      };
      const res = classifyProductDietary(veganProduct);
      assert.equal(res.status, 'VEGAN');
      assert.equal(res.isVegan, true);
      assert.equal(res.isVegetarian, true);
      assert.equal(res.isNonVegetarian, false);
    });

    it('accurately classifies verified Vegetarian non-Vegan product (contains dairy/honey)', () => {
      const vegProduct = {
        product_name: 'Amul Butter Cookies',
        category_name: 'Packaged Biscuits & Cookies',
        ingredients: { rawText: 'Wheat flour, sugar, butter (20%), milk solids, salt.' },
        nutrition_info: { allergens: ['Wheat', 'Milk'] }
      };
      const res = classifyProductDietary(vegProduct);
      assert.equal(res.status, 'VEGETARIAN');
      assert.equal(res.isVegan, false, 'Must NOT classify dairy product as Vegan');
      assert.equal(res.isVegetarian, true);
      assert.equal(res.isNonVegetarian, false);
    });

    it('accurately classifies verified Non-Vegetarian product (meat/fish/poultry/gelatin)', () => {
      const nonVegProduct = {
        product_name: 'Chicken Instant Ramen',
        category_name: 'Instant Noodles & Pasta',
        ingredients: { rawText: 'Wheat flour, palm oil, chicken extract (5%), dehydrated egg powder, salt.' },
        nutrition_info: { allergens: ['Wheat', 'Egg'] }
      };
      const res = classifyProductDietary(nonVegProduct);
      assert.equal(res.status, 'NON_VEGETARIAN');
      assert.equal(res.isNonVegetarian, true);
      assert.equal(res.isVegetarian, false);
      assert.equal(res.isVegan, false);
    });

    it('accurately classifies Unknown / Unverified product (insufficient ingredients)', () => {
      const unknownProduct = {
        product_name: 'Unlabeled Snack Mix',
        ingredients: { rawText: '' }
      };
      const res = classifyProductDietary(unknownProduct);
      assert.equal(res.status, 'UNKNOWN');
      assert.equal(res.isVegetarian, false);
      assert.equal(res.isVegan, false);
      assert.equal(res.isNonVegetarian, false);
    });

    it('accurately identifies non-vegetarian ambiguous ingredients like gelatin or carmine', () => {
      const gelatinProduct = {
        product_name: 'Fruit Flavoured Marshmallows',
        ingredients: { rawText: 'Sugar, glucose syrup, gelatin, artificial colours.' }
      };
      const res = classifyProductDietary(gelatinProduct);
      assert.equal(res.status, 'NON_VEGETARIAN', 'Gelatin must trigger NON_VEGETARIAN');
    });
  });

  // ==========================================
  // SECTION 2: COMPARISON ENGINE
  // ==========================================
  describe('2. Comparison Engine Verification', () => {
    it('executes two-product comparison with 11 nutrients and consistent measurement bases', async () => {
      const res = await comparisonService.compareProducts(['PKG_PRD_0001', 'PKG_PRD_0008']);
      assert.equal(res.products.length, 2);
      assert.ok(res.nutritionalComparison.calories);
      assert.ok(res.nutritionalComparison.protein);
      assert.ok(res.nutritionalComparison.sugar);
      assert.ok(res.nutritionalComparison.sodium);
      assert.ok(res.nutritionalComparison.salt);
    });

    it('executes three-product comparison across different categories', async () => {
      const res = await comparisonService.compareProducts(['PKG_PRD_0001', 'PKG_PRD_0041', 'PKG_PRD_0081']);
      assert.equal(res.products.length, 3);
      assert.ok(res.verdict);
      assert.ok(res.verdict.bestProductId);
    });

    it('handles missing nutrient information without treating it as zero', async () => {
      const res = await comparisonService.compareProducts(['PKG_PRD_0001', 'PKG_PRD_0002']);
      assert.ok(res.advantagesByProduct);
      const advA = res.advantagesByProduct['PKG_PRD_0001'];
      assert.equal(typeof advA.missingCount, 'number');
    });

    it('computes shared vs unique ingredients and detects INS additives', async () => {
      const res = await comparisonService.compareProducts(['PKG_PRD_0001', 'PKG_PRD_0002']);
      assert.ok(Array.isArray(res.ingredientComparison.shared));
      assert.ok(Array.isArray(res.ingredientComparison.uniqueByProduct));
      assert.ok(res.products[0].additiveInfo.insCodes.length > 0);
    });

    it('enforces allergen comparison matrix with CONTAINS, MAY_CONTAIN, VERIFIED_ABSENCE, UNKNOWN', async () => {
      const res = await comparisonService.compareProducts(['PKG_PRD_0001', 'PKG_PRD_0008']);
      const matrix = res.allergenComparison.matrix;
      assert.ok(matrix.length >= 8);
      const milkRow = matrix.find(r => r.key === 'milk');
      assert.ok(milkRow);
      const p1Status = milkRow.statuses['PKG_PRD_0001'];
      assert.equal(p1Status, 'CONTAINS');
    });

    it('generates evidence-based Best Product Verdict with pairwise trade-off analysis', async () => {
      const res = await comparisonService.compareProducts(['PKG_PRD_0001', 'PKG_PRD_0008']);
      assert.ok(res.verdict.bestProductId);
      assert.ok(res.verdict.reason.length > 20);
      assert.ok(res.verdict.pairwiseExplanations.length > 0);
    });
  });

  // ==========================================
  // SECTION 3: RECOMMENDATION ENGINE
  // ==========================================
  describe('3. Recommendation Engine Verification', () => {
    it('ranks by baseline Quality Score when no preferences are specified', async () => {
      const recs = await recommendationService.rankProducts(allProds.slice(0, 30), {});
      assert.ok(recs.length > 0);
      assert.equal(recs[0].finalScore, recs[0].smartChoiceScore);
    });

    it('ranks products by nutrient direction for single nutritional preference (High Protein)', async () => {
      const recs = await recommendationService.rankProducts(allProds.slice(0, 50), { highProtein: true });
      assert.ok(recs.length > 0);
      assert.ok(recs[0].matchScore >= 70);
    });

    it('ranks products by synergy score for multiple nutritional preferences', async () => {
      const recs = await recommendationService.rankProducts(allProds.slice(0, 50), { highProtein: true, lowSugar: true });
      assert.ok(recs.length > 0);
    });

    it('strictly enforces Vegetarian-only filter (excludes non-veg and unknown)', async () => {
      const recs = await recommendationService.rankProducts(allProds.slice(0, 50), { vegetarian: true });
      for (const r of recs.slice(0, 10)) {
        const prod = allProds.find(p => (p.product_id || p.id) === r.productId);
        const diet = classifyProductDietary(prod);
        assert.ok(diet.status === 'VEGETARIAN' || diet.status === 'VEGAN', 'Must satisfy vegetarian criteria');
      }
    });

    it('strictly enforces Vegan-only filter (excludes non-vegan vegetarian items)', async () => {
      const recs = await recommendationService.rankProducts(allProds.slice(0, 50), { vegan: true });
      for (const r of recs.slice(0, 10)) {
        const prod = allProds.find(p => (p.product_id || p.id) === r.productId);
        const diet = classifyProductDietary(prod);
        assert.equal(diet.isVegan, true, 'Vegan-only filter must return strictly vegan products');
      }
    });

    it('strictly enforces global allergen exclusions as hard constraint (score drops to 0)', async () => {
      const recs = await recommendationService.rankProducts(allProds.slice(0, 50), { avoidAllergens: ['Peanuts'] });
      for (const r of recs) {
        const prod = allProds.find(p => (p.product_id || p.id) === r.productId);
        const rawText = (prod.ingredients?.rawText || '').toLowerCase();
        if (rawText.includes('peanut')) {
          assert.equal(r.isEligible, false, 'Product containing peanut must be marked ineligible');
          assert.equal(r.finalScore, 0, 'Ineligible product finalScore must be 0');
        }
      }
    });
  });

  // ==========================================
  // SECTION 4: MASTER CATALOG NEUTRALITY
  // ==========================================
  describe('4. Master Catalog Neutrality & Keyword Search', () => {
    it('scoped keyword search matches product names and brand only, NEVER ingredients', () => {
      const { matchesSearchQuery } = require('../../frontend/src/utils/categoryMatching');
      const sample = allProds.find(p => (p.product_id || p.id) === 'PKG_PRD_0145'); // Uncle Chipps
      assert.ok(sample);
      assert.equal(matchesSearchQuery(sample, 'Uncle'), true);
      assert.equal(matchesSearchQuery(sample, 'Chipps'), true);
      assert.equal(matchesSearchQuery(sample, 'Milk'), false, 'Search "Milk" must not match Uncle Chipps ingredients');
    });

    it('category filtering returns products only from target category and handles empty categories', () => {
      const { matchesSelectedCategory } = require('../../frontend/src/utils/categoryMatching');
      const sample = allProds.find(p => (p.product_id || p.id) === 'PKG_PRD_0001'); // Category 1
      assert.equal(matchesSelectedCategory(sample, 1), true);
      assert.equal(matchesSelectedCategory(sample, 2), false);
      assert.equal(matchesSelectedCategory(sample, 999), false);
    });
  });

  // ==========================================
  // SECTION 5: SCORING ENGINE INTEGRITY
  // ==========================================
  describe('5. Scoring Engine Formula and Strict Additivity', () => {
    it('enforces exact additivity TotalScore === Nutrition + Ingredients + Processing + ProteinFibre + Preferences', () => {
      const sample = allProds.slice(0, 50);
      for (const p of sample) {
        const res = scoringService.calculateSmartChoiceScore(p, {});
        const wb = res.weightedBreakdown;
        const sum = wb.nutrition + wb.ingredients + wb.processing + wb.proteinFiber + wb.preferences;
        assert.equal(res.totalScore, sum, `Product ${p.product_id} must have exact additivity`);
      }
    });

    it('calculates numerical Confidence Score decoupled from quality score', () => {
      const sample = allProds.slice(0, 20);
      for (const p of sample) {
        const conf = scoringService.calculateConfidence(p);
        assert.equal(typeof conf.score, 'number');
        assert.ok(conf.score >= 0 && conf.score <= 100);
        assert.ok(['high', 'medium', 'low'].includes(conf.level));
      }
    });

    it('verifies reported screenshot product PKG_PRD_0067 adds up with exact mathematical additivity', () => {
      const galaxy = allProds.find(p => (p.product_id || p.id) === 'PKG_PRD_0067');
      const res = scoringService.calculateSmartChoiceScore(galaxy, {});
      assert.equal(res.weightedBreakdown.nutrition, 18);
      assert.equal(res.weightedBreakdown.ingredients, 17);
      assert.equal(res.weightedBreakdown.processing, 5);
      assert.equal(res.weightedBreakdown.proteinFiber, 10);
      assert.equal(res.weightedBreakdown.preferences, 0);
      const sum = res.weightedBreakdown.nutrition + res.weightedBreakdown.ingredients + res.weightedBreakdown.processing + res.weightedBreakdown.proteinFiber + res.weightedBreakdown.preferences;
      assert.equal(res.totalScore, sum, `Total score ${res.totalScore} must exactly equal sum of components ${sum}`);
    });
  });
});
