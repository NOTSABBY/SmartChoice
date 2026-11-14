# SmartChoice Redesign — Baseline Repository & Dataset Audit

**Document:** `docs/REDESIGN_BASELINE_AUDIT.md`  
**Phase:** Phase 1 — Complete Repository and Dataset Audit  
**Date:** November 2026  
**Status:** Audit Completed & Verified  

---

## 1. Executive Summary

The **SmartChoice Redesign** project centers on evolving SmartChoice from a generic open-source food scanner into an authentic, FSSAI-aligned Indian packaged food intelligence platform. The primary dataset for this redesign is the **500 Products Virtual Dataset Catalog** (`Catalog-500`), which contains 500 packaged food items spanning 25 categories commonly sold in Indian quick-commerce and retail environments.

This audit report documents the pre-redesign baseline across both repositories:
1. **SmartChoice** (`Primary Project` — Authorized for modification): Full-stack nutrition scoring, similarity, comparison, OCR, barcode scanning, Atlas Vector Search, and AI Agent application.
2. **Catalog-500** (`Source Dataset Project` — Strictly READ-ONLY at `D:\500Products`): 500-product authentic packaged food catalog, raw Excel source, multi-tier enrichment pipeline (Open Food Facts + FSSAI domain benchmarks + Gemini fallback), and quick-commerce UI.

---

## 2. SmartChoice Repository Audit

### 2.1 Technology Stack & Architecture
- **Frontend**: React 19.2.8, Vite 8.3.0, Tailwind CSS 4.3.3, React Router DOM 7.18.4, Lucide React 1.51.0, Recharts 3.10.1, Tesseract.js 7.0.0, html5-qrcode 2.3.8, Oxlint 1.81.0.
- **Backend**: Node.js v24, Express 4.19.2, Mongoose 8.5.1, `@google/genai` 2.27.0, `@huggingface/inference` 4.13.30, Helmet 7.1.0, CORS 2.8.5, Rate-Limit 7.3.1, Morgan 1.10.0, dotenv 16.4.5.
- **Database**: MongoDB Atlas with Vector Search index `product_vector_index`.
- **Embeddings**: Hugging Face `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions).
- **AI/LLM**: Google Gemini (`gemini-3.8-flash` / `@google/genai`) with structured intent routing, deterministic tool invocation, and session state management.

### 2.2 Directory Structure
```
SmartChoice/
├── .env / .env.example       # Server and API configurations
├── ARCHITECTURE.md           # High-level architecture reference
├── PROJECT_STRUCTURE.md      # Monorepo directory map
├── backend/
│   ├── config/               # Database, scoring, and RAG configuration
│   ├── controllers/          # productController, ragController
│   ├── models/               # Product, UserPreference, AgentSession
│   ├── routes/               # productRoutes
│   ├── middleware/           # errorHandler
│   ├── services/             # 19 core backend domain services
│   ├── agent/                # toolRegistry, intentRouter, agentActions, agentState
│   ├── utils/                # geminiErrorHandler
│   └── server.js             # Express application root (Port 8080)
├── frontend/
│   ├── src/
│   │   ├── components/       # BarcodeScanner, OcrProcessor, RecommendationList
│   │   ├── context/          # ComparisonContext, PreferenceContext
│   │   ├── layouts/          # MainLayout (Navbar, Footer)
│   │   ├── pages/            # Home, Search, ProductDetail, Compare, Scanner, OCR, RagAssistantPage, PreferencesPage
│   │   ├── services/         # productService, ragService, comparisonService, ocrParser, semanticSearchService
│   │   └── utils/            # formatting, helpers
├── data/
│   ├── backups/              # Historical collection snapshots
│   ├── processed/            # products_india.json (500 items)
│   └── raw/                  # openfoodfacts_india raw snapshot JSONs
├── docs/                     # Technical specifications and phase documentation
└── scripts/                  # Data ingestion, embedding generation, RAG and OCR test scripts
```

### 2.3 Database Models
1. **`Product` (`backend/models/Product.js`)**:
   - `identity`: `barcode` (String, required, unique, indexed), `name` (String, required, indexed), `brand` (String, indexed), `categories` ([String], indexed), `productType` (String).
   - `serving`: `servingSize` (String), `servingSizeUnit` (String).
   - `media`: `imageUrl` (String), `productUrl` (String).
   - `ingredients`: `ingredients` ([String]), `allergens` ([String]), `additives` ([String]).
   - `nutrition`: `calories`, `protein`, `carbohydrates`, `sugar`, `fat`, `saturatedFat`, `fiber`, `sodium` (all Numbers, per 100g/ml).
   - `processing`: `level` (String), `novaGroup` (Number), `labels` ([String]).
   - `source`: `source` (default: 'OpenFoodFacts'), `sourceId` (String), `lastUpdated` (Date).
   - `dataQuality`: `completeness` (Number), `missingNutritionFields` ([String]), `dataQualityScore` (Number).
   - `embedding`: `vector` ([Number], 384 dim), `model` (String), `dimensions` (Number), `version` (String), `textHash` (String), `generatedAt` (Date).
2. **`UserPreference` (`backend/models/UserPreference.js`)**:
   - Dietary goals: `highProtein`, `lowSugar`, `lowCalories`, `lowSaturatedFat`, `lowSodium`, `highFiber` (Booleans).
   - Dietary lifestyles: `vegetarian`, `vegan` (Booleans).
   - Restrictions: `avoidAllergens` ([String]), `avoidIngredients` ([String]), `preferredCategories` ([String]), `excludedCategories` ([String]), `preferredBrands` ([String]), `excludedBrands` ([String]).
   - Hard thresholds: `maxCalories`, `maxSugar`, `minProtein`, `minFiber` (Numbers).
3. **`AgentSession` (`backend/models/AgentSession.js`)**:
   - `sessionId` (String, unique, indexed), `conversation` (messages array), `activeComparisonList` (product snapshots array), `retrievedProducts`, `inputState` (OCR uploads, barcode scans), `userPreferences`, `validationWarnings`, `expiresAt` (TTL 24 hours).

### 2.4 Backend Services Inventory (21 Services)
| Service | Purpose | Key Dependencies | Reusability in Redesign |
|---|---|---|---|
| `scoringService.js` | Computes SmartChoice Score (0–100) across 5 weighted components | `scoringConfig.js`, `Product` model | Reusable as-is (weights: 40/20/15/15/10) |
| `similarityService.js` | Calculates product similarity score (0–100) using weighted metrics | `Product` model | Reusable as-is (weights: 40/20/15/15/10) |
| `recommendationService.js` | Finds healthier alternatives matching user preferences | `scoringService`, `similarityService` | Reusable as-is |
| `comparisonService.js` | Side-by-side nutrition, ingredient, and score comparison | `Product` model | Reusable as-is |
| `preferenceService.js` | Normalizes user preferences and applies dietary penalties | `UserPreference` model | Reusable as-is |
| `nutritionNormalizationService.js` | Normalizes per-serving and per-100g nutritional metrics | None | Reusable as-is |
| `ingredientAnalysisService.js` | Parses ingredient strings, flags harmful additives, allergens | Rule dictionaries | Reusable as-is |
| `processingAnalysisService.js` | Classifies foods into NOVA 1–4 processing stages | Rules & NOVA definitions | Reusable as-is |
| `fssaiService.js` | Validates against Indian RDA guidelines and FSSAI rules | Regulatory limits | Reusable as-is |
| `embeddingService.js` | Generates 384-dim vectors via Hugging Face API | `@huggingface/inference` | Reusable as-is |
| `productEmbeddingService.js` | Constructs rich semantic text strings and batch embeddings | `embeddingService`, `Product` | Reusable with catalog text adjustments |
| `vectorSearchService.js` | Atlas `$vectorSearch` aggregation pipeline execution | `embeddingService`, `Product` | Reusable with vector index sync |
| `ragRetrievalService.js` | Semantic search + SmartChoice scoring + preference scoring context | `vectorSearchService`, `scoringService` | Reusable as-is (0.55 / 0.70 thresholds) |
| `agentOrchestrator.js` | Multi-turn AI Assistant orchestrator | `intentRouter`, `toolRegistry`, Gemini | Reusable, needs catalog tool enrichment |
| `sessionManager.js` | In-memory + MongoDB session lifecycle management | `AgentSession` model | Reusable as-is |
| `openFoodFactsService.js` | Queries external Open Food Facts REST API | `axios` | Keep as secondary fallback only |
| `barcodeResolver.js` | Resolves scanned barcode against DB and external APIs | `Product`, `openFoodFactsService` | Must adapt to support `product_id` |
| `visionExtractor.js` | Multimodal label extraction using Gemini Vision | `@google/genai` | Reusable for OCR image analysis |
| `dataQualityService.js` | Calculates completeness and penalty scores for product records | None | Reusable as-is |
| `globalProductQueryService.js` | Deterministic querying for generalized product exploration | `Product` model | Reusable for catalog broad search |
| `llmService.js` | Direct LLM prompting utility and structured formatting | `@google/genai` | Reusable for natural language explanations |

### 2.5 API Endpoints
- `GET /api/health` — Service health check.
- `GET /api/products/search?q=...` — Hybrid product search (MongoDB regex with OpenFoodFacts fallback).
- `GET /api/products/barcode/:barcode` — Barcode lookup with external API fallback.
- `GET /api/products/:id` — Product detail fetch by MongoDB `_id`.
- `GET /api/products/:id/similar` — Top similar products in same category.
- `GET /api/products/:id/score` — SmartChoice score with confidence and breakdown.
- `GET /api/products/:id/ingredients` — Parsed ingredient list with additive/allergen flags.
- `GET /api/products/:id/processing` — NOVA processing classification details.
- `GET /api/search/semantic?q=...` — Vector search endpoint via Atlas.
- `POST /api/compare` — Compares an array of product IDs side-by-side.
- `POST /api/scores` — Batch scoring for multiple products.
- `GET /api/preferences/default` — Returns default preference profile.
- `POST /api/recommendations` & `POST /api/recommendations/rank` — Healthier alternative recommendations.
- `GET /api/rag/context` — Formatted RAG context payload for LLM consumption.
- `POST /api/rag/query` — AI Assistant multi-turn query processing via Agent Orchestrator.

---

## 3. Catalog-500 Repository Audit (`D:\500Products`)

### 3.1 Directory Structure & Artifacts
```
D:\500Products/
├── authentic_packaged_food_catalog_500.xlsx   # Master source workbook (READ-ONLY)
├── requirements.txt                          # Python dependencies
├── pipeline/
│   ├── enrich_catalog.py                     # Multi-tier enrichment engine
│   ├── fssai_knowledge_base.py               # FSSAI profiles for 25 categories
│   ├── gemini_fallback.py                    # Gemini 2.5 Flash batch structured extraction
│   ├── image_generator.py                    # SVG packshot generator with category themes
│   └── checkpoint_cache.json                 # Checkpoint cache (500 items, 5.08 MB)
└── frontend/
    ├── public/data/
    │   ├── enriched_catalog_500.json         # Master enriched JSON (500 items, 5.28 MB)
    │   └── categories/                       # 25 category slice JSONs
    └── src/
        ├── types/catalog.ts                  # Canonical TypeScript interface
        ├── components/                       # ProductCard, CategorySidebar, ProductDetailModal, CartDrawer
        └── utils/packshotFallback.ts         # Client-side dynamic SVG generator
```

### 3.2 Master Excel Workbook (`authentic_packaged_food_catalog_500.xlsx`)
- **Worksheet Count**: 1 sheet named `'Products Catalog'`.
- **Dimensions**: Exactly 500 rows × 7 columns.
- **Columns & Types**:
  1. `Product ID` (String, e.g. `PKG_PRD_0001` to `PKG_PRD_0500`) — Unique primary key.
  2. `Category ID` (Integer, 1 to 25) — Numerical category identifier.
  3. `Category Name` (String, 25 unique category names, exactly 20 products per category).
  4. `Brand` (String, 210 unique brand names).
  5. `Product Name` (String, 500 unique product titles).
  6. `Packaging Size` (String, static value `"Standard Pack"` for all 500 rows).
  7. `Open Food Facts Query Term` (String, exact brand + product search term).

### 3.3 Multi-Tier Data Enrichment Pipeline
The Catalog-500 project contains an asynchronous enrichment pipeline (`pipeline/enrich_catalog.py`):
1. **Tier 1 (Open Food Facts Search)**: Queries Open Food Facts using the query term with rate limiting and retry logic. 110 products (22.0%) were successfully enriched via live Open Food Facts data.
2. **Tier 2 (Gemini Structured Extraction)**: For items where Open Food Facts was missing or incomplete, Gemini 2.5 Flash structured output was used to extract realistic nutrition and ingredients matching FSSAI profiles.
3. **Tier 3 (FSSAI Regulatory Knowledge Base)**: 25 distinct category benchmark profiles (`fssai_knowledge_base.py`) providing standard per-100g nutritional compositions, ingredient sequences sorted by predominance, allergen lists, and NOVA/Nutri-Score ratings.
4. **Visual Asset Fallback**: `image_generator.py` generates deterministic, themed SVG packshot illustrations for products lacking external CDN images.

### 3.4 Canonical Catalog-500 Product Schema (`catalog.ts`)
```typescript
export interface Product {
  product_id: string;          // e.g. "PKG_PRD_0001"
  category_id: number;         // 1 - 25
  category_name: string;       // e.g. "Packaged Biscuits & Cookies"
  brand: string;               // e.g. "Parle"
  product_name: string;        // e.g. "Parle-G Gold Biscuits"
  packaging_size: string;      // e.g. "Standard Pack"
  query_term: string;          // e.g. "Parle-G Gold Biscuits"
  dietary_type: 'VEG' | 'NON_VEG' | string;
  images: {
    front_hd: string;
    front_thumb: string;
    image_source: 'openfoodfacts' | 'serper' | 'ddg' | 'placeholder' | string;
  };
  nutrition_info: {
    serving_size: string;
    nutri_score: string;       // 'A', 'B', 'C', 'D', 'E', 'U'
    nova_group: number;        // 1, 2, 3, 4
    ingredients_text: string;
    allergens: string[];
    per_100g: {
      energy_kcal: number;
      protein_g: number;
      carbohydrates_g: number;
      total_sugars_g: number;
      added_sugars_g: number;
      total_fat_g: number;
      saturated_fat_g: number;
      trans_fat_g: number;
      dietary_fiber_g: number;
      sodium_mg: number;
    };
    data_source: 'openfoodfacts' | 'gemini_fssai_estimated' | string;
  };
  price: number;
  mrp: number;
  discount_percent: number;
  delivery_time_mins: number;
  rating: number;
  review_count: number;
  in_stock: boolean;
}
```

---

## 4. Key Gaps & Inconsistencies Discovered

1. **Barcode Absence in Catalog-500**:
   - SmartChoice requires `identity.barcode` as a unique, required index.
   - Catalog-500 uses `product_id` (`PKG_PRD_XXXX`) and has zero barcodes in the Excel workbook and enriched JSON.
   - *Impact*: Ingestion requires establishing a dual-key strategy: either generating synthetic deterministic EAN-like barcodes from `product_id` or making `barcode` optional while indexing `product_id` across all routes.
2. **MongoDB Connection / DNS Error in SmartChoice**:
   - The current `MONGODB_URI` in `.env` points to `_mongodb._tcp.smartchoice.hqzxyys.mongodb.net`, which fails DNS SRV lookup (`ENOTFOUND`).
   - *Impact*: Backend integration tests that connect to Atlas fail synchronously. A valid Atlas URI or local MongoDB connection string is required.
3. **Packaging Size Homogeneity in Excel**:
   - All 500 rows in `authentic_packaged_food_catalog_500.xlsx` have `Packaging Size = "Standard Pack"`.
   - *Impact*: The enriched JSON contains realistic `serving_size` inside `nutrition_info` (e.g. "15 g", "30 g"), which must be prioritized over the raw Excel column.
4. **Nutri-Score Non-Standard Values**:
   - 32 products have Nutri-Score `'U'` (Unknown) and 3 have `'N'`.
   - *Impact*: Frontend badge renderers expecting only 'A' through 'E' must handle 'U' and 'N' without visual failure.
5. **Quick-Commerce Metadata Presence**:
   - Catalog-500 introduces pricing, MRP, discounts, delivery times, and stock indicators that do not exist in the current SmartChoice `Product` schema.
   - *Impact*: SmartChoice schema should be extended to store these fields so the UI can optionally render quick-commerce context alongside health analytics.
