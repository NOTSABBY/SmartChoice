const Product = require('../models/Product');
const offService = require('../services/openFoodFactsService');
const similarityService = require('../services/similarityService');
const comparisonService = require('../services/comparisonService');
const scoringService = require('../services/scoringService');
const preferenceService = require('../services/preferenceService');
const recommendationService = require('../services/recommendationService');

// @desc    Search products
// @route   GET /api/products/search?q=...
// @access  Public
const searchProducts = async (req, res, next) => {
  try {
    const query = req.query.q;
    const rawCategoryId = req.query.categoryId;
    const categoryId = (rawCategoryId !== undefined && rawCategoryId !== null && rawCategoryId !== '' && rawCategoryId !== 'null')
      ? parseInt(rawCategoryId, 10)
      : null;
    
    if (!query || query.trim().length === 0) {
      res.status(400);
      throw new Error('Search query is required');
    }

    const searchTerm = query.trim();
    const searchPattern = searchTerm.replace(/['’]/g, '');
    const regexStr = searchTerm !== searchPattern ? `${searchTerm}|${searchPattern}` : searchTerm;

    // 1. Check MongoDB first
    let localProducts = [];
    try {
      if (require('mongoose').connection.readyState === 1) {
        const queryFilter = {
          $or: [
            { 'identity.name': { $regex: regexStr, $options: 'i' } },
            { 'identity.brand': { $regex: regexStr, $options: 'i' } },
            { 'catalog.productName': { $regex: regexStr, $options: 'i' } },
            { 'catalog.brand': { $regex: regexStr, $options: 'i' } }
          ]
        };

        if (categoryId !== null && !isNaN(categoryId)) {
          queryFilter.$and = [
            {
              $or: [
                { 'catalog.categoryId': categoryId },
                { 'category_id': categoryId },
                { 'identity.categoryId': categoryId }
              ]
            }
          ];
        }

        localProducts = await Product.find(queryFilter).limit(20);
      }
    } catch (err) {
      console.warn("Database query failed, bypassing local search:", err.message);
    }

    // 1b. If DB didn't find items or is offline, check catalogLoader
    if (localProducts.length === 0) {
      const catalogLoader = require('../utils/catalogLoader');
      const catalogMatches = catalogLoader.searchProducts(searchTerm, 20, categoryId);
      if (catalogMatches.length > 0) {
        localProducts = catalogMatches;
      }
    }

    // 1c. Filter by global dietary restrictions if preferences provided
    let preferences = {};
    if (req.query.preferences) {
      try {
        preferences = typeof req.query.preferences === 'string'
          ? JSON.parse(req.query.preferences)
          : req.query.preferences;
      } catch (e) {
        preferences = {};
      }
    } else if (req.query.vegetarian || req.query.vegan || req.query.avoidAllergens || req.query.excludedIngredients) {
      preferences = {
        vegetarian: req.query.vegetarian === 'true',
        vegan: req.query.vegan === 'true',
        avoidAllergens: req.query.avoidAllergens ? String(req.query.avoidAllergens).split(',') : [],
        excludedIngredients: req.query.excludedIngredients ? String(req.query.excludedIngredients).split(',') : []
      };
    }

    if (Object.keys(preferences).length > 0) {
      const { evaluateProductEligibility } = require('../services/eligibilityService');
      const scope = req.query.scope || preferences.scope || 'catalog';
      localProducts = localProducts.filter(p => evaluateProductEligibility(p, preferences, { scope }).eligible);
    }

    // If an individual category is selected, return local results strictly without querying OFF
    if (categoryId !== null && !isNaN(categoryId)) {
      return res.json({
        success: true,
        data: localProducts,
        message: localProducts.length > 0 ? 'Products retrieved from selected category' : 'No products found'
      });
    }

    if (localProducts.length >= 5) {
      return res.json({
        success: true,
        data: localProducts,
        message: 'Products retrieved from local database'
      });
    }

    // 2. Query OFF if not enough local results
    let offProducts = [];
    let externalError = null;
    try {
      offProducts = await offService.searchProducts(searchTerm, 10);
    } catch (err) {
      console.warn("External search failed:", err.message);
      externalError = "External product search is temporarily unavailable. Displaying local results only.";
    }
    
    if (offProducts.length === 0) {
      return res.json({
        success: true,
        data: localProducts,
        message: externalError || 'No additional products found'
      });
    }

    // 3. Save valid products to MongoDB
    const savedProducts = [];
    for (const prod of offProducts) {
      try {
        if (require('mongoose').connection.readyState === 1) {
          const existing = await Product.findOne({ 'identity.barcode': prod.identity.barcode });
          if (existing) {
            savedProducts.push(existing);
          } else {
            const newProduct = await Product.create(prod);
            savedProducts.push(newProduct);
          }
        } else {
          // just push it as a transient product if DB is down
          savedProducts.push(prod);
        }
      } catch (err) {
        console.error(`Failed to save product ${prod.identity.barcode}:`, err.message);
        savedProducts.push(prod); // still return it
      }
    }

    // 4. Combine and return unique results
    const allProductsMap = new Map();
    [...localProducts, ...savedProducts].forEach(p => {
      allProductsMap.set(p.identity.barcode, p);
    });

    res.json({
      success: true,
      data: Array.from(allProductsMap.values()),
      message: 'Products retrieved successfully'
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Get product by Barcode
// @route   GET /api/products/barcode/:barcode
// @access  Public
const getProductByBarcode = async (req, res, next) => {
  try {
    const { barcode } = req.params;
    
    // Validate barcode format roughly
    if (!barcode || !/^\d+$/.test(barcode)) {
      res.status(400);
      throw new Error('Invalid barcode format');
    }

    // 1. MongoDB lookup (only if database is connected)
    let product = null;
    if (require('mongoose').connection.readyState === 1) {
      try {
        product = await Product.findOne({ 'identity.barcode': barcode });
      } catch (dbErr) {
        console.warn("MongoDB barcode query failed:", dbErr.message);
      }
    }

    // 1b. Check local catalog fallback if not found in DB
    if (!product) {
      const catalogLoader = require('../utils/catalogLoader');
      product = catalogLoader.getProductById(barcode);
    }

    if (product) {
      return res.json({
        success: true,
        data: product,
        message: 'Product retrieved successfully'
      });
    }

    // 2. Not found locally, query OFF
    const offProduct = await offService.getProductByBarcode(barcode);

    if (!offProduct) {
      res.status(404);
      throw new Error('Product not found');
    }

    // 3. Save to MongoDB if connected
    if (require('mongoose').connection.readyState === 1) {
      try {
        product = await Product.create(offProduct);
      } catch (err) {
        console.warn("Failed to cache OFF product in DB:", err.message);
        product = offProduct;
      }
    } else {
      product = offProduct;
    }

    res.json({
      success: true,
      data: product,
      message: 'Product retrieved and cached'
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Get product by MongoDB ID or Catalog ID
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      res.status(400);
      throw new Error('Invalid product ID');
    }

    const cleanId = id.trim();
    let product = null;
    const isDbConnected = require('mongoose').connection.readyState === 1;

    // 1. Query MongoDB if connection is ready
    if (isDbConnected) {
      try {
        if (cleanId.match(/^[0-9a-fA-F]{24}$/)) {
          product = await Product.findById(cleanId).lean();
        } else {
          product = await Product.findOne({
            $or: [
              { 'catalog.productId': cleanId },
              { 'identity.barcode': cleanId },
              { _id: cleanId }
            ]
          }).lean();
        }
      } catch (dbErr) {
        console.warn("MongoDB query in getProductById failed:", dbErr.message);
      }
    }

    // 2. Fallback to catalogLoader if not in DB or DB offline
    if (!product) {
      const catalogLoader = require('../utils/catalogLoader');
      product = catalogLoader.getProductById(cleanId);
    }

    if (!product) {
      if (!isDbConnected) {
        res.status(503);
        throw new Error('Database service is currently unavailable and product was not found in local catalogue');
      }
      res.status(404);
      throw new Error('Product not found');
    }

    res.json({
      success: true,
      data: product,
      message: 'Product retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get similar products
// @route   GET /api/products/:id/similar
// @access  Public
const getSimilarProducts = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      res.status(400);
      throw new Error('Invalid product ID');
    }

    const data = await similarityService.getSimilarProducts(id.trim(), 5);
    
    res.json({
      success: true,
      data,
      message: 'Similar products retrieved successfully'
    });
  } catch (error) {
    if (error.message === 'Target product not found') {
      res.status(404);
    } else if (error.message.includes('unavailable')) {
      res.status(503);
    }
    next(error);
  }
};

// @desc    Compare multiple products
// @route   POST /api/compare
// @access  Public
const compareProducts = async (req, res, next) => {
  try {
    const { productIds, preferences = {} } = req.body;
    
    if (!Array.isArray(productIds)) {
      res.status(400);
      throw new Error('productIds must be an array');
    }

    // Validate that every product ID is a non-empty string
    for (const id of productIds) {
      if (!id || typeof id !== 'string' || id.trim().length === 0) {
        res.status(400);
        throw new Error(`Invalid product ID: ${id}`);
      }
    }

    const data = await comparisonService.compareProducts(productIds, preferences);

    res.json({
      success: true,
      data,
      message: 'Products compared successfully'
    });
  } catch (error) {
    if (error.message.includes('between 2 and 5') || error.message.includes('Duplicate') || error.message.includes('enough products') || error.message.includes('Invalid product ID')) {
      res.status(400);
    }
    next(error);
  }
};

// @desc    Get product score
// @route   GET /api/products/:id/score
// @access  Public
const getScore = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      res.status(400);
      throw new Error('Invalid product ID');
    }

    // Extract preferences from query
    const prefs = {
      highProtein: req.query.highProtein === 'true',
      lowSugar: req.query.lowSugar === 'true',
      lowSodium: req.query.lowSodium === 'true',
      highFiber: req.query.highFiber === 'true',
      lowCalories: req.query.lowCalories === 'true',
      lowSaturatedFat: req.query.lowSaturatedFat === 'true',
      lowFat: req.query.lowFat === 'true',
      vegetarian: req.query.vegetarian === 'true',
      vegan: req.query.vegan === 'true',
      avoidAllergens: req.query.avoidAllergens ? (Array.isArray(req.query.avoidAllergens) ? req.query.avoidAllergens : req.query.avoidAllergens.split(',').map(s => s.trim())) : [],
      avoidIngredients: req.query.avoidIngredients ? (Array.isArray(req.query.avoidIngredients) ? req.query.avoidIngredients : req.query.avoidIngredients.split(',').map(s => s.trim())) : []
    };

    const data = await scoringService.getScoreForProduct(id.trim(), prefs);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    if (error.message === 'Product not found') {
      res.status(404);
    } else if (error.message.includes('unavailable')) {
      res.status(503);
    }
    next(error);
  }
};

// @desc    Get multiple product scores
// @route   POST /api/scores
// @access  Public
const getScores = async (req, res, next) => {
  try {
    const { productIds } = req.body;
    
    if (!Array.isArray(productIds)) {
      res.status(400);
      throw new Error('productIds must be an array');
    }

    const data = await scoringService.getScoresForProducts(productIds);

    res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get default preferences
// @route   GET /api/preferences/default
// @access  Public
const getDefaultPreferences = (req, res) => {
  res.json({
    success: true,
    data: preferenceService.getDefaultPreferences()
  });
};

// @desc    Get recommendations
// @route   POST /api/recommendations
// @access  Public
const getRecommendations = async (req, res, next) => {
  try {
    const { productIds, preferences } = req.body || {};
    
    if (productIds !== undefined && productIds !== null && !Array.isArray(productIds)) {
      res.status(400);
      throw new Error('productIds must be an array');
    }

    // Check if any preferences are active
    const p = preferences || {};
    const hasActivePrefs = Boolean(
      p.highProtein || p.lowSugar || p.lowCalories || p.lowSaturatedFat || p.lowSodium || p.highFiber ||
      p.vegetarian || p.vegan ||
      (Array.isArray(p.avoidAllergens) && p.avoidAllergens.length > 0) ||
      (Array.isArray(p.excludedIngredients) && p.excludedIngredients.length > 0) ||
      (Array.isArray(p.avoidIngredients) && p.avoidIngredients.length > 0)
    );

    // If no specific productIds and no active preferences, return dedicated empty state
    if ((!productIds || productIds.length === 0) && !hasActivePrefs) {
      return res.json({
        success: true,
        data: [],
        hasActivePreferences: false,
        message: 'No active preferences selected. Personalize your preferences to receive recommendations.'
      });
    }

    let products = [];
    const catalogLoader = require('../utils/catalogLoader');

    // 1. If explicit productIds provided, fetch those products
    if (Array.isArray(productIds) && productIds.length > 0) {
      if (require('mongoose').connection.readyState === 1) {
        try {
          const objectIds = productIds.filter(id => typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/));
          const catalogIds = productIds.filter(id => typeof id === 'string' && !id.match(/^[0-9a-fA-F]{24}$/));
          const orClauses = [];
          if (objectIds.length > 0) orClauses.push({ _id: { $in: objectIds } });
          if (catalogIds.length > 0) orClauses.push({ 'catalog.productId': { $in: catalogIds } });
          if (orClauses.length > 0) {
            products = await Product.find({ $or: orClauses }).lean();
          }
        } catch (dbErr) {
          console.warn("MongoDB query in getRecommendations failed:", dbErr.message);
        }
      }

      // If DB returned fewer than requested or was offline, supplement from catalogLoader
      if (products.length < productIds.length) {
        const foundIds = new Set(products.map(p => (p._id ? p._id.toString() : p.catalog?.productId)));
        const missingIds = productIds.filter(id => !foundIds.has(String(id)));
        const diskItems = catalogLoader.getProductsByIds(missingIds);
        products = [...products, ...diskItems];
      }
    } else {
      // 2. If no productIds provided, retrieve all catalog products across all 25 categories
      if (require('mongoose').connection.readyState === 1) {
        try {
          products = await Product.find({ 'catalog.productId': { $exists: true } }).lean();
        } catch (dbErr) {
          console.warn("MongoDB query in getRecommendations failed:", dbErr.message);
        }
      }

      if (!products || products.length === 0) {
        products = catalogLoader.loadProductsFromDisk();
      }
    }

    if (!products || products.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const ranked = await recommendationService.rankProducts(products, preferences || {});

    res.json({
      success: true,
      data: ranked
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Semantic product search
// @route   GET /api/search/semantic?q=...
// @access  Public
const semanticSearch = async (req, res, next) => {
  try {
    const query = req.query.q || req.query.query;
    
    if (!query || query.trim().length === 0) {
      res.status(400);
      throw new Error('Search query is required');
    }

    if (query.length > 200) {
      res.status(400);
      throw new Error('Search query is too long (max 200 chars)');
    }

    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 500;
    const page = req.query.page ? parseInt(req.query.page, 10) : 1;
    const rawCategoryId = req.query.categoryId;
    const categoryId = (rawCategoryId !== undefined && rawCategoryId !== null && rawCategoryId !== '' && rawCategoryId !== 'null' && rawCategoryId !== 'all')
      ? parseInt(rawCategoryId, 10)
      : null;

    let preferences = {};
    if (req.query.preferences) {
      try {
        preferences = typeof req.query.preferences === 'string'
          ? JSON.parse(req.query.preferences)
          : req.query.preferences;
      } catch (e) {
        preferences = {};
      }
    } else {
      preferences = {
        vegetarian: req.query.vegetarian === 'true',
        vegan: req.query.vegan === 'true',
        avoidAllergens: req.query.avoidAllergens ? String(req.query.avoidAllergens).split(',') : [],
        excludedIngredients: req.query.excludedIngredients ? String(req.query.excludedIngredients).split(',') : []
      };
    }
    
    const vectorSearchService = require('../services/vectorSearchService');
    const scope = req.query.scope || preferences.scope || 'catalog';
    const results = await vectorSearchService.semanticProductSearch(query, { limit, page, categoryId, preferences, scope });

    const items = Array.isArray(results) ? results : (results.data || []);

    res.json({
      success: true,
      query: query,
      categoryId: categoryId,
      totalCatalogSize: results.totalCatalogSize ?? items.length,
      totalEvaluated: results.totalEvaluated ?? items.length,
      totalExcluded: results.totalExcluded ?? 0,
      totalMatches: results.totalMatches ?? items.length,
      totalEligible: results.totalEligible ?? results.totalMatches ?? items.length,
      totalNeedsReview: results.totalNeedsReview ?? 0,
      pagination: results.pagination ?? {
        page,
        limit,
        totalPages: Math.ceil(items.length / limit) || 1,
        totalCount: items.length,
        hasNextPage: page < (Math.ceil(items.length / limit) || 1),
        hasPrevPage: page > 1
      },
      understanding: results.understanding || results.intent || null,
      filters_applied: results.filters_applied || null,
      intent: results.intent || null,
      results: items,
      data: items,
      message: 'Semantic search completed successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get product ingredients analysis
// @route   GET /api/products/:id/ingredients
// @access  Public
const getIngredients = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ingredientAnalysisService = require('../services/ingredientAnalysisService');

    const product = await Product.findById(id);
    if (!product) {
      res.status(404);
      throw new Error('Product not found');
    }

    const analysis = ingredientAnalysisService.analyzeProduct(product);

    res.json({
      success: true,
      data: analysis,
      message: 'Ingredient analysis completed successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get product processing analysis
// @route   GET /api/products/:id/processing
// @access  Public
const getProcessing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const processingAnalysisService = require('../services/processingAnalysisService');

    const product = await Product.findById(id);
    if (!product) {
      res.status(404);
      throw new Error('Product not found');
    }

    const analysis = processingAnalysisService.analyzeProcessing(product);

    res.json({
      success: true,
      data: analysis,
      message: 'Processing analysis completed successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  searchProducts,
  getProductByBarcode,
  getProductById,
  getSimilarProducts,
  compareProducts,
  getScore,
  getScores,
  getDefaultPreferences,
  getRecommendations,
  semanticSearch,
  getIngredients,
  getProcessing
};
