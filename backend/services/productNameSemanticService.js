/**
 * SmartChoice Product Name Semantic Identity Service
 * 
 * Evaluates product identity, food taxonomy, synonyms, and product-type relationships
 * based STRICTLY AND EXCLUSIVELY on product-name information (and canonical category context).
 * 
 * CRITICAL RULE:
 * Absolutely NO access to ingredients, nutrition facts, allergens, processing data,
 * health claims, or analysis scores. The product name is the authoritative searchable identity.
 */

const { normalizeProductName } = require('./productNameNormalizationService');

// Plant-based / vegan modifier patterns that convert a dairy-sounding word into a non-dairy alternative
const PLANT_MODIFIERS = [
  'almond', 'soy', 'soya', 'oat', 'oats', 'coconut', 'cashew', 'pea', 'hemp', 'rice',
  'peanut', 'shea', 'cocoa', 'cacao', 'apple', 'mango', 'kokum', 'plant based', 'plant-based',
  'vegan', 'dairy free', 'dairy-free', 'non dairy', 'non-dairy'
];

// Product Concept Ontology based on product names
const CONCEPT_ONTOLOGY = {
  // Dairy Product Concepts
  DAIRY: {
    name: 'dairy',
    canonicalTerms: ['dairy', 'milk', 'cheese', 'butter', 'ghee', 'yogurt', 'curd', 'dahi', 'paneer', 'lassi', 'chaas', 'buttermilk', 'cream', 'shrikhand', 'ice cream', 'kulfi'],
    patterns: [
      /\b(?:milk|cheese|butter|ghee|yogurt|curd|dahi|paneer|lassi|chaas|buttermilk|cream|shrikhand|ice\s*cream|kulfi|khoa|khoya)\b/i
    ],
    // Terms that look like dairy but are plant-based when paired with specific modifiers
    plantSubstitutes: ['almond milk', 'soy milk', 'soya milk', 'oat milk', 'coconut milk', 'cashew milk', 'peanut butter', 'almond butter', 'cocoa butter']
  },
  MILK: {
    name: 'milk',
    canonicalTerms: ['milk', 'toned milk', 'cow milk', 'full cream milk', 'pasteurized milk', 'skimmed milk'],
    patterns: [/\bmilk\b/i]
  },
  CHEESE: {
    name: 'cheese',
    canonicalTerms: ['cheese', 'cheddar', 'mozzarella', 'processed cheese', 'cheese slices', 'cheese cubes', 'cheese blocks', 'pizza cheese'],
    patterns: [/\b(?:cheese|cheddar|mozzarella|parmesan|gouda)\b/i]
  },
  BUTTER: {
    name: 'butter',
    canonicalTerms: ['butter', 'pasteurized butter', 'table butter', 'cooking butter', 'salted butter', 'unsalted butter'],
    patterns: [/\bbutter\b/i]
  },
  GHEE: {
    name: 'ghee',
    canonicalTerms: ['ghee', 'cow ghee', 'desi ghee', 'pure ghee'],
    patterns: [/\bghee\b/i]
  },
  YOGURT: {
    name: 'yogurt',
    canonicalTerms: ['yogurt', 'curd', 'dahi', 'greek yogurt', 'shrikhand'],
    patterns: [/\b(?:yogurt|curd|dahi|shrikhand)\b/i]
  },
  PANEER: {
    name: 'paneer',
    canonicalTerms: ['paneer', 'cottage cheese'],
    patterns: [/\b(?:paneer|cottage\s*cheese)\b/i]
  },

  // Chocolate & Confectionery
  CHOCOLATE: {
    name: 'chocolate',
    canonicalTerms: ['chocolate', 'choco', 'cocoa', 'cacao', 'dark chocolate', 'milk chocolate', 'white chocolate', 'truffle', 'praline', 'chocobar', 'cadbury', 'kitkat', 'snickers', 'milkybar', 'toblerone', 'kinder', 'ferrero'],
    patterns: [/\b(?:chocolate|choco|chocolates|cocoa|cacao|truffle|praline|fudge|cadbury|milkybar|toblerone|kinder|kitkat|snickers|ferrero|raffaello)\b/i]
  },

  // Biscuits & Cookies
  BISCUITS: {
    name: 'biscuits',
    canonicalTerms: ['biscuit', 'biscuits', 'cookie', 'cookies', 'rusk', 'cracker', 'shortbread', 'cream wafer', 'dark fantasy', 'choco fills'],
    patterns: [/\b(?:biscuit|biscuits|cookie|cookies|rusk|rusks|cracker|crackers|cream\s*wafers?|dark\s*fantasy|choco\s*fills)\b/i]
  },

  // Snacks & Namkeen
  SNACKS: {
    name: 'snacks',
    canonicalTerms: ['snack', 'snacks', 'chips', 'crisps', 'namkeen', 'bhujia', 'sev', 'mixture', 'wafers', 'puffs', 'popcorn', 'makhana', 'khakhra'],
    patterns: [/\b(?:snack|snacks|chips|crisps|namkeen|bhujia|sev|mixture|wafers|puffs|popcorn|makhana|khakhra|nachos?)\b/i]
  },

  // Breakfast Cereals & Oats
  CEREAL: {
    name: 'cereal',
    canonicalTerms: ['cereal', 'cereals', 'oats', 'oatmeal', 'muesli', 'granola', 'cornflakes', 'wheat flakes', 'porridge'],
    patterns: [/\b(?:cereal|cereals|oats?|oatmeal|muesli|granola|cornflakes|wheat\s*flakes|porridge)\b/i]
  },

  // Juices & Beverages
  JUICE: {
    name: 'juice',
    canonicalTerms: ['juice', 'juices', 'drink', 'drinks', 'beverage', 'nectar', 'squash', 'cooler', 'smoothie'],
    patterns: [/\b(?:juice|juices|nectar|squash|smoothie)\b/i]
  },

  // Noodles & Pasta
  NOODLES: {
    name: 'noodles',
    canonicalTerms: ['noodle', 'noodles', 'pasta', 'macaroni', 'spaghetti', 'ramen', 'vermicelli', 'sewai'],
    patterns: [/\b(?:noodles?|pasta|macaroni|spaghetti|ramen|vermicelli|sewai)\b/i]
  },

  // Cooking Oils
  OIL: {
    name: 'oil',
    canonicalTerms: ['oil', 'cooking oil', 'mustard oil', 'sunflower oil', 'olive oil', 'groundnut oil', 'sesame oil', 'rice bran oil', 'canola oil'],
    patterns: [/\boils?\b/i]
  },

  // Tea & Coffee
  TEA_COFFEE: {
    name: 'tea_coffee',
    canonicalTerms: ['tea', 'coffee', 'chai', 'green tea', 'espresso', 'cappuccino', 'instant coffee'],
    patterns: [/\b(?:tea|coffee|chai|espresso|cappuccino)\b/i]
  },

  // Atta, Flour & Dals
  FLOUR_DAL: {
    name: 'flour_dal',
    canonicalTerms: ['atta', 'flour', 'dal', 'dhal', 'pulses', 'lentils', 'toor dal', 'moong dal', 'chana dal', 'urad dal', 'masoor dal', 'besan', 'maida', 'sooji', 'rava'],
    patterns: [/\b(?:atta|flour|dal|dhal|pulses|lentils?|besan|maida|sooji|rava)\b/i]
  },

  // Spices & Masalas
  SPICES: {
    name: 'spices',
    canonicalTerms: ['spice', 'spices', 'masala', 'turmeric', 'chilli', 'pepper', 'coriander', 'cumin', 'garam masala'],
    patterns: [/\b(?:spices?|masalas?|turmeric|chilli|pepper|coriander|cumin)\b/i]
  },

  // Jams & Spreads
  SPREADS: {
    name: 'spreads',
    canonicalTerms: ['spread', 'jam', 'honey', 'peanut butter', 'marmalade', 'mayonnaise', 'dip'],
    patterns: [/\b(?:spread|spreads|jam|jams|honey|peanut\s*butter|marmalade|mayonnaise|dip|dips)\b/i]
  },

  // Desserts & Sweets
  DESSERT: {
    name: 'dessert',
    canonicalTerms: ['dessert', 'custard', 'pudding', 'halwa', 'gulab jamun', 'rasgulla', 'soan papdi', 'mithai', 'sweets'],
    patterns: [/\b(?:dessert|desserts|custard|pudding|halwa|gulab\s*jamun|rasgulla|soan\s*papdi|mithai|sweets?)\b/i]
  }
};

/**
 * Checks if a product name indicates a plant-based non-dairy alternative.
 * e.g. "Almond Milk", "Soy Milk", "Peanut Butter", "Oat Milk".
 * @param {string} normalizedName 
 * @returns {boolean}
 */
function isPlantBasedAlternative(normalizedName) {
  if (!normalizedName) return false;
  const name = normalizedName.toLowerCase();

  // Peanut butter is explicitly a plant spread, not dairy butter
  if (name.includes('peanut butter') || name.includes('almond butter') || name.includes('cashew butter') || name.includes('cocoa butter')) {
    return true;
  }

  // Plant milks: almond milk, soy milk, oat milk, coconut milk, etc.
  if (/\b(?:almond|soy|soya|oat|coconut|cashew|rice|hemp|pea|plant[- ]based|vegan)\s+milk\b/i.test(name)) {
    return true;
  }

  // Other plant-based claims in name
  if (name.includes('dairy free') || name.includes('dairy-free') || name.includes('non dairy') || name.includes('non-dairy') || name.includes('plant based') || name.includes('plant-based')) {
    return true;
  }

  return false;
}

/**
 * Checks if a product's name identifies it as a dairy product.
 * A product is a dairy product if its name represents milk, cheese, butter, ghee, yogurt, paneer, etc.,
 * UNLESS it is an explicit plant-based alternative (like almond milk or peanut butter).
 * @param {string} rawOrCleanName 
 * @param {string|number} categoryId 
 * @returns {boolean}
 */
function isDairyProductIdentity(rawOrCleanName, categoryId = null, brand = '') {
  if (!rawOrCleanName) return false;
  const { normalizedText } = normalizeProductName(rawOrCleanName);

  // If it's a plant-based alternative, it is NOT an animal dairy product
  if (isPlantBasedAlternative(normalizedText)) {
    return false;
  }

  // If it's explicitly Ice Cream or Kulfi, it IS a dairy frozen dessert (even if flavored with chocolate or fruit)
  const isIceCream = /\b(?:ice\s*cream|kulfi)\b/i.test(normalizedText);
  if (isIceCream) return true;

  // If it's confectionery, bakery, snack, sauce, or pasta, it is NOT a dairy product:
  // e.g. Cadbury Dairy Milk is chocolate, Milk Bikis is biscuit, Nacho Cheese is chips, Cheese Dip is sauce
  const isConfectionery = /\b(?:chocolate|choco|cadbury|milkybar|toblerone|kinder)\b/i.test(normalizedText);
  const isBakery = /\b(?:biscuit|biscuits|cookie|cookies|rusk|rusks|wafer|wafers)\b/i.test(normalizedText);
  const isSnack = /\b(?:chips|crisps|nachos?|tortilla|wafers?|popcorn|nuggets?)\b/i.test(normalizedText);
  const isSauceOrDip = /\b(?:dip|dips|sauce|mayo|mayonnaise)\b/i.test(normalizedText);
  const isPastaOrNoodle = /\b(?:pasta|noodles?|macaroni)\b/i.test(normalizedText);

  if (isConfectionery || isBakery || isSnack || isSauceOrDip || isPastaOrNoodle) {
    return false;
  }

  // Pure dairy product types
  const isGhee = /\bghee\b/i.test(normalizedText);
  const isPaneer = /\b(?:paneer|cottage\s*cheese)\b/i.test(normalizedText);
  const isCheese = /\b(?:cheese|cheddar|mozzarella|parmesan|gouda|cheezza)\b/i.test(normalizedText);
  const isButter = /\bbutter\b/i.test(normalizedText); // peanut butter already excluded above
  const isYogurt = /\b(?:yogurt|curd|dahi|shrikhand)\b/i.test(normalizedText);
  const isLassi = /\b(?:lassi|chaas|buttermilk)\b/i.test(normalizedText);

  // Milk identity:
  // Must distinguish "Milk Chocolate" or "Milk Bikis" (which are chocolate or biscuits) from actual Milk products
  const isMilkBeverage = /\b(?:cow\s*milk|toned\s*milk|fresh\s*milk|full\s*cream\s*milk|pasteurized\s*milk|pure\s*milk|dairy\s*milk\s*pack|milk\s*pack)\b/i.test(normalizedText) ||
    (/\bmilk\b/i.test(normalizedText) && !/\b(?:chocolate|biscuit|biscuits|cookies?|wafers?|chips|shake|mix)\b/i.test(normalizedText));

  // Category 13 is explicitly Packaged Dairy & Cheese
  const isCat13 = Number(categoryId) === 13;

  if (isGhee || isPaneer || isCheese || isButter || isYogurt || isLassi || isMilkBeverage || isIceCream || isCat13) {
    return true;
  }

  return false;
}

/**
 * Extracts all semantic food identities and concepts represented by a product's name.
 * @param {string} productName 
 * @param {Object} options - { brand, categoryId, categoryName }
 * @returns {Object} - Semantic profile of the product
 */
function extractProductSemanticProfile(productName, options = {}) {
  const { cleanName, normalizedText, tokens } = normalizeProductName(productName);
  const brand = (options.brand || '').toLowerCase().trim();
  const categoryId = options.categoryId ? Number(options.categoryId) : null;
  const categoryName = (options.categoryName || '').toLowerCase().trim();

  const isPlant = isPlantBasedAlternative(normalizedText);
  const isDairy = isDairyProductIdentity(cleanName, categoryId, brand);

  // Concept matching based purely on name
  const matchedConcepts = [];
  for (const [key, concept] of Object.entries(CONCEPT_ONTOLOGY)) {
    const hasPattern = concept.patterns.some(p => p.test(normalizedText));
    if (hasPattern) {
      // Special check: don't tag DAIRY if it's plant-based
      if (key === 'DAIRY' && isPlant) continue;
      // Don't tag BUTTER if it's peanut butter
      if (key === 'BUTTER' && normalizedText.includes('peanut butter')) continue;
      // Don't tag CEREAL if it's a biscuit or cookie with oatmeal
      if (key === 'CEREAL' && /\b(?:biscuit|biscuits|cookies?)\b/i.test(normalizedText)) continue;
      // Don't tag MILK if it's chocolate or biscuits unless specifically matched
      if (key === 'MILK' && !isDairy && !isPlant) {
        if (/\b(?:chocolate|biscuit|cookie|bar)\b/i.test(normalizedText)) continue;
      }
      matchedConcepts.push(concept.name);
    }
  }

  // Canonical product type determination
  let primaryType = 'other';
  if (isDairy) primaryType = 'dairy';
  else if (matchedConcepts.includes('chocolate')) primaryType = 'chocolate';
  else if (matchedConcepts.includes('biscuits')) primaryType = 'biscuit';
  else if (matchedConcepts.includes('snacks')) primaryType = 'snack';
  else if (matchedConcepts.includes('cereal')) primaryType = 'cereal';
  else if (matchedConcepts.includes('juice')) primaryType = 'juice';
  else if (matchedConcepts.includes('noodles')) primaryType = 'noodles';
  else if (matchedConcepts.includes('oil')) primaryType = 'oil';
  else if (matchedConcepts.includes('tea_coffee')) primaryType = 'tea_coffee';
  else if (matchedConcepts.includes('flour_dal')) primaryType = 'flour_dal';
  else if (matchedConcepts.includes('spices')) primaryType = 'spice';
  else if (matchedConcepts.includes('spreads')) primaryType = 'spread';
  else if (matchedConcepts.includes('dessert')) primaryType = 'dessert';

  return {
    cleanName,
    normalizedText,
    tokens,
    brand,
    categoryId,
    categoryName,
    isDairyProduct: isDairy,
    isPlantBasedAlternative: isPlant,
    primaryType,
    concepts: matchedConcepts
  };
}

module.exports = {
  CONCEPT_ONTOLOGY,
  PLANT_MODIFIERS,
  normalizeProductName,
  isPlantBasedAlternative,
  isDairyProductIdentity,
  extractProductSemanticProfile
};
