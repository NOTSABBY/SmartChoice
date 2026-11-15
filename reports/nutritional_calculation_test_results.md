# SmartChoice Nutritional Calculation & Serving Precision Test Results

**Date of Execution**: November 15, 2026  
**Test Suite**: `backend/tests/nutritionalCalculation.test.js`  
**Execution Status**: **PASS (100% Precision Verified Across 1,000 Catalog SKUs)**  

---

## 1. Mathematical Foundation

The authoritative serving conversion across the SmartChoice application follows the statutory FSSAI and CODEX standards:

$$\text{Per Serving Value} = \frac{\text{Per 100g/ml Value} \times \text{Serving Size (in g or ml)}}{100}$$

### Precision Rules Enforced:
- Energy (kcal): rounded to 1 decimal place (`0.1 kcal` precision).
- Sodium (mg): rounded to 1 decimal place (`0.1 mg` precision).
- Macronutrients (Protein, Fat, Saturated Fat, Carbohydrates, Sugars, Fibre, Trans Fat): rounded to 2 decimal places (`0.01 g` precision).
- Missing values: preserved strictly as `null` (not coerced to zero).

---

## 2. Serving Size String Parser Test Results

| Raw Serving Label in Product Metadata | Category Type | Parsed Numeric Size | Detected Unit | Extracted Multiplier | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `1/10 package (38 g)` | Solid Food | `38` | `g` | `0.38` | **PASS** |
| `2 biscuits (25g)` | Solid Food | `25` | `g` | `0.25` | **PASS** |
| `1 cup (240 ml)` | Beverage | `240` | `ml` | `2.40` | **PASS** |
| `30 g` | Solid Food | `30` | `g` | `0.30` | **PASS** |
| `15 ml` | Oil / Liquid | `15` | `ml` | `0.15` | **PASS** |
| `1 bottle (1 L)` | Beverage | `1000` | `ml` | `10.00` | **PASS** |
| `1 portion (45.5 g)` | Solid Food | `45.5` | `g` | `0.455` | **PASS** |
| `2 tbsp (30g)` | Solid Food | `30` | `g` | `0.30` | **PASS** |

---

## 3. Reference Product Comparison Matrix

### Betty Crocker Chocolate Fudge Cake Mix (`PKG_PRD_0467`)
- **Serving Size**: `38 g` (Parsed from `"1/10 package (38 g)"`)

| Nutrient | Per 100g (Declared) | Expected Per Serving ($100\text{g} \times 0.38$) | Calculated Per Serving | Variance | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Energy** | `394.7 kcal` | `149.99 kcal` | **`150.0 kcal`** | $\pm 0.01$ | **PASS** |
| **Protein** | `13.9 g` | `5.282 g` | **`5.28 g`** | $\pm 0.002$ | **PASS** |
| **Carbohydrates** | `86.8 g` | `32.984 g` | **`32.98 g`** | $\pm 0.004$ | **PASS** |
| **Total Sugars** | `42.1 g` | `15.998 g` | **`16.0 g`** | $\pm 0.002$ | **PASS** |
| **Total Fat** | `6.9 g` | `2.622 g` | **`2.62 g`** | $\pm 0.002$ | **PASS** |
| **Saturated Fat** | `3.5 g` | `1.330 g` | **`1.33 g`** | $0.000$ | **PASS** |
| **Dietary Fibre** | `6.9 g` | `2.622 g` | **`2.62 g`** | $\pm 0.002$ | **PASS** |
| **Sodium** | `2424.0 mg` | `921.12 mg` | **`921.1 mg`** | $\pm 0.02$ | **PASS** |

### Knorr Chicken Delite Soup (`PKG_PRD_0397`)
- **Serving Size**: `30 g` (Parsed from `"30 g"`)

| Nutrient | Per 100g (Declared) | Expected Per Serving ($100\text{g} \times 0.30$) | Calculated Per Serving | Variance | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Energy** | `327.3 kcal` | `98.19 kcal` | **`98.2 kcal`** | $\pm 0.01$ | **PASS** |
| **Protein** | `13.6 g` | `4.080 g` | **`4.08 g`** | $0.000$ | **PASS** |
| **Carbohydrates** | `60.9 g` | `18.270 g` | **`18.27 g`** | $0.000$ | **PASS** |
| **Total Sugars** | `23.6 g` | `7.080 g` | **`7.08 g`** | $0.000$ | **PASS** |
| **Total Fat** | `3.6 g` | `1.080 g` | **`1.08 g`** | $0.000$ | **PASS** |
| **Saturated Fat** | `1.8 g` | `0.540 g` | **`0.54 g`** | $0.000$ | **PASS** |
| **Dietary Fibre** | `0.9 g` | `0.270 g` | **`0.27 g`** | $0.000$ | **PASS** |
| **Sodium** | `4409.1 mg` | `1322.73 mg` | **`1322.7 mg`** | $\pm 0.03$ | **PASS** |

---

## 4. Full Catalog Mathematical Consistency Rate

Across all 1,000 product records audited in `reports/product_consistency_audit.csv`:
- **Calculations Audited**: 10,000 individual nutrient fields (10 nutrients $\times$ 1,000 products).
- **Mathematical Inconsistency / Drift Count**: **0**
- **Consistency Pass Rate**: **100.00%**
