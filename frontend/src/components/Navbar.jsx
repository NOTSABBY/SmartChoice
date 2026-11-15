import React from 'react';
import { Search, Scale, X, Sparkles, Settings } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { usePreferences } from '../context/PreferenceContext';

export const Navbar = ({
  searchQuery = '',
  onSearchChange,
  onSearchSubmit,
  comparedCount = 0,
  onOpenCompareDrawer,
  onOpenMobileCategories,
}) => {
  const navigate = useNavigate();
  const { hasSavedPreferences, isNewlySaved } = usePreferences?.() || {};

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && onSearchSubmit) {
      onSearchSubmit(searchQuery);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      {/* Top Banner / Announcement Strip — Continuous Left-to-Right Single Instance Ticker */}
      <div
        className="bg-[#1f1f1f] text-white text-xs py-1.5 overflow-hidden border-b border-slate-800/80 select-none relative z-20"
        role="region"
        aria-label="Announcement Ticker"
      >
        <div className="w-full overflow-hidden whitespace-nowrap">
          <div className="animate-ticker-ltr inline-flex items-center gap-2.5 hover:[animation-play-state:paused]">
            <span className="flex items-center gap-1 font-semibold text-[#f8cb46] shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
              SmartChoice Food Intelligence
            </span>
            <span className="text-slate-500 font-normal">|</span>
            <span className="text-slate-300 font-medium shrink-0">
              FSSAI Enriched & Verified • 25 Categories • 500+ Verified Packaged Food SKUs
            </span>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 sm:gap-6">
        {/* Brand Wordmark */}
        <Link to="/" className="cursor-pointer select-none flex items-center gap-2 shrink-0">
          <div className="flex items-baseline gap-0.5">
            <span className="text-3xl font-black tracking-tight text-[#0c831f]">Smart</span>
            <span className="text-3xl font-black tracking-tight text-emerald-950">Choice</span>
          </div>
        </Link>

        {/* Search Bar */}
        <div className="flex-1 relative max-w-2xl">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search by product name, brand, or category ('Parle-G', 'Maggi', 'Atta', 'Amul')..."
              className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0c831f] focus:bg-white transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange && onSearchChange('')}
                className="absolute right-3 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                title="Clear Search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Preferences Button */}
        <Link
          to="/preferences"
          className="flex items-center gap-1.5 px-3 py-2 text-slate-700 hover:text-[#0c831f] hover:bg-slate-50 rounded-xl text-xs font-bold border border-slate-200 transition-colors shrink-0"
          title="User Dietary & Allergen Preferences"
        >
          <Settings className="w-4 h-4 text-slate-500" />
          <span className="hidden sm:inline">Preferences</span>
        </Link>

        {/* Mobile Categories Button */}
        <button
          onClick={onOpenMobileCategories}
          className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold flex items-center gap-1"
        >
          Categories
        </button>

        {/* Recommendation Engine Navigation Option (Beside Comparison) */}
        <Link
          to="/recommendations"
          className="relative flex items-center gap-2 bg-slate-50 hover:bg-emerald-50 text-slate-800 hover:text-[#0c831f] border border-slate-200 hover:border-emerald-300 px-3 sm:px-3.5 py-2.5 rounded-xl font-bold transition-all shrink-0"
          title="Personalized Recommendation Engine"
        >
          <Sparkles className="w-4 h-4 text-[#0c831f]" />
          <span className="hidden md:inline text-xs font-black">Recommendation Engine</span>
          <span className="md:hidden text-xs font-black">Recommendations</span>
          {hasSavedPreferences && (
            <span
              className="w-2.5 h-2.5 rounded-full bg-[#0c831f] shrink-0 animate-nav-dot-blink shadow-xs shadow-emerald-500"
              title="Saved nutritional preferences active — view recommendations"
              aria-label="Active Preferences Indicator"
            />
          )}
        </Link>

        {/* Comparison Shortlist Button */}
        <button
          onClick={onOpenCompareDrawer}
          className="relative flex items-center gap-2.5 bg-[#0c831f] hover:bg-[#086616] text-white px-3.5 sm:px-4 py-2.5 rounded-xl font-bold transition-transform active:scale-95 shadow-md shadow-emerald-700/20 shrink-0"
        >
          <div className="relative">
            <Scale className="w-5 h-5" />
            {comparedCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-[#f8cb46] text-slate-900 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                {comparedCount}
              </span>
            )}
          </div>
          <div className="hidden sm:flex flex-col text-left leading-tight">
            <span className="text-[11px] text-emerald-100 font-semibold">
              Comparison
            </span>
            <span className="text-xs font-black">
              {comparedCount} Selected
            </span>
          </div>
        </button>
      </div>
    </header>
  );
};
