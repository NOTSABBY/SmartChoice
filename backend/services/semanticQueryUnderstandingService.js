/**
 * SmartChoice LLM-Powered Semantic Query Understanding Service
 * 
 * Analyzes natural-language grocery queries and generates structured understanding:
 * 1. core_entity: Principal food item or product category.
 * 2. implicit_synonyms: 3-4 meaningful synonyms, hypernyms, or colloquial terms.
 * 3. attributes: Explicitly stated and reasonably implied attributes (dietary, preparation, packaging).
 * 4. optimized_vector_query: Strictly product identity concepts only (zero dietary or ingredient metadata).
 * 5. search_intent: Positive concepts, negative concepts, context.
 * 6. structured_filters: Dietary (VEGAN, VEGETARIAN, etc.), allergens to exclude, ingredients to exclude, preparation state, packaging type.
 * 7. confidence: Numerical confidence score (0.0 to 1.0).
 * 
 * Supports live LLM via GoogleGenAI with automatic fallback to deterministic ontology.
 */

const { GoogleGenAI, Type } = require('@google/genai');
const { executeWithRetry } = require('../utils/geminiErrorHandler');
const { normalizeQuery } = require('./productNameNormalizationService');

const QUERY_UNDERSTANDING_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    core_entity: {
      type: Type.STRING,
      description: "Principal food item or product category (e.g. 'Carbonated beverages', 'Chocolate snacks')"
    },
    implicit_synonyms: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3 to 4 meaningful synonyms, related product types, or hypernyms"
    },
    attributes: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Explicitly stated or reasonably implied attributes (e.g. 'Vegan', 'Packaged', 'Ready-to-eat')"
    },
    optimized_vector_query: {
      type: Type.STRING,
      description: "Product identity concepts ONLY for vector search. NO dietary or allergen terms!"
    },
    search_intent: {
      type: Type.OBJECT,
      properties: {
        positive_concepts: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Positive product concepts sought (e.g. ['chocolate', 'snacks'])"
        },
        negative_concepts: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Negative concepts to exclude (e.g. ['dairy'])"
        },
        context: {
          type: Type.STRING,
          description: "Brief contextual summary of user's query intent"
        }
      },
      required: ["positive_concepts", "negative_concepts", "context"]
    },
    structured_filters: {
      type: Type.OBJECT,
      properties: {
        dietary: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Dietary flags e.g. ['VEGAN'], ['VEGETARIAN'], ['GLUTEN_FREE'], ['DAIRY_FREE']"
        },
        allergens_to_exclude: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Allergens to exclude e.g. ['milk', 'peanuts', 'gluten']"
        },
        ingredients_to_exclude: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Specific ingredients to exclude e.g. ['palm oil', 'sugar']"
        },
        preparation_state: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Preparation state e.g. ['FROZEN'], ['FRESH'], ['INSTANT'], ['READY_TO_EAT']"
        },
        packaging_type: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Packaging type e.g. ['BOTTLE'], ['CAN'], ['POUCH'], ['PACKET'], ['JAR']"
        },
        other_constraints: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Other constraints e.g. ['sugar-free', 'low-sodium']"
        }
      },
      required: ["dietary", "allergens_to_exclude", "ingredients_to_exclude", "preparation_state", "packaging_type", "other_constraints"]
    },
    confidence: {
      type: Type.NUMBER,
      description: "Confidence score between 0.0 and 1.0"
    }
  },
  required: [
    "core_entity",
    "implicit_synonyms",
    "attributes",
    "optimized_vector_query",
    "search_intent",
    "structured_filters",
    "confidence"
  ]
};

class SemanticQueryUnderstandingService {
  constructor() {
    this.ai = null;
    this.modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  }

  _initAi() {
    if (!this.ai && process.env.GEMINI_API_KEY) {
      this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
  }

  getSystemPrompt() {
    return `You are the Query Understanding Engine for SmartChoice, a packaged-food intelligence platform.
Your task is to analyze natural-language grocery queries and output structured JSON.

CRITICAL ARCHITECTURAL RULES:
1. OPTION A ARCHITECTURE: Strictly separate semantic retrieval from evidence-based filtering.
2. "optimized_vector_query" MUST CONTAIN PRODUCT IDENTITY CONCEPTS ONLY.
   - Example Input: "vegan chocolate snacks"
   - "optimized_vector_query": "Packaged chocolate snacks, chocolate bars and cocoa-based confectionery."
   - DO NOT include "vegan", "sugar-free", "gluten-free", or allergen exclusions in "optimized_vector_query"!
3. Dietary attributes, allergen restrictions, and ingredient exclusions MUST be placed into "structured_filters".
   - Dietary restrictions: ["VEGAN"], ["VEGETARIAN"], ["GLUTEN_FREE"], ["DAIRY_FREE"], ["HALAL"], ["KETO"].
   - Allergens to exclude: ["milk"], ["peanuts"], ["gluten"], ["soy"], ["eggs"], ["tree nuts"].
4. Positive vs Negative intent:
   - "dairy" -> positive_concepts: ["dairy", "milk"], negative_concepts: []
   - "dairy-free" -> positive_concepts: [], negative_concepts: ["dairy"], dietary: ["DAIRY_FREE"], allergens_to_exclude: ["milk"]
   - "non-dairy milk" -> positive_concepts: ["plant_milk"], negative_concepts: ["dairy"], dietary: ["DAIRY_FREE"]
   - "chocolate without dairy" -> positive_concepts: ["chocolate"], negative_concepts: ["dairy"], dietary: ["DAIRY_FREE"]
5. implicit_synonyms: Provide 3 to 4 meaningful food synonyms, related product types, or hypernyms.
   - "Soda" -> ["Carbonated beverage", "Soft drink", "Fizzy drink", "Pop"]
   - "Chocolate" -> ["Chocolate confectionery", "Cocoa-based products", "Chocolate bars", "Chocolate treats"]
6. Always return valid JSON conforming to the schema.`;
  }

  /**
   * Analyzes user query using Gemini LLM with deterministic fallback on failure.
   * @param {string} rawQuery 
   * @returns {Promise<Object>} Structured query understanding
   */
  async understandQuery(rawQuery) {
    if (!rawQuery || typeof rawQuery !== 'string' || rawQuery.trim().length === 0) {
      return this._generateEmptyUnderstanding();
    }

    const query = rawQuery.trim();
    this._initAi();

    // 1. If Gemini AI is configured, attempt LLM understanding with fast timeout (<1000ms)
    if (this.ai) {
      try {
        const prompt = `Analyze this grocery search query:\n"${query}"`;
        
        // Fast timeout race: if Gemini takes >1000ms or throws 503/429, fall back immediately to preserve sub-second SLA
        const llmPromise = this.ai.models.generateContent({
          model: this.modelName,
          contents: prompt,
          config: {
            systemInstruction: this.getSystemPrompt(),
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: QUERY_UNDERSTANDING_SCHEMA
          }
        });

        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('LLM_TIMEOUT')), 1000)
        );

        const response = await Promise.race([llmPromise, timeoutPromise]);
        
        if (response && response.text) {
          const parsed = JSON.parse(response.text);
          if (this._validatePayload(parsed)) {
            return {
              ...parsed,
              provider: "gemini",
              model: this.modelName,
              raw_query: query
            };
          }
        }
      } catch (err) {
        // Fall back gracefully without failing or blocking user request
        console.warn(`[QueryUnderstanding] LLM unavailable (${err.message}). Using deterministic fallback.`);
      }
    }

    // 2. Deterministic Fallback Engine
    return this.fallbackQueryUnderstanding(query);
  }

  /**
   * Deterministic ontology-based query understanding fallback.
   * Guarantees 100% schema compliance and robust query interpretation when LLM is unavailable.
   * @param {string} query 
   * @returns {Object} Structured understanding payload
   */
  fallbackQueryUnderstanding(query) {
    const { cleanQuery, tokens } = normalizeQuery(query);
    const q = cleanQuery;

    let core_entity = "Packaged food";
    let implicit_synonyms = ["Grocery items", "Food products", "Packaged goods"];
    let attributes = [];
    let optimized_vector_query = cleanQuery;
    let positive_concepts = [];
    let negative_concepts = [];
    let context = `Search for ${cleanQuery}`;

    const structured_filters = {
      dietary: [],
      allergens_to_exclude: [],
      ingredients_to_exclude: [],
      preparation_state: [],
      packaging_type: [],
      other_constraints: []
    };

    // -------------------------------------------------------------
    // Negative Intent & Exclusions Detection
    // -------------------------------------------------------------
    const isDairyNegative = /\b(?:dairy[- ]free|free\s+from\s+dairy|without\s+(?:any\s+)?dairy|no\s+dairy|non[- ]dairy|not\s+(?:a\s+)?dairy|excluding\s+(?:any\s+)?dairy(?:-based)?|exclude\s+dairy|except\s+dairy)\b/i.test(q) ||
                            /\b(?:milk[- ]free|free\s+from\s+milk|without\s+(?:any\s+)?milk|no\s+milk)\b/i.test(q) ||
                            /\bproducts?\s+(?:that\s+are\s+not|without|excluding)\s+(?:any\s+)?dairy\b/i.test(q);

    // -------------------------------------------------------------
    // Core Entity & Positive Concepts Extraction (Residual Query)
    // -------------------------------------------------------------
    const qPos = q
      .replace(/\b(?:dairy[- ]free|without\s+(?:any\s+)?dairy|no\s+dairy|non[- ]dairy|not\s+(?:a\s+)?dairy|excluding\s+(?:any\s+)?dairy(?:-based)?)\b/gi, ' ')
      .replace(/\b(?:milk[- ]free|without\s+milk|no\s+milk|sugar[- ]free|without\s+sugar|gluten[- ]free|caffeine[- ]free)\b/gi, ' ')
      .replace(/\bproducts?\s+(?:that\s+are\s+not|without|excluding)\s+(?:any\s+)?dairy(?:-based)?(?:\s+items|\s+products)?\b/gi, ' ')
      .trim();

    if (isDairyNegative) {
      attributes.push("Dairy-Free");
      negative_concepts.push("dairy");
      context = `${context} (Excluding dairy products)`;

      // If query is "dairy free" (space), "dairy-free products", or has positive food targets like "dairy-free cookies":
      if (/\bdairy\s+free\b/i.test(q) || /\b(?:products?|items?|certified|verified|non[- ]dairy\s+milk)\b/i.test(q) || qPos.length > 0) {
        structured_filters.dietary.push("DAIRY_FREE");
        if (!/\bmilk\b/i.test(qPos)) {
          structured_filters.allergens_to_exclude.push("milk");
        }
      }
    }

    if (/\b(?:palm\s*oil[- ]free|without\s+palm\s*oil|no\s+palm\s*oil)\b/i.test(q)) {
      attributes.push("Palm-Oil-Free");
      negative_concepts.push("palm_oil");
      structured_filters.ingredients_to_exclude.push("palm oil");
    }

    if (/\b(?:peanut[- ]free|without\s+peanuts?|no\s+peanuts?)\b/i.test(q)) {
      attributes.push("Peanut-Free");
      negative_concepts.push("peanuts");
      structured_filters.allergens_to_exclude.push("peanuts", "peanut");
    }

    if (/\b(?:products?\s+containing\s+milk|containing\s+milk|has\s+milk|milk\s+ingredients?)\b/i.test(q)) {
      core_entity = "Products containing milk";
      implicit_synonyms = ["Milk containing products", "Dairy-containing foods"];
      optimized_vector_query = "Packaged foods containing milk or milk derivatives";
      positive_concepts.push("dairy_contains_all");
      structured_filters.dairy_status = "DAIRY_CONTAINS";
      context = "Search for products with confirmed milk ingredients";
    } else if (/\b(?:may\s+contain\s+milk|declared\s+milk\s+allergens?)\b/i.test(q)) {
      core_entity = "Products that may contain milk";
      implicit_synonyms = ["May contain milk", "Milk cross-contamination warning"];
      optimized_vector_query = "Packaged foods with may contain milk warning";
      positive_concepts.push("dairy_may_contain_all");
      structured_filters.dairy_status = "DAIRY_MAY_CONTAIN";
      context = "Search for products with may contain milk warning";
    }

    if (/\b(?:caffeine[- ]free|decaf|decaffeinated|without\s+caffeine|no\s+caffeine)\b/i.test(q)) {
      attributes.push("Caffeine-Free");
      negative_concepts.push("caffeine");
      structured_filters.other_constraints.push("caffeine-free");
    }

    if (/\b(?:gluten[- ]free|without\s+gluten|no\s+gluten)\b/i.test(q)) {
      attributes.push("Gluten-Free");
      negative_concepts.push("gluten");
      structured_filters.dietary.push("GLUTEN_FREE");
      structured_filters.allergens_to_exclude.push("gluten", "wheat");
    }

    if (/\b(?:sugar[- ]free|zero\s+sugar|without\s+sugar|no\s+sugar|unsweetened)\b/i.test(q)) {
      attributes.push("Sugar-Free");
      structured_filters.other_constraints.push("sugar-free");
      structured_filters.ingredients_to_exclude.push("sugar");
    }

    // Vegan
    if (/\bvegan\b/i.test(q)) {
      attributes.push("Vegan");
      structured_filters.dietary.push("VEGAN");
      context = `${context} (Strictly Vegan)`;
    }

    // Vegetarian
    if (/\b(?:vegetarian|veg)\b/i.test(q) && !/\bvegan\b/i.test(q)) {
      attributes.push("Vegetarian");
      structured_filters.dietary.push("VEGETARIAN");
    }

    // Alternative Seeking Queries (e.g. "milk alternatives")
    const isAlternativeSeeking = /\b(?:alternatives?|substitutes?)\b/i.test(q) || /\b(?:plant[- ]based|vegan)\s+milks?\b/i.test(q);
    if (isAlternativeSeeking) {
      core_entity = "Plant-based milk alternatives";
      implicit_synonyms = ["Almond milk", "Soy milk", "Oat milk", "Coconut milk beverage"];
      optimized_vector_query = "Plant-based milk alternatives, almond milk and oat milk beverages";
      positive_concepts.push("plant_milk");
      attributes.push("Plant-based", "Dairy-Free");
    }

    // Preparation States
    if (/\bfrozen\b/i.test(q)) {
      attributes.push("Frozen");
      structured_filters.preparation_state.push("FROZEN");
    }
    if (/\bfresh\b/i.test(q)) {
      attributes.push("Fresh");
      structured_filters.preparation_state.push("FRESH");
    }
    if (/\binstant\b/i.test(q) && !structured_filters.preparation_state.includes("INSTANT")) {
      attributes.push("Instant");
      structured_filters.preparation_state.push("INSTANT");
    }
    if (/\b(?:ready\s*to\s*eat|rte)\b/i.test(q) && !structured_filters.preparation_state.includes("READY_TO_EAT")) {
      attributes.push("Ready-to-eat");
      structured_filters.preparation_state.push("READY_TO_EAT");
    }

    // Packaging Types
    if (/\b(?:bottled?|bottles?)\b/i.test(q)) {
      attributes.push("Bottled");
      structured_filters.packaging_type.push("BOTTLE");
    }
    if (/\b(?:canned?|cans?|tins?)\b/i.test(q)) {
      attributes.push("Canned");
      structured_filters.packaging_type.push("CAN");
    }
    if (/\b(?:pouch|pouches?)\b/i.test(q)) {
      attributes.push("Pouch");
      structured_filters.packaging_type.push("POUCH");
    }

    // -------------------------------------------------------------
    // Core Entity & Positive Concepts Extraction (Residual Query)
    // -------------------------------------------------------------
    if (/\b(?:soda|colas?|soft\s*drinks?|carbonated)\b/i.test(qPos)) {
      core_entity = "Carbonated beverages";
      implicit_synonyms = ["Carbonated beverage", "Soft drink", "Fizzy drink", "Pop"];
      optimized_vector_query = "Carbonated soft drinks, fizzy beverages and sparkling sodas";
      positive_concepts.push("soda");
      attributes.push("Packaged", "Bottled");
    } else if (/\b(?:peanut\s*butter)\b/i.test(qPos)) {
      core_entity = "Peanut butter";
      implicit_synonyms = ["Peanut spread", "Nut butter", "Crunchy peanut butter", "Creamy peanut spread"];
      optimized_vector_query = "Peanut butter spreads and nut butter jars";
      positive_concepts.push("peanut_butter", "spreads");
      attributes.push("Packaged", "Jar");
    } else if (/\b(?:instant\s*noodles?|noodles?|ramen|pasta)\b/i.test(qPos)) {
      core_entity = "Instant noodles";
      implicit_synonyms = ["Ramen noodles", "Packaged noodles", "Instant pasta", "Cup noodles"];
      optimized_vector_query = "Instant noodles, ramen and packaged pasta";
      positive_concepts.push("noodles");
      attributes.push("Instant", "Packaged");
      if (!structured_filters.preparation_state.includes("INSTANT")) structured_filters.preparation_state.push("INSTANT");
    } else if (/\b(?:breakfast\s*cereals?|cereals?|oats?|muesli|granola|cornflakes)\b/i.test(qPos)) {
      core_entity = "Breakfast cereals";
      implicit_synonyms = ["Breakfast cereal", "Rolled oats", "Muesli mix", "Granola clusters"];
      optimized_vector_query = "Breakfast cereals, rolled oats, muesli and cornflakes";
      positive_concepts.push("cereal");
      attributes.push("Packaged", "Ready-to-eat");
    } else if (/\b(?:chips|crisps|potato\s*chips|wafers?|nachos?|potato\s*products?)\b/i.test(qPos)) {
      core_entity = "Potato snacks";
      implicit_synonyms = ["Potato crisps", "Salted wafers", "Potato snacks", "Packaged savory snacks"];
      optimized_vector_query = "Potato snacks, salted crisps and packaged potato treats";
      positive_concepts.push("snacks");
      attributes.push("Packaged", "Ready-to-eat");
    } else if (/\b(?:chocolate|choco|cocoa|cacao)\b/i.test(qPos)) {
      core_entity = "Chocolate confectionery";
      implicit_synonyms = ["Chocolate bars", "Cocoa-based products", "Chocolate treats", "Chocolate confectionery"];
      optimized_vector_query = "Packaged chocolate bars, dark chocolate and cocoa-based confectionery";
      positive_concepts.push("chocolate");
      attributes.push("Packaged", "Ready-to-eat");
    } else if (/\b(?:biscuits?|cookies?|rusks?|crackers?)\b/i.test(qPos)) {
      core_entity = "Biscuits and cookies";
      implicit_synonyms = ["Baked cookies", "Tea biscuits", "Crunchy crackers", "Digestive biscuits"];
      optimized_vector_query = "Packaged biscuits, baked cookies, tea rusks and crackers";
      positive_concepts.push("biscuits");
      attributes.push("Packaged", "Baked");
    } else if (/\b(?:juices?|fruit\s*juices?|nectars?)\b/i.test(qPos)) {
      core_entity = "Fruit juice";
      implicit_synonyms = ["Packaged fruit juice", "Fruit nectar", "Beverage drink", "Fruit cooler"];
      optimized_vector_query = "Packaged fruit juice, natural nectar and bottled fruit drinks";
      positive_concepts.push("juice");
      attributes.push("Bottled", "Packaged");
    } else if (/\b(?:cheese|cheddar|mozzarella)\b/i.test(qPos)) {
      core_entity = "Packaged cheese";
      implicit_synonyms = ["Processed cheese", "Cheese slices", "Cheddar block", "Mozzarella cheese"];
      optimized_vector_query = "Packaged cheese slices, cheddar blocks and mozzarella cheese";
      positive_concepts.push("cheese", "dairy");
      attributes.push("Packaged");
    } else if (/\b(?:ghee|desi\s*ghee|cow\s*ghee)\b/i.test(qPos)) {
      core_entity = "Cooking ghee";
      implicit_synonyms = ["Cow ghee", "Desi ghee", "Pure clarified butter", "Traditional ghee"];
      optimized_vector_query = "Pure cow ghee jars, desi ghee tins and cooking ghee";
      positive_concepts.push("ghee", "dairy");
      attributes.push("Packaged", "Jar");
    } else if (!isDairyNegative && /\b(?:milks?|cow\s*milk|toned\s*milk)\b/i.test(qPos) && !/\b(?:almond|soy|oat|coconut|cashew)\b/i.test(qPos)) {
      core_entity = "Dairy milk";
      implicit_synonyms = ["Toned milk", "Cow milk", "Pasteurized milk", "Dairy beverage"];
      optimized_vector_query = "Fresh pasteurized milk, toned cow milk packs and dairy staples";
      positive_concepts.push("milk");
      attributes.push("Packaged");
    } else if (!isDairyNegative && /\b(?:dairy|dairy\s*products?|dairy\s*items?)\b/i.test(qPos)) {
      core_entity = "Dairy products";
      implicit_synonyms = ["Dairy milk", "Milk products", "Dairy staples", "Dairy beverages"];
      optimized_vector_query = "Dairy products, fresh milk, butter, cheese, ghee and curd";
      positive_concepts.push("dairy");
      attributes.push("Packaged");
    } else if (/\b(?:snacks?|namkeen|bhujia|sev)\b/i.test(qPos)) {
      core_entity = "Packaged snacks";
      implicit_synonyms = ["Traditional namkeen", "Savory snacks", "Crispy bhujia", "Tea-time snacks"];
      optimized_vector_query = "Packaged savory snacks, traditional namkeen and crispy mixtures";
      positive_concepts.push("snacks");
      attributes.push("Packaged", "Ready-to-eat");
    }

    // Deduplicate
    attributes = Array.from(new Set(attributes));
    positive_concepts = Array.from(new Set(positive_concepts));
    negative_concepts = Array.from(new Set(negative_concepts));

    return {
      core_entity,
      implicit_synonyms,
      attributes,
      optimized_vector_query,
      search_intent: {
        positive_concepts,
        negative_concepts,
        context
      },
      structured_filters,
      confidence: 0.90,
      provider: "deterministic_fallback",
      raw_query: query
    };
  }

  _validatePayload(payload) {
    if (!payload || typeof payload !== 'object') return false;
    if (typeof payload.core_entity !== 'string') return false;
    if (!Array.isArray(payload.implicit_synonyms)) return false;
    if (!Array.isArray(payload.attributes)) return false;
    if (typeof payload.optimized_vector_query !== 'string') return false;
    if (!payload.search_intent || !Array.isArray(payload.search_intent.positive_concepts)) return false;
    if (!payload.structured_filters || !Array.isArray(payload.structured_filters.dietary)) return false;
    return true;
  }

  _generateEmptyUnderstanding() {
    return {
      core_entity: "All grocery products",
      implicit_synonyms: [],
      attributes: [],
      optimized_vector_query: "",
      search_intent: {
        positive_concepts: [],
        negative_concepts: [],
        context: "Empty query"
      },
      structured_filters: {
        dietary: [],
        allergens_to_exclude: [],
        ingredients_to_exclude: [],
        preparation_state: [],
        packaging_type: [],
        other_constraints: []
      },
      confidence: 0.0,
      provider: "system",
      raw_query: ""
    };
  }
}

module.exports = new SemanticQueryUnderstandingService();
