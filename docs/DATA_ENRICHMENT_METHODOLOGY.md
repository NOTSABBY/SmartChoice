# Open Food Facts Product Data Enrichment Methodology

**Document:** `docs/DATA_ENRICHMENT_METHODOLOGY.md`  
**Phase:** Phase 2 — Catalog Integration, MongoDB Database Migration & Product Data Enrichment  
**Date:** November 2026  
**Status:** Implemented & Verified  

---

## 1. Enrichment Architecture & Principles

The enrichment pipeline enriches imported Catalog-500 products with nutritional profiles, ingredients, additives, allergens, and packaging photography from the Open Food Facts API (`https://world.openfoodfacts.org`).

### Core Governance Rules
1. **Decoupled Lifecycle**: The catalog import pipeline is completely independent of external enrichment. Inability to enrich an item never blocks or rolls back catalog ingestion.
2. **Resumable Batching**: Enrichment executes as a controlled background batch process with rate limiting, targeting items in `PENDING` or `FAILED` states.
3. **No Automatic Acceptance of Ambiguity**: If brand, category, or name agreement falls into an ambiguous range, the item is flagged as `MATCH_REQUIRES_REVIEW` rather than corrupting catalog records.
4. **Zero Fabrication**: If Open Food Facts lacks a specific nutrient (e.g. dietary fiber), the field remains `null`. Missing values are never converted to zero.
5. **Measurement Basis Preservation**: The pipeline inspects whether nutriments are reported `per_100g` or `per_serving` before conversion, and preserves the raw response snapshot in `nutrition.originalRetrieved`.

---

## 2. Multi-Factor Product Matching Algorithm

Each Open Food Facts candidate returned for a query term is scored against the catalog product across three weighted dimensions:

$$\text{Match Confidence} = 0.40 \cdot \text{BrandAgreement} + 0.45 \cdot \text{NameSimilarity} + 0.15 \cdot \text{CategoryCompatibility}$$

### Dimension Breakdown
1. **Brand Agreement (40%)**:
   - Case-insensitive bidirectional substring check between `catalog.brand` and candidate `brands`.
   - Score: `0.40` if matched; `0.00` with warning reason if mismatched.
2. **Product Name Token Similarity (45%)**:
   - Tokenizes names into alphanumeric words (length > 2), computing Jaccard similarity:
     $$J(\text{Tokens}_{\text{catalog}}, \text{Tokens}_{\text{candidate}}) = \frac{|\text{Tokens}_{\text{catalog}} \cap \text{Tokens}_{\text{candidate}}|}{|\text{Tokens}_{\text{catalog}} \cup \text{Tokens}_{\text{candidate}}|}$$
   - Score: $J \cdot 0.45$.
3. **Category Compatibility (15%)**:
   - Checks if key tokens from `catalog.categoryName` appear in candidate `categories`.
   - Score: `0.15` if compatible; `0.00` otherwise.

### Thresholds & State Transitions
- **Confidence $\ge 0.75$**: `MATCHED`. High confidence match accepted; proceeds to extraction and normalization.
- **$0.55 \le \text{Confidence} < 0.75$**: `MATCH_REQUIRES_REVIEW`. The candidate is stored in `matchEvidence` with candidate barcode, but fields are not merged automatically.
- **$\text{Confidence} < 0.55$**: `NOT_FOUND`. All candidate matches rejected as unrelated products.

---

## 3. Nutritional Normalization & Basis Detection

### 3.1 Basis Detection
Open Food Facts returns nutriments in either per-100g or per-serving format:
1. **Case A (`per_100g`)**: `energy-kcal_100g`, `proteins_100g`, `sugars_100g`.
   - *Action*: Directly extracted without conversion. Measurement basis marked as `per_100g`.
2. **Case B (`per_serving`)**: `energy-kcal_serving`, `proteins_serving`, etc.
   - *Action*: Parses numeric serving size $S$ from `serving_size` string (e.g. `"30 g"` -> $S = 30$).
   - Multiplier $M = \frac{100}{S}$.
   - Normalized value = $\text{Value}_{\text{serving}} \cdot M$.
   - Measurement basis marked as `per_serving`.
3. **Case C (Double-Normalization Prevention)**:
   - If `per_100g` fields exist, the serving multiplier is bypassed entirely, preventing accidental compound multiplication.

### 3.2 Raw Payload Preservation
Every enriched product stores an immutable snapshot in `nutrition.originalRetrieved`:
```javascript
originalRetrieved: {
  detectedBasis: "per_100g",
  rawValuesSnapshot: {
    "energy-kcal": 448.6,
    "proteins": 6.4,
    "carbohydrates": 63,
    "sugars": null,
    "fat": 19,
    "saturated-fat": null
  }
}
```

---

## 4. Enrichment Status State Machine

```
              [ PENDING ]
                   |
            (Query External OFF)
                   |
      +------------+------------+---------------+
      |                         |               |
(Conf >= 0.75)         (0.55 <= Conf < 0.75)  (Conf < 0.55 or 0 Results)
      |                         |               |
      v                         v               v
 [ Extract Data ]    [ MATCH_REQUIRES_REVIEW ] [ NOT_FOUND ]
      |
      +---> (6+ Nutrients & Ingredients present) ---> [ ENRICHED ]
      |
      +---> (<6 Nutrients or Missing Ingredients) ---> [ PARTIALLY_ENRICHED ]

* On Network Timeout / 503 HTTP / Rate Limit ---> [ FAILED ] (retryable)
```
