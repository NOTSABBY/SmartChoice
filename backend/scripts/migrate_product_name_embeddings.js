/**
 * SmartChoice Product-Name-Only Embedding Migration & Audit Script
 * 
 * Audits and safely regenerates product embeddings in MongoDB:
 * 1. Checks existing embeddings for schema and model compliance.
 * 2. Compares textHash to detect legacy embeddings containing ingredients/nutrition.
 * 3. Safely migrates products to version "v2" (normalized product name only).
 * 4. Preserves all other product fields (nutrition, ingredients, scores).
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const productEmbeddingService = require('../services/productEmbeddingService');
const catalogLoader = require('../utils/catalogLoader');

async function migrateEmbeddings() {
  console.log('=== SMARTCHOICE PRODUCT-NAME EMBEDDING MIGRATION & AUDIT ===\n');

  // Audit local catalog products
  const catalogProducts = catalogLoader.getCatalog500Products
    ? catalogLoader.getCatalog500Products()
    : catalogLoader.getAllProducts();

  console.log(`Audited local catalogue: ${catalogProducts.length} products loaded.`);
  
  let sampleText = productEmbeddingService.buildProductEmbeddingText(catalogProducts[0]);
  console.log(`Sample product-name embedding text: "${sampleText}"`);

  // Check MongoDB connection
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('\n[INFO] MONGODB_URI not provided. Local runtime operates with deterministic semantic retrieval.');
    return;
  }

  try {
    console.log('\nConnecting to MongoDB...');
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('MongoDB connected successfully.');

    const totalInDb = await Product.countDocuments();
    console.log(`Total products in database: ${totalInDb}`);

    const withEmbeddings = await Product.countDocuments({
      'embedding.vector': { $exists: true, $ne: [] }
    });
    console.log(`Products with existing embeddings: ${withEmbeddings}`);

    const v1Embeddings = await Product.countDocuments({
      'embedding.version': 'v1'
    });
    console.log(`Legacy v1 (mixed fields) embeddings: ${v1Embeddings}`);

    const v2Embeddings = await Product.countDocuments({
      'embedding.version': 'v2'
    });
    console.log(`Up-to-date v2 (product-name-only) embeddings: ${v2Embeddings}`);

    if (process.env.HUGGINGFACE_API_KEY) {
      console.log('\nStarting safe migration to v2 (product-name-only)...');
      let updatedCount = 0;
      const cursor = Product.find().cursor();
      for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
        const text = productEmbeddingService.buildProductEmbeddingText(doc);
        const hash = productEmbeddingService._hashText(text);
        if (!doc.embedding || doc.embedding.version !== 'v2' || doc.embedding.textHash !== hash) {
          try {
            await productEmbeddingService.generateProductEmbedding(doc);
            await doc.save();
            updatedCount++;
            if (updatedCount % 25 === 0) {
              console.log(`Migrated ${updatedCount} products...`);
            }
          } catch (err) {
            console.warn(`Failed embedding for ${doc._id}: ${err.message}`);
          }
        }
      }
      console.log(`\nMigration completed. Total updated: ${updatedCount}`);
    } else {
      console.log('\n[INFO] HUGGINGFACE_API_KEY not configured. Skipping online embedding regeneration.');
    }

    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
  } catch (err) {
    console.warn(`[INFO] Database connection unavailable (${err.message}). Safe fallback preserved.`);
  }
}

migrateEmbeddings().catch(console.error);
