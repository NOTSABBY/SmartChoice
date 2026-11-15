const fs = require('fs');
const path = require('path');

const catalog500Path = path.join(__dirname, '../../frontend/public/data/enriched_catalog_500.json');
const c500 = JSON.parse(fs.readFileSync(catalog500Path, 'utf8'));

console.log('=== CATALOG 500 FULL INGREDIENT AUDIT ===\n');

const issues = [];

c500.categories.forEach(cat => {
  cat.products.forEach(p => {
    const pId = p.product_id;
    const pName = p.product_name;
    const brand = p.brand;
    const catName = cat.name;
    const ing = String(p.nutrition_info?.ingredients_text || '').trim();
    const ingLower = ing.toLowerCase();
    const nameLower = pName.toLowerCase();

    // Check specific known discrepancies
    let issueType = null;
    let details = '';

    if (nameLower.includes('ghee') && (ingLower.includes('vegetable oil') || ingLower.includes('palmolein') || !ingLower.includes('milk'))) {
      issueType = 'GHEE_VEGETABLE_OIL_MISMATCH';
      details = `Product is Ghee but ingredient list declares vegetable oil or lacks milk fat.`;
    } else if (nameLower.includes('butter') && !nameLower.includes('peanut butter') && !nameLower.includes('cookie') && !nameLower.includes('biscuit') && !nameLower.includes('rusk') && !nameLower.includes('chicken') && !nameLower.includes('masala') && (ingLower.includes('rennet') || ingLower.includes('emulsifying salts') || !ingLower.includes('butter') && !ingLower.includes('milk fat'))) {
      issueType = 'BUTTER_CHEESE_MISMATCH';
      details = `Product is Butter but ingredient list contains processed cheese ingredients (rennet / emulsifying salts).`;
    } else if (nameLower.includes('mustard oil') && !ingLower.includes('mustard')) {
      issueType = 'MUSTARD_OIL_GENERIC_OIL';
      details = `Product is Mustard Oil but ingredient list is generic vegetable oil without mustard.`;
    } else if (nameLower.includes('sunflower oil') && !ingLower.includes('sunflower')) {
      issueType = 'SUNFLOWER_OIL_GENERIC_OIL';
      details = `Product is Sunflower Oil but ingredient list is generic vegetable oil without sunflower.`;
    } else if (nameLower.includes('olive oil') && !ingLower.includes('olive')) {
      issueType = 'OLIVE_OIL_GENERIC_OIL';
      details = `Product is Olive Oil but ingredient list is generic vegetable oil without olive.`;
    } else if (nameLower.includes('coconut oil') && !ingLower.includes('coconut')) {
      issueType = 'COCONUT_OIL_GENERIC_OIL';
      details = `Product is Coconut Oil but ingredient list is generic vegetable oil without coconut.`;
    } else if ((nameLower.includes('ice cream') || nameLower.includes('kulfi') || nameLower.includes('cornetto') || nameLower.includes('magnum') || nameLower.includes('cassatta')) && ingLower.includes('potato (82%)')) {
      issueType = 'ICE_CREAM_FROZEN_POTATO_MISMATCH';
      details = `Product is Ice Cream / Kulfi but ingredient list is Frozen Potato snacks (Potato 82%).`;
    } else if ((nameLower.includes('gulab jamun') || nameLower.includes('kheer') || nameLower.includes('payasam') || nameLower.includes('cake mix') || nameLower.includes('jelly')) && ingLower.includes('corn flour (maize starch), sugar, iodised salt, nature-identical flavouring substances (vanilla)')) {
      issueType = 'DESSERT_MIX_CUSTARD_POWDER_MISMATCH';
      details = `Product is ${pName} but ingredient list is Vanilla Custard Powder.`;
    } else if (ing.includes('Pure Indian Tea Granules / Roasted & Ground Coffee Beans')) {
      issueType = 'TEA_COFFEE_GENERIC_HYBRID';
      details = `Product has generic slash-separated placeholder text "Tea Granules / Roasted & Ground Coffee Beans".`;
    } else if (ing.includes('Ground Coriander, Cumin, Turmeric, Red Chilli, Black Pepper, Dry Ginger, Clove, Cinnamon, Cardamom') && (nameLower.includes('turmeric') || nameLower.includes('chilli') || nameLower.includes('coriander') || nameLower.includes('cumin') || nameLower.includes('black pepper') || nameLower.includes('haldi') || nameLower.includes('mirch') || nameLower.includes('dhaniya') || nameLower.includes('jeera'))) {
      issueType = 'SINGLE_SPICE_GARAM_MASALA_MISMATCH';
      details = `Product is single pure spice (${pName}) but ingredient list is a 10-spice Garam Masala mix.`;
    } else if (ing.includes('100% Whole Wheat Grains (Stone Ground Sharbati / MP Lokwan Wheat)') && (nameLower.includes('besan') || nameLower.includes('gram flour') || nameLower.includes('maida') || nameLower.includes('sooji') || nameLower.includes('rava') || nameLower.includes('rice flour'))) {
      issueType = 'NON_WHEAT_FLOUR_WHEAT_GRAIN_MISMATCH';
      details = `Product is ${pName} (non-wheat flour) but ingredient list is Stone Ground Wheat Grains.`;
    } else if (ing.includes('Whole Grain Rolled Oats (100%)') && (nameLower.includes('corn flakes') || nameLower.includes('chocos') || nameLower.includes('wheat flakes') || nameLower.includes('all-bran') || nameLower.includes('masala oats'))) {
      issueType = 'CEREAL_PLAIN_OATS_MISMATCH';
      details = `Product is ${pName} but ingredient list is plain 100% Rolled Oats.`;
    } else if (ing.includes('Whole Grain Rolled Oats (42%), Honey, Almonds') && nameLower.includes('bar') && !nameLower.includes('granola')) {
      issueType = 'BAR_GRANOLA_MISMATCH';
      details = `Product is ${pName} bar but ingredient list is Granola cereal.`;
    } else if (ing.includes('Carbonated Water, Sugar, Acidity Regulators (INS 338, INS 330), Colour (INS 150d)') && (nameLower.includes('sprite') || nameLower.includes('7up') || nameLower.includes('limca') || nameLower.includes('tonic water') || nameLower.includes('ginger ale') || nameLower.includes('soda water'))) {
      issueType = 'CLEAR_BEVERAGE_COLA_RECIPE_MISMATCH';
      details = `Product is clear drink (${pName}) but ingredient list contains Cola Caramel Colour INS 150d and Phosphoric Acid INS 338.`;
    } else if (pId === 'PKG_PRD_0008' && ing.includes('Yeast') && ing.includes('Acidity Regulators [INS 270, INS 330]')) {
      issueType = 'NUTRICELL_MONACO_MISMATCH';
      details = `NutriChoice Digestive Biscuits contains Parle Monaco salted cracker ingredients.`;
    } else if (pId === 'PKG_PRD_0012' && ing.includes('Malt Extract') && !ing.includes('Milk Solids')) {
      issueType = 'MILK_BIKIS_DIGESTIVE_MISMATCH';
      details = `Britannia Milk Bikis Biscuits has McVitie's Digestive ingredients without Milk Solids.`;
    }

    if (issueType) {
      issues.push({
        id: pId,
        name: pName,
        brand: brand,
        category: catName,
        issueType,
        details,
        currentIng: ing
      });
    }
  });
});

console.log(`Total Demonstrably Wrong / Generic Ingredient Records Identified: ${issues.length}`);
console.log('\nBreakdown by Issue Type:');
const counts = {};
issues.forEach(i => counts[i.issueType] = (counts[i.issueType] || 0) + 1);
console.log(JSON.stringify(counts, null, 2));

console.log('\nSample Identified Issues:');
issues.slice(0, 15).forEach(i => {
  console.log(`[${i.id}] ${i.name} (${i.category}):`);
  console.log(`   Type: ${i.issueType}`);
  console.log(`   Details: ${i.details}`);
  console.log(`   Current: "${i.currentIng.slice(0, 90)}..."\n`);
});
