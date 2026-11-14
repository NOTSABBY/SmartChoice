const express = require('express');
const router = express.Router();
const { requireAdminAuth } = require('../middleware/authMiddleware');
const {
  getCatalogStatistics,
  listCatalogProducts,
  getCatalogProductById,
  listCategories,
  validateWorkbook,
  importCatalog,
  syncCatalog,
  triggerEnrichment,
  getEnrichmentStatus
} = require('../controllers/catalogController');

// Public Catalog APIs
router.get('/statistics', getCatalogStatistics);
router.get('/products', listCatalogProducts);
router.get('/products/:id', getCatalogProductById);
router.get('/categories', listCategories);

// Protected Admin APIs
router.post('/admin/validate', requireAdminAuth, validateWorkbook);
router.post('/admin/import', requireAdminAuth, importCatalog);
router.post('/admin/sync', requireAdminAuth, syncCatalog);
router.post('/admin/enrich', requireAdminAuth, triggerEnrichment);
router.get('/admin/enrich/status', requireAdminAuth, getEnrichmentStatus);

module.exports = router;
