# SMARTCHOICE — RECOMMENDATION ENGINE SCORING REDESIGN: IMPLEMENTATION REPORT

## 1. Executive Summary & Purpose

This document details the complete redesign and implementation of the SmartChoice Recommendation Engine's Match Percentage calculation.

Prior read-only audits revealed five fundamental structural defects in preference matching:
1. **Flat 100% Scoring Plateaus**: Every product meeting a minimum statutory claim threshold received a flat 100% match score (e.g. 0 mg vs 120 mg sodium, 0g vs 2.5g sugar, 20g vs 45g protein, 8g vs 15g fiber), eliminating any ability to differentiate between genuinely superior nutritional profiles and borderline compliant foods.
2. **Artificial Cliff / Discontinuity**: Low Calories (Solid) crashed from 5% at 400 kcal to 0% at 401 kcal due to an unhandled ternary ceiling.
3. **Multi-Preference Dilution**: Products with extreme deficiencies on one goal (0% score) saw their overall match score artificially elevated when users selected additional unrelated satisfied preferences (e.g., peanut butter scoring higher on calories when sugar/protein preferences were active).
4. **Missing/Invalid Data Inflation**: Missing nutrient data was awarded a neutral 50%, while corrupt data received 30%, overstating compatibility.
5. **Separation of Concerns**: Statutory marketing claims and personalized match compatibility were entangled.

### Project Preservation Mandates Confirmed
- **Catalog-500 Product Records**: 100% preserved and untouched.
- **SmartChoice Quality Score**: Locked formula ($SC = 0.40N + 0.20I + 0.15P + 0.15PF + 0.10U$) preserved with exact component weights. Match Score operates with complete mathematical independence from Quality Score.
- **Hard Exclusions**: Allergen and Ingredient exclusions remain strict binary disqualifications ($0\%$ match score, $0$ total score, `isEligible = false`).
- **Lifestyle Preferences**: Vegan and Vegetarian classifications strictly enforced.

---

## 2. Modified Files & Architectures

| File | Role | Changes Made |
| :--- | :--- | :--- |
| `frontend/src/utils/productScoring.js` | Frontend Scoring Engine | Replaced step-function plateaus with continuous piecewise linear functions for all 7 preferences (solid and liquid); implemented dual-term anti-dilution aggregation ($0.65\text{ avg} + 0.35\min$) with Critical Failure and Severe Weakness guards; updated UNKNOWN baseline to 40% and INVALID to 15%; unified allergen and ingredient detection. |
| `backend/services/recommendationService.js` | Backend Recommendation Service | Synchronized exact mathematical formulas, aggregation logic, physical impossibility filters, and classification logic with frontend for 100% parity. |
| `backend/tests/dynamicRecommendationEngine.test.js` | Backend Recommendation Test Suite | Aligned test expectation for physically invalid declaration from 30% to 15%. (24/24 passing). |
| `backend/tests/preferenceRankingConsistency.test.js` | Preference Consistency Tests | Aligned test expectations for continuous protein scoring between Betty Crocker and Knorr Soup (13.9g = 78%, 13.6g = 77%, delta = 1%). (5/5 passing). |
| `backend/tests/scoringEngineIntegration.test.js` | Scoring Engine Integration Tests | Aligned test expectation for multi-preference compatibility from $\ge 90$ to $\ge 80$ reflecting continuous gradient. (10/10 passing). |
| `backend/tests/recommendationScoringRedesign.test.js` | New Dedicated Verification Suite | Comprehensive 30-test suite verifying individual boundary accuracy, dense monotonicity, continuity at 400 kcal, anti-dilution guards, missing data handling, and exact 500-SKU parity. (30/30 passing). |
| `docs/RECOMMENDATION_SCORING_DESIGN.md` | Mathematical Design Specification | Formal piecewise definitions, threshold rationales, and aggregation specifications. |

---

## 3. Mathematical Formulations Implemented

### 3.1 Individual Preference Piecewise Functions

#### 1. Low Sodium ($s_{\text{sodium}}(x)$ per 100g/ml)
- $x = 0\text{ mg} \implies 100\%$
- $0 < x \le 40\text{ mg} \implies 100 - \left(\frac{x}{40}\right) \times 5 \quad [100\% \to 95\%]$
- $40 < x \le 120\text{ mg} \implies 95 - \left(\frac{x - 40}{80}\right) \times 10 \quad [95\% \to 85\%]$
- $120 < x \le 400\text{ mg} \implies 85 - \left(\frac{x - 120}{280}\right) \times 35 \quad [85\% \to 50\%]$
- $400 < x \le 600\text{ mg} \implies 50 - \left(\frac{x - 400}{200}\right) \times 30 \quad [50\% \to 20\%]$
- $600 < x \le 1000\text{ mg} \implies 20 - \left(\frac{x - 600}{400}\right) \times 20 \quad [20\% \to 0\%]$
- $x > 1000\text{ mg} \implies 0\%$

#### 2. High Protein ($s_{\text{protein}}(x)$ per 100g/ml)
**Solid Foods:**
- $x \ge 45\text{g} \implies 100\%$
- $20 \le x < 45\text{g} \implies 90 + \left(\frac{x - 20}{25}\right) \times 10 \quad [90\% \to 100\%]$
- $10 \le x < 20\text{g} \implies 70 + \left(\frac{x - 10}{10}\right) \times 20 \quad [70\% \to 90\%]$
- $5 \le x < 10\text{g} \implies 35 + \left(\frac{x - 5}{5}\right) \times 35 \quad [35\% \to 70\%]$
- $0 \le x < 5\text{g} \implies \left(\frac{x}{5}\right) \times 35 \quad [0\% \to 35\%]$

**Beverages & Liquids:**
- $x \ge 12\text{g} \implies 100\%$
- $6 \le x < 12\text{g} \implies 90 + \left(\frac{x - 6}{6}\right) \times 10 \quad [90\% \to 100\%]$
- $3 \le x < 6\text{g} \implies 60 + \left(\frac{x - 3}{3}\right) \times 30 \quad [60\% \to 90\%]$
- $0 \le x < 3\text{g} \implies \left(\frac{x}{3}\right) \times 60 \quad [0\% \to 60\%]$

#### 3. Low Sugar ($s_{\text{sugar}}(x)$ per 100g/ml)
**Solid Foods:**
- $x = 0\text{g} \implies 100\%$
- $0 < x \le 2.5\text{g} \implies 100 - \left(\frac{x}{2.5}\right) \times 10 \quad [100\% \to 90\%]$
- $2.5 < x \le 5.0\text{g} \implies 90 - \left(\frac{x - 2.5}{2.5}\right) \times 15 \quad [90\% \to 75\%]$
- $5.0 < x \le 15.0\text{g} \implies 75 - \left(\frac{x - 5.0}{10.0}\right) \times 40 \quad [75\% \to 35\%]$
- $15.0 < x \le 25.0\text{g} \implies 35 - \left(\frac{x - 15.0}{10.0}\right) \times 35 \quad [35\% \to 0\%]$
- $x > 25.0\text{g} \implies 0\%$

**Beverages & Liquids:**
- $x = 0\text{g} \implies 100\%$
- $0 < x \le 1.0\text{g} \implies 100 - \left(\frac{x}{1.0}\right) \times 10 \quad [100\% \to 90\%]$
- $1.0 < x \le 2.5\text{g} \implies 90 - \left(\frac{x - 1.0}{1.5}\right) \times 15 \quad [90\% \to 75\%]$
- $2.5 < x \le 7.5\text{g} \implies 75 - \left(\frac{x - 2.5}{5.0}\right) \times 45 \quad [75\% \to 30\%]$
- $7.5 < x \le 11.25\text{g} \implies 30 - \left(\frac{x - 7.5}{3.75}\right) \times 30 \quad [30\% \to 0\%]$
- $x > 11.25\text{g} \implies 0\%$

#### 4. High Fiber ($s_{\text{fiber}}(x)$ per 100g/ml)
- Format constraints: Cooking oils, spice powders, tea/coffee infusions $\implies 0\%$.
- $x \ge 15\text{g} \implies 100\%$
- $8 \le x < 15\text{g} \implies 90 + \left(\frac{x - 8}{7}\right) \times 10 \quad [90\% \to 100\%]$
- $6 \le x < 8\text{g} \implies 80 + \left(\frac{x - 6}{2}\right) \times 10 \quad [80\% \to 90\%]$
- $3 \le x < 6\text{g} \implies 40 + \left(\frac{x - 3}{3}\right) \times 40 \quad [40\% \to 80\%]$
- $0 \le x < 3\text{g} \implies \left(\frac{x}{3}\right) \times 40 \quad [0\% \to 40\%]$

#### 5. Low Calories ($s_{\text{calories}}(x)$ per 100g/ml)
**Solid Foods:**
- $x \le 40\text{ kcal} \implies 100 - \left(\frac{x}{40}\right) \times 10 \quad [100\% \to 90\%]$
- $40 < x \le 120\text{ kcal} \implies 90 - \left(\frac{x - 40}{80}\right) \times 20 \quad [90\% \to 70\%]$
- $120 < x \le 250\text{ kcal} \implies 70 - \left(\frac{x - 120}{130}\right) \times 35 \quad [70\% \to 35\%]$
- $250 < x \le 400\text{ kcal} \implies 35 - \left(\frac{x - 250}{150}\right) \times 25 \quad [35\% \to 10\%]$
- $400 < x \le 500\text{ kcal} \implies 10 - \left(\frac{x - 400}{100}\right) \times 10 \quad [10\% \to 0\%]$
- $x > 500\text{ kcal} \implies 0\%$

*Elimination of Discontinuity*: Previously, 400 kcal gave 5% and 401 kcal gave 0%. Now, 399 kcal = 10%, 400 kcal = 10%, 401 kcal = 10%, decaying smoothly to 0% at 500 kcal.

**Beverages & Liquids:**
- $x \le 20\text{ kcal} \implies 100 - \left(\frac{x}{20}\right) \times 10 \quad [100\% \to 90\%]$
- $20 < x \le 60\text{ kcal} \implies 90 - \left(\frac{x - 20}{40}\right) \times 30 \quad [90\% \to 60\%]$
- $60 < x \le 120\text{ kcal} \implies 60 - \left(\frac{x - 60}{60}\right) \times 40 \quad [60\% \to 20\%]$
- $120 < x \le 180\text{ kcal} \implies 20 - \left(\frac{x - 120}{60}\right) \times 20 \quad [20\% \to 0\%]$
- $x > 180\text{ kcal} \implies 0\%$

#### 6. Low Saturated Fat ($s_{\text{satFat}}(x)$ per 100g/ml)
- $x = 0\text{g} \implies 100\%$
- $0 < x \le 0.5\text{g} \implies 100 - \left(\frac{x}{0.5}\right) \times 5 \quad [100\% \to 95\%]$
- $0.5 < x \le 1.5\text{g} \implies 95 - \left(\frac{x - 0.5}{1.0}\right) \times 10 \quad [95\% \to 85\%]$
- $1.5 < x \le 5.0\text{g} \implies 85 - \left(\frac{x - 1.5}{3.5}\right) \times 40 \quad [85\% \to 45\%]$
- $5.0 < x \le 10.0\text{g} \implies 45 - \left(\frac{x - 5.0}{5.0}\right) \times 45 \quad [45\% \to 0\%]$
- $x > 10.0\text{g} \implies 0\%$

#### 7. Low Fat ($s_{\text{fat}}(x)$ per 100g/ml)
**Solid Foods:**
- $0 < x \le 1.5\text{g} \implies 100 - \left(\frac{x}{1.5}\right) \times 5 \quad [100\% \to 95\%]$
- $1.5 < x \le 3.0\text{g} \implies 95 - \left(\frac{x - 1.5}{1.5}\right) \times 10 \quad [95\% \to 85\%]$
- $3.0 < x \le 10.0\text{g} \implies 85 - \left(\frac{x - 3.0}{7.0}\right) \times 35 \quad [85\% \to 50\%]$
- $10.0 < x \le 25.0\text{g} \implies 50 - \left(\frac{x - 10.0}{15.0}\right) \times 50 \quad [50\% \to 0\%]$
- $x > 25.0\text{g} \implies 0\%$

**Beverages & Liquids:**
- $0 < x \le 0.75\text{g} \implies 100 - \left(\frac{x}{0.75}\right) \times 5 \quad [100\% \to 95\%]$
- $0.75 < x \le 1.5\text{g} \implies 95 - \left(\frac{x - 0.75}{0.75}\right) \times 10 \quad [95\% \to 85\%]$
- $1.5 < x \le 3.0\text{g} \implies 85 - \left(\frac{x - 1.5}{1.5}\right) \times 35 \quad [85\% \to 50\%]$
- $3.0 < x \le 10.0\text{g} \implies 50 - \left(\frac{x - 3.0}{7.0}\right) \times 50 \quad [50\% \to 0\%]$
- $x > 10.0\text{g} \implies 0\%$

---

### 3.2 Multi-Preference Aggregation Model

Given $N$ active soft preferences with individual scores $\{s_1, s_2, \dots, s_N\}$:
$$\bar{s} = \frac{1}{N}\sum_{i=1}^{N} s_i, \quad s_{\min} = \min_{1 \le i \le N} s_i$$

1. **Base Synergy Score**:
   $$S_{\text{base}} = 0.65 \cdot \bar{s} + 0.35 \cdot s_{\min}$$

2. **Critical Failure Guard**:
   If any active preference receives $s_i = 0$ ($s_{\min} = 0$), the product cannot masquerade as compatible.
   $$\text{Cap}_{\text{zero}} = \max\left(15, 30 - (k_{\text{zero}} - 1) \cdot 10\right)$$
   $$S = \min\left(S_{\text{base}}, \text{Cap}_{\text{zero}}\right)$$
   where $k_{\text{zero}}$ is the number of active preferences scoring $0\%$.

3. **Severe Weakness Guard**:
   If $0 < s_{\min} < 35$:
   $$\text{Cap}_{\text{weak}} = 40 + \left(\frac{s_{\min}}{35}\right) \cdot 15$$
   $$S = \min\left(S_{\text{base}}, \text{Cap}_{\text{weak}}\right)$$

4. **Clamping & Rounding**:
   $$\text{MatchScore} = \text{clamp}\left(\text{round}(S), 0, 100\right)$$

---

### 3.3 Missing Data & Physical Invalidity Policies

1. **Missing Nutrient Declaration**:
   - Status: `UNKNOWN`
   - Score: $40\%$ (conservative uncertainty baseline)
   - Reason: Clearly states data is missing and penalized.
2. **Physically Impossible Declarations**:
   - Condition: Macronutrient $> 105\text{g}$ per 100g or sum of protein + carbs + fat $> 115\text{g}$ per 100g, or calories $< 0$.
   - Status: `UNKNOWN`
   - Score: $15\%$ (severe penalty for corrupt/untrustworthy data).

---

## 4. Key Comparisons: Before vs After

| Nutrient & Value | Old Implementation | Redesigned Implementation | Impact / Resolution |
| :--- | :--- | :--- | :--- |
| **Sodium: 0 mg** | 100% | **100%** | Baseline perfect match. |
| **Sodium: 120 mg** | 100% (Plateau) | **85%** | Plateau eliminated. Clear 15% distinction from 0 mg. |
| **Sodium: 125 mg** | 99% | **84%** | Smooth continuous descent (1% delta for 5 mg). |
| **Sugar: 0 g** | 100% | **100%** | Zero sugar gold standard. |
| **Sugar: 2.5 g** | 100% (Plateau) | **90%** | Separated from 0g while remaining strongly compatible. |
| **Protein: 20 g (Solid)** | 100% (Plateau) | **90%** | High protein recognized. |
| **Protein: 45 g (Solid)** | 100% (Plateau) | **100%** | Exceptional protein density awarded top score. |
| **Calories: 400 kcal** | 5% | **10%** | Continuous transition. |
| **Calories: 401 kcal** | 0% (Cliff Drop) | **10%** | Discontinuity eliminated completely. |
| **[Low Cal (0%), Low Sod (100%)]** | 50% (Dilution) | **30% (Critical Guard)** | Deficient product cannot masquerade as recommended. |
| **[Low Cal (0%), Sod (100%), Sugar (100%)]** | 67% (Dilution) | **30% (Critical Guard)** | Adding satisfied preferences no longer hides core failure. |
| **Missing Nutrient** | 50% | **40% (UNKNOWN)** | Conservative uncertainty penalty applied. |
| **Corrupt Data (>105g/100g)** | 30% | **15% (INVALID)** | Corrupt data penalized heavily. |
