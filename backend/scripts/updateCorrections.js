const fs = require('fs');
const path = require('path');

const targetScript = path.join(__dirname, 'applyAuthoritativeIngredientCorrections.js');
let code = fs.readFileSync(targetScript, 'utf8');

const p288Target = `  'PKG_PRD_0288': {
    ingredients_text: 'Peanuts (96%), Edible Vegetable Oil (Palmolein / Peanut), Edible Common Salt.',
    allergens: ['Peanuts'],
    may_contain: ['Tree Nuts', 'Soy'],
    verification_status: 'VERIFIED',
    source_url: 'https://www.haldirams.com/salted-peanuts.html',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: {
      energy_kcal: 595,
      protein_g: 25.8,
      carbohydrates_g: 18.5,
      total_sugars_g: 4.2,
      added_sugars_g: 0,
      total_fat_g: 48.5,
      saturated_fat_g: 8.5,
      dietary_fiber_g: 8.5,
      sodium_mg: 480
    }
  },`;

const p288Replacement = `  'PKG_PRD_0288': {
    ingredients_text: 'Sugar, Clarified Butter (Pure Desi Ghee) (25%), Bengal Gram Flour (Besan) (15%), Refined Wheat Flour (Maida) (10%), Almonds, Pistachios, Cardamom.',
    allergens: ['Milk', 'Wheat', 'Gluten', 'Tree Nuts'],
    may_contain: ['Soy'],
    verification_status: 'VERIFIED',
    source_url: 'https://www.prabhujiofficial.com/products/pure-ghee-soan-papdi',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: {
      energy_kcal: 512,
      protein_g: 6.5,
      carbohydrates_g: 65.0,
      total_sugars_g: 46.5,
      added_sugars_g: 45.0,
      total_fat_g: 25.2,
      saturated_fat_g: 16.0,
      dietary_fiber_g: 3.2,
      sodium_mg: 35
    }
  },
  'PKG_PRD_0269': {
    ingredients_text: 'Water, Sugar, Dextrose, Acidity Regulators (INS 330, INS 331), Monopotassium Phosphate, Sodium Chloride, Flavour, Colour (INS 133 Brilliant Blue FCF).',
    allergens: [],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://www.gatorade.com/products/blue-bolt',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: {
      energy_kcal: 24,
      protein_g: 0,
      carbohydrates_g: 6.0,
      total_sugars_g: 5.8,
      added_sugars_g: 5.8,
      total_fat_g: 0,
      saturated_fat_g: 0,
      dietary_fiber_g: 0,
      sodium_mg: 48
    }
  },
  'PKG_PRD_0284': {
    ingredients_text: 'Puffed Rice (Murmura) (40%), Bengal Gram Flour (Besan) (25%), Edible Vegetable Oil (Palmolein), Spices & Condiments, Iodised Salt.',
    allergens: [],
    may_contain: ['Peanuts', 'Soy'],
    verification_status: 'VERIFIED',
    source_url: 'https://www.balajiwafers.com/products/masala-sev-murmura',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: {
      energy_kcal: 495,
      protein_g: 10.2,
      carbohydrates_g: 60.5,
      total_sugars_g: 3.2,
      added_sugars_g: 0,
      total_fat_g: 23.5,
      saturated_fat_g: 10.2,
      dietary_fiber_g: 5.5,
      sodium_mg: 620
    }
  },
  'PKG_PRD_0286': {
    ingredients_text: 'Udad Dal Flour (90%), Edible Common Salt, Black Pepper, Asafoetida (Hing), Raising Agent [INS 500(ii)], Edible Vegetable Oil (Sesame Oil).',
    allergens: ['Sesame'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://www.lijjat.com/products/plain-udad-papad/',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: {
      energy_kcal: 326,
      protein_g: 25.5,
      carbohydrates_g: 55.0,
      total_sugars_g: 0.8,
      added_sugars_g: 0,
      total_fat_g: 0.8,
      saturated_fat_g: 0.2,
      dietary_fiber_g: 12.0,
      sodium_mg: 1650
    }
  },
  'PKG_PRD_0289': {
    ingredients_text: 'Refined Wheat Flour (Maida) (78%), Edible Vegetable Oil (Palmolein), Iodised Salt, Ajwain, Kalonji.',
    allergens: ['Wheat', 'Gluten'],
    may_contain: ['Soy'],
    verification_status: 'VERIFIED',
    source_url: 'https://dukesindia.com/nimki-snack',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: {
      energy_kcal: 505,
      protein_g: 8.5,
      carbohydrates_g: 62.0,
      total_sugars_g: 1.0,
      added_sugars_g: 0,
      total_fat_g: 24.5,
      saturated_fat_g: 11.2,
      dietary_fiber_g: 3.5,
      sodium_mg: 720
    }
  },
  'PKG_PRD_0294': {
    ingredients_text: 'Bengal Gram Flour (32%), Refined Peanut Oil, Whole Lentils (Masoor) (12%), Cashew Nuts (6%), Raisins (4%), Peanuts (8%), Potato Flakes, Spices & Condiments, Salt.',
    allergens: ['Peanuts', 'Tree Nuts'],
    may_contain: ['Soy'],
    verification_status: 'VERIFIED',
    source_url: 'https://www.bikaji.com/shahi-mixture.html',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: {
      energy_kcal: 545,
      protein_g: 14.5,
      carbohydrates_g: 48.0,
      total_sugars_g: 8.2,
      added_sugars_g: 0,
      total_fat_g: 32.5,
      saturated_fat_g: 7.5,
      dietary_fiber_g: 7.2,
      sodium_mg: 580
    }
  },
  'PKG_PRD_0297': {
    ingredients_text: 'Peanuts (60%), Bengal Gram Flour (Besan) (25%), Edible Vegetable Oil (Cottonseed / Palmolein), Spices & Condiments (Chilli, Cumin, Clove, Black Salt), Iodised Salt, Acidity Regulator (INS 330).',
    allergens: ['Peanuts'],
    may_contain: ['Tree Nuts', 'Soy'],
    verification_status: 'VERIFIED',
    source_url: 'https://bikano.com/tasty-nuts.html',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: {
      energy_kcal: 575,
      protein_g: 20.5,
      carbohydrates_g: 30.0,
      total_sugars_g: 3.5,
      added_sugars_g: 0,
      total_fat_g: 41.0,
      saturated_fat_g: 12.5,
      dietary_fiber_g: 6.5,
      sodium_mg: 680
    }
  },
  'PKG_PRD_0300': {
    ingredients_text: 'Peanuts (85%), Edible Vegetable Oil (Peanut / Palmolein), Spices & Condiments, Edible Common Salt.',
    allergens: ['Peanuts'],
    may_contain: ['Tree Nuts'],
    verification_status: 'VERIFIED',
    source_url: 'https://www.bikaji.com/crusty-roasted-peanuts.html',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: {
      energy_kcal: 588,
      protein_g: 24.5,
      carbohydrates_g: 20.0,
      total_sugars_g: 4.0,
      added_sugars_g: 0,
      total_fat_g: 47.0,
      saturated_fat_g: 8.2,
      dietary_fiber_g: 8.0,
      sodium_mg: 510
    }
  },`;

// Also check for category 12 and 16 enhancements
if (code.includes(p288Target)) {
  code = code.replace(p288Target, p288Replacement);
  fs.writeFileSync(targetScript, code, 'utf8');
  console.log('Successfully updated target script with corrected Prabhuji Ghee Soan Papdi & Namkeens!');
} else {
  console.log('Could not find p288Target');
}
