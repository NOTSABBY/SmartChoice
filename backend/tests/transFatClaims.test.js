const assert = require('assert');
const { evaluateTransFatFreeClaim, evaluateTransFatCompliance } = require('../services/nutritionAnalysisService');

console.log('=== TEST SUITE: TRANS-FAT CLAIMS & STATUTORY COMPLIANCE ===');

let passed = 0;
let total = 0;

function runTest(name, fn) {
  total++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
  }
}

// TF-01: Milligram to Gram Conversion (Eligible)
runTest('TF-01: Milligram to Gram Conversion (Eligible)', () => {
  const res = evaluateTransFatFreeClaim({
    declaredTransFat: 150,
    declaredUnit: 'mg',
    declaredBasis: 'PER_100G',
    categoryFormat: 'SOLID_FOOD'
  });
  assert.strictEqual(res.claimTag, 'TRANS_FAT_FREE_ELIGIBLE');
  assert.strictEqual(res.isEligible, true);
  assert.strictEqual(res.provenance.normalizedValuePer100, 0.15);
});

// TF-02: Milligram to Gram Conversion (Exceeds)
runTest('TF-02: Milligram to Gram Conversion (Exceeds)', () => {
  const res = evaluateTransFatFreeClaim({
    declaredTransFat: 250,
    declaredUnit: 'mg',
    declaredBasis: 'PER_100G',
    categoryFormat: 'SOLID_FOOD'
  });
  assert.strictEqual(res.claimTag, 'NOT_ELIGIBLE');
  assert.strictEqual(res.isEligible, false);
  assert.strictEqual(res.provenance.normalizedValuePer100, 0.25);
});

// TF-03: Liquid Per-Serving Normalization (Eligible)
runTest('TF-03: Liquid Per-Serving Normalization (Eligible)', () => {
  const res = evaluateTransFatFreeClaim({
    declaredTransFat: 0.03,
    declaredUnit: 'g',
    declaredBasis: 'PER_SERVING',
    servingSize: { value: 200, unit: 'ml' },
    categoryFormat: 'BEVERAGE_GENERAL'
  });
  assert.strictEqual(res.claimTag, 'TRANS_FAT_FREE_ELIGIBLE');
  assert.strictEqual(res.isEligible, true);
  assert.strictEqual(res.provenance.normalizedValuePer100, 0.015);
});

// TF-04: Liquid Per-Serving Normalization (Exceeds)
runTest('TF-04: Liquid Per-Serving Normalization (Exceeds)', () => {
  const res = evaluateTransFatFreeClaim({
    declaredTransFat: 0.5,
    declaredUnit: 'g',
    declaredBasis: 'PER_SERVING',
    servingSize: { value: 200, unit: 'ml' },
    categoryFormat: 'BEVERAGE_GENERAL'
  });
  assert.strictEqual(res.claimTag, 'NOT_ELIGIBLE');
  assert.strictEqual(res.isEligible, false);
  assert.strictEqual(res.provenance.normalizedValuePer100, 0.25);
});

// TF-05: Solid Food Incompatible Unit (ml for solid)
runTest('TF-05: Solid Food Incompatible Unit (ml for solid)', () => {
  const res = evaluateTransFatFreeClaim({
    declaredTransFat: 0.05,
    declaredBasis: 'PER_SERVING',
    servingSize: { value: 30, unit: 'ml' },
    categoryFormat: 'SOLID_FOOD'
  });
  assert.strictEqual(res.claimTag, 'INCOMPATIBLE_SERVING_UNIT');
  assert.strictEqual(res.isEligible, false);
});

// TF-06: Liquid Incompatible Unit (g for liquid)
runTest('TF-06: Liquid Incompatible Unit (g for liquid)', () => {
  const res = evaluateTransFatFreeClaim({
    declaredTransFat: 0.05,
    declaredBasis: 'PER_SERVING',
    servingSize: { value: 250, unit: 'g' },
    categoryFormat: 'BEVERAGE_GENERAL'
  });
  assert.strictEqual(res.claimTag, 'INCOMPATIBLE_SERVING_UNIT');
  assert.strictEqual(res.isEligible, false);
});

// TF-07: Category-Basis Mismatch (Liquid declared per 100g)
runTest('TF-07: Category-Basis Mismatch (Liquid declared per 100g)', () => {
  const res = evaluateTransFatFreeClaim({
    declaredTransFat: 0.1,
    declaredBasis: 'PER_100G',
    categoryFormat: 'BEVERAGE_GENERAL'
  });
  assert.strictEqual(res.claimTag, 'INCOMPATIBLE_BASIS');
  assert.strictEqual(res.isEligible, false);
});

// TF-08: Category-Basis Mismatch (Solid declared per 100ml)
runTest('TF-08: Category-Basis Mismatch (Solid declared per 100ml)', () => {
  const res = evaluateTransFatFreeClaim({
    declaredTransFat: 0.1,
    declaredBasis: 'PER_100ML',
    categoryFormat: 'SOLID_FOOD'
  });
  assert.strictEqual(res.claimTag, 'INCOMPATIBLE_BASIS');
  assert.strictEqual(res.isEligible, false);
});

// TF-09: Solid Food Boundary Immediately Below (0.199g)
runTest('TF-09: Solid Food Boundary Immediately Below (0.199g)', () => {
  const res = evaluateTransFatFreeClaim({
    declaredTransFat: 0.199,
    declaredBasis: 'PER_100G',
    categoryFormat: 'SOLID_FOOD'
  });
  assert.strictEqual(res.claimTag, 'TRANS_FAT_FREE_ELIGIBLE');
  assert.strictEqual(res.isEligible, true);
});

// TF-10: Solid Food Boundary Exactly at Threshold (0.200g)
runTest('TF-10: Solid Food Boundary Exactly at Threshold (0.200g)', () => {
  const res = evaluateTransFatFreeClaim({
    declaredTransFat: 0.200,
    declaredBasis: 'PER_100G',
    categoryFormat: 'SOLID_FOOD'
  });
  assert.strictEqual(res.claimTag, 'NOT_ELIGIBLE');
  assert.strictEqual(res.isEligible, false);
});

// TF-11: Solid Food Boundary Immediately Above (0.201g)
runTest('TF-11: Solid Food Boundary Immediately Above (0.201g)', () => {
  const res = evaluateTransFatFreeClaim({
    declaredTransFat: 0.201,
    declaredBasis: 'PER_100G',
    categoryFormat: 'SOLID_FOOD'
  });
  assert.strictEqual(res.claimTag, 'NOT_ELIGIBLE');
  assert.strictEqual(res.isEligible, false);
});

// TF-12: Cooking Oil Boundary Below 1.0g
runTest('TF-12: Cooking Oil Boundary Below 1.0g', () => {
  const res = evaluateTransFatFreeClaim({
    declaredTransFat: 0.99,
    declaredBasis: 'PER_100G',
    categoryFormat: 'COOKING_OIL'
  });
  assert.strictEqual(res.claimTag, 'TRANS_FAT_FREE_ELIGIBLE');
  assert.strictEqual(res.isEligible, true);
  assert.strictEqual(res.applicableThresholdG, 1.0);
});

// TF-13: Cooking Oil Boundary Exactly at 1.0g
runTest('TF-13: Cooking Oil Boundary Exactly at 1.0g', () => {
  const res = evaluateTransFatFreeClaim({
    declaredTransFat: 1.00,
    declaredBasis: 'PER_100G',
    categoryFormat: 'COOKING_OIL'
  });
  assert.strictEqual(res.claimTag, 'NOT_ELIGIBLE');
  assert.strictEqual(res.isEligible, false);
});

// TF-14: Unsupported Nutrient Unit (oz)
runTest('TF-14: Unsupported Nutrient Unit (oz)', () => {
  const res = evaluateTransFatFreeClaim({
    declaredTransFat: 0.01,
    declaredUnit: 'oz',
    declaredBasis: 'PER_100G',
    categoryFormat: 'SOLID_FOOD'
  });
  assert.strictEqual(res.claimTag, 'UNSUPPORTED_UNIT');
  assert.strictEqual(res.isEligible, false);
});

// TF-15: Serving Size Zero
runTest('TF-15: Serving Size Zero', () => {
  const res = evaluateTransFatFreeClaim({
    declaredTransFat: 0.05,
    declaredBasis: 'PER_SERVING',
    servingSize: { value: 0, unit: 'g' },
    categoryFormat: 'SOLID_FOOD'
  });
  assert.strictEqual(res.claimTag, 'CLAIM_UNVERIFIABLE_BASIS_MISMATCH');
  assert.strictEqual(res.isEligible, false);
});

// TF-16: Serving Size Negative
runTest('TF-16: Serving Size Negative', () => {
  const res = evaluateTransFatFreeClaim({
    declaredTransFat: 0.05,
    declaredBasis: 'PER_SERVING',
    servingSize: { value: -30, unit: 'g' },
    categoryFormat: 'SOLID_FOOD'
  });
  assert.strictEqual(res.claimTag, 'CLAIM_UNVERIFIABLE_BASIS_MISMATCH');
  assert.strictEqual(res.isEligible, false);
});

// TF-17: Declared Trans-Fat Negative
runTest('TF-17: Declared Trans-Fat Negative', () => {
  const res = evaluateTransFatFreeClaim({
    declaredTransFat: -0.1,
    declaredBasis: 'PER_100G',
    categoryFormat: 'SOLID_FOOD'
  });
  assert.strictEqual(res.claimTag, 'INVALID_INPUT');
  assert.strictEqual(res.isEligible, false);
});

// TF-18: Declared Trans-Fat NaN / Non-Numeric
runTest('TF-18: Declared Trans-Fat NaN / Non-Numeric', () => {
  const res = evaluateTransFatFreeClaim({
    declaredTransFat: NaN,
    declaredBasis: 'PER_100G',
    categoryFormat: 'SOLID_FOOD'
  });
  assert.strictEqual(res.claimTag, 'UNVERIFIABLE');
  assert.strictEqual(res.isEligible, false);
});

// TF-19: Unclassified Product Category
runTest('TF-19: Unclassified Product Category', () => {
  const res = evaluateTransFatFreeClaim({
    declaredTransFat: 0.1,
    declaredBasis: 'PER_100G',
    categoryFormat: 'UNCLASSIFIED'
  });
  assert.strictEqual(res.claimTag, 'UNCLASSIFIED_CATEGORY');
  assert.strictEqual(res.isEligible, false);
});

// TF-20: Decoupling: Statutory Compliance returns REGULATORY_COMPLIANCE_UNVERIFIABLE
runTest('TF-20: Decoupling: Statutory Compliance returns REGULATORY_COMPLIANCE_UNVERIFIABLE', () => {
  const res = evaluateTransFatCompliance({
    declaredTransFatG: 0.1,
    declaredTotalFatG: 10.0,
    ingredientText: 'Wheat flour, water, salt'
  });
  assert.strictEqual(res.status, 'REGULATORY_COMPLIANCE_UNVERIFIABLE');
  assert.strictEqual(res.analyticalEvidencePresent, false);
});

console.log(`\nTrans-Fat Tests Summary: ${passed}/${total} passed.\n`);
if (passed !== total) process.exit(1);