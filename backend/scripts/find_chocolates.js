const fs = require('fs');
const path = require('path');
const cat = JSON.parse(fs.readFileSync(path.join(__dirname, '../../frontend/public/data/enriched_catalog_500.json'), 'utf8'));
const { classifyProductDairy } = require('../services/dairyClassificationService');

cat.categories.forEach(c => {
  c.products.forEach(p => {
    if (/chocolate|cocoa/i.test(p.product_name)) {
      const d = classifyProductDairy(p);
      console.log(`[${d.classification}] ${p.product_id}: ${p.product_name} (${c.category_name})`);
    }
  });
});
