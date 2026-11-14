import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Activity, CheckCircle, AlertCircle, Plus, Info, ChevronRight, Loader2, Filter, ShieldCheck, Image as ImageIcon } from 'lucide-react';
import { searchProducts, getRecommendations } from '../services/productService';
import { usePreferences } from '../context/PreferenceContext';
import { useComparison } from '../context/ComparisonContext';

export const RecommendationsPage = () => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { preferences } = usePreferences();
  const { addProduct, hasProduct } = useComparison();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRecommendations = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch representative products from across categories
        const searchRes = await searchProducts('a'); // Broad query to get catalog sample
        const products = searchRes.success && searchRes.data ? searchRes.data : [];

        if (products.length > 0) {
          const productIds = products.slice(0, 20).map(p => p._id);
          const recRes = await getRecommendations(productIds, preferences);
          if (recRes.success && Array.isArray(recRes.data)) {
            // Sort by finalScore descending
            const sorted = recRes.data.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));
            setRecommendations(sorted);
          } else {
            setRecommendations([]);
          }
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load recommendations');
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [preferences]);

  return (
    <div className="space-y-8 animate-in pb-12 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-green-700 rounded-3xl p-8 lg:p-12 text-white shadow-lg">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-semibold uppercase tracking-wider mb-4">
          <Sparkles className="w-4 h-4" />
          <span>Tailored For You</span>
        </div>
        <h1 className="text-3xl lg:text-5xl font-black mb-4 tracking-tight">Personalized Recommendations</h1>
        <p className="text-white/80 max-w-2xl text-base lg:text-lg leading-relaxed">
          Products ranked by SmartChoice nutritional quality and matched against your active dietary preferences and allergen exclusions.
        </p>
      </div>

      {/* Active Preferences Filter Bar */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <span className="font-bold text-gray-700 text-sm">Active Filters:</span>
          <div className="flex flex-wrap gap-2">
            {preferences.highProtein && (
              <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold border border-green-200">High Protein</span>
            )}
            {preferences.lowSugar && (
              <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold border border-green-200">Low Sugar</span>
            )}
            {preferences.highFiber && (
              <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold border border-green-200">High Fibre</span>
            )}
            {preferences.avoidAllergens?.map((a, i) => (
              <span key={i} className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-bold border border-red-200">
                Avoid: {a}
              </span>
            ))}
            {!preferences.highProtein && !preferences.lowSugar && !preferences.highFiber && (!preferences.avoidAllergens || preferences.avoidAllergens.length === 0) && (
              <span className="text-gray-400 text-xs italic">Default general nutritional optimization</span>
            )}
          </div>
        </div>
        <button
          onClick={() => navigate('/preferences')}
          className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-4 py-2 rounded-xl transition-colors"
        >
          Adjust Preferences
        </button>
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm h-64 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="h-4 bg-gray-100 rounded w-2/3 mb-2"></div>
              <div className="h-4 bg-gray-100 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="p-6 bg-red-50 border border-red-100 text-red-700 rounded-2xl flex items-center">
          <AlertCircle className="w-6 h-6 mr-3 shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {!loading && !error && recommendations.length === 0 && (
        <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 shadow-sm">
          <Info className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Recommendations Found</h3>
          <p className="text-gray-500">Try loosening your dietary constraints or search for specific products.</p>
        </div>
      )}

      {!loading && recommendations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {recommendations.map((rec) => {
            const isExcluded = rec.isEligible === false;
            return (
              <div
                key={rec.productId}
                className={`bg-white rounded-2xl border transition-all duration-300 shadow-sm hover:shadow-md flex flex-col overflow-hidden ${
                  isExcluded ? 'border-red-200 bg-red-50/20' : 'border-gray-100 hover:border-emerald-200'
                }`}
              >
                <div className="p-6 flex-grow">
                  <div className="flex justify-between items-start gap-4 mb-3">
                    <div>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">
                        {rec.brand || 'Packaged Goods'}
                      </span>
                      <h3
                        onClick={() => navigate(`/product/${rec.productId}`)}
                        className="font-extrabold text-gray-900 text-xl leading-tight cursor-pointer hover:text-emerald-600 transition-colors"
                      >
                        {rec.productName || 'SmartChoice Catalog Product'}
                      </h3>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-sm bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <Activity className="w-4 h-4" />
                        <span>Match: {rec.finalScore || rec.smartChoiceScore || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Positive Contributors */}
                  {rec.positiveFactors && rec.positiveFactors.length > 0 && (
                    <div className="mt-4 space-y-1.5">
                      {rec.positiveFactors.slice(0, 3).map((f, i) => (
                        <div key={i} className="flex items-center text-xs font-medium text-emerald-800">
                          <CheckCircle className="w-3.5 h-3.5 mr-2 text-emerald-600 shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Safety Exclusions */}
                  {isExcluded && (
                    <div className="mt-4 p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-700 font-semibold flex items-center">
                      <AlertCircle className="w-4 h-4 mr-2 shrink-0" />
                      <span>Safety Exclusion: Contains avoided allergen or restricted ingredient.</span>
                    </div>
                  )}

                  {/* Confidence and Completeness Pill */}
                  <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 font-medium">
                    <span>SmartChoice Score: <strong className="text-gray-800">{rec.smartChoiceScore || 0}/100</strong></span>
                    <span>Confidence: <strong className="text-gray-800">{rec.confidence?.level || 'high'}</strong></span>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="bg-gray-50/70 px-6 py-3 border-t border-gray-100 flex justify-between items-center">
                  <button
                    onClick={() => navigate(`/product/${rec.productId}`)}
                    className="text-xs font-bold text-gray-700 hover:text-emerald-700 flex items-center transition-colors"
                  >
                    View Analysis <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                  <button
                    onClick={() => addProduct({ _id: rec.productId, identity: { name: rec.productName, brand: rec.brand } })}
                    disabled={hasProduct(rec.productId)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center transition-colors ${
                      hasProduct(rec.productId)
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    {hasProduct(rec.productId) ? 'In Compare' : 'Compare'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RecommendationsPage;