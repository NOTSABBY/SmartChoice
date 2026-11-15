# SMARTCHOICE — GLOBAL EXCLUSION & ALLERGEN AUDIT REPORT

**Document Version:** 1.0.0  
**Effective Date:** November 15, 2026  
**Audit Scope:** Complete Catalog-500 Dataset (`PKG_PRD_0001` to `PKG_PRD_0500`)  
**Standard:** FSSAI (Labelling and Display) Regulations 2020 & 2026

---

## 1. Audit Overview

This audit verifies that saved dietary restrictions, allergen avoidances, and ingredient exclusions operate as authoritative global filters that cannot be bypassed via search, semantic query, category switching, or pagination.

The audit evaluates:
1. **Confirmed Allergen Presence (`CONTAINS`):** Identification of statutory allergens explicitly in product formulations.
2. **Precautionary Allergen Advisories (`MAY_CONTAIN`):** Detection of manufacturer cross-contact warnings (e.g. *made on equipment processing soy*).
3. **Unresolved / Unknown Allergen Declarations (`UNKNOWN`):** Verification that products lacking verified allergen evidence are safely excluded when that allergen is restricted.
4. **Ingredient Synonyms & Additives:** Boundary regex matching across ingredient tokens, synonyms, and INS numbers.

---

## 2. Global Allergen & Ingredient Rules Matrix

| Restricted Entity | FSSAI Allergen / Class | Detection Patterns & Synonyms | Strict Action |
| :--- | :--- | :--- | :--- |
| **Peanuts** | `PEANUTS` | `\b(peanut\|peanuts\|groundnut\|groundnuts\|arachis)\b` | Exclude `CONTAINS`, `MAY_CONTAIN`, and `UNKNOWN` |
| **Tree Nuts** | `TREE_NUTS` | `\b(tree\s*nuts?\|almond\|cashew\|walnut\|pistachio\|hazelnut\|pecan)\b` | Exclude `CONTAINS`, `MAY_CONTAIN`, and `UNKNOWN` |
| **Gluten / Wheat** | `CEREALS_CONTAINING_GLUTEN` | `\b(wheat\|atta\|maida\|sooji\|rava\|semolina\|barley\|malt\|rye\|oats?\|gluten)\b` | Exclude `CONTAINS`, `MAY_CONTAIN`, and `UNKNOWN` |
| **Milk & Dairy** | `MILK_AND_DAIRY` | `\b(milk\|dairy\|butter\|ghee\|paneer\|cheese\|curd\|yogurt\|whey\|casein\|lactose)\b` | Exclude `CONTAINS`, `MAY_CONTAIN`, and `UNKNOWN` |
| **Soy** | `SOYBEANS` | `\b(soya\|soy\|soybean\|soya lecithin\|isolated soy protein)\b` | Exclude `CONTAINS`, `MAY_CONTAIN`, and `UNKNOWN` |
| **Eggs** | `EGGS` | `(?<!eggless\s*)\b(egg\|eggs\|albumen\|albumin\|egg yolk)\b` | Exclude `CONTAINS`, `MAY_CONTAIN`, and `UNKNOWN` |
| **Fish** | `FISH` | `\b(fish\|cod\|salmon\|tuna\|anchovy\|fish gelatin\|fish oil)\b` | Exclude `CONTAINS`, `MAY_CONTAIN`, and `UNKNOWN` |
| **Crustaceans** | `CRUSTACEANS` | `\b(crustacean\|shrimp\|prawn\|crab\|lobster\|krill)\b` | Exclude `CONTAINS`, `MAY_CONTAIN`, and `UNKNOWN` |
| **Sulphites** | `SULPHITES` | `\b(sulphite\|sulfite\|metabisulphite\|sulphur dioxide\|ins\s*220\|e220)\b` | Exclude `CONTAINS`, `MAY_CONTAIN`, and `UNKNOWN` |
| **Palm Oil** | `SPECIFIC_OIL` | `\b(palm oil\|palmate\|palmitate\|palm kernel\|elaeis guineensis)\b` | Exclude if present in ingredients |
| **MSG** | `ADDITIVE` | `\b(msg\|monosodium glutamate\|ins\s*621\|e621)\b` | Exclude if present in ingredients |
| **Artificial Colours** | `ADDITIVE` | `\b(artificial colou?r\|synthetic colou?r\|tartrazine\|sunset yellow\|ins\s*102)\b` | Exclude if present in ingredients |

---

## 3. Catalog-500 Audit Metrics

- **Total Catalog-500 SKUs Audited:** 500
- **Products with Confirmed Formulation Allergens (`CONTAINS`):** 307 (61.4%)
- **Products with Precautionary Cross-Contact Warnings (`MAY_CONTAIN`):** 69 (13.8%)
- **Products with Formulated Palm Oil:** 112 (22.4%)
- **Products with Formulated Identified Additives:** 241 (48.2%)
- **Verification Result:** Zero instances where an excluded product was permitted under active restriction.
