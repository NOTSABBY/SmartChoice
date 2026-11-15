# SMARTCHOICE — GLOBAL DIETARY FILTER TEST RESULTS

**Test Run Date:** November 15, 2026  
**Test Suite:** `backend/tests/globalDietaryAndSemanticSearch.test.js`  
**Execution Environment:** Node.js v24.21.0 / Windows 11  
**Target Dataset:** Catalog-500 (500 SKUs)

---

## 1. Summary of Execution

All automated dietary filter test cases executed with **100% PASS** rate (31/31 assertions passed).

```
✔ applies no dietary restrictions when neither Vegetarian nor Vegan is selected (1.06ms)
✔ enforces Vegetarian filter: permits verified VEGETARIAN/VEGAN and excludes NON_VEGETARIAN (0.21ms)
✔ enforces Vegan filter: permits verified VEGAN only and excludes non-vegan vegetarians and non-vegetarians (0.19ms)
✔ applies stricter Vegan restriction when both Vegetarian and Vegan are selected (0.15ms)
✔ excludes UNKNOWN dietary status under strict dietary lifestyle rules (0.19ms)
```

---

## 2. Test Scenarios and Results

### Scenario 1: Neither Vegetarian nor Vegan Selected
- **Action:** `evaluateProductEligibility(product, {})`
- **Expected:** All 500 catalog items eligible.
- **Observed:** 500 / 500 eligible (100%).
- **Status:** **PASS**

### Scenario 2: Vegetarian Filter Active
- **Action:** `evaluateProductEligibility(product, { vegetarian: true })`
- **Expected:** Only verified `VEGETARIAN` or `VEGAN` products allowed. All 10 non-vegetarian products excluded.
- **Observed:** 
  - Eligible Products: 490 (98.0%)
  - Excluded Products: 10 (2.0%) (e.g. `PKG_PRD_0234` Kitchens of India Chicken Darbari, `PKG_PRD_0394` Maggi Hot Cup Chicken Soup).
- **Status:** **PASS**

### Scenario 3: Vegan Filter Active
- **Action:** `evaluateProductEligibility(product, { vegan: true })`
- **Expected:** Only 100% plant-based certified `VEGAN` products allowed. Non-vegetarian products and dairy/honey vegetarian products excluded.
- **Observed:**
  - Eligible Products: 321 (64.2%)
  - Excluded Products: 179 (35.8%) (10 non-veg + 169 dairy/egg/animal derivative products).
- **Status:** **PASS**

### Scenario 4: Both Vegetarian and Vegan Selected
- **Action:** `evaluateProductEligibility(product, { vegetarian: true, vegan: true })`
- **Expected:** Stricter Vegan rule automatically resolves without contradiction.
- **Observed:** Exactly 321 products eligible (identical to Vegan alone). Zero non-vegan vegetarian items permitted.
- **Status:** **PASS**

### Scenario 5: Unverified / Unknown Dietary Status Handling
- **Action:** Synthetic test item with `status: 'UNKNOWN'`, `isVegetarian: false`, `isVegan: false`.
- **Expected:** Ineligible under both Vegetarian and Vegan rules.
- **Observed:** Excluded with explicit reason (`"Vegetarian status is unverified or unknown"` / `"Vegan status is unverified or unknown"`).
- **Status:** **PASS**

---

## 3. UI and Cross-Page Integrity
- **Master Catalog:** Non-vegetarian and non-vegan items properly disappear from catalog grid upon saving preferences. Informational banner shows exact count of excluded products.
- **Recommendation Engine:** Only eligible products are ranked; non-eligible items never appear in the recommendations cards.
- **Sorting Neutrality:** Master Catalog default sort remains strictly based on objective Quality Score (`calculatedScore`) and is never corrupted by nutritional ranking preferences.
