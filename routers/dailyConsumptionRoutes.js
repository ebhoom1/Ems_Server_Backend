// routes/dailyConsumptionRoutes.js
const express = require('express');
const router = express.Router();
const {
  saveDailyConsumption,
  getDailyConsumptions,
} = require('../controllers/dailyConsumptionController');

// POST endpoint to save or update a daily consumption record
router.post('/save-daily-consumption', saveDailyConsumption);

// GET endpoint to retrieve daily consumption records (optionally filtered by userName)
router.get('/daily-consumption', getDailyConsumptions);

module.exports = router;
