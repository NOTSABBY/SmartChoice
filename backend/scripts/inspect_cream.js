const fs = require('fs');
const path = require('path');

const catPath = path.join(__dirname, '../../frontend/public/data/enriched_catalog_500.json');
const cat = JSON.parse(fs.readFileSync(catPath, 'utf8'));

const DAIRY_TERMS = [
  'milk', 'dairy', 'butter', 'ghee', 'clarified butter', 'paneer', 'cheese',
  'cheddar', 'mozzarella', 'parmesan', 'gouda', 'curd', 'yogurt', 'dahi',
  'whey', 'casein', 'caseinate', 'lactose', 'milk fat', 'milk solids',
  'milk powder', 'dairy whitener', 'malai', 'khoya', 'mawa', 'buttermilk', 'dairy solids'
];

// Note: "cream" alone can appear in "cream of tartar", "creamy texture", "non-dairy creamer", "onion & cream flavouring"
// But dairy cream: "milk cream", "dairy cream", "fresh cream", "sour cream", "cream (milk)", "whipping cream", "heavy cream"
// Let's inspect products matching cream
cat.categories.forEach(c => {
  c.products.forEach(p => {
    const ingText = ((p.nutrition_info?.ingredients_text || '') + ' ' + (p.ingredients?.ingredients || []).join(' ')).toLowerCase();
    const allergens = (p.nutrition_info?.allergens || []).map(a => String(a).toLowerCase());
    const hasMilkAllergen = allergens.some(a => a.includes('milk') || a.includes('dairy'));
    
    // Check dairy terms
    const matchedTerms = DAIRY_TERMS.filter(t => new RegExp(`\\b${t}\\b`, 'i').test(ingText));
    const hasCream = /\bcream\b/i.test(ingText);
    
    if (hasCream && matchedTerms.length === 0 && !hasMilkAllergen) {
      console.log(`Product: [${p.product_id}] ${p.product_name} (Cat ${c.category_id}: ${c.category_name})`);
      console.log(`  Ingredients: ${p.nutrition_info?.ingredients_text}`);
      console.log(`  Allergens: ${p.nutrition_info?.allergens?.join(', ')}`);
      console.log('---');
    }
  });
});
