/**
 * FSSAI 8 Mandatory Allergen Detection & Precautionary Cross-Contact Service
 * In strict compliance with Chapter 2, Regulation 5(3)(b) of FSSAI (Labelling and Display) Reg 2020 & 2026.
 * Distinguishes:
 *  A. CONTAINS: Allergen explicitly present in declared ingredients or official "Contains" declaration.
 *  B. MAY_CONTAIN: Precautionary cross-contact warning explicitly declared by manufacturer.
 *  C. UNKNOWN: Insufficient evidence to determine allergen status.
 * Maintains specific allergen identities (Peanut, Almond, Cashew, Walnut, Soy, Milk, Egg, Wheat, Fish, etc.)
 */

const SPECIFIC_ALLERGEN_RULES = [
  // 1. Cereals containing gluten
  {
    specificId: 'Wheat',
    fssaiCode: 'CEREALS_CONTAINING_GLUTEN',
    label: 'Wheat (Gluten)',
    regex: /\b(wheat|atta|maida|sooji|rava|semolina|durum wheat|spelt)\b/i
  },
  {
    specificId: 'Barley',
    fssaiCode: 'CEREALS_CONTAINING_GLUTEN',
    label: 'Barley (Gluten)',
    regex: /\b(barley|malt|malt extract|malted barley)\b/i
  },
  {
    specificId: 'Oats',
    fssaiCode: 'CEREALS_CONTAINING_GLUTEN',
    label: 'Oats (Gluten)',
    regex: /\b(oats?|rolled oats|oat flour)\b/i
  },
  {
    specificId: 'Rye',
    fssaiCode: 'CEREALS_CONTAINING_GLUTEN',
    label: 'Rye (Gluten)',
    regex: /\b(rye)\b/i
  },
  {
    specificId: 'Gluten',
    fssaiCode: 'CEREALS_CONTAINING_GLUTEN',
    label: 'Gluten',
    regex: /\b(gluten|wheat gluten)\b/i
  },

  // 2. Crustaceans
  {
    specificId: 'Crustaceans',
    fssaiCode: 'CRUSTACEANS',
    label: 'Crustaceans (Shrimp, Prawn, Crab, Lobster)',
    regex: /\b(crustacean|shrimp|prawn|crab|lobster|krill)\b/i
  },

  // 3. Milk and dairy
  {
    specificId: 'Milk',
    fssaiCode: 'MILK_AND_DAIRY',
    label: 'Milk & Dairy',
    regex: /\b(milk|dairy|butter|ghee|paneer|cheese|curd|yogurt|whey|casein|caseinate|lactose|malted milk|milk solids|cream|khoa|dairy whitener)\b/i
  },

  // 4. Eggs
  {
    specificId: 'Egg',
    fssaiCode: 'EGGS',
    label: 'Eggs & Egg Products',
    // Exclude 'eggless'
    regex: /(?<!eggless\s*)\b(egg|albumen|albumin|egg powder|egg yolk|liquid egg)\b/i
  },

  // 5. Fish
  {
    specificId: 'Fish',
    fssaiCode: 'FISH',
    label: 'Fish & Fish Products',
    regex: /\b(fish|cod|salmon|tuna|anchovy|fish gelatin|fish oil|fish sauce)\b/i
  },

  // 6. Peanuts (distinct from tree nuts)
  {
    specificId: 'Peanut',
    fssaiCode: 'PEANUTS',
    label: 'Peanuts (Groundnuts)',
    regex: /\b(peanut|groundnut|peanuts|peanut butter|peanut oil|groundnut oil|groundnut protein)\b/i
  },

  // 6b. Tree Nuts (Granular identities)
  {
    specificId: 'Almond',
    fssaiCode: 'TREE_NUTS',
    label: 'Almonds',
    regex: /\b(almond|almonds|badam)\b/i
  },
  {
    specificId: 'Cashew',
    fssaiCode: 'TREE_NUTS',
    label: 'Cashews',
    regex: /\b(cashew|cashews|kaju|cashewnut)\b/i
  },
  {
    specificId: 'Walnut',
    fssaiCode: 'TREE_NUTS',
    label: 'Walnuts',
    regex: /\b(walnut|walnuts|akhrot)\b/i
  },
  {
    specificId: 'Pistachio',
    fssaiCode: 'TREE_NUTS',
    label: 'Pistachios',
    regex: /\b(pistachio|pistachios|pista)\b/i
  },
  {
    specificId: 'Hazelnut',
    fssaiCode: 'TREE_NUTS',
    label: 'Hazelnuts',
    regex: /\b(hazelnut|hazelnuts)\b/i
  },
  {
    specificId: 'Tree Nut',
    fssaiCode: 'TREE_NUTS',
    label: 'Tree Nuts (General)',
    regex: /\b(tree\s*nuts?|pecan|macadamia)\b/i
  },

  // 7. Soybeans
  {
    specificId: 'Soy',
    fssaiCode: 'SOYBEANS',
    label: 'Soybeans & Soy Products',
    regex: /\b(soya|soy|soybean|soya lecithin|soy lecithin|isolated soy protein|hydrolysed soy protein|soya sauce|edamame)\b/i
  },

  // 8. Sulphites (>= 10mg/kg)
  {
    specificId: 'Sulphites',
    fssaiCode: 'SULPHITES',
    label: 'Sulphites (>= 10mg/kg)',
    regex: /\b(sulphite|sulfite|metabisulphite|sulphur dioxide|ins\s*220|ins\s*221|ins\s*222|ins\s*223|ins\s*224|ins\s*225|ins\s*227|ins\s*228|e220|e223)\b/i
  },

  // Additional Indian Market Common Allergens
  {
    specificId: 'Mustard',
    fssaiCode: 'MUSTARD',
    label: 'Mustard',
    regex: /\b(mustard|mustard oil|sarson|rai)\b/i
  },
  {
    specificId: 'Sesame',
    fssaiCode: 'SESAME',
    label: 'Sesame',
    regex: /\b(sesame|til|sesame oil|sesame seeds|tahini)\b/i
  },
  {
    specificId: 'Celery',
    fssaiCode: 'CELERY',
    label: 'Celery',
    regex: /\b(celery|celery salt|celery seed)\b/i
  }
];

// Legacy FSSAI codes for backwards compatibility
const ALLERGEN_RULES = [
  { code: 'CEREALS_CONTAINING_GLUTEN', label: 'Cereals containing gluten (wheat, rye, barley, oats, spelt)', regex: /\b(wheat|atta|maida|sooji|rava|semolina|rye|barley|oats?|spelt|gluten)\b/i },
  { code: 'CRUSTACEANS', label: 'Crustaceans and products thereof', regex: /\b(crustacean|shrimp|prawn|crab|lobster|krill)\b/i },
  { code: 'MILK_AND_DAIRY', label: 'Milk and milk products', regex: /\b(milk|dairy|butter|ghee|paneer|cheese|curd|yogurt|whey|casein|caseinate|lactose|malted milk)\b/i },
  { code: 'EGGS', label: 'Eggs and egg products', regex: /(?<!eggless\s*)\b(egg|albumen|albumin|egg powder|yolk)\b/i },
  { code: 'FISH', label: 'Fish and fish products', regex: /\b(fish|cod|salmon|tuna|anchovy|gelatin\s+from\s+fish)\b/i },
  { code: 'PEANUTS_AND_TREENUTS', label: 'Peanuts, tree nuts and products thereof', regex: /\b(peanut|groundnut|almond|cashew|walnut|pistachio|hazelnut|pecan|macadamia|tree\s*nut)\b/i },
  { code: 'SOYBEANS', label: 'Soybeans and products thereof', regex: /\b(soya|soy|soybean|soya lecithin|soy lecithin|isolated soy protein)\b/i },
  { code: 'SULPHITES', label: 'Sulphites in concentrations of 10mg/kg or more', regex: /\b(sulphite|sulfite|metabisulphite|sulphur dioxide|ins\s*220|ins\s*223|e220|e223)\b/i }
];

/**
 * Extracts and distinguishes CONTAINS vs MAY_CONTAIN allergens.
 * @param {string} rawText Raw ingredients and allergen declaration string
 * @param {Array<string>} parsedIngredients Array of parsed ingredient tokens
 * @param {Object} explicitDeclarations Pre-extracted { contains: [], mayContain: [] }
 */
function analyzeAllergens(rawText, parsedIngredients = [], explicitDeclarations = null) {
  if (!rawText && (!parsedIngredients || parsedIngredients.length === 0) && !explicitDeclarations) {
    return {
      detectionStatus: 'UNKNOWN',
      contains: [],
      mayContain: [],
      declaredAllergenClasses: [],
      specificAllergens: [],
      availability: {
        isAvailable: false,
        allergenDeclarationPresent: false,
        inferredFromIngredients: false,
        precautionaryWarningPresent: false
      }
    };
  }

  const text = String(rawText || '').trim();
  
  // 1. Separate formulation text from precautionary warning statements
  // Precautionary patterns: "May contain...", "Manufactured in a facility...", "Processed on equipment..."
  const precautionaryRegex = /(?:may contain|made on equipment|manufactured in a facility|traces of|processed in a plant)[^.\n;]*/i;
  const precMatch = text.match(precautionaryRegex);
  
  let ingredientsOnlyText = text;
  let precautionaryText = '';
  
  if (precMatch) {
    precautionaryText = precMatch[0];
    ingredientsOnlyText = text.replace(precautionaryRegex, '');
  }

  // Also include parsed ingredient tokens in ingredientsOnlyText
  const formulationTokens = [...(parsedIngredients || [])].filter(t => !/(?:may contain|manufactured in|traces of)/i.test(t));
  const fullFormulationText = [ingredientsOnlyText, ...formulationTokens].join(' ');

  const containsSet = new Set();
  const mayContainSet = new Set();
  const fssaiClassesSet = new Set();
  const specificAllergensSet = new Set();

  // If explicit declarations are provided, honor them
  if (explicitDeclarations) {
    (explicitDeclarations.contains || []).forEach(a => {
      containsSet.add(a);
      specificAllergensSet.add(a);
    });
    (explicitDeclarations.mayContain || []).forEach(a => {
      mayContainSet.add(a);
    });
  }

  // Scan formulation text for CONTAINS
  SPECIFIC_ALLERGEN_RULES.forEach(rule => {
    if (rule.regex.test(fullFormulationText)) {
      containsSet.add(rule.specificId);
      specificAllergensSet.add(rule.specificId);
      fssaiClassesSet.add(rule.fssaiCode);
    }
  });

  // Scan precautionary text for MAY_CONTAIN (Do NOT add to contains!)
  if (precautionaryText) {
    SPECIFIC_ALLERGEN_RULES.forEach(rule => {
      if (rule.regex.test(precautionaryText)) {
        // Only add to mayContain if not already confirmed in formulation
        if (!containsSet.has(rule.specificId)) {
          mayContainSet.add(rule.specificId);
        }
      }
    });
  }

  // Populate legacy ALLERGEN_RULES fssaiClassesSet
  ALLERGEN_RULES.forEach(rule => {
    if (rule.regex.test(fullFormulationText)) {
      fssaiClassesSet.add(rule.code);
    }
  });

  const contains = Array.from(containsSet);
  const mayContain = Array.from(mayContainSet);
  const declaredAllergenClasses = Array.from(fssaiClassesSet);
  const specificAllergens = Array.from(specificAllergensSet);

  const hasAllergens = contains.length > 0 || mayContain.length > 0;
  const detectionStatus = hasAllergens ? 'ALLERGENS_IDENTIFIED' : (text ? 'NO_ALLERGENS_DETECTED' : 'UNKNOWN');

  return {
    detectionStatus,
    contains,
    mayContain,
    declaredAllergenClasses,
    specificAllergens,
    containsEgg: contains.includes('Egg'),
    containsMilk: contains.includes('Milk'),
    containsPeanut: contains.includes('Peanut'),
    containsSoy: contains.includes('Soy'),
    containsWheat: contains.includes('Wheat'),
    availability: {
      isAvailable: Boolean(text || explicitDeclarations),
      allergenDeclarationPresent: /contains|allergen/i.test(text),
      inferredFromIngredients: contains.length > 0,
      precautionaryWarningPresent: Boolean(precautionaryText || mayContain.length > 0)
    }
  };
}

const FSSAI_MANDATORY_ALLERGENS = [
  'CEREALS_CONTAINING_GLUTEN',
  'CRUSTACEANS',
  'EGGS',
  'FISH',
  'PEANUTS',
  'TREE_NUTS',
  'SOYBEANS',
  'MILK_AND_DAIRY',
  'SULPHITES'
];

module.exports = {
  SPECIFIC_ALLERGEN_RULES,
  ALLERGEN_RULES,
  FSSAI_MANDATORY_ALLERGENS,
  analyzeAllergens,
  detectAllergens: analyzeAllergens
};
