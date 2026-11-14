# SmartChoice Catalog-500 Ingestion & Synchronization Guide

**Document:** `docs/CATALOG_INTEGRATION.md`  
**Phase:** Phase 2 — Catalog Integration, MongoDB Database Migration & Product Data Enrichment  
**Date:** November 2026  
**Status:** Implemented & Verified  

---

## 1. Overview & Architecture

The **Catalog Integration Pipeline** establishes the 500 Products Virtual Dataset Catalog (`authentic_packaged_food_catalog_500.xlsx`) as the foundational source of truth for product identity and category structure in SmartChoice.

The pipeline is implemented across four modular, single-responsibility services:
1. `backend/services/catalogValidationService.js`: Structural and data validation.
2. `backend/services/catalogNormalizationService.js`: Normalization without fabrication.
3. `backend/services/catalogImportService.js`: Reading, validation, and idempotent bulk upsert.
4. `backend/services/catalogSyncService.js`: Re-import and synchronization with source-priority policy.

```
+-----------------------------------------------------------------------------------+
|               CATALOG WORKBOOK (authentic_packaged_food_catalog_500.xlsx)         |
|                          (Configurable via CATALOG_EXCEL_PATH)                    |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                             catalogImportService.js                               |
|        - Reads workbook with SheetJS (xlsx)                                       |
|        - Selects 'Products Catalog' worksheet                                     |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                           catalogValidationService.js                             |
|        - Verifies 7 mandatory column headers                                      |
|        - Checks row data types, missing required values, duplicate IDs            |
|        - Produces structured validation report (rejects malformed records)        |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                          catalogNormalizationService.js                           |
|        - Cleans and trims whitespace, standardizes casing safely                  |
|        - Parses packaging size into servingSize and unit                          |
|        - Preserves original values in `catalog` subdocument                       |
|        - Sets nutritional and composition fields to null (zero fabrication)       |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                                 MONGODB ATLAS                                     |
|        - Safe idempotent bulkWrite upsert: { 'catalog.productId': id }            |
|        - $set: Updates identity, catalog metadata, sync timestamps                |
|        - $setOnInsert: Initializes nutrition, composition, enrichment lifecycle   |
|        - Partial Unique Index: { 'catalog.productId': 1 }                         |
+-----------------------------------------------------------------------------------+
```

---

## 2. Workbook Specification

- **File Path**: Configured via `process.env.CATALOG_EXCEL_PATH` (default: `D:\500Products\authentic_packaged_food_catalog_500.xlsx`).
- **Target Worksheet**: Exactly `'Products Catalog'`.
- **Mandatory Columns (7)**:
  1. `Product ID` (String, regex: `/^PKG_PRD_\d{4}$/`)
  2. `Category ID` (Integer, 1 to 25)
  3. `Category Name` (String)
  4. `Brand` (String)
  5. `Product Name` (String)
  6. `Packaging Size` (String)
  7. `Open Food Facts Query Term` (String)

---

## 3. Idempotent Ingestion & Source-Priority Policy

### 3.1 Idempotency Guarantee
The pipeline uses MongoDB's `bulkWrite` with `updateOne`:
```javascript
{
  filter: { 'catalog.productId': normalized.catalog.productId },
  update: {
    $set: {
      'catalog': normalized.catalog,
      'identity.name': normalized.identity.name,
      'identity.brand': normalized.identity.brand,
      'identity.categories': normalized.identity.categories,
      'identity.productType': normalized.identity.productType,
      'serving.servingSize': normalized.serving.servingSize,
      'serving.servingSizeUnit': normalized.serving.servingSizeUnit,
      'provenance.lastSyncAt': new Date()
    },
    $setOnInsert: {
      'identity.barcode': null,
      'media': normalized.media,
      'ingredients': normalized.ingredients,
      'nutrition': normalized.nutrition,
      'processing': normalized.processing,
      'commerce': normalized.commerce,
      'enrichment': normalized.enrichment,
      'dataQuality': normalized.dataQuality
    }
  },
  upsert: true
}
```

### 3.2 Source-Priority Rules
1. **Catalog Updates**: Changes to brand, product name, packaging size, or category in the Excel workbook update the corresponding `catalog` and `identity` fields during re-import.
2. **Enriched Field Protection**: Enriched nutrition metrics, ingredients, allergens, NOVA processing scores, and media URLs populated by Open Food Facts are preserved in existing documents because they are only initialized in `$setOnInsert`. Re-importing the workbook **never** overwrites verified enrichment data with nulls.

---

## 4. Execution Commands

### Run Validation (Dry Run)
```powershell
cd backend
node -e "require('dotenv').config({ path: '../.env' }); require('./services/catalogImportService').validateWorkbook().then(console.log);"
```

### Execute Catalog Import
```powershell
cd backend
node -e "require('dotenv').config({ path: '../.env' }); const m = require('mongoose'); m.connect(process.env.MONGODB_URI).then(async () => { const res = await require('./services/catalogImportService').importCatalog(); console.log(res); await m.disconnect(); });"
```

### Run Full Test Suite
```powershell
cd backend
node tests/catalogImport.test.js
node tests/catalogDatabase.test.js
node tests/productEnrichment.test.js
```
