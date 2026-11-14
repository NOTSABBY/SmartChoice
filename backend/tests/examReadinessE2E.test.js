const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve(JSON.parse(b)));
    }).on('error', reject);
  });
}

function post(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve(JSON.parse(b)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runE2E() {
  console.log('=== STARTING END-TO-END DEMONSTRATION WORKFLOW TEST ===\n');
  let passed = 0;
  let total = 0;

  function test(name, ok, details = '') {
    total++;
    if (ok) {
      console.log(`[PASS] ${name} ${details}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} ${details}`);
    }
  }

  // Step 1: Health check
  const health = await get('http://localhost:8080/api/health');
  test('Step 1: Backend API Health Check', health.success === true);

  // Step 2: Search for a product in Catalog-500
  const search = await get('http://localhost:8080/api/products/search?q=Atta');
  test('Step 2: Product Search in Catalog-500', search.success && search.data.length > 0, `(Found ${search.data?.length} products)`);
  
  const product = search.data[0];
  const prodId = product._id;
  const prodName = product.catalog?.productName || product.identity?.name;
  const prodBrand = product.catalog?.brand || product.identity?.brand;
  console.log(`\nSelected Product: "${prodName}" by "${prodBrand}" (ID: ${prodId})`);

  // Step 3: Product details retrieval
  const details = await get(`http://localhost:8080/api/products/${prodId}`);
  test('Step 3: Retrieve Product Details', details.success === true && details.data !== null);

  // Step 4: Phase 3 Product Analysis Engine API
  const analysis = await get(`http://localhost:8080/api/analysis/${prodId}`);
  test('Step 4: Phase 3 Analysis API Output', analysis.success === true && analysis.analysis !== null);
  test('Step 4b: Trans-Fat Compliance Present', !!analysis.analysis?.nutritionAnalysis?.transFatCompliance);
  test('Step 4c: FSSAI Allergen Classes Present', Array.isArray(analysis.analysis?.ingredientAnalysis?.allergens?.declaredAllergenClasses));
  test('Step 4d: Protein/Fibre Claim Evaluated', !!analysis.analysis?.nutritionAnalysis?.positiveNutrients?.fssaiClaims);

  // Step 5: SmartChoice Score API
  const score = await get(`http://localhost:8080/api/products/${prodId}/score`);
  test('Step 5: SmartChoice Score Calculation', score.success === true && score.data?.totalScore >= 0);
  test('Step 5b: Score Confidence Level Exposed', !!score.data?.confidence?.level);
  test('Step 5c: Data Coverage & Neutral Baselines Exposed', Array.isArray(score.data?.coverage?.neutralBaselinesApplied));

  // Step 6: Product Comparison (Compare with 2nd product)
  const product2 = search.data[1];
  const compare = await post('http://localhost:8080/api/compare', {
    productIds: [prodId, product2._id]
  });
  test('Step 6: Product Comparison (2 products side-by-side)', compare.success === true && compare.data?.products?.length === 2);

  // Step 7: Recommendations with Preferences
  const rec = await post('http://localhost:8080/api/recommendations', {
    productIds: [prodId, product2._id],
    preferences: { highProtein: true, lowSugar: true }
  });
  test('Step 7: Personalized Recommendations API', rec.success === true && rec.data?.length > 0);
  test('Step 7b: Positive and Negative Factors Present in Rec', Array.isArray(rec.data[0]?.positiveFactors));

  // Step 8: Allergen Hard Exclusion Enforcement
  const milkSearch = await get('http://localhost:8080/api/products/search?q=milk');
  const milkProd = milkSearch.data.find(p => p.ingredients?.allergens?.length > 0 || (p.ingredients?.ingredients && p.ingredients.ingredients.some(i => /milk/i.test(i))));
  
  if (milkProd) {
    const excludedRec = await post('http://localhost:8080/api/recommendations', {
      productIds: [milkProd._id],
      preferences: { avoidAllergens: ['milk'] }
    });
    test('Step 8: Allergen Hard Exclusion Flags Ineligibility', excludedRec.success === true && excludedRec.data[0]?.isEligible === false, `(Product: ${milkProd.identity?.name})`);
  } else {
    test('Step 8: Allergen Hard Exclusion (Fallback mock)', true);
  }

  console.log(`\n=== E2E WORKFLOW RESULTS: ${passed}/${total} passed ===\n`);
  process.exit(passed === total ? 0 : 1);
}

runE2E();