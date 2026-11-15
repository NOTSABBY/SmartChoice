const assert = require('assert');
const { classifyProductDairy } = require('../services/dairyClassificationService');

console.log('Testing dairyClassificationService against Section 11 test cases:');

// 1. Cow ghee with verified dairy identity
const cowGhee = {
  product_name: 'Mother Dairy Ultimate Cow Ghee',
  nutrition_info: { ingredients_text: 'Milk Fat (100%)', allergens: ['Milk'], verification_status: 'VERIFIED' }
};
const res1 = classifyProductDairy(cowGhee);
assert.equal(res1.classification, 'DAIRY_CONTAINS');
console.log('✔ Case 1: Cow ghee -> DAIRY_CONTAINS');

// 2. Butter
const butter = {
  product_name: 'Amul Butter',
  nutrition_info: { ingredients_text: 'Butter, Common Salt', allergens: ['Milk'], verification_status: 'VERIFIED' }
};
const res2 = classifyProductDairy(butter);
assert.equal(res2.classification, 'DAIRY_CONTAINS');
console.log('✔ Case 2: Butter -> DAIRY_CONTAINS');

// 3. Milk powder
const milkPowder = {
  product_name: 'Everyday Dairy Whitener',
  nutrition_info: { ingredients_text: 'Partially Skimmed Milk Powder, Sugar', allergens: ['Milk'], verification_status: 'VERIFIED' }
};
const res3 = classifyProductDairy(milkPowder);
assert.equal(res3.classification, 'DAIRY_CONTAINS');
console.log('✔ Case 3: Milk powder -> DAIRY_CONTAINS');

// 4. Whey protein
const wheyBar = {
  product_name: 'Yoga Bar 20g Protein',
  nutrition_info: { ingredients_text: 'Whey Protein Concentrate, Almonds, Dates', allergens: ['Milk'], verification_status: 'VERIFIED' }
};
const res4 = classifyProductDairy(wheyBar);
assert.equal(res4.classification, 'DAIRY_CONTAINS');
console.log('✔ Case 4: Whey protein -> DAIRY_CONTAINS');

// 5. Casein
const caseinProd = {
  product_name: 'Micellar Casein Powder',
  nutrition_info: { ingredients_text: 'Calcium Caseinate, Cocoa Powder', allergens: ['Milk'], verification_status: 'VERIFIED' }
};
const res5 = classifyProductDairy(caseinProd);
assert.equal(res5.classification, 'DAIRY_CONTAINS');
console.log('✔ Case 5: Casein -> DAIRY_CONTAINS');

// 6. Product with explicit milk ingredient
const milkBiscuit = {
  product_name: 'Britannia Milk Bikis',
  nutrition_info: { ingredients_text: 'Refined Wheat Flour, Sugar, Condensed Milk, Milk Solids', allergens: ['Wheat', 'Milk'], verification_status: 'VERIFIED' }
};
const res6 = classifyProductDairy(milkBiscuit);
assert.equal(res6.classification, 'DAIRY_CONTAINS');
console.log('✔ Case 6: Explicit milk ingredient -> DAIRY_CONTAINS');

// 7. Product with only "may contain milk"
const mayContainProd = {
  product_name: 'Ching Secret Hakka Noodles',
  nutrition_info: {
    ingredients_text: 'Refined Wheat Flour, Wheat Gluten, Iodised Salt. May contain Soy, Mustard, Milk and Celery',
    allergens: ['Wheat'],
    may_contain: ['Milk', 'Soy', 'Mustard', 'Celery'],
    verification_status: 'VERIFIED'
  }
};
const res7 = classifyProductDairy(mayContainProd);
assert.equal(res7.classification, 'DAIRY_MAY_CONTAIN');
assert.equal(res7.isDairyFree, false);
console.log('✔ Case 7: Only "may contain milk" -> DAIRY_MAY_CONTAIN');

// 8. Verified plant-based milk alternative
const almondMilk = {
  product_name: 'Raw Pressery Almond Milk Unsweetened',
  nutrition_info: { ingredients_text: 'Water, Almonds (12%), Sea Salt', allergens: ['Almond'], verification_status: 'VERIFIED' }
};
const res8 = classifyProductDairy(almondMilk);
assert.notEqual(res8.classification, 'DAIRY_CONTAINS');
assert.equal(res8.classification, 'DAIRY_FREE_VERIFIED');
console.log('✔ Case 8: Verified plant-based milk alternative -> DAIRY_FREE_VERIFIED (Not DAIRY_CONTAINS)');

// 9. Verified dairy-free product
const oats = {
  product_name: 'Quaker Rolled Oats',
  nutrition_info: { ingredients_text: '100% Rolled Oats', allergens: ['Oats'], verification_status: 'VERIFIED' }
};
const res9 = classifyProductDairy(oats);
assert.equal(res9.classification, 'DAIRY_FREE_VERIFIED');
assert.equal(res9.isDairyFree, true);
console.log('✔ Case 9: Verified dairy-free product -> DAIRY_FREE_VERIFIED');

// 10. Missing ingredient list
const missingDataProd = {
  product_name: 'Mystery Snack',
  nutrition_info: { ingredients_text: '', allergens: [], verification_status: 'UNAVAILABLE' }
};
const res10 = classifyProductDairy(missingDataProd);
assert.equal(res10.classification, 'DAIRY_UNKNOWN');
assert.equal(res10.isDairyFree, false);
console.log('✔ Case 10: Missing ingredient list -> DAIRY_UNKNOWN');

// 11. Conflicting product evidence (claims Dairy-Free but contains Milk Solids)
const conflictProd = {
  product_name: 'Vegan Cookie (Dairy-Free)',
  nutrition_info: { ingredients_text: 'Oat flour, Sugar, Milk Solids, Cocoa', allergens: ['Milk'], verification_status: 'VERIFIED' }
};
const res11 = classifyProductDairy(conflictProd);
assert.equal(res11.classification, 'DAIRY_CONFLICTING_EVIDENCE');
console.log('✔ Case 11: Conflicting product evidence -> DAIRY_CONFLICTING_EVIDENCE');

// 12. Vegan product with adequate dairy-free evidence
const veganBar = {
  product_name: 'Yoga Bar Dark Chocolate Vegan Bar',
  dietaryClassification: { isVegan: true },
  nutrition_info: { ingredients_text: 'Dates, Oats, Almonds, Cocoa Butter, Cocoa Solids', allergens: ['Almond'], verification_status: 'VERIFIED' }
};
const res12 = classifyProductDairy(veganBar);
assert.equal(res12.classification, 'DAIRY_FREE_VERIFIED');
console.log('✔ Case 12: Vegan product with adequate dairy-free evidence -> DAIRY_FREE_VERIFIED');

// 13. Vegan product with insufficient evidence
const veganUnknown = {
  product_name: 'Vegan Candy',
  dietaryClassification: { isVegan: true },
  nutrition_info: { ingredients_text: '', allergens: [], verification_status: 'UNVERIFIED' }
};
const res13 = classifyProductDairy(veganUnknown);
assert.equal(res13.classification, 'DAIRY_UNKNOWN');
console.log('✔ Case 13: Vegan product with insufficient evidence -> DAIRY_UNKNOWN');

console.log('All Section 11 mandatory edge cases passed successfully!');
