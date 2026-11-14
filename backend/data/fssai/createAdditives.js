const fs = require('fs');

const additives = [
  // Preservatives
  { insNumber: 'INS 200', eNumber: 'E200', primaryName: 'Sorbic acid', functionalClass: ['Preservative'], isCosmetic: false, fssaiSchedule: 'Appendix A', generalRegulatoryStatus: 'PERMITTED_IN_SPECIFIED_FOODS' },
  { insNumber: 'INS 202', eNumber: 'E202', primaryName: 'Potassium sorbate', functionalClass: ['Preservative'], isCosmetic: false, fssaiSchedule: 'Appendix A', generalRegulatoryStatus: 'PERMITTED_IN_SPECIFIED_FOODS' },
  { insNumber: 'INS 211', eNumber: 'E211', primaryName: 'Sodium benzoate', functionalClass: ['Preservative'], isCosmetic: false, fssaiSchedule: 'Appendix A', generalRegulatoryStatus: 'PERMITTED_IN_SPECIFIED_FOODS' },
  { insNumber: 'INS 220', eNumber: 'E220', primaryName: 'Sulphur dioxide', functionalClass: ['Preservative', 'Antioxidant'], isCosmetic: false, fssaiSchedule: 'Appendix A', generalRegulatoryStatus: 'PERMITTED_IN_SPECIFIED_FOODS' },
  { insNumber: 'INS 223', eNumber: 'E223', primaryName: 'Sodium metabisulphite', functionalClass: ['Preservative', 'Bleaching agent'], isCosmetic: false, fssaiSchedule: 'Appendix A', generalRegulatoryStatus: 'PERMITTED_IN_SPECIFIED_FOODS' },
  { insNumber: 'INS 282', eNumber: 'E282', primaryName: 'Calcium propionate', functionalClass: ['Preservative'], isCosmetic: false, fssaiSchedule: 'Appendix A', generalRegulatoryStatus: 'PERMITTED_IN_SPECIFIED_FOODS' },

  // Acidity Regulators & Antioxidants
  { insNumber: 'INS 300', eNumber: 'E300', primaryName: 'Ascorbic acid', functionalClass: ['Antioxidant', 'Acidity regulator'], isCosmetic: false, fssaiSchedule: 'GMP', generalRegulatoryStatus: 'GMP_PERMITTED' },
  { insNumber: 'INS 307', eNumber: 'E307', primaryName: 'Tocopherol', functionalClass: ['Antioxidant'], isCosmetic: false, fssaiSchedule: 'GMP', generalRegulatoryStatus: 'GMP_PERMITTED' },
  { insNumber: 'INS 319', eNumber: 'E319', primaryName: 'Tertiary butylhydroquinone (TBHQ)', functionalClass: ['Antioxidant'], isCosmetic: false, fssaiSchedule: 'Appendix A', generalRegulatoryStatus: 'PERMITTED_IN_SPECIFIED_FOODS' },
  { insNumber: 'INS 320', eNumber: 'E320', primaryName: 'Butylated hydroxyanisole (BHA)', functionalClass: ['Antioxidant'], isCosmetic: false, fssaiSchedule: 'Appendix A', generalRegulatoryStatus: 'PERMITTED_IN_SPECIFIED_FOODS' },
  { insNumber: 'INS 322', eNumber: 'E322', primaryName: 'Lecithins', functionalClass: ['Emulsifier', 'Antioxidant'], isCosmetic: false, fssaiSchedule: 'GMP', generalRegulatoryStatus: 'GMP_PERMITTED' },
  { insNumber: 'INS 330', eNumber: 'E330', primaryName: 'Citric acid', functionalClass: ['Acidity regulator', 'Antioxidant'], isCosmetic: false, fssaiSchedule: 'GMP', generalRegulatoryStatus: 'GMP_PERMITTED' },
  { insNumber: 'INS 331', eNumber: 'E331', primaryName: 'Sodium citrates', functionalClass: ['Acidity regulator', 'Emulsifying salt'], isCosmetic: false, fssaiSchedule: 'GMP', generalRegulatoryStatus: 'GMP_PERMITTED' },
  { insNumber: 'INS 334', eNumber: 'E334', primaryName: 'Tartaric acid', functionalClass: ['Acidity regulator'], isCosmetic: false, fssaiSchedule: 'GMP', generalRegulatoryStatus: 'GMP_PERMITTED' },
  { insNumber: 'INS 339', eNumber: 'E339', primaryName: 'Sodium phosphates', functionalClass: ['Acidity regulator', 'Emulsifying salt'], isCosmetic: false, fssaiSchedule: 'Appendix A', generalRegulatoryStatus: 'PERMITTED_IN_SPECIFIED_FOODS' },

  // Thickeners, Stabilizers & Emulsifiers
  { insNumber: 'INS 407', eNumber: 'E407', primaryName: 'Carrageenan', functionalClass: ['Gelling agent', 'Thickener'], isCosmetic: true, fssaiSchedule: 'GMP', generalRegulatoryStatus: 'GMP_PERMITTED' },
  { insNumber: 'INS 412', eNumber: 'E412', primaryName: 'Guar gum', functionalClass: ['Thickener', 'Stabilizer'], isCosmetic: false, fssaiSchedule: 'GMP', generalRegulatoryStatus: 'GMP_PERMITTED' },
  { insNumber: 'INS 414', eNumber: 'E414', primaryName: 'Acacia gum (gum arabic)', functionalClass: ['Thickener', 'Stabilizer'], isCosmetic: false, fssaiSchedule: 'GMP', generalRegulatoryStatus: 'GMP_PERMITTED' },
  { insNumber: 'INS 415', eNumber: 'E415', primaryName: 'Xanthan gum', functionalClass: ['Thickener', 'Stabilizer'], isCosmetic: false, fssaiSchedule: 'GMP', generalRegulatoryStatus: 'GMP_PERMITTED' },
  { insNumber: 'INS 440', eNumber: 'E440', primaryName: 'Pectins', functionalClass: ['Gelling agent', 'Thickener'], isCosmetic: false, fssaiSchedule: 'GMP', generalRegulatoryStatus: 'GMP_PERMITTED' },
  { insNumber: 'INS 471', eNumber: 'E471', primaryName: 'Mono- and diglycerides of fatty acids', functionalClass: ['Emulsifier', 'Stabilizer'], isCosmetic: true, fssaiSchedule: 'GMP', generalRegulatoryStatus: 'GMP_PERMITTED' },
  { insNumber: 'INS 472e', eNumber: 'E472e', primaryName: 'Diacetyltartaric and fatty acid esters of glycerol (DATEM)', functionalClass: ['Emulsifier'], isCosmetic: true, fssaiSchedule: 'GMP', generalRegulatoryStatus: 'GMP_PERMITTED' },
  { insNumber: 'INS 476', eNumber: 'E476', primaryName: 'Polyglycerol polyricinoleate (PGPR)', functionalClass: ['Emulsifier'], isCosmetic: true, fssaiSchedule: 'Appendix A', generalRegulatoryStatus: 'PERMITTED_IN_SPECIFIED_FOODS' },
  { insNumber: 'INS 461', eNumber: 'E461', primaryName: 'Methyl cellulose', functionalClass: ['Emulsifier', 'Thickener'], isCosmetic: true, fssaiSchedule: 'GMP', generalRegulatoryStatus: 'GMP_PERMITTED' },
  { insNumber: 'INS 466', eNumber: 'E466', primaryName: 'Sodium carboxymethyl cellulose', functionalClass: ['Thickener', 'Stabilizer'], isCosmetic: true, fssaiSchedule: 'GMP', generalRegulatoryStatus: 'GMP_PERMITTED' },

  // Raising Agents & Anti-caking
  { insNumber: 'INS 500', eNumber: 'E500', primaryName: 'Sodium carbonates (Baking soda)', functionalClass: ['Raising agent', 'Acidity regulator'], isCosmetic: false, fssaiSchedule: 'GMP', generalRegulatoryStatus: 'GMP_PERMITTED' },
  { insNumber: 'INS 503', eNumber: 'E503', primaryName: 'Ammonium carbonates', functionalClass: ['Raising agent'], isCosmetic: false, fssaiSchedule: 'GMP', generalRegulatoryStatus: 'GMP_PERMITTED' },
  { insNumber: 'INS 551', eNumber: 'E551', primaryName: 'Silicon dioxide (amorphous)', functionalClass: ['Anticaking agent'], isCosmetic: false, fssaiSchedule: 'Appendix A', generalRegulatoryStatus: 'PERMITTED_IN_SPECIFIED_FOODS' },

  // Flavor Enhancers (Cosmetic Ultra-Processing Markers)
  { insNumber: 'INS 621', eNumber: 'E621', primaryName: 'Monosodium L-glutamate (MSG)', functionalClass: ['Flavor enhancer'], isCosmetic: true, fssaiSchedule: 'Appendix A', generalRegulatoryStatus: 'PERMITTED_IN_SPECIFIED_FOODS' },
  { insNumber: 'INS 627', eNumber: 'E627', primaryName: 'Disodium 5-guanylate', functionalClass: ['Flavor enhancer'], isCosmetic: true, fssaiSchedule: 'Appendix A', generalRegulatoryStatus: 'PERMITTED_IN_SPECIFIED_FOODS' },
  { insNumber: 'INS 631', eNumber: 'E631', primaryName: 'Disodium 5-inosinate', functionalClass: ['Flavor enhancer'], isCosmetic: true, fssaiSchedule: 'Appendix A', generalRegulatoryStatus: 'PERMITTED_IN_SPECIFIED_FOODS' },
  { insNumber: 'INS 635', eNumber: 'E635', primaryName: 'Disodium 5-ribonucleotides', functionalClass: ['Flavor enhancer'], isCosmetic: true, fssaiSchedule: 'Appendix A', generalRegulatoryStatus: 'PERMITTED_IN_SPECIFIED_FOODS' },

  // Non-Nutritive Sweeteners (Cosmetic Ultra-Processing Markers)
  { insNumber: 'INS 950', eNumber: 'E950', primaryName: 'Acesulfame potassium', functionalClass: ['Sweetener'], isCosmetic: true, fssaiSchedule: 'Appendix A', generalRegulatoryStatus: 'PERMITTED_IN_SPECIFIED_FOODS' },
  { insNumber: 'INS 951', eNumber: 'E951', primaryName: 'Aspartame', functionalClass: ['Sweetener'], isCosmetic: true, fssaiSchedule: 'Appendix A', generalRegulatoryStatus: 'PERMITTED_IN_SPECIFIED_FOODS' },
  { insNumber: 'INS 955', eNumber: 'E955', primaryName: 'Sucralose', functionalClass: ['Sweetener'], isCosmetic: true, fssaiSchedule: 'Appendix A', generalRegulatoryStatus: 'PERMITTED_IN_SPECIFIED_FOODS' },
  { insNumber: 'INS 960', eNumber: 'E960', primaryName: 'Steviol glycosides', functionalClass: ['Sweetener'], isCosmetic: true, fssaiSchedule: 'Appendix A', generalRegulatoryStatus: 'PERMITTED_IN_SPECIFIED_FOODS' },

  // Colors (Synthetic & Natural Extracts)
  { insNumber: 'INS 102', eNumber: 'E102', primaryName: 'Tartrazine', functionalClass: ['Color'], isCosmetic: true, fssaiSchedule: 'Appendix A', generalRegulatoryStatus: 'PERMITTED_IN_SPECIFIED_FOODS' },
  { insNumber: 'INS 110', eNumber: 'E110', primaryName: 'Sunset yellow FCF', functionalClass: ['Color'], isCosmetic: true, fssaiSchedule: 'Appendix A', generalRegulatoryStatus: 'PERMITTED_IN_SPECIFIED_FOODS' },
  { insNumber: 'INS 122', eNumber: 'E122', primaryName: 'Carmoisine', functionalClass: ['Color'], isCosmetic: true, fssaiSchedule: 'Appendix A', generalRegulatoryStatus: 'PERMITTED_IN_SPECIFIED_FOODS' },
  { insNumber: 'INS 124', eNumber: 'E124', primaryName: 'Ponceau 4R', functionalClass: ['Color'], isCosmetic: true, fssaiSchedule: 'Appendix A', generalRegulatoryStatus: 'PERMITTED_IN_SPECIFIED_FOODS' },
  { insNumber: 'INS 127', eNumber: 'E127', primaryName: 'Erythrosine', functionalClass: ['Color'], isCosmetic: true, fssaiSchedule: 'Appendix A', generalRegulatoryStatus: 'PERMITTED_IN_SPECIFIED_FOODS' },
  { insNumber: 'INS 133', eNumber: 'E133', primaryName: 'Brilliant blue FCF', functionalClass: ['Color'], isCosmetic: true, fssaiSchedule: 'Appendix A', generalRegulatoryStatus: 'PERMITTED_IN_SPECIFIED_FOODS' },
  { insNumber: 'INS 150a', eNumber: 'E150a', primaryName: 'Plain caramel (Caramel I)', functionalClass: ['Color'], isCosmetic: true, fssaiSchedule: 'GMP', generalRegulatoryStatus: 'GMP_PERMITTED' },
  { insNumber: 'INS 150d', eNumber: 'E150d', primaryName: 'Sulphite ammonia caramel (Caramel IV)', functionalClass: ['Color'], isCosmetic: true, fssaiSchedule: 'Appendix A', generalRegulatoryStatus: 'PERMITTED_IN_SPECIFIED_FOODS' },
  { insNumber: 'INS 160a', eNumber: 'E160a', primaryName: 'Carotenes (beta-carotene)', functionalClass: ['Color'], isCosmetic: true, fssaiSchedule: 'GMP', generalRegulatoryStatus: 'GMP_PERMITTED' },
  { insNumber: 'INS 160c', eNumber: 'E160c', primaryName: 'Paprika extract (Capsanthin)', functionalClass: ['Color'], isCosmetic: true, fssaiSchedule: 'GMP', generalRegulatoryStatus: 'GMP_PERMITTED' }
];

fs.writeFileSync('c:\\Users\\sabya\\OneDrive\\Desktop\\SmartChoice\\backend\\data\\fssai\\additivesReference.json', JSON.stringify(additives, null, 2), 'utf8');
console.log('additivesReference.json created with', additives.length, 'entries');