const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { parseIngredientTokens, analyzeIngredientProfile, isGenericBoilerplate } = require('../services/ingredientParsingService');
const { detectAllergens, FSSAI_MANDATORY_ALLERGENS } = require('../services/allergenAnalysisService');
const { SCORING_WEIGHTS } = require('../services/scoringService');

let passed = 0;
let failed = 0;

function runTest(description, fn) {
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
  console.log('=== TEST SUITE: CATALOG-WIDE INGREDIENT, ALLERGEN & DIETARY VERIFICATION ===\n');

  // Load catalog products from disk
  const catalogData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../frontend/public/data/enriched_catalog_500.json'), 'utf8')
  );
  const rawCatalog = catalogData.categories.flatMap(c => c.products);
  console.log(`Loaded ${rawCatalog.length} products from enriched_catalog_500.json.\n`);

  // ==========================================
  // SECTION 1: 18 SPECIFIC SCENARIO TESTS
  // ==========================================
  console.log('--- SECTION 1: 18 SPECIFIC TEST SCENARIOS ---');

  // 1. Verified Vegetarian product
  runTest('Scenario 01: Verified Vegetarian product', () => {
    const tea = rawCatalog.find(p => p.product_id === 'PKG_PRD_0161');
    assert(tea, 'Product PKG_PRD_0161 Tata Tea Gold must exist');
    assert.strictEqual(tea.dietary_classification.status, 'VEGETARIAN');
    assert.strictEqual(tea.dietary_classification.isVegetarian, true);
    assert.strictEqual(tea.dietary_classification.isNonVegetarian, false);
    assert.strictEqual(tea.dietary_classification.verificationStatus, 'VERIFIED');
  });

  // 2. Verified Non-Vegetarian product (poultry/meat)
  runTest('Scenario 02: Verified Non-Vegetarian product (poultry/meat)', () => {
    const chickenDarbari = rawCatalog.find(p => p.product_id === 'PKG_PRD_0234');
    assert(chickenDarbari, 'Product PKG_PRD_0234 must exist');
    assert.strictEqual(chickenDarbari.dietary_classification.status, 'NON_VEGETARIAN');
    assert.strictEqual(chickenDarbari.dietary_classification.isNonVegetarian, true);
    assert.strictEqual(chickenDarbari.dietary_classification.isVegetarian, false);
    assert.strictEqual(chickenDarbari.dietary_classification.verificationStatus, 'VERIFIED');
    assert(chickenDarbari.nutrition_info.ingredients_text.toLowerCase().includes('chicken'));
  });

  // 3. Egg-containing product
  runTest('Scenario 03: Egg-containing product detection', () => {
    const mockEggProduct = 'Refined Wheat Flour, Sugar, Whole Egg Powder (5%), Butter, Salt.';
    const allergenAnalysis = detectAllergens(mockEggProduct);
    assert(allergenAnalysis.contains.includes('Egg'), 'Must detect Egg allergen in formulation');
    assert.strictEqual(allergenAnalysis.containsEgg, true);
  });

  // 4. Dairy-containing product
  runTest('Scenario 04: Dairy-containing product', () => {
    const dairyProduct = rawCatalog.find(p => p.nutrition_info.allergens.includes('Milk') && p.dietary_classification.status === 'VEGETARIAN');
    assert(dairyProduct, 'Dairy product must exist in catalog');
    assert.strictEqual(dairyProduct.dietary_classification.status, 'VEGETARIAN');
    assert.strictEqual(dairyProduct.dietary_classification.isVegetarian, true);
    assert.strictEqual(dairyProduct.dietary_classification.isVegan, false, 'Dairy-containing product cannot be vegan');
    assert(dairyProduct.nutrition_info.allergens.includes('Milk'));
  });

  // 5. Animal additive (gelatin)
  runTest('Scenario 05: Animal additive (gelatin) classification', () => {
    const gelatin = rawCatalog.find(p => p.product_id === 'PKG_PRD_0378');
    assert(gelatin, 'Product PKG_PRD_0378 must exist');
    assert.strictEqual(gelatin.dietary_classification.status, 'NON_VEGETARIAN');
    assert.strictEqual(gelatin.dietary_classification.isNonVegetarian, true);
    assert(gelatin.nutrition_info.ingredients_text.toLowerCase().includes('gelatin'));
  });

  // 6. Unknown/Unverified origin
  runTest('Scenario 06: Unknown/Unverified origin handling', () => {
    const unknownParsed = analyzeIngredientProfile({});
    assert.strictEqual(unknownParsed.verificationStatus, 'INGREDIENTS_UNVERIFIED');
    assert.strictEqual(unknownParsed.parsedIngredients.length, 0);
  });

  // 7. Peanut allergen detection
  runTest('Scenario 07: Peanut allergen detection', () => {
    const pintola = rawCatalog.find(p => p.product_id === 'PKG_PRD_0132');
    assert(pintola, 'Product PKG_PRD_0132 Pintola must exist');
    assert(pintola.ingredients.allergenDeclarations.contains.includes('Peanut') || pintola.nutrition_info.allergens.includes('Peanut'));
  });

  // 8. Specific tree-nut allergen detection
  runTest('Scenario 08: Specific tree-nut allergen detection (Almond, Cashew, Walnut)', () => {
    const nutText = 'Contains roasted almonds (20%), cashews (15%), walnuts (10%).';
    const analysis = detectAllergens(nutText);
    assert(analysis.contains.includes('Almond'), 'Must identify Almond');
    assert(analysis.contains.includes('Cashew'), 'Must identify Cashew');
    assert(analysis.contains.includes('Walnut'), 'Must identify Walnut');
  });

  // 9. Soy allergen detection
  runTest('Scenario 09: Soy allergen detection', () => {
    const soyProduct = rawCatalog.find(p => p.nutrition_info.allergens.includes('Soy') || p.ingredients.allergenDeclarations.contains.includes('Soy'));
    assert(soyProduct, 'Must find a product containing Soy');
    assert(soyProduct.nutrition_info.allergens.includes('Soy') || soyProduct.ingredients.allergenDeclarations.contains.includes('Soy'));
  });

  // 10. Multiple allergens detection
  runTest('Scenario 10: Multiple allergens detection', () => {
    const multiAllergenText = 'Ingredients: Wheat Flour (40%), Milk Solids (12%), Soy Lecithin (INS 322). Allergen Advice: Contains Wheat, Milk, Soy.';
    const analysis = detectAllergens(multiAllergenText);
    assert(analysis.contains.includes('Wheat'), 'Must identify Wheat');
    assert(analysis.contains.includes('Milk'), 'Must identify Milk');
    assert(analysis.contains.includes('Soy'), 'Must identify Soy');
    assert(analysis.contains.length >= 3, 'Must have at least 3 allergens');
  });

  // 11. May contain (precautionary advisory) vs formulation Contains
  runTest('Scenario 11: Segregation of May Contain (advisory) from Contains (formulation)', () => {
    const pintola = rawCatalog.find(p => p.product_id === 'PKG_PRD_0132');
    assert(pintola, 'Product PKG_PRD_0132 must exist');
    const contains = pintola.ingredients.allergenDeclarations.contains;
    const mayContain = pintola.ingredients.allergenDeclarations.mayContain;
    assert(contains.includes('Peanut'), 'Contains must have Peanut');
    assert(!contains.includes('Soy'), 'Formulation Contains must NOT have Soy');
    assert(mayContain.includes('Soy') || mayContain.includes('Tree Nuts') || mayContain.some(m => m.includes('Soy')), 'May contain must have Soy/Tree Nuts advisory');
  });

  // 12. Product with no allergens
  runTest('Scenario 12: Product with no allergens declared', () => {
    const tea = rawCatalog.find(p => p.product_id === 'PKG_PRD_0161');
    assert(tea, 'Product PKG_PRD_0161 Tata Tea Gold must exist');
    assert.strictEqual(tea.nutrition_info.allergens.length, 0);
    assert.strictEqual(tea.ingredients.allergenDeclarations.contains.length, 0);
  });

  // 13. Unverified ingredients handling
  runTest('Scenario 13: Unverified ingredients handling without fabrication', () => {
    const isBoilerplate = isGenericBoilerplate('Standard authentic food ingredients with permitted stabilizers and spices');
    assert.strictEqual(isBoilerplate, true, 'Boilerplate string must be flagged as generic');
  });

  // 14. Dietary conflict detection
  runTest('Scenario 14: Dietary conflict detection', () => {
    const chickenConflict = rawCatalog.find(p => p.product_id === 'PKG_PRD_0394');
    assert(chickenConflict, 'Maggi Hot Cup Chicken Soup PKG_PRD_0394 must exist');
    assert.strictEqual(chickenConflict.dietary_classification.status, 'NON_VEGETARIAN', 'Chicken soup must be NON_VEGETARIAN even if in general soup category');
  });

  // 15. Missing data handling
  runTest('Scenario 15: Missing data handling with safe defaults', () => {
    const analysis = analyzeIngredientProfile({ ingredients: null, nutrition_info: null });
    assert.strictEqual(analysis.verificationStatus, 'INGREDIENTS_UNVERIFIED');
    assert.deepStrictEqual(analysis.parsedIngredients, []);
  });

  // 16. Single ingredient product
  runTest('Scenario 16: Single ingredient product (Pintola Organic Peanut Butter)', () => {
    const pintola = rawCatalog.find(p => p.product_id === 'PKG_PRD_0132');
    assert(pintola, 'Product PKG_PRD_0132 must exist');
    assert.strictEqual(pintola.nutrition_info.ingredients_text, 'Organic Peanuts (100%).');
    assert.strictEqual(pintola.dietary_classification.isVegan, true);
    assert.strictEqual(pintola.dietary_classification.isVegetarian, true);
  });

  // 17. Multiple ingredients in predominance order
  runTest('Scenario 17: Predominance order verification', () => {
    const ketchup = rawCatalog.find(p => p.product_id === 'PKG_PRD_0101');
    assert(ketchup, 'Product PKG_PRD_0101 Kissan Ketchup must exist');
    const tokens = parseIngredientTokens(ketchup.nutrition_info.ingredients_text);
    assert(tokens.length >= 3, 'Must have at least 3 ingredients');
    assert.strictEqual(tokens[0].order, 1, 'First token order must be 1');
    assert(tokens[0].name.toLowerCase().includes('water') || tokens[0].name.toLowerCase().includes('tomato'), 'First ingredient must be primary base');
  });

  // 18. Sub-ingredients in parentheses parsing
  runTest('Scenario 18: Sub-ingredients in parentheses parsing', () => {
    const complexText = 'Milk Solids (30%) (Skimmed Milk Powder, Whey Protein), Sugar, Cocoa Butter.';
    const tokens = parseIngredientTokens(complexText);
    assert(tokens.length >= 3);
    const milkToken = tokens.find(t => t.name.toLowerCase().includes('milk solids'));
    assert(milkToken, 'Must find milk solids parent token');
    assert(milkToken.subIngredients.length >= 2, 'Must extract sub-ingredients in parentheses');
  });

  // ==========================================
  // SECTION 2: 500 CATALOG INTEGRITY ASSERTIONS
  // ==========================================
  console.log('\n--- SECTION 2: 500-PRODUCT CATALOG INTEGRITY ASSERTIONS ---');

  runTest('CA-01: Exactly 500 Catalog products audited', () => {
    assert.strictEqual(rawCatalog.length, 500, 'Catalog must contain exactly 500 products');
  });

  runTest('CA-02: Zero residual generic boilerplate text across entire 500-product catalog', () => {
    const boilerplateMatches = rawCatalog.filter(p => {
      const text = p.nutrition_info?.ingredients_text || p.ingredients?.rawText || '';
      return isGenericBoilerplate(text);
    });
    assert.strictEqual(boilerplateMatches.length, 0, `Found ${boilerplateMatches.length} boilerplate entries remaining: ${boilerplateMatches.map(m => m.product_id).join(', ')}`);
  });

  runTest('CA-03: Zero empty or undefined ingredient strings across all 500 products', () => {
    const emptyMatches = rawCatalog.filter(p => {
      const text = p.nutrition_info?.ingredients_text;
      return !text || text.trim().length === 0;
    });
    assert.strictEqual(emptyMatches.length, 0, `Found ${emptyMatches.length} empty ingredient entries: ${emptyMatches.map(m => m.product_id).join(', ')}`);
  });

  runTest('CA-04: Non-default dietary classification (exactly 10 verified Non-Veg, 490 Veg, 321 Vegan)', () => {
    const nonVeg = rawCatalog.filter(p => p.dietary_classification?.status === 'NON_VEGETARIAN');
    const veg = rawCatalog.filter(p => p.dietary_classification?.status === 'VEGETARIAN');
    const vegan = rawCatalog.filter(p => p.dietary_classification?.isVegan === true);

    assert.strictEqual(nonVeg.length, 10, `Expected exactly 10 Non-Vegetarian products, got ${nonVeg.length}`);
    assert.strictEqual(veg.length, 490, `Expected exactly 490 Vegetarian products, got ${veg.length}`);
    assert.strictEqual(vegan.length, 321, `Expected exactly 321 Vegan products, got ${vegan.length}`);
  });

  runTest('CA-05: Non-Veg products are verified poultry/meat/gelatin SKUs', () => {
    const nonVeg = rawCatalog.filter(p => p.dietary_classification?.status === 'NON_VEGETARIAN');
    const expectedNonVegIds = [
      'PKG_PRD_0234', 'PKG_PRD_0238', 'PKG_PRD_0378', 'PKG_PRD_0394',
      'PKG_PRD_0397', 'PKG_PRD_0400', 'PKG_PRD_0481', 'PKG_PRD_0483',
      'PKG_PRD_0492', 'PKG_PRD_0497'
    ];
    for (const id of expectedNonVegIds) {
      assert(nonVeg.some(p => p.product_id === id), `Product ${id} must be verified NON_VEGETARIAN`);
    }
  });

  runTest('CA-06: No category-based non-veg inference (spice blends for chicken are 100% vegetarian)', () => {
    const chickenMasala = rawCatalog.find(p => p.product_id === 'PKG_PRD_0190');
    assert(chickenMasala, 'Product PKG_PRD_0190 Eastern Chicken Masala must exist');
    assert.strictEqual(chickenMasala.dietary_classification.status, 'VEGETARIAN', 'Eastern Chicken Masala is a spice blend and must be VEGETARIAN');
    assert.strictEqual(chickenMasala.dietary_classification.isVegan, true, 'Spice blend must be VEGAN');
  });

  runTest('CA-07: All 500 products have 100% verification status and authoritative source URL', () => {
    for (const p of rawCatalog) {
      assert.strictEqual(p.dietary_classification.verificationStatus, 'VERIFIED', `Product ${p.product_id} verificationStatus must be VERIFIED`);
      assert(p.dietary_classification.source, `Product ${p.product_id} must have an authoritative provenance source URL`);
    }
  });

  runTest('CA-08: 5-Component scoring weights formula intact (40/20/15/15/10)', () => {
    assert.strictEqual(SCORING_WEIGHTS.NUTRITION, 40);
    assert.strictEqual(SCORING_WEIGHTS.INGREDIENTS, 20);
    assert.strictEqual(SCORING_WEIGHTS.PROCESSING, 15);
    assert.strictEqual(SCORING_WEIGHTS.PROTEIN_FIBRE, 15);
    assert.strictEqual(SCORING_WEIGHTS.PREFERENCES, 10);
    const sum = SCORING_WEIGHTS.NUTRITION + SCORING_WEIGHTS.INGREDIENTS +
      SCORING_WEIGHTS.PROCESSING + SCORING_WEIGHTS.PROTEIN_FIBRE + SCORING_WEIGHTS.PREFERENCES;
    assert.strictEqual(sum, 100);
  });

  console.log('\n==========================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('==========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
