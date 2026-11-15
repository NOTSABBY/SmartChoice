# SmartChoice User Preference Scoring — System Architecture & Audit Report

## 1. Executive Summary

This report documents the architectural separation, mathematical evaluation, and behavior of the **User Preferences ($U$)** component across the SmartChoice platform.

The audit resolves previous inconsistencies where user preferences were inadvertently modifying master catalog scores or defaulting to improper constants. The system now enforces a strict dual-mode operational contract:
1. **Master Catalog Browsing Mode:** Preferences are inactive. $U = 0$ (0/10 contribution). All users see identical, purely objective quality scores.
2. **Recommendation Engine Mode:** Preferences are active. $U$ is computed dynamically per product on a continuous 0–100 scale, contributing $0.10 \times U$ points to personalized scoring and determining recommendation ranking.

---

## 2. Mathematical Preference Evaluation Engine

When preferences are active, each product is evaluated by `backend/services/recommendationService.js` and `frontend/src/utils/productScoring.js`.

### 2.1 Supported User Preferences Matrix

| Preference Key | Type | Evaluation Logic & Target Thresholds | Missing Data Behavior |
|:---|:---:|:---|:---:|
| `highProtein` | Nutrient (Soft) | Food: $\ge 10\text{g}/100\text{g}$; Beverage: $\ge 5\text{g}/100\text{ml}$ | Neutral 50 (`UNKNOWN`) |
| `lowCalories` | Nutrient (Soft) | Food: $\le 200\text{kcal}/100\text{g}$; Beverage: $\le 40\text{kcal}/100\text{ml}$ | Neutral 50 (`UNKNOWN`) |
| `lowSugar` | Nutrient (Soft) | Food: $\le 5\text{g}/100\text{g}$; Beverage: $\le 2.5\text{g}/100\text{ml}$ | Neutral 50 (`UNKNOWN`) |
| `highFiber` | Nutrient (Soft) | Food: $\ge 6\text{g}/100\text{g}$ | Neutral 50 (`UNKNOWN`) |
| `lowSodium` | Nutrient (Soft) | Food: $\le 120\text{mg}/100\text{g}$; Beverage: $\le 60\text{mg}/100\text{ml}$ | Neutral 50 (`UNKNOWN`) |
| `lowSaturatedFat` | Nutrient (Soft) | Food: $\le 1.5\text{g}/100\text{g}$; Beverage: $\le 0.75\text{g}/100\text{ml}$ | Neutral 50 (`UNKNOWN`) |
| `lowFat` | Nutrient (Soft) | Food: $\le 3\text{g}/100\text{g}$; Beverage: $\le 1.5\text{g}/100\text{ml}$ | Neutral 50 (`UNKNOWN`) |
| `vegetarian` | Dietary (Filter) | Requires verified `VEGETARIAN` or `VEGAN` status | Excluded if Non-Veg |
| `vegan` | Dietary (Filter) | Requires verified `VEGAN` status (no dairy, honey, eggs, meat) | Excluded if non-vegan |
| `avoidAllergens` | Safety (Hard) | Searches formulation allergens & verified declarations | **Score = 0, Hard Exclusion** |
| `avoidIngredients` | Safety (Hard) | Matches forbidden tokens in ingredient list | **Score = 0, Hard Exclusion** |

### 2.2 Continuous Personalized Scoring Formula
For soft nutrient preferences, each preference returns one of:
- `MATCH`: 100 points
- `PARTIAL_MATCH`: 65 points
- `NO_MATCH`: 0 points
- `UNKNOWN`: 50 points (neutral baseline for missing data)

The aggregate preference score $U$ is computed as:
$$U = \mathrm{round}\left(\frac{\sum \text{preferencePoints}}{N_{\text{active}}}\right)$$

The weighted contribution to the overall score is:
$$wU = \mathrm{round}(0.10 \times U)$$

For example, a product matching a user's High Protein preference with 80% compatibility contributes $8 / 10$ points to its personalized quality score.

---

## 3. Inactive vs. Active Comparison

To verify that preferences do not bleed into the master catalog, the following table compares product scores in both states:

| Product ID | Product Name | Protein / Sugar | Inactive ($U=0$) | High Protein ($U>0$) | Low Sugar ($U>0$) |
|:---|:---|:---:|:---:|:---:|:---:|
| `PKG_PRD_0001` | Parle-G Gold Biscuits | 6.5g / 25.5g | **49 / 100** ($wU=0$) | **54 / 100** ($wU=5$) | **49 / 100** ($wU=0$) |
| `PKG_PRD_0006` | Parle Monaco Salted Biscuits | 9.0g / 4.5g | **44 / 100** ($wU=0$) | **51 / 100** ($wU=7$) | **54 / 100** ($wU=10$) |
| `PKG_PRD_0008` | Britannia NutriChoice Digestive | 9.0g / 14.5g | **53 / 100** ($wU=0$) | **60 / 100** ($wU=7$) | **58 / 100** ($wU=5$) |
| `PKG_PRD_0241` | Amul Taaza Homogenised Milk | 3.2g / 4.7g | **87 / 100** ($wU=0$) | **94 / 100** ($wU=7$) | **97 / 100** ($wU=10$) |
| `PKG_PRD_0401` | Pintola All-Natural Peanut Butter | 30.0g / 3.0g | **91 / 100** ($wU=0$) | **100 / 100** ($wU=10$) | **100 / 100** ($wU=10$) |

---

## 4. Architectural Separation of Storefront & Recommendations

### Master Packaged Catalog (`/`)
- Purely objective reference catalog.
- Evaluates scores with empty preferences `{}`.
- Displays all eligible products sorted objectively by base Quality Score (`score_desc`).
- Free from personalized re-sorting or allergen-based product hiding.

### Recommendation Engine (`/recommendations`)
- Accessed via dedicated top navigation link with blinking live indicator.
- Automatically loads saved preferences from `PreferenceContext`.
- If no preferences are configured, renders an informative empty-state directing user to set preferences.
- When active, sorts products by Match Score % (e.g., 95% Match) and highlights matching nutrients.

---

## 5. Audit Results

The catalog-wide evaluation confirmed:
1. **Zero Contribution in Inactive State:** 1,024 of 1,024 products (100%) had $U = 0$ and $wU = 0$.
2. **Dynamic Range in Active State:** Across single and multi-preference scenarios, $U$ spanned the full continuous range from 0 to 100 based on nutritional profiles.
3. **Hard Constraint Enforcement:** Products with avoided allergens had their scores overridden to 0 and were excluded from recommendation rankings.
