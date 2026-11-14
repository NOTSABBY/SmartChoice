# Phase 3 — Product Analysis Engine Specification

## 1. Overview
The SmartChoice Product Analysis Engine provides deterministic, explainable, and regulatory-aligned evaluations of food products across 25 catalog categories. It processes:
1. Nutritional thresholds & category-aware traffic lights (UK FSA / WHO SEARO / FSSAI).
2. Trans-fat statutory compliance vs. decoupled FSSAI "Trans Fat Free" nutritional claims.
3. Protein claims evaluated against ICMR-NIN RDA (2020) across all recognized statutory claim bases.
4. Dietary fibre claims evaluated across solids, liquids, and per-100-kcal dimensions.
5. Ingredient tokenization and FSSAI 8 mandatory allergen classes.
6. Food additive identification, INS coding, and cosmetic ultra-processing identification.
7. Strict multi-factor evidence-based NOVA classification (Never based on category priors alone).
8. Independent, decoupled Data Completeness and Analytical Confidence scoring.

## 2. API Endpoints
- `GET /api/analysis/thresholds`: Returns complete category formats, nutritional thresholds, and ICMR-NIN RDA references.
- `GET /api/analysis/:id`: Analyzes product by ID or `catalog.productId`. Supports query parameters `?statutoryRda=54&profileKey=ADULT_WOMEN.SEDENTARY`.