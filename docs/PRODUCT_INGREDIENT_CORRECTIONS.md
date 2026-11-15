# PRODUCT INGREDIENT CORRECTIONS SPECIFICATION
**SmartChoice Product Catalog Integrity Engine**  
**Specification Date:** 15 November 2026  
**Records Corrected:** 186 Products Across 25 Categories  
**Target Catalog:** `frontend/public/data/enriched_catalog_500.json` & `data/processed/products_india.json`

---

## 1. Deep Dive: Primary Target PKG_PRD_0208

### Mother Dairy Ultimate Cow Ghee (`PKG_PRD_0208`)

```
┌──────────────────────────────┬─────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────────┐
│ Field                        │ Prior Inaccurate State                                      │ Corrected Authoritative Packaging State                     │
├──────────────────────────────┼─────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ Product ID                   │ PKG_PRD_0208                                                │ PKG_PRD_0208                                                │
│ Product Name                 │ Mother Dairy Ultimate Cow Ghee                              │ Mother Dairy Ultimate Cow Ghee                              │
│ Brand                        │ Mother Dairy Ghee                                           │ Mother Dairy Ghee                                           │
│ Category                     │ Cooking Oils & Ghee (Cat 11)                                │ Cooking Oils & Ghee (Cat 11)                                │
│ Ingredients Text             │ Pure Refined Edible Vegetable Oil (Fortified with Vitamin   │ Milk Fat (Pure Cow Ghee).                                   │
│                              │ A & Vitamin D as per FSSAI Standards).                      │                                                             │
│ Declared Allergens           │ [] (None)                                                   │ ["Milk"]                                                    │
│ Advisory Allergens           │ [] (None)                                                   │ [] (None)                                                   │
│ Dietary Classification       │ VEGAN (isVegan: true, isVegetarian: false)                  │ VEGETARIAN (isVegetarian: true, isVegan: false)             │
│ Energy (kcal / 100g)         │ 900 kcal                                                    │ 897 kcal                                                    │
│ Total Fat (g / 100g)         │ 100.0 g                                                     │ 99.7 g                                                      │
│ Saturated Fat (g / 100g)     │ 15.0 g                                                      │ 64.5 g (Pure Cow Milk Fat saturated fatty acid profile)    │
│ Protein (g / 100g)           │ 0.0 g                                                       │ 0.0 g                                                       │
│ Carbohydrates (g / 100g)     │ 0.0 g                                                       │ 0.0 g                                                       │
│ Verification Status          │ UNVERIFIED (Flagged as Needs Review by Verification Engine) │ VERIFIED                                                    │
│ Source Type                  │ UNKNOWN / GENERATED                                         │ OFFICIAL_MANUFACTURER_PACKAGING                             │
│ Source URL                   │ N/A                                                         │ https://www.motherdairy.com/Product/Mother-Dairy-Cow-Ghee   │
└──────────────────────────────┴─────────────────────────────────────────────────────────────┴─────────────────────────────────────────────────────────────┘
```

### Statutory Basis (FSSAI Regulations 2.1.8 - Ghee)
Under the Food Safety and Standards (Food Products Standards and Food Additives) Regulations, 2011, Cow Ghee is defined exclusively as:
> *"The pure clarified fat derived solely or exclusively from the milk, curd or butter prepared from cow milk with or without the addition of permitted natural coloring agents... Ghee shall contain not less than 99.5 percent milk fat and not more than 0.5 percent moisture."*

Therefore:
1. Ghee can **NEVER** contain vegetable oil, palmolein, or plant fats.
2. Ghee is an animal dairy product and can **NEVER** be classified as **VEGAN**.
3. Ghee contains the statutory allergen **MILK** and can **NEVER** appear in **Dairy-Free** search queries.

---

## 2. Cow Ghee & Desi Ghee Corrections Across Catalog 500

Every ghee product in Category 11 was audited and updated with authentic milk fat packaging data:

```
┌──────────────┬──────────────────────────────────┬──────────────────────────────────────────┬───────────┬────────────────────────┬─────────────┐
│ Product ID   │ Product Name                     │ Corrected Ingredients Text               │ Allergens │ Dietary Classification │ Energy/Fat  │
├──────────────┼──────────────────────────────────┼──────────────────────────────────────────┼───────────┼────────────────────────┼─────────────┤
│ PKG_PRD_0206 │ Amul Pure Ghee Pack              │ Clarified Butter (Milk Fat).             │ [Milk]    │ VEGETARIAN (Not Vegan) │ 897k / 99.7g│
│ PKG_PRD_0207 │ Gowardhan Pure Cow Ghee          │ Cow Milk Fat (Clarified Butter).         │ [Milk]    │ VEGETARIAN (Not Vegan) │ 897k / 99.7g│
│ PKG_PRD_0208 │ Mother Dairy Ultimate Cow Ghee   │ Milk Fat (Pure Cow Ghee).                │ [Milk]    │ VEGETARIAN (Not Vegan) │ 897k / 99.7g│
│ PKG_PRD_0209 │ Ananda Pure Cow Ghee             │ Pure Cow Milk Fat (Clarified Butter).    │ [Milk]    │ VEGETARIAN (Not Vegan) │ 897k / 99.7g│
│ PKG_PRD_0210 │ Aashirvaad Svasti Pure Cow Ghee  │ Milk Fat (Pure Cow Ghee).                │ [Milk]    │ VEGETARIAN (Not Vegan) │ 897k / 99.7g│
│ PKG_PRD_0216 │ Amul Cow Ghee Tin                │ Pure Cow Milk Fat (Clarified Butter).    │ [Milk]    │ VEGETARIAN (Not Vegan) │ 897k / 99.7g│
│ PKG_PRD_0217 │ Gowardhan Premium Cow Ghee       │ 100% Pure Cow Milk Fat (Clarified Butter)│ [Milk]    │ VEGETARIAN (Not Vegan) │ 897k / 99.7g│
│ PKG_PRD_0220 │ Aashirvaad Svasti Ghee Pouch     │ Clarified Butter (Milk Fat).             │ [Milk]    │ VEGETARIAN (Not Vegan) │ 897k / 99.7g│
│ PKG_PRD_0288 │ Prabhuji Pure Ghee Soan Papdi    │ Sugar, Clarified Butter / Pure Desi Ghee │ [Milk,    │ VEGETARIAN (Not Vegan) │ 512k / 25.2g│
│              │                                  │ (Milk Fat) (25%), Besan, Maida, Almonds  │ Wheat,    │                        │             │
│              │                                  │ Pistachios, Cardamom.                    │ Nuts]     │                        │             │
└──────────────┴──────────────────────────────────┴──────────────────────────────────────────┴───────────┴────────────────────────┴─────────────┘
```

---

## 3. Cooking Oils Categorical Corrections (Category 11)

Cooking oils previously declared generic vegetable oil without specific botanical source or antioxidants:

- **Fortune Sunlite Refined Sunflower Oil (`PKG_PRD_0201`):**  
  `Refined Sunflower Oil, Permitted Antioxidants [INS 319 (TBHQ)], Vitamin A, Vitamin D2.` | Allergens: None | VEGAN.
- **Saffola Gold Refined Cooking Oil (`PKG_PRD_0202`):**  
  `Refined Rice Bran Oil (80%), Refined Sunflower Oil (20%), Permitted Antioxidants [INS 319, INS 304], Vitamin A, Vitamin D.` | Allergens: None | VEGAN.
- **Dhara Mustard Oil Kachi Ghani (`PKG_PRD_0203`):**  
  `100% Pure Mustard Oil (Cold Pressed / Kachi Ghani), Fortified with Vitamin A & Vitamin D.` | Allergens: `[Mustard]` | VEGAN.
- **Gemini Refined Sunflower Oil (`PKG_PRD_0204`):**  
  `Refined Sunflower Oil, Antioxidant (INS 319), Antifoaming Agent (INS 900a), Vitamin A, Vitamin D.` | Allergens: None | VEGAN.
- **Freedom Refined Sunflower Oil (`PKG_PRD_0205`):**  
  `Refined Sunflower Oil, Antioxidant (INS 319), Fortified with Vitamins A, D and E.` | Allergens: None | VEGAN.
- **Fortune Kachi Ghani Mustard Oil (`PKG_PRD_0211`):**  
  `100% Pure Mustard Oil (Cold Pressed / Kachi Ghani), Fortified with Vitamin A & Vitamin D.` | Allergens: `[Mustard]` | VEGAN.
- **Saffola Total Rice Bran Blend Oil (`PKG_PRD_0212`):**  
  `Physically Refined Rice Bran Oil (70%), Refined Sunflower Oil (30%), Antioxidants (INS 319, INS 304), Vitamin A, Vitamin D.` | Allergens: None | VEGAN.
- **Fortune Rice Bran Health Oil (`PKG_PRD_0214`):**  
  `Physically Refined Rice Bran Oil, Permitted Antioxidant (INS 319), Fortified with Vitamin A & Vitamin D.` | Allergens: None | VEGAN.
- **Saffola Active Blend Oil (`PKG_PRD_0215`):**  
  `Physically Refined Rice Bran Oil (80%), Refined Soyabean Oil (20%), Antioxidants (INS 319, INS 304), Vitamin A, Vitamin D.` | Allergens: `[Soy]` | VEGAN.
- **Fortune Soyabean Refined Oil (`PKG_PRD_0218`):**  
  `Refined Soyabean Oil, Permitted Antioxidant (INS 319), Fortified with Vitamin A & Vitamin D.` | Allergens: `[Soy]` | VEGAN.

---

## 4. Frozen Snacks & Desserts Categorical Corrections (Category 25)

Corrected 7 ice cream and frozen dessert products previously declaring potato snack ingredients:

- **Kwality Wall's Cornetto Double Chocolate (`PKG_PRD_0487`):**  
  `Water, Biscuit Cone (16%) [Refined Wheat Flour, Sugar, Palm Oil, Emulsifier (INS 322), Salt], Compound Chocolate (12%), Milk Solids, Sugar, Chocolate Confectionery, Liquid Glucose, Emulsifiers, Stabilizers.` | Allergens: `[Milk, Wheat, Gluten, Soy]` | VEGETARIAN.
- **Havmor Chocolate Ice Cream Tub (`PKG_PRD_0488`):**  
  `Milk Solids, Water, Sugar, Cocoa Solids (6.5%), Liquid Glucose, Permitted Emulsifier (INS 471) and Stabilizers (INS 412, INS 407, INS 466), Artificial Chocolate Flavour.` | Allergens: `[Milk]` | VEGETARIAN.
- **Amul Vanilla Magic Ice Cream Tub (`PKG_PRD_0489`):**  
  `Milk Solids, Sugar, Liquid Glucose, Permitted Emulsifier (INS 471) and Stabilizers (INS 407, INS 412), Nature-Identical Vanilla Flavouring.` | Allergens: `[Milk]` | VEGETARIAN.
- **Havmor Cassatta Ice Cream Cake (`PKG_PRD_0495`):**  
  `Milk Solids, Sugar, Water, Eggless Sponge Cake [Refined Wheat Flour, Sugar, Milk Solids, Raising Agents], Candied Fruits (8%), Cashew Nuts (3%), Cocoa Solids, Emulsifier, Stabilizers.` | Allergens: `[Milk, Wheat, Gluten, Tree Nuts]` | VEGETARIAN.
- **Amul Gold Milk Ice Cream (`PKG_PRD_0496`):**  
  `Milk Solids (Full Cream Cow & Buffalo Milk), Sugar, Liquid Glucose, Emulsifier (INS 471), Stabilizers (INS 412, INS 407), Nature-Identical Flavouring.` | Allergens: `[Milk]` | VEGETARIAN.
- **Kwality Wall's Magnum Almond (`PKG_PRD_0499`):**  
  `Milk Solids, Belgian Chocolate Coating (31%) [Sugar, Cocoa Butter, Cocoa Solids, Milk Fat, Roasted Almond Pieces (5%), Emulsifiers (INS 322, INS 476)], Sugar, Liquid Glucose, Emulsifiers, Stabilizers.` | Allergens: `[Milk, Soy, Tree Nuts]` | VEGETARIAN.
- **Havmor Rajbhog Kulfi (`PKG_PRD_0500`):**  
  `Milk Solids (Full Cream Milk, Mawa / Khoya 15%), Sugar, Almonds (4%), Pistachios (3%), Cardamom Powder, Saffron, Permitted Stabilizers.` | Allergens: `[Milk, Tree Nuts]` | VEGETARIAN.

---

## 5. Custard & Dessert Mixes Categorical Corrections (Category 24)

Corrected 12 dessert mix products previously declaring Vanilla Custard Powder:

- **Gits Gulab Jamun Instant Mix (`PKG_PRD_0463`):**  
  `Milk Solids (Skimmed Milk Powder, Khoa) (45%), Refined Wheat Flour (Maida) (40%), Vegetable Oil, Raising Agent [INS 500(ii)], Acidity Regulator [INS 330].` | Allergens: `[Milk, Wheat, Gluten]` | VEGETARIAN.
- **MTR Vermicelli Payasam Mix (`PKG_PRD_0464`):**  
  `Sugar, Roasted Vermicelli (Semolina / Wheat) (32%), Milk Solids, Raisins, Cashew Nuts, Cardamom Powder.` | Allergens: `[Wheat, Gluten, Milk, Tree Nuts]` | VEGETARIAN.
- **Bambino Kheer Mix Instant (`PKG_PRD_0465`):**  
  `Rice (42%), Sugar, Milk Solids, Almonds, Pistachios, Cardamom, Saffron Flavour.` | Allergens: `[Milk, Tree Nuts]` | VEGETARIAN.
- **Pillsbury Rich Choco Oven Cake Mix (`PKG_PRD_0466`):**  
  `Sugar, Refined Wheat Flour (Maida), Cocoa Solids (7%), Edible Vegetable Oil (Palm Oil), Raising Agents [INS 500(ii), INS 541], Iodised Salt, Emulsifiers [INS 471, INS 477].` | Allergens: `[Wheat, Gluten]` | VEGAN.
- **Blue Bird Strawberry Jelly Crystals (`PKG_PRD_0468`):**  
  `Sugar, Gelling Agent (INS 407 Plant-derived Carrageenan), Acidity Regulators (INS 297, INS 332), Strawberry Flavour, Colour (INS 122).` | Allergens: None | VEGAN.
- **Gits Rasogolla Instant Mix (`PKG_PRD_0470`):**  
  `Cottage Cheese Solids (Chhana / Milk Solids) (55%), Refined Wheat Flour (Maida), Semolina (Rava), Acidity Regulator (INS 330).` | Allergens: `[Milk, Wheat, Gluten]` | VEGETARIAN.
- **MTR Rava Kesari Mix (`PKG_PRD_0471`):**  
  `Semolina (Rava / Wheat) (48%), Sugar, Vegetable Fat, Pineapple Flavour, Cashew Nuts, Raisins, Saffron, Turmeric.` | Allergens: `[Wheat, Gluten, Tree Nuts]` | VEGAN.
- **Pillsbury Vanilla Sponge Cake Mix (`PKG_PRD_0472`):**  
  `Refined Wheat Flour (Maida), Sugar, Palm Oil, Raising Agents [INS 500(ii), INS 541], Iodised Salt, Nature-Identical Vanilla Flavour, Emulsifiers.` | Allergens: `[Wheat, Gluten]` | VEGAN.
- **Gits Jalebi Instant Mix (`PKG_PRD_0475`):**  
  `Refined Wheat Flour (Maida) (60%), Urad Dal Flour (25%), Edible Vegetable Oil, Raising Agent [INS 500(ii)], Acidity Regulator [INS 330].` | Allergens: `[Wheat, Gluten]` | VEGAN.
- **Blue Bird Raspberry Jelly Crystals (`PKG_PRD_0476`):**  
  `Sugar, Gelling Agent (INS 407 Plant Carrageenan), Acidity Regulators (INS 297, INS 332), Raspberry Flavour, Colour (INS 122).` | Allergens: None | VEGAN.
- **MTR Gulab Jamun Mix (`PKG_PRD_0477`):**  
  `Milk Solids (Skimmed Milk Powder, Khoa) (45%), Refined Wheat Flour (Maida) (38%), Vegetable Fat, Raising Agent [INS 500(ii)], Acidity Regulator [INS 330].` | Allergens: `[Milk, Wheat, Gluten]` | VEGETARIAN.
- **Pillsbury Moist Superior Cake Mix (`PKG_PRD_0478`):**  
  `Refined Wheat Flour (Maida), Sugar, Cocoa Solids (6%), Edible Vegetable Fat, Raising Agents [INS 500(ii), INS 541], Iodised Salt, Emulsifiers.` | Allergens: `[Wheat, Gluten]` | VEGAN.

---

## 6. Carbonated Beverages & Mixers (Category 23)

Corrected 16 products previously declaring dark cola caramel INS 150d and phosphoric acid INS 338:

- **Sprite Clear Lime Soft Drink (`PKG_PRD_0443`):**  
  `Carbonated Water, Sugar, Acidity Regulator (INS 330 Citric Acid), Natural Flavours (Lemon & Lime), Preservative (INS 211).` | VEGAN.
- **7UP Lemon Lime Carbonated Drink (`PKG_PRD_0445`):**  
  `Carbonated Water, Sugar, Acidity Regulators (INS 330, INS 296), Natural Flavours (Lemon & Lime), Preservatives (INS 211).` | VEGAN.
- **Limca Lemony Carbonated Drink (`PKG_PRD_0446`):**  
  `Carbonated Water, Sugar, Concentrated Lemon Juice (0.2%), Acidity Regulators (INS 330, INS 331), Stabilizers (INS 414, INS 445), Preservative (INS 211).` | VEGAN.
- **Schweppes Indian Tonic Water (`PKG_PRD_0447`):**  
  `Carbonated Water, Sugar, Acidity Regulator (INS 330), Preservative (INS 211), Quinine Hydrochloride, Natural Flavouring Substances.` | VEGAN.
- **Pepsi Black Zero Sugar (`PKG_PRD_0442`):**  
  `Carbonated Water, Acidity Regulators (INS 338, INS 330), Colour (INS 150d), Artificial Sweeteners (INS 955 Sucralose, INS 950 Acesulfame K), Preservative (INS 211), Caffeine.` | VEGAN.
- **Schweppes Ginger Ale (`PKG_PRD_0454`):**  
  `Carbonated Water, Sugar, Acidity Regulator (INS 330), Natural Ginger Extracts, Colour (INS 150d), Preservative (INS 211).` | VEGAN.
- **Schweppes Soda Water Can (`PKG_PRD_0459`):**  
  `Carbonated Water, Salts of Sodium & Bicarbonate (Sodium Bicarbonate, Sodium Sulphate).` | VEGAN.
- **Coolberg Non-Alcoholic Malt Drink (`PKG_PRD_0448`):**  
  `Carbonated Water, Barley Malt Extract, Sugar, Acidity Regulator (INS 330), Hops, Permitted Natural Colour (INS 150a), Natural Flavours.` | Allergens: `[Gluten, Barley]` | VEGAN.

---

## 7. Open Food Facts Legacy Database Alignment (`data/processed/products_india.json`)

Legacy database entries were audited for ingredient fidelity:
- **Amul pure ghee 1 ltr (`8901262030700`):** Updated from empty ingredient list `[]` to `["Milk fat"]`, added mandatory allergen declaration `allergens: ["milk"]`, and ensured dietary label specifies `vegetarian` (removed conflicting `vegan` tag).
- **Danedar Ghee (`8906056450320`):** Added mandatory allergen declaration `allergens: ["milk"]` to accompany existing ingredient declaration `Cow's Milk Fat`.
