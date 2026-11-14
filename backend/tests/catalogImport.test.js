require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const assert = require('assert');
const catalogValidationService = require('../services/catalogValidationService');
const catalogNormalizationService = require('../services/catalogNormalizationService');
const catalogImportService = require('../services/catalogImportService');

async function runTests() {
  console.log('=== TEST SUITE 1: CATALOG IMPORT & VALIDATION ===\n');
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

  // 1. Workbook Structure Validation
  await test('Validates expected worksheet name exists', () => {
    const validWb = { SheetNames: ['Products Catalog', 'Sheet2'] };
    const res = catalogValidationService.validateWorkbookStructure(validWb);
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.sheetName, 'Products Catalog');
  });

  await test('Rejects workbook missing Products Catalog sheet', () => {
    const invalidWb = { SheetNames: ['Sheet1', 'Sheet2'] };
    const res = catalogValidationService.validateWorkbookStructure(invalidWb);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors[0].includes('Missing expected worksheet'));
  });

  // 2. Header Validation
  await test('Validates all 7 required headers', () => {
    const validHeaders = [
      'Product ID',
      'Category ID',
      'Category Name',
      'Brand',
      'Product Name',
      'Packaging Size',
      'Open Food Facts Query Term'
    ];
    const res = catalogValidationService.validateHeaders(validHeaders);
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.missingHeaders.length, 0);
  });

  await test('Flags missing headers', () => {
    const incompleteHeaders = ['Product ID', 'Category ID', 'Brand'];
    const res = catalogValidationService.validateHeaders(incompleteHeaders);
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.missingHeaders.length, 4);
    assert.ok(res.missingHeaders.includes('Product Name'));
  });

  // 3. Record Validation
  await test('Detects missing Product ID and Brand in rows', () => {
    const sampleRows = [
      {
        'Product ID': '',
        'Category ID': 1,
        'Category Name': 'Biscuits',
        'Brand': '',
        'Product Name': 'Test Cookie',
        'Packaging Size': '50g',
        'Open Food Facts Query Term': 'Test Cookie'
      }
    ];
    const res = catalogValidationService.validateRecords(sampleRows);
    assert.strictEqual(res.invalidRecordsCount, 1);
    assert.strictEqual(res.validRecordsCount, 0);
    assert.strictEqual(res.missingFieldCounts.productId, 1);
    assert.strictEqual(res.missingFieldCounts.brand, 1);
  });

  await test('Detects duplicate Product IDs', () => {
    const sampleRows = [
      {
        'Product ID': 'PKG_PRD_0001',
        'Category ID': 1,
        'Category Name': 'Biscuits',
        'Brand': 'Brand A',
        'Product Name': 'Cookie 1',
        'Packaging Size': '50g',
        'Open Food Facts Query Term': 'Cookie 1'
      },
      {
        'Product ID': 'PKG_PRD_0001', // duplicate
        'Category ID': 1,
        'Category Name': 'Biscuits',
        'Brand': 'Brand B',
        'Product Name': 'Cookie 2',
        'Packaging Size': '50g',
        'Open Food Facts Query Term': 'Cookie 2'
      }
    ];
    const res = catalogValidationService.validateRecords(sampleRows);
    assert.strictEqual(res.invalidRecordsCount, 1);
    assert.strictEqual(res.duplicateProductIds.length, 1);
    assert.strictEqual(res.duplicateProductIds[0], 'PKG_PRD_0001');
  });

  await test('Rejects invalid Category ID outside 1-25 range', () => {
    const sampleRows = [
      {
        'Product ID': 'PKG_PRD_0099',
        'Category ID': 99, // invalid
        'Category Name': 'Exotic',
        'Brand': 'Brand',
        'Product Name': 'Item',
        'Packaging Size': '50g',
        'Open Food Facts Query Term': 'Item'
      }
    ];
    const res = catalogValidationService.validateRecords(sampleRows);
    assert.strictEqual(res.invalidRecordsCount, 1);
    assert.ok(res.invalidRecords[0].errors.some(e => e.includes('Invalid Category ID')));
  });

  // 4. Normalization Validation
  await test('Normalizes strings and parses serving size cleanly', () => {
    const rawRow = {
      'Product ID': '  PKG_PRD_0010  ',
      'Category ID': 1,
      'Category Name': '  Packaged  Biscuits  ',
      'Brand': '  Parle  ',
      'Product Name': ' Parle-G   Gold ',
      'Packaging Size': ' 15 g ',
      'Open Food Facts Query Term': 'Parle-G Gold'
    };
    const normalized = catalogNormalizationService.normalizeRecord(rawRow);
    assert.strictEqual(normalized.catalog.productId, 'PKG_PRD_0010');
    assert.strictEqual(normalized.catalog.brand, 'Parle');
    assert.strictEqual(normalized.catalog.productName, 'Parle-G Gold');
    assert.strictEqual(normalized.serving.servingSize, '15');
    assert.strictEqual(normalized.serving.servingSizeUnit, 'g');
    assert.strictEqual(normalized.nutrition.calories, null); // Zero fabrication check
    assert.strictEqual(normalized.ingredients.ingredients.length, 0); // Zero fabrication check
  });

  // 5. Full Workbook Validation against the actual file
  await test('Successfully validates the actual authentic_packaged_food_catalog_500.xlsx workbook', async () => {
    const res = await catalogImportService.validateWorkbook();
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.totalRowsExtracted, 500);
    assert.strictEqual(res.validRecordsCount, 500);
    assert.strictEqual(res.invalidRecordsCount, 0);
  });

  console.log(`\nImport Tests Summary: ${passed}/${total} passed.\n`);
  if (passed !== total) process.exit(1);
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
