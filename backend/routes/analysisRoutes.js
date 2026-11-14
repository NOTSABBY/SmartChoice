const express = require('express');
const router = express.Router();
const analysisController = require('../controllers/analysisController');

// Public threshold specification endpoint
router.get('/thresholds', analysisController.getThresholdsReference);

// Product analysis endpoint
router.get('/:id', analysisController.getProductAnalysis);

module.exports = router;