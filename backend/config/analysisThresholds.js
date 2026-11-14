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
  }
};

const CATEGORY_FORMAT_MAP = {
  1: 'SOLID_FOOD',
  2: 'SOLID_FOOD',
  3: 'SOLID_FOOD',
  4: 'COOKING_OIL',
  5: 'SOLID_FOOD',
  6: 'SOLID_FOOD',
  7: 'BEVERAGE_DAIRY',
  8: 'SOLID_FOOD',
  9: 'SOLID_FOOD',
  10: 'SOLID_FOOD',
  11: 'BEVERAGE_GENERAL',
  12: 'BEVERAGE_GENERAL',
  13: 'BEVERAGE_GENERAL',
  14: 'SOLID_FOOD',
  15: 'SOLID_FOOD',
  16: 'SOLID_FOOD',
  17: 'SOLID_FOOD',
  18: 'SOLID_FOOD',
  19: 'SOLID_FOOD',
  20: 'SOLID_FOOD',
  21: 'BEVERAGE_GENERAL',
  22: 'SOLID_FOOD',
  23: 'SOLID_FOOD',
  24: 'SOLID_FOOD',
  25: 'SOLID_FOOD'
};

function getCategoryFormat(categoryId) {
  if (categoryId !== null && categoryId !== undefined && CATEGORY_FORMAT_MAP[categoryId]) {
    return CATEGORY_FORMAT_MAP[categoryId];
  }
  return 'UNCLASSIFIED';
}

module.exports = {
  NUTRITION_THRESHOLDS,
  CATEGORY_FORMAT_MAP,
  getCategoryFormat
};