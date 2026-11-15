import React from 'react';
import { Layers } from 'lucide-react';

export const CATEGORY_ICONS = {
  1: '🍪', 2: '🥣', 3: '🍜', 4: '🍫', 5: '🧃',
  6: '🥫', 7: '🍯', 8: '🥔', 9: '☕', 10: '🌶️',
  11: '🫒', 12: '🍛', 13: '🧀', 14: '⚡', 15: '🥨',
  16: '🫙', 17: '🌾', 18: '🥜', 19: '🧁', 20: '🍲',
  21: '💪', 22: '🌾', 23: '🥤', 24: '🍮', 25: '🍦'
};

export const CategorySidebar = ({
  categories = [],
  selectedCategoryId = null,
  onSelectCategory,
  totalProductsCount = 500,
}) => {
  return (
    <aside className="w-full bg-white rounded-2xl border border-slate-200 p-3 shadow-xs sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
      <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
          Categories ({categories.length})
        </h2>
        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
          {totalProductsCount} SKUs
        </span>
      </div>

      <div className="mt-2 space-y-1">
        {/* All Products Option */}
        <button
          onClick={() => onSelectCategory(null)}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all ${
            selectedCategoryId === null
              ? 'bg-[#0c831f] text-white font-bold shadow-sm shadow-emerald-700/20'
              : 'text-slate-700 hover:bg-slate-50 font-medium'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm ${
                selectedCategoryId === null ? 'bg-white/20' : 'bg-slate-100 text-slate-700'
              }`}
            >
              <Layers className="w-4 h-4" />
            </span>
            <span className="text-xs">All Categories</span>
          </div>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              selectedCategoryId === null ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {totalProductsCount}
          </span>
        </button>

        {/* 25 Individual Categories */}
        {categories.map((cat) => {
          const isSelected = selectedCategoryId === cat.category_id;
          const icon = CATEGORY_ICONS[cat.category_id] || '📦';

          return (
            <button
              key={cat.category_id}
              onClick={() => onSelectCategory(cat.category_id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all group ${
                isSelected
                  ? 'bg-emerald-50 text-[#0c831f] font-bold border border-emerald-200'
                  : 'text-slate-700 hover:bg-slate-50 font-medium'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-1">
                <span
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 ${
                    isSelected ? 'bg-emerald-100' : 'bg-slate-100 group-hover:bg-slate-200/60'
                  }`}
                >
                  {icon}
                </span>
                <span className="text-xs truncate" title={cat.category_name}>
                  {cat.category_name}
                </span>
              </div>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                  isSelected
                    ? 'bg-emerald-200/60 text-[#0c831f]'
                    : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200/50'
                }`}
              >
                {cat.product_count}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
};
