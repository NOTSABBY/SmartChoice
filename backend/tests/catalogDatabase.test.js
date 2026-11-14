require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const assert = require('assert');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const catalogImportService = require('../services/catalogImportService');
const catalogSyncService = require('../services/catalogSyncService');

async function runTests() {
  console.log('=== TEST SUITE 2: DATABASE MIGRATION & IDEMPOTENCY ===\n');
  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}: ${err.message}`);
    }
  }

  // Connect to DB
  await mongoose.connect(process.env.MONGODB_URI);

  try {
    // 1. Connection check
    await test('Mongoose is successfully connected to MongoDB Atlas', () => {
      assert.strictEqual(mongoose.connection.readyState, 1);
    });

    // 2. 500 catalog records exist
    await test('Database holds exactly 500 catalog products', async () => {
      const count = await Product.countDocuments({ 'catalog.productId': { $exists: true } });
      assert.strictEqual(count, 500);
    });

    // 3. Category distribution (all 25 categories have 20 products)
    await test('All 25 categories have exactly 20 catalog records', async () => {
      const categories = await Product.aggregate([
        { $match: { 'catalog.productId': { $exists: true } } },
        { $group: { _id: '$catalog.categoryName', count: { $sum: 1 } } }
      ]);
      assert.strictEqual(categories.length, 25);
      for (const cat of categories) {
        assert.strictEqual(cat.count, 20, `Category ${cat._id} has count ${cat.count} instead of 20`);
      }
    });

    // 4. Unique Partial Index on catalog.productId
    await test('Enforces uniqueness on catalog.productId', async () => {
      const duplicateDoc = new Product({
        catalog: {
          productId: 'PKG_PRD_0001', // already exists
          categoryId: 1,
          categoryName: 'Biscuits',
          brand: 'Duplicate Brand',
          productName: 'Duplicate Item'
        },
        identity: {
          name: 'Duplicate Item'
        }
      });

      let threw = false;
      try {
        await duplicateDoc.save();
      } catch (err) {
        threw = true;
        assert.ok(err.code === 11000 || err.message.includes('E11000'));
      }
      assert.strictEqual(threw, true, 'Expected duplicate key error E11000 on catalog.productId');
    });

    // 5. Backward compatibility: Record without catalog fields can be created
    await test('Supports legacy retail product without catalog fields', async () => {
      const legacyBarcode = `LEGACY_TEST_${Date.now()}`;
      const legacyDoc = new Product({
        identity: {
          barcode: legacyBarcode,
          name: 'Legacy Test Product',
          brand: 'Legacy Brand',
          categories: ['Snacks']
        },
        nutrition: {
          calories: 150,
          protein: 5
        }
      });

      const saved = await legacyDoc.save();
      assert.ok(saved._id);
      assert.strictEqual(saved.catalog.productId, undefined);

      // Clean up legacy test record
      await Product.deleteOne({ _id: saved._id });
    });

    // 6. Idempotency on Sync / Re-import
    await test('Re-import is idempotent and does not create duplicate products', async () => {
      const syncResult = await catalogSyncService.syncCatalog();
      assert.strictEqual(syncResult.success, true);
      assert.strictEqual(syncResult.totalCatalogProducts, 500);
      assert.strictEqual(syncResult.importResult.databaseResults.upsertedCount, 0);
    });

    // 7. Enriched fields preservation
    await test('Preserves enriched fields when catalog is re-imported', async () => {
      // Find one enriched product
      const enriched = await Product.findOne({
        'catalog.productId': 'PKG_PRD_0004'
      });
      assert.ok(enriched);
      assert.strictEqual(enriched.enrichment.status, 'PARTIALLY_ENRICHED');
      assert.ok(enriched.nutrition.calories > 0);

      // Re-import
      await catalogImportService.importCatalog();

      // Check that enriched fields remain intact
      const after = await Product.findOne({ 'catalog.productId': 'PKG_PRD_0004' });
      assert.strictEqual(after.enrichment.status, 'PARTIALLY_ENRICHED');
      assert.strictEqual(after.nutrition.calories, enriched.nutrition.calories);
      assert.strictEqual(after.identity.barcode, enriched.identity.barcode);
    });

    console.log(`\nDatabase Tests Summary: ${passed}/${total} passed.\n`);
    if (passed !== total) process.exit(1);

  } finally {
    await mongoose.disconnect();
  }
}

runTests().catch(err => {
  console.error('Database test suite error:', err);
  process.exit(1);
});
