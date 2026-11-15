const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const { executeSemanticSearch, parseQueryIntent, evaluateProductForIntent, checkProductDairyContainment } = require('../services/semanticSearchEngine');
const vectorSearchService = require('../services/vectorSearchService');
const catalogLoader = require('../utils/catalogLoader');

describe('SMARTCHOICE SEMANTIC SEARCH CANDIDATE LIMIT & DAIRY-FREE AUDIT SUITE', () => {
  const catalog500 = catalogLoader.getCatalog500Products();

  it('confirms the baseline catalog contains exactly 500 products across 25 categories', () => {
    assert.equal(catalog500.length, 500, 'Catalog-500 must contain exactly 500 products');
    const categories = new Set(catalog500.map(p => Number(p.catalog?.categoryId ?? p.category_id)));
    assert.equal(categories.size, 25, 'Catalog-500 must have exactly 25 categories');
  });

  // --------------------------------------------------------------------------
  // PART 1: EVALUATION OF ENTIRE CATALOGUE (NO 20-ITEM TRUNCATION)
  // --------------------------------------------------------------------------
  describe('Part 1: Catalogue-Wide Candidate Evaluation', () => {
    it('evaluates all 500 products when searching "dairy free" in All Categories', async () => {
      const res = await executeSemanticSearch('dairy free', { limit: 500 });
      assert.equal(res.success, true);
      assert.equal(res.totalCatalogSize, 500, 'Total catalogue size must be 500');
      assert.equal(res.totalEvaluated, 500, 'Must evaluate all 500 candidates, not just 20');
      assert.ok(res.totalMatches >= 280, `Expected >= 280 dairy-free products, got ${res.totalMatches}`);
      assert.equal(res.data.length, res.totalMatches, 'When limit >= totalMatches, all eligible items must be returned');
      assert.equal(res.data.length > 20, true, 'Result count must vastly exceed legacy 20-candidate limit');
    });

    it('sanitizes query intent so "dairy free" does not target Dairy as a product category', () => {
      const intent = parseQueryIntent('dairy free');
      assert.equal(intent.dietary.dairyFree, true);
      assert.ok(intent.ingredients.excluded.includes('milk'));
      assert.deepEqual(intent.targetCategoryIds, [], 'Target category IDs must be empty so non-dairy items are not penalized');
      assert.deepEqual(intent.productTypes, [], 'Product types must be empty for purely dietary queries');
    });

    it('correctly associates product types when dietary query includes product type', () => {
      const intent = parseQueryIntent('dairy free biscuits');
      assert.equal(intent.dietary.dairyFree, true);
      assert.ok(intent.ingredients.excluded.includes('milk'));
      assert.ok(intent.productTypes.includes('biscuits') || intent.productTypes.includes('biscuit'));
      assert.deepEqual(intent.targetCategoryIds, [1], 'Target category must correctly identify Biscuits (Cat 1)');
    });
  });

  // --------------------------------------------------------------------------
  // PART 2: STRICT DAIRY EXCLUSION ACCURACY & ZERO LEAKAGE
  // --------------------------------------------------------------------------
  describe('Part 2: Dairy Derivative Detection & Zero Contamination', () => {
    it('ensures ZERO dairy-containing products leak into "dairy free" results', async () => {
      const res = await executeSemanticSearch('dairy free', { limit: 500 });
      
      const LEAK_CHECK_REGEX = /\b(milk|dairy|ghee|clarified butter|desi ghee|cow ghee|paneer|cheese|cheddar|mozzarella|curd|yogurt|dahi|whey|casein|caseinate|lactose|milk fat|dairy solids|milk solids|milk powder|dairy whitener|malai|khoya|mawa|buttermilk)\b/i;
      const PLANT_BUTTER = /(?:peanut|cocoa|almond|cashew|apple|shea)\s+butter/gi;

      const leaks = [];
      res.data.forEach(item => {
        const p = item.product;
        const pName = p.product_name || p.catalog?.productName || '';
        const pCatName = p.catalog?.categoryName || p.category_name || '';
        const allergens = (p.nutrition_info?.allergens || []).map(a => String(a).toLowerCase());
        
        if (allergens.some(a => a === 'milk' || a === 'dairy')) {
          leaks.push({ id: p.product_id, name: pName, reason: 'Declared milk allergen' });
          return;
        }

        if (/dairy/i.test(pCatName)) {
          leaks.push({ id: p.product_id, name: pName, reason: 'Dairy category product' });
          return;
        }

        let rawIng = (p.nutrition_info?.ingredients_text || '').toLowerCase();
        const splitIdx = rawIng.search(/\b(?:may contain|contain traces of|allergen advice:?\s*may contain)\b/i);
        if (splitIdx !== -1) {
          rawIng = rawIng.substring(0, splitIdx);
        }
        let cleanText = (pName + ' ' + rawIng).replace(PLANT_BUTTER, ' plant_butter ');

        if (LEAK_CHECK_REGEX.test(cleanText)) {
          leaks.push({ id: p.product_id, name: pName, match: cleanText.match(LEAK_CHECK_REGEX)[0] });
        }
      });

      assert.deepEqual(leaks, [], `Zero dairy items may leak into dairy-free search results! Leaks: ${JSON.stringify(leaks)}`);
    });

    it('excludes PKG_PRD_0208 (Mother Dairy Ultimate Cow Ghee) from dairy-free search', async () => {
      const res = await executeSemanticSearch('dairy free', { limit: 500 });
      const ghee = res.data.find(item => item.product.product_id === 'PKG_PRD_0208' || item.product.catalog?.productId === 'PKG_PRD_0208');
      assert.equal(ghee, undefined, 'Mother Dairy Cow Ghee must be excluded from dairy-free search');
    });

    it('excludes all products in Category 13 (Packaged Dairy & Cheese)', async () => {
      const res = await executeSemanticSearch('dairy free', { categoryId: 13, limit: 500 });
      assert.equal(res.totalMatches, 0, 'Packaged Dairy & Cheese must return 0 eligible dairy-free products');
      assert.equal(res.data.length, 0);
    });

    it('excludes all protein bars with whey / milk proteins in Category 21', async () => {
      const res = await executeSemanticSearch('dairy free', { categoryId: 21, limit: 500 });
      assert.equal(res.totalMatches, 0, 'Protein & Energy Bars with whey/milk protein must return 0 products');
    });

    it('preserves non-dairy plant butters (Pintola Peanut Butter) in Category 7', async () => {
      const res = await executeSemanticSearch('dairy free', { categoryId: 7, limit: 500 });
      assert.ok(res.totalMatches >= 16, `Expected >= 16 dairy-free products in Category 7, got ${res.totalMatches}`);
      const pintola = res.data.find(item => (item.product.product_name || item.product.catalog?.productName || '').includes('Pintola All Natural Peanut Butter'));
      assert.ok(pintola, 'Pintola All Natural Peanut Butter (100% peanuts) must NOT be excluded by butter regex');
    });

    it('retains all 12 pure vegetable cooking oils while excluding all 8 cow/desi ghees in Category 11', async () => {
      const res = await executeSemanticSearch('dairy free', { categoryId: 11, limit: 500 });
      assert.equal(res.totalMatches, 12, 'Cooking Oils & Ghee must return exactly 12 vegetable oils');
      res.data.forEach(item => {
        const name = (item.product.product_name || '').toLowerCase();
        assert.equal(name.includes('ghee'), false, 'No ghee product may appear in dairy-free cooking oils');
      });
    });

    it('retains all 20 products in pure non-dairy categories (Juices, Spices, Teas, Flours, Nuts, Sodas) and respects allergen warnings in Cereals', async () => {
      const pureNonDairyCategories = [5, 9, 10, 16, 17, 18, 23];
      for (const catId of pureNonDairyCategories) {
        const res = await executeSemanticSearch('dairy free', { categoryId: catId, limit: 500 });
        assert.equal(res.totalMatches, 20, `Category ${catId} must return all 20 products as dairy-free`);
      }

      // Category 2 (Breakfast Cereals & Oats) has 12 products declaring "May contain milk" allergen warnings
      // Under strict evidence-based classification, only the 8 verified dairy-free products are returned
      const cerealRes = await executeSemanticSearch('dairy free', { categoryId: 2, limit: 500 });
      assert.equal(cerealRes.totalMatches, 8, 'Category 2 must return 8 verified dairy-free products (12 excluded for May Contain Milk warnings)');
    });
  });

  // --------------------------------------------------------------------------
  // PART 3: SCALABLE CANDIDATE RETRIEVAL, RANKING & STRUCTURED PAGINATION
  // --------------------------------------------------------------------------
  describe('Part 3: Structured Pagination & Vector Ranking Independence', () => {
    it('correctly supports pagination with page and limit parameters', async () => {
      const page1 = await executeSemanticSearch('dairy free', { page: 1, limit: 20 });
      const page2 = await executeSemanticSearch('dairy free', { page: 2, limit: 20 });

      assert.equal(page1.data.length, 20);
      assert.equal(page2.data.length, 20);
      assert.equal(page1.pagination.page, 1);
      assert.equal(page2.pagination.page, 2);
      assert.equal(page1.pagination.totalCount, page1.totalMatches);
      assert.equal(page1.pagination.totalPages, Math.ceil(page1.totalMatches / 20));
      assert.equal(page1.pagination.hasNextPage, true);

      // Verify page 1 and page 2 products are mutually exclusive (no duplicates)
      const idsPage1 = new Set(page1.data.map(i => i.product.product_id));
      const idsPage2 = new Set(page2.data.map(i => i.product.product_id));
      for (const id of idsPage2) {
        assert.equal(idsPage1.has(id), false, `Product ${id} appeared on both page 1 and page 2`);
      }
    });

    it('iterates through all pages without omitting any eligible product', async () => {
      const limit = 50;
      const firstPage = await executeSemanticSearch('dairy free', { page: 1, limit });
      const totalEligible = firstPage.totalMatches;
      const totalPages = firstPage.pagination.totalPages;

      const collectedIds = new Set();
      for (let p = 1; p <= totalPages; p++) {
        const pageRes = await executeSemanticSearch('dairy free', { page: p, limit });
        pageRes.data.forEach(item => {
          assert.equal(collectedIds.has(item.product.product_id), false, `Duplicate product ${item.product.product_id} across pages`);
          collectedIds.add(item.product.product_id);
        });
      }

      assert.equal(collectedIds.size, totalEligible, 'Sum of all paginated items must equal totalMatches exactly');
    });

    it('vectorSearchService semanticProductSearch returns full metadata and complete candidate list', async () => {
      const res = await vectorSearchService.semanticProductSearch('dairy free', { limit: 500 });
      assert.equal(res.success, true);
      assert.equal(res.totalCatalogSize, 500);
      assert.equal(res.totalEvaluated, 500);
      assert.ok(res.totalMatches >= 280);
      assert.equal(res.data.length, res.totalMatches);
    });
  });

  // --------------------------------------------------------------------------
  // PART 4: GENERALIZATION TO OTHER DIETARY & INGREDIENT EXCLUSION QUERIES
  // --------------------------------------------------------------------------
  describe('Part 4: Generalization Across Semantic Dietary Queries', () => {
    it('evaluates all 500 candidates for "gluten free"', async () => {
      const res = await executeSemanticSearch('gluten free', { limit: 500 });
      assert.equal(res.totalCatalogSize, 500);
      assert.equal(res.totalEvaluated, 500);
      assert.ok(res.totalMatches > 0);
      res.data.forEach(item => {
        const p = item.product;
        const ings = ((p.nutrition_info?.ingredients_text || '') + ' ' + (p.product_name || '')).toLowerCase();
        const allergens = (p.nutrition_info?.allergens || []).map(a => a.toLowerCase());
        assert.equal(allergens.includes('gluten') || allergens.includes('wheat'), false);
        assert.equal(/\b(wheat|maida|atta|sooji|semolina|barley|malt|rye|spelt)\b/i.test(ings), false);
      });
    });

    it('evaluates all 500 candidates for "without palm oil"', async () => {
      const res = await executeSemanticSearch('without palm oil', { limit: 500 });
      assert.equal(res.totalCatalogSize, 500);
      assert.equal(res.totalEvaluated, 500);
      assert.ok(res.totalMatches > 0);
      res.data.forEach(item => {
        const ings = (item.product.nutrition_info?.ingredients_text || '').toLowerCase();
        assert.equal(/\b(palm oil|palmolein|palm kernel|elaeis guineensis)\b/i.test(ings), false);
      });
    });

    it('evaluates all 500 candidates for "peanut free"', async () => {
      const res = await executeSemanticSearch('peanut free', { limit: 500 });
      assert.equal(res.totalCatalogSize, 500);
      assert.equal(res.totalEvaluated, 500);
      assert.ok(res.totalMatches > 0);
      res.data.forEach(item => {
        const p = item.product;
        const ings = (p.nutrition_info?.ingredients_text || '').toLowerCase();
        const allergens = (p.nutrition_info?.allergens || []).map(a => a.toLowerCase());
        assert.equal(allergens.includes('peanut'), false);
        assert.equal(/\b(peanut|peanuts|groundnut)\b/i.test(ings), false);
      });
    });
  });

  // --------------------------------------------------------------------------
  // PART 5: HTTP ENDPOINT VERIFICATION
  // --------------------------------------------------------------------------
  describe('Part 5: HTTP API Verification (/api/search/semantic)', () => {
    it('returns all dairy-free products via HTTP API', async () => {
      const data = await new Promise((resolve, reject) => {
        http.get('http://localhost:8080/api/search/semantic?q=dairy+free', res => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
      });

      assert.equal(data.success, true);
      assert.equal(data.totalCatalogSize, 500);
      assert.equal(data.totalEvaluated, 500);
      assert.ok(data.totalMatches >= 280);
      assert.equal(data.data.length, data.totalMatches);
    });

    it('returns category scoped dairy-free products via HTTP API', async () => {
      const data = await new Promise((resolve, reject) => {
        http.get('http://localhost:8080/api/search/semantic?q=dairy+free&categoryId=13', res => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
      });

      assert.equal(data.success, true);
      assert.equal(data.totalMatches, 0);
      assert.equal(data.data.length, 0);
    });
  });
});
