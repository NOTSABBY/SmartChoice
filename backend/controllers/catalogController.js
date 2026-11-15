const Product = require('../models/Product');
const catalogStatisticsService = require('../services/catalogStatisticsService');
const catalogImportService = require('../services/catalogImportService');
const catalogSyncService = require('../services/catalogSyncService');
const productEnrichmentService = require('../services/productEnrichmentService');

/**
 * Public: Get catalog statistics & completeness
 */
const getCatalogStatistics = async (req, res, next) => {
  try {
    const stats = await catalogStatisticsService.getCatalogStatistics();
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
};

/**
 * Public: List catalog products with pagination, category/brand filters & search
 */
const listCatalogProducts = async (req, res, next) => {
  try {
    const {
      q,
      categoryId,
      category,
      brand,
      status,
      page = 1,
      limit = 20
    } = req.query;

    const filter = { 'catalog.productId': { $exists: true } };

    if (q && q.trim()) {
      const term = q.trim();
      filter.$or = [
        { 'catalog.productName': { $regex: term, $options: 'i' } },
        { 'catalog.brand': { $regex: term, $options: 'i' } },
        { 'catalog.productId': { $regex: term, $options: 'i' } }
      ];
    }

    if (categoryId) {
      filter['catalog.categoryId'] = parseInt(categoryId, 10);
    }

    if (category && category.trim()) {
      filter['catalog.categoryName'] = { $regex: category.trim(), $options: 'i' };
    }

    if (brand && brand.trim()) {
      filter['catalog.brand'] = { $regex: brand.trim(), $options: 'i' };
    }

    if (status && status.trim()) {
      filter['enrichment.status'] = status.trim().toUpperCase();
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    let products = [];
    let total = 0;

    if (require('mongoose').connection.readyState === 1) {
      try {
        [products, total] = await Promise.all([
          Product.find(filter)
            .sort({ 'catalog.categoryId': 1, 'catalog.productId': 1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
          Product.countDocuments(filter)
        ]);
      } catch (dbErr) {
        console.warn("MongoDB list query failed, falling back to disk catalog:", dbErr.message);
      }
    }

    if (products.length === 0 && total === 0) {
      const catalogLoader = require('../utils/catalogLoader');
      let all = catalogLoader.loadProductsFromDisk();
      if (q && q.trim()) {
        const term = q.trim().toLowerCase();
        all = all.filter(p => 
          (p.product_name && p.product_name.toLowerCase().includes(term)) ||
          (p.catalog?.productName && p.catalog.productName.toLowerCase().includes(term)) ||
          (p.brand && p.brand.toLowerCase().includes(term)) ||
          (p.product_id && p.product_id.toLowerCase().includes(term)) ||
          (p._id && String(p._id).toLowerCase().includes(term))
        );
      }
      if (categoryId) {
        const cId = parseInt(categoryId, 10);
        all = all.filter(p => (p.category_id || p.catalog?.categoryId) === cId);
      }

      // Apply global dietary eligibility if requested
      const hasPrefs = req.query.preferences || req.query.vegetarian || req.query.vegan || req.query.avoidAllergens || req.query.excludedIngredients;
      if (hasPrefs) {
        let prefs = {};
        try {
          prefs = typeof req.query.preferences === 'string' ? JSON.parse(req.query.preferences) : (req.query.preferences || {});
        } catch (e) { prefs = {}; }
        if (req.query.vegetarian === 'true') prefs.vegetarian = true;
        if (req.query.vegan === 'true') prefs.vegan = true;
        if (req.query.avoidAllergens) prefs.avoidAllergens = String(req.query.avoidAllergens).split(',');
        if (req.query.excludedIngredients) prefs.excludedIngredients = String(req.query.excludedIngredients).split(',');

        const { evaluateProductEligibility } = require('../services/eligibilityService');
        all = all.filter(p => evaluateProductEligibility(p, prefs).eligible);
      }

      total = all.length;
      products = all.slice(skip, skip + limitNum);
    }

    res.json({
      success: true,
      data: products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Public: Get product by Catalog Product ID (or _id fallback)
 */
const getCatalogProductById = async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Product ID parameter is required' });
    }

    let product = null;
    if (require('mongoose').connection.readyState === 1) {
      try {
        product = await Product.findOne({ 'catalog.productId': id }).lean();
        if (!product && /^[0-9a-fA-F]{24}$/.test(id)) {
          product = await Product.findById(id).lean();
        }
        if (!product) {
          product = await Product.findOne({ 'identity.barcode': id }).lean();
        }
      } catch (dbErr) {
        console.warn("MongoDB query in getCatalogProductById failed:", dbErr.message);
      }
    }

    if (!product) {
      const catalogLoader = require('../utils/catalogLoader');
      product = catalogLoader.getProductById(id);
    }

    if (!product) {
      return res.status(404).json({ success: false, error: `Product not found for ID: ${id}` });
    }

    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
};

/**
 * Public: List all 25 categories
 */
const listCategories = async (req, res, next) => {
  try {
    const catalogLoader = require('../utils/catalogLoader');
    let data = [];

    if (require('mongoose').connection.readyState === 1) {
      try {
        const categories = await Product.aggregate([
          { $match: { 'catalog.productId': { $exists: true } } },
          {
            $group: {
              _id: '$catalog.categoryName',
              categoryId: { $first: '$catalog.categoryId' },
              productCount: { $sum: 1 },
              brands: { $addToSet: '$catalog.brand' }
            }
          },
          { $sort: { categoryId: 1 } }
        ]);

        if (categories && categories.length > 0) {
          data = categories.map(c => ({
            categoryId: c.categoryId,
            categoryName: c._id,
            productCount: c.productCount,
            brandCount: c.brands.length
          }));
        }
      } catch (aggErr) {
        console.warn("MongoDB aggregate failed, falling back to disk catalog:", aggErr.message);
      }
    }

    if (data.length === 0) {
      data = catalogLoader.getCategories();
    }

    res.json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin: Validate catalog workbook dry-run
 */
const validateWorkbook = async (req, res, next) => {
  try {
    const { filePath } = req.body;
    const report = await catalogImportService.validateWorkbook(filePath);
    res.json({ success: report.success, data: report });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin: Import catalog from workbook
 */
const importCatalog = async (req, res, next) => {
  try {
    const { filePath, dryRun } = req.body;
    const result = await catalogImportService.importCatalog({ filePath, dryRun });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin: Synchronize catalog
 */
const syncCatalog = async (req, res, next) => {
  try {
    const { filePath } = req.body;
    const result = await catalogSyncService.syncCatalog({ filePath });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin: Trigger Open Food Facts enrichment batch
 */
const triggerEnrichment = async (req, res, next) => {
  try {
    const { limit = 10, statuses } = req.body;
    const result = await productEnrichmentService.runEnrichmentBatch({ limit, statuses });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin: Get enrichment status
 */
const getEnrichmentStatus = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        isRunning: productEnrichmentService.isEnrichmentRunning,
        lastRunStats: productEnrichmentService.lastRunStats
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCatalogStatistics,
  listCatalogProducts,
  getCatalogProductById,
  listCategories,
  validateWorkbook,
  importCatalog,
  syncCatalog,
  triggerEnrichment,
  getEnrichmentStatus
};
