/**
 * SmartChoice Semantic Eligibility Service
 * 
 * Determines whether a product is eligible for a given semantic search query
 * STRICTLY based on product name and product identity.
 * 
 * ABSOLUTE RESTRICTIONS:
 * - NO ingredient lists.
 * - NO nutrition facts.
 * - NO allergen lists.
 * - NO processing information.
 * - NO scores or metadata.
 * 
 * Authoritative field: Product Name (with canonical category context).
 */

const { extractProductSemanticProfile, isDairyProductIdentity, isPlantBasedAlternative } = require('./productNameSemanticService');

/**
 * Evaluates whether a product is eligible for the parsed semantic intent.
 * @param {Object} product - Product record (catalog object or plain object)
 * @param {Object} intent - Parsed semantic intent from semanticIntentService
 * @returns {Object} - { isEligible, rejectionReason, matchedConcepts, relevanceBoost }
 */
function evaluateProductSemanticEligibility(product, intent) {
  const name = product.product_name || product.catalog?.productName || product.identity?.name || '';
  const brand = product.brand || product.catalog?.brand || product.identity?.brand || '';
  const categoryId = product.category_id ?? product.catalog?.categoryId ?? product.identity?.categoryId;
  const categoryName = product.category_name || product.catalog?.categoryName || '';

  const profile = extractProductSemanticProfile(name, { brand, categoryId, categoryName });

  // --------------------------------------------------------------------------
  // 1. ALTERNATIVE-SEEKING INTENT
  // e.g. "milk alternatives", "plant-based alternatives to dairy"
  // --------------------------------------------------------------------------
  if (intent.isSeekingAlternatives || intent.queryType === 'ALTERNATIVE_SEEKING') {
    if (profile.isPlantBasedAlternative) {
      return {
        isEligible: true,
        relevanceBoost: 100,
        matchedConcepts: ['plant_alternative'],
        explanation: `Matches plant-based alternative identity: ${profile.cleanName}`
      };
    }
    return {
      isEligible: false,
      rejectionReason: `Product name does not identify as a plant-based dairy alternative`
    };
  }

  // --------------------------------------------------------------------------
  // 2. NEGATIVE EXCLUSIONS
  // e.g. "dairy-free", "milk-free", "non-dairy", "products without dairy"
  // --------------------------------------------------------------------------
  if (intent.excludedConcepts.includes('dairy') || intent.excludedConcepts.includes('milk')) {
    // If the product name identifies it as a dairy product, it MUST be excluded!
    if (profile.isDairyProduct) {
      return {
        isEligible: false,
        rejectionReason: `Product identity (${profile.cleanName}) is a dairy product, excluded by negative query`
      };
    }

    // Crucial check: Non-dairy alternatives (e.g. Almond Milk, Peanut Butter)
    // MUST NOT be excluded simply because they contain the word "milk" or "butter"!
    if (profile.isPlantBasedAlternative) {
      // Retained as valid non-dairy identity
    }
  }

  if (intent.excludedConcepts.includes('gluten')) {
    if (/\b(?:atta|maida|wheat|sooji|rava|semolina|noodles?|pasta|macaroni|biscuit|biscuits|cookies?)\b/i.test(profile.normalizedText)) {
      return {
        isEligible: false,
        rejectionReason: `Product name indicates a gluten-containing grain or bakery product`
      };
    }
  }

  if (intent.excludedConcepts.includes('caffeine')) {
    if (/\b(?:coffee|espresso|cappuccino|tea|chai|energy\s*drink)\b/i.test(profile.normalizedText)) {
      return {
        isEligible: false,
        rejectionReason: `Product name indicates a caffeinated coffee or beverage`
      };
    }
  }

  // --------------------------------------------------------------------------
  // 3. COMPOUND QUERIES (Positive target + Negative exclusion)
  // e.g. "chocolate without dairy", "non-dairy chocolate"
  // --------------------------------------------------------------------------
  if (intent.queryType === 'COMPOUND_MODIFIED') {
    // If the query excludes dairy, ANY dairy product identity (e.g. ice cream, dairy chocolate) MUST be excluded!
    if (intent.excludedConcepts.includes('dairy') && profile.isDairyProduct) {
      return {
        isEligible: false,
        rejectionReason: `Product identity (${profile.cleanName}) is a dairy product, excluded by negative constraint`
      };
    }

    // Must match the positive concept(s)
    let matchesTarget = false;
    for (const concept of intent.targetConcepts) {
      if (profile.concepts.includes(concept) || profile.normalizedText.includes(concept)) {
        matchesTarget = true;
        break;
      }
    }

    if (!matchesTarget) {
      return {
        isEligible: false,
        rejectionReason: `Product name does not identify as ${intent.targetConcepts.join('/')}`
      };
    }

    // In "chocolate without dairy", milk chocolate, milkybar, or dairy milk is contradictory!
    if (intent.excludedConcepts.includes('dairy') && intent.targetConcepts.includes('chocolate')) {
      if (/\b(?:milk\s*chocolate|dairy\s*milk|white\s*chocolate|milkybar)\b/i.test(profile.normalizedText)) {
        return {
          isEligible: false,
          rejectionReason: `Milk chocolate contradicts dairy-free requirement`
        };
      }
    }

    return {
      isEligible: true,
      relevanceBoost: 95,
      matchedConcepts: intent.targetConcepts,
      explanation: `Matches target ${intent.targetConcepts.join('/')} and respects exclusions`
    };
  }

  // --------------------------------------------------------------------------
  // 4. POSITIVE CONCEPT RETRIEVAL
  // e.g. "dairy", "milk", "cheese", "chocolate", "biscuits", "snacks", etc.
  // --------------------------------------------------------------------------
  if (intent.queryType === 'POSITIVE') {
    // Case 4X: Full-catalogue status queries (e.g. "products containing milk", "products that may contain milk")
    if (intent.targetConcepts.includes('dairy_contains_all') || intent.targetConcepts.includes('dairy_may_contain_all')) {
      return {
        isEligible: true,
        relevanceBoost: 80,
        matchedConcepts: ['dairy_status_match'],
        explanation: `Matches requested dairy status evaluation`
      };
    }

    // Case 4A: Seeking Dairy Products (e.g. query: "dairy")
    if (intent.targetConcepts.includes('dairy')) {
      if (!profile.isDairyProduct) {
        return {
          isEligible: false,
          rejectionReason: `Product name does not identify as a dairy product`
        };
      }
      return {
        isEligible: true,
        relevanceBoost: 90,
        matchedConcepts: ['dairy'],
        explanation: `Product name represents dairy product identity: ${profile.cleanName}`
      };
    }

    // Case 4B: Seeking Milk (e.g. query: "milk")
    if (intent.targetConcepts.includes('milk')) {
      // Must identify as milk beverage/pack or plant-based milk alternative
      const isMilkName = /\b(?:milk|toned\s*milk|cow\s*milk|fresh\s*milk|skimmed\s*milk|almond\s*milk|soy\s*milk|oat\s*milk)\b/i.test(profile.normalizedText);
      const isConfectioneryOrBakery = /\b(?:chocolate|choco|cadbury|milkybar|biscuit|biscuits|cookie|cookies|bar|shake\s*mix|ice\s*cream|kulfi|cake)\b/i.test(profile.normalizedText);

      if (isMilkName && !isConfectioneryOrBakery) {
        return {
          isEligible: true,
          relevanceBoost: 95,
          matchedConcepts: ['milk'],
          explanation: `Product name represents milk identity: ${profile.cleanName}`
        };
      }
      return {
        isEligible: false,
        rejectionReason: `Product is not a milk beverage/staple (name indicates ${profile.primaryType})`
      };
    }

    // Case 4C: Seeking Cheese (e.g. query: "cheese")
    if (intent.targetConcepts.includes('cheese')) {
      const isCheesePrimary = /\b(?:cheese|cheddar|mozzarella|parmesan|gouda|cheezza)\b/i.test(profile.normalizedText);
      const isFlavoredSnackOrDip = /\b(?:chips|crisps|nachos?|tortilla|wafers?|popcorn|pasta|noodles?|nuggets?|dip|dips|sauce)\b/i.test(profile.normalizedText);

      if (isCheesePrimary && !isFlavoredSnackOrDip) {
        return {
          isEligible: true,
          relevanceBoost: 95,
          matchedConcepts: ['cheese'],
          explanation: `Product name represents cheese identity: ${profile.cleanName}`
        };
      }
      return {
        isEligible: false,
        rejectionReason: `Product is not a cheese product (name indicates snack, dip, or pasta)`
      };
    }

    // Case 4D: Seeking Chocolate
    if (intent.targetConcepts.includes('chocolate')) {
      if (profile.concepts.includes('chocolate') || /\b(?:chocolate|choco|cocoa|cacao)\b/i.test(profile.normalizedText)) {
        return {
          isEligible: true,
          relevanceBoost: 95,
          matchedConcepts: ['chocolate'],
          explanation: `Product name represents chocolate identity: ${profile.cleanName}`
        };
      }
      return {
        isEligible: false,
        rejectionReason: `Product name does not identify as a chocolate product`
      };
    }

    // Case 4E: General Positive Concept Matching (Biscuits, Snacks, Juice, Cereal, Noodles, Oil, etc.)
    for (const concept of intent.targetConcepts) {
      if (profile.concepts.includes(concept) || profile.normalizedText.includes(concept)) {
        return {
          isEligible: true,
          relevanceBoost: 85,
          matchedConcepts: [concept],
          explanation: `Product name matches ${concept} concept: ${profile.cleanName}`
        };
      }
    }

    // If query targeted specific concepts but this product matches none, reject
    if (intent.targetConcepts.length > 0) {
      return {
        isEligible: false,
        rejectionReason: `Product name does not match requested concepts: ${intent.targetConcepts.join(', ')}`
      };
    }
  }

  // --------------------------------------------------------------------------
  // 5. NEGATIVE-ONLY QUERIES (e.g. "dairy-free", "non-dairy")
  // All products whose names are NOT excluded are eligible!
  // --------------------------------------------------------------------------
  if (intent.queryType === 'NEGATIVE_EXCLUSION') {
    return {
      isEligible: true,
      relevanceBoost: 70,
      matchedConcepts: ['non_excluded'],
      explanation: `Product identity (${profile.cleanName}) satisfies negative exclusion constraint`
    };
  }

  // --------------------------------------------------------------------------
  // 6. GENERAL SEARCH (Lexical / Semantic token overlap on product name)
  // --------------------------------------------------------------------------
  const queryTokens = intent.tokens || [];
  const nameTokens = profile.tokens || [];
  const hasTokenMatch = queryTokens.some(qt => nameTokens.includes(qt) || profile.normalizedText.includes(qt));

  if (hasTokenMatch) {
    return {
      isEligible: true,
      relevanceBoost: 60,
      matchedConcepts: ['token_match'],
      explanation: `Product name contains query terms`
    };
  }

  return {
    isEligible: true, // Allow general semantic ranking to score relevance
    relevanceBoost: 40,
    matchedConcepts: [],
    explanation: `General catalogue match`
  };
}

module.exports = {
  evaluateProductSemanticEligibility
};
