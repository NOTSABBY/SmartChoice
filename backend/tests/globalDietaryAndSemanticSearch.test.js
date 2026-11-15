const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { evaluateProductEligibility } = require('../services/eligibilityService');
const { classifyProductDietary } = require('../utils/dietaryClassifier');
const { parseQueryIntent, evaluateProductForIntent, executeSemanticSearch } = require('../services/semanticSearchEngine');
const vectorSearchService = require('../services/vectorSearchService');
const catalogLoader = require('../utils/catalogLoader');

describe('SMARTCHOICE FINAL DIETARY CLASSIFICATION, PREFERENCE & STRICT EXCLUSION TEST SUITE', () => {
  const allProducts = catalogLoader.loadProductsFromDisk();

  // Find sample products with verified profiles
  const chickenItem = allProducts.find(p => p.dietary_classification?.status === 'NON_VEGETARIAN');
  const veganItem = allProducts.find(p => p.dietary_classification?.status === 'VEGAN');
  const dairyVegetarianItem = allProducts.find(p => p.dietary_classification?.status === 'VEGETARIAN');
  const peanutItem = allProducts.find(p => {
    const raw = JSON.stringify(p.ingredients || {}).toLowerCase() + ' ' + (p.nutrition_info?.ingredients_text || '').toLowerCase();
    return raw.includes('peanut');
  });
  const milkItem = allProducts.find(p => {
    const raw = JSON.stringify(p.ingredients || {}).toLowerCase() + ' ' + (p.nutrition_info?.ingredients_text || '').toLowerCase();
    return raw.includes('milk solids') || raw.includes('butter') || raw.includes('skimmed milk');
  });
  const palmOilItem = allProducts.find(p => {
    const raw = JSON.stringify(p.ingredients || {}).toLowerCase() + ' ' + (p.nutrition_info?.ingredients_text || '').toLowerCase();
    return raw.includes('palm oil') || raw.includes('palmolein') || raw.includes('rbd palm');
  });
  const msgItem = allProducts.find(p => {
    const raw = JSON.stringify(p.ingredients || {}).toLowerCase() + ' ' + (p.nutrition_info?.ingredients_text || '').toLowerCase();
    return raw.includes('msg') || raw.includes('monosodium glutamate') || raw.includes('ins 621') || raw.includes('e621');
  });

  // --------------------------------------------------------------------------
  // TEST A: STRICT ALLERGEN EXCLUSIONS
  // --------------------------------------------------------------------------
  describe('Test A: Strict Allergen Exclusion ("peanuts, milk")', () => {
    it('excludes products containing or declaring peanuts or milk across all categories in both Master Catalog and Recommendation Engine', () => {
      const prefs = { avoidAllergens: ['peanuts', 'milk'] };

      if (peanutItem) {
        const mcRes = evaluateProductEligibility(peanutItem, prefs, { scope: 'catalog' });
        const recRes = evaluateProductEligibility(peanutItem, prefs, { scope: 'recommendation' });
        assert.equal(mcRes.eligible, false, 'Peanut item must be excluded from Master Catalog');
        assert.equal(recRes.eligible, false, 'Peanut item must be excluded from Recommendation Engine');
      }

      if (milkItem) {
        const mcRes = evaluateProductEligibility(milkItem, prefs, { scope: 'catalog' });
        const recRes = evaluateProductEligibility(milkItem, prefs, { scope: 'recommendation' });
        assert.equal(mcRes.eligible, false, 'Milk item must be excluded from Master Catalog');
        assert.equal(recRes.eligible, false, 'Milk item must be excluded from Recommendation Engine');
      }
    });

    it('conservatively excludes MAY CONTAIN allergen cross-contact declarations', () => {
      const mayContainItem = {
        ingredients: {
          rawIngredientsText: 'Whole wheat flour, sugar, salt. May contain traces of peanuts.',
          allergenDeclarations: { mayContain: ['peanuts'], status: 'ALLERGENS_IDENTIFIED' }
        }
      };
      const res = evaluateProductEligibility(mayContainItem, { avoidAllergens: ['peanuts'] });
      assert.equal(res.eligible, false);
      assert.ok(res.reasons.some(r => r.includes('May Contain') || r.includes('Advisory')));
    });

    it('excludes products with unresolved UNKNOWN allergen declarations where absence cannot be verified', () => {
      const unknownAllergenItem = {
        ingredients: {
          rawIngredientsText: '',
          ingredients: [],
          allergenDeclarations: { status: 'UNKNOWN' }
        }
      };
      const res = evaluateProductEligibility(unknownAllergenItem, { avoidAllergens: ['peanuts'] });
      assert.equal(res.eligible, false);
    });
  });

  // --------------------------------------------------------------------------
  // TEST B: STRICT INGREDIENT EXCLUSIONS
  // --------------------------------------------------------------------------
  describe('Test B: Strict Ingredient Exclusion ("palm oil, MSG")', () => {
    it('excludes products containing palm oil or MSG across both pages', () => {
      const prefs = { excludedIngredients: ['palm oil', 'MSG'] };

      if (palmOilItem) {
        const mcRes = evaluateProductEligibility(palmOilItem, prefs, { scope: 'catalog' });
        const recRes = evaluateProductEligibility(palmOilItem, prefs, { scope: 'recommendation' });
        assert.equal(mcRes.eligible, false, 'Palm oil product must be excluded from Master Catalog');
        assert.equal(recRes.eligible, false, 'Palm oil product must be excluded from Recommendation Engine');
      }

      const mockMsgProduct = {
        ingredients: {
          rawIngredientsText: 'Noodles, Dehydrated Vegetables, Flavour Enhancer (INS 621), Salt.',
          ingredients: ['Noodles', 'Dehydrated Vegetables', 'Flavour Enhancer (INS 621)', 'Salt']
        }
      };
      const resMsg = evaluateProductEligibility(mockMsgProduct, prefs, { scope: 'catalog' });
      assert.equal(resMsg.eligible, false, 'INS 621 / MSG must trigger ingredient exclusion');
    });

    it('excludes products with incomplete or missing ingredient lists under strict ingredient exclusion policy', () => {
      const incompleteItem = {
        ingredients: { rawIngredientsText: '', ingredients: [] }
      };
      const res = evaluateProductEligibility(incompleteItem, { excludedIngredients: ['palm oil'] });
      assert.equal(res.eligible, false, 'Missing ingredient list cannot prove absence of excluded ingredient');
    });
  });

  // --------------------------------------------------------------------------
  // TEST C: MULTIPLE EXCLUSIONS (OR LOGIC)
  // --------------------------------------------------------------------------
  describe('Test C: Multiple Exclusions with OR Logic', () => {
    it('excludes a product if it contains ANY one of the avoided allergens OR excluded ingredients', () => {
      const prefs = {
        avoidAllergens: ['peanuts', 'milk'],
        excludedIngredients: ['palm oil', 'MSG']
      };

      if (peanutItem) {
        assert.equal(evaluateProductEligibility(peanutItem, prefs).eligible, false);
      }
      if (milkItem) {
        assert.equal(evaluateProductEligibility(milkItem, prefs).eligible, false);
      }
      if (palmOilItem) {
        assert.equal(evaluateProductEligibility(palmOilItem, prefs).eligible, false);
      }

      // Safe product free of all 4
      const safeProduct = {
        dietary_classification: { status: 'VEGAN' },
        ingredients: {
          rawIngredientsText: 'Roasted Chickpeas, Sunflower Oil, Cumin, Black Salt.',
          ingredients: ['Roasted Chickpeas', 'Sunflower Oil', 'Cumin', 'Black Salt'],
          allergenDeclarations: { contains: [], mayContain: [], status: 'ALLERGENS_IDENTIFIED' }
        }
      };
      assert.equal(evaluateProductEligibility(safeProduct, prefs).eligible, true);
    });
  });

  // --------------------------------------------------------------------------
  // TEST D: VEGETARIAN ONLY
  // --------------------------------------------------------------------------
  describe('Test D: Vegetarian Selected Alone in Recommendation Engine', () => {
    const prefs = { vegetarian: true, vegan: false };

    it('shows VERIFIED VEGETARIAN products in Recommendation Engine', () => {
      assert.ok(dairyVegetarianItem, 'Dairy vegetarian item should exist');
      const res = evaluateProductEligibility(dairyVegetarianItem, prefs, { scope: 'recommendation' });
      assert.equal(res.eligible, true, 'Vegetarian product must appear when Vegetarian is selected alone');
    });

    it('excludes VEGAN products under application Vegetarian-only classification rule', () => {
      assert.ok(veganItem, 'Vegan item should exist');
      const res = evaluateProductEligibility(veganItem, prefs, { scope: 'recommendation' });
      assert.equal(res.eligible, false, 'Vegan product must be excluded when Vegetarian is selected alone');
    });

    it('excludes NON_VEGETARIAN products', () => {
      assert.ok(chickenItem, 'Chicken item should exist');
      const res = evaluateProductEligibility(chickenItem, prefs, { scope: 'recommendation' });
      assert.equal(res.eligible, false, 'Non-vegetarian product must be excluded');
    });

    it('excludes UNKNOWN dietary products', () => {
      const unk = { ingredients: { rawIngredientsText: 'Unknown ingredients' }, dietary_classification: { status: 'UNKNOWN' } };
      const res = evaluateProductEligibility(unk, prefs, { scope: 'recommendation' });
      assert.equal(res.eligible, false, 'Unknown dietary product must be excluded');
    });

    it('does NOT affect Master Catalog (Master Catalog remains neutral to Vegetarian selection)', () => {
      if (veganItem) {
        const mcVegan = evaluateProductEligibility(veganItem, prefs, { scope: 'catalog' });
        assert.equal(mcVegan.eligible, true, 'Vegan item remains visible in Master Catalog');
      }
      if (dairyVegetarianItem) {
        const mcVeg = evaluateProductEligibility(dairyVegetarianItem, prefs, { scope: 'catalog' });
        assert.equal(mcVeg.eligible, true, 'Vegetarian item remains visible in Master Catalog');
      }
      if (chickenItem) {
        const mcChicken = evaluateProductEligibility(chickenItem, prefs, { scope: 'catalog' });
        assert.equal(mcChicken.eligible, true, 'Chicken item remains visible in Master Catalog (unless allergen/ingredient excluded)');
      }
    });
  });

  // --------------------------------------------------------------------------
  // TEST E: VEGAN ONLY
  // --------------------------------------------------------------------------
  describe('Test E: Vegan Selected Alone in Recommendation Engine', () => {
    const prefs = { vegetarian: false, vegan: true };

    it('shows VERIFIED VEGAN products in Recommendation Engine', () => {
      assert.ok(veganItem, 'Vegan item should exist');
      const res = evaluateProductEligibility(veganItem, prefs, { scope: 'recommendation' });
      assert.equal(res.eligible, true, 'Vegan product must appear when Vegan is selected alone');
    });

    it('excludes VEGETARIAN products (dairy, honey, animal derivatives)', () => {
      assert.ok(dairyVegetarianItem, 'Dairy vegetarian item should exist');
      const res = evaluateProductEligibility(dairyVegetarianItem, prefs, { scope: 'recommendation' });
      assert.equal(res.eligible, false, 'Vegetarian product must be excluded when Vegan is selected alone');
    });

    it('excludes NON_VEGETARIAN products', () => {
      assert.ok(chickenItem, 'Chicken item should exist');
      const res = evaluateProductEligibility(chickenItem, prefs, { scope: 'recommendation' });
      assert.equal(res.eligible, false, 'Non-vegetarian product must be excluded');
    });

    it('excludes UNKNOWN dietary products', () => {
      const unk = { ingredients: { rawIngredientsText: 'Unknown ingredients' }, dietary_classification: { status: 'UNKNOWN' } };
      const res = evaluateProductEligibility(unk, prefs, { scope: 'recommendation' });
      assert.equal(res.eligible, false, 'Unknown dietary product must be excluded');
    });

    it('does NOT affect Master Catalog (Master Catalog remains neutral to Vegan selection)', () => {
      if (dairyVegetarianItem) {
        const mcVeg = evaluateProductEligibility(dairyVegetarianItem, prefs, { scope: 'catalog' });
        assert.equal(mcVeg.eligible, true, 'Vegetarian item remains visible in Master Catalog');
      }
      if (chickenItem) {
        const mcChicken = evaluateProductEligibility(chickenItem, prefs, { scope: 'catalog' });
        assert.equal(mcChicken.eligible, true, 'Chicken item remains visible in Master Catalog');
      }
    });
  });

  // --------------------------------------------------------------------------
  // TEST F: BOTH VEGETARIAN AND VEGAN SELECTED
  // --------------------------------------------------------------------------
  describe('Test F: Both Vegetarian and Vegan Selected', () => {
    const prefs = { vegetarian: true, vegan: true };

    it('shows VERIFIED VEGAN products', () => {
      assert.ok(veganItem);
      const res = evaluateProductEligibility(veganItem, prefs, { scope: 'recommendation' });
      assert.equal(res.eligible, true, 'Vegan product appears when both are selected');
    });

    it('shows VERIFIED VEGETARIAN products', () => {
      assert.ok(dairyVegetarianItem);
      const res = evaluateProductEligibility(dairyVegetarianItem, prefs, { scope: 'recommendation' });
      assert.equal(res.eligible, true, 'Vegetarian product appears when both are selected');
    });

    it('excludes NON_VEGETARIAN products', () => {
      assert.ok(chickenItem);
      const res = evaluateProductEligibility(chickenItem, prefs, { scope: 'recommendation' });
      assert.equal(res.eligible, false, 'Non-vegetarian product must be excluded');
    });

    it('excludes UNKNOWN dietary products', () => {
      const unk = { ingredients: { rawIngredientsText: 'Unknown ingredients' }, dietary_classification: { status: 'UNKNOWN' } };
      const res = evaluateProductEligibility(unk, prefs, { scope: 'recommendation' });
      assert.equal(res.eligible, false, 'Unknown dietary product must be excluded');
    });

    it('does NOT affect Master Catalog', () => {
      if (chickenItem) {
        const mcChicken = evaluateProductEligibility(chickenItem, prefs, { scope: 'catalog' });
        assert.equal(mcChicken.eligible, true, 'Chicken item remains visible in Master Catalog');
      }
    });
  });

  // --------------------------------------------------------------------------
  // TEST G: NEITHER SELECTED
  // --------------------------------------------------------------------------
  describe('Test G: Neither Selected (OFF, OFF)', () => {
    it('applies no dietary lifestyle restrictions; allows all classifications subject to strict exclusions', () => {
      const prefs = { vegetarian: false, vegan: false };
      assert.equal(evaluateProductEligibility(veganItem, prefs, { scope: 'recommendation' }).eligible, true);
      assert.equal(evaluateProductEligibility(dairyVegetarianItem, prefs, { scope: 'recommendation' }).eligible, true);
      assert.equal(evaluateProductEligibility(chickenItem, prefs, { scope: 'recommendation' }).eligible, true);
    });
  });

  // --------------------------------------------------------------------------
  // TEST H: CATEGORY COVERAGE & SEMANTIC SEARCH SCOPE
  // --------------------------------------------------------------------------
  describe('Test H: Search, Semantic Search & Category Coverage', () => {
    it('enforces strict category isolation during semantic search', async () => {
      const res = await executeSemanticSearch('protein', {
        categoryId: 1,
        limit: 10
      });
      assert.ok(res.success);
      assert.ok(res.data.length > 0);
      res.data.forEach(item => {
        const catId = Number(item.product.catalog?.categoryId ?? item.product.category_id);
        assert.equal(catId, 1, 'All results must belong strictly to category 1 (Biscuits & Cookies)');
      });
    });

    it('enforces strict exclusions globally during semantic search in Master Catalog', async () => {
      const res = await executeSemanticSearch('snacks', {
        scope: 'catalog',
        limit: 10,
        preferences: {
          avoidAllergens: ['peanuts'],
          excludedIngredients: ['palm oil']
        }
      });
      assert.ok(res.success);
      res.data.forEach(item => {
        const p = item.product;
        const elig = evaluateProductEligibility(p, {
          avoidAllergens: ['peanuts'],
          excludedIngredients: ['palm oil']
        }, { scope: 'catalog' });
        assert.equal(elig.eligible, true, 'No excluded product should appear in Master Catalog semantic results');
      });
    });

    it('enforces dietary lifestyle rules during semantic search in Recommendation Engine', async () => {
      const res = await executeSemanticSearch('snacks', {
        scope: 'recommendation',
        limit: 10,
        preferences: {
          vegan: true
        }
      });
      assert.ok(res.success);
      res.data.forEach(item => {
        const dc = item.product.dietary_classification || classifyProductDietary(item.product);
        assert.equal(dc.status, 'VEGAN', 'Only verified vegan products should appear in Vegan recommendation search');
      });
    });
  });

  // --------------------------------------------------------------------------
  // TEST I: INGREDIENT-BASED PRODUCT CLASSIFICATION AUDIT
  // --------------------------------------------------------------------------
  describe('Test I: Ingredient-Based Product Classification Audit', () => {
    it('verifies that all 500 catalog products have authoritative dietary classifications backed by ingredient evidence', () => {
      const catalog500 = allProducts.filter(p => p.catalog?.productId || String(p._id).startsWith('PKG_PRD_'));
      assert.equal(catalog500.length, 500, 'Catalog-500 must contain exactly 500 products');
      catalog500.forEach(p => {
        const dc = classifyProductDietary(p);
        assert.ok(['VEGAN', 'VEGETARIAN', 'NON_VEGETARIAN', 'UNKNOWN'].includes(dc.status));
        assert.ok(dc.reason && dc.reason.length > 0);
      });
    });
  });
});
