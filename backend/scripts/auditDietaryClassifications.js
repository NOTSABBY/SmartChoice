const fs = require('fs');
const path = require('path');
const { classifyProductDietary } = require('../utils/dietaryClassifier');

function runAudit() {
  console.log('=== STARTING SMARTCHOICE AUTHORITATIVE DIETARY AUDIT ===');

  const catalog500Path = path.join(__dirname, '../../frontend/public/data/enriched_catalog_500.json');
  const legacyPath = path.join(__dirname, '../../data/processed/products_india.json');

  if (!fs.existsSync(catalog500Path)) {
    console.error('Catalog 500 file not found at:', catalog500Path);
    process.exit(1);
  }

  const catalog500Raw = JSON.parse(fs.readFileSync(catalog500Path, 'utf8'));
  let legacyRaw = [];
  if (fs.existsSync(legacyPath)) {
    try {
      legacyRaw = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
    } catch (e) {
      console.warn('Could not read legacy products:', e.message);
    }
  }

  const auditRows = [];
  let totalAudited = 0;
  let countVegan = 0;
  let countVeg = 0;
  let countNonVeg = 0;
  let countUnknown = 0;
  let countChanged = 0;

  // 1. Audit Catalog-500 products
  catalog500Raw.categories.forEach(cat => {
    (cat.products || []).forEach(p => {
      totalAudited++;
      const prevStatus = p.dietary_classification?.status || (p.dietary_type === 'NON_VEG' ? 'NON_VEGETARIAN' : (p.dietary_type === 'VEG' ? 'VEGETARIAN' : 'UNKNOWN'));
      const classification = classifyProductDietary(p);

      // Attach authoritative classification to product
      p.dietary_classification = classification;
      p.dietary_type = classification.status === 'NON_VEGETARIAN' ? 'NON_VEG' : (classification.status === 'VEGAN' || classification.status === 'VEGETARIAN' ? 'VEG' : 'UNKNOWN');

      if (classification.status === 'VEGAN') countVegan++;
      else if (classification.status === 'VEGETARIAN') countVeg++;
      else if (classification.status === 'NON_VEGETARIAN') countNonVeg++;
      else countUnknown++;

      const isChanged = prevStatus !== classification.status;
      if (isChanged) countChanged++;

      const ingText = String(p.nutrition_info?.ingredients_text || p.ingredients?.rawIngredientsText || p.ingredients?.rawText || '').replace(/[\r\n,;]+/g, ' ').trim();
      const normIng = Array.isArray(p.ingredients?.ingredients) ? p.ingredients.ingredients.map(i => typeof i === 'string' ? i : (i.name || i.raw || '')).filter(Boolean).join('; ') : ingText;

      auditRows.push({
        productId: p.product_id,
        productName: p.product_name,
        brand: p.brand,
        category: cat.name,
        originalIngredients: ingText.slice(0, 200),
        normalizedIngredients: normIng.slice(0, 200),
        previousClassification: prevStatus,
        dietaryClassification: classification.status,
        classificationChanged: isChanged ? 'YES' : 'NO',
        classificationReason: classification.reason,
        supportingEvidence: classification.supportingEvidence,
        verificationStatus: classification.verificationStatus,
        sourceReference: classification.source,
        verificationDate: classification.lastVerifiedAt
      });
    });
  });

  // Save updated Catalog-500 back to disk with authoritative classifications
  fs.writeFileSync(catalog500Path, JSON.stringify(catalog500Raw, null, 2), 'utf8');
  console.log('Saved enriched_catalog_500.json with authoritative dietary classifications.');

  // 2. Audit Legacy products
  let legacyVegan = 0;
  let legacyVeg = 0;
  let legacyNonVeg = 0;
  let legacyUnknown = 0;

  legacyRaw.forEach(p => {
    const canonicalId = p._id || p.catalog?.productId || p.identity?.barcode;
    const prevStatus = p.dietaryClassification?.status || p.identity?.dietaryType || p.dietary_type || 'UNKNOWN';
    const classification = classifyProductDietary(p);

    if (classification.status === 'VEGAN') legacyVegan++;
    else if (classification.status === 'VEGETARIAN') legacyVeg++;
    else if (classification.status === 'NON_VEGETARIAN') legacyNonVeg++;
    else legacyUnknown++;

    const isChanged = prevStatus !== classification.status;
    const ingTokens = Array.isArray(p.ingredients?.ingredients) ? p.ingredients.ingredients.join('; ') : '';

    auditRows.push({
      productId: canonicalId,
      productName: p.identity?.name || p.name || 'Legacy Food Product',
      brand: p.identity?.brand || p.brand || 'Authentic Brand',
      category: Array.isArray(p.identity?.categories) ? p.identity.categories[0] : 'Preserved Catalog',
      originalIngredients: ingTokens.slice(0, 200),
      normalizedIngredients: ingTokens.slice(0, 200),
      previousClassification: prevStatus,
      dietaryClassification: classification.status,
      classificationChanged: isChanged ? 'YES' : 'NO',
      classificationReason: classification.reason,
      supportingEvidence: classification.supportingEvidence,
      verificationStatus: classification.verificationStatus,
      sourceReference: classification.source,
      verificationDate: classification.lastVerifiedAt
    });
  });

  // 3. Write CSV Report
  const reportsDir = path.join(__dirname, '../../reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const csvPath = path.join(reportsDir, 'dietary_classification_audit.csv');
  const headers = [
    'Product ID',
    'Product Name',
    'Brand',
    'Category',
    'Original Ingredient List',
    'Normalized Ingredient List',
    'Previous Classification',
    'Dietary Classification',
    'Classification Changed',
    'Classification Reason',
    'Supporting Evidence',
    'Verification Status',
    'Source Reference',
    'Verification Date'
  ];

  const escapeCsv = (val) => {
    const str = String(val || '').replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvContent = [
    headers.join(','),
    ...auditRows.map(r => [
      escapeCsv(r.productId),
      escapeCsv(r.productName),
      escapeCsv(r.brand),
      escapeCsv(r.category),
      escapeCsv(r.originalIngredients),
      escapeCsv(r.normalizedIngredients),
      escapeCsv(r.previousClassification),
      escapeCsv(r.dietaryClassification),
      escapeCsv(r.classificationChanged),
      escapeCsv(r.classificationReason),
      escapeCsv(r.supportingEvidence),
      escapeCsv(r.verificationStatus),
      escapeCsv(r.sourceReference),
      escapeCsv(r.verificationDate)
    ].join(','))
  ].join('\n');

  fs.writeFileSync(csvPath, csvContent, 'utf8');
  console.log(`Saved audit CSV to ${csvPath}`);

  console.log('\n=== AUDIT SUMMARY ===');
  console.log(`Total Catalog-500 Audited: ${totalAudited}`);
  console.log(`  - Vegan: ${countVegan}`);
  console.log(`  - Vegetarian: ${countVeg}`);
  console.log(`  - Non-Vegetarian: ${countNonVeg}`);
  console.log(`  - Unknown: ${countUnknown}`);
  console.log(`  - Classifications Updated/Corrected: ${countChanged}`);
  console.log(`Legacy Products Audited: ${legacyRaw.length}`);
  console.log(`  - Legacy Vegan: ${legacyVegan}`);
  console.log(`  - Legacy Vegetarian: ${legacyVeg}`);
  console.log(`  - Legacy Non-Vegetarian: ${legacyNonVeg}`);
  console.log(`  - Legacy Unknown (Incomplete Ingredients): ${legacyUnknown}`);
}

runAudit();
