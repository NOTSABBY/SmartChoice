const assert = require('assert');
const { executeSemanticSearch } = require('../services/semanticSearchEngine');

async function runTests() {
  console.log('Testing Semantic Query Intent Interpretation and Retrieval:');

  // Query 1: "dairy-free products"
  const q1 = await executeSemanticSearch('dairy-free products', { limit: 500 });
  console.log(`1. "dairy-free products": ${q1.totalMatches} matches`);
  assert.equal(q1.intent.dairyRequirement, 'DAIRY_FREE');
  assert.equal(q1.totalMatches, 280, 'Must return exactly 280 verified dairy-free products');
  q1.data.forEach(item => {
    assert.equal(item.dairyClassification.classification, 'DAIRY_FREE_VERIFIED');
    assert.equal(item.dairyClassification.isDairyFree, true);
  });
  console.log('✔ "dairy-free products" strictly returns DAIRY_FREE_VERIFIED items only');

  // Query 2: "dairy products"
  const q2 = await executeSemanticSearch('dairy products', { limit: 500 });
  console.log(`2. "dairy products": ${q2.totalMatches} matches`);
  assert.equal(q2.intent.dairyRequirement, 'DAIRY_CONTAINS');
  assert.equal(q2.totalMatches, 182, 'Must return exactly 182 verified dairy-containing products');
  q2.data.forEach(item => {
    assert.equal(item.dairyClassification.classification, 'DAIRY_CONTAINS');
    assert.equal(item.dairyClassification.isDairyFree, false);
  });
  console.log('✔ "dairy products" strictly returns DAIRY_CONTAINS items only');

  // Query 3: "products without milk"
  const q3 = await executeSemanticSearch('products without milk', { limit: 500 });
  console.log(`3. "products without milk": ${q3.totalMatches} matches`);
  assert.equal(q3.intent.dairyRequirement, 'DAIRY_FREE');
  assert.equal(q3.totalMatches, 280);
  console.log('✔ "products without milk" strictly returns DAIRY_FREE_VERIFIED items');

  // Query 4: "products that may contain milk"
  const q4 = await executeSemanticSearch('products that may contain milk', { limit: 500 });
  console.log(`4. "products that may contain milk": ${q4.totalMatches} matches`);
  assert.equal(q4.intent.dairyRequirement, 'DAIRY_MAY_CONTAIN');
  assert.equal(q4.totalMatches, 38, 'Must return exactly 38 precautionary cross-contact products');
  q4.data.forEach(item => {
    assert.equal(item.dairyClassification.classification, 'DAIRY_MAY_CONTAIN');
  });
  console.log('✔ "products that may contain milk" strictly returns DAIRY_MAY_CONTAIN items');

  // Query 5: "milk-free chocolate"
  const q5 = await executeSemanticSearch('milk-free chocolate', { limit: 50 });
  console.log(`5. "milk-free chocolate": ${q5.totalMatches} matches`);
  assert.equal(q5.intent.dairyRequirement, 'DAIRY_FREE');
  assert.ok(q5.totalMatches > 0);
  q5.data.forEach(item => {
    assert.equal(item.dairyClassification.classification, 'DAIRY_FREE_VERIFIED');
    assert.equal(item.dairyClassification.isDairyFree, true);
  });
  const top10 = q5.data.slice(0, 10);
  assert.ok(top10.some(i => i.product.product_id === 'PKG_PRD_0370')); // Urban Platter Dark Chocolate Chips
  console.log('✔ "milk-free chocolate" strictly returns DAIRY_FREE_VERIFIED chocolate items');

  // Query 6: "snacks containing milk"
  const q6 = await executeSemanticSearch('snacks containing milk', { limit: 50 });
  console.log(`6. "snacks containing milk": ${q6.totalMatches} matches`);
  assert.equal(q6.intent.dairyRequirement, 'DAIRY_CONTAINS');
  assert.ok(q6.totalMatches > 0);
  q6.data.forEach(item => {
    assert.equal(item.dairyClassification.classification, 'DAIRY_CONTAINS');
  });
  console.log('✔ "snacks containing milk" returns dairy snacks with DAIRY_CONTAINS');

  // Query 7: "plant-based alternatives to dairy"
  const q7 = await executeSemanticSearch('plant-based alternatives to dairy', { limit: 50 });
  console.log(`7. "plant-based alternatives to dairy": ${q7.totalMatches} matches`);
  assert.equal(q7.intent.dairyRequirement, 'DAIRY_FREE');
  q7.data.forEach(item => {
    assert.equal(item.dairyClassification.classification, 'DAIRY_FREE_VERIFIED');
  });
  console.log('✔ "plant-based alternatives to dairy" returns DAIRY_FREE_VERIFIED items');

  console.log('\nAll Semantic Query Tests Passed Successfully!');
}

runTests().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
