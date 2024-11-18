const express = require('express');
const router = express.Router();
const {
    getAllPredictionSummaryData,
    getPredictionSummaryByUserName,
    getPredictionSummaryByUserNameAndInterval,
} = require('../controllers/TotalPredictionSummaryController');

// Route to get all prediction summaries
router.get('/prediction-summary/all', getAllPredictionSummaryData);

// Route to get prediction summary by userName
router.get('/prediction-summary/:userName', getPredictionSummaryByUserName);

// Route to get prediction summary by userName and intervalType
router.get('/prediction-summary/:userName/:intervalType', getPredictionSummaryByUserNameAndInterval);

module.exports = router;
