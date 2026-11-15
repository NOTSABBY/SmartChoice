# SmartChoice Preference Ranking & Personalization Test Results

**Date of Execution**: November 15, 2026  
**Test Suite**: `backend/tests/preferenceRankingConsistency.test.js` & `backend/tests/dynamicRecommendationEngine.test.js`  
**Execution Status**: **PASS (100% Deterministic Parity Verified)**  

---

## 1. Single Preference Exact Parity Audit

The SmartChoice specification dictates that when exactly one nutritional goal is active, the `SmartChoice Recommended` sorting option must produce the exact same product sequence as selecting that individual nutritional sort directly.

| Active Nutritional Goal | Equivalent Sort Key | Canonical Sorting Comparator | Match Status |
| :--- | :--- | :--- | :--- |
| **High Protein** | `protein_desc` | `singlePreferenceComparators.highProtein` | **EXACT MATCH (100%)** |
| **Low Calories** | `calories_asc` | `singlePreferenceComparators.lowCalories` | **EXACT MATCH (100%)** |
| **Low Sugar** | `sugar_asc` | `singlePreferenceComparators.lowSugar` | **EXACT MATCH (100%)** |
| **High Fibre** | `fiber_desc` | `singlePreferenceComparators.highFiber` | **EXACT MATCH (100%)** |
| **Low Sodium** | `sodium_asc` | `singlePreferenceComparators.lowSodium` | **EXACT MATCH (100%)** |
| **Low Saturated Fat** | `satfat_asc` | `singlePreferenceComparators.lowSaturatedFat` | **EXACT MATCH (100%)** |
| **Low Fat** | `fat_asc` | `singlePreferenceComparators.lowFat` | **EXACT MATCH (100%)** |

All 7 canonical single-preference comparisons verify that top products, tie-breakers, and category exclusions match identically between backend recommendation services and frontend client-side rendering.

---

## 2. Multi-Preference Dynamic Combination Testing

When multiple preferences are active simultaneously, the recommendation engine dynamically calculates a continuous synergy match score ($70\%\text{ Average} + 30\%\text{ Minimum}$). Products that strongly satisfy all goals rank ahead of products that excel in one while failing another.

### Verified Multi-Preference Combinations:
1. **High Protein + Low Calories**:
   - Products with high protein density and modest calories (e.g. pulses, soya, high-protein flour) rank ahead of energy-dense spreads (e.g. peanut butter at 625 kcal) and high-sugar sauces (e.g. tomato ketchup).
2. **High Protein + Low Sugar + High Fibre**:
   - Synergistic evaluation rewards whole grains and high-fibre protein bars while penalizing added sugar syrups.
3. **Low Fat + Low Calories + Low Sodium**:
   - Evaluates fat $\le 3\text{g}$, energy $\le 120\text{ kcal}$, and sodium $\le 120\text{ mg}$.
4. **Vegan + High Protein**:
   - Strictly filters for verified vegan formulations while maximizing plant protein content.

---

## 3. Discrepancy Resolution: Betty Crocker vs Knorr Soup

| Product Under Test | Protein (per 100g) | Previous Match Score | Corrected Match Score | Explanation |
| :--- | :--- | :--- | :--- | :--- |
| **Betty Crocker Chocolate Fudge Cake Mix (`PKG_PRD_0467`)** | `13.9 g` | `30%` (Bug) | **`85%`** (Corrected) | High protein content (13.9g/100g) satisfies high-protein preference. Analytical proximate sum ($107.6\text{g}$) no longer triggers false rejection. |
| **Knorr Chicken Delite Soup (`PKG_PRD_0397`)** | `13.6 g` | `84%` | **`84%`** | High protein content (13.6g/100g) satisfies high-protein preference. |

**Observation**: A 0.3g protein difference between the two products now results in an expected 1% score delta (85% vs 84%), resolving the previous 54% penalty distortion.

---

## 4. Category Format Constraints & Dietary Exclusions

1. **Beverage Infusions (Tea & Coffee Powders)**:
   - Evaluated on as-consumed brew basis ($<0.1\text{g protein/100ml}$). High protein score: `0%` (Status: `NO_MATCH`). Spent dry leaf biomass is not counted towards dietary protein intake.
2. **Condiments & Spices**:
   - Spices consumed in 1-5g pinches are not counted as significant dietary protein sources. High protein score: `0%` (Status: `NO_MATCH`).
3. **Cooking Oils & Ghee**:
   - Naturally contain 0g protein and 0g fiber. High protein and high fiber scores: `0%` (Status: `NO_MATCH`).
4. **Hard Allergen Exclusions**:
   - Any product containing an avoided allergen receives `Match Score: 0%`, `Final Score: 0`, is marked `isEligible: false`, and sorts deterministically to the bottom of recommendations.
