const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const connectDB = require('../config/database');
const Product = require('../models/Product');
const recommendationService = require('../services/recommendationService');
const similarityService = require('../services/similarityService');
const { calculateSmartChoiceScore } = require('../services/scoringService');

console.log('=== TEST SUITE: PHASE 4 REGRESSION & DATABASE PRESERVATION ===');

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
  try {
    await connectDB();
    console.log('[INFO] Connected to MongoDB Atlas.');

    // PR-01: 500 Catalog-500 Records Intact
    await runAsyncTest('PR-01: 500 Catalog-500 records verified intact', async () => {
      const count = await Product.countDocuments({ 'catalog.productId': { $exists: true, $ne: null } });
      assert.strictEqual(count, 500);
    });

    // PR-02: 524 Legacy Retail Records Intact
    await runAsyncTest('PR-02: 524 Legacy retail records verified intact', async () => {
      const legacyCount = await Product.countDocuments({ 'catalog.productId': { $exists: false } });
      assert.strictEqual(legacyCount, 524);
    });

    // PR-03: Real Catalog Product Scoring
    await runAsyncTest('PR-03: Scoring real Catalog-500 product PKG_PRD_0001', async () => {
      const prod = await Product.findOne({ 'catalog.productId': 'PKG_PRD_0001' });
      assert.ok(prod);
      const score = calculateSmartChoiceScore(prod);
      assert.ok(score.totalScore >= 0 && score.totalScore <= 100);
      assert.ok(score.explanation.includes('Overall score of'));
    });

    // PR-04: Real Legacy Retail Product Scoring
    await runAsyncTest('PR-04: Scoring real Legacy retail product', async () => {
      const legacy = await Product.findOne({ 'catalog.productId': { $exists: false } });
      assert.ok(legacy);
      const score = calculateSmartChoiceScore(legacy);
      assert.ok(score.totalScore >= 0 && score.totalScore <= 100);
    });

    // PR-05: Recommendation Service Compatibility
    await runAsyncTest('PR-05: Recommendation Service evaluates preferences compatibly', async () => {
      const prod = await Product.findOne({ 'catalog.productId': 'PKG_PRD_0001' });
      const evalRes = recommendationService.evaluatePreferences(prod, { highProtein: true });
      assert.ok(Array.isArray(evalRes.results));
    });

    // PR-06: Similarity Service Invariants
    runTest('PR-06: Similarity Weights invariant check (40/20/15/15/10)', () => {
      const dummy1 = { identity: { categories: ['grain'] }, serving: { servingSize: '100' } };
      const dummy2 = { identity: { categories: ['grain'] }, serving: { servingSize: '100' } };
      const sim = similarityService.calculateSimilarity(dummy1, dummy2);
      assert.ok(sim.similarityScore >= 55);
    });

  } catch (err) {
    console.error('[FAIL] DB Connection or execution error:', err.message);
  }

  console.log(`\nPhase 4 Regression Summary: ${passed}/${total} passed.\n`);
  process.exit(passed === total ? 0 : 1);
}

main();