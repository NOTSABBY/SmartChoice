# SMARTCHOICE — MASTER CATALOG AND PERSONALIZED RECOMMENDATION ENGINE SEPARATION REPORT

**Date:** November 15, 2026  
**Status:** Completed & Verified  
**Scope:** Architecture separation of Master Packaged Catalog and Personalized Recommendation Engine  
**Author:** SmartChoice Engineering Team

---

## 1. Executive Summary

We have successfully executed a clean, architectural separation between the **Master Packaged Catalog** and the **Personalized Recommendation Engine** within the SmartChoice food intelligence platform.

Prior to this separation, the homepage storefront was overloading the catalog view with personalized recommendation reordering whenever preferences were active, or collapsing into an empty recommendation prompt when preferences were unset. This violated catalog neutrality.

Following this implementation:
1. **The Master Packaged Catalog** remains the authoritative SmartChoice homepage (`/`), providing unrestricted, neutral access to all 500 lab-enriched packaged food items across 25 categories. It is completely isolated from user preferences—saved preferences never filter, hide, reorder, or alter products in the Master Catalog.
2. **The Personalized Recommendation Engine** operates as a dedicated standalone page (`/recommendations`), directly accessible via a top navigation link located beside Comparison. It evaluates saved preferences dynamically, features an authoritative category dropdown (All Categories + 25 individual categories), enforces statutory single/multi-nutritional rankings, displays all eligible products with their exact ranking nutritional metrics, and displays an explicit empty state when no preferences are saved.
3. **Preferences Workflow** maintains a strict distinction between unsaved draft selections and saved active profiles. Saving preferences updates persistent storage (`localStorage` and `sessionStorage`), activates the Recommendation Engine, and triggers a CSS-animated blinking green dot indicator in the top navigation until the user visits the Recommendation Engine.

---

## 2. Existing Architecture Inspected

The following existing services, routes, layouts, and components were inspected and verified prior to making any modifications:

| Component / File | Purpose & Inspection Findings |
|---|---|
| `frontend/src/App.jsx` | Verified route configuration (`/`, `/preferences`, `/compare`, `/recommendations`). Preserved all auxiliary routes. |
| `frontend/src/pages/Storefront.jsx` | Identified default sort (`smartchoice_recommended`) causing catalog reordering; neutralized to `score_desc` (Quality Score: High to Low) with 100% preference independence. |
| `frontend/src/pages/RecommendationsPage.jsx` | Re-architected into a standalone page featuring dynamic category dropdown, nutritional rankings, preference chips, and mandatory empty state. |
| `frontend/src/pages/PreferencesPage.jsx` | Enhanced save workflow with unsaved draft vs. saved profile indicators, immediate persistence notification, and bidirectional navigation links. |
| `frontend/src/context/PreferenceContext.jsx` | Extended with `hasSavedPreferences`, `isNewlySaved`, `savePreferences`, `clearPreferences`, and `markRecommendationsSeen`. |
| `frontend/src/components/Navbar.jsx` | Added dedicated `Recommendation Engine` link beside Comparison with CSS blinking green dot indicator. |
| `frontend/src/pages/ComparePage.jsx` | Preserved comparison engine and enriched with bidirectional navigation links to Master Catalog and Recommendation Engine. |
| `frontend/src/utils/productScoring.js` | Preserved all 5-component scoring formulas ($SC = 0.40N + 0.20I + 0.15P + 0.15PF + 0.10U$), confidence calculations, and single/multi-preference comparators. |
| `backend/services/scoringService.js` | Inspected and verified deterministic Quality Score ($SC$) and Confidence Score ($0.45Nr + 0.35Ir + 0.20Pr$). |
| `frontend/src/index.css` | Added `@keyframes nav-dot-blink` with `prefers-reduced-motion` compliance. |

---

## 3. Strict State and Architecture Separation

### 3.1 Master Catalog (`Storefront.jsx`)
- **Route:** `/`
- **Default Sorting:** `score_desc` (Quality Score: High to Low).
- **Preference Isolation:** Evaluated with empty preferences `{}` for 100% objective neutrality.
- **Product Guarantee:** All 500 products remain available and accessible across All Categories or individual categories.
- **Zero Drift:** Saved user preferences NEVER filter, reorder, hide, or alter Master Catalog items.
- **Search:** Category-aware search strictly operates on Product Name and Brand Name.

### 3.2 User Preferences (`PreferencesPage.jsx`)
- **Route:** `/preferences`
- **Draft vs. Saved:** Clearly distinguishes unsaved draft checkbox selections from active saved profiles via real-time diff detection (`hasUnsavedChanges`).
- **Save Action:** Explicit form submission invokes `savePreferences(formData)`, persisting to `localStorage` and `sessionStorage`, notifying backend API, and arming the green navigation indicator (`isNewlySaved = true`).
- **Clear Action:** `clearPreferences()` resets all fields, clears active recommendations, and removes the green indicator.

### 3.3 Recommendation Engine (`RecommendationsPage.jsx`)
- **Route:** `/recommendations`
- **State Isolation:** Maintains local `selectedCategoryId` and independent ranking state. Changing category in the Recommendation Engine does not affect the Master Catalog category selection.
- **Empty State:** When no saved preferences exist, displays the mandatory empty state:
  - **Heading:** "Select your preferences first"
  - **Message:** "Visit the Preferences page, choose your nutritional preferences and save them to activate personalized recommendations."
  - **Action Button:** "Go to Preferences"
  - **Product Count:** Exactly 0 products displayed.
- **Category Dropdown:** Authoritative dynamic dropdown populated from `catalog.categories`:
  - `All Categories (500 products)`
  - Individual categories 1 through 25 with accurate SKU counts.
- **Ranking Engine:**
  - **Single Preference:** Strictly follows statutory nutritional direction (e.g. High Protein = highest to lowest protein). Parity with independent nutritional sort verified.
  - **Multiple Preferences:** Evaluates each goal independently using continuous normalized scores, computes combined compatibility, and ranks all eligible products from best to worst.
  - **All Products Available:** Eligible products are never hidden; ineligible/allergen-conflicted products receive an `Excluded` badge and are sorted to the bottom.

---

## 4. Green Navigation Indicator Behavior (Part 7)

The top navigation bar displays a dedicated indicator beside the `Recommendation Engine` option, implemented entirely through CSS animations without JavaScript timers:

1. **No Saved Preferences:** Dot is completely hidden (`hasSavedPreferences === false`).
2. **Saved Preferences Active:** Green dot rendered (`#0c831f`).
3. **Newly Saved Profile:** Green dot blinks using CSS animation (`animate-nav-dot-blink`).
4. **User Visits Recommendation Engine:** Page mount triggers `markRecommendationsSeen()`. Blinking stops immediately; solid green dot remains visible while preferences remain active.
5. **Preferences Cleared:** Green dot is removed.
6. **Page Refresh:** State is derived from persistent storage (`localStorage` & `sessionStorage`).
7. **Accessibility:** Respects `@media (prefers-reduced-motion: reduce)`, disabling animation and presenting a static solid dot.

```css
@keyframes nav-dot-blink {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.25;
    transform: scale(0.8);
  }
}

.animate-nav-dot-blink {
  animation: nav-dot-blink 1.2s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .animate-nav-dot-blink {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
```

---

## 5. Bidirectional Navigation Matrix (Part 8)

| From Page | To Master Catalog | To Preferences | To Recommendation Engine | To Comparison |
|---|---|---|---|---|
| **Master Catalog (`/`)** | Home (`/`) | Navbar Link (`/preferences`) | Navbar Option beside Comparison (`/recommendations`) | Compare Button / Drawer |
| **Preferences (`/preferences`)** | Header & Footer Links | Active Form | Header & Footer Link + Post-save button | Navbar Link |
| **Recommendation Engine (`/recommendations`)** | Header Link (`/`) | Header Link & Adjust Link | Current Page | Header Button & Compare Drawer |
| **Comparison (`/compare`)** | Header Link (`/`) | Contextual Link | Header Link (`/recommendations`) | Active Page |

---

## 6. Verification and Test Results

### 6.1 Automated Separation Test Suite
Suite: `backend/tests/masterCatalogAndRecommendationSeparation.test.js`
- **Test 1:** Master Catalog products remain 100% neutral and independent of user preferences (500/500 SKUs identical scores) — **PASSED**
- **Test 2:** Single Preference High Protein ranks strictly from highest to lowest protein — **PASSED**
- **Test 3:** Single Preference Low Calories ranks strictly from lowest to highest calories — **PASSED**
- **Test 4:** Single Preference Low Sugar ranks strictly from lowest to highest sugar — **PASSED**
- **Test 5:** Multiple Preferences combined compatibility ranking across All Categories — **PASSED**
- **Test 6:** Mandatory empty state trigger when no saved preferences exist — **PASSED**
- **Test 7:** Green navigation indicator state transitions (Hidden -> Blinking -> Solid -> Hidden) — **PASSED**
- **Test 8:** Regression: Category-restricted search remains intact (Uncle Chipps does not leak into "Milk" search) — **PASSED**

**Result: 8/8 Passed (100%)**

### 6.2 Regression Test Suites Executed
1. `backend/tests/categoryAwareSearch.test.js` — **8/8 PASSED** (Strict category isolation and search parity).
2. `backend/tests/headerTickerAndComparison.test.js` — **16/16 PASSED** (Continuous LTR ticker and comparison synchronization).
3. `backend/tests/storefrontLayoutOverlap.test.js` — **5/5 PASSED** (Strict 2-column CSS Grid without overlap).
4. `backend/tests/preferenceRankingConsistency.test.js` — **5/5 PASSED** (Continuous preference scoring and tie-breaking).
5. `backend/tests/nutritionalCalculation.test.js` — **6/6 PASSED** (Mathematical per-serving conversion formulas).
6. `backend/tests/metricSeparationAndConsistency.test.js` — **3/3 PASSED** (Independence of 5 metrics and card/modal parity).
7. `backend/tests/catalogIngredientAndAllergenAudit.test.js` — **26/26 PASSED** (100% ingredient and allergen integrity).

### 6.3 Production Frontend Build Verification
Executed: `npm --prefix frontend run build`
- **Result:** Code exited with 0 in 1.04s.
- **Output:** Built clean production bundle (`dist/assets/index-B2OhPnI9.js` and `dist/assets/index-BXwc_gJj.css`).
- **Errors:** 0 errors.

---

## 7. Final Acceptance Checklist

| Requirement | Status | Verification Evidence |
|---|---|---|
| Master Catalog remains the homepage | **VERIFIED** | Route `/` serves `Storefront.jsx` displaying all 500 catalog products. |
| Master Catalog is never personalized by preferences | **VERIFIED** | Evaluates with `{}` empty preferences; products never reordered or hidden by preferences. |
| Recommendation Engine is a separate page beside Comparison | **VERIFIED** | Located at `/recommendations` with dedicated top navigation button in `Navbar.jsx`. |
| Preferences must be saved before recommendations active | **VERIFIED** | Form submission invokes `savePreferences()`; draft state distinguished from saved state. |
| Recommendation Engine receives saved preference updates | **VERIFIED** | Subscribed to `PreferenceContext`; updates trigger immediate ranking recalculation. |
| Category dropdown supports All Categories and 25 categories | **VERIFIED** | Dynamic `<select>` in `RecommendationsPage.jsx` populated from `catalog.categories`. |
| Single-preference ranking follows actual nutritional values | **VERIFIED** | High Protein (desc), Low Calories (asc), Low Sugar (asc), etc., matching independent sorts. |
| Multiple preferences use combined compatibility ranking | **VERIFIED** | Normalized continuous scoring with deterministic Quality Score secondary tie-breaker. |
| All eligible products remain visible | **VERIFIED** | Products are not hidden; ranked from highest to lowest compatibility. |
| No preferences means no recommendation results | **VERIFIED** | Displays mandatory "Select your preferences first" empty state with 0 products. |
| Green navigation indicator reflects saved preferences | **VERIFIED** | Blinks on save, turns solid on visit, disappears on clear; respects reduced motion. |
| Bidirectional navigation between all sections | **VERIFIED** | Clear navigation links across Master Catalog, Preferences, Recommendations, and Compare. |
| All previously completed functionality preserved | **VERIFIED** | All regression suites (search, scoring, layout, ticker, FSSAI) passing at 100%. |

---
*End of Report.*
