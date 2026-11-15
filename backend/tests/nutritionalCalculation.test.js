/**
 * SmartChoice Automated Test Suite: Nutritional Calculation & Serving-Size Precision
 * Validates Part 2 & Part 9 requirements.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const {
  parseServingSize,
  calculateNutrientPerServing,
  calculateAllNutrientsPerServing
} = require('../utils/nutritionConversion');

console.log('=== RUNNING NUTRITIONAL CALCULATION TESTS ===\n');

// TEST 1: Serving Size String Parsing
console.log('Test 1: Complex serving size parsing...');
const testCases = [
  { input: '1/10 package (38 g)', expectedVal: 38, expectedUnit: 'g' },
  { input: '2 biscuits (25g)', expectedVal: 25, expectedUnit: 'g' },
  { input: '1 cup (240 ml)', expectedVal: 240, expectedUnit: 'ml' },
  { input: '30 g', expectedVal: 30, expectedUnit: 'g' },
  { input: '15 ml', expectedVal: 15, expectedUnit: 'ml' },
  { input: '1 bottle (1 L)', expectedVal: 1000, expectedUnit: 'ml' },
  { input: '1 portion (45.5 g)', expectedVal: 45.5, expectedUnit: 'g' },
  { input: '2 tbsp (30g)', expectedVal: 30, expectedUnit: 'g' }
];

testCases.forEach(tc => {
  const res = parseServingSize(tc.input);
  assert.strictEqual(res.value, tc.expectedVal, `Value mismatch for "${tc.input}": expected ${tc.expectedVal}, got ${res.value}`);
  assert.strictEqual(res.unit, tc.expectedUnit, `Unit mismatch for "${tc.input}": expected ${tc.expectedUnit}, got ${res.unit}`);
});
console.log('✔ Test 1 Passed: Complex serving sizes parsed accurately.\n');

// TEST 2: Formula Verification: Per Serving = Per 100g * Serving Size / 100
console.log('Test 2: Mathematical conversion formula precision...');
const sample100g = {
  energy_kcal: 400.0,
  protein_g: 20.0,
  carbohydrates_g: 50.0,
  total_sugars_g: 10.0,
  total_fat_g: 15.0,
  saturated_fat_g: 5.0,
  dietary_fiber_g: 8.0,
  sodium_mg: 500.0
};
const res30g = calculateAllNutrientsPerServing(sample100g, '30 g');
assert.strictEqual(res30g.servingMultiplier, 0.3);
assert.strictEqual(res30g.perServing.energy_kcal, 120.0);
assert.strictEqual(res30g.perServing.protein_g, 6.0);
assert.strictEqual(res30g.perServing.carbohydrates_g, 15.0);
assert.strictEqual(res30g.perServing.total_sugars_g, 3.0);
assert.strictEqual(res30g.perServing.total_fat_g, 4.5);
assert.strictEqual(res30g.perServing.saturated_fat_g, 1.5);
assert.strictEqual(res30g.perServing.dietary_fiber_g, 2.4);
assert.strictEqual(res30g.perServing.sodium_mg, 150.0);
console.log('✔ Test 2 Passed: Conversion formula mathematically exact.\n');

// TEST 3: Betty Crocker Chocolate Fudge Cake Mix (PKG_PRD_0467)
console.log('Test 3: Betty Crocker Chocolate Fudge Cake Mix verification...');
const catalogPath = path.join(__dirname, '../../frontend/public/data/enriched_catalog_500.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
let betty = null;
let knorr = null;

catalog.categories.forEach(c => {
  (c.products || []).forEach(p => {
    if (p.product_id === 'PKG_PRD_0467') betty = p;
    if (p.product_id === 'PKG_PRD_0397') knorr = p;
  });
});

assert(betty, 'Betty Crocker PKG_PRD_0467 must exist in catalog');
const bettyServing = calculateAllNutrientsPerServing(betty);

assert.strictEqual(bettyServing.servingSize, 38, 'Betty Crocker serving size must be 38g');
assert.strictEqual(bettyServing.per100g.energy_kcal, 394.7, 'Betty Crocker per 100g energy must be 394.7 kcal');
assert.strictEqual(bettyServing.per100g.protein_g, 13.9, 'Betty Crocker per 100g protein must be 13.9g');

// Expected: 394.7 * 0.38 = 149.986 -> 150.0 kcal
assert(Math.abs(bettyServing.perServing.energy_kcal - 150.0) <= 0.1, `Betty energy per serving must be ~150.0 kcal, got ${bettyServing.perServing.energy_kcal}`);
// Expected: 13.9 * 0.38 = 5.282 -> 5.28g protein
assert(Math.abs(bettyServing.perServing.protein_g - 5.28) <= 0.05, `Betty protein per serving must be ~5.28g, got ${bettyServing.perServing.protein_g}`);
console.log(`✔ Test 3 Passed: Betty Crocker serving values: ${bettyServing.perServing.energy_kcal} kcal, ${bettyServing.perServing.protein_g}g protein (Verified!)\n`);

// TEST 4: Knorr Chicken Delite Soup (PKG_PRD_0397)
console.log('Test 4: Knorr Chicken Delite Soup verification...');
assert(knorr, 'Knorr Soup PKG_PRD_0397 must exist in catalog');
const knorrServing = calculateAllNutrientsPerServing(knorr);

assert.strictEqual(knorrServing.servingSize, 30, 'Knorr serving size must be 30g');
assert.strictEqual(knorrServing.per100g.energy_kcal, 327.3, 'Knorr per 100g energy must be 327.3 kcal');
assert.strictEqual(knorrServing.per100g.protein_g, 13.6, 'Knorr per 100g protein must be 13.6g');

// Expected: 327.3 * 0.30 = 98.19 -> 98.2 kcal
assert(Math.abs(knorrServing.perServing.energy_kcal - 98.2) <= 0.1, `Knorr energy per serving must be ~98.2 kcal, got ${knorrServing.perServing.energy_kcal}`);
// Expected: 13.6 * 0.30 = 4.08g protein
assert(Math.abs(knorrServing.perServing.protein_g - 4.08) <= 0.05, `Knorr protein per serving must be ~4.08g, got ${knorrServing.perServing.protein_g}`);
console.log(`✔ Test 4 Passed: Knorr Soup serving values: ${knorrServing.perServing.energy_kcal} kcal, ${knorrServing.perServing.protein_g}g protein (Verified!)\n`);

// TEST 5: Liquid Beverly Serving Conversions
console.log('Test 5: Liquid Beverage Conversions (ml)...');
const juice100ml = {
  energy_kcal: 45.0,
  protein_g: 0.5,
  carbohydrates_g: 10.5,
  total_sugars_g: 10.0,
  total_fat_g: 0.1,
  sodium_mg: 10.0
};
const juiceServing = calculateAllNutrientsPerServing(juice100ml, '200 ml', 'BEVERAGE_GENERAL');
assert.strictEqual(juiceServing.servingSize, 200);
assert.strictEqual(juiceServing.servingUnit, 'ml');
assert.strictEqual(juiceServing.perServing.energy_kcal, 90.0);
assert.strictEqual(juiceServing.perServing.total_sugars_g, 20.0);
console.log('✔ Test 5 Passed: Beverage volume conversions exact.\n');

// TEST 6: Zero & Missing Value Handling
console.log('Test 6: Missing and zero value handling...');
const emptyNutr = {};
const emptyRes = calculateAllNutrientsPerServing(emptyNutr, '');
assert.strictEqual(emptyRes.perServing.energy_kcal, null);
assert.strictEqual(emptyRes.perServing.protein_g, null);
console.log('✔ Test 6 Passed: Safe null preservation for missing nutrients.\n');

console.log('ALL NUTRITIONAL CALCULATION TESTS PASSED SUCCESSFULLY!');
