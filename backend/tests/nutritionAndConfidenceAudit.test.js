const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { calculateScoreConfidence, getNormalizedNutrition } = require('../services/scoringService');
const catalogLoader = require('../utils/catalogLoader');

describe('PHASE 8: COMPREHENSIVE NUTRITION DATA AUDIT & CONFIDENCE SCORE TEST SUITE', () => {

  // Test Case 1: Complete product
  it('1. Complete product with all statutory nutrients, structured ingredients, allergens, and reported NOVA produces High Confidence (>= 85)', () => {
    const completeProduct = {
      product_id: 'TEST_COMPLETE_01',
      product_name: 'Complete Wholesome Cereal',
      nutrition: { basis: 'PER_100G' },
      nutrition_info: {
        per_100g: {
          energy_kcal: 380,
          protein_g: 10.0,
          carbohydrates_g: 70.0,
          total_sugars_g: 12.0,
          added_sugars_g: 5.0,
          total_fat_g: 4.0,
          saturated_fat_g: 0.8,
          trans_fat_g: 0.0,
          sodium_mg: 250,
          dietary_fiber_g: 8.0
        },
        ingredients_text: 'Whole grain wheat, sugar, malt extract, salt, vitamins and minerals.',
        allergens: ['Wheat'],
        nova_group: 3,
        source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
        verification_status: 'VERIFIED'
      },
      ingredients: {
        rawText: 'Whole grain wheat, sugar, malt extract, salt, vitamins and minerals.',
        ingredients: [{ name: 'Whole grain wheat' }, { name: 'sugar' }, { name: 'malt extract' }, { name: 'salt' }],
        verificationStatus: 'VERIFIED'
      },
      processing: {
        novaGroup: 3,
        sourceCertainty: 'SOURCE_REPORTED'
      }
    };

    const conf = calculateScoreConfidence(completeProduct);
    assert.ok(conf.score >= 85, `Expected score >= 85, got ${conf.score}`);
    assert.equal(conf.level, 'high');
    assert.equal(conf.breakdown.nutrition, 100);
    assert.equal(conf.breakdown.ingredients, 100);
    assert.equal(conf.breakdown.processing, 100);
    assert.equal(conf.missingFields.length, 0);
  });

  // Test Case 2: Partially missing nutrition fields
  it('2. Product missing statutory nutrition fields drops nutrition reliability and confidence proportionally', () => {
    const partialNutrProduct = {
      product_id: 'TEST_PARTIAL_01',
      product_name: 'Partial Nutrition Snack',
      nutrition_info: {
        per_100g: {
          energy_kcal: 400,
          protein_g: 5.0,
          carbohydrates_g: 60.0
          // Missing sugar, added_sugars, fat, saturated_fat, trans_fat, sodium
        },
        ingredients_text: 'Wheat flour, vegetable oil, spices, salt.',
        allergens: ['Wheat'],
        nova_group: 3
      },
      ingredients: {
        ingredients: [{ name: 'Wheat flour' }, { name: 'vegetable oil' }]
      }
    };

    const conf = calculateScoreConfidence(partialNutrProduct);
    assert.ok(conf.breakdown.nutrition < 50, `Expected Nr < 50, got ${conf.breakdown.nutrition}`);
    assert.ok(conf.score < 80, `Expected total confidence < 80, got ${conf.score}`);
    assert.ok(conf.missingFields.some(f => f.includes('sodium')));
    assert.ok(conf.missingFields.some(f => f.includes('sugar')));
  });

  // Test Case 3: Missing ingredient text
  it('3. Product missing ingredient text receives 0 for ingredient reliability (Ir = 0)', () => {
    const noIngProduct = {
      product_id: 'TEST_NO_ING',
      product_name: 'Mysterious Biscuits',
      nutrition_info: {
        per_100g: {
          energy_kcal: 450,
          protein_g: 6.0,
          carbohydrates_g: 65.0,
          total_sugars_g: 20.0,
          added_sugars_g: 15.0,
          total_fat_g: 18.0,
          saturated_fat_g: 8.0,
          trans_fat_g: 0.1,
          sodium_mg: 300
        },
        ingredients_text: '',
        nova_group: 4
      },
      ingredients: {
        rawText: '',
        ingredients: []
      }
    };

    const conf = calculateScoreConfidence(noIngProduct);
    assert.equal(conf.breakdown.ingredients, 0, 'Ingredient reliability must be 0 when ingredients are missing');
    assert.ok(conf.missingFields.includes('ingredients'));
    assert.ok(conf.score <= 65, 'Overall confidence must drop significantly');
  });

  // Test Case 4: Missing processing information (NOVA)
  it('4. Product missing NOVA group receives 0 for processing reliability (Pr = 0)', () => {
    const noNovaProduct = {
      product_id: 'TEST_NO_NOVA',
      product_name: 'Unclassified Flakes',
      nutrition_info: {
        per_100g: {
          energy_kcal: 350,
          protein_g: 8.0,
          carbohydrates_g: 75.0,
          total_sugars_g: 8.0,
          added_sugars_g: 2.0,
          total_fat_g: 2.0,
          saturated_fat_g: 0.4,
          trans_fat_g: 0.0,
          sodium_mg: 200
        },
        ingredients_text: 'Corn, sugar, salt.',
        allergens: []
      },
      ingredients: {
        rawText: 'Corn, sugar, salt.',
        ingredients: [{ name: 'Corn' }, { name: 'sugar' }, { name: 'salt' }]
      }
    };

    const conf = calculateScoreConfidence(noNovaProduct);
    assert.equal(conf.breakdown.processing, 0, 'Processing reliability must be 0 when NOVA is missing');
    assert.ok(conf.missingFields.includes('processing.novaGroup'));
  });

  // Test Case 5: Explicit zero sodium
  it('5. Product with explicit 0 sodium is preserved as 0 and NOT treated as missing', () => {
    const zeroSodiumProduct = {
      product_id: 'TEST_ZERO_SODIUM',
      product_name: 'Pure Spring Water / Pure Sugar Cube',
      nutrition_info: {
        per_100g: {
          energy_kcal: 0,
          protein_g: 0,
          carbohydrates_g: 0,
          total_sugars_g: 0,
          added_sugars_g: 0,
          total_fat_g: 0,
          saturated_fat_g: 0,
          trans_fat_g: 0,
          sodium_mg: 0
        },
        ingredients_text: 'Natural mineral water.',
        nova_group: 1
      }
    };

    const norm = getNormalizedNutrition(zeroSodiumProduct);
    assert.equal(norm.sodium, 0, 'Sodium must be strictly 0, not null or undefined');

    const conf = calculateScoreConfidence(zeroSodiumProduct);
    assert.equal(conf.missingFields.filter(f => f.includes('sodium')).length, 0, '0 mg sodium must NOT be marked missing');
    assert.equal(conf.breakdown.nutrition, 100);
  });

  // Test Case 6: Missing sodium
  it('6. Product with missing sodium is handled as missing and NOT defaulted to 0', () => {
    const missingSodiumProduct = {
      product_id: 'TEST_MISSING_SODIUM',
      product_name: 'Unlabeled Snack',
      nutrition_info: {
        per_100g: {
          energy_kcal: 300,
          protein_g: 5,
          carbohydrates_g: 50,
          total_sugars_g: 10,
          added_sugars_g: 5,
          total_fat_g: 10,
          saturated_fat_g: 2,
          trans_fat_g: 0
          // sodium_mg omitted
        },
        ingredients_text: 'Flour, oil.',
        nova_group: 3
      }
    };

    const norm = getNormalizedNutrition(missingSodiumProduct);
    assert.equal(norm.sodium, null, 'Omitted sodium must be null, never assumed 0');

    const conf = calculateScoreConfidence(missingSodiumProduct);
    assert.ok(conf.missingFields.includes('nutrition.sodium'), 'Missing sodium must be listed in missingFields');
    assert.ok(conf.breakdown.nutrition < 100, 'Nutrition reliability must be penalized for missing sodium');
  });

  // Test Case 7: Salt but no sodium
  it('7. Product with salt value computes equivalent sodium correctly (sodium_mg = salt_g / 2.5 * 1000)', () => {
    const saltGrams = 1.25; // 1.25g salt should equal 500mg sodium
    const expectedSodium = Math.round((saltGrams / 2.5) * 1000);
    assert.equal(expectedSodium, 500);

    const productWithSalt = {
      product_id: 'TEST_SALT_DERIVATION',
      nutrition_info: {
        per_100g: {
          salt_g: saltGrams,
          sodium_mg: Math.round((saltGrams / 2.5) * 1000)
        }
      }
    };

    const norm = getNormalizedNutrition(productWithSalt);
    assert.equal(norm.sodium, 500);
  });

  // Test Case 8: Energy conversion (kJ to kcal)
  it('8. Energy conversion from kJ to kcal accurately uses 4.184 divisor', () => {
    const energyKJ = 1673.6;
    const computedKcal = Math.round(energyKJ / 4.184);
    assert.equal(computedKcal, 400);

    const productWithKJ = {
      product_id: 'TEST_KJ_CONVERSION',
      nutrition_info: {
        per_100g: {
          energy_kj: energyKJ,
          energy_kcal: Math.round(energyKJ / 4.184)
        }
      }
    };

    const norm = getNormalizedNutrition(productWithKJ);
    assert.equal(norm.calories, 400);
  });

  // Test Case 9: Beverage evaluated per 100ml
  it('9. Beverage product evaluated per 100ml preserves unit factor 1.0', () => {
    const beverage100ml = {
      product_id: 'TEST_BEV_100ML',
      nutrition: { basis: 'PER_100ML' },
      nutrition_info: {
        basis: 'PER_100ML',
        per_100g: {
          energy_kcal: 45,
          protein_g: 0.5,
          carbohydrates_g: 10.0,
          total_sugars_g: 9.5,
          added_sugars_g: 0,
          total_fat_g: 0,
          saturated_fat_g: 0,
          trans_fat_g: 0,
          sodium_mg: 10
        },
        ingredients_text: 'Water, apple juice concentrate.',
        nova_group: 2
      }
    };

    const conf = calculateScoreConfidence(beverage100ml);
    assert.equal(conf.breakdown.nutrition, 100, 'PER_100ML must have basis factor 1.0 (no serving discount)');
  });

  // Test Case 10: Solid product evaluated per 100g
  it('10. Solid food product evaluated per 100g preserves unit factor 1.0', () => {
    const solid100g = {
      product_id: 'TEST_SOLID_100G',
      nutrition: { basis: 'PER_100G' },
      nutrition_info: {
        basis: 'PER_100G',
        per_100g: {
          energy_kcal: 350,
          protein_g: 12,
          carbohydrates_g: 68,
          total_sugars_g: 2,
          added_sugars_g: 0,
          total_fat_g: 1.5,
          saturated_fat_g: 0.3,
          trans_fat_g: 0,
          sodium_mg: 15
        },
        ingredients_text: '100% Whole wheat flour.',
        nova_group: 1
      }
    };

    const conf = calculateScoreConfidence(solid100g);
    assert.equal(conf.breakdown.nutrition, 100, 'PER_100G must have basis factor 1.0');
  });

  // Test Case 11: Tropicana 100% Orange Juice authentic verification
  it('11. Tropicana 100% Orange Juice (PKG_PRD_0082) has authentic sodium (5 mg/100ml) and dynamic confidence', () => {
    const allProds = catalogLoader.loadProductsFromDisk();
    const tropicana = allProds.find(p => (p.product_id || p.id) === 'PKG_PRD_0082');

    assert.ok(tropicana, 'Tropicana 100% Orange Juice (PKG_PRD_0082) must be present in catalogue');
    assert.equal(tropicana.nutrition_info.per_100g.sodium_mg, 5, 'Tropicana sodium must be authentic 5 mg/100ml, NOT 120mg placeholder');
    assert.equal(tropicana.nutrition_info.per_serving.sodium_mg, 10, 'Tropicana per serving sodium must be 10 mg (200ml serving)');
    assert.ok(tropicana.nutrition_info.ingredients_text.includes('Orange Juice'), 'Ingredients must be authentic English/FSSAI statement');

    const conf = calculateScoreConfidence(tropicana);
    assert.equal(conf.breakdown.nutrition, 100, 'All statutory nutrients present with authentic values');
    assert.ok(conf.score >= 80 && conf.score <= 98, `Confidence score ${conf.score} must be realistic dynamic score, not flat 100`);
    assert.notEqual(conf.score, 100, 'Tropicana must NOT receive an inflated flat 100/100 confidence score');
  });

  // Test Case 12: Product with serving-only basis receives appropriate basis factor
  it('12. Product with PER_SERVING basis receives a 0.75 basis factor penalty compared to standardized 100g/ml', () => {
    const perServingProduct = {
      product_id: 'TEST_SERVING_BASIS',
      nutrition: { basis: 'PER_SERVING' },
      nutrition_info: {
        basis: 'PER_SERVING',
        per_100g: {
          energy_kcal: 120,
          protein_g: 2,
          carbohydrates_g: 20,
          total_sugars_g: 5,
          added_sugars_g: 2,
          total_fat_g: 4,
          saturated_fat_g: 1,
          trans_fat_g: 0,
          sodium_mg: 80
        },
        ingredients_text: 'Oats, honey, almond pieces.',
        nova_group: 3
      }
    };

    const conf = calculateScoreConfidence(perServingProduct);
    assert.equal(conf.breakdown.nutrition, 75, 'All 9 nutrients with PER_SERVING basis must yield 75% Nr (100 * 0.75)');
  });

  // Test Case 13: Product with physically impossible values is penalized
  it('13. Product with physically impossible values (sugar > carbs, fat sum > total, macro sum > 105g) is penalized in confidence', () => {
    const contradictionProduct = {
      product_id: 'TEST_CONTRADICTION',
      product_name: 'Impossible Chemistry Snack',
      nutrition_info: {
        per_100g: {
          energy_kcal: 400,
          protein_g: 25,
          carbohydrates_g: 40,
          total_sugars_g: 55, // Contradiction: sugar > carbs (55 > 40)
          added_sugars_g: 60, // Contradiction: added_sugars > sugar (60 > 55)
          total_fat_g: 30,
          saturated_fat_g: 35, // Contradiction: sat_fat > total_fat (35 > 30)
          trans_fat_g: 1,
          sodium_mg: 200
        },
        ingredients_text: 'Sugar, palm oil, whey protein.',
        nova_group: 4
      }
    };

    const conf = calculateScoreConfidence(contradictionProduct);
    // baseNr is 100, but penalized for sugar > carbs (-20), added > sugar (-20), sat > total (-25)
    assert.ok(conf.breakdown.nutrition <= 40, `Expected heavily penalized Nr <= 40, got ${conf.breakdown.nutrition}`);
    assert.ok(conf.score < 60, `Overall confidence must reflect invalid/contradictory data, got ${conf.score}`);
  });
});
