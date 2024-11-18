const express = require('express');
const router = express.Router();
const {
    getAllSummary,
    getSummaryByUserName,
    getSummaryByUserNameAndInterval,
} = require('../controllers/TotalConsumptionSummaryController');

// Route to get all summaries
router.get('/allSummary', getAllSummary);

// Route to get summary by userName
router.get('/summary/:userName', getSummaryByUserName);


// Route to get summary by userName, stackName, and intervalType
router.get('/summary/:userName/:intervalType', getSummaryByUserNameAndInterval);

module.exports = router;
