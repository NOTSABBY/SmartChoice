/**
 * SmartChoice Product Verification Status Audit Script
 * Audits all 1,024 products (500 Catalog-500 + 524 Legacy)
 * Outputs reports/product_verification_status_audit.csv
 */

const fs = require('fs');
const path = require('path');
const { calculateProductVerification } = require('../utils/productVerification');

const catalogJsonPath = path.join(__dirname, '../../frontend/public/data/enriched_catalog_500.json');
const legacyJsonPath = path.join(__dirname, '../../data/processed/products_india.json');
const backupJsonPath = path.join(__dirname, '../../data/backups/products_before_india_replacement_1791283450259.json');

const catalog500Products = [];
if (fs.existsSync(catalogJsonPath)) {
  const catData = JSON.parse(fs.readFileSync(catalogJsonPath, 'utf8'));
  (catData.categories || []).forEach(cat => {
    (cat.products || []).forEach(p => {
      catalog500Products.push({
        ...p,
        sourceDataset: 'Catalog-500'
      });
    });
  });
}

const legacyProducts = [];
const seenLegacyIds = new Set();

if (fs.existsSync(legacyJsonPath)) {
  try {
    const legData = JSON.parse(fs.readFileSync(legacyJsonPath, 'utf8'));
    if (Array.isArray(legData)) {
      legData.forEach(p => {
        const id = p.product_id || p._id || p.catalog?.productId || p.identity?.barcode;
        if (id && !seenLegacyIds.has(id)) {
          seenLegacyIds.add(id);
          legacyProducts.push({
            ...p,
            sourceDataset: 'Legacy'
          });
        }
      });
    }
  } catch (e) {
    console.warn('Could not read legacy products:', e.message);
  }
}

if (legacyProducts.length < 524 && fs.existsSync(backupJsonPath)) {
  try {
    const backupData = JSON.parse(fs.readFileSync(backupJsonPath, 'utf8'));
    if (Array.isArray(backupData)) {
      for (const p of backupData) {
        if (legacyProducts.length >= 524) break;
        const id = p.product_id || p._id || p.catalog?.productId || p.identity?.barcode;
        if (id && !seenLegacyIds.has(id)) {
          seenLegacyIds.add(id);
          legacyProducts.push({
            ...p,
            sourceDataset: 'Legacy'
          });
        }
      }
    }
  } catch (e) {
    console.warn('Could not read backup legacy products:', e.message);
  }
}

const allProducts = [...catalog500Products, ...legacyProducts];
console.log(`Auditing verification status for ${allProducts.length} total products...`);

const records = [];
const statusCounts = { 'Verified': 0, 'Partially Verified': 0, 'Unverified': 0, 'Needs Review': 0 };

for (let i = 0; i < allProducts.length; i++) {
  const p = allProducts[i];
  const productId = p.product_id || p._id || p.catalog?.productId || p.identity?.barcode || `PROD_${i + 1}`;
  const productName = p.product_name || p.catalog?.productName || p.identity?.name || 'Unknown Product';
  const brand = p.brand || p.catalog?.brand || p.identity?.brand || 'Unknown Brand';
  const categoryId = p.category_id || p.catalog?.categoryId || p.identity?.categoryId || 1;
  const categoryName = p.category_name || p.catalog?.categoryName || (p.identity?.categories && p.identity.categories[0]) || 'General';
  const datasetSource = p.sourceDataset || 'Unknown';

  const ver = calculateProductVerification(p);
  statusCounts[ver.status] = (statusCounts[ver.status] || 0) + 1;

  records.push({
    productId,
    productName,
    brand,
    categoryId,
    categoryName,
    datasetSource,
    verificationStatus: ver.status,
    verificationLevel: ver.level,
    verificationPercentage: ver.percentage,
    nutritionVerified: ver.breakdown.nutrition ? 'YES' : 'NO',
    ingredientsVerified: ver.breakdown.ingredients ? 'YES' : 'NO',
    processingVerified: ver.breakdown.processing ? 'YES' : 'NO',
    dietaryVerified: ver.breakdown.dietary ? 'YES' : 'NO',
    conflictCount: ver.conflicts.length,
    conflicts: ver.conflicts.join(' | ') || 'NONE',
    reason: ver.reason
  });
}

// Write to CSV
const csvHeaders = Object.keys(records[0]);
const csvRows = [csvHeaders.join(',')];
for (const r of records) {
  const row = csvHeaders.map(h => {
    let val = r[h];
    if (val === null || val === undefined) val = '';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  });
  csvRows.push(row.join(','));
}

const csvOutputPath = path.join(__dirname, '../../reports/product_verification_status_audit.csv');
fs.writeFileSync(csvOutputPath, csvRows.join('\n'), 'utf8');

console.log('\n======================================================');
console.log('PRODUCT VERIFICATION AUDIT SUMMARY (1,024 PRODUCTS):');
console.log(`Total Products Audited: ${records.length}`);
console.log(`- Verified:           ${statusCounts['Verified']} (${((statusCounts['Verified'] / records.length) * 100).toFixed(2)}%)`);
console.log(`- Partially Verified: ${statusCounts['Partially Verified']} (${((statusCounts['Partially Verified'] / records.length) * 100).toFixed(2)}%)`);
console.log(`- Unverified:         ${statusCounts['Unverified']} (${((statusCounts['Unverified'] / records.length) * 100).toFixed(2)}%)`);
console.log(`- Needs Review:       ${statusCounts['Needs Review']} (${((statusCounts['Needs Review'] / records.length) * 100).toFixed(2)}%)`);
console.log(`Output generated at: reports/product_verification_status_audit.csv`);
console.log('======================================================');
