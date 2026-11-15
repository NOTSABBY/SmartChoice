const { analyzeAdditives } = require('./additiveAnalysisService');
const { analyzeAllergens } = require('./allergenAnalysisService');

const GENERIC_BOILERPLATE_PATTERNS = [
  /Standard authentic food ingredients with permitted stabilizers and spices/i,
  /Quality authentic food ingredients formulated according to Indian food standards/i,
  /Authentic packaged food formulation with permitted preservatives and seasoning/i,
  /Standard packaged food ingredients compliant with FSSAI regulations/i,
  /Authentic ingredients blended according to traditional Indian recipes/i,
  /Standard ingredients for category/i,
  /Quality authentic food formulation/i,
  /Standard formulation with permitted/i
];

function isGenericBoilerplate(text) {
  if (!text || typeof text !== 'string') return false;
  return GENERIC_BOILERPLATE_PATTERNS.some(p => p.test(text));
}

/**
 * Normalizes raw ingredient strings into clean structural tokens in order of predominance.
 */
function parseIngredientTokens(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];

  // Remove common prefix headings
  let cleaned = rawText.replace(/^(ingredients|composition|samagri)\s*[:\-]\s*/i, '');

  // Separate out any trailing allergen advisory like "Contains: ..." or "May contain: ..."
  cleaned = cleaned.replace(/\s*(?:contains|allergen\s*information|allergen\s*advice)\s*[:\-].*$/i, '');

  // Split by common delimiters (commas, semicolons, bullets) while respecting parentheses
  const rawTokens = [];
  let current = '';
  let parenDepth = 0;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (char === '(' || char === '[') parenDepth++;
    else if (char === ')' || char === ']') parenDepth = Math.max(0, parenDepth - 1);

    if ((char === ',' || char === ';' || char === '•') && parenDepth === 0) {
      if (current.trim()) rawTokens.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) rawTokens.push(current.trim());

  return rawTokens.map((t, idx) => {
    const cleanStr = t.replace(/\s+/g, ' ').trim();
    if (!cleanStr) return null;

    // Extract sub-ingredients if any: e.g. "Milk Solids (30%) (Skimmed Milk Powder, Whey Protein)"
    const allParens = [...cleanStr.matchAll(/\(([^)]+)\)/g)].map(m => m[1]);
    let subIngredients = [];
    for (const parenContent of allParens) {
      if (parenContent.includes(',') || parenContent.toLowerCase().includes('powder') || parenContent.toLowerCase().includes('protein')) {
        subIngredients = parenContent.split(/,\s*/).map(s => s.trim()).filter(Boolean);
        break;
      }
    }

    const pctMatch = cleanStr.match(/(\d+(?:\.\d+)?)\s*%/);
    const percentage = pctMatch ? parseFloat(pctMatch[1]) : null;

    const tokenObj = {
      order: idx + 1,
      name: cleanStr.replace(/\s*\([^)]*\)/g, '').trim(),
      raw: cleanStr,
      subIngredients,
      percentage
    };
    tokenObj.toString = () => cleanStr;
    return tokenObj;
  }).filter(Boolean);
}

/**
 * Unified ingredient, additive, and allergen analysis.
 */
function analyzeIngredientProfile(product) {
  const ingData = product.ingredients || {};
  const rawText = ingData.rawText || ingData.rawIngredientsText || 
    (product.nutrition_info?.ingredients_text) ||
    (Array.isArray(ingData.ingredients) && ingData.ingredients.length > 0 ? ingData.ingredients.join(', ') : null);

  const verificationStatus = ingData.verificationStatus || 
    (rawText ? 'VERIFIED' : 'INGREDIENTS_UNVERIFIED');

  let parseStatus = 'EMPTY_INGREDIENTS';
  let parsedIngredients = [];

  if (rawText && typeof rawText === 'string' && rawText.trim().length > 0) {
    parsedIngredients = parseIngredientTokens(rawText);
    parseStatus = parsedIngredients.length > 0 ? 'PARSED_SUCCESSFULLY' : 'UNPARSED_TEXT_ONLY';
  }

  // Additive analysis
  const additives = analyzeAdditives(rawText, parsedIngredients);

  // Allergen analysis (supporting explicit and inferred declarations)
  const explicitAllergens = ingData.allergenDeclarations || (product.nutrition_info?.allergens ? {
    contains: product.nutrition_info.allergens,
    mayContain: product.nutrition_info.may_contain || []
  } : null);

  const allergens = analyzeAllergens(rawText, parsedIngredients, explicitAllergens);

  return {
    parseStatus,
    verificationStatus,
    totalIngredientCount: parsedIngredients.length,
    parsedIngredients,
    rawText: rawText || null,
    sourceUrl: ingData.sourceUrl || null,
    sourceType: ingData.sourceType || null,
    additives: {
      detectionStatus: additives.detectionStatus,
      totalDetected: additives.totalDetected,
      cosmeticCount: additives.cosmeticCount,
      identifiedList: additives.identifiedList,
      availability: additives.availability
    },
    allergens: {
      detectionStatus: allergens.detectionStatus,
      contains: allergens.contains,
      mayContain: allergens.mayContain,
      declaredAllergenClasses: allergens.declaredAllergenClasses,
      specificAllergens: allergens.specificAllergens,
      availability: allergens.availability
    }
  };
}

module.exports = {
  parseIngredientTokens,
  analyzeIngredientProfile,
  isGenericBoilerplate,
  GENERIC_BOILERPLATE_PATTERNS
};
