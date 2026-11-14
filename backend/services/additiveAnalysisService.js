const additivesRef = require('../data/fssai/additivesReference.json');

// Map of INS and E-number lookups (case-insensitive)
const lookupMap = new Map();
additivesRef.forEach(entry => {
  const cleanIns = entry.insNumber.toLowerCase().replace(/\s+/g, '');
  const cleanE = entry.eNumber.toLowerCase().replace(/\s+/g, '');
  lookupMap.set(cleanIns, entry);
  lookupMap.set(cleanE, entry);
  lookupMap.set(entry.primaryName.toLowerCase(), entry);
});

/**
 * Extracts and classifies additives from ingredient text and token lists.
 */
function analyzeAdditives(rawText, parsedIngredients = []) {
  if (!rawText && (!parsedIngredients || parsedIngredients.length === 0)) {
    return {
      detectionStatus: 'UNPARSED_INGREDIENTS',
      totalDetected: 0,
      cosmeticCount: 0,
      identifiedList: [],
      availability: {
        isAvailable: false,
        rawIngredientAvailable: false,
        parsedTokenCount: 0
      }
    };
  }

  const combinedText = [rawText || '', ...(parsedIngredients || [])].join(' ');
  const detectedMap = new Map();

  // 1. Regex to match INS and E numbers: e.g. "INS 500", "INS 500(ii)", "E471", "INS 472e"
  const additiveRegex = /\b(?:INS|E)\s*[-:]?\s*(\d{3,4}\s*[a-z]?(?:\s*\([ivx]+\))?)/gi;
  let match;
  while ((match = additiveRegex.exec(combinedText)) !== null) {
    const rawMatch = match[0];
    const codeNumber = match[1].toLowerCase().replace(/[\s\(\)]/g, '');
    
    // Check in lookup map
    const entry = lookupMap.get(`ins${codeNumber}`) || lookupMap.get(`e${codeNumber}`);
    const key = entry ? entry.insNumber : rawMatch.toUpperCase().replace(/\s+/g, ' ');
    
    if (!detectedMap.has(key)) {
      detectedMap.set(key, {
        insNumber: entry ? entry.insNumber : key,
        primaryName: entry ? entry.primaryName : 'Food Additive',
        functionalClass: entry ? entry.functionalClass : ['Additive'],
        isCosmetic: entry ? entry.isCosmetic : false,
        verificationStatus: entry ? 'CATEGORY_PERMITTED' : 'IDENTIFIED_ONLY'
      });
    }
  }

  // 2. Named additive matching
  additivesRef.forEach(entry => {
    const nameRegex = new RegExp(`\\b${entry.primaryName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
    if (nameRegex.test(combinedText) && !detectedMap.has(entry.insNumber)) {
      detectedMap.set(entry.insNumber, {
        insNumber: entry.insNumber,
        primaryName: entry.primaryName,
        functionalClass: entry.functionalClass,
        isCosmetic: entry.isCosmetic,
        verificationStatus: 'CATEGORY_PERMITTED'
      });
    }
  });

  const identifiedList = Array.from(detectedMap.values());
  const cosmeticCount = identifiedList.filter(a => a.isCosmetic).length;

  return {
    detectionStatus: identifiedList.length > 0 ? 'ADDITIVES_IDENTIFIED' : 'NO_ADDITIVES_DETECTED',
    totalDetected: identifiedList.length,
    cosmeticCount,
    identifiedList,
    availability: {
      isAvailable: true,
      rawIngredientAvailable: !!rawText,
      parsedTokenCount: parsedIngredients ? parsedIngredients.length : 0
    }
  };
}

module.exports = {
  analyzeAdditives
};