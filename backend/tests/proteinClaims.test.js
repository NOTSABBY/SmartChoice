const assert = require('assert');
const { evaluateProteinClaim } = require('../services/proteinFibreAnalysisService');

console.log('=== TEST SUITE: PROTEIN CLAIMS & RDA SPECIFICATION ===');

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

// PR-01: Missing Statutory Reference Group
runTest('PR-01: Missing Statutory Reference Group returns STATUTORY_REFERENCE_UNSPECIFIED', () => {
  const res = evaluateProteinClaim({
    declaredProtein: 12.0,
    declaredBasis: 'PER_100G',
    categoryFormat: 'SOLID_FOOD',
    statutoryReferenceRdaG: null
  });
  assert.strictEqual(res.statutoryClaim.status, 'STATUTORY_REFERENCE_UNSPECIFIED');
});

// PR-02: Solids Boundary Exactly at High Threshold (10.8g for 54g RDA)
runTest('PR-02: Solids Boundary Exactly at High Threshold (10.8g for 54g RDA)', () => {
  const res = evaluateProteinClaim({
    declaredProtein: 10.8,
    declaredBasis: 'PER_100G',
    categoryFormat: 'SOLID_FOOD',
    statutoryReferenceRdaG: 54.0
  });
  assert.strictEqual(res.statutoryClaim.status, 'HIGH_PROTEIN_ELIGIBLE');
  assert.strictEqual(res.statutoryClaim.qualifyingBasis, 'PER_100G');
});

// PR-03: Solids Boundary Immediately Below High (10.79g for 54g RDA)
runTest('PR-03: Solids Boundary Immediately Below High (10.79g for 54g RDA)', () => {
  const res = evaluateProteinClaim({
    declaredProtein: 10.79,
    declaredBasis: 'PER_100G',
    categoryFormat: 'SOLID_FOOD',
    statutoryReferenceRdaG: 54.0
  });
  assert.strictEqual(res.statutoryClaim.status, 'SOURCE_OF_PROTEIN_ELIGIBLE');
  assert.strictEqual(res.statutoryClaim.qualifyingBasis, 'PER_100G');
});

// PR-04: Solids Boundary Exactly at Source Threshold (5.40g for 54g RDA)
runTest('PR-04: Solids Boundary Exactly at Source Threshold (5.40g for 54g RDA)', () => {
  const res = evaluateProteinClaim({
    declaredProtein: 5.40,
    declaredBasis: 'PER_100G',
    categoryFormat: 'SOLID_FOOD',
    statutoryReferenceRdaG: 54.0
  });
  assert.strictEqual(res.statutoryClaim.status, 'SOURCE_OF_PROTEIN_ELIGIBLE');
  assert.strictEqual(res.statutoryClaim.qualifyingBasis, 'PER_100G');
});

// PR-05: Solids Boundary Immediately Below Source (5.39g for 54g RDA)
runTest('PR-05: Solids Boundary Immediately Below Source (5.39g for 54g RDA)', () => {
  const res = evaluateProteinClaim({
    declaredProtein: 5.39,
    declaredBasis: 'PER_100G',
    categoryFormat: 'SOLID_FOOD',
    statutoryReferenceRdaG: 54.0
  });
  assert.strictEqual(res.statutoryClaim.status, 'NOT_ELIGIBLE');
});

// PR-06: Liquids Boundary Exactly at High Threshold (5.40g for 54g RDA)
runTest('PR-06: Liquids Boundary Exactly at High Threshold (5.40g for 54g RDA)', () => {
  const res = evaluateProteinClaim({
    declaredProtein: 5.40,
    declaredBasis: 'PER_100ML',
    categoryFormat: 'BEVERAGE_GENERAL',
    statutoryReferenceRdaG: 54.0
  });
  assert.strictEqual(res.statutoryClaim.status, 'HIGH_PROTEIN_ELIGIBLE');
  assert.strictEqual(res.statutoryClaim.qualifyingBasis, 'PER_100ML');
});

// PR-07: Liquids Boundary Exactly at Source Threshold (2.70g for 54g RDA)
runTest('PR-07: Liquids Boundary Exactly at Source Threshold (2.70g for 54g RDA)', () => {
  const res = evaluateProteinClaim({
    declaredProtein: 2.70,
    declaredBasis: 'PER_100ML',
    categoryFormat: 'BEVERAGE_GENERAL',
    statutoryReferenceRdaG: 54.0
  });
  assert.strictEqual(res.statutoryClaim.status, 'SOURCE_OF_PROTEIN_ELIGIBLE');
  assert.strictEqual(res.statutoryClaim.qualifyingBasis, 'PER_100ML');
});

// PR-08: Liquid Per-Serving Claim (Verified Serving)
runTest('PR-08: Liquid Per-Serving Claim (Verified Serving)', () => {
  const res = evaluateProteinClaim({
    declaredProtein: 3.0,
    declaredBasis: 'PER_SERVING',
    servingSize: { value: 200, unit: 'ml' },
    categoryFormat: 'BEVERAGE_GENERAL',
    statutoryReferenceRdaG: 54.0
  });
  assert.strictEqual(res.statutoryClaim.status, 'SOURCE_OF_PROTEIN_ELIGIBLE');
  assert.strictEqual(res.statutoryClaim.qualifyingBasis, 'PER_SERVING');
});

// PR-09: Per 100 kcal Claim with Energy Parity
runTest('PR-09: Per 100 kcal Claim with Energy Parity', () => {
  const res = evaluateProteinClaim({
    declaredProtein: 3.0,
    declaredBasis: 'PER_100G',
    energyKcal: 60,
    energyBasis: 'PER_100G',
    categoryFormat: 'SOLID_FOOD',
    statutoryReferenceRdaG: 54.0
  });
  assert.strictEqual(res.statutoryClaim.status, 'SOURCE_OF_PROTEIN_ELIGIBLE');
  assert.strictEqual(res.statutoryClaim.qualifyingBasis, 'PER_100_KCAL');
});

// PR-10: Per 100 kcal Claim with Energy Mismatch
runTest('PR-10: Per 100 kcal Claim with Energy Mismatch', () => {
  const res = evaluateProteinClaim({
    declaredProtein: 1.0,
    declaredBasis: 'PER_SERVING',
    servingSize: { value: 30, unit: 'g' },
    energyKcal: 60,
    energyBasis: 'PER_100G',
    categoryFormat: 'SOLID_FOOD',
    statutoryReferenceRdaG: 54.0
  });
  // Mismatched energy basis should NOT qualify via per 100 kcal
  assert.notStrictEqual(res.statutoryClaim.qualifyingBasis, 'PER_100_KCAL');
});

// PR-11: Zero / Negative Serving Size
runTest('PR-11: Zero / Negative Serving Size', () => {
  const res = evaluateProteinClaim({
    declaredProtein: 5.0,
    declaredBasis: 'PER_SERVING',
    servingSize: { value: 0, unit: 'g' },
    categoryFormat: 'SOLID_FOOD',
    statutoryReferenceRdaG: 54.0
  });
  assert.strictEqual(res.statutoryClaim.status, 'CLAIM_UNVERIFIABLE_BASIS_MISMATCH');
});

// PR-12: Milligram Unit Conversion
runTest('PR-12: Milligram Unit Conversion', () => {
  const res = evaluateProteinClaim({
    declaredProtein: 11000,
    declaredUnit: 'mg',
    declaredBasis: 'PER_100G',
    categoryFormat: 'SOLID_FOOD',
    statutoryReferenceRdaG: 54.0
  });
  assert.strictEqual(res.statutoryClaim.status, 'HIGH_PROTEIN_ELIGIBLE');
  assert.strictEqual(res.statutoryClaim.normalizedValuePer100, 11.0);
});

// PR-13: Non-Numeric / Negative Protein
runTest('PR-13: Non-Numeric / Negative Protein', () => {
  const res = evaluateProteinClaim({
    declaredProtein: -5.0,
    declaredBasis: 'PER_100G',
    categoryFormat: 'SOLID_FOOD',
    statutoryReferenceRdaG: 54.0
  });
  assert.strictEqual(res.statutoryClaim.status, 'DATA_UNAVAILABLE');
});

console.log(`\nProtein Tests Summary: ${passed}/${total} passed.\n`);
if (passed !== total) process.exit(1);