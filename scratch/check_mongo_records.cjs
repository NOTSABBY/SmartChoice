const path = require('path');
const mongoose = require(path.join(__dirname, '../backend/node_modules/mongoose'));
const dotenv = require(path.join(__dirname, '../backend/node_modules/dotenv'));
dotenv.config({ path: path.join(__dirname, '../.env') });

mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 }).then(async () => {
  const Product = require('../backend/models/Product');
  const prods = await Product.find({}).lean();
  console.log(`Total products in MongoDB: ${prods.length}`);

  let nullNutrition = 0;
  let emptyIngredients = 0;
  let cat500Count = 0;

  for (const p of prods) {
    const isCat500 = p.catalog?.productId && p.catalog.productId.startsWith('PKG_PRD_');
    if (isCat500) cat500Count++;

    const hasNut = p.nutrition?.calories != null || (p.nutrition_info?.per_100g && p.nutrition_info.per_100g.energy_kcal != null);
    if (!hasNut) nullNutrition++;

    const hasIng = !!(p.ingredients?.rawText || p.ingredients?.rawIngredientsText || p.nutrition_info?.ingredients_text || (p.ingredients?.ingredients && p.ingredients.ingredients.length > 0));
    if (!hasIng) emptyIngredients++;
  }

  console.log(`Catalog-500 SKUs (PKG_PRD_*): ${cat500Count}`);
  console.log(`Products with null nutrition: ${nullNutrition}`);
  console.log(`Products with empty ingredients: ${emptyIngredients}`);

  const p1 = await Product.findOne({ 'catalog.productId': 'PKG_PRD_0001' }).lean();
  console.log('PKG_PRD_0001 in Mongo:', {
    name: p1.identity?.name,
    nut: p1.nutrition,
    nut_info: p1.nutrition_info,
    ing: p1.ingredients
  });

  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
