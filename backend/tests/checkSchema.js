const Product = require('./backend/models/Product');
const schema = Product.schema;
console.log('analysis in schema before:', !!schema.path('analysis'));