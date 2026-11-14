# Scoring Engine API Reference

## Endpoints

### 1. Single Product Score
`GET /api/products/:id/score`
Returns deterministic scoring evaluation for a product.

### 2. Response Structure
```json
{
  "totalScore": 85,
  "breakdown": {
    "nutrition": 90,
    "ingredients": 85,
    "processing": 100,
    "proteinFiber": 75,
    "preferences": 70
  },
  "appliedWeights": {
    "nutrition": 0.40,
    "ingredients": 0.20,
    "processing": 0.15,
    "proteinFiber": 0.15,
    "preferences": 0.10
  },
  "confidence": {
    "score": 90,
    "level": "high"
  },
  "coverage": {
    "nutritionCoverage": { "evaluatedCount": 4, "missingCount": 0, "categoryFormat": "SOLID_FOOD" },
    "ingredientCoverage": { "parseStatus": "PARSED_SUCCESSFULLY", "totalIngredients": 3, "totalAdditives": 0 }
  },
  "positiveFactors": ["Low sugar content", "No listed food additives detected"],
  "negativeFactors": [],
  "limitations": [],
  "explanation": "Overall score of 85/100 calculated from Nutrition (90/100, 40% wt)..."
}
```