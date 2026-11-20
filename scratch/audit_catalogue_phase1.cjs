const path = require('path');
const fs = require('fs');
const dotenv = require(path.join(__dirname, '../backend/node_modules/dotenv'));
dotenv.config({ path: path.join(__dirname, '../.env') });
const mongoose = require(path.join(__dirname, '../backend/node_modules/mongoose'));
const scoringService = require(path.join(__dirname, '../backend/services/scoringService'));

async function runAudit() {
  console.log('=== PHASE 1: COMPREHENSIVE CATALOGUE AUDIT ===');
  
  // 1. Read Catalog-500 from Disk
  const cat500Path = path.join(__dirname, '../frontend/public/data/enriched_catalog_500.json');
  const cat500Raw = JSON.parse(fs.readFileSync(cat500Path, 'utf8'));
  const cat500Products = [];
  if (cat500Raw.categories && Array.isArray(cat500Raw.categories)) {
    cat500Raw.categories.forEach(cat => {
      (cat.products || []).forEach(p => {
        cat500Products.push({
          ...p,
          category_id: p.category_id || cat.id,
          category_name: p.category_name || cat.name
        });
      });
    });
  }
  console.log(`Loaded ${cat500Products.length} Catalog-500 products from disk.`);

  // 2. Connect to MongoDB and fetch all records
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const Product = require(path.join(__dirname, '../backend/models/Product'));
  const mongoProducts = await Product.find({}).lean();
  console.log(`Loaded ${mongoProducts.length} total products from MongoDB.`);

  // Catalog-500 products in Mongo
  const mongoCat500 = mongoProducts.filter(p => p.catalog?.productId && p.catalog.productId.startsWith('PKG_PRD_'));
  const mongoLegacy = mongoProducts.filter(p => !p.catalog?.productId || !p.catalog.productId.startsWith('PKG_PRD_'));

  console.log(`- Catalog-500 SKUs (PKG_PRD_*) in Mongo: ${mongoCat500.length}`);
  console.log(`- Legacy/Retail SKUs in Mongo: ${mongoLegacy.length}`);

  // Check matching between Disk Catalog-500 and Mongo Catalog-500
  const diskIds = new Set(cat500Products.map(p => p.product_id));
  const mongoIds = new Set(mongoCat500.map(p => p.catalog.productId));

  const missingInMongo = [...diskIds].filter(id => !mongoIds.has(id));
  const unmatchedInDisk = [...mongoIds].filter(id => !diskIds.has(id));

  console.log(`Missing in Mongo: ${missingInMongo.length}`);
  console.log(`Unmatched in Disk: ${unmatchedInDisk.length}`);

  // Check duplicates in Disk and Mongo
  const diskDuplicateCounts = {};
  cat500Products.forEach(p => {
    diskDuplicateCounts[p.product_id] = (diskDuplicateCounts[p.product_id] || 0) + 1;
  });
  const diskDups = Object.entries(diskDuplicateCounts).filter(([k, v]) => v > 1);

  const mongoDuplicateCounts = {};
  mongoProducts.forEach(p => {
    const id = p.catalog?.productId || p.identity?.barcode || p._id.toString();
    mongoDuplicateCounts[id] = (mongoDuplicateCounts[id] || 0) + 1;
  });
  const mongoDups = Object.entries(mongoDuplicateCounts).filter(([k, v]) => v > 1);

  console.log(`Disk duplicate IDs: ${diskDups.length}`);
  console.log(`Mongo duplicate IDs: ${mongoDups.length}`);

  // Field-by-field validation for Catalog-500 products (authoritative dataset)
  let completeNutCount = 0;
  let partialNutCount = 0;
  let noNutCount = 0;
  let missingIngCount = 0;
  let missingAllergenCount = 0;
  let suspiciousNutCount = 0;
  const suspiciousList = [];

  let confDist = {};
  let conf100Count = 0;

  cat500Products.forEach((p, idx) => {
    const p100 = p.nutrition_info?.per_100g || {};
    const nut = p.nutrition || {};

    // 11 Core fields: Energy, Protein, Carbs, Total Sugar, Added Sugar, Total Fat, Saturated Fat, Trans Fat, Fibre, Sodium, Salt
    const energy = p100.energy_kcal ?? nut.calories ?? null;
    const protein = p100.protein_g ?? nut.protein ?? null;
    const carbs = p100.carbohydrates_g ?? nut.carbohydrates ?? null;
    const sugar = p100.total_sugars_g ?? nut.sugar ?? null;
    const addedSugar = p100.added_sugars_g ?? nut.addedSugars ?? null;
    const fat = p100.total_fat_g ?? nut.fat ?? null;
    const satFat = p100.saturated_fat_g ?? nut.saturatedFat ?? null;
    const transFat = p100.trans_fat_g ?? nut.transFat ?? null;
    const fiber = p100.dietary_fiber_g ?? nut.fiber ?? null;
    const sodium = p100.sodium_mg ?? nut.sodium ?? null;
    const salt = (sodium != null) ? (sodium * 2.5) / 1000 : null;

    const core11 = [energy, protein, carbs, sugar, addedSugar, fat, satFat, transFat, fiber, sodium];
    const filled11 = core11.filter(v => v != null && v !== '').length;

    if (filled11 === 10) completeNutCount++;
    else if (filled11 > 0) partialNutCount++;
    else noNutCount++;

    // Ingredients
    const ingText = p.nutrition_info?.ingredients_text || p.ingredients?.rawText || '';
    const ingTokens = p.ingredients?.ingredients || [];
    if (!ingText.trim() && ingTokens.length === 0) missingIngCount++;

    // Allergens
    const allergens = p.nutrition_info?.allergens || p.ingredients?.allergens || [];
    const mayContain = p.nutrition_info?.may_contain || [];
    const allergenDecl = p.ingredients?.allergenDeclarations;
    const hasAllergenInfo = (allergens.length > 0 || mayContain.length > 0 || (allergenDecl && (allergenDecl.contains?.length > 0 || allergenDecl.mayContain?.length > 0)));
    // If ingredients mention allergens but allergens array is empty or vice versa, or if allergen info is empty
    if (!hasAllergenInfo && (!ingText.toLowerCase().includes('contains') && !ingText.toLowerCase().includes('may contain'))) {
      missingAllergenCount++;
    }

    // Suspicious numerical values checks:
    // 1. Protein > 100g, Carbs > 100g, Fat > 100g, Sugar > 100g
    // 2. Sum of Protein + Carbs + Fat > 105g (macro violation)
    // 3. Saturated fat > Total fat + 0.5 (impossible)
    // 4. Sugar > Carbs + 1.0 (impossible)
    // 5. Sodium > 40,000 mg (pure salt is ~39,000 mg/100g)
    // 6. Negative values
    // 7. Energy vs Atwater calculation: 4*P + 4*C + 9*F vs Energy discrepancy > 150 kcal
    // 8. Packaged Juices with sodium >= 100mg (like Tropicana 120mg!)
    const issues = [];
    if (protein != null && (protein < 0 || protein > 100)) issues.push(`Protein invalid (${protein}g)`);
    if (carbs != null && (carbs < 0 || carbs > 100)) issues.push(`Carbs invalid (${carbs}g)`);
    if (fat != null && (fat < 0 || fat > 100)) issues.push(`Fat invalid (${fat}g)`);
    if (sugar != null && (sugar < 0 || sugar > 100)) issues.push(`Sugar invalid (${sugar}g)`);
    if (energy != null && (energy < 0 || energy > 950)) issues.push(`Energy invalid (${energy} kcal)`);
    if (sodium != null && (sodium < 0 || sodium > 40000)) issues.push(`Sodium invalid (${sodium} mg)`);

    if (protein != null && carbs != null && fat != null) {
      const sumMacro = protein + carbs + fat;
      if (sumMacro > 105) issues.push(`Macro sum > 105g (${sumMacro.toFixed(1)}g)`);
    }

    if (satFat != null && fat != null && satFat > fat + 0.5) {
      issues.push(`Sat Fat (${satFat}g) exceeds Total Fat (${fat}g)`);
    }

    if (sugar != null && carbs != null && sugar > carbs + 1.0) {
      issues.push(`Sugar (${sugar}g) exceeds Carbs (${carbs}g)`);
    }

    // Specific category checks:
    // Juices & Drinks with high sodium (e.g. >= 100 mg)
    if (p.category_id === 5 && sodium != null && sodium >= 100) {
      issues.push(`Juice with high sodium (${sodium}mg)`);
    }

    if (issues.length > 0) {
      suspiciousNutCount++;
      suspiciousList.push({
        id: p.product_id,
        name: p.product_name,
        brand: p.brand,
        category: p.category_name,
        issues
      });
    }

    // Confidence Score calculation
    const conf = scoringService.calculateConfidence(p);
    confDist[conf.score] = (confDist[conf.score] || 0) + 1;
    if (conf.score === 100) conf100Count++;
  });

  console.log('\n=== AUDIT RESULTS SUMMARY ===');
  console.log(`1. Total products inspected: ${cat500Products.length}`);
  console.log(`2. Products with complete 10-field nutrition: ${completeNutCount}`);
  console.log(`3. Products with partially missing nutrition: ${partialNutCount}`);
  console.log(`4. Products with no usable nutrition: ${noNutCount}`);
  console.log(`5. Products with missing ingredient lists: ${missingIngCount}`);
  console.log(`6. Products with missing explicit allergen declarations: ${missingAllergenCount}`);
  console.log(`7. Products with invalid or suspicious numerical values: ${suspiciousNutCount}`);
  console.log(`8. Duplicate IDs in disk: ${diskDups.length}, in Mongo: ${mongoDups.length}`);
  console.log(`9. Products with Confidence Score 100: ${conf100Count} (${((conf100Count/cat500Products.length)*100).toFixed(1)}%)`);
  console.log(`10. Confidence Score distribution across catalogue:`, confDist);

  console.log('\n=== SUSPICIOUS PRODUCTS DETAIL (Top 20) ===');
  suspiciousList.slice(0, 20).forEach(s => {
    console.log(`${s.id} [${s.category}] ${s.name} (${s.brand}): ${s.issues.join('; ')}`);
  });

  // Also audit the Legacy products in Mongo
  console.log('\n=== MONGODB LEGACY / RETAIL PRODUCTS AUDIT (524 items) ===');
  let legacyComplete = 0;
  let legacyPartial = 0;
  let legacyNone = 0;
  let legacyConfDist = {};

  mongoLegacy.forEach(p => {
    const nut = p.nutrition || {};
    const core = [nut.calories, nut.protein, nut.carbohydrates, nut.sugar, nut.fat, nut.saturatedFat, nut.sodium, nut.fiber];
    const filled = core.filter(v => v != null).length;
    if (filled === 8) legacyComplete++;
    else if (filled > 0) legacyPartial++;
    else legacyNone++;

    const conf = scoringService.calculateConfidence(p);
    legacyConfDist[conf.score] = (legacyConfDist[conf.score] || 0) + 1;
  });

  console.log(`Legacy Complete: ${legacyComplete}, Partial: ${legacyPartial}, None: ${legacyNone}`);
  console.log(`Legacy Confidence Distribution:`, legacyConfDist);

  await mongoose.disconnect();
}

runAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
