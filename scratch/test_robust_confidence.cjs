const fs = require('fs');
const path = require('path');

const cat500 = JSON.parse(fs.readFileSync('frontend/public/data/enriched_catalog_500.json', 'utf8'));
let prods = [];
cat500.categories.forEach(c => c.products.forEach(p => prods.push(p)));

// Robust Evidence-Based Confidence Function
function calculateRobustConfidence(product) {
  const p100 = product.nutrition_info?.per_100g || {};
  const nut = product.nutrition || {};

  // 1. Nutritional Reliability Nr (45% weight)
  // Evaluates all statutory FSSAI fields: energy, protein, carbohydrates, total_sugars, added_sugars, total_fat, saturated_fat, trans_fat, sodium
  const statutoryNutrients = [
    { key: 'calories', val: p100.energy_kcal ?? nut.calories },
    { key: 'protein', val: p100.protein_g ?? nut.protein },
    { key: 'carbohydrates', val: p100.carbohydrates_g ?? nut.carbohydrates },
    { key: 'sugar', val: p100.total_sugars_g ?? nut.sugar },
    { key: 'addedSugars', val: p100.added_sugars_g ?? nut.addedSugars },
    { key: 'fat', val: p100.total_fat_g ?? nut.fat },
    { key: 'saturatedFat', val: p100.saturated_fat_g ?? nut.saturatedFat },
    { key: 'transFat', val: p100.trans_fat_g ?? nut.transFat },
    { key: 'sodium', val: p100.sodium_mg ?? nut.sodium }
  ];

  let filledCount = 0;
  const missingFields = [];
  statutoryNutrients.forEach(n => {
    if (typeof n.val === 'number' && !isNaN(n.val) && isFinite(n.val)) {
      filledCount++;
    } else {
      missingFields.push(n.key);
    }
  });

  const basis = product.nutrition?.basis || product.nutrition_info?.basis || 'PER_100G';
  const basisFactor = (basis === 'PER_100G' || basis === 'PER_100ML') ? 1.0 : (basis === 'PER_SERVING' ? 0.75 : 0.85);
  let baseNr = (filledCount / statutoryNutrients.length) * basisFactor * 100;

  // Penalize for physical contradictions in data
  const prot = p100.protein_g ?? nut.protein;
  const carbs = p100.carbohydrates_g ?? nut.carbohydrates;
  const fat = p100.total_fat_g ?? nut.fat;
  const sugar = p100.total_sugars_g ?? nut.sugar;
  const addedSug = p100.added_sugars_g ?? nut.addedSugars;
  const satF = p100.saturated_fat_g ?? nut.saturatedFat;

  if (sugar != null && carbs != null && sugar > carbs + 0.5) baseNr -= 20;
  if (addedSug != null && sugar != null && addedSug > sugar + 0.2) baseNr -= 20;
  if (satF != null && fat != null && satF > fat + 0.2) baseNr -= 25;
  if (prot != null && carbs != null && fat != null && (prot + carbs + fat) > 105) baseNr -= 25;

  const nr = Math.max(0, Math.min(100, Math.round(baseNr)));

  // 2. Ingredient Reliability Ir (35% weight)
  const rawText = (product.nutrition_info?.ingredients_text || product.ingredients?.rawText || product.ingredients?.rawIngredientsText || '').trim();
  const tokens = product.ingredients?.ingredients || [];
  const allergens = product.nutrition_info?.allergens || product.ingredients?.allergens || [];
  const mayContain = product.nutrition_info?.may_contain || [];
  const allergenDecl = product.ingredients?.allergenDeclarations;
  const hasExplicitAllergens = (allergens.length > 0 || mayContain.length > 0 || (allergenDecl && (allergenDecl.contains?.length > 0 || allergenDecl.mayContain?.length > 0)) || allergenDecl?.status === 'NO_ALLERGENS_DETECTED');

  let ir = 0;
  if (rawText.length > 10 && !rawText.toLowerCase().includes('unknown')) {
    ir += 40; // Valid raw ingredient text
    if (tokens.length >= 2) ir += 30; // Structured parsed tokens
    else if (tokens.length === 1) ir += 15;
    
    // Allergen declaration presence
    if (hasExplicitAllergens) ir += 20;
    else if (rawText.toLowerCase().includes('contains') || rawText.toLowerCase().includes('allergen')) ir += 10;
    
    // FSSAI verification of packaging source
    const isVerifiedPack = product.nutrition_info?.source_type === 'OFFICIAL_MANUFACTURER_PACKAGING' ||
                           product.ingredients?.verificationStatus === 'VERIFIED';
    if (isVerifiedPack) ir += 10;
  } else if (rawText.length > 0) {
    ir = 30;
  } else {
    ir = 0;
    missingFields.push('ingredients');
  }
  ir = Math.max(0, Math.min(100, ir));

  // 3. Processing Reliability Pr (20% weight)
  const novaGroup = product.processing?.novaGroup ?? product.nutrition_info?.nova_group;
  const sourceCertainty = product.analysis?.processingAnalysis?.sourceCertainty || product.processing?.sourceCertainty;
  const dataSource = product.nutrition_info?.data_source;

  let pr = 0;
  if (novaGroup != null && [1, 2, 3, 4].includes(Number(novaGroup))) {
    if (sourceCertainty === 'SOURCE_REPORTED' || dataSource === 'OFFICIAL_MANUFACTURER_PACKAGING') {
      pr = 100;
    } else if (dataSource === 'openfoodfacts') {
      pr = 85;
    } else if (dataSource === 'gemini_fssai_estimated' || sourceCertainty === 'INTERNALLY_ESTIMATED') {
      pr = 70;
    } else {
      pr = 80;
    }
  } else {
    pr = 0;
    missingFields.push('processing.novaGroup');
  }

  // Authoritative Formula: 0.45 * Nr + 0.35 * Ir + 0.20 * Pr
  const score = Math.max(0, Math.min(100, Math.round(0.45 * nr + 0.35 * ir + 0.20 * pr)));
  const level = score >= 80 ? 'high' : (score >= 60 ? 'medium' : 'low');
  const label = score >= 80 ? 'High Confidence' : (score >= 60 ? 'Moderate Confidence' : 'Low Confidence');

  return {
    score,
    confidence: score,
    level,
    label,
    breakdown: { nutrition: nr, ingredients: ir, processing: pr },
    missingFields
  };
}

const dist = {};
let sampleList = [];
prods.forEach(p => {
  const conf = calculateRobustConfidence(p);
  dist[conf.score] = (dist[conf.score] || 0) + 1;
  sampleList.push({ id: p.product_id, name: p.product_name, conf });
});

console.log('Robust Confidence distribution across Catalog-500:');
console.log(dist);

console.log('\nSample score categories:');
const high = sampleList.filter(s => s.conf.score >= 90).slice(0, 3);
const med = sampleList.filter(s => s.conf.score >= 70 && s.conf.score < 90).slice(0, 3);
const low = sampleList.filter(s => s.conf.score < 70).slice(0, 5);

console.log('HIGH (>=90):', high.map(h => `${h.id}: ${h.name} (${h.conf.score} - Nr:${h.conf.breakdown.nutrition}, Ir:${h.conf.breakdown.ingredients}, Pr:${h.conf.breakdown.processing})`));
console.log('MODERATE (70-89):', med.map(m => `${m.id}: ${m.name} (${m.conf.score} - Nr:${m.conf.breakdown.nutrition}, Ir:${m.conf.breakdown.ingredients}, Pr:${m.conf.breakdown.processing})`));
console.log('LOW (<70):', low.map(l => `${l.id}: ${l.name} (${l.conf.score} - Nr:${l.conf.breakdown.nutrition}, Ir:${l.conf.breakdown.ingredients}, Pr:${l.conf.breakdown.processing})`));
