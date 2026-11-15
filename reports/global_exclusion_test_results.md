# SMARTCHOICE — GLOBAL EXCLUSION & ALLERGEN TEST RESULTS

**Test Run Date:** November 15, 2026  
**Test Suite:** `backend/tests/globalDietaryAndSemanticSearch.test.js`  
**Execution Environment:** Node.js v24.21.0 / Windows 11  
**Target Dataset:** Catalog-500 (500 SKUs)

---

## 1. Summary of Execution

All automated strict exclusion test cases executed with **100% PASS** rate.

```
✔ strictly excludes products with confirmed CONTAINS allergen evidence (0.55ms)
✔ conservatively excludes products with MAY CONTAIN advisory declarations (0.44ms)
✔ excludes products with unresolved UNKNOWN allergen declarations where absence cannot be verified (0.35ms)
✔ excludes products containing excluded ingredients using synonym and boundary matching (Palm Oil) (0.32ms)
✔ matches additive INS numbers and synonyms for MSG and artificial colours (0.39ms)
✔ excludes products with incomplete ingredient information under strict exclusion policy (0.13ms)
```

---

## 2. Test Scenarios and Results

### Scenario 1: Confirmed Formulation Allergen (`CONTAINS`)
- **Condition:** User excludes `peanuts`.
- **Target SKU:** `PKG_PRD_0284` Balaji Masala Sev Murmura (formulation contains 4% peanuts).
- **Result:** `eligible: false`, reason: `"Excluded by strict allergen policy: Confirmed presence of avoided allergen \"peanuts\"."`
- **Status:** **PASS**

### Scenario 2: Advisory Allergen Declaration (`MAY_CONTAIN`)
- **Condition:** User excludes `soy`. Product has `"May contain traces of soy and peanuts"` in facility warning.
- **Target SKU:** Synthetic advisory cracker item.
- **Result:** `eligible: false`, reason: `"Excluded by strict allergen policy: Advisory cross-contact warning (May Contain) for avoided allergen \"soy\"."`
- **Status:** **PASS**

### Scenario 3: Unresolved Unknown Allergen Declarations
- **Condition:** User excludes `gluten`. Product has empty/unverified allergen declaration status (`UNKNOWN`).
- **Result:** `eligible: false`, reason: `"Excluded by strict allergen policy: Allergen declaration is unverified/unknown for \"gluten\"; absence cannot be confirmed."`
- **Status:** **PASS** (Zero unverified items silently classified as safe).

### Scenario 4: Excluded Ingredients with Synonym Expansion (Palm Oil)
- **Condition:** User excludes `palm oil`.
- **Target SKU:** `PKG_PRD_0001` Parle-G (contains "Edible Vegetable Oil (Palmolein)").
- **Result:** `eligible: false`, reason: `"Excluded by strict ingredient policy: Contains excluded ingredient or synonym \"palm oil\"."`
- **Status:** **PASS**

### Scenario 5: Additive INS Codes (MSG & Synthetic Colours)
- **Condition:** User excludes `msg` or `artificial color`.
- **Target SKU:** Items declaring `INS 621` or `Tartrazine (INS 102)`.
- **Result:** `eligible: false`, correctly mapped to MSG and Artificial Colours respectively.
- **Status:** **PASS**

### Scenario 6: Incomplete Ingredient Information under Strict Policy
- **Condition:** User specifies excluded ingredients, but product ingredient list is empty or unavailable.
- **Result:** `eligible: false`, reason: `"Excluded by strict ingredient exclusion: Ingredient formulation is incomplete/unavailable for verification."`
- **Status:** **PASS**

---

## 3. Cross-Page Non-Bypassability Verification
- **Semantic Search:** When `avoidAllergens: ['peanuts']` is active, querying for *"Healthy snacks"* automatically filters out peanut-containing items, promoting safe alternatives (e.g., `PKG_PRD_0281` Haldiram's Moong Dal Fried).
- **Category Switching:** Excluded items remain excluded regardless of which category is clicked.
- **Pagination:** Excluded items are filtered prior to pagination slicing, preventing them from reappearing on page 2 or beyond.
