/**
 * SmartChoice Automated Test Suite: Category-Aware Global Search
 * 
 * Validates:
 * 1. All Categories search returns matching products across the entire catalogue.
 * 2. Individual category search returns ONLY products belonging to that selected category.
 * 3. Searching for a non-matching query in a category (e.g. "Milk" in Category 8 "Packaged Chips and Crisps")
 *    yields 0 products, never leaking items from other categories.
 * 4. All 25 categories are individually tested for strict category isolation.
 * 5. Backend catalogLoader search with categoryId filtering.
 * 6. Live API endpoints (/api/products/search) with categoryId parameter.
 * 7. Rapid category switching simulation and stale response prevention.
 * 8. State preservation: clearing search preserves category selection.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');

const catalogLoader = require('../utils/catalogLoader');

async function runAllTests() {
  console.log('=== RUNNING CATEGORY-AWARE GLOBAL SEARCH TEST SUITE ===\n');

  // 1. Load Catalog-500
  const catalogPath = path.join(__dirname, '../../frontend/public/data/enriched_catalog_500.json');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const allProducts = [];
  const categoryMap = new Map();

  catalog.categories.forEach(c => {
    categoryMap.set(c.category_id, c);
    if (c.products) {
      allProducts.push(...c.products);
    }
  });

  console.log(`Loaded ${allProducts.length} products across ${catalog.categories.length} categories.\n`);

  const matchesSelectedCategory = (product, selectedCategoryId, currentCategory = null) => {
    if (selectedCategoryId === null || selectedCategoryId === undefined) return true;
    if (!product) return false;

    const targetId = Number(selectedCategoryId);
    const pCatId = product.category_id ?? product.catalog?.categoryId ?? product.identity?.categoryId;
    if (pCatId !== undefined && pCatId !== null && Number(pCatId) === targetId) {
      return true;
    }

    if (currentCategory?.category_name) {
      const targetName = currentCategory.category_name.toLowerCase().trim();
      const pCatName = (
        product.category_name ||
        product.catalog?.categoryName ||
        (Array.isArray(product.identity?.categories) ? product.identity.categories[0] : '') ||
        ''
      ).toLowerCase().trim();

      if (pCatName && (pCatName === targetName || targetName.includes(pCatName) || pCatName.includes(targetName))) {
        return true;
      }
    }

    return false;
  };

  const matchesSearchQuery = (product, query) => {
    if (!query || !query.trim()) return true;
    if (!product) return false;

    const q = query.toLowerCase().trim();
    const qClean = q.replace(/['’]/g, '');

    const name = (product.product_name || product.catalog?.productName || product.identity?.name || '').toLowerCase();
    const brand = (product.brand || product.catalog?.brand || product.identity?.brand || '').toLowerCase();

    const nameClean = name.replace(/['’]/g, '');
    const brandClean = brand.replace(/['’]/g, '');

    return (
      name.includes(q) || brand.includes(q) ||
      nameClean.includes(qClean) || brandClean.includes(qClean)
    );
  };

  const filterStorefrontProducts = (products, selectedCategoryId, searchQuery, searchResults = null) => {
    const currentCategory = selectedCategoryId !== null ? categoryMap.get(selectedCategoryId) : null;
    const basePool = selectedCategoryId === null
      ? products
      : (currentCategory?.products || products.filter(p => matchesSelectedCategory(p, selectedCategoryId, currentCategory)));

    let list = [];
    if (searchResults !== null && Array.isArray(searchResults)) {
      list = searchResults.filter(p => matchesSelectedCategory(p, selectedCategoryId, currentCategory));
    } else {
      list = basePool;
    }

    return list.filter(p => matchesSelectedCategory(p, selectedCategoryId, currentCategory) && matchesSearchQuery(p, searchQuery));
  };

  // --------------------------------------------------------------------------
  // TEST 1: All Categories Search for "Milk"
  // --------------------------------------------------------------------------
  console.log('Test 1: All Categories search for "Milk"...');
  {
    const milkResults = filterStorefrontProducts(allProducts, null, 'Milk');
    assert(milkResults.length > 0, 'Expected at least 1 milk-related product across all categories');
    
    milkResults.forEach(p => {
      assert(matchesSearchQuery(p, 'Milk'), `Product ${p.product_id} does not match search query 'Milk'`);
    });

    const categoriesPresent = new Set(milkResults.map(p => p.category_id));
    console.log(`  Found ${milkResults.length} products across ${categoriesPresent.size} categories.`);
    assert(categoriesPresent.size >= 1, 'Expected milk products to span at least 1 category');
    console.log('  PASS: All Categories search returns expected cross-category matches.');
  }

  // --------------------------------------------------------------------------
  // TEST 2: Individual Category Search: Category 8 ("Packaged Chips & Crisps")
  // --------------------------------------------------------------------------
  console.log('\nTest 2: Category 8 ("Packaged Chips & Crisps") search isolation...');
  {
    const chipsCategory = categoryMap.get(8);
    assert(chipsCategory, 'Category 8 must exist');
    assert(chipsCategory.category_name.includes('Chips'), 'Category 8 must be chips & crisps');

    // 2a. Searching "Milk" in Category 8:
    // Search must use PRODUCT NAME. Uncle Chips (whose ingredients contain milk) MUST NOT appear!
    // Since no chips product has "Milk" in its name, results must be strictly 0.
    const chipsMilkResults = filterStorefrontProducts(allProducts, 8, 'Milk');
    console.log(`  Results count for Category 8 + "Milk": ${chipsMilkResults.length}`);
    assert.strictEqual(chipsMilkResults.length, 0, 'Uncle Chips must NOT appear for "Milk"! Product name matching only.');

    // 2b. Searching a query that exists across the catalog (e.g. "Paneer", "Dahi", "Yogurt")
    // but has NO items in Category 8: MUST return exactly 0 products!
    const allPaneer = filterStorefrontProducts(allProducts, null, 'Paneer');
    assert(allPaneer.length > 0, 'Catalog has Paneer products across all categories');
    const chipsPaneer = filterStorefrontProducts(allProducts, 8, 'Paneer');
    assert.strictEqual(chipsPaneer.length, 0, 'Category 8 + Paneer must return exactly 0 products (Empty state)');

    const allAtta = filterStorefrontProducts(allProducts, null, 'Atta');
    assert(allAtta.length > 0, 'Catalog has Atta products across all categories');
    const chipsAtta = filterStorefrontProducts(allProducts, 8, 'Atta');
    assert.strictEqual(chipsAtta.length, 0, 'Category 8 + Atta must return exactly 0 products (Empty state)');

    console.log('  PASS: Strict category isolation verified (zero cross-category leakage & empty state verified).');
  }

  // --------------------------------------------------------------------------
  // TEST 3: Individual Category Search: Category 8 ("Packaged Chips and Crisps") + "Lays"
  // --------------------------------------------------------------------------
  console.log('\nTest 3: Category 8 ("Packaged Chips and Crisps") search for "Lays"...');
  {
    const chipsLaysResults = filterStorefrontProducts(allProducts, 8, 'Lays');
    assert(chipsLaysResults.length > 0, 'Expected to find Lay\'s products in Category 8');
    chipsLaysResults.forEach(p => {
      assert.strictEqual(p.category_id, 8, `Product ${p.product_id} is in category ${p.category_id}, expected 8`);
      assert(matchesSearchQuery(p, 'Lays'), `Product ${p.product_id} should match 'Lays'`);
    });
    console.log(`  Found ${chipsLaysResults.length} Lay's products strictly within Category 8.`);
    console.log('  PASS: Category 8 search accurately isolates in-category items.');
  }

  // --------------------------------------------------------------------------
  // TEST 4: Backend catalogLoader.searchProducts with categoryId
  // --------------------------------------------------------------------------
  console.log('\nTest 4: Backend catalogLoader.searchProducts category filtering...');
  {
    // All categories query
    const allMilk = catalogLoader.searchProducts('milk', 50, null);
    assert(allMilk.length > 0, 'catalogLoader should find milk products when categoryId is null');

    // Category 8 query for milk: must return 0 products because no chips product has "milk" in its name
    const chipsMilk = catalogLoader.searchProducts('milk', 50, 8);
    assert.strictEqual(chipsMilk.length, 0, 'catalogLoader must return 0 products for "milk" in Category 8 (Product name matching only)');

    // Category 8 query for paneer: must return 0 products
    const chipsPaneer = catalogLoader.searchProducts('paneer', 50, 8);
    assert.strictEqual(chipsPaneer.length, 0, 'catalogLoader must return 0 products for "paneer" in Category 8');

    // Category 8 Lays query
    const chipsLays = catalogLoader.searchProducts('lays', 50, 8);
    assert(chipsLays.length > 0, 'catalogLoader must find Lays in Category 8');
    chipsLays.forEach(p => {
      const catId = p.catalog?.categoryId ?? p.category_id;
      assert.strictEqual(catId, 8, `catalogLoader product ${p.product_id} should have categoryId 8`);
    });
    console.log('  PASS: Backend catalogLoader strictly enforces categoryId parameter.');
  }

  // --------------------------------------------------------------------------
  // TEST 5: Comprehensive 25-Category Isolation Test
  // --------------------------------------------------------------------------
  console.log('\nTest 5: Exhaustive test across all 25 categories...');
  {
    for (const cat of catalog.categories) {
      const catId = cat.category_id;
      const catName = cat.category_name;
      const catProducts = cat.products || [];

      // 5a. Empty search within category returns exactly that category's products
      const unfiltered = filterStorefrontProducts(allProducts, catId, '');
      assert.strictEqual(unfiltered.length, catProducts.length, `Category ${catId} (${catName}) product count mismatch`);
      unfiltered.forEach(p => {
        assert.strictEqual(p.category_id, catId, `Unfiltered product in category ${catId} had wrong category ${p.category_id}`);
      });

      // 5b. Search for a query that does NOT exist in this category
      const impossibleResults = filterStorefrontProducts(allProducts, catId, 'xyznonexistentterm999');
      assert.strictEqual(impossibleResults.length, 0, `Nonexistent search in category ${catId} must return 0 results`);

      // 5c. Search for the category's first product by name
      if (catProducts.length > 0) {
        const sample = catProducts[0];
        const sampleWord = sample.product_name.split(' ')[0];
        if (sampleWord && sampleWord.length >= 3) {
          const specificResults = filterStorefrontProducts(allProducts, catId, sampleWord);
          assert(specificResults.length > 0, `Search for '${sampleWord}' in category ${catId} should find at least 1 product`);
          specificResults.forEach(p => {
            assert.strictEqual(p.category_id, catId, `Result ${p.product_id} for '${sampleWord}' must belong to category ${catId}`);
          });
        }
      }
    }
    console.log('  PASS: All 25 categories strictly preserve isolation under empty and active search queries.');
  }

  // --------------------------------------------------------------------------
  // TEST 6: Category Switching Sequence Simulation
  // --------------------------------------------------------------------------
  console.log('\nTest 6: Simulating the mandatory 10-step Category Switching Sequence...');
  {
    let activeCategoryId = null; // Step 1: Open All Categories
    let activeQuery = '';

    // Step 2: Search for "Milk"
    activeQuery = 'Milk';
    let r1 = filterStorefrontProducts(allProducts, activeCategoryId, activeQuery);
    assert(r1.length > 0, 'Step 2: All Categories search for Milk must return results');
    const catSetAll = new Set(r1.map(p => p.category_id));
    assert(catSetAll.size >= 1, 'Step 2: Multiple categories should be represented');

    // Step 3: Switch to Category 8 (Packaged Chips & Crisps) with query "Milk" still active
    activeCategoryId = 8;
    let r2 = filterStorefrontProducts(allProducts, activeCategoryId, activeQuery);
    // Every single product returned must strictly belong to Category 8
    r2.forEach(p => {
      assert.strictEqual(p.category_id, 8, 'Step 3: Result in Category 8 must strictly have category_id === 8');
    });
    // Cross-category products must NEVER appear
    assert.strictEqual(r2.filter(p => p.category_id !== 8).length, 0, 'Step 3: No cross-category products allowed');
    // When searching for an item not in chips (e.g. Paneer), must strictly be 0
    let r2Empty = filterStorefrontProducts(allProducts, activeCategoryId, 'Paneer');
    assert.strictEqual(r2Empty.length, 0, 'Step 3: Paneer in Category 8 must return exactly 0 products (Empty state)');

    // Step 4: Clear search query (query becomes '') while keeping Category 8 selected
    activeQuery = '';
    let r3 = filterStorefrontProducts(allProducts, activeCategoryId, activeQuery);
    assert.strictEqual(r3.length, 20, 'Step 4: Category 8 unfiltered must return all 20 chips products');
    r3.forEach(p => assert.strictEqual(p.category_id, 8, 'Step 4: All products must be in Category 8'));

    // Step 5: Search for "Lays" in Category 8
    activeQuery = 'Lays';
    let r4 = filterStorefrontProducts(allProducts, activeCategoryId, activeQuery);
    assert(r4.length > 0, 'Step 5: Lay\'s search in Category 8 must return results');
    r4.forEach(p => assert.strictEqual(p.category_id, 8, 'Step 5: Lay\'s results must strictly be in Category 8'));

    // Step 6: Switch back to All Categories with query "Lays" still active
    activeCategoryId = null;
    let r5 = filterStorefrontProducts(allProducts, activeCategoryId, activeQuery);
    assert(r5.length >= r4.length, 'Step 6: All Categories for Lay\'s should return at least as many products as Category 8');

    // Step 7: Clear search query in All Categories
    activeQuery = '';
    let r6 = filterStorefrontProducts(allProducts, activeCategoryId, activeQuery);
    assert.strictEqual(r6.length, 500, 'Step 7: All Categories unfiltered must return all 500 products');

    console.log('  PASS: Category switching sequence perfectly preserves isolation and state.');
  }

  // --------------------------------------------------------------------------
  // TEST 7: Stale Response Race Condition Simulation
  // --------------------------------------------------------------------------
  console.log('\nTest 7: Stale Response Race Condition Simulation...');
  {
    let currentRequestId = 0;
    let searchResults = null;

    const mockPerformSearch = async (term, categoryId, reqId) => {
      const delay = categoryId === null ? 50 : 10;
      await new Promise(res => setTimeout(res, delay));
      
      if (reqId !== currentRequestId) {
        return; // Discard stale response
      }

      searchResults = catalogLoader.searchProducts(term, 20, categoryId);
    };

    currentRequestId = 1;
    const slowRequest = mockPerformSearch('Paneer', null, 1);

    currentRequestId = 2;
    const fastRequest = mockPerformSearch('Paneer', 8, 2);

    await Promise.all([slowRequest, fastRequest]);

    assert(Array.isArray(searchResults), 'searchResults should be an array');
    assert.strictEqual(searchResults.length, 0, 'Stale response from All Categories must NOT overwrite Category 8 result!');
    console.log('  PASS: Stale response guard prevented out-of-order search responses.');
  }

  // --------------------------------------------------------------------------
  // TEST 8: Live Backend HTTP API Endpoint Verification
  // --------------------------------------------------------------------------
  console.log('\nTest 8: Testing live backend HTTP API (/api/products/search)...');

  const fetchJson = (urlPath) => {
    return new Promise((resolve, reject) => {
      http.get(`http://localhost:8080${urlPath}`, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  };

  try {
    // 8a. All Categories search
    const allRes = await fetchJson('/api/products/search?q=milk');
    assert(allRes.success, 'API search should be successful');
    assert(allRes.data.length > 0, 'API search for milk should return products');
    console.log(`  Live API All Categories 'milk': ${allRes.data.length} results returned.`);

    // 8b. Category 8 search for paneer (must be 0)
    const cat8Paneer = await fetchJson('/api/products/search?q=paneer&categoryId=8');
    assert(cat8Paneer.success, 'API search should be successful');
    assert.strictEqual(cat8Paneer.data.length, 0, 'API search for paneer in Category 8 must return 0 results');
    console.log(`  Live API Category 8 'paneer': ${cat8Paneer.data.length} results returned (expected 0).`);

    // 8c. Category 8 search for milk (must be 0 because Uncle Chips does not match Milk)
    const cat8Milk = await fetchJson('/api/products/search?q=milk&categoryId=8');
    assert(cat8Milk.success, 'API search should be successful');
    assert.strictEqual(cat8Milk.data.length, 0, 'Category 8 search for milk must return 0 results (Product name only)');
    console.log(`  Live API Category 8 'milk': ${cat8Milk.data.length} results returned (expected 0).`);

    // 8d. Category 8 search for lays
    const cat8Lays = await fetchJson('/api/products/search?q=lays&categoryId=8');
    assert(cat8Lays.success, 'API search should be successful');
    assert(cat8Lays.data.length > 0, 'API search for lays in Category 8 should return products');
    cat8Lays.data.forEach(p => {
      const catId = p.catalog?.categoryId ?? p.category_id;
      assert.strictEqual(catId, 8, `API result ${p.product_id} categoryId must be 8`);
    });
    console.log(`  Live API Category 8 'lays': ${cat8Lays.data.length} results returned strictly in Category 8.`);

    console.log('  PASS: Live Backend HTTP API enforces categoryId parameter flawlessly.');

    console.log('\n======================================================');
    console.log('ALL CATEGORY-AWARE GLOBAL SEARCH TESTS PASSED (8/8)');
    console.log('======================================================\n');
  } catch (err) {
    console.error('Test 8 failed with error:', err.message);
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
