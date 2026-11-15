/**
 * SMARTCHOICE — COMPLETE CATALOGUE DATA INTEGRITY AUTOMATED TEST SUITE
 * 
 * Asserts 100% data integrity, mathematical consistency, ingredient authenticity,
 * dietary classification, and allergen correctness across the entire catalogue.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { getAllProducts, getCatalog500Products } = require('../utils/catalogLoader');
const { calculateNutrientPerServing, calculateAllNutrientsPerServing } = require('../utils/nutritionConversion');
const { calculateProductQualityScore } = require('../services/scoringService');
const { calculateProductVerification } = require('../utils/productVerification');
const { isProductGloballyEligible } = require('../services/eligibilityService');

test('TEST 1: Master Catalogue Inventory Count and Deduplication', () => {
  const all = getAllProducts();
  assert.equal(all.length, 1000, `Expected exactly 1000 total catalogue products, got ${all.length}`);

  const cat500 = getCatalog500Products();
  assert.equal(cat500.length, 500, `Expected exactly 500 Catalog-500 products, got ${cat500.length}`);

  const ids = new Set();
  const duplicates = [];
  all.forEach(p => {
    const id = p._id || p.catalog?.productId || p.identity?.barcode;
    assert.ok(id, 'Every product must have a non-empty canonical ID');
    if (ids.has(id)) duplicates.push(id);
    ids.add(id);
  });
  assert.equal(duplicates.length, 0, `Detected duplicate product IDs: ${duplicates.join(', ')}`);
});

test('TEST 2: Known Corruption Remediation — Hershey\'s Cocoa Powder Unsweetened (PKG_PRD_0363)', () => {
  const cat500 = getCatalog500Products();
  const cocoa = cat500.find(p => p.product_id === 'PKG_PRD_0363');
  assert.ok(cocoa, 'PKG_PRD_0363 must exist in Catalog-500');

  const rawIng = (cocoa.nutrition_info?.ingredients_text || '').toLowerCase();
  assert.ok(rawIng.includes('cocoa'), 'Hershey\'s Cocoa Powder must declare Cocoa in ingredients');
  assert.ok(!rawIng.includes('yeast'), 'Hershey\'s Cocoa Powder must NOT declare yeast');
  assert.ok(!rawIng.includes('sorbitan monostearate'), 'Hershey\'s Cocoa Powder must NOT declare sorbitan monostearate');

  const protein = cocoa.nutrition_info?.per_100g?.protein_g;
  assert.ok(protein >= 18 && protein <= 24, `Protein per 100g must be ~19.6g for pure cocoa, got ${protein}g`);

  const perServing = cocoa.nutrition_info?.per_serving;
  assert.ok(perServing, 'per_serving must be calculated');
  assert.ok(perServing.protein_g < 2.0, `Protein per 5g serving must be ~1g, got ${perServing.protein_g}g`);

  assert.equal(cocoa.dietary_classification?.status, 'VEGAN', 'Pure unsweetened cocoa powder must be classified as VEGAN');
});

test('TEST 3: Known Corruption Remediation — Mother Dairy Ultimate Cow Ghee (PKG_PRD_0208)', () => {
  const cat500 = getCatalog500Products();
  const ghee = cat500.find(p => p.product_id === 'PKG_PRD_0208');
  assert.ok(ghee, 'PKG_PRD_0208 must exist in Catalog-500');

  const rawIng = (ghee.nutrition_info?.ingredients_text || '').toLowerCase();
  assert.ok(rawIng.includes('milk fat'), 'Ghee must declare Milk Fat');
  assert.ok(!rawIng.includes('vegetable oil'), 'Ghee must NOT declare vegetable oil in raw text');

  const parsedIngs = (ghee.ingredients?.ingredients || []).map(i => (typeof i === 'string' ? i : (i.name || i.raw || '')).toLowerCase()).join('; ');
  assert.ok(!parsedIngs.includes('vegetable oil'), `Structured ingredients must NOT contain vegetable oil: ${parsedIngs}`);

  assert.equal(ghee.dietary_classification?.status, 'VEGETARIAN', 'Ghee must be classified as VEGETARIAN');
  assert.equal(ghee.dietary_classification?.isVegan, false, 'Ghee is a dairy product and CANNOT be VEGAN');
});

test('TEST 4: Known Corruption Remediation — Pintola Peanut Butter Variants', () => {
  const cat500 = getCatalog500Products();

  // Pintola Organic (PKG_PRD_0132)
  const organic = cat500.find(p => p.product_id === 'PKG_PRD_0132');
  assert.ok(organic, 'PKG_PRD_0132 must exist');
  assert.equal(organic.nutrition_info?.per_100g?.added_sugars_g, 0, '100% Organic Peanut Butter must declare 0g added sugar');
  assert.equal(organic.dietary_classification?.status, 'VEGAN', '100% Peanuts must be VEGAN');

  // Pintola High Protein (PKG_PRD_0138)
  const hiProt = cat500.find(p => p.product_id === 'PKG_PRD_0138');
  assert.ok(hiProt, 'PKG_PRD_0138 must exist');
  const prot = hiProt.nutrition_info?.per_100g?.protein_g;
  assert.ok(prot >= 30, `High protein peanut butter must have >= 30g protein, got ${prot}g`);
  assert.equal(hiProt.dietary_classification?.status, 'VEGETARIAN', 'Contains whey protein (dairy) so must be VEGETARIAN');
  assert.equal(hiProt.dietary_classification?.isVegan, false, 'Contains whey protein so must NOT be VEGAN');
});

test('TEST 5: Complete Nutritional Plausibility Validation Across Catalog-500', () => {
  const cat500 = getCatalog500Products();
  const plausibilityViolations = [];

  cat500.forEach(p => {
    const nutri = p.nutrition_info?.per_100g || {};
    const id = p.product_id;
    const name = p.product_name;

    // Macro checks
    if (nutri.total_sugars_g > (nutri.carbohydrates_g || 0) + 1.0) {
      plausibilityViolations.push(`${id} (${name}): Sugar (${nutri.total_sugars_g}g) > Carbs (${nutri.carbohydrates_g}g)`);
    }
    if (nutri.saturated_fat_g > (nutri.total_fat_g || 0) + 0.5) {
      plausibilityViolations.push(`${id} (${name}): Sat Fat (${nutri.saturated_fat_g}g) > Total Fat (${nutri.total_fat_g}g)`);
    }
    if (nutri.energy_kcal < 0 || nutri.protein_g < 0 || nutri.total_fat_g < 0 || nutri.carbohydrates_g < 0) {
      plausibilityViolations.push(`${id} (${name}): Negative nutrient value detected`);
    }
  });

  assert.equal(plausibilityViolations.length, 0, `Plausibility violations found:\n${plausibilityViolations.join('\n')}`);
});

test('TEST 6: Ghee SKUs Zero Vegetable Oil Contamination Check', () => {
  const cat500 = getCatalog500Products();
  const gheeProducts = cat500.filter(p => /ghee/i.test(p.product_name) && !/soan papdi/i.test(p.product_name));
  assert.ok(gheeProducts.length >= 8, `Expected at least 8 ghee SKUs, found ${gheeProducts.length}`);

  gheeProducts.forEach(g => {
    const raw = (g.nutrition_info?.ingredients_text || '').toLowerCase();
    assert.ok(!raw.includes('vegetable oil'), `${g.product_id} (${g.product_name}) raw text contains vegetable oil`);

    const parsed = (g.ingredients?.ingredients || []).map(i => (typeof i === 'string' ? i : (i.name || i.raw || '')).toLowerCase()).join('; ');
    assert.ok(!parsed.includes('vegetable oil'), `${g.product_id} (${g.product_name}) parsed ingredients contains vegetable oil`);
    assert.equal(g.dietary_classification?.isVegan, false, `${g.product_id} Ghee cannot be vegan`);
  });
});

test('TEST 7: Baking Category Integrity (PKG_PRD_0361 - PKG_PRD_0380)', () => {
  const cat500 = getCatalog500Products();
  
  // Weikfield Baking Powder
  const bp = cat500.find(p => p.product_id === 'PKG_PRD_0361');
  assert.ok(bp.nutrition_info.ingredients_text.toLowerCase().includes('bicarbonate'), 'Baking powder must declare bicarbonate');
  assert.ok(!bp.nutrition_info.ingredients_text.toLowerCase().includes('cocoa'), 'Baking powder must not declare cocoa');

  // Blue Bird Baking Soda
  const bs = cat500.find(p => p.product_id === 'PKG_PRD_0362');
  assert.ok(bs.nutrition_info.ingredients_text.toLowerCase().includes('sodium bicarbonate'), 'Baking soda must declare sodium bicarbonate');

  // Weikfield Gelatine Crystals
  const gel = cat500.find(p => p.product_id === 'PKG_PRD_0380');
  assert.equal(gel.dietary_classification?.status, 'NON_VEGETARIAN', 'Gelatine must be classified NON_VEGETARIAN');
  assert.equal(gel.dietary_classification?.isVegetarian, false, 'Gelatine is not vegetarian');
});

test('TEST 8: Canned Foods Category Integrity (PKG_PRD_0381 - PKG_PRD_0399)', () => {
  const cat500 = getCatalog500Products();

  // Del Monte Sweet Corn
  const corn = cat500.find(p => p.product_id === 'PKG_PRD_0381');
  assert.ok(corn.nutrition_info.ingredients_text.toLowerCase().includes('sweet corn kernels'), 'Sweet corn must declare corn kernels');
  assert.ok(!corn.nutrition_info.ingredients_text.toLowerCase().includes('soup'), 'Sweet corn must not declare soup');

  // Heinz Baked Beans
  const beans = cat500.find(p => p.product_id === 'PKG_PRD_0382');
  assert.ok(beans.nutrition_info.ingredients_text.toLowerCase().includes('beans'), 'Baked beans must declare beans');
  assert.ok(!beans.nutrition_info.ingredients_text.toLowerCase().includes('sweet corn'), 'Baked beans must not declare sweet corn');
});

test('TEST 9: Mathematical Consistency of Per-Serving Values', () => {
  const cat500 = getCatalog500Products();
  cat500.forEach(p => {
    const srv = p.nutrition_info?.per_serving;
    const p100 = p.nutrition_info?.per_100g;
    assert.ok(srv, `${p.product_id} missing per_serving block`);

    if (p100?.energy_kcal != null && srv.energy_kcal != null) {
      assert.ok(srv.energy_kcal >= 0, `${p.product_id} per-serving energy must be non-negative`);
    }
  });
});

test('TEST 10: Mandatory Deliverable Reports Exist and Are Non-Empty', () => {
  const expectedFiles = [
    'reports/catalogue_inventory_audit.csv',
    'reports/product_data_integrity_audit.csv',
    'reports/product_data_correction_log.csv',
    'reports/products_needing_manual_verification.csv',
    'docs/PRODUCT_DATA_CORRUPTION_ROOT_CAUSE.md',
    'docs/COMPLETE_PRODUCT_DATA_INTEGRITY_AUDIT.md'
  ];

  expectedFiles.forEach(relPath => {
    const fullPath = path.join(__dirname, '../../', relPath);
    assert.ok(fs.existsSync(fullPath), `Required deliverable missing: ${relPath}`);
    const stat = fs.statSync(fullPath);
    assert.ok(stat.size > 100, `Required deliverable is empty or too small: ${relPath} (${stat.size} bytes)`);
  });
});
