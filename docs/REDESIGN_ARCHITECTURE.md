# SmartChoice Redesign — Target Architecture & Migration Blueprint

**Document:** `docs/REDESIGN_ARCHITECTURE.md`  
**Phase:** Phase 1 — Complete Repository and Dataset Audit  
**Date:** November 2026  
**Status:** Architecture Blueprint Finalized  

---

## 1. Architectural Vision

The redesigned SmartChoice platform transforms into a **unified nutrition intelligence and quick-commerce food catalog** tailored for the Indian packaged goods market.

By leveraging the **500 Products Virtual Dataset Catalog** as the primary source of truth, SmartChoice eliminates dependency on unpredictable external API lookups while empowering consumers to:
1. Browse 25 curated Indian food categories with authentic FSSAI-compliant nutrition facts and procedural packshots.
2. Evaluate products through the deterministic **SmartChoice Scoring Engine** (Nutrition 40%, Ingredients 20%, Processing 15%, Protein/Fiber 15%, Preferences 10%).
3. Find healthier alternatives via the **Product Similarity Engine** (Category 40%, Product Type 20%, Serving Size 15%, Ingredients 15%, Nutrition 10%).
4. Interact with the multi-turn **AI Nutrition Assistant** via semantic vector search and RAG context retrieval (0.55 min similarity, 0.70 strong similarity).
5. Leverage client-side **OCR Label Scanning** and **Barcode Detection**.

```
+-----------------------------------------------------------------------------------+
|                                  USER CLIENT                                      |
|  React 19 + Vite 8 + Tailwind CSS 4 + Lucide Icons + Recharts + html5-qrcode/OCR  |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                               EXPRESS BACKEND API                                 |
|      (Routing, Rate Limiting, Helmet Security, Error Handling, Agent Session)     |
+-----------------------------------------------------------------------------------+
       |                   |                   |                     |
       v                   v                   v                     v
+--------------+    +---------------+   +---------------+    +----------------------+
|   CATALOG    |    |  SMARTCHOICE  |   |  SIMILARITY   |    |    AI ASSISTANT      |
|  CONTROLLER  |    | SCORING ENGINE|   |  & ALTERNATIVE|    |  (Gemini + RAG +     |
| (Search, Cat,|    |  (40/20/15/   |   |  RECOMMENDER  |    |  Intent Router +     |
| Filters, DB) |    |    15/10)     |   | (40/20/15/15) |    |  Atlas Vector Search)|
+--------------+    +---------------+   +---------------+    +----------------------+
       |                   |                   |                     |
       +-------------------+-------------------+---------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                                 MONGODB ATLAS                                     |
|        - Products Collection (500 Curated Indian Packaged Foods)                  |
|        - Atlas Vector Search Index (384-dimensional embeddings)                   |
|        - UserPreferences & AgentSession Collections                               |
+-----------------------------------------------------------------------------------+
```

---

## 2. Service Architecture Assessment

### 2.1 Reusable Services (Zero / Minimal Changes)
- **`scoringService.js`**: Calculates deterministic SmartChoice score. Already aligns with the 40/20/15/15/10 weighting rule. Reusable as-is.
- **`similarityService.js`**: Computes multi-parameter similarity. Already aligns with the 40/20/15/15/10 similarity configuration. Reusable as-is.
- **`recommendationService.js`**: Ranks healthier alternatives matching user preferences and category boundaries. Reusable as-is.
- **`comparisonService.js`**: Formats side-by-side product comparisons. Reusable as-is.
- **`preferenceService.js`**: Normalizes dietary preferences and applies penalty rules. Reusable as-is.
- **`nutritionNormalizationService.js`**: Normalizes nutrients per 100g. Reusable as-is.
- **`ingredientAnalysisService.js`**: Identifies allergens and extracts INS/E numbers. Reusable as-is.
- **`processingAnalysisService.js`**: Evaluates NOVA group 1–4. Reusable as-is.
- **`sessionManager.js`**: Manages conversational sessions and comparison states. Reusable as-is.
- **`agentActions.js` & `toolRegistry.js`**: Safe, deterministic tool execution interface for the AI assistant. Reusable.

### 2.2 Services Requiring Modification
- **`productController.js`**:
  - Add category listing and category filtering support (`/api/products?category=...`).
  - Prioritize local Catalog-500 products over external Open Food Facts queries.
  - Support product lookup by either MongoDB `_id` or `product_id` (`PKG_PRD_XXXX`).
- **`barcodeResolver.js`**:
  - Currently expects an EAN barcode. Must be updated to resolve `product_id` (e.g. `PKG_PRD_0001`) as well as synthetic barcodes.
- **`productEmbeddingService.js`**:
  - Update semantic text formatting template to incorporate the 25 new category names, FSSAI dietary classifications (`VEG` / `NON_VEG`), and brand data from Catalog-500.
- **`vectorSearchService.js`**:
  - Ensure compatibility with the newly regenerated 384-dimensional vectors for the 500 catalog items.
- **`agentOrchestrator.js`**:
  - Register category browsing and dietary filtering tools into the tool registry for the Gemini orchestrator.

### 2.3 Redundant / Deprecated Services
- **Aggressive Live Open Food Facts Fallback**:
  - Previously, searches with fewer than 5 local matches made synchronous external API requests to Open Food Facts (`openFoodFactsService.js`).
  - *Recommendation*: Deprecate the aggressive external fallback in search routes. All 500 catalog products are locally indexed in MongoDB Atlas; external OFF queries should be relegated to optional explicit user imports.

### 2.4 Broken / Blocked Baseline Components
- **MongoDB Atlas SRV Lookup Failure**:
  - The default `.env` MONGODB_URI causes `querySrv ENOTFOUND` error.
  - *Action*: Configure a healthy Atlas cluster or provide a local MongoDB fallback connection URI to allow backend tests to pass.

---

## 3. Database Migration Requirements

1. **Schema Extension (`backend/models/Product.js`)**:
   - Add `identity.productId` (String, unique, indexed).
   - Add `identity.dietaryType` (String, enum: `['VEG', 'NON_VEG']`).
   - Add optional `commerce` subdocument for quick-commerce attributes (`mrp`, `price`, `discountPercent`, `deliveryTimeMins`, `rating`, `reviewCount`, `inStock`, `categoryId`).
   - Ensure `identity.barcode` supports synthetic identifiers without breaking uniqueness constraints.
2. **Catalog Ingestion Pipeline (`scripts/ingestCatalog500.js`)**:
   - Read `D:\500Products\frontend\public\data\enriched_catalog_500.json`.
   - Transform each record according to `docs/FIELD_MAPPING.md`.
   - Compute data quality scores using `dataQualityService`.
   - Batch insert into MongoDB `products` collection with full transaction/backup safety.
3. **Embedding Generation (`scripts/generateCatalogEmbeddings.js`)**:
   - Generate 384-dimensional vectors using Hugging Face `sentence-transformers/all-MiniLM-L6-v2`.
   - Store in `embedding.vector` and verify Atlas Vector Search index `product_vector_index`.

---

## 4. API & Route Evolution Plan

| Endpoint | HTTP Method | Change Type | Description |
|---|---|---|---|
| `/api/categories` | `GET` | **New** | Returns all 25 categories with thumbnail, slug, and product count. |
| `/api/categories/:slug/products` | `GET` | **New** | Returns all 20 products belonging to a category. |
| `/api/products/search` | `GET` | **Enhance** | Adds category, brand, and dietary filter params (`dietary=VEG`). |
| `/api/products/id/:productId` | `GET` | **New** | Lookup product by `PKG_PRD_XXXX` catalog identifier. |
| `/api/products/barcode/:barcode` | `GET` | **Enhance** | Resolves either synthetic barcode or `product_id`. |

---

## 5. Frontend UI/UX Evolution Plan

1. **Category Navigation & Sidebar**:
   - Port the category browsing pattern from Catalog-500 into SmartChoice's navigation.
   - 25 category pills/cards with themed icons and packshots.
2. **Product Card Modernization**:
   - Display FSSAI Green/Red Veg/Non-Veg emblem.
   - Display Nutri-Score badge ('A' through 'E').
   - Render packshot SVG when external image fails or is unavailable.
   - Display SmartChoice Health Score alongside quick-commerce price and MRP.
3. **Product Detail View**:
   - Comprehensive nutritional facts table with per-serving and per-100g toggles.
   - Transparent SmartChoice score explanation accordion (Nutrition, Ingredients, NOVA, Protein/Fiber).
   - Direct button to add product to the Compare tray or AI Assistant session.
4. **AI Assistant Integration**:
   - Enable Assistant to query category benchmarks, recommend lower-sugar or higher-protein items within the same category, and compare products seamlessly.
