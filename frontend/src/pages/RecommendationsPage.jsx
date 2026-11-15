import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Sparkles,
  Sliders,
  Filter,
  ArrowLeft,
  Scale,
  Award,
  Layers,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  ChevronRight,
  TrendingUp,
  Info,
  X,
  Search,
  ShieldCheck
} from 'lucide-react';
import { usePreferences } from '../context/PreferenceContext';
import { useComparison } from '../context/ComparisonContext';
import { ProductCard } from '../components/ProductCard';
import { ProductDetailModal } from '../components/ProductDetailModal';
import { CompareDrawer } from '../components/CompareDrawer';
import {
  calculateProductQualityScore,
  evaluateProductPreferences,
  getActiveNutritionalPreferences,
  singlePreferenceComparators,
  getProductCategoryFormat,
  extractNutrient
} from '../utils/productScoring';
import { matchesSelectedCategory, matchesSearchQuery } from '../utils/categoryMatching';
import { isProductGloballyEligible } from '../utils/productEligibility';

export const RecommendationsPage = () => {
  const {
    preferences = {},
    hasSavedPreferences,
    savePreferences,
    clearPreferences,
    markRecommendationsSeen
  } = usePreferences();

  const {
    compareList = [],
    addProduct,
    removeProduct,
    hasProduct,
    clearProducts
  } = useComparison();

  const navigate = useNavigate();

  // Catalog State
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Recommendation Engine Local Page State (Completely Independent of Master Catalog)
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isCompareDrawerOpen, setIsCompareDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // When Recommendation Engine mounts, notify context to stop green dot from blinking
  useEffect(() => {
    if (markRecommendationsSeen) {
      markRecommendationsSeen();
    }
  }, [markRecommendationsSeen]);

  // Load Authoritative Catalog Data
  useEffect(() => {
    const loadCatalog = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/data/enriched_catalog_500.json');
        if (!res.ok) {
          throw new Error(`Failed to load catalog (HTTP ${res.status})`);
        }
        const data = await res.json();
        setCatalog(data);
      } catch (err) {
        console.warn("Catalog fetch notice:", err.message);
        setError(err.message || 'Could not load catalog data');
      } finally {
        setLoading(false);
      }
    };
    loadCatalog();
  }, []);

  const allProducts = useMemo(() => {
    if (!catalog?.categories) return [];
    return catalog.categories.flatMap((cat) => cat.products || []);
  }, [catalog]);
  const categories = catalog?.categories || [];

  // Active Nutritional Preferences
  const activeNutritionalPrefs = useMemo(() => {
    return getActiveNutritionalPreferences(preferences);
  }, [preferences]);

  const hasLifestylePrefs = Boolean(
    preferences.vegetarian ||
    preferences.vegan ||
    (preferences.avoidAllergens && preferences.avoidAllergens.length > 0) ||
    (preferences.excludedIngredients && preferences.excludedIngredients.length > 0) ||
    (preferences.avoidIngredients && preferences.avoidIngredients.length > 0)
  );

  // Dynamic Category resolution
  const currentCategory = useMemo(() => {
    if (selectedCategoryId === 'all') return null;
    return categories.find((c) => String(c.category_id) === String(selectedCategoryId)) || null;
  }, [categories, selectedCategoryId]);

  // Ranking Criteria Summary Text
  const rankingSummary = useMemo(() => {
    if (!hasSavedPreferences) return '';
    const parts = [];
    if (preferences.highProtein) parts.push('Highest Protein (desc)');
    if (preferences.lowCalories) parts.push('Lowest Calories (asc)');
    if (preferences.lowSugar) parts.push('Lowest Sugar (asc)');
    if (preferences.highFiber) parts.push('Highest Fibre (desc)');
    if (preferences.lowSodium) parts.push('Lowest Sodium (asc)');
    if (preferences.lowSaturatedFat) parts.push('Lowest Saturated Fat (asc)');
    if (preferences.lowFat) parts.push('Lowest Fat (asc)');
    if (preferences.vegetarian) parts.push('100% Vegetarian');
    if (preferences.vegan) parts.push('Vegan Diet');
    if (preferences.avoidAllergens?.length > 0) parts.push(`Avoid Allergens: ${preferences.avoidAllergens.join(', ')}`);
    return parts.join(' • ');
  }, [preferences, hasSavedPreferences]);

  // Total products excluded in current category by global dietary & allergen rules
  const excludedDietaryCount = useMemo(() => {
    if (!allProducts.length) return 0;
    const baseList = selectedCategoryId === 'all'
      ? allProducts
      : allProducts.filter((p) => matchesSelectedCategory(p, selectedCategoryId, currentCategory));
    return baseList.filter((p) => !isProductGloballyEligible(p, preferences, { scope: 'recommendation' })).length;
  }, [allProducts, selectedCategoryId, currentCategory, preferences]);

  // Evaluated and Ranked Products for Selected Category
  const rankedProducts = useMemo(() => {
    if (!hasSavedPreferences || allProducts.length === 0) {
      return [];
    }

    // 1. Filter by Selected Category (Independent of Master Catalog)
    let baseList = selectedCategoryId === 'all'
      ? allProducts
      : allProducts.filter((p) => matchesSelectedCategory(p, selectedCategoryId, currentCategory));

    // 2. Authoritative Global Dietary Eligibility Filtering
    // Only verified eligible products are retained in active recommendations
    const eligibleList = baseList.filter((p) => isProductGloballyEligible(p, preferences, { scope: 'recommendation' }));

    // Filter by search query if user typed a search term
    let pool = eligibleList;
    if (searchQuery.trim().length >= 2) {
      pool = eligibleList.filter((p) => matchesSearchQuery(p, searchQuery));
    }

    // 3. Evaluate each eligible product against saved nutritional preferences
    const decoratedList = pool.map((item) => {
      const prefEval = evaluateProductPreferences(item, preferences);
      const scScore = calculateProductQualityScore(item, preferences);
      const format = getProductCategoryFormat(item);
      const matchScore = prefEval.matchScore;

      return {
        ...item,
        allergenExcluded: false,
        calculatedScore: scScore,
        matchScore,
        preferenceEval: prefEval,
        format,
        finalScore: matchScore
      };
    });

    // 4. Rank according to statutory nutritional direction
    const sorted = [...decoratedList];

    // Case A: Single Nutritional Goal active and no lifestyle constraints
    if (activeNutritionalPrefs.length === 1 && !hasLifestylePrefs) {
      const singlePrefKey = activeNutritionalPrefs[0];
      sorted.sort((a, b) => singlePreferenceComparators[singlePrefKey](a, b));
    } else {
      // Case B: Multiple nutritional preferences or combined with lifestyle
      sorted.sort((a, b) => {
        // Combined preference score (highest compatibility first)
        if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
        if ((b.matchScore ?? 0) !== (a.matchScore ?? 0)) return (b.matchScore ?? 0) - (a.matchScore ?? 0);

        // Quality Score as secondary tie-breaker
        if (b.calculatedScore !== a.calculatedScore) return b.calculatedScore - a.calculatedScore;

        // Deterministic alphabetical tie-breaker
        const na = a.product_name || a.catalog?.productName || '';
        const nb = b.product_name || b.catalog?.productName || '';
        return na.localeCompare(nb);
      });
    }

    return sorted;
  }, [allProducts, selectedCategoryId, currentCategory, preferences, hasSavedPreferences, activeNutritionalPrefs, hasLifestylePrefs, searchQuery]);

  // Remove individual preference chip handler
  const handleRemovePreference = (prefKey) => {
    const updated = { ...preferences };
    if (Array.isArray(updated[prefKey])) {
      updated[prefKey] = [];
    } else {
      updated[prefKey] = false;
    }
    savePreferences(updated);
  };

  const handleToggleCompare = (product) => {
    const prodId = product.product_id || product._id || product.productId || product.catalog?.productId;
    if (hasProduct(prodId)) {
      removeProduct(prodId);
    } else {
      addProduct(product);
    }
  };

  // Helper to extract key nutritional values for display
  const getNutrientRankingDisplay = (product) => {
    const parts = [];
    if (activeNutritionalPrefs.includes('highProtein')) {
      const val = extractNutrient(product, 'protein');
      parts.push(`Protein: ${val != null ? `${val}g` : 'N/A'}`);
    }
    if (activeNutritionalPrefs.includes('lowCalories')) {
      const val = extractNutrient(product, 'calories');
      parts.push(`Energy: ${val != null ? `${val} kcal` : 'N/A'}`);
    }
    if (activeNutritionalPrefs.includes('lowSugar')) {
      const val = extractNutrient(product, 'sugar');
      parts.push(`Sugar: ${val != null ? `${val}g` : 'N/A'}`);
    }
    if (activeNutritionalPrefs.includes('highFiber')) {
      const val = extractNutrient(product, 'fiber');
      parts.push(`Fibre: ${val != null ? `${val}g` : 'N/A'}`);
    }
    if (activeNutritionalPrefs.includes('lowSodium')) {
      const val = extractNutrient(product, 'sodium');
      parts.push(`Sodium: ${val != null ? `${val}mg` : 'N/A'}`);
    }
    if (activeNutritionalPrefs.includes('lowSaturatedFat')) {
      const val = extractNutrient(product, 'saturatedFat');
      parts.push(`Sat Fat: ${val != null ? `${val}g` : 'N/A'}`);
    }
    if (activeNutritionalPrefs.includes('lowFat')) {
      const val = extractNutrient(product, 'fat');
      parts.push(`Fat: ${val != null ? `${val}g` : 'N/A'}`);
    }
    return parts.join(' • ');
  };

  return (
    <div className="min-h-screen bg-[#f4f6fb] flex flex-col selection:bg-[#0c831f] selection:text-white">
      {/* Top Header with Bidirectional Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            <div className="flex items-baseline gap-0.5">
              <span className="text-2xl font-black tracking-tight text-[#0c831f]">Smart</span>
              <span className="text-2xl font-black tracking-tight text-emerald-950">Choice</span>
            </div>
            <span className="text-[11px] uppercase tracking-wider font-extrabold text-[#0c831f] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>Recommendation Engine</span>
            </span>
          </Link>

          {/* Navigation Controls */}
          <div className="flex items-center gap-2.5">
            <Link
              to="/preferences"
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-[#0c831f] px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors shrink-0"
              title="Configure Saved Preferences"
            >
              <Sliders className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">Preferences</span>
            </Link>

            <button
              onClick={() => setIsCompareDrawerOpen(true)}
              className="relative flex items-center gap-2 bg-[#0c831f] hover:bg-[#086616] text-white px-3.5 py-2 rounded-xl font-bold text-xs shadow-md shadow-emerald-700/20 active:scale-95 transition-all shrink-0"
            >
              <Scale className="w-4 h-4" />
              <span className="hidden sm:inline">Comparison</span>
              {compareList.length > 0 && (
                <span className="bg-[#f8cb46] text-slate-900 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                  {compareList.length}
                </span>
              )}
            </button>

            <Link
              to="/"
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#0c831f] px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Master Catalog</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full px-4 py-6 flex-1 space-y-6">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-green-800 rounded-3xl p-6 sm:p-10 text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Personalized Food Intelligence</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black mb-2 tracking-tight">
              Personalized Recommendation Engine
            </h1>
            <p className="text-white/85 text-xs sm:text-sm leading-relaxed">
              Every eligible product dynamically ranked by strict mathematical compatibility with your saved nutritional goals, dietary lifestyle rules, and allergen avoidances.
            </p>
          </div>
          <div className="absolute -bottom-10 -right-10 w-60 h-60 rounded-full bg-white/10 pointer-events-none" />
        </div>

        {/* PART 6: MANDATORY EMPTY STATE WHEN NO PREFERENCES SAVED */}
        {!hasSavedPreferences ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-16 text-center shadow-xs">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-[#0c831f] flex items-center justify-center mx-auto mb-4 border border-emerald-100 shadow-2xs">
              <Sliders className="w-8 h-8 text-[#0c831f]" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">
              Select your preferences first
            </h2>
            <p className="text-sm text-slate-600 max-w-lg mx-auto mb-6 font-medium leading-relaxed">
              Visit the Preferences page, choose your nutritional preferences and save them to activate personalized recommendations.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => navigate('/preferences')}
                className="inline-flex items-center gap-2 bg-[#0c831f] hover:bg-[#086616] text-white px-8 py-3 rounded-xl font-black text-xs shadow-md shadow-emerald-700/20 active:scale-95 transition-all"
              >
                <Sliders className="w-4 h-4" />
                <span>Go to Preferences</span>
              </button>
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 px-5 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <span>Browse Master Catalog Instead</span>
              </Link>
            </div>
          </div>
        ) : (
          /* Active Recommendation Engine Content */
          <div className="space-y-6">
            {/* Control Bar: Saved Preferences Summary Chips & Category Dropdown */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              {/* Search in Recommendation Engine */}
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search recommendations by name or brand ('oats', 'protein', 'almond')..."
                  className="w-full pl-10 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0c831f] focus:bg-white transition-all shadow-inner"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
                    title="Clear query"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Left: Saved Preferences Summary Chips */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    <Filter className="w-3.5 h-3.5 text-[#0c831f]" />
                    <span>Saved Preference Profile:</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {preferences.highProtein && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-[#0c831f] rounded-full text-xs font-bold border border-emerald-200 shadow-2xs">
                        <span>High Protein</span>
                        <button
                          onClick={() => handleRemovePreference('highProtein')}
                          className="hover:text-rose-600 p-0.5 rounded-full"
                          title="Remove High Protein"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}

                    {preferences.lowCalories && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-[#0c831f] rounded-full text-xs font-bold border border-emerald-200 shadow-2xs">
                        <span>Low Calories</span>
                        <button
                          onClick={() => handleRemovePreference('lowCalories')}
                          className="hover:text-rose-600 p-0.5 rounded-full"
                          title="Remove Low Calories"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}

                    {preferences.lowSugar && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-[#0c831f] rounded-full text-xs font-bold border border-emerald-200 shadow-2xs">
                        <span>Low Sugar</span>
                        <button
                          onClick={() => handleRemovePreference('lowSugar')}
                          className="hover:text-rose-600 p-0.5 rounded-full"
                          title="Remove Low Sugar"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}

                    {preferences.highFiber && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-[#0c831f] rounded-full text-xs font-bold border border-emerald-200 shadow-2xs">
                        <span>High Fibre</span>
                        <button
                          onClick={() => handleRemovePreference('highFiber')}
                          className="hover:text-rose-600 p-0.5 rounded-full"
                          title="Remove High Fibre"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}

                    {preferences.lowSodium && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-[#0c831f] rounded-full text-xs font-bold border border-emerald-200 shadow-2xs">
                        <span>Low Sodium</span>
                        <button
                          onClick={() => handleRemovePreference('lowSodium')}
                          className="hover:text-rose-600 p-0.5 rounded-full"
                          title="Remove Low Sodium"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}

                    {preferences.lowSaturatedFat && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-[#0c831f] rounded-full text-xs font-bold border border-emerald-200 shadow-2xs">
                        <span>Low Saturated Fat</span>
                        <button
                          onClick={() => handleRemovePreference('lowSaturatedFat')}
                          className="hover:text-rose-600 p-0.5 rounded-full"
                          title="Remove Low Saturated Fat"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}

                    {preferences.lowFat && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-[#0c831f] rounded-full text-xs font-bold border border-emerald-200 shadow-2xs">
                        <span>Low Fat</span>
                        <button
                          onClick={() => handleRemovePreference('lowFat')}
                          className="hover:text-rose-600 p-0.5 rounded-full"
                          title="Remove Low Fat"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}

                    {preferences.vegetarian && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-50 text-teal-700 rounded-full text-xs font-bold border border-teal-200 shadow-2xs">
                        <span>Vegetarian</span>
                        <button
                          onClick={() => handleRemovePreference('vegetarian')}
                          className="hover:text-rose-600 p-0.5 rounded-full"
                          title="Remove Vegetarian"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}

                    {preferences.vegan && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-50 text-teal-700 rounded-full text-xs font-bold border border-teal-200 shadow-2xs">
                        <span>Vegan</span>
                        <button
                          onClick={() => handleRemovePreference('vegan')}
                          className="hover:text-rose-600 p-0.5 rounded-full"
                          title="Remove Vegan"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}

                    {preferences.avoidAllergens?.map((a, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-rose-50 text-rose-700 rounded-full text-xs font-bold border border-rose-200 shadow-2xs">
                        <span>Avoid: {a}</span>
                      </span>
                    ))}

                    <Link
                      to="/preferences"
                      className="text-xs font-bold text-slate-500 hover:text-[#0c831f] underline ml-1"
                    >
                      Adjust Preferences
                    </Link>
                  </div>
                </div>

                {/* Right: PART 4 — Authoritative Category Dropdown */}
                <div className="shrink-0 flex items-center gap-3">
                  <div className="flex flex-col">
                    <label htmlFor="rec-category-select" className="text-[11px] font-black uppercase text-slate-400 tracking-wider mb-1">
                      Filter by Category
                    </label>
                    <select
                      id="rec-category-select"
                      value={selectedCategoryId}
                      onChange={(e) => setSelectedCategoryId(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0c831f] cursor-pointer shadow-inner"
                    >
                      <option value="all">
                        All Categories ({catalog?.metadata?.total_products || allProducts.length || 500} products)
                      </option>
                      {categories.map((cat) => (
                        <option key={cat.category_id} value={cat.category_id}>
                          {cat.category_name} ({cat.product_count} products)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Ranking Metric Notification Banner */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
                  <TrendingUp className="w-4 h-4 text-[#0c831f]" />
                  <span>
                    Ranking Criterion:{' '}
                    <strong className="text-slate-900">{rankingSummary || 'Nutritional Compatibility'}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {excludedDietaryCount > 0 && (
                    <div className="flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 rounded-full">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                      <span>{excludedDietaryCount} excluded by dietary / allergen rules</span>
                    </div>
                  )}
                  <div className="text-slate-500 font-bold">
                    <span>{rankedProducts.length} items ranked</span>
                    <span className="text-slate-400 mx-1.5">•</span>
                    <span>Category: {selectedCategoryId === 'all' ? 'All Categories' : currentCategory?.category_name}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Loading Indicator */}
            {loading && (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-slate-200 border-t-[#0c831f] rounded-full animate-spin mb-4" />
                <h3 className="text-base font-black text-slate-800">
                  Ranking Products by Nutritional Compatibility...
                </h3>
              </div>
            )}

            {/* Error Indicator */}
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-6 rounded-2xl flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <div>
                  <p className="font-bold text-sm">Failed to load recommendations</p>
                  <p className="text-xs">{error}</p>
                </div>
              </div>
            )}

            {/* Empty Result within Category */}
            {!loading && !error && rankedProducts.length === 0 && (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs">
                <Info className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-black text-slate-900">
                  No products found in {currentCategory?.category_name || 'selected category'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Try selecting All Categories or adjusting your preferences.
                </p>
              </div>
            )}

            {/* Ranked Products Grid */}
            {!loading && !error && rankedProducts.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5 sm:gap-4">
                {rankedProducts.map((product, idx) => {
                  const prodId = product.product_id || product._id || product.productId || product.catalog?.productId;
                  const nutrientDisplay = getNutrientRankingDisplay(product);

                  return (
                    <div key={prodId} className="flex flex-col relative group">
                      {/* Product Card with Synchronized Match Score & FSSAI Badges */}
                      <ProductCard
                        product={product}
                        isCompared={hasProduct(prodId)}
                        onToggleCompare={handleToggleCompare}
                        onSelectProduct={setSelectedProduct}
                      />

                      {/* Prominent Nutritional Ranking Strip */}
                      <div className="mt-1.5 px-2 py-1 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-700 flex items-center justify-between">
                        <span className="text-[#0c831f] font-black">Rank #{idx + 1}</span>
                        {nutrientDisplay && (
                          <span className="text-slate-600 truncate ml-1" title={nutrientDisplay}>
                            {nutrientDisplay}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        isCompared={selectedProduct ? hasProduct(selectedProduct.product_id || selectedProduct._id || selectedProduct.productId || selectedProduct.catalog?.productId) : false}
        onToggleCompare={handleToggleCompare}
      />

      {/* Comparison Drawer */}
      <CompareDrawer
        isOpen={isCompareDrawerOpen}
        onClose={() => setIsCompareDrawerOpen(false)}
        comparedProducts={compareList}
        onRemoveProduct={removeProduct}
        onClearAll={clearProducts}
      />
    </div>
  );
};

export default RecommendationsPage;
