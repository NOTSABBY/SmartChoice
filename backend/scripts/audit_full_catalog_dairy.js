const fs = require('fs');
const path = require('path');
const { classifyProductDairy } = require('../services/dairyClassificationService');

const catPath = path.join(__dirname, '../../frontend/public/data/enriched_catalog_500.json');
const catalog = JSON.parse(fs.readFileSync(catPath, 'utf8'));

const counts = {
  DAIRY_CONTAINS: 0,
  DAIRY_FREE_VERIFIED: 0,
  DAIRY_MAY_CONTAIN: 0,
  DAIRY_UNKNOWN: 0,
  DAIRY_CONFLICTING_EVIDENCE: 0
};

const perCategory = {};
const productClassifications = [];

catalog.categories.forEach(cat => {
  const catKey = `Cat ${cat.category_id}: ${cat.category_name}`;
  perCategory[catKey] = {
    total: 0,
    DAIRY_CONTAINS: 0,
    DAIRY_FREE_VERIFIED: 0,
    DAIRY_MAY_CONTAIN: 0,
    DAIRY_UNKNOWN: 0,
    DAIRY_CONFLICTING_EVIDENCE: 0
  };

  cat.products.forEach(p => {
    const res = classifyProductDairy(p);
    counts[res.classification]++;
    perCategory[catKey][res.classification]++;
    perCategory[catKey].total++;

    productClassifications.push({
      product_id: p.product_id,
      name: p.product_name,
      category_id: cat.category_id,
      category_name: cat.category_name,
      classification: res.classification,
      isDairyFree: res.isDairyFree,
      confidence: res.confidence,
      reason: res.reason,
      evidence: res.evidence.map(e => `${e.type}:${e.matchedTerm}`).join('; ')
    });
  });
});

console.log('=== OVERALL CATALOG-500 DAIRY AUDIT DISTRIBUTION ===');
console.log(JSON.stringify(counts, null, 2));

console.log('\n=== PER-CATEGORY BREAKDOWN ===');
Object.keys(perCategory).forEach(k => {
  const c = perCategory[k];
  console.log(`${k} -> CONTAINS: ${c.DAIRY_CONTAINS}, FREE_VERIFIED: ${c.DAIRY_FREE_VERIFIED}, MAY_CONTAIN: ${c.DAIRY_MAY_CONTAIN}, UNKNOWN: ${c.DAIRY_UNKNOWN}, CONFLICT: ${c.DAIRY_CONFLICTING_EVIDENCE}`);
});

// Write to CSV report
const csvRows = [
  'ProductID,ProductName,CategoryID,CategoryName,Classification,IsDairyFree,Confidence,Reason,Evidence'
];

productClassifications.forEach(row => {
  const cleanReason = (row.reason || '').replace(/"/g, '""');
  const cleanEvidence = (row.evidence || '').replace(/"/g, '""');
  const cleanName = (row.name || '').replace(/"/g, '""');
  csvRows.push(`"${row.product_id}","${cleanName}",${row.category_id},"${row.category_name}","${row.classification}",${row.isDairyFree},${row.confidence},"${cleanReason}","${cleanEvidence}"`);
});

fs.writeFileSync(path.join(__dirname, '../../reports/catalog_500_dairy_classification_audit.csv'), csvRows.join('\n'), 'utf8');
console.log('\nWrote reports/catalog_500_dairy_classification_audit.csv');
