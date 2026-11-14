const fs = require('fs');
const xlsx = require('xlsx');
const catalogConfig = require('../config/catalogConfig');
const catalogValidationService = require('./catalogValidationService');
const catalogNormalizationService = require('./catalogNormalizationService');
const Product = require('../models/Product');

class CatalogImportService {
  /**
   * Reads and parses the Excel workbook from disk.
   * @param {string} [customPath] - Optional custom path override
   * @returns {Object} SheetJS workbook
   */
  readWorkbook(customPath) {
    const filePath = customPath || catalogConfig.EXCEL_PATH;
    if (!fs.existsSync(filePath)) {
      throw new Error(`Catalog Excel file not found at path: ${filePath}`);
    }
    return xlsx.readFile(filePath);
  }

  /**
   * Dry-run validation of the catalog workbook without writing to MongoDB.
   * @param {string} [customPath]
   * @returns {Object} Validation summary report
   */
  async validateWorkbook(customPath) {
    const workbook = this.readWorkbook(customPath);
    
    // Structure check
    const structResult = catalogValidationService.validateWorkbookStructure(workbook);
    if (!structResult.isValid) {
      return {
        success: false,
        phase: 'STRUCTURE_VALIDATION',
        errors: structResult.errors
      };
    }

    const sheet = workbook.Sheets[structResult.sheetName];
    const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: null });
    
    if (rawRows.length === 0) {
      return {
        success: false,
        phase: 'EMPTY_SHEET',
        errors: ['Worksheet contains no data rows.']
      };
    }

    // Header check
    const headers = Object.keys(rawRows[0]);
    const headerResult = catalogValidationService.validateHeaders(headers);
    if (!headerResult.isValid) {
      return {
        success: false,
        phase: 'HEADER_VALIDATION',
        missingHeaders: headerResult.missingHeaders,
        extraHeaders: headerResult.extraHeaders
      };
    }

    // Record check
    const recordsResult = catalogValidationService.validateRecords(rawRows);

    return {
      success: recordsResult.isFullyValid,
      phase: 'RECORD_VALIDATION',
      filePath: customPath || catalogConfig.EXCEL_PATH,
      sheetName: structResult.sheetName,
      totalRowsExtracted: rawRows.length,
      validRecordsCount: recordsResult.validRecordsCount,
      invalidRecordsCount: recordsResult.invalidRecordsCount,
      duplicateProductIds: recordsResult.duplicateProductIds,
      missingFieldCounts: recordsResult.missingFieldCounts,
      rejectedRecords: recordsResult.invalid
    };
  }

  /**
   * Executes full import of the Excel workbook into MongoDB Atlas.
   * Idempotent: Upserts based on `catalog.productId` without wiping enrichment data.
   * @param {Object} [options]
   * @param {string} [options.filePath]
   * @param {boolean} [options.dryRun]
   * @returns {Promise<Object>} Import execution summary
   */
  async importCatalog(options = {}) {
    const validation = await this.validateWorkbook(options.filePath);
    if (!validation.success) {
      throw new Error(`Catalog validation failed: ${JSON.stringify(validation.errors || validation.rejectedRecords)}`);
    }

    if (options.dryRun) {
      return {
        dryRun: true,
        message: 'Validation passed in dryRun mode. Zero database writes performed.',
        validationSummary: validation
      };
    }

    const workbook = this.readWorkbook(options.filePath);
    const sheet = workbook.Sheets[catalogConfig.EXPECTED_WORKSHEET];
    const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: null });

    const recordsResult = catalogValidationService.validateRecords(rawRows);
    const validRows = recordsResult.validRecords;

    const operations = validRows.map(row => {
      const normalized = catalogNormalizationService.normalizeRecord(row);
      const prodId = normalized.catalog.productId;

      // Safe Upsert Strategy:
      // $set updates catalog identity & sync timestamps
      // $setOnInsert sets initial blank nutrition/enrichment only if new document
      return {
        updateOne: {
          filter: { 'catalog.productId': prodId },
          update: {
            $set: {
              'catalog': normalized.catalog,
              'identity.name': normalized.identity.name,
              'identity.brand': normalized.identity.brand,
              'identity.categories': normalized.identity.categories,
              'identity.productType': normalized.identity.productType,
              'serving.servingSize': normalized.serving.servingSize,
              'serving.servingSizeUnit': normalized.serving.servingSizeUnit,
              'provenance.sourceRecordId': prodId,
              'provenance.lastSyncAt': new Date()
            },
            $setOnInsert: {
              'identity.barcode': null,
              'identity.dietaryType': 'UNKNOWN',
              'media': normalized.media,
              'ingredients': normalized.ingredients,
              'nutrition': normalized.nutrition,
              'processing': normalized.processing,
              'commerce': normalized.commerce,
              'provenance.originalDataset': normalized.provenance.originalDataset,
              'provenance.datasetVersion': normalized.provenance.datasetVersion,
              'enrichment': normalized.enrichment,
              'source': normalized.source,
              'dataQuality': normalized.dataQuality
            }
          },
          upsert: true
        }
      };
    });

    const bulkResult = await Product.bulkWrite(operations, { ordered: false });

    // Category distribution verification
    const categoryDistribution = await Product.aggregate([
      { $match: { 'catalog.productId': { $exists: true } } },
      { $group: { _id: '$catalog.categoryName', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const totalStored = await Product.countDocuments({ 'catalog.productId': { $exists: true } });

    return {
      success: true,
      timestamp: new Date().toISOString(),
      dataset: catalogConfig.DATASET_NAME,
      datasetVersion: catalogConfig.DATASET_VERSION,
      totalWorkbookRows: rawRows.length,
      validRecordsProcessed: validRows.length,
      databaseResults: {
        matchedCount: bulkResult.matchedCount,
        modifiedCount: bulkResult.modifiedCount,
        upsertedCount: bulkResult.upsertedCount,
        totalStoredCatalogProducts: totalStored
      },
      categoryDistribution: categoryDistribution.map(c => ({ category: c._id, count: c.count })),
      idempotencyCheck: {
        isIdempotent: bulkResult.upsertedCount === 0 || bulkResult.upsertedCount === validRows.length
      }
    };
  }
}

module.exports = new CatalogImportService();
