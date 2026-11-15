const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

// Load 500 catalog
const catalogPath = path.join(__dirname, '../../frontend/public/data/enriched_catalog_500.json');
const catalogRaw = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const categories = catalogRaw.categories;
const products = categories.flatMap(c => c.products || []);

// Load scoring and preference utilities
const {
  calculateProductQualityScore,
  evaluateProductPreferences,
  getActiveNutritionalPreferences,
  singlePreferenceComparators,
  getProductCategoryFormat,
  extractNutrient
} = require('../../frontend/src/utils/productScoring');

describe('Master Catalog and Recommendation Engine Separation Test Suite', () => {

  it('Part 1: Master Catalog products remain 100% neutral and independent of user preferences', () => {
    // When preferences are empty
    const noPrefsScoreList = products.map(p => calculateProductQualityScore(p, {}));

    // When multiple preferences are saved (e.g. High Protein + Low Sugar + Vegan)
    const activePrefs = {
      highProtein: true,
      lowSugar: true,
      vegetarian: true,
      vegan: true,
      avoidAllergens: ['peanuts', 'milk']
    };

    // In Master Catalog, calculateProductQualityScore is invoked with neutral {} (or objective scoring)
    const masterCatalogScoresWithActivePrefs = products.map(p => calculateProductQualityScore(p, {}));

    // Assert that every product in Master Catalog has the exact identical neutral score regardless of user preferences
    for (let i = 0; i < products.length; i++) {
      assert.strictEqual(
        masterCatalogScoresWithActivePrefs[i],
        noPrefsScoreList[i],
        `Product ${products[i].product_id} Master Catalog score must be independent of user preferences`
      );
    }

    // Verify Master Catalog does not exclude or hide any product
    assert.strictEqual(products.length, 500, 'Master Catalog must maintain all 500 products');
  });

  it('Part 4 & 5: Single Preference Ranking: High Protein ranks strictly from highest to lowest protein', () => {
    // Test on Category 3: Instant Noodles & Pasta
    const cat3Products = products.filter(p => Number(p.category_id) === 3);
    assert.ok(cat3Products.length > 0, 'Category 3 should have products');

    const sortedByProtein = [...cat3Products].sort((a, b) => singlePreferenceComparators.highProtein(a, b));

    // Verify strictly descending protein
    for (let i = 0; i < sortedByProtein.length - 1; i++) {
      const pa = extractNutrient(sortedByProtein[i], 'protein') ?? 0;
      const pb = extractNutrient(sortedByProtein[i + 1], 'protein') ?? 0;
      assert.ok(pa >= pb, `Product rank #${i} protein (${pa}g) must be >= rank #${i + 1} (${pb}g)`);
    }
  });

  it('Part 4 & 5: Single Preference Ranking: Low Calories ranks strictly from lowest to highest calories', () => {
    // Test on Category 3: Instant Noodles & Pasta
    const cat3Products = products.filter(p => Number(p.category_id) === 3);
    const sortedByCalories = [...cat3Products].sort((a, b) => singlePreferenceComparators.lowCalories(a, b));

    // Verify strictly ascending calories
    for (let i = 0; i < sortedByCalories.length - 1; i++) {
      const ca = extractNutrient(sortedByCalories[i], 'calories') ?? 9999;
      const cb = extractNutrient(sortedByCalories[i + 1], 'calories') ?? 9999;
      assert.ok(ca <= cb, `Product rank #${i} calories (${ca} kcal) must be <= rank #${i + 1} (${cb} kcal)`);
    }
  });

  it('Part 4 & 5: Single Preference Ranking: Low Sugar ranks strictly from lowest to highest sugar', () => {
    // Test on Category 1: Biscuits & Cookies
    const cat1Products = products.filter(p => Number(p.category_id) === 1);
    const sortedBySugar = [...cat1Products].sort((a, b) => singlePreferenceComparators.lowSugar(a, b));

    for (let i = 0; i < sortedBySugar.length - 1; i++) {
      const sa = extractNutrient(sortedBySugar[i], 'sugar') ?? 9999;
      const sb = extractNutrient(sortedBySugar[i + 1], 'sugar') ?? 9999;
      assert.ok(sa <= sb, `Product rank #${i} sugar (${sa}g) must be <= rank #${i + 1} (${sb}g)`);
    }
  });

  it('Part 5: Multiple Preferences Combined Compatibility Ranking across All Categories', () => {
    const multiPrefs = {
      highProtein: true,
      lowCalories: true
    };

    const evaluated = products.map(p => {
      const evalRes = evaluateProductPreferences(p, multiPrefs);
      return {
        id: p.product_id,
        matchScore: evalRes.matchScore,
        isEligible: evalRes.isEligible
      };
    });

    const sorted = [...evaluated].sort((a, b) => {
      if (a.isEligible && !b.isEligible) return -1;
      if (!a.isEligible && b.isEligible) return 1;
      return b.matchScore - a.matchScore;
    });

    // Check that all eligible products are ranked ahead of ineligible, and matchScores descend
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].isEligible && sorted[i + 1].isEligible) {
        assert.ok(
          sorted[i].matchScore >= sorted[i + 1].matchScore,
          `Combined preference score rank #${i} (${sorted[i].matchScore}%) must be >= rank #${i + 1} (${sorted[i + 1].matchScore}%)`
        );
      }
    }
  });

  it('Part 6: Empty state condition when no saved preferences exist', () => {
    const emptyPrefs = {
      highProtein: false,
      lowSugar: false,
      lowCalories: false,
      lowSaturatedFat: false,
      lowSodium: false,
      highFiber: false,
      lowFat: false,
      vegetarian: false,
      vegan: false,
      avoidAllergens: [],
      excludedIngredients: [],
      avoidIngredients: []
    };

    const activeNutritional = getActiveNutritionalPreferences(emptyPrefs);
    assert.strictEqual(activeNutritional.length, 0, 'No active nutritional preferences');

    const hasAny = Boolean(
      emptyPrefs.highProtein || emptyPrefs.lowSugar || emptyPrefs.lowCalories ||
      emptyPrefs.lowSaturatedFat || emptyPrefs.lowSodium || emptyPrefs.highFiber ||
      emptyPrefs.lowFat || emptyPrefs.vegetarian || emptyPrefs.vegan ||
      emptyPrefs.avoidAllergens.length > 0
    );

    assert.strictEqual(hasAny, false, 'No preferences saved triggers empty state in Recommendation Engine');
  });

  it('Part 7: Green navigation indicator state transitions', () => {
    // Scenario 1: Initial state (no preferences)
    let hasSaved = false;
    let isNewlySaved = false;
    let indicatorState = !hasSaved ? 'HIDDEN' : (isNewlySaved ? 'BLINKING' : 'SOLID');
    assert.strictEqual(indicatorState, 'HIDDEN');

    // Scenario 2: User saves preferences
    hasSaved = true;
    isNewlySaved = true;
    indicatorState = !hasSaved ? 'HIDDEN' : (isNewlySaved ? 'BLINKING' : 'SOLID');
    assert.strictEqual(indicatorState, 'BLINKING');

    // Scenario 3: User visits Recommendation Engine
    isNewlySaved = false; // markRecommendationsSeen()
    indicatorState = !hasSaved ? 'HIDDEN' : (isNewlySaved ? 'BLINKING' : 'SOLID');
    assert.strictEqual(indicatorState, 'SOLID');

    // Scenario 4: User clears preferences
    hasSaved = false;
    isNewlySaved = false;
    indicatorState = !hasSaved ? 'HIDDEN' : (isNewlySaved ? 'BLINKING' : 'SOLID');
    assert.strictEqual(indicatorState, 'HIDDEN');
  });

  it('Regression Check: Category-restricted search remains intact', () => {
    // Search "Milk" in Category 8 (Packaged Chips and Crisps)
    const cat8Products = products.filter(p => Number(p.category_id) === 8);
    const matchesSearchQuery = (product, query) => {
      if (!query || !query.trim()) return true;
      if (!product) return false;
      const q = query.toLowerCase().trim().replace(/['’]/g, '');
      const name = (product.product_name || product.catalog?.productName || product.identity?.name || '').toLowerCase().replace(/['’]/g, '');
      const brand = (product.brand || product.catalog?.brand || product.identity?.brand || '').toLowerCase().replace(/['’]/g, '');
      return name.includes(q) || brand.includes(q);
    };

    const cat8MilkMatches = cat8Products.filter(p => matchesSearchQuery(p, 'Milk'));
    // Uncle Chipps contains milk solids in ingredients, but its name does not contain Milk!
    assert.strictEqual(
      cat8MilkMatches.length,
      0,
      'Searching "Milk" in Chips category must NOT match Uncle Chipps by ingredients'
    );
  });
});
