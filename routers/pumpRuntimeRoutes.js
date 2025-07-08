const express = require('express');
const router = express.Router();
const { getDailyPumpRuntime } = require('../controllers/pumpRuntimeController');

// GET runtime for all pumps on a given date
router.get('/runtime/:product_id/:userName/:date', getDailyPumpRuntime);

module.exports = router;