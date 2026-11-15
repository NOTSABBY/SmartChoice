# SmartChoice Confidence Score — Complete Catalog Audit Report

## 1. Executive Summary

This audit verifies the calculation, backend API exposure, and frontend display of the **Numerical Analysis Confidence Score** across all 1,024 products in the SmartChoice ecosystem (500 Catalog-500 SKUs and 524 legacy retail products).

The Confidence Score is an independent meta-metric representing data provenance, evidentiary reliability, and analytical certainty. It is completely decoupled from the product's nutritional quality score.

---

## 2. Authoritative Formula & Component Weights

The Confidence Score is calculated using the established formula:

$$\text{Confidence} = \mathrm{clamp}\left(\mathrm{round}(0.45Nr + 0.35Ir + 0.20Pr), 0, 100\right)$$

### Component Reliability Definitions

| Component | Symbol | Weight | Measurement Basis | Evidence Criteria |
|:---|:---:|:---:|:---|:---|
| **Nutrition Reliability** | $Nr$ | **45%** | Completeness of 8 mandatory nutrients + Basis verification | Evaluates: Calories, Protein, Carbs, Total Sugars, Fat, Saturated Fat, Sodium, Fiber.<br>• Declared per 100g / 100ml: $1.0\times$<br>• Declared per serving: $0.70\times$<br>• Formula: $\mathrm{round}\left(\frac{\text{filled Nutrients}}{8} \times \text{basisFactor} \times 100\right)$ |
| **Ingredient Reliability** | $Ir$ | **35%** | Ingredient text completeness & verified laboratory / FSSAI source | • Parsed structured tokens OR verified raw text: **100%**<br>• Unverified raw ingredient text: **70%**<br>• Missing ingredient text: **0%** |
| **Processing Reliability** | $Pr$ | **20%** | NOVA classification certainty & additive verification | • Verified source-reported NOVA + additives: **100%**<br>• Internally estimated NOVA with full ingredients: **75%**<br>• Unverified NOVA group: **60%**<br>• Missing processing data: **0%** |

---

## 3. Statutory Confidence Classification Thresholds

The application strictly enforces the following classification bands:

| Numerical Range | Classification Level | UI Display Label | Badge Styling |
|:---:|:---:|:---:|:---|
| **80 – 100** | `'high'` | **High Confidence** | Emerald green badge (`bg-emerald-100 text-emerald-800`) |
| **60 – 79** | `'medium'` | **Moderate Confidence** | Amber badge (`bg-amber-100 text-amber-800`) |
| **0 – 59** | `'low'` | **Low Confidence** | Rose/Red badge (`bg-rose-100 text-rose-800`) |

---

## 4. API Exposure & Frontend Visibility

### 4.1 Backend API Specification
The Confidence Score is exposed in the REST API under both `/api/products/:id/score` and within the embedded score payload:

```json
{
  "confidence": {
    "score": 100,
    "confidence": 100,
    "level": "high",
    "label": "High Confidence",
    "breakdown": {
      "nutrition": 100,
      "ingredients": 100,
      "processing": 100
    },
    "weights": {
      "nutrition": 0.45,
      "ingredients": 0.35,
      "processing": 0.20
    }
  }
}
```

### 4.2 Frontend Product Detail Modal
Inside `frontend/src/components/ProductDetailModal.jsx`:
- **Header Section**: Features an explicit confidence badge: `Analysis Confidence: 82/100 (High Confidence)`.
- **Dedicated Analysis Confidence Card**: Displays the statutory formula `Confidence = 0.45Nr + 0.35Ir + 0.20Pr` alongside a 3-column breakdown showing exact percentage reliability for Nutrition ($Nr$), Ingredients ($Ir$), and Processing ($Pr$).

### 4.3 Frontend Product Card
Inside `frontend/src/components/ProductCard.jsx`:
- The bottom-left verification pill features a comprehensive hover tooltip:
  `title="Data Completeness: 100%\nAnalysis Confidence: 100/100 (High Confidence)"`
- No raw `/100` strings are directly rendered on the card surface, maintaining a clean UI while ensuring full transparency on user interaction.

---

## 5. Catalog-Wide Audit Results (1,024 Products)

An automated audit across all 1,024 products in the SmartChoice database yielded the following distribution:

| Metric | Catalog-500 (500 Products) | Legacy Products (524 Products) | Total (1,024 Products) |
|:---|:---:|:---:|:---:|
| **Formula Compliance Rate** | 100.00% (500/500) | 100.00% (524/524) | **100.00% (1,024/1,024)** |
| **High Confidence ($\ge 80$)** | 500 (100.0%) | 486 (92.7%) | **986 (96.3%)** |
| **Moderate Confidence (60–79)**| 0 (0.0%) | 29 (5.5%) | **29 (2.8%)** |
| **Low Confidence ($< 60$)** | 0 (0.0%) | 9 (1.8%) | **9 (0.9%)** |
| **Mean Confidence Score** | **100.0 / 100** | **94.2 / 100** | **97.0 / 100** |

All 500 Catalog-500 items achieve **100/100 High Confidence** owing to comprehensive FSSAI laboratory nutrition panels, verified ingredient predominance orders, and verified NOVA classifications.

The complete per-product record is recorded in `reports/smartchoice_score_audit_1024.csv`.
