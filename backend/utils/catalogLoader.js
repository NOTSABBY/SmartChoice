const fs = require('fs');
const path = require('path');
const { classifyProductDietary } = require('./dietaryClassifier');
const { classifyProductDairy } = require('../services/dairyClassificationService');

let cachedProducts = null;
let productsMap = null;

const loadProductsFromDisk = () => {
  if (cachedProducts) {
    return cachedProducts;
  }

  const possiblePaths = [
    path.join(__dirname, '../../frontend/public/data/enriched_catalog_500.json'),
    path.join(process.cwd(), 'frontend/public/data/enriched_catalog_500.json'),
    path.join(process.cwd(), 'data/processed/products_india.json')
  ];

  let rawData = null;
  let source = '';

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        rawData = JSON.parse(fs.readFileSync(p, 'utf8'));
        source = p;
        break;
      } catch (err) {
        console.warn(`Failed reading catalog JSON from ${p}:`, err.message);
      }
    }
  }

  if (!rawData) {
    console.error("Could not find any catalog JSON file on disk.");
    return [];
  }

  const products = [];

  if (Array.isArray(rawData)) {
    // Already an array of products (e.g. products_india.json)
    rawData.forEach(p => {
      const canonicalId = p._id || p.catalog?.productId || p.identity?.barcode || String(Math.random());
      const dc = p.dietaryClassification || p.dietary_classification || classifyProductDietary(p);
      products.push({
        _id: canonicalId,
        ...p,
        dietary_classification: dc,
        dietaryClassification: dc,
        dairy_classification: p.dairyClassification || classifyProductDairy(p),
        dairyClassification: p.dairyClassification || classifyProductDairy(p),
        dietary_type: dc.status === 'NON_VEGETARIAN' ? 'NON_VEG' : (dc.status === 'VEGAN' || dc.status === 'VEGETARIAN' ? 'VEG' : 'UNKNOWN'),
        identity: {
          ...(p.identity || { name: 'Unknown Product', brand: 'Unknown' }),
          dietaryType: dc.status === 'NON_VEGETARIAN' ? 'NON_VEGETARIAN' : (dc.status === 'VEGAN' || dc.status === 'VEGETARIAN' ? 'VEGETARIAN' : 'UNKNOWN')
        },
        nutrition: p.nutrition || {},
        ingredients: p.ingredients || {},
        media: p.media || {},
        processing: p.processing || {}
      });
    });
  } else if (rawData.categories && Array.isArray(rawData.categories)) {
    // enriched_catalog_500.json format
    rawData.categories.forEach(cat => {
      (cat.products || []).forEach(p => {
        const canonicalId = p.product_id;
        const dc = classifyProductDietary(p);
        products.push({
          _id: canonicalId,
          catalog: {
            productId: p.product_id,
            categoryId: p.category_id || cat.id,
            categoryName: p.category_name || cat.name,
            brand: p.brand,
            productName: p.product_name,
            packagingSize: p.packaging_size,
            mrp: p.mrp,
            price: p.price,
            discountPercent: p.discount_percent,
            rating: p.rating,
            reviewCount: p.review_count,
            inStock: p.in_stock
          },
          product_id: canonicalId,
          product_name: p.product_name,
          brand: p.brand,
          category_id: p.category_id || cat.id,
          category_name: p.category_name || cat.name,
          dietary_type: dc.status === 'NON_VEGETARIAN' ? 'NON_VEG' : (dc.status === 'VEGAN' || dc.status === 'VEGETARIAN' ? 'VEG' : 'UNKNOWN'),
          dietary_classification: dc,
          dietaryClassification: dc,
          dairy_classification: classifyProductDairy(p),
          dairyClassification: classifyProductDairy(p),
          identity: {
            barcode: p.product_id,
            name: p.product_name,
            brand: p.brand,
            categories: [p.category_name || cat.name],
            productType: 'food',
            dietaryType: dc.status === 'NON_VEGETARIAN' ? 'NON_VEGETARIAN' : (dc.status === 'VEGAN' || dc.status === 'VEGETARIAN' ? 'VEGETARIAN' : 'UNKNOWN')
          },
          serving: {
            servingSize: p.nutrition_info?.serving_size || p.packaging_size || '100 g',
            servingSizeUnit: 'g'
          },
          media: {
            imageUrl: p.images?.front_hd || p.images?.front_thumb || '',
            frontThumb: p.images?.front_thumb || '',
            frontHd: p.images?.front_hd || ''
          },
          images: p.images || {},
          nutrition_info: p.nutrition_info || {},
          ingredients: {
            rawText: p.nutrition_info?.ingredients_text || '',
            rawIngredientsText: p.nutrition_info?.ingredients_text || '',
            ingredients: p.ingredients?.ingredients || [],
            allergens: p.nutrition_info?.allergens || [],
            verificationStatus: p.nutrition_info?.verification_status || 'VERIFIED',
            sourceUrl: p.nutrition_info?.source_url || '',
            sourceType: p.nutrition_info?.source_type || 'OFFICIAL_MANUFACTURER_PACKAGING',
            verifiedAt: new Date('2026-11-15T09:00:00.000Z'),
            allergenDeclarations: {
              contains: p.nutrition_info?.allergens || [],
              mayContain: p.nutrition_info?.may_contain || [],
              status: (p.nutrition_info?.allergens?.length > 0 || p.nutrition_info?.may_contain?.length > 0) ? 'ALLERGENS_IDENTIFIED' : 'NO_ALLERGENS_DETECTED',
              source: p.nutrition_info?.source_type || 'OFFICIAL_MANUFACTURER_PACKAGING'
            },
            analysis: {
              identifiedAllergens: p.nutrition_info?.allergens || []
            }
          },
          nutrition: {
            calories: p.nutrition_info?.per_100g?.energy_kcal ?? null,
            protein: p.nutrition_info?.per_100g?.protein_g ?? null,
            carbohydrates: p.nutrition_info?.per_100g?.carbohydrates_g ?? null,
            sugar: p.nutrition_info?.per_100g?.total_sugars_g ?? null,
            fat: p.nutrition_info?.per_100g?.total_fat_g ?? null,
            saturatedFat: p.nutrition_info?.per_100g?.saturated_fat_g ?? null,
            fiber: p.nutrition_info?.per_100g?.dietary_fiber_g ?? null,
            sodium: p.nutrition_info?.per_100g?.sodium_mg ?? null,
          },
          processing: {
            novaGroup: p.nutrition_info?.nova_group ?? null
          },
          dataQuality: {
            completeness: 90
          }
        });
      });
    });
  }

  // Also load products_india.json to index legacy retail barcodes
  const indiaPath = path.join(process.cwd(), 'data/processed/products_india.json');
  if (fs.existsSync(indiaPath)) {
    try {
      const indiaProds = JSON.parse(fs.readFileSync(indiaPath, 'utf8'));
      if (Array.isArray(indiaProds)) {
        indiaProds.forEach(p => {
          const barcode = p.identity?.barcode;
          if (barcode) {
            products.push({
              _id: barcode,
              ...p,
              identity: p.identity || { name: 'Unknown Product', brand: 'Unknown' },
              nutrition: p.nutrition || {},
              ingredients: p.ingredients || {},
              media: p.media || {},
              processing: p.processing || {}
            });
          }
        });
      }
    } catch (err) {
      console.warn("Failed reading products_india.json:", err.message);
    }
  }

  cachedProducts = products;
  productsMap = new Map();
  products.forEach(p => {
    const id = p._id;
    if (id) productsMap.set(String(id), p);
    if (p.catalog?.productId) productsMap.set(String(p.catalog.productId), p);
    if (p.identity?.barcode) productsMap.set(String(p.identity.barcode), p);
  });

  return cachedProducts;
};

const getAllProducts = () => {
  return loadProductsFromDisk();
};

const getCatalog500Products = () => {
  const all = loadProductsFromDisk();
  const cat500 = [];
  const seen = new Set();
  for (const p of all) {
    const id = String(p.catalog?.productId || p.product_id || p._id || '');
    if (id.startsWith('PKG_PRD_') && !seen.has(id)) {
      seen.add(id);
      cat500.push(p);
    }
  }
  return cat500;
};

const getProductsByIds = (ids = []) => {
  if (!ids || ids.length === 0) return [];
  loadProductsFromDisk();
  const results = [];
  const seen = new Set();

  for (const id of ids) {
    if (!id) continue;
    const key = String(id);
    if (!seen.has(key) && productsMap && productsMap.has(key)) {
      results.push(productsMap.get(key));
      seen.add(key);
    }
  }
  return results;
};

const getProductById = (id) => {
  if (!id) return null;
  loadProductsFromDisk();
  return productsMap?.get(String(id)) || null;
};

/**
 * Returns a diverse sample of products sampled evenly across all categories
 * to ensure personalized recommendations rank candidates from all categories.
 */
const getDiverseSample = (targetCount = 60) => {
  const all = loadProductsFromDisk();
  if (all.length <= targetCount) return all;

  // Group by category
  const catMap = new Map();
  all.forEach(p => {
    const cat = p.catalog?.categoryName || (p.identity?.categories && p.identity.categories[0]) || 'Other';
    if (!catMap.has(cat)) catMap.set(cat, []);
    catMap.get(cat).push(p);
  });

  const categories = Array.from(catMap.values());
  const perCategory = Math.max(2, Math.ceil(targetCount / categories.length));
  const sample = [];

  for (const catList of categories) {
    sample.push(...catList.slice(0, perCategory));
  }

  return sample;
};

const searchProducts = (query, limit = 20, categoryId = null) => {
  if (!query || typeof query !== 'string') return [];
  const q = query.toLowerCase().trim();
  const qClean = q.replace(/['’]/g, '');
  const all = loadProductsFromDisk();
  const targetCatId = categoryId !== null && categoryId !== undefined && categoryId !== '' && categoryId !== 'null'
    ? Number(categoryId)
    : null;

  return all.filter(p => {
    if (targetCatId !== null && !isNaN(targetCatId)) {
      const pCatId = p.catalog?.categoryId ?? p.category_id ?? p.identity?.categoryId;
      if (pCatId === undefined || pCatId === null || Number(pCatId) !== targetCatId) {
        return false;
      }
    }
    const name = (p.identity?.name || p.catalog?.productName || p.product_name || '').toLowerCase();
    const brand = (p.identity?.brand || p.catalog?.brand || p.brand || '').toLowerCase();

    const nameClean = name.replace(/['’]/g, '');
    const brandClean = brand.replace(/['’]/g, '');

    return (
      name.includes(q) || brand.includes(q) ||
      nameClean.includes(qClean) || brandClean.includes(qClean)
    );
  }).slice(0, limit);
};

const getCategories = () => {
  const all = loadProductsFromDisk();
  const catMap = new Map();
  for (const p of all) {
    const id = p.catalog?.categoryId || p.category_id || 1;
    const name = p.catalog?.categoryName || p.category_name || 'Category';
    const brand = p.identity?.brand || p.catalog?.brand || p.brand || '';
    if (!catMap.has(id)) {
      catMap.set(id, { categoryId: id, categoryName: name, productCount: 0, brands: new Set() });
    }
    const c = catMap.get(id);
    c.productCount++;
    if (brand) c.brands.add(brand);
  }
  return Array.from(catMap.values())
    .map(c => ({
      categoryId: c.categoryId,
      categoryName: c.categoryName,
      productCount: c.productCount,
      brandCount: c.brands.size
    }))
    .sort((a, b) => a.categoryId - b.categoryId);
};

module.exports = {
  loadProductsFromDisk,
  getAllProducts,
  getCatalog500Products,
  getProductsByIds,
  getProductById,
  getDiverseSample,
  searchProducts,
  getCategories
};
