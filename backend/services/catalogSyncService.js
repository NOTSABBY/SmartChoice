const catalogImportService = require('./catalogImportService');
const Product = require('../models/Product');

class CatalogSyncService {
  /**
   * Synchronizes the database catalog with the workbook.
   * Preserves existing enriched data while updating source identity fields.
   * @param {Object} [options]
   * @returns {Promise<Object>} Sync report
   */
  async syncCatalog(options = {}) {
    // 1. Run the safe idempotent import
    const importResult = await catalogImportService.importCatalog(options);

    // 2. Query status breakdown
    const enrichmentBreakdown = await Product.aggregate([
      { $match: { 'catalog.productId': { $exists: true } } },
      { $group: { _id: '$enrichment.status', count: { $sum: 1 } } }
    ]);

    const totalCatalog = await Product.countDocuments({ 'catalog.productId': { $exists: true } });

    return {
      success: true,
      action: 'SYNC',
      timestamp: new Date().toISOString(),
      importResult,
      totalCatalogProducts: totalCatalog,
      enrichmentStatusBreakdown: enrichmentBreakdown.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {})
    };
  }
}

module.exports = new CatalogSyncService();
