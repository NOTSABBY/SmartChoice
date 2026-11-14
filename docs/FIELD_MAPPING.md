# Catalog-500 to SmartChoice Canonical Product Field Mapping

**Document:** `docs/FIELD_MAPPING.md`  
**Phase:** Phase 1 — Complete Repository and Dataset Audit  
**Date:** November 2026  
**Status:** Complete  

---

## 1. Mapping Overview

This document defines the field-level transformation matrix connecting **Catalog-500** (`enriched_catalog_500.json` / `authentic_packaged_food_catalog_500.xlsx`) to the **SmartChoice canonical `Product` Mongoose model** (`backend/models/Product.js`).

---

## 2. Comprehensive Field Mapping Matrix

| Catalog-500 Field | SmartChoice Target Path | Mapping Classification | Transformation / Normalization Rule |
|---|---|---|---|
| `product_id` | `source.sourceId` & `identity.productId` | **Renamed / Schema Extension** | Stores `"PKG_PRD_XXXX"`. Needs schema addition as indexed alternate key. |
| *(None)* | `identity.barcode` | **Missing Field** | Catalog-500 lacks barcodes. Strategy: Generate deterministic synthetic barcode (e.g. `890500` + 4-digit numeric index) or make `barcode` non-required. |
| `product_name` | `identity.name` | **Renamed** | Direct copy of trimmed string. |
| `brand` | `identity.brand` | **Direct Mapping** | Direct copy of trimmed string. |
| `category_name` | `identity.categories` | **Conversion** | Wrap string as single-element array `[category_name]`. |
| `dietary_type` | `identity.productType` & `processing.labels` | **Conversion** | If `"VEG"`, map to `labels: ["Vegetarian"]`; if `"NON_VEG"`, map to `labels: ["Non-Vegetarian"]`. |
| `packaging_size` | `serving.servingSize` | **Renamed** | Raw Excel has static `"Standard Pack"`. Prefer `nutrition_info.serving_size` when available. |
| `nutrition_info.serving_size` | `serving.servingSize` & `serving.servingSizeUnit` | **Normalization / Parsing** | Parse numeric value and unit from strings like `"15 g"` -> `servingSize: "15"`, `servingSizeUnit: "g"`. |
| `images.front_hd` | `media.imageUrl` | **Renamed** | Map primary high-definition image URL. |
| `images.front_thumb` | `media.thumbnailUrl` | **Schema Extension** | Add optional thumbnail URL field to `media` subdocument. |
| `query_term` | `source.queryTerm` | **Schema Extension** | Useful for debugging external search queries. |
| `nutrition_info.ingredients_text` | `ingredients.ingredients` | **Conversion** | Parse comma/semicolon delimited ingredient string into an array of individual ingredient strings. |
| `nutrition_info.allergens` | `ingredients.allergens` | **Normalization** | Lowercase and trim array elements for consistency with SmartChoice preference filters. |
| *(Extracted from `ingredients_text`)* | `ingredients.additives` | **Extraction** | Run `ingredientAnalysisService` regex to extract INS and E-numbers (e.g. `INS 500(ii)` -> `e500ii`). |
| `nutrition_info.per_100g.energy_kcal` | `nutrition.calories` | **Renamed** | Direct numeric assignment (kcal). |
| `nutrition_info.per_100g.protein_g` | `nutrition.protein` | **Renamed** | Direct numeric assignment (g). |
| `nutrition_info.per_100g.carbohydrates_g` | `nutrition.carbohydrates` | **Renamed** | Direct numeric assignment (g). |
| `nutrition_info.per_100g.total_sugars_g` | `nutrition.sugar` | **Renamed** | Direct numeric assignment (g). |
| `nutrition_info.per_100g.total_fat_g` | `nutrition.fat` | **Renamed** | Direct numeric assignment (g). |
| `nutrition_info.per_100g.saturated_fat_g` | `nutrition.saturatedFat` | **Renamed** | Direct numeric assignment (g). |
| `nutrition_info.per_100g.dietary_fiber_g` | `nutrition.fiber` | **Renamed** | Direct numeric assignment (g). |
| `nutrition_info.per_100g.sodium_mg` | `nutrition.sodium` | **Renamed** | Direct numeric assignment (mg). |
| `nutrition_info.per_100g.added_sugars_g` | `nutrition.addedSugars` | **Schema Extension** | Valuable FSSAI metric; add optional number field to `nutrition`. |
| `nutrition_info.per_100g.trans_fat_g` | `nutrition.transFat` | **Schema Extension** | Valuable FSSAI metric; add optional number field to `nutrition`. |
| `nutrition_info.nova_group` | `processing.novaGroup` | **Direct Mapping** | Direct integer assignment (1–4). |
| `nutrition_info.nova_group` | `processing.level` | **Normalization** | Map `1` -> `"NOVA 1 (Unprocessed)"`, `4` -> `"NOVA 4 (Ultra-processed)"`. |
| `nutrition_info.nutri_score` | `processing.nutriScore` | **Schema Extension** | Add optional string field for Nutri-Score ('A'–'E', 'U', 'N'). |
| `nutrition_info.data_source` | `source.source` | **Normalization** | Prefix with `"Catalog-500:"` (e.g. `"Catalog-500:openfoodfacts"` or `"Catalog-500:gemini_fssai"`). |
| *(Calculated during ingestion)* | `dataQuality.*` | **Calculated** | Execute `dataQualityService.calculateCompleteness(product)` during ingestion. |
| *(Generated during ingestion)* | `embedding.*` | **Calculated** | Execute `productEmbeddingService.generateProductEmbedding(product)` to generate 384-dim vector. |

---

## 3. Unsupported Fields in SmartChoice Schema (Commercial Attributes)

Catalog-500 includes quick-commerce commercial metadata intended for grocery delivery applications:
- `mrp` (Number) — Maximum Retail Price in INR (e.g. ₹30).
- `price` (Number) — Selling price in INR (e.g. ₹26).
- `discount_percent` (Number) — Percentage discount (e.g. 12%).
- `delivery_time_mins` (Number) — Estimated delivery duration (e.g. 10).
- `rating` (Number) — Customer rating score (e.g. 4.6).
- `review_count` (Number) — Number of reviews (e.g. 1240).
- `in_stock` (Boolean) — Inventory stock status.
- `category_id` (Number) — 1 to 25.
- `category_slug` (String) — URL-safe category identifier.

### Architectural Recommendation for Commercial Attributes:
Create an optional `commerce` subdocument in `backend/models/Product.js`:
```javascript
commerce: {
  mrp: { type: Number },
  price: { type: Number },
  discountPercent: { type: Number },
  deliveryTimeMins: { type: Number },
  rating: { type: Number },
  reviewCount: { type: Number },
  inStock: { type: Boolean, default: true },
  categoryId: { type: Number }
}
```
This isolates commercial attributes from the core health/scoring logic while enabling rich UI features like "Sort by Price", "Filter by In-Stock", or "Cost-per-Nutrient" comparisons.

---

## 4. Missing Fields in Catalog-500 & Resolution Strategies

### 4.1 Missing Barcodes
- **Problem**: In SmartChoice, `identity.barcode` is `required: true, unique: true`. Catalog-500 has no barcodes.
- **Resolution Strategy**:
  1. Add `identity.productId` as a unique indexed string (`PKG_PRD_XXXX`).
  2. For `identity.barcode`, generate deterministic synthetic barcodes adhering to Indian GS1 country code prefix (e.g. `890` + `500` + 4-digit sequence, such as `8905000001` for `PKG_PRD_0001`).
  3. Update `backend/services/barcodeResolver.js` to accept either standard 13-digit EANs or `PKG_PRD_XXXX` product IDs.

### 4.2 Missing Individual Ingredients Array
- **Problem**: Catalog-500 provides `ingredients_text` as a raw string (e.g. `"Refined Wheat Flour (68%), Sugar, Palm Oil..."`), but SmartChoice expects `ingredients.ingredients` as an array of strings.
- **Resolution Strategy**: Ingest through `ingredientAnalysisService.parseIngredientText(text)` to produce clean tokenized arrays while preserving the full text.

### 4.3 Missing Additives Array
- **Problem**: Additives are not pre-parsed in Catalog-500.
- **Resolution Strategy**: SmartChoice's additive extraction regex in `ingredientAnalysisService` successfully extracts INS/E numbers (e.g. `INS 500(ii)` -> `e500ii`, `INS 322` -> `e322`) during pipeline transformation.
