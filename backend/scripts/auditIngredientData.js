const fs = require('fs');
const path = require('path');

const catalog500Path = path.join(__dirname, '../../frontend/public/data/enriched_catalog_500.json');
const legacyPath = path.join(__dirname, '../../data/processed/products_india.json');

const c500 = JSON.parse(fs.readFileSync(catalog500Path, 'utf8'));
let legacy = [];
if (fs.existsSync(legacyPath)) {
  try {
    legacy = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
  } catch (e) {
    console.warn('Error reading legacy:', e.message);
  }
}

const ingCounts = {};
const contradictions = [];

c500.categories.forEach(c => {
  (c.products || []).forEach(p => {
    const ing = String(p.nutrition_info?.ingredients_text || p.ingredients?.rawIngredientsText || p.ingredients?.rawText || '').trim();
    ingCounts[ing] = (ingCounts[ing] || 0) + 1;

    const name = (p.product_name || '').toLowerCase();
    const cat = (c.name || '').toLowerCase();
    const ingLower = ing.toLowerCase();

    // 1. Ghee with vegetable oil or no milk fat/clarified butter
    if (name.includes('ghee') && (ingLower.includes('vegetable oil') || ingLower.includes('palmolein') || !ingLower.includes('milk'))) {
      contradictions.push({ id: p.product_id, name: p.product_name, category: c.name, type: 'GHEE_MISMATCH', ing: ing.slice(0, 100) });
    }
    // 2. Butter with no dairy/cream/butter
    if (name.includes('butter') && !name.includes('peanut butter') && !name.includes('biscuit') && !name.includes('cookie') && !name.includes('rusk') && !name.includes('chicken') && !name.includes('masala') && !ingLower.includes('butter') && !ingLower.includes('milk fat') && !ingLower.includes('cream')) {
      contradictions.push({ id: p.product_id, name: p.product_name, category: c.name, type: 'BUTTER_MISMATCH', ing: ing.slice(0, 100) });
    }
    // 3. Cooking oil mismatch (e.g. mustard oil with no mustard, olive oil with no olive, coconut oil with no coconut)
    if (name.includes('mustard oil') && !ingLower.includes('mustard')) {
      contradictions.push({ id: p.product_id, name: p.product_name, category: c.name, type: 'MUSTARD_OIL_MISMATCH', ing: ing.slice(0, 100) });
    }
    if (name.includes('olive oil') && !ingLower.includes('olive')) {
      contradictions.push({ id: p.product_id, name: p.product_name, category: c.name, type: 'OLIVE_OIL_MISMATCH', ing: ing.slice(0, 100) });
    }
    if (name.includes('coconut oil') && !ingLower.includes('coconut')) {
      contradictions.push({ id: p.product_id, name: p.product_name, category: c.name, type: 'COCONUT_OIL_MISMATCH', ing: ing.slice(0, 100) });
    }
    if (name.includes('groundnut oil') && !ingLower.includes('groundnut') && !ingLower.includes('peanut')) {
      contradictions.push({ id: p.product_id, name: p.product_name, category: c.name, type: 'GROUNDNUT_OIL_MISMATCH', ing: ing.slice(0, 100) });
    }
    if (name.includes('sunflower oil') && !ingLower.includes('sunflower')) {
      contradictions.push({ id: p.product_id, name: p.product_name, category: c.name, type: 'SUNFLOWER_OIL_MISMATCH', ing: ing.slice(0, 100) });
    }
    if (name.includes('sesame oil') && !ingLower.includes('sesame') && !ingLower.includes('til')) {
      contradictions.push({ id: p.product_id, name: p.product_name, category: c.name, type: 'SESAME_OIL_MISMATCH', ing: ing.slice(0, 100) });
    }
    // 4. Rice with no rice
    if (cat.includes('rice') && !ingLower.includes('rice')) {
      contradictions.push({ id: p.product_id, name: p.product_name, category: c.name, type: 'RICE_MISMATCH', ing: ing.slice(0, 100) });
    }
    // 5. Atta with no wheat / atta / flour
    if (cat.includes('atta') && !ingLower.includes('wheat') && !ingLower.includes('atta') && !ingLower.includes('flour')) {
      contradictions.push({ id: p.product_id, name: p.product_name, category: c.name, type: 'ATTA_MISMATCH', ing: ing.slice(0, 100) });
    }
    // 6. Milk with no milk
    if (name.includes('milk') && (cat.includes('dairy') || cat.includes('milk')) && !ingLower.includes('milk')) {
      contradictions.push({ id: p.product_id, name: p.product_name, category: c.name, type: 'MILK_MISMATCH', ing: ing.slice(0, 100) });
    }
  });
});

console.log('Total contradictions found in Catalog 500:', contradictions.length);
contradictions.forEach(c => {
  console.log(`- [${c.type}] ${c.id}: "${c.name}" (${c.category})`);
  console.log(`   Ing: "${c.ing}"`);
});

console.log('\nTop repeated ingredient texts:');
const repeated = Object.entries(ingCounts).filter(([k, v]) => v > 1).sort((a, b) => b[1] - a[1]);
console.log('Total repeated ingredient patterns:', repeated.length);
repeated.forEach(([ing, count]) => {
  console.log(`- Count ${count}: "${ing.slice(0, 100)}..."`);
});

console.log('\n--- Category-by-Category Ingredient Diversity ---');
c500.categories.forEach(c => {
  const uniqueIngs = new Set();
  c.products.forEach(p => {
    const ing = String(p.nutrition_info?.ingredients_text || '').trim();
    uniqueIngs.add(ing);
  });
  console.log(`Cat ${c.id} [${c.name}]: ${uniqueIngs.size} unique ingredient texts out of ${c.products.length} products`);
});
