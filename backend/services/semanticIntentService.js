/**
 * SmartChoice Semantic Intent Understanding Service
 * 
 * Analyzes natural-language queries to determine:
 * 1. Query intent type: POSITIVE, NEGATIVE_EXCLUSION, COMPOUND_MODIFIED, ALTERNATIVE_SEEKING.
 * 2. Target product concepts and categories sought.
 * 3. Excluded product concepts and identities.
 * 4. Product modifiers (e.g. dark, plant-based, unsweetened, crunchy).
 */

const { normalizeQuery } = require('./productNameNormalizationService');

/**
 * Parses a natural language user query into a structured semantic intent.
 * @param {string} rawQuery 
 * @returns {Object} Structured intent representation
 */
function parseSemanticIntent(rawQuery) {
  if (!rawQuery || typeof rawQuery !== 'string') {
    return {
      rawQuery: '',
      cleanQuery: '',
      queryType: 'GENERAL',
      targetConcepts: [],
      excludedConcepts: [],
      modifiers: [],
      isSeekingAlternatives: false,
      intentDescription: 'Empty query'
    };
  }

  const { cleanQuery, tokens } = normalizeQuery(rawQuery);
  const q = cleanQuery;

  const targetConcepts = [];
  const excludedConcepts = [];
  const modifiers = [];
  let isSeekingAlternatives = false;
  let queryType = 'POSITIVE';

  // 1. Detect Alternative-Seeking Queries (e.g. "milk alternatives", "plant-based alternatives to dairy")
  if (/\b(?:alternatives?|substitutes?)\b/i.test(q) || /\b(?:plant[- ]based|vegan)\s+milks?\b/i.test(q)) {
    isSeekingAlternatives = true;
    queryType = 'ALTERNATIVE_SEEKING';
    if (/\b(?:dairy|milk)\b/i.test(q)) {
      targetConcepts.push('plant_milk_alternative');
    }
  }

  // 2. Detect Negative / Exclusion Patterns
  // e.g. "dairy-free", "without dairy", "not dairy", "excluding dairy", "free from milk", "no dairy"
  const isDairyExclusion = /\b(?:dairy[- ]free|free\s+from\s+dairy|without\s+dairy|no\s+dairy|non[- ]dairy|not\s+dairy|excluding\s+dairy|exclude\s+dairy)\b/i.test(q) ||
                           /\b(?:products?\s+that\s+are\s+not\s+dairy|products?\s+without\s+dairy|products?\s+excluding\s+dairy)\b/i.test(q);

  const isMilkExclusion = /\b(?:milk[- ]free|free\s+from\s+milk|without\s+milk|no\s+milk|not\s+milk|excluding\s+milk|without\s+milk[- ]derived)\b/i.test(q);

  const isSugarExclusion = /\b(?:sugar[- ]free|free\s+from\s+sugar|without\s+sugar|no\s+sugar|zero\s+sugar|unsweetened)\b/i.test(q);

  const isGlutenExclusion = /\b(?:gluten[- ]free|free\s+from\s+gluten|without\s+gluten|no\s+gluten)\b/i.test(q);

  const isCaffeineExclusion = /\b(?:caffeine[- ]free|without\s+caffeine|no\s+caffeine|decaf)\b/i.test(q);

  if (isDairyExclusion || isMilkExclusion) {
    excludedConcepts.push('dairy');
    excludedConcepts.push('milk');
  }
  if (isSugarExclusion) excludedConcepts.push('sugar');
  if (isGlutenExclusion) excludedConcepts.push('gluten');
  if (isCaffeineExclusion) excludedConcepts.push('caffeine');

  // 3. Detect Positive Food Concepts in Query
  // Check for concepts independently of exclusion phrases
  // e.g. In "chocolate without dairy", positive concept is "chocolate", excluded is "dairy"
  const queryWithoutExclusions = q
    .replace(/\b(?:dairy[- ]free|without\s+dairy|no\s+dairy|non[- ]dairy|not\s+dairy|excluding\s+dairy|milk[- ]free|without\s+milk|no\s+milk)\b/gi, ' ')
    .replace(/\b(?:sugar[- ]free|without\s+sugar|no\s+sugar|zero\s+sugar|gluten[- ]free|without\s+gluten|caffeine[- ]free)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Concept extractors on residual positive query
  if (/\b(?:chocolate|choco|chocolates|cocoa|cacao)\b/i.test(queryWithoutExclusions)) {
    targetConcepts.push('chocolate');
  }
  if (/\b(?:biscuit|biscuits|cookie|cookies|rusk|crackers?)\b/i.test(queryWithoutExclusions)) {
    targetConcepts.push('biscuits');
  }
  if (/\b(?:snack|snacks|chips|crisps|namkeen|bhujia|sev|wafers?|nachos?)\b/i.test(queryWithoutExclusions)) {
    targetConcepts.push('snacks');
  }
  if (/\b(?:juice|juices|nectar|squash)\b/i.test(queryWithoutExclusions)) {
    targetConcepts.push('juice');
  }
  if (/\b(?:cereal|cereals|oats?|oatmeal|muesli|granola|cornflakes)\b/i.test(queryWithoutExclusions)) {
    targetConcepts.push('cereal');
  }
  if (/\b(?:noodles?|pasta|macaroni|spaghetti|ramen)\b/i.test(queryWithoutExclusions)) {
    targetConcepts.push('noodles');
  }
  if (/\b(?:tea|coffee|chai|espresso|cappuccino)\b/i.test(queryWithoutExclusions)) {
    targetConcepts.push('tea_coffee');
  }
  if (/\b(?:oil|oils|mustard\s*oil|sunflower\s*oil|olive\s*oil)\b/i.test(queryWithoutExclusions)) {
    targetConcepts.push('oil');
  }
  if (/\b(?:atta|flour|dal|dhal|pulses|lentils?)\b/i.test(queryWithoutExclusions)) {
    targetConcepts.push('flour_dal');
  }
  if (/\b(?:spice|spices|masala|turmeric|chilli|pepper)\b/i.test(queryWithoutExclusions)) {
    targetConcepts.push('spices');
  }
  if (/\b(?:spread|spreads|jam|jams|honey|peanut\s*butter)\b/i.test(queryWithoutExclusions)) {
    targetConcepts.push('spreads');
  }

  // Pure Positive Dairy checks (when NOT excluded!)
  if (!excludedConcepts.includes('dairy')) {
    if (/\b(?:dairy|dairy\s*products?|dairy\s*items?)\b/i.test(q)) {
      targetConcepts.push('dairy');
    }
    if (/\b(?:milk|cow\s*milk|toned\s*milk)\b/i.test(q) && !targetConcepts.includes('chocolate') && !targetConcepts.includes('biscuits')) {
      targetConcepts.push('milk');
    }
    if (/\b(?:cheese|cheddar|mozzarella)\b/i.test(q)) {
      targetConcepts.push('cheese');
    }
    if (/\b(?:butter)\b/i.test(q) && !q.includes('peanut butter')) {
      targetConcepts.push('butter');
    }
    if (/\bghee\b/i.test(q)) {
      targetConcepts.push('ghee');
    }
    if (/\b(?:yogurt|curd|dahi|shrikhand)\b/i.test(q)) {
      targetConcepts.push('yogurt');
    }
    if (/\bpaneer\b/i.test(q)) {
      targetConcepts.push('paneer');
    }
  }

  // 4. Modifiers extraction
  if (/\bdark\b/i.test(q)) modifiers.push('dark');
  if (/\bcrunchy\b/i.test(q)) modifiers.push('crunchy');
  if (/\bcreamy\b/i.test(q)) modifiers.push('creamy');
  if (/\bplant[- ]based\b/i.test(q)) modifiers.push('plant-based');
  if (/\borganic\b/i.test(q)) modifiers.push('organic');
  if (/\bunsweetened\b/i.test(q)) modifiers.push('unsweetened');
  if (/\bsalted\b/i.test(q)) modifiers.push('salted');
  if (/\bmasala\b/i.test(q)) modifiers.push('masala');

  // 5. Determine overall queryType
  if (isSeekingAlternatives) {
    queryType = 'ALTERNATIVE_SEEKING';
  } else if (excludedConcepts.length > 0 && targetConcepts.length > 0) {
    queryType = 'COMPOUND_MODIFIED'; // e.g. "chocolate without dairy"
  } else if (excludedConcepts.length > 0) {
    queryType = 'NEGATIVE_EXCLUSION'; // e.g. "dairy-free", "non-dairy"
  } else if (targetConcepts.length > 0) {
    queryType = 'POSITIVE'; // e.g. "dairy", "milk", "cheese", "chocolate"
  } else {
    queryType = 'GENERAL';
  }

  // 6. Generate human-readable intent description
  let intentDescription = '';
  if (queryType === 'NEGATIVE_EXCLUSION') {
    intentDescription = `Excluding product identities representing ${excludedConcepts.join(', ')}`;
  } else if (queryType === 'COMPOUND_MODIFIED') {
    intentDescription = `Seeking ${targetConcepts.join(', ')} while excluding ${excludedConcepts.join(', ')}`;
  } else if (queryType === 'ALTERNATIVE_SEEKING') {
    intentDescription = `Seeking plant-based non-dairy alternatives`;
  } else if (queryType === 'POSITIVE') {
    intentDescription = `Seeking product identities representing ${targetConcepts.join(', ')}`;
  } else {
    intentDescription = `General semantic search for '${rawQuery.trim()}'`;
  }

  return {
    rawQuery: rawQuery.trim(),
    cleanQuery,
    tokens,
    queryType,
    targetConcepts: Array.from(new Set(targetConcepts)),
    excludedConcepts: Array.from(new Set(excludedConcepts)),
    modifiers,
    isSeekingAlternatives,
    intentDescription
  };
}

module.exports = {
  parseSemanticIntent
};
