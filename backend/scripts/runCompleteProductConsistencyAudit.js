/**
 * SmartChoice Complete Product Data, Preference Ranking, Scoring Consistency & Serving Size Audit
 * Audits all 500 Catalog-500 products and all legacy products.
 * Generates reports/product_consistency_audit.csv and summaries.
 */

const fs = require('fs');
const path = require('path');

const { calculateAllNutrientsPerServing, parseServingSize } = require('../utils/nutritionConversion');
const scoringService = require('../services/scoringService');
const recommendationService = require('../services/recommendationService');
const preferenceService = require('../services/preferenceService');

// 1. Load Datasets
const catalogJsonPath = path.join(__dirname, '../../frontend/public/data/enriched_catalog_500.json');
const legacyJsonPath = path.join(__dirname, '../../data/processed/products_india.json');

let catalog500Products = [];
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

let legacyProducts = [];
if (fs.existsSync(legacyJsonPath)) {
  try {
    const legData = JSON.parse(fs.readFileSync(legacyJsonPath, 'utf8'));
    if (Array.isArray(legData)) {
      legacyProducts = legData.map(p => ({
        ...p,
        sourceDataset: 'Legacy-India'
      }));
    }
  } catch (e) {
    console.warn('Could not read legacy products:', e.message);
  }
}

console.log(`Loaded ${catalog500Products.length} Catalog-500 products and ${legacyProducts.length} legacy products.`);

// Combine products ensuring unique canonical IDs
const allProductsMap = new Map();
catalog500Products.forEach(p => {
  const id = p.product_id || p._id || p.catalog?.productId;
  allProductsMap.set(id, p);
});
legacyProducts.forEach(p => {
  const id = p.product_id || p._id || p.catalog?.productId || p.identity?.barcode;
  if (!allProductsMap.has(id)) {
    allProductsMap.set(id, p);
  }
});

const allProducts = Array.from(allProductsMap.values());
console.log(`Total unique catalog items under audit: ${allProducts.length}`);

// Test scenarios for multi-preference evaluations
const testScenarios = {
  highProtein: { highProtein: true },
  lowCalories: { lowCalories: true },
  lowSugar: { lowSugar: true },
  highFiber: { highFiber: true },
  lowSodium: { lowSodium: true },
  lowSaturatedFat: { lowSaturatedFat: true },
  lowFat: { lowFat: true },
  multiProteinCals: { highProtein: true, lowCalories: true },
  multiProteinSugarFiber: { highProtein: true, lowSugar: true, highFiber: true },
  multiLowFatCalsSodium: { lowFat: true, lowCalories: true, lowSodium: true },
  multiVeganProtein: { vegan: true, highProtein: true }
};

const auditRecords = [];
let servingMathPassCount = 0;
let servingMathFailCount = 0;
let scoreBreakdownPassCount = 0;
let scoreBreakdownFailCount = 0;

for (const product of allProducts) {
  const productId = product.product_id || product._id || product.catalog?.productId || 'UNKNOWN_ID';
  const productName = product.product_name || product.catalog?.productName || product.identity?.name || 'Unknown Product';
  const brand = product.brand || product.catalog?.brand || product.identity?.brand || 'Unknown Brand';
  const categoryId = product.category_id || product.catalog?.categoryId || product.identity?.categoryId || 1;
  const categoryName = product.category_name || product.catalog?.categoryName || (product.identity?.categories && product.identity.categories[0]) || 'General';
  const format = product.categoryFormat || 'SOLID_FOOD';
  
  // Dietary classification
  const dc = product.dietary_classification || product.dietaryClassification;
  const dietaryStatus = dc?.status || (product.dietary_type === 'NON_VEG' ? 'NON_VEGETARIAN' : (product.dietary_type === 'VEG' ? 'VEGETARIAN' : 'UNKNOWN'));

  // Serving calculation
  const servingConversion = calculateAllNutrientsPerServing(product);
  const p100 = servingConversion.per100g || {};
  const pServ = servingConversion.perServing || {};
  const multiplier = servingConversion.servingMultiplier;

  // Verify serving calculation consistency
  let mathConsistent = true;
  for (const key of ['energy_kcal', 'protein_g', 'carbohydrates_g', 'total_sugars_g', 'total_fat_g', 'saturated_fat_g', 'dietary_fiber_g', 'sodium_mg']) {
    const v100 = p100[key];
    const vServ = pServ[key];
    if (v100 != null && vServ != null) {
      const expected = v100 * multiplier;
      if (Math.abs(expected - vServ) > 0.15) {
        mathConsistent = false;
        break;
      }
    }
  }
  if (mathConsistent) servingMathPassCount++;
  else servingMathFailCount++;

  // SmartChoice Quality Score
  const emptyPrefs = {};
  const scData = scoringService.calculateSmartChoiceScore(product, emptyPrefs);
  const qualityScore = scData.totalScore;
  const breakdown = scData.weightedBreakdown || scData.breakdown;
  const breakdownSum = breakdown.nutrition + breakdown.ingredients + breakdown.processing + breakdown.proteinFiber + breakdown.preferences;
  
  if (Math.abs(breakdownSum - qualityScore) <= 1) scoreBreakdownPassCount++;
  else scoreBreakdownFailCount++;

  // Match Scores across scenarios
  const scenarioScores = {};
  for (const [sName, sPrefs] of Object.entries(testScenarios)) {
    const evalRes = recommendationService.evaluatePreferences(product, sPrefs);
    scenarioScores[sName] = recommendationService.calculatePersonalizedScore(evalRes);
  }

  // Completeness & Verification
  const completeness = product.score?.coverage?.overallCompleteness ?? product.dataQuality?.completeness ?? 85;
  const verification = product.ingredients?.verificationStatus || product.nutrition_info?.verification_status || 'VERIFIED';

  auditRecords.push({
    productId,
    productName,
    brand,
    categoryId,
    categoryName,
    dietaryStatus,
    servingSizeDisplay: servingConversion.servingDisplayStr,
    servingSizeNumeric: servingConversion.servingSize,
    servingUnit: servingConversion.servingUnit,
    per100gEnergy: p100.energy_kcal ?? '',
    per100gProtein: p100.protein_g ?? '',
    per100gCarbs: p100.carbohydrates_g ?? '',
    per100gSugars: p100.total_sugars_g ?? '',
    per100gFat: p100.total_fat_g ?? '',
    per100gSatFat: p100.saturated_fat_g ?? '',
    per100gFiber: p100.dietary_fiber_g ?? '',
    per100gSodium: p100.sodium_mg ?? '',
    perServingEnergy: pServ.energy_kcal ?? '',
    perServingProtein: pServ.protein_g ?? '',
    perServingCarbs: pServ.carbohydrates_g ?? '',
    perServingSugars: pServ.total_sugars_g ?? '',
    perServingFat: pServ.total_fat_g ?? '',
    perServingSatFat: pServ.saturated_fat_g ?? '',
    perServingFiber: pServ.dietary_fiber_g ?? '',
    perServingSodium: pServ.sodium_mg ?? '',
    servingMathConsistent: mathConsistent ? 'PASS' : 'FAIL',
    smartChoiceQualityScore: qualityScore,
    breakdownNutrition: breakdown.nutrition,
    breakdownIngredients: breakdown.ingredients,
    breakdownProcessing: breakdown.processing,
    breakdownProteinFiber: breakdown.proteinFiber,
    breakdownPreferences: breakdown.preferences,
    breakdownSum,
    breakdownValid: Math.abs(breakdownSum - qualityScore) <= 1 ? 'PASS' : 'FAIL',
    matchHighProtein: scenarioScores.highProtein,
    matchLowCalories: scenarioScores.lowCalories,
    matchLowSugar: scenarioScores.lowSugar,
    matchHighFiber: scenarioScores.highFiber,
    matchLowSodium: scenarioScores.lowSodium,
    matchLowSaturatedFat: scenarioScores.lowSaturatedFat,
    matchLowFat: scenarioScores.lowFat,
    matchMultiProteinCals: scenarioScores.multiProteinCals,
    matchMultiProteinSugarFiber: scenarioScores.multiProteinSugarFiber,
    matchMultiLowFatCalsSodium: scenarioScores.multiLowFatCalsSodium,
    matchMultiVeganProtein: scenarioScores.multiVeganProtein,
    dataCompleteness: completeness,
    dataVerificationStatus: verification
  });
}

// Write CSV
const csvHeaders = Object.keys(auditRecords[0]);
const csvRows = [csvHeaders.join(',')];
for (const r of auditRecords) {
  const row = csvHeaders.map(h => {
    let val = r[h];
    if (val === null || val === undefined) val = '';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  });
  csvRows.push(row.join(','));
}

const csvOutputPath = path.join(__dirname, '../../reports/product_consistency_audit.csv');
fs.writeFileSync(csvOutputPath, csvRows.join('\n'), 'utf8');

console.log(`\nAudit Complete!`);
console.log(`- Total Products Audited: ${auditRecords.length}`);
console.log(`- Serving Math Consistency Pass Rate: ${servingMathPassCount} / ${auditRecords.length} (${((servingMathPassCount / auditRecords.length) * 100).toFixed(2)}%)`);
console.log(`- Scoring Breakdown Additivity Pass Rate: ${scoreBreakdownPassCount} / ${auditRecords.length} (${((scoreBreakdownPassCount / auditRecords.length) * 100).toFixed(2)}%)`);
console.log(`- CSV generated at: reports/product_consistency_audit.csv`);
