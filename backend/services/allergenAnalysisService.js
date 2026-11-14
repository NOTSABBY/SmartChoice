/**
 * FSSAI 8 Mandatory Allergen Detection Service
 * In strict compliance with Chapter 2, Regulation 5(3)(b) of FSSAI (Labelling and Display) Reg 2020 & 2026.
 */

const ALLERGEN_RULES = [
  {
    code: 'CEREALS_CONTAINING_GLUTEN',
    label: 'Cereals containing gluten (wheat, rye, barley, oats, spelt)',
    regex: /\b(wheat|atta|maida|sooji|rava|semolina|rye|barley|oats?|spelt|gluten)\b/i
  },
  {
    code: 'CRUSTACEANS',
    label: 'Crustaceans and products thereof',
    regex: /\b(crustacean|shrimp|prawn|crab|lobster|krill)\b/i
  },
  {
    code: 'MILK_AND_DAIRY',
    label: 'Milk and milk products',
    regex: /\b(milk|dairy|butter|ghee|paneer|cheese|curd|yogurt|whey|casein|caseinate|lactose|malted milk)\b/i
  },
  {
    code: 'EGGS',
    label: 'Eggs and egg products',
    regex: /\b(egg|albumen|albumin|egg powder|yolk)\b/i
  },
  {
    code: 'FISH',
    label: 'Fish and fish products',
    regex: /\b(fish|cod|salmon|tuna|anchovy|gelatin\s+from\s+fish)\b/i
  },
  {
    code: 'PEANUTS_AND_TREENUTS',
    label: 'Peanuts, tree nuts and products thereof',
    regex: /\b(peanut|groundnut|almond|cashew|walnut|pistachio|hazelnut|pecan|macadamia|tree\s*nut)\b/i
  },
  {
    code: 'SOYBEANS',
    label: 'Soybeans and products thereof',
    regex: /\b(soya|soy|soybean|soya lecithin|soy lecithin|isolated soy protein)\b/i
  },
  {
    code: 'SULPHITES',
    label: 'Sulphites in concentrations of 10mg/kg or more',
    regex: /\b(sulphite|sulfite|metabisulphite|sulphur dioxide|ins\s*220|ins\s*223|e220|e223)\b/i
  }
];

function analyzeAllergens(rawText, parsedIngredients = []) {
  if (!rawText && (!parsedIngredients || parsedIngredients.length === 0)) {
    return {
      detectionStatus: 'UNKNOWN',
      declaredAllergenClasses: [],
      availability: {
        isAvailable: false,
        allergenDeclarationPresent: false,
        inferredFromIngredients: false
      }
    };
  }

  const combinedText = [rawText || '', ...(parsedIngredients || [])].join(' ');
  const detectedAllergens = new Set();

  ALLERGEN_RULES.forEach(rule => {
    if (rule.regex.test(combinedText)) {
      detectedAllergens.add(rule.code);
    }
  });

  const declaredAllergenClasses = Array.from(detectedAllergens);

  return {
    detectionStatus: declaredAllergenClasses.length > 0 ? 'ALLERGENS_IDENTIFIED' : 'NO_ALLERGENS_DETECTED',
    declaredAllergenClasses,
    availability: {
      isAvailable: true,
      allergenDeclarationPresent: /contains|allergen/i.test(combinedText),
      inferredFromIngredients: true
    }
  };
}

module.exports = {
  ALLERGEN_RULES,
  analyzeAllergens
};