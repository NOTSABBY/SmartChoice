const fs = require('fs');
const path = require('path');

const catPath = path.join(__dirname, '../../frontend/public/data/enriched_catalog_500.json');
const cat = JSON.parse(fs.readFileSync(catPath, 'utf8'));

const DAIRY_REGEX = /\b(milk|dairy|butter|ghee|clarified butter|paneer|cheese|curd|yogurt|dahi|whey|casein|caseinate|lactose|milk fat|cream|malai|khoya|mawa)\b/i;

let total = 0;
let dairyCount = 0;
let dairyFreeCount = 0;
const perCategory = {};

cat.categories.forEach(c => {
  const catKey = `Cat ${c.category_id}: ${c.category_name}`;
  perCategory[catKey] = { total: 0, dairy: 0, dairyFree: 0, dairyProducts: [] };
  c.products.forEach(p => {
    total++;
    perCategory[catKey].total++;
    const pName = p.product_name || '';
    const pCatName = c.category_name || '';
    const ingObj = p.ingredients || {};
    const rawIngText = String(p.nutrition_info?.ingredients_text || ingObj.rawIngredientsText || ingObj.rawText || '').toLowerCase();
    const ingTokens = Array.isArray(ingObj.ingredients) ? ingObj.ingredients.map(t => String(t).toLowerCase()) : [];
    const fullIngredientsText = [rawIngText, ...ingTokens].join(' ');

    const allergens = (
      p.nutrition_info?.allergens ||
      p.ingredients?.allergens ||
      p.ingredients?.allergenDeclarations?.contains ||
      []
    ).map(a => String(a).toLowerCase());
    
    const hasMilkAllergen = allergens.some(a => a.includes('milk') || a.includes('dairy'));
    const hasDairyInName = DAIRY_REGEX.test(pName) || /\bdairy\b/i.test(pCatName);
    const hasDairyInIngredients = DAIRY_REGEX.test(fullIngredientsText);

    if (hasDairyInIngredients || hasMilkAllergen || hasDairyInName) {
      dairyCount++;
      perCategory[catKey].dairy++;
      perCategory[catKey].dairyProducts.push(p.product_id + ': ' + p.product_name);
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
