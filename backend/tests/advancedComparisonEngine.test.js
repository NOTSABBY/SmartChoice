const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const comparisonService = require('../services/comparisonService');
const { calculateProductVerification } = require('../utils/productVerification');

describe('SMARTCHOICE ADVANCED COMPARISON ENGINE TEST SUITE', () => {

  describe('Part 1 & 2: Nutritional and Ingredient Comparison', () => {
    it('compares 2 products across all supported nutritional fields and identifies best values', async () => {
      const res = await comparisonService.compareProducts(['PKG_PRD_0001', 'PKG_PRD_0008']);
      assert.ok(res.products.length === 2, 'Should return 2 normalized products');

      // Check all 11 nutrition fields exist
      const keys = ['calories', 'protein', 'carbohydrates', 'sugar', 'addedSugars', 'fat', 'saturatedFat', 'transFat', 'fiber', 'sodium', 'salt'];
      for (const k of keys) {
        assert.ok(res.nutritionalComparison[k], `Nutritional field ${k} should be present in comparison`);
        assert.ok(Array.isArray(res.nutritionalComparison[k].values), `Values array should exist for ${k}`);
        assert.equal(res.nutritionalComparison[k].values.length, 2);
      }

      // Check protein difference: PKG_PRD_0008 (NutriChoice Digestive, 9g) vs PKG_PRD_0001 (Parle-G, 6.5g)
      const protA = res.products[0].nutrients.protein;
      const protB = res.products[1].nutrients.protein;
      assert.ok(typeof protA === 'number' && typeof protB === 'number');
      assert.ok(protB > protA, 'Digestive biscuit should have higher protein than Parle-G');
      assert.equal(res.nutritionalComparison.protein.bestVal, protB);

      // Check ingredient comparison
      assert.ok(Array.isArray(res.ingredientComparison.shared));
      assert.ok(Array.isArray(res.ingredientComparison.uniqueByProduct));
      assert.equal(res.ingredientComparison.uniqueByProduct.length, 2);
      assert.ok(Array.isArray(res.ingredientComparison.additivesByProduct));
    });

    it('identifies additives, INS numbers and classes', async () => {
      const res = await comparisonService.compareProducts(['PKG_PRD_0001', 'PKG_PRD_0006']);
      res.products.forEach(p => {
        assert.ok(p.additiveInfo, 'Each product should have additiveInfo');
        assert.ok(Array.isArray(p.additiveInfo.insCodes), 'insCodes should be an array');
        assert.ok(Array.isArray(p.additiveInfo.classes), 'classes should be an array');
      });
    });
  });

  describe('Part 3: Statutory Allergen Matrix Comparison', () => {
    it('distinguishes CONTAINS, MAY_CONTAIN, VERIFIED_ABSENCE and UNKNOWN', async () => {
      const res = await comparisonService.compareProducts(['PKG_PRD_0001', 'PKG_PRD_0004']);
      assert.ok(Array.isArray(res.allergenComparison.matrix));
      assert.ok(res.allergenComparison.matrix.length >= 8);

      // Gluten should be CONTAINS for both biscuits
      const glutenRow = res.allergenComparison.matrix.find(m => m.key === 'gluten');
      assert.ok(glutenRow, 'Gluten should be in statutory matrix');
      assert.equal(glutenRow.statuses['PKG_PRD_0001'], 'CONTAINS');
      assert.equal(glutenRow.statuses['PKG_PRD_0004'], 'CONTAINS');

      // Tree nuts should be CONTAINS for Unibic Fruit and Nut (PKG_PRD_0004) and ABSENCE for Parle-G (PKG_PRD_0001)
      const nutRow = res.allergenComparison.matrix.find(m => m.key === 'treeNuts');
      assert.ok(nutRow);
      assert.equal(nutRow.statuses['PKG_PRD_0004'], 'CONTAINS');
      assert.equal(nutRow.statuses['PKG_PRD_0001'], 'VERIFIED_ABSENCE');
    });

    it('enforces allergen safety exclusion priority over quality score in verdict', async () => {
      // User has peanut allergen exclusion; compare peanut butter (higher quality score) with biscuit
      const res = await comparisonService.compareProducts(['PKG_PRD_0401', 'PKG_PRD_0001'], {
        avoidAllergens: ['peanuts']
      });

      // PKG_PRD_0401 (Peanut butter) violates allergen exclusion
      const pb = res.products.find(p => p.productId === 'PKG_PRD_0401');
      assert.ok(pb.preferenceMatch?.hardExclusionViolated, 'Peanut product should be flagged as hard exclusion violated');

      // Verdict MUST select the non-violating product or exclude the allergen product
      assert.notEqual(res.verdict.bestProductId, 'PKG_PRD_0401', 'Peanut product must NEVER be chosen when peanut is avoided');
      assert.equal(res.verdict.bestProductId, 'PKG_PRD_0001');
    });
  });

  describe('Part 4 & 5: Scores and Product Similarity', () => {
    it('compares Quality Score with complete 5-part breakdown and numerical Confidence Score', async () => {
      const res = await comparisonService.compareProducts(['PKG_PRD_0001', 'PKG_PRD_0008']);
      for (const p of res.products) {
        assert.ok(typeof p.qualityScore === 'number' && p.qualityScore >= 0 && p.qualityScore <= 100);
        assert.ok(p.qualityBreakdown);
        assert.ok(typeof p.qualityBreakdown.nutrition === 'number');
        assert.ok(typeof p.qualityBreakdown.ingredients === 'number');
        assert.ok(typeof p.qualityBreakdown.processing === 'number');
        assert.ok(typeof p.qualityBreakdown.proteinFiber === 'number');
        assert.ok(typeof p.qualityBreakdown.preferences === 'number');

        assert.ok(p.confidence);
        assert.ok(typeof p.confidence.score === 'number');
        assert.ok(p.confidence.level);
        assert.ok(p.confidence.label);

        assert.ok(typeof p.completeness === 'number');
        assert.ok(typeof p.verification.percentage === 'number');
      }
    });

    it('calculates Pairwise Similarity SIM = 0.40C + 0.20T + 0.15S + 0.15I + 0.10N', async () => {
      const res = await comparisonService.compareProducts(['PKG_PRD_0001', 'PKG_PRD_0002']);
      assert.ok(res.pairwiseSimilarity.length === 1);
      const sim = res.pairwiseSimilarity[0];

      assert.ok(sim.overallSimilarity >= 50, 'Two biscuits in Category 1 should have high similarity');
      assert.equal(sim.breakdown.category, 100, 'Same category should yield 100% category similarity');
      assert.ok(sim.sharedTraits.length > 0);
    });
  });

  describe('Part 6: Comparison Verdict (Best Product)', () => {
    it('identifies best overall product and provides pairwise outperformance reasons for 3 products', async () => {
      const res = await comparisonService.compareProducts(['PKG_PRD_0001', 'PKG_PRD_0008', 'PKG_PRD_0041']);
      assert.equal(res.products.length, 3);

      assert.ok(res.verdict);
      assert.ok(res.verdict.bestProductId);
      assert.ok(res.verdict.bestProductName);
      assert.ok(res.verdict.reason.length > 20);

      // Must have pairwise comparative explanations for each alternative
      assert.ok(Array.isArray(res.verdict.pairwiseExplanations));
      assert.equal(res.verdict.pairwiseExplanations.length, 2, 'Should have pairwise explanations against both alternatives');
      for (const pw of res.verdict.pairwiseExplanations) {
        assert.ok(pw.alternativeName);
        assert.ok(pw.explanation.length > 20);
      }
    });

    it('correctly compares Godrej Sausage (PKG_PRD_0497) and McCain Fries (PKG_PRD_0482) with complete data and realistic similarity', async () => {
      const res = await comparisonService.compareProducts(['PKG_PRD_0497', 'PKG_PRD_0482']);
      assert.equal(res.products.length, 2);

      const sausage = res.products.find(p => p.productId === 'PKG_PRD_0497');
      const fries = res.products.find(p => p.productId === 'PKG_PRD_0482');

      // 1. Nutritional values must be populated (NOT N/A)
      assert.ok(sausage.nutrients.calories > 150, 'Sausage calories should be populated');
      assert.ok(sausage.nutrients.protein > 15, 'Sausage protein should be > 15g');
      assert.ok(fries.nutrients.calories > 150, 'Fries calories should be populated');
      assert.ok(fries.nutrients.carbohydrates > 20, 'Fries carbohydrates should be > 20g');

      // 2. Ingredients must NOT be empty or unknown
      assert.ok(sausage.ingredientTokens.length >= 5, 'Sausage must have parsed ingredient tokens');
      assert.ok(fries.ingredientTokens.length >= 4, 'Fries must have parsed ingredient tokens');

      // 3. Allergens must be accurately identified
      assert.equal(sausage.allergens.soy, 'CONTAINS', 'Sausage contains soy protein');

      // 4. Quality Scores must reflect genuine nutritional analysis (NOT 46 baseline)
      assert.ok(sausage.qualityScore >= 60, `Sausage quality score should be >= 60, got ${sausage.qualityScore}`);
      assert.ok(fries.qualityScore >= 60, `Fries quality score should be >= 60, got ${fries.qualityScore}`);

      // 5. Confidence Score must be high (NOT 0)
      assert.ok(sausage.confidence.score >= 80, `Sausage confidence should be >= 80, got ${sausage.confidence.score}`);
      assert.ok(fries.confidence.score >= 80, `Fries confidence should be >= 80, got ${fries.confidence.score}`);

      // 6. Pairwise similarity must appropriately distinguish meat sausage from fried potato
      const sim = res.pairwiseSimilarity[0];
      assert.ok(sim.overallSimilarity < 60, `Pairwise similarity should reflect food type distinction (<60%), got ${sim.overallSimilarity}%`);
      assert.ok(sim.differingTraits.some(t => t.includes('Different food types') || t.includes('Non-Vegetarian')), 'Must flag distinct food types');

      // 7. Decisive verdict with evidence
      assert.equal(res.verdict.status, 'DECISIVE');
      assert.ok(res.verdict.reason.includes('Godrej Yummiez Chicken Sausage'));
    });

    it('returns INSUFFICIENT_DATA and NO winner when products have missing data or low confidence', async () => {
      // Use catalogLoader to simulate a comparison where data is missing
      const catalogLoader = require('../utils/catalogLoader');
      const origGet = catalogLoader.getProductById;
      try {
        catalogLoader.getProductById = (id) => {
          if (id === 'STUB_01') {
            return {
              product_id: 'STUB_01',
              product_name: 'Incomplete Stub Product 1',
              category_id: 1,
              category_name: 'Snacks',
              nutrition: { calories: null, protein: null, fat: null, sugar: null, sodium: null },
              nutrition_info: { per_100g: {} },
              ingredients: { ingredients: [], rawText: '' },
              dataQuality: { completeness: 20 }
            };
          }
          if (id === 'STUB_02') {
            return {
              product_id: 'STUB_02',
              product_name: 'Incomplete Stub Product 2',
              category_id: 1,
              category_name: 'Snacks',
              nutrition: { calories: null, protein: null, fat: null, sugar: null, sodium: null },
              nutrition_info: { per_100g: {} },
              ingredients: { ingredients: [], rawText: '' },
              dataQuality: { completeness: 20 }
            };
          }
          return origGet(id);
        };

        const res = await comparisonService.compareProducts(['STUB_01', 'STUB_02']);
        assert.equal(res.verdict.status, 'INSUFFICIENT_DATA', 'Must return INSUFFICIENT_DATA status');
        assert.equal(res.verdict.bestProductId, null, 'Must NOT declare a winner when data is insufficient');
        assert.ok(res.verdict.reason.includes('Insufficient verified data'));
        assert.ok(res.verdict.uncertaintyExplanation.includes('lack sufficient verified data'));
      } finally {
        catalogLoader.getProductById = origGet;
      }
    });

    it('returns TIED verdict and NO arbitrary winner when products have identical quality scores', async () => {
      const catalogLoader = require('../utils/catalogLoader');
      const origGet = catalogLoader.getProductById;
      try {
        // Two complete products with identical scores
        const sample = origGet('PKG_PRD_0001');
        catalogLoader.getProductById = (id) => {
          if (id === 'TIED_01') {
            return { ...sample, product_id: 'TIED_01', product_name: 'Tied Biscuit Alpha' };
          }
          if (id === 'TIED_02') {
            return { ...sample, product_id: 'TIED_02', product_name: 'Tied Biscuit Beta' };
          }
          return origGet(id);
        };

        const res = await comparisonService.compareProducts(['TIED_01', 'TIED_02']);
        assert.equal(res.verdict.status, 'TIED', 'Must return TIED status when scores are equal');
        assert.equal(res.verdict.bestProductId, null, 'Must NOT declare an arbitrary winner on ties');
        assert.ok(res.verdict.reason.includes('equally rated overall'));
      } finally {
        catalogLoader.getProductById = origGet;
      }
    });
  });

  describe('Part 8: Product Verification Status Engine', () => {
    it('classifies a complete FSSAI catalog product as Verified', () => {
      const verifiedProduct = {
        nutrition_info: {
          basis: 'PER_100G',
          per_100g: { energy_kcal: 450, protein_g: 8, carbohydrates_g: 65, total_sugars_g: 20, total_fat_g: 18, saturated_fat_g: 8, sodium_mg: 300, dietary_fiber_g: 4 },
          verification_status: 'VERIFIED',
          nova_group: 3
        },
        ingredients: { rawText: 'Wheat flour, Sugar, Edible vegetable oil', verificationStatus: 'VERIFIED' },
        processing: { novaGroup: 3, sourceCertainty: 'SOURCE_REPORTED' },
        dietary_classification: { status: 'VEGETARIAN', verificationStatus: 'VERIFIED' }
      };

      const ver = calculateProductVerification(verifiedProduct);
      assert.equal(ver.status, 'Verified');
      assert.ok(ver.percentage >= 80);
      assert.equal(ver.conflicts.length, 0);
    });

    it('classifies a product with missing laboratory verification as Partially Verified', () => {
      const partialProduct = {
        nutrition_info: {
          basis: 'PER_100G',
          per_100g: { energy_kcal: 400, protein_g: 6, carbohydrates_g: 60, total_sugars_g: 15, total_fat_g: 14 }
        },
        ingredients: { rawText: 'Wheat flour, sugar' }
      };

      const ver = calculateProductVerification(partialProduct);
      assert.equal(ver.status, 'Partially Verified');
      assert.ok(ver.percentage >= 45 && ver.percentage < 80);
    });

    it('classifies a product with conflicting data as Needs Review', () => {
      // Saturated fat exceeds total fat (macro impossibility)
      const conflictProduct = {
        nutrition_info: {
          per_100g: { energy_kcal: 200, total_fat_g: 5, saturated_fat_g: 10 }
        },
        ingredients: { rawText: 'Oats' }
      };

      const ver = calculateProductVerification(conflictProduct);
      assert.equal(ver.status, 'Needs Review');
      assert.ok(ver.conflicts.length > 0);
      assert.ok(ver.reason.includes('exceeds total fat'));
    });

    it('classifies a product with dietary conflict (claims veg but contains chicken) as Needs Review', () => {
      const vegWithMeat = {
        dietary_classification: { status: 'VEGETARIAN' },
        nutrition_info: {
          ingredients_text: 'Dehydrated chicken powder, salt, spices'
        }
      };

      const ver = calculateProductVerification(vegWithMeat);
      assert.equal(ver.status, 'Needs Review');
      assert.ok(ver.conflicts.length > 0);
      assert.ok(ver.reason.includes('conflicts with non-vegetarian ingredients') || ver.reason.includes('contains confirmed meat'));
    });
  });
});
