const Product = require('../models/Product');
const scoringService = require('./scoringService');
const recommendationService = require('./recommendationService');
const { calculateProductVerification } = require('../utils/productVerification');
const { calculateAllNutrientsPerServing } = require('../utils/nutritionConversion');
const { classifyProductDietary } = require('../utils/dietaryClassifier');

const NUTRITION_FIELDS = [
  { key: 'calories', name: 'Energy', unit: 'kcal', higherIsBetter: false },
  { key: 'protein', name: 'Protein', unit: 'g', higherIsBetter: true },
  { key: 'carbohydrates', name: 'Total Carbohydrates', unit: 'g', higherIsBetter: null },
  { key: 'sugar', name: 'Total Sugars', unit: 'g', higherIsBetter: false },
  { key: 'addedSugars', name: 'Added Sugars', unit: 'g', higherIsBetter: false },
  { key: 'fat', name: 'Total Fat', unit: 'g', higherIsBetter: null },
  { key: 'saturatedFat', name: 'Saturated Fat', unit: 'g', higherIsBetter: false },
  { key: 'transFat', name: 'Trans Fat', unit: 'g', higherIsBetter: false },
  { key: 'fiber', name: 'Dietary Fibre', unit: 'g', higherIsBetter: true },
  { key: 'sodium', name: 'Sodium', unit: 'mg', higherIsBetter: false },
  { key: 'salt', name: 'Salt', unit: 'g', higherIsBetter: false }
];

const STATUTORY_ALLERGENS = [
  { key: 'gluten', label: 'Gluten / Wheat' },
  { key: 'milk', label: 'Milk / Dairy' },
  { key: 'peanuts', label: 'Peanuts' },
  { key: 'treeNuts', label: 'Tree Nuts (Almond/Cashew/Walnut)' },
  { key: 'soy', label: 'Soy / Soybeans' },
  { key: 'eggs', label: 'Eggs' },
  { key: 'fish', label: 'Fish' },
  { key: 'crustaceans', label: 'Crustaceans' },
  { key: 'sulphites', label: 'Sulphites' }
];

// Helper to normalize strings for comparison
const cleanStr = (s) => (s || '').toLowerCase().trim();

// Jaccard similarity between two arrays of tokens
const calculateJaccardSimilarity = (arr1, arr2) => {
  if (!arr1 || !arr2 || (arr1.length === 0 && arr2.length === 0)) return 0;
  const set1 = new Set(arr1.map(cleanStr).filter(Boolean));
  const set2 = new Set(arr2.map(cleanStr).filter(Boolean));
  if (set1.size === 0 && set2.size === 0) return 1.0;
  if (set1.size === 0 || set2.size === 0) return 0.0;
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
};

// Compare numeric fields
const compareNumericSim = (val1, val2, maxDiff) => {
  if (val1 == null || val2 == null) return 0;
  const diff = Math.abs(val1 - val2);
  if (diff >= maxDiff) return 0;
  return (maxDiff - diff) / maxDiff;
};

// Parse INS additives and classes
const parseAdditivesFromText = (text) => {
  if (!text) return { additives: [], insCodes: [], classes: [] };
  const insRegex = /ins\s*(\d+[a-z]?(\([a-z0-9]+\))?)|e\s*(\d+[a-z]?)/gi;
  const insCodes = [];
  let match;
  while ((match = insRegex.exec(text)) !== null) {
    insCodes.push(match[0].toUpperCase().replace(/\s+/g, ' '));
  }

  const detectedClasses = [];
  const lower = text.toLowerCase();
  if (lower.includes('emulsifi')) detectedClasses.push('Emulsifier');
  if (lower.includes('preservat')) detectedClasses.push('Preservative');
  if (lower.includes('colour') || lower.includes('color')) detectedClasses.push('Colour');
  if (lower.includes('flavour') || lower.includes('flavor')) detectedClasses.push('Flavouring');
  if (lower.includes('acidity regulator') || lower.includes('acid')) detectedClasses.push('Acidity Regulator');
  if (lower.includes('raising agent') || lower.includes('leavening')) detectedClasses.push('Leavening Agent');
  if (lower.includes('sweetener')) detectedClasses.push('Sweetener');
  if (lower.includes('antioxidant')) detectedClasses.push('Antioxidant');
  if (lower.includes('thickener') || lower.includes('stabiliz')) detectedClasses.push('Stabilizer / Thickener');

  return {
    insCodes: [...new Set(insCodes)],
    classes: [...new Set(detectedClasses)],
    hasArtificialColors: lower.includes('synthetic colour') || lower.includes('artificial colour') || lower.includes('tartrazine') || lower.includes('sunset yellow'),
    hasPreservatives: lower.includes('preservative') || lower.includes('benzoate') || lower.includes('sorbate'),
    hasArtificialSweeteners: lower.includes('sucralose') || lower.includes('aspartame') || lower.includes('acesulfame')
  };
};

/**
 * Advanced Product Comparison Engine
 */
const compareProducts = async (productIds, userPreferences = {}) => {
  if (!productIds || productIds.length < 2) {
    throw new Error('Please select at least 2 products to compare');
  }

  const uniqueIds = [...new Set(productIds)];
  const objectIds = uniqueIds.filter(id => typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/));
  const catalogIds = uniqueIds.filter(id => typeof id === 'string' && !id.match(/^[0-9a-fA-F]{24}$/));

  const queryConditions = [];
  if (objectIds.length > 0) queryConditions.push({ _id: { $in: objectIds } });
  if (catalogIds.length > 0) queryConditions.push({ 'catalog.productId': { $in: catalogIds } });

  let products = [];
  if (require('mongoose').connection.readyState === 1 && queryConditions.length > 0) {
    try {
      products = await Product.find({ $or: queryConditions }).lean();
    } catch (e) {
      console.warn("MongoDB query in comparison failed:", e.message);
    }
  }

  const catalogLoader = require('../utils/catalogLoader');
  const foundMap = new Map();
  products.forEach(p => {
    if (p._id) foundMap.set(p._id.toString(), p);
    if (p.catalog?.productId) foundMap.set(p.catalog.productId, p);
    if (p.product_id) foundMap.set(p.product_id, p);
  });

  const orderedProducts = uniqueIds.map(id => {
    if (foundMap.has(id)) return foundMap.get(id);
    return catalogLoader.getProductById(id);
  }).filter(Boolean);

  if (orderedProducts.length < 2) {
    throw new Error('Could not find enough valid products for comparison');
  }

  // 1. Normalize every product with authoritative scoring, verification & conversions
  const normalizedProducts = orderedProducts.map(p => {
    const canonicalId = p.product_id || p._id || p.catalog?.productId || 'UNKNOWN_ID';
    const brand = p.brand || p.catalog?.brand || p.identity?.brand || 'Authentic Brand';
    const name = p.product_name || p.catalog?.productName || p.identity?.name || 'Packaged Product';
    const categoryId = p.category_id || p.catalog?.categoryId || p.identity?.categoryId || 1;
    const categoryName = p.category_name || p.catalog?.categoryName || (p.identity?.categories && p.identity.categories[0]) || 'General Packaged Food';
    const packagingSize = p.packaging_size || p.catalog?.packagingSize || p.serving?.servingSize || 'Standard Pack';
    const isLiquid = (p.categoryFormat || '').includes('BEVERAGE') || (categoryName.toLowerCase().includes('drink') || categoryName.toLowerCase().includes('juice') || categoryName.toLowerCase().includes('milk'));
    const measurementBasis = isLiquid ? 'per 100ml' : 'per 100g';

    // Serving conversion
    const servingConv = calculateAllNutrientsPerServing(p);
    const p100 = servingConv.per100g || {};
    const pServ = servingConv.perServing || {};

    // Nutrients map
    const saltVal = (p100.sodium_mg != null) ? parseFloat(((p100.sodium_mg * 2.5) / 1000).toFixed(2)) : null;
    const nutrients = {
      calories: p100.energy_kcal ?? null,
      protein: p100.protein_g ?? null,
      carbohydrates: p100.carbohydrates_g ?? null,
      sugar: p100.total_sugars_g ?? null,
      addedSugars: p100.added_sugars_g ?? null,
      fat: p100.total_fat_g ?? null,
      saturatedFat: p100.saturated_fat_g ?? null,
      transFat: p100.trans_fat_g ?? null,
      fiber: p100.dietary_fiber_g ?? null,
      sodium: p100.sodium_mg ?? null,
      salt: saltVal
    };

    const servingNutrients = {
      calories: pServ.energy_kcal ?? null,
      protein: pServ.protein_g ?? null,
      carbohydrates: pServ.carbohydrates_g ?? null,
      sugar: pServ.total_sugars_g ?? null,
      addedSugars: pServ.added_sugars_g ?? null,
      fat: pServ.total_fat_g ?? null,
      saturatedFat: pServ.saturated_fat_g ?? null,
      transFat: pServ.trans_fat_g ?? null,
      fiber: pServ.dietary_fiber_g ?? null,
      sodium: pServ.sodium_mg ?? null,
      salt: (pServ.sodium_mg != null) ? parseFloat(((pServ.sodium_mg * 2.5) / 1000).toFixed(2)) : null
    };

    // Authoritative Quality Score & Breakdown (using empty prefs for baseline objective comparison)
    const baseScore = scoringService.calculateSmartChoiceScore(p, {});
    const qualityScore = baseScore.totalScore;
    const qualityBreakdown = {
      nutrition: baseScore.weightedBreakdown.nutrition,
      ingredients: baseScore.weightedBreakdown.ingredients,
      processing: baseScore.weightedBreakdown.processing,
      proteinFiber: baseScore.weightedBreakdown.proteinFiber,
      preferences: baseScore.weightedBreakdown.preferences,
      rawComponents: {
        nutrition: baseScore.breakdown.nutrition,
        ingredients: baseScore.breakdown.ingredients,
        processing: baseScore.breakdown.processing,
        proteinFiber: baseScore.breakdown.proteinFiber,
        preferences: baseScore.breakdown.preferences
      }
    };

    // Confidence Score
    const confData = scoringService.calculateConfidence(p);

    // Verification Status
    const verData = calculateProductVerification(p);

    // Completeness
    const completeness = baseScore.coverage?.overallCompleteness ?? 85;

    // Preference Match (if active preferences provided)
    let preferenceMatch = null;
    const hasActivePrefs = Object.keys(userPreferences || {}).some(k => Boolean(userPreferences[k]));
    if (hasActivePrefs) {
      const evalRes = recommendationService.evaluatePreferences(p, userPreferences);
      const matchScore = recommendationService.calculatePersonalizedScore(evalRes);
      preferenceMatch = {
        score: matchScore,
        isEligible: evalRes.isEligible,
        hardExclusionViolated: !evalRes.isEligible,
        matchCount: evalRes.matchCount,
        unknownCount: evalRes.unknownCount
      };
    }

    // Ingredients & Additives Analysis
    const rawIngText = p.nutrition_info?.ingredients_text || p.ingredients?.rawText || p.ingredients?.text || '';
    const parsedTokens = (p.ingredients?.ingredients && p.ingredients.ingredients.length > 0)
      ? p.ingredients.ingredients.map(i => (typeof i === 'string' ? i : i.name))
      : rawIngText.split(/[,;\(\)]/).map(s => s.trim()).filter(s => s.length > 1 && !s.toLowerCase().startsWith('contains') && !s.toLowerCase().startsWith('may contain'));

    const additiveInfo = parseAdditivesFromText(rawIngText);

    // Allergens Classification
    const declaredContains = (p.ingredients?.allergenDeclarations?.contains || p.nutrition_info?.allergens || p.ingredients?.allergens || []).map(cleanStr);
    const declaredMayContain = (p.ingredients?.allergenDeclarations?.mayContain || p.nutrition_info?.may_contain || []).map(cleanStr);

    const checkAllergenMatch = (declList, key) => {
      const k = key.toLowerCase();
      return declList.some(c => {
        if (c.includes(k)) return true;
        if (k === 'gluten' && (c.includes('wheat') || c.includes('barley') || c.includes('rye') || c.includes('oats') || c.includes('cereal') || c.includes('gluten') || c.includes('atta') || c.includes('maida'))) return true;
        if (k === 'treenuts' && (c.includes('nut') || c.includes('almond') || c.includes('cashew') || c.includes('walnut') || c.includes('pistachio') || c.includes('hazelnut'))) return true;
        if (k === 'milk' && (c.includes('dairy') || c.includes('milk') || c.includes('lactose') || c.includes('butter') || c.includes('cheese') || c.includes('ghee'))) return true;
        if (k === 'soy' && (c.includes('soya') || c.includes('soybean') || c.includes('lecithin'))) return true;
        if (k === 'peanuts' && (c.includes('peanut') || c.includes('groundnut'))) return true;
        if (k === 'eggs' && c.includes('egg')) return true;
        if (k === 'fish' && c.includes('fish')) return true;
        if (k === 'crustaceans' && (c.includes('prawn') || c.includes('shrimp') || c.includes('crab') || c.includes('crustacean'))) return true;
        if (k === 'sulphites' && (c.includes('sulphite') || c.includes('sulfite') || c.includes('sulfur'))) return true;
        return false;
      });
    };

    const allergenMap = {};
    STATUTORY_ALLERGENS.forEach(a => {
      const isContains = checkAllergenMatch(declaredContains, a.key);
      const isMayContain = checkAllergenMatch(declaredMayContain, a.key);
      if (isContains) allergenMap[a.key] = 'CONTAINS';
      else if (isMayContain) allergenMap[a.key] = 'MAY_CONTAIN';
      else if (verData.status === 'Verified') allergenMap[a.key] = 'VERIFIED_ABSENCE';
      else allergenMap[a.key] = 'UNKNOWN';
    });

    const classification = classifyProductDietary(p);
    const dietaryStatus = classification.status;
    const isVegan = classification.isVegan;

    return {
      productId: canonicalId,
      _id: canonicalId,
      name,
      brand,
      categoryId,
      categoryName,
      packagingSize,
      format: isLiquid ? 'LIQUID' : 'SOLID',
      measurementBasis,
      servingDisplay: servingConv.servingDisplayStr,
      nutrients,
      servingNutrients,
      qualityScore,
      qualityBreakdown,
      confidence: confData,
      verification: verData,
      completeness,
      preferenceMatch,
      novaGroup: p.processing?.novaGroup || p.nutrition_info?.nova_group || p.analysis?.processingAnalysis?.novaGroup || 3,
      ingredientsText: rawIngText,
      ingredientTokens: parsedTokens,
      additiveInfo,
      allergens: allergenMap,
      declaredContains,
      declaredMayContain,
      dietaryStatus,
      isVegan,
      dietaryClassification: classification,
      dietary_classification: classification,
      images: p.images || p.catalog?.images || p.media || {}
    };
  });

  // 2. Nutritional Comparison & Pairwise Differences
  const nutritionalComparison = {};
  const advantagesByProduct = {};
  normalizedProducts.forEach(p => {
    advantagesByProduct[p.productId] = {
      betterCount: 0,
      worseCount: 0,
      equalCount: 0,
      missingCount: 0,
      betterNutrients: [],
      worseNutrients: []
    };
  });

  NUTRITION_FIELDS.forEach(field => {
    const values = normalizedProducts.map(p => ({
      productId: p.productId,
      value: p.nutrients[field.key]
    }));

    // Find best value
    let bestVal = null;
    let bestProductId = null;
    const numericVals = values.filter(v => v.value != null);

    if (numericVals.length > 0 && field.higherIsBetter !== null) {
      if (field.higherIsBetter) {
        bestVal = Math.max(...numericVals.map(v => v.value));
      } else {
        bestVal = Math.min(...numericVals.map(v => v.value));
      }
    }

    // Differences compared to first product or mean
    const diffs = {};
    for (let i = 0; i < normalizedProducts.length; i++) {
      const pA = normalizedProducts[i];
      const valA = pA.nutrients[field.key];

      if (valA == null) {
        advantagesByProduct[pA.productId].missingCount++;
        continue;
      }

      let isBest = (bestVal != null && valA === bestVal && numericVals.length > 1);
      let isWorst = false;

      if (numericVals.length > 1 && field.higherIsBetter !== null) {
        const worstVal = field.higherIsBetter ? Math.min(...numericVals.map(v => v.value)) : Math.max(...numericVals.map(v => v.value));
        if (valA === worstVal && worstVal !== bestVal) isWorst = true;
      }

      if (isBest) {
        advantagesByProduct[pA.productId].betterCount++;
        advantagesByProduct[pA.productId].betterNutrients.push(field.name);
      } else if (isWorst) {
        advantagesByProduct[pA.productId].worseCount++;
        advantagesByProduct[pA.productId].worseNutrients.push(field.name);
      } else {
        advantagesByProduct[pA.productId].equalCount++;
      }
    }

    nutritionalComparison[field.key] = {
      name: field.name,
      unit: field.unit,
      higherIsBetter: field.higherIsBetter,
      bestVal,
      values: values.map(v => v.value)
    };
  });

  // 3. Ingredient Comparison Engine (Shared vs Unique, Additives)
  const allIngredientSets = normalizedProducts.map(p => new Set(p.ingredientTokens.map(cleanStr)));
  const commonIngredients = [];
  const uniqueIngredients = normalizedProducts.map(() => []);

  // Collect all unique tokens
  const tokenOccurrences = new Map();
  normalizedProducts.forEach((p, idx) => {
    p.ingredientTokens.forEach(token => {
      const c = cleanStr(token);
      if (!c) return;
      if (!tokenOccurrences.has(c)) {
        tokenOccurrences.set(c, { token, indices: new Set() });
      }
      tokenOccurrences.get(c).indices.add(idx);
    });
  });

  tokenOccurrences.forEach(({ token, indices }) => {
    if (indices.size === normalizedProducts.length) {
      commonIngredients.push(token);
    } else if (indices.size === 1) {
      const idx = [...indices][0];
      uniqueIngredients[idx].push(token);
    }
  });

  const ingredientComparison = {
    shared: commonIngredients,
    uniqueByProduct: uniqueIngredients.map((u, i) => ({
      productId: normalizedProducts[i].productId,
      uniqueIngredients: u
    })),
    additivesByProduct: normalizedProducts.map(p => ({
      productId: p.productId,
      insCodes: p.additiveInfo.insCodes,
      classes: p.additiveInfo.classes,
      totalCount: p.additiveInfo.insCodes.length,
      hasArtificialColors: p.additiveInfo.hasArtificialColors,
      hasPreservatives: p.additiveInfo.hasPreservatives,
      hasArtificialSweeteners: p.additiveInfo.hasArtificialSweeteners
    }))
  };

  // 4. Allergen Comparison
  const allergenComparison = {
    statutoryAllergens: STATUTORY_ALLERGENS,
    matrix: STATUTORY_ALLERGENS.map(a => {
      const row = { key: a.key, label: a.label, statuses: {} };
      normalizedProducts.forEach(p => {
        row.statuses[p.productId] = p.allergens[a.key] || 'UNKNOWN';
      });
      return row;
    }),
    sharedContains: [],
    uniqueContainsByProduct: normalizedProducts.map(p => ({
      productId: p.productId,
      allergens: p.declaredContains
    }))
  };

  // 5. Product Pairwise Similarity (SIM = 0.40C + 0.20T + 0.15S + 0.15I + 0.10N)
  const pairwiseSimilarity = [];
  for (let i = 0; i < normalizedProducts.length; i++) {
    for (let j = i + 1; j < normalizedProducts.length; j++) {
      const p1 = normalizedProducts[i];
      const p2 = normalizedProducts[j];

      // C = Category (40%)
      const catSim = (p1.categoryId === p2.categoryId) ? 1.0 : (p1.format === p2.format ? 0.3 : 0.0);

      // T = Product Type (20%)
      const typeSim = (p1.categoryName === p2.categoryName) ? 1.0 : 0.5;

      // S = Serving Size (15%)
      const s1 = parseFloat(p1.packagingSize) || 50;
      const s2 = parseFloat(p2.packagingSize) || 50;
      const servSim = compareNumericSim(s1, s2, Math.max(s1, s2, 100));

      // I = Ingredients (15%)
      const ingSim = calculateJaccardSimilarity(p1.ingredientTokens, p2.ingredientTokens);

      // N = Nutrition (10%)
      let nutSimSum = 0;
      let nutFieldsCount = 0;
      ['calories', 'protein', 'carbohydrates', 'sugar', 'fat', 'saturatedFat', 'sodium'].forEach(k => {
        const v1 = p1.nutrients[k];
        const v2 = p2.nutrients[k];
        if (v1 != null && v2 != null) {
          nutFieldsCount++;
          const maxDiff = Math.max(v1, v2, 10) * 0.5;
          nutSimSum += compareNumericSim(v1, v2, maxDiff);
        }
      });
      const nutSim = nutFieldsCount > 0 ? (nutSimSum / nutFieldsCount) : 0.5;

      const totalSim = Math.round((0.40 * catSim + 0.20 * typeSim + 0.15 * servSim + 0.15 * ingSim + 0.10 * nutSim) * 100);

      const sharedTraits = [];
      const differingTraits = [];

      if (catSim >= 0.9) sharedTraits.push('Same food category');
      else differingTraits.push('Different categories');

      if (ingSim >= 0.4) sharedTraits.push(`Share ${Math.round(ingSim * 100)}% common ingredients`);
      else differingTraits.push('Substantially different ingredient formulations');

      if (p1.novaGroup === p2.novaGroup) sharedTraits.push(`Identical NOVA Group ${p1.novaGroup} processing level`);
      else differingTraits.push(`Different processing levels (NOVA ${p1.novaGroup} vs NOVA ${p2.novaGroup})`);

      pairwiseSimilarity.push({
        productAId: p1.productId,
        productBId: p2.productId,
        productAName: p1.name,
        productBName: p2.name,
        overallSimilarity: totalSim,
        breakdown: {
          category: Math.round(catSim * 100),
          productType: Math.round(typeSim * 100),
          servingSize: Math.round(servSim * 100),
          ingredients: Math.round(ingSim * 100),
          nutrition: Math.round(nutSim * 100)
        },
        sharedTraits,
        differingTraits
      });
    }
  }

  // 6. Final Comparison Verdict: Best Product Identification
  let winner = null;
  let verdictStatus = 'DECISIVE';
  let verdictReason = '';
  let pairwiseExplanations = [];
  let uncertaintyExplanation = null;

  // Filter out any products violating hard allergen constraints
  const eligibleProducts = normalizedProducts.filter(p => !p.preferenceMatch?.hardExclusionViolated);

  if (eligibleProducts.length === 0) {
    verdictStatus = 'ALL_EXCLUDED';
    verdictReason = 'All selected products violate active user allergen safety constraints.';
  } else if (eligibleProducts.length === 1 && normalizedProducts.length > 1) {
    winner = eligibleProducts[0];
    verdictStatus = 'DECISIVE';
    verdictReason = `${winner.name} is selected as the only safe choice because the alternative products violate your active allergen safety preferences.`;
  } else {
    // Sort eligible products by Quality Score
    const sortedByScore = [...eligibleProducts].sort((a, b) => b.qualityScore - a.qualityScore);
    const topProd = sortedByScore[0];
    const secondProd = sortedByScore[1];

    const scoreDiff = topProd.qualityScore - secondProd.qualityScore;
    const topHasLowConfidence = topProd.confidence.score < 50;
    const secondHasHighConfidence = secondProd.confidence.score >= 80;

    if (scoreDiff <= 2 && (topProd.verification.status === 'Needs Review' || secondProd.verification.status === 'Needs Review')) {
      verdictStatus = 'INCONCLUSIVE';
      uncertaintyExplanation = 'Insufficient evidence to determine a clear winner due to unresolved data inconsistencies or conflicting nutritional declarations.';
    } else if (scoreDiff <= 1 && topHasLowConfidence && secondHasHighConfidence) {
      // Confidence limitation override: second product has verified evidence while top has unverified data
      winner = secondProd;
      verdictStatus = 'DECISIVE';
      verdictReason = `${secondProd.name} is selected over ${topProd.name} due to substantially higher evidentiary verification (${secondProd.confidence.score}/100 vs ${topProd.confidence.score}/100), despite nearly identical quality scores.`;
    } else {
      winner = topProd;
      verdictStatus = 'DECISIVE';

      // Build comparative explanations against each alternative
      const alternatives = normalizedProducts.filter(p => p.productId !== winner.productId);
      pairwiseExplanations = alternatives.map(alt => {
        const advNutrients = [];
        if ((winner.nutrients.protein || 0) > (alt.nutrients.protein || 0) + 1.0) {
          advNutrients.push(`${(winner.nutrients.protein - alt.nutrients.protein).toFixed(1)}g more protein`);
        }
        if ((winner.nutrients.fiber || 0) > (alt.nutrients.fiber || 0) + 1.0) {
          advNutrients.push(`${(winner.nutrients.fiber - alt.nutrients.fiber).toFixed(1)}g more dietary fibre`);
        }
        if ((winner.nutrients.sugar != null) && (alt.nutrients.sugar != null) && (alt.nutrients.sugar > winner.nutrients.sugar + 2.0)) {
          advNutrients.push(`${(alt.nutrients.sugar - winner.nutrients.sugar).toFixed(1)}g less sugar`);
        }
        if ((winner.nutrients.saturatedFat != null) && (alt.nutrients.saturatedFat != null) && (alt.nutrients.saturatedFat > winner.nutrients.saturatedFat + 1.0)) {
          advNutrients.push(`${(alt.nutrients.saturatedFat - winner.nutrients.saturatedFat).toFixed(1)}g less saturated fat`);
        }
        if ((winner.nutrients.sodium != null) && (alt.nutrients.sodium != null) && (alt.nutrients.sodium > winner.nutrients.sodium + 50)) {
          advNutrients.push(`${Math.round(alt.nutrients.sodium - winner.nutrients.sodium)}mg less sodium`);
        }

        const ingAdv = [];
        if (winner.additiveInfo.insCodes.length < alt.additiveInfo.insCodes.length) {
          ingAdv.push(`${alt.additiveInfo.insCodes.length - winner.additiveInfo.insCodes.length} fewer identified additives`);
        }
        if (!winner.additiveInfo.hasArtificialColors && alt.additiveInfo.hasArtificialColors) {
          ingAdv.push('no artificial colours');
        }
        if (!winner.additiveInfo.hasPreservatives && alt.additiveInfo.hasPreservatives) {
          ingAdv.push('no chemical preservatives');
        }

        const procAdv = (winner.novaGroup < alt.novaGroup)
          ? `lower food processing level (NOVA Group ${winner.novaGroup} vs NOVA Group ${alt.novaGroup})`
          : null;

        const parts = [];
        if (advNutrients.length > 0) parts.push(advNutrients.join(', '));
        if (ingAdv.length > 0) parts.push(ingAdv.join(', '));
        if (procAdv) parts.push(procAdv);

        const reasonsStr = parts.length > 0 ? parts.join(' and ') : 'higher composite nutritional quality';
        return {
          alternativeId: alt.productId,
          alternativeName: alt.name,
          explanation: `${winner.name} outperforms ${alt.name} with ${reasonsStr}, resulting in a SmartChoice Quality Score of ${winner.qualityScore}/100 vs ${alt.qualityScore}/100.`
        };
      });

      // Overall synthesis reason
      const primaryAlt = alternatives[0];
      const winAdv = advantagesByProduct[winner.productId].betterNutrients.slice(0, 3).join(', ');
      verdictReason = `${winner.name} is the superior overall choice with a SmartChoice Quality Score of ${winner.qualityScore}/100 (surpassing alternatives by up to ${scoreDiff} points). It demonstrates superior performance in ${winAdv || 'key macro-nutritional balance'} and carries a ${winner.verification.status} FSSAI evidentiary profile.`;
    }
  }

  const verdict = {
    status: verdictStatus,
    bestProductId: winner?.productId || null,
    bestProductName: winner?.name || null,
    bestProductScore: winner?.qualityScore || null,
    reason: verdictReason,
    pairwiseExplanations,
    uncertaintyExplanation,
    advantages: winner ? {
      nutritional: advantagesByProduct[winner.productId].betterNutrients,
      ingredients: [
        `${winner.additiveInfo.insCodes.length} additives`,
        winner.additiveInfo.hasArtificialColors ? 'Contains colours' : 'No artificial colours',
        winner.additiveInfo.hasPreservatives ? 'Contains preservatives' : 'No preservatives'
      ],
      processing: `NOVA Group ${winner.novaGroup} (${winner.novaGroup <= 2 ? 'Minimally Processed' : (winner.novaGroup === 3 ? 'Processed Food' : 'Ultra-Processed')})`,
      verification: `${winner.verification.status} (${winner.verification.percentage}% verified evidence)`
    } : null,
    tradeoffs: winner ? {
      disadvantages: advantagesByProduct[winner.productId].worseNutrients,
      missingData: advantagesByProduct[winner.productId].missingCount > 0 ? `${advantagesByProduct[winner.productId].missingCount} nutrient values unavailable` : null
    } : null
  };

  return {
    products: normalizedProducts,
    nutritionalComparison,
    ingredientComparison,
    allergenComparison,
    pairwiseSimilarity,
    advantagesByProduct,
    verdict
  };
};

module.exports = {
  compareProducts,
  NUTRITION_FIELDS,
  STATUTORY_ALLERGENS
};
