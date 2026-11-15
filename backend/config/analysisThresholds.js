const fs = require('fs');

const NUTRITION_THRESHOLDS = {
  SOLID_FOOD: {
    sugar: {
      low: { max: 5.0 },
      moderate: { min: 5.0, max: 22.5 },
      high: { min: 22.5 },
      unit: 'g',
      source: 'UK FSA FoP (2016); WHO SEARO (2017)'
    },
    fat: {
      low: { max: 3.0 },
      moderate: { min: 3.0, max: 17.5 },
      high: { min: 17.5 },
      unit: 'g',
      source: 'UK FSA FoP (2016); FSSAI Draft HFSS'
    },
    saturatedFat: {
      low: { max: 1.5 },
      moderate: { min: 1.5, max: 5.0 },
      high: { min: 5.0 },
      unit: 'g',
      source: 'UK FSA FoP (2016); WHO SEARO (2017)'
    },
    sodium: {
      low: { max: 120 },
      moderate: { min: 120, max: 600 },
      high: { min: 600 },
      unit: 'mg',
      source: 'UK FSA FoP (2016); FSSAI Draft HFSS'
    },
    salt: {
      low: { max: 0.30 },
      moderate: { min: 0.30, max: 1.50 },
      high: { min: 1.50 },
      unit: 'g',
      source: 'Salt = Sodium (g) * 2.5'
    }
  },
  BEVERAGE_GENERAL: {
    sugar: {
      low: { max: 2.5 },
      moderate: { min: 2.5, max: 11.25 },
      high: { min: 11.25 },
      unit: 'g',
      source: 'UK FSA FoP (2016); WHO SEARO (2017)'
    },
    fat: {
      low: { max: 1.5 },
      moderate: { min: 1.5, max: 8.75 },
      high: { min: 8.75 },
      unit: 'g',
      source: 'UK FSA FoP (2016)'
    },
    saturatedFat: {
      low: { max: 0.75 },
      moderate: { min: 0.75, max: 2.5 },
      high: { min: 2.5 },
      unit: 'g',
      source: 'UK FSA FoP (2016)'
    },
    sodium: {
      low: { max: 60 },
      moderate: { min: 60, max: 300 },
      high: { min: 300 },
      unit: 'mg',
      source: 'UK FSA FoP (2016)'
    },
    salt: {
      low: { max: 0.15 },
      moderate: { min: 0.15, max: 0.75 },
      high: { min: 0.75 },
      unit: 'g',
      source: 'Salt = Sodium (g) * 2.5'
    }
  },
  BEVERAGE_DAIRY: {
    sugar: {
      low: { max: 5.0 },
      moderate: { min: 5.0, max: 13.5 },
      high: { min: 13.5 },
      unit: 'g',
      source: 'UK FSA (2016) Dairy Annex (intrinsic lactose ~4.8g/100ml)'
    },
    fat: {
      low: { max: 1.5 },
      moderate: { min: 1.5, max: 8.75 },
      high: { min: 8.75 },
      unit: 'g',
      source: 'UK FSA FoP (2016)'
    },
    saturatedFat: {
      low: { max: 0.75 },
      moderate: { min: 0.75, max: 2.5 },
      high: { min: 2.5 },
      unit: 'g',
      source: 'UK FSA FoP (2016)'
    },
    sodium: {
      low: { max: 60 },
      moderate: { min: 60, max: 300 },
      high: { min: 300 },
      unit: 'mg',
      source: 'UK FSA FoP (2016)'
    },
    salt: {
      low: { max: 0.15 },
      moderate: { min: 0.15, max: 0.75 },
      high: { min: 0.75 },
      unit: 'g',
      source: 'Salt = Sodium (g) * 2.5'
    }
  },
  COOKING_OIL: {
    saturatedFat: {
      low: { max: 15.0 },
      moderate: { min: 15.0, max: 35.0 },
      high: { min: 35.0 },
      unit: 'g',
      source: 'Codex STAN 210-1999; FSA Oils Annex'
    },
    sugar: null,
    sodium: null,
    fat: null,
    salt: null
  },
  BEVERAGE_INFUSION: {
    sugar: {
      low: { max: 2.5 },
      moderate: { min: 2.5, max: 11.25 },
      high: { min: 11.25 },
      unit: 'g',
      source: 'UK FSA FoP (2016); WHO SEARO (2017) (evaluated on as-consumed infusion basis)'
    },
    fat: {
      low: { max: 1.5 },
      moderate: { min: 1.5, max: 8.75 },
      high: { min: 8.75 },
      unit: 'g',
      source: 'UK FSA FoP (2016)'
    },
    saturatedFat: {
      low: { max: 0.75 },
      moderate: { min: 0.75, max: 2.5 },
      high: { min: 2.5 },
      unit: 'g',
      source: 'UK FSA FoP (2016)'
    },
    sodium: {
      low: { max: 60 },
      moderate: { min: 60, max: 300 },
      high: { min: 300 },
      unit: 'mg',
      source: 'UK FSA FoP (2016)'
    },
    salt: {
      low: { max: 0.15 },
      moderate: { min: 0.15, max: 0.75 },
      high: { min: 0.75 },
      unit: 'g',
      source: 'Salt = Sodium (g) * 2.5'
    }
  },
  CONDIMENT_SPICE: {
    sugar: {
      low: { max: 5.0 },
      moderate: { min: 5.0, max: 22.5 },
      high: { min: 22.5 },
      unit: 'g',
      source: 'UK FSA FoP (2016)'
    },
    fat: {
      low: { max: 3.0 },
      moderate: { min: 3.0, max: 17.5 },
      high: { min: 17.5 },
      unit: 'g',
      source: 'UK FSA FoP (2016)'
    },
    saturatedFat: {
      low: { max: 1.5 },
      moderate: { min: 1.5, max: 5.0 },
      high: { min: 5.0 },
      unit: 'g',
      source: 'UK FSA FoP (2016)'
    },
    sodium: {
      low: { max: 120 },
      moderate: { min: 120, max: 600 },
      high: { min: 600 },
      unit: 'mg',
      source: 'UK FSA FoP (2016)'
    },
    salt: {
      low: { max: 0.30 },
      moderate: { min: 0.30, max: 1.50 },
      high: { min: 1.50 },
      unit: 'g',
      source: 'Salt = Sodium (g) * 2.5'
    }
  }
};

const CATEGORY_FORMAT_MAP = {
  1: 'SOLID_FOOD',         // Packaged Biscuits & Cookies
  2: 'SOLID_FOOD',         // Breakfast Cereals & Oats
  3: 'SOLID_FOOD',         // Instant Noodles & Pasta
  4: 'SOLID_FOOD',         // Chocolates & Confectionery
  5: 'BEVERAGE_GENERAL',   // Packaged Juices & Drinks
  6: 'SOLID_FOOD',         // Sauces, Ketchup & Dips
  7: 'SOLID_FOOD',         // Jams, Spreads & Honey
  8: 'SOLID_FOOD',         // Packaged Chips & Crisps
  9: 'BEVERAGE_INFUSION',  // Tea & Coffee Powders
  10: 'CONDIMENT_SPICE',   // Packaged Spices & Masalas
  11: 'COOKING_OIL',       // Cooking Oils & Ghee
  12: 'SOLID_FOOD',        // Ready-to-Eat Meals
  13: 'BEVERAGE_DAIRY',    // Packaged Dairy & Cheese
  14: 'BEVERAGE_GENERAL',  // Health & Energy Drinks
  15: 'SOLID_FOOD',        // Namkeen & Traditional Snacks
  16: 'CONDIMENT_SPICE',   // Pickles & Chutneys
  17: 'SOLID_FOOD',        // Packaged Atta, Flour & Dals
  18: 'SOLID_FOOD',        // Dry Fruits & Nuts (Packaged)
  19: 'SOLID_FOOD',        // Baking Ingredients & Cocoa
  20: 'SOLID_FOOD',        // Canned Foods & Soups
  21: 'SOLID_FOOD',        // Protein & Energy Bars
  22: 'SOLID_FOOD',        // Granola & Breakfast Bars
  23: 'BEVERAGE_GENERAL',  // Carbonated Soda & Mixers
  24: 'SOLID_FOOD',        // Custard & Dessert Mixes
  25: 'SOLID_FOOD'         // Frozen Snacks & Desserts
};

function getCategoryFormat(input) {
  if (input === null || input === undefined) return 'UNCLASSIFIED';

  // 1. Direct numeric lookup
  if (typeof input === 'number' || (typeof input === 'string' && /^\d+$/.test(input))) {
    const num = Number(input);
    if (CATEGORY_FORMAT_MAP[num]) return CATEGORY_FORMAT_MAP[num];
  }

  // 2. Object input (e.g. product or identity or catalog)
  if (typeof input === 'object') {
    const catId = input.category_id || input.categoryId || input.catalog?.categoryId || input.identity?.categoryId;
    if (catId && CATEGORY_FORMAT_MAP[catId]) return CATEGORY_FORMAT_MAP[catId];
    
    const catList = [
      input.category_name,
      input.categoryName,
      input.catalog?.categoryName,
      ...(Array.isArray(input.categories) ? input.categories : []),
      ...(Array.isArray(input.identity?.categories) ? input.identity.categories : []),
      input.product_name,
      input.productName,
      input.identity?.name,
      input.name
    ].filter(Boolean);

    if (catList.length > 0) {
      return getCategoryFormat(catList.join(' '));
    }
    return 'UNCLASSIFIED';
  }

  // 3. String lookup
  if (typeof input === 'string') {
    const str = input.toLowerCase();

    // Infusions: Tea & Coffee
    if (str.includes('tea') || str.includes('coffee') || str.includes('infusion')) return 'BEVERAGE_INFUSION';

    // Condiments & Spices
    if (str.includes('spice') || str.includes('masala') || str.includes('chili') || str.includes('chilli') || str.includes('pickle') || str.includes('chutney') || str.includes('turmeric') || str.includes('cumin') || str.includes('coriander')) {
      if (!str.includes('baking') && !str.includes('cocoa') && !str.includes('protein')) {
        return 'CONDIMENT_SPICE';
      }
    }

    // Cooking Oils & Ghee
    if (str.includes('oil') || str.includes('ghee')) return 'COOKING_OIL';

    // Dairy Beverages & Milks
    if (str.includes('dairy') || str.includes('lassi') || str.includes('yogurt drink') || str.includes('milks') || str.includes('buttermilk')) return 'BEVERAGE_DAIRY';

    // General Beverages
    if (str.includes('juice') || str.includes('soda') || str.includes('drink') || str.includes('mixer') || str.includes('beverage')) return 'BEVERAGE_GENERAL';

    // Solid foods
    if (str.includes('biscuit') || str.includes('cookie') || str.includes('cereal') || str.includes('oat') || str.includes('noodle') || str.includes('pasta') || str.includes('chocolate') || str.includes('snack') || str.includes('bar') || str.includes('atta') || str.includes('flour') || str.includes('dal') || str.includes('rice') || str.includes('wheat') || str.includes('nut') || str.includes('crisp') || str.includes('chip')) {
      return 'SOLID_FOOD';
    }
  }

  return 'UNCLASSIFIED';
}

module.exports = {
  NUTRITION_THRESHOLDS,
  CATEGORY_FORMAT_MAP,
  getCategoryFormat
};