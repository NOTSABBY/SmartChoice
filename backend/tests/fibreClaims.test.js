const assert = require('assert');
const { evaluateFibreClaim } = require('../services/proteinFibreAnalysisService');

console.log('=== TEST SUITE: FIBRE CLAIMS & BASIS SPECIFICATION ===');

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

// FB-01: Solids Boundary Exactly at High Threshold (6.0g)
runTest('FB-01: Solids Boundary Exactly at High Threshold (6.0g)', () => {
  const res = evaluateFibreClaim({
    declaredFibre: 6.0,
    declaredBasis: 'PER_100G',
    categoryFormat: 'SOLID_FOOD'
  });
  assert.strictEqual(res.status, 'HIGH_FIBRE_ELIGIBLE');
  assert.strictEqual(res.qualifyingBasis, 'PER_100G');
});

// FB-02: Solids Boundary Immediately Below High (5.99g)
runTest('FB-02: Solids Boundary Immediately Below High (5.99g)', () => {
  const res = evaluateFibreClaim({
    declaredFibre: 5.99,
    declaredBasis: 'PER_100G',
    categoryFormat: 'SOLID_FOOD'
  });
  assert.strictEqual(res.status, 'SOURCE_OF_FIBRE_ELIGIBLE');
  assert.strictEqual(res.qualifyingBasis, 'PER_100G');
});

// FB-03: Solids Boundary Exactly at Source Threshold (3.0g)
runTest('FB-03: Solids Boundary Exactly at Source Threshold (3.0g)', () => {
  const res = evaluateFibreClaim({
    declaredFibre: 3.0,
    declaredBasis: 'PER_100G',
    categoryFormat: 'SOLID_FOOD'
  });
  assert.strictEqual(res.status, 'SOURCE_OF_FIBRE_ELIGIBLE');
  assert.strictEqual(res.qualifyingBasis, 'PER_100G');
});

// FB-04: Solids Boundary Immediately Below Source (2.99g)
runTest('FB-04: Solids Boundary Immediately Below Source (2.99g)', () => {
  const res = evaluateFibreClaim({
    declaredFibre: 2.99,
    declaredBasis: 'PER_100G',
    categoryFormat: 'SOLID_FOOD'
  });
  assert.strictEqual(res.status, 'NOT_ELIGIBLE');
});

// FB-05: Liquids Boundary Exactly at High Threshold (3.0g/100ml)
runTest('FB-05: Liquids Boundary Exactly at High Threshold (3.0g/100ml)', () => {
  const res = evaluateFibreClaim({
    declaredFibre: 3.0,
    declaredBasis: 'PER_100ML',
    categoryFormat: 'BEVERAGE_GENERAL'
  });
  assert.strictEqual(res.status, 'HIGH_FIBRE_ELIGIBLE');
  assert.strictEqual(res.qualifyingBasis, 'PER_100ML');
});

// FB-06: Liquids Boundary Exactly at Source Threshold (1.5g/100ml)
runTest('FB-06: Liquids Boundary Exactly at Source Threshold (1.5g/100ml)', () => {
  const res = evaluateFibreClaim({
    declaredFibre: 1.5,
    declaredBasis: 'PER_100ML',
    categoryFormat: 'BEVERAGE_GENERAL'
  });
  assert.strictEqual(res.status, 'SOURCE_OF_FIBRE_ELIGIBLE');
  assert.strictEqual(res.qualifyingBasis, 'PER_100ML');
});

// FB-07: Solids Per-Serving Normalization (Eligible High)
runTest('FB-07: Solids Per-Serving Normalization (Eligible High)', () => {
  const res = evaluateFibreClaim({
    declaredFibre: 2.4,
    declaredBasis: 'PER_SERVING',
    servingSize: { value: 40, unit: 'g' },
    categoryFormat: 'SOLID_FOOD'
  });
  assert.strictEqual(res.status, 'HIGH_FIBRE_ELIGIBLE');
  assert.strictEqual(res.qualifyingBasis, 'PER_100G');
});

// FB-08: Liquids Per-Serving Normalization (Eligible Source)
runTest('FB-08: Liquids Per-Serving Normalization (Eligible Source)', () => {
  const res = evaluateFibreClaim({
    declaredFibre: 3.0,
    declaredBasis: 'PER_SERVING',
    servingSize: { value: 200, unit: 'ml' },
    categoryFormat: 'BEVERAGE_GENERAL'
  });
  assert.strictEqual(res.status, 'SOURCE_OF_FIBRE_ELIGIBLE');
  assert.strictEqual(res.qualifyingBasis, 'PER_100ML');
});

// FB-09: Per 100 kcal Fibre Claim (Energy Parity Verified)
runTest('FB-09: Per 100 kcal Fibre Claim (Energy Parity Verified)', () => {
  const res = evaluateFibreClaim({
    declaredFibre: 2.0,
    declaredBasis: 'PER_100G',
    energyKcal: 50,
    energyBasis: 'PER_100G',
    categoryFormat: 'SOLID_FOOD'
  });
  assert.strictEqual(res.status, 'HIGH_FIBRE_ELIGIBLE');
  assert.strictEqual(res.qualifyingBasis, 'PER_100_KCAL');
});

// FB-10: Per 100 kcal Fibre Claim (Basis Mismatch Rejected)
runTest('FB-10: Per 100 kcal Fibre Claim (Basis Mismatch Rejected)', () => {
  const res = evaluateFibreClaim({
    declaredFibre: 0.5,
    declaredBasis: 'PER_SERVING',
    servingSize: { value: 30, unit: 'g' },
    energyKcal: 50,
    energyBasis: 'PER_100G',
    categoryFormat: 'SOLID_FOOD'
  });
  assert.notStrictEqual(res.qualifyingBasis, 'PER_100_KCAL');
});

// FB-11: Unclassified Category Format
runTest('FB-11: Unclassified Category Format', () => {
  const res = evaluateFibreClaim({
    declaredFibre: 5.0,
    declaredBasis: 'PER_100G',
    categoryFormat: 'UNCLASSIFIED'
  });
  assert.strictEqual(res.status, 'UNCLASSIFIED_CATEGORY');
});

// FB-12: Incompatible Serving Unit (ml for solid food)
runTest('FB-12: Incompatible Serving Unit (ml for solid food)', () => {
  const res = evaluateFibreClaim({
    declaredFibre: 2.0,
    declaredBasis: 'PER_SERVING',
    servingSize: { value: 30, unit: 'ml' },
    categoryFormat: 'SOLID_FOOD'
  });
  assert.strictEqual(res.status, 'INCOMPATIBLE_SERVING_UNIT');
});

// FB-13: Incompatible Serving Unit (g for liquid)
runTest('FB-13: Incompatible Serving Unit (g for liquid)', () => {
  const res = evaluateFibreClaim({
    declaredFibre: 2.0,
    declaredBasis: 'PER_SERVING',
    servingSize: { value: 200, unit: 'g' },
    categoryFormat: 'BEVERAGE_GENERAL'
  });
  assert.strictEqual(res.status, 'INCOMPATIBLE_SERVING_UNIT');
});

// FB-14: Zero / Negative Serving Size
runTest('FB-14: Zero / Negative Serving Size', () => {
  const res = evaluateFibreClaim({
    declaredFibre: 2.0,
    declaredBasis: 'PER_SERVING',
    servingSize: { value: -40, unit: 'g' },
    categoryFormat: 'SOLID_FOOD'
  });
  assert.strictEqual(res.status, 'CLAIM_UNVERIFIABLE_BASIS_MISMATCH');
});

// FB-15: Unsupported Fibre Unit (mcg)
runTest('FB-15: Unsupported Fibre Unit (mcg)', () => {
  const res = evaluateFibreClaim({
    declaredFibre: 5000000,
    declaredUnit: 'mcg',
    declaredBasis: 'PER_100G',
    categoryFormat: 'SOLID_FOOD'
  });
  assert.strictEqual(res.status, 'UNSUPPORTED_UNIT');
});

// FB-16: Missing / Null Fibre Value
runTest('FB-16: Missing / Null Fibre Value', () => {
  const res = evaluateFibreClaim({
    declaredFibre: null,
    declaredBasis: 'PER_100G',
    categoryFormat: 'SOLID_FOOD'
  });
  assert.strictEqual(res.status, 'DATA_UNAVAILABLE');
});

console.log(`\nFibre Tests Summary: ${passed}/${total} passed.\n`);
if (passed !== total) process.exit(1);