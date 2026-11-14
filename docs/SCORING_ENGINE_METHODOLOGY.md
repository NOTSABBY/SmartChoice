# Scoring Engine Methodology

## 1. Statutory Invariant Scoring Weights
SmartChoice scores food products using a deterministic linear combination of five component scores normalized to a 0–100 scale:

$$SC = (0.40 \times \text{Nutrition}) + (0.20 \times \text{Ingredients}) + (0.15 \times \text{Processing}) + (0.15 \times \text{Protein/Fibre}) + (0.10 \times \text{User Preferences})$$

All component scores are clamped strictly between 0 and 100 before applying weights.

## 2. Category-Aware Nutrition Scoring
- **Solid Foods & Beverages:** Sugar, Saturated Fat, and Sodium evaluated against UK FSA / WHO SEARO / FSSAI contiguous thresholds.
- **Cooking Oils & Pure Fats:** Sugar and Sodium are legitimately unclassified. Only Saturated Fat is scored. No penalties are assessed for unclassified nutrients.
- **Dairy Beverages:** Intrinsic lactose allowance accounted for (up to 4.8g/100ml lactose).

## 3. Ingredient & Additive Scoring
- Evaluates verified additives and cosmetic markers (flavor enhancers INS 621/627/631, non-nutritive sweeteners, synthetic dyes).
- Unparsed text receives a modest uncertainty penalty, while verified clean ingredients receive optimal scores.

## 4. Processing (NOVA) Scoring
- NOVA 1: 100
- NOVA 2: 80
- NOVA 3: 60
- NOVA 4: 30
- Insufficient data: 50 (neutral baseline, not penalized or inflated).

## 5. Protein and Fibre Scoring
- Evaluated against statutory benchmarks (FSSAI Advertising & Claims Regulations 2019) without universal hardcoded RDA baselines.

## 6. Allergen Hard Constraints
- User allergen exclusions (e.g., avoided nuts, gluten, milk) act as HARD CONSTRAINTS.
- If an allergen matches in parsed ingredients or declared classes, the overall product score drops to 0 immediately with an explicit safety rationale.