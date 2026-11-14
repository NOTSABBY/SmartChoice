const catalogConfig = require('../config/catalogConfig');

class CatalogValidationService {
  /**
   * Validates the workbook sheets and headers against the required schema.
   * @param {Object} workbook - SheetJS workbook object
   * @returns {Object} { isValid: boolean, errors: string[], sheetName: string }
   */
  validateWorkbookStructure(workbook) {
    const errors = [];
    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      return { isValid: false, errors: ['Workbook is empty or contains no sheets.'] };
    }

    const expectedSheet = catalogConfig.EXPECTED_WORKSHEET;
    if (!workbook.SheetNames.includes(expectedSheet)) {
      errors.push(`Missing expected worksheet "${expectedSheet}". Found: [${workbook.SheetNames.join(', ')}]`);
      return { isValid: false, errors, sheetName: null };
    }

    return { isValid: true, errors: [], sheetName: expectedSheet };
  }

  /**
   * Validates raw header row from the worksheet.
   * @param {Array<string>} headers - Array of header strings
   * @returns {Object} { isValid: boolean, missingHeaders: string[], extraHeaders: string[] }
   */
  validateHeaders(headers) {
    const normalizedActual = (headers || []).map(h => (typeof h === 'string' ? h.trim() : ''));
    const missingHeaders = catalogConfig.EXPECTED_HEADERS.filter(h => !normalizedActual.includes(h));
    const extraHeaders = normalizedActual.filter(h => h && !catalogConfig.EXPECTED_HEADERS.includes(h));

    return {
      isValid: missingHeaders.length === 0,
      missingHeaders,
      extraHeaders
    };
  }

  /**
   * Validates an array of extracted raw row objects.
   * @param {Array<Object>} rows - Raw row records
   * @returns {Object} Structured validation report
   */
  validateRecords(rows) {
    const total = rows.length;
    const valid = [];
    const invalid = [];
    const seenProductIds = new Set();
    const duplicateProductIds = [];
    const missingFieldCounts = {
      productId: 0,
      productName: 0,
      brand: 0,
      categoryId: 0,
      categoryName: 0,
      packagingSize: 0,
      queryTerm: 0
    };

    rows.forEach((row, index) => {
      const rowNumber = index + 2; // Accounting for 1-based index and header row
      const errors = [];

      const rawId = row['Product ID'];
      const rawCatId = row['Category ID'];
      const rawCatName = row['Category Name'];
      const rawBrand = row['Brand'];
      const rawName = row['Product Name'];
      const rawPack = row['Packaging Size'];
      const rawQuery = row['Open Food Facts Query Term'];

      // 1. Product ID check
      if (!rawId || typeof rawId !== 'string' || rawId.trim().length === 0) {
        errors.push('Missing Product ID');
        missingFieldCounts.productId++;
      } else {
        const trimmedId = rawId.trim();
        if (!/^PKG_PRD_\d{4}$/.test(trimmedId)) {
          errors.push(`Malformed Product ID format: "${trimmedId}". Expected "PKG_PRD_XXXX"`);
        }
        if (seenProductIds.has(trimmedId)) {
          duplicateProductIds.push(trimmedId);
          errors.push(`Duplicate Product ID: "${trimmedId}"`);
        } else {
          seenProductIds.add(trimmedId);
        }
      }

      // 2. Product Name check
      if (!rawName || typeof rawName !== 'string' || rawName.trim().length === 0) {
        errors.push('Missing Product Name');
        missingFieldCounts.productName++;
      }

      // 3. Brand check
      if (!rawBrand || typeof rawBrand !== 'string' || rawBrand.trim().length === 0) {
        errors.push('Missing Brand');
        missingFieldCounts.brand++;
      }

      // 4. Category ID check
      const catIdNum = Number(rawCatId);
      if (rawCatId === undefined || rawCatId === null || isNaN(catIdNum) || catIdNum < 1 || catIdNum > 25) {
        errors.push(`Invalid Category ID: "${rawCatId}". Expected integer between 1 and 25.`);
        missingFieldCounts.categoryId++;
      }

      // 5. Category Name check
      if (!rawCatName || typeof rawCatName !== 'string' || rawCatName.trim().length === 0) {
        errors.push('Missing Category Name');
        missingFieldCounts.categoryName++;
      }

      // 6. Packaging size check
      if (!rawPack || typeof rawPack !== 'string' || rawPack.trim().length === 0) {
        missingFieldCounts.packagingSize++;
      }

      // 7. Query term check
      if (!rawQuery || typeof rawQuery !== 'string' || rawQuery.trim().length === 0) {
        missingFieldCounts.queryTerm++;
      }

      if (errors.length > 0) {
        invalid.push({
          rowNumber,
          productId: rawId || null,
          productName: rawName || null,
          errors,
          raw: row
        });
      } else {
        valid.push(row);
      }
    });

    return {
      totalRecords: total,
      validRecordsCount: valid.length,
      invalidRecordsCount: invalid.length,
      duplicateProductIds: Array.from(new Set(duplicateProductIds)),
      missingFieldCounts,
      validRecords: valid,
      invalidRecords: invalid,
      isFullyValid: invalid.length === 0
    };
  }
}

module.exports = new CatalogValidationService();
