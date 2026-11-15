# SMARTCHOICE — STRICT EXCLUSION & DIETARY LIFESTYLE ARCHITECTURE

## 1. Overview
This specification details the final architecture of SmartChoice's preference engine, strict exclusion policies, and dietary lifestyle filters.

---

## 2. Strict Allergen & Ingredient Exclusions (Global Scope)

### 2.1 User Input Processing
- **Fields**:
  - `Avoided Allergens`: Comma-separated (e.g. `peanuts, milk, soy, gluten`)
  - `Excluded Ingredients`: Comma-separated (e.g. `palm oil, artificial colour, MSG, high fructose corn syrup`)
- **Sanitization Pipeline**:
  1. Multiple comma-separated tokens are parsed.
  2. Whitespace is trimmed and capitalization normalized.
  3. Known allergen and ingredient synonyms are canonicalized (e.g., `groundnut` -> `peanuts`, `rbd palm oil` -> `palm oil`, `monosodium glutamate` / `INS 621` -> `MSG`).
  4. Duplicate entries are eliminated via `Set`.
  5. Empty or single-character noise tokens are discarded.
  6. Values persist in `localStorage`, `sessionStorage`, and backend API, surviving page refresh.
  7. When an entry is removed and saved, the eligibility filter automatically restores previously excluded products without mutating catalog data.

### 2.2 Exclusion Evaluation Logic
- **OR Logic**: A product is excluded if it contains **ANY** avoided allergen OR **ANY** excluded ingredient.
- **Evidence Verification Rules**:
  - `CONTAINS`: Confirmed allergen declaration or presence in formulation text -> Exclude.
  - `MAY CONTAIN`: Precautionary cross-contact advisory declaration -> Exclude conservatively.
  - `UNKNOWN`: Incomplete allergen declaration where absence cannot be verified -> Exclude under strict avoidance.
  - `VERIFIED ABSENCE`: Permitted only when official labelling confirms absence.
  - `INCOMPLETE INGREDIENTS`: If an excluded ingredient is active and product formulation is missing or incomplete, product is marked ineligible under strict exclusion.

### 2.3 Global Enforcement Scope
Strict exclusions apply globally across:
- All Categories.
- Every individual category.
- Master Catalog.
- Recommendation Engine.
- Normal Search.
- Semantic Search.
- Product result pagination.
- No category switching or search query can bypass an active strict exclusion.

---

## 3. Dietary Lifestyle Rules (Recommendation Engine Scope)

### 3.1 Strict Separation of Scope
- **Master Catalog**:
  - Strictly independent of Vegetarian and Vegan selections.
  - Independent of nutritional goal preferences.
  - Retains neutral objective Quality Score sorting.
  - Applies ONLY saved strict allergen & ingredient exclusions.
- **Recommendation Engine**:
  - Applies Vegetarian and Vegan lifestyle filtering.
  - Applies saved statutory nutritional targets (High Protein, Low Sugar, High Fibre, etc.).
  - Applies saved strict allergen & ingredient exclusions.

### 3.2 Recommendation Engine Selection Matrix
| Vegetarian | Vegan | Eligible Classifications | Excluded Classifications |
|---|---|---|---|
| **OFF** | **OFF** | All classifications | None (subject to strict allergen/ingredient exclusions) |
| **ON** | **OFF** | `VEGETARIAN` only | `VEGAN`, `NON_VEGETARIAN`, `UNKNOWN` |
| **OFF** | **ON** | `VEGAN` only | `VEGETARIAN`, `NON_VEGETARIAN`, `UNKNOWN` |
| **ON** | **ON** | `VEGETARIAN` and `VEGAN` | `NON_VEGETARIAN`, `UNKNOWN` |

*Statutory Project Note*: Following project specifications, when Vegetarian is selected alone, `VEGAN` products are excluded so that only strictly `VEGETARIAN` (dairy/honey-containing) products are surfaced. When both options are selected, both `VEGETARIAN` and `VEGAN` products are eligible, excluding only `NON_VEGETARIAN` and `UNKNOWN`.

---

## 4. Distinct Product Card Dietary Emblems
Every product card, detail modal, and comparison canvas uses the unified [DietaryEmblem](file:///c:/Users/sabya/OneDrive/Desktop/SmartChoice/frontend/src/components/DietaryEmblem.jsx):
1. **Vegan**: Emerald leaf icon with distinct `Vegan` label.
2. **Vegetarian**: FSSAI green square with solid green circle and `Veg` label.
3. **Non-Veg**: FSSAI brown/rose square with solid circle and `Non-Veg` label.
4. **Unknown / Unverified**: Slate dashed square with `Unknown` label.
