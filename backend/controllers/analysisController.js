const Product = require('../models/Product');
const { analyzeProduct } = require('../services/productAnalysisService');
const { NUTRITION_THRESHOLDS, CATEGORY_FORMAT_MAP } = require('../config/analysisThresholds');
const { ICMR_NIN_RDA_2020 } = require('../config/icmrRdaReference');

// Get analysis for a single product by ID or catalog productId
async function getProductAnalysis(req, res) {
  try {
    const { id } = req.params;
    let product = await Product.findOne({ 'catalog.productId': id });
    if (!product) {
      product = await Product.findById(id);
    }
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const { statutoryRda, profileKey } = req.query;
    const analysis = analyzeProduct(product, {
      statutoryReferenceRdaG: statutoryRda ? parseFloat(statutoryRda) : null,
      personalizedProfileKey: profileKey || null
    });

    return res.json({
      success: true,
      productId: product.catalog?.productId || product._id,
      productName: product.catalog?.productName || product.identity?.productName,
      brand: product.catalog?.brand || product.identity?.brand,
      analysis
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// Inspect reference thresholds and statutory schedules
function getThresholdsReference(req, res) {
  return res.json({
    success: true,
    nutritionThresholds: NUTRITION_THRESHOLDS,
    categoryFormats: CATEGORY_FORMAT_MAP,
    icmrRdaReference: ICMR_NIN_RDA_2020
  });
}

module.exports = {
  getProductAnalysis,
  getThresholdsReference
};