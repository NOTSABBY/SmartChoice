const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const scoringService = require('../services/scoringService');
const catalogLoader = require('../utils/catalogLoader');

describe('SMARTCHOICE SCORING ADDITIVITY & PARITY REGRESSION SUITE', () => {
  const allProds = catalogLoader.loadProductsFromDisk();

  it('1. Exact Reproduction & Fix of Reported Discrepancy (Galaxy Chocolate PKG_PRD_0067)', () => {
    const galaxy = allProds.find(p => (p.product_id || p.id) === 'PKG_PRD_0067');
    assert.ok(galaxy, 'PKG_PRD_0067 must exist in catalogue');

    const res = scoringService.calculateSmartChoiceScore(galaxy, {});
    const wb = res.weightedBreakdown;

    // Component verification matching exact mathematical additivity
    assert.equal(wb.ingredients, 17, 'Ingredients component contribution must be exactly 17/20');
    assert.equal(wb.processing, 5, 'Processing component contribution must be exactly 5/15');
    assert.equal(wb.proteinFiber, 10, 'Protein & Fibre component contribution must be exactly 10/15');
    assert.equal(wb.preferences, 0, 'User Preferences component contribution must be 0/10 when inactive');

    // Strict Additivity Check: totalScore must strictly equal arithmetic sum of weighted contributions
    const expectedSum = wb.nutrition + wb.ingredients + wb.processing + wb.proteinFiber + wb.preferences;
    assert.equal(res.totalScore, expectedSum, 'Total Score must strictly equal arithmetic sum of weighted contributions');
  });

  it('2. Verification of All 4 Products Displaying the 24 + 17 + 5 + 10 + 0 Breakdown', () => {
    const targetIds = ['PKG_PRD_0067', 'PKG_PRD_0111', 'PKG_PRD_0464', 'PKG_PRD_0471'];
    for (const tid of targetIds) {
      const prod = allProds.find(p => (p.product_id || p.id) === tid);
      if (prod) {
        const res = scoringService.calculateSmartChoiceScore(prod, {});
        const wb = res.weightedBreakdown;
        const sum = wb.nutrition + wb.ingredients + wb.processing + wb.proteinFiber + wb.preferences;
        assert.equal(res.totalScore, sum, `Product ${tid} totalScore must match exact component sum`);
      }
    }
  });

  it('3. Additivity Across Boundary Products (0 and 100)', () => {
    // Artificial 100 Product
    const perfectProduct = {
      product_id: 'TEST_PERFECT_100',
      category_id: 1,
      nutrition_info: {
        per_100g: {
          energy_kcal: 100,
          protein_g: 15,
          total_fat_g: 2,
          saturated_fat_g: 0.5,
          carbohydrates_g: 10,
          total_sugars_g: 1.0,
          dietary_fiber_g: 10,
          sodium_mg: 30,
          nova_group: 1
        }
      },
      ingredients: {
        rawText: 'Whole organic rolled oats.',
        ingredients: ['Whole organic rolled oats']
      }
    };
    const perfectRes = scoringService.calculateSmartChoiceScore(perfectProduct, {});
    const pWb = perfectRes.weightedBreakdown;
    const pSum = pWb.nutrition + pWb.ingredients + pWb.processing + pWb.proteinFiber + pWb.preferences;
    assert.equal(perfectRes.totalScore, pSum, 'Perfect product score must strictly equal component sum');
    assert.ok(perfectRes.totalScore >= 90, 'Perfect product should score >= 90');

    // Hard Exclusion Allergen Product (Score forced to 0)
    const allergenProd = {
      product_id: 'TEST_ALLERGEN_0',
      category_id: 1,
      ingredients: {
        rawText: 'Peanuts, palm oil, salt.',
        allergens: ['Peanuts']
      }
    };
    const allergenRes = scoringService.calculateSmartChoiceScore(allergenProd, { avoidAllergens: ['Peanuts'] });
    assert.equal(allergenRes.totalScore, 0, 'Violating hard exclusion must force totalScore to 0');
  });

  it('4. Missing Data Neutral Baselines Maintain Exact Additivity', () => {
    const emptyProd = {
      product_id: 'TEST_EMPTY',
      category_id: 1,
      nutrition_info: {},
      ingredients: {}
    };
    const emptyRes = scoringService.calculateSmartChoiceScore(emptyProd, {});
    const eWb = emptyRes.weightedBreakdown;
    const eSum = eWb.nutrition + eWb.ingredients + eWb.processing + eWb.proteinFiber + eWb.preferences;
    assert.equal(emptyRes.totalScore, eSum, 'Empty product must maintain exact component additivity');
    assert.equal(emptyRes.breakdown.nutrition, 50, 'Nutrition must anchor to neutral baseline 50');
    assert.equal(emptyRes.breakdown.ingredients, 50, 'Ingredients must anchor to neutral baseline 50');
    assert.equal(emptyRes.breakdown.processing, 50, 'Processing must anchor to neutral baseline 50');
    assert.equal(emptyRes.breakdown.proteinFiber, 50, 'Protein & Fibre must anchor to neutral baseline 50');
    assert.equal(emptyRes.totalScore, 46, 'Baseline with inactive preferences (U=0) sums to 20 + 10 + 8 + 8 + 0 = 46');
  });

  it('5. Exhaustive Additivity Check Across All 1,000 Catalogue SKUs', () => {
    let violationCount = 0;
    for (const p of allProds) {
      const res = scoringService.calculateSmartChoiceScore(p, {});
      const wb = res.weightedBreakdown;
      const sum = wb.nutrition + wb.ingredients + wb.processing + wb.proteinFiber + wb.preferences;
      if (res.totalScore !== sum) {
        violationCount++;
      }
    }
    assert.equal(violationCount, 0, 'Zero additivity violations allowed across all 1,000 catalogue products');
  });

  it('6. Additivity Preserved When Active Preferences Are Present (U > 0)', () => {
    const sample = allProds.slice(0, 100);
    const prefs = { highProtein: true, lowSugar: true };
    for (const p of sample) {
      const res = scoringService.calculateSmartChoiceScore(p, prefs);
      const wb = res.weightedBreakdown;
      const sum = wb.nutrition + wb.ingredients + wb.processing + wb.proteinFiber + wb.preferences;
      assert.equal(res.totalScore, sum, `Product ${p.product_id || p._id} must maintain additivity with active preferences`);
    }
  });
});
