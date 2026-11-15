# SMARTCHOICE — STRICT EXCLUSION & DIETARY LIFESTYLE TEST RESULTS

## 1. Test Execution Summary

| Test ID | Test Description | Status | Evidence / Verification Notes |
|---|---|:---:|---|
| **Test A** | Strict Allergen Exclusion (`peanuts, milk`) | **PASS** | Products containing or declaring peanuts or milk are eliminated across all categories in both Master Catalog and Recommendation Engine. Precautionary `May contain` and unverified declarations are strictly excluded. |
| **Test B** | Strict Ingredient Exclusion (`palm oil, MSG`) | **PASS** | Products containing palm oil, palmolein, MSG, or INS 621 are eliminated across both pages. Products with missing ingredient lists are barred under strict policy. |
| **Test C** | Multiple Exclusions with OR Logic | **PASS** | A product violating ANY one of the entered allergen or ingredient exclusions is excluded once. Safe products with verified absence of all items are preserved. |
| **Test D** | Vegetarian Only in Recommendation Engine | **PASS** | Only verified `VEGETARIAN` products appear. `VEGAN`, `NON_VEGETARIAN`, and `UNKNOWN` are excluded. Master Catalog remains completely unaffected and neutral. |
| **Test E** | Vegan Only in Recommendation Engine | **PASS** | Only verified `VEGAN` products appear. `VEGETARIAN` (dairy/honey), `NON_VEGETARIAN`, and `UNKNOWN` are excluded. Master Catalog remains unaffected. |
| **Test F** | Both Vegetarian and Vegan Selected | **PASS** | Both verified `VEGETARIAN` and `VEGAN` products appear. `NON_VEGETARIAN` and `UNKNOWN` products are excluded. Master Catalog remains unaffected. |
| **Test G** | Neither Selected (OFF, OFF) | **PASS** | All dietary classifications are eligible, subject only to active allergen and ingredient exclusions. |
| **Test H** | Category Coverage & Semantic Search Scope | **PASS** | Category isolation strictly maintained (e.g. Category 1 returns only Biscuits). Calling semantic search from Master Catalog enforces neutral scope, while calling from Recommendation Engine enforces dietary lifestyle rules. |
| **Test I** | Ingredient-Based Product Classification Audit | **PASS** | All 500 Catalog-500 products audited against ingredient lists and allergen declarations (270 Vegan, 214 Vegetarian, 16 Non-Veg). 500 legacy products audited (174 Vegan, 231 Vegetarian, 7 Non-Veg, 88 Unknown). |

---

## 2. Automated Test Suite Output
```
▶ SMARTCHOICE FINAL DIETARY CLASSIFICATION, PREFERENCE & STRICT EXCLUSION TEST SUITE
  ▶ Test A: Strict Allergen Exclusion ("peanuts, milk")
    ✔ excludes products containing or declaring peanuts or milk across all categories in both Master Catalog and Recommendation Engine (1.4ms)
    ✔ conservatively excludes MAY CONTAIN allergen cross-contact declarations (0.2ms)
    ✔ excludes products with unresolved UNKNOWN allergen declarations where absence cannot be verified (0.2ms)
  ✔ Test A: Strict Allergen Exclusion ("peanuts, milk") (2.6ms)
  ▶ Test B: Strict Ingredient Exclusion ("palm oil, MSG")
    ✔ excludes products containing palm oil or MSG across both pages (0.5ms)
    ✔ excludes products with incomplete or missing ingredient lists under strict ingredient exclusion policy (0.1ms)
  ✔ Test B: Strict Ingredient Exclusion ("palm oil, MSG") (0.9ms)
  ▶ Test C: Multiple Exclusions with OR Logic
    ✔ excludes a product if it contains ANY one of the avoided allergens OR excluded ingredients (0.3ms)
  ✔ Test C: Multiple Exclusions with OR Logic (0.4ms)
  ▶ Test D: Vegetarian Selected Alone in Recommendation Engine
    ✔ shows VERIFIED VEGETARIAN products in Recommendation Engine (0.2ms)
    ✔ excludes VEGAN products under application Vegetarian-only classification rule (0.1ms)
    ✔ excludes NON_VEGETARIAN products (0.1ms)
    ✔ excludes UNKNOWN dietary products (0.2ms)
    ✔ does NOT affect Master Catalog (Master Catalog remains neutral to Vegetarian selection) (0.2ms)
  ✔ Test D: Vegetarian Selected Alone in Recommendation Engine (1.1ms)
  ▶ Test E: Vegan Selected Alone in Recommendation Engine
    ✔ shows VERIFIED VEGAN products in Recommendation Engine (0.1ms)
    ✔ excludes VEGETARIAN products (dairy, honey, animal derivatives) (0.1ms)
    ✔ excludes NON_VEGETARIAN products (0.1ms)
    ✔ excludes UNKNOWN dietary products (0.1ms)
    ✔ does NOT affect Master Catalog (Master Catalog remains neutral to Vegan selection) (0.1ms)
  ✔ Test E: Vegan Selected Alone in Recommendation Engine (0.7ms)
  ▶ Test F: Both Vegetarian and Vegan Selected
    ✔ shows VERIFIED VEGAN products (0.1ms)
    ✔ shows VERIFIED VEGETARIAN products (0.1ms)
    ✔ excludes NON_VEGETARIAN products (0.1ms)
    ✔ excludes UNKNOWN dietary products (0.1ms)
    ✔ does NOT affect Master Catalog (0.1ms)
  ✔ Test F: Both Vegetarian and Vegan Selected (0.7ms)
  ▶ Test G: Neither Selected (OFF, OFF)
    ✔ applies no dietary lifestyle restrictions; allows all classifications subject to strict exclusions (0.1ms)
  ✔ Test G: Neither Selected (OFF, OFF) (0.2ms)
  ▶ Test H: Search, Semantic Search & Category Coverage
    ✔ enforces strict category isolation during semantic search (10.5ms)
    ✔ enforces strict exclusions globally during semantic search in Master Catalog (13.4ms)
    ✔ enforces dietary lifestyle rules during semantic search in Recommendation Engine (9.8ms)
  ✔ Test H: Search, Semantic Search & Category Coverage (33.8ms)
  ▶ Test I: Ingredient-Based Product Classification Audit
    ✔ verifies that all 500 catalog products have authoritative dietary classifications backed by ingredient evidence (3.6ms)
  ✔ Test I: Ingredient-Based Product Classification Audit (3.7ms)
✔ SMARTCHOICE FINAL DIETARY CLASSIFICATION, PREFERENCE & STRICT EXCLUSION TEST SUITE (45.1ms)
ℹ tests 26
ℹ suites 10
ℹ pass 26
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

---

## 3. Production Build Status
```
✓ 2039 modules transformed.
dist/index.html                   0.50 kB │ gzip:   0.32 kB
dist/assets/index-DG1q36Dg.css   82.08 kB │ gzip:  13.34 kB
dist/assets/index-5L3rSp9t.js   922.33 kB │ gzip: 269.42 kB
✓ built in 1.41s (0 errors)
```
