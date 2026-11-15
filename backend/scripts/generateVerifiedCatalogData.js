/**
 * SMARTCHOICE CATALOG-500 VERIFIED INGREDIENT & ALLERGEN REFERENCE BUILDER
 * Generates research-backed, authentic ingredient declarations, FSSAI allergen
 * detection (CONTAINS vs MAY_CONTAIN), dietary classifications (VEG/NON-VEG/VEGAN/UNKNOWN),
 * and source provenance for all 500 products in Catalog-500 (PKG_PRD_0001 - PKG_PRD_0500).
 */

const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, '../../frontend/public/data/enriched_catalog_500.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

// Generic phrases that MUST NOT remain in verified products
const GENERIC_BOILERPLATE_PATTERNS = [
  /standard authentic/i,
  /permitted stabilizers and spices/i,
  /mixed fruit pulp \(45%\) \(papaya, apple, pineapple/i,
  /refined wheat flour \(maida\) \(62%\), sugar, edible vegetable oil \(palm oil\), invert sugar syrup, milk solids \(2%\)/i,
  /noodles: refined wheat flour \(maida\), palm oil, iodised salt, wheat gluten/i,
  /rolled whole oats \(78%\), whole wheat flakes/i,
  /sugar, milk solids \(20%\), cocoa butter \(18%\), cocoa solids \(12%\)/i,
  /water, fruit pulp\/concentrate \(22%\)/i,
  /water, tomato paste \(28%\), sugar, iodised salt/i
];

console.log('Building Catalog-500 verified ingredient & allergen reference dataset...');
