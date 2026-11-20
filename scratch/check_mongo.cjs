const mongoose = require('mongoose');
require('dotenv').config();

const connectDb = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('MongoDB connected successfully!');
    const Product = require('./backend/models/Product');
    const p1 = await Product.findOne({ $or: [{ 'catalog.productId': 'PKG_PRD_0497' }, { product_id: 'PKG_PRD_0497' }, { _id: 'PKG_PRD_0497' }] }).lean();
    console.log('MongoDB PKG_PRD_0497:', p1 ? {
      id: p1._id,
      catalog: p1.catalog,
      identity: p1.identity,
      nutrition: p1.nutrition,
      nutrition_info: p1.nutrition_info,
      ingredients: p1.ingredients
    } : 'NOT FOUND IN MONGO');

    const p2 = await Product.findOne({ $or: [{ 'catalog.productId': 'PKG_PRD_0482' }, { product_id: 'PKG_PRD_0482' }, { _id: 'PKG_PRD_0482' }] }).lean();
    console.log('MongoDB PKG_PRD_0482:', p2 ? {
      id: p2._id,
      catalog: p2.catalog,
      identity: p2.identity,
      nutrition: p2.nutrition,
      nutrition_info: p2.nutrition_info,
      ingredients: p2.ingredients
    } : 'NOT FOUND IN MONGO');
  } catch (err) {
    console.log('MongoDB connection error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
};
connectDb();
