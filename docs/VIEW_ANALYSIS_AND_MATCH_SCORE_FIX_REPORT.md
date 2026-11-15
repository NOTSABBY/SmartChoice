# SMARTCHOICE — VIEW ANALYSIS DATABASE ERROR FIX & MATCH SCORE FORMULA AUDIT REPORT

**Date:** November 14, 2026  
**Status:** FULLY RESOLVED & VERIFIED  
**Targets Tested:** `/recommendations`, `/product/:id`, `/api/products/:id`, `/api/analysis/:id`, `/api/products/:id/score`, `/api/products/:id/similar`, `POST /api/recommendations`

---

## 1. EXECUTIVE SUMMARY

This investigation diagnosed and resolved two core issues on the SmartChoice Recommendations and Product Details workflow:
1. **View Analysis Database Error (`Cannot call products.findOne() before initial connection is complete if bufferCommands = false`):**
   - **Root Cause:** In `backend/server.js`, database connection was initiated asynchronously without being awaited prior to starting the Express HTTP server, while `mongoose.set('bufferCommands', false)` was active. Any incoming HTTP request executed before Mongoose's connection handshake was finalized threw an uncaught Mongoose operational error. In addition, `Product.findById()` and related endpoints rejected Catalog-500 alphanumeric identifiers (`PKG_PRD_xxxx`) using restrictive 24-character hex regexes.
   - **Resolution:** `backend/server.js` now strictly awaits `connectDB()` before opening port 8080. In all product lookup routes (`getProductById`, `getProductAnalysis`, `getScore`, `getSimilarProducts`), database queries are strictly conditioned on `mongoose.connection.readyState === 1`, with automated fallback to the in-memory indexed `catalogLoader`.
2. **Match Score Formula Audit & Transparency:**
   - **Audit Findings:** Previously, the frontend recommendation card badge displayed `rec.finalScore` (a 70/30 composite of SmartChoice quality and preference compatibility) rather than the pure preference compatibility percentage. For Brooke Bond Red Label Tea under `High Protein` + `Low Calories`, both the 5-component SmartChoice score was 99 and the combined rank score was $0.70(99) + 0.30(100) = 99.3 \to 99$, giving the false impression that Match Score was duplicated from SmartChoice Score.
   - **Resolution:** Decoupled the three metrics in both API response and UI:
     - **Match Score (`matchScore`):** Measures compatibility with user preferences (0–100%).
     - **SmartChoice Score (`smartChoiceScore`):** Measures statutory 5-component product quality (0–100).
     - **Rank Score (`finalScore`):** The weighted ranking score combining 70% SmartChoice Quality and 30% Match Compatibility.
     - **Confidence (`confidence`):** Decoupled metric measuring data availability and completeness.

---

## 2. PROBLEM A: VIEW ANALYSIS DATABASE ERROR & NAVIGATION FIX

### 2.1 Root Cause Diagnostics
1. **Unawaited Connection Handshake:** `startServer` in `backend/server.js` called `connectDB().catch(...)` without `await`. The HTTP listener bound port 8080 while Mongoose was still in `readyState: 2` (connecting).
2. **Immediate Mongoose Exception under `bufferCommands = false`:** With Mongoose command buffering disabled, executing any model query (`Product.findOne` or `Product.findById`) while connection is pending throws `Cannot call products.findOne() before initial connection is complete if bufferCommands = false.`
3. **ID Schema Discrepancy:** Catalog-500 products utilize format `PKG_PRD_xxxx`. Multiple endpoints (`/api/products/:id/score`, `/api/products/:id/similar`) contained `if (!id.match(/^[0-9a-fA-F]{24}$/))` which instantly failed for all 500 catalog products.
4. **Offline Resilience:** If MongoDB Atlas TLS handshake failed (e.g., alert 80 on unwhitelisted dynamic IP), controller methods directly called Mongoose models rather than serving verified records from local data structures.

### 2.2 Implemented Corrections
- **`backend/server.js`:**
  ```javascript
  // 1. Await database initialization before listening for incoming HTTP requests
  try {
    await connectDB();
  } catch (dbError) {
    console.warn("MongoDB connection could not be established during startup; operating with local catalog fallback:", dbError.message);
  }
  const app = express();
  ...
  app.listen(PORT, ...);
  ```
- **`backend/controllers/productController.js`:**
  - `getProductById`: Validates ID string, checks `mongoose.connection.readyState === 1` before invoking `Product.findOne()`, and queries `catalogLoader.getProductById(cleanId)` on DB miss or offline state. Returns HTTP 503 if DB is offline and product is missing, or HTTP 404 if online and missing.
  - `getScore`: Removed 24-character hex constraint. Now accepts any valid ID string, resolves canonical product, and returns 5-component score breakdown.
  - `getSimilarProducts`: Removed 24-character hex constraint. Uses `catalogLoader` to compute Jaccard and nutrient similarity across catalog products when DB is offline.
- **`backend/controllers/analysisController.js`:**
  - `getProductAnalysis`: Checks `readyState === 1`, supports both MongoDB IDs and Catalog-500 IDs (`PKG_PRD_xxxx`), and retrieves full Phase 3 FSSAI analysis (trans-fat, protein/fibre claims, additives, INS markers, allergen classes, NOVA classification).
- **`backend/services/scoringService.js`:**
  - `getScoreForProduct`: Dual-lookup supporting MongoDB ObjectIDs, Catalog IDs, and barcodes with resilient `catalogLoader` integration.
- **`backend/utils/catalogLoader.js`:**
  - Dual-indexes all 500 products from `frontend/public/data/enriched_catalog_500.json` and legacy retail barcodes from `data/processed/products_india.json`.
- **`frontend/src/pages/Pages.jsx` (`ProductDetail`):**
  - Displays all 5 scoring components:
    1. Nutrition (40%)
    2. Ingredients (20%)
    3. Processing (15%)
    4. Protein/Fiber (15%)
    5. Preferences (10%)
  - Renders Phase 3 deep audit: Trans-fat free claim status, FSSAI protein & fibre claims, additives & INS cosmetic markers, FSSAI 8 allergen classes, and NOVA classification.

---

## 3. PROBLEM B: AUDIT OF THE MATCH SCORE FORMULA

### 3.1 Function & Implementation
The Match Score calculation is implemented in [backend/services/recommendationService.js](file:///c:/Users/sabya/OneDrive/Desktop/SmartChoice/backend/services/recommendationService.js):
- Primary evaluation: `evaluatePreferences(product, prefs)`
- Score aggregation: `calculatePersonalizedScore(evalResults)`
- Ranking orchestrator: `rankProducts(products, rawPrefs)`

### 3.2 Exact Mathematical Formula
1. **Hard Constraints (Safety Exclusions):**
   If an avoided allergen (`avoidAllergens`) or excluded ingredient (`avoidIngredients` / `excludedIngredients`) is detected in the declared allergens, identified classes, or ingredient text:
   $$\text{isEligible} = \text{false} \implies \text{Match Score} = 0, \quad \text{Rank Score} = 0$$

2. **Preference Match Evaluation:**
   For each active preference $i \in \{1, \dots, N_{\text{active}}\}$, an evaluation returns status $\in \{\text{MATCH}, \text{NO\_MATCH}, \text{UNKNOWN}\}$:
   $$\text{points}(i) = \begin{cases} 100 & \text{if } \text{status} = \text{MATCH} \\ 50 & \text{if } \text{status} = \text{UNKNOWN} \text{ (neutral fallback)} \\ 0 & \text{if } \text{status} = \text{NO\_MATCH} \end{cases}$$

3. **Normalized Match Score (0–100%):**
   $$\text{Match Score} = \begin{cases} 0 & \text{if } \text{isEligible} = \text{false} \\ 50 & \text{if } N_{\text{active}} = 0 \text{ (neutral default)} \\ \text{round}\left( \frac{\sum_{i=1}^{N_{\text{active}}} \text{points}(i)}{N_{\text{active}}} \right) & \text{if } N_{\text{active}} > 0 \end{cases}$$

4. **Recommendation Rank Score (`finalScore`):**
   $$\text{Final Rank Score} = \begin{cases} 0 & \text{if } \text{isEligible} = \text{false} \\ \text{round}(0.70 \times \text{SmartChoice Quality Score} + 0.30 \times \text{Match Score}) & \text{if } \text{isEligible} = \text{true} \end{cases}$$

### 3.3 Active Preference Input Criteria
| Preference Key | Threshold / Standard | MATCH Condition | NO_MATCH Condition | UNKNOWN Condition |
| :--- | :--- | :--- | :--- | :--- |
| `highProtein` | FSSAI Protein Schedule ($\ge 5$g/100g) | Protein $\ge 5$g | Protein $< 5$g | Protein is null/missing |
| `lowSugar` | Statutory Low Sugar ($\le 5$g/100g) | Sugar $\le 5$g | Sugar $> 5$g | Sugar is null/missing |
| `lowCalories` | Moderate Energy Boundary ($\le 150$ kcal/100g) | Energy $\le 150$ kcal | Energy $> 150$ kcal | Energy is null/missing |
| `lowSaturatedFat`| Low Saturated Fat ($\le 1.5$g/100g) | Sat. Fat $\le 1.5$g | Sat. Fat $> 1.5$g | Sat. Fat is null/missing |
| `lowSodium` | Low Salt Boundary ($\le 120$mg/100g) | Sodium $\le 120$mg | Sodium $> 120$mg | Sodium is null/missing |
| `highFiber` | Dietary Fibre Schedule ($\ge 3$g/100g) | Fibre $\ge 3$g | Fibre $< 3$g | Fibre is null/missing |
| `vegetarian` | Dietary Identity Schedule | Labeled `VEGETARIAN` / `VEG` | Labeled `NON_VEG` | Unspecified / missing |
| `vegan` | Processing Label Schedule | Explicit `vegan` marker | No vegan marker | Unspecified |
| `avoidAllergens` | FSSAI 8 Mandatory Allergen Classes | No avoided allergen | Contains allergen | Ineligible (Score = 0) |
| `avoidIngredients`| Ingredient List Match | No avoided ingredient| Contains ingredient | Ineligible (Score = 0) |

### 3.4 Why Brooke Bond Red Label Tea Received Match: 99 Previously
Under preferences `High Protein` + `Low Calories`:
1. **Tea Leaves Composition:**
   - Protein: $19.3$g/100g ($\ge 5$g $\to \text{MATCH} = 100$)
   - Calories: $101.8$ kcal/100g ($\le 150$ kcal $\to \text{MATCH} = 100$)
   - **True Match Score:** $\frac{100 + 100}{2} = 100\%$
2. **SmartChoice 5-Component Quality Score:**
   - Pure single-ingredient tea leaves (0g sugar, 0g sat fat, 0mg sodium, NOVA 1) $\to 99/100$
3. **Recommendation Rank Score:**
   - $\text{Rank Score} = \text{round}(0.70 \times 99 + 0.30 \times 100) = \text{round}(69.3 + 30.0) = 99$
4. **UI Mapping Artifact:** The UI badge previously displayed `Match: {rec.finalScore}` rather than `rec.matchScore`. Because both the 5-component SmartChoice score was 99 and the composite rank score was 99, it appeared as though the score was cloned.
5. **UI Correction:** The card badge now explicitly displays `Match: {rec.matchScore}%` (100%), while the footer displays `SmartChoice Score: 99/100` and `Rank Score: 99`.

---

## 4. MULTI-PREFERENCE AUDIT & VERIFICATION RESULTS

An automated audit script evaluated multiple preference permutations against the catalog:

```
=== MULTI-PREFERENCE AUDIT ===
1. High Protein only:
   Top: Brooke Bond Red Label Tea | MatchScore: 100% | SmartChoice: 99 | RankScore: 99
2. Low Calories only:
   Top: Brooke Bond Red Label Tea | MatchScore: 100% | SmartChoice: 97 | RankScore: 98
3. High Protein + Low Calories:
   Top: Brooke Bond Red Label Tea | MatchScore: 100% | SmartChoice: 99 | RankScore: 99
4. High Fibre + Low Sugar:
   Top: Brooke Bond Red Label Tea | MatchScore: 100% | SmartChoice: 99 | RankScore: 99
5. Multiple Nutritional Goals (Protein + Low Sugar + Low Sodium + High Fibre):
   Top: Brooke Bond Red Label Tea | MatchScore: 100% | SmartChoice: 100 | RankScore: 100
6. Missing Nutritional Data Handling:
   Test Product: Mystery Food (All nutrients null)
   Result: MatchScore: 50% | Status: ['UNKNOWN', 'UNKNOWN']
7. Avoided Allergens (Milk):
   Total Excluded: 126 products
   Sample Dairy Product: isEligible: false | MatchScore: 0% | RankScore: 0
8. Partial Compatibility Test (Parle-G Gold Biscuits under High Protein + Low Sugar + Low Calories):
   - High Protein: MATCH (6.9g >= 5g) -> 100 pts
   - Low Sugar: NO_MATCH (25.5g > 5g) -> 0 pts
   - Low Calories: NO_MATCH (454 kcal > 150 kcal) -> 0 pts
   Result: MatchScore: 33% | SmartChoice: 45 | RankScore: 41
```

All preference evaluations are deterministic and mathematically verified.

---

## 5. TEST EXECUTION SUMMARY

### 5.1 Product Details & Analysis Endpoints
| Product Type | Identifier | `/products/:id` | `/analysis/:id` | `/products/:id/score` | `/products/:id/similar` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Catalog-500** | `PKG_PRD_0001` (Parle-G Gold) | 200 OK | 200 OK (Completeness: 100%) | 200 OK (Score: 46) | 200 OK (5 similar) |
| **Legacy Retail** | `8901719134845` (Parle-G Biscuit)| 200 OK | 200 OK (Completeness: 87.5%)| 200 OK (Score: 67) | 200 OK (1 similar) |

### 5.2 Statutory Regression Test Suites
All statutory test suites passed:
- `backend/tests/fibreClaims.test.js`: 16/16 passed
- `backend/tests/proteinClaims.test.js`: 13/13 passed
- `backend/tests/transFatClaims.test.js`: 20/20 passed
- `backend/tests/scoringEngineIntegration.test.js`: 10/10 passed

### 5.3 Production Build Verification
- Vite production build executed with zero errors:
  ```
  ✓ 2031 modules transformed.
  dist/index.html                   0.45 kB
  dist/assets/index-DfSupuaL.css   71.46 kB
  dist/assets/index-CN-_Zgpu.js   828.02 kB
  ✓ built in 1.59s
  ```

---

## 6. REMAINING ARCHITECTURAL OBSERVATIONS & LIMITATIONS

1. **MongoDB Atlas IP Access:** When running in local development environments where external dynamic public IPs change, Atlas drops TLS connections if the current IP address is not explicitly present in the Network Access whitelist. The system's fallback architecture now gracefully detects this during startup and serves authentic 500-product data from the verified in-memory catalogue without crashing or timing out. Adding `0.0.0.0/0` or the developer's current IP to the Atlas Network Access list will re-enable live cluster persistence.
2. **Scoring Preservation:** Component weights ($40/20/15/15/10$) and recommendation weights ($70/30$) were strictly preserved without modification.
