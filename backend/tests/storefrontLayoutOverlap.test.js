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

console.log('=== TEST SUITE: STOREFRONT SIDEBAR & MAIN CONTENT LAYOUT OVERLAP FIX ===\n');

const storefrontPath = path.join(__dirname, '../../frontend/src/pages/Storefront.jsx');
const sidebarPath = path.join(__dirname, '../../frontend/src/components/CategorySidebar.jsx');

const storefrontSource = fs.readFileSync(storefrontPath, 'utf8');
const sidebarSource = fs.readFileSync(sidebarPath, 'utf8');

// 1. Grid/Flex Column Separation
test('LO-01: Storefront main container uses 2-column grid with dedicated sidebar and minmax content', () => {
  assert(
    storefrontSource.includes('lg:grid-cols-[280px_minmax(0,1fr)]'),
    'Main container must define strict 280px sidebar and minmax(0,1fr) content columns on desktop'
  );
  assert(
    storefrontSource.includes('lg:gap-6'),
    'Main container must enforce an explicit horizontal gap (gap-6 = 24px) between columns'
  );
});

// 2. Sidebar Dimension Matching
test('LO-02: Sidebar wrapper matches column width and prevents shrinking', () => {
  assert(
    storefrontSource.includes('w-[280px] shrink-0'),
    'Sidebar wrapper must strictly match the 280px grid track and specify shrink-0'
  );
  assert(
    !storefrontSource.includes('w-60 shrink-0'),
    'Sidebar wrapper must not use undersized w-60 (240px) that causes child overflow'
  );
});

// 3. CategorySidebar Fluid Inner Aside
test('LO-03: CategorySidebar aside uses w-full instead of hardcoded overflowing width', () => {
  assert(
    sidebarSource.includes('w-full'),
    'CategorySidebar aside must be fluid to its container (w-full)'
  );
  assert(
    !sidebarSource.includes('w-64 lg:w-72'),
    'CategorySidebar aside must not hardcode w-64 lg:w-72 which caused the 35px-48px horizontal overflow'
  );
});

// 4. Main Content Isolation
test('LO-04: Main content column specifies min-w-0 to prevent grid blowout', () => {
  assert(
    storefrontSource.includes('min-w-0'),
    'Main content area must specify min-w-0 to guarantee content does not blow out grid column'
  );
  assert(
    storefrontSource.includes('w-full min-w-0'),
    'Main content area must specify w-full min-w-0'
  );
});

// 5. Responsive Handling
test('LO-05: Desktop sidebar is hidden on mobile/tablet viewports (< lg)', () => {
  assert(
    storefrontSource.includes('hidden lg:block'),
    'Sidebar must use hidden lg:block so it is neatly stacked/hidden on smaller viewports'
  );
  assert(
    storefrontSource.includes('onOpenMobileCategories={() => setIsMobileCategoryOpen(true)}'),
    'Storefront must pass onOpenMobileCategories handler to Navbar for mobile drawer access'
  );
  assert(
    storefrontSource.includes('isMobileCategoryOpen'),
    'Storefront must maintain state and UI for mobile category drawer'
  );
});

console.log(`\n==========================================`);
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`==========================================`);

if (failed > 0) {
  process.exit(1);
}
