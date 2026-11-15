import React from 'react';
import { X, Scale, Trash2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const CompareDrawer = ({
  isOpen = false,
  onClose,
  comparedProducts = [],
  onRemoveProduct,
  onClearAll,
}) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleProceedToCompare = () => {
    onClose();
    navigate('/compare');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-[#0c831f]" />
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Comparison Shortlist
              </h3>
              <p className="text-[11px] text-slate-500">
                {(comparedProducts?.length || 0)} {(comparedProducts?.length || 0) === 1 ? 'item' : 'items'} selected (Max 4)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Items List */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {(comparedProducts?.length || 0) === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-[#0c831f] flex items-center justify-center mb-3 text-2xl">
                âš–ï¸
              </div>
              <h4 className="text-base font-black text-slate-800">
                Your shortlist is empty
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Click the <strong>COMPARE</strong> button on any product card in the catalog to add items for side-by-side analysis.
              </p>
            </div>
          ) : (
            comparedProducts.map((prod) => {
              const name = prod.product_name || prod.catalog?.productName || prod.identity?.name || 'Product';
              const brand = prod.brand || prod.catalog?.brand || prod.identity?.brand || 'Brand';
              const img = prod.images?.front_thumb || prod.images?.front_hd || prod.catalog?.images?.frontThumb || prod.media?.imageUrl;
              const prodId = prod.product_id || prod._id;

              return (
                <div
                  key={prodId}
                  className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-white hover:border-emerald-300 transition-colors shadow-2xs"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="w-12 h-12 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                      {img ? (
                        <img src={img} alt={name} className="max-h-full max-w-full object-contain" />
                      ) : (
                        <span className="text-lg">ðŸ“¦</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block truncate">
                        {brand}
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 truncate" title={name}>
                        {name}
                      </h4>
                    </div>
                  </div>

                  <button
                    onClick={() => onRemoveProduct(prodId)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
                    title="Remove from comparison"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        {(comparedProducts?.length || 0) > 0 && (
          <div className="p-4 border-t border-slate-200 bg-white space-y-2">
            <button
              onClick={handleProceedToCompare}
              className="w-full bg-[#0c831f] hover:bg-[#086616] text-white py-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-700/20 active:scale-98 transition-transform"
            >
              <span>Compare Selected Products</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onClearAll}
              className="w-full text-slate-500 hover:text-slate-800 py-1.5 text-xs font-bold transition-colors"
            >
              Clear Shortlist
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
