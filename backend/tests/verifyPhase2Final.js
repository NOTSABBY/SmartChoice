require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Product = require('../models/Product');
  const catalogImportService = require('../services/catalogImportService');
  const catalogSyncService = require('../services/catalogSyncService');
  const catalogStatisticsService = require('../services/catalogStatisticsService');
  const productEnrichmentService = require('../services/productEnrichmentService');
  const scoringService = require('../services/scoringService');
  const similarityService = require('../services/similarityService');
  const scoringConfig = require('../config/scoringConfig');

  console.log('====================================================');
  console.log('1. DATABASE VERIFICATION');
  console.log('====================================================');

  const catalogCount = await Product.countDocuments({ 'catalog.productId': { $exists: true } });
  console.log('Total Catalog-500 products in DB:', catalogCount);

  const distinctIds = await Product.distinct('catalog.productId', { 'catalog.productId': { $exists: true } });
  console.log('Unique catalog.productId values:', distinctIds.length);

  const duplicates = await Product.aggregate([
    { $match: { 'catalog.productId': { $exists: true } } },
    { $group: { _id: '$catalog.productId', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]);
  console.log('Duplicate catalog.productId count:', duplicates.length);

  const indexes = await Product.collection.indexes();
  console.log('\nActual MongoDB Collection Indexes:');
  indexes.forEach(idx => {
    console.log(`- ${idx.name}: ${JSON.stringify(idx.key)} | unique: ${idx.unique} | partial: ${JSON.stringify(idx.partialFilterExpression)}`);
  });

  // Unique Partial Index Enforcement
  let duplicateCaught = false;
  try {
    const dup = new Product({
      catalog: { productId: 'PKG_PRD_0001', categoryId: 1, categoryName: 'Biscuits', brand: 'Test', productName: 'Dup Test' },
      identity: { name: 'Dup Test' }
    });
    await dup.save();
  } catch (err) {
    if (err.code === 11000 || err.message.includes('E11000')) {
      duplicateCaught = true;
      console.log('\nE11000 duplicate key error caught on duplicate insertion:', err.message);
    }
  }
  console.log('Unique partial index enforcement verified:', duplicateCaught);

  // Legacy retail records
  const legacyCount = await Product.countDocuments({ 'catalog.productId': { $exists: false } });
  console.log('Total legacy retail products:', legacyCount);
  const legacySample = await Product.findOne({ 'catalog.productId': { $exists: false } }).lean();
  console.log('Sample legacy product barcode:', legacySample?.identity?.barcode, '| name:', legacySample?.identity?.name);

  console.log('\n====================================================');
  console.log('2. IMPORT & IDEMPOTENCY VERIFICATION');
  console.log('====================================================');

  const validation = await catalogImportService.validateWorkbook();
  console.log('Catalog validation success:', validation.success);
  console.log('Extracted rows:', validation.totalRowsExtracted, '| Valid rows:', validation.validRecordsCount);

  // Check enriched product PKG_PRD_0004 before re-import
  const enrichedBefore = await Product.findOne({ 'catalog.productId': 'PKG_PRD_0004' }).lean();
  console.log('PKG_PRD_0004 before sync: status =', enrichedBefore?.enrichment?.status, '| calories =', enrichedBefore?.nutrition?.calories, '| barcode =', enrichedBefore?.identity?.barcode);

  // Re-import (idempotent sync)
  const syncResult = await catalogSyncService.syncCatalog();
  console.log('Re-import matchedCount:', syncResult.importResult.databaseResults.matchedCount);
  console.log('Re-import upsertedCount (must be 0):', syncResult.importResult.databaseResults.upsertedCount);
  console.log('Total catalog records after sync:', syncResult.totalCatalogProducts);

  // Check enriched product PKG_PRD_0004 after re-import
  const enrichedAfter = await Product.findOne({ 'catalog.productId': 'PKG_PRD_0004' }).lean();
  console.log('PKG_PRD_0004 after sync: status =', enrichedAfter?.enrichment?.status, '| calories =', enrichedAfter?.nutrition?.calories, '| barcode =', enrichedAfter?.identity?.barcode);

  const survived = enrichedBefore?.nutrition?.calories === enrichedAfter?.nutrition?.calories &&
                   enrichedBefore?.identity?.barcode === enrichedAfter?.identity?.barcode &&
                   enrichedAfter?.enrichment?.status === 'PARTIALLY_ENRICHED';
  console.log('Enriched fields survived re-import without data loss:', survived);

  console.log('\n====================================================');
  console.log('3. ENRICHMENT VERIFICATION');
  console.log('====================================================');

  console.log('Enrichment worker isRunning status:', productEnrichmentService.isEnrichmentRunning);
  
  // Pending jobs query
  const pendingCount = await Product.countDocuments({ 'catalog.productId': { $exists: true }, 'enrichment.status': 'PENDING' });
  console.log('Pending jobs waiting to be resumed:', pendingCount);

  // Failed jobs query
  const failedCount = await Product.countDocuments({ 'catalog.productId': { $exists: true }, 'enrichment.status': 'FAILED' });
  console.log('Failed jobs waiting for retry:', failedCount);

  // Review jobs query
  const reviewCount = await Product.countDocuments({ 'catalog.productId': { $exists: true }, 'enrichment.status': 'MATCH_REQUIRES_REVIEW' });
  console.log('Jobs held for manual review (ambiguous match):', reviewCount);
  const reviewSample = await Product.findOne({ 'catalog.productId': { $exists: true }, 'enrichment.status': 'MATCH_REQUIRES_REVIEW' }).lean();
  console.log('Review sample evidence:', reviewSample?.catalog?.productId, reviewSample?.enrichment?.matchEvidence);

  // Unmatched query
  const notFoundCount = await Product.countDocuments({ 'catalog.productId': { $exists: true }, 'enrichment.status': 'NOT_FOUND' });
  console.log('Unmatched jobs safely flagged as NOT_FOUND:', notFoundCount);
  const notFoundSample = await Product.findOne({ 'catalog.productId': { $exists: true }, 'enrichment.status': 'NOT_FOUND' }).lean();
  console.log('Unmatched sample has zero fabricated nutrition (calories is null):', notFoundSample?.nutrition?.calories === null);

  // Test retry on a failed job
  if (failedCount > 0) {
    const failedProd = await Product.findOne({ 'catalog.productId': { $exists: true }, 'enrichment.status': 'FAILED' });
    console.log('Attempting retry on failed product:', failedProd.catalog.productId);
    const retryOutcome = await productEnrichmentService.enrichSingleProduct(failedProd);
    console.log('Retry outcome:', retryOutcome);
  }

  console.log('\n====================================================');
  console.log('4. SCORING & REGRESSION VERIFICATION');
  console.log('====================================================');

  console.log('Scoring baseline weights:', scoringConfig.weights);
  const weightsSum = Object.values(scoringConfig.weights).reduce((a, b) => a + b, 0);
  console.log('Weights sum to 1.0 (100%):', Math.abs(weightsSum - 1.0) < 0.001);

  // Verify scoring on enriched catalog product
  const scoreResult = scoringService.calculateSmartChoiceScore(enrichedAfter);
  console.log('SmartChoice score for PKG_PRD_0004:', scoreResult.totalScore, '| Confidence:', scoreResult.confidence);

  // Verify similarity between catalog products
  const anotherProd = await Product.findOne({ 'catalog.productId': 'PKG_PRD_0001' }).lean();
  const simResult = similarityService.calculateSimilarity(enrichedAfter, anotherProd);
  console.log('Similarity between PKG_PRD_0004 and PKG_PRD_0001:', simResult.similarityScore, '| Reasons:', simResult.reasons);

  console.log('\n====================================================');
  console.log('5. SECURITY VERIFICATION');
  console.log('====================================================');

  // Test admin auth middleware logic directly
  const { requireAdminAuth } = require('../middleware/authMiddleware');
  
  let rejectedWithoutKey = false;
  requireAdminAuth({ headers: {} }, {
    status: (code) => ({
      json: (data) => {
        if (code === 401) rejectedWithoutKey = true;
      }
    })
  }, () => {});
  console.log('Admin route rejects request without x-admin-key (401):', rejectedWithoutKey);

  let acceptedWithKey = false;
  requireAdminAuth({ headers: { 'x-admin-key': process.env.ADMIN_API_KEY } }, {}, () => {
    acceptedWithKey = true;
  });
  console.log('Admin route accepts request with valid x-admin-key:', acceptedWithKey);

  await mongoose.disconnect();
  console.log('\nVerification completed successfully.');
}

run().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
