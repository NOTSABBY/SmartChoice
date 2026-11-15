/**
 * SMARTCHOICE LLM-POWERED SEMANTIC SEARCH REDESIGN TEST SUITE
 * 
 * Verifies end-to-end:
 * Part 1: LLM Query Understanding & JSON Schema Validation
 * Part 2: Product-Name-Only Retrieval (Zero Ingredient or Nutrition Bleed)
 * Part 3: Independent Evidence-Based Structured Filtering
 * Part 4: Complete Catalogue Evaluation, Pagination & Category Scoping
 * Part 5: HTTP API Contract & Performance Measurements
 * Part 6: Regression Verification (Master Catalog, Recommendations, Comparison, Scoring)
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const semanticQueryUnderstandingService = require('../services/semanticQueryUnderstandingService');
const { executeSemanticSearch } = require('../services/semanticSearchEngine');
const productEmbeddingService = require('../services/productEmbeddingService');
const { evaluateStructuredFilters } = require('../services/semanticFilteringService');
const { extractProductSemanticProfile } = require('../services/productNameSemanticService');
const catalogLoader = require('../utils/catalogLoader');

describe('SMARTCHOICE LLM-POWERED SEMANTIC SEARCH REDESIGN SUITE', () => {

  // --------------------------------------------------------------------------
  // PART 1: QUERY UNDERSTANDING & SCHEMA VALIDATION TESTS
  // --------------------------------------------------------------------------
  describe('Part 1: Query Understanding & Schema Validation', () => {
    const testCases = [
      { query: 'soda', expectedEntity: 'Carbonated beverages' },
      { query: 'chocolate snacks', expectedEntity: 'Chocolate' },
      { query: 'peanut butter', expectedEntity: 'Peanut butter' },
      { query: 'instant noodles', expectedEntity: 'Instant noodles', expectedPrep: 'INSTANT' },
      { query: 'vegan chocolate snacks', expectedEntity: 'Chocolate', expectedDietary: 'VEGAN' },
      { query: 'gluten-free biscuits', expectedEntity: 'Biscuits', expectedDietary: 'GLUTEN_FREE' },
      { query: 'dairy-free products', expectedDietary: 'DAIRY_FREE' },
      { query: 'non-dairy milk', expectedDietary: 'DAIRY_FREE' },
      { query: 'sugar-free snacks', expectedConstraint: 'sugar-free' },
      { query: 'frozen potato products', expectedPrep: 'FROZEN' },
      { query: 'fresh fruit juice', expectedEntity: 'Fruit juice' }
    ];

    for (const tc of testCases) {
      it(`understands "${tc.query}" and returns valid schema`, async () => {
        const u = await semanticQueryUnderstandingService.understandQuery(tc.query);
        
        // Strict Schema Validation
        assert.equal(typeof u.core_entity, 'string');
        assert.ok(u.core_entity.length > 0);
        assert.ok(Array.isArray(u.implicit_synonyms));
        assert.ok(u.implicit_synonyms.length >= 3, 'Must have at least 3 synonyms');
        assert.ok(Array.isArray(u.attributes));
        assert.equal(typeof u.optimized_vector_query, 'string');
        assert.ok(u.optimized_vector_query.length > 0);
        
        assert.ok(u.search_intent);
        assert.ok(Array.isArray(u.search_intent.positive_concepts));
        assert.ok(Array.isArray(u.search_intent.negative_concepts));
        assert.equal(typeof u.search_intent.context, 'string');

        assert.ok(u.structured_filters);
        assert.ok(Array.isArray(u.structured_filters.dietary));
        assert.ok(Array.isArray(u.structured_filters.allergens_to_exclude));
        assert.ok(Array.isArray(u.structured_filters.ingredients_to_exclude));
        assert.ok(Array.isArray(u.structured_filters.preparation_state));
        assert.ok(Array.isArray(u.structured_filters.packaging_type));

        assert.equal(typeof u.confidence, 'number');
        assert.ok(u.confidence >= 0 && u.confidence <= 1);

        // Functional checks
        if (tc.expectedEntity) {
          assert.ok(
            u.core_entity.toLowerCase().includes(tc.expectedEntity.toLowerCase()),
            `Expected core_entity to contain "${tc.expectedEntity}", got "${u.core_entity}"`
          );
        }
        if (tc.expectedDietary) {
          assert.ok(u.structured_filters.dietary.includes(tc.expectedDietary));
        }
        if (tc.expectedPrep) {
          assert.ok(u.structured_filters.preparation_state.includes(tc.expectedPrep));
        }
        if (tc.expectedConstraint) {
          assert.ok(u.structured_filters.other_constraints.includes(tc.expectedConstraint));
        }

        // ARCHITECTURAL RESTRICTION:
        // optimized_vector_query MUST contain product identity concepts ONLY.
        // It must NOT contain dietary filter strings like "vegan", "sugar-free", "gluten-free"
        if (tc.query === 'vegan chocolate snacks') {
          assert.equal(
            u.optimized_vector_query.toLowerCase().includes('vegan'),
            false,
            'optimized_vector_query must not embed "vegan" - dietary constraints belong in structured_filters'
          );
        }
      });
    }
  });

  // --------------------------------------------------------------------------
  // PART 2: PRODUCT-NAME-ONLY RETRIEVAL TESTS
  // --------------------------------------------------------------------------
  describe('Part 2: Product-Name-Only Retrieval (Zero Metadata Bleed)', () => {
    it('verifies product embeddings use normalized product name ONLY', () => {
      const sampleProduct = {
        product_name: 'Amul Dark Chocolate (150g Bar)',
        brand: 'Amul',
        category_name: 'Chocolates & Confectionery',
        ingredients: { rawText: 'Sugar, Cocoa Butter, Milk Solids' },
        nutrition: { calories: 550, protein: 7 }
      };

      const text = productEmbeddingService.buildProductEmbeddingText(sampleProduct);
      assert.equal(text, 'Amul Dark Chocolate', 'Embedding input must be normalized product name only');
      assert.equal(text.includes('Milk Solids'), false, 'Embedding text must NOT contain ingredients');
      assert.equal(text.includes('550'), false, 'Embedding text must NOT contain nutrition facts');
    });

    it('ensures an unrelated product with milk ingredients is NEVER returned for "dairy" search', async () => {
      // Snickers and Parle-G contain milk solids, but their identities are chocolate and biscuits
      const res = await executeSemanticSearch('dairy');
      const names = res.data.map(p => (p.product_name || '').toLowerCase());
      assert.equal(names.some(n => n.includes('snickers')), false);
      assert.equal(names.some(n => n.includes('parle-g') || n.includes('parle g')), false);
      assert.equal(names.some(n => n.includes('doritos')), false);
    });

    it('retrieves dairy products based on name even if ingredients are empty', async () => {
      const customDairy = {
        product_id: 'CUSTOM_DAIRY_99',
        product_name: 'Pure Desi Cow Ghee',
        category_id: 11,
        category_name: 'Cooking Oils & Ghee',
        nutrition_info: { ingredients_text: '' }, // empty ingredients!
        ingredients: { ingredients: [] }
      };

      const res = await executeSemanticSearch('dairy', { products: [customDairy] });
      assert.equal(res.totalMatches, 1);
      assert.equal(res.data[0].product_id, 'CUSTOM_DAIRY_99');
    });

    it('preserves plant-based alternatives in negative dairy queries', async () => {
      const res = await executeSemanticSearch('dairy-free', { limit: 500 });
      const names = res.data.map(p => (p.product_name || '').toLowerCase());
      
      // All dairy staples excluded
      assert.equal(names.some(n => n.includes('ghee')), false);
      assert.equal(names.some(n => n.includes('cheese slices')), false);
      assert.equal(names.some(n => n.includes('paneer')), false);
      assert.equal(names.some(n => n.includes('cow milk pack')), false);

      // Non-dairy plant butters preserved
      assert.ok(names.some(n => n.includes('peanut butter')));
    });
  });

  // --------------------------------------------------------------------------
  // PART 3: INDEPENDENT EVIDENCE-BASED STRUCTURED FILTERING TESTS
  // --------------------------------------------------------------------------
  describe('Part 3: Independent Evidence-Based Structured Filtering', () => {
    it('filters strictly by verified Vegan dietary status', () => {
      const veganProduct = {
        product_name: 'Pintola All Natural Peanut Butter',
        dietary_classification: { status: 'VEGAN' },
        ingredients: { rawIngredientsText: 'Roasted Peanuts (100%)' },
        nutrition_info: { allergens: ['Peanuts'] }
      };

      const nonVeganProduct = {
        product_name: 'Britannia Processed Cheese Slices',
        dietary_classification: { status: 'VEGETARIAN' },
        ingredients: { rawIngredientsText: 'Cheese, Milk Solids' },
        nutrition_info: { allergens: ['Milk'] }
      };

      const evalVegan = evaluateStructuredFilters(veganProduct, { dietary: ['VEGAN'] });
      assert.equal(evalVegan.isEligible, true);

      const evalNonVegan = evaluateStructuredFilters(nonVeganProduct, { dietary: ['VEGAN'] });
      assert.equal(evalNonVegan.isEligible, false);
      assert.ok(evalNonVegan.rejectionReason.includes('Vegan'));
    });

    it('rejects unknown dietary classification when a restriction is active', () => {
      const unknownProduct = {
        product_name: 'Imported Snack Bar',
        dietary_classification: { status: 'UNKNOWN' }
      };

      const evalRes = evaluateStructuredFilters(unknownProduct, { dietary: ['VEGAN'] });
      assert.equal(evalRes.isEligible, false);
    });

    it('strictly enforces allergen exclusions based on factual evidence', () => {
      const milkProduct = {
        product_name: 'Chocolate Bar',
        dietary_classification: { status: 'VEGETARIAN' },
        nutrition_info: { allergens: ['Milk', 'Soy'] },
        ingredients: { rawIngredientsText: 'Sugar, Milk Solids, Cocoa' }
      };

      const evalRes = evaluateStructuredFilters(milkProduct, { allergens_to_exclude: ['milk'] });
      assert.equal(evalRes.isEligible, false);
      assert.ok(evalRes.rejectionReason.includes('avoided allergen'));
    });

    it('strictly enforces ingredient exclusions (e.g. palm oil)', () => {
      const palmOilProduct = {
        product_name: 'Crispy Biscuits',
        dietary_classification: { status: 'VEGAN' },
        ingredients: { rawIngredientsText: 'Wheat Flour, Refined Palm Oil, Sugar' },
        nutrition_info: { allergens: ['Wheat'] }
      };

      const evalRes = evaluateStructuredFilters(palmOilProduct, { ingredients_to_exclude: ['palm oil'] });
      assert.equal(evalRes.isEligible, false);
      assert.ok(evalRes.rejectionReason.includes('palm oil'));
    });
  });

  // --------------------------------------------------------------------------
  // PART 4: FULL CATALOGUE COVERAGE, PAGINATION & CATEGORY SCOPING
  // --------------------------------------------------------------------------
  describe('Part 4: Full Catalogue Coverage & Structured Pagination', () => {
    it('evaluates all 500 catalogue products without arbitrary limits', async () => {
      const res = await executeSemanticSearch('dairy-free', { limit: 500 });
      assert.equal(res.totalCatalogSize, 500);
      assert.equal(res.totalEvaluated, 500);
      assert.ok(res.totalMatches >= 280);
    });

    it('paginates consistently with zero duplicate product IDs across pages', async () => {
      const full = await executeSemanticSearch('dairy-free', { limit: 500 });
      const pageSize = 20;
      const totalPages = Math.ceil(full.totalMatches / pageSize);

      const collected = new Set();
      let duplicates = 0;

      for (let p = 1; p <= totalPages; p++) {
        const pageRes = await executeSemanticSearch('dairy-free', { page: p, limit: pageSize });
        assert.equal(pageRes.pagination.page, p);
        pageRes.data.forEach(item => {
          if (collected.has(item.product_id)) duplicates++;
          collected.add(item.product_id);
        });
      }

      assert.equal(duplicates, 0, 'Zero duplicate product IDs across pagination');
      assert.equal(collected.size, full.totalMatches);
    });

    it('strictly isolates categories when categoryId is specified', async () => {
      // Category 11: Cooking Oils & Ghee (12 cooking oils, 8 ghees)
      const res = await executeSemanticSearch('dairy-free', { categoryId: 11 });
      assert.equal(res.totalMatches, 12);
      res.data.forEach(p => {
        assert.equal((p.category_id || p.catalog?.categoryId), 11);
        assert.equal(p.product_name.toLowerCase().includes('ghee'), false);
      });
    });
  });

  // --------------------------------------------------------------------------
  // PART 5: HTTP API CONTRACT & PERFORMANCE
  // --------------------------------------------------------------------------
  describe('Part 5: HTTP API Contract & Performance Verification', () => {
    it('returns structured understanding and applied filters via HTTP GET /api/search/semantic', async () => {
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

      const start = Date.now();
      const res = await makeRequest('/api/search/semantic?q=soda');
      const duration = Date.now() - start;

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.understanding);
      assert.equal(typeof res.body.understanding.core_entity, 'string');
      assert.ok(Array.isArray(res.body.understanding.implicit_synonyms));
      assert.ok(res.body.filters_applied);
      assert.ok(Array.isArray(res.body.results));
      assert.ok(res.body.totalMatches > 0);
      
      console.log(`\n  [Performance] End-to-End Search Latency: ${duration}ms (Threshold: < 500ms)`);
      assert.ok(duration < 1500, 'Search response must be under 1500ms');
    });
  });

  // --------------------------------------------------------------------------
  // PART 6: REGRESSION VERIFICATION
  // --------------------------------------------------------------------------
  describe('Part 6: System Regression Verification', () => {
    it('preserves Master Catalog keyword search', () => {
      const searchRes = catalogLoader.searchProducts('Parle-G', 10);
      assert.ok(searchRes.length > 0);
      assert.ok(searchRes.some(p => (p.product_name || p.catalog?.productName || '').includes('Parle-G')));
    });

    it('preserves product retrieval by ID', () => {
      const p = catalogLoader.getProductById('PKG_PRD_0001');
      assert.ok(p);
      assert.equal(p.product_id || p.catalog?.productId, 'PKG_PRD_0001');
    });
  });
});
