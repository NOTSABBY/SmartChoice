const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, '../../frontend/public/data/enriched_catalog_500.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

[6, 7, 12, 13, 20, 25].forEach(catId => {
  const cat = catalog.categories.find(c => c.category_id === catId);
  if (cat) {
    console.log(`\n=== Category ${catId}: ${cat.category_name} ===`);
    (cat.products || []).forEach(p => {
      console.log(`${p.product_id}: [${p.brand}] ${p.product_name} (Current: ${p.dietary_type})`);
    });
  }
});
