# SmartChoice Advanced Product Comparison Engine — Implementation & Architecture Report

## 1. Executive Summary

This report documents the architectural design, algorithmic implementation, and testing of the **SmartChoice Advanced Product Comparison Engine**.

The engine transforms the previous simple comparison table into an evidence-based multi-attribute analytical system that evaluates 2 or more products simultaneously across:
- **Product Overview & Identity** (Stable product ID, brand, pack size, FSSAI verification status, dietary mark).
- **Nutritional Comparison** (11 standardized FSSAI nutritional metrics, basis normalization, pairwise differential calculations, higher/lower betterness annotations).
- **Ingredient Comparison Engine** (Shared vs. unique ingredients, identified additives with INS numbers, functional additive classes, clean-label evaluation).
- **Statutory Allergen Matrix** (Gluten, Milk, Peanuts, Tree Nuts, Soy, Egg, Fish, Crustaceans, Sulphites with strict 4-state distinction: `CONTAINS`, `MAY_CONTAIN`, `VERIFIED_ABSENCE`, `UNKNOWN`).
- **Score Comparison** (Authoritative Quality Score $SC = 0.40N + 0.20I + 0.15P + 0.15PF + 0.10U$, numerical Confidence Score $0.45Nr + 0.35Ir + 0.20Pr$, Completeness %, Verification %, and Personalized Match %).
- **Product Similarity Analysis** (Pairwise calculation using $SIM = 0.40C + 0.20T + 0.15S + 0.15I + 0.10N$).
- **SmartChoice Comparison Verdict** (Deterministic identification of the Best Overall Product with exhaustive pairwise comparative explanations against each alternative, or clear uncertainty disclosures).

---

## 2. Core Comparison Modules & Technical Specifications

### 2.1 Standardized Nutritional Comparison & Difference Engine
Evaluates all 11 core statutory FSSAI nutrient metrics:
1. **Energy** (`calories`, kcal) — *Lower is better* (general health context).
2. **Protein** (`protein`, g) — *Higher is better*.
3. **Total Carbohydrates** (`carbohydrates`, g) — *Contextual / neutral*.
4. **Total Sugars** (`sugar`, g) — *Lower is better*.
5. **Added Sugars** (`addedSugars`, g) — *Lower is better*.
6. **Total Fat** (`fat`, g) — *Contextual / neutral*.
7. **Saturated Fat** (`saturatedFat`, g) — *Lower is better*.
8. **Trans Fat** (`transFat`, g) — *Lower is better*.
9. **Dietary Fibre** (`fiber`, g) — *Higher is better*.
10. **Sodium** (`sodium`, mg) — *Lower is better*.
11. **Salt** (`salt`, g) — *Lower is better* (calculated as $(\text{sodium} \times 2.5) / 1000$ where not independently reported).

**Measurement Basis Normalization:**
- All solid food products are compared on a normalized **per 100g** basis.
- All beverage and liquid products are compared on a normalized **per 100ml** basis.
- Serving-level values are accessible via a dedicated view toggle without conflating per-100g metrics.
- Missing nutrient fields are displayed as explicit `N/A` indicators; values are never fabricated.

### 2.2 Ingredient & Additive Comparison Engine
- **Token Predominance Analysis:** Tokenizes raw ingredient declarations and parses parentheses.
- **Shared vs. Unique Sets:** Computes intersection ($\bigcap$) and disjoint sets ($\Delta$) across all selected products.
- **INS Additive Parser:** Regular-expression scanner identifying statutory codes (`INS \d+[a-z]?(\([a-z0-9]+\))?` and `E\d+`).
- **Functional Classification:** Maps additives to statutory classes (Emulsifier, Preservative, Colour, Acidity Regulator, Leavening Agent, Sweetener, Antioxidant, Stabilizer/Thickener).
- **Formulation Cleanliness:** Flags synthetic colours, chemical preservatives, and artificial sweeteners.

### 2.3 Statutory Allergen Comparison Matrix
Evaluates the 9 mandatory FSSAI allergen groups across a 4-state evidentiary continuum:
1. `CONTAINS` (Red): Confirmed in formulation or mandatory declaration.
2. `MAY_CONTAIN` (Amber): Declared under precautionary cross-contact advisory.
3. `VERIFIED_ABSENCE` (Emerald): Confirmed absent based on laboratory verification or certified allergen-free single ingredient.
4. `UNKNOWN` (Slate): Allergen data unverified or undeclared.

**Allergen Safety Priority:** If active user preferences include `avoidAllergens`, any product containing the forbidden allergen is flagged with `hardExclusionViolated = true`, disqualified from the winner verdict, and highlighted with safety exclusion banners.

### 2.4 SmartChoice Comparison Verdict Algorithm
1. **Safety Filter:** Eliminate products violating user allergen constraints.
2. **Candidate Evaluation:** Rank remaining eligible products primarily by base SmartChoice Quality Score ($SC$).
3. **Evidence & Confidence Gating:**
   - If the top product has a low Confidence Score ($< 50$) while a close alternative has high Confidence ($\ge 80$), the verified alternative is selected.
   - If products are within 2 points and carry conflicting data (`Needs Review`), the verdict reports `INCONCLUSIVE` (*"Insufficient evidence to determine a clear winner"*).
4. **Pairwise Comparative Generation:** For the selected winner, generates exhaustive comparative explanations against every other product in the comparison shortlist, detailing exact nutrient differentials ($+X\text{g}$ protein, $-Y\text{g}$ sugar), additive count differences, and NOVA processing level distinctions.

---

## 3. Frontend Responsive Design & Layout (Part 9 Compliance)

Structured into 10 dedicated sections in `frontend/src/pages/ComparePage.jsx`:
1. **Selected Products Strip:** Quick overview with count, Clear button, and Add More shortcut.
2. **Product Overview:** Side-by-side cards with packshot SVG fallback, brand, name, category, pack size, ID, and verification badge.
3. **SmartChoice Comparison Verdict:** Prominent verdict banner with Trophy/Award icon, best product highlight, evidence-based reasoning, and pairwise outperformance breakdowns.
4. **Nutrient & Ingredient Betterness Summary:** Summary matrix showing each product's win/loss/tie count for nutrients and clean-label badges.
5. **Score Comparison:** Quality Score (/100) with complete 5-part statutory weights ($0.40N, 0.20I, 0.15P, 0.15PF, 0.10U$), numerical Confidence Score, Completeness %, Verification %, and Personalized Match %.
6. **FSSAI Nutritional Comparison Table:** All 11 nutrients with best-value highlights, difference annotations, and Per 100g / Per Serving toggle.
7. **Ingredient Comparison Engine:** Shared ingredients pills, unique ingredients pills, identified INS additives, and complete ingredient statements.
8. **Statutory Allergen Matrix:** 4-state statutory matrix across all 9 allergens.
9. **Processing & Formulation (NOVA):** NOVA Groups 1 through 4 with descriptions.
10. **Pairwise Product Similarity Analysis:** $SIM = 0.40C + 0.20T + 0.15S + 0.15I + 0.10N$ with component breakdown and shared/differing traits.

**Responsive Architecture:**
- All comparison grids and tables utilize `overflow-x-auto` with flexible min-width columns (`minmax(220px, 1fr)`).
- Seamless horizontal scrolling on mobile and tablet viewports without truncating or breaking the desktop layout.
- Supports 2, 3, 4, or 5 products simultaneously.

---

## 4. Verification & Production Build Status

- **Automated Test Suite:** `backend/tests/advancedComparisonEngine.test.js` passes 11/11 tests (100%).
- **Production Build:** `npm --prefix frontend run build` compiled client bundle in 1.18s with 0 errors.
- **Backward Compatibility:** All existing routes, contexts, and components remain intact.
