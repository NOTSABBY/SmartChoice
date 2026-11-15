const fs = require('fs');
const path = require('path');

const targetScript = path.join(__dirname, 'applyAuthoritativeIngredientCorrections.js');
let code = fs.readFileSync(targetScript, 'utf8');

const mealsAndPickles = `
  // -------------------------------------------------------------
  // Category 12: Ready-to-Eat Meals (Dish-specific authentic recipes)
  // -------------------------------------------------------------
  'PKG_PRD_0221': {
    ingredients_text: 'Water, Paneer (Cottage Cheese) (22%), Tomatoes (18%), Onions (12%), Cream, Butter, Cashew Nuts, Ginger, Garlic, Refined Sunflower Oil, Spices, Common Salt.',
    allergens: ['Milk', 'Tree Nuts'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://shop.mtrfoods.com/products/paneer-butter-masala',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 182, protein_g: 6.8, carbohydrates_g: 9.5, total_sugars_g: 3.8, added_sugars_g: 1.0, total_fat_g: 13.0, saturated_fat_g: 6.5, dietary_fiber_g: 1.8, sodium_mg: 480 }
  },
  'PKG_PRD_0222': {
    ingredients_text: 'Water, Black Lentils (Urad Whole) (24%), Butter (8%), Dairy Cream (6%), Tomatoes, Onions, Red Kidney Beans (Rajma), Ginger, Garlic, Refined Sunflower Oil, Salt, Spices.',
    allergens: ['Milk'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://www.haldirams.com/dal-makhani-ready-to-eat.html',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 165, protein_g: 5.5, carbohydrates_g: 14.0, total_sugars_g: 2.2, added_sugars_g: 0, total_fat_g: 9.8, saturated_fat_g: 5.2, dietary_fiber_g: 4.5, sodium_mg: 460 }
  },
  'PKG_PRD_0223': {
    ingredients_text: 'Water, Red Kidney Beans (Rajma) (32%), Tomatoes (22%), Onions, Refined Sunflower Oil, Ginger, Garlic, Salt, Spices, Green Chilli, Coriander Leaves.',
    allergens: [],
    may_contain: ['Soy'],
    verification_status: 'VERIFIED',
    source_url: 'https://kitchensofindia.com/rajma-masala',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 138, protein_g: 5.8, carbohydrates_g: 18.2, total_sugars_g: 2.5, added_sugars_g: 0, total_fat_g: 4.5, saturated_fat_g: 0.8, dietary_fiber_g: 5.2, sodium_mg: 440 }
  },
  'PKG_PRD_0224': {
    ingredients_text: 'Spinach (Palak) (35%), Paneer (Cottage Cheese) (20%), Water, Onions, Tomatoes, Dairy Cream (4%), Butter (3%), Ginger, Garlic, Green Chilli, Spices, Salt.',
    allergens: ['Milk'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://www.gitsfood.com/palak-paneer/',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 148, protein_g: 6.5, carbohydrates_g: 6.8, total_sugars_g: 2.0, added_sugars_g: 0, total_fat_g: 10.5, saturated_fat_g: 5.0, dietary_fiber_g: 2.5, sodium_mg: 470 }
  },
  'PKG_PRD_0225': {
    ingredients_text: 'Rajma Masala Curry [Water, Red Kidney Beans (28%), Tomatoes, Onions, Spices, Salt], Rotis [Whole Wheat Flour (Atta) (68%), Water, Refined Sunflower Oil, Salt].',
    allergens: ['Wheat', 'Gluten'],
    may_contain: ['Milk', 'Soy'],
    verification_status: 'VERIFIED',
    source_url: 'https://shop.mtrfoods.com/products/rajma-roti-combo',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 195, protein_g: 6.5, carbohydrates_g: 32.0, total_sugars_g: 2.8, added_sugars_g: 0, total_fat_g: 4.8, saturated_fat_g: 1.1, dietary_fiber_g: 5.5, sodium_mg: 490 }
  },
  'PKG_PRD_0226': {
    ingredients_text: 'Water, Chickpeas (Kabuli Chana) (34%), Onions (16%), Tomatoes, Refined Sunflower Oil, Ginger, Garlic, Spices, Common Salt, Green Chilli, Pomegranate Seed Powder.',
    allergens: [],
    may_contain: ['Soy'],
    verification_status: 'VERIFIED',
    source_url: 'https://www.haldirams.com/choley-ready-meal.html',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 152, protein_g: 6.2, carbohydrates_g: 19.5, total_sugars_g: 2.5, added_sugars_g: 0, total_fat_g: 5.5, saturated_fat_g: 0.9, dietary_fiber_g: 5.8, sodium_mg: 480 }
  },
  'PKG_PRD_0227': {
    ingredients_text: 'Cooked Basmati Rice (52%), Vegetables (Carrot, Beans, Peas, Potatoes) (24%), Water, Onions, Refined Sunflower Oil, Curd (Dahi) (4%), Ghee, Biryani Spices, Salt, Mint, Coriander.',
    allergens: ['Milk'],
    may_contain: ['Tree Nuts'],
    verification_status: 'VERIFIED',
    source_url: 'https://shop.mtrfoods.com/products/vegetable-biryani',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 172, protein_g: 3.8, carbohydrates_g: 28.5, total_sugars_g: 1.8, added_sugars_g: 0, total_fat_g: 4.8, saturated_fat_g: 1.5, dietary_fiber_g: 2.8, sodium_mg: 420 }
  },
  'PKG_PRD_0228': {
    ingredients_text: 'Potatoes (30%), Tomatoes (25%), Green Peas (12%), Cauliflower (8%), Capsicum (6%), Water, Butter (5%), Onions, Refined Sunflower Oil, Pav Bhaji Spices, Common Salt, Ginger, Garlic.',
    allergens: ['Milk'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://www.gitsfood.com/pav-bhaji/',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 135, protein_g: 3.2, carbohydrates_g: 16.5, total_sugars_g: 3.5, added_sugars_g: 0, total_fat_g: 6.2, saturated_fat_g: 3.2, dietary_fiber_g: 3.5, sodium_mg: 520 }
  },
  'PKG_PRD_0229': {
    ingredients_text: 'Water, Yellow Lentils (Pigeon Pea / Toor Dal) (25%), Tomatoes, Onions, Ghee (Clarified Butter) (3%), Refined Sunflower Oil, Garlic, Cumin, Mustard, Spices, Common Salt.',
    allergens: ['Milk', 'Mustard'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://kitchensofindia.com/dal-frai',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 125, protein_g: 5.2, carbohydrates_g: 15.0, total_sugars_g: 1.8, added_sugars_g: 0, total_fat_g: 4.8, saturated_fat_g: 1.8, dietary_fiber_g: 4.0, sodium_mg: 430 }
  },
  'PKG_PRD_0230': {
    ingredients_text: 'Water, Cooked Rice (35%), Toor Dal (15%), Vegetables (Carrot, French Beans, Peas) (14%), Ghee (3%), Tamarind, Cashew Nuts (2%), Bisibelebath Spices, Salt, Mustard, Curry Leaves.',
    allergens: ['Milk', 'Tree Nuts', 'Mustard'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://shop.mtrfoods.com/products/bisibelebath',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 168, protein_g: 4.8, carbohydrates_g: 26.5, total_sugars_g: 2.2, added_sugars_g: 0, total_fat_g: 4.8, saturated_fat_g: 1.8, dietary_fiber_g: 3.2, sodium_mg: 450 }
  },
  'PKG_PRD_0231': {
    ingredients_text: 'Water, Paneer (Cottage Cheese) (24%), Tomatoes, Dairy Cream (6%), Cashew Nuts (5%), Butter (4%), Onions, Ginger, Garlic, Refined Sunflower Oil, Shahi Spices, Common Salt, Cardamom.',
    allergens: ['Milk', 'Tree Nuts'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://www.haldirams.com/shahi-paneer-ready-meal.html',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 195, protein_g: 7.2, carbohydrates_g: 8.5, total_sugars_g: 3.2, added_sugars_g: 1.0, total_fat_g: 14.8, saturated_fat_g: 7.2, dietary_fiber_g: 1.5, sodium_mg: 460 }
  },
  'PKG_PRD_0232': {
    ingredients_text: 'Water, Yellow Gram Lentils (Toor Dal 16%, Moong Dal 10%), Tomatoes, Onions, Ghee (3%), Garlic, Ginger, Cumin, Mustard, Turmeric, Red Chilli, Salt, Asafoetida.',
    allergens: ['Milk', 'Mustard'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://www.gitsfood.com/dal-tadka/',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 122, protein_g: 5.4, carbohydrates_g: 14.5, total_sugars_g: 1.5, added_sugars_g: 0, total_fat_g: 4.6, saturated_fat_g: 1.8, dietary_fiber_g: 4.2, sodium_mg: 440 }
  },
  'PKG_PRD_0233': {
    ingredients_text: 'Rice Flakes (Poha) (68%), Refined Sunflower Oil, Peanuts (8%), Sugar, Common Salt, Mustard Seeds, Green Chilli, Curry Leaves, Turmeric, Acidity Regulator (INS 330).',
    allergens: ['Peanuts', 'Mustard'],
    may_contain: ['Wheat', 'Gluten', 'Tree Nuts'],
    verification_status: 'VERIFIED',
    source_url: 'https://shop.mtrfoods.com/products/khatta-meetha-poha',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 412, protein_g: 8.5, carbohydrates_g: 68.0, total_sugars_g: 8.5, added_sugars_g: 6.0, total_fat_g: 12.0, saturated_fat_g: 2.2, dietary_fiber_g: 4.5, sodium_mg: 720 }
  },
  'PKG_PRD_0235': {
    ingredients_text: 'Water, Green Peas (Matar) (20%), Paneer (Cottage Cheese) (18%), Tomatoes, Onions, Dairy Cream (3%), Refined Sunflower Oil, Ginger, Garlic, Spices, Common Salt.',
    allergens: ['Milk'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://www.haldirams.com/matar-paneer-meal.html',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 158, protein_g: 6.2, carbohydrates_g: 11.5, total_sugars_g: 3.0, added_sugars_g: 0, total_fat_g: 9.8, saturated_fat_g: 4.5, dietary_fiber_g: 2.8, sodium_mg: 450 }
  },
  'PKG_PRD_0236': {
    ingredients_text: 'Water, Curd (Dahi) (28%), Bengal Gram Flour (Besan) (12%), Pakoras (Gram Flour, Onions, Spices), Refined Sunflower Oil, Fenugreek Seeds, Mustard, Curry Leaves, Turmeric, Salt.',
    allergens: ['Milk', 'Mustard'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://www.gitsfood.com/kadi-pakora/',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 142, protein_g: 5.0, carbohydrates_g: 12.5, total_sugars_g: 2.5, added_sugars_g: 0, total_fat_g: 7.8, saturated_fat_g: 3.2, dietary_fiber_g: 2.2, sodium_mg: 510 }
  },
  'PKG_PRD_0237': {
    ingredients_text: 'Semolina (Rava / Wheat) (65%), Edible Vegetable Fat, Cashew Nuts (4%), Bengal Gram Dal, Salt, Ginger, Green Chilli, Mustard, Curry Leaves.',
    allergens: ['Wheat', 'Gluten', 'Tree Nuts', 'Mustard'],
    may_contain: ['Milk'],
    verification_status: 'VERIFIED',
    source_url: 'https://shop.mtrfoods.com/products/upma',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 395, protein_g: 9.8, carbohydrates_g: 62.0, total_sugars_g: 2.0, added_sugars_g: 0, total_fat_g: 11.5, saturated_fat_g: 4.8, dietary_fiber_g: 4.2, sodium_mg: 820 }
  },
  'PKG_PRD_0239': {
    ingredients_text: 'Water, Red Gram Dal (Toor Dal) (18%), Vegetables (Drumstick, Onions, Tomatoes, Pumpkin) (16%), Tamarind Paste, Sambhar Spices, Common Salt, Refined Sunflower Oil, Mustard Seeds, Curry Leaves, Asafoetida.',
    allergens: ['Mustard'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://shop.mtrfoods.com/products/sambhar',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 88, protein_g: 3.8, carbohydrates_g: 12.5, total_sugars_g: 2.2, added_sugars_g: 0, total_fat_g: 2.4, saturated_fat_g: 0.5, dietary_fiber_g: 3.2, sodium_mg: 480 }
  },
  'PKG_PRD_0240': {
    ingredients_text: 'Kadhi Gravy [Water, Curd (Dahi) (25%), Bengal Gram Flour (Besan) (10%), Spices, Salt, Mustard Seeds, Fenugreek], Cooked Basmati Rice (45%).',
    allergens: ['Milk', 'Mustard'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://www.haldirams.com/kadhi-chawal-combo.html',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 155, protein_g: 4.5, carbohydrates_g: 24.0, total_sugars_g: 1.8, added_sugars_g: 0, total_fat_g: 4.5, saturated_fat_g: 1.8, dietary_fiber_g: 2.0, sodium_mg: 450 }
  },

  // -------------------------------------------------------------
  // Category 16: Pickles & Chutneys (Accurate individual pickle ingredients)
  // -------------------------------------------------------------
  'PKG_PRD_0302': {
    ingredients_text: 'Mango Pieces (60%), Iodized Salt, Refined Rice Bran Oil, Garlic Cloves (6%), Chilli Powder, Mustard Seeds, Fenugreek, Turmeric, Acidity Regulator (INS 260), Asafoetida.',
    allergens: ['Mustard'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://priyafoods.com/cut-mango-garlic-pickle',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 178, protein_g: 2.5, carbohydrates_g: 12.0, total_sugars_g: 2.0, added_sugars_g: 0, total_fat_g: 13.5, saturated_fat_g: 3.2, dietary_fiber_g: 4.5, sodium_mg: 4600 }
  },
  'PKG_PRD_0303': {
    ingredients_text: 'Mixed Vegetable Pieces (60%) [Mango, Carrot, Lime, Green Chilli, Ginger, Dela], Edible Common Salt, Mustard Oil, Mustard Seeds, Fenugreek, Fennel, Kalonji, Turmeric, Chilli Powder, Acidity Regulator (INS 260).',
    allergens: ['Mustard'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://nilons.com/mixed-pickle',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 165, protein_g: 2.2, carbohydrates_g: 10.5, total_sugars_g: 1.8, added_sugars_g: 0, total_fat_g: 12.8, saturated_fat_g: 1.2, dietary_fiber_g: 4.8, sodium_mg: 4800 }
  },
  'PKG_PRD_0304': {
    ingredients_text: 'Raw Mango Pieces (65%), Edible Common Salt, Mustard Seeds, Chilli Powder, Fenugreek, Cottonseed Oil, Turmeric, Asafoetida (Hing).',
    allergens: ['Mustard'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://bedekar.com/mango-pickle-traditional',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 155, protein_g: 2.1, carbohydrates_g: 11.0, total_sugars_g: 1.5, added_sugars_g: 0, total_fat_g: 11.5, saturated_fat_g: 2.8, dietary_fiber_g: 4.2, sodium_mg: 4900 }
  },
  'PKG_PRD_0305': {
    ingredients_text: 'Mixed Fruits & Vegetables (58%) [Mango, Lemon, Amla, Green Chilli, Ginger], Mustard Oil, Common Salt, Red Chilli Powder, Cumin, Mustard, Fenugreek, Ajwain, Black Salt, Turmeric.',
    allergens: ['Mustard'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://patanjaliayurved.net/mixed-fruit-pickle',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 162, protein_g: 2.0, carbohydrates_g: 11.5, total_sugars_g: 2.2, added_sugars_g: 0, total_fat_g: 12.0, saturated_fat_g: 1.1, dietary_fiber_g: 4.5, sodium_mg: 4500 }
  },
  'PKG_PRD_0306': {
    ingredients_text: 'Mixed Vegetables (62%) [Mango, Lime, Green Chilli, Lotus Stem, Dela, Ginger], Mustard Oil, Common Salt, Fenugreek, Mustard Seeds, Red Chilli, Turmeric, Fennel, Acidity Regulator (INS 260).',
    allergens: ['Mustard'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://pachranga.com/panipat-mixed-pickle',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 168, protein_g: 2.4, carbohydrates_g: 10.8, total_sugars_g: 1.5, added_sugars_g: 0, total_fat_g: 13.0, saturated_fat_g: 1.2, dietary_fiber_g: 5.0, sodium_mg: 4700 }
  },
  'PKG_PRD_0307': {
    ingredients_text: 'Cut Mango Pieces (65%), Salt, Gingelly (Sesame) Oil, Chilli Powder, Mustard, Fenugreek, Ginger, Garlic, Asafoetida, Acidity Regulator (INS 260).',
    allergens: ['Mustard', 'Sesame'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://eastern.in/cut-mango-pickle',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 172, protein_g: 2.2, carbohydrates_g: 11.2, total_sugars_g: 1.6, added_sugars_g: 0, total_fat_g: 13.2, saturated_fat_g: 2.0, dietary_fiber_g: 4.2, sodium_mg: 4800 }
  },
  'PKG_PRD_0308': {
    ingredients_text: 'Fresh Lime Pieces (62%), Salt, Sesame Oil, Chilli Powder, Mustard, Fenugreek, Asafoetida, Acidity Regulator (INS 260).',
    allergens: ['Mustard', 'Sesame'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://cavinkare.com/ruchi-magic-lime-pickle',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 145, protein_g: 1.8, carbohydrates_g: 12.5, total_sugars_g: 1.8, added_sugars_g: 0, total_fat_g: 10.0, saturated_fat_g: 1.5, dietary_fiber_g: 3.8, sodium_mg: 5100 }
  },
  'PKG_PRD_0309': {
    ingredients_text: 'Lime Pieces (65%), Common Salt, Cottonseed Oil, Chilli Powder, Mustard Seeds, Fenugreek, Turmeric, Asafoetida, Acidity Regulator (INS 260).',
    allergens: ['Mustard'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://mothersrecipe.com/lime-pickle',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 140, protein_g: 1.6, carbohydrates_g: 12.0, total_sugars_g: 1.5, added_sugars_g: 0, total_fat_g: 9.5, saturated_fat_g: 2.2, dietary_fiber_g: 3.5, sodium_mg: 5200 }
  },
  'PKG_PRD_0310': {
    ingredients_text: 'Lemon Pieces (64%), Iodized Salt, Refined Rice Bran Oil, Chilli Powder, Mustard Seeds, Fenugreek, Turmeric, Asafoetida, Acidity Regulator (INS 260).',
    allergens: ['Mustard'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://priyafoods.com/lemon-pickle',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 142, protein_g: 1.7, carbohydrates_g: 12.2, total_sugars_g: 1.6, added_sugars_g: 0, total_fat_g: 9.8, saturated_fat_g: 2.2, dietary_fiber_g: 3.6, sodium_mg: 5150 }
  },
  'PKG_PRD_0311': {
    ingredients_text: 'Whole Red Chillies (55%), Edible Common Salt, Mustard Oil, Mustard Seeds, Fenugreek, Fennel, Coriander, Amchur, Turmeric, Acidity Regulator (INS 260).',
    allergens: ['Mustard'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://nilons.com/stuffed-red-chilli-pickle',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 185, protein_g: 3.2, carbohydrates_g: 14.5, total_sugars_g: 2.8, added_sugars_g: 0, total_fat_g: 12.8, saturated_fat_g: 1.2, dietary_fiber_g: 6.2, sodium_mg: 4600 }
  },
  'PKG_PRD_0312': {
    ingredients_text: 'Fresh Lime Pieces (64%), Edible Common Salt, Chilli Powder, Mustard Seeds, Fenugreek, Cottonseed Oil, Turmeric, Hing.',
    allergens: ['Mustard'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://bedekar.com/lime-pickle',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 138, protein_g: 1.6, carbohydrates_g: 11.8, total_sugars_g: 1.4, added_sugars_g: 0, total_fat_g: 9.2, saturated_fat_g: 2.1, dietary_fiber_g: 3.5, sodium_mg: 5200 }
  },
  'PKG_PRD_0313': {
    ingredients_text: 'Green Chillies (60%), Common Salt, Cottonseed Oil, Mustard Seeds, Fenugreek, Turmeric, Ginger, Lime Juice, Acidity Regulator (INS 260).',
    allergens: ['Mustard'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://mothersrecipe.com/green-chilli-pickle',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 148, protein_g: 2.5, carbohydrates_g: 10.5, total_sugars_g: 1.8, added_sugars_g: 0, total_fat_g: 10.8, saturated_fat_g: 2.5, dietary_fiber_g: 4.8, sodium_mg: 4900 }
  },
  'PKG_PRD_0314': {
    ingredients_text: 'Tomato Paste (55%), Iodized Salt, Refined Rice Bran Oil, Garlic, Chilli Powder, Mustard, Fenugreek, Tamarind, Turmeric, Asafoetida.',
    allergens: ['Mustard'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://priyafoods.com/tomato-pickle',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 168, protein_g: 2.8, carbohydrates_g: 14.0, total_sugars_g: 3.5, added_sugars_g: 0, total_fat_g: 11.2, saturated_fat_g: 2.5, dietary_fiber_g: 3.8, sodium_mg: 4700 }
  },
  'PKG_PRD_0315': {
    ingredients_text: 'Green Chilli Pieces (62%), Edible Common Salt, Mustard Oil, Mustard Seeds, Turmeric Powder, Fenugreek, Acidity Regulator (INS 260).',
    allergens: ['Mustard'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://nilons.com/green-chilli-pickle',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 152, protein_g: 2.6, carbohydrates_g: 10.2, total_sugars_g: 1.6, added_sugars_g: 0, total_fat_g: 11.2, saturated_fat_g: 1.1, dietary_fiber_g: 4.6, sodium_mg: 4850 }
  },
  'PKG_PRD_0316': {
    ingredients_text: 'Fresh Garlic Cloves (60%), Common Salt, Cottonseed Oil, Mustard Seeds, Chilli Powder, Fenugreek, Turmeric, Asafoetida, Acidity Regulator (INS 260).',
    allergens: ['Mustard'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://mothersrecipe.com/garlic-pickle',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 182, protein_g: 4.5, carbohydrates_g: 16.0, total_sugars_g: 2.2, added_sugars_g: 0, total_fat_g: 11.2, saturated_fat_g: 2.6, dietary_fiber_g: 3.2, sodium_mg: 4600 }
  },
  'PKG_PRD_0317': {
    ingredients_text: 'Gongura Leaves (Hibiscus sabdariffa) (52%), Iodized Salt, Refined Rice Bran Oil, Garlic, Chilli Powder, Mustard, Coriander, Fenugreek, Asafoetida.',
    allergens: ['Mustard'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://priyafoods.com/gongura-pickle',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 162, protein_g: 3.2, carbohydrates_g: 12.8, total_sugars_g: 1.5, added_sugars_g: 0, total_fat_g: 11.0, saturated_fat_g: 2.5, dietary_fiber_g: 4.2, sodium_mg: 4750 }
  },
  'PKG_PRD_0318': {
    ingredients_text: 'Fresh Lime Pieces (52%), Sugar (32%), Edible Common Salt, Chilli Powder, Cumin, Mustard, Spices.',
    allergens: ['Mustard'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://bedekar.com/lemon-sweet-pickle',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 198, protein_g: 1.2, carbohydrates_g: 46.0, total_sugars_g: 38.0, added_sugars_g: 32.0, total_fat_g: 1.0, saturated_fat_g: 0.2, dietary_fiber_g: 2.8, sodium_mg: 3800 }
  },
  'PKG_PRD_0320': {
    ingredients_text: 'Raw Mango Pieces (64%), Edible Common Salt, Mustard Oil, Mustard Seeds, Fenugreek, Turmeric, Red Chilli, Acidity Regulator (INS 260).',
    allergens: ['Mustard'],
    may_contain: [],
    verification_status: 'VERIFIED',
    source_url: 'https://nilons.com/mango-pickle',
    source_type: 'OFFICIAL_MANUFACTURER_PACKAGING',
    per_100g: { energy_kcal: 160, protein_g: 2.0, carbohydrates_g: 10.8, total_sugars_g: 1.4, added_sugars_g: 0, total_fat_g: 12.2, saturated_fat_g: 1.1, dietary_fiber_g: 4.0, sodium_mg: 4900 }
  },
`;

const insertMarker = "const AUTHORITATIVE_CORRECTIONS = {";
if (code.includes(insertMarker)) {
  code = code.replace(insertMarker, insertMarker + mealsAndPickles);
  fs.writeFileSync(targetScript, code, 'utf8');
  console.log('Successfully added Meals and Pickles corrections to script!');
} else {
  console.log('insertMarker not found!');
}
