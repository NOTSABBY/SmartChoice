const fs = require('fs');
const path = require('path');

const catPath = path.join(__dirname, '../../frontend/public/data/enriched_catalog_500.json');
const cat = JSON.parse(fs.readFileSync(catPath, 'utf8'));

const NON_DAIRY_BUTTER = /(?:peanut|cocoa|almond|cashew|apple|shea)\s+butter/gi;
const DAIRY_REGEX = /\b(milk|dairy|ghee|clarified butter|desi ghee|cow ghee|paneer|cheese|cheddar|mozzarella|parmesan|gouda|curd|yogurt|dahi|whey|casein|caseinate|lactose|milk fat|dairy solids|milk solids|milk powder|dairy whitener|malai|khoya|mawa|buttermilk)\b|(?<!peanut\s+|cocoa\s+|almond\s+|cashew\s+|apple\s+|shea\s+)\bbutter\b/i;

function isDairy(p, c) {
  // 1. Packaged Dairy & Cheese is 100% dairy
  if (c.category_id === 13) return true;

  const pName = p.product_name || '';
  if (/\b(ice\s*cream|kulfi)\b/i.test(pName)) return true;

  // 2. Check declared confirmed allergens
  const declaredAllergens = (p.nutrition_info?.allergens || []).map(a => String(a).toLowerCase());
  // Precautionary may_contain is separate:
  const mayContain = (p.nutrition_info?.may_contain || []).map(a => String(a).toLowerCase());

  // In ingredients text, split out "May contain" / "Allergen Advice" / "Traces of"
  let rawIng = (p.nutrition_info?.ingredients_text || '');
  // Cut off precautionary statement if present in ingredients_text
  const splitIdx = rawIng.search(/\b(?:may contain|contain traces of|allergen advice:?\s*may contain)\b/i);
  if (splitIdx !== -1) {
    rawIng = rawIng.substring(0, splitIdx);
  }

  const ingTokens = (p.ingredients?.ingredients || []).map(t => String(t).toLowerCase());
  let fullText = (pName + ' ' + rawIng + ' ' + ingTokens.join(' ')).toLowerCase();
  fullText = fullText.replace(NON_DAIRY_BUTTER, ' plant_butter ');

  // If declared allergens has milk
  if (declaredAllergens.some(a => a.includes('milk') || a.includes('dairy'))) {
    // But check if it's only in peanut butter without dairy
    return true;
  }

  if (DAIRY_REGEX.test(fullText)) {
    return true;
  }

  return false;
}

let total = 0;
let dairyCount = 0;
let dairyFreeCount = 0;
const perCategory = {};

cat.categories.forEach(c => {
  const catKey = `Cat ${c.category_id}: ${c.category_name}`;
  perCategory[catKey] = { total: 0, dairy: 0, dairyFree: 0 };
  c.products.forEach(p => {
    total++;
    perCategory[catKey].total++;
    if (isDairy(p, c)) {
      dairyCount++;
      perCategory[catKey].dairy++;
    } else {
      dairyFreeCount++;
      perCategory[catKey].dairyFree++;
    }
  });
});

console.log('Total:', total, 'Dairy:', dairyCount, 'DairyFree:', dairyFreeCount);
Object.keys(perCategory).forEach(k => {
  console.log(`${k} -> Dairy: ${perCategory[k].dairy}, DairyFree: ${perCategory[k].dairyFree}`);
});
