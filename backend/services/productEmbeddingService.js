const crypto = require('crypto');
const embeddingService = require('./embeddingService');
const Product = require('../models/Product');
const { normalizeProductName } = require('./productNameNormalizationService');

const EMBEDDING_CONFIG = {
  model: process.env.HUGGINGFACE_EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2',
  version: "v2" // v2: strictly product-name-only embedding input (zero ingredients/nutrition)
};

class ProductEmbeddingService {
  /**
   * Deterministically builds the embedding input text for a product.
   * STRICT REQUIREMENT: Primary embedding input is the normalized product name.
   * Absolutely NO ingredients, nutrition facts, allergens, processing data,
   * health claims, or dynamic scores.
   * @param {Object} product - Product document
   * @returns {string} - Formatted text string for embedding
   */
  buildProductEmbeddingText(product) {
    if (!product) return '';

    const name = product.product_name || product.catalog?.productName || product.identity?.name || '';
    const { cleanName } = normalizeProductName(name);
    return cleanName || '';
  }

  /**
   * Generates a hash for the embedding text to detect changes.
   * @param {string} text - The formatted text
   * @returns {string} - SHA-256 hash
   */
  _hashText(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  /**
   * Generates a new embedding for a product, replacing the old one.
   * Does NOT save the product to the DB automatically.
   * @param {Object} product - Product document
   * @returns {Promise<Object>} - The updated product
   */
  async generateProductEmbedding(product) {
    const text = this.buildProductEmbeddingText(product);
    if (!text) {
      throw new Error('Cannot generate embedding text for product');
    }

    const textHash = this._hashText(text);
    const vector = await embeddingService.generateEmbedding(text);
    
    product.embedding = {
      vector,
      model: EMBEDDING_CONFIG.model,
      dimensions: vector.length,
      version: EMBEDDING_CONFIG.version,
      textHash,
      generatedAt: new Date()
    };

    return product;
  }

  /**
   * Ensures the product has a valid, up-to-date embedding.
   * Reuses existing if valid and unchanged.
   * @param {Object} product - Product document
   * @param {boolean} forceSave - If true, calls product.save() when modified
   * @returns {Promise<boolean>} - True if embedding was generated/updated, false if reused
   */
  async ensureProductEmbedding(product, forceSave = false) {
    const text = this.buildProductEmbeddingText(product);
    if (!text) return false;
    
    const textHash = this._hashText(text);

    const isCurrent = 
      product.embedding &&
      product.embedding.vector &&
      product.embedding.vector.length > 0 &&
      product.embedding.model === EMBEDDING_CONFIG.model &&
      product.embedding.version === EMBEDDING_CONFIG.version &&
      product.embedding.textHash === textHash;

    if (isCurrent) {
      return false; // Reused existing
    }

    // Need to generate new embedding
    await this.generateProductEmbedding(product);
    
    if (forceSave && typeof product.save === 'function') {
      await product.save();
    }
    
    return true; // Generated new
  }

  /**
   * Forces regeneration of the embedding regardless of current state.
   * @param {Object} product 
   */
  async refreshProductEmbedding(product, forceSave = false) {
    await this.generateProductEmbedding(product);
    if (forceSave && typeof product.save === 'function') {
      await product.save();
    }
    return true;
  }
}

module.exports = new ProductEmbeddingService();
