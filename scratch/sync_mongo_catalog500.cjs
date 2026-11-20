const path = require('path');
const fs = require('fs');
const mongoose = require(path.join(__dirname, '../backend/node_modules/mongoose'));
const dotenv = require(path.join(__dirname, '../backend/node_modules/dotenv'));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function syncCatalog500() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  console.log('Connected.');

  const Product = require('../backend/models/Product');
  const catalogPath = path.join(__dirname, '../frontend/public/data/enriched_catalog_500.json');
  const rawCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

  let products = [];
  if (rawCatalog.categories && Array.isArray(rawCatalog.categories)) {
    rawCatalog.categories.forEach(cat => {
      (cat.products || []).forEach(p => products.push({ ...p, category_id: p.category_id || cat.id, category_name: p.category_name || cat.name }));
    });
  }

  console.log(`Loaded ${products.length} products from enriched_catalog_500.json`);

  const ops = products.map(p => {
    const p100 = p.nutrition_info?.per_100g || {};
    const rawIngText = p.nutrition_info?.ingredients_text || p.ingredients?.rawText || '';

    const updateFields = {
      'catalog.productId': p.product_id,
      'catalog.productName': p.product_name,
      'catalog.brand': p.brand,
      'catalog.categoryId': p.category_id,
      'catalog.categoryName': p.category_name,
      'catalog.packagingSize': p.packaging_size,
      product_id: p.product_id,
      product_name: p.product_name,
      brand: p.brand,
      category_id: p.category_id,
      category_name: p.category_name,
      images: p.images || {},
      media: {
        imageUrl: p.images?.front_hd || p.images?.front_thumb || '',
        thumbnailUrl: p.images?.front_thumb || '',
        frontThumb: p.images?.front_thumb || '',
        frontHd: p.images?.front_hd || ''
      },
      serving: {
        servingSize: p.nutrition_info?.serving_size || p.packaging_size || '100 g',
        servingSizeUnit: 'g'
      },
      nutrition_info: p.nutrition_info || {},
      nutrition: {
        basis: 'per_100g',
        servingSize: p.nutrition_info?.serving_size || p.packaging_size || '100 g',
        servingSizeUnit: 'g',
        calories: p100.energy_kcal ?? null,
        protein: p100.protein_g ?? null,
        carbohydrates: p100.carbohydrates_g ?? null,
        sugar: p100.total_sugars_g ?? null,
        addedSugars: p100.added_sugars_g ?? 0,
        fat: p100.total_fat_g ?? null,
        saturatedFat: p100.saturated_fat_g ?? null,
        transFat: p100.trans_fat_g ?? 0,
        fiber: p100.dietary_fiber_g ?? null,
        sodium: p100.sodium_mg ?? null
      },
      ingredients: {
        rawText: rawIngText,
        rawIngredientsText: rawIngText,
        ingredients: (p.ingredients?.ingredients || []).map(i => (typeof i === 'string' ? i : (i.name || i.raw || ''))).filter(Boolean),
        structuredIngredients: p.ingredients?.ingredients || [],
        allergens: p.nutrition_info?.allergens || [],
        additives: [],
        verificationStatus: p.nutrition_info?.verification_status || 'VERIFIED',
        sourceUrl: p.nutrition_info?.source_url || '',
        sourceType: p.nutrition_info?.source_type || 'OFFICIAL_MANUFACTURER_PACKAGING',
        verifiedAt: new Date(),
        allergenDeclarations: {
          contains: p.nutrition_info?.allergens || [],
          mayContain: p.nutrition_info?.may_contain || [],
          status: (p.nutrition_info?.allergens?.length > 0 || p.nutrition_info?.may_contain?.length > 0) ? 'ALLERGENS_IDENTIFIED' : 'NO_ALLERGENS_DETECTED',
          source: p.nutrition_info?.source_type || 'OFFICIAL_MANUFACTURER_PACKAGING'
        }
      },
      processing: {
        novaGroup: p.nutrition_info?.nova_group ?? 4,
        nutriScore: p.nutrition_info?.nutri_score || null,
        level: p.nutrition_info?.nova_group === 1 ? 'Unprocessed or minimally processed' :
               p.nutrition_info?.nova_group === 2 ? 'Processed culinary ingredient' :
               p.nutrition_info?.nova_group === 3 ? 'Processed food' : 'Ultra-processed food'
      },
      dietaryClassification: p.dietaryClassification || p.dietary_classification,
      dietary_classification: p.dietaryClassification || p.dietary_classification,
      dairyClassification: p.dairyClassification || p.dairy_classification,
      dairy_classification: p.dairyClassification || p.dairy_classification,
      'dataQuality.completeness': 95,
      'enrichment.status': 'ENRICHED'
    };

    return {
      updateOne: {
        filter: { 'catalog.productId': p.product_id },
        update: { $set: updateFields }
      }
    };
  });

  console.log(`Executing bulkWrite for ${ops.length} operations...`);
  const result = await Product.bulkWrite(ops, { ordered: false });
  console.log('bulkWrite Result:', {
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
    upsertedCount: result.upsertedCount
  });

  await mongoose.disconnect();
  console.log('Done.');
}

syncCatalog500().catch(err => {
  console.error(err);
  process.exit(1);
});
