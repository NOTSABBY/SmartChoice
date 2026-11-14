/**
 * ICMR-NIN RDA (2020) Reference Framework
 * 
 * Recommended Dietary Allowances for Indians (2020),
 * published by the ICMR-National Institute of Nutrition (Hyderabad).
 * 
 * Provides reference protein allowances across adult demographics.
 * Used for personalized evaluation and documented statutory comparisons.
 */

const ICMR_NIN_RDA_2020 = {
  ADULT_MEN: {
    SEDENTARY: { 
      rdaProteinG: 54.0, 
      categoryLabel: 'Adult Male - Sedentary Work', 
      referenceBodyWeightKg: 65.0,
      citation: 'ICMR-NIN 2020 RDA Table 2.1 (Adult Men - Sedentary)'
    },
    MODERATE: { 
      rdaProteinG: 64.8, 
      categoryLabel: 'Adult Male - Moderate Work', 
      referenceBodyWeightKg: 65.0,
      citation: 'ICMR-NIN 2020 RDA Table 2.1 (Adult Men - Moderate)'
    },
    HEAVY: { 
      rdaProteinG: 83.2, 
      categoryLabel: 'Adult Male - Heavy Work', 
      referenceBodyWeightKg: 65.0,
      citation: 'ICMR-NIN 2020 RDA Table 2.1 (Adult Men - Heavy)'
    }
  },
  ADULT_WOMEN: {
    SEDENTARY: { 
      rdaProteinG: 46.0, 
      categoryLabel: 'Adult Female - Sedentary Work', 
      referenceBodyWeightKg: 55.0,
      citation: 'ICMR-NIN 2020 RDA Table 2.1 (Adult Women - Sedentary)'
    },
    MODERATE: { 
      rdaProteinG: 55.2, 
      categoryLabel: 'Adult Female - Moderate Work', 
      referenceBodyWeightKg: 55.0,
      citation: 'ICMR-NIN 2020 RDA Table 2.1 (Adult Women - Moderate)'
    },
    HEAVY: { 
      rdaProteinG: 70.8, 
      categoryLabel: 'Adult Female - Heavy Work', 
      referenceBodyWeightKg: 55.0,
      citation: 'ICMR-NIN 2020 RDA Table 2.1 (Adult Women - Heavy)'
    },
    PREGNANT: { 
      rdaProteinG: 69.5, 
      categoryLabel: 'Adult Female - Pregnant (2nd/3rd Trimester)', 
      referenceBodyWeightKg: 55.0,
      citation: 'ICMR-NIN 2020 RDA Table 2.1 (Pregnant Women)'
    },
    LACTATING: { 
      rdaProteinG: 63.0, 
      categoryLabel: 'Adult Female - Lactating (0-6 months)', 
      referenceBodyWeightKg: 55.0,
      citation: 'ICMR-NIN 2020 RDA Table 2.1 (Lactating Women)'
    }
  }
};

/**
 * Resolves an explicit RDA profile entry from a demographic key
 * e.g., 'ADULT_MEN.SEDENTARY' or 'ADULT_WOMEN.MODERATE'.
 * Returns null if the profile key is missing or invalid.
 * NEVER defaults silently to any specific profile.
 */
function getIcmrRdaProfile(profileKey) {
  if (!profileKey || typeof profileKey !== 'string') return null;
  const parts = profileKey.trim().toUpperCase().split('.');
  if (parts.length === 2 && ICMR_NIN_RDA_2020[parts[0]] && ICMR_NIN_RDA_2020[parts[0]][parts[1]]) {
    return {
      key: `${parts[0]}.${parts[1]}`,
      ...ICMR_NIN_RDA_2020[parts[0]][parts[1]]
    };
  }
  return null;
}

module.exports = {
  ICMR_NIN_RDA_2020,
  getIcmrRdaProfile
};
