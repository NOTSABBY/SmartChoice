import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Database, AlertTriangle, Scale, CheckCircle2, Award, Zap } from 'lucide-react';
import { generatePackshotSvgClient } from '../utils/packshotFallback';
import { calculateProductQualityScore, calculateProductBreakdown, calculateProductConfidence } from '../utils/productScoring';
import { calculateProductVerification } from '../utils/productVerification';
import { calculateAllNutrientsPerServing } from '../utils/nutritionConversion';
import { usePreferences } from '../context/PreferenceContext';
import { DietaryEmblem } from './DietaryEmblem';

export const ProductDetailModal = ({
  product,
  onClose,
  isCompared = false,
  onToggleCompare,
}) => {
  const { preferences = {} } = usePreferences?.() || {};
  const [imgSrc, setImgSrc] = useState('');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (product) {
      const rawImage = product.images?.front_hd || product.images?.front_thumb || product.catalog?.images?.frontHd || product.media?.imageUrl || '';
      setImgSrc(rawImage);
      setHasError(false);
    }
  }, [product]);

  if (!product) return null;

  const brand = product.brand || product.catalog?.brand || product.identity?.brand || 'AUTHENTIC';
  const name = product.product_name || product.catalog?.productName || product.identity?.name || 'Packaged Food';
  const packagingSize = product.packaging_size || product.catalog?.packagingSize || product.serving?.servingSize || 'Standard Pack';
  const categoryId = product.category_id || product.catalog?.categoryId || 1;
  const categoryName = product.category_name || product.catalog?.categoryName || product.identity?.categories?.[0] || 'Packaged Foods';
  
  // Authoritative Dietary & Provenance Data
  const dc = product.dietary_classification || product.dietaryClassification;
  const dietaryStatus = dc?.status || (product.dietary_type === 'NON_VEG' ? 'NON_VEGETARIAN' : (product.dietary_type === 'VEG' ? 'VEGETARIAN' : 'UNKNOWN'));
  const isVeg = dietaryStatus === 'VEGETARIAN';
  const isNonVeg = dietaryStatus === 'NON_VEGETARIAN';
  const isVegan = Boolean(dc?.isVegan);
  const dietaryType = isNonVeg ? 'NON_VEG' : (isVeg ? 'VEG' : 'UNKNOWN');

  const nutri = product.nutrition_info;
  const ver = calculateProductVerification(product);
  const verificationStatus = ver.status;
  const sourceUrl = product.ingredients?.sourceUrl || nutri?.source_url || dc?.source;
  const sourceType = product.ingredients?.sourceType || nutri?.source_type || 'OFFICIAL_MANUFACTURER_PACKAGING';
  const declaredIngredients = nutri?.ingredients_text || product.ingredients?.rawText || product.ingredients?.rawIngredientsText || '';

  // Authoritative Nutritional Conversion & Calculations
  const servingConversion = calculateAllNutrientsPerServing(product);
  const per100g = servingConversion.per100g;
  const perServing = servingConversion.perServing;
  const servingSizeStr = servingConversion.servingLabel;

  // Authoritative SmartChoice Quality Score & 5-Component Breakdown
  const breakdownCalc = calculateProductBreakdown(product, preferences || {});
  const score = breakdownCalc?.totalScore ?? product.calculatedScore ?? 75;
  const breakdown = breakdownCalc?.breakdown || {
    nutrition: Math.round(score * 0.40),
    ingredients: Math.round(score * 0.20),
    processing: Math.round(score * 0.15),
    proteinFibre: Math.round(score * 0.15),
    preferences: 0
  };
  const conf = calculateProductConfidence(product) || {
    score: 85,
    level: 'high',
    label: 'High Confidence',
    breakdown: { nutrition: 85, ingredients: 85, processing: 80 }
  };
  const completeness = product.score?.coverage?.overallCompleteness ?? product.dataQuality?.completeness ?? 85;
  const novaGroup = product.analysis?.processingAnalysis?.novaGroup || product.processing?.novaGroup || nutri?.nova_group || 3;

  // Additives & Allergens
  const containsAllergens = product.ingredients?.allergenDeclarations?.contains || nutri?.allergens || product.ingredients?.allergens || [];
  const mayContainAllergens = product.ingredients?.allergenDeclarations?.mayContain || nutri?.may_contain || [];
  const additives = product.analysis?.additiveAnalysis?.additives || product.ingredients?.additives || [];

  const handleImageError = () => {
    if (!hasError) {
      setHasError(true);
      const fallbackSvg = generatePackshotSvgClient(brand, name, packagingSize, categoryId, dietaryType);
      setImgSrc(fallbackSvg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500 bg-slate-200/70 px-2.5 py-1 rounded-lg">
              {categoryName}
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-bold text-slate-600">
              ID: {product.product_id || product._id}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Left Column: Visual Packshot + Seals + Score Breakdown */}
          <div className="md:col-span-5 flex flex-col items-center">
            <div className="w-full aspect-square bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center p-6 relative group overflow-hidden shadow-inner">
              <img
                src={imgSrc || generatePackshotSvgClient(brand, name, packagingSize, categoryId, dietaryType)}
                alt={name}
                onError={handleImageError}
                className="max-h-full max-w-full object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-300"
              />

              {/* Verification status & completeness badge */}
              <div
                className={`absolute top-3 left-3 bg-slate-900/90 backdrop-blur-xs text-white text-[11px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm border ${
                  ver.status === 'Verified' ? 'border-emerald-500/40' :
                  ver.status === 'Partially Verified' ? 'border-amber-500/40' :
                  ver.status === 'Needs Review' ? 'border-purple-500/40' : 'border-slate-600/40'
                }`}
                title={`Verification: ${ver.status} (${ver.percentage}% evidence)\nReason: ${ver.reason}\nData Completeness: ${completeness}%`}
              >
                <ShieldCheck className={`w-3.5 h-3.5 ${
                  ver.status === 'Verified' ? 'text-emerald-400' :
                  ver.status === 'Partially Verified' ? 'text-amber-400' :
                  ver.status === 'Needs Review' ? 'text-purple-400' : 'text-slate-400'
                }`} />
                <span>{ver.status.toUpperCase()} ({ver.percentage}%)</span>
              </div>
            </div>

            {/* SmartChoice Overall Score Card */}
            <div className="w-full mt-4 p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/60 border border-emerald-200/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                  SmartChoice Quality Score
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-3xl font-black text-emerald-900">{score}</span>
                  <span className="text-xs font-bold text-emerald-700">/ 100</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[11px] font-semibold text-emerald-800">
                    Analysis Confidence: <strong>{conf.score}/100</strong> ({conf.label})
                  </span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-emerald-100 flex items-center justify-center text-emerald-700">
                <Award className="w-6 h-6 stroke-[2.2]" />
              </div>
            </div>

            {/* 5-Component Score Breakdown */}
            <div className="w-full mt-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Evidence Score Weights (Preserved Formula)
                </span>
                <span className="text-[10px] font-bold text-slate-500">{score}/100</span>
              </div>
              <div className="space-y-1.5 font-bold">
                <div className="flex justify-between items-center text-slate-700">
                  <span>Nutrition (40%)</span>
                  <span className="text-emerald-700">{breakdown.nutrition}/40</span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span>Ingredients (20%)</span>
                  <span className="text-emerald-700">{breakdown.ingredients}/20</span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span>Processing / NOVA (15%)</span>
                  <span className="text-emerald-700">{breakdown.processing}/15</span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span>Protein & Fibre (15%)</span>
                  <span className="text-emerald-700">{breakdown.proteinFibre}/15</span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span>User Preferences (10%)</span>
                  <span className={breakdown.preferences > 0 ? "text-emerald-700" : "text-slate-500"}>
                    {breakdown.preferences}/10
                  </span>
                </div>
              </div>
            </div>

            {/* Dedicated Analysis Confidence Card */}
            <div className="w-full mt-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Analysis Confidence
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                  (conf?.level || 'high') === 'high' ? 'bg-emerald-100 text-emerald-800' :
                  conf?.level === 'medium' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {conf?.score ?? 85}/100 — {conf?.label ?? 'High Confidence'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-tight">
                Confidence = 0.45Nr + 0.35Ir + 0.20Pr
              </p>
              <div className="grid grid-cols-3 gap-1 pt-1 text-[10px] font-bold text-center">
                <div className="bg-white p-1 rounded border border-slate-200">
                  <span className="block text-slate-400">Nutr (45%)</span>
                  <span className="text-slate-700">{conf?.breakdown?.nutrition ?? 85}%</span>
                </div>
                <div className="bg-white p-1 rounded border border-slate-200">
                  <span className="block text-slate-400">Ingr (35%)</span>
                  <span className="text-slate-700">{conf?.breakdown?.ingredients ?? 85}%</span>
                </div>
                <div className="bg-white p-1 rounded border border-slate-200">
                  <span className="block text-slate-400">NOVA (20%)</span>
                  <span className="text-slate-700">{conf?.breakdown?.processing ?? 80}%</span>
                </div>
              </div>
            </div>

            {/* NOVA Classification Card */}
            <div className="w-full mt-3 p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider">
                NOVA Processing
              </span>
              <span className="px-2.5 py-1 bg-slate-200 text-slate-900 rounded-lg text-xs font-black">
                GROUP {novaGroup}
              </span>
            </div>
          </div>

          {/* Right Column: Nutrition Table, Ingredients, Additives, Allergens */}
          <div className="md:col-span-7 flex flex-col justify-between space-y-6">
            <div>
              {/* Brand, Dietary Badge & Title */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black uppercase text-emerald-700 tracking-wider">
                  {brand}
                </span>

                {/* FSSAI Dietary Emblem & Badge */}
                <div className="flex items-center gap-1.5">
                  <DietaryEmblem product={product} />
                </div>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1 leading-snug">
                {name}
              </h2>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
                  Net Wt: {packagingSize}
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-slate-600">
                  Serving Size: <strong>{servingSizeStr}</strong>
                </span>
              </div>

              {/* FSSAI Mandatory Nutritional Facts Table */}
              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                    <span>FSSAI Nutritional Facts</span>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      Per 100g vs Per Serving ({servingSizeStr})
                    </span>
                  </h3>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                        <th className="py-2 px-3">Nutrient</th>
                        <th className="py-2 px-3 text-right">Per 100g</th>
                        <th className="py-2 px-3 text-right">Per Serving</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      <tr className="font-bold bg-slate-50/50">
                        <td className="py-1.5 px-3">Energy (kcal)</td>
                        <td className="py-1.5 px-3 text-right">{per100g?.energy_kcal ?? 0} kcal</td>
                        <td className="py-1.5 px-3 text-right text-emerald-700">
                          {perServing?.energy_kcal?.toFixed(1) ?? '0.0'} kcal
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3">Protein</td>
                        <td className="py-1.5 px-3 text-right">{per100g?.protein_g ?? 0} g</td>
                        <td className="py-1.5 px-3 text-right">
                          {perServing?.protein_g?.toFixed(1) ?? '0.0'} g
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3">Carbohydrate</td>
                        <td className="py-1.5 px-3 text-right">{per100g?.carbohydrates_g ?? 0} g</td>
                        <td className="py-1.5 px-3 text-right">
                          {perServing?.carbohydrates_g?.toFixed(1) ?? '0.0'} g
                        </td>
                      </tr>
                      <tr className="text-slate-600 pl-4">
                        <td className="py-1 px-3 pl-6 text-[11px]">- Total Sugars</td>
                        <td className="py-1 px-3 text-right text-[11px]">{per100g?.total_sugars_g ?? 0} g</td>
                        <td className="py-1 px-3 text-right text-[11px]">
                          {perServing?.total_sugars_g?.toFixed(1) ?? '0.0'} g
                        </td>
                      </tr>
                      <tr className="text-slate-600 pl-4">
                        <td className="py-1 px-3 pl-6 text-[11px]">- Added Sugars</td>
                        <td className="py-1 px-3 text-right text-[11px]">{per100g?.added_sugars_g ?? 0} g</td>
                        <td className="py-1 px-3 text-right text-[11px]">
                          {perServing?.added_sugars_g?.toFixed(1) ?? '0.0'} g
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3">Total Fat</td>
                        <td className="py-1.5 px-3 text-right">{per100g?.total_fat_g ?? 0} g</td>
                        <td className="py-1.5 px-3 text-right">
                          {perServing?.total_fat_g?.toFixed(1) ?? '0.0'} g
                        </td>
                      </tr>
                      <tr className="text-slate-600 pl-4">
                        <td className="py-1 px-3 pl-6 text-[11px]">- Saturated Fat</td>
                        <td className="py-1 px-3 text-right text-[11px]">{per100g?.saturated_fat_g ?? 0} g</td>
                        <td className="py-1 px-3 text-right text-[11px]">
                          {perServing?.saturated_fat_g?.toFixed(1) ?? '0.0'} g
                        </td>
                      </tr>
                      <tr className="text-slate-600 pl-4 bg-emerald-50/40">
                        <td className="py-1 px-3 pl-6 text-[11px] font-bold text-emerald-800">
                          - Trans Fat (FSSAI 0g)
                        </td>
                        <td className="py-1 px-3 text-right text-[11px] font-bold text-emerald-800">
                          {per100g?.trans_fat_g ?? 0.0} g
                        </td>
                        <td className="py-1 px-3 text-right text-[11px] font-bold text-emerald-800">
                          {perServing?.trans_fat_g?.toFixed(1) ?? '0.0'} g
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3">Dietary Fiber</td>
                        <td className="py-1.5 px-3 text-right">{per100g?.dietary_fiber_g ?? 0} g</td>
                        <td className="py-1.5 px-3 text-right">
                          {perServing?.dietary_fiber_g?.toFixed(1) ?? '0.0'} g
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3">Sodium</td>
                        <td className="py-1.5 px-3 text-right">{per100g?.sodium_mg ?? 0} mg</td>
                        <td className="py-1.5 px-3 text-right">
                          {perServing?.sodium_mg?.toFixed(1) ?? '0.0'} mg
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Ingredients */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Ingredients (Sorted by Predominance)
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      {verificationStatus === 'VERIFIED' ? 'Verified FSSAI Label' : verificationStatus}
                    </span>
                    {sourceUrl && (
                      <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-bold text-slate-500 hover:text-emerald-700 underline"
                      >
                        Source
                      </a>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-100 font-medium">
                  {declaredIngredients ? (
                    declaredIngredients
                  ) : (
                    <span className="text-amber-800 font-semibold bg-amber-50 p-2 rounded block">
                      {ver.status === 'Needs Review' ? `⚠ ${ver.reason}` : `⚠ Field-level verification incomplete for this SKU (${ver.percentage}% evidence).`}
                    </span>
                  )}
                </p>
              </div>

              {/* Additives & INS codes */}
              {additives.length > 0 && (
                <div className="mt-3">
                  <span className="text-xs font-bold text-slate-800 block mb-1">
                    Permitted Food Additives (INS Classified)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {additives.map((add, idx) => (
                      <span
                        key={idx}
                        className="text-[11px] font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-lg border border-slate-200"
                      >
                        {add.insNumber ? `INS ${add.insNumber}` : ''} {add.name || add}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Allergens: Strictly Segregated into CONTAINS and MAY CONTAIN */}
              <div className="mt-3 space-y-2.5">
                {containsAllergens.length > 0 ? (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <span className="text-xs font-black text-rose-900 uppercase tracking-wide">
                        Mandatory FSSAI Allergen Declaration (Contains)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {containsAllergens.map((allergen, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] font-black bg-rose-50 text-rose-800 border border-rose-200 px-2.5 py-0.5 rounded-lg"
                        >
                          Contains: {allergen}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50/70 border border-emerald-100 px-2.5 py-1 rounded-xl">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>No FSSAI mandatory allergens present in formulation</span>
                  </div>
                )}

                {mayContainAllergens.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                        Precautionary Cross-Contact Advisory (May Contain)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {mayContainAllergens.map((allergen, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200/70 px-2.5 py-0.5 rounded-lg"
                        >
                          May contain: {allergen}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Sticky Footer Action Bar */}
        <div className="p-4 px-6 border-t border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">
              SmartChoice Evaluation:
            </span>
            <span className="text-sm font-black text-emerald-800">
              {score >= 70 ? 'Nutritionally Recommended' : 'Consume in Moderation'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onToggleCompare && onToggleCompare(product)}
              className={`px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-md transition-all active:scale-95 text-xs ${
                isCompared
                  ? 'bg-emerald-100 text-[#0c831f] border border-emerald-400'
                  : 'bg-[#0c831f] hover:bg-[#086616] text-white shadow-emerald-700/20'
              }`}
            >
              <Scale className="w-4 h-4 stroke-[2.5]" />
              <span>{isCompared ? 'In Comparison Shortlist' : 'Add to Compare'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
