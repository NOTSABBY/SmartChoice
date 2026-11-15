/**
 * SmartChoice Authoritative Global Dietary Eligibility Utility (Frontend ES Module)
 * 
 * Enforces strict exclusion rules and dietary lifestyle policies across:
 * - Master Catalog (Strict Allergen and Ingredient exclusions ONLY; neutral to dietary lifestyle)
 * - Recommendation Engine (Strict Allergen and Ingredient exclusions + Vegetarian/Vegan lifestyle rules)
 * - Semantic Search (Scoped by calling page)
 * - Category Switching & Pagination
 * 
 * Dietary Selection Matrix (Recommendation Engine only):
 * | Vegetarian | Vegan | Eligible Classifications |
 * | OFF        | OFF   | All classifications      |
 * | ON         | OFF   | VEGETARIAN only          |
 * | OFF        | ON    | VEGAN only               |
 * | ON         | ON    | VEGETARIAN and VEGAN     |
 * (UNKNOWN is excluded whenever any dietary restriction is active)
 */

import { classifyProductDietary } from './dietaryClassifier';

export const ALLERGEN_PATTERNS = {
  peanut: /\b(peanut|peanuts|groundnut|groundnuts|arachis)\b/i,
  peanuts: /\b(peanut|peanuts|groundnut|groundnuts|arachis)\b/i,
  groundnut: /\b(peanut|peanuts|groundnut|groundnuts|arachis)\b/i,
  treenut: /\b(tree\s*nuts?|almond|almonds|badam|cashew|cashews|kaju|walnut|walnuts|akhrot|pistachio|pistachios|pista|hazelnut|hazelnuts|pecan|macadamia)\b/i,
  treenuts: /\b(tree\s*nuts?|almond|almonds|badam|cashew|cashews|kaju|walnut|walnuts|akhrot|pistachio|pistachios|pista|hazelnut|hazelnuts|pecan|macadamia)\b/i,
  'tree nut': /\b(tree\s*nuts?|almond|almonds|badam|cashew|cashews|kaju|walnut|walnuts|akhrot|pistachio|pistachios|pista|hazelnut|hazelnuts|pecan|macadamia)\b/i,
  'tree nuts': /\b(tree\s*nuts?|almond|almonds|badam|cashew|cashews|kaju|walnut|walnuts|akhrot|pistachio|pistachios|pista|hazelnut|hazelnuts|pecan|macadamia)\b/i,
  nut: /\b(tree\s*nuts?|almond|almonds|badam|cashew|cashews|kaju|walnut|walnuts|akhrot|pistachio|pistachios|pista|hazelnut|hazelnuts|pecan|macadamia|peanut|peanuts)\b/i,
  nuts: /\b(tree\s*nuts?|almond|almonds|badam|cashew|cashews|kaju|walnut|walnuts|akhrot|pistachio|pistachios|pista|hazelnut|hazelnuts|pecan|macadamia|peanut|peanuts)\b/i,
  almond: /\b(almond|almonds|badam)\b/i,
  cashew: /\b(cashew|cashews|kaju)\b/i,
  walnut: /\b(walnut|walnuts|akhrot)\b/i,
  pistachio: /\b(pistachio|pistachios|pista)\b/i,
  hazelnut: /\b(hazelnut|hazelnuts)\b/i,
  gluten: /\b(gluten|wheat|atta|maida|sooji|rava|semolina|durum wheat|spelt|barley|malt|malted|rye|oats?)\b/i,
  wheat: /\b(wheat|atta|maida|sooji|rava|semolina|durum wheat|spelt|gluten)\b/i,
  barley: /\b(barley|malt|malted|malted barley)\b/i,
  oats: /\b(oats?|rolled oats|oat flour)\b/i,
  milk: /\b(milk|dairy|butter|ghee|paneer|cheese|curd|yogurt|whey|casein|caseinate|lactose|malted milk|milk solids|cream|khoa|dairy whitener)\b/i,
  dairy: /\b(milk|dairy|butter|ghee|paneer|cheese|curd|yogurt|whey|casein|caseinate|lactose|malted milk|milk solids|cream|khoa|dairy whitener)\b/i,
  lactose: /\b(lactose|milk solids|dairy)\b/i,
  soy: /\b(soya|soy|soybean|soya lecithin|soy lecithin|isolated soy protein|hydrolysed soy protein|soya sauce|edamame)\b/i,
  soya: /\b(soya|soy|soybean|soya lecithin|soy lecithin|isolated soy protein|hydrolysed soy protein|soya sauce|edamame)\b/i,
  soybean: /\b(soya|soy|soybean|soya lecithin|soy lecithin|isolated soy protein|hydrolysed soy protein|soya sauce|edamame)\b/i,
  egg: /(?<!eggless\s*)\b(egg|eggs|albumen|albumin|egg powder|egg yolk|liquid egg)\b/i,
  eggs: /(?<!eggless\s*)\b(egg|eggs|albumen|albumin|egg powder|egg yolk|liquid egg)\b/i,
  fish: /\b(fish|cod|salmon|tuna|anchovy|fish gelatin|fish oil|fish sauce)\b/i,
  crustacean: /\b(crustacean|crustaceans|shrimp|prawn|prawns|crab|lobster|krill|shellfish)\b/i,
  crustaceans: /\b(crustacean|crustaceans|shrimp|prawn|prawns|crab|lobster|krill|shellfish)\b/i,
  shellfish: /\b(crustacean|crustaceans|shrimp|prawn|prawns|crab|lobster|krill|shellfish)\b/i,
  sulphite: /\b(sulphite|sulphites|sulfite|sulfites|metabisulphite|sulphur dioxide|ins\s*220|ins\s*221|ins\s*222|ins\s*223|ins\s*224|ins\s*225|ins\s*227|ins\s*228|e220|e223)\b/i,
  sulphites: /\b(sulphite|sulphites|sulfite|sulfites|metabisulphite|sulphur dioxide|ins\s*220|ins\s*221|ins\s*222|ins\s*223|ins\s*224|ins\s*225|ins\s*227|ins\s*228|e220|e223)\b/i,
  sulfite: /\b(sulphite|sulphites|sulfite|sulfites|metabisulphite|sulphur dioxide|ins\s*220|ins\s*221|ins\s*222|ins\s*223|ins\s*224|ins\s*225|ins\s*227|ins\s*228|e220|e223)\b/i,
  sulfites: /\b(sulphite|sulphites|sulfite|sulfites|metabisulphite|sulphur dioxide|ins\s*220|ins\s*221|ins\s*222|ins\s*223|ins\s*224|ins\s*225|ins\s*227|ins\s*228|e220|e223)\b/i,
  mustard: /\b(mustard|mustard oil|sarson|rai)\b/i,
  sesame: /\b(sesame|til|sesame oil|sesame seeds|tahini)\b/i,
  celery: /\b(celery|celery salt|celery seed)\b/i
};

export const INGREDIENT_SYNONYMS = {
  'palm oil': /\b(palm oil|palmate|palmitate|palm kernel|elaeis guineensis|fractionated palm|rbd palm oil)\b/i,
  'msg': /\b(msg|monosodium glutamate|monosodium l-glutamate|e621|ins\s*621|flavour enhancer 621)\b/i,
  'monosodium glutamate': /\b(msg|monosodium glutamate|monosodium l-glutamate|e621|ins\s*621|flavour enhancer 621)\b/i,
  'artificial color': /\b(artificial colou?r|synthetic colou?r|tartrazine|sunset yellow|allura red|carmoisine|brilliant blue|ponceau 4r|ins\s*102|ins\s*110|ins\s*129|ins\s*122|ins\s*133|e102|e110|e129|e122|e133)\b/i,
  'artificial colors': /\b(artificial colou?r|synthetic colou?r|tartrazine|sunset yellow|allura red|carmoisine|brilliant blue|ponceau 4r|ins\s*102|ins\s*110|ins\s*129|ins\s*122|ins\s*133|e102|e110|e129|e122|e133)\b/i,
  'artificial colour': /\b(artificial colou?r|synthetic colou?r|tartrazine|sunset yellow|allura red|carmoisine|brilliant blue|ponceau 4r|ins\s*102|ins\s*110|ins\s*129|ins\s*122|ins\s*133|e102|e110|e129|e122|e133)\b/i,
  'artificial colours': /\b(artificial colou?r|synthetic colou?r|tartrazine|sunset yellow|allura red|carmoisine|brilliant blue|ponceau 4r|ins\s*102|ins\s*110|ins\s*129|ins\s*122|ins\s*133|e102|e110|e129|e122|e133)\b/i,
  'high fructose corn syrup': /\b(high fructose corn syrup|hfcs|isoglucose|glucose-fructose syrup)\b/i,
  'hfcs': /\b(high fructose corn syrup|hfcs|isoglucose|glucose-fructose syrup)\b/i,
  'aspartame': /\b(aspartame|nutrasweet|ins\s*951|e951)\b/i,
  'sucralose': /\b(sucralose|splenda|ins\s*955|e955)\b/i,
  'preservative': /\b(preservatives?|sodium benzoate|potassium sorbate|ins\s*211|ins\s*202|e211|e202)\b/i,
  'preservatives': /\b(preservatives?|sodium benzoate|potassium sorbate|ins\s*211|ins\s*202|e211|e202)\b/i
};

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Evaluates whether a product meets all active restrictions.
 * @param {Object} product - Product record
 * @param {Object} preferences - User preferences object
 * @param {Object} [options] - Options { scope: 'catalog' | 'recommendation' | 'all' }
 * @returns {Object} { eligible: boolean, reasons: string[], matchedRules: Object }
 */
export function evaluateProductEligibility(product, preferences = {}, options = {}) {
  const reasons = [];
  const matchedRules = {
    dietary: null,
    allergens: [],
    ingredients: []
  };

  if (!product || !preferences) {
    return { eligible: true, reasons: [], matchedRules };
  }

  // Determine whether dietary lifestyle (Vegetarian/Vegan) applies.
  // By statutory requirement (Part 2 & 5), dietary lifestyle applies ONLY to Recommendation Engine.
  // Master Catalog remains independent of Vegetarian and Vegan selections.
  const scope = options.scope || (options.isRecommendationEngine ? 'recommendation' : (options.isMasterCatalog ? 'catalog' : 'all'));
  const applyDietaryLifestyle = scope !== 'catalog';

  // -------------------------------------------------------------
  // 1. DIETARY LIFESTYLE FILTERING (Recommendation Engine Scope)
  // -------------------------------------------------------------
  if (applyDietaryLifestyle) {
    const wantVegan = Boolean(preferences.vegan);
    const wantVegetarian = Boolean(preferences.vegetarian);

    if (wantVegan || wantVegetarian) {
      const dietary = classifyProductDietary(product);
      const status = dietary.status; // 'VEGAN' | 'VEGETARIAN' | 'NON_VEGETARIAN' | 'UNKNOWN'

      // Case 1: Vegetarian ON, Vegan OFF -> Strictly VEGETARIAN only (exclude VEGAN, NON-VEG, UNKNOWN)
      if (wantVegetarian && !wantVegan) {
        if (status === 'VEGAN') {
          reasons.push('Excluded by Vegetarian-only filter: Product is classified as VEGAN. Vegetarian-only selection requires strictly VEGETARIAN products.');
          matchedRules.dietary = 'EXCLUDED_VEGAN_BY_VEGETARIAN_ONLY';
        } else if (status === 'NON_VEGETARIAN') {
          reasons.push('Excluded by Vegetarian filter: Product contains confirmed animal or non-vegetarian ingredients.');
          matchedRules.dietary = 'EXCLUDED_NON_VEG';
        } else if (status === 'UNKNOWN') {
          reasons.push('Excluded by Vegetarian filter: Dietary classification is unknown or unverified.');
          matchedRules.dietary = 'EXCLUDED_UNKNOWN_VEG';
        }
      }
      // Case 2: Vegetarian OFF, Vegan ON -> Strictly VEGAN only (exclude VEGETARIAN, NON-VEG, UNKNOWN)
      else if (!wantVegetarian && wantVegan) {
        if (status === 'VEGETARIAN') {
          reasons.push('Excluded by Vegan filter: Product is vegetarian but contains dairy, honey, or animal derivatives and is not 100% vegan.');
          matchedRules.dietary = 'EXCLUDED_NON_VEGAN_VEGETARIAN';
        } else if (status === 'NON_VEGETARIAN') {
          reasons.push('Excluded by Vegan filter: Product contains confirmed animal-derived ingredients or non-vegetarian formulation.');
          matchedRules.dietary = 'EXCLUDED_NON_VEG';
        } else if (status === 'UNKNOWN') {
          reasons.push('Excluded by Vegan filter: Vegan status is unverified or unknown; plant-based certification cannot be confirmed.');
          matchedRules.dietary = 'EXCLUDED_UNKNOWN_VEGAN';
        }
      }
      // Case 3: Both Vegetarian ON, Vegan ON -> Allow both VEGETARIAN and VEGAN (exclude NON-VEG and UNKNOWN)
      else if (wantVegetarian && wantVegan) {
        if (status === 'NON_VEGETARIAN') {
          reasons.push('Excluded by dietary filter: Product contains confirmed animal or non-vegetarian ingredients.');
          matchedRules.dietary = 'EXCLUDED_NON_VEG';
        } else if (status === 'UNKNOWN') {
          reasons.push('Excluded by dietary filter: Dietary classification is unknown or unverified.');
          matchedRules.dietary = 'EXCLUDED_UNKNOWN';
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 2. STRICT ALLERGEN AVOIDANCE (Global Scope: Catalog + Recommendation)
  // -------------------------------------------------------------
  const rawAvoidAllergens = Array.isArray(preferences.avoidAllergens)
    ? preferences.avoidAllergens
    : (typeof preferences.avoidAllergens === 'string' ? preferences.avoidAllergens.split(',') : []);

  const avoidAllergens = Array.from(new Set(
    rawAvoidAllergens
      .map(a => String(a).trim().toLowerCase())
      .filter(Boolean)
  ));

  if (avoidAllergens.length > 0) {
    const ingObj = product.ingredients || {};
    const allergenDecl = ingObj.allergenDeclarations || {};
    const confirmedContains = (allergenDecl.contains || ingObj.allergens || product.nutrition_info?.allergens || [])
      .map(x => String(x).toLowerCase());
    const mayContain = (allergenDecl.mayContain || ingObj.mayContain || product.nutrition_info?.may_contain || [])
      .map(x => String(x).toLowerCase());
    const allergenStatus = String(allergenDecl.status || ingObj.analysis?.status || '').toUpperCase();

    const rawIngText = String(ingObj.rawIngredientsText || ingObj.rawText || product.nutrition_info?.ingredients_text || '').toLowerCase();
    
    // Decouple formulation text from precautionary warning statements (e.g. "May contain...")
    const precautionaryRegex = /(?:may contain|made on equipment|manufactured in a facility|traces of|processed in a plant)[^.\n;]*/i;
    const precMatch = rawIngText.match(precautionaryRegex);
    const formulationText = precMatch ? rawIngText.replace(precautionaryRegex, '') : rawIngText;
    const precautionaryTextFromRaw = precMatch ? precMatch[0] : '';

    const ingTokens = Array.isArray(ingObj.ingredients)
      ? ingObj.ingredients.map(t => typeof t === 'string' ? t.toLowerCase() : (t.name || t.raw || '').toLowerCase())
      : [];
    const fullFormulationText = [formulationText, ...ingTokens].join(' ');

    const hasNoIngredientInfo = fullFormulationText.trim().length === 0 && ingTokens.length === 0;

    for (const allergen of avoidAllergens) {
      const pattern = ALLERGEN_PATTERNS[allergen] || new RegExp('\\b' + escapeRegex(allergen) + '\\b', 'i');

      // 1. Confirmed presence (CONTAINS)
      const inContains = confirmedContains.some(c => c.includes(allergen) || pattern.test(c));
      const inFormulation = pattern.test(fullFormulationText);

      if (inContains || inFormulation) {
        reasons.push(`Excluded by strict allergen policy: Confirmed presence of avoided allergen "${allergen}".`);
        matchedRules.allergens.push({ allergen, type: 'CONTAINS' });
        continue;
      }

      // 2. Precautionary advisory (MAY CONTAIN)
      const inMayContain = mayContain.some(m => m.includes(allergen) || pattern.test(m));
      const inRawPrecautionary = pattern.test(precautionaryTextFromRaw);

      if (inMayContain || inRawPrecautionary) {
        reasons.push(`Excluded by strict allergen policy: Advisory cross-contact warning (May Contain) for avoided allergen "${allergen}".`);
        matchedRules.allergens.push({ allergen, type: 'MAY_CONTAIN' });
        continue;
      }

      // 3. Unresolved UNKNOWN allergen status where absence cannot be established reliably
      if (allergenStatus === 'UNKNOWN' || (hasNoIngredientInfo && confirmedContains.length === 0)) {
        reasons.push(`Excluded by strict allergen policy: Allergen declaration is unverified/unknown for "${allergen}"; absence cannot be confirmed.`);
        matchedRules.allergens.push({ allergen, type: 'UNKNOWN_ABSENCE' });
        continue;
      }
    }
  }

  // -------------------------------------------------------------
  // 3. EXCLUDED INGREDIENTS & SYNONYMS (Global Scope: Catalog + Recommendation)
  // -------------------------------------------------------------
  const rawExcluded = [
    ...(Array.isArray(preferences.excludedIngredients) ? preferences.excludedIngredients : []),
    ...(Array.isArray(preferences.avoidIngredients) ? preferences.avoidIngredients : [])
  ];

  const excludedList = Array.from(new Set(
    rawExcluded
      .map(i => String(i).trim().toLowerCase())
      .filter(Boolean)
  ));

  if (excludedList.length > 0) {
    const ingObj = product.ingredients || {};
    const rawIngText = String(ingObj.rawIngredientsText || ingObj.rawText || product.nutrition_info?.ingredients_text || '').toLowerCase();
    const ingTokens = Array.isArray(ingObj.ingredients)
      ? ingObj.ingredients.map(t => typeof t === 'string' ? t.toLowerCase() : (t.name || t.raw || '').toLowerCase())
      : [];
    const additives = Array.isArray(ingObj.additives)
      ? ingObj.additives.map(a => String(a).toLowerCase())
      : [];
    
    // Sub-ingredients
    const subIngs = ingObj.subIngredients && typeof ingObj.subIngredients === 'object'
      ? Object.values(ingObj.subIngredients).flat().map(s => String(s).toLowerCase())
      : [];

    const fullFormulationText = [rawIngText, ...ingTokens, ...additives, ...subIngs].join(' ');
    const hasIncompleteIngredients = fullFormulationText.trim().length === 0;

    for (const excluded of excludedList) {
      if (hasIncompleteIngredients) {
        reasons.push(`Excluded by strict ingredient exclusion: Ingredient formulation is incomplete/unavailable for verification of "${excluded}".`);
        matchedRules.ingredients.push({ ingredient: excluded, type: 'INCOMPLETE_DATA' });
        continue;
      }

      const pattern = INGREDIENT_SYNONYMS[excluded] || new RegExp('\\b' + escapeRegex(excluded) + '\\b', 'i');

      if (pattern.test(fullFormulationText)) {
        reasons.push(`Excluded by strict ingredient policy: Contains excluded ingredient or synonym "${excluded}".`);
        matchedRules.ingredients.push({ ingredient: excluded, type: 'CONFIRMED' });
      }
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    matchedRules
  };
}

export function isProductGloballyEligible(product, preferences = {}, options = {}) {
  return evaluateProductEligibility(product, preferences, options).eligible;
}
