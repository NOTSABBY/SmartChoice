const fs = require('fs');
const path = require('path');
const c = JSON.parse(fs.readFileSync(path.join(__dirname, '../../frontend/public/data/enriched_catalog_500.json'), 'utf8'));

const tests = {
  dairyFree: /\b(milk|dairy|butter|ghee|clarified butter|paneer|cheese|curd|yogurt|dahi|whey|casein|caseinate|lactose|milk fat|cream|malai|khoya|mawa|buttermilk|dairy whitener|milk solids|condensed milk|milk powder|skimmed milk|full cream milk|toned milk|dairy fat|milk protein|butter oil|anhydrous milk fat)\b/i,
  glutenFree: /\b(wheat|atta|maida|sooji|rava|semolina|barley|malt|rye|gluten|oats)\b/i,
  peanutFree: /\b(peanut|peanuts|groundnut|arachis)\b/i,
  eggFree: /(?<!eggless\s*)\b(egg|eggs|albumen|albumin|egg yolk)\b/i,
  palmOilFree: /\b(palm oil|palmolein|palmate|palmitate|palm kernel|elaeis guineensis)\b/i
};

const allProds = [];
c.categories.forEach(cat => cat.products.forEach(p => allProds.push({ ...p, categoryName: cat.category_name })));

Object.entries(tests).forEach(([testName, regex]) => {
  let excluded = 0;
  let eligible = 0;
  allProds.forEach(p => {
    const ing = p.nutrition_info?.ingredients_text || '';
    const allergens = (p.nutrition_info?.allergens || []).map(a => String(a).toLowerCase());
    const name = p.product_name;
    const catName = p.categoryName;

    const hasInIng = regex.test(ing);
    const hasInName = regex.test(name) || (testName === 'dairyFree' && /dairy/i.test(catName));
    const hasInAllergen = allergens.some(a => regex.test(a));

    if (hasInIng || hasInName || hasInAllergen) {
      excluded++;
    } else {
      eligible++;
    }
  });
  console.log(`${testName}: Total 500 | Excluded: ${excluded} | Eligible: ${eligible}`);
});
