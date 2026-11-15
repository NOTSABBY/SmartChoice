# SmartChoice — Product Data Corruption Root Cause Analysis Report

## Executive Summary

During the complete catalogue-wide data integrity audit, systematic data corruption and field misalignments were detected across Catalog-500 and legacy retail records.

The investigation traced the root cause back through the data pipeline:
`Frontend Presentation` -> `API Response` -> `catalogLoader.js` -> `enriched_catalog_500.json` -> `applyAuthoritativeIngredientCorrections.js` -> `buildCatalog500VerifiedData.js`.

---

## 1. Primary Failure Patterns Identified

### Pattern A: Off-by-One and Index-Shifted Correction Dictionaries
- **Responsible Code**: `backend/scripts/applyAuthoritativeIngredientCorrections.js` lines 2736–2754 and Category 10 / Category 19 loops.
- **Mechanism**: A batch correction script was authored using dictionary keys where product IDs were shifted by 1 to 3 positions relative to the ground-truth inventory (`backend/data/products_inventory_500.csv`).
- **Observed Symptoms**:
  1. **Hershey's Cocoa Powder Unsweetened (`PKG_PRD_0363`)**: Was mapped to Bluebird Dry Yeast (`https://bluebirdfoods.com/products/dry-yeast`), inheriting 45g protein per 100g and yeast ingredients (`Yeast (Saccharomyces cerevisiae), Emulsifier INS 491`).
  2. **Weikfield Baking Powder (`PKG_PRD_0361`)**: Was mapped to Cadbury Cocoa Powder (`https://www.cadbury.co.in/cocoa-powder`).
  3. **Blue Bird Baking Soda (`PKG_PRD_0362`)**: Was mapped to Weikfield Baking Powder.
  4. **Urban Platter Pure Vanilla Extract (`PKG_PRD_0364`)**: Was mapped to Hershey's Chocolate Chips.
  5. **Category 10 Spices (`PKG_PRD_0181` to `PKG_PRD_0194`)**: MDH Chat Masala was assigned pure Turmeric powder; Everest Garam Masala was assigned Deggi Mirch; Catch Red Chilli was assigned Coriander seeds; Tata Sampann Turmeric was assigned Cumin powder.
  6. **Canned Foods (`PKG_PRD_0381` & `PKG_PRD_0382`)**: Del Monte Sweet Corn was assigned Knorr Mixed Vegetable Soup; Heinz Baked Beans was assigned Sweet Corn Soup.
  7. **Dry Fruits (`PKG_PRD_0350`)**: Happilo Whole Cashews was assigned California Prunes.

---

### Pattern B: Stale Parsed Object Array Desynchronization
- **Mechanism**: Previous correction scripts updated `p.nutrition_info.ingredients_text` and `p.ingredients.rawText`, but failed to re-parse or update the structured token array `p.ingredients.ingredients`.
- **Observed Symptoms**:
  - In Mother Dairy Ultimate Cow Ghee (`PKG_PRD_0208`) and other ghee SKUs (`PKG_PRD_0206` - `PKG_PRD_0220`), the raw text declared "Milk Fat (Pure Cow Ghee)", but the structured `p.ingredients.ingredients[0]` remained `"Pure Refined Edible Vegetable Oil (Fortified with Vitamin A & Vitamin D as per FSSAI Standards)"`.
  - In Prabhuji Pure Ghee Soan Papdi (`PKG_PRD_0288`), the structured array retained stale vegetable oil tokens.

---

### Pattern C: Archetype Boilerplate Copy-Paste Clusters
- **Mechanism**: During early project initialization, whole categories of products with missing initial research data were seeded with identical archetype strings:
  1. **Category 13 (Dairy & Cheese)**: 15 products (including Mother Dairy Paneer, Nandini Toned Milk, and Epigamia Greek Yogurt) inherited Processed Cheese Slice boilerplate with microbial rennet and emulsifying salts.
  2. **Category 14 (Health Drinks)**: 18 products (including Protinex and Ensure) inherited Horlicks/Bournvita malted barley boilerplate.
  3. **Category 18 (Dry Fruits)**: 11 products inherited `"100% Selected Premium Grade Whole Almonds / Cashews / Walnuts (Naturally Vacuum Packed)"`.
  4. **Category 20 (Canned Foods)**: Del Monte Pineapple Slices and Fruit Cocktail inherited tomato paste and vegetable soup boilerplate.
  5. **Category 25 (Frozen Foods)**: Veggie Fingers, Aloo Tikki, Smiles, and Burger Patty inherited French Fries potato flakes boilerplate.

---

### Pattern D: Nutrition Profile Swaps from Adjacent Rows
- **Mechanism**: When copy-pasting scraped data tables, row values from adjacent products were applied:
  - **Pintola High Protein Peanut Butter (`PKG_PRD_0138`)**: Received Fruit Jam nutrition (0.5g protein, 71g carbohydrates, 66g sugar).
  - **MyFitness Honey Peanut Butter (`PKG_PRD_0139`)**: Received Fruit Jam nutrition (0.5g protein).
  - **Pintola Organic Peanut Butter (`PKG_PRD_0132`)**: Received 14g added sugar for 100% pure organic peanuts.
  - **Nescafe Classic Instant Coffee (`PKG_PRD_0166`)**: Received 10g saturated fat against 1g total fat.

---

### Pattern E: Premature 100% Verification Badge Assignment
- **Mechanism**: The verification engine considered a product 100% verified if `p.nutrition_info.verification_status === 'VERIFIED'`, regardless of whether the fields were supported by manufacturer evidence or had internal macro/identity conflicts.
- **Remediation**: Implemented strict conflict checking and field-level provenance status (`VERIFIED_LABEL`, `VERIFIED_MANUFACTURER`, `SOURCE_REPORTED`, `ESTIMATED`, `NEEDS_REVIEW`).

---

## 2. Code Files and Datasets Modified

1. `frontend/public/data/enriched_catalog_500.json`: Authoritative 500-product dataset permanently repaired.
2. `data/processed/products_india.json`: Legacy retail products dataset standardized.
3. `backend/utils/productVerification.js`: Added conflict guards for cocoa vs yeast, ghee vs vegetable oil, and macro plausibility.
4. `backend/utils/nutritionConversion.js`: Validated statutory solid and liquid per-serving conversion formulas.
5. `backend/services/ingredientParsingService.js`: Enforced structured token re-parsing across all products.

---

## 3. Prevention & Safe Import Architecture

1. **Idempotent Imports**: Imports check field-level source precedence and never overwrite `VERIFIED_LABEL` fields with unverified bulk data.
2. **Mandatory Token Synchronization**: Structured ingredient arrays must always be re-tokenized from the authoritative raw text.
3. **Macro Plausibility Gate**: Automated unit tests assert:
   - Saturated fat $\le$ Total fat
   - Total sugars $\le$ Total carbohydrates
   - $E \approx 4P + 4C + 9F$ within physiological bounds.
