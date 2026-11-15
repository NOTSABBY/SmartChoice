import React, { useState, useEffect, useMemo } from 'react';
import { usePreferences, hasActiveSavedPreferences } from '../context/PreferenceContext';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, CheckCircle, Sliders, HeartPulse, ShieldAlert, Sparkles, RotateCcw, Leaf, ChevronRight, AlertCircle } from 'lucide-react';

const normalizeUserInputArray = (rawString, type = 'general') => {
  if (!rawString || typeof rawString !== 'string') return [];
  const parts = rawString.split(',');
  const result = [];
  const seen = new Set();

  for (const part of parts) {
    const trimmed = part.trim().toLowerCase();
    if (!trimmed || trimmed.length < 2) continue;

    let canonical = trimmed;
    if (type === 'allergen') {
      if (/^(peanut|peanuts|groundnut|groundnuts)$/.test(trimmed)) canonical = 'peanuts';
      else if (/^(tree\s*nuts?|treenuts?|nuts?)$/.test(trimmed)) canonical = 'tree nuts';
      else if (/^(milk|dairy|lactose)$/.test(trimmed)) canonical = 'milk';
      else if (/^(soya|soy|soybean)$/.test(trimmed)) canonical = 'soy';
      else if (/^(wheat|atta|maida|gluten)$/.test(trimmed)) canonical = 'gluten';
      else if (/^(egg|eggs)$/.test(trimmed)) canonical = 'egg';
      else if (/^(crustacean|crustaceans|shrimp|prawn|prawns|crab|lobster|shellfish)$/.test(trimmed)) canonical = 'crustaceans';
      else if (/^(sulphite|sulphites|sulfite|sulfites)$/.test(trimmed)) canonical = 'sulphites';
    } else if (type === 'ingredient') {
      if (/^(palm\s*oil|palmate|palmitate|rbd\s*palm\s*oil)$/.test(trimmed)) canonical = 'palm oil';
      else if (/^(msg|monosodium\s*glutamate|ins\s*621|e621)$/.test(trimmed)) canonical = 'MSG';
      else if (/^(artificial\s*colou?rs?|synthetic\s*colou?rs?|tartrazine|sunset\s*yellow)$/.test(trimmed)) canonical = 'artificial colour';
      else if (/^(hfcs|high\s*fructose\s*corn\s*syrup)$/.test(trimmed)) canonical = 'high fructose corn syrup';
      else if (/^(preservatives?|sodium\s*benzoate|potassium\s*sorbate|ins\s*211)$/.test(trimmed)) canonical = 'preservatives';
    }

    if (!seen.has(canonical.toLowerCase())) {
      seen.add(canonical.toLowerCase());
      result.push(canonical);
    }
  }

  return result;
};

const PreferencesPage = () => {
  const { preferences, savePreferences, clearPreferences, hasSavedPreferences, loading } = usePreferences();
  const [formData, setFormData] = useState({});
  const [allergenInput, setAllergenInput] = useState('');
  const [ingredientInput, setIngredientInput] = useState('');
  const [saved, setSaved] = useState(false);
  const [clearedNotice, setClearedNotice] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && preferences) {
      setFormData(preferences);
      setAllergenInput((preferences.avoidAllergens || []).join(', '));
      setIngredientInput((preferences.excludedIngredients || preferences.avoidIngredients || []).join(', '));
    }
  }, [preferences, loading]);

  const hasUnsavedChanges = useMemo(() => {
    if (!formData || !preferences) return false;
    const keys = ['highProtein', 'lowSugar', 'lowCalories', 'lowSaturatedFat', 'lowSodium', 'highFiber', 'lowFat', 'vegetarian', 'vegan'];
    for (const k of keys) {
      if (Boolean(formData[k]) !== Boolean(preferences[k])) return true;
    }
    const cleanAllergens = normalizeUserInputArray(allergenInput, 'allergen').join(',');
    const savedAllergens = (preferences.avoidAllergens || []).join(',');
    if (cleanAllergens !== savedAllergens) return true;

    const cleanIngredients = normalizeUserInputArray(ingredientInput, 'ingredient').join(',');
    const savedIngredients = (preferences.excludedIngredients || preferences.avoidIngredients || []).join(',');
    if (cleanIngredients !== savedIngredients) return true;

    return false;
  }, [formData, preferences, allergenInput, ingredientInput]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setSaved(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanAllergens = normalizeUserInputArray(allergenInput, 'allergen');
    const cleanIngredients = normalizeUserInputArray(ingredientInput, 'ingredient');

    const updated = {
      ...formData,
      avoidAllergens: cleanAllergens,
      excludedIngredients: cleanIngredients,
      avoidIngredients: cleanIngredients
    };

    savePreferences(updated);
    setAllergenInput(cleanAllergens.join(', '));
    setIngredientInput(cleanIngredients.join(', '));
    setSaved(true);
    setTimeout(() => setSaved(false), 4000);
  };

  const handleClearAll = () => {
    const cleared = {
      highProtein: false,
      lowSugar: false,
      lowCalories: false,
      lowSaturatedFat: false,
      lowSodium: false,
      highFiber: false,
      lowFat: false,
      vegetarian: false,
      vegan: false,
      avoidAllergens: [],
      excludedIngredients: [],
      avoidIngredients: []
    };
    setFormData(cleared);
    setAllergenInput('');
    setIngredientInput('');
    clearPreferences();
    setClearedNotice(true);
    setSaved(false);
    setTimeout(() => setClearedNotice(false), 3000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f6fb] flex items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-[#0c831f] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f6fb] flex flex-col selection:bg-[#0c831f] selection:text-white">
      {/* Minimal Dedicated Header with Bidirectional Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="flex items-baseline gap-0.5">
              <span className="text-2xl font-black tracking-tight text-[#0c831f]">Smart</span>
              <span className="text-2xl font-black tracking-tight text-emerald-950">Choice</span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
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
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#0c831f] px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Master Catalog</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto w-full px-4 py-8 flex-1">
        {/* Page Hero */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 mb-8 shadow-xs relative overflow-hidden">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase text-[#0c831f] tracking-wider">
                <Sliders className="w-4 h-4" />
                <span>Nutritional Personalization Engine</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                Nutritional & Dietary Preferences
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-xl">
                Configure your statutory nutritional targets, dietary lifestyle rules, and mandatory allergen avoidances. Saved dietary restrictions and exclusions apply globally across both the Master Catalog and Recommendation Engine, while nutritional targets dynamically rank items in the Recommendation Engine.
              </p>

              <div className="mt-3 p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs text-emerald-950 flex items-start gap-2 max-w-xl">
                <ShieldAlert className="w-4 h-4 text-[#0c831f] shrink-0 mt-0.5" />
                <span>
                  <strong>Strict Exclusions Scope Notice:</strong> Saved allergen avoidances and ingredient exclusions apply globally across both the Master Catalog and Recommendation Engine. Vegetarian and Vegan dietary lifestyle rules apply strictly to the Recommendation Engine, preserving the Master Catalog as a neutral baseline.
                </span>
              </div>

              {/* Unsaved vs Saved status pill */}
              <div className="flex items-center gap-2 mt-3">
                {hasUnsavedChanges ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md">
                    <AlertCircle className="w-3 h-3" /> Unsaved draft selections — Click "Save & Apply" below
                  </span>
                ) : hasSavedPreferences ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                    <CheckCircle className="w-3 h-3 text-[#0c831f]" /> Saved active preferences profile loaded
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-md">
                    No active preferences saved
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-2">
              {saved && (
                <div className="flex flex-col items-end gap-1.5 bg-emerald-50 text-[#0c831f] border border-emerald-200 p-3 rounded-2xl text-xs font-bold shadow-xs">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>Preferences Saved!</span>
                  </div>
                  <Link
                    to="/recommendations"
                    className="inline-flex items-center gap-1 text-[11px] font-black text-white bg-[#0c831f] hover:bg-[#086616] px-2.5 py-1 rounded-lg transition-colors mt-1"
                  >
                    <span>View Recommendations</span>
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
              {clearedNotice && (
                <div className="flex items-center gap-2 bg-amber-50 text-amber-800 border border-amber-200 px-4 py-2 rounded-2xl text-xs font-bold shadow-xs">
                  <RotateCcw className="w-4 h-4 shrink-0" />
                  <span>All Preferences Cleared!</span>
                </div>
              )}
              <button
                type="button"
                onClick={handleClearAll}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-rose-600 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-rose-200 hover:bg-rose-50/50 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear All Preferences</span>
              </button>
            </div>
          </div>
          <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-emerald-50/70 pointer-events-none" />
        </div>

        {/* Preference Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. Nutritional Target Goals */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-xs border border-slate-200">
            <div className="flex items-center gap-2 mb-1">
              <HeartPulse className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-black text-slate-900">
                Nutritional Target Goals
              </h2>
            </div>
            <p className="text-xs text-slate-500 mb-6">
              Select key nutrient criteria to prioritize in recommendation scoring and sorting:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {[
                { id: 'highProtein', label: 'High Protein', desc: 'Boost score for foods meeting FSSAI source (5.4g) & high (10.8g) protein thresholds' },
                { id: 'lowSugar', label: 'Low Sugar', desc: 'Prioritize low total & added sugar content (<= 5g/100g)' },
                { id: 'lowCalories', label: 'Low Calories', desc: 'Prioritize lower energy density per 100g/100ml (<= 120 kcal)' },
                { id: 'lowSaturatedFat', label: 'Low Saturated Fat', desc: 'Minimize saturated fatty acids (<= 1.5g/100g)' },
                { id: 'lowSodium', label: 'Low Sodium', desc: 'Favor lower salt / sodium formulations (<= 120mg/100g)' },
                { id: 'highFiber', label: 'High Fibre', desc: 'Reward foods with high dietary fibre (>= 6g/100g)' }
              ].map(goal => (
                <label
                  key={goal.id}
                  className={`flex flex-col p-4 rounded-2xl border transition-all cursor-pointer ${
                    formData[goal.id]
                      ? 'border-[#0c831f] bg-emerald-50/50 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-slate-900">{goal.label}</span>
                    <input
                      type="checkbox"
                      name={goal.id}
                      checked={!!formData[goal.id]}
                      onChange={handleChange}
                      className="w-4 h-4 rounded text-[#0c831f] focus:ring-[#0c831f]"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500 leading-relaxed">{goal.desc}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 2. Dietary Lifestyle Preferences (Applies ONLY to Recommendation Engine) */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-xs border border-slate-200">
            <div className="flex items-center gap-2 mb-1">
              <Leaf className="w-5 h-5 text-teal-600" />
              <h2 className="text-lg font-black text-slate-900">
                Dietary Lifestyle (Recommendation Engine Only)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mb-6">
              Filter eligible recommendations by verified dietary classification. Does not alter Master Catalog visibility:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {[
                { id: 'vegetarian', label: 'Vegetarian', desc: 'Prioritize verified vegetarian products carrying the FSSAI green vegetarian mark' },
                { id: 'vegan', label: 'Vegan', desc: 'Prioritize 100% plant-based products free of dairy, eggs, honey, and animal derivatives' }
              ].map(diet => (
                <label
                  key={diet.id}
                  className={`flex flex-col p-4 rounded-2xl border transition-all cursor-pointer ${
                    formData[diet.id]
                      ? 'border-teal-600 bg-teal-50/50 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-slate-900">{diet.label}</span>
                    <input
                      type="checkbox"
                      name={diet.id}
                      checked={!!formData[diet.id]}
                      onChange={handleChange}
                      className="w-4 h-4 rounded text-teal-600 focus:ring-teal-600"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500 leading-relaxed">{diet.desc}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 3. Strict Allergen & Ingredient Exclusions (Applies Globally to Master Catalog & Recommendation Engine) */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-xs border border-slate-200">
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              <h2 className="text-lg font-black text-slate-900">
                Strict Exclusions & Allergen Avoidances (Global Scope)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mb-6">
              Products containing any avoided allergen or excluded ingredient are strictly eliminated across all categories in both Master Catalog and Recommendation Engine:
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Avoided Allergens (Comma separated)
                </label>
                <input
                  type="text"
                  value={allergenInput}
                  onChange={(e) => {
                    setAllergenInput(e.target.value);
                    setSaved(false);
                  }}
                  placeholder="e.g. peanuts, tree nuts, gluten, soy, milk, egg, fish, crustacean"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0c831f] focus:bg-white"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Matches FSSAI statutory allergen classes across ingredient formulations and warning declarations.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Excluded Ingredients (Comma separated)
                </label>
                <input
                  type="text"
                  value={ingredientInput}
                  onChange={(e) => {
                    setIngredientInput(e.target.value);
                    setSaved(false);
                  }}
                  placeholder="e.g. palm oil, artificial colour, MSG, high fructose corn syrup"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0c831f] focus:bg-white"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Strict boundary token matching including additive INS codes and ingredient synonyms.
                </span>
              </div>
            </div>
          </div>

          {/* Save Button Bar & Bidirectional Navigation */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-200">
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Return to Master Catalog
              </Link>
              <span className="text-slate-300">•</span>
              <Link
                to="/recommendations"
                className="text-xs font-bold text-emerald-700 hover:text-emerald-900 transition-colors flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#0c831f]" />
                <span>Go to Recommendation Engine</span>
              </Link>
            </div>

            <button
              type="submit"
              className="flex items-center gap-2 bg-[#0c831f] hover:bg-[#086616] text-white px-8 py-3 rounded-xl font-black text-xs shadow-md shadow-emerald-700/20 active:scale-95 transition-all w-full sm:w-auto justify-center"
            >
              <Save className="w-4 h-4" />
              <span>Save & Apply Preferences</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default PreferencesPage;
