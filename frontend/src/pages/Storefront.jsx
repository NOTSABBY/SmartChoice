import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { CategorySidebar, CATEGORY_ICONS } from '../components/CategorySidebar';
import { ProductCard } from '../components/ProductCard';
import { ProductDetailModal } from '../components/ProductDetailModal';
import { CompareDrawer } from '../components/CompareDrawer';
import { useComparison } from '../context/ComparisonContext';
import { usePreferences } from '../context/PreferenceContext';
import { searchProducts } from '../services/productService';
import {
  calculateProductQualityScore,
  evaluateProductPreferences,
  extractNutrient,
  getProductCategoryFormat,
  hasActivePreferences,
  getActiveNutritionalPreferences,
  singlePreferenceComparators
} from '../utils/productScoring';
import { matchesSelectedCategory, matchesSearchQuery } from '../utils/categoryMatching';
import { isProductGloballyEligible } from '../utils/productEligibility';
import {
  Sparkles,
  ArrowUpDown,
  RefreshCw,
  ShieldCheck,
  Award,
  Layers,
  Sliders,
  Filter
} from 'lucide-react';

export const Storefront = () => {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter & Navigation State
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [sortBy, setSortBy] = useState('score_desc');
  const searchRequestIdRef = useRef(0);

  // Modals & Drawers
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isCompareDrawerOpen, setIsCompareDrawerOpen] = useState(false);
  const [isMobileCategoryOpen, setIsMobileCategoryOpen] = useState(false);

  // Global Contexts
  const {
    compareList = [],
    comparisonProducts = compareList,
    addProduct,
    removeProduct,
    hasProduct,
    clearProducts,
    clearComparison = clearProducts
  } = useComparison();
  const { hasSavedPreferences, preferences = {} } = usePreferences?.() || {};

  // Load Catalog-500 Data
  const loadCatalog = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/data/enriched_catalog_500.json');
      if (!res.ok) {
        throw new Error(`Failed to load catalog data (HTTP ${res.status})`);
      }
      const data = await res.json();
      setCatalog(data);
    } catch (err) {
      console.warn("Local catalog fetch notice:", err.message);
      setError(err.message || 'Could not load local catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  // Handle Backend Search integration with request-id tracking and category-awareness
  const performSearch = async (term, categoryId = selectedCategoryId) => {
    const requestId = ++searchRequestIdRef.current;
    if (!term || !term.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const res = await searchProducts(term, categoryId, { ...preferences, scope: 'catalog' });
      if (requestId !== searchRequestIdRef.current) return; // Stale response guard
      if (res && res.success && res.data) {
        setSearchResults(res.data);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      if (requestId !== searchRequestIdRef.current) return;
      console.warn("Backend search failed, falling back to local catalog filtering:", err.message);
      setSearchResults(null);
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setIsSearching(false);
      }
    }
  };

  // Debounced search trigger for backend with category dependency
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        performSearch(searchQuery, selectedCategoryId);
      } else {
        searchRequestIdRef.current++;
        setSearchResults(null);
        setIsSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategoryId]);

  // All products flattened
  const allProducts = useMemo(() => {
    if (!catalog?.categories) return [];
    return catalog.categories.flatMap((cat) => cat.products);
  }, [catalog]);

  const hasActiveGlobalRestrictions = Boolean(
    (Array.isArray(preferences.avoidAllergens) && preferences.avoidAllergens.length > 0) ||
    (Array.isArray(preferences.excludedIngredients) && preferences.excludedIngredients.length > 0) ||
    (Array.isArray(preferences.avoidIngredients) && preferences.avoidIngredients.length > 0)
  );

  // Selected Category
  const currentCategory = useMemo(() => {
    if (!catalog || selectedCategoryId === null) return null;
    return catalog.categories.find((c) => c.category_id === selectedCategoryId) || null;
  }, [catalog, selectedCategoryId]);

  const globallyExcludedCount = useMemo(() => {
    if (!hasActiveGlobalRestrictions || allProducts.length === 0) return 0;
    const currentPool = selectedCategoryId === null
      ? allProducts
      : (currentCategory?.products || allProducts.filter((p) => matchesSelectedCategory(p, selectedCategoryId, currentCategory)));
    return currentPool.filter((p) => !isProductGloballyEligible(p, preferences, { scope: 'catalog' })).length;
  }, [allProducts, selectedCategoryId, currentCategory, preferences, hasActiveGlobalRestrictions]);

  // Master Catalog Filtered & Sorted Products (Strictly Neutral & Independent of User Preferences)
  const filteredProducts = useMemo(() => {
    // 1. Determine category base pool
    const basePool = selectedCategoryId === null
      ? allProducts
      : (currentCategory?.products || allProducts.filter((p) => matchesSelectedCategory(p, selectedCategoryId, currentCategory)));

    let list = [];
    if (searchResults !== null && Array.isArray(searchResults)) {
      // Backend returned results: strictly filter by selected category
      list = searchResults.filter((p) => matchesSelectedCategory(p, selectedCategoryId, currentCategory));
    } else {
      list = basePool;
    }

    // 2. Authoritative filtering:
    // Checks category scoping, product name & brand matching, and global dietary eligibility
    list = list.filter((p) => {
      const inCategory = matchesSelectedCategory(p, selectedCategoryId, currentCategory);
      const inSearch = matchesSearchQuery(p, searchQuery);
      const isEligible = isProductGloballyEligible(p, preferences, { scope: 'catalog' });
      return inCategory && inSearch && isEligible;
    });

    // Decorate every product with deterministic objective scoring (Strictly Independent of User Preferences)
    const decoratedList = list.map((item) => {
      const scScore = calculateProductQualityScore(item, {}); // Neutral objective score in Master Catalog
      const format = getProductCategoryFormat(item);

      return {
        ...item,
        allergenExcluded: false,
        calculatedScore: scScore,
        matchScore: null,
        preferenceEval: null,
        format,
        finalScore: scScore
      };
    });

    // Master Catalog Sorting implementation
    const sorted = [...decoratedList];
    switch (sortBy) {
      case 'score_desc':
      case 'smartchoice_recommended': // Default to objective quality score in Master Catalog
        sorted.sort((a, b) => {
          if (b.calculatedScore !== a.calculatedScore) return b.calculatedScore - a.calculatedScore;
          const na = a.product_name || a.catalog?.productName || '';
          const nb = b.product_name || b.catalog?.productName || '';
          return na.localeCompare(nb);
        });
        break;

      case 'protein_desc':
        sorted.sort((a, b) => singlePreferenceComparators.highProtein(a, b));
        break;

      case 'calories_asc':
        sorted.sort((a, b) => singlePreferenceComparators.lowCalories(a, b));
        break;

      case 'sugar_asc':
        sorted.sort((a, b) => singlePreferenceComparators.lowSugar(a, b));
        break;

      case 'fiber_desc':
        sorted.sort((a, b) => singlePreferenceComparators.highFiber(a, b));
        break;

      case 'sodium_asc':
        sorted.sort((a, b) => singlePreferenceComparators.lowSodium(a, b));
        break;

      case 'satfat_asc':
        sorted.sort((a, b) => singlePreferenceComparators.lowSaturatedFat(a, b));
        break;

      case 'fat_asc':
        sorted.sort((a, b) => singlePreferenceComparators.lowFat(a, b));
        break;

      case 'score_desc':
        sorted.sort((a, b) => {
          if (b.calculatedScore !== a.calculatedScore) return b.calculatedScore - a.calculatedScore;
          const na = a.product_name || a.catalog?.productName || '';
          const nb = b.product_name || b.catalog?.productName || '';
          return na.localeCompare(nb);
        });
        break;

      case 'score_asc':
        sorted.sort((a, b) => {
          if (a.calculatedScore !== b.calculatedScore) return a.calculatedScore - b.calculatedScore;
          const na = a.product_name || a.catalog?.productName || '';
          const nb = b.product_name || b.catalog?.productName || '';
          return na.localeCompare(nb);
        });
        break;

      case 'confidence_desc':
        sorted.sort((a, b) => {
          const ca = a.score?.coverage?.overallCompleteness ?? a.dataQuality?.completeness ?? 85;
          const cb = b.score?.coverage?.overallCompleteness ?? b.dataQuality?.completeness ?? 85;
          return cb - ca;
        });
        break;

      case 'nova_asc':
        sorted.sort((a, b) => {
          const na = a.nutrition_info?.nova_group ?? a.processing?.novaGroup ?? 3;
          const nb = b.nutrition_info?.nova_group ?? b.processing?.novaGroup ?? 3;
          return na - nb;
        });
        break;

      case 'name_asc':
        sorted.sort((a, b) => {
          const na = a.product_name || a.catalog?.productName || '';
          const nb = b.product_name || b.catalog?.productName || '';
          return na.localeCompare(nb);
        });
        break;

      case 'name_desc':
        sorted.sort((a, b) => {
          const na = a.product_name || a.catalog?.productName || '';
          const nb = b.product_name || b.catalog?.productName || '';
          return nb.localeCompare(na);
        });
        break;

      default:
        break;
    }

    return sorted;
  }, [allProducts, currentCategory, selectedCategoryId, searchQuery, searchResults, sortBy]);

  // Toggle compare handler
  const handleToggleCompare = (product) => {
    const prodId = product.product_id || product._id || product.productId || product.catalog?.productId;
    if (hasProduct(prodId)) {
      removeProduct(prodId);
    } else {
      addProduct(product);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f6fb] flex flex-col selection:bg-[#0c831f] selection:text-white">
      {/* Redesigned Storefront Navbar */}
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={(term) => performSearch(term, selectedCategoryId)}
        comparedCount={compareList.length}
        onOpenCompareDrawer={() => setIsCompareDrawerOpen(true)}
        onOpenMobileCategories={() => setIsMobileCategoryOpen(true)}
      />

      {/* Main Browse Layout — Strict 2-Column Grid to eliminate sidebar/content overlap */}
      <main className="max-w-[1720px] mx-auto w-full px-3 sm:px-4 py-4 flex-1 flex flex-col lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-6 items-start">
        {/* Desktop Category Sidebar (Dedicated 280px column) */}
        <aside aria-label="Categories Sidebar" className="hidden lg:block w-[280px] shrink-0">
          <CategorySidebar
            categories={catalog?.categories || []}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
            totalProductsCount={catalog?.metadata?.total_products || allProducts?.length || 500}
          />
        </aside>

        {/* Product Grid & Controls Area (Isolated Main Column) */}
        <div className="w-full min-w-0">
          {/* Category Hero Banner */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 mb-6 shadow-xs relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-black uppercase text-[#0c831f] tracking-wider">
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {selectedCategoryId === null ? 'Master Packaged Catalog' : 'Category Section'}
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1 flex items-center gap-2">
                  <span>
                    {selectedCategoryId === null ? 'All Authentic Packaged Foods' : currentCategory?.category_name}
                  </span>
                  <span className="text-sm font-black text-slate-500 bg-slate-100 px-3 py-0.5 rounded-full">
                    {filteredProducts.length} items
                  </span>
                </h1>

                {/* Mobile / Tablet Quick Category Pill (Stacked navigation for < lg screens) */}
                <div className="lg:hidden mt-2">
                  <button
                    onClick={() => setIsMobileCategoryOpen(true)}
                    className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200/80 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 transition-colors"
                    title="Change product category"
                  >
                    <span>📁</span>
                    <span>
                      {selectedCategoryId === null
                        ? `All Categories (${catalog?.categories?.length || 25})`
                        : `${currentCategory?.category_name || 'Category'} (${filteredProducts.length})`}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Change</span>
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-xl">
                  {selectedCategoryId === null
                    ? 'Explore 500 lab-enriched packaged food items across 25 categories evaluated with SmartChoice 5-component scoring, FSSAI claims, and additive safety.'
                    : `Verified FSSAI nutritional facts, ingredient analysis, and studio packshots for ${currentCategory?.category_name || 'selected category'}.`}
                </p>

                {/* Active Saved Preference Banner with Direct Link to Recommendation Engine */}
                {hasSavedPreferences && (
                  <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-100 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-500">Saved Preferences Profile Active:</span>
                    <Link
                      to="/recommendations"
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-full transition-colors shadow-2xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#0c831f]" />
                      <span>View Personalized Ranking in Recommendation Engine →</span>
                    </Link>
                  </div>
                )}

                {/* Global Dietary Filter Active Notice */}
                {hasActiveGlobalRestrictions && globallyExcludedCount > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900 bg-amber-50/90 border border-amber-200/80 px-3 py-1 rounded-full mt-2 w-fit">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    <span>Filtered by saved dietary & allergen rules ({globallyExcludedCount} product{globallyExcludedCount > 1 ? 's' : ''} excluded)</span>
                  </div>
                )}

              </div>

              {/* Master Catalog Sorting Dropdown */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-transparent focus:outline-none cursor-pointer text-xs font-bold"
                  >
                    <option value="score_desc">Quality Score: High to Low (Default)</option>
                    <option value="score_asc">Quality Score: Low to High</option>
                    <option value="confidence_desc">Confidence: High to Low</option>
                    <option value="nova_asc">Least Processed First</option>
                    <option value="name_asc">Product Name: A to Z</option>
                    <option value="name_desc">Product Name: Z to A</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-10 -right-10 w-44 h-44 rounded-full bg-emerald-50/60 pointer-events-none" />
          </div>

          {/* Loading Indicator */}
          {(loading || isSearching) && (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs flex flex-col items-center justify-center">
              <div className="w-12 h-12 border-4 border-slate-200 border-t-[#0c831f] rounded-full animate-spin mb-4" />
              <h3 className="text-base font-black text-slate-800">
                Evaluating Product Intelligence...
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Synchronizing 500 packaged products with FSSAI statutory standards
              </p>
            </div>
          )}

          {/* Empty Search / Filter State (Strict category-aware empty state) */}
          {!loading && !isSearching && filteredProducts.length === 0 && (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs">
              <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3 text-2xl">
                🔍
              </div>
              <h3 className="text-base font-black text-slate-900">
                No products found
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {selectedCategoryId !== null && currentCategory
                  ? `No products matching "${searchQuery}" in "${currentCategory.category_name}". Try searching across All Categories or using different keywords.`
                  : `We couldn't find any items matching "${searchQuery}". Try searching for brands like Parle, Maggi, Britannia, or MTR.`
                }
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {searchQuery.trim() && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults(null);
                    }}
                    className="bg-[#0c831f] text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-[#086616] transition-colors"
                  >
                    Clear search
                  </button>
                )}
                {selectedCategoryId !== null && (
                  <button
                    onClick={() => {
                      setSelectedCategoryId(null);
                      setSearchResults(null);
                    }}
                    className="border border-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    View All Categories
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Product Grid (5-column desktop) */}
          {!loading && !isSearching && filteredProducts.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5 sm:gap-4">
              {filteredProducts.map((product) => {
                const prodId = product.product_id || product._id || product.productId || product.catalog?.productId;
                return (
                  <ProductCard
                    key={prodId}
                    product={product}
                    isCompared={hasProduct(prodId)}
                    onToggleCompare={handleToggleCompare}
                    onSelectProduct={setSelectedProduct}
                  />
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        isCompared={selectedProduct ? hasProduct(selectedProduct.product_id || selectedProduct._id || selectedProduct.productId || selectedProduct.catalog?.productId) : false}
        onToggleCompare={handleToggleCompare}
      />

      {/* Comparison Shortlist Drawer */}
      <CompareDrawer
        isOpen={isCompareDrawerOpen}
        onClose={() => setIsCompareDrawerOpen(false)}
        comparedProducts={compareList}
        onRemoveProduct={removeProduct}
        onClearAll={clearProducts}
      />

      {/* Mobile Category Drawer */}
      {isMobileCategoryOpen && catalog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-start lg:hidden">
          <div className="w-80 max-w-full bg-white h-full p-4 overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900">All Categories</h3>
              <button
                onClick={() => setIsMobileCategoryOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 space-y-1">
              <button
                onClick={() => {
                  setSelectedCategoryId(null);
                  setIsMobileCategoryOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs font-bold ${
                  selectedCategoryId === null ? 'bg-[#0c831f] text-white' : 'text-slate-700'
                }`}
              >
                <span>All Categories</span>
                <span>{catalog?.metadata?.total_products || allProducts?.length || 500}</span>
              </button>
              {catalog.categories.map((cat) => (
                <button
                  key={cat.category_id}
                  onClick={() => {
                    setSelectedCategoryId(cat.category_id);
                    setIsMobileCategoryOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs font-bold ${
                    selectedCategoryId === cat.category_id
                      ? 'bg-emerald-50 text-[#0c831f]'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{CATEGORY_ICONS[cat.category_id] || '📦'}</span>
                    <span>{cat.category_name}</span>
                  </div>
                  <span className="text-slate-400 text-[11px]">{cat.product_count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Storefront;
