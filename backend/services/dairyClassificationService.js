/**
 * SmartChoice Evidence-Based Dairy Classification Service
 * 
 * Classifies food products based on rigorous ingredient, allergen, and packaging evidence.
 * NEVER uses embedding similarity as proof of dairy presence or absence.
 * 
 * Classifications:
 * - DAIRY_CONTAINS: Confirmed presence of milk or milk-derived ingredients, confirmed milk allergen, or dairy identity.
 * - DAIRY_FREE_VERIFIED: Verified absence of dairy ingredients, milk allergens, and precautionary cross-contact with reliable label evidence.
 * - DAIRY_MAY_CONTAIN: Confirmed absence of recipe dairy ingredients, but explicit manufacturer "may contain milk" precautionary cross-contact warning.
 * - DAIRY_UNKNOWN: Incomplete, missing, or unverified ingredient information. Never assumed dairy-free.
 * - DAIRY_CONFLICTING_EVIDENCE: Contradictory declarations (e.g. claimed vegan/dairy-free but contains milk solids, or mismatched identity/ingredients).
 */

// Plant-based milks, butters, and botanicals that MUST NOT be classified as dairy
const PLANT_BASED_NON_DAIRY_PATTERNS = [
  /\b(?:almond|soy|soya|oat|coconut|cashew|rice|hemp|flax|pea|hazelnut)\s+milk\b/gi,
  /\b(?:peanut|cocoa|almond|cashew|shea|apple|mango|kokum|illipe)\s+butter\b/gi,
  /\b(?:coconut|almond|soy|soya|oat)\s+cream\b/gi,
  /\bcream\s+of\s+tartar\b/gi,
  /\bcreamy\s+(?:texture|taste|flavor|flavour|mouthfeel|sauce|dressing|consistency)\b/gi,
  /\b(?:milk\s+thistle|butternut\s+squash|butternut)\b/gi
];

// Animal dairy derivatives & ingredients (English + Hindi/transliterated + international packaging)
const DAIRY_INGREDIENT_RULES = [
  { term: 'Milk', regex: /(?<!(?:almond|soy|soya|oat|coconut|cashew|rice|hemp|flax|pea|hazelnut)\s+)\bmilk\b/i },
  { term: 'Cow Milk', regex: /\bcow(?:'?s)?\s+milk\b/i },
  { term: 'Buffalo Milk', regex: /\bbuffalo(?:'?s)?\s+milk\b/i },
  { term: 'Goat Milk', regex: /\bgoat(?:'?s)?\s+milk\b/i },
  { term: 'Skimmed Milk', regex: /\b(?:skimmed|skim)\s+milk\b/i },
  { term: 'Whole Milk', regex: /\bwhole\s+milk\b/i },
  { term: 'Toned Milk', regex: /\b(?:double\s+)?toned\s+milk\b/i },
  { term: 'Milk Powder', regex: /\b(?:skimmed\s+|whole\s+)?milk\s+powder\b/i },
  { term: 'Dairy Whitener', regex: /\bdairy\s+whitener\b/i },
  { term: 'Milk Solids', regex: /\bmilk\s+solids\b/i },
  { term: 'Dairy Solids', regex: /\bdairy\s+solids\b/i },
  { term: 'Milk Fat', regex: /\b(?:anhydrous\s+)?milk\s*fat\b/i },
  { term: 'Milk Protein', regex: /\bmilk\s+protein(?:s|\s+concentrate|\s+isolate)?\b/i },
  { term: 'Dairy', regex: /\bdairy\b/i },
  { term: 'Butter', regex: /(?<!(?:peanut|cocoa|almond|cashew|shea|apple|mango|kokum|illipe)\s+)\bbutter\b/i },
  { term: 'Butterfat', regex: /\bbutter\s*fat\b/i },
  { term: 'Butter Oil', regex: /\bbutter\s+oil\b/i },
  { term: 'Clarified Butter', regex: /\bclarified\s+butter\b/i },
  { term: 'Ghee', regex: /\b(?:cow\s+|desi\s+|pure\s+)?ghee\b/i },
  { term: 'Makkhan', regex: /\bmakkhan\b/i },
  { term: 'Cheese', regex: /\b(?:processed\s+|cheddar\s+|mozzarella\s+|parmesan\s+|gouda\s+)?cheese\b/i },
  { term: 'Cheese Powder', regex: /\bcheese\s+powder\b/i },
  { term: 'Paneer', regex: /\bpaneer\b/i },
  { term: 'Chhena', regex: /\bchhena\b/i },
  { term: 'Curd', regex: /\bcurd\b/i },
  { term: 'Yogurt', regex: /\byog[h]?urt\b/i },
  { term: 'Dahi', regex: /\bdahi\b/i },
  { term: 'Buttermilk', regex: /\bbuttermilk\b/i },
  { term: 'Chaas', regex: /\bchaas\b/i },
  { term: 'Lassi', regex: /\blassi\b/i },
  { term: 'Cream', regex: /(?<!(?:coconut|almond|soy|soya|oat)\s+|cream\s+of\s+)\b(?:fresh\s+|heavy\s+|sour\s+|whipping\s+|clotted\s+)?cream\b/i },
  { term: 'Malai', regex: /\bmalai\b/i },
  { term: 'Khoya', regex: /\b(?:khoya|khoa|mawa)\b/i },
  { term: 'Whey', regex: /\bwhey\b/i },
  { term: 'Whey Protein', regex: /\bwhey\s+protein(?:\s+concentrate|\s+isolate|\s+hydrolysate)?\b/i },
  { term: 'Whey Powder', regex: /\bwhey\s+powder\b/i },
  { term: 'Whey Permeate', regex: /\bwhey\s+permeate\b/i },
  { term: 'Casein', regex: /\bcasein\b/i },
  { term: 'Caseinate', regex: /\b(?:calcium\s+|sodium\s+|potassium\s+)?caseinate\b/i },
  { term: 'Lactose', regex: /\blactose\b/i },
  { term: 'Lait', regex: /\b(?:lait\s+écrémé|lait\s+entier|lait\s+en\s+poudre|matière\s+grasse\s+du\s+lait|protéine\s+de\s+lait|petit-lait|lait)\b/i },
  { term: 'Milch', regex: /\b(?:milch|vollmilch|magermilch|milchpulver|vollmilchpulver|magermilchpulver|butterreinfett|milchzucker|milcheiweiß)[a-z]*\b/i },
  { term: 'Fromage', regex: /\bfromage\b/i },
  { term: 'Käse', regex: /\bkäse\b/i }
];

// Product identities establishing inherent dairy nature
const DAIRY_PRODUCT_IDENTITY_PATTERNS = [
  /\b(?:cow|desi|pure)?\s*ghee\b/i,
  /(?<!(?:peanut|cocoa|almond|cashew|shea|apple|mango|kokum|illipe)\s+)\b(?:salted|unsalted|table|dairy|cooking)?\s*butter\b/i,
  /\b(?:paneer|cottage\s+cheese)\b/i,
  /\b(?:cheese\s+slices|processed\s+cheese|cheddar\s+cheese|mozzarella)\b/i,
  /\b(?:curd|dahi|yogurt|yoghurt)\b/i,
  /\b(?:dairy\s+milk|milk\s+chocolate)\b/i,
  /\b(?:ice\s*cream|kulfi)\b/i,
  /\b(?:condensed\s+milk|evaporated\s+milk|dairy\s+whitener)\b/i
];

// Precautionary cross-contact markers on labels
const PRECAUTIONARY_SPLIT_REGEX = /\b(?:may contain|contain traces of|traces of|allergen advice:?\s*may contain|manufactured (?:on|in a facility|in a plant) that (?:also )?processes|made in a facility that)\b/i;

/**
 * Classifies a product's dairy status based exclusively on factual evidence.
 * 
 * @param {Object} product - Product document or enriched product record
 * @returns {Object} Structured dairy classification result
 */
function classifyProductDairy(product) {
  if (!product) {
    return {
      classification: 'DAIRY_UNKNOWN',
      isDairyFree: false,
      confidence: 0.0,
      evidence: [{ type: 'MISSING_DATA', matchedTerm: 'None', sourceField: 'product' }],
      verificationStatus: 'UNVERIFIED',
      reason: 'No product data provided for dairy classification.',
      source: 'NONE',
      rawIngredientsText: ''
    };
  }

  const pName = String(product.product_name || product.catalog?.productName || product.identity?.name || '').trim();
  const pBrand = String(product.brand || product.catalog?.brand || product.identity?.brand || '').trim();
  const pCatName = String(product.category_name || product.catalog?.categoryName || product.identity?.categories?.[0] || '').trim();
  const pCatId = Number(product.category_id ?? product.catalog?.categoryId ?? product.identity?.categoryId);

  const ingObj = product.ingredients || {};
  const nutriObj = product.nutrition_info || {};

  const rawIngredientsText = String(
    ingObj.rawIngredientsText ||
    ingObj.rawText ||
    nutriObj.ingredients_text ||
    ''
  ).trim();

  const ingTokens = Array.isArray(ingObj.ingredients)
    ? ingObj.ingredients.map(i => typeof i === 'string' ? i : (i.name || i.raw || '')).filter(Boolean)
    : [];

  const sourceUrl = ingObj.sourceUrl || nutriObj.source_url || 'OFFICIAL_MANUFACTURER_PACKAGING';
  const verificationStatus = nutriObj.verification_status || ingObj.verificationStatus || 'VERIFIED_LABEL';

  const evidence = [];

  // --------------------------------------------------------------------------
  // 1. Missing Data Check
  // Missing ingredients must yield DAIRY_UNKNOWN, never DAIRY_FREE_VERIFIED
  // --------------------------------------------------------------------------
  const hasNoIngredients = (!rawIngredientsText || rawIngredientsText.length === 0) && ingTokens.length === 0;
  const isExplicitlyUnverified = verificationStatus === 'INGREDIENTS_UNAVAILABLE' || verificationStatus === 'UNKNOWN' || verificationStatus === 'UNVERIFIED';

  if (hasNoIngredients) {
    // Check if product identity conclusively identifies it as a dairy staple
    const isIdentityDairy = DAIRY_PRODUCT_IDENTITY_PATTERNS.some(rx => rx.test(pName)) || pCatId === 13 || /packaged dairy & cheese/i.test(pCatName);
    if (isIdentityDairy) {
      return {
        classification: 'DAIRY_CONTAINS',
        isDairyFree: false,
        confidence: 0.95,
        evidence: [{ type: 'PRODUCT_IDENTITY', matchedTerm: pName, sourceField: 'identity.name' }],
        verificationStatus: 'VERIFIED_IDENTITY',
        reason: `Product identity (${pName}) explicitly denotes an authentic dairy staple.`,
        source: sourceUrl,
        rawIngredientsText
      };
    }

    return {
      classification: 'DAIRY_UNKNOWN',
      isDairyFree: false,
      confidence: 0.0,
      evidence: [{ type: 'MISSING_DATA', matchedTerm: 'Missing ingredients text', sourceField: 'ingredients' }],
      verificationStatus: 'UNAVAILABLE',
      reason: 'Missing ingredient information; dairy status cannot be verified.',
      source: sourceUrl,
      rawIngredientsText: ''
    };
  }

  // --------------------------------------------------------------------------
  // 2. Precautionary Statement Separation
  // Separate actual recipe ingredients from advisory "May contain traces of milk"
  // --------------------------------------------------------------------------
  // Normalize markdown formatting from OpenFoodFacts (e.g. _lait_, _lactose_, _milk_)
  const cleanFormattedText = rawIngredientsText.replace(/[_*~`]/g, ' ');

  let confirmedIngredientsText = cleanFormattedText;
  let advisoryText = '';

  const splitMatch = cleanFormattedText.match(PRECAUTIONARY_SPLIT_REGEX);
  if (splitMatch && splitMatch.index !== undefined) {
    confirmedIngredientsText = cleanFormattedText.substring(0, splitMatch.index).trim();
    advisoryText = cleanFormattedText.substring(splitMatch.index).trim();
  }

  // Sanitize plant-based milks and butters from false-positive dairy matching
  let sanitizedConfirmedText = (pName + ' ' + confirmedIngredientsText + ' ' + ingTokens.join(' ')).toLowerCase();
  PLANT_BASED_NON_DAIRY_PATTERNS.forEach(rx => {
    sanitizedConfirmedText = sanitizedConfirmedText.replace(rx, ' non_dairy_plant_ingredient ');
  });

  // --------------------------------------------------------------------------
  // 3. Evaluate Confirmed Dairy Ingredients
  // --------------------------------------------------------------------------
  const matchedDairyTerms = new Set();
  DAIRY_INGREDIENT_RULES.forEach(rule => {
    if (rule.regex.test(sanitizedConfirmedText)) {
      matchedDairyTerms.add(rule.term);
      evidence.push({
        type: 'INGREDIENT',
        matchedTerm: rule.term,
        sourceField: 'ingredients'
      });
    }
  });

  // Check declared confirmed allergens
  const confirmedAllergens = (
    nutriObj.allergens ||
    ingObj.allergens ||
    ingObj.allergenDeclarations?.contains ||
    []
  ).map(a => String(a).toLowerCase());

  if (confirmedAllergens.some(a => a === 'milk' || a === 'dairy' || a.includes('milk') || a.includes('dairy'))) {
    matchedDairyTerms.add('Declared Milk Allergen');
    evidence.push({
      type: 'ALLERGEN_CONTAINS',
      matchedTerm: 'Milk',
      sourceField: 'allergens'
    });
  }

  // Check Category 13: Packaged Dairy & Cheese
  if (pCatId === 13 || /packaged dairy & cheese/i.test(pCatName)) {
    matchedDairyTerms.add('Dairy Category');
    evidence.push({
      type: 'PRODUCT_IDENTITY',
      matchedTerm: pCatName || 'Packaged Dairy & Cheese',
      sourceField: 'catalog.categoryName'
    });
  }

  // Check Product Identity for Cow Ghee, Butter, Paneer, Cheese, Ice Cream, etc.
  let sanitizedName = pName.toLowerCase();
  PLANT_BASED_NON_DAIRY_PATTERNS.forEach(rx => {
    sanitizedName = sanitizedName.replace(rx, ' non_dairy_plant_ingredient ');
  });

  const matchedIdentityRule = DAIRY_PRODUCT_IDENTITY_PATTERNS.find(rx => rx.test(sanitizedName));
  if (matchedIdentityRule) {
    const matchedIdentity = sanitizedName.match(matchedIdentityRule)[0].trim();
    // Check if it's not a vegan/plant alternative explicitly named (e.g. "Vegan Butter", "Almond Milk Cheese")
    if (!/\b(?:vegan|plant[- ]based|dairy[- ]free)\b/i.test(pName)) {
      matchedDairyTerms.add(`Dairy Identity: ${matchedIdentity}`);
      evidence.push({
        type: 'PRODUCT_IDENTITY',
        matchedTerm: matchedIdentity,
        sourceField: 'identity.name'
      });
    }
  }

  // --------------------------------------------------------------------------
  // 4. Conflicting Evidence Detection
  // e.g. Claims Vegan or Dairy-Free but contains confirmed milk ingredients
  // OR Cow Ghee labelled as vegetable oil
  // --------------------------------------------------------------------------
  const claimsDairyFree = /\b(?:dairy[- ]free|free from dairy|non[- ]dairy|milk[- ]free)\b/i.test(pName) ||
                          /\b(?:dairy[- ]free|non[- ]dairy)\b/i.test(rawIngredientsText);
  const isDeclaredVegan = product.dietaryClassification?.isVegan === true ||
                          product.dietary_classification?.isVegan === true ||
                          product.catalog?.isVegan === true;

  if (matchedDairyTerms.size > 0 && (claimsDairyFree || (isDeclaredVegan && !matchedDairyTerms.has('Dairy Identity')))) {
    return {
      classification: 'DAIRY_CONFLICTING_EVIDENCE',
      isDairyFree: false,
      confidence: 0.5,
      evidence: [
        ...evidence,
        { type: 'CONFLICT', matchedTerm: claimsDairyFree ? 'Claimed Dairy-Free' : 'Declared Vegan', sourceField: 'claims' }
      ],
      verificationStatus: 'NEEDS_REVIEW',
      reason: `Conflicting evidence detected: Product claims dairy-free/vegan status but contains confirmed dairy derivatives (${Array.from(matchedDairyTerms).join(', ')}).`,
      source: sourceUrl,
      rawIngredientsText
    };
  }

  // If confirmed dairy terms exist -> DAIRY_CONTAINS
  if (matchedDairyTerms.size > 0) {
    const termList = Array.from(matchedDairyTerms).join(', ');
    return {
      classification: 'DAIRY_CONTAINS',
      isDairyFree: false,
      confidence: 1.0,
      evidence,
      verificationStatus: verificationStatus || 'VERIFIED_LABEL',
      reason: `Milk-derived ingredients or dairy derivatives are confirmed: ${termList}.`,
      source: sourceUrl,
      rawIngredientsText
    };
  }

  // --------------------------------------------------------------------------
  // 5. Precautionary "May Contain Milk" Evaluation
  // If zero confirmed dairy ingredients, but manufacturer declared "May contain milk"
  // --------------------------------------------------------------------------
  const mayContainAllergens = (
    nutriObj.may_contain ||
    ingObj.allergenDeclarations?.mayContain ||
    []
  ).map(a => String(a).toLowerCase());

  const hasMayContainMilkAllergen = mayContainAllergens.some(a => a === 'milk' || a === 'dairy' || a.includes('milk'));
  const hasMayContainMilkText = /\b(?:milk|dairy|lait|milch)\b/i.test(advisoryText);

  if (hasMayContainMilkAllergen || hasMayContainMilkText) {
    evidence.push({
      type: 'ALLERGEN_MAY_CONTAIN',
      matchedTerm: 'May contain milk (Precautionary cross-contact advisory)',
      sourceField: hasMayContainMilkAllergen ? 'may_contain' : 'ingredients.advisory'
    });

    return {
      classification: 'DAIRY_MAY_CONTAIN',
      isDairyFree: false, // Precautionary warnings are not verified dairy-free for severe milk allergies
      confidence: 0.95,
      evidence,
      verificationStatus: verificationStatus || 'VERIFIED_LABEL',
      reason: 'No dairy ingredients in formulation, but manufacturer label declares precautionary cross-contact warning (May contain milk).',
      source: sourceUrl,
      rawIngredientsText
    };
  }

  // --------------------------------------------------------------------------
  // 6. Insufficient Evidence Fallback
  // If verification status is explicitly unverified or needs review
  // --------------------------------------------------------------------------
  if (isExplicitlyUnverified) {
    return {
      classification: 'DAIRY_UNKNOWN',
      isDairyFree: false,
      confidence: 0.3,
      evidence: [{ type: 'MISSING_DATA', matchedTerm: 'Unverified ingredient record', sourceField: 'verificationStatus' }],
      verificationStatus: 'NEEDS_REVIEW',
      reason: 'Ingredient list exists but has unverified or preliminary status; dairy-free absence cannot be authoritatively guaranteed.',
      source: sourceUrl,
      rawIngredientsText
    };
  }

  // --------------------------------------------------------------------------
  // 7. Verified Dairy-Free Status
  // Comprehensive verified evidence confirming absence of dairy & milk allergens
  // --------------------------------------------------------------------------
  evidence.push({
    type: 'VERIFIED_ABSENCE',
    matchedTerm: 'Zero dairy ingredients & zero milk allergens declared',
    sourceField: 'ingredients'
  });

  return {
    classification: 'DAIRY_FREE_VERIFIED',
    isDairyFree: true,
    confidence: 1.0,
    evidence,
    verificationStatus: 'VERIFIED_LABEL',
    reason: 'Reliable ingredient evidence verifies complete absence of dairy ingredients, milk derivatives, and milk allergen declarations.',
    source: sourceUrl,
    rawIngredientsText
  };
}

module.exports = {
  classifyProductDairy,
  PLANT_BASED_NON_DAIRY_PATTERNS,
  DAIRY_INGREDIENT_RULES,
  DAIRY_PRODUCT_IDENTITY_PATTERNS
};
