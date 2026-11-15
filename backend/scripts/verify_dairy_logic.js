const fs = require('fs');
const path = require('path');

const catPath = path.join(__dirname, '../../frontend/public/data/enriched_catalog_500.json');
const cat = JSON.parse(fs.readFileSync(catPath, 'utf8'));

// Plant butter regex (peanut butter, cocoa butter, almond butter, shea butter, etc.)
const PLANT_BUTTER_REGEX = /(?:peanut|cocoa|almond|cashew|apple|shea)\s+butter/gi;

// Comprehensive Dairy Derivatives Regex (English + international packaging terms)
const DAIRY_INGREDIENTS_REGEX = /\b(milk|dairy|ghee|clarified butter|desi ghee|cow ghee|paneer|cheese|cheddar|mozzarella|parmesan|gouda|fromage|curd|yogurt|dahi|whey|casein|caseinate|lactose|milk fat|dairy solids|milk solids|milk powder|dairy whitener|malai|khoya|mawa|buttermilk|lait|milch|vollmilch|magermilch|butterfat|butterreinfett|petit-lait)\b|(?<!peanut\s+|cocoa\s+|almond\s+|cashew\s+|apple\s+|shea\s+)\bbutter\b/i;

function evaluateDairyStatus(product, category) {
  const catId = Number(category.category_id || category.id);
  const catName = category.category_name || category.name || '';
  const pName = product.product_name || product.catalog?.productName || '';

  // 1. Packaged Dairy & Cheese is 100% dairy
  if (catId === 13 || /packaged dairy & cheese/i.test(catName)) {
    return { isDairy: true, reason: 'Packaged Dairy & Cheese category' };
  }

  // 2. Ice cream & kulfi desserts in frozen snacks
  if (/\b(ice\s*cream|kulfi)\b/i.test(pName)) {
    return { isDairy: true, reason: 'Ice cream / kulfi product' };
  }

  // 3. Check declared confirmed allergens
  const declaredAllergens = (
    product.nutrition_info?.allergens ||
    product.ingredients?.allergens ||
    product.ingredients?.allergenDeclarations?.contains ||
    []
  ).map(a => String(a).toLowerCase());

  if (declaredAllergens.some(a => a === 'milk' || a === 'dairy')) {
    return { isDairy: true, reason: 'Declared milk allergen' };
  }

  // 4. Raw ingredient text & tokens (excluding precautionary advisory)
  let rawIng = (product.nutrition_info?.ingredients_text || product.ingredients?.rawIngredientsText || product.ingredients?.rawText || '');
  
  // Cut off precautionary statement if present in ingredients_text ("May contain...", "Contain traces of...")
  const splitIdx = rawIng.search(/\b(?:may contain|contain traces of|allergen advice:?\s*may contain)\b/i);
  if (splitIdx !== -1) {
    rawIng = rawIng.substring(0, splitIdx);
  }

  const ingTokens = (product.ingredients?.ingredients || []).map(t => String(t).toLowerCase());
  let combinedText = (pName + ' ' + rawIng + ' ' + ingTokens.join(' ')).toLowerCase();
  
  // Replace plant butters so "cocoa butter" or "peanut butter" does not trigger "butter"
  combinedText = combinedText.replace(PLANT_BUTTER_REGEX, ' plant_butter ');

  // 5. Test against comprehensive dairy regex
  if (DAIRY_INGREDIENTS_REGEX.test(combinedText)) {
    const match = combinedText.match(DAIRY_INGREDIENTS_REGEX)[0];
    return { isDairy: true, reason: `Contains dairy derivative: ${match}` };
  }

  return { isDairy: false, reason: 'No dairy ingredients detected' };
}

let totalEvaluated = 0;
let dairyCount = 0;
let dairyFreeCount = 0;
const perCategory = {};

cat.categories.forEach(c => {
  const catKey = `Cat ${c.category_id}: ${c.category_name}`;
  perCategory[catKey] = { total: 0, dairy: 0, dairyFree: 0 };
  c.products.forEach(p => {
    totalEvaluated++;
    perCategory[catKey].total++;
    const res = evaluateDairyStatus(p, c);
    if (res.isDairy) {
      dairyCount++;
      perCategory[catKey].dairy++;
    } else {
      dairyFreeCount++;
      perCategory[catKey].dairyFree++;
    }
  });
});

console.log('Total Evaluated:', totalEvaluated);
console.log('Dairy Count:', dairyCount);
console.log('Dairy-Free Count:', dairyFreeCount);
Object.keys(perCategory).forEach(k => {
  console.log(`${k} -> Dairy: ${perCategory[k].dairy}, DairyFree: ${perCategory[k].dairyFree}`);
});
