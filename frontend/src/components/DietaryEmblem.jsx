import React from 'react';
import { Leaf, HelpCircle } from 'lucide-react';
import { classifyProductDietary } from '../utils/dietaryClassifier';

/**
 * Reusable Dietary Emblem & Badge Component
 * 
 * Displays distinct, consistent visual indicators for:
 * - VEGAN: Plant leaf icon with emerald badge and "VEGAN" text.
 * - VEGETARIAN: Standard Indian FSSAI green square with solid green circle and "VEG" text.
 * - NON_VEGETARIAN: Standard Indian FSSAI brown/rose square with solid brown/rose circle and "NON-VEG" text.
 * - UNKNOWN: Slate neutral border with dashed/question indicator and "UNKNOWN" text.
 * 
 * @param {Object} props
 * @param {Object} props.product - Full product record
 * @param {string} [props.size] - 'sm' | 'md' | 'lg'
 * @param {boolean} [props.showLabel] - Whether to render text label beside icon
 */
export const DietaryEmblem = ({
  product,
  size = 'sm',
  showLabel = true,
  className = ''
}) => {
  const classification = classifyProductDietary(product);
  const { status, reason, supportingEvidence } = classification;

  const tooltip = `${status}: ${reason}${supportingEvidence ? ` (${supportingEvidence})` : ''}`;

  if (status === 'VEGAN') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 shrink-0 ${className}`}
        title={tooltip}
      >
        <div className="w-3.5 h-3.5 rounded-sm bg-emerald-600 flex items-center justify-center p-0.5 shadow-2xs">
          <Leaf className="w-2.5 h-2.5 text-white stroke-[2.8]" />
        </div>
        {showLabel && (
          <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
            Vegan
          </span>
        )}
      </div>
    );
  }

  if (status === 'VEGETARIAN') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 shrink-0 ${className}`}
        title={tooltip}
      >
        {/* Standard FSSAI Indian Green Veg Mark: Green Square with Solid Green Circle */}
        <div className="w-3.5 h-3.5 border-2 border-emerald-600 rounded-xs flex items-center justify-center p-0.5 bg-white">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
        </div>
        {showLabel && (
          <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50/50 px-1 py-0.5 rounded border border-emerald-100">
            Veg
          </span>
        )}
      </div>
    );
  }

  if (status === 'NON_VEGETARIAN') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 shrink-0 ${className}`}
        title={tooltip}
      >
        {/* Standard FSSAI Indian Non-Veg Mark: Brown/Rose Square with Solid Circle/Triangle */}
        <div className="w-3.5 h-3.5 border-2 border-rose-700 rounded-xs flex items-center justify-center p-0.5 bg-white">
          <div className="w-1.5 h-1.5 rounded-full bg-rose-700" />
        </div>
        {showLabel && (
          <span className="text-[9px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 px-1 py-0.5 rounded border border-rose-200">
            Non-Veg
          </span>
        )}
      </div>
    );
  }

  // UNKNOWN / UNVERIFIED
  return (
    <div
      className={`inline-flex items-center gap-1.5 shrink-0 ${className}`}
      title={tooltip}
    >
      <div className="w-3.5 h-3.5 border border-dashed border-slate-400 rounded-xs flex items-center justify-center p-0.5 bg-slate-50">
        <div className="w-1 h-1 rounded-full bg-slate-400" />
      </div>
      {showLabel && (
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
          Unknown
        </span>
      )}
    </div>
  );
};

export default DietaryEmblem;
