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
      const normalizedProducts = compareList.map(p => {
        const canonicalId = getCanonicalId(p);
        const brand = p.brand || p.catalog?.brand || p.identity?.brand || 'Brand';
        const name = p.product_name || p.catalog?.productName || p.identity?.name || 'Product';
        const categoryId = p.category_id || p.catalog?.categoryId || p.identity?.categoryId || 1;
        const categoryName = p.category_name || p.catalog?.categoryName || 'Packaged Food';
        const packagingSize = p.packaging_size || p.catalog?.packagingSize || p.serving?.servingSize || 'Standard Pack';
        const isLiquid = (p.categoryFormat || '').includes('BEVERAGE');

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

        const qualityScore = calculateProductQualityScore(p);
        const qualityBreakdown = calculateProductBreakdown(p, {});
        const confData = calculateProductConfidence(p);
        const verData = calculateProductVerification(p);
        const completeness = p.score?.coverage?.overallCompleteness ?? p.dataQuality?.completeness ?? 85;

        const rawIng = p.nutrition_info?.ingredients_text || p.ingredients?.rawText || p.ingredients?.text || '';
        const parsedTokens = (p.ingredients?.ingredients && p.ingredients.ingredients.length > 0)
          ? p.ingredients.ingredients.map(i => (typeof i === 'string' ? i : i.name))
          : rawIng.split(/[,;\(\)]/).map(s => s.trim()).filter(s => s.length > 1);

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
            proteinFiber: qualityBreakdown.proteinFiber,
            preferences: qualityBreakdown.preferences
          },
          confidence: confData,
          verification: verData,
          completeness,
          novaGroup: p.processing?.novaGroup || p.nutrition_info?.nova_group || 3,
          ingredientsText: rawIng,
          ingredientTokens: parsedTokens,
          dietaryStatus,
          isVegan: Boolean(dc?.isVegan),
          images: p.images || p.catalog?.images || p.media || {}
        };
      });

      setCompData({
        products: normalizedProducts,
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
                const isWinner = verdict?.bestProductId === p.productId;
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
                    <span className="font-bold text-slate-900">{p.qualityBreakdown.nutrition} / 40</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Ingredients (20%):</span>
                    <span className="font-bold text-slate-900">{p.qualityBreakdown.ingredients} / 20</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Processing (15%):</span>
                    <span className="font-bold text-slate-900">{p.qualityBreakdown.processing} / 15</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Protein/Fibre (15%):</span>
                    <span className="font-bold text-slate-900">{p.qualityBreakdown.proteinFiber} / 15</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>User Preferences (10%):</span>
                    <span className="font-bold text-slate-900">{p.qualityBreakdown.preferences} / 10</span>
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
              <span className="flex items-center gap-1 text-emerald-700"><span className="w-2 h-2 rounded-full bg-emerald-600" /> ABSENCE</span>
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
                SIM = 0.40C + 0.20T + 0.15S + 0.15I + 0.10N
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
                      <span className="block text-slate-400">Cat (40%)</span>
                      <span className="text-slate-700">{sim.breakdown.category}%</span>
                    </div>
                    <div className="bg-white p-1 rounded border border-slate-200">
                      <span className="block text-slate-400">Type (20%)</span>
                      <span className="text-slate-700">{sim.breakdown.productType}%</span>
                    </div>
                    <div className="bg-white p-1 rounded border border-slate-200">
                      <span className="block text-slate-400">Serv (15%)</span>
                      <span className="text-slate-700">{sim.breakdown.servingSize}%</span>
                    </div>
                    <div className="bg-white p-1 rounded border border-slate-200">
                      <span className="block text-slate-400">Ing (15%)</span>
                      <span className="text-slate-700">{sim.breakdown.ingredients}%</span>
                    </div>
                    <div className="bg-white p-1 rounded border border-slate-200">
                      <span className="block text-slate-400">Nutr (10%)</span>
                      <span className="text-slate-700">{sim.breakdown.nutrition}%</span>
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
