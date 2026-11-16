const { parseIngredientTokens } = require('./ingredientParsingService');
const { analyzeAdditives } = require('./additiveAnalysisService');

// Industrial fractionated / reconstituted markers
const INDUSTRIAL_INGREDIENT_REGEX = /\b(invert\s+sugar|high\s+fructose\s+corn\s+syrup|hfcs|maltodextrin|dextrose|isolated\s+soy\s+protein|soy\s+protein\s+isolate|whey\s+protein\s+concentrate|mechanically\s+separated|hydrogenated\s+vegetable\s+oil|vanaspati|modified\s+starch|interesterified|polydextrose)\b/i;

// Processing method markers
const PROCESSING_TECHNIQUE_REGEX = /\b(extruded|carbonated|pre-fried|reconstituted|bleached|hydrogenated|deodorized)\b/i;

/**
 * Classifies NOVA group strictly with evidence corroboration.
 * Category priors provide supporting context ONLY and CANNOT assign NOVA alone.
 */
function classifyNova(product) {
  const extNova = product.processing?.novaGroup || product.nutrition_info?.nova_group;
  
  // 1. Check for external reported source
  if (extNova && [1, 2, 3, 4].includes(extNova)) {
    return {
      novaGroup: extNova,
      sourceCertainty: 'SOURCE_REPORTED',
      externalProvenance: {
        sourceName: 'Open Food Facts / Manufacturer package',
        disclaimer: 'Reported by external source; not independently verified by SmartChoice.'
      },
      evidence: {
        cosmeticAdditivesDetected: [],
        industrialIngredientsDetected: [],
        processingTechniques: [],
        categoryPriorContext: product.identity?.categoryName || product.catalog?.categoryName || null,
        corroborationScore: 1
      },
      rationale: `NOVA Group ${extNova} reported by external data source.`
    };
  }

  // 2. Internal Estimation Engine
  const ingData = product.ingredients || {};
  const rawText = ingData.rawText || (Array.isArray(ingData.ingredients) && ingData.ingredients.length > 0 ? ingData.ingredients.join(', ') : null);

  if (!rawText) {
    return {
      novaGroup: null,
      sourceCertainty: 'INSUFFICIENT_DATA',
      externalProvenance: { sourceName: null, disclaimer: null },
      evidence: {
        cosmeticAdditivesDetected: [],
        industrialIngredientsDetected: [],
        processingTechniques: [],
        categoryPriorContext: product.identity?.categoryName || product.catalog?.categoryName || null,
        corroborationScore: 0
      },
      rationale: 'Missing ingredient information. Category priors alone cannot determine NOVA classification.'
    };
  }

  const tokens = parseIngredientTokens(rawText);
  const additivesResult = analyzeAdditives(rawText, tokens);

  // Line A: Cosmetic Additives
  const cosmeticAdditives = additivesResult.identifiedList.filter(a => a.isCosmetic).map(a => `${a.insNumber} (${a.primaryName})`);

  // Line B: Industrial fractionated ingredients
  const industrialIngredients = [];
  tokens.forEach(tok => {
    if (INDUSTRIAL_INGREDIENT_REGEX.test(tok)) industrialIngredients.push(tok);
  });
  if (industrialIngredients.length === 0 && INDUSTRIAL_INGREDIENT_REGEX.test(rawText)) {
    const m = rawText.match(INDUSTRIAL_INGREDIENT_REGEX);
    if (m) industrialIngredients.push(m[0]);
  }

  // Line C: Processing techniques
  const techniques = [];
  tokens.forEach(tok => {
    if (PROCESSING_TECHNIQUE_REGEX.test(tok)) techniques.push(tok);
  });
  if (techniques.length === 0 && PROCESSING_TECHNIQUE_REGEX.test(rawText)) {
    const m = rawText.match(PROCESSING_TECHNIQUE_REGEX);
    if (m) techniques.push(m[0]);
  }

  let corroborationScore = 0;
  if (cosmeticAdditives.length > 0) corroborationScore++;
  if (industrialIngredients.length > 0) corroborationScore++;
  if (techniques.length > 0) corroborationScore++;

  const categoryContext = product.identity?.categoryName || product.catalog?.categoryName || 'General';

  // NOVA 4 Rule: Requires >= 2 lines of evidence, or >= 2 cosmetic additives
  if (corroborationScore >= 2 || cosmeticAdditives.length >= 2) {
    return {
      novaGroup: 4,
      sourceCertainty: 'INTERNALLY_ESTIMATED',
      externalProvenance: { sourceName: null, disclaimer: null },
      evidence: {
        cosmeticAdditivesDetected: cosmeticAdditives,
        industrialIngredientsDetected: industrialIngredients,
        processingTechniques: techniques,
        categoryPriorContext: categoryContext,
        corroborationScore
      },
      rationale: `Classified as NOVA 4 based on ${corroborationScore} corroborated lines of evidence (Cosmetic additives: ${cosmeticAdditives.length}, Industrial ingredients: ${industrialIngredients.length}).`
    };
  }

  // NOVA 3 Rule: Processed foods (canned, salted, preserved with simple culinary additions: salt, oil, sugar)
  // Simple ingredients <= 5, no cosmetic additives, no industrial fractionated ingredients
  if (tokens.length > 0 && tokens.length <= 5 && cosmeticAdditives.length === 0 && industrialIngredients.length === 0) {
    const hasCulinaryAdditions = tokens.some(t => /\b(salt|sugar|oil|vinegar)\b/i.test(t));
    if (hasCulinaryAdditions && tokens.length > 1) {
      return {
        novaGroup: 3,
        sourceCertainty: 'INTERNALLY_ESTIMATED',
        externalProvenance: { sourceName: null, disclaimer: null },
        evidence: {
          cosmeticAdditivesDetected: [],
          industrialIngredientsDetected: [],
          processingTechniques: techniques,
          categoryPriorContext: categoryContext,
          corroborationScore: 1
        },
        rationale: 'Classified as NOVA 3 (Processed Food) composed of whole food combined with culinary ingredients (salt/sugar/oil).'
      };
    }
  }

  // NOVA 2 Rule: Pure culinary ingredients (pure salt, pure sugar, pure vegetable oil, ghee)
  const isCulinaryCategory = product.identity?.categoryId === 4 || product.identity?.categoryId === 5;
  if (isCulinaryCategory && tokens.length <= 2 && cosmeticAdditives.length === 0 && industrialIngredients.length === 0) {
    return {
      novaGroup: 2,
      sourceCertainty: 'INTERNALLY_ESTIMATED',
      externalProvenance: { sourceName: null, disclaimer: null },
      evidence: {
        cosmeticAdditivesDetected: [],
        industrialIngredientsDetected: [],
        processingTechniques: [],
        categoryPriorContext: categoryContext,
        corroborationScore: 1
      },
      rationale: 'Classified as NOVA 2 (Processed Culinary Ingredient) based on single-component lipid/mineral nature.'
    };
  }

  // NOVA 1 Rule: Single whole food ingredient (e.g., whole wheat atta, raw rice, whole pulses)
  if (tokens.length === 1 && cosmeticAdditives.length === 0 && industrialIngredients.length === 0) {
    return {
      novaGroup: 1,
      sourceCertainty: 'INTERNALLY_ESTIMATED',
      externalProvenance: { sourceName: null, disclaimer: null },
      evidence: {
        cosmeticAdditivesDetected: [],
        industrialIngredientsDetected: [],
        processingTechniques: [],
        categoryPriorContext: categoryContext,
        corroborationScore: 1
      },
      rationale: 'Classified as NOVA 1 (Unprocessed or Minimally Processed Food) consisting of a single whole food ingredient.'
    };
  }

  // Inconclusive
  return {
    novaGroup: null,
    sourceCertainty: 'INSUFFICIENT_DATA',
    externalProvenance: { sourceName: null, disclaimer: null },
    evidence: {
      cosmeticAdditivesDetected: cosmeticAdditives,
      industrialIngredientsDetected: industrialIngredients,
      processingTechniques: techniques,
      categoryPriorContext: categoryContext,
      corroborationScore
    },
    rationale: 'Ingredient profile is ambiguous without sufficient corroborated ultra-processing markers.'
  };
}

module.exports = {
  classifyNova
};