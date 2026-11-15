const fs = require('fs');
const path = require('path');

const catalog500Path = path.join(__dirname, '../../frontend/public/data/enriched_catalog_500.json');
const c500 = JSON.parse(fs.readFileSync(catalog500Path, 'utf8'));

c500.categories.forEach(c => {
  const ingMap = {};
  c.products.forEach(p => {
    const ing = String(p.nutrition_info?.ingredients_text || '').trim();
    if (!ingMap[ing]) ingMap[ing] = [];
    ingMap[ing].push(p.product_id + ': ' + p.product_name);
  });
  
  const placeholders = Object.entries(ingMap).filter(([k, v]) => v.length > 1);
  if (placeholders.length > 0) {
    console.log(`\n========================================`);
    console.log(`Category ${c.category_id || c.id}: ${c.category_name || c.name} (Total Products: ${c.products.length})`);
    console.log(`========================================`);
    placeholders.forEach(([ing, prods]) => {
      console.log(`\nPlaceholder (${prods.length} products): "${ing.slice(0, 100)}..."`);
      console.log(`Products:`);
      prods.forEach(pr => console.log(`  - ${pr}`));
    });
  }
});
