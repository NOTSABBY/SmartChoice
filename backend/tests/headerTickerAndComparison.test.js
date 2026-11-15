const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function test(description, fn) {
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

console.log('=== TEST SUITE: HEADER TICKER & COMPARISON STATE BUG FIX ===\n');

// ==========================================
// SECTION 1: ANNOUNCEMENT BAR & TICKER
// ==========================================
console.log('--- 1. ANNOUNCEMENT BAR & TICKER AUDIT ---');

const navbarPath = path.join(__dirname, '../../frontend/src/components/Navbar.jsx');
const cssPath = path.join(__dirname, '../../frontend/src/index.css');

const navbarSource = fs.readFileSync(navbarPath, 'utf8');
const cssSource = fs.readFileSync(cssPath, 'utf8');

test('TB-01: Announcement bar does NOT contain Recommendations navigation link', () => {
  // Check the announcement bar section (above main header)
  const topBarMatch = navbarSource.match(/role="region"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
  assert(topBarMatch, 'Announcement bar container with role="region" must exist');
  const topBar = topBarMatch[0];
  assert(!topBar.includes('/recommendations'), 'Announcement bar must not contain link to /recommendations');
  assert(!topBar.includes('Recommendations</span>'), 'Announcement bar must not contain Recommendations text link');
});

test('TB-02: Announcement bar does NOT contain AI Assistant navigation link', () => {
  const topBarMatch = navbarSource.match(/role="region"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
  const topBar = topBarMatch[0];
  assert(!topBar.includes('/assistant'), 'Announcement bar must not contain link to /assistant');
  assert(!topBar.includes('AI Assistant</span>'), 'Announcement bar must not contain AI Assistant text link');
});

test('TB-03: Announcement bar contains exact required announcement text', () => {
  assert(navbarSource.includes('SmartChoice Food Intelligence'), 'Must contain exact brand intelligence label');
  assert(navbarSource.includes('FSSAI Enriched & Verified • 25 Categories • 500+ Verified Packaged Food SKUs'),
    'Must contain exact FSSAI verification ticker copy');
});

test('TB-04: Ticker CSS moves LEFT TO RIGHT (translateX -100% to 100vw)', () => {
  assert(cssSource.includes('@keyframes ticker-ltr'), 'Must define ticker-ltr keyframes');
  assert(cssSource.includes('translateX(-100%)'), 'Must start off-screen to the left');
  assert(cssSource.includes('translateX(100vw)'), 'Must translate across viewport to the right');
  assert(cssSource.includes('.animate-ticker-ltr'), 'Must define .animate-ticker-ltr class');
});

test('TB-05: Accessible reduced-motion alternative is defined', () => {
  assert(cssSource.includes('prefers-reduced-motion: reduce'), 'Must have prefers-reduced-motion media query');
  assert(cssSource.includes('animation: none'), 'Reduced motion must disable continuous animation');
});

test('TB-06: Announcement bar renders only ONE single instance without duplicate segments', () => {
  const matches = (navbarSource.match(/SmartChoice Food Intelligence/g) || []).length;
  assert.strictEqual(matches, 1, 'Navbar must contain exactly 1 instance of SmartChoice Food Intelligence');
  assert(!navbarSource.includes('[0, 1, 2].map'), 'Must not contain repeated segment loops');
});

// ==========================================
// SECTION 2: COMPARISON STATE SYNCHRONIZATION
// ==========================================
console.log('\n--- 2. COMPARISON STATE SYNCHRONIZATION ---');

// Replicate exact ComparisonContext engine functions
const getCanonicalId = (item) => {
  if (!item) return null;
  if (typeof item === 'string') return item;
  return item.product_id || item.productId || item.catalog?.productId || item._id || item.id || item.identity?.barcode || null;
};

const createComparisonStore = () => {
  let compareList = [];

  const addProduct = (product) => {
    const newId = getCanonicalId(product);
    if (!newId) return false;
    if (compareList.length >= 4) {
      return false; // Capacity reached
    }
    const alreadyExists = compareList.some(p => {
      const pId = getCanonicalId(p);
      return pId === newId || String(pId) === String(newId);
    });
    if (!alreadyExists) {
      compareList = [...compareList, product];
      return true;
    }
    return false;
  };

  const removeProduct = (productIdOrProduct) => {
    const targetId = getCanonicalId(productIdOrProduct);
    if (!targetId) return;
    compareList = compareList.filter(p => {
      const pId = getCanonicalId(p);
      return pId !== targetId && String(pId) !== String(targetId);
    });
  };

  const clearProducts = () => {
    compareList = [];
  };

  const hasProduct = (productIdOrProduct) => {
    const targetId = getCanonicalId(productIdOrProduct);
    if (!targetId) return false;
    return compareList.some(p => {
      const pId = getCanonicalId(p);
      return pId === targetId || String(pId) === String(targetId);
    });
  };

  const getProductCount = () => compareList.length;

  return {
    getCompareList: () => compareList,
    addProduct,
    removeProduct,
    clearProducts,
    hasProduct,
    getProductCount
  };
};

test('CS-01: Initial comparison count is zero', () => {
  const store = createComparisonStore();
  assert.strictEqual(store.getProductCount(), 0);
  assert.strictEqual(store.getCompareList().length, 0);
});

test('CS-02: Adding first product updates count to 1 and flags hasProduct', () => {
  const store = createComparisonStore();
  const prod1 = { product_id: 'PKG_PRD_0001', product_name: 'Parle-G Gold' };
  const added = store.addProduct(prod1);
  assert.strictEqual(added, true);
  assert.strictEqual(store.getProductCount(), 1);
  assert.strictEqual(store.hasProduct('PKG_PRD_0001'), true);
  assert.strictEqual(store.hasProduct(prod1), true);
});

test('CS-03: Adding second product updates count to 2', () => {
  const store = createComparisonStore();
  store.addProduct({ product_id: 'PKG_PRD_0001', product_name: 'Parle-G Gold' });
  const added = store.addProduct({ product_id: 'PKG_PRD_0002', product_name: 'Britannia Marie Gold' });
  assert.strictEqual(added, true);
  assert.strictEqual(store.getProductCount(), 2);
  assert.strictEqual(store.hasProduct('PKG_PRD_0002'), true);
});

test('CS-04: Duplicate addition does not increase count', () => {
  const store = createComparisonStore();
  store.addProduct({ product_id: 'PKG_PRD_0001', product_name: 'Parle-G Gold' });
  const duplicate = store.addProduct({ product_id: 'PKG_PRD_0001', product_name: 'Parle-G Gold' });
  assert.strictEqual(duplicate, false);
  assert.strictEqual(store.getProductCount(), 1);
});

test('CS-05: Removing one product updates count back to 1', () => {
  const store = createComparisonStore();
  store.addProduct({ product_id: 'PKG_PRD_0001', product_name: 'Parle-G Gold' });
  store.addProduct({ product_id: 'PKG_PRD_0002', product_name: 'Britannia Marie Gold' });
  store.removeProduct('PKG_PRD_0001');
  assert.strictEqual(store.getProductCount(), 1);
  assert.strictEqual(store.hasProduct('PKG_PRD_0001'), false);
  assert.strictEqual(store.hasProduct('PKG_PRD_0002'), true);
});

test('CS-06: Removing all products resets count to 0', () => {
  const store = createComparisonStore();
  store.addProduct({ product_id: 'PKG_PRD_0001', product_name: 'Parle-G Gold' });
  store.addProduct({ product_id: 'PKG_PRD_0002', product_name: 'Britannia Marie Gold' });
  store.clearProducts();
  assert.strictEqual(store.getProductCount(), 0);
  assert.strictEqual(store.getCompareList().length, 0);
});

test('CS-07: Interoperability across Catalog-500, MongoDB _id, and Recommendations productId', () => {
  const store = createComparisonStore();
  const catalog500Item = { product_id: 'PKG_PRD_0100', name: 'Item A' };
  const mongoDbItem = { _id: '67041234567890abcdef1234', name: 'Item B' };
  const recsApiItem = { productId: 'PKG_PRD_0200', name: 'Item C' };

  store.addProduct(catalog500Item);
  store.addProduct(mongoDbItem);
  store.addProduct(recsApiItem);

  assert.strictEqual(store.getProductCount(), 3);
  assert.strictEqual(store.hasProduct('PKG_PRD_0100'), true);
  assert.strictEqual(store.hasProduct('67041234567890abcdef1234'), true);
  assert.strictEqual(store.hasProduct('PKG_PRD_0200'), true);
});

test('CS-08: Maximum limit of 4 products is enforced', () => {
  const store = createComparisonStore();
  store.addProduct({ product_id: 'P1' });
  store.addProduct({ product_id: 'P2' });
  store.addProduct({ product_id: 'P3' });
  store.addProduct({ product_id: 'P4' });
  assert.strictEqual(store.getProductCount(), 4);

  const fifth = store.addProduct({ product_id: 'P5' });
  assert.strictEqual(fifth, false, 'Adding 5th item must be rejected');
  assert.strictEqual(store.getProductCount(), 4, 'Count must stay at 4');
  assert.strictEqual(store.hasProduct('P5'), false);
});

// ==========================================
// SECTION 3: STOREFRONT COMPONENT WIRING AUDIT
// ==========================================
console.log('\n--- 3. STOREFRONT COMPONENT WIRING AUDIT ---');

const storefrontPath = path.join(__dirname, '../../frontend/src/pages/Storefront.jsx');
const storefrontSource = fs.readFileSync(storefrontPath, 'utf8');

test('CW-01: Storefront consumes compareList directly from useComparison', () => {
  assert(storefrontSource.includes('compareList'), 'Storefront must consume compareList');
  assert(storefrontSource.includes('comparedCount={compareList.length}'), 'Navbar must receive comparedCount={compareList.length}');
});

test('CW-02: CompareDrawer receives compareList and clearProducts', () => {
  assert(storefrontSource.includes('comparedProducts={compareList}'), 'CompareDrawer must receive comparedProducts={compareList}');
  assert(storefrontSource.includes('onClearAll={clearProducts}'), 'CompareDrawer must receive onClearAll={clearProducts}');
});

console.log(`\n==========================================`);
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`==========================================`);

if (failed > 0) {
  process.exit(1);
}
