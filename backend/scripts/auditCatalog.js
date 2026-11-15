const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, '../../frontend/public/data/enriched_catalog_500.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

let total = 0;
const allProducts = [];
const emptyIngredients = [];
const genericIngredients = [];
const suspectDietary = [];
const suspectAllergens = [];

const genericPhrases = [
  'Standard authentic food ingredients with permitted stabilizers and spices',
  'Mixed Fruit Pulp (45%) (Papaya, Apple, Pineapple, Mango, Grape)',
  'Refined Wheat Flour (Maida) (62%), Sugar, Edible Vegetable Oil (Palm Oil), Invert Sugar Syrup, Milk Solids (2%)',
  'Noodles: Refined Wheat Flour (Maida), Palm Oil, Iodised Salt, Wheat Gluten',
  'Rolled Whole Oats (78%), Whole Wheat Flakes, Invert Sugar',
  'Sugar, Milk Solids (20%), Cocoa Butter (18%), Cocoa Solids (12%)',
  'Water, Fruit Pulp/Concentrate (22%)',
  'Water, Tomato Paste (28%), Sugar, Iodised Salt'
];

catalog.categories.forEach(cat => {
  const catName = cat.category_name || cat.name;
  (cat.products || []).forEach(p => {
    total++;
    allProducts.push(p);

    const ingText = (p.nutrition_info?.ingredients_text || '').trim();
    if (!ingText) {
      emptyIngredients.push({ id: p.product_id, name: p.product_name, brand: p.brand, cat: catName });
    } else {
      const isGeneric = genericPhrases.some(phrase => ingText.includes(phrase));
      if (isGeneric) {
        genericIngredients.push({ id: p.product_id, name: p.product_name, brand: p.brand, cat: catName, text: ingText.slice(0, 60) });
      }
    }

    // Check for non-veg ingredients or keywords
    const lowerIng = ingText.toLowerCase();
    const lowerName = p.product_name.toLowerCase();
    const nonVegKeywords = ['chicken', 'egg', 'fish', 'meat', 'mutton', 'pork', 'beef', 'prawn', 'shrimp', 'crab', 'gelatin', 'lard', 'tallow', 'anchovy', 'oyster', 'squid'];
    const matchedNonVeg = nonVegKeywords.filter(kw => {
      // Avoid false positive on 'eggless'
      if (kw === 'egg' && (lowerIng.includes('eggless') || lowerName.includes('eggless'))) {
        return false;
      }
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      return regex.test(lowerIng) || regex.test(lowerName);
    });

    if (matchedNonVeg.length > 0) {
      suspectDietary.push({ id: p.product_id, name: p.product_name, brand: p.brand, cat: catName, matched: matchedNonVeg, currentDiet: p.dietary_type });
    }

    // Check allergens
    const allergens = p.nutrition_info?.allergens || [];
    if (allergens.length === 0) {
      suspectAllergens.push({ id: p.product_id, name: p.product_name, brand: p.brand, cat: catName });
    }
  });
});

console.log('=== FULL CATALOG-500 AUDIT RESULTS ===');
console.log(`Total Products Audited: ${total}`);
console.log(`Empty Ingredients: ${emptyIngredients.length}`);
console.log(`Generic/Fallback Ingredients: ${genericIngredients.length}`);
console.log(`Suspect Non-Veg Keywords found in Name or Ingredients: ${suspectDietary.length}`);
console.log(`Missing/Empty Allergen Lists: ${suspectAllergens.length}`);

console.log('\n--- Sample Products with Empty Ingredients (first 5): ---');
console.log(emptyIngredients.slice(0, 5));

console.log('\n--- Sample Products with Generic Fallback Ingredients (first 5): ---');
console.log(genericIngredients.slice(0, 5));

console.log('\n--- Suspect Non-Veg Products (Keywords detected): ---');
console.log(suspectDietary);
