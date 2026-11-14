# Nutrition Analysis Methodology & Regulatory Alignments

## 1. Category Formats & Threshold Matrices
The engine evaluates 4 distinct category formats:
- `SOLID_FOOD`: UK FSA / FSSAI criteria per 100g.
- `BEVERAGE_GENERAL`: Beverage criteria per 100ml.
- `BEVERAGE_DAIRY`: Dairy beverage criteria accounting for intrinsic lactose (~4.8g/100ml).
- `COOKING_OIL`: Edible oil lipid criteria (saturated fat boundaries; sodium/sugar explicitly UNCLASSIFIED).

## 2. Trans-Fat Evaluation
- Statutory compliance (< 2.0% of fat) requires certified analytical gas chromatography data; standard label data yields `REGULATORY_COMPLIANCE_UNVERIFIABLE`.
- Claims (< 0.2g/100g solids/liquids, < 1.0g/100g cooking oils) are decoupled from saturated fat and strictly normalized from serving declarations.