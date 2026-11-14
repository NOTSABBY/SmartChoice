const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const connectDB = require('../config/database');
const Product = require('../models/Product');

async function check() {
  await connectDB();
  const sample = await Product.findOne({ 'catalog.productId': { $exists: true } });
  console.log('Sample catalog productId:', sample ? sample.catalog.productId : 'none');
  process.exit(0);
}
check();