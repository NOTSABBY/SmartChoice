const fs = require('fs');
const path = require('path');
const catalogLoader = require('../utils/catalogLoader');
const scoringService = require('../services/scoringService');

// Authoritative Catalog-wide Product Scoring Audit
function runCatalogueAudit() {
  console.log('======================================================================');
  console.log('   SMARTCHOICE CATALOGUE-WIDE PRODUCT SCORING AUDIT (PHASE 5)        ');
  console.log('======================================================================\n');

  // Load populations
  const cat500Raw = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../frontend/public/data/enriched_catalog_500.json'), 'utf8')
  );
  const cat500Products = cat500Raw.categories ? cat500Raw.categories.flatMap(c => c.products) : (cat500Raw.products || []);

  const legacyProducts = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../data/processed/products_india.json'), 'utf8')
  );

  console.log(`Auditing Populations:`);
  console.log(`  1. Catalog-500:          ${cat500Products.length} SKUs`);
  console.log(`  2. Legacy Retail India:   ${legacyProducts.length} SKUs`);
  console.log(`  Total Active Inventory:   ${cat500Products.length + legacyProducts.length} SKUs\n`);

  const results = {
    cat500: { PASS: 0, FAIL: 0, INCOMPLETE: 0, INVALID: 0, details: [] },
    legacy: { PASS: 0, FAIL: 0, INCOMPLETE: 0, INVALID: 0, details: [] },
    totalAdditivityErrors: 0,
    discrepancies: []
  };

  function auditProduct(product, populationKey) {
    const id = product.product_id || product.id || product._id || 'UNKNOWN';
    const name = product.product_name || product.identity?.name || product.name || 'Unnamed';
    
    // Evaluate backend score
    const res = scoringService.calculateSmartChoiceScore(product, {});
    const wb = res.weightedBreakdown;
    const sumComponents = wb.nutrition + wb.ingredients + wb.processing + wb.proteinFiber + wb.preferences;

    // Check exact additivity
    const isAdditive = res.totalScore === sumComponents;
    if (!isAdditive) {
      results.totalAdditivityErrors++;
      results.discrepancies.push({
        id,
        name,
        total: res.totalScore,
        sum: sumComponents,
        breakdown: wb
      });
      results[populationKey].FAIL++;
      return;
    }

    // Check boundary
    if (res.totalScore < 0 || res.totalScore > 100) {
      results[populationKey].FAIL++;
      return;
    }

    // Check physical validity
    const p100 = product.nutrition_info?.per_100g || {};
    const nut = product.nutrition || {};
    const protein = typeof p100.protein_g === 'number' ? p100.protein_g : (typeof nut.protein === 'number' ? nut.protein : 0);
    const carbs = typeof p100.carbohydrates_g === 'number' ? p100.carbohydrates_g : (typeof nut.carbohydrates === 'number' ? nut.carbohydrates : 0);
    const fat = typeof p100.total_fat_g === 'number' ? p100.total_fat_g : (typeof nut.fat === 'number' ? nut.fat : 0);
    const cals = typeof p100.energy_kcal === 'number' ? p100.energy_kcal : (typeof nut.calories === 'number' ? nut.calories : (typeof nut.energyKcal === 'number' ? nut.energyKcal : null));

    if (protein > 100 || carbs > 100 || fat > 100 || (protein + carbs + fat) > 115 || (cals != null && cals < 0)) {
      results[populationKey].INVALID++;
      return;
    }

    // Check data completeness
    const isNeutralNutrition = res.coverage?.nutritionCoverage?.evaluatedCount === 0;
    const isMissingIngredients = res.coverage?.ingredientCoverage?.parseStatus === 'EMPTY_INGREDIENTS';
    if (isNeutralNutrition || isMissingIngredients) {
      results[populationKey].INCOMPLETE++;
      return;
    }

    // Otherwise fully verified PASS
    results[populationKey].PASS++;
  }

  // Audit Catalog-500
  for (const p of cat500Products) {
    auditProduct(p, 'cat500');
  }

  // Audit Legacy
  for (const p of legacyProducts) {
    auditProduct(p, 'legacy');
  }

  console.log('---------------- AUDIT CLASSIFICATION RESULTS ----------------');
  console.log('Catalog-500 (500 SKUs):');
  console.log(`  PASS:        ${results.cat500.PASS}`);
  console.log(`  FAIL:        ${results.cat500.FAIL}`);
  console.log(`  INCOMPLETE:  ${results.cat500.INCOMPLETE}`);
  console.log(`  INVALID:     ${results.cat500.INVALID}`);

  console.log('\nLegacy Retail Products (500 SKUs):');
  console.log(`  PASS:        ${results.legacy.PASS}`);
  console.log(`  FAIL:        ${results.legacy.FAIL}`);
  console.log(`  INCOMPLETE:  ${results.legacy.INCOMPLETE}`);
  console.log(`  INVALID:     ${results.legacy.INVALID}`);

  const totalPass = results.cat500.PASS + results.legacy.PASS;
  const totalFail = results.cat500.FAIL + results.legacy.FAIL;
  const totalIncomplete = results.cat500.INCOMPLETE + results.legacy.INCOMPLETE;
  const totalInvalid = results.cat500.INVALID + results.legacy.INVALID;

  console.log('\nCOMBINED TOTALS (1,000 SKUs):');
  console.log(`  PASS:        ${totalPass} (${((totalPass/1000)*100).toFixed(1)}%)`);
  console.log(`  FAIL:        ${totalFail}`);
  console.log(`  INCOMPLETE:  ${totalIncomplete} (${((totalIncomplete/1000)*100).toFixed(1)}%)`);
  console.log(`  INVALID:     ${totalInvalid} (${((totalInvalid/1000)*100).toFixed(1)}%)`);
  console.log(`  Additivity Violations: ${results.totalAdditivityErrors}`);

  // Test Galaxy Chocolate specifically
  const galaxy = cat500Products.find(p => (p.product_id || p.id) === 'PKG_PRD_0067');
  if (galaxy) {
    const gRes = scoringService.calculateSmartChoiceScore(galaxy, {});
    console.log('\n--- VERIFICATION OF REPORTED SCREENSHOT PRODUCT (PKG_PRD_0067: Galaxy Smooth Milk Chocolate) ---');
    console.log(`  Nutrition (40%):           ${gRes.weightedBreakdown.nutrition}/40`);
    console.log(`  Ingredients (20%):         ${gRes.weightedBreakdown.ingredients}/20`);
    console.log(`  Processing / NOVA (15%):   ${gRes.weightedBreakdown.processing}/15`);
    console.log(`  Protein & Fibre (15%):     ${gRes.weightedBreakdown.proteinFiber}/15`);
    console.log(`  User Preferences (10%):    ${gRes.weightedBreakdown.preferences}/10`);
    console.log(`  SUM OF COMPONENTS:         ${gRes.weightedBreakdown.nutrition + gRes.weightedBreakdown.ingredients + gRes.weightedBreakdown.processing + gRes.weightedBreakdown.proteinFiber + gRes.weightedBreakdown.preferences}/100`);
    console.log(`  TOTAL QUALITY SCORE:       ${gRes.totalScore}/100`);
    console.log(`  Exact Additivity Verified: ${gRes.totalScore === (gRes.weightedBreakdown.nutrition + gRes.weightedBreakdown.ingredients + gRes.weightedBreakdown.processing + gRes.weightedBreakdown.proteinFiber + gRes.weightedBreakdown.preferences)}`);
  }

  return results;
}

if (require.main === module) {
  runCatalogueAudit();
}

module.exports = { runCatalogueAudit };
