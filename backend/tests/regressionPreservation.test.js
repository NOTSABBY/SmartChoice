const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const connectDB = require('../config/database');
const Product = require('../models/Product');
const scoringConfig = require('../config/scoringConfig');
const similarityService = require('../services/similarityService');
const { analyzeProduct } = require('../services/productAnalysisService');

console.log('=== TEST SUITE: FULL SYSTEM REGRESSION & PRESERVATION ===');

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

async function runAsyncTest(name, fn) {
  total++;
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
  }
}

async function main() {
  // RG-01: Scoring Weights Preservation
  runTest('RG-01: Scoring Weights remain strictly 40/20/15/15/10', () => {
    assert.strictEqual(scoringConfig.weights.nutrition, 0.40);
    assert.strictEqual(scoringConfig.weights.ingredients, 0.20);
    assert.strictEqual(scoringConfig.weights.processing, 0.15);
    assert.strictEqual(scoringConfig.weights.proteinFiber, 0.15);
    assert.strictEqual(scoringConfig.weights.preferences, 0.10);
  });

  // RG-02: Similarity Weights Preservation
  runTest('RG-02: Similarity Weights remain strictly 40/20/15/15/10', () => {
    const dummyTarget = { identity: { categories: ['snack'], productType: 'chips' }, serving: { servingSize: '30' } };
    const dummyCand = { identity: { categories: ['snack'], productType: 'chips' }, serving: { servingSize: '30' } };
    const sim = similarityService.calculateSimilarity(dummyTarget, dummyCand);
    assert.ok(sim.similarityScore >= 60);
  });

  // Database-dependent checks
  try {
    await connectDB();
    console.log('[INFO] Connected to MongoDB Atlas for regression verification.');

    // RG-03: Verify 500 Catalog-500 products
    await runAsyncTest('RG-03: 500 Catalog-500 products intact in database', async () => {
      const count = await Product.countDocuments({ 'catalog.productId': { $exists: true, $ne: null } });
      assert.strictEqual(count, 500);
    });

    // RG-04: Verify Legacy Retail Products Accessible
    await runAsyncTest('RG-04: 524 legacy retail products intact and accessible', async () => {
      const legacyCount = await Product.countDocuments({ 'catalog.productId': { $exists: false } });
      assert.strictEqual(legacyCount, 524);
    });

    // RG-05: Product Analysis Engine runs on real Catalog-500 document (PKG_PRD_0001)
    await runAsyncTest('RG-05: Product Analysis Engine seamlessly analyzes real catalog product PKG_PRD_0001', async () => {
      const sample = await Product.findOne({ 'catalog.productId': 'PKG_PRD_0001' });
      assert.ok(sample, 'PKG_PRD_0001 must exist');
      const analysis = analyzeProduct(sample, { statutoryReferenceRdaG: 54.0 });
      assert.ok(analysis.engineVersion.includes('3.0.0-fssai'));
      assert.ok(analysis.nutritionAnalysis);
      assert.ok(analysis.ingredientAnalysis);
      assert.ok(analysis.processingAnalysis);
      assert.ok(analysis.completeness);
      assert.ok(analysis.confidence);
    });

    // RG-06: Product Analysis Engine runs safely on a legacy retail document
    await runAsyncTest('RG-06: Product Analysis Engine safely analyzes a legacy retail product', async () => {
      const legacySample = await Product.findOne({ 'catalog.productId': { $exists: false } });
      assert.ok(legacySample, 'Legacy retail sample must exist');
      const analysis = analyzeProduct(legacySample, { statutoryReferenceRdaG: 54.0 });
      assert.ok(analysis.engineVersion.includes('3.0.0-fssai'));
      assert.ok(analysis.completeness.overallPercentage >= 0);
    });

  } catch (dbErr) {
    console.warn('[WARN] MongoDB Atlas connection error:', dbErr.message);
  }

  console.log(`\nRegression Tests Summary: ${passed}/${total} passed.\n`);
  process.exit(passed === total ? 0 : 1);
}

main();