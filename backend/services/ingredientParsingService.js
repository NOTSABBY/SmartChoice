const { analyzeAdditives } = require('./additiveAnalysisService');
const { analyzeAllergens } = require('./allergenAnalysisService');

/**
 * Normalizes raw ingredient strings into clean structural tokens.
 */
function parseIngredientTokens(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];

  // Remove common prefix headings
  let cleaned = rawText.replace(/^(ingredients|composition|samagri)\s*[:\-]\s*/i, '');

  // Split by common delimiters (commas, semicolons, bullets) while respecting parentheses
  const tokens = [];
  let current = '';
  let parenDepth = 0;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (char === '(' || char === '[') parenDepth++;
    else if (char === ')' || char === ']') parenDepth = Math.max(0, parenDepth - 1);

    if ((char === ',' || char === ';' || char === '•') && parenDepth === 0) {
      if (current.trim()) tokens.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) tokens.push(current.trim());

  return tokens.map(t => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/**
 * Unified ingredient, additive, and allergen analysis.
 */
function analyzeIngredientProfile(product) {
  const ingData = product.ingredients || {};
  const rawText = ingData.rawText || (Array.isArray(ingData.ingredients) && ingData.ingredients.length > 0 ? ingData.ingredients.join(', ') : null);

  let parseStatus = 'EMPTY_INGREDIENTS';
  let parsedIngredients = [];

  if (rawText) {
    parsedIngredients = parseIngredientTokens(rawText);
    parseStatus = parsedIngredients.length > 0 ? 'PARSED_SUCCESSFULLY' : 'UNPARSED_TEXT_ONLY';
  }

  // Additive analysis
  const additives = analyzeAdditives(rawText, parsedIngredients);

  // Allergen analysis
  const allergens = analyzeAllergens(rawText, parsedIngredients);

  return {
    parseStatus,
    totalIngredientCount: parsedIngredients.length,
    parsedIngredients,
    additives: {
      detectionStatus: additives.detectionStatus,
      totalDetected: additives.totalDetected,
      cosmeticCount: additives.cosmeticCount,
      identifiedList: additives.identifiedList,
      availability: additives.availability
    },
    allergens: {
      detectionStatus: allergens.detectionStatus,
      declaredAllergenClasses: allergens.declaredAllergenClasses,
      availability: allergens.availability
    }
  };
}

module.exports = {
  parseIngredientTokens,
  analyzeIngredientProfile
};