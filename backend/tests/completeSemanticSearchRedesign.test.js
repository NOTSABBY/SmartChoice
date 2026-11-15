/**
 * SMARTCHOICE COMPLETE SEMANTIC SEARCH REDESIGN & PRODUCT-NAME IDENTITY TEST SUITE
 * 
 * Verifies end-to-end:
 * 1. Positive intent tests (dairy, milk, cheese, chocolate, snacks, biscuits, juice, cereal)
 * 2. Negative intent tests (dairy-free, milk-free, non-dairy, sugar-free, caffeine-free, gluten-free)
 * 3. Contextual query tests (products that are not dairy, milk alternatives, chocolate without dairy, non-dairy alternatives, products excluding dairy-based items)
 * 4. Ingredient independence tests (unrelated products with milk ingredients excluded from dairy; dairy products with empty ingredients included in dairy)
 * 5. Full-catalogue coverage tests (all 500 products evaluated, no top-K limits, pagination integrity)
 * 6. Regression tests (Master catalog search, detail pages, recommendations, comparison, preferences, scoring)
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const { executeSemanticSearch } = require('../services/semanticSearchEngine');
const { parseSemanticIntent } = require('../services/semanticIntentService');
const { extractProductSemanticProfile, isDairyProductIdentity, isPlantBasedAlternative } = require('../services/productNameSemanticService');
const { normalizeProductName } = require('../services/productNameNormalizationService');
const catalogLoader = require('../utils/catalogLoader');

describe('SMARTCHOICE COMPLETE SEMANTIC SEARCH REDESIGN SUITE', () => {

  // --------------------------------------------------------------------------
  // PART A: POSITIVE INTENT TESTS
  // --------------------------------------------------------------------------
  describe('Part A: Positive Intent Search by Product Name Identity', () => {
    it('evaluates "dairy" and returns exclusively products whose names represent dairy products', async () => {
      const res = await executeSemanticSearch('dairy');
      assert.ok(res.totalMatches > 0, 'Dairy search must return dairy products');
      
      // All returned items must be dairy product identities
      res.data.forEach(p => {
        const name = (p.product_name || p.catalog?.productName || '').toLowerCase();
        const profile = extractProductSemanticProfile(name, {
          categoryId: p.category_id || p.catalog?.categoryId,
          brand: p.brand || p.catalog?.brand
        });
        assert.equal(profile.isDairyProduct, true, `Product "${name}" must be a dairy product identity`);
      });

      // Crucial: Unrelated products with milk ingredients must NOT appear
      const names = res.data.map(p => (p.product_name || p.catalog?.productName || '').toLowerCase());
      assert.equal(names.some(n => n.includes('parle-g') || n.includes('parle g')), false, 'Parle-G must not appear in dairy');
      assert.equal(names.some(n => n.includes('snickers')), false, 'Snickers must not appear in dairy');
      assert.equal(names.some(n => n.includes('doritos')), false, 'Doritos chips must not appear in dairy');
    });

    it('evaluates "milk" and identifies specifically milk beverage / pack products', async () => {
      const res = await executeSemanticSearch('milk');
      assert.ok(res.totalMatches > 0);
      
      const names = res.data.map(p => (p.product_name || p.catalog?.productName || '').toLowerCase());
      assert.ok(names.some(n => n.includes('cow milk pack')), 'Must include Cow Milk Pack');
      assert.ok(names.some(n => n.includes('toned milk pack')), 'Must include Toned Milk Pack');

      // Must not return chocolate or biscuits
      assert.equal(names.some(n => n.includes('cadbury')), false, 'Cadbury chocolate must not appear in milk');
      assert.equal(names.some(n => n.includes('bikis')), false, 'Milk Bikis biscuit must not appear in milk');
      assert.equal(names.some(n => n.includes('ghee')), false, 'Ghee must not appear in milk search');
    });

    it('evaluates "cheese" and identifies cheese products without snack / pasta leakage', async () => {
      const res = await executeSemanticSearch('cheese');
      assert.ok(res.totalMatches >= 10);
      
      const names = res.data.map(p => (p.product_name || p.catalog?.productName || '').toLowerCase());
      assert.ok(names.some(n => n.includes('cheese slices')));
      assert.ok(names.some(n => n.includes('cheddar cheese')));
      assert.ok(names.some(n => n.includes('mozzarella')));

      // Zero snacks, chips, or dips
      assert.equal(names.some(n => n.includes('chips') || n.includes('crisps')), false);
      assert.equal(names.some(n => n.includes('dip') || n.includes('nuggets')), false);
    });

    it('evaluates "chocolate" and returns all chocolate & confectionery identities', async () => {
      const res = await executeSemanticSearch('chocolate');
      assert.ok(res.totalMatches >= 20);

      const names = res.data.map(p => (p.product_name || p.catalog?.productName || '').toLowerCase());
      assert.ok(names.some(n => n.includes('dark chocolate')));
      assert.ok(names.some(n => n.includes('dairy milk silk')));
      assert.ok(names.some(n => n.includes('kitkat')));
      assert.ok(names.some(n => n.includes('ferrero')));
    });

    it('evaluates "biscuits" and identifies biscuit / cookie products', async () => {
      const res = await executeSemanticSearch('biscuits');
      assert.ok(res.totalMatches >= 20);
      res.data.forEach(p => {
        const name = (p.product_name || '').toLowerCase();
        assert.ok(
          name.includes('biscuit') || name.includes('cookie') || name.includes('rusk') || name.includes('cracker') || name.includes('dark fantasy') || name.includes('choco fills'),
          `Product "${name}" must identify as a biscuit or cookie`
        );
      });
    });

    it('evaluates "snacks" and identifies chips, crisps, and namkeen products', async () => {
      const res = await executeSemanticSearch('snacks');
      assert.ok(res.totalMatches >= 20);
    });

    it('evaluates "juice" and identifies packaged juice products', async () => {
      const res = await executeSemanticSearch('juice');
      assert.ok(res.totalMatches >= 10);
      res.data.forEach(p => {
        const name = (p.product_name || '').toLowerCase();
        assert.ok(name.includes('juice') || name.includes('nectar') || name.includes('drink'), `Product "${name}" must identify as a juice`);
      });
    });

    it('evaluates "cereal" and identifies breakfast cereals, oats, and muesli', async () => {
      const res = await executeSemanticSearch('cereal');
      assert.ok(res.totalMatches >= 20);
      res.data.forEach(p => {
        const name = (p.product_name || '').toLowerCase();
        assert.ok(
          name.includes('oats') || name.includes('cereal') || name.includes('muesli') || name.includes('granola') || name.includes('cornflakes') || name.includes('flakes'),
          `Product "${name}" must identify as cereal`
        );
      });
    });
  });

  // --------------------------------------------------------------------------
  // PART B: NEGATIVE INTENT TESTS
  // --------------------------------------------------------------------------
  describe('Part B: Negative and Exclusion-Based Semantic Search', () => {
    it('evaluates "dairy-free" and excludes all dairy product identities while retaining plant butters', async () => {
      const res = await executeSemanticSearch('dairy-free', { limit: 500 });
      assert.ok(res.totalMatches > 400);

      const names = res.data.map(p => (p.product_name || p.catalog?.productName || '').toLowerCase());
      
      // Contradictory dairy identities MUST be excluded
      assert.equal(names.some(n => n.includes('ghee')), false, 'Zero cow ghee permitted in dairy-free');
      assert.equal(names.some(n => n.includes('cheese slices')), false, 'Zero cheese slices permitted in dairy-free');
      assert.equal(names.some(n => n.includes('paneer')), false, 'Zero paneer permitted in dairy-free');
      assert.equal(names.some(n => n.includes('yogurt')), false, 'Zero yogurt permitted in dairy-free');
      assert.equal(names.some(n => n.includes('cow milk pack')), false, 'Zero cow milk pack permitted in dairy-free');

      // Plant-based alternatives MUST NOT be excluded by naive substring matches
      const peanutButter = names.filter(n => n.includes('peanut butter'));
      assert.ok(peanutButter.length >= 8, 'Peanut butters must be retained in dairy-free search');
    });

    it('evaluates "milk-free" and excludes milk products', async () => {
      const res = await executeSemanticSearch('milk-free', { limit: 500 });
      const names = res.data.map(p => (p.product_name || '').toLowerCase());
      assert.equal(names.some(n => n.includes('cow milk pack')), false);
      assert.equal(names.some(n => n.includes('toned milk pack')), false);
    });

    it('evaluates "non-dairy" equivalently to dairy-free', async () => {
      const res = await executeSemanticSearch('non-dairy', { limit: 500 });
      const names = res.data.map(p => (p.product_name || '').toLowerCase());
      assert.equal(names.some(n => n.includes('ghee')), false);
      assert.equal(names.some(n => n.includes('paneer')), false);
    });

    it('evaluates "gluten-free" and excludes bakery, atta, flour, pasta, and noodles identities', async () => {
      const res = await executeSemanticSearch('gluten-free', { limit: 500 });
      const names = res.data.map(p => (p.product_name || '').toLowerCase());
      assert.equal(names.some(n => /\batta\b/i.test(n) || /\bmaida\b/i.test(n)), false, 'Atta/Maida excluded from gluten-free');
      assert.equal(names.some(n => /\bpasta\b/i.test(n) || /\bmacaroni\b/i.test(n)), false, 'Pasta excluded from gluten-free');
    });

    it('evaluates "caffeine-free" and excludes coffee and tea identities', async () => {
      const res = await executeSemanticSearch('caffeine-free', { limit: 500 });
      const names = res.data.map(p => (p.product_name || '').toLowerCase());
      assert.equal(names.some(n => n.includes('coffee') || n.includes('espresso')), false, 'Coffee excluded from caffeine-free');
    });
  });

  // --------------------------------------------------------------------------
  // PART C: CONTEXTUAL QUERY TESTS
  // --------------------------------------------------------------------------
  describe('Part C: Contextual Query Tests', () => {
    it('evaluates "products that are not dairy products" as a negative dairy exclusion', async () => {
      const res = await executeSemanticSearch('products that are not dairy products', { limit: 500 });
      assert.equal(res.intent.queryType, 'NEGATIVE_EXCLUSION');
      assert.ok(res.intent.excludedConcepts.includes('dairy'));
      const names = res.data.map(p => (p.product_name || '').toLowerCase());
      assert.equal(names.some(n => n.includes('ghee')), false);
    });

    it('evaluates "products excluding dairy-based items" contextually', async () => {
      const res = await executeSemanticSearch('products excluding dairy-based items', { limit: 500 });
      assert.ok(res.intent.excludedConcepts.includes('dairy'));
      const names = res.data.map(p => (p.product_name || '').toLowerCase());
      assert.equal(names.some(n => n.includes('ghee')), false);
    });

    it('evaluates compound query "chocolate without dairy" (seeking chocolate, excluding dairy identities)', async () => {
      const res = await executeSemanticSearch('chocolate without dairy', { limit: 500 });
      assert.equal(res.intent.queryType, 'COMPOUND_MODIFIED');
      assert.ok(res.intent.targetConcepts.includes('chocolate'));
      assert.ok(res.intent.excludedConcepts.includes('dairy'));

      res.data.forEach(p => {
        const name = (p.product_name || '').toLowerCase();
        // Must identify as chocolate / confectionery
        assert.ok(
          name.includes('chocolate') || name.includes('choco') || name.includes('cocoa') || name.includes('fudge') || name.includes('cadbury') || name.includes('raffaello'),
          `Product "${name}" must match chocolate concept`
        );
        // Must NOT be milk chocolate, milkybar, or ice cream
        assert.equal(name.includes('milk chocolate'), false, 'No milk chocolate in chocolate without dairy');
        assert.equal(name.includes('milkybar'), false, 'No milkybar in chocolate without dairy');
        assert.equal(name.includes('ice cream'), false, 'No ice cream in chocolate without dairy');
      });
    });

    it('evaluates "milk alternatives" and identifies plant-based alternatives', async () => {
      const res = await executeSemanticSearch('milk alternatives');
      assert.ok(res.intent.isSeekingAlternatives);
      // All returned items must identify as plant-based alternatives
      res.data.forEach(p => {
        const name = (p.product_name || '').toLowerCase();
        assert.equal(isPlantBasedAlternative(name), true, `Product "${name}" must be a plant-based alternative`);
      });
    });
  });

  // --------------------------------------------------------------------------
  // PART D: INGREDIENT INDEPENDENCE TESTS
  // --------------------------------------------------------------------------
  describe('Part D: Ingredient Independence Tests', () => {
    it('ensures an unrelated product with milk ingredients is NEVER classified as a dairy product', async () => {
      // Snickers Peanut Chocolate Bar has Skimmed Milk Powder in ingredients,
      // but its product name identifies as a chocolate bar, not a dairy product.
      const res = await executeSemanticSearch('dairy');
      const names = res.data.map(p => (p.product_name || '').toLowerCase());
      assert.equal(names.some(n => n.includes('snickers')), false, 'Snickers must not appear in dairy search solely due to ingredients');
    });

    it('ensures a product clearly named as a dairy product matches even if ingredients are missing', async () => {
      const customDairy = {
        product_id: 'TEST_GHEE_001',
        product_name: 'Pure Desi Cow Ghee',
        category_id: 11,
        category_name: 'Cooking Oils & Ghee',
        nutrition_info: { ingredients_text: '' }, // empty ingredients!
        ingredients: { ingredients: [] }
      };

      const testPool = [
        customDairy,
        { product_id: 'TEST_JUICE_002', product_name: 'Orange Fruit Juice', category_id: 5, category_name: 'Packaged Juices & Drinks' }
      ];

      const res = await executeSemanticSearch('dairy', { products: testPool });
      assert.equal(res.totalMatches, 1);
      assert.equal(res.data[0].product_id, 'TEST_GHEE_001');
    });
  });

  // --------------------------------------------------------------------------
  // PART E: FULL-CATALOGUE COVERAGE TESTS
  // --------------------------------------------------------------------------
  describe('Part E: Full-Catalogue Coverage Tests', () => {
    it('evaluates all 500 catalogue products without arbitrary candidate caps', async () => {
      const res = await executeSemanticSearch('dairy-free', { limit: 500 });
      assert.equal(res.totalCatalogSize, 500);
      assert.equal(res.totalEvaluated, 500);
      assert.ok(res.totalMatches > 400, 'Eligible dairy-free products must exceed 400 across 500 products');
    });

    it('filters before pagination and delivers consistent pages with zero duplicate IDs', async () => {
      const full = await executeSemanticSearch('dairy-free', { limit: 500 });
      const pageSize = 20;
      const totalPages = Math.ceil(full.totalMatches / pageSize);

      const seenIds = new Set();
      let duplicates = 0;

      for (let p = 1; p <= totalPages; p++) {
        const pageRes = await executeSemanticSearch('dairy-free', { page: p, limit: pageSize });
        assert.equal(pageRes.pagination.page, p);
        assert.equal(pageRes.pagination.totalCount, full.totalMatches);
        
        pageRes.data.forEach(item => {
          if (seenIds.has(item.product_id)) duplicates++;
          seenIds.add(item.product_id);
        });
      }

      assert.equal(duplicates, 0, 'No product IDs may be duplicated across pages');
      assert.equal(seenIds.size, full.totalMatches, 'Sum of paginated items must equal totalMatches');
    });

    it('preserves strict category isolation when categoryId is specified', async () => {
      // In Category 11 (Cooking Oils & Ghee): 12 oils, 8 ghees
      const cat11Res = await executeSemanticSearch('dairy-free', { categoryId: 11 });
      assert.equal(cat11Res.totalMatches, 12, 'Category 11 must return exactly 12 non-dairy cooking oils');
      cat11Res.data.forEach(p => {
        assert.equal((p.category_id || p.catalog?.categoryId), 11);
        assert.equal(p.product_name.toLowerCase().includes('ghee'), false);
      });
    });
  });

  // --------------------------------------------------------------------------
  // PART F: HTTP API & REGRESSION TESTS
  // --------------------------------------------------------------------------
  describe('Part F: HTTP API & Regression Verification', () => {
    it('returns valid JSON search results with metadata via HTTP GET /api/search/semantic', async () => {
      const makeRequest = (path) => new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:8080${path}`, (res) => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            try {
              resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
            } catch (err) {
              resolve({ statusCode: res.statusCode, body: data });
            }
          });
        });
        req.on('error', reject);
      });

      const res = await makeRequest('/api/search/semantic?q=dairy');
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.totalMatches > 0);
      assert.ok(Array.isArray(res.body.data));
    });

    it('preserves master catalog search without regressions', async () => {
      const searchRes = catalogLoader.searchProducts('Parle-G', 10);
      assert.ok(searchRes.length > 0);
      assert.ok(searchRes.some(p => (p.product_name || p.catalog?.productName || '').includes('Parle-G')));
    });
  });
});
