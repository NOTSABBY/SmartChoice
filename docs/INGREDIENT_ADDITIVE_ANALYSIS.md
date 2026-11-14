# Ingredient, Additive & Allergen Analysis

## 1. Additive Neutrality & INS Coding
Food additives are identified via `backend/data/fssai/additivesReference.json`. Identified additives are functionally classified (preservative, antioxidant, emulsifier, color, flavor enhancer) without pejorative labels. Additives serving cosmetic ultra-processing roles are flagged for NOVA corroboration.

## 2. Mandatory FSSAI Allergen Classes
Monitors the 8 mandatory classes under FSSAI Labelling Regulations:
1. Cereals containing gluten
2. Crustaceans
3. Milk and dairy
4. Eggs
5. Fish
6. Peanuts and tree nuts
7. Soybeans
8. Sulphites (>= 10 ppm)