import React, { useState, useEffect } from 'react';
import { useComparison } from '../context/ComparisonContext';
import { usePreferences } from '../context/PreferenceContext';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Trash2,
  Scale,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Award,
  Layers,
  ChevronRight,
  Zap,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Info,
  Flame,
  Check,
  X,
  Plus
} from 'lucide-react';
import { compareProducts } from '../services/comparisonService';
import { generatePackshotSvgClient } from '../utils/packshotFallback';
import { calculateProductQualityScore, calculateProductConfidence, calculateProductBreakdown } from '../utils/productScoring';
import { calculateProductVerification } from '../utils/productVerification';
import { calculateAllNutrientsPerServing } from '../utils/nutritionConversion';
import { DietaryEmblem } from '../components/DietaryEmblem';

export const ComparePage = () => {
  const { compareList, removeProduct, clearProducts, getCanonicalId } = useComparison();
  const { preferences, hasSavedPreferences } = usePreferences();
  const [compData, setCompData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeBasis, setActiveBasis] = useState('per100g'); // 'per100g' or 'perServing'

  useEffect(() => {
    if (compareList.length < 2) {
      setCompData(null);
      return;
    }

    const fetchComparison = async () => {
      setLoading(true);
      setError(null);
      try {
        const ids = compareList.map(p => getCanonicalId(p)).filter(Boolean);
        const res = await compareProducts(ids, preferences);

        if (res && res.success && res.data) {
          setCompData(res.data);
        } else {
          throw new Error(res?.message || 'Failed to compare products via API');
        }
      } catch (err) {
        console.warn('Backend comparison fallback to client-side data:', err.message);
        buildClientSideComparison();
      } finally {
        setLoading(false);
      }
    };

    const buildClientSideComparison = () => {
      const cleanStr = (s) => (s || '').toLowerCase().trim();

      const parseAdditives = (text) => {
        if (!text) return { insCodes: [], classes: [], hasArtificialColors: false, hasPreservatives: false, hasArtificialSweeteners: false };
        const insRegex = /ins\s*(\d+[a-z]?(\([a-z0-9]+\))?)|e\s*(\d+[a-z]?)/gi;
        const insCodes = [];
        let match;
        while ((match = insRegex.exec(text)) !== null) {
          insCodes.push(match[0].toUpperCase().replace(/\s+/g, ' '));
        }

        const lower = text.toLowerCase();
        const detectedClasses = [];
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

      const normalizedProducts = compareList.map(p => {
        const canonicalId = getCanonicalId(p);
        const brand = p.brand || p.catalog?.brand || p.identity?.brand || 'Brand';
        const name = p.product_name || p.catalog?.productName || p.identity?.name || 'Product';
        const categoryId = p.category_id || p.catalog?.categoryId || p.identity?.categoryId || 1;
        const categoryName = p.category_name || p.catalog?.categoryName || 'Packaged Food';
        const packagingSize = p.packaging_size || p.catalog?.packagingSize || p.serving?.servingSize || 'Standard Pack';
        const isLiquid = (p.categoryFormat || '').includes('BEVERAGE') || (categoryName.toLowerCase().includes('drink') || categoryName.toLowerCase().includes('juice') || categoryName.toLowerCase().includes('milk'));

        const servingConv = calculateAllNutrientsPerServing(p);
        const p100 = servingConv.per100g || {};
        const pServ = servingConv.perServing || {};

        const saltVal = p100.sodium_mg != null ? parseFloat(((p100.sodium_mg * 2.5) / 1000).toFixed(2)) : null;
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
          salt: pServ.sodium_mg != null ? parseFloat(((pServ.sodium_mg * 2.5) / 1000).toFixed(2)) : null
        };

        const qualityBreakdown = calculateProductBreakdown(p, {});
        const qualityScore = qualityBreakdown.totalScore;
        const confData = calculateProductConfidence(p);
        const verData = calculateProductVerification(p);
        const completeness = p.score?.coverage?.overallCompleteness ?? p.dataQuality?.completeness ?? 85;

        const rawIng = p.nutrition_info?.ingredients_text || p.ingredients?.rawText || p.ingredients?.text || '';
        const parsedTokens = (p.ingredients?.ingredients && p.ingredients.ingredients.length > 0)
          ? p.ingredients.ingredients.map(i => (typeof i === 'string' ? i : i.name))
          : rawIng.split(/[,;\(\)]/).map(s => s.trim()).filter(s => s.length > 1 && !s.toLowerCase().startsWith('contains') && !s.toLowerCase().startsWith('may contain'));

        const additiveInfo = parseAdditives(rawIng);

        // Allergens
        const declaredContains = (p.ingredients?.allergenDeclarations?.contains || p.nutrition_info?.allergens || p.ingredients?.allergens || []).map(cleanStr);
        const declaredMayContain = (p.ingredients?.allergenDeclarations?.mayContain || p.nutrition_info?.may_contain || []).map(cleanStr);

        const checkAllergen = (list, key) => {
          const k = key.toLowerCase();
          return list.some(c => {
            if (c.includes(k)) return true;
            if (k === 'gluten' && (c.includes('wheat') || c.includes('barley') || c.includes('rye') || c.includes('oats') || c.includes('cereal') || c.includes('atta') || c.includes('maida'))) return true;
            if (k === 'treenuts' && (c.includes('nut') || c.includes('almond') || c.includes('cashew') || c.includes('walnut') || c.includes('pistachio'))) return true;
            if (k === 'milk' && (c.includes('dairy') || c.includes('milk') || c.includes('lactose') || c.includes('butter') || c.includes('cheese') || c.includes('ghee'))) return true;
            if (k === 'soy' && (c.includes('soya') || c.includes('soybean') || c.includes('lecithin'))) return true;
            if (k === 'peanuts' && (c.includes('peanut') || c.includes('groundnut'))) return true;
            if (k === 'eggs' && c.includes('egg')) return true;
            if (k === 'fish' && c.includes('fish')) return true;
            if (k === 'crustaceans' && (c.includes('prawn') || c.includes('shrimp') || c.includes('crab'))) return true;
            if (k === 'sulphites' && (c.includes('sulphite') || c.includes('sulfite'))) return true;
            return false;
          });
        };

        const allergenMap = {};
        STATUTORY_ALLERGENS.forEach(a => {
          if (checkAllergen(declaredContains, a.key)) allergenMap[a.key] = 'CONTAINS';
          else if (checkAllergen(declaredMayContain, a.key)) allergenMap[a.key] = 'MAY_CONTAIN';
          else if (verData.status === 'Verified') allergenMap[a.key] = 'VERIFIED_ABSENCE';
          else allergenMap[a.key] = 'UNKNOWN';
        });

        const dc = p.dietary_classification || p.dietaryClassification;
        const dietaryStatus = dc?.status || (p.dietary_type === 'NON_VEG' ? 'NON_VEGETARIAN' : (p.dietary_type === 'VEG' ? 'VEGETARIAN' : 'UNKNOWN'));

        return {
          productId: canonicalId,
          _id: canonicalId,
          name,
          brand,
          categoryId,
          categoryName,
          packagingSize,
          format: isLiquid ? 'LIQUID' : 'SOLID',
          measurementBasis: isLiquid ? 'per 100ml' : 'per 100g',
          servingDisplay: servingConv.servingDisplayStr,
          nutrients,
          servingNutrients,
          qualityScore,
          qualityBreakdown: {
            nutrition: qualityBreakdown.nutrition,
            ingredients: qualityBreakdown.ingredients,
            processing: qualityBreakdown.processing,
            proteinFiber: qualityBreakdown.proteinFiber ?? qualityBreakdown.proteinFibre,
            proteinFibre: qualityBreakdown.proteinFibre ?? qualityBreakdown.proteinFiber,
            preferences: qualityBreakdown.preferences ?? 0
          },
          confidence: confData,
          verification: verData,
          completeness,
          novaGroup: p.processing?.novaGroup || p.nutrition_info?.nova_group || 3,
          ingredientsText: rawIng,
          ingredientTokens: parsedTokens,
          additiveInfo,
          allergens: allergenMap,
          declaredContains,
          declaredMayContain,
          dietaryStatus,
          isVegan: Boolean(dc?.isVegan),
          images: p.images || p.catalog?.images || p.media || {}
        };
      });

      // 1. Build Nutritional Comparison
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
        const numericVals = values.filter(v => v.value != null);
        let bestVal = null;
        if (numericVals.length > 0 && field.higherIsBetter !== null) {
          bestVal = field.higherIsBetter ? Math.max(...numericVals.map(v => v.value)) : Math.min(...numericVals.map(v => v.value));
        }

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

      // 2. Build Ingredient Comparison
      const commonIngredients = [];
      const uniqueIngredients = normalizedProducts.map(() => []);
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
        }))
      };

      // 3. Build Allergen Comparison Matrix
      const allergenComparison = {
        matrix: STATUTORY_ALLERGENS.map(a => {
          const row = { key: a.key, label: a.label, statuses: {} };
          normalizedProducts.forEach(p => {
            row.statuses[p.productId] = p.allergens[a.key] || 'UNKNOWN';
          });
          return row;
        })
      };

      // 4. Pairwise Similarity (SIM = 0.20C + 0.25T + 0.25I + 0.20N + 0.10S)
      const extractSubtypes = (name) => {
        const lower = (name || '').toLowerCase();
        const types = [
          'sausage', 'salami', 'frankfurter', 'nugget', 'patty', 'kebab', 'meat', 'chicken', 'fish', 'prawn', 'mutton',
          'fries', 'french fries', 'potato', 'wedges', 'hash brown', 'aloo',
          'biscuit', 'cookie', 'cracker', 'rusk', 'wafer',
          'noodle', 'pasta', 'vermicelli', 'macaroni',
          'chocolate', 'candy', 'toffee', 'confectionery',
          'juice', 'nectar', 'drink', 'beverage', 'squash', 'syrup',
          'tea', 'coffee', 'chai',
          'milk', 'cheese', 'paneer', 'butter', 'ghee', 'curd', 'yogurt', 'dahi',
          'cereal', 'oats', 'muesli', 'corn flakes', 'granola',
          'oil', 'refined oil', 'mustard oil', 'olive oil',
          'chips', 'crisps', 'namkeen', 'bhujia', 'snack', 'popcorn',
          'sauce', 'ketchup', 'mayonnaise', 'dip', 'chutney',
          'bread', 'bun', 'pav', 'tortilla', 'paratha', 'roti'
        ];
        return types.filter(t => lower.includes(t));
      };

      const pairwiseSimilarity = [];
      for (let i = 0; i < normalizedProducts.length; i++) {
        for (let j = i + 1; j < normalizedProducts.length; j++) {
          const p1 = normalizedProducts[i];
          const p2 = normalizedProducts[j];

          const catSim = (p1.categoryId === p2.categoryId) ? 1.0 : (p1.format === p2.format ? 0.3 : 0.0);

          const isP1NonVeg = p1.dietaryStatus === 'NON_VEGETARIAN';
          const isP2NonVeg = p2.dietaryStatus === 'NON_VEGETARIAN';
          const dietaryMatch = (isP1NonVeg === isP2NonVeg) ? 1.0 : 0.0;

          const sub1 = extractSubtypes(p1.name);
          const sub2 = extractSubtypes(p2.name);
          const commonSub = sub1.filter(s => sub2.includes(s));
          let subtypeMatch = 0.0;
          if (commonSub.length > 0) {
            subtypeMatch = 1.0;
          } else if (p1.categoryId === p2.categoryId && dietaryMatch === 1.0) {
            subtypeMatch = 0.5;
          } else if (p1.categoryId === p2.categoryId) {
            subtypeMatch = 0.15;
          } else {
            subtypeMatch = 0.0;
          }

          const typeSim = (0.50 * dietaryMatch) + (0.50 * subtypeMatch);

          const s1 = parseFloat(p1.packagingSize) || 50;
          const s2 = parseFloat(p2.packagingSize) || 50;
          const servSim = Math.max(0, (100 - Math.abs(s1 - s2)) / 100);

          const set1 = new Set(p1.ingredientTokens.map(cleanStr));
          const set2 = new Set(p2.ingredientTokens.map(cleanStr));
          const intersection = new Set([...set1].filter(x => set2.has(x)));
          const union = new Set([...set1, ...set2]);
          const ingSim = (set1.size > 0 && set2.size > 0 && union.size > 0) ? (intersection.size / union.size) : 0;

          let nutSimSum = 0;
          let nutFieldsCount = 0;
          ['calories', 'protein', 'carbohydrates', 'sugar', 'fat', 'saturatedFat', 'sodium'].forEach(k => {
            const v1 = p1.nutrients[k];
            const v2 = p2.nutrients[k];
            if (v1 != null && v2 != null) {
              nutFieldsCount++;
              const maxDiff = Math.max(Math.abs(v1), Math.abs(v2), 10) * 0.75;
              const diff = Math.abs(v1 - v2);
              nutSimSum += (diff >= maxDiff) ? 0 : ((maxDiff - diff) / maxDiff);
            }
          });
          const nutSim = nutFieldsCount > 0 ? (nutSimSum / nutFieldsCount) : 0.0;

          const totalSim = Math.round((0.20 * catSim + 0.25 * typeSim + 0.25 * ingSim + 0.20 * nutSim + 0.10 * servSim) * 100);

          const sharedTraits = [];
          const differingTraits = [];
          if (catSim >= 0.9) sharedTraits.push('Same broad food category');
          else differingTraits.push('Different categories');

          if (dietaryMatch === 1.0) {
            sharedTraits.push(`Both ${isP1NonVeg ? 'Non-Vegetarian' : 'Vegetarian'}`);
          } else {
            differingTraits.push(`Different food types (${isP1NonVeg ? 'Non-Vegetarian meat' : 'Vegetarian'} vs ${isP2NonVeg ? 'Non-Vegetarian meat' : 'Vegetarian'})`);
          }

          if (ingSim >= 0.35) sharedTraits.push(`Share ${Math.round(ingSim * 100)}% common ingredients`);
          else differingTraits.push('Substantially different ingredient formulations');

          if (p1.novaGroup === p2.novaGroup) sharedTraits.push(`Identical NOVA Group ${p1.novaGroup} processing level`);
          else differingTraits.push(`Different processing levels (NOVA ${p1.novaGroup} vs NOVA ${p2.novaGroup})`);

          if (p1.nutrients.protein != null && p2.nutrients.protein != null && Math.abs(p1.nutrients.protein - p2.nutrients.protein) >= 5) {
            differingTraits.push(`Distinct protein density (${p1.nutrients.protein}g vs ${p2.nutrients.protein}g per 100g)`);
          }

          pairwiseSimilarity.push({
            productAId: p1.productId,
            productBId: p2.productId,
            productAName: p1.name,
            productBName: p2.name,
            overallSimilarity: totalSim,
            breakdown: {
              category: Math.round(catSim * 100),
              productType: Math.round(typeSim * 100),
              ingredients: Math.round(ingSim * 100),
              nutrition: Math.round(nutSim * 100),
              servingSize: Math.round(servSim * 100)
            },
            sharedTraits,
            differingTraits
          });
        }
      }

      // 5. Best Product Verdict Identification
      const productSufficiency = normalizedProducts.map(p => {
        const missingCore = [];
        if (p.nutrients.calories == null) missingCore.push('Energy/Calories');
        if (p.nutrients.protein == null) missingCore.push('Protein');
        if (p.nutrients.fat == null) missingCore.push('Total Fat');
        if (p.nutrients.sugar == null) missingCore.push('Total Sugars');
        if (p.nutrients.sodium == null) missingCore.push('Sodium');
        if (!p.ingredientTokens || p.ingredientTokens.length === 0) missingCore.push('Ingredient Statement');

        const isInsufficient = missingCore.length >= 3 || p.confidence.score < 50 || p.completeness < 50;
        return { productId: p.productId, name: p.name, isInsufficient, missingCore };
      });

      const insufficientProds = productSufficiency.filter(d => d.isInsufficient);

      let winner = null;
      let verdictStatus = 'DECISIVE';
      let verdictReason = '';
      let uncertaintyExplanation = null;
      let pairwiseExplanations = [];

      if (insufficientProds.length > 0) {
        verdictStatus = 'INSUFFICIENT_DATA';
        verdictReason = 'Insufficient verified data to determine a reliable winner. One or more products lack required nutritional declarations or ingredient statements.';
        uncertaintyExplanation = `The following products lack sufficient verified data for a conclusive comparison: ${insufficientProds.map(d => `${d.name} (Missing: ${d.missingCore.join(', ') || 'Low evidentiary confidence'})`).join('; ')}.`;
      } else {
        const sortedByScore = [...normalizedProducts].sort((a, b) => b.qualityScore - a.qualityScore);
        const topProd = sortedByScore[0];
        const second = sortedByScore[1];
        const scoreDiff = topProd.qualityScore - second.qualityScore;
        const confDiff = second.confidence.score - topProd.confidence.score;

        if (scoreDiff === 0) {
          if (confDiff >= 20) {
            winner = second;
            verdictStatus = 'DECISIVE';
            verdictReason = `${second.name} is selected over ${topProd.name} due to substantially higher evidentiary verification (${second.confidence.score}/100 vs ${topProd.confidence.score}/100), despite identical quality scores.`;
          } else {
            verdictStatus = 'TIED';
            verdictReason = `Both ${topProd.name} (${topProd.qualityScore}/100) and ${second.name} (${second.qualityScore}/100) are equally rated overall. Neither product demonstrates a decisive composite nutritional advantage.`;
            uncertaintyExplanation = `Both products achieved identical SmartChoice Quality Scores of ${topProd.qualityScore}/100 with comparable evidentiary confidence (${topProd.confidence.score}/100 vs ${second.confidence.score}/100). Review the individual nutrient breakdown to choose based on your personal priorities.`;
          }
        } else if (scoreDiff === 1 && confDiff >= 25) {
          winner = second;
          verdictStatus = 'DECISIVE';
          verdictReason = `${second.name} is selected over ${topProd.name} due to substantially higher evidentiary verification (${second.confidence.score}/100 vs ${topProd.confidence.score}/100), despite a 1-point difference in raw quality score.`;
        } else {
          winner = topProd;
          verdictStatus = 'DECISIVE';

          const alternatives = normalizedProducts.filter(p => p.productId !== winner.productId);
          pairwiseExplanations = alternatives.map(alt => {
            const advNutrients = [];
            if ((winner.nutrients.protein || 0) > (alt.nutrients.protein || 0) + 1.0) {
              advNutrients.push(`${(winner.nutrients.protein - alt.nutrients.protein).toFixed(1)}g more protein`);
            }
            if ((winner.nutrients.fiber || 0) > (alt.nutrients.fiber || 0) + 1.0) {
              advNutrients.push(`${(winner.nutrients.fiber - alt.nutrients.fiber).toFixed(1)}g more dietary fibre`);
            }
            if (winner.nutrients.sugar != null && alt.nutrients.sugar != null && alt.nutrients.sugar > winner.nutrients.sugar + 2.0) {
              advNutrients.push(`${(alt.nutrients.sugar - winner.nutrients.sugar).toFixed(1)}g less sugar`);
            }
            if (winner.nutrients.saturatedFat != null && alt.nutrients.saturatedFat != null && alt.nutrients.saturatedFat > winner.nutrients.saturatedFat + 1.0) {
              advNutrients.push(`${(alt.nutrients.saturatedFat - winner.nutrients.saturatedFat).toFixed(1)}g less saturated fat`);
            }
            if (winner.nutrients.sodium != null && alt.nutrients.sodium != null && alt.nutrients.sodium > winner.nutrients.sodium + 50) {
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

      setCompData({
        products: normalizedProducts,
        nutritionalComparison,
        ingredientComparison,
        allergenComparison,
        pairwiseSimilarity,
        advantagesByProduct,
        verdict,
        isClientFallback: true
      });
    };

    fetchComparison();
  }, [compareList, preferences]);

  if (compareList.length < 2) {
    return (
      <div className="min-h-screen bg-[#f4f6fb] flex flex-col selection:bg-[#0c831f] selection:text-white">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="flex items-baseline gap-0.5">
                <span className="text-2xl font-black tracking-tight text-[#0c831f]">Smart</span>
                <span className="text-2xl font-black tracking-tight text-emerald-950">Choice</span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-[#0c831f] px-2 py-0.5 rounded-md border border-emerald-200">
                Comparison Engine
              </span>
            </Link>

            <div className="flex items-center gap-2">
              <Link
                to="/recommendations"
                className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#0c831f]" />
                <span>Recommendation Engine</span>
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-16 flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-3xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#0c831f] mb-6 shadow-sm">
            <Scale className="w-10 h-10 stroke-[2.2]" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Advanced Product Comparison Engine
          </h1>
          <p className="text-slate-600 max-w-lg mt-3 text-sm leading-relaxed">
            Select at least <strong>two packaged food products</strong> from the Master Catalog to conduct an evidence-based side-by-side comparison across all nutritional, ingredient, processing, allergen, and score attributes.
          </p>

          {compareList.length === 1 && (
            <div className="mt-6 p-4 bg-white rounded-2xl border border-emerald-200 shadow-xs max-w-md w-full flex items-center justify-between gap-3 text-left">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-slate-100 shrink-0 flex items-center justify-center p-1">
                  <img
                    src={compareList[0].images?.front_thumb || compareList[0].catalog?.images?.frontThumb || generatePackshotSvgClient(compareList[0].brand, compareList[0].product_name)}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase text-emerald-700 block truncate">
                    {compareList[0].brand || 'Brand'}
                  </span>
                  <h4 className="text-xs font-bold text-slate-900 truncate">
                    {compareList[0].product_name || compareList[0].name || 'Product 1'}
                  </h4>
                </div>
              </div>
              <button
                onClick={() => removeProduct(getCanonicalId(compareList[0]))}
                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                title="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}

          <Link
            to="/"
            className="mt-8 inline-flex items-center gap-2 bg-[#0c831f] hover:bg-[#086616] text-white px-6 py-3 rounded-xl font-black text-xs shadow-md shadow-emerald-700/20 active:scale-95 transition-all"
          >
            <span>Browse Master Catalog</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </main>
      </div>
    );
  }

  const products = compData?.products || [];
  const verdict = compData?.verdict || null;
  const nutritionalComparison = compData?.nutritionalComparison || {};
  const ingredientComparison = compData?.ingredientComparison || {};
  const allergenComparison = compData?.allergenComparison || {};
  const pairwiseSimilarity = compData?.pairwiseSimilarity || [];
  const advantagesByProduct = compData?.advantagesByProduct || {};

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

  return (
    <div className="min-h-screen bg-[#f4f6fb] flex flex-col selection:bg-[#0c831f] selection:text-white">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="flex items-baseline gap-0.5">
              <span className="text-2xl font-black tracking-tight text-[#0c831f]">Smart</span>
              <span className="text-2xl font-black tracking-tight text-emerald-950">Choice</span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-[#0c831f] px-2 py-0.5 rounded-md border border-emerald-200 hidden sm:inline">
              Comparison Engine
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={clearProducts}
              className="text-xs font-bold text-slate-500 hover:text-rose-600 transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear Comparison ({products.length})</span>
            </button>
            <Link
              to="/recommendations"
              className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#0c831f]" />
              <span className="hidden sm:inline">Recommendation Engine</span>
              <span className="sm:hidden">Engine</span>
            </Link>
            <Link
              to="/"
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add More</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Comparison Canvas */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-8 flex-1 w-full">
        {/* Section 1 & 2: Top Comparison Header & Products Overview Strip */}
        <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                  {products.length} Products Selected
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs font-semibold text-slate-600">
                  Evidence-based multi-attribute evaluation
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
                Product Comparison & Verdict Engine
              </h1>
            </div>

            {/* Toggle Basis */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
              <button
                onClick={() => setActiveBasis('per100g')}
                className={`px-3 py-1 text-xs font-black rounded-lg transition-all ${
                  activeBasis === 'per100g'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Per 100g / 100ml
              </button>
              <button
                onClick={() => setActiveBasis('perServing')}
                className={`px-3 py-1 text-xs font-black rounded-lg transition-all ${
                  activeBasis === 'perServing'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Per Serving
              </button>
            </div>
          </div>

          {/* Product Overview Side-by-Side Cards */}
          <div className="overflow-x-auto pt-4">
            <div
              className="grid gap-4 min-w-[600px]"
              style={{ gridTemplateColumns: `repeat(${products.length}, minmax(220px, 1fr))` }}
            >
              {products.map((p) => {
                const isWinner = verdict?.status === 'DECISIVE' && verdict?.bestProductId === p.productId;
                return (
                  <div
                    key={p.productId}
                    className={`bg-slate-50/60 p-4 rounded-2xl border transition-all flex flex-col justify-between relative ${
                      isWinner
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20'
                        : 'border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    {isWinner && (
                      <div className="absolute -top-3 left-4 bg-emerald-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                        <Award className="w-3 h-3" />
                        <span>BEST OVERALL PRODUCT</span>
                      </div>
                    )}

                    <button
                      onClick={() => removeProduct(p.productId)}
                      className="absolute top-2 right-2 p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Remove product"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <div className="w-full aspect-square bg-white rounded-xl p-2 flex items-center justify-center border border-slate-100 mb-3 overflow-hidden">
                      <img
                        src={p.images?.front_thumb || p.images?.front_hd || generatePackshotSvgClient(p.brand, p.name)}
                        alt={p.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider block truncate">
                          {p.brand}
                        </span>
                        <DietaryEmblem product={p} />
                      </div>

                      <h3 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug" title={p.name}>
                        {p.name}
                      </h3>

                      <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Category:</span>
                          <span className="font-semibold text-slate-700 truncate max-w-[130px]">{p.categoryName}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Net Pack:</span>
                          <span className="font-semibold text-slate-700">{p.packagingSize}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Serving:</span>
                          <span className="font-semibold text-slate-700">{p.servingDisplay}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Product ID:</span>
                          <span className="font-mono text-[10px] text-slate-600">{p.productId}</span>
                        </div>
                      </div>
                    </div>

                    {/* Verification Status Badge */}
                    <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Verification:</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase flex items-center gap-1 ${
                        p.verification.status === 'Verified' ? 'bg-emerald-100 text-emerald-800' :
                        p.verification.status === 'Partially Verified' ? 'bg-amber-100 text-amber-800' :
                        p.verification.status === 'Needs Review' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700'
                      }`}
                      title={p.verification.reason}
                      >
                        <ShieldCheck className="w-3 h-3" />
                        <span>{p.verification.status} ({p.verification.percentage}%)</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Section 3: SmartChoice Comparison Verdict */}
        {verdict && (
          <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-emerald-900 text-white p-6 sm:p-8 rounded-3xl shadow-lg border border-emerald-500/30 relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative z-10">
              <div className="space-y-3 max-w-3xl">
                <div className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                  <Award className="w-4 h-4 text-emerald-400" />
                  <span>SmartChoice Comparison Verdict</span>
                </div>

                {verdict.status === 'DECISIVE' && (
                  <>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                      Best Overall Product:{' '}
                      <span className="text-emerald-400">{verdict.bestProductName}</span>
                    </h2>
                    <p className="text-slate-300 text-sm leading-relaxed font-normal">
                      {verdict.reason}
                    </p>

                    {verdict.pairwiseExplanations && verdict.pairwiseExplanations.length > 0 && (
                      <div className="pt-2 space-y-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 block">
                          Pairwise Outperformance Analysis:
                        </span>
                        <div className="grid gap-2">
                          {verdict.pairwiseExplanations.map((pw, i) => (
                            <div key={i} className="bg-slate-800/60 border border-slate-700/60 p-3 rounded-xl text-xs text-slate-200 flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                              <span className="leading-relaxed">{pw.explanation}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {verdict.status === 'INSUFFICIENT_DATA' && (
                  <div className="bg-amber-950/70 border border-amber-500/50 p-4 rounded-2xl text-amber-200">
                    <h3 className="text-lg font-black flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                      <span>Insufficient Data for a Reliable Verdict</span>
                    </h3>
                    <p className="text-xs text-amber-200/90 mt-1 leading-relaxed">
                      {verdict.reason || 'One or more products lack sufficient verified nutritional or ingredient data to determine a reliable winner.'}
                    </p>
                    {verdict.uncertaintyExplanation && (
                      <p className="text-[11px] text-amber-300/80 mt-2 p-2.5 bg-black/30 rounded-xl leading-relaxed">
                        {verdict.uncertaintyExplanation}
                      </p>
                    )}
                  </div>
                )}

                {verdict.status === 'TIED' && (
                  <div className="bg-blue-950/70 border border-blue-500/50 p-4 rounded-2xl text-blue-200">
                    <h3 className="text-lg font-black flex items-center gap-2">
                      <Scale className="w-5 h-5 text-blue-400" />
                      <span>Comparative Tie — Equally Rated Products</span>
                    </h3>
                    <p className="text-xs text-blue-200/90 mt-1 leading-relaxed">
                      {verdict.reason}
                    </p>
                    {verdict.uncertaintyExplanation && (
                      <p className="text-[11px] text-blue-300/80 mt-2 p-2.5 bg-black/30 rounded-xl leading-relaxed">
                        {verdict.uncertaintyExplanation}
                      </p>
                    )}
                  </div>
                )}

                {verdict.status === 'INCONCLUSIVE' && (
                  <div className="bg-amber-950/60 border border-amber-500/40 p-4 rounded-2xl text-amber-200">
                    <h3 className="text-lg font-black flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                      <span>Insufficient Evidence to Determine a Clear Winner</span>
                    </h3>
                    <p className="text-xs text-amber-300/90 mt-1 leading-relaxed">
                      {verdict.uncertaintyExplanation || 'The selected products have closely matched quality ratings or lack sufficient verified laboratory data to establish an evidence-based advantage.'}
                    </p>
                  </div>
                )}

                {verdict.status === 'ALL_EXCLUDED' && (
                  <div className="bg-rose-950/60 border border-rose-500/40 p-4 rounded-2xl text-rose-200">
                    <h3 className="text-lg font-black flex items-center gap-2">
                      <XCircle className="w-5 h-5 text-rose-400" />
                      <span>All Products Excluded by Safety Constraints</span>
                    </h3>
                    <p className="text-xs text-rose-300/90 mt-1 leading-relaxed">
                      Every selected product contains allergens or ingredients that violate your active user preferences.
                    </p>
                  </div>
                )}
              </div>

              {verdict.advantages && (
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 text-xs space-y-3 min-w-[260px] shrink-0">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 block">
                    Key Advantages
                  </span>
                  <div className="space-y-1.5 text-slate-200">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400">Nutritional:</span>
                      <span className="font-bold text-white text-right">
                        {verdict.advantages.nutritional.length > 0 ? verdict.advantages.nutritional.join(', ') : 'Balanced'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400">Ingredients:</span>
                      <span className="font-bold text-white text-right">
                        {verdict.advantages.ingredients[0]}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400">Processing:</span>
                      <span className="font-bold text-white text-right">
                        {verdict.advantages.processing}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400">Evidentiary:</span>
                      <span className="font-bold text-white text-right">
                        {verdict.advantages.verification}
                      </span>
                    </div>
                  </div>

                  {verdict.tradeoffs?.disadvantages?.length > 0 && (
                    <div className="pt-2 border-t border-white/10 text-[11px] text-amber-300">
                      <span className="font-bold block text-[10px] uppercase text-amber-400">Trade-offs to note:</span>
                      <span>Higher in: {verdict.tradeoffs.disadvantages.join(', ')}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section 4: Overall Nutrient & Ingredient Betterness Summary */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
              Nutrient & Ingredient Betterness Summary
            </h2>
          </div>

          <div
            className="grid gap-4 overflow-x-auto"
            style={{ gridTemplateColumns: `repeat(${products.length}, minmax(220px, 1fr))` }}
          >
            {products.map(p => {
              const adv = advantagesByProduct[p.productId] || { betterCount: 0, worseCount: 0, betterNutrients: [], worseNutrients: [] };
              return (
                <div key={p.productId} className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70 space-y-3">
                  <span className="text-xs font-black text-slate-900 truncate block">
                    {p.name}
                  </span>

                  <div>
                    <span className="text-[10px] font-black uppercase text-emerald-700 flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-600" />
                      Superior in ({adv.betterCount}):
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {adv.betterNutrients.length > 0 ? (
                        adv.betterNutrients.map((n, i) => (
                          <span key={i} className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                            {n}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">None</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-black uppercase text-rose-700 flex items-center gap-1">
                      <X className="w-3 h-3 text-rose-600" />
                      Inferior in ({adv.worseCount}):
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {adv.worseNutrients.length > 0 ? (
                        adv.worseNutrients.map((n, i) => (
                          <span key={i} className="text-[10px] font-bold bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded">
                            {n}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">None</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 text-[10px]">
                    <span className="text-slate-400 block">Formulation Cleanliness:</span>
                    <span className="font-bold text-slate-700">
                      {p.additiveInfo?.insCodes?.length || 0} identified additives
                      {p.additiveInfo?.hasArtificialColors ? ' • Has synthetic colours' : ''}
                      {p.additiveInfo?.hasPreservatives ? ' • Has preservatives' : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 5: Compare All SmartChoice Scores */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-600" />
              <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
                SmartChoice Scores & Reliability Comparison
              </h2>
            </div>
            <span className="text-[11px] font-mono font-bold text-slate-500">
              SC = 0.40N + 0.20I + 0.15P + 0.15PF + 0.10U
            </span>
          </div>

          <div
            className="grid gap-4 overflow-x-auto"
            style={{ gridTemplateColumns: `repeat(${products.length}, minmax(220px, 1fr))` }}
          >
            {products.map(p => (
              <div key={p.productId} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <span className="text-xs font-black text-slate-900 truncate block">
                  {p.name}
                </span>

                <div className="p-3 bg-white rounded-xl border border-emerald-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Quality Score</span>
                    <div className="text-2xl font-black text-emerald-700">
                      {p.qualityScore}<span className="text-xs text-slate-400 font-normal">/100</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Confidence</span>
                    <div className="text-sm font-black text-slate-800">
                      {p.confidence.score}/100
                    </div>
                    <span className="text-[9px] font-bold text-emerald-700 uppercase">
                      {p.confidence.label}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                    Statutory Contributions:
                  </span>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Nutrition (40%):</span>
                    <span className="font-bold text-slate-900">{p.qualityBreakdown?.nutrition ?? 0} / 40</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Ingredients (20%):</span>
                    <span className="font-bold text-slate-900">{p.qualityBreakdown?.ingredients ?? 0} / 20</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Processing (15%):</span>
                    <span className="font-bold text-slate-900">{p.qualityBreakdown?.processing ?? 0} / 15</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Protein/Fibre (15%):</span>
                    <span className="font-bold text-slate-900">{p.qualityBreakdown?.proteinFiber ?? p.qualityBreakdown?.proteinFibre ?? 0} / 15</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>User Preferences (10%):</span>
                    <span className="font-bold text-slate-900">{p.qualityBreakdown?.preferences ?? 0} / 10</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60 space-y-1 text-[11px]">
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Data Completeness:</span>
                    <span className="font-bold text-slate-700">{p.completeness}%</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Verification Percentage:</span>
                    <span className="font-bold text-emerald-700">{p.verification.percentage}%</span>
                  </div>
                  {p.preferenceMatch && (
                    <div className="flex items-center justify-between text-emerald-800 font-bold bg-emerald-50 px-2 py-1 rounded">
                      <span>Personalized Match:</span>
                      <span>{p.preferenceMatch.score}%</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 6: Nutritional Comparison Table (All 11 Nutrients) */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
                FSSAI Nutritional Comparison ({activeBasis === 'per100g' ? 'Per 100g / 100ml' : 'Per Serving'})
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-semibold">
              Green highlight indicates superior nutritional performance
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="border-b border-slate-200 bg-white">
                  <th className="p-3 px-5 text-xs font-black uppercase text-slate-400 w-1/4">Nutrient</th>
                  {products.map(p => (
                    <th key={p.productId} className="p-3 text-xs font-black text-slate-900 text-center">
                      <span className="block truncate max-w-[150px] mx-auto">{p.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {NUTRITION_FIELDS.map(f => {
                  const compField = nutritionalComparison[f.key] || {};
                  return (
                    <tr key={f.key} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 px-5 font-bold text-slate-700">
                        {f.name} <span className="text-[10px] text-slate-400 font-normal">({f.unit})</span>
                      </td>
                      {products.map(p => {
                        const val = activeBasis === 'per100g' ? p.nutrients[f.key] : p.servingNutrients[f.key];
                        const isBest = val != null && compField.bestVal != null && val === compField.bestVal;
                        return (
                          <td
                            key={p.productId}
                            className={`p-3 text-center font-semibold ${
                              isBest ? 'bg-emerald-50 text-emerald-900 font-black' : 'text-slate-800'
                            }`}
                          >
                            {val != null ? (
                              <div className="flex items-center justify-center gap-1">
                                <span>{val}</span>
                                {isBest && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" title="Best in comparison" />
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 font-normal italic">N/A</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 7: Ingredient Comparison Engine */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600" />
            <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
              Ingredient Comparison Engine
            </h2>
          </div>

          {ingredientComparison.shared && ingredientComparison.shared.length > 0 && (
            <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/80">
              <span className="text-[11px] font-black uppercase text-emerald-800 block mb-1">
                Ingredients Shared by All Selected Products ({ingredientComparison.shared.length}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {ingredientComparison.shared.map((ing, i) => (
                  <span key={i} className="text-xs bg-white text-emerald-900 px-2 py-0.5 rounded-lg border border-emerald-200 font-semibold shadow-2xs">
                    {ing}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div
            className="grid gap-4 overflow-x-auto"
            style={{ gridTemplateColumns: `repeat(${products.length}, minmax(240px, 1fr))` }}
          >
            {products.map((p, idx) => {
              const uniqueList = ingredientComparison.uniqueByProduct?.[idx]?.uniqueIngredients || [];
              const addInfo = p.additiveInfo || {};
              return (
                <div key={p.productId} className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                  <h4 className="text-xs font-black text-slate-900 truncate">
                    {p.name}
                  </h4>

                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                      Identified Additives ({addInfo.insCodes?.length || 0}):
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {addInfo.insCodes?.length > 0 ? (
                        addInfo.insCodes.map((code, i) => (
                          <span key={i} className="text-[10px] font-mono font-bold bg-white text-slate-800 px-1.5 py-0.5 rounded border border-slate-200">
                            {code}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-emerald-700 font-semibold">Zero identified INS additives</span>
                      )}
                    </div>
                  </div>

                  {uniqueList.length > 0 && (
                    <div>
                      <span className="text-[10px] font-black uppercase text-blue-700 block mb-1">
                        Unique Ingredients ({uniqueList.length}):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {uniqueList.slice(0, 8).map((u, i) => (
                          <span key={i} className="text-[10px] bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200 font-medium">
                            {u}
                          </span>
                        ))}
                        {uniqueList.length > 8 && (
                          <span className="text-[10px] text-slate-400">+{uniqueList.length - 8} more</span>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                      Complete Ingredient Statement:
                    </span>
                    <p className="text-[11px] text-slate-600 leading-relaxed max-h-32 overflow-y-auto bg-white p-2.5 rounded-xl border border-slate-200/60 font-medium">
                      {p.ingredientsText || <span className="text-amber-700 italic">Ingredient declaration unverified</span>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 8: Statutory Allergen Comparison */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
                FSSAI Statutory Allergen Matrix
              </h2>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-bold">
              <span className="flex items-center gap-1 text-rose-700"><span className="w-2 h-2 rounded-full bg-rose-600" /> CONTAINS</span>
              <span className="flex items-center gap-1 text-amber-700"><span className="w-2 h-2 rounded-full bg-amber-500" /> MAY CONTAIN</span>
              <span className="flex items-center gap-1 text-emerald-700"><span className="w-2 h-2 rounded-full bg-emerald-600" /> VERIFIED ABSENCE</span>
              <span className="flex items-center gap-1 text-slate-500"><span className="w-2 h-2 rounded-full bg-slate-400" /> UNKNOWN</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="border-b border-slate-200 bg-white">
                  <th className="p-3 px-5 text-xs font-black uppercase text-slate-400 w-1/4">Statutory Allergen</th>
                  {products.map(p => (
                    <th key={p.productId} className="p-3 text-xs font-black text-slate-900 text-center">
                      <span className="block truncate max-w-[150px] mx-auto">{p.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {STATUTORY_ALLERGENS.map(a => (
                  <tr key={a.key} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 px-5 font-bold text-slate-700">{a.label}</td>
                    {products.map(p => {
                      const status = p.allergens?.[a.key] || 'UNKNOWN';
                      return (
                        <td key={p.productId} className="p-3 text-center">
                          {status === 'CONTAINS' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200 inline-block">
                              CONTAINS
                            </span>
                          )}
                          {status === 'MAY_CONTAIN' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200 inline-block">
                              MAY CONTAIN
                            </span>
                          )}
                          {status === 'VERIFIED_ABSENCE' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200 inline-block">
                              ABSENCE
                            </span>
                          )}
                          {status === 'UNKNOWN' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 inline-block">
                              UNKNOWN
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 9: Processing (NOVA) Comparison */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-600" />
            <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
              Processing & Industrial Formulation (NOVA)
            </h2>
          </div>

          <div
            className="grid gap-4 overflow-x-auto"
            style={{ gridTemplateColumns: `repeat(${products.length}, minmax(220px, 1fr))` }}
          >
            {products.map(p => (
              <div key={p.productId} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-center">
                <span className="text-xs font-black text-slate-900 truncate block">
                  {p.name}
                </span>

                <div className="py-2">
                  <span className={`inline-block px-3 py-1 rounded-xl text-xs font-black ${
                    p.novaGroup === 1 ? 'bg-emerald-100 text-emerald-800' :
                    p.novaGroup === 2 ? 'bg-teal-100 text-teal-800' :
                    p.novaGroup === 3 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    NOVA GROUP {p.novaGroup}
                  </span>
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {p.novaGroup === 1 ? 'Unprocessed or minimally processed whole food.' :
                   p.novaGroup === 2 ? 'Processed culinary ingredient derived from nature.' :
                   p.novaGroup === 3 ? 'Processed food with simple ingredients and seasoning.' :
                   'Ultra-processed industrial formulation with additives.'}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Section 10: Pairwise Product Similarity Analysis */}
        {pairwiseSimilarity && pairwiseSimilarity.length > 0 && (
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-emerald-600" />
                <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
                  Pairwise Product Similarity Analysis
                </h2>
              </div>
              <span className="text-[11px] font-mono font-bold text-slate-500">
                SIM = 0.20C + 0.25T + 0.25I + 0.20N + 0.10S
              </span>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {pairwiseSimilarity.map((sim, i) => (
                <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 truncate max-w-[200px]">
                      {sim.productAName} vs {sim.productBName}
                    </span>
                    <span className="text-sm font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                      {sim.overallSimilarity}% SIMILAR
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-1 text-[10px] text-center font-bold">
                    <div className="bg-white p-1 rounded border border-slate-200">
                      <span className="block text-slate-400">Cat (20%)</span>
                      <span className="text-slate-700">{sim.breakdown.category}%</span>
                    </div>
                    <div className="bg-white p-1 rounded border border-slate-200">
                      <span className="block text-slate-400">Type (25%)</span>
                      <span className="text-slate-700">{sim.breakdown.productType}%</span>
                    </div>
                    <div className="bg-white p-1 rounded border border-slate-200">
                      <span className="block text-slate-400">Ing (25%)</span>
                      <span className="text-slate-700">{sim.breakdown.ingredients}%</span>
                    </div>
                    <div className="bg-white p-1 rounded border border-slate-200">
                      <span className="block text-slate-400">Nutr (20%)</span>
                      <span className="text-slate-700">{sim.breakdown.nutrition}%</span>
                    </div>
                    <div className="bg-white p-1 rounded border border-slate-200">
                      <span className="block text-slate-400">Serv (10%)</span>
                      <span className="text-slate-700">{sim.breakdown.servingSize}%</span>
                    </div>
                  </div>

                  <div className="text-[11px] space-y-1 text-slate-600">
                    {sim.sharedTraits.map((t, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-emerald-800">
                        <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>{t}</span>
                      </div>
                    ))}
                    {sim.differingTraits.map((t, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-slate-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                        <span>{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ComparePage;
