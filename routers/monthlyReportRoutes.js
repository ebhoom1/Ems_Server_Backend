const express = require('express');
const router = express.Router();
const { 
  saveOrUpdateReport, 
  getReport 
} = require('../controllers/monthlyReportController'); // Adjust path

// You should add authentication middleware here to protect these routes
// const { protect, admin } = require('../middleware/authMiddleware');

// @route   POST /api/monthly-report
// @desc    Save or update a report
// @access  Private (e.g., protect)
router.post('/', saveOrUpdateReport);

// @route   GET /api/monthly-report/:userName/:year/:month
// @desc    Get a specific report
// @access  Private (e.g., protect)
router.get('/:userName/:year/:month', getReport);

module.exports = router;