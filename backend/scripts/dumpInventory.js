const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, '../../frontend/public/data/enriched_catalog_500.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

const lines = ['id,category_id,category_name,brand,product_name'];
catalog.categories.forEach(c => {
  (c.products || []).forEach(p => {
    lines.push(`${p.product_id},${p.category_id || c.category_id},"${(p.category_name || c.category_name).replace(/"/g, '""')}","${(p.brand || '').replace(/"/g, '""')}","${(p.product_name || '').replace(/"/g, '""')}"`);
  });
});

fs.writeFileSync(path.join(__dirname, '../data/products_inventory_500.csv'), lines.join('\n'), 'utf8');
console.log(`Exported ${lines.length - 1} products to products_inventory_500.csv`);
