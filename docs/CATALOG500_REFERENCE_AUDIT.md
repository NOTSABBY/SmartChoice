# CATALOG-500 REFERENCE ARCHITECTURE AND IMPLEMENTATION AUDIT

**Audit Date:** November 14, 2026  
**Reference Repository:** `https://github.com/NOTSABBY/Catalog-500.git`  
**Reference Local Path:** `D:\500Products`  
**Target Integration Project:** `SmartChoice` (`C:\Users\sabya\OneDrive\Desktop\SmartChoice`)

---

## 1. Executive Summary

Catalog-500 is a specialized quick-commerce styled storefront designed around an authentic 500-product virtual packaged food catalog spanning 25 distinct food and beverage categories. It was developed to simulate a high-speed instant grocery browsing experience with FSSAI-compliant nutrition facts, ingredients, allergens, and multi-tier packshots.

This audit provides a comprehensive inspection of the entire Catalog-500 repository: its Python data generation pipeline, data storage artifacts, React/TypeScript/Vite frontend architecture, UI components, styling system, and browsing interactions.

---

## 2. Repository & Directory Architecture

```
D:\500Products\
├── authentic_packaged_food_catalog_500.xlsx   # 500 SKU Source Excel workbook
├── requirements.txt                           # Python pipeline dependencies (pandas, openpyxl, httpx, etc.)
├── pipeline/                                  # Multi-tier data enrichment pipeline
│   ├── enrich_catalog.py                      # Main orchestrator (OFF API + Gemini + FSSAI fallback)
│   ├── fssai_knowledge_base.py                # Rule-based nutritional & allergen estimation per category
│   ├── gemini_fallback.py                     # LLM fallback for missing data
│   ├── image_generator.py                     # SVG packshot generator with category themes
│   └── checkpoint_cache.json                  # 5MB cache of all 500 enriched items
└── frontend/                                  # React 19 + TypeScript + Vite 8 storefront
    ├── package.json                           # Dependencies: React 19, Tailwind v4, Lucide-react
    ├── vite.config.ts                         # Vite configuration with Tailwind CSS plugin
    ├── public/
    │   └── data/
    │       ├── enriched_catalog_500.json      # 5.2MB master catalog (500 products in 25 categories)
    │       └── categories/                    # Individual cat_1.json .. cat_25.json files
    └── src/
        ├── App.tsx                            # Primary application shell, layout, search, & state
        ├── index.css                          # Tailwind v4 theme variables & custom scrollbar
        ├── types/catalog.ts                   # Strict TypeScript domain interfaces
        ├── utils/packshotFallback.ts          # Client-side dynamic SVG generator
        └── components/
            ├── Navbar.tsx                     # Top announcement strip, brand, search, & cart trigger
            ├── CategorySidebar.tsx            # Sticky 25-category left navigation with SKU counts
            ├── ProductCard.tsx                # Compact 5-column grid product card
            ├── ProductDetailModal.tsx         # Comprehensive FSSAI nutrition fact modal
            ├── CartDrawer.tsx                 # Sliding right cart drawer with stepper controls
            └── OrderSuccessModal.tsx          # Mock checkout confirmation modal
```

---

## 3. Data Flow & Pipeline Analysis

1. **Source Workbook (`authentic_packaged_food_catalog_500.xlsx`)**:
   - Contains 500 genuine packaged food SKUs across 25 standard Indian grocery categories (Biscuits, Noodles, Cooking Oils, Spices, Dairy, Snacks, Breakfast Cereals, etc.).
   - Attributes: `category_id`, `category_name`, `brand`, `product_name`, `packaging_size`, `query_term`, `dietary_type` (`VEG` / `NON_VEG`).

2. **Pipeline Orchestrator (`enrich_catalog.py`)**:
   - Tier 1: Queries Open Food Facts India API for barcode, real image URLs (`front_hd`, `front_thumb`), Nutri-Score, NOVA group, and per-100g nutritional facts.
   - Tier 2: Calls Gemini AI fallback if API data is incomplete.
   - Tier 3: Uses deterministic `fssai_knowledge_base.py` for standard statutory nutritional values, serving sizes, and mandatory allergen labeling.
   - Caches state into `checkpoint_cache.json` and outputs `frontend/public/data/enriched_catalog_500.json`.

3. **Frontend Ingestion**:
   - The frontend loads `enriched_catalog_500.json` at startup via `fetch('/data/enriched_catalog_500.json')`.
   - Organizes items into a master category tree and flat product list.

---

## 4. Frontend Component Hierarchy & UI Architecture

### 4.1 Navbar (`Navbar.tsx`)
- **Announcement Strip**: Dark `#1f1f1f` bar displaying "Blinkit Authentic Catalog 500 | FSSAI Enriched & Verified • 25 Categories • 500 Verified Packaged Food SKUs • Delivery in 8-10 mins".
- **Brand Logo**: Dual-color wordmark (`blink` in `#0c831f`, `it` in `#f8cb46`) with "Virtual Catalog" sub-label.
- **Location Selector**: "Delivery in 8 minutes / Connaught Place, New Delhi" (Delivery specific).
- **Search Bar**: Prominent central search input with left search icon and right clear button.
- **Dietary Filter**: 3-button pill switch (`All`, `Pure Veg` with green dot, `Non-Veg` with red dot).
- **Cart Button**: `#0c831f` green button with item count badge, cart quantity, and total price.

### 4.2 Horizontal Quick Category Rail (`App.tsx`)
- Scrollable horizontal chip rail directly below the navbar.
- Displays "All (500)" plus 25 category chips with category-specific emojis and product count badges.

### 4.3 Left Category Sidebar (`CategorySidebar.tsx`)
- Sticky 256px/288px sidebar on desktop.
- Header: "CATEGORIES (25) • 500 SKUs".
- "All Categories" primary selector.
- 25 category items with custom emojis, title truncation, and individual SKU count pills.
- Active category is highlighted in light emerald (`bg-emerald-50 text-[#0c831f] border border-emerald-200`).

### 4.4 Main Content & Grid Area
- **Category Hero Banner**: Card with sparkles icon, section title, active item count, and category description.
- **Sorting Dropdown**: Dropdown menu containing:
  - `relevance`: Blinkit Featured
  - `price_asc`: Price: Low to High
  - `price_desc`: Price: High to Low
  - `calories_asc`: Calories: Low to High
  - `nutri_score`: Nutri-Score: Best First
- **Product Grid**: Responsive 5-column layout on 2XL screens (`grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5`).

### 4.5 Product Card (`ProductCard.tsx`)
- Rounded-2xl card with subtle border and hover shadow.
- Top badge row: FSSAI Veg/Non-Veg dot emblem, Nutri-Score grade pill (`Grade A` to `E`), and NOVA badge (`N1` to `N4`).
- Aspect-square image container with instant fallback to client-side SVG packshot on image error.
- Overlay badge: "8 MINS".
- Info icon for quick-view modal.
- Brand name (uppercase bold) and 2-line truncated product name.
- Packaging size (e.g. "500 g", "1 L").
- Bottom pricing and green "ADD" button or quantity stepper.

### 4.6 Product Detail Modal (`ProductDetailModal.tsx`)
- Two-column modal layout.
- Left: High-resolution packshot, Veg/Non-Veg FSSAI certification banner, Nutri-Score and NOVA group summary cards, Data Source indicator.
- Right: Brand, product title, net weight, serving size, complete FSSAI Nutritional Facts table (Per 100g vs Per Serving), full ingredient text (sorted by predominance), and allergen warnings.
- Sticky footer: Price, MRP, discount percentage, and Add to Cart stepper.

### 4.7 Cart & Checkout Flow (`CartDrawer.tsx` & `OrderSuccessModal.tsx`)
- Sliding right drawer with item listing, quantity increments, bill details (items total, handling charge, delivery fee), and mock checkout trigger.

---

## 5. Design System Specifications

| Element | Catalog-500 Reference Specification |
|---|---|
| Background Color | `#f4f6fb` (soft cool grey) |
| Card Background | `#ffffff` with `border border-slate-200/90` and `rounded-2xl` |
| Primary Accent | `#0c831f` (Blinkit green) |
| Dark Green Hover | `#086616` |
| Secondary Accent | `#f8cb46` (yellow/gold) |
| Top Bar Background | `#1f1f1f` (charcoal dark) |
| Typography | Inter / system-ui, bold & black weights for titles, compact tracking |
| Grid Columns | Mobile: 2 cols; MD: 3 cols; XL: 4 cols; 2XL: 5 cols |
| Card Padding | `p-3` |
| Image Frame | Aspect square, `bg-slate-50/80 rounded-xl` |

---

## 6. SmartChoice Replication & Adaptation Strategy

To achieve visual and functional fidelity while preserving and elevating SmartChoice intelligence capabilities:

1. **Retain Layout & Grid Proportions**:
   - Exact header bar proportions, horizontal category rail, left sticky category sidebar, and 5-column product grid.
2. **Branding Transition**:
   - Replace "Blinkit" with "SmartChoice" (Emerald green leaf mark + "Smart" in `#0c831f` and "Choice" in emerald-800).
   - Retain manufacturer brands (Heinz, Kissan, Amul, Parle, Nestle, etc.).
3. **Remove Delivery & Location Functionality**:
   - Remove "Delivery in 8 mins", delivery countdowns, Connaught Place location selector, and delivery fee calculation.
4. **Remove Veg/Non-Veg Toggle in Header**:
   - Rely on reliable ingredient and dietary analysis rather than blanket unverified toggles.
5. **Preserve & Elevate Search Bar**:
   - Connect the central search bar directly to standard product search, semantic vector search, and live autocomplete against MongoDB Atlas.
6. **Replace Cart with Comparison Shortlist**:
   - Transform "My Cart" into "Compare Shortlist" (`Compare (N)`), enabling side-by-side nutritional difference analysis.
7. **Elevate Product Cards**:
   - Replace delivery tags with **SmartChoice Quality Score (0–100)**, **Data Confidence Indicator**, and **NOVA badge**.
   - Provide "Compare" button and "Analysis" button.
8. **Elevate Product Detail Modal**:
   - Include the full Catalog-500 nutrition facts table AND inject all Phase 3 & 4 intelligence: 5 component score breakdown (40/20/15/15/10), trans-fat statutory compliance, ICMR-NIN RDA protein/fibre claims, 46-additive INS database breakdown, 8 FSSAI allergen classes, and data completeness/neutral baseline metrics.
9. **Elevate Sorting**:
   - Add "SmartChoice Recommended", "Score: High to Low", "Score: Low to High", "Confidence: High to Low", "Highest Protein", "Lowest Sugar", "Highest Fibre", "Least Processed First", and alphabetical options.
