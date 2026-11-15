const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, '../../frontend/public/data/enriched_catalog_500.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

const prods = [];
catalog.categories.forEach(cat => {
  (cat.products || []).forEach(p => {
    prods.push({
      id: p.product_id,
      catId: p.category_id || cat.category_id,
      catName: p.category_name || cat.category_name,
      brand: p.brand,
      name: p.product_name,
      packaging: p.packaging_size,
      dietary: p.dietary_type,
      ingredients: p.nutrition_info?.ingredients_text || '',
      allergens: p.nutrition_info?.allergens || [],
      source: p.nutrition_info?.data_source || 'unknown'
    });
  });
});

console.log(`Total Products: ${prods.length}`);
console.log('Categories count:', catalog.categories.length);

// Check distribution of data_source
const sources = {};
prods.forEach(p => {
  sources[p.source] = (sources[p.source] || 0) + 1;
});
console.log('Data sources:', sources);

// Check ingredients length distribution
let zeroLen = 0, under50 = 0, over50 = 0;
prods.forEach(p => {
  if (p.ingredients.length === 0) zeroLen++;
  else if (p.ingredients.length < 50) under50++;
  else over50++;
});
console.log(`Ingredients length: 0 chars: ${zeroLen}, <50 chars: ${under50}, >=50 chars: ${over50}`);
