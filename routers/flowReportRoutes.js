const express = require('express');
const router = express.Router();
const { 
  saveOrUpdateReport, 
  getReport 
} = require('../controllers/flowReportController'); // Adjust path

// Add your auth middleware here
// const { protect } = require('../middleware/authMiddleware');

// @route   POST /api/flow-report
// @desc    Save or update a flow report
// @access  Private (e.g., protect)
router.post('/', saveOrUpdateReport);

// @route   GET /api/flow-report/:userName/:year/:month
// @desc    Get a specific flow report
// @access  Private (e.g., protect)
router.get('/:userName/:year/:month', getReport);

module.exports = router;