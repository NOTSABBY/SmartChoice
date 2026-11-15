import React, { useState } from 'react';
import { Check, Info, ShieldCheck, Scale, Ban } from 'lucide-react';
import { generatePackshotSvgClient } from '../utils/packshotFallback';
import { calculateProductQualityScore, calculateProductConfidence } from '../utils/productScoring';
import { calculateProductVerification } from '../utils/productVerification';
import { DietaryEmblem } from './DietaryEmblem';

export const ProductCard = ({
  product,
  isCompared = false,
  onToggleCompare,
  onSelectProduct,
}) => {
  // Support both Catalog-500 schema and MongoDB SmartChoice schema
  const brand = product.brand || product.catalog?.brand || product.identity?.brand || 'AUTHENTIC';
  const name = product.product_name || product.catalog?.productName || product.identity?.name || 'Packaged Food';
  const packagingSize = product.packaging_size || product.catalog?.packagingSize || product.serving?.servingSize || 'Standard Pack';
  const categoryId = product.category_id || product.catalog?.categoryId || 1;
  
  // Authoritative Dietary Classification
  const dietaryStatus = product.dietary_classification?.status || product.dietaryClassification?.status || 
    (product.dietary_type === 'NON_VEG' || product.catalog?.dietaryType === 'NON_VEG' || product.identity?.dietaryType === 'NON_VEGETARIAN' ? 'NON_VEGETARIAN' :
     product.dietary_type === 'VEG' || product.catalog?.dietaryType === 'VEG' || product.identity?.dietaryType === 'VEGETARIAN' ? 'VEGETARIAN' : 'UNKNOWN');

  const isVeg = dietaryStatus === 'VEGETARIAN';
  const isNonVeg = dietaryStatus === 'NON_VEGETARIAN';
  const isUnknownDiet = !isVeg && !isNonVeg;
  const dietaryType = isNonVeg ? 'NON_VEG' : (isVeg ? 'VEG' : 'UNKNOWN');
  
  // Image URL resolution
  const rawImage = product.images?.front_hd || product.images?.front_thumb || product.catalog?.images?.frontHd || product.media?.imageUrl || '';
  const [imgSrc, setImgSrc] = useState(rawImage);
  const [hasError, setHasError] = useState(false);

  // Score extraction (Phase 4 engine or deterministic calculation, never mock price)
  const score = product.calculatedScore ?? product.score?.totalScore ?? product.analysis?.scoring?.totalScore ?? calculateProductQualityScore(product);
  const matchScore = product.matchScore;
  const isAllergenExcluded = Boolean(product.allergenExcluded);
  const conf = calculateProductConfidence(product) || { score: 85, level: 'high', label: 'High Confidence' };
  const ver = calculateProductVerification(product);
  const confidence = conf?.level || product.score?.confidence?.level || product.analysis?.confidence?.level || 'high';
  const completeness = product.score?.coverage?.overallCompleteness ?? product.dataQuality?.completeness ?? 85;
  const novaGroup = product.analysis?.processingAnalysis?.novaGroup || product.processing?.novaGroup || product.nutrition_info?.nova_group || 3;

  // Grade color
  const getScoreBadgeColor = (s) => {
    if (s >= 80) return 'bg-emerald-600 text-white';
    if (s >= 65) return 'bg-lime-600 text-white';
    if (s >= 50) return 'bg-amber-500 text-white';
    return 'bg-rose-500 text-white';
  };

  const handleImageError = () => {
    if (!hasError) {
      setHasError(true);
      const fallbackSvg = generatePackshotSvgClient(
        brand,
        name,
        packagingSize,
        categoryId,
        dietaryType
      );
      setImgSrc(fallbackSvg);
    }
  };

  return (
    <div className={`group bg-white rounded-2xl border p-3 flex flex-col justify-between transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/60 relative ${
      isAllergenExcluded ? 'border-rose-200 bg-rose-50/20 opacity-75' : 'border-slate-200/90 hover:border-emerald-300'
    }`}>
      {/* Top Badges Strip */}
      <div className="flex items-center justify-between mb-2 gap-1">
        {/* FSSAI Statutory Dietary Classification Emblem */}
        <div className="flex items-center gap-1.5 shrink-0">
          <DietaryEmblem product={product} />
        </div>

        {/* Personalized Match, SmartChoice Score & NOVA Badges */}
        <div className="flex items-center gap-1 shrink-0">
          {product.semanticScore !== undefined && product.semanticScore !== null && (
            <span
              className="text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tight bg-teal-50 text-teal-700 border border-teal-300"
              title={`Semantic Match: ${product.semanticScore}%\n${product.matchExplanation || ''}`}
            >
              Semantic: {product.semanticScore}%
            </span>
          )}
          {isAllergenExcluded ? (
            <span
              className="text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tight bg-rose-100 text-rose-700 border border-rose-300 flex items-center gap-0.5"
              title="Allergen Excluded: Violates active allergen preference constraint"
            >
              <Ban className="w-2.5 h-2.5" /> Excluded
            </span>
          ) : matchScore !== null && matchScore !== undefined ? (
            <span
              className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tight border ${
                matchScore >= 75
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : matchScore >= 35
                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                  : 'bg-slate-100 text-slate-500 border-slate-300'
              }`}
              title={`Personalized Preference Match: ${matchScore}%\n${product.preferenceEval?.explanation || ''}`}
            >
              Match: {matchScore}%
            </span>
          ) : null}
          <span
            className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1 py-0.5 rounded-md"
            title={`NOVA Processing Group: N${novaGroup}`}
          >
            N{novaGroup}
          </span>
        </div>
      </div>

      {/* Product Image Frame */}
      <div
        onClick={() => onSelectProduct && onSelectProduct(product)}
        className="relative w-full aspect-square bg-slate-50/80 rounded-xl overflow-hidden cursor-pointer flex items-center justify-center p-2 mb-3 group-hover:bg-slate-100/60 transition-colors"
      >
        <img
          src={imgSrc || generatePackshotSvgClient(brand, name, packagingSize, categoryId, dietaryType)}
          alt={name}
          onError={handleImageError}
          loading="lazy"
          className="max-h-full max-w-full object-contain drop-shadow-sm group-hover:scale-105 transition-transform duration-300"
        />

        {/* Verification Status & Completeness Pill */}
        <div
          className={`absolute bottom-2 left-2 bg-slate-900/90 backdrop-blur-xs text-white text-[9px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 shadow-xs border ${
            ver.status === 'Verified' ? 'border-emerald-500/40' :
            ver.status === 'Partially Verified' ? 'border-amber-500/40' :
            ver.status === 'Needs Review' ? 'border-purple-500/40' : 'border-slate-600/40'
          }`}
          title={`Verification Status: ${ver.status} (${ver.percentage}% verified)\nReason: ${ver.reason}\nData Completeness: ${completeness}%\nAnalysis Confidence: ${conf?.score ?? 85}/100 (${conf?.label ?? 'High Confidence'})`}
        >
          <ShieldCheck className={`w-3 h-3 ${
            ver.status === 'Verified' ? 'text-emerald-400' :
            ver.status === 'Partially Verified' ? 'text-amber-400' :
            ver.status === 'Needs Review' ? 'text-purple-400' : 'text-slate-400'
          }`} />
          <span>{ver.status.toUpperCase()}</span>
        </div>

        {/* Quick View Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelectProduct && onSelectProduct(product);
          }}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 shadow-xs text-slate-500 hover:text-slate-900 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
          title="View Nutritional Intelligence & FSSAI Breakdown"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Product Information */}
      <div className="flex-1 flex flex-col justify-between">
        <div>
          {/* Brand */}
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block truncate">
            {brand}
          </span>

          {/* Product Name */}
          <h3
            onClick={() => onSelectProduct && onSelectProduct(product)}
            className="text-xs font-bold text-slate-900 leading-snug line-clamp-2 mt-0.5 hover:text-[#0c831f] cursor-pointer"
            title={name}
          >
            {name}
          </h3>

          {/* Packaging Size */}
          <span className="text-[11px] font-semibold text-slate-500 mt-1 block">
            {packagingSize}
          </span>

          {/* Semantic Match Explanation */}
          {product.matchExplanation && (
            <div className="text-[10px] text-emerald-900 bg-emerald-50/90 border border-emerald-200/80 rounded-md px-1.5 py-1 mt-1.5 line-clamp-2" title={product.matchExplanation}>
              <span className="font-extrabold text-[#0c831f]">Why matched:</span> {product.matchExplanation}
            </div>
          )}
        </div>

        {/* Bottom Actions: Analysis & Compare Button */}
        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          <button
            onClick={() => onSelectProduct && onSelectProduct(product)}
            className="text-[11px] font-bold text-slate-600 hover:text-[#0c831f] transition-colors truncate"
          >
            View Facts
          </button>

          {/* Compare Action Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCompare && onToggleCompare(product);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-tight flex items-center gap-1 transition-all active:scale-95 shadow-2xs ${
              isCompared
                ? 'bg-[#0c831f] text-white shadow-emerald-700/20'
                : 'bg-emerald-50 hover:bg-emerald-100 text-[#0c831f] border border-emerald-600/40 hover:border-emerald-600'
            }`}
            title={isCompared ? 'Remove from Comparison' : 'Add to Comparison Shortlist'}
          >
            {isCompared ? (
              <>
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>ADDED</span>
              </>
            ) : (
              <>
                <Scale className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>COMPARE</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
