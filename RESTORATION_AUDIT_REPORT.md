# SMARTCHOICE — SYSTEM RESTORATION & REGRESSION AUDIT REPORT (PHASE 1)

**Audit Date:** 16 November 2026  
**Auditor:** Antigravity AI Assistant  
**Repository:** SmartChoice (Packaged Food Intelligence & Recommendation System)  
**Primary References:** Git Commit History (`f8eb1e7`, `8272292`, `706a8b9`, `81563a7`, `8aac2b3`), Canonical Source Code, and Previously Approved Requirements.

---

## 1. Executive Summary

A comprehensive change-history audit was conducted across the SmartChoice repository to identify functional regressions introduced during recent catalogue, scoring, recommendation, and UI modifications.

The audit verified:
1. **Catalog Integrity & Data Sources:** The production catalogue consists of 500 verified SKUs in `frontend/public/data/enriched_catalog_500.json` alongside 500 legacy SKUs in `data/processed/products_india.json` (total 1,000 SKUs).
2. **Scoring Engine Additivity:** The core scoring discrepancy (where component badge integers summed to 56, but total score displayed 55 due to unrounded float truncation) was addressed in commit `8aac2b3`. Exact additivity holds across all 1,000 SKUs.
3. **Primary Regressions Identified:**
   - **ProductCard Dietary Symbols:** In commit `706a8b91` ("SmartChoice Final"), `<DietaryEmblem product={product} />` was completely stripped from `ProductCard.jsx` following an instruction to remove dietary icons from the *image area*, leaving product cards with zero visual dietary classification indicators in the product information area.
   - **Comparison Engine Fallback Incompleteness:** `ComparePage.jsx` contained an incomplete client-side fallback `buildClientSideComparison` which omitted `verdict`, `nutritionalComparison`, `ingredientComparison`, and `allergenComparison`. If the backend API was unreachable or offline, the comparison page broke or displayed empty sections. Furthermore, property key divergence (`proteinFiber` vs `proteinFibre`) caused undefined values in the scoring comparison matrix.
   - **Recommendation Engine Independence & Lifestyle Exclusions:** The Recommendation Engine logic in `RecommendationsPage.jsx` and `productEligibility.js` was largely sound, but lifestyle preference filter edge cases (e.g. Vegetarian-only vs Vegan-only vs Both) and category persistence required verification against the approved selection matrix.
   - **Master Catalog Neutrality:** The Master Catalog in `Storefront.jsx` correctly enforces strict allergen and ingredient exclusions globally while remaining strictly neutral to user nutritional and dietary lifestyle preferences, but product cards lacked the required restored classification emblems in the text area.

---

## 2. Detailed Change History & Regression Analysis

### 2.1 ProductCard.jsx & Dietary Classification Symbols
* **Previously Working Behaviour:** Product cards communicated whether a product was Vegetarian, Vegan, Non-Vegetarian, or Unknown using the standard FSSAI statutory emblems (green dot in green square for Vegetarian, brown/rose mark for Non-Vegetarian, leaf emblem for Vegan, dashed slate circle for Unknown).
* **Current Broken Behaviour:** In commit `706a8b91`, `<DietaryEmblem product={product} />` was deleted from `ProductCard.jsx`. As a result, product cards in Master Catalog, Search Results, and Recommendation Engine currently display no dietary symbols at all.
* **Files Responsible:** `frontend/src/components/ProductCard.jsx`.
* **Root Cause:** Over-correction during removal of dietary icons from the top image container resulted in removing the emblem entirely rather than relocating it to the product information section.
* **Recommended Repair:** Re-import `DietaryEmblem` and position `<DietaryEmblem product={product} />` in the product information section alongside the brand header (strictly outside the image area).
* **Tests Required:** Verification of Vegan, Vegetarian, Non-Vegetarian, and Unknown product cards in Master Catalog and Recommendation Engine.

---

### 2.2 Comparison Engine (ComparePage.jsx & comparisonService.js)
* **Previously Working Behaviour:** The Comparison Engine rendered side-by-side evaluations across 11 nutritional fields, complete ingredient lists with shared vs unique tokens, a 9-allergen matrix (CONTAINS, MAY_CONTAIN, VERIFIED_ABSENCE, UNKNOWN), processing NOVA classifications, score breakdowns, pairwise similarity metrics, and an evidence-based Best Product Verdict explaining trade-offs.
* **Current Broken Behaviour:**
  1. In `ComparePage.jsx`, `buildClientSideComparison` provided only `{ products: normalizedProducts, isClientFallback: true }`. When running client-side or if the backend endpoint (`/api/compare`) failed, `verdict`, `nutritionalComparison`, `ingredientComparison`, `allergenComparison`, and `pairwiseSimilarity` were undefined, breaking sections 3–10.
  2. In Section 7 (Scores), `p.qualityBreakdown.proteinFiber` evaluated to `undefined` because `calculateProductBreakdown` returned `proteinFibre`, causing `undefined / 15` in the UI.
* **Files Responsible:** `frontend/src/pages/ComparePage.jsx`, `frontend/src/utils/productScoring.js`, `backend/services/comparisonService.js`.
* **Root Cause:** Lack of parity between client-side fallback builder and backend response contract, plus spelling mismatch (`proteinFiber` vs `proteinFibre`).
* **Recommended Repair:**
  1. Implement a complete, deterministic client-side comparison builder in `ComparePage.jsx` mirroring `comparisonService.js` so that comparisons never break regardless of server state.
  2. Support both `proteinFiber` and `proteinFibre` aliases in `productScoring.js` and `ComparePage.jsx`.
  3. Ensure allergen comparison never treats `UNKNOWN` as verified absence.
* **Tests Required:** Two-product comparison, three-product comparison, missing nutrient comparison, allergen conflict comparison, and best-product trade-off analysis.

---

### 2.3 Recommendation Engine (RecommendationsPage.jsx & recommendationService.js)
* **Previously Working Behaviour:** Recommendation Engine operated as an independent page (`/recommendations`), reading user preferences, filtering eligible products via strict exclusions, ranking products primarily by Match Score and secondarily by Quality Score, and displaying outperformance reasons.
* **Current Broken Behaviour:**
  1. Lifestyle preferences required strict verification against the approved rules:
     - Vegetarian ON, Vegan OFF: include verified Vegetarian; exclude Vegan and Non-Veg.
     - Vegan ON, Vegetarian OFF: include verified Vegan only.
     - Both ON: include verified Vegetarian and Vegan; exclude Non-Veg.
     - Unknown classification must be excluded when any lifestyle filter is active.
  2. The recommendation interface needed to ensure that product cards rendered with the restored dietary emblems and that empty states when no preferences were set remained clear.
* **Files Responsible:** `frontend/src/pages/RecommendationsPage.jsx`, `frontend/src/utils/productEligibility.js`, `backend/services/recommendationService.js`.
* **Root Cause:** Verification of edge-case handling when combining multiple lifestyle preferences with strict exclusions.
* **Recommended Repair:** Ensure `RecommendationsPage.jsx` strictly enforces the 4-quadrant lifestyle matrix and renders restored product cards with match explanations and dietary emblems.
* **Tests Required:** Zero-preference empty state, single nutritional preference, multiple nutritional preferences, vegan-only, vegetarian-only, both, and strict allergen exclusion.

---

### 2.4 Master Catalog Neutrality & Global Strict Exclusions
* **Previously Working Behaviour:** Master Catalog homepage (`/`) remained strictly neutral: no personalized reordering or lifestyle filtering based on user nutritional preferences, with keyword search scoped to product names and brands (never ingredients), and global enforcement of strict allergen exclusions.
* **Current Broken Behaviour:** Functionality in `Storefront.jsx` was mostly compliant, but lacked dietary classification symbols on product cards.
* **Files Responsible:** `frontend/src/pages/Storefront.jsx`, `frontend/src/components/ProductCard.jsx`.
* **Root Cause:** Removal of classification badges from cards.
* **Recommended Repair:** Restore dietary emblems to cards and verify that searching "Milk" in Category 8 returns 0 products (search product name/brand only).
* **Tests Required:** Neutral catalog ordering with saved preferences, category isolation, empty category handling ("No results found"), and keyword search integrity.

---

### 2.5 Scoring Engine Integrity & Exact Additivity
* **Previously Working Behaviour:** Overall Quality Score $SC = 0.40N + 0.20I + 0.15P + 0.15PF + 0.10U$.
* **Current Broken Behaviour:** The 55 vs 56 rounding discrepancy was resolved in commit `8aac2b3`. Verified that $24 + 17 + 5 + 10 + 0 = 56$ exactly across all Catalog-500 and legacy SKUs.
* **Files Responsible:** `backend/services/scoringService.js`, `frontend/src/utils/productScoring.js`, `backend/services/novaAnalysisService.js`.
* **Recommended Repair:** Preserve exact additivity, maintain locked weights (40/20/15/15/10), ensure card and modal show identical scores, and ensure $U=0$ when inactive and calculated when active.
* **Tests Required:** Automated regression suite `backend/tests/scoringAdditivityAndParity.test.js` ($6/6$ passed).

---

## 3. Repair Roadmap

| Phase | Target Area | Planned Actions | Risk Level |
|---|---|---|---|
| **Phase 2** | Product Classification Symbols | Restore `<DietaryEmblem />` in `ProductCard.jsx` text area; verify non-image placement | Low |
| **Phase 3** | Comparison Engine | Complete `buildClientSideComparison` in `ComparePage.jsx`; fix `proteinFiber` / `proteinFibre` key aliases; verify 11 nutrients, allergens, and best product analysis | Medium |
| **Phase 4** | Recommendation Engine | Verify `/recommendations` against 4-quadrant lifestyle matrix, strict exclusions, and match explanations | Low |
| **Phase 5** | Master Catalog | Verify neutrality, keyword search name/brand scoping, and empty category handling | Low |
| **Phase 6** | Scoring Engine | Maintain exact integer additivity, locked weights, and numerical confidence scores | Low |
| **Phase 8** | Regression Testing | Execute backend tests and Vite production build | Low |
| **Phase 9** | Completion Report | Author `SMARTCHOICE_RESTORATION_REPORT.md` | Low |

---

## 4. Phase 1 Audit Conclusion

The repository state is well-understood. A dedicated recovery branch (`restoration-backup-20261116`) has been created. The changes needed are surgical, preserving all existing datasets and prior fixes while restoring lost UI emblems and strengthening the comparison engine's resilience.

**Proceeding to Phase 2 implementation.**
