/**
 * SmartChoice Product Name Normalization Service
 * 
 * Normalizes product names and natural-language query strings by:
 * 1. Removing packaging formats, sizes, and quantity metrics (e.g. 500g, 1L, Pet Jar, Pack of 2).
 * 2. Normalizing punctuation, apostrophes, and spacing (e.g. Parle-G -> Parle G, Lay's -> Lays).
 * 3. Extracting clean identity tokens and descriptors.
 */

// Common packaging descriptors and volume/weight patterns
const PACKAGING_REGEX = /\b(?:\d+(?:\.\d+)?\s*(?:g|gm|gms|kg|kgs|ml|l|ltr|litre|litres|liter|liters|oz|lb|pcs|pieces?))\b/gi;
const CONTAINER_REGEX = /\b(?:pack\s*of\s*\d+|pack|packet|pouch|jar|tin|can|bottle|carton|box|tub|tubes?|tetra\s*pak|tetrapack|pet\s*jar|refill\s*pack|multipack|combo\s*pack)\b/gi;
const PARENTHETICAL_REGEX = /\([^)]*\)/g;
const BRACKET_REGEX = /\[[^\]]*\]/g;

/**
 * Normalizes a product name to its core identity representation.
 * @param {string} rawName - The original product name
 * @returns {Object} - { cleanName, normalizedText, tokens, rawName }
 */
function normalizeProductName(rawName) {
  if (!rawName || typeof rawName !== 'string') {
    return {
      cleanName: '',
      normalizedText: '',
      tokens: [],
      rawName: rawName || ''
    };
  }

  const raw = rawName.trim();

  // 1. Remove parenthetical notes e.g. (1L Pet Jar), (Unsweetened)
  let cleaned = raw.replace(PARENTHETICAL_REGEX, ' ').replace(BRACKET_REGEX, ' ');

  // 2. Remove packaging units and container terms
  cleaned = cleaned.replace(PACKAGING_REGEX, ' ');
  cleaned = cleaned.replace(CONTAINER_REGEX, ' ');

  // 3. Normalize quotes and apostrophes: Lay's -> Lays, Haldiram's -> Haldirams
  cleaned = cleaned.replace(/['’`]/g, '');

  // 4. Replace punctuation/hyphens with space: Parle-G -> Parle G, Kit-Kat -> Kit Kat
  cleaned = cleaned.replace(/[-_/:,;+*&|~#@!?.()]+/g, ' ');

  // 5. Collapse whitespace and lowercase
  const normalizedText = cleaned.replace(/\s+/g, ' ').trim().toLowerCase();
  const cleanName = cleaned.replace(/\s+/g, ' ').trim();

  // 6. Tokenize
  const tokens = normalizedText.split(' ').filter(t => t.length > 0);

  return {
    rawName: raw,
    cleanName,
    normalizedText,
    tokens
  };
}

/**
 * Normalizes user queries for consistent semantic comparison.
 * @param {string} rawQuery - The user's search query
 * @returns {Object} - Normalized query representation
 */
function normalizeQuery(rawQuery) {
  if (!rawQuery || typeof rawQuery !== 'string') {
    return {
      rawQuery: '',
      cleanQuery: '',
      tokens: []
    };
  }

  let cleaned = rawQuery.trim().replace(/['’`]/g, '');
  cleaned = cleaned.replace(/[-_/:,;+*&|~#@!?.()]+/g, ' ');
  const cleanQuery = cleaned.replace(/\s+/g, ' ').trim().toLowerCase();
  const tokens = cleanQuery.split(' ').filter(t => t.length > 0);

  return {
    rawQuery: rawQuery.trim(),
    cleanQuery,
    tokens
  };
}

module.exports = {
  normalizeProductName,
  normalizeQuery
};
