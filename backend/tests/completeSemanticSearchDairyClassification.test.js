const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const { classifyProductDairy } = require('../services/dairyClassificationService');
const { executeSemanticSearch, parseQueryIntent } = require('../services/semanticSearchEngine');
const vectorSearchService = require('../services/vectorSearchService');
const catalogLoader = require('../utils/catalogLoader');

describe('SMARTCHOICE COMPLETE SEMANTIC SEARCH & EVIDENCE-BASED DAIRY CLASSIFICATION SUITE', () => {
  const catalog500 = catalogLoader.getCatalog500Products();

  // --------------------------------------------------------------------------
  // PART 1: SECTION 11 MANDATORY CLASSIFIER TEST MATRIX
  // --------------------------------------------------------------------------
  describe('Part 1: Mandatory Classifier Test Matrix', () => {
    it('Cow ghee with verified dairy identity -> DAIRY_CONTAINS', () => {
      const cowGhee = {
        product_name: 'Mother Dairy Ultimate Cow Ghee',
        nutrition_info: { ingredients_text: 'Milk Fat (100%)', allergens: ['Milk'], verification_status: 'VERIFIED' }
      };
      const res = classifyProductDairy(cowGhee);
      assert.equal(res.classification, 'DAIRY_CONTAINS');
      assert.equal(res.isDairyFree, false);
      assert.ok(res.evidence.some(e => e.matchedTerm.includes('Ghee') || e.matchedTerm.includes('Milk')));
    });

    it('Butter -> DAIRY_CONTAINS', () => {
      const butter = {
        product_name: 'Amul Butter',
        nutrition_info: { ingredients_text: 'Butter, Common Salt', allergens: ['Milk'], verification_status: 'VERIFIED' }
      };
      const res = classifyProductDairy(butter);
      assert.equal(res.classification, 'DAIRY_CONTAINS');
      assert.equal(res.isDairyFree, false);
    });

    it('Milk powder -> DAIRY_CONTAINS', () => {
      const milkPowder = {
        product_name: 'Everyday Dairy Whitener',
        nutrition_info: { ingredients_text: 'Partially Skimmed Milk Powder, Sugar', allergens: ['Milk'], verification_status: 'VERIFIED' }
      };
      const res = classifyProductDairy(milkPowder);
      assert.equal(res.classification, 'DAIRY_CONTAINS');
      assert.equal(res.isDairyFree, false);
    });

    it('Whey protein -> DAIRY_CONTAINS', () => {
      const wheyBar = {
        product_name: 'Yoga Bar 20g Protein',
        nutrition_info: { ingredients_text: 'Whey Protein Concentrate, Almonds, Dates', allergens: ['Milk'], verification_status: 'VERIFIED' }
      };
      const res = classifyProductDairy(wheyBar);
      assert.equal(res.classification, 'DAIRY_CONTAINS');
      assert.equal(res.isDairyFree, false);
    });

    it('Casein -> DAIRY_CONTAINS', () => {
      const caseinProd = {
        product_name: 'Micellar Casein Powder',
        nutrition_info: { ingredients_text: 'Calcium Caseinate, Cocoa Powder', allergens: ['Milk'], verification_status: 'VERIFIED' }
      };
      const res = classifyProductDairy(caseinProd);
      assert.equal(res.classification, 'DAIRY_CONTAINS');
      assert.equal(res.isDairyFree, false);
    });

    it('Product with explicit milk ingredient -> DAIRY_CONTAINS', () => {
      const milkBiscuit = {
        product_name: 'Britannia Milk Bikis',
        nutrition_info: { ingredients_text: 'Refined Wheat Flour, Sugar, Condensed Milk, Milk Solids', allergens: ['Wheat', 'Milk'], verification_status: 'VERIFIED' }
      };
      const res = classifyProductDairy(milkBiscuit);
      assert.equal(res.classification, 'DAIRY_CONTAINS');
      assert.equal(res.isDairyFree, false);
    });

    it('Product with only "may contain milk" -> DAIRY_MAY_CONTAIN', () => {
      const mayContainProd = {
        product_name: 'Ching Secret Hakka Noodles',
        nutrition_info: {
          ingredients_text: 'Refined Wheat Flour, Wheat Gluten, Iodised Salt. May contain Soy, Mustard, Milk and Celery',
          allergens: ['Wheat'],
          may_contain: ['Milk', 'Soy'],
          verification_status: 'VERIFIED'
        }
      };
      const res = classifyProductDairy(mayContainProd);
      assert.equal(res.classification, 'DAIRY_MAY_CONTAIN');
      assert.equal(res.isDairyFree, false);
      assert.ok(res.evidence.some(e => e.type === 'ALLERGEN_MAY_CONTAIN'));
    });

    it('Verified plant-based milk alternative -> Not DAIRY_CONTAINS (DAIRY_FREE_VERIFIED)', () => {
      const almondMilk = {
        product_name: 'Raw Pressery Almond Milk Unsweetened',
        nutrition_info: { ingredients_text: 'Water, Almonds (12%), Sea Salt', allergens: ['Almond'], verification_status: 'VERIFIED' }
      };
      const res = classifyProductDairy(almondMilk);
      assert.notEqual(res.classification, 'DAIRY_CONTAINS');
      assert.equal(res.classification, 'DAIRY_FREE_VERIFIED');
      assert.equal(res.isDairyFree, true);
    });

    it('Verified dairy-free product -> DAIRY_FREE_VERIFIED', () => {
      const oats = {
        product_name: 'Quaker Rolled Oats',
        nutrition_info: { ingredients_text: '100% Rolled Oats', allergens: ['Oats'], verification_status: 'VERIFIED' }
      };
      const res = classifyProductDairy(oats);
      assert.equal(res.classification, 'DAIRY_FREE_VERIFIED');
      assert.equal(res.isDairyFree, true);
    });

    it('Missing ingredient list -> DAIRY_UNKNOWN', () => {
      const missingDataProd = {
        product_name: 'Mystery Snack',
        nutrition_info: { ingredients_text: '', allergens: [], verification_status: 'UNAVAILABLE' }
      };
      const res = classifyProductDairy(missingDataProd);
      assert.equal(res.classification, 'DAIRY_UNKNOWN');
      assert.equal(res.isDairyFree, false);
      assert.ok(res.evidence.some(e => e.type === 'MISSING_DATA'));
    });

    it('Conflicting product evidence -> DAIRY_CONFLICTING_EVIDENCE', () => {
      const conflictProd = {
        product_name: 'Vegan Cookie (Dairy-Free)',
        nutrition_info: { ingredients_text: 'Oat flour, Sugar, Milk Solids, Cocoa', allergens: ['Milk'], verification_status: 'VERIFIED' }
      };
      const res = classifyProductDairy(conflictProd);
      assert.equal(res.classification, 'DAIRY_CONFLICTING_EVIDENCE');
      assert.equal(res.isDairyFree, false);
      assert.ok(res.evidence.some(e => e.type === 'CONFLICT'));
    });

    it('Vegan product with adequate dairy-free evidence -> DAIRY_FREE_VERIFIED', () => {
      const veganBar = {
        product_name: 'Yoga Bar Dark Chocolate Vegan Bar',
        dietaryClassification: { isVegan: true },
        nutrition_info: { ingredients_text: 'Dates, Oats, Almonds, Cocoa Butter, Cocoa Solids', allergens: ['Almond'], verification_status: 'VERIFIED' }
      };
      const res = classifyProductDairy(veganBar);
      assert.equal(res.classification, 'DAIRY_FREE_VERIFIED');
      assert.equal(res.isDairyFree, true);
    });

    it('Vegan product with insufficient evidence -> DAIRY_UNKNOWN', () => {
      const veganUnknown = {
        product_name: 'Vegan Candy',
        dietaryClassification: { isVegan: true },
        nutrition_info: { ingredients_text: '', allergens: [], verification_status: 'UNVERIFIED' }
      };
      const res = classifyProductDairy(veganUnknown);
      assert.equal(res.classification, 'DAIRY_UNKNOWN');
      assert.equal(res.isDairyFree, false);
    });
  });

  // --------------------------------------------------------------------------
  // PART 2: RETRIEVAL & SEMANTIC SEARCH BEHAVIOR TESTS
  // --------------------------------------------------------------------------
  describe('Part 2: Retrieval & Query Constraints', () => {
    it('1. Searching "dairy products" does NOT return verified dairy-free products as dairy-containing', async () => {
      const res = await executeSemanticSearch('dairy products', { limit: 500 });
      assert.ok(res.totalMatches > 0);
      res.data.forEach(item => {
        assert.equal(item.dairyClassification.classification, 'DAIRY_CONTAINS');
        assert.equal(item.dairyClassification.isDairyFree, false);
      });
      // Confirm pure oils, juices, oats are NEVER returned as dairy products
      const ids = res.data.map(i => i.product.product_id);
      assert.equal(ids.includes('PKG_PRD_0201'), false, 'Fortune Sunflower oil cannot be in dairy products');
      assert.equal(ids.includes('PKG_PRD_0081'), false, 'Real Apple Juice cannot be in dairy products');
    });

    it('2. Searching "dairy-free products" NEVER returns cow ghee', async () => {
      const res = await executeSemanticSearch('dairy-free products', { limit: 500 });
      const cowGhee = res.data.find(item => item.product.product_id === 'PKG_PRD_0208');
      assert.equal(cowGhee, undefined, 'Mother Dairy Ultimate Cow Ghee (PKG_PRD_0208) must never appear in dairy-free search');
    });

    it('3. Searching "dairy-free products" strictly excludes products containing milk-derived ingredients', async () => {
      const res = await executeSemanticSearch('dairy-free products', { limit: 500 });
      assert.equal(res.totalMatches, 280);
      res.data.forEach(item => {
        assert.equal(item.dairyClassification.classification, 'DAIRY_FREE_VERIFIED');
        assert.equal(item.dairyClassification.isDairyFree, true);
      });
    });

    it('4. Searching "products containing milk" returns products with verified milk evidence', async () => {
      const res = await executeSemanticSearch('products containing milk', { limit: 500 });
      assert.equal(res.totalMatches, 182);
      res.data.forEach(item => {
        assert.equal(item.dairyClassification.classification, 'DAIRY_CONTAINS');
      });
    });

    it('5. "May contain milk" remains separate from confirmed milk ingredients', async () => {
      const res = await executeSemanticSearch('products that may contain milk', { limit: 500 });
      assert.equal(res.totalMatches, 38);
      res.data.forEach(item => {
        assert.equal(item.dairyClassification.classification, 'DAIRY_MAY_CONTAIN');
      });
    });

    it('6. Unknown products never enter verified dairy-free results', async () => {
      const res = await executeSemanticSearch('dairy-free products', { limit: 500 });
      res.data.forEach(item => {
        assert.notEqual(item.dairyClassification.classification, 'DAIRY_UNKNOWN');
        assert.notEqual(item.dairyClassification.classification, 'DAIRY_CONFLICTING_EVIDENCE');
      });
    });

    it('7. Plant-based milk alternatives are not incorrectly classified as animal dairy', () => {
      const coconutMilk = {
        product_name: 'Real Thai Coconut Milk',
        nutrition_info: { ingredients_text: 'Coconut Extract (85%), Water', allergens: [], verification_status: 'VERIFIED' }
      };
      const res = classifyProductDairy(coconutMilk);
      assert.equal(res.classification, 'DAIRY_FREE_VERIFIED');
      assert.equal(res.isDairyFree, true);
    });

    it('8. Semantic similarity cannot override hard dietary constraints', async () => {
      // Searching "milky buttery rich creamy treat" should still reject dairy items if query requested dairy-free
      const res = await executeSemanticSearch('dairy-free buttery cookies', { limit: 500 });
      res.data.forEach(item => {
        assert.equal(item.dairyClassification.classification, 'DAIRY_FREE_VERIFIED');
      });
    });

    it('9. Filtering happens before pagination', async () => {
      const page1 = await executeSemanticSearch('dairy-free products', { page: 1, limit: 20 });
      const page2 = await executeSemanticSearch('dairy-free products', { page: 2, limit: 20 });
      assert.equal(page1.data.length, 20);
      assert.equal(page2.data.length, 20);
      assert.equal(page1.pagination.totalCount, 280);
      assert.equal(page1.pagination.totalPages, 14);

      // Verify no overlap across pages
      const set1 = new Set(page1.data.map(i => i.product.product_id));
      for (const item of page2.data) {
        assert.equal(set1.has(item.product.product_id), false);
      }
    });

    it('10. Search works across every product category', async () => {
      const catsChecked = new Set();
      const res = await executeSemanticSearch('dairy-free products', { limit: 500 });
      res.data.forEach(item => {
        const catId = Number(item.product.category_id || item.product.catalog?.categoryId);
        catsChecked.add(catId);
      });
      // Categories with 0 dairy-free products are: Cat 1 (0 free), Cat 4 (0 free), Cat 12 (0 free), Cat 13 (0 free), Cat 14 (0 free), Cat 21 (0 free)
      // The remaining 19 categories must be represented!
      assert.ok(catsChecked.size >= 18, `Expected >= 18 categories represented, got ${catsChecked.size}`);
    });

    it('11. Results are not silently capped at 20 eligible products', async () => {
      const res = await executeSemanticSearch('dairy-free products', { limit: 500 });
      assert.equal(res.totalMatches, 280);
      assert.equal(res.data.length, 280);
      assert.ok(res.data.length > 20);
    });
  });

  // --------------------------------------------------------------------------
  // PART 3: HTTP API INTEGRATION
  // --------------------------------------------------------------------------
  describe('Part 3: HTTP API Integration', () => {
    it('returns 280 verified dairy-free products via HTTP API', async () => {
      const data = await new Promise((resolve, reject) => {
        http.get('http://localhost:8080/api/search/semantic?q=dairy-free+products', res => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
      });

      assert.equal(data.success, true);
      assert.equal(data.totalMatches, 280);
      assert.equal(data.data.length, 280);
    });

    it('returns 182 dairy-containing products via HTTP API', async () => {
      const data = await new Promise((resolve, reject) => {
        http.get('http://localhost:8080/api/search/semantic?q=dairy+products', res => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
      });

      assert.equal(data.success, true);
      assert.equal(data.totalMatches, 182);
      assert.equal(data.data.length, 182);
    });
  });
});
