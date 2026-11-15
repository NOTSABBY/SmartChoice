const Product = require('../models/Product');
const { analyzeProduct } = require('../services/productAnalysisService');
const { NUTRITION_THRESHOLDS, CATEGORY_FORMAT_MAP } = require('../config/analysisThresholds');
const { ICMR_NIN_RDA_2020 } = require('../config/icmrRdaReference');

// Get analysis for a single product by ID or catalog productId
async function getProductAnalysis(req, res) {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const cleanId = id.trim();
    let product = null;
    const isDbConnected = require('mongoose').connection.readyState === 1;

    // 1. Query MongoDB if connected
    if (isDbConnected) {
      try {
        if (cleanId.match(/^[0-9a-fA-F]{24}$/)) {
          product = await Product.findById(cleanId).lean();
        }
        if (!product) {
          product = await Product.findOne({
            $or: [
              { 'catalog.productId': cleanId },
              { 'identity.barcode': cleanId },
              { _id: cleanId }
            ]
          }).lean();
        }
      } catch (dbErr) {
        console.warn("MongoDB query in getProductAnalysis failed:", dbErr.message);
      }
    }

    // 2. Fallback to catalogLoader if not found in DB or DB offline
    if (!product) {
      const catalogLoader = require('../utils/catalogLoader');
      product = catalogLoader.getProductById(cleanId);
    }

    if (!product) {
      if (!isDbConnected) {
        return res.status(503).json({
          success: false,
          message: 'Database service is currently unavailable and product was not found in local catalogue'
        });
      }
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
      productName: product.catalog?.productName || product.identity?.name || product.identity?.productName || 'SmartChoice Product',
      brand: product.catalog?.brand || product.identity?.brand || 'Packaged Brand',
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